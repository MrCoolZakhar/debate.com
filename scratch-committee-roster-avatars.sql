-- scratch-committee-roster-avatars.sql
-- DRAFT, NOT APPLIED. Apply only through the chat's Supabase work. 21 Oct 2026.
--
-- my_committee_roster returns no photo, so committee lists draw initials. This
-- adds avatar_url (profiles.avatar_url of the person already named on the row)
-- to the result. Nothing else changes: same gate, same rows, same order, and
-- the photo is null exactly where delegate_name is null (an open seat) or the
-- person has no photo. Based on the live body read with pg_get_functiondef on
-- 21 Oct 2026.
--
-- The return type changes, so the function is dropped and re-created (CREATE OR
-- REPLACE cannot add an OUT column). The grant is restated to match the live
-- one (authenticated and service_role on 21 Oct 2026); re-check before applying:
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'my_committee_roster';
--
-- Client that would read it (NOT edited in this run):
--   src/app/conferences/[slug]/participant/delegation/committee/committeeSlots.ts
--   (map avatar_url onto the slot and pass it to the avatar instead of initials)

begin;

drop function if exists public.my_committee_roster(uuid);

create function public.my_committee_roster(p_conference_committee uuid)
 returns table(country_code text, country_name text, seat smallint, delegate_name text, society_name text, is_mine boolean, avatar_url text)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  select cc.conference_id into v_conf from conference_committees cc where cc.id = p_conference_committee;
  if v_conf is null then
    raise exception 'We could not find this committee.' using errcode = 'P0001', hint = 'not_found';
  end if;

  if not (
    is_conference_organizer(v_conf)
    or exists (
      select 1 from conference_allocations ca
       where ca.conference_committee_id = p_conference_committee
         and ca.user_id = v_uid
         and ca.allocation_sent
         and exists (select 1 from applications a
                      where a.conference_id = v_conf and a.user_id = v_uid
                        and a.role in ('delegate', 'head-delegate')
                        and a.status in ('accepted', 'assigned', 'checked-in')))
    or exists (
      select 1 from conference_allocations ca
       left join applications m on m.id = ca.application_id
       where ca.conference_committee_id = p_conference_committee
         and ca.allocation_sent
         and coalesce(m.society_id, ca.society_id) is not null
         and is_society_leader(coalesce(m.society_id, ca.society_id)))
  ) then
    raise exception 'You can see this committee once your allocation in it is published.' using errcode = 'P0001', hint = 'not_allowed';
  end if;

  return query
  select ca.country_code,
         ca.country_name,
         ca.seat,
         case when ca.user_id is null and ca.application_id is null then null
              else coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.invited_name), ''), 'Delegate') end,
         s.name,
         coalesce(s.id in (select public.my_society_ids()), false),
         -- NEW: the named person's photo, only where a person is named.
         case when ca.user_id is null and ca.application_id is null then null
              else nullif(btrim(p.avatar_url), '') end
    from conference_allocations ca
    left join applications a on a.id = ca.application_id
    left join profiles p on p.id = coalesce(ca.user_id, a.user_id)
    left join societies s on s.id = coalesce(a.society_id, ca.society_id)
   where ca.conference_committee_id = p_conference_committee
     and ca.allocation_sent
   order by ca.country_name, ca.seat;
end $function$;

revoke all on function public.my_committee_roster(uuid) from public, anon;
grant execute on function public.my_committee_roster(uuid) to authenticated, service_role;

commit;

-- Note for the owners (not changed here): the roster lists only rows with
-- allocation_sent, and a delegation's OPEN block seats are never marked sent,
-- so a leader whose delegation holds only open seats in a committee is refused
-- ("once your allocation in it is published") and those seats never appear in
-- anyone's roster. If block seats should show, that is a separate decision
-- (for example: count released block seats, see scratch-delegation-allocation-email.sql section C).
