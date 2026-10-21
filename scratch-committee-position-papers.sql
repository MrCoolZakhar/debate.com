-- scratch-committee-position-papers.sql
-- DRAFT for the owners' Supabase chat. Not applied. Read from the live project on 21 Oct 2026.
--
-- Owner, 21 Oct 2026 (Peter): the delegate's Committee section lists every member of the
-- committee, and each member's position paper once it is submitted, "so the whole committee
-- can read each other's papers".
--
-- Today (read-only inspection, 21 Oct 2026):
--   public.position_papers SELECT policies
--     "Delegates manage own position papers"          user_id = auth.uid()
--     "Seatmates read shared position paper"          user_is_allocated_to(committee, country)
--     "Delegation leaders read member position papers" pp_leader_of_member(committee, user_id)
--     "Chairs read committee position papers"         chairs and organisers
--   storage.objects (bucket position-papers) SELECT policies
--     "Position papers: read by author, seatmates, chairs, organisers"  pp_object_readable(name)
--     "Position papers: read by delegation leaders"   pp_leader_of_member(pp_key_uuid(name,2), pp_key_uuid(name,3))
--   Object paths are <conference_id>/<conference_committee_id>/<user_id>_<epoch>.pdf.
--   The bucket is still public (scratch-private-buckets.sql makes it private); the storage
--   policy below matters once it is, and for signed URLs (openPositionPaper) either way.
--
-- The change, minimal and additive (no existing policy or function is altered):
--   1. pp_committee_member(p_committee)  SECURITY DEFINER: the caller is an accepted
--      delegate or head delegate (accepted / assigned / checked-in) of the committee's
--      conference AND holds a PUBLISHED allocation (allocation_sent) in that committee.
--      Published, because my_committee_roster shows the committee list only then: a
--      delegate reads the committee's papers exactly when they can see who is in it.
--   2. pp_committee_paper_visible(p_paper) SECURITY DEFINER: the paper is submitted
--      (status submitted, reviewed or approved; a paper sent back, 'rejected', is not),
--      its country holds a published allocation in the committee (an unpublished seat is
--      never revealed through its paper), and the caller is pp_committee_member of it.
--   3. A SELECT policy on public.position_papers using (2).
--   4. pp_object_committee_readable(p_name) SECURITY DEFINER: the object is the file of a
--      paper that (2) allows, matched like pp_object_readable does (committee from the
--      path, file_url ending in the object name).
--   5. A SELECT policy on storage.objects for bucket position-papers using (4).
-- Nothing here grants INSERT, UPDATE or DELETE; the chat thread (position_paper_messages)
-- and reviews stay as they are. Observers, faculty advisors and chairs are unchanged
-- (advisors read their own delegation's papers through pp_leader_of_member already).
--
-- Client: src/app/conferences/[slug]/participant/delegation/committee/committeePapers.ts
-- reads position_papers of the committee (status submitted/reviewed/approved) and links
-- each country's paper. COMMITTEE_PAPERS_DB = false until this is applied: while false
-- the links are limited to the viewer's own country and, for leaders, their delegation's.
-- Flip it to true in the same session this lands.

begin;

create or replace function public.pp_committee_member(p_committee uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select auth.uid() is not null and p_committee is not null and exists (
    select 1
      from conference_allocations ca
      join applications a
        on a.conference_id = ca.conference_id
       and a.user_id = auth.uid()
     where ca.conference_committee_id = p_committee
       and ca.user_id = auth.uid()
       and ca.allocation_sent
       and a.role in ('delegate', 'head-delegate')
       and a.status in ('accepted', 'assigned', 'checked-in'));
$$;

create or replace function public.pp_committee_paper_visible(p_paper uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
      from position_papers pp
     where pp.id = p_paper
       and pp.status in ('submitted', 'reviewed', 'approved')
       and exists (select 1 from conference_allocations ca
                    where ca.conference_committee_id = pp.conference_committee_id
                      and ca.country_code = pp.country_code
                      and ca.allocation_sent)
       and public.pp_committee_member(pp.conference_committee_id));
$$;

revoke all on function public.pp_committee_member(uuid) from public, anon;
revoke all on function public.pp_committee_paper_visible(uuid) from public, anon;
grant execute on function public.pp_committee_member(uuid) to authenticated;
grant execute on function public.pp_committee_paper_visible(uuid) to authenticated;

drop policy if exists "Committee members read submitted position papers" on public.position_papers;
create policy "Committee members read submitted position papers"
  on public.position_papers
  for select
  to authenticated
  using (public.pp_committee_paper_visible(id));

create or replace function public.pp_object_committee_readable(p_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select auth.uid() is not null and exists (
    select 1
      from position_papers pp
     where pp.conference_committee_id = public.pp_key_uuid(p_name, 2)
       and pp.file_url like '%/position-papers/' || p_name
       and public.pp_committee_paper_visible(pp.id));
$$;

revoke all on function public.pp_object_committee_readable(text) from public, anon;
grant execute on function public.pp_object_committee_readable(text) to authenticated;

drop policy if exists "Position papers: read by committee members" on storage.objects;
create policy "Position papers: read by committee members"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'position-papers' and public.pp_object_committee_readable(name));

commit;

-- ── Verify (rolled back; run separately, before or after applying) ─────────────────────
-- Applies the same objects inside a transaction, then reads as a real seated delegate of a
-- committee that has a submitted paper of ANOTHER country, and compares what that delegate
-- could read before (own + seatmates) with what they read after. Nothing is kept.
--
-- begin;
--   -- (paste the five objects above here, without begin/commit)
--   create temp table _pick on commit drop as
--     select ca.user_id as viewer, ca.conference_committee_id as committee
--       from conference_allocations ca
--       join applications a on a.conference_id = ca.conference_id and a.user_id = ca.user_id
--      where ca.allocation_sent and ca.user_id is not null
--        and a.role in ('delegate', 'head-delegate') and a.status in ('accepted', 'assigned', 'checked-in')
--        and exists (select 1 from position_papers pp
--                     where pp.conference_committee_id = ca.conference_committee_id
--                       and pp.country_code <> ca.country_code
--                       and pp.status in ('submitted', 'reviewed', 'approved'))
--      limit 1;
--   grant select on _pick to authenticated;
--   select * from _pick;                                  -- empty = no committee to test on yet
--   select set_config('request.jwt.claims',
--            json_build_object('sub', (select viewer from _pick), 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select count(*) as papers_readable_now,
--          count(*) filter (where pp.user_id <> auth.uid()) as others_papers
--     from position_papers pp
--    where pp.conference_committee_id = (select committee from _pick);
--   -- expected: others_papers > 0 (every submitted paper of a published country)
--   select count(*) as objects_readable
--     from storage.objects o
--    where o.bucket_id = 'position-papers'
--      and public.pp_key_uuid(o.name, 2) = (select committee from _pick);
--   -- a paper sent back stays hidden (expected: every row visible = false):
--   select pp.status, public.pp_committee_paper_visible(pp.id) as visible
--     from position_papers pp
--    where pp.conference_committee_id = (select committee from _pick)
--      and pp.status = 'rejected';
--   reset role;
-- rollback;
