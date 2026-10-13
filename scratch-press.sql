-- =============================================================================
-- scratch-press.sql : Press committees, the Press Desk and press releases
-- (owner's first draft, 12 Oct 2026). APPLIED 12 Oct 2026 as migration press_committees. Apply only AFTER the client
-- that reads `session_broadcasts.source` is deployed (see the note at step 2).
--
-- What it adds
--   1. conference_committees.committee_type may be 'press' (a fifth type: seats
--      are outlets or journalists, entered like custom seats).
--   2. session_broadcasts.source ('organiser' | 'press') and .author_label (the
--      outlet / seat name a press release is signed with). Organisers can still
--      only insert 'organiser' rows; press rows are written by
--      send_press_release() alone.
--   3. press_releases: one row per release (the 3-a-day limit and the record).
--      RLS on, no policies, no grants.
--   4. _press_access(conference, user): who is press here (owner only).
--   5. my_press_access(p_conference)  : light check the You tab uses.
--   6. press_desk(p_conference)        : the read-only live view of every room.
--   7. send_press_release(p_conference, p_message, p_image_url)
--
-- Who is press at a conference
--   press_seat   : a conference_allocations row of a committee_type = 'press'
--                  committee, held by the caller, whose application (when it has
--                  one) is accepted / assigned / checked-in. Signs as the seat's
--                  name ("BBC").
--   press_chair  : the caller is in that committee's chair_user_ids. Signs as
--                  the committee's acronym, else its name.
--   observer     : an accepted / assigned / checked-in observer application at
--                  the conference. Reads the desk; sends nothing.
--   Nobody else (organisers included: they have the live wall).
--
-- What the desk returns per committee (and nothing else)
--   name, acronym, emblem, type; whether a room exists and its phase, suspended
--   / ended, topic, the caucus type / purpose / motion name; the floor speaker
--   and the next 3 of the list the room is using (country + crest only); the
--   motions on the floor (type, proposer, topic, times, order); documents that
--   are introduced, passed or failed (code, title, type, status, sponsors, file
--   url / name, text, voting_now). NEVER chat, feedback, scores, chair notes,
--   votes or anything from committees.settings (the chair code lives there).
-- =============================================================================

begin;

-- 1. The fifth committee type ------------------------------------------------
alter table public.conference_committees
  drop constraint if exists conference_committees_committee_type_check;
alter table public.conference_committees
  add constraint conference_committees_committee_type_check
  check (committee_type = any (array['general-assembly','specialised','crisis','custom','press']::text[]));

-- 2. Who a broadcast is from --------------------------------------------------
-- Old bundles read every row as a Secretariat message; the new client labels
-- source = 'press' rows "Press · <author_label>" and keeps them off the chairs'
-- sticky cards. Deploy the client first.
alter table public.session_broadcasts
  add column if not exists source text not null default 'organiser',
  add column if not exists author_label text;
alter table public.session_broadcasts
  drop constraint if exists session_broadcasts_source_check;
alter table public.session_broadcasts
  add constraint session_broadcasts_source_check
  check (source in ('organiser', 'press'));
alter table public.session_broadcasts
  drop constraint if exists session_broadcasts_author_label_check;
alter table public.session_broadcasts
  add constraint session_broadcasts_author_label_check
  check (
    (source = 'organiser' and author_label is null)
    or (source = 'press' and author_label is not null and char_length(btrim(author_label)) between 1 and 80 and kind = 'informational')
  );

-- Organisers keep sending only their own kind (no forged "Press · X" rows).
drop policy if exists "Organizers send broadcasts" on public.session_broadcasts;
create policy "Organizers send broadcasts" on public.session_broadcasts
  for insert
  with check (
    conference_id is not null
    and is_conference_organizer(conference_id)
    and source = 'organiser'
    and author_label is null
  );

-- 3. The record of releases (and the 3 a day) --------------------------------
create table if not exists public.press_releases (
  id            uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  author_id     uuid references auth.users(id) on delete set null,
  author_label  text not null check (char_length(btrim(author_label)) between 1 and 80),
  author_role   text not null check (author_role in ('press_seat', 'press_chair')),
  message       text not null check (char_length(btrim(message)) between 1 and 600),
  image_url     text,
  sent_to       integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists press_releases_author_time_idx
  on public.press_releases (conference_id, author_id, created_at desc);
alter table public.press_releases enable row level security;
revoke all on public.press_releases from public, anon, authenticated;

-- 4. Who is press here (owner only) ------------------------------------------
create or replace function public._press_access(p_conference uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with seat as (
    select a.country_name as label, cc.id as committee_id
      from conference_allocations a
      join conference_committees cc on cc.id = a.conference_committee_id
     where cc.conference_id = p_conference
       and cc.committee_type = 'press'
       and a.user_id = p_user
       and (
         a.application_id is null
         or exists (select 1 from applications ap
                     where ap.id = a.application_id
                       and ap.status in ('accepted', 'assigned', 'checked-in'))
       )
     order by a.created_at, a.seat
     limit 1
  ), chair as (
    select coalesce(nullif(btrim(cc.abbreviation), ''), cc.name) as label, cc.id as committee_id
      from conference_committees cc
     where cc.conference_id = p_conference
       and cc.committee_type = 'press'
       and p_user = any (coalesce(cc.chair_user_ids, '{}'::uuid[]))
     order by cc.created_at
     limit 1
  ), obs as (
    select 1 from applications ap
     where ap.conference_id = p_conference
       and ap.user_id = p_user
       and ap.role = 'observer'
       and ap.status in ('accepted', 'assigned', 'checked-in')
     limit 1
  )
  select case
    when p_user is null then jsonb_build_object('eligible', false)
    when exists (select 1 from seat) then
      jsonb_build_object('eligible', true, 'role', 'press_seat', 'can_release', true,
                         'label', (select label from seat), 'press_committee_id', (select committee_id from seat))
    when exists (select 1 from chair) then
      jsonb_build_object('eligible', true, 'role', 'press_chair', 'can_release', true,
                         'label', (select label from chair), 'press_committee_id', (select committee_id from chair))
    when exists (select 1 from obs) then
      jsonb_build_object('eligible', true, 'role', 'observer', 'can_release', false, 'label', null)
    else jsonb_build_object('eligible', false)
  end;
$$;
revoke all on function public._press_access(uuid, uuid) from public, anon, authenticated;

-- The release allowance: 3 in any rolling 24 hours, per person per conference.
create or replace function public._press_allowance(p_conference uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recent as (
    select created_at from press_releases
     where conference_id = p_conference and author_id = p_user
       and created_at > now() - interval '24 hours'
  )
  select jsonb_build_object(
    'releases_left', greatest(0, 3 - (select count(*) from recent))::int,
    'next_release_at', case when (select count(*) from recent) >= 3
                            then (select min(created_at) + interval '24 hours' from recent) end
  );
$$;
revoke all on function public._press_allowance(uuid, uuid) from public, anon, authenticated;

-- 5. The light check ----------------------------------------------------------
create or replace function public.my_press_access(p_conference uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null or p_conference is null then
    return jsonb_build_object('ok', true, 'eligible', false);
  end if;
  v := _press_access(p_conference, v_uid);
  if not coalesce((v->>'eligible')::boolean, false) then
    return jsonb_build_object('ok', true, 'eligible', false);
  end if;
  if coalesce((v->>'can_release')::boolean, false) then
    v := v || _press_allowance(p_conference, v_uid);
  end if;
  return jsonb_build_object('ok', true) || v;
end;
$$;
revoke all on function public.my_press_access(uuid) from public, anon;
grant execute on function public.my_press_access(uuid) to authenticated;

-- 6. The desk -----------------------------------------------------------------
create or replace function public.press_desk(p_conference uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_rooms jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in to open the Press Desk.');
  end if;
  if p_conference is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'We could not find that conference.');
  end if;
  v_access := _press_access(p_conference, v_uid);
  if not coalesce((v_access->>'eligible')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'The Press Desk is for the press and observers of this conference.');
  end if;
  if coalesce((v_access->>'can_release')::boolean, false) then
    v_access := v_access || _press_allowance(p_conference, v_uid);
  end if;

  select coalesce(jsonb_agg(room order by room->>'sort'), '[]'::jsonb) into v_rooms
  from (
    select jsonb_build_object(
      'sort', (case when cc.committee_type = 'press' then '1' else '0' end) || lower(coalesce(nullif(btrim(cc.abbreviation), ''), cc.name)),
      'id', cc.id,
      'name', cc.name,
      'abbreviation', cc.abbreviation,
      'logo_url', cc.logo_url,
      'committee_type', cc.committee_type,
      'session', case when c.id is null then null else jsonb_build_object(
        'phase', c.phase,
        'suspended', c.suspended_at is not null,
        'ended', c.ended_at is not null,
        'topic', c.topic,
        'caucus', case when c.caucus is null or jsonb_typeof(c.caucus) <> 'object' then null else jsonb_build_object(
          'type', c.caucus->>'type',
          'purpose', c.caucus->>'purpose',
          'motion_label', c.caucus->>'motionLabel',
          'is_consultation', coalesce((c.caucus->>'isConsultation')::boolean, false)
        ) end,
        'speaker', (
          select jsonb_build_object('country', cs.country, 'logo_url', d.logo_url)
            from current_speaker cs
            left join delegates d on d.id = cs.delegate_id
           where cs.committee_id = c.id and cs.delegate_id is not null
           limit 1
        ),
        'next', coalesce((
          select jsonb_agg(jsonb_build_object('country', x.country, 'logo_url', x.logo_url) order by x.position, x.created_at, x.id)
            from (
              select sl.country, d.logo_url, sl.position, sl.created_at, sl.id
                from speakers_list sl
                left join delegates d on d.id = sl.delegate_id
               where sl.committee_id = c.id
                 and sl.list_type = case
                       when c.phase = 'moderated-caucus' or (c.caucus->>'type') = 'moderated' then 'caucus'
                       else 'gsl' end
                 and sl.delegate_id is distinct from (select cs2.delegate_id from current_speaker cs2 where cs2.committee_id = c.id)
               order by sl.position, sl.created_at, sl.id
               limit 3
            ) x
        ), '[]'::jsonb),
        'motions', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', m.id, 'type', m.type, 'proposed_by', m.proposed_by, 'topic', m.topic,
                   'total_time', m.total_time, 'speaking_time', m.speaking_time, 'tour_order', m.tour_order)
                 order by m.disruptiveness desc nulls last, m.created_at)
            from motions m
           where m.committee_id = c.id
             and m.type not in ('join-request', 'gsl-request')
        ), '[]'::jsonb),
        'documents', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', doc.id, 'doc_code', doc.doc_code, 'title', doc.title, 'type', doc.type,
                   'status', doc.status, 'sponsors', coalesce(to_jsonb(doc.sponsors), '[]'::jsonb),
                   'file_url', doc.file_url, 'file_name', doc.file_name, 'content', doc.content,
                   'voting_now', coalesce(doc.vote_state->>'status', '') in ('voting', 'rights-speakers'))
                 order by doc.type, doc.doc_code, doc.created_at)
            from documents doc
           where doc.committee_id = c.id
             and doc.status in ('introduced', 'passed', 'failed')
        ), '[]'::jsonb)
      ) end
    ) as room
    from conference_committees cc
    left join committees c on c.id = cc.session_id
    where cc.conference_id = p_conference
  ) r;

  return jsonb_build_object('ok', true, 'now', now(), 'rooms', v_rooms) || v_access;
end;
$$;
revoke all on function public.press_desk(uuid) from public, anon;
grant execute on function public.press_desk(uuid) to authenticated;

-- 7. Sending a release ----------------------------------------------------------
create or replace function public.send_press_release(
  p_conference uuid,
  p_message text,
  p_image_url text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_allow jsonb;
  v_msg text := btrim(coalesce(p_message, ''));
  v_img text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_label text;
  v_release uuid;
  v_sent int := 0;
  v_rooms int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in to send a press release.');
  end if;
  v_access := _press_access(p_conference, v_uid);
  if not coalesce((v_access->>'can_release')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only the press of this conference can send a press release.');
  end if;
  if char_length(v_msg) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty', 'message', 'Write your press release first.');
  end if;
  if char_length(v_msg) > 600 then
    return jsonb_build_object('ok', false, 'reason', 'too_long', 'message', 'A press release can be up to 600 characters.');
  end if;
  -- The image: only what the composer uploads, in this conference's own path.
  if v_img is not null and v_img !~ (
       '^https://luruhkwrgisytejswlas\.supabase\.co/storage/v1/object/public/conference-assets/broadcasts/'
       || p_conference::text || '-[0-9]{10,16}\.[a-z0-9]{1,8}$') then
    return jsonb_build_object('ok', false, 'reason', 'image', 'message', 'That image could not be attached. Upload it again.');
  end if;

  -- One release at a time per person, so two quick presses cannot both pass the limit.
  perform pg_advisory_xact_lock(hashtext('press_release:' || p_conference::text || ':' || v_uid::text));
  v_allow := _press_allowance(p_conference, v_uid);
  if (v_allow->>'releases_left')::int <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'limit',
      'message', 'You have sent 3 press releases in the last 24 hours.',
      'next_release_at', v_allow->'next_release_at', 'releases_left', 0);
  end if;

  select count(*) into v_rooms
    from conference_committees cc
    join committees c on c.id = cc.session_id
   where cc.conference_id = p_conference and c.ended_at is null;
  if v_rooms = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_rooms',
      'message', 'No committee room is open yet. Send it once the rooms have started.');
  end if;

  v_label := left(btrim(v_access->>'label'), 80);
  insert into press_releases (conference_id, author_id, author_label, author_role, message, image_url)
  values (p_conference, v_uid, v_label, v_access->>'role', v_msg, v_img)
  returning id into v_release;

  -- One informational row per open room. expires_at = now: the release is never a
  -- sticky chair card, not even in a bundle that predates the source column.
  insert into session_broadcasts (committee_id, conference_id, kind, message, image_url, action, action_at,
                                  created_by, expires_at, source, author_label)
  select c.id, p_conference, 'informational', v_msg, v_img, null, null, v_uid, now(), 'press', v_label
    from conference_committees cc
    join committees c on c.id = cc.session_id
   where cc.conference_id = p_conference and c.ended_at is null;
  get diagnostics v_sent = row_count;

  update press_releases set sent_to = v_sent where id = v_release;

  return jsonb_build_object('ok', true, 'sent_to', v_sent, 'release_id', v_release)
         || _press_allowance(p_conference, v_uid);
end;
$$;
revoke all on function public.send_press_release(uuid, text, text) from public, anon;
grant execute on function public.send_press_release(uuid, text, text) to authenticated;

commit;

-- =============================================================================
-- Rolled-back test (run as one block AFTER the above is applied; it writes
-- nothing that survives). Replace nothing: it builds its own conference.
-- =============================================================================
/*
begin;
do $t$
declare
  v_org uuid; v_press uuid; v_obs uuid; v_stranger uuid;
  v_conf uuid := gen_random_uuid();
  v_cc_press uuid := gen_random_uuid();
  v_cc_ga uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  r jsonb;
begin
  select id into v_org from auth.users order by created_at limit 1;
  select id into v_press from auth.users order by created_at offset 1 limit 1;
  select id into v_obs from auth.users order by created_at offset 2 limit 1;
  select id into v_stranger from auth.users order by created_at offset 3 limit 1;

  -- Other triggers on conferences may want more; this is every NOT NULL column without a default (12 Oct 2026).
  insert into conferences (id, slug, organizer_id, full_name, acronym, contact_email, student_level, country, city, format, expected_delegates, is_demo)
    values (v_conf, 'press-test-' || left(v_conf::text, 8), v_org, 'Press Test Conference', 'PTC', 'press-test@gavelling.com',
            'university', 'United Kingdom', 'London', 'in-person', 50, true);
  insert into conference_committees (id, conference_id, name, abbreviation, topics, committee_type, total_slots)
    values (v_cc_press, v_conf, 'International Press Corps', 'IPC', array['News'], 'press', 5),
           (v_cc_ga, v_conf, 'General Assembly', 'GA', array['Climate'], 'general-assembly', 5);
  insert into committees (id, code, name, topic, phase, session_origin) values (v_room, 'PTEST1', 'GA', 'Climate', 'speakers-list', 'conference');
  update conference_committees set session_id = v_room where id = v_cc_ga;
  insert into conference_allocations (conference_committee_id, conference_id, user_id, country_code, country_name, seat)
    values (v_cc_press, v_conf, v_press, 'BBC', 'BBC', 1);
  insert into applications (conference_id, user_id, role, status) values (v_conf, v_obs, 'observer', 'accepted');
  insert into documents (committee_id, title, type, status, content) values
    (v_room, 'Draft on climate', 'draft-resolution', 'introduced', 'Text'),
    (v_room, 'Secret draft', 'working-paper', 'submitted', 'Hidden');

  -- the press seat
  perform set_config('request.jwt.claims', json_build_object('sub', v_press, 'role', 'authenticated')::text, true);
  r := press_desk(v_conf);
  raise notice 'press desk: role=% rooms=% docs=%', r->>'role', jsonb_array_length(r->'rooms'),
    (select jsonb_array_length(x->'session'->'documents') from jsonb_array_elements(r->'rooms') x where x->>'id' = v_cc_ga::text);
  assert r->>'role' = 'press_seat' and (r->>'can_release')::boolean;
  assert not (r::text like '%Secret draft%'), 'submitted paper leaked';
  assert not (r::text like '%chairJoinSuffix%'), 'settings leaked';
  r := send_press_release(v_conf, 'Breaking: GA opens debate', null);
  assert (r->>'ok')::boolean and (r->>'sent_to')::int = 1, r::text;
  assert exists (select 1 from session_broadcasts where committee_id = v_room and source = 'press' and author_label = 'BBC');
  r := send_press_release(v_conf, 'Two', null);
  r := send_press_release(v_conf, 'Three', null);
  r := send_press_release(v_conf, 'Four', null);
  assert r->>'reason' = 'limit', r::text;
  r := send_press_release(v_conf, 'bad image', 'https://evil.example/x.png');
  assert r->>'reason' in ('image', 'limit'), r::text;

  -- the observer reads, sends nothing
  perform set_config('request.jwt.claims', json_build_object('sub', v_obs, 'role', 'authenticated')::text, true);
  r := press_desk(v_conf);
  assert (r->>'ok')::boolean and r->>'role' = 'observer' and not (r->>'can_release')::boolean, r::text;
  r := send_press_release(v_conf, 'hello', null);
  assert r->>'reason' = 'denied', r::text;

  -- a stranger gets nothing
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  r := press_desk(v_conf);
  assert r->>'reason' = 'denied', r::text;
  r := my_press_access(v_conf);
  assert not (r->>'eligible')::boolean, r::text;

  raise notice 'press tests passed';
end
$t$;
rollback;
*/
