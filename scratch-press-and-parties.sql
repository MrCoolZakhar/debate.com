-- =============================================================================
-- scratch-press-and-parties.sql
--
-- NOT APPLIED. Drafted 23 Oct 2026 (owner approved every item the same day).
-- The lead applies it through the chat's Supabase work, section by section, in
-- this order. Every section ends with a READ-ONLY check. The client works before
-- and after: it feature-detects every function and column below (PGRST202 /
-- 42883 for a function, 42703 / PGRST204 for a column) and falls back to what
-- it did before.
--
-- Sections
--   K1   Party colour and short name on delegates (+ start_my_chair_session, backfill)
--   P4   my_live_rooms carries committee_type (reporters go to the Press Desk)
--   PA   press_releases: status, chosen rooms; the approval switch
--   PB   _press_allowance: pending + sent count, rejected gives the slot back
--   PC   _press_deliver + send_press_release(p_committees) (P5: no press room)
--   PD   review_press_release, set_press_release_approval
--   PE   press_releases_board (P6: the reporter's history, the chair's queue)
--   PF   press_desk: seat_logos (P8), press_room (Join the press room), approval
--   P7   Release photos cannot be deleted or overwritten once used
--   T    TEST SEND (separate, last): ONE email to wearegavelling@gmail.com
--
-- Nothing here calls a sending function. Section T is a single INSERT to the
-- team inbox and is run by hand, once, only when the lead decides to.
-- =============================================================================


-- =============================================================================
-- K1. A seat's party in its live room
-- Most groups have a colour and a short name but no crest, so party seats drew
-- initials. The room now carries both, flattened at seed time like logo_url.
-- Nullable, additive; standalone rooms never set them.
-- =============================================================================

alter table public.delegates
  add column if not exists group_color text,
  add column if not exists group_short text;

-- start_my_chair_session: the live body of 23 Oct 2026, unchanged except the
-- delegates insert, which now also writes group_color / group_short from the
-- seat's group (custom committees only, the same group lookup that already
-- resolved the group crest).
create or replace function public.start_my_chair_session(p_committee uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cc          record;
  v_uid         uuid := auth.uid();
  v_code        text;
  v_suffix      text;
  v_session_id  uuid;
  v_seats       int := 0;
  v_attempt     int;
  v_ended       timestamptz;
  v_conf        record;
  v_tz          text;
  v_limit       timestamptz;
  v_retired     uuid := null;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out',
      'message', 'Sign in to start your committee room.');
  end if;

  select cc.id, cc.conference_id, cc.name, cc.topics, cc.session_id, cc.session_code,
         cc.chair_user_ids, cc.committee_type, cc.groups
    into v_cc
    from conference_committees cc
   where cc.id = p_committee;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found',
      'message', 'That committee no longer exists.');
  end if;

  if not (v_uid = any (coalesce(v_cc.chair_user_ids, '{}'::uuid[]))
          or is_conference_organizer(v_cc.conference_id)) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only this committee''s chairs and the organising team can start its room.');
  end if;

  perform pg_advisory_xact_lock(hashtext('start_chair_session:' || p_committee::text));

  select cc.session_id, cc.session_code into v_session_id, v_code
    from conference_committees cc where cc.id = p_committee;

  if v_session_id is not null and v_code is not null then
    select cm.ended_at into v_ended from committees cm where cm.id = v_session_id;
    if v_ended is null then
      return jsonb_build_object('ok', true, 'created', false,
        'code', v_code, 'session_id', v_session_id);
    end if;

    select c.start_date, c.end_date, c.timezone into v_conf
      from conferences c where c.id = v_cc.conference_id;
    v_tz := case when v_conf.timezone is not null
                  and exists (select 1 from pg_timezone_names z where z.name = v_conf.timezone)
                 then v_conf.timezone else 'Etc/GMT+12' end;
    v_limit := v_ended + interval '24 hours';
    if coalesce(v_conf.end_date, v_conf.start_date) is not null then
      v_limit := greatest(v_limit,
        ((coalesce(v_conf.end_date, v_conf.start_date))::text || ' 23:59')::timestamp at time zone v_tz);
    end if;
    if now() < v_limit then
      return jsonb_build_object('ok', true, 'created', false,
        'code', v_code, 'session_id', v_session_id);
    end if;
    v_retired := v_session_id;
    v_session_id := null;
  end if;

  for v_attempt in 1..5 loop
    v_code   := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    v_suffix := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    begin
      insert into committees (code, name, topic, chair_names, phase,
                              speaker_time_limit, settings, session_origin)
      values (v_code,
              v_cc.name,
              coalesce(nullif(btrim((v_cc.topics)[1]), ''), 'TBD'),
              '{}'::text[],
              'pre-session',
              90,
              jsonb_build_object('chairJoinSuffix', v_suffix, 'separateChairCode', true),
              'conference')
      returning id into v_session_id;
      exit;
    exception when unique_violation then
      v_session_id := null;
    end;
  end loop;

  if v_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_code',
      'message', 'Could not create a session code just now. Please try again.');
  end if;

  insert into current_speaker (committee_id, delegate_id, country, time_remaining)
  values (v_session_id, null, null, 90);

  insert into delegates (committee_id, country, status, is_observer, logo_url, group_color, group_short)
  select v_session_id, s.country_name, 'absent', s.is_observer,
         coalesce(
           nullif(btrim(coalesce(s.logo_url, '')), ''),
           case when v_cc.committee_type = 'custom' then nullif(btrim(coalesce(g.grp->>'logo_url', '')), '') end),
         case when v_cc.committee_type = 'custom' and btrim(coalesce(g.grp->>'color', '')) ~* '^#[0-9a-f]{6}$'
              then btrim(g.grp->>'color') end,
         case when v_cc.committee_type = 'custom'
              then left(nullif(btrim(coalesce(g.grp->>'short_name', '')), ''), 12) end
    from committee_country_slots s
    left join lateral (
      select gg as grp
        from jsonb_array_elements(case when jsonb_typeof(v_cc.groups) = 'array' then v_cc.groups else '[]'::jsonb end) gg
       where nullif(btrim(coalesce(s.group_id, '')), '') is not null
         and jsonb_typeof(gg->'id') = 'string' and jsonb_typeof(gg->'name') = 'string'
         and gg->>'id' = s.group_id
       limit 1
    ) g on true
   where s.conference_committee_id = p_committee
   order by s.country_name
  on conflict (committee_id, country) do nothing;
  select count(*) into v_seats from delegates where committee_id = v_session_id;

  update conference_committees
     set session_id = v_session_id, session_code = v_code
   where id = p_committee;

  return jsonb_build_object('ok', true, 'created', true,
    'code', v_code, 'session_id', v_session_id, 'seats', v_seats,
    'replaced', v_retired);
end
$function$;

-- One-off backfill: every existing conference room of a custom committee.
update public.delegates d
   set group_color = x.color, group_short = x.short
  from (
    select cc.session_id, s.country_name,
           case when btrim(coalesce(g.grp->>'color', '')) ~* '^#[0-9a-f]{6}$' then btrim(g.grp->>'color') end as color,
           left(nullif(btrim(coalesce(g.grp->>'short_name', '')), ''), 12) as short
      from conference_committees cc
      join committee_country_slots s on s.conference_committee_id = cc.id
      join lateral (
        select gg as grp
          from jsonb_array_elements(case when jsonb_typeof(cc.groups) = 'array' then cc.groups else '[]'::jsonb end) gg
         where jsonb_typeof(gg->'id') = 'string' and gg->>'id' = s.group_id
         limit 1
      ) g on true
     where cc.committee_type = 'custom'
       and cc.session_id is not null
       and nullif(btrim(coalesce(s.group_id, '')), '') is not null
  ) x
 where d.committee_id = x.session_id
   and d.country = x.country_name
   and (d.group_color is distinct from x.color or d.group_short is distinct from x.short);

-- Check (read only): seats with a party, per room.
-- select committee_id, count(*) filter (where group_color is not null) as coloured,
--        count(*) filter (where group_short is not null) as named
--   from delegates where group_color is not null or group_short is not null group by 1;


-- =============================================================================
-- P4. "Your room is live" sends reporters to the Press Desk
-- my_live_rooms: the live body, with ONE addition: 'committee_type' in each
-- room's base. The client routes a delegate row whose committee is 'press' to
-- /conferences/<slug>/press (src/lib/liveRooms.ts). An older client ignores
-- the field and keeps routing to the room, as today.
-- =============================================================================

create or replace function public.my_live_rooms()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with me as (
    select auth.uid() as uid
  ),
  confs as (
    select c.*
    from conferences c
    where c.start_date is not null
      and (now() at time zone (
            case
              when c.timezone is not null
                and exists (select 1 from pg_timezone_names z where z.name = c.timezone)
              then c.timezone
              else 'UTC'
            end
          ))::date between c.start_date and coalesce(c.end_date, c.start_date)
  ),
  rooms as (
    select
      cc.id as cc_id, cc.conference_id, cc.chair_user_ids,
      jsonb_build_object(
        'conference_committee_id', cc.id,
        'conference_id', cc.conference_id,
        'session_id', cm.id,
        'committee_name', cc.name,
        'committee_abbreviation', cc.abbreviation,
        'committee_logo_url', cc.logo_url,
        'committee_type', cc.committee_type,
        'conference_name', c.full_name,
        'conference_acronym', c.acronym,
        'conference_logo_url', c.logo_url,
        'conference_country', c.country,
        'conference_slug', c.slug,
        'start_date', c.start_date,
        'end_date', coalesce(c.end_date, c.start_date),
        'session_code', cm.code,
        'topic', coalesce(
          nullif(nullif(btrim(cm.topic), ''), 'TBD'),
          nullif(btrim(cc.topics[1]), ''),
          nullif(btrim(cm.topic), '')
        ),
        'phase', cm.phase,
        'suspended', cm.suspended_at is not null,
        'started', cm.phase is distinct from 'pre-session',
        'chair_names', coalesce(cm.chair_names, '{}'::text[]),
        'chair_count', coalesce(array_length(cm.chair_names, 1), 0),
        'head_chair', nullif(btrim(coalesce(cm.settings->>'headChair', '')), ''),
        'delegate_count', (select count(*) from delegates d where d.committee_id = cm.id),
        'present_count', (select count(*) from delegates d where d.committee_id = cm.id and d.status <> 'absent'),
        'present_countries', coalesce((
          select jsonb_agg(x.country order by x.country)
          from (
            select d.country from delegates d
            where d.committee_id = cm.id and d.status <> 'absent'
            order by d.country limit 10
          ) x
        ), '[]'::jsonb)
      ) as base,
      (cm.phase is distinct from 'pre-session' and cm.suspended_at is null) as in_session,
      c.full_name as conf_name, cc.name as cc_name, c.start_date
    from conference_committees cc
    join confs c on c.id = cc.conference_id
    join committees cm on cm.id = cc.session_id
    where cm.ended_at is null and cm.code is not null
  ),
  items as (
    select 1 as prio, c.start_date, c.full_name as conf_name, '' as cc_name,
      jsonb_build_object(
        'role', 'organiser',
        'conference_id', c.id,
        'conference_name', c.full_name,
        'conference_acronym', c.acronym,
        'conference_logo_url', c.logo_url,
        'conference_country', c.country,
        'conference_slug', c.slug,
        'start_date', c.start_date,
        'end_date', coalesce(c.end_date, c.start_date),
        'live_count', (select count(*) from rooms r where r.conference_id = c.id),
        'in_session_count', (select count(*) from rooms r where r.conference_id = c.id and r.in_session)
      ) as item
    from me
    join conference_organizers o on o.user_id = me.uid
    join confs c on c.id = o.conference_id
    where exists (select 1 from rooms r where r.conference_id = c.id)
    union all
    select 2, r.start_date, r.conf_name, r.cc_name, r.base || jsonb_build_object('role', 'chair')
    from me join rooms r on me.uid = any(coalesce(r.chair_user_ids, '{}'::uuid[]))
    union all
    select 3, r.start_date, r.conf_name, r.cc_name,
      r.base || jsonb_build_object('role', 'delegate', 'country_name', a.country_name, 'country_code', a.country_code, 'seat', a.seat)
    from me
    join rooms r on true
    join lateral (
      select ca.country_name, ca.country_code, ca.seat
      from conference_allocations ca
      left join applications ap on ap.id = ca.application_id
      where ca.conference_committee_id = r.cc_id
        and (ca.user_id = me.uid or (ca.user_id is null and ap.user_id = me.uid))
      order by ca.seat nulls last, ca.created_at
      limit 1
    ) a on true
    union all
    select 4, r.start_date, r.conf_name, r.cc_name,
      r.base || jsonb_build_object(
        'role', 'advisor',
        'students_in_room', (
          select count(*)
          from conference_allocations ca
          left join applications ap2 on ap2.id = ca.application_id
          where ca.conference_committee_id = r.cc_id
            and adv.society_id is not null
            and (ca.society_id = adv.society_id or ap2.society_id = adv.society_id)
            and (ca.user_id is not null or ap2.id is not null)
            and (ap2.id is null or ap2.status not in ('withdrawn', 'rejected'))
        )
      )
    from me
    join rooms r on true
    join lateral (
      select coalesce(ap.society_id, (
        select s.id from societies s
        where s.conference_id = r.conference_id and s.advisor_user_id = me.uid
        order by s.created_at limit 1
      )) as society_id
      from applications ap
      where ap.conference_id = r.conference_id and ap.user_id = me.uid
        and ap.role = 'faculty-advisor' and ap.status in ('accepted', 'assigned', 'checked-in')
      order by (ap.society_id is null), ap.submitted_at nulls last, ap.id
      limit 1
    ) adv on true
  )
  select coalesce(jsonb_agg(i.item order by i.prio, i.start_date, i.conf_name, i.cc_name), '[]'::jsonb)
  from items i
  where (select uid from me) is not null;
$function$;

-- Check (read only): the new key is on every room row.
-- select jsonb_path_query_array(my_live_rooms(), '$[*].committee_type');   -- as a signed-in user


-- =============================================================================
-- PA. press_releases: status and chosen rooms; the approval switch
-- status: 'sent' (every release before this file), 'pending' (waiting for a
-- press chair), 'rejected'. target_committees: the conference_committees the
-- reporter picked (null = every open room at the moment it goes out).
-- The switch lives in its own table (RPC only), ON by default: a conference
-- with no row has approval on.
-- =============================================================================

alter table public.press_releases
  add column if not exists status text not null default 'sent',
  add column if not exists target_committees uuid[],
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists sent_at timestamptz;

do $$ begin
  alter table public.press_releases
    add constraint press_releases_status_check check (status in ('pending', 'sent', 'rejected'));
exception when duplicate_object then null; end $$;

update public.press_releases set sent_at = created_at where status = 'sent' and sent_at is null;

create index if not exists press_releases_conf_status_idx on public.press_releases (conference_id, status, created_at desc);
create index if not exists press_releases_author_idx on public.press_releases (conference_id, author_id, created_at desc);

create table if not exists public.press_desk_settings (
  conference_id uuid primary key references public.conferences(id) on delete cascade,
  approval_required boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.press_desk_settings enable row level security;
-- No policies: read and written only through the functions below.

create or replace function public._press_approval_on(p_conference uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select s.approval_required from press_desk_settings s where s.conference_id = p_conference), true);
$function$;

-- Who may approve, reject and flip the switch: a chair of one of this
-- conference's press committees, or its organising team.
create or replace function public._press_can_review(p_conference uuid, p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select p_user is not null and (
    exists (select 1 from conference_committees cc
             where cc.conference_id = p_conference and cc.committee_type = 'press'
               and p_user = any (coalesce(cc.chair_user_ids, '{}'::uuid[])))
    or exists (select 1 from conference_organizers o where o.conference_id = p_conference and o.user_id = p_user)
    or (p_user = auth.uid() and is_platform_admin())
  );
$function$;

revoke all on function public._press_approval_on(uuid) from public, anon;
revoke all on function public._press_can_review(uuid, uuid) from public, anon;

-- Check (read only):
-- select status, count(*) from press_releases group by 1;
-- select * from press_desk_settings;


-- =============================================================================
-- PB. The 3-in-24-hours allowance
-- DECIDED: a PENDING release counts as well as a sent one (otherwise a reporter
-- could queue any number for the chair); a REJECTED release gives its slot back.
-- =============================================================================

create or replace function public._press_allowance(p_conference uuid, p_user uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with recent as (
    select created_at from press_releases
     where conference_id = p_conference and author_id = p_user
       and status in ('pending', 'sent')
       and created_at > now() - interval '24 hours'
  )
  select jsonb_build_object(
    'releases_left', greatest(0, 3 - (select count(*) from recent))::int,
    'next_release_at', case when (select count(*) from recent) >= 3
                            then (select min(created_at) + interval '24 hours' from recent) end
  );
$function$;

-- Check (read only): select _press_allowance('<conference>', '<user>');


-- =============================================================================
-- PC. Delivering a release; send_press_release with picked rooms
-- P5: the press committee's own room is never a target and never counted.
-- The conference-days check of the live body is kept as it is.
-- A press CHAIR's release always goes straight out; a press SEAT's waits for a
-- chair while approval is on.
-- =============================================================================

-- The rooms a release goes to: open (linked, not ended), not a press room,
-- and, when picked, only the picked ones.
create or replace function public._press_target_rooms(p_conference uuid, p_committees uuid[])
 returns table (session_id uuid, committee_id uuid)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select c.id, cc.id
    from conference_committees cc
    join committees c on c.id = cc.session_id
   where cc.conference_id = p_conference
     and c.ended_at is null
     and cc.committee_type is distinct from 'press'
     and (p_committees is null or cc.id = any (p_committees));
$function$;

create or replace function public._press_deliver(p_release uuid)
 returns int
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  r press_releases%rowtype;
  v_sent int := 0;
begin
  select * into r from press_releases where id = p_release for update;
  if not found or r.status = 'sent' or r.status = 'rejected' then return 0; end if;

  insert into session_broadcasts (committee_id, conference_id, kind, message, image_url, action, action_at,
                                  created_by, expires_at, source, author_label)
  select t.session_id, r.conference_id, 'informational', r.message, r.image_url, null, null,
         r.author_id, now(), 'press', r.author_label
    from _press_target_rooms(r.conference_id, r.target_committees) t;
  get diagnostics v_sent = row_count;

  update press_releases set status = 'sent', sent_to = v_sent, sent_at = now() where id = p_release;
  return v_sent;
end;
$function$;

revoke all on function public._press_target_rooms(uuid, uuid[]) from public, anon;
revoke all on function public._press_deliver(uuid) from public, anon, authenticated;

-- The 3-argument version is replaced by one with an optional 4th argument, so
-- an older client calling (p_conference, p_message, p_image_url) by name still
-- reaches it.
drop function if exists public.send_press_release(uuid, text, text);

create or replace function public.send_press_release(p_conference uuid, p_message text, p_image_url text default null, p_committees uuid[] default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
  v_conf record;
  v_tz text;
  v_pick uuid[] := null;
  v_pending boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in to send a press release.');
  end if;
  v_access := _press_access(p_conference, v_uid);
  if not coalesce((v_access->>'can_release')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only the press of this conference can send a press release.');
  end if;

  select c.start_date, coalesce(c.end_date, c.start_date) as last_day, coalesce(c.dates_tbd, false) as tbd,
         public.conference_timezone(c.country, c.timezone) as tz
    into v_conf from conferences c where c.id = p_conference;
  if v_conf.start_date is null or v_conf.tbd then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'Press releases open once the conference has dates.');
  end if;
  v_tz := case when exists (select 1 from pg_timezone_names z where z.name = v_conf.tz) then v_conf.tz else 'UTC' end;
  if now() < (v_conf.start_date::timestamp at time zone v_tz) then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'Press releases open when the conference starts.');
  end if;
  if now() >= ((v_conf.last_day + 1)::timestamp at time zone v_tz) then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'The conference has ended, so press releases are closed.');
  end if;

  if char_length(v_msg) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty', 'message', 'Write your press release first.');
  end if;
  if char_length(v_msg) > 600 then
    return jsonb_build_object('ok', false, 'reason', 'too_long', 'message', 'A press release can be up to 600 characters.');
  end if;
  if v_img is not null and v_img !~ (
       '^https://luruhkwrgisytejswlas\.supabase\.co/storage/v1/object/public/conference-assets/broadcasts/'
       || p_conference::text || '-[0-9]{10,16}\.[a-z0-9]{1,8}$') then
    return jsonb_build_object('ok', false, 'reason', 'image', 'message', 'That image could not be attached. Upload it again.');
  end if;

  -- Picked rooms: every one must be an open, non-press room of this conference.
  if p_committees is not null then
    select array_agg(distinct x) into v_pick from unnest(p_committees) x where x is not null;
    if v_pick is null or cardinality(v_pick) = 0 then
      return jsonb_build_object('ok', false, 'reason', 'rooms', 'message', 'Pick at least one committee room.');
    end if;
    if (select count(*) from _press_target_rooms(p_conference, v_pick)) <> cardinality(v_pick) then
      return jsonb_build_object('ok', false, 'reason', 'rooms',
        'message', 'One of the rooms you picked is not open any more. Pick the rooms again.');
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('press_release:' || p_conference::text || ':' || v_uid::text));
  v_allow := _press_allowance(p_conference, v_uid);
  if (v_allow->>'releases_left')::int <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'limit',
      'message', 'You have sent 3 press releases in the last 24 hours.',
      'next_release_at', v_allow->'next_release_at', 'releases_left', 0);
  end if;

  select count(*) into v_rooms from _press_target_rooms(p_conference, v_pick);
  if v_rooms = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_rooms',
      'message', 'No committee room is open yet. Send it once the rooms have started.');
  end if;

  v_pending := (v_access->>'role') = 'press_seat' and _press_approval_on(p_conference);

  v_label := left(btrim(v_access->>'label'), 80);
  -- Always written 'pending' first; _press_deliver turns it 'sent' at once when no
  -- approval is needed, so both paths share one delivery.
  insert into press_releases (conference_id, author_id, author_label, author_role, message, image_url,
                              status, target_committees)
  values (p_conference, v_uid, v_label, v_access->>'role', v_msg, v_img, 'pending', v_pick)
  returning id into v_release;

  if v_pending then
    return jsonb_build_object('ok', true, 'pending', true, 'sent_to', 0, 'release_id', v_release)
           || _press_allowance(p_conference, v_uid);
  end if;

  v_sent := _press_deliver(v_release);
  return jsonb_build_object('ok', true, 'pending', false, 'sent_to', v_sent, 'release_id', v_release)
         || _press_allowance(p_conference, v_uid);
end;
$function$;

revoke all on function public.send_press_release(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.send_press_release(uuid, text, text, uuid[]) to authenticated;

-- Check (read only, rolled back):
-- begin; select send_press_release('<conference>', 'test', null, null); rollback;   -- as a press seat


-- =============================================================================
-- PD. Approving and rejecting; the switch
-- =============================================================================

create or replace function public.review_press_release(p_release uuid, p_approve boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  r press_releases%rowtype;
  v_conf record;
  v_tz text;
  v_sent int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in to review press releases.');
  end if;
  select * into r from press_releases where id = p_release for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'That press release no longer exists.');
  end if;
  if not _press_can_review(r.conference_id, v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only the press chairs and the organising team can review press releases.');
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'done', 'status', r.status,
      'message', case when r.status = 'sent' then 'This press release has already gone out.' else 'This press release was already rejected.' end);
  end if;

  if not coalesce(p_approve, false) then
    update press_releases set status = 'rejected', reviewed_by = v_uid, reviewed_at = now() where id = p_release;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  select c.start_date, coalesce(c.end_date, c.start_date) as last_day, coalesce(c.dates_tbd, false) as tbd,
         public.conference_timezone(c.country, c.timezone) as tz
    into v_conf from conferences c where c.id = r.conference_id;
  v_tz := case when exists (select 1 from pg_timezone_names z where z.name = v_conf.tz) then v_conf.tz else 'UTC' end;
  if v_conf.start_date is null or v_conf.tbd
     or now() < (v_conf.start_date::timestamp at time zone v_tz)
     or now() >= ((v_conf.last_day + 1)::timestamp at time zone v_tz) then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'Press releases go out only during the conference.');
  end if;
  if (select count(*) from _press_target_rooms(r.conference_id, r.target_committees)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_rooms',
      'message', 'None of the rooms it was written for is open now. Reject it, or approve it once they reopen.');
  end if;

  update press_releases set reviewed_by = v_uid, reviewed_at = now() where id = p_release;
  v_sent := _press_deliver(p_release);
  return jsonb_build_object('ok', true, 'status', 'sent', 'sent_to', v_sent);
end;
$function$;

create or replace function public.set_press_release_approval(p_conference uuid, p_on boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if not _press_can_review(p_conference, v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only the press chairs and the organising team can change this.');
  end if;
  insert into press_desk_settings (conference_id, approval_required, updated_by, updated_at)
  values (p_conference, coalesce(p_on, true), v_uid, now())
  on conflict (conference_id) do update
     set approval_required = excluded.approval_required, updated_by = excluded.updated_by, updated_at = now();
  -- Turning approval off does NOT send what is waiting: a chair still approves or rejects each one.
  return jsonb_build_object('ok', true, 'approval_on', coalesce(p_on, true));
end;
$function$;

revoke all on function public.review_press_release(uuid, boolean) from public, anon;
revoke all on function public.set_press_release_approval(uuid, boolean) from public, anon;
grant execute on function public.review_press_release(uuid, boolean) to authenticated;
grant execute on function public.set_press_release_approval(uuid, boolean) to authenticated;

-- Check (read only, rolled back):
-- begin; select set_press_release_approval('<conference>', false); select * from press_desk_settings; rollback;


-- =============================================================================
-- PE. press_releases_board: the reporter's own history (P6) and, for press
-- chairs and organisers, the queue waiting for approval
-- =============================================================================

create or replace function public.press_releases_board(p_conference uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_review boolean;
  v_mine jsonb := '[]'::jsonb;
  v_pending jsonb := '[]'::jsonb;
begin
  if v_uid is null or p_conference is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  v_access := _press_access(p_conference, v_uid);
  v_review := _press_can_review(p_conference, v_uid);
  if not coalesce((v_access->>'eligible')::boolean, false) and not v_review then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pr.id, 'message', pr.message, 'image_url', pr.image_url, 'status', pr.status,
           'sent_to', pr.sent_to, 'created_at', pr.created_at, 'sent_at', pr.sent_at, 'reviewed_at', pr.reviewed_at,
           'rooms', (select coalesce(jsonb_agg(coalesce(nullif(btrim(cc.abbreviation), ''), cc.name) order by cc.name), '[]'::jsonb)
                       from conference_committees cc where cc.id = any (coalesce(pr.target_committees, '{}'::uuid[]))))
         order by pr.created_at desc), '[]'::jsonb)
    into v_mine
    from (select * from press_releases
           where conference_id = p_conference and author_id = v_uid
           order by created_at desc limit 50) pr;

  if v_review then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', pr.id, 'author_label', pr.author_label, 'message', pr.message, 'image_url', pr.image_url,
             'created_at', pr.created_at,
             'rooms', (select coalesce(jsonb_agg(coalesce(nullif(btrim(cc.abbreviation), ''), cc.name) order by cc.name), '[]'::jsonb)
                         from conference_committees cc where cc.id = any (coalesce(pr.target_committees, '{}'::uuid[]))))
           order by pr.created_at), '[]'::jsonb)
      into v_pending
      from press_releases pr
     where pr.conference_id = p_conference and pr.status = 'pending';
  end if;

  return jsonb_build_object('ok', true, 'approval_on', _press_approval_on(p_conference),
                            'can_review', v_review, 'mine', v_mine, 'pending', v_pending);
end;
$function$;

revoke all on function public.press_releases_board(uuid) from public, anon;
grant execute on function public.press_releases_board(uuid) to authenticated;

-- Check (read only): select press_releases_board('<conference>');   -- as a press seat / chair


-- =============================================================================
-- PF. press_desk: crests for sponsor chips (P8), the press room to join, and
-- the approval switch. The live body with three additions, marked "-- new".
-- =============================================================================

create or replace function public.press_desk(p_conference uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_rooms jsonb;
  v_press_room jsonb;   -- new
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
        ), '[]'::jsonb),
        -- new: each seat's crest by name, for the sponsor chips (P8)
        'seat_logos', coalesce((
          select jsonb_object_agg(d2.country, d2.logo_url)
            from delegates d2
           where d2.committee_id = c.id and nullif(btrim(coalesce(d2.logo_url, '')), '') is not null
        ), '{}'::jsonb)
      ) end
    ) as room
    from conference_committees cc
    left join committees c on c.id = cc.session_id
    where cc.conference_id = p_conference
  ) r;

  -- new: the caller's own press room, for "Join the press room" (press seats and press chairs)
  if (v_access->>'role') in ('press_seat', 'press_chair') and (v_access->>'press_committee_id') is not null then
    select jsonb_build_object(
             'committee_id', cc.id,
             'code', c.code,
             'ended', c.ended_at is not null,
             'country', case when (v_access->>'role') = 'press_seat' then v_access->>'label' end)
      into v_press_room
      from conference_committees cc
      join committees c on c.id = cc.session_id
     where cc.id = (v_access->>'press_committee_id')::uuid
       and c.code is not null;
  end if;

  return jsonb_build_object('ok', true, 'now', now(), 'rooms', v_rooms,
                            'press_room', v_press_room,                                  -- new
                            'approval_on', _press_approval_on(p_conference),            -- new
                            'can_review', _press_can_review(p_conference, v_uid))       -- new
         || v_access;
end;
$function$;

-- Check (read only): select press_desk('<conference>') -> 'press_room';   -- as a press seat


-- =============================================================================
-- P7. A release photo cannot be deleted or overwritten once a release used it
-- RESTRICTIVE, so it narrows the existing permissive and restrictive policies
-- on conference-assets: the sender (owner_id) can no longer remove or replace
-- the object behind a release, so it never breaks in the rooms. Platform
-- admins keep the way out.
-- =============================================================================

create or replace function public.press_image_in_use(p_name text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select p_name like 'broadcasts/%' and exists (
    select 1 from press_releases pr
     where pr.image_url = 'https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/conference-assets/' || p_name
  );
$function$;

drop policy if exists "Conference assets: press photos stay once sent (delete)" on storage.objects;
create policy "Conference assets: press photos stay once sent (delete)"
  on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'conference-assets' or not public.press_image_in_use(name) or public.is_platform_admin());

drop policy if exists "Conference assets: press photos stay once sent (update)" on storage.objects;
create policy "Conference assets: press photos stay once sent (update)"
  on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'conference-assets' or not public.press_image_in_use(name) or public.is_platform_admin())
  with check (bucket_id <> 'conference-assets' or not public.press_image_in_use(name) or public.is_platform_admin());

-- Check (read only):
-- select policyname, permissive, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%press photos%';
-- select count(*) filter (where press_image_in_use(substring(image_url from '/conference-assets/(.*)$'))) from press_releases where image_url is not null;


-- =============================================================================
-- T. TEST SEND. Run by hand, ONCE, only when the lead decides to.
-- Exactly ONE email_outbox row to the team inbox wearegavelling@gmail.com
-- (exempt from the hourly cap), the press seat email
-- (`press_allocation_assigned`, src/lib/defaultEmails.ts) with sample values
-- for Tilburg Model United Nations' International Press Corps. Sent from the
-- Gavelling domain. Nothing else is queued.
-- =============================================================================

-- insert into public.email_outbox (conference_id, recipient_email, subject, body, body_html, status, from_name, from_address, reply_to)
-- select c.id,
--        'wearegavelling@gmail.com',
--        'Your press seat at ' || c.full_name,
--        'Hi Sample Reporter,' || chr(10) || chr(10)
--          || 'You are on the press team for ' || c.full_name || '.' || chr(10) || chr(10)
--          || 'Committee: International Press Corps' || chr(10)
--          || 'Your outlet: BBC' || chr(10) || chr(10)
--          || 'During the conference your Press Desk follows every committee room live: who is speaking, the motions on the floor and the papers introduced, which you can read in full.' || chr(10) || chr(10)
--          || 'From the desk you can send a press release of up to 600 characters with a photo. Pick which committee rooms it goes to, or send it to all of them. It appears in each room''s chat as Press · BBC.' || chr(10) || chr(10)
--          || 'You can send 3 in any 24 hours. If your press chair has approval on, a release waits for their OK before it goes out. You can also join the press room itself from the desk.' || chr(10) || chr(10)
--          || 'Open your Press Desk: https://gavelling.com/conferences/' || c.slug || '/press',
--        public.gavelling_email_html(
--          c.id,
--          'You are on the press team',
--          array[
--            'Hi Sample Reporter,',
--            'You are on the press team for ' || c.full_name || '.',
--            'During the conference your Press Desk follows every committee room live: who is speaking, the motions on the floor and the papers introduced, which you can read in full.',
--            'From the desk you can send a press release of up to 600 characters with a photo. Pick which committee rooms it goes to, or send it to all of them. It appears in each room''s chat as Press · BBC.',
--            'You can send 3 in any 24 hours. If your press chair has approval on, a release waits for their OK before it goes out. You can also join the press room itself from the desk.'
--          ],
--          jsonb_build_array(
--            jsonb_build_object('label', 'Committee', 'value', 'International Press Corps'),
--            jsonb_build_object('label', 'Your outlet', 'value', 'BBC')),
--          'Open my Press Desk', 'https://gavelling.com/conferences/' || c.slug || '/press',
--          null, null,
--          jsonb_build_object('pill', 'Press')),
--        'pending',
--        'Gavelling',
--        'peter@mail.gavelling.com',
--        'wearegavelling@gmail.com'
--   from public.conferences c
--  where c.slug = 'tilburg-model-united-nations-ni7u0'
--  limit 1;
--
-- Check (read only): select id, status, subject, created_at from email_outbox
--                     where recipient_email = 'wearegavelling@gmail.com' order by created_at desc limit 3;
