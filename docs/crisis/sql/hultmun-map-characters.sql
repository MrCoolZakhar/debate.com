-- Gavelling Crisis: HultMUN crisis director feedback (23 Nov 2026). APPLIED 23 Nov 2026 (Peter approved).
--
-- A. crisis_sync_roster: a delegate whose profile has no name was named after the SEAT (the character's own name), so the
--    character looked "assigned to itself". Now such a delegate gets the local part of their email, else 'Delegate'.
--    (Client already shows "Name not set" for these; nothing here depends on it.)
-- B. crisis_swap_delegate_characters(p_member_a, p_member_b): two delegates trade characters in ONE transaction (any cabinets;
--    each cabinet follows the new character through the trigger crisis_members_cabinet_from_character). Client:
--    SWAP_DELEGATES_DB in src/lib/crisis/placeDelegate.ts stays false until this is applied.
-- C. Not needed: new map units default their "Known to" to every other cabinet in the client (MapPanels.defaultKnownTo); zones and
--    territory were already created public by the client. crisis_units.revealed_to / crisis_shapes.public keep their database defaults.

-- ───────────── A. crisis_sync_roster (same body as live; only the delegate name fallback changed) ─────────────
create or replace function public.crisis_sync_roster(p_crisis uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare cab record; s record; a record; chr uuid; added_c int := 0; added_m int := 0;
begin
  if not public.crisis_is_director(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  for cab in select * from public.crisis_cabinets where crisis_id = p_crisis and conference_committee_id is not null loop
    for s in select * from public.committee_country_slots where conference_committee_id = cab.conference_committee_id order by country_name loop
      if not exists (select 1 from public.crisis_characters where slot_id = s.id) then
        insert into public.crisis_characters(crisis_id, cabinet_id, name, picture_url, slot_id)
        values (p_crisis, cab.id, coalesce(nullif(btrim(s.country_name), ''), s.country_code), s.logo_url, s.id);
        added_c := added_c + 1;
      end if;
    end loop;
    for a in select al.*, p.display_name, u.email
               from public.conference_allocations al
               left join public.profiles p on p.id = al.user_id
               left join auth.users u on u.id = al.user_id
              where al.conference_committee_id = cab.conference_committee_id and al.user_id is not null loop
      chr := null;
      select ch.id into chr from public.crisis_characters ch
        join public.committee_country_slots sl on sl.id = ch.slot_id
       where ch.cabinet_id = cab.id and (sl.country_code = a.country_code or sl.country_name = a.country_name) limit 1;
      if not exists (select 1 from public.crisis_members where crisis_id = p_crisis and user_id = a.user_id) then
        insert into public.crisis_members(crisis_id, user_id, role, cabinet_id, character_id, display_name, email)
        values (p_crisis, a.user_id, 'delegate', cab.id, chr,
                coalesce(nullif(btrim(a.display_name), ''), nullif(btrim(split_part(coalesce(a.email, ''), '@', 1)), ''), 'Delegate'), a.email);
        added_m := added_m + 1;
      end if;
    end loop;
    insert into public.crisis_members(crisis_id, user_id, role, cabinet_id, display_name, email)
    select p_crisis, u.id, 'chair', cab.id, coalesce(nullif(btrim(p.display_name), ''), 'Chair'), u.email
      from public.conference_committees cc
      cross join lateral unnest(cc.chair_user_ids) as ch(uid)
      join auth.users u on u.id = ch.uid
      left join public.profiles p on p.id = u.id
     where cc.id = cab.conference_committee_id
       and not exists (select 1 from public.crisis_members m where m.crisis_id = p_crisis and m.user_id = u.id);
  end loop;
  return jsonb_build_object('characters_added', added_c, 'members_added', added_m);
end $$;

-- Optional repair, PREVIEW ONLY (changes nothing): delegates whose name is still their character's name.
--   select m.id, m.crisis_id, m.display_name, m.email from crisis_members m join crisis_characters c on c.id = m.character_id
--    where m.role = 'delegate' and lower(btrim(m.display_name)) = lower(btrim(c.name));
-- (25 of 110 on 23 Nov 2026.) The director can also type the real name under Staff and Access > Manage > Name.

-- ───────────── B. Swap two delegates' characters ─────────────
create or replace function public.crisis_swap_delegate_characters(p_member_a uuid, p_member_b uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a record; b record;
begin
  if p_member_a = p_member_b then return jsonb_build_object('ok', false, 'reason', 'not_delegates'); end if;
  -- Lock both rows in a fixed order so two swaps can never deadlock.
  select * into a from public.crisis_members where id = least(p_member_a, p_member_b) for update;
  select * into b from public.crisis_members where id = greatest(p_member_a, p_member_b) for update;
  if a.id is null or b.id is null or a.crisis_id <> b.crisis_id then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  if not (public.crisis_is_director(a.crisis_id) or public.crisis_can(a.crisis_id, 'characters')) then
    raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select * into a from public.crisis_members where id = p_member_a;
  select * into b from public.crisis_members where id = p_member_b;
  if a.role <> 'delegate' or b.role <> 'delegate' or a.character_id is null or b.character_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_delegates');
  end if;
  -- Each cabinet follows its new character (crisis_members_cabinet_from_character); the player history trigger records both moves.
  update public.crisis_members set character_id = b.character_id where id = a.id;
  update public.crisis_members set character_id = a.character_id where id = b.id;
  insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link)
  select a.crisis_id, x.member, 'status', 'You now play ' || left(c.name, 160), null, null
    from (values (a.id, b.character_id), (b.id, a.character_id)) as x(member, ch)
    join public.crisis_characters c on c.id = x.ch;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.crisis_swap_delegate_characters(uuid, uuid) from public, anon;
grant execute on function public.crisis_swap_delegate_characters(uuid, uuid) to authenticated;

-- ───────────── Rolled-back test (run as the crisis director's session, or replace the ids) ─────────────
-- begin;
--   -- pick two delegates with characters in one crisis
--   select m.id, m.display_name, m.character_id, m.cabinet_id from crisis_members m where m.crisis_id = '<crisis>' and m.role = 'delegate' and m.character_id is not null limit 2;
--   select public.crisis_swap_delegate_characters('<member a>', '<member b>');   -- expect {"ok": true}
--   select id, character_id, cabinet_id from crisis_members where id in ('<member a>', '<member b>');   -- characters traded, cabinets follow
--   select public.crisis_swap_delegate_characters('<member a>', '<member a>');   -- expect {"ok": false, "reason": "not_delegates"}
-- rollback;
