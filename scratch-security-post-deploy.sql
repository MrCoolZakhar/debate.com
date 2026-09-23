-- RUN ONLY AFTER the client changes of 23 Sep 2026 are live on gavelling.com
-- (feature/conferences-auth pushed to production). Each block breaks the
-- CURRENT production bundle if run earlier:
--   * feedback: the old bundle reads chair notes with the plain anon client
--     (no x-chair-suffix header) and subscribes to `feedback` realtime, so the
--     comment dock and scoreboard would see no notes (and the dock could start
--     inserting duplicates).
--   * position-papers: the old bundle opens papers by their public URL.
--   * profiles: the old bundle embeds `profiles (display_name)` on peer
--     surfaces (seatmates, delegation panel, chair roster, paper thread), which
--     would show no names until the new `profile_cards` embeds ship.
-- Everything additive (profile_cards view, feedback_signals + trigger, storage
-- write/read policies, stripe_customer_id column revoke) is ALREADY applied.
-- Apply this file as one migration named security_post_deploy_lockdown.

begin;

-- 1. Chair notes and ratings: the dais (x-chair-suffix header), the linked
--    conference's organisers and chairs (JWT), and platform admins only.
drop policy if exists sess_select on public.feedback;
create policy feedback_select_dais_and_organisers on public.feedback
  for select using (
    public.is_session_chair(committee_id)
    or public.is_platform_admin()
    or exists (select 1 from public.conference_committees cc
               where cc.session_id = feedback.committee_id
                 and ((select auth.uid()) = any(cc.chair_user_ids)
                      or public.is_conference_organizer(cc.conference_id)))
  );
-- Chairs now listen to feedback_signals; nothing subscribes to feedback rows.
do $$ begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback') then
    alter publication supabase_realtime drop table public.feedback;
  end if;
end $$;

-- 2. Position papers: private bucket; files are opened through signed URLs
--    (src/lib/positionPapers.ts signedPositionPaperUrl), which storage mints
--    only for pp_object_readable() callers.
update storage.buckets set public = false where id = 'position-papers';

-- 3. Profiles: peers (seatmates, society co-members, committee chairs) read
--    names and pictures through public.profile_cards, never whole profiles
--    rows (date_of_birth, email of minors). Self, organisers and
--    co-organisers keep their existing policies.
drop policy if exists "Seatmates read profiles" on public.profiles;
drop policy if exists "Society co-members read profiles" on public.profiles;
drop policy if exists "Chairs read committee delegate profiles" on public.profiles;

commit;
