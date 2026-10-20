# The Job Board

## What it is

Conferences post titled listings for chair, secretariat and staff roles ("UNSC Chair", "USG Crisis", "Press Team"). A listing either applies through the conference's own Gavelling application, or links to another site (a Google Form, for example). Seekers browse `/jobs`, answer a listing's screening questions, then continue into that conference's normal application.

Prompt 1 built the seeker side. Prompts 2 to 5 build the organizer panel, the Team tab, the homepage and conference-page sections, standalone listings and the Unlimited perks.

`/conferences/roles` is a permanent redirect to `/jobs`.

## The server

The server is live, built through the chat's Supabase work. Reads with no sign-in use the anon client; writes use `getFreshAuthedClient()`. Every refusal is `{ ok: false, message }` with a sentence for people.

- `job_board(p_filters jsonb, p_limit int, p_offset int)`, anon and authenticated, returns `{ total, items: Card[], live }`.
  - Filters, all optional: `roles` (chair, secretariat, staff), `countries` (as stored in `conferences.country`), `regions` (north-america, south-america, europe, africa, asia, oceania), `from` / `to` (ISO dates, overlap), `level` (school or university; `both` always matches), `format` (in-person, online, hybrid), `offers` (paid, accommodation, travel, certificate, letter; all must be offered), `deadline_days`, `under10`, `q`.
  - Order: promoted first, then newest.
- Card: `{ id, kind ('gavelling' | 'outside' | 'premium'), title, role, committee, committee_id, offers { paid, paid_amount, accommodation, travel, certificate, letter }, promoted, premium, standalone, closes_at, urgency, published_at, conference { id, slug (null when standalone), short, name, logo_url, verified, city, country, format, level, start_date, end_date, theme, website (standalone only) } }`.
- `job_listing_get(p_id)`, anon and authenticated: `{ ok, listing: Card + { description, questions_count, outside_url, premium_apply, status, open, hidden }, poster { name, avatar_url, title }, conference_about { slug, name, about }, saved, mine (null or { status: started | stopped | submitted | accepted | rejected, application_id, pick_rank }), can_edit, premium_locked, unlimited, insights, insights_locked }`.
- `job_record_event(p_id, 'view' | 'click')`: one view per listing per browser session (sessionStorage), a click when Apply or Apply on their site is pressed.
- `job_save(p_id, p_on)` returns `{ ok, saved }`, signed in only.
- `job_screening(p_id)` returns `{ ok, kind, role, title, questions [{ id, text, type yesno | choice | text, options[] }], existing_application, conference { slug, short } }`. Not-ok codes: `signin`, `outside`, `unlimited`, `stopped`.
- `job_submit_screening(p_id, p_answers [{ id, answer }])` returns one of:
  - `{ ok: false, field, message }`
  - `{ ok: false, stopped: true, message }`: an automatic turn-down on a missed Essential answer; nothing is created and no email is sent.
  - `{ ok: true, next: 'continue', continue_url, role, committee_id }`
  - `{ ok: true, next: 'added', application_id, message }`
  - `{ ok: true, next: 'done', message }`
- `job_my()` returns `{ ok, saved, applications (status submitted | accepted | rejected | not_finished), listings (prompt 5), unlimited }`.

Linking is automatic: a database trigger links the normal application to the listing when it is submitted after Continue application. Nothing in the apply flow writes job data.

## Switches

- `store_flags.job_board_live`: while off, the server returns only listings of demo conferences, listings made by platform admins, and the viewer's own. The client builds nothing around it.
- The organiser Job Board page stays behind `JOB_BOARD_LIVE` in `manage/[slug]/jobs/page.tsx` until prompt 2.

## Files of prompt 1

- `src/lib/jobBoard.ts`: typed RPC wrappers and shared words.
- `src/app/jobs/page.tsx`: server; metadata and the first page server-rendered.
- `src/app/jobs/JobBoardClient.tsx`: the two-pane page, tabs, the URL.
- `src/app/jobs/JobFilters.tsx`: the filter pills.
- `src/app/jobs/jobQuery.ts`: filters to and from the URL.
- `src/app/jobs/JobCard.tsx`: the card, with a compact variant for prompt 4.
- `src/app/jobs/JobListing.tsx`: the listing pane.
- `src/app/jobs/JobApplyPopup.tsx`: the screening pop-up.
- `src/app/conferences/[slug]/apply/ListingApplyLine.tsx`: the "Applying for" line and the committee prefill.
- `src/components/SiteNav.tsx`: Job Board in the top strip (desktop pill from 1200px, the phone menu below).
- `src/app/conferences/roles/page.tsx`: permanent redirect to `/jobs`.
- `src/app/sitemap.ts`: `/jobs` replaces `/conferences/roles`.
