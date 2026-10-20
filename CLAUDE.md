# CLAUDE.md

Guidance for Claude Code when working in this repository. This file is the **map**: what Gavelling is, who it is for, how the money and the growth work, where things live, and the rules that hold today. `AGENTS.md` (imported below) is the **rulebook** for the live-session runtime; read it before touching anything under `src/app/chair`, `delegate`, `advisor`, `voting`, `join`, `create` or `src/lib/committeeService.ts`.

@AGENTS.md

---

## How to read this file

This file holds rules, limits and pointers. The history behind every rule (owner quotes, verification notes, the "why") is archived verbatim in `docs/history/CLAUDE.md.2026-10-17.md` and split by area into `docs/conferences/*.md` and `docs/sessions/*.md`. Read the area file before changing an area.

| Before touching | Read |
|---|---|
| Sessions runtime (chair, delegate, voting, join, create, committeeService) | `AGENTS.md`, then `docs/sessions/*.md` |
| Money: credits, Unlimited, the Store, imports, the email allowance, the pool | `docs/conferences/business-model.md` |
| Financials, /pay, invoices and receipts, refunds, currency, aid | `docs/conferences/business-model.md` (the Financials prompts) |
| Settings | `docs/conferences/business-model.md` ("Settings as tabs") |
| Communications, paid announcements, the inbox | `docs/conferences/business-model.md` ("Communications redesign") |
| Documents, uploads, position papers, study guides | `docs/conferences/position-papers-and-study-guides-the-documents-p.md`, `docs/conferences/business-model.md` ("Document Uploads") |
| Awards | `docs/conferences/awards.md`, `docs/sessions/awards.md` |
| The checkmark, sign-up, names, the auth pop-up | `docs/conferences/the-verified-checkmark.md` |
| Intent, the creation wizard, drafts, publishing on create | `docs/conferences/stated-intent.md` |
| "Your room is live", the advisor board | `docs/conferences/your-room-is-live.md` |
| Explore, Spotlights, SEO, traffic counting, link previews, slugs | `docs/conferences/growth-loops.md`, `docs/conferences/design-system-and-copy.md` (the Explore page) |
| Email (every sender, the brake, the cap, campaigns) | `docs/conferences/where-things-live.md` |
| Design, copy, taste boards | `docs/conferences/design-system-and-copy.md` |
| Custom and press committees | `docs/conferences/custom-committees.md` |

---

## Owner Decisions: Do Not Change Without an Owner

The owners are Peter and Christian; a decision by either stands. If a request would change, remove, merge or redesign any item below, stop, say it needs an owner's sign-off, and do not do it in this run. Always `git pull` before starting work.

- The profile menu: Needs your attention, My profile, Manage account with credits and "+", Pricing with the Free / Unlimited badge and the up-arrow, Your conferences, About Gavelling, Sign out. One red bubble on the avatar, its number the rows in Needs Your Attention (`attentionRows` in `src/lib/myActivity.ts` is the one rule); live rooms never add to it.
- /about and /contact are two separate pages; /about carries the ambassador world map; no footer on /contact.
- /account/manage is three pages: Credits, Subscription, Promo code. Credits and Unlimited stay apart.
- No site footer on /account.
- Delegation leaders import from "Import delegates" on the delegation card (two-tab pop-up) and share the invite link from "Copy invite link" on the same card (`create_delegation_invite`, `/invites/delegation/[token]`). There is no /delegation portal. All leaders (head delegates and faculty advisors, several of each) have the same powers: invite, import, move people between delegate and head delegate (`delegation_set_head`), place, take out of a seat and swap. ONLY ORGANISERS move someone between delegate and faculty advisor, because the money moves with the person (Christian and Peter, 20 Oct 2026; Christian's chat builds that organiser-only function, `docs/conferences/delegations-money-answers.md` answers 1 to 4). Expected size IS the delegate tickets: raising it ("Buy another ticket", `add_pledged_spots(app, 1)`) creates a ticket, the X on /pay removes an unpaid one; never a second kind of ticket outside it. A pledged ticket covers the earliest delegates whether or not it is paid yet (`fin_pledge_covers`, on purpose). Only a head delegate or an advisor creates a delegation, never the organiser. The leader card lives in the conference page's You view (Delegation section). "Pledge" is called Expected size everywhere users read it. Rules and votes: `docs/conferences/delegations.md`.
- My conferences opens each conference's role dashboard.
- Explore: the title left, the search pill left with "Organise your conference" on the same line, the place pills under Where (max 5), no place rail, filters with sort and view on one line, grid first, at most 4 columns, spotlights as the first grid cards (no "In the Spotlight" row), the list view in plain date order with spotlights tagged in place, Near you is the IP country. Spotlights obey every filter.
- Free (house) spotlights exist only for flagship pairs in `spotlight_flagships`; the database refuses any other. Never add free spotlights as test data.
- Organizer imports are free until an owner flips `IMPORTS_PAID_LAUNCH` and `store_flags.organizer_import_charged` together.
- Leader imports are free until an owner flips `LEADER_IMPORTS_PAID_LAUNCH` and `store_flags.leader_import_charged`; while free, each delegate's own credit is taken at claim.
- Payment never locks the role page; the dashboard always shows. Turned-down applicants can edit and resubmit until turned down 3 times (`applications.rejection_count`, server-owned). `payment_timing` only decides when people can pay ('anytime' or 'after_acceptance'). Two-choice role settings are toggles, all off by default; settings that do not apply are hidden.
- Country and Region Spotlights: 2 a day each, same price (1 credit a day, 7 a week), each with an Explore pop-up (optional pitch, up to 3 highlights).
- Buttons are sentence case, titles are Title Case, no em dashes anywhere users can see.
- Every page under /conferences/[slug] (the public page, apply, pay, the role pages, papers, documents) uses the conference's own colour scheme (its theme variables, the ones the apply flow and role pages already read, for example var(--gv-main)) for buttons, accents, active tabs and highlights. Never hard-code Gavelling forest or gold there. Gavelling's own colours are for Gavelling's pages and the organizer dashboard. (Prompt 142: `themeCssVars` sets them on the page wrapper; the participant kit's `FOREST`, `GOLD_DEEP`, `TINT_MAIN`, `TINT_ACCENT`, `CONF_BUTTON_CSS` (`.gv-cf-main`) and `CARD_TITLE_STYLE` in `participant/dashboardKit.tsx` read them; text on a main-colour button is `var(--gv-on-main)`.)
- Every database object is changed only through the chat's Supabase work, never from a Claude Code run.
- "What You Use Gavelling For" is asked only in the creation wizard, never edited in Settings.
- Paid announcements never show the organiser a reach number; only the flat price and `has_people`.
- A pop-up never opens another pop-up on top of itself. A second step replaces the pop-up's content with a back button; menus and confirms stay inside it (a menu opens upward or leftward and scrolls itself; a confirm is asked in place, never as a modal).
- No empty bands: a page or tab fills its content width at 1440 and 1920. Never cap a whole page at a reading width unless it is long text; use columns or wider cards. Read your diff for fixed max-widths on page-level containers.
- How a run is tested: `npm run build` once and `npx eslint` on the files touched, then read your own diff once (every part of the prompt wired, every quoted string present, every new hook above the early returns, nothing in WHAT MUST NOT CHANGE touched). No browser, Playwright, screenshots, stubbed RPCs, test data or retried checks; the owner tests every run himself. The report is short: one line per part, deviations and why, every file changed, anything not wired. No "Checked" section.

---

## 1. What Gavelling is

Two products in one Next.js codebase, one Supabase project (`luruhkwrgisytejswlas`). **Sessions**: anonymous, a 6-char code plus a 4-digit chair password, free forever. **Conferences**: Supabase Auth accounts; the organiser pays nothing, participants pay. They meet at the database: a conference committee mints a live session (`committees.session_origin = 'conference'`, `conference_committees.session_id`); the secretariat watches rooms from `/manage/[slug]/live`. Sessions is the top of the funnel and must stay free, anonymous and account-free. Strategy: `CONFERENCES_PRD.md`, `docs/competitive-mymun.md`.

**A live room is only ever created by a press.** `mintConferenceSession` (`src/components/CommitteeEditorModal.tsx`) is the one minting primitive; `mintSessionForCommittee` the one shared wrapper. Exactly three callers, all presses: saving a brand new committee, the organiser's "Create session code" button(s), and the chair's "Start your committee room", which calls `start_my_chair_session(p_committee)` (SECURITY DEFINER, idempotent, one transaction, so a room can never exist unlinked). **Never mint from an effect, a page load, a publish or a cron.** If the shape of a minted room changes, change the RPC and `mintConferenceSession` together.

**Who uses it.** Chairs on one laptop, optimistic-first; delegates on phones, who never see chair notes, ratings or nominations before publication; advisors on the read-only board `/advisor`; organisers at scale (section permissions are UI-only, `src/lib/organizerPermissions.ts`; only `team` and `financials_readonly` are DB-enforced). Mobile-first for delegates and applicants; the chair page is desktop-first.

---

## 2. Money

**Hard rules.** Organisers are never charged. There is NO platform fee: card payments are direct charges on the organiser's Stripe Connect account (or the platform account for `platform_collects`) with no `application_fee_amount`; `PLATFORM_FEE_RATE` / `PROCESSING_RATE` in `src/lib/finance.ts` are legacy, never wire them back in. Manual payment is a first-class path. Points are retired: `points_ledger` and `profiles.points_balance` are history only, never write or build on them; `award_points_for()` does not exist. `profiles.unlimited_status` is dead; never read it.

**Credits.** 1 credit = 1 application (delegate, head-delegate, faculty-advisor, observer; chairs exempt), refunded on rejection. Prices come from the database and nowhere else: `credit_price_tiers()` (`max_qty` 500) and `credit_price_cents(qty)`; the client reads the table once (`src/lib/creditPricing.ts`) with the same rounding. Never type a price or a percentage into the client. Unlimited is flat (USD 3 a month, USD 30 a year; the `create-subscription-checkout` edge function is the truth). Plan status is `my_unlimited_status()`, cached as ONE store (`src/lib/unlimitedStatus.ts`), re-read after every purchase, cancel or resume; never trust local state. Credits are always the signed-in person's own balance. Edge functions are called with a token read fresh at call time (`src/lib/purchaseCheckout.ts`), never one held in React state. Stripe's form colours come from the Stripe Dashboard.

**The delegation pool** (`fund_delegation_pool` 1..500): a leader moves their OWN credits in; members are covered at insert by the credit-gate trigger; the client charges nothing. **The Store:** spotlight prices live only in `spotlight_placements`. Bookings are at most 28 days, never before today or past the conference's last day, description 1..120 characters with no links or profanity; holds last 10 minutes; `store_transfer_in` 1..1000; a transfer back returns only the caller's unspent contribution. A short buy answers `{ok:false, need_credits}`: `useStoreBuy` opens the credits pop-up and re-calls the SAME RPC once with `p_top_up true`. Launch, Everything and the house booking are never cancelled.

**Imports.** Rows need email, name and role; a blank or unknown role or payment value is an error, never defaulted; allocation problems are warnings. Every import is confirmed in place, never on one press (it queues invite emails). While paid imports are off nothing blocks and no screen says "free for now". Leader imports (1..200 rows, all or nothing) use ONE leader credit per delegate while charged. Imported applications attach by VERIFIED email only; a claim takes a credit if the claimant has one and never blocks. Never change claims to "always free".

**The email allowance.** 1,000 free BULK emails per conference (only `queueAdHocEmail` sends count); packs 100 for 1 credit, 500 for 5, unlimited for 20; `email_allowance(p_conf)` is the read, the database cap the real check.

**Financials.** Money shown to anyone is the payments ledger, never `payment_status`: `conference_money_summary` (`src/lib/conferenceMoney.ts`) is the one definition (received = Stripe, offline = manual, never added; outstanding = open invoices of accepted people). `payment_status = 'paid'` is an access flag; never multiply it by a fee. Every Financials number is `financials_dashboard(p_conference_id)`, never a sum of rows. Manual money is recorded ONLY through `mark_invoices_paid` and taken back ONLY through `mark_invoices_unpaid` (card items must be refunded); the Applications page uses the same two RPCs and never writes `payment_status`. Payment set-up is written ONLY by `set_payment_setup`; a payment link needs the link, in-person payment its instructions. The Financials welcome pop-up (`financials/onboarding/PaymentFlow.tsx`) is 1 bank country, 2 currency, 3 How Payments Work (a Stripe card only where Stripe works for that country, a proofs card always; the Payment Method pop-up skips it), 4 how people pay, 5 set-up, 6 registration fee, 7 add-ons, Done; every payer-instructions field carries the hint "No need to ask for screenshots. Payers upload their proof on Gavelling and you accept it in Financials". A refund moves money; Mark unpaid does not and is NEVER shown as a refund (`refunded_cents` vs `undone_cents`). A partial refund keeps the item paid at a lower price; a full refund closes a removable item and leaves a person's own fee owed. A fee waiver is removed ONLY through `remove_fee_waiver`. Attendance never changes payment. Every amount goes through `formatMoney` / `formatCents` (`financials/shared.tsx`). The Financials currency chip IS the conference currency and changing it changes the conference's currency (prompt 136; there is no display conversion any more). One currency per conference (`conferences.fee_currency`), locked once money has moved; the client never sends a currency. Financial aid is one pool per person spent by the database (`apply_aid_pool`, never called by the client) and never refunded. `advisors_pledged` counts only the advisors coming with a faculty advisor; their own ticket is their role fee. Stripe Connect `start` needs `can_write_financials`. **Money functions only Christian's chat changes** (`docs/conferences/delegations-money-answers.md`, 19 Oct 2026): `sync_participant_invoices`, `settle_invoice_effects`, `cover_pledge_spot`, `pledge_covered_application_ids`, `_apply_pledge_cover_to_app`, `apply_pledge_coverage_society` / `_all`, ticket numbering (`renumber_pledge_spot_labels`, `renumber_delegation_tickets`, trigger `zz_renumber_delegation_tickets`), `add_pledged_spots`, `add_pledged_advisor_spots`, `remove_pledged_spot_invoice`, `trim_excess_spot_invoices`, `zz_app_role_switched` / `_app_role_switched`, `invoice_price_locked`, `money_daily_check`, `my_pay_overview`, `fin_attention_due_v2`, stripe-webhook and create-checkout. Anything that creates or changes invoices or tickets, payment status, coverage, or moves a paid person between roles or delegations goes to Christian's chat first (a note or the SQL; they test and apply it). Leaders pay their own ticket (Delegate Ticket 1 / Advisor Ticket 1; tickets they buy are numbered after it) and are never covered by tickets they bought. A leader's money headline is the Paid figure /pay shows (`my_pay_overview`), counts are tickets ("12 of 15 Delegate Tickets paid"), never a second total. `connect-onboard`, `create-checkout`, `refund-items` and the webhooks are edge functions not in git: read them with the Supabase MCP tools.

**Stripe's own limits live only in `create-checkout`:** a metadata value is capped at 500 characters (`setIdListMetadata` spreads ids; nothing may depend on that metadata, the webhook matches by `payments.stripe_checkout_session_id`) and Checkout takes at most 20 line items (`fitLineItems` groups by kind and unit price).

**/pay** reads everything from `my_pay_overview` (the caller's own items only). Proof is required to finish a manual payment unless the way is in person (image or PDF, 10 MB); started payments are held 3 days. A payment-link tab is opened inside the click, before any await. Every pay button is LOCKED while payments are not set up (`participant/PaymentsLocked.tsx`); applications never wait for payments and nothing blocks publishing or opening a role on `conference_payments_ready()`. Referral codes are removed from every screen; WorldMUN counts referrals through its own application question; the database objects remain and nothing shows or accepts them.

**Money documents.** Lines and amounts are a ledger snapshot and can never be edited; one shape (`src/components/money/moneyDocument.ts`) is drawn on screen and as the PDF (`@react-pdf/renderer`, loaded only on Download); amounts are the currency code and two decimals. A receipt lists only what was paid; a refund gets its own document.

**Applications and participants.** A role's window and its fee phases are one timeline: `enforce_role_config_timeline()` in the database, mirrored by `src/lib/roleTimeline.ts`; dated prices must be back to back and ARE the window; refusals are `arc_timeline_*` with sentences in `CONSTRAINT_MESSAGES`. "Open" is judged by the database clock (`src/lib/applicationWindow.ts`). `guard_application_write()` refuses a self-submitted insert without nationality and date of birth. A lost insert response must never strand an applicant: `handleSubmit` adopts an existing live application before inserting and after a network failure. Public prices go through `src/lib/publicFees.ts`; `conferences.fee_amount` is stale. `payment_available` (opt-in) is the only payment reminder; **never re-enable or re-schedule cron `payment-reminders`**. `conference_is_test` is the SQL twin of `isTestConference` (`src/lib/publicConferences.ts`): change both. `email_address_failed(email)` means the ADDRESS failed, never its batch. `profiles.display_name` (live) wins over every stored copy. A new client write to a `profiles` column needs a GRANT first. Redirect-only addresses live in `next.config.ts` `redirects()`, never in page files. `looksIndependentName` warns, never blocks. Dates to be decided are public (`hasNoDates` / `DATES_TO_BE_DECIDED` in `src/lib/conferenceDates.ts` are the one test and wording); spotlights stay dated only.

---

## 3. Growth, SEO and tracking

- **Spotlights.** The homepage rail is `featured_conferences('homepage', '')` (bookings first, then fillers that have not started, `homepage_picks` first among them); Explore lists `featured_conferences('explore')` first. `record_spotlight_event` counts one view per browser session per booking, never on localhost or `*.vercel.app`; a Spotlight preview records nothing.
- **Link previews.** (1) `next.config.ts` `htmlLimitedBots: /.*/` keeps metadata in `<head>` for every visitor; never remove or narrow it. (2) The card URL carries no date: `ogVersion()` = `OG_CARD_DESIGN` + a hash of what the card draws; bump `OG_CARD_DESIGN` when the drawing changes. (3) Organiser images share one 2.5 s budget; a degraded card is served `X-Og-Degraded` with a 5-minute cache, never pinned. (4) Opening a conference page warms its card (`warmOgImage`, production only). (5) A complete card is stored once in the public bucket `og-cards` at `conference/<slug>/<version>.jpg` (`src/lib/ogStore.ts`) and `generateMetadata` points `og:image` at it when it exists. `pageMetadata()` (`src/lib/seo.ts`) is the one way to write metadata; `scripts/check-og-config.mjs` fails the build on a hand-written `openGraph:`, an edge runtime on the card routes or missing fonts. Share cards draw in Inter from static TTFs, never a variable font or woff2.
- **Slugs.** `conferenceSlugLadder` (`src/lib/conferenceSlug.ts`) and the database's `conference_slug_ladder()` are twins: change one, change the other. A rename re-mints the slug in the database; `conference_slug_aliases` keeps every old slug and `src/middleware.ts` 308s them. Canonical and sitemap stay on the current slug only; an alias is honoured, never advertised.
- **Indexability** (`npm run check:indexability` must pass after any routing or SEO change): the sitemap lists only URLs that answer 200 without a redirect, are self-canonical, not noindex, with a title, an h1 and real text in the raw HTML; never a redirecting path or a query string; `lastmod` is the content date, never `new Date()`. Private pages are noindex by `NOINDEX_ROUTES` in `next.config.ts` and stay crawlable; `robots.ts` blocks only what has a side effect when rendered (session runtimes, `/unsubscribe`, `/drafts/*?stop=1`, `/r/`) and `/api/`. `/_next/static/*`, `*.pdf` and `*.txt` are noindex, never disallowed. No hreflang. Every sitemap URL is reachable by a server-rendered `<a href>` from another sitemap page; conference pages and country hubs are crawled from `/conferences/all`, linked from every footer. The footer is information links only: never a list of conferences or a per-conference link. Keep the Explore Suspense fallback's real sentence and link to `/conferences/all`.
- **No SEO blocks on the main public pages unless Peter asks** (owner, 19 Oct 2026: "I never asked for this, looks absolutely ridiculous"). Never add a visible directory, list of conferences, facts paragraph, FAQ card or row of hub links to the homepage, Explore or a conference page for SEO. Crawl lists live on `/conferences/all` and the hubs (`/conferences/in/*`); on Explore the upcoming-conferences directory stays FOLDED in a closed `<details>` ("See all upcoming conferences", `ExploreDirectory.tsx`). Anything new of this kind is proposed first, never shipped unasked.
- **CV.** CV privacy is enforced in the database (`get_public_cv`, the `cv_entry_visible` policy; a private CV returns only the name and photo with `private: true`, and the page says "This MUN CV is private", noindex); never add a SECURITY DEFINER read around it. `mun_cv_entries_guard_source` stops a client writing any source but `manual`.
- **Premium guides.** `src/lib/premiumGuides/index.ts` is `server-only`; locked content is never in the HTML or the bundle; `/api/guides/[slug]` answers 200 only on `guide_access().can_read`. No guide promises a result or names an author.
- **No third-party analytics or tracking**, by policy. The one exception is the anonymous view counter (`/api/conference-view`, `/api/site-view`): no cookie, per-visitor id, IP, user agent, full referrer URL or third party, ever. A visit is judged by where it BEGAN (`classifyLanding`, `src/lib/trafficSource.ts`); first touch is kept 90 days and written to `applications.traffic_source` / `traffic_detail` on insert, never changeable afterwards. Limits: 30 a minute per IP on conference views, 60 on site views, 20,000 views per conference per day, 200,000 per page per day. Admin user-origin estimates are never written to `profiles`.
- **Ambassadors** are added in `src/app/about/ambassadors.ts`.

---

## 4. Awards, checkmark, identity, committees, wizard, live rooms, documents

**Awards** (`src/lib/awards.ts` the config, `src/lib/awardsService.ts` every read and write; nothing else touches `conference_awards`). Set up, reviewed and published in Settings → Awards. `awards_config` without `setUp: true` reads as NOT set up. **Chairs are offered awards only through `awardsOfferedFor(config, conferenceCommitteeId)`** (in a session `useChairAwards` / `resolveChairAwards`; a failed read = not offered). Awards only on conference-linked sessions. `award_type` keys are stable identifiers. Nothing about a nomination is visible to a delegate before publish; never bypass the `conference_awards` RLS. Publishing mints one `gavelling_verified` CV entry per recipient, is idempotent, and sends no email (an owner's call). Awards are not a checklist item or a verification criterion.

**The checkmark.** The organiser checklist is exactly 7 steps with stable keys: `page`, `committees`, `applications`, `financials`, `communications`, `chairs`, `store`; the blue checkmark is the first six. `conference_setup_status()` is the truth; `refresh_conference_verification()` stores the mark; a guard trigger rejects any direct write to `conferences.is_verified`. Visit stamps are written ONLY by `mark_organiser_visit`. `intentRank` reorders pending rows and never removes one.

**Identity.** Sign-up asks nationality and date of birth first (`validateBasics`, `src/lib/pendingBasics.ts`); `CompleteBasicsGate` is the backstop and cannot be dismissed (Sign out is the exit); nationality is prefilled from `/api/geo` (Vercel's IP header, never a third party) and written only on the user's tap. A name is a person's name: `nameProblem(name)` in `src/lib/personName.ts` is the one rule. Log in / sign up is the pop-up opened by `openAuth`; the first three questionnaire steps are required. Every gate publishes through `src/lib/basicsGateState.ts` so no two modals stack, and no gate opens on a live session route.

**Listings** (`docs/conferences/claimable-listings.md`, `docs/conferences/listings-job.md`, `src/lib/listings.ts`). A listing is an ordinary `conferences` row with `listed_by = 'gavelling'`, owned by the Gavelling staff account, written ONLY by `upsert_gavelling_listing` (the daily job); `listing_meta` holds the sources, the checked date and the banner credit. It goes public only when `gavelling_listing_meets_bar()` holds AND the `listings_live()` switch is on (database). On every surface a listing carries "Not on Gavelling yet" (`NotOnGavellingMark`), shows no Apply, price, window, organiser email (it is our inbox), secretariat or reviews, and the Delegates count only when `listing_meta.delegates_known`; it is never a spotlight, never on the homepage rail, never counted as taking applications. Its logo and banner may be third-party https URLs and are drawn ONLY through `conferenceImageSrc` (`src/lib/listingImage.ts`, served by `/api/listing-image`, which takes a slug, never a URL) and fetched server-side ONLY through `fetchListingImage`. Claims are manual (email to the team inbox; Peter asks Claude to run `transfer_listing_to_organiser(conference, user)`, which sends one email; there is no admin tab, owner 19 Oct 2026); removal is `set_gavelling_listing_hidden` (archived, never re-published by the job).

**Custom and press committees.** `src/lib/slotGroups.ts` is the contract for groups and crests. Press committees are live: seat holders, chairs and accepted observers get the Press Desk (`/conferences/[slug]/press`, noindex, read only; never chat, feedback, scores, notes, votes or settings). Press seats and chairs send releases through `send_press_release`: 600 characters, an optional image, 3 per person per conference in any 24 hours, one `session_broadcasts` row per open room with `source = 'press'`, shown in Everyone and never as a chair card. No chat or DMs with the press.

**Intent and the wizard.** `src/lib/conferenceIntent.ts` is the only definition of the six options. `conferences.intent` keeps three states apart (`'{}'` never asked, `skipped: true`, answered). The wizard asks intent before the insert and requires it; a signed-out visitor is never asked for an email: answers stay in the browser (`gavelling-conference-draft-local`) and sign-in is asked at "Sign in to publish", then the create runs; it asks the payment METHOD, never a price. A new conference is published on create as a SECOND write whose refusal is swallowed, never part of the insert. Drafts belong to an account only by browser token or verified auth email, never a typed email; limits 512 KB, 240 saves per token per 10 minutes, 3 new drafts per email per day, 5 open per email, 500 anonymous per hour.

**Live rooms.** `LiveRoomsGate` opens one prompt at a time (organiser > chair > delegate > advisor) from `my_live_rooms()` (the caller's own rows, never the chair suffix), never on a session route, /join, auth or apply paths, never over another gate. A chair enters through `enter_live_chair_room` with no chair code; the database decides Moderator or Commenter at press time. The advisor board reads `my_advisor_delegation()` (own society only, never an email or user id).

**The Documents page** (`/manage/[slug]/documents`: one page, two equal columns from 1100px). Committee settings are ONE verified write, `save_committee_documents`. A study guide follows its release date only: no Publish or Unpublish. Resubmitting is always allowed; a replaced position paper goes back to `submitted` (a trigger). Conference documents (private buckets, PDF / Word / JPG / PNG, 10 MB, signed URLs made inside the click) are removed, never deleted once copies were sent back. The five document emails are sent ONLY by the server; `defaultEmails.ts` mirrors their copy word for word. Six committees per page, one full-width row each. Email attachments: 10 files and 10 MB per email, this conference's files only; the outbox trigger is the real check. Every template saves its files on `email_templates.attachments` (automatic emails since prompt 133, builder templates since prompt 144: the same Attachments row, picker and limits, saved as they change through the template save, a verified write that keeps the old list and shows the sentence on a refusal, an empty list saves null; a saved template opens with its chips and each send still passes them). Each attachment keeps its own bucket: `conference-documents` or `study-guides` (a committee study guide, path under this conference's id; "From your documents" lists Additional Documents and Study Guides). The outbox copies a template's files into every row queued with that template_id, and send-emails v19 sends those rows one by one. The client automatic senders pass the enabled template's id even when it sends our default wording.

---

## 5. Where things live

```
src/app/
  (sessions)    create, join, chair/[code], delegate/[code], advisor (the board; advisor/[code] redirects to it), voting/[code]
  (public)      /, sessions, about, contact, blog/*, guides/*, [slug] (vanity), conferences/{explore,all,in,roles,new,[slug]/*}
  (participant) conferences/[slug]/{apply,pay,role/[role],papers,awards,press}, drafts/[token], invites/*, r/[token]/[key]
  (organiser)   manage/[slug]/{committees,applications,assignment,documents,communications,financials (financials/aid, /invoices, /documents, /history),settings,store,jobs,import,live,scoreboard}
  (account)     account/{profile,cv,conferences,manage/{credits,subscription,promo}}, auth/*, cv/[id]
  redirects     /account, /account/unlimited, /account/calendar, /my-conferences, /pricing, /conferences/map, manage/[slug]/{awards,financial-aid}
  api/          ambassador, conference-view, contact, emails, geo, gifs, guides, indexnow, og, site-view
src/lib/
  sessions      types.ts, committeeService.ts (all session DB I/O + realtime), sessionSync.ts, scoring.ts, sessionScoreboard.ts, settingsStore.ts, committeeFlags.ts, docNames.ts
  conferences   conferenceAccess.ts, conferenceScoreboard.ts, awards.ts, awardsService.ts, slotGroups.ts, conferenceIntent.ts, finance.ts, payments.ts, emailEvents.ts, defaultEmails.ts, organizerPermissions.ts, publicFees.ts, seo.ts, conferenceSlug.ts, conferenceAliases.ts
  shared        translations.ts, countries.ts, supabase.ts (anon), supabase-auth.ts (getAuthedClient), sessionClient.ts (chair suffix header), friendlyError.ts, replaceUrlInPlace.ts, reportCrash.ts
src/components/ neu.tsx (tokens), DatePicker, GSelect, Portal, CircleFlag, SeatName, SiteNav, SiteFooter, GoldButton, ScoreboardTable, MotionsModal, DocumentsModal, RollCallPanel, ChatPanel, SettingsPanel, FeedbackLogPanel
```

**State.** The chair page is React state + `committeeService` + a Realtime channel through `startSessionSync` (AGENTS.md RULE 4), with `useSettingsStore` (zustand) for per-committee settings. The conferences layer uses no zustand.

**Auth clients.** Every client made by `getAuthedClient` sends the SDK's CURRENT token; a "JWT expired" answer refreshes once and retries once, silently; only a failed refresh opens the sign-in pop-up (a timed-out refresh or an offline browser opens nothing). Pollers get their client from `getFreshAuthedClient()` at call time, pause while hidden, and refresh before polling again. **Key effects and page loads on the user id, never the token or the session object.** Never put a full-screen loader on a re-read; never `location.reload()` to pick up data that can be read in place; use `replaceUrlInPlace` (`src/lib/replaceUrlInPlace.ts`) for a query-only URL change. Session pages never reset an access state to a loader from a re-check.

**Database.** No `supabase/` directory and no migrations in git; the schema lives only in the remote project; `scratch-*.sql` files are drafts, not truth. Inspect with the Supabase MCP tools before assuming a column exists. RLS is the security boundary everywhere; `isViewOnly`, section permissions and hidden buttons are not. supabase-js resolves on an RLS refusal and a zero-row update returns no error: every write that matters asks for `.select('id')` and counts rows.

Deleting a conference committee removes its chat attachments through `chat_cleanup_queue`, never its submitted documents.

---

## 6. Email

Nothing sends inline. Every email is an `email_outbox` row, rendered by a trigger, delivered by the `send-emails` edge function via Resend. Add an event to `EVENT_REGISTRY` in `emailEvents.ts`. Test emails go to **wearegavelling@gmail.com**, exempt from the hourly cap; every email carries an image.

**Senders and switches.** `ESSENTIAL_DEFAULT_ON_EVENTS` are on when no `email_templates` row exists; an explicit OFF row is honoured. Payment received and the document emails are sent ONLY by the server. Four fixed server emails always send (receipt, refund confirmation, proof not accepted, your spot is covered). Allocation emails have two switches and the template's OFF wins. Emailing "everyone" reaches imported people who never registered; the unsubscribe link must never be removed from a broadcast. Cron-only edge functions verify the DB-held `x-cron-secret`, failing closed; `send-emails` is deliberately not gated. Every address-level error text starts with "Invalid recipient address"; `outbox_error_is_address_level()` keys on it. Campaigns: `email_campaigns` + `queue_email_campaigns_tick()`; cron `email-campaigns` (every 10 minutes) IS scheduled and active; campaign v2-05 ran to about 4,900 recipients and finished. Run one: paste `scripts/newsletter/publish.mjs`'s output, preview with `select queue_email_campaign('<slug>')` (inserts nothing), test with `queue_email_campaign_test`, start with `update email_campaigns set started_at = now()`, pause with `paused_at = now()`, stop with `email_pause()` or `cron.unschedule('email-campaigns')`. `/r/[token]/[key]` stores nothing but the click. Pacing everywhere: at most `120 - rows created in the last 10 minutes` per run.

### STOP ALL EMAIL

```sql
select public.email_pause('why you stopped it');   -- nothing leaves, no deploy needed
select public.email_resume();                      -- everything held goes back to pending
select * from public.email_sending_paused;         -- is it paused, who paused it, why
select status, count(*) from email_outbox group by 1;
```

Paused parks every new and waiting row as `held`, keeping `send_after`; resume puts them back; suppressed rows are never released; only the burst alarm's own email is exempt. `email_burst_check()` runs every 5 minutes: over 150 rows due in 10 minutes it alerts; over 600 it pauses everything.

### Never more than TWO emails to one address in any rolling hour

Enforced in the database by the BEFORE INSERT trigger `email_outbox_rate_cap()`, so every sender obeys it. A third row inside an hour has its `send_after` DEFERRED (61 minutes after the earlier of the pair), never dropped; after 500 attempts it is `held`. Exempt: the owner's alarm, the team inbox wearegavelling@gmail.com, suppressed rows. The cap fails OPEN, so a bug in it can never stop email. A broadcast to an address that already got two lands later, not never.

### AGENTS NEVER CALL A LIVE SENDING FUNCTION TO TEST ANYTHING

Whatever the argument is called. Testing is a rolled-back transaction (`begin; select ...; rollback;`) or a send to the owner's own address, nothing else. Before calling anything that can write `email_outbox`, read its body and find the line that skips the insert; if you cannot point at it, you are about to send. This rule exists because an agent once called `queue_checkmark_emails(null, true)` believing the flag meant dry run, and 440 emails reached 424 organisers. Senders with NO preview flag, which always send to real people at once: `queue_organizer_reminder_emails`, `queue_request_digest_emails`, `queue_study_guide_release_emails`, `queue_chair_session_reminders`, `compose_daily_platform_report`, `admin_email_conference_organisers`, `mark_invoice_paid`, `settle_invoice_effects`, `review_payment_batch`, `queue_prereg_credit_campaign`, `queue_email_campaigns_tick`, `queue_email_campaign_test`, and others. Never re-enable cron `payment-reminders`.

---

## 7. Sessions runtime in one screen

- `speakersList` is the GSL: permanent, never wiped by a caucus; a GSL floor holder with time left interrupted by a caucus or a suspension goes back to its front, HELD in `settings.gslHeldFloors` with the seconds left and the original seat nonce, so the resumed turn is one speech of every second spoken (`src/lib/gslFloorReturn.ts`). `caucusQueue` is temporary. `currentSpeaker` is its own row and never in either list.
- Optimistic writes: `updateLocal()` first, DB write fire-and-forget; realtime echoes are ignored for 3 s after a structural local write; the Commenter never debounces. Every write reports whether it landed (`runWrite`); parkable writes survive offline (`OFFLINE_RESILIENCE`).
- Timers are anchored on the DATABASE clock (`serverNow()`): persist `started_at` + duration once; there is no per-second write and there must never be one.
- List writes go through the `speakers_list_add` / `speakers_list_reorder` RPCs; never a client-computed position.
- `committees.settings` is written as key-level patches only; `chairJoinSuffix` is the only write credential and is never regenerated when the DB has one. `isViewOnly` is a UI gate, never a permission.
- End Debate is reversible for 24 hours (`ENDED_KEEP_HOURS` = `REOPEN_WINDOW_HOURS`, `src/lib/roomRetention.ts`, changed together); a conference room is never auto-deleted; a suspended standalone room is kept 72 h after debate, else 36 h.
- One person per seat (`delegate_seat_claims`): a claim expires after 65 idle minutes, a kicked device is locked out 10 minutes, one device per signed-in account. Not a security boundary.
- An Absent delegation is never added to a list; attendance changes only through Roll Call. A chair name never equals a seat. Seat names go through `<SeatName>`. Up to 15 motions on the floor.

The rest is in `AGENTS.md`.

---

## 8. Design and copy

**The 12-year-old rule.** Every screen, above all organiser set-up, must pass "is this easy enough for a 12 year old to set up?": one obvious next step per screen, plain words, sensible defaults on, advanced options tucked away, no indicator that does not change a decision.

**Style sheet (the rules that won the taste boards: https://claude.ai/artifact/9CDYVLCgb7h8apgaDPEyad, https://claude.ai/artifact/X9Lue9qkskg41q1z6GT78c, https://claude.ai/artifact/HHtzZWT6bPBkp3vif7fUgV, https://claude.ai/artifact/Q5WEk2qYtNsJWpCc9uEYMm; the direction is Airbnb).**
1. Tokens in `src/components/neu.tsx`: ivory `#EDE7D8` page, `#F0EBDD` surface, forest `#1B3828`, gold `#EED98A`, ink `#1C1410`; shadows forest-tinted, never neutral; `muted` fails contrast for body text, use `inkSoft`.
2. Pages are ivory and white only; forest is an accent (the main button, text, a small mark), never a band or a card background. No ivory-to-white fades.
3. Cards: white with a soft shadow, or the raised / pressed 3D cards (NeuCard), which stay across the organiser tools. Never a forest card or a flat hairline card.
4. Never paint a square-cornered tinted band behind a sticky header, tab row or filter bar; at rest a sticky header has no background of its own.
5. The typeface is Inter everywhere, loaded once by `next/font` as `var(--font-brand)`; never name a family that is not loaded. Outside Sessions every weight reads one step lighter (`LIGHTER_WEIGHTS_SCRIPT`). Playfair Display italic only for the gold accent word.
6. A page's MAIN heading may end in ONE gold Playfair word (`<GoldWord>`), once per page; every other title is plain sans in ink. No all-capitals tracked headings, no serif headings.
7. Buttons are sentence case in the Airbnb rounded rectangle with the forest gradient; the one gold call to action is `GoldButton`; no full stop at the end of a title, button or caption; every inline link is bold and underlined; every left rail is sticky. Existing uppercase labels change only when their surface is redesigned.
8. Icons: the direction is style A, fine line in bare ink (Lucide at strokeWidth about 1.5, no tile behind it), chosen by Peter on the delegations taste board (19 to 20 Oct 2026, `docs/conferences/delegations.md`). Every new or redesigned screen uses it; the delegation screens already do. Never add a new Fluent 3D emoji (`Emoji3D`) or a forest-gradient icon tile; existing `Emoji3D` surfaces (organiser pages, pricing, the purchase pop-ups, Manage account, the help center) keep theirs until that surface is redesigned, then move to style A. No duotone icons, never native emoji in text, never a gold icon on a forest tile. An icon may hang over its card's edge; never unclip a card for it.
9. Counts are a big number with the word beside it, or icon + number. No count or status pills anywhere; observer status is an icon.
10. Flags come in two shapes and never mix: a rectangle uses `getFlagUrl`; a circle uses `src/components/CircleFlag.tsx` (`<CircleFlag>`, `<SeatCircleFlag>`), crest then flag then monogram. Never put a `getFlagUrl` image in a `rounded-full` box.
11. Never cut a name or label off with "…": no `truncate`, `text-overflow: ellipsis` or `line-clamp` on a person, delegation, committee, country, email or any identifying label. Use two rows: the short form big, the full text smaller beneath, wrapping (`[overflow-wrap:anywhere]`). An ellipsis is allowed only on free text that is not an identity, with the full text as its `title`. Sessions: `<SeatName>`; committees: `committeeDisplayName`.
12. No em dashes in user-facing copy. No triads of short fragments, no "N things worth knowing" boxes, no captions under titles: one short title, at most one plain line.
13. Outcome messages ("Saved", "Couldn't save") are the glass card top right (`notifyOk` / `notifyErr`, `src/lib/appNotify.ts`), never a banner in the page; facts that stay true stay in the page. Loading is grey skeletons.
14. A section is as tall as its content (only a hero may be one viewport); padding about `clamp(40px, 4vw, 64px)`; titles about `clamp(24px, 2.4vw, 40px)`. Devices overlap the section above; no white gradient fades over photos.
15. Work in small steps: targeted edits, a rebuild only when a section breaks a hard "no". Never redesign the chair console or the delegate phone. Buttons with an icon lead with the icon, the word small beneath. A photo not in `public/`: ask Peter.

**Components.** The logo is always the image (`/gavelling-lockup.webp`, the gavel mark for square spots), never typed text, never a generated file. Never a native `<select>` or `<datalist>`: every dropdown is `GSelect` (`src/components/GSelect.tsx`); richer pickers keep their own components. Dates: the shared `DatePicker` only, never `<input type="date">`. Popovers through `Portal` at fixed coordinates, flipped near edges, never clipped. Info hints open on hover. Every button gets `focus:outline-none`. Consoles and dashboards fit one screen at 1280x800 and up (`docs/ui-audit/00-DESIGN-RULEBOOK.md` §9).

**Errors.** Never render `error.message`, a Postgres, PostgREST, Storage or Stripe string, or a stack trace to a user. Route every caught error through `friendlyError(error, fallback)` (`src/lib/friendlyError.ts`); when a migration adds a CHECK a user can reach, add its sentence to `CONSTRAINT_MESSAGES` in the same change; our own thrown errors are `new UserFacingError('...')`. Only `src/app/admin/*` keeps raw errors. `reportCrash.ts` drops noise and records expected refusals; crash alerts go to wearegavelling@gmail.com.

**i18n.** Four locales in `src/lib/translations.ts` (en, es, fr, ar with RTL), sessions only; English everywhere else. New keys go in `src/lib/translations<Area>.ts`; keep `.claude/TRANSLATIONS.md` updated. Polish reference: `.claude/skills/make-interfaces-feel-better/SKILL.md`.

---

## 9. Switches

Database `store_flags` (as of 17 Oct 2026):

| Flag | Gates | State |
|---|---|---|
| `email_cap_enforced` | the bulk email allowance blocks sends | on |
| `organizer_import_charged` | 1 conference credit per imported charged-role row | off (flip with `IMPORTS_PAID_LAUNCH`) |
| `leader_import_charged` | 1 leader credit per imported delegate | off (flip with `LEADER_IMPORTS_PAID_LAUNCH`) |
| `docs_extra` | extra documents, ask-back, reminders | off (demo conferences behave as on) |
| `email_attachments` | files on builder emails | off (demo conferences behave as on) |
| `fin_refund_outcome` | refund outcomes | on |
| `fin_checkout_vouchers` | discount codes at /pay checkout | on |
| `fin_link_required` | payment setup must be complete before paying | on |
| the other `fin_*` flags, `aid_pool_leaders` | the merged Financials rules | on |

Client constants:

| Constant | File | Value |
|---|---|---|
| `IMPORTS_PAID_LAUNCH` | `manage/[slug]/import/importQuote.ts` | false |
| `LEADER_IMPORTS_PAID_LAUNCH` | `manage/[slug]/import/importQuote.ts` | false |
| `JOB_BOARD_LIVE` | `manage/[slug]/jobs/page.tsx` | false |
| `COMMS_TOUR_LIVE` | `manage/[slug]/communications/page.tsx` | false |
| `GENERATE_INVOICES_READY` | `manage/[slug]/financials/dashboardKit.tsx` | true |
| `OFFLINE_RESILIENCE` | `src/lib/offlineResilience.ts` | true (the kill switch) |
| `DELEGATIONS_V2_DB` | `conferences/[slug]/participant/delegation/v2.ts` and `manage/[slug]/applications/delegations/v2.ts` | false (people and seats; flip both together once `scratch-delegations-part1-people-and-seats.sql` is applied) |
| `DELEGATIONS_MONEY_DB` | the same two `v2.ts` files | false (removing a member and the organiser's delegate / advisor move; flip both once Christian's chat ships `delegation_remove_member` and `organiser_set_member_role`, `docs/conferences/delegations-requests-for-christian.md`) |
| `REFUND_WORDS_EDITABLE` | `financials/documents/DocumentEditor.tsx` | true |

---

## 10. Pending

- `scratch-awards-setup.sql`: an unapplied draft enforcing the awards gate in the chair INSERT policy and `submit_committee_awards`. Owners decide.
- `scratch-tbd-public.sql`: the commented UPDATE publishing existing never-published TBD conferences. Owners' call, not run.
- `scratch-study-guides-storage.sql`: the `study-guides` bucket lets ANY signed-in account upload, overwrite, delete and list every conference's files; the draft limits writes and listing to the conference's organisers (same test as the `study_guides` table), public-URL reads unchanged, no client change. Apply soon (owners).
- `scratch-session-block-seats.sql`: a delegation's open seat (allocation with no person) currently locks its country in the live room for everyone, and leader seat swaps fail when both people have accounts; the draft makes only rows naming a person reserve a country (`seat_claim_is_reserved`, used by `session_join_rules`, `claim_delegate_seat`, `session_reserved_seat_hint`) and clears both seats before a swap fills them. Apply before any conference with live rooms gives open seats (owners); then update AGENTS.md JOIN PAGE "Reserved seat".
- `scratch-delegations-part1-people-and-seats.sql`: the delegations rebuild's seats and reads only (open seats, placing and taking out of a seat, organiser seat grants with the seat limit, committee roster, member seats, leader papers, study guides, chair names); it writes no invoice, payment or coverage. Send it to Christian's chat for a read, then apply and flip both `DELEGATIONS_V2_DB`. Money pieces (removing a member, the organiser's delegate / advisor move, the "pledge" wording inside their functions) are requests to Christian's chat: `docs/conferences/delegations-requests-for-christian.md`. `scratch-delegations-rebuild.sql` is the superseded single draft; never apply it.
- Cron `paid-announcements`: not scheduled; nothing reaches recipients until it is. Schedule after the first approval in /admin (commented in `scratch-paid-announcements.sql`). Owners.
- Cron `conference-draft-reminders` (`queue_conference_draft_reminders(false)`): not scheduled; needs Peter's go.
- The email burst alarm goes to petizakhar@gmail.com; moving it to the team inbox needs SQL (the chat's Supabase work).
- Referral codes: the database objects remain unshown; removing them is the chat's Supabase work. The old "step 6" ownership check is moot.
- `www.gavelling.com` must 308 to `https://gavelling.com` at the Vercel domain level with a valid certificate (Peter or Christian).

**Dead code to delete:** `account/manage/{ManageAccount,CreditsSection,SubscriptionSection,PromoSection}.tsx`, `SpotlightRow` in `ExploreFeed.tsx`, `awards/AwardsConsole.tsx`, `src/lib/store.ts` with `SpeakersListPanel`, `CaucusPanel`, `ResolutionsPanel`, the `BrandLogo` fallback, `src/app/_archive/*`, the old board component in `applications/DelegationsBoard.tsx` (only `PeopleDelegationsSwitch` is used), `CoDelegateCard`'s default export and `RosterGroup` / `RosterRow` in `participant/`.

---

## 11. Commands, checks and environment

```bash
npm run dev
npm run build                # prebuild first: check-brand-marks.mjs and check-og-config.mjs fail the build on violations
npm run lint
npm run test:e2e             # Playwright, e2e/chat-new-conversation.spec.ts, needs a running server
npm run check:og             # pageMetadata / OG rules (-- --base=https://gavelling.com after a deploy)
npm run check:indexability   # sitemap, canonicals, noindex, robots, crawl links (default https://gavelling.com)
npm run check:text-overlaps  # text clipped or overlapping because of the brand font (needs a running server)
```

No unit tests and no CI; the build, the two prebuild gates, `check:og`, `check:indexability` and the one e2e test are the quality gates. `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `GIPHY_API_KEY` is server-only. Payments, email and account deletion run in edge functions with their own secrets; nothing in this repo deploys them.

Largest files, as of Oct 2026 (lines): `translations.ts` 6.8k, `chair/[code]/page.tsx` 6.4k, `ConferenceApplyClient.tsx` 6.3k, `applications/page.tsx` 5.9k, `settings/page.tsx` 5.5k, `assignment/page.tsx` 5.5k, `communications/page.tsx` 4.6k. Keep diffs in these small; put new features in new files and mount them.

---

## 12. How work happens here

- **Branches.** All work lands on `feature/conferences-auth`. Production deploys from `claude/muncommand-recreation-9yjin`, touched only when Peter says "push to production". Commit and push after every change: `git add -A`, `git pull --rebase`, `npm run build`, push.
- **Two workstreams, one branch.** Christian Galindo owns the conferences layer and pushes to the same branch. Before editing a shared file, check `git log --author=Christian -- <file>`. Never restructure conference code as a side effect of a sessions change. The database is the real shared surface: check the live schema first.
- **Agents.** Investigation, implementation and verification are delegated to subagents; independent agents run in parallel; agents touching the same file are serialised; at most 3 agents at once.
- **Fix what was asked, then name what the same evidence implies.**
- **Docs to keep truthful:** `AGENTS.md`, `EXPERIENCE.md`, `CONFERENCES_PRD.md` + `CONFERENCES_EXPERIENCE.md`, `.claude/TRANSLATIONS.md`, `docs/competitive-mymun.md`, and the area files under `docs/`. When code makes one wrong, fix it in the same commit. New rules go in this file; the reasoning goes in the area file.
