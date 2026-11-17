-- Crisis part 38 (14 Nov 2026, Hult MUN). Applied as migration crisis_part38_parties_never_break_send.
--
-- At Hult a third party disappeared while 10 territories in the team's unsent map changes were painted in it,
-- and Send to delegates failed for everything with crisis_bad_owner. Three changes so that cannot happen again:
--
-- 1. An owner that no longer exists never fails a write: crisis_owner_check makes the land, area, zone or unit
--    nobody's (owner null), the same as crisis_remove_party does to land already sent. A cabinet of another
--    crisis is still never accepted (it becomes null too).
-- 2. crisis_remove_party refuses while the team's unsent changes give anything to the party
--    ({ok:false, reason:'in_draft'}); the map says to send or take back those changes first.
-- 3. crisis_add_party drops parties that own nothing only when the list is full (20). Before, every add dropped
--    them, which removed a party someone was painting with but had not saved to the shared draft yet.

create or replace function public.crisis_owner_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_cabinet_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.owner_cabinet_id is not distinct from old.owner_cabinet_id then return new; end if;
  if exists (select 1 from public.crisis_cabinets where id = new.owner_cabinet_id and crisis_id = new.crisis_id)
     or public.crisis_is_party(new.crisis_id, new.owner_cabinet_id) then
    return new;
  end if;
  -- The owner is gone (or was never this crisis's): the thing is nobody's, and the rest of the send goes through.
  new.owner_cabinet_id := null;
  return new;
end $$;

-- Whether the team's unsent map changes give anything to this owner.
create or replace function public.crisis_party_in_draft(p_crisis uuid, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crisis_map_drafts d,
      jsonb_array_elements(coalesce(d.payload -> 'owners', '[]'::jsonb) || coalesce(d.payload -> 'regions', '[]'::jsonb)
        || coalesce(d.payload -> 'addShapes', '[]'::jsonb) || coalesce(d.payload -> 'units', '[]'::jsonb)
        || coalesce(d.payload -> 'unitAdds', '[]'::jsonb)) x
     where d.crisis_id = p_crisis and jsonb_typeof(x) = 'object' and x ->> 'owner_cabinet_id' = p_id::text)
$$;

create or replace function public.crisis_remove_party(p_crisis uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.crisis_can(p_crisis, 'map') then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if public.crisis_party_in_draft(p_crisis, p_id) then return jsonb_build_object('ok', false, 'reason', 'in_draft'); end if;
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
  kept := cur;
  -- Only a full list makes room by dropping the parties that own nothing, sent or unsent.
  if jsonb_array_length(kept) >= 20 then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into kept from jsonb_array_elements(cur) e
     where public.crisis_party_in_use(p_crisis, (e ->> 'id')::uuid);
    if jsonb_array_length(kept) >= 20 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  end if;
  pid := gen_random_uuid();
  update public.crises
     set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{thirdParties}', kept || jsonb_build_array(jsonb_build_object('id', pid, 'name', nm, 'color', col)))
   where id = p_crisis;
  return jsonb_build_object('ok', true, 'id', pid, 'existing', false);
end $$;
grant execute on function public.crisis_add_party(uuid, text, text) to anon, authenticated;
