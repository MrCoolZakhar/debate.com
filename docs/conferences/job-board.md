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

## Prompt 2: the organizer panel

### The page

`/manage/<slug>/jobs` is gated by the existing `job_board` permission (the section "Job Board" in Settings > Team). Owners always pass. Promoting and paid listings also need the Store permission; when it is missing the server answers with a sentence.

- **Listings.** Drafts first. Each row shows its status (Draft, Live, Closed or Hidden), views, clicks and applicants, and "Promoted until" while a promotion runs. The row menu: Edit, Promote, View on Job Board, Close (asked in place) and Delete (drafts only).
- **The digest** (`job_digest`): Yesterday and This Week, with links to Applications or Settings > Team.
- **The emails card** (`job_settings_set`): the conference switch "Email organizers about new applicants", off by default; once on, each organizer makes their own choice: every new applicant, one daily digest, or no emails.

### The posting pop-up

1. **Role** and how people apply. A role whose application is off cannot be picked for a Gavelling listing.
2. **The listing.** Title up to 80 characters, no links; the committee; the description up to 4,000 characters, prefilled from `job_draft_description`; posted by. The draft is saved when leaving this step.
3. **What you offer.**
4. **Screening questions** (Gavelling listings only), up to 5: Yes/No, Choice with 2 to 6 options, or Short text. Each can carry an ideal answer; Essential exists on Yes/No and Choice only and turns a miss into an automatic turn-down.
5. **Deadline**, optional, future dates only (`futureOnly`), and for a Gavelling listing never after the role's closing. A listing closes at the earliest of its deadline, the role's closing, the conference start, or when it is closed.
6. **Review**, with Publish and Publish and promote.

### Posting rules

- A listing that applies on Gavelling is free and unlimited.
- A listing that applies on another site costs 2 credits once (`prices.outside_listing`).
- After a paid outside listing is published, its role, title, link and dates are fixed, with one free fix in the first 24 hours (`fix_available`, `fix_used`).
- The 60-day question (`confirm_deadline`): a paid outside listing that would stay up 60 days or more asks "Is this really the application deadline?". Yes, publish calls again with `p_confirm_deadline true`.
- Refusal codes of `job_listing_publish`: `confirm_deadline`, `short`, `role_off` (with a link to Settings > Applications), `not_public`.

### Promotion

- `job_promote_quote` and `job_promote(p_id, p_days 7 | 14 | 28, p_homepage, p_top_up)`.
- Prices today: 3, 5 or 9 credits for 7, 14 or 28 days, plus 2 credits for the homepage on each length. Prices are never typed in the client; they are read from `prices` or the quote.
- The run starts today, never runs past the listing's close, and is not refundable.
- The homepage holds 6 promoted listings a day. A full homepage answers `homepage_full` with `taken_days`; promoting without the homepage still works.

### Short on credits

A call that answers code `short` with `need_credits`: the pop-up closes first (never a pop-up on a pop-up), the credits pop-up opens preselected to `need_credits`, and when the purchase completes the SAME call runs once more with `p_top_up true` (`useJobTopUp`, a ref-guarded one-shot), then a toast.

### The Store

The Store's Job Board card (`store/JobBoardStoreCard.tsx`) lists live listings, each with Promote.

### Legacy code

The legacy `job_postings` / `job_applications` code is gone from `src/` (the tables are dropped at the production merge). `src/app/conferences/roles/ConferencesRolesClient.tsx` is deleted, and `fetchJobStats` with it.

## Files of prompt 2

- `src/app/manage/[slug]/jobs/page.tsx`: rewritten.
- `src/app/manage/[slug]/jobs/jobsApi.ts`: the organizer RPC wrappers.
- `src/app/manage/[slug]/jobs/useJobTopUp.ts`: the top-up one-shot.
- `src/app/manage/[slug]/jobs/ListingRow.tsx`: a listing row and its menu.
- `src/app/manage/[slug]/jobs/PostingPopup.tsx`: the posting steps.
- `src/app/manage/[slug]/jobs/PromotePopup.tsx`: promotion.
- `src/app/manage/[slug]/store/JobBoardStoreCard.tsx`: the Store card.
- `src/app/manage/[slug]/layout.tsx`: the rail's "Coming soon" tag removed.
- `src/lib/organizerPermissions.ts`: the `job_board` blurb.
