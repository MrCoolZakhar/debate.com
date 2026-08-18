-- ============================================================
-- scratch-scoreboard-rls.sql   —   NOT APPLIED. FOR REVIEW ONLY.
--
-- Context: /manage/[slug]/scoreboard (added alongside this file) lets a
-- conference organiser read the SESSIONS-side scoring data for every committee
-- of their conference: `committees`, `delegates`, `messages` (the __log__
-- ledger), `documents` and `feedback`.
--
-- VERDICT: no migration is required for that feature to work. Verified against
-- project luruhkwrgisytejswlas on 2026-08-18:
--
--   select tablename, policyname, cmd, roles, qual from pg_policies
--    where schemaname='public'
--      and tablename in ('committees','delegates','messages','documents','feedback');
--
--   committees | sess_select | SELECT | {public} | true
--   delegates  | sess_select | SELECT | {public} | true
--   messages   | sess_select | SELECT | {public} | true
--   documents  | sess_select | SELECT | {public} | true
--   feedback   | sess_select | SELECT | {public} | true
--
-- RLS is enabled on all five (relrowsecurity = true), but every SELECT policy
-- is USING (true) for role `public`, and both `anon` and `authenticated` hold
-- the SELECT grant. So the organiser's authenticated client already reads
-- everything the scoreboard needs. Nothing below is needed to ship it.
--
-- ------------------------------------------------------------
-- THE FINDING THAT IS WORTH ACTING ON (pre-existing, not introduced here)
-- ------------------------------------------------------------
-- `feedback.content` is documented in src/lib/committeeService.ts:923 as
-- "the chair's PRIVATE note — never sent to delegates". The application honours
-- that: getDelegateFeedback() deliberately selects only level/factor_scores/
-- created_at and never `content`.
--
-- The DATABASE does not honour it. With `sess_select` = USING (true) and a
-- SELECT grant to `anon`, anyone holding the publishable key — which ships in
-- the client bundle — can read every chair's private note on every delegate in
-- every committee, with no session code and no sign-in:
--
--   select country, chair_name, content from feedback;
--
-- The same is true of `messages`, which carries committee chat.
--
-- The scoreboard does not widen this exposure (it reads as an authenticated
-- organiser through the conference_committees link), but it is the first
-- surface that presents those notes as a product feature, so the gap is worth
-- closing deliberately rather than by accident.
--
-- ------------------------------------------------------------
-- THE TIGHTENING, IF AND WHEN YOU WANT IT
-- ------------------------------------------------------------
-- Read this as a sketch, not a drop-in. Applying it WILL break callers that
-- currently read these tables through the plain anon client — verify each one
-- before running anything:
--
--   * getFeedbackForCommittee() (committeeService.ts:979) uses the bare
--     `supabase` client, NOT sessionClient(), so it sends no x-chair-suffix
--     header. Under the policy below the chair's own ScoreboardPanel would go
--     blank. It must be switched to sessionClient(code, chairSuffix) FIRST.
--   * FeedbackLogPanel (co-chair-only dock) reads the same way.
--   * /advisor/[code] and /delegate/[code] read `messages` anonymously.
--
-- Helper already in the database (used by the conferences-side policies):
--   is_conference_organizer(conf_id uuid) -> boolean
--     = is_platform_admin() OR EXISTS (select 1 from conference_organizers
--                                       where conference_id = conf_id
--                                         and user_id = auth.uid())

-- 1. An organiser's reach into the sessions side, expressed once.
--    The ONLY link between a conference and a live session is
--    conference_committees.session_id -> committees.id
--    (there is no conference column on `committees`; session_origin is just a
--    'conference' | 'standalone' flag and names no conference).
create or replace function public.is_conference_organizer_of_session(p_committee uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from conference_committees cc
    where cc.session_id = p_committee
      and public.is_conference_organizer(cc.conference_id)
  );
$$;

-- 2. Replace the blanket-true SELECT on `feedback` with the three readers that
--    should actually have it: the committee's chairs, anyone holding the
--    session code, and the organisers of the conference the session belongs to.
--
-- drop policy "sess_select" on public.feedback;
--
-- create policy "feedback_select_scoped" on public.feedback
--   for select
--   using (
--     is_session_chair(committee_id)
--     or has_session_code(committee_id)
--     or public.is_conference_organizer_of_session(committee_id)
--   );
--
-- NOTE: has_session_code() would let any delegate in the room read the chairs'
-- private notes. If "private" is meant literally, drop that disjunct — but then
-- the delegate Stats tab must stop reading `feedback` directly and go through a
-- SECURITY DEFINER function that returns level/factor_scores/created_at only,
-- mirroring getDelegateFeedback().

-- 3. Same shape for `messages` if committee chat should stop being public.
--    Strictly optional for the scoreboard: it only reads the __log__ rows.
--
-- drop policy "sess_select" on public.messages;
--
-- create policy "messages_select_scoped" on public.messages
--   for select
--   using (
--     is_session_chair(committee_id)
--     or has_session_code(committee_id)
--     or public.is_conference_organizer_of_session(committee_id)
--   );

-- 4. `committees`, `delegates` and `documents` are intentionally world-readable
--    (the join page resolves a code before anyone is authenticated, and the
--    public conference pages list committees). Leave those alone.
