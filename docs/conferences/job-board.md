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

## Prompt 3: team applicants

### Where secretariat and staff applicants land

Secretariat and staff applicants land only in Settings > Team, in an Applicants list with the filters Waiting, Accepted, Rejected and All. They are no longer listed, counted, filtered, exported, bulk-selected or emailed on the Applications page, which shows one slim line instead: "N team applicants are in Settings > Team". Chair applicants stay in Applications.

### The reads and writes

- `team_applicants(p_conf)`: the list. Calling it also records that an organizer reviewed applicants, which feeds the Unlimited "actively reviewing" line. It returns `can_accept`: false without the Team permission, and then the organizer can read and reject but Accept is greyed with "Adding someone to the team needs the Team permission".
- `accept_team_application(p_application_id, p_permissions, p_public_title)`: for secretariat and staff. `p_public_title` null means the first pick's listing title. The new `conference_organizers` row has role `'secretariat'` or `'staff'` and `show_on_public` false. `accept_secretariat_application` stays in the database, but the client no longer calls it.

### The review pop-up

It shows who they are, their MUN experience, their answers and their Job Board picks. Accept replaces the pop-up's content with the permissions step (the `ORGANIZER_SECTIONS`, all unticked, and a Public title prefilled from the first pick), then runs the same post-accept effects as before: the `application_accepted` email, `payment_available` when `payment_timing` is `after_acceptance`, `notifyIfNeeded` and `heldUnresolvedMessage`. Reject is asked in place and runs the Applications page's reject, shared in `applications/teamDecisions.ts`.

### Unlimited applicants first

Owner, 20 Oct 2026 (prompt 7): organizers must never be able to tell which applicants hold Gavelling Unlimited, so nobody is judged as paying extra to win. Unlimited applicants appear first, silently: no mark, word, tooltip, colour or divider anywhere.

- `conference_applicant_priority(p_conf)` returns a `uuid[]` of the application ids to show first (organizers only; anyone else gets an empty array). It never says why. The Applications page reads it once (`useJobBoardApplicantExtras.ts`, `priorityIds`) and, inside each status group of its default order, puts those ids first, then newest first. The `groupAtOpen` snapshot is unchanged, so a decision never moves a row while the organizer looks at it; filters, exports, counts and bulk actions are unchanged.
- `team_applicants(p_conf)` no longer returns `unlimited` and already orders its applicants (waiting first, then priority applicants, then newest). Settings > Team keeps that order and never re-sorts it.
- `conference_unlimited_applicants(p_conf)` is no longer called by the client (the chat removes its access). The gold Unlimited mark component was deleted.

### Chair picks

`job_application_picks(p_conf)` feeds the "From the Job Board" block in a chair applicant's pop-up (`applications/JobPicksBlock.tsx`, also used in the team review pop-up).

### Marking applicants reviewed

`job_mark_reviewed(p_conf)` is called once when the Applications page opens, fire and forget.

### Organizer role 'staff'

`conference_organizers.role` can be `'staff'`, shown as "Staff" and treated like `'secretariat'` everywhere (for example `ORGANISER_LABEL` in `src/components/PersonalConferenceCard.tsx`, and `unstartedConferences.ts`, which leaves both out). The public secretariat list is unaffected: `sync_display_secretariat()` builds `conferences.display_secretariat` from `show_on_public` only, whatever the role.

## Files of prompt 3

- `src/app/manage/[slug]/applications/teamDecisions.ts`: the shared accept and reject.
- `src/app/manage/[slug]/applications/JobPicksBlock.tsx`: the "From the Job Board" block.
- `src/app/manage/[slug]/applications/useJobBoardApplicantExtras.ts`: the hook for the priority ids (shown first, never labelled), the picks and the mark reviewed.
- `src/app/manage/[slug]/applications/TeamApplicantsLine.tsx`: the slim line.
- `src/app/manage/[slug]/applications/page.tsx`: team applicants taken out, the hook and the line mounted.
- `src/app/manage/[slug]/settings/teamApplicantsApi.ts`: the team_applicants read and the Team badge count.
- `src/app/manage/[slug]/settings/TeamApplicants.tsx`: the Applicants list (filters, rows, accept and reject) mounted under Your Team.
- `src/app/manage/[slug]/settings/TeamApplicantPopup.tsx`: the review pop-up and its permissions step.
- `src/app/manage/[slug]/settings/settingsShell.tsx`: the Team badge's spoken label. `settings/panelKit.tsx`: staff, like secretariat, is never auto accepted.

## Prompt 4: the homepage, Join the Team and the Hiring mark

Three placements outside /jobs. All three reads are anon and authenticated, and a failed read renders nothing.

- **Homepage** (prompt 6, owner 20 Oct 2026). `job_homepage()` returns up to 6 cards, already in the owner's order: paid Promotion + Homepage listings for today, then other promoted listings (one per conference, more from one conference only when there are not 6), then free listings by biggest conference (most accepted delegates, the homepage rail's rule), one per conference and never a conference already shown, standalone listings last. The client never re-sorts it. It is read on the server in `src/app/page.tsx` beside the featured and listed loads, so the first paint does not jump, and drawn by `landing-lab/JobBoardSection.tsx` below Gavelling Sessions and its numbers bar, directly above Learn MUN, on the cream ground.
  - The section ALWAYS shows, so the Job Board can always be reached from the homepage (an owner exception to "no empty bands": the six tiles always fill it).
  - Two columns from 1024px: on the left (about a third) the plain title "Job Board", the line "Find chairing, secretariat and staff opportunities at conferences all over the globe." and a search built like the hero's (a pill, a magnifier, the field "Search roles or conferences…", ONE round forest button with an ivory magnifier). That button is "See all roles" when empty (/jobs) and "Search roles" with text (/jobs?q=...); Enter does the same. No typeahead and no other button. On the right always exactly 6 tiles, 3 by 2 (2 across on tablets, a swipe row on phones).
  - Listing tiles come first, in the server's order: the role title (never cut off), the conference short name, the dates and the place ("Online" for online conferences); a promoted tile keeps the gold edge and a small Promoted tag, a premium tile the Premium tag; the whole tile opens /jobs?listing=<id>. No logo, chips, urgency or committee. JobCard is not used here.
  - Starter tiles fill the rest up to 6, in this order: Chair roles (/jobs?role=chair), Secretariat roles (/jobs?role=secretariat), Staff roles (/jobs?role=staff), Post a listing (/jobs?post=1), Paid roles (/jobs?offer=paid), Role alerts (/jobs). They are plainly not jobs: an icon, a title and one line, quieter, no gold edge.
  - /jobs?post=1 acts as one press of "Post a listing" (signed out: sign-in first, then it carries on) and leaves the URL (`jobs/PostListingButton.tsx`).
- **Join the Team** on the conference page (`conferences/[slug]/JoinTheTeam.tsx`), in the Overview tab's full-width area right after Committees and before the partners and the page's closing sections. `job_conference_listings(p_conf)` returns this conference's live listings, promoted first, then newest; one card each (title, role and committee, offer chips, urgency, Promoted in the conference's accent) with "Apply" (to /jobs?listing=<id>, where the screening runs) or "Apply on their site" (a new tab opened inside the click, with a job_record_event click; the card has no link of its own, so each outside or premium listing is read once with job_listing_get). It is drawn in the conference's own colours (theme variables), hidden with no listings, and never on a Gavelling listing ("Not on Gavelling yet"). The Apply card at the top of the page does not change: its chair, secretariat and staff tiles still go straight to the application.
- **The Hiring mark on Explore.** `job_hiring_conferences()` returns the conferences with at least one live promoted listing, read once with the other Explore reads. Those cards carry a small "Hiring" mark with a briefcase (tooltip "Open team roles on the Job Board"), which opens /jobs?conference=<id>. Never on a Gavelling listing card. /jobs reads `?conference=` as the `conference_id` filter of job_board() and shows it as a removable "Roles at <short>" pill.
- Files of prompt 4: `src/lib/jobBoard.ts` (fetchJobHomepage, fetchConferenceListings, fetchHiringConferences, the conference_id filter), `src/app/jobs/jobQuery.ts` and `JobFilters.tsx` (?conference=), `src/app/page.tsx`, `src/app/conferences/StagefrontClient.tsx`, `landing-lab/VariantStagefront.tsx`, `landing-lab/JobBoardSection.tsx`, `conferences/[slug]/ConferenceDetailClient.tsx`, `conferences/[slug]/JoinTheTeam.tsx`, `src/components/conferences/HiringMark.tsx`, `conferences/ConferenceCard.tsx`, `explore/ExploreFeed.tsx` and `explore/ConferencesExploreClient.tsx` (the Hiring mark), and `jobs/JobCard.tsx` (keeps the scroll only when selecting in place).

## Prompt 5: standalone listings, Unlimited perks, admin, signed-out apply

### Standalone listings
- Anyone with a Gavelling account can post a listing for a conference that is NOT on Gavelling: "Post a listing" on /jobs (top right; signed out it opens sign-in and carries on). Someone who organizes a conference on Gavelling is first asked in place "Is this for a conference on Gavelling?": their conferences link to /manage/<slug>/jobs, where listings that apply on Gavelling are free; "No, another conference" continues.
- The pop-up: the conference (ext_name, ext_acronym, ext_city, ext_country, ext_format, ext_level, ext_start, ext_end, optional ext_logo_url and ext_website), the role, title, description and the outside link, what you offer, an optional deadline, and Review ("Post for N credits", "Post and promote"). job_listing_save without conference_id and with kind 'outside' creates the standalone draft.
- It applies on another site only, for chair, secretariat or staff, and costs the poster's OWN credits (job_prices key outside_listing, 2 today, never typed in the client). Short on credits: the pop-up closes, openCreditsPopup({ context: 'header', preselect: need_credits }) opens, and its onComplete publishes once (a ref-guarded one-shot held by the page).
- After publishing, the role, title, link, conference details and dates are fixed, with one free fix in the first 24 hours (fix_available; a save that used it answers fix_used with "Saved. That was your one free fix."), and the deadline can only move earlier. The description and offers stay editable. code locked is shown as written.
- The 60-day question: a deadline (or conference start) 60 or more days away answers confirm_deadline and is asked in place, "Is this really the application deadline?", with "Yes, publish" and "Change the dates".
- Posters manage them in the "Your Listings" tab on /jobs (shown when job_my().listings is not empty): status, views, clicks, Promoted, the lock hint, Edit, Promote (paid from their own credits), Close, Delete for drafts, and "Hidden by Gavelling: <note>".

### Unlimited perks
- Their applications appear first in organizers' lists, silently (see Unlimited applicants first).
- The insights strip under the header card of a listing (job_listing_get insights { applicants, closes_at, reviewing }): "N applied", "Closes 15 Nov", "Organizers are actively reviewing" (an organizer opened the applicants in the last 7 days). Everyone else sees it locked, with "Get Unlimited" opening the Unlimited pop-up (insights_locked). Never on outside listings.
- Premium listings: a non-member (premium_locked) sees the Premium tag and the header card, then a lock card, "This role is for Gavelling Unlimited members", instead of the description and Apply. The page reads again once the plan turns on. job_screening and job_submit_screening answer code 'unlimited'.
- Job alerts: "Save as alert" under the filters saves the current filters with a name (job_alert_save, Unlimited only, at most 10; non-members get the Unlimited pop-up); members manage them in the Alerts panel of the Saved tab (job_alerts_mine, job_alert_remove). "We email you once a day when new roles match": the daily email is sent by the server.
- "Premium job board roles" is live in the Unlimited pop-up and on /pricing/subscription.

### Admin
- /admin has a Job Board tab (src/app/admin/JobBoardTab.tsx): every listing (admin_job_listings) with search, View and Hide / Unhide (an optional note asked in place; admin_job_hide emails the poster when hiding).
- Premium listings are posted only there (admin_job_premium_save): the organisation and place, title, description, offers, how people apply (an outside link, or a Gavelling form with up to 5 screening questions) and deadline, saved as a draft or published, edited or closed. A form listing shows its applicants (admin_job_premium_applicants) with Accept and Reject (admin_job_premium_decide); no emails go out from these buttons.

### Signed-out apply
- Apply on a Gavelling listing works signed out, like every other application: the pop-up opens directly and loads its questions from job_screening_public (premium listings answer code 'signin' and still open sign-in with the pending action). "Continue application" calls job_check_screening, which saves NOTHING: a field is marked, stopped shows the stopped screen, ok stores the answers on the device for 14 days (localStorage `gavelling-job-answers:<listing id>`, storeJobAnswers in src/lib/jobBoard.ts) and goes to continue_url. Signed in, the pop-up still uses job_screening and job_submit_screening.
- On the apply page with ?listing=<id>, once the person is signed in and stored answers exist: right after a NEW application is submitted (before the confirmation redirect) job_claim_screening saves them and adds the listing as the next ranked pick, with no email; it never blocks or fails the submission (a failure is reported with reportBlocked). When they already have an application for the role (edit mode or "You've Already Applied"), it is claimed once and its sentence ("Added to your chair application at LIMUN", or the stopped message) shows in the ListingApplyLine spot. The stored answers are cleared on ok or stopped. Without stored answers, or signed out, nothing changes: the trigger still links people who answered signed in. Code: useListingClaim and ListingClaimNote in conferences/[slug]/apply/ListingApplyLine.tsx.

### The homepage title
- The homepage Job Board title is plain (no GoldWord), so the homepage keeps one gold word, the hero's (owner, 20 Oct 2026).

### Files of prompt 5
- `src/lib/jobBoard.ts`: JobMyListing, fetchJobPrice, the alert wrappers, fetchJobScreeningPublic, checkJobScreening, claimJobScreening and the stored answers (storeJobAnswers, readJobAnswers, clearJobAnswers).
- `src/app/jobs/PostListingButton.tsx` (the button and useStandalonePosting: sign-in carry-on, the pop-ups, the own-credits top-up one-shot), `StandalonePostingPopup.tsx` (the "Is this for a conference on Gavelling?" question and the steps), `YourListings.tsx` (the rows), `JobBoardClient.tsx` (the button, the Your Listings tab as local state, the alert mounts).
- `src/app/jobs/InsightsStrip.tsx`, `PremiumLock.tsx`, `SaveAlertAction.tsx`, `AlertsPanel.tsx`, `JobListing.tsx` (the strip, the lock, signed-out Apply), `JobApplyPopup.tsx` (signed-out questions and the check).
- `src/app/manage/[slug]/jobs/PromotePopup.tsx`: an optional `payer` ('you' on /jobs, so the totals speak of your own credits).
- `src/app/conferences/[slug]/apply/ListingApplyLine.tsx` (useListingClaim, ListingClaimNote) and `ConferenceApplyClient.tsx` (the hook call, the claim before the confirmation redirect, the note in the form and on "You've Already Applied").
- `src/app/admin/JobBoardTab.tsx` and `AdminClient.tsx` (the admin tab); `src/components/purchase/UnlimitedPopup.tsx` and `src/app/pricing/subscription/SubscriptionPricingClient.tsx` (Premium job board roles live).
- `src/app/conferences/landing-lab/JobBoardSection.tsx`: the plain title.
- Known limit: admin_job_listings leaves drafts out, so a premium draft is not listed in /admin until it is published.

## Applicant notes (prompt 9)

Owner, 20 Oct 2026: organizers review applications together, so every applicant has a thread of private team notes. They are private to the conference's organizers, never shown or sent to the applicant, and separate from `applications.organizer_note` (the "Note sent to them" on a rejection, which is unchanged).

- `application_notes_list(p_application)`: the notes, oldest first (`id, body, created_at, updated_at, edited, author_id, author_name, author_avatar, mine`); empty for anyone who is not an organizer of that conference.
- `application_note_add(p_application, p_body)`: returns the new note id (1 to 4,000 characters, trimmed by the server).
- `application_note_edit(p_note, p_body)` and `application_note_remove(p_note)`: return true; only the author can change or remove a note, everyone else gets the server's sentence.
- `application_note_counts(p_conf)`: `{ "<application_id>": count }`, organizers only.
- Where: the applicant pop-up's Notes tab (after Payment, `?tab=notes`, the count beside it), the Notes section of Settings > Team's review step (not the access step), and a small note icon with the count on an Applications row ("N notes from your team"), read with the page's other reads and again after the pop-up closes (`applications/useNoteCounts.ts`). The thread and the box are `applications/ApplicantDetail/NotesPanel.tsx`: optimistic add, edit and remove rolled back with the server's sentence, Cmd or Ctrl plus Enter adds, edits and removals asked in place.

## Prompt 10: organizer tools

### Funnel
- `job_conference_panel(p_conf)` listings and `job_my()` Your Listings carry `funnel { views, clicks, started, screened_out, submitted, views_7d, clicks_7d }`: started = began applying through the listing, screened_out = stopped by an Essential question, submitted = finished applications.
- `src/app/jobs/ListingFunnel.tsx` draws it on the organizer rows (`ListingRow.tsx`) and Your Listings: Views, Clicked Apply, Started, Applied, joined by a chevron with the share that went on (hidden when the step before is 0), "This week: N views, N clicks" under it, and "N stopped by an Essential question" under Started when above 0. Outside listings show only Views and Clicked their link.

### Committee pack
- `job_committee_pack(p_conf, p_committee_ids, p_template, p_publish)` posts one Gavelling chair listing per picked committee (up to 40), titled "<abbreviation or name> Chair", with the shared template (description, offers, questions, auto_reject, deadline, poster_user_id); committees with a draft or live chair listing are skipped; free. It answers created, skipped and failed (a failed one may be kept as a draft).
- "Post chair roles for every committee" sits beside "Post a listing" on /manage/<slug>/jobs, hidden with no committees or with the chair role off. `CommitteePackPopup.tsx`: committees, the shared details (PostingPopup's own exported fields), review ("Post N listings"), then the result in place.

### Share card
- `src/app/jobs/ShareCardPopup.tsx` draws a share image on a canvas, client side, as a Post (1080 x 1350) or a Story (1080 x 1920): the logo (a monogram disc when it cannot load), the title, the conference, dates and place, up to three offers, a QR code (the `qrcode` package, imported inside the pop-up) and "Apply on Gavelling". The QR and "Copy link" point to `https://gavelling.com/jobs?listing=<id>&ref=share`; /jobs ignores `ref`. "Download image" saves "<short>-<title>.png".
- It opens from the organizer row menu ("Share card", live listings), Your Listings ("Share", live listings) and the listing page ("Share" after Save, open listings).

### Promote links
- The server sends the poster of a listing one "closes soon" email (3 days or fewer left) and one "few applicants" email (live 7 days, fewer than 3 applicants) per listing, with "Promote for 3 credits". The button opens /manage/<slug>/jobs?promote=<listing id> for a conference listing, or /jobs?tab=listings&promote=<listing id> for a standalone one.
- /manage/<slug>/jobs opens PromotePopup for that listing once the panel has loaded when it is live and the organizer can promote, otherwise shows "This listing is no longer live.", then drops the param. /jobs opens Your Listings and the Promote pop-up when it is one of the person's live listings (signed out, sign-in first), then drops the param.

## Prompt 11: find people and invites

Owner, 20 Oct 2026: organizers can search people with chair or secretariat experience and invite them to a listing, paying credits per invite. Two safeguards: OPT-IN ONLY (nobody can be found until they turn on "Open to team roles", off by default) and CAPS (one invite per person per conference; at most 3 invites a week reach any one person; extra invites wait and go out later). Organizers never see anyone's email or contact details.

Seeker side:
- `talent_settings()` returns `{ open, since, show_prompt }`; show_prompt is true once, for people with an accepted chair or team role (or chair or secretariat CV entries) who never answered. `talent_set_open(p_open)` turns it on or off (off also cancels invites still waiting; answering ends the nudge). `talent_dismiss_prompt()` ends the nudge without turning anything on.
- "Open to team roles" is a setting in the CV privacy settings (`account/cv/CVPrivacyPanel.tsx`), disabled with "Make your CV public to be found" while the CV is private. The one-time nudge is `src/components/TalentPrompt.tsx`, at the top of /account/cv and of /jobs for signed-in people ("Turn on" or "Not now"; never again after either).
- `talent_my_invites()` returns the person's invites (a JobCard plus `invite_id, invite_status sent | opened | applied | not_interested, message, invited_at, invited_by, open`); `talent_invite_respond(p_invite, 'opened' | 'not_interested')`. They show as an Invites block above My Applications on /jobs (`src/app/jobs/InvitesBlock.tsx`), the tab carrying the count of unanswered invites, with a quiet "Not interested". /jobs?listing=<id>&invite=<invite id> marks the invite opened once (signed in and theirs), drops the param, and the listing shows "<short> invited you to apply" with the note.

Organizer side (/manage/<slug>/jobs):
- `talent_search(p_conf, p_query, p_role, p_country, p_level, p_limit, p_offset)`: only opted-in people with public chair or secretariat entries, never people already on this conference's team or with an open team application there; Job Board permission. It returns the people (name, avatar, nationality, level, counts, verified, recent entries, any invite), the price, the conference credits and can_pay.
- `job_invite_send(p_listing, p_user, p_message, p_top_up)`: price in job_prices key talent_invite (1 credit today) from conference credits (Store permission), the usual short and top-up flow (useJobTopUp), code already, or a field message. Answers status sent or queued.
- `job_conference_invites(p_conf)`: the conference's invites for the Invites card.
- "Find people" (FindPeoplePopup.tsx: search, then the invite step in the same pop-up) and the Invites card (SentInvitesCard.tsx).
- Delivery is by email from the server ("See the role" to /jobs?listing=<id>&invite=<invite id>); queued invites go out with an hourly job.
