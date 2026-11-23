-- scratch-leader-paper-upload.sql  (23 Nov 2026)  APPLIED 23 Nov 2026 (migration position_papers_leader_upload_policy_fix, Peter asked for the fix).
--
-- BUG: a head delegate or faculty advisor could never upload a position paper for a member
-- (People table "Upload", member menu "Upload position paper"). The file goes to the bucket
-- first, and the storage INSERT policy "Position papers: upload for a delegation member"
-- always refuses it. Its sanity check reads
--
--     EXISTS (SELECT 1 FROM conference_committees cc
--              WHERE cc.id = pp_key_uuid(name, 2) AND cc.conference_id = pp_key_uuid(name, 1))
--
-- and inside that subquery the bare column `name` binds to conference_committees.name (the
-- committee's display name), not storage.objects.name. A committee name is never a path, so
-- pp_key_uuid(cc.name, 2) is always null, the EXISTS is never true, the policy never passes,
-- and storage answers "new row violates row-level security policy" for every leader upload.
-- (pg_get_expr prints it as pp_key_uuid(cc.name, 2).) The RPC delegation_submit_member_paper,
-- pp_leader_of_member and the position_papers table policies are all fine and were never reached.
--
-- FIX: qualify the column with the storage table. pp_leader_of_member() already proves the
-- committee, the member's seat and the caller's leadership, so the EXISTS only has to confirm
-- that segment 1 is the committee's own conference.

begin;

drop policy if exists "Position papers: upload for a delegation member" on storage.objects;

create policy "Position papers: upload for a delegation member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'position-papers'
    and pp_key_uuid(objects.name, 1) is not null
    and exists (
      select 1 from public.conference_committees cc
       where cc.id = pp_key_uuid(objects.name, 2)
         and cc.conference_id = pp_key_uuid(objects.name, 1)
    )
    and pp_leader_of_member(pp_key_uuid(objects.name, 2), pp_key_uuid(objects.name, 3))
  );

commit;

-- ---------------------------------------------------------------------------------------------
-- TEST (read only, rolls back). Run BEFORE the fix to see the old clause fail, AFTER to see it pass.
-- Picks one real delegate with a seat and builds the exact object name the client uploads.
-- ---------------------------------------------------------------------------------------------
begin;
with m as (
  select ca.conference_id, ca.conference_committee_id as committee_id, ca.user_id
    from conference_allocations ca
    join applications a on a.conference_id = ca.conference_id and a.user_id = ca.user_id
   where a.society_id is not null and a.role in ('delegate','head-delegate')
     and a.status in ('accepted','assigned','checked-in') and ca.user_id is not null
   limit 1
), n as (
  select m.*, m.conference_id || '/' || m.committee_id || '/' || m.user_id || '_1700000000000.pdf' as obj from m
)
select obj,
  -- the OLD clause (binds to the committee's name): expect false
  exists (select 1 from conference_committees cc
           where cc.id = pp_key_uuid(cc.name, 2) and cc.conference_id = pp_key_uuid(cc.name, 1)) as old_clause,
  -- the NEW clause (binds to the object name): expect true
  exists (select 1 from conference_committees cc
           where cc.id = pp_key_uuid(n.obj, 2) and cc.conference_id = pp_key_uuid(n.obj, 1)) as new_clause
from n;
-- Real end-to-end check after applying: as a head delegate, People table > Upload on a seated
-- member with a small PDF; then  select file_url, status from position_papers where user_id = '<member>';
rollback;
