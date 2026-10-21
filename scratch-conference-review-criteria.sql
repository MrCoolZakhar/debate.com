-- scratch-conference-review-criteria.sql
--
-- DRAFT FOR THE OWNERS' CHAT. NOT APPLIED. Written by a Claude Code run on
-- 21 Oct 2026; CLAUDE.md: every database object is changed only through the
-- chat's Supabase work. Apply it there (one transaction), then flip
-- REVIEW_CRITERIA_DB to true in src/lib/conferenceReviews.ts in the same push.
--
-- What it does (owner feedback, Peter, 21 Oct 2026):
--  1. conference_reviews.criteria jsonb, nullable: the five extra 1..5 ratings
--     the review pop-up asks for beside Overall (`rating`, unchanged):
--       committees    Committees and debate
--       chairs        Chairs
--       organisation  Organisation
--       social        Social events
--       value         Value for money
--     Every key optional, no other key allowed, each value an integer 1..5.
--     Old rows keep criteria null. The public average stays `rating` only.
--  2. Reviews only once the conference is over. Today the insert policy is
--     `user_id = auth.uid() AND user_attended_conference(conference_id)`, which
--     lets an accepted participant review BEFORE the conference (the bug the
--     owner saw in the client). This adds `conference_review_window_open()`:
--     not dates to be decided, and the last day (end_date, else start_date)
--     on or before today (UTC). "On or before" on purpose: the client shows the
--     pop-up only once the last day is before the viewer's LOCAL today, which is
--     never earlier than this, so the database never refuses a pop-up the client
--     offered. Applied to INSERT and UPDATE.
--
-- Read-back checks are at the bottom (all read only).

begin;

-- 1. The criteria column ------------------------------------------------------

alter table public.conference_reviews
  add column if not exists criteria jsonb;

create or replace function public.conference_review_criteria_valid(p jsonb)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) e
      where e.key not in ('committees', 'chairs', 'organisation', 'social', 'value')
         or jsonb_typeof(e.value) <> 'number'
         or (e.value)::numeric not in (1, 2, 3, 4, 5)
    )
  );
$$;

alter table public.conference_reviews
  drop constraint if exists conference_reviews_criteria_check;
alter table public.conference_reviews
  add constraint conference_reviews_criteria_check
  check (public.conference_review_criteria_valid(criteria));

-- 2. Only after the conference ----------------------------------------------

create or replace function public.conference_review_window_open(p_conference_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.conferences c
    where c.id = p_conference_id
      and coalesce(c.dates_tbd, false) = false
      and coalesce(c.end_date, c.start_date) is not null
      and coalesce(c.end_date, c.start_date) <= current_date
  );
$$;

revoke all on function public.conference_review_window_open(uuid) from public;
grant execute on function public.conference_review_window_open(uuid) to authenticated;

drop policy if exists "Attendees create own review" on public.conference_reviews;
create policy "Attendees create own review" on public.conference_reviews
  for insert to public
  with check (
    user_id = (select auth.uid())
    and public.user_attended_conference(conference_id)
    and public.conference_review_window_open(conference_id)
  );

drop policy if exists "Authors update own review" on public.conference_reviews;
create policy "Authors update own review" on public.conference_reviews
  for update to public
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.user_attended_conference(conference_id)
    and public.conference_review_window_open(conference_id)
  );

commit;

-- Friendly sentence for the new CHECK (add in the same push as the flag):
--   src/lib/friendlyError.ts CONSTRAINT_MESSAGES
--     conference_reviews_criteria_check: 'Each rating must be between 1 and 5 stars.'

-- Read-back (read only) --------------------------------------------------------
-- select column_name, data_type, is_nullable from information_schema.columns
--   where table_name = 'conference_reviews' and column_name = 'criteria';
-- select policyname, cmd, with_check from pg_policies where tablename = 'conference_reviews';
-- select public.conference_review_criteria_valid('{"chairs":5,"value":1}');   -- true
-- select public.conference_review_criteria_valid('{"chairs":6}');             -- false
-- select public.conference_review_criteria_valid('{"food":3}');               -- false
-- Reviews already written before their conference ended (to look at, not delete):
-- select r.id, c.slug, c.start_date, c.end_date, r.created_at
--   from conference_reviews r join conferences c on c.id = r.conference_id
--  where r.created_at::date <= coalesce(c.end_date, c.start_date) or c.dates_tbd;
