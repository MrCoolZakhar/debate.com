-- APPLIED 16 Nov 2026 (migration conferences_no_test_public, Peter's one-off approval).
-- A conference whose name says it is a test can never be public (owner, 16 Nov 2026:
-- "add a rule that conferences that are including words like test, demo or other
-- similar ones can't be published").
--
-- The pattern, checked on 16 Nov 2026 against every conference (12 matches, all tests,
-- no real conference): in the full name, the acronym or the slug, a word that STARTS
-- with "test" (TestMUN7, testmun, "test 1"), or one of the whole words demo, sample,
-- dummy, fake, placeholder, lorem, or a word starting asdf / qwert. "Democracy",
-- "Contest" and "Protest" do not match. Gavelling's own demo conferences (is_demo) and
-- Gavelling listings are exempt.
--
-- Every path is covered by one CHECK: the organiser's Publish button (PublishModal,
-- the sentence comes from CONSTRAINT_MESSAGES in src/lib/friendlyError.ts), the
-- auto-publish cron (publish_due_conferences catches the error per row and leaves the
-- conference private), and renaming an already public conference to a test name.
-- The client's discovery filter (isTestConference, src/lib/publicConferences.ts) stays
-- as it is.

-- 1. The one public conference that already breaks the rule goes private first.
update public.conferences
   set is_public = false, status = 'private'
 where slug = 'test-mun-2yfzg' and is_public;

-- 2. The rule.
alter table public.conferences
  add constraint conferences_no_test_public check (
    not coalesce(is_public, false)
    or coalesce(is_demo, false)
    or coalesce(listed_by, 'organiser') = 'gavelling'
    or concat_ws(' ', full_name, acronym, slug)
       !~* '(^|[^a-z])(test|(demo|sample|dummy|fake|placeholder|lorem)(?![a-z])|asdf|qwert)'
  );

-- 3. The cron would otherwise retry a test-named conference every 15 minutes.
update public.conferences
   set auto_publish_at = null
 where auto_publish_at is not null
   and not coalesce(is_public, false)
   and not coalesce(is_demo, false)
   and concat_ws(' ', full_name, acronym, slug)
       ~* '(^|[^a-z])(test|(demo|sample|dummy|fake|placeholder|lorem)(?![a-z])|asdf|qwert)';
