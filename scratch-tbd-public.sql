-- APPLIED 12 Oct 2026 as migration tbd_conferences_may_be_public: ONLY the constraint drop.
-- The conference_setup_status rewording below was NOT needed (checklist v2 already has the new text).
-- scratch-tbd-public.sql — DRAFT, NOT APPLIED (12 Oct 2026)
--
-- Owner (Peter): conferences whose dates are "to be decided" become public
-- like any other new conference. Explore lists them in their own
-- "Dates to Be Decided" section at the very bottom (client code already
-- shipped on feature/conferences-auth, it works with or without this SQL).
--
-- What was checked, read-only, on the live project (luruhkwrgisytejswlas):
--
--   * conferences_tbd_not_public  CHECK (NOT (dates_tbd AND is_public))
--     The ONLY database rule that refuses publishing a TBD conference.
--     (It looks at dates_tbd only: a conference with start_date NULL and
--     dates_tbd false was never refused by it.)
--
--   * Triggers on conferences: set_updated_at, handle_new_conference,
--     conferences_reslug_on_rename, conference_slug_alias_guard,
--     guard_conference_financial_columns, guard_conference_verification,
--     guard_predecessor_fields, stamp_published_at (x2). None refuses a TBD
--     publish. enforce_conference_publish_payment_gate still exists as a
--     function but is attached to NO trigger.
--
--   * No RLS policy and no view mentions dates_tbd.
--
--   * Functions that read dates_tbd and DELIBERATELY keep excluding TBD
--     conferences (left alone, they are correct for an undated conference):
--       featured_conferences      homepage / region fill skips TBD
--       book_spotlight,
--       hold_spotlight_days       "Publish your conference with its dates
--                                  before booking a spotlight." (a spotlight
--                                  is a set of calendar days up to the last day)
--       is_active_conference      TBD with no end date counts as active
--       admin_update_conference   lets an admin set both, no extra check
--
--   * conference_setup_status()'s 'page' item still needs real dates to be
--     "done" (it is a verification stage; unchanged), but its todo text says
--     "A conference without dates cannot be published", which becomes false.
--     Step 2 rewrites only those two sentences and the stale comment.
--
-- Counts on 12 Oct 2026 (TBD = dates_tbd OR start_date IS NULL):
--     67 TBD conferences in all, 66 not demo
--     66 of them private, all 66 never published (published_at NULL)
--     63 of those 66 are not test conferences (conference_is_test false)
--      0 TBD conferences are public today
--     (59 have dates_tbd true; 8 have no start_date with dates_tbd false)

begin;

-- 1. The rule itself.
alter table public.conferences drop constraint if exists conferences_tbd_not_public;

-- 2. conference_setup_status(): reword the 'page' item's todo so it no longer
--    claims a TBD conference cannot be published. Patched through
--    pg_get_functiondef() so the rest of the body stays byte-identical.
do $$
declare
  v_def text := pg_get_functiondef('public.conference_setup_status'::regproc);
  v_new text;
begin
  v_new := replace(v_def,
    'Add your conference dates, a banner image and a description. A conference without dates cannot be published.',
    'Add your conference dates, a banner image and a description.');
  v_new := replace(v_new,
    'Add your conference dates. A conference without dates stays private and cannot be published.',
    'Add your conference dates so delegates can plan their trip.');
  v_new := replace(v_new,
    '-- Dates are part of the page: a TBD conference can never be published
      -- (CHECK conferences_tbd_not_public), so an organiser must learn it here,
      -- not from the Publish button.',
    '-- Dates are part of the page. A TBD conference may be public since
      -- 12 Oct 2026 (Explore lists it under Dates to Be Decided).');
  if v_new = v_def then
    raise exception 'conference_setup_status: nothing replaced, check the body before applying';
  end if;
  execute v_new;
end $$;

-- Check before committing:
--   select conname from pg_constraint where conname = 'conferences_tbd_not_public';  -- 0 rows
--   select position('cannot be published' in prosrc) from pg_proc where proname = 'conference_setup_status';  -- 0

commit;

-- 3. OPTIONAL, NOT RUN: publish the existing never-published TBD conferences.
--    Peter decides. 63 rows today (not demo, not test, never published).
--
--    Side effects to know before running it:
--      * stamp_published_at sets published_at on each, so they enter the
--        organiser nudge emails' PUBLISHED track and any "your conference is
--        live" mail keyed on published_at.
--      * queue_claim_reminders' "never published" skip stops applying to them
--        (the ABANDONED skip still protects conferences that never opened
--        applications and had no registered applicant).
--      * No IndexNow ping is sent (that only happens from the app).
--      * enforce_conference_publish_payment_gate is not attached, so nothing
--        else refuses the update.
--
-- update public.conferences c
--    set is_public = true, status = 'public'
--  where (c.dates_tbd or c.start_date is null)
--    and not c.is_public
--    and c.published_at is null
--    and not coalesce(c.is_demo, false)
--    and not public.conference_is_test(c.slug, c.full_name, c.is_demo)
--    and c.status <> 'archived';
