-- Gavelling Crisis, part 22 (applied 30 Oct 2026 as crisis_part22_map_set_v2).
-- crisis_apply_map_set_v2(p_crisis, p_set jsonb): everything crisis_apply_map_set (part 20) takes, plus what the unsent
-- map changes now hold, in ONE transaction:
--   units:[{id, lng?, lat?, strength?, sight_km?, name?, kind?, owner_cabinet_id?, note?, revealed_to?}]  (only keys present change)
--   addUnits:[{name, kind, strength, owner_cabinet_id, note, revealed_to, sight_km, lng, lat}]            -> ids in "addedUnits", in order
--   removeUnits:[unit id]                                                                              (already gone is fine)
--   chars:[{id, lng, lat}]                                                                              (a character's exact spot)
--   -> {ok, v: 2, added:[new shape ids], addedUnits:[new unit ids]}
-- The map parts (regions, shapes, owners, removeShapes, addShapes) and the plain unit fields (lng, lat, strength, sight_km)
-- go through crisis_apply_map_set unchanged, so its power checks and its logging stay the one definition. Unit parts need
-- crisis_can 'units', character moves need 'characters'. Until this exists the client sends the map part with the first
-- function and the rest one row at a time (src/app/crisis/components/map/mapEdits.ts sendSet).

create or replace function public.crisis_apply_map_set_v2(p_crisis uuid, p_set jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  uid uuid;
  new_id uuid;
  n integer;
  res jsonb := jsonb_build_object('ok', true, 'added', '[]'::jsonb);
  base_units jsonb;
  base jsonb;
  base_parts integer;
  added_units uuid[] := '{}';
  unit_parts boolean;
begin
  unit_parts := jsonb_array_length(coalesce(p_set -> 'units', '[]'::jsonb)) > 0
             or jsonb_array_length(coalesce(p_set -> 'addUnits', '[]'::jsonb)) > 0
             or jsonb_array_length(coalesce(p_set -> 'removeUnits', '[]'::jsonb)) > 0;
  if unit_parts and not public.crisis_can(p_crisis, 'units') then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_set -> 'chars', '[]'::jsonb)) > 0 and not public.crisis_can(p_crisis, 'characters') then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;

  -- 1. The map part and the plain unit fields: the first function, as it is.
  select coalesce(jsonb_agg(s.obj), '[]'::jsonb) into base_units
    from (
      select (select jsonb_object_agg(k, u -> k) from unnest(array['id', 'lng', 'lat', 'strength', 'sight_km']) k where u ? k) as obj
        from jsonb_array_elements(coalesce(p_set -> 'units', '[]'::jsonb)) u
    ) s
   where s.obj is not null and (s.obj - 'id') <> '{}'::jsonb;
  base := jsonb_build_object(
    'regions', coalesce(p_set -> 'regions', '[]'::jsonb),
    'shapes', coalesce(p_set -> 'shapes', '[]'::jsonb),
    'owners', coalesce(p_set -> 'owners', '[]'::jsonb),
    'removeShapes', coalesce(p_set -> 'removeShapes', '[]'::jsonb),
    'addShapes', coalesce(p_set -> 'addShapes', '[]'::jsonb),
    'units', base_units);
  base_parts := jsonb_array_length(base -> 'regions') + jsonb_array_length(base -> 'shapes') + jsonb_array_length(base -> 'owners')
              + jsonb_array_length(base -> 'removeShapes') + jsonb_array_length(base -> 'addShapes') + jsonb_array_length(base_units);
  if base_parts > 0 then
    res := public.crisis_apply_map_set(p_crisis, base);
  end if;

  -- 2. The other unit fields.
  for e in select value from jsonb_array_elements(coalesce(p_set -> 'units', '[]'::jsonb)) loop
    if e ?| array['name', 'kind', 'owner_cabinet_id', 'note', 'revealed_to'] then
      update public.crisis_units set
        name = case when e ? 'name' then btrim(e ->> 'name') else name end,
        kind = case when e ? 'kind' then e ->> 'kind' else kind end,
        owner_cabinet_id = case when e ? 'owner_cabinet_id' then nullif(e ->> 'owner_cabinet_id', '')::uuid else owner_cabinet_id end,
        note = case when e ? 'note' then e ->> 'note' else note end,
        revealed_to = case when e ? 'revealed_to' then
          coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(e -> 'revealed_to') = 'array' then e -> 'revealed_to' else '[]'::jsonb end))::uuid[], '{}')
          else revealed_to end
       where id = (e ->> 'id')::uuid and crisis_id = p_crisis;
      get diagnostics n = row_count;
      if n = 0 then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
    end if;
  end loop;

  -- 3. Units added.
  for e in select value from jsonb_array_elements(coalesce(p_set -> 'addUnits', '[]'::jsonb)) loop
    insert into public.crisis_units (crisis_id, owner_cabinet_id, kind, name, strength, lng, lat, note, revealed_to, sight_km)
    values (
      p_crisis, nullif(e ->> 'owner_cabinet_id', '')::uuid, coalesce(e ->> 'kind', 'army'), btrim(e ->> 'name'),
      coalesce((e ->> 'strength')::integer, 1), (e ->> 'lng')::double precision, (e ->> 'lat')::double precision, e ->> 'note',
      coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(e -> 'revealed_to') = 'array' then e -> 'revealed_to' else '[]'::jsonb end))::uuid[], '{}'),
      nullif(e ->> 'sight_km', '')::double precision)
    returning id into new_id;
    added_units := added_units || new_id;
  end loop;

  -- 4. Units removed (one already gone is fine).
  for uid in select (value)::uuid from jsonb_array_elements_text(coalesce(p_set -> 'removeUnits', '[]'::jsonb)) loop
    delete from public.crisis_units where id = uid and crisis_id = p_crisis;
  end loop;

  -- 5. Characters moved to an exact spot.
  for e in select value from jsonb_array_elements(coalesce(p_set -> 'chars', '[]'::jsonb)) loop
    update public.crisis_characters
       set location_lng = (e ->> 'lng')::double precision, location_lat = (e ->> 'lat')::double precision
     where id = (e ->> 'id')::uuid and crisis_id = p_crisis;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  end loop;

  return jsonb_build_object('ok', true, 'v', 2, 'added', coalesce(res -> 'added', '[]'::jsonb), 'addedUnits', to_jsonb(added_units));
end $$;

revoke all on function public.crisis_apply_map_set_v2(uuid, jsonb) from public;
grant execute on function public.crisis_apply_map_set_v2(uuid, jsonb) to anon, authenticated;
