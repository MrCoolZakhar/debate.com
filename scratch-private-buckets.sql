-- =============================================================================
-- scratch-private-buckets.sql   DRAFT, NOT APPLIED. For the owners' chat (Christian's
-- chat applies it; no money is touched).
-- Make the `study-guides` and `position-papers` storage buckets private
-- (Christian, delegations-money-answers.md answers 15 and 16; 20 Oct 2026).
--
-- WHY: both buckets are public, so anyone holding a stored URL downloads a study
-- guide before its release date, or anyone's position paper.
--
-- WHAT THE CLIENT ALREADY DOES (same commit as this file): every read goes through a
-- signed URL minted for the viewer (src/lib/studyGuideFiles.ts, src/lib/positionPapers.ts);
-- emails link to https://gavelling.com/files/study-guide/<id>, which signs on open
-- after sign-in. Email ATTACHMENTS are downloaded by the send-emails edge function
-- with the service key, so they keep working. Stored file_url values are unchanged
-- (the object path is derived from them).
--
-- STORAGE READ RULES AFTER THIS (createSignedUrl needs a SELECT policy for the viewer):
--   position-papers: unchanged and already complete:
--     "Position papers: read by author, seatmates, chairs, organisers" (pp_object_readable)
--     "Position papers: read by delegation leaders" (pp_leader_of_member)
--   study-guides: today only "Study guides: organisers list" (sg_object_manageable).
--     NEW "Study guides: readers of a readable guide": the caller may read a file
--     exactly when they can read a study_guides row pointing at it. The check runs as
--     the caller (SECURITY INVOKER), so the study_guides RLS decides: the release-date
--     rule for seated delegates, chairs and delegation members, and organisers always.
--     Matching decodes the stored URL (percent-encoded spaces etc.): on 20 Oct 2026 all
--     64 guides whose file_url points into the bucket decode to an existing object
--     (5 seed rows hold relative paths and never opened).
--
-- KNOWN EFFECT: links to these two buckets in emails ALREADY SENT stop opening.
-- No money, no invoices, no email is queued by this file.
-- =============================================================================

begin;

-- Percent-decoding of a URL path (UTF-8). Immutable, no table access.
create or replace function public._url_path_decode(p text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select convert_from(
           coalesce(string_agg(
             case when t.mm[1] ~ '^%[0-9a-fA-F]{2}$'
                  then decode(substr(t.mm[1], 2), 'hex')
                  else convert_to(t.mm[1], 'UTF8') end,
             ''::bytea order by t.ord), ''::bytea),
           'UTF8')
    from regexp_matches(coalesce(p, ''), '%[0-9a-fA-F]{2}|[^%]+|%', 'g') with ordinality as t(mm, ord);
$function$;

-- Can the CALLER read a study_guides row whose file is this object? SECURITY INVOKER
-- on purpose: the study_guides RLS of the caller decides.
create or replace function public.sg_object_readable(p_name text)
returns boolean
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.study_guides g
     where g.file_url like '%/study-guides/%'
       and public._url_path_decode(substring(g.file_url from '/study-guides/(.*)$')) = p_name);
$function$;

revoke all on function public._url_path_decode(text) from public, anon;
grant execute on function public._url_path_decode(text) to authenticated;
revoke all on function public.sg_object_readable(text) from public, anon;
grant execute on function public.sg_object_readable(text) to authenticated;

drop policy if exists "Study guides: readers of a readable guide" on storage.objects;
create policy "Study guides: readers of a readable guide"
  on storage.objects for select to authenticated
  using (bucket_id = 'study-guides' and public.sg_object_readable(name));

update storage.buckets set public = false where id in ('study-guides', 'position-papers');

commit;

-- -----------------------------------------------------------------------------
-- VERIFY (rolled back; replace the placeholders):
-- begin;
--   -- a seated delegate of a committee with a RELEASED guide can read its object,
--   -- an unreleased guide's object stays hidden, an outsider sees nothing
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<SEATED_DELEGATE_UUID>","role":"authenticated"}', true);
--   select name from storage.objects where bucket_id = 'study-guides';   -- only released guides of their committee
--   select set_config('request.jwt.claims', '{"sub":"<OUTSIDER_UUID>","role":"authenticated"}', true);
--   select count(*) from storage.objects where bucket_id = 'study-guides'; -- 0
--   select count(*) from storage.objects where bucket_id = 'position-papers'; -- only their own papers
-- rollback;
-- select id, public from storage.buckets where id in ('study-guides','position-papers'); -- both false
-- Then open a guide from a delegate's Committee section and a paper from the chair
-- roster (signed links), and a /files/study-guide/<id> link from a builder email.
-- -----------------------------------------------------------------------------
