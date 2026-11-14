-- Crisis part 39 (14 Nov 2026, Hult MUN: chairs project their screen to the room).
-- Applied as migration crisis_part39_chairs_see_other_cabinet_people_only.
--
-- "Chairs see both cabinets" (settings.chairsSeeAllCabinets) now means the other cabinet's DELEGATES (characters:
-- names, titles, bios, pictures, through characters_read, crisis_world and crisis_meeting_people) and nothing else.
-- A chair never reads another cabinet's directives or meetings, whatever the setting says.

drop policy if exists directives_read on public.crisis_directives;
create policy directives_read on public.crisis_directives for select using (
  (public.crisis_is_staff(crisis_id)
     and ((status <> all (array['awaiting_chair', 'changes_requested', 'rejected'])) or public.crisis_is_director(crisis_id))
     and (public.crisis_can(crisis_id, 'seeAll') or assigned_member_id = (public.crisis_me(crisis_id)).id or assigned_member_id is null))
  or author_member_id = (public.crisis_me(crisis_id)).id
  or public.crisis_is_coauthor(id, crisis_id)
  or (public.crisis_role(crisis_id) = 'chair'
      and (cabinet_id is null or cabinet_id = public.crisis_my_cabinet(crisis_id))
      and (kind = any (array['committee', 'communique', 'press_release'])
           or coalesce((select (c.settings ->> 'chairReadsPersonal')::boolean from public.crises c where c.id = crisis_directives.crisis_id), false))));

drop policy if exists meetings_read on public.crisis_meetings;
create policy meetings_read on public.crisis_meetings for select using (
  public.crisis_is_staff(crisis_id)
  or (public.crisis_me(crisis_id)).character_id = any (character_ids)
  or (public.crisis_role(crisis_id) = 'chair'
      and exists (select 1 from public.crisis_characters ch
                   where ch.id = any (crisis_meetings.character_ids) and ch.cabinet_id = public.crisis_my_cabinet(crisis_meetings.crisis_id))));
