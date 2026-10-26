-- Gavelling Crisis, part 10 (Peter's feedback round 3, 26 Oct 2026):
-- cabinet logos; staff pictures; news numbered per cabinet (an all-rooms story takes the next number in
-- every cabinet); reply actions (character status, unit moves, border changes) in the same press;
-- backroomers edit characters only when the CD allows it; meetings (request, approve, hold).

alter table public.crisis_cabinets add column if not exists logo_url text;
alter table public.crisis_members add column if not exists picture_url text;
grant select (picture_url) on public.crisis_members to anon, authenticated;

-- ───────── News numbers per cabinet ─────────
alter table public.crisis_news add column if not exists numbers jsonb not null default '{}'::jsonb;  -- { cabinet_id: n }

create or replace function public.crisis_news_assign_numbers(p_news uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n record; cab record; nums jsonb := '{}'::jsonb; nxt int;
begin
  select * into n from public.crisis_news where id = p_news;
  for cab in select id from public.crisis_cabinets where crisis_id = n.crisis_id
              and (n.audience_cabinet_id is null or id = n.audience_cabinet_id) loop
    select coalesce(max((x.numbers ->> cab.id::text)::int), 0) + 1 into nxt
      from public.crisis_news x where x.crisis_id = n.crisis_id and x.status = 'published' and x.id <> n.id;
    nums := nums || jsonb_build_object(cab.id::text, nxt);
  end loop;
  update public.crisis_news set numbers = nums where id = p_news;
  return nums;
end $$;
revoke execute on function public.crisis_news_assign_numbers(uuid) from public, anon, authenticated;

-- Publish now numbers the story for each cabinet that sees it.
create or replace function public.crisis_publish_news(p_news uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n record; c record; me public.crisis_members; needs boolean; rooms int := 0; cab record; msg text; nums jsonb;
begin
  select * into n from public.crisis_news where id = p_news for update;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  select * into c from public.crises where id = n.crisis_id;
  needs := coalesce((c.settings ->> 'newsNeedsApproval')::boolean, true);
  if not (public.crisis_is_director(n.crisis_id) or (not needs and public.crisis_can(n.crisis_id, 'news'))) then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  if n.status = 'published' then return jsonb_build_object('ok', true, 'rooms', 0, 'already', true, 'numbers', n.numbers); end if;
  me := public.crisis_me(n.crisis_id);
  update public.crisis_news set status = 'published', published_at = now(), published_by = me.id where id = p_news;
  nums := public.crisis_news_assign_numbers(p_news);
  msg := n.title || E'\n\n' || case when char_length(n.body) > 1500 then left(n.body, 1500) || E'…\n\nRead the full story in Gavelling Crisis.' else n.body end;
  for cab in select cc.session_id from public.crisis_cabinets cb
               join public.conference_committees cc on cc.id = cb.conference_committee_id
              where cb.crisis_id = n.crisis_id and cc.session_id is not null
                and (n.audience_cabinet_id is null or cb.id = n.audience_cabinet_id) loop
    insert into public.session_broadcasts(committee_id, conference_id, kind, message, image_url, source, author_label, created_by, expires_at)
    values (cab.session_id, c.conference_id, 'informational', msg, coalesce(n.banner_url, n.image_url), 'crisis',
            coalesce(n.source_label, 'Crisis update'), auth.uid(), now() + interval '20 minutes');
    rooms := rooms + 1;
  end loop;
  return jsonb_build_object('ok', true, 'rooms', rooms, 'numbers', nums);
end $$;

-- Backfill numbers for stories already published, oldest first.
do $$
declare r record;
begin
  for r in select id from public.crisis_news where status = 'published' order by published_at nulls first, created_at loop
    perform public.crisis_news_assign_numbers(r.id);
  end loop;
end $$;

-- ───────── Characters: backroomers edit only with the CD's permission (backroomPowers.characters) ─────────
drop policy if exists characters_director_write on public.crisis_characters;
create policy characters_staff_write on public.crisis_characters for all
  using (public.crisis_is_director(crisis_id) or public.crisis_can(crisis_id, 'characters'))
  with check (public.crisis_is_director(crisis_id) or public.crisis_can(crisis_id, 'characters'));

-- ───────── Answer with actions in the same press ─────────
-- p_effects: {"resources":[{"id","delta"}], "news":{...}, "characters":[{"id","status","status_note"}],
--             "units":[{"id","lng","lat","strength"?}], "regions":[{"key","owner_cabinet_id"}]}
create or replace function public.crisis_answer_directive(p_directive uuid, p_outcome text, p_reply text, p_effects jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d record; me public.crisis_members; e jsonb; r record; nid uuid;
begin
  select * into d from public.crisis_directives where id = p_directive for update;
  if not found or not public.crisis_is_staff(d.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if p_outcome not in ('approved','partial','denied','clarify','later') then raise exception 'crisis_bad_outcome' using errcode = '22023'; end if;
  if coalesce(btrim(p_reply), '') = '' then raise exception 'crisis_reply_required' using errcode = '22023'; end if;
  me := public.crisis_me(d.crisis_id);
  update public.crisis_directives
     set outcome = p_outcome, reply = btrim(p_reply),
         status = case when p_outcome = 'clarify' then 'clarify' else 'answered' end,
         answered_at = now(), answered_by = me.id,
         assigned_member_id = coalesce(assigned_member_id, me.id)
   where id = p_directive;

  for e in select * from jsonb_array_elements(coalesce(p_effects -> 'resources', '[]'::jsonb)) loop
    if public.crisis_can(d.crisis_id, 'resources') then
      r := null;
      update public.crisis_resources set amount = amount + (e ->> 'delta')::numeric, updated_at = now()
       where id = (e ->> 'id')::uuid and crisis_id = d.crisis_id returning * into r;
      if r.id is not null then
        insert into public.crisis_resource_log(crisis_id, resource_id, delta, amount_after, reason, directive_id, member_id)
        values (d.crisis_id, r.id, (e ->> 'delta')::numeric, r.amount, 'Directive ' || d.no, d.id, me.id);
      end if;
    end if;
  end loop;

  -- Character status (dead, arrested, missing, active): part of answering, any staff.
  for e in select * from jsonb_array_elements(coalesce(p_effects -> 'characters', '[]'::jsonb)) loop
    if (e ->> 'status') in ('active','dead','arrested','missing','spare') then
      update public.crisis_characters set status = e ->> 'status', status_note = nullif(btrim(coalesce(e ->> 'status_note', '')), '')
       where id = (e ->> 'id')::uuid and crisis_id = d.crisis_id;
    end if;
  end loop;

  -- Unit moves (units power).
  if public.crisis_can(d.crisis_id, 'units') then
    for e in select * from jsonb_array_elements(coalesce(p_effects -> 'units', '[]'::jsonb)) loop
      update public.crisis_units set lng = coalesce((e ->> 'lng')::double precision, lng), lat = coalesce((e ->> 'lat')::double precision, lat),
             strength = coalesce((e ->> 'strength')::int, strength)
       where id = (e ->> 'id')::uuid and crisis_id = d.crisis_id;
    end loop;
  end if;

  -- Border changes (map power).
  if public.crisis_can(d.crisis_id, 'map') then
    for e in select * from jsonb_array_elements(coalesce(p_effects -> 'regions', '[]'::jsonb)) loop
      insert into public.crisis_map_regions(crisis_id, region_key, owner_cabinet_id, updated_at)
      values (d.crisis_id, e ->> 'key', nullif(e ->> 'owner_cabinet_id', '')::uuid, now())
      on conflict (crisis_id, region_key) do update set owner_cabinet_id = excluded.owner_cabinet_id, updated_at = now();
    end loop;
  end if;

  if p_effects ? 'news' and coalesce(btrim(p_effects -> 'news' ->> 'title'), '') <> '' then
    insert into public.crisis_news(crisis_id, title, body, source_label, audience_cabinet_id, author_member_id, directive_id, banner_url)
    values (d.crisis_id, btrim(p_effects -> 'news' ->> 'title'), coalesce(nullif(btrim(p_effects -> 'news' ->> 'body'), ''), btrim(p_effects -> 'news' ->> 'title')),
            nullif(btrim(p_effects -> 'news' ->> 'source_label'), ''), nullif(p_effects -> 'news' ->> 'audience_cabinet_id', '')::uuid, me.id, d.id,
            nullif(p_effects -> 'news' ->> 'banner_url', ''))
    returning id into nid;
  end if;
  return jsonb_build_object('ok', true, 'news_id', nid);
end $$;

-- Handing a directive to yourself is not a hand-off (Peter): assign to someone else only; claiming stays.
create or replace function public.crisis_assign_directive(p_directive uuid, p_member uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare d record; me public.crisis_members; target uuid;
begin
  select * into d from public.crisis_directives where id = p_directive;
  if not found or not public.crisis_is_staff(d.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  me := public.crisis_me(d.crisis_id);
  target := coalesce(p_member, me.id);
  if target is not null and not exists (select 1 from public.crisis_members where id = target and crisis_id = d.crisis_id
       and role in ('director','assistant_director','backroomer')) then
    raise exception 'crisis_not_found' using errcode = 'P0002';
  end if;
  update public.crisis_directives
     set assigned_member_id = target,
         status = case when status = 'queued' and p_member is null then 'claimed' else status end,
         claimed_at = case when p_member is null then now() else claimed_at end
   where id = p_directive;
  return true;
end $$;

-- ───────── Meetings ─────────
create table if not exists public.crisis_meetings (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  requested_by_member uuid references public.crisis_members(id) on delete set null,
  requested_by_character uuid references public.crisis_characters(id) on delete set null,
  character_ids uuid[] not null default '{}',               -- who meets (the requester included)
  intention text not null check (char_length(btrim(intention)) between 1 and 1000),
  duration_minutes int not null default 10 check (duration_minutes between 1 and 180),
  wanted_time text check (wanted_time is null or char_length(wanted_time) <= 120),  -- "next unmoderated caucus"
  status text not null default 'pending' check (status in ('pending','approved','declined','held','cancelled')),
  decided_by uuid references public.crisis_members(id) on delete set null,
  decided_at timestamptz,
  staff_note text check (staff_note is null or char_length(staff_note) <= 2000),  -- shown to the delegates
  outcome_note text check (outcome_note is null or char_length(outcome_note) <= 4000), -- what was agreed (staff)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crisis_meetings enable row level security;
create trigger crisis_meetings_touch before update on public.crisis_meetings for each row execute function public.crisis_touch();
create trigger crisis_meetings_ping after insert or update or delete on public.crisis_meetings for each row execute function public.crisis_ping();

-- Staff and chairs see every meeting (the chair simply sees); a delegate sees meetings they are in.
create policy meetings_read on public.crisis_meetings for select using (
  public.crisis_is_staff(crisis_id) or public.crisis_role(crisis_id) = 'chair'
  or (public.crisis_me(crisis_id)).character_id = any (character_ids));

create or replace function public.crisis_request_meeting(p_crisis uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.crisis_members; ids uuid[]; needs boolean; mid uuid; st text;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null or me.character_id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select array_agg(distinct x) into ids from (
    select me.character_id as x
    union select (jsonb_array_elements_text(coalesce(p -> 'character_ids', '[]'::jsonb)))::uuid) s
   where exists (select 1 from public.crisis_characters c where c.id = s.x and c.crisis_id = p_crisis);
  if coalesce(array_length(ids, 1), 0) < 2 then return jsonb_build_object('ok', false, 'reason', 'nobody'); end if;
  select coalesce((settings ->> 'meetingsNeedApproval')::boolean, true) into needs from public.crises where id = p_crisis;
  st := case when needs then 'pending' else 'approved' end;
  insert into public.crisis_meetings(crisis_id, requested_by_member, requested_by_character, character_ids, intention, duration_minutes, wanted_time, status)
  values (p_crisis, me.id, me.character_id, ids, btrim(p ->> 'intention'), coalesce((p ->> 'duration_minutes')::int, 10),
          nullif(btrim(coalesce(p ->> 'wanted_time', '')), ''), st)
  returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'status', st);
end $$;

-- Staff (backroomer or CD) approve, decline, mark held (with what was agreed) or cancel.
create or replace function public.crisis_decide_meeting(p_meeting uuid, p_status text, p_staff_note text default null, p_outcome_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from public.crisis_meetings where id = p_meeting;
  if not found or not public.crisis_is_staff(m.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if p_status not in ('approved','declined','held','cancelled','pending') then raise exception 'crisis_bad_status' using errcode = '22023'; end if;
  update public.crisis_meetings
     set status = p_status, decided_by = (public.crisis_me(m.crisis_id)).id, decided_at = now(),
         staff_note = coalesce(nullif(btrim(coalesce(p_staff_note, '')), ''), staff_note),
         outcome_note = coalesce(nullif(btrim(coalesce(p_outcome_note, '')), ''), outcome_note)
   where id = p_meeting;
  return true;
end $$;

-- The requester can cancel their own pending or approved meeting.
create or replace function public.crisis_cancel_meeting(p_meeting uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from public.crisis_meetings where id = p_meeting;
  if not found or (public.crisis_me(m.crisis_id)).id is distinct from m.requested_by_member then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  update public.crisis_meetings set status = 'cancelled' where id = p_meeting and status in ('pending','approved');
  return true;
end $$;

grant execute on function public.crisis_request_meeting(uuid, jsonb), public.crisis_decide_meeting(uuid, text, text, text),
  public.crisis_cancel_meeting(uuid) to anon, authenticated;
