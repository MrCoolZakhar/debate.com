-- ─────────────────────────────────────────────────────────────────────────────
-- Lock down the `study-guides` storage bucket.  DRAFT, NOT APPLIED.
-- Apply through the owners' Supabase chat (CLAUDE.md: no Claude Code run changes
-- a database object). Read-only audit 19 Oct 2026.
--
-- WHAT IS OPEN TODAY (storage.objects, bucket `study-guides`, role authenticated):
--   "Authenticated users can upload study guides"  INSERT  check bucket_id = 'study-guides'
--   "Authenticated users can update study guides"  UPDATE  using bucket_id = 'study-guides'
--   "Authenticated users can delete study guides"  DELETE  using bucket_id = 'study-guides'
--   "Authenticated users can read study guides"    SELECT  using bucket_id = 'study-guides'
-- So ANY signed-in account (a delegate of another conference included) can
-- overwrite or delete any conference's study guides and rules of procedure, and
-- list every file, unpublished guides included (listing gives the path, and the
-- bucket is public, so the path is a working download link before release).
--
-- HOW THE BUCKET IS USED (why this rule is safe):
--   * The only uploader is the Documents page (manage/[slug]/documents/
--     CommitteeDocsPopup.tsx): key `<conference_id>/<conference_committee_id>/<ts>-<file>`,
--     then a `study_guides` row whose policy is already organiser-only
--     ("Organizers manage study guides" = is_conference_organizer of the committee's conference).
--   * All 70 objects follow that key shape; 69 were uploaded by an organiser of that
--     conference (the 70th belongs to a committee that no longer exists).
--   * Every reader uses the stored PUBLIC url (study_guides.file_url, email buttons in
--     ConferenceFilesPanel). The bucket stays public, so downloads by URL are unchanged;
--     the SELECT policy below only limits API listing/downloading by path.
--
-- THE NEW RULE: writes and listing only by an organiser of the conference named in the
-- key's first segment, and only into a committee of that conference (second segment).
-- Same test as the study_guides table, so storage and table can never disagree.
-- Reuses public.pp_key_uuid(name, seg) (the position-papers helper: returns the
-- segment as uuid, or null when it is not one) and public.is_conference_organizer.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create or replace function public.sg_object_manageable(p_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select auth.uid() is not null
     and public.pp_key_uuid(p_name, 1) is not null
     and public.pp_key_uuid(p_name, 2) is not null
     and public.is_conference_organizer(public.pp_key_uuid(p_name, 1))
     and exists (
       select 1 from public.conference_committees cc
        where cc.id = public.pp_key_uuid(p_name, 2)
          and cc.conference_id = public.pp_key_uuid(p_name, 1)
     )
$$;

revoke all on function public.sg_object_manageable(text) from public;
grant execute on function public.sg_object_manageable(text) to authenticated;

drop policy if exists "Authenticated users can upload study guides" on storage.objects;
drop policy if exists "Authenticated users can update study guides" on storage.objects;
drop policy if exists "Authenticated users can delete study guides" on storage.objects;
drop policy if exists "Authenticated users can read study guides"   on storage.objects;

create policy "Study guides: organisers upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'study-guides' and public.sg_object_manageable(name));

create policy "Study guides: organisers update"
  on storage.objects for update to authenticated
  using      (bucket_id = 'study-guides' and public.sg_object_manageable(name))
  with check (bucket_id = 'study-guides' and public.sg_object_manageable(name));

create policy "Study guides: organisers delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'study-guides' and public.sg_object_manageable(name));

-- Listing / API download by path: organisers only. Public-URL downloads (how every
-- reader gets the file) do not go through this policy and keep working.
create policy "Study guides: organisers list"
  on storage.objects for select to authenticated
  using (bucket_id = 'study-guides' and public.sg_object_manageable(name));

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY in a transaction that is rolled back (nothing is kept). Replace the
-- placeholders with real ids: an organiser of a conference that has a committee,
-- and an account that is NOT an organiser of it.
--
-- begin;
--   -- as a non-organiser: listing shows nothing, an upload is refused
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<NON_ORGANISER_UUID>","role":"authenticated"}', true);
--   select count(*) from storage.objects where bucket_id = 'study-guides';            -- expect 0
--   insert into storage.objects (bucket_id, name)
--     values ('study-guides', '<CONF_UUID>/<COMMITTEE_UUID>/test.pdf');                -- expect: new row violates row-level security policy
-- rollback;
--
-- begin;
--   -- as an organiser of <CONF_UUID>: listing shows that conference's files only,
--   -- an upload into its committee works, an upload into another conference's path is refused
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<ORGANISER_UUID>","role":"authenticated"}', true);
--   select count(*) from storage.objects where bucket_id = 'study-guides';            -- expect that conference's count
--   insert into storage.objects (bucket_id, name)
--     values ('study-guides', '<CONF_UUID>/<COMMITTEE_UUID>/test.pdf');                -- expect: 1 row
--   insert into storage.objects (bucket_id, name)
--     values ('study-guides', '<OTHER_CONF_UUID>/<OTHER_COMMITTEE_UUID>/test.pdf');    -- expect: refused
-- rollback;
--
-- Then, in the app (owner tests): upload a study guide from Manage › Documents, open
-- it from a delegate's Committee section, and link it in a builder email.
--
-- CLIENT CHANGES NEEDED: none. The only uploader already writes the
-- `<conference>/<committee>/` key as an organiser.
--
-- NOT IN THIS DRAFT (separate decision): the `position-papers` bucket's policies are
-- already scoped (author, seatmates, chairs, organisers via pp_object_readable /
-- pp_object_manageable), but the bucket is PUBLIC, so the stored public URL of a paper
-- downloads for anyone who has it. Making it private means every reader must use a
-- signed URL (src/lib/positionPapers.ts already does; PositionPaperCard and the
-- delegation v2 upload still store getPublicUrl). Audit the readers first.
-- ─────────────────────────────────────────────────────────────────────────────
