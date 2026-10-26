-- Gavelling Crisis, part 11: notifications (Peter, 26 Oct 2026: a bell like Master of Disaster's,
-- for troop movements a person can see, approvals and answers, things revealed, new territory, news,
-- meetings, status changes). Rows are written by triggers, so no screen can forget to notify.
-- Each row belongs to one member; members read and mark only their own.

create table if not exists public.crisis_notifications (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  member_id uuid not null references public.crisis_members(id) on delete cascade,
  kind text not null check (kind in ('directive_answer','directive_new','directive_note','news','unit','reveal','territory','meeting','status')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 600),
  link text check (link is null or char_length(link) <= 300),   -- path inside the crisis, e.g. 'map', 'news', 'directives?d=<id>'
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists crisis_notifications_member on public.crisis_notifications(member_id, created_at desc);
alter table public.crisis_notifications enable row level security;
create policy notifications_read on public.crisis_notifications for select using (member_id = (public.crisis_me(crisis_id)).id);
create trigger crisis_notifications_ping after insert or update on public.crisis_notifications for each row execute function public.crisis_ping();

create or replace function public.crisis_mark_notifications_read(p_crisis uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare me public.crisis_members; n int;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null then return 0; end if;
  update public.crisis_notifications set read_at = now()
   where member_id = me.id and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.crisis_mark_notifications_read(uuid, uuid[]) to anon, authenticated;

-- Helper: notify every member of the given cabinets (delegates, chairs, press), skipping the actor.
create or replace function public.crisis_notify_cabinets(p_crisis uuid, p_cabinets uuid[], p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid;
begin
  actor := (public.crisis_me(p_crisis)).id;
  insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
  select p_crisis, m.id, p_kind, left(p_title, 200), left(p_body, 600), p_link, p_ref
    from public.crisis_members m
   where m.crisis_id = p_crisis and m.role in ('delegate','chair','press')
     and m.cabinet_id = any(p_cabinets) and m.id is distinct from actor;
end $$;
revoke execute on function public.crisis_notify_cabinets(uuid, uuid[], text, text, text, text, uuid) from public, anon, authenticated;

-- Directives: an answer reaches the author (and co-authors); a new directive reaches its backroomer;
-- a delegate's clarification reaches the assigned backroomer.
create or replace function public.crisis_notify_directive() returns trigger
language plpgsql security definer set search_path = public as $$
declare label text;
begin
  if tg_op = 'INSERT' then
    if new.assigned_member_id is not null then
      insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
      select new.crisis_id, new.assigned_member_id, 'directive_new', 'New directive No. ' || new.no || ': ' || left(new.title, 120),
             (select name from public.crisis_characters where id = new.author_character_id), 'directives?d=' || new.id, new.id;
    end if;
    return new;
  end if;
  if new.answered_at is distinct from old.answered_at and new.answered_at is not null then
    label := case new.outcome when 'approved' then 'Approved' when 'partial' then 'Partly works' when 'denied' then 'Denied'
                              when 'clarify' then 'More detail needed' else 'Answered' end;
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select new.crisis_id, m.id, 'directive_answer', label || ': ' || left(new.title, 140), left(coalesce(new.reply, ''), 600), '?d=' || new.id, new.id
      from public.crisis_members m
     where m.crisis_id = new.crisis_id and (m.id = new.author_member_id
        or m.character_id in (select character_id from public.crisis_directive_coauthors where directive_id = new.id));
  end if;
  if new.assigned_member_id is distinct from old.assigned_member_id and new.assigned_member_id is not null
     and new.assigned_member_id is distinct from (public.crisis_me(new.crisis_id)).id then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, link, ref_id)
    values (new.crisis_id, new.assigned_member_id, 'directive_new', 'Handed to you: No. ' || new.no || ' ' || left(new.title, 120), 'directives?d=' || new.id, new.id);
  end if;
  return new;
end $$;
create trigger crisis_directives_notify after insert or update on public.crisis_directives
  for each row execute function public.crisis_notify_directive();

create or replace function public.crisis_notify_directive_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if new.internal then return new; end if;
  select * into d from public.crisis_directives where id = new.directive_id;
  if new.member_id is not distinct from d.author_member_id and d.assigned_member_id is not null then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    values (d.crisis_id, d.assigned_member_id, 'directive_note', 'Clarification on No. ' || d.no || ': ' || left(d.title, 120), left(new.body, 600), 'directives?d=' || d.id, d.id);
  end if;
  return new;
end $$;
create trigger crisis_directive_notes_notify after insert on public.crisis_directive_notes
  for each row execute function public.crisis_notify_directive_note();

-- News: when published, everyone who sees it (its cabinet, or all cabinets), staff excluded.
create or replace function public.crisis_notify_news() returns trigger
language plpgsql security definer set search_path = public as $$
declare cabs uuid[];
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select array_agg(id) into cabs from public.crisis_cabinets
     where crisis_id = new.crisis_id and (new.audience_cabinet_id is null or id = new.audience_cabinet_id);
    perform public.crisis_notify_cabinets(new.crisis_id, coalesce(cabs, '{}'), 'news',
      coalesce(new.source_label, 'News') || ': ' || left(new.title, 160), left(new.body, 300), 'news', new.id);
  end if;
  return new;
end $$;
create trigger crisis_news_notify after insert or update on public.crisis_news
  for each row execute function public.crisis_notify_news();

-- Units: a new unit or a move reaches the cabinets that can see it (owner and revealed_to);
-- a cabinet newly added to revealed_to is told something was revealed.
create or replace function public.crisis_notify_unit() returns trigger
language plpgsql security definer set search_path = public as $$
declare seen uuid[]; newly uuid[];
begin
  seen := array_remove(array[new.owner_cabinet_id] || new.revealed_to, null);
  if tg_op = 'INSERT' then
    perform public.crisis_notify_cabinets(new.crisis_id, seen, 'unit', 'New on the map: ' || new.name, null, 'map', new.id);
    return new;
  end if;
  if (new.lng, new.lat) is distinct from (old.lng, old.lat) then
    perform public.crisis_notify_cabinets(new.crisis_id, seen, 'unit', 'Movement: ' || new.name, null, 'map', new.id);
  elsif new.strength is distinct from old.strength then
    perform public.crisis_notify_cabinets(new.crisis_id, seen, 'unit', new.name || ' is now ' || new.strength, null, 'map', new.id);
  end if;
  select array_agg(x) into newly from unnest(new.revealed_to) x where not (x = any(old.revealed_to));
  if newly is not null then
    perform public.crisis_notify_cabinets(new.crisis_id, newly, 'reveal', 'Revealed: ' || new.name, null, 'map', new.id);
  end if;
  return new;
end $$;
create trigger crisis_units_notify after insert or update on public.crisis_units
  for each row execute function public.crisis_notify_unit();

-- Territory: the cabinet that gains a country is told it gained territory, the one that loses it that it lost.
create or replace function public.crisis_notify_region() returns trigger
language plpgsql security definer set search_path = public as $$
declare prev uuid;
begin
  prev := case when tg_op = 'UPDATE' then old.owner_cabinet_id end;
  if prev is not distinct from new.owner_cabinet_id then return new; end if;
  if new.owner_cabinet_id is not null then
    perform public.crisis_notify_cabinets(new.crisis_id, array[new.owner_cabinet_id], 'territory', 'Territory gained on the map', null, 'map', null);
  end if;
  if prev is not null then
    perform public.crisis_notify_cabinets(new.crisis_id, array[prev], 'territory', 'Territory lost on the map', null, 'map', null);
  end if;
  return new;
end $$;
create trigger crisis_regions_notify after insert or update on public.crisis_map_regions
  for each row execute function public.crisis_notify_region();

-- Areas (extended territory) owned by a cabinet: the owner is told.
create or replace function public.crisis_notify_shape() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_cabinet_id is not null and (tg_op = 'INSERT' or new.geometry is distinct from old.geometry) then
    perform public.crisis_notify_cabinets(new.crisis_id, array[new.owner_cabinet_id], 'territory',
      'Territory changed: ' || coalesce(new.label, 'an area on the map'), null, 'map', new.id);
  end if;
  return new;
end $$;
create trigger crisis_shapes_notify after insert or update on public.crisis_shapes
  for each row execute function public.crisis_notify_shape();

-- Meetings: participants hear the decision; staff hear a new request.
create or replace function public.crisis_notify_meeting() returns trigger
language plpgsql security definer set search_path = public as $$
declare label text;
begin
  if tg_op = 'INSERT' then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select new.crisis_id, m.id, 'meeting', 'Meeting requested', left(new.intention, 300), 'meetings', new.id
      from public.crisis_members m where m.crisis_id = new.crisis_id and m.role in ('director','assistant_director','backroomer');
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved','declined','held') then
    label := case new.status when 'approved' then 'Meeting approved' when 'declined' then 'Meeting declined' else 'Meeting held' end;
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select new.crisis_id, m.id, 'meeting', label, left(coalesce(new.staff_note, new.intention), 300), 'meetings', new.id
      from public.crisis_members m where m.crisis_id = new.crisis_id and m.character_id = any(new.character_ids);
  end if;
  return new;
end $$;
create trigger crisis_meetings_notify after insert or update on public.crisis_meetings
  for each row execute function public.crisis_notify_meeting();

-- Character status: the person playing the character is told.
create or replace function public.crisis_notify_character() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select new.crisis_id, m.id, 'status', new.name || ' is now ' || new.status, new.status_note, '', new.id
      from public.crisis_members m where m.crisis_id = new.crisis_id and m.character_id = new.id;
  end if;
  return new;
end $$;
create trigger crisis_characters_notify after update on public.crisis_characters
  for each row execute function public.crisis_notify_character();
