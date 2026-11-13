-- Crisis part 37 (13 Nov 2026, Hult MUN feedback). Applied as migration crisis_part37_chairs_meetings_parties_clarify.
--
-- 1. chairsSeeAllCabinets (setting, default off): a chair also reads the other cabinets' characters,
--    cabinet directives and meetings. Approving or sending back a cabinet directive stays own cabinet only
--    (crisis_chair_review_directive / crisis_chair_request_changes are unchanged).
-- 2. crossCabinetMeetings (setting, default on): delegates may ask characters of another cabinet to a meeting.
--    crisis_meeting_people lists who the caller may invite (names and pictures only), even when
--    otherCabinets is 'hidden'. Off: crisis_request_meeting refuses other cabinets' characters ('other_cabinet').
-- 3. Third parties on the map: settings.thirdParties [{id, name, color}] can own land, areas, zones and units
--    through the same owner_cabinet_id column. The foreign keys to crisis_cabinets are replaced by a check
--    trigger (a cabinet of this crisis or a listed third party) and a cabinet delete clears its land as before.
--    crisis_add_party creates one (dropping parties that own nothing), crisis_remove_party clears its land and
--    drops it. Both need the map power.
-- 4. Clarifications on cabinet directives: co-authors and the cabinet's chair may answer the backroom's
--    question (not just the writer). The chair is told when the backroom answers or asks about a cabinet
--    directive, and a clarification answer from any of them reaches the backroomer.

create or replace function public.crisis_setting_bool(p_crisis uuid, p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (settings ->> p_key)::boolean from public.crises where id = p_crisis), p_default)
$$;

create or replace function public.crisis_chair_sees_all(p_crisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.crisis_role(p_crisis) = 'chair', false)
     and public.crisis_setting_bool(p_crisis, 'chairsSeeAllCabinets', false)
$$;

-- 1. Chairs and the other cabinet ------------------------------------------------------------------------

drop policy if exists characters_read on public.crisis_characters;
create policy characters_read on public.crisis_characters for select using (
  public.crisis_is_staff(crisis_id)
  or (cabinet_id is not null and cabinet_id = public.crisis_my_cabinet(crisis_id))
  or public.crisis_chair_sees_all(crisis_id));

drop policy if exists directives_read on public.crisis_directives;
create policy directives_read on public.crisis_directives for select using (
  (public.crisis_is_staff(crisis_id)
     and (status <> all (array['awaiting_chair','changes_requested','rejected']) or public.crisis_is_director(crisis_id))
     and (public.crisis_can(crisis_id, 'seeAll') or assigned_member_id = (public.crisis_me(crisis_id)).id or assigned_member_id is null))
  or author_member_id = (public.crisis_me(crisis_id)).id
  or public.crisis_is_coauthor(id, crisis_id)
  or (public.crisis_role(crisis_id) = 'chair'
      and (cabinet_id is null or cabinet_id = public.crisis_my_cabinet(crisis_id) or public.crisis_chair_sees_all(crisis_id))
      and (kind = any (array['committee','communique','press_release'])
           or coalesce((select (c.settings ->> 'chairReadsPersonal')::boolean from public.crises c where c.id = crisis_directives.crisis_id), false))));

drop policy if exists meetings_read on public.crisis_meetings;
create policy meetings_read on public.crisis_meetings for select using (
  public.crisis_is_staff(crisis_id)
  or (public.crisis_me(crisis_id)).character_id = any (character_ids)
  or (public.crisis_role(crisis_id) = 'chair'
      and (public.crisis_chair_sees_all(crisis_id)
           or exists (select 1 from public.crisis_characters ch
                       where ch.id = any (crisis_meetings.character_ids) and ch.cabinet_id = public.crisis_my_cabinet(crisis_meetings.crisis_id)))));

create or replace function public.crisis_world(p_crisis uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare vis text; mine uuid; staff boolean;
begin
  if not public.crisis_is_member(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  staff := public.crisis_is_staff(p_crisis) or public.crisis_chair_sees_all(p_crisis);
  mine := public.crisis_my_cabinet(p_crisis);
  select coalesce(settings ->> 'otherCabinets', 'hidden') into vis from public.crises where id = p_crisis;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', ch.id, 'cabinet_id', ch.cabinet_id, 'name', ch.name, 'status', ch.status,
      'title', case when staff or ch.cabinet_id = mine or vis in ('full','profiles') then ch.title end,
      'bio', case when staff or ch.cabinet_id = mine or vis in ('full','profiles') then ch.bio end,
      'picture_url', case when staff or ch.cabinet_id = mine or vis <> 'hidden' then ch.picture_url end)
      order by ch.sort, ch.name)
    from public.crisis_characters ch
    where ch.crisis_id = p_crisis and ch.status <> 'spare'
      and (staff or ch.cabinet_id = mine or vis <> 'hidden')), '[]'::jsonb);
end $$;

-- 2. Cross-cabinet meetings ----------------------------------------------------------------------------

create or replace function public.crisis_meeting_people(p_crisis uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mine uuid; open_all boolean;
begin
  if not public.crisis_is_member(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  mine := public.crisis_my_cabinet(p_crisis);
  open_all := public.crisis_is_staff(p_crisis) or public.crisis_chair_sees_all(p_crisis)
              or public.crisis_setting_bool(p_crisis, 'crossCabinetMeetings', true);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', ch.id, 'cabinet_id', ch.cabinet_id, 'name', ch.name, 'status', ch.status, 'picture_url', ch.picture_url)
      order by ch.sort, ch.name)
    from public.crisis_characters ch
    where ch.crisis_id = p_crisis and ch.status <> 'spare'
      and (open_all or ch.cabinet_id = mine)), '[]'::jsonb);
end $$;
grant execute on function public.crisis_meeting_people(uuid) to anon, authenticated;

create or replace function public.crisis_request_meeting(p_crisis uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.crisis_members; ids uuid[]; needs boolean; mid uuid; st text; asks boolean; my_cab uuid;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null or me.character_id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select array_agg(distinct x) into ids from (
    select me.character_id as x
    union select (jsonb_array_elements_text(coalesce(p -> 'character_ids', '[]'::jsonb)))::uuid) s
   where exists (select 1 from public.crisis_characters c where c.id = s.x and c.crisis_id = p_crisis);
  if coalesce(array_length(ids, 1), 0) < 2 then return jsonb_build_object('ok', false, 'reason', 'nobody'); end if;
  if not public.crisis_setting_bool(p_crisis, 'crossCabinetMeetings', true) then
    select cabinet_id into my_cab from public.crisis_characters where id = me.character_id;
    if exists (select 1 from public.crisis_characters c where c.id = any(ids) and c.cabinet_id is distinct from my_cab) then
      return jsonb_build_object('ok', false, 'reason', 'other_cabinet');
    end if;
  end if;
  select coalesce((settings ->> 'meetingsNeedApproval')::boolean, true) into needs from public.crises where id = p_crisis;
  asks := exists (select 1 from public.crisis_members mm where mm.crisis_id = p_crisis and mm.role = 'delegate'
                   and mm.character_id = any(ids) and mm.character_id <> me.character_id);
  st := case when asks then 'awaiting_delegates' when needs then 'pending' else 'approved' end;
  insert into public.crisis_meetings(crisis_id, requested_by_member, requested_by_character, character_ids, intention, duration_minutes, wanted_time, status, delegates_due_at)
  values (p_crisis, me.id, me.character_id, ids, btrim(p ->> 'intention'), coalesce((p ->> 'duration_minutes')::int, 10),
          nullif(btrim(coalesce(p ->> 'wanted_time', '')), ''), st, case when asks then now() + interval '5 minutes' end)
  returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'status', st);
end $$;

-- 3. Third parties on the map ---------------------------------------------------------------------------

alter table public.crisis_map_regions drop constraint if exists crisis_map_regions_owner_cabinet_id_fkey;
alter table public.crisis_shapes drop constraint if exists crisis_shapes_owner_cabinet_id_fkey;
alter table public.crisis_units drop constraint if exists crisis_units_owner_cabinet_id_fkey;

create or replace function public.crisis_is_party(p_crisis uuid, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crises c, jsonb_array_elements(coalesce(c.settings -> 'thirdParties', '[]'::jsonb)) e
                  where c.id = p_crisis and e ->> 'id' = p_id::text)
$$;

create or replace function public.crisis_owner_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_cabinet_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.owner_cabinet_id is not distinct from old.owner_cabinet_id then return new; end if;
  if exists (select 1 from public.crisis_cabinets where id = new.owner_cabinet_id and crisis_id = new.crisis_id)
     or public.crisis_is_party(new.crisis_id, new.owner_cabinet_id) then
    return new;
  end if;
  raise exception 'crisis_bad_owner' using errcode = '23503';
end $$;

drop trigger if exists crisis_map_regions_owner_check on public.crisis_map_regions;
create trigger crisis_map_regions_owner_check before insert or update of owner_cabinet_id on public.crisis_map_regions
  for each row execute function public.crisis_owner_check();
drop trigger if exists crisis_shapes_owner_check on public.crisis_shapes;
create trigger crisis_shapes_owner_check before insert or update of owner_cabinet_id on public.crisis_shapes
  for each row execute function public.crisis_owner_check();
drop trigger if exists crisis_units_owner_check on public.crisis_units;
create trigger crisis_units_owner_check before insert or update of owner_cabinet_id on public.crisis_units
  for each row execute function public.crisis_owner_check();

-- What the dropped foreign keys did on a cabinet delete.
create or replace function public.crisis_cabinet_gone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.crisis_map_regions set owner_cabinet_id = null where owner_cabinet_id = old.id;
  update public.crisis_shapes set owner_cabinet_id = null where owner_cabinet_id = old.id;
  update public.crisis_units set owner_cabinet_id = null where owner_cabinet_id = old.id;
  return old;
end $$;
drop trigger if exists crisis_cabinets_gone on public.crisis_cabinets;
create trigger crisis_cabinets_gone after delete on public.crisis_cabinets
  for each row execute function public.crisis_cabinet_gone();

create or replace function public.crisis_party_in_use(p_crisis uuid, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crisis_map_regions where crisis_id = p_crisis and owner_cabinet_id = p_id)
      or exists (select 1 from public.crisis_shapes where crisis_id = p_crisis and owner_cabinet_id = p_id)
      or exists (select 1 from public.crisis_units where crisis_id = p_crisis and owner_cabinet_id = p_id)
      or exists (select 1 from public.crisis_map_drafts where crisis_id = p_crisis and payload::text like '%' || p_id::text || '%')
$$;

-- Adds a third party (or returns the one with the same name) and drops parties that no longer own anything.
create or replace function public.crisis_add_party(p_crisis uuid, p_name text, p_color text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare nm text; col text; cur jsonb; kept jsonb; hit jsonb; pid uuid;
begin
  if not public.crisis_can(p_crisis, 'map') then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  nm := btrim(coalesce(p_name, ''));
  if nm = '' or char_length(nm) > 60 then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  col := case when coalesce(p_color, '') ~ '^#[0-9A-Fa-f]{6}$' then p_color else '#7A6F5A' end;
  select coalesce(settings -> 'thirdParties', '[]'::jsonb) into cur from public.crises where id = p_crisis for update;
  select e into hit from jsonb_array_elements(cur) e where lower(e ->> 'name') = lower(nm) limit 1;
  if hit is not null then return jsonb_build_object('ok', true, 'id', hit ->> 'id', 'existing', true); end if;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into kept from jsonb_array_elements(cur) e
   where public.crisis_party_in_use(p_crisis, (e ->> 'id')::uuid);
  if jsonb_array_length(kept) >= 20 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  pid := gen_random_uuid();
  update public.crises
     set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{thirdParties}', kept || jsonb_build_array(jsonb_build_object('id', pid, 'name', nm, 'color', col)))
   where id = p_crisis;
  return jsonb_build_object('ok', true, 'id', pid, 'existing', false);
end $$;
grant execute on function public.crisis_add_party(uuid, text, text) to anon, authenticated;

-- Renames or recolours a third party.
create or replace function public.crisis_edit_party(p_crisis uuid, p_id uuid, p_name text, p_color text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur jsonb; nm text;
begin
  if not public.crisis_can(p_crisis, 'map') then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  nm := btrim(coalesce(p_name, ''));
  if nm = '' or char_length(nm) > 60 then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  select coalesce(settings -> 'thirdParties', '[]'::jsonb) into cur from public.crises where id = p_crisis for update;
  update public.crises set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{thirdParties}',
    (select coalesce(jsonb_agg(case when e ->> 'id' = p_id::text
        then jsonb_build_object('id', e ->> 'id', 'name', nm,
               'color', case when coalesce(p_color, '') ~ '^#[0-9A-Fa-f]{6}$' then p_color else e ->> 'color' end)
        else e end), '[]'::jsonb) from jsonb_array_elements(cur) e))
   where id = p_crisis;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.crisis_edit_party(uuid, uuid, text, text) to anon, authenticated;

-- Removes a third party: its land, areas, zones and units become nobody's.
create or replace function public.crisis_remove_party(p_crisis uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.crisis_can(p_crisis, 'map') then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  perform set_config('crisis.batch', 'on', true);
  update public.crisis_map_regions set owner_cabinet_id = null where crisis_id = p_crisis and owner_cabinet_id = p_id;
  update public.crisis_shapes set owner_cabinet_id = null where crisis_id = p_crisis and owner_cabinet_id = p_id;
  update public.crisis_units set owner_cabinet_id = null where crisis_id = p_crisis and owner_cabinet_id = p_id;
  update public.crises set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{thirdParties}',
    (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(coalesce(settings -> 'thirdParties', '[]'::jsonb)) e
      where e ->> 'id' <> p_id::text))
   where id = p_crisis;
  perform set_config('crisis.batch', 'off', true);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.crisis_remove_party(uuid, uuid) to anon, authenticated;

-- 4. Clarifications on cabinet directives ---------------------------------------------------------------

create or replace function public.crisis_add_directive_note(p_directive uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare d record; me public.crisis_members; staff boolean; nid uuid; may boolean;
begin
  select * into d from public.crisis_directives where id = p_directive;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  me := public.crisis_me(d.crisis_id);
  staff := public.crisis_is_staff(d.crisis_id);
  may := staff
      or (me.id is not null and me.id = d.author_member_id)
      or (me.id is not null and public.crisis_is_coauthor(d.id, d.crisis_id))
      or (me.id is not null and me.role = 'chair' and d.kind = 'committee' and d.cabinet_id is not null and me.cabinet_id = d.cabinet_id);
  if not may then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  insert into public.crisis_directive_notes(directive_id, crisis_id, member_id, body, internal)
  values (p_directive, d.crisis_id, me.id, btrim(p_body), staff and coalesce(p_internal, false))
  returning id into nid;
  if not staff and d.status = 'clarify' then
    update public.crisis_directives set status = 'queued', waiting_since = now() where id = p_directive;
  end if;
  return nid;
end $$;

create or replace function public.crisis_notify_directive()
returns trigger language plpgsql security definer set search_path = public as $$
declare label text; target uuid; actor uuid;
begin
  if tg_op = 'INSERT' then
    if new.status = 'awaiting_chair' then
      insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
      select new.crisis_id, m.id, 'directive_new', 'Cabinet directive for your approval: ' || left(new.title, 120),
             (select name from public.crisis_characters where id = new.author_character_id), '?d=' || new.id, new.id
        from public.crisis_members m where m.crisis_id = new.crisis_id and m.role = 'chair' and m.cabinet_id = new.cabinet_id;
    else
      target := coalesce(new.assigned_member_id, public.crisis_fallback_staff(new.crisis_id, new.author_character_id));
      if target is not null then
        insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
        values (new.crisis_id, target, 'directive_new', 'New directive No. ' || coalesce(new.cabinet_no, new.no) || ': ' || left(new.title, 120),
               (select name from public.crisis_characters where id = new.author_character_id), 'directives?d=' || new.id, new.id);
      end if;
    end if;
    return new;
  end if;
  if new.answered_at is distinct from old.answered_at and new.answered_at is not null then
    actor := (public.crisis_me(new.crisis_id)).id;
    label := case when new.status = 'rejected' then 'Rejected by your chair'
                  else case new.outcome when 'approved' then 'Approved' when 'partial' then 'Partly works' when 'denied' then 'Denied'
                              when 'clarify' then 'More detail needed' else 'Answered' end end;
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select new.crisis_id, m.id, 'directive_answer', label || ': ' || left(new.title, 140), left(coalesce(new.reply, ''), 600), '?d=' || new.id, new.id
      from public.crisis_members m
     where m.crisis_id = new.crisis_id and m.id is distinct from actor
       and (m.id = new.author_member_id
        or m.character_id in (select character_id from public.crisis_directive_coauthors where directive_id = new.id)
        or (new.kind = 'committee' and new.status <> 'rejected' and m.role = 'chair' and m.cabinet_id = new.cabinet_id));
  end if;
  if new.assigned_member_id is distinct from old.assigned_member_id and new.assigned_member_id is not null
     and new.assigned_member_id is distinct from (public.crisis_me(new.crisis_id)).id then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, link, ref_id)
    values (new.crisis_id, new.assigned_member_id, 'directive_new', 'Handed to you: No. ' || coalesce(new.cabinet_no, new.no) || ' ' || left(new.title, 120), 'directives?d=' || new.id, new.id);
  end if;
  return new;
end $$;

create or replace function public.crisis_notify_directive_note()
returns trigger language plpgsql security definer set search_path = public as $$
declare d record; target uuid; writer public.crisis_members; who text;
begin
  if new.internal then return new; end if;
  select * into d from public.crisis_directives where id = new.directive_id;
  select * into writer from public.crisis_members where id = new.member_id;
  if writer.id is null or writer.role in ('director','assistant_director','backroomer') then return new; end if;
  -- An answer from the writer, a co-author or the cabinet's chair goes to the backroomer handling it.
  target := coalesce(d.assigned_member_id, public.crisis_fallback_staff(d.crisis_id, d.author_character_id));
  if target is not null then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    values (d.crisis_id, target, 'directive_note', 'Clarification on No. ' || coalesce(d.cabinet_no, d.no) || ': ' || left(d.title, 120), left(new.body, 600), 'directives?d=' || d.id, d.id);
  end if;
  -- On a cabinet directive the others who can answer hear that it was answered.
  if d.kind = 'committee' then
    who := case when writer.role = 'chair' then 'Your chair' else coalesce(writer.display_name, 'Your cabinet') end;
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select d.crisis_id, m.id, 'directive_note', who || ' answered the backroom on No. ' || coalesce(d.cabinet_no, d.no) || ': ' || left(d.title, 100), left(new.body, 600), '?d=' || d.id, d.id
      from public.crisis_members m
     where m.crisis_id = d.crisis_id and m.id <> writer.id
       and (m.id = d.author_member_id
        or m.character_id in (select character_id from public.crisis_directive_coauthors where directive_id = d.id)
        or (m.role = 'chair' and m.cabinet_id = d.cabinet_id));
  end if;
  return new;
end $$;
