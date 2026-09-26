# CLAUDE.md

Guidance for Claude Code when working in this repository. This file is the **map**: what
Gavelling is, who it is for, how the money and the growth work, where things live, and what
is true today. `AGENTS.md` (imported below) is the **rulebook** for the live-session runtime;
read it before touching anything under `src/app/chair`, `delegate`, `advisor`, `voting`,
`join`, `create` or `src/lib/committeeService.ts`.

@AGENTS.md

---

## 1. What Gavelling is

Two products in one Next.js codebase, sharing one Supabase project (`luruhkwrgisytejswlas`):

| Product | Identity | Money | Who |
|---|---|---|---|
| **Sessions** | anonymous, 6-char code (+ 4-digit chair suffix) | free, forever | a chair running a committee room from a laptop; delegates following on phones |
| **Conferences** | Supabase Auth accounts | organiser pays nothing; participants pay | secretariats managing hundreds of applications, allocations, papers, payments and awards |

The two meet at the database: a conference committee mints a live session (`committees.session_origin = 'conference'`, linked by `conference_committees.session_id`), and the secretariat watches every room from `/manage/[slug]/live`, reads the cross-committee scoreboard, and turns the record into awards and verified MUN CV entries.

**The strategic position** (`CONFERENCES_PRD.md`, `docs/competitive-mymun.md`): the incumbent directory charges organisers per participant per day; Gavelling charges the organiser nothing, is merchant-of-record through the organiser's own Stripe Connect account, and monetises the participant side transparently. Sessions is the top of the funnel and must stay free, anonymous and account-free.

---

## 2. Who uses it and what they want

- **Chair (Moderator / Commenter).** One laptop is the dais. Wants zero-latency controls, a queue that never empties mid-session, timers that survive reloads, and a record they can defend when awards are questioned. Everything they do is optimistic-first (AGENTS.md rules 3 to 6).
- **Delegate.** Phone in hand. Wants to know when they speak, to request the floor, submit a paper, read the study guide, and after the conference see their award on a CV they can share. They never see chair notes, factor ratings or nominations before publication.
- **Faculty advisor / observer.** Read-only board at `/advisor` (the single-room view and its nudges were removed 24 Sep 2026).
- **Organiser / secretariat.** Repetition at scale: 1,000 applications, 400 seats, 30 committees. Wants the To-Do queue, fit-scored assignment, one-click emails, a live status wall, and a closing ceremony they can run from one page. Section permissions are UI-only (`src/lib/organizerPermissions.ts`); only `team` and `financials_readonly` are DB-enforced.
- **Applicant browsing.** Discovery (`/conferences/explore`, `/conferences/map`), the job board for chairs and staff (`/conferences/roles`), public conference pages with vanity URLs, and a public MUN CV at `/cv/[id]`.

Design consequences: mobile-first on every delegate and applicant surface; the chair page is desktop-first; the organiser surfaces optimise for the 900th repetition, not the first.

---

## 3. Business model (as implemented, not as pitched)

| Mechanism | Where |
|---|---|
| **Credits**: 1 credit = 1 application (delegate, head-delegate, faculty-advisor, observer; chairs exempt). USD 1 each, bundles from 10 up discounted by the server's tiers (see "Buying credits and Unlimited" below). Bought in the credits pop-up (`create-credit-checkout` v5, embedded Stripe Checkout); refunded on rejection. Welcome credit + one-time modal on signup (`CreditsWelcomeGate`). | `src/lib/creditPricing.ts`, `src/lib/purchasePopup.ts`, `src/hooks/useCredits.ts` |
| **Subscriptions**: Unlimited (unlimited credits): USD 3 a month or USD 30 a year, the same price everywhere, no regions. Pro is hidden from the UI and not sold. Whether someone is on Unlimited is `my_unlimited_status()` (a personal `unlimited_*` subscription, active or trialing, not past `current_period_end`), read client-side through `useUnlimitedStatus()` (`src/lib/unlimitedStatus.ts`). `profiles.unlimited_status` is DEAD: nothing ever wrote it (every profile read `none` while 129 subscriptions were live); never read it. | `src/app/account/unlimited/page.tsx`, `payments.ts` |
| **Conference fees**: **there is NO platform fee** (owner, 23 Sep 2026; Stripe Connect is unavailable in many countries, so manual payment is a first-class path, not a fallback). Card payments are direct charges on the organiser's Stripe Connect account (or, for `platform_collects` conferences, the platform account) with no `application_fee_amount`; the participant pays exactly the invoice amount, recomputed server-side in the `create-checkout` edge function. `PLATFORM_FEE_RATE` / `PROCESSING_RATE` in `src/lib/finance.ts` are legacy: `computeCheckout` still computes a `serviceFee`, but no screen shows it and nothing charges it. Do not wire them back in. Manual payments with proof review sit beside Stripe. | `src/lib/finance.ts`, `manage/[slug]/financials/*` |
| **Gavelling Points (retired 23 Sep 2026)**: no longer earned or shown. The welcome-points trigger, `grant_welcome_points()`, `award_points_for()` and the points block in `publish_conference_awards()` were dropped. `points_ledger` and `profiles.points_balance` are kept as history only; never write them and never build on them. | `points_ledger` (history only) |

**Money shown to anyone is the payments ledger, never `payment_status`** (19 Sep 2026). `conference_money_summary(conference, detail)` (`src/lib/conferenceMoney.ts`) is the one definition used by the dashboard money card, Financials and /admin: *received* = succeeded Stripe payments (money that came in through Gavelling), *offline* = succeeded manual payments (organiser mark-paid / approved proof), shown apart and never added, *outstanding* = open invoice balances of accepted participants. `payment_status = 'paid'` is an access flag: free registrations (chairs) are stamped paid on arrival and pledge-covered members are paid with no money of their own, so never multiply it by a fee. The daily report and `admin_platform_metrics` use the same split.

Hard rules: organisers are never charged; Unlimited status is server-verified; public price display goes through `displayDelegatePrice` / `fetchDelegatePrices` in `src/lib/publicFees.ts` (reading the read-only `conference_public_fees` view), because `conferences.fee_amount` is a stale denormalised column: "TBD" and no Pricing details list until delegate applications are set up (delegate role config `is_enabled`, open now or opening later); once set up, the delegate price of the current fee stage (for an upcoming opening, the stage that applies at opening) with the Pricing details list ("Applications open {date}" when upcoming), "Free" at 0. The creation wizard asks no price.

**Buying credits and Unlimited (24 Sep 2026): two pop-ups, one price source, no page change.**
- **Prices come from the database and nowhere else.** `credit_price_tiers()` (anon + authenticated) returns `{unit_cents, max_qty, tiers:[{min_qty,pct}]}` (100 cents, 500 max; 10+ 10%, 25+ 15%, 50+ 20%, 100+ 25%), and `credit_price_cents(qty)` / `credit_discount_pct(qty)` are the exact charge. The client reads the table ONCE (`src/lib/creditPricing.ts`: `useCreditPriceTable`, `priceCentsFor`, `discountPctFor`, `formatUsd`) and computes with the same rounding, `round(qty * unit * (100 - pct) / 100)`, so a chip, a total and Stripe's amount cannot disagree (12 credits = $10.80). Never type a price or a percentage into the client; until the table loads the UI shows "…". `create-credit-checkout` (v5) takes no price from the client. Unlimited is flat (USD 3 a month, USD 30 a year, `unlimitedPricing()` in `payments.ts` for display; `create-subscription-checkout` v10 is the truth).
- **The pop-ups.** `src/lib/purchasePopup.ts` is the store (`openCreditsPopup({context, conferenceName?, preselect?, onComplete?})`, `openUnlimitedPopup({renewOnce?, onComplete?})`, `closePurchasePopup()`, the two swap into each other keeping `onComplete`); `src/components/purchase/*` renders them (`PurchasePopupHost` in the root layout, mounted BEFORE `AuthModalHost` so a sign-in prompt raised from inside one lands on top). Credits is the light pop-up in the login kit's language; Unlimited is dark forest and gold on purpose. Contexts and bundles (`CREDIT_BUNDLES`): header / pricing / manage 1, 10, 25, 50, 100; apply 1, 5, 10, 20, 25 (1 preselected, the conference named); pay 1, 5, 10, 25, 50; organizer 25, 50, 100, 200; "Another amount" up to `max_qty`. No Credits/Unlimited toggle at the top, no "USD 1 a credit", no "never expires" (owner). Credits are ALWAYS the signed-in person's own balance, whoever buys: nothing sends `societyId` any more (`DelegationCreditsCard` shows the personal balance; an existing society pool is only read).
- **Cancel and resume inside Gavelling (25 Sep 2026).** Manage account → Subscription (`src/app/account/manage/subscription/page.tsx`) shows exactly one state from the whole `my_unlimited_status()` object (`src/lib/subscriptionManage.ts`, `useUnlimitedDetail`; the RPC now also returns `on_stripe`, `renews`, `cancel_at_period_end`, `can_cancel`, `can_resume`, `lapsed_plan`, `lapsed_at`): renewing ("Renews on {date}", "Update payment method" opens the Stripe portal, where card changes stay, and a quiet "Cancel subscription"), cancelled ("We hate to see you go" with Gavin, `SAD_GAVIN_SRC`, until Peter's sad drawing lands; "Unlimited stays on until {date}"; the Resume Subscription card), trial (ends on {date}, renews nothing, nothing to cancel), the one-time year ("Paid once. Active until {date}. Nothing renews."), the failed renewal (unchanged, RENEW FOR A YEAR), nothing ("Get Unlimited", or "Come Back to Unlimited" when a paid plan lapsed in the last 180 days). Cancelling opens `CancelUnlimitedSheet` ("Cancel Unlimited?", optional reason chips: too_expensive, no_conferences_soon, missing_feature, payment_trouble, just_trying, other with a 500-character note; "Keep Unlimited" is primary) and calls the edge function `manage-subscription` (`{action:'cancel', reasons?, note?}` or `{action:'resume'}`, the user's JWT, `{ok, status}` or `{ok:false, error}` shown as written, safe to repeat), which cancels AT PERIOD END and records `subscription_cancellations`; resume works while the period still runs. After either action the client RE-READS `my_unlimited_status()` (`notifyPlanChanged`) and never trusts local state; the Stripe webhook (v17) syncs `cancel_at_period_end`, so a cancel made in the Stripe portal shows up too. The Unlimited pop-up opens in RESUME mode wherever it is opened from while `can_resume` is true ("Resume Unlimited", the four benefits highlighted, one "Resume subscription" button, no checkout; success closes it and runs the caller's `onComplete` like a purchase), and reads "Come Back to Unlimited" after a lapse. Trials and one-time years renew nothing and offer no cancel. `/admin` → Data carries a Cancellations card (`admin_unlimited_cancellations(30)`: total, resumed, reasons as bars in the chips' wording, the ten latest notes).
- **Payment happens inside the pop-up.** `@stripe/react-stripe-js` Embedded Checkout with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`src/components/purchase/StripeEmbedded.tsx`); the edge function is called with `embedded: true` off a token read fresh at call time (`src/lib/purchaseCheckout.ts`, never a token captured in React state). Pressing Pay mints the session, then Stripe's form (with its own "Pay $X") replaces the bundle grid, with a "Change" link back. Without the key the same button sends the person to the hosted page. `onComplete` closes the pop-up, toasts (`notifyOk`, the stack is mounted lazily by the host on pages without their own), and `pollCreditsUntilChanged()` (`useCredits.ts`) re-reads the balance every 2 s for ~20 s until the webhook lands, then `refreshCreditsEverywhere()` updates every mounted reader; `notifyUnlimitedChanged()` (`unlimitedStatus.ts`) does the same for the plan. A 3-D Secure payment returns through `returnTo?credits=success&session_id=…` / `?unlimited=success&…`, which `PurchaseReturnHandler` (in the host) handles on ANY page: toast, refresh, strip the params. A 409 from the subscription function means Unlimited is already active and is shown as a sentence. `renew: false` is sent from exactly one place: `/pricing/subscription?renew=once`, the failed-renewal email's link, which opens the Unlimited pop-up in "Pay once for a year" mode (Manage account → Subscription offers RENEW FOR A YEAR when the latest row is `past_due`, the only in-app way there). Stripe retired `ui_mode: 'embedded'` on 25 Sep 2026: `create-credit-checkout` v6 and `create-subscription-checkout` v11 use `embedded_page`; the client flow is unchanged. Stripe's own colours inside the form (its Pay button) come from the Stripe Dashboard branding, never from code. Buying while on a trial or promo Unlimited is allowed (`useMySubscription()` in `src/lib/mySubscription.ts` tells trial / paid / past_due / lapsed and the end date; the webhook adds the remaining days); only an active PAID plan is refused.
- **The delegation pool (25 Sep 2026).** Credits stay personal, but a delegation leader (faculty advisor or head delegate) can move their OWN credits into the delegation's pool, and members applying in that delegation are covered by the pool before their own credits (the credit-gate trigger does it at insert; the client charges nothing). RPCs, all `authenticated`, plain `message` on refusal: `my_delegation_pool(p_society)` (leader: `{is_leader:true, pool, mine_unspent, mine_funded, balance, covered_members}`; anyone else: `{is_leader:false, covers}`, never counts), `fund_delegation_pool(p_society, p_quantity)` (1..500; short answers `{ok:false, need_credits:N}` and the pay page opens the credits pop-up preselected to N, then funds again on completion), `withdraw_delegation_pool` (only your own unspent contribution). The "Pay for your delegates" card on `/conferences/[slug]/pay` (`participant/DelegationCreditsCard.tsx`, leaders only) is the one UI; the apply Overview reads `covers` and says "Your delegation covers your credit". `my_credit_activity` lists pool rows (kind `pool`) and pool-covered applications (delta 0). `society_credit_balance` is no longer read by the client.
- **The Conference Store (25 Sep 2026, organiser side).** `/manage/[slug]/store` (`store/page.tsx`, data in `storeApi.ts`, look in `storeKit.tsx`, pop-ups `SpotlightPopup`, `SponsorshipPopup`, `EmailsPopup`, the list `YourSpotlights`): a conference spends CONFERENCE CREDITS on Gavelling Spotlights (homepage, explore, region, country), delegate sponsorship, email packs and four bundles. Permission: `permissions.store` (`ORGANIZER_SECTIONS` in `src/lib/organizerPermissions.ts`, rail entry STORE, `SECTION_PERMS.store`); the database's `can_use_store()` also lets `team` holders and owners in, and the layout mirrors that. Two balances, shown like the header credit chip: conference credits and your credits; Transfer moves credits INTO the conference (`store_transfer_in`, 1..1000) or BACK to you (`store_transfer_out`), and back only ever returns your own unspent contribution. RPCs: `my_store`, `store_transfer_in/out`, `store_add_sponsorship(p_conf, p_qty, p_top_up)` / `store_remove_sponsorship`, `book_spotlight(p_conf, p_placement, p_ranges [{from,to}], p_description, p_top_up)` (several ranges, up to 28 days, never before today or past the conference's last day, description 1..120 characters with no links / emails / swearing, `taken_days` when someone booked first), `book_spotlight_bundle(p_conf, p_kind boost|local_boost|launch|everything, p_items [{placement, ranges}], p_description, p_top_up)` (each placement exactly its days: boost 7 homepage + 14 explore = 40; local_boost 14 region + 14 country = 20; launch 14 homepage + 28 explore + 28 region + unlimited emails = 120; everything 28 of each + unlimited emails + 50 extra credits = 220), `cancel_spotlight(p_purchase)`, `my_spotlights`, `my_spotlight_stats`, `spotlight_calendar(p_placement, p_target, p_from, p_to)` (93 days max), `spotlight_reach(p_placement)`, `email_allowance(p_conf)`, `buy_email_pack(p_conf, '100'|'500'|'unlimited', p_top_up)` (1, 5, 20 credits). **Prices live in `spotlight_placements` (day_price, week_price, capacity, label; a booking is every 7 days at the week price plus the rest per day, never more than a week, `spotlightPrice` = `_spotlight_price`) and in `credit_price_tiers` only**; the client never types a spotlight price, and the bundles' struck-through list prices are summed from the same table. Region's target is the conference's continent from `country_continents`; country's is `conferences.country`. Every buy answers `{ok:false, need_credits}` when the conference is short: `useStoreBuy` (`storeApi.ts`) calls the RPC with `p_top_up false`, opens the credits pop-up (`context: 'organizer'`, `purpose: 'store'`) for the difference, and on completion calls the SAME RPC once with `p_top_up true` (a ref, consumed once, like the delegation pool); when the buyer's own credits already cover the shortfall it offers "Use N of your own" instead of a purchase. Cancelling: only the whole purchase, only while its first day is at least 2 days away; Launch, Everything and the house (flagship) booking never. `store_flags` (`email_cap_enforced`, `organizer_import_charged`) are OFF until the production deploy, so nothing is enforced or charged yet. **Polish (25 Sep 2026):** the two balances top right are clickable coin pills ("Conference Credits", "Your Credits") with a real "Transfer" button between them; either pill opens the credits pop-up with `destination` (`src/lib/purchasePopup.ts`): "Add to this conference" (preselected from the Conference pill) buys into the buyer's own account and then moves exactly that amount in with `store_transfer_in`, once, when the embedded purchase completes, so it stays their contribution; "Add to my account" is an ordinary purchase. Email packs are `'unlimited'` or any multiple of 100 from 100 to 5,000 as text (1 credit per 100; the Emails pop-up has an "Another amount" stepper). `email_packs(p_conf)` lists them under the Emails card's meter ("Your email packs": pack, credits, date, buyer) and `refund_email_pack(p_conf, p_ledger_id)` takes back an UNUSED pack ("Take back", confirmed first), returning the credits to Conference credits, to whoever paid them. The Emails card no longer has its own Go Unlimited button (Unlimited stays inside the pop-up).
- **Paid organiser imports (25 Sep 2026).** Each NEW row the organiser importer (`manage/[slug]/import`) creates with role delegate, head-delegate, faculty-advisor or observer costs 1 CONFERENCE credit, charged by the database at insert (`applications_organizer_import_charge`, hint `import_credits`, a plain P0001 sentence "Importing costs 1 credit for each delegate, head delegate, faculty advisor or observer. Add credits to your conference in the Store, then import again."). Chair, secretariat and staff rows and re-imported rows (updates) are free. A paid import makes the delegate's later claim free (their own credit is never taken), and a rejection or withdrawal refunds the credit to CONFERENCE credits. Before importing, `import_quote(p_conf, p_rows)` (`import/importQuote.ts`) answers `{charged, credits, conference_credits, need_credits}` and the confirm step says "Your total for these N delegates: N credits" and the conference's balance; a short conference gets the credits pop-up (`context: 'organizer'`, the shortfall preselected), then `store_transfer_in(p_conf, need)` moves the credits and the SAME import runs once (`pendingImportRef`). If the insert is still refused, the results screen shows the sentence with a "Go to Store" link and nothing else is imported. **`charged` is false until the production deploy flips `store_flags.organizer_import_charged`**, and until then the cost is shown as information and nothing blocks.
- **The email allowance (25 Sep 2026).** 1,000 free BULK emails per conference: only sends through `queueAdHocEmail` (the Communications builder, the Applications bulk Email bar) count, because those outbox rows carry an `email_send_id`; automatic notifications never count. Packs from the Store's Gavelling Emails pop-up (`buy_email_pack`: 100 for 1 credit, 500 for 5, unlimited for 20). `email_allowance(p_conf)` (`src/lib/emailAllowance.ts`) is the read; both senders read it before queueing and, when `enforced` and `remaining < recipients`, stop with "This email goes to N people and your conference has R emails left" and a "Get more emails" button (`store/GetMoreEmails.tsx` opens `EmailsPopup` in place, then re-checks). The database's own cap (`email_outbox_bulk_allowance`, hint `email_allowance`: "This conference has used its N emails. Get more in the Store, then send again.") shows the same button when it fires. The builder carries a quiet "N of 1,000 free emails used" line linked to the Store. **`enforced` is false until the production deploy flips `store_flags.email_cap_enforced`**, and until then nothing blocks.
- **Delegation imports (25 Sep 2026).** A delegation leader (faculty advisor or head delegate) can bring their own delegates in by name and email, when the conference allows it: `conferences.allow_delegation_import` (default false), switched in Manage → Settings → **Delegations** (`settings/delegationsUi.tsx`, a tab of its own after Applications, `?tab=delegations`, which also now holds Delegation allocation swaps, moved out of the Conference tab; the switch is a verified `.select('id')` write, no optimistic flip). RPCs, all `authenticated`, plain `message` on refusal: `my_delegation_import(p_society)` (leader: `{is_leader:true, enabled, pledged, delegates, free_spots, balance, imports:[{application_id, name, email, status, claimed, credit held|claimed|refunded, imported_at}]}`; anyone else `{is_leader:false, enabled}`), `leader_import_delegates(p_society, p_rows [{name, email}] 1..200)` (validates every row and writes nothing unless all pass: `invalid` with a reason per row (name, email, duplicate, self, already_applied), `need_spots` when the pledged spots are short, `need_credits`, or `ok` with the rows), and `conference_leader_imports(p_conference)` (organisers only). Each imported delegate uses ONE of the leader's own credits, taken at import and returned to the leader if the delegate is rejected or withdraws; the delegate is never charged a credit when they claim. Imports arrive as submitted delegate applications in the leader's delegation, still need the organiser's acceptance, and the SERVER queues each invite email (the client only calls `triggerEmailDelivery`). UI (moved 25 Sep 2026): an "Import delegates" button at the top right of the DELEGATION CARD, left of "Paid spots", for a leader while the switch is on, opens `participant/DelegationImportPopup.tsx` (the purchase pop-up shell) with two tabs: Import (rows or a pasted list, name over email on narrow screens so a whole address shows, the stats, per-row errors) and Imported (name, email, status, invite date; the tab carries the count). One `DelegationImportCard` instance (`tab`, `bare`) stays mounted, so typed rows survive a tab switch; its RPCs, fresh-token client and ref guard are unchanged. /pay no longer has an import row. Errors come one at a time: short of pledged spots first (the database sentence and "Add delegation spots", which goes to `/conferences/[slug]/pay?open=spots`), then "Not enough credits" in the danger colour under the button, else "Uses N of your M credits". The delegation card itself is ONE card for advisors, head delegates and plain delegates (`participant/DelegationPanel.tsx`), read with `my_delegation_roster(p_society)` (authenticated, any member with a live application; `{ok, society_name, is_leader, members[]}`, each member `{application_id, is_me, claimed, name, avatar_url, role, status, payment_status, allocation}`, payment and allocation only for the caller's own row unless the caller leads; the caller first, rejected and withdrawn left out): groups Advisors 3 / Head Delegates 3 / Delegates 5 a page, the viewer first with a gold edge and "You"; leaders keep paid spots, payment chips, pledges and swaps; an independent delegate keeps the plain `DelegationPlacard`. Also a short leader gets the credits pop-up with `purpose: 'import'` (it says "It seems you don't have enough credits for this" and lists importing as a live use), after which the same import runs again exactly once (a ref guard, like the pool). Organisers see such applications marked "Imported by [delegation]" on the Applications card and in the applicant pop-up (`ApplicationSourceMark` / `ApplicationSourceChip` `importedBy`, keyed on the application id, so it survives the claim clearing `invited_email`).
- **A lost insert response must never strand an applicant (25 Sep 2026).** In the test an observer's `applications` INSERT committed (row + credit) but the browser got `TypeError: Failed to fetch`, so `submittedAppIdRef` was never set, the catch showed the network sentence and a reload said "already applied". `handleSubmit` now (1) looks for the person's live application for this conference and role BEFORE inserting and adopts it (a retry never inserts twice), (2) re-checks the same way when the insert fails with a network-class error, and (3) once an id is held, everything after it (credit RPC, voucher, email, draft discard) is caught, `reportBlocked`, and the redirect to `/apply/confirmation` still happens; only the preferences insert keeps its UserFacingError retry. With 0 credits SUBMIT stays enabled: pressing it opens the credits pop-up and the application submits by itself when the payment completes.
- **Redirect-only addresses live in `next.config.ts` `redirects()`** (`/account`, `/account/points`, `/account/manage`, `/account/unlimited`, `/my-conferences`, `/pricing`), not in page files: a server `redirect()` page under the client account layout threw in dev ("'PointsPage' cannot have a negative time stamp"). Next keeps the query, the browser keeps the hash.
- **Where it lives.** `/pricing` → `/pricing/credits`; `/pricing/credits` and `/pricing/subscription` are two tabs in a left rail (public, in the sitemap, linked from the nav as PRICING, the profile menu and every footer); `/help` is the help center (Sessions, Delegates, Chairs, Organizers, Pricing, with search; the Pricing section and both pricing FAQs render the ONE list in `src/lib/pricingFaq.ts` through `src/components/pricing/FaqList.tsx`). "Got a question?" boxes link to `/help`, never to a page's own FAQ. `/account/manage` (`/credits`: balance, Top up, a 30-day usage chart, history from `my_credit_activity()` with the middle column headed "Action"; `/subscription`: the plan, Go Unlimited, and on a paid plan "Manage or cancel" through `create-billing-portal`; `/promo`: `claim_promo_code(p_code)`, the server's `message` shown as returned) replaces Credits & Subscription in the account menu. `/account/conferences` replaces `/my-conferences` (a client redirect keeps query and hash); `/account/unlimited` redirects to `/pricing/subscription` keeping its query (old Stripe return URLs); `/account/points` to `/account/manage/credits`. The header credit counter is the ONLY place the coin image appears, and it carries a "+" that opens the credits pop-up; the profile menu reads Needs your attention, My profile, Manage account (credit count + "+"), Pricing (Free / Unlimited badge, an up-arrow on Free opens the Unlimited pop-up), Your conferences (three, then All conferences), Sign out.

**Stripe Connect set-up needs financials write access (23 Sep 2026).** The `connect-onboard` edge function (v8, not in git) refuses `start` (create the Express account, mint an onboarding link) with a 403 unless `can_write_financials(conference)` is true for the caller (owners, and organisers with financials write access; asked with the caller's JWT); `status` stays open to every organiser, and Financials → Settings disables the Stripe buttons for a read-only organiser with the same sentence.

**A role's application window and its fee phases are one timeline (21 Sep 2026).** Since 19 Sep
`guard_application_write()` refuses a non-organiser application outside `applications_open_at` /
`applications_close_at`; MUNBU WS then advertised a Late price for days nobody could apply on. Now
the trigger `enforce_role_config_timeline()` (via `role_timeline_normalise()`, mirrored client-side
in `src/lib/roleTimeline.ts`) runs on INSERT or any write of those two columns or `fee_phases`:
dated prices must be back to back (overlap / gap refused), and when they exist they ARE the window
(open on the first price's start day, close on the last price's end day, conference timezone else
UTC; the edited side wins, the other follows), open before close, never close after the
conference's last day. Refusals raise named `arc_timeline_*` constraints with sentences in
`CONSTRAINT_MESSAGES`. Settings (`settings/timelineUi.tsx`) derives the same answer before saving,
says what moved in one line, and shows a warning with a one-click fix for rows saved before the
rule. Existing rows were not rewritten. The apply page and the conference page judge "open" by the
database clock (`src/lib/applicationWindow.ts`) and show the closed / not-yet-open state before the
form; a window refusal at submit is not a crash alert. The only payment date in the schema is the
optional `invoices.due_date` (23 Sep 2026): nothing sets it yet (no organiser UI), it enforces
nothing, and it is only SHOWN (the Pay now card, `queue_payment_reminders()`).

**Participant lifecycle jobs (23 Sep 2026).** All SECURITY DEFINER, all callable only by the
service role / cron:
- **Pay now.** `my_open_balances(p_conference)` (authenticated) returns what the caller owes
  today per conference (open/partial invoices payable now: payable before acceptance or the
  application accepted; own, or the delegation's as its head delegate / advisor), with the
  earliest `due_date` and `payments_ready`. `PaymentsDueSection` on `/my-conferences` and
  `PayNowCard` on the participant page (`participant/PayNowCard.tsx`) render it.
- **`queue_payment_reminders(p_preview default TRUE, p_limit)`**: one email per payer per
  conference, only for accepted participants, first no sooner than 3 days after acceptance, at
  most one per invoice per 7 days (`payment_reminder_log`), respects `notify_email_payments` /
  `notify_email_reminders`, the global opt-out, failed addresses, `conference_payments_ready()`,
  and stands down for 7 days after the organiser's own `queue_payment_reminder_emails()`
  (template `payment_available`). **PAUSED 24 Sep 2026 and it stays off: cron `payment-reminders` (11:15 UTC) is `active = false`.** Its one run, on 24 Sep, emailed 92 payers across 8 conferences, none of which had turned any reminder on. Payment reminders are the organiser's choice: the opt-in `payment_available` recurring reminder (cron `payment-reminder-drain`, `queue_payment_reminder_emails()`). Never re-enable or re-schedule this job. Preview inserts nothing (90 payers across 9
  conferences on 23 Sep 2026).
- **`queue_claim_reminders(p_preview default TRUE, p_limit)`**: imported / invited applicants
  with no account. Upcoming conference: "Your place is waiting" (Committee + Representing facts
  when allocated), at most 3, a week apart. Finished conference: "We know, it's over", accepted
  and beyond only, within a year, ONCE ever PER PERSON (`lower(email)`, not per application, since
  24 Sep 2026). Link `/invites/import/<claim_token>`; skips anyone
  with an account, opted-out or failed addresses, and anyone emailed in the last 7 days
  (`claim_reminder_log`). Skips test / demo conferences (`conference_is_test(slug, full_name,
  is_demo)`, the SQL twin of `isTestConference` in `src/lib/publicConferences.ts`: change both) and
  dead drafts (never published, `is_public` false AND `published_at` null, and already started; note
  this also skips a real conference run privately, e.g. MUJMUN 13.0, 36 people).
  **Scheduled 24 Sep 2026: cron `claim-reminders` 11:30 UTC daily.** Preview: 165 (69 upcoming, 96 past) on 23 Sep 2026; 137 (69 upcoming, 68 past) after the 24 Sep changes.
- **"Failed address" means the ADDRESS failed, never its batch (24 Sep 2026).** Every sender
  (payment, claim, prereg) asks `email_address_failed(email)`: true when the address is unsendable on
  its face (`email_address_is_unsendable`: malformed, non-ASCII, or a reserved placeholder domain
  `example.*`, `*.test`, `*.invalid`, `*.localhost`) or has a failed outbox row whose error is
  address-level (`outbox_error_is_address_level`: "Invalid recipient address…", "No recipient
  email…", a bounce). "Resend batch error…" rows are collateral and do not count; before this, 127
  innocent addresses caught in poisoned batches were silently excluded from every reminder.
- **Imported applications attach by VERIFIED email only** (`auth.users.email_confirmed_at`, never
  `profiles.email`): the profile-insert trigger, a trigger on `auth.users` when an address is
  confirmed (`claim_imported_on_email_confirmed`), and `claim_my_imported_applications()` once per
  browser session from `ProfileDropdown` (`src/lib/importClaim.ts`). **A claim takes a credit if the
  claimant has one, and never blocks (24 Sep 2026, owner's rule).** `claim_imported_for` and
  `claim_import_invite` (the invite link) call `_credit_consume_core`: a claimant who holds a
  credit (usually their free welcome credit) spends it. Only when that answers `need_credit` do
  they record a `claim_free` hold (no lot), so a claimant with no credit is attached anyway and
  never sees a paywall. Errors go to `claim_billing_errors` and never block a claim.
  `_credit_consume_core` re-issues `claim_free` when a claimed import that once held one is
  reinstated after a rejection. The 16 claims refunded early on 24 Sep were re-charged under this
  rule (11 from their own credit, 4 covered by Unlimited, 1 `claim_free`). About 294 older
  claim-looking charges were not touched: the owner's call. Never change claims to "always free".
- **`close_undecided_after_conference()`**, cron `close-undecided-after-conference` 02:20 UTC:
  applications still `submitted` the day after a conference's last day (its timezone) become
  `withdrawn` (the credit gate refunds the credit), recorded in `application_auto_closures`. No
  email. First run closed 34 (16 credits refunded).
- **`record_attended_cv_entries()`**, cron `record-attended-cv-entries` 02:40 UTC: after a
  conference ends, one `mun_cv_entries` row with `source = 'gavelling_attended'` per seat holder
  (allocation) and chair, unless the person already has an entry for it. Shown as "Gavelling
  record" on `/account/cv` and `/cv/[id]`, never the blue seal (awards still upgrade it to
  `gavelling_verified`). Deleting one leaves a tombstone (`cv_attended_dismissals`) so it never
  comes back. Backfill wrote 177 across 23 conferences. `mun_cv_entries_guard_source` stops a
  client from writing any source but `manual` (the owner RLS policy used to allow forging the
  seal), and on a row that is not `manual` it silently keeps what the entry certifies
  (conference_name, conference_id, session_committee_id, committee, allocation, award, awards,
  entry_type, user_id): the owner may still delete it and edit description, photos, logo, date
  and expertise (`CVEntryModal` locks the same fields). `publish_conference_awards` overwrites an
  upgraded entry's awards with exactly the person's published awards at that conference, and its
  committee / allocation / conference name with the official ones.
- **`profiles` column grants (24 Sep 2026).** `authenticated` may UPDATE only display_name,
  nationality, date_of_birth, avatar_url, bio, mun_experience_level, education_level,
  mun_countries, conference_countries, the five notify_email_* switches, welcome_token_seen and
  setup_reminder_seen_at; anon nothing. email, stripe_customer_id, is_ambassador, unlimited_*,
  points_balance, is_demo, pre_registered are written only by SECURITY DEFINER code or the service
  role. `profiles.email` follows `auth.users.email` through the trigger
  `sync_profile_email_from_auth`. A new client write to another column needs a GRANT first.

**Stripe's own limits are the thing that breaks a big bill, and they live only in
the edge function.** `create-checkout` (v18, 8 Sep 2026; not in git, read it with
the Supabase MCP tools) has two guards, and both exist because a delegation with a
long invoice list hit them in production:

- A metadata VALUE is capped at 500 characters. `metadata[invoice_ids]` used to be
  one comma-joined list of UUIDs, which overflows at the 14th invoice and makes
  Stripe reject the whole session, so the participant simply cannot pay.
  `setIdListMetadata()` now spreads them over `invoice_ids`, `invoice_ids_2`, ...
  plus `invoice_ids_count`. **Nothing reads this metadata** - `stripe-webhook`
  matches work by `payments.stripe_checkout_session_id` - so it is forensic only,
  it may be truncated, and no settlement path may start depending on it.
- Checkout accepts at most 20 `line_items`. Above that, `fitLineItems()` groups by
  invoice KIND and unit price and puts the count in Stripe's `quantity` (grouping
  by label merges nothing: fifteen pledge spots have fifteen different labels).
  The per-invoice `payments` rows and the itemised receipt are untouched, so the
  ledger still breaks the payment down invoice by invoice.

---

## 4. Growth loops (what the code is built to do)

1. **Content SEO**: 84 posts in `src/app/blog/posts.ts` (the sitemap is generated from that manifest), the competitor-alternative posts carry the highest sitemap priority. Bare `/join` and `/create` stay indexable; `/join?code=...` is noindex by header.
2. **Gavelling Spotlight on the site (25 Sep 2026).** The homepage's "up next" rail comes from `featured_conferences('homepage', '')` (`src/lib/spotlight.ts`, read on the server by `fetchFeaturedHomepage()` in `listedConferences.ts` and handed to `VariantStagefront` as `featured`): today's booked Spotlights first (WorldMUN's flagship booking included), then the empty slots filled with the upcoming public conferences with the most accepted delegates. The hand-written `FEATURED_SLUGS` list is gone. A booked spotlight card wears the "Spotlight" tag and a bright gold edge and glow (`SpotlightTag`, `SPOTLIGHT_GLOW` in `src/components/conferences/SpotlightTag.tsx`; `ConferenceCard` props `spotlight`, `creditSponsored`); a filled slot is a plain card. Explore lists `featured_conferences('explore')` first (a continent filter: `('region', key)`, a country: `('country', name)`), still subject to every other filter, and opens `ConferenceSpotlightDialog` ("Conference Spotlight", up to three booked conferences, Apply and View conference) ONCE per site visit (`sessionStorage gavelling-explore-spotlight-seen`) when an Explore booking is live. `record_spotlight_event(booking, 'view'|'click')`: one view per browser session per booking (`sessionStorage gavelling-spot-view:<booking>`), a click when the card or a pop-up button is opened; never on localhost, 127.0.0.1 or `*.vercel.app`. **Credit sponsored** (`src/lib/creditSponsored.ts`, `credit_sponsored_conference_ids()` / `conference_credit_sponsored(id)`): a heart and the words beside the fee on every card and list row, an Explore filter (`?sponsored=1`), and on the conference page's price medallion and the apply overview the line "[ACRONYM] pays your Gavelling credit. Applying costs you nothing".
3. **Public conference pages** as landing pages: dynamic sitemap (was ISR, which froze for days on Vercel), IndexNow ping on publish and on a rename, dynamic OG cards (`/api/og/*`), `pageMetadata()` makes a missing OG image structurally impossible (`src/lib/seo.ts`; `npm run check:og`).

**The slug follows the name, and every old link keeps working (23 Sep 2026).** A conference minted `demomun`, was renamed to KU MUN, and kept the DEMOMUN link forever, because `conferences.slug` was written once by the creation wizard and by nothing else ever again. Now:
- Renaming a conference (its acronym or its full name) re-mints the slug from the new name, down the SAME ladder `src/lib/conferenceSlug.ts` uses at creation. It happens in the DATABASE (`conferences_reslug_on_rename`, migration `conference_slug_aliases_and_reslug_on_rename`), because the name is editable from the organiser settings autosave, from the admin console's `admin_update_conference` RPC and from hand-written SQL, and because the forwarding address must be written in the same transaction as the slug it replaces. `conference_slug_ladder()` in the database is a PORT of `conferenceSlugLadder()`; change one, change the other (the parity query is in that file's header — it matched byte for byte over all 272 live conferences on 23 Sep 2026). A DATE change never moves a slug, and an edit whose new name mints the slug the conference already has writes nothing.
- `conference_slug_aliases (slug pk, conference_id, created_at)` holds every slug a conference has ever answered to, seeded on 23 Sep 2026 with all 272 live slugs. RLS: read for anyone (it is public routing data); no write policy at all, so only the SECURITY DEFINER trigger and the service role write it. A conference can never mint a slug another conference holds as a live slug OR as an alias (`conference_slug_alias_guard` raises 23505 naming the slug, so `isSlugTakenError` walks the creation ladder to the next rung).
- `src/middleware.ts` 308s `/conferences/<old>/…` and `/manage/<old>/…` to the same path on the current slug, query string kept, one hop, never a loop (it fires only when the alias names a conference whose current slug is different). Middleware because the redirect must cover a dozen route files, several of them client components that cannot issue a 308 at all. `src/lib/conferenceAliases.ts` is the lookup: one point query per unknown segment, memoised for 60 s including the misses, so a live slug costs nothing per request.
- **Canonical and sitemap stay on the current slug only.** The sitemap reads `conferences.slug` and never the alias table: an alias is honoured, never advertised. `/<ACRONYM>` vanity stays 307 (derived from a mutable acronym) and now falls back to the alias table, so an old acronym typed bare still resolves, live acronyms always winning.
- What the alias does NOT fix: three `localStorage` namespaces keyed on the slug (`gavelling-first-touch:<slug>`, the guest apply draft, `gavelling-fin-currency-<slug>`) silently orphan on a rename, and `record_conference_page_view(p_slug, …)` drops a view posted by a tab that was open across the rename. Sent emails, QR codes, bookmarks and already-scraped share cards are all covered (the OG route follows the alias, so a preview cached in a WhatsApp thread keeps rendering).
3. **The MUN CV as a credential**: every profile link resolves to `/cv/<name>-<hex>`; `ShareAchievementModal` fires after a new entry; `PublicCVSignupPrompt` converts the reader. **Awards are the first thing that writes a `gavelling_verified` entry**; before that every CV entry was self-reported, which is why the awards pipeline matters commercially.
   **CV privacy (24 Sep 2026, migration `mun_cv_privacy`).** Public by default; the owner can make the whole CV private (`profiles.cv_private`: `/cv/…` 404s), hide single entries (`mun_cv_entries.is_private`, the eye on each card) or hide their nationality (`profiles.cv_hide_nationality`), from `account/cv/CVPrivacyPanel.tsx`. Enforced in the DATABASE: `get_public_cv()` drops all three (and no longer ships bio, education or experience level, which nothing rendered), and the old `true` SELECT policy on `mun_cv_entries` is now `cv_entry_visible(user_id, is_private)`: the owner, platform admins and the organisers of a conference the owner applied to (an application or a job-board application) read everything; everyone else only non-private entries of a non-private CV. Any new reader of other people's CV entries goes through that policy; never add a SECURITY DEFINER read around it. Privacy Policy §16 and Terms say the same.
4. **Job board** for chairs and secretariat, cross-conference.
5. **Ambassadors** (`/about` form) and **delegation invite links**.
6. **Draft-recovery emails** for abandoned applications.
7. **Premium MUN guides (25 Sep 2026), an Unlimited benefit that is also SEO.** Seven long playbooks (best delegate, chairing, sponsorship, regional growth, clause bank, committee design, specialised committees). Content: `src/lib/premiumGuides/content/<slug>.ts` (a small markdown-like source, grammar in `parse.ts`), catalogue `src/lib/premiumGuides/index.ts` (`import 'server-only'`: never import it from a client component). The public page `/guides/[slug]` server-renders the h1, the description, the full contents list and the teaser (the first `teaserSections` H2 sections); the rest is NEVER in the HTML or the bundle. `PremiumBody` (client) fetches it from `GET /api/guides/[slug]` with the bearer token only when `useUnlimitedStatus()` says Unlimited, and the route asks `my_unlimited_status()` again with the caller's JWT (401 no or bad token, 403 not on Unlimited). Signed out: `openAuth`; no plan: `openUnlimitedPopup()`. JSON-LD Article `isAccessibleForFree: false` with `hasPart` WebPageElement `cssSelector: '.premium-body'` (Google's paywalled-content markup). `/guides` and every guide are in the sitemap and linked by plain `<a>` cards at the TOP of `/blog`. Listed as a benefit on `/pricing/subscription` and in the Unlimited pop-up. Every premium card (homepage, /blog, /guides) is a cover photo (`src/lib/premiumGuides/covers.ts`) under frosted glass with the lock and the gold "Unlock with Unlimited"; a locked guide page ends in blurred placeholder shapes under frost with gold chains across them and the gold button (PremiumBody). The placeholder shapes are built from the locked section TITLES only. **Honesty rule:** no guide promises an award or any result, and nothing claims authorship by "world champions" or any named person; `authors` stays `[]` until the owner supplies real contributor credits. **Unlimited OR 1 credit forever (25 Sep 2026):** `guide_access(p_slug)` (with the caller's JWT, `src/lib/guideAccess.ts`) answers `{signed_in, unlimited, unlocked, can_read}`; the route `GET /api/guides/[slug]` answers 200 on `can_read`, 403 `locked` otherwise, 401 with no or a bad token. `unlock_guide(p_slug)` takes one of the reader's credits and records `guide_unlocks` (`{ok:false, need_credits:1}` when short: the credits pop-up, `context: 'header'`, preselect 1, then the unlock runs once). `PremiumBody` offers both "Unlock with Unlimited" and "Unlock this guide · 1 credit"; a guide card shows a small "Yours" mark (`GuideOwnedMark`) to a reader who can read it. Google's paywall markup is unchanged.

**Indexability rules (17 Sep 2026, after Search Console kept reopening the same issues).** `npm run check:indexability` (`scripts/check-indexability.mjs`, default https://gavelling.com, `-- --base=http://localhost:3000`) enforces them and must pass after any routing or SEO change:
- The sitemap (`src/app/sitemap.ts`, `force-dynamic`) lists only URLs that answer 200 without a redirect, are self-canonical, not noindex, and have a title, an h1 and real text in the RAW HTML. Never a redirecting path (`/conferences` 308s to `/`; link `/conferences/explore`), never a query string. `lastmod` is the content date, never `new Date()`.
- Private pages are noindex by the `X-Robots-Tag` header list `NOINDEX_ROUTES` in `next.config.ts` and stay CRAWLABLE. `robots.ts` blocks only what has a side effect when rendered (the session runtimes, which claim seats; `/unsubscribe`; `/drafts/*?stop=1`) and `/api/`. A Disallow on a noindex page is what produced "Indexed, though blocked by robots.txt".
- `/_next/static/*`, `*.pdf` and `*.txt` carry `X-Robots-Tag: noindex` and are never disallowed (Google needs them to render).
- No hreflang until real, indexable, self-canonical locale URLs exist; the languages are a client-side preference.
- Every sitemap URL must be reachable by a plain server-rendered `<a href>` from another sitemap page: `/conferences/all` (every conference page and every country hub, A to Z; the conference map was archived on 25 Sep 2026 to `src/app/_archive/conferences-map`, and `/conferences/map` now redirects to Explore), `/blog`, the homepage's own sections and site nav, and `FooterLegal` (Explore Conferences, All conferences, MUN Guides, List your conference (straight into `/conferences/new` since 25 Sep 2026; every "list your conference" button skips `/organisers`), For organisers (`/organisers`, kept for search and reachable only from here and the homepage's What is Gavelling card), Create a committee, Join a session on every public footer). A client-rendered list is not a link. **Since 24 Sep 2026 the crawl path for conference pages and country hubs is `/conferences/all`** (linked from every footer), not a directory under the explore grid (it read as a second footer and was moved), and the homepage has no extra link row under its footer any more. The explore grid renders client-side, so in production its raw HTML is only the Suspense fallback: keep that fallback's real sentence and its link to `/conferences/all`.
- `www.gavelling.com` must 308 to `https://gavelling.com` at the Vercel domain level with a valid certificate.
- **The footer is information links only** (owner, 23 Sep 2026, after this regressed repeatedly): Explore conferences, roles, List your conference, MUN guides, the session tools, About, Contact, and the legal strip. **Never a list of conferences and never a per-conference link in any footer.** Conference pages and country hubs are crawled from `/conferences/all` (`src/app/conferences/all/page.tsx`), which server-renders a real `<a>` for every public conference and every hub and is itself in the sitemap and linked from every footer as ONE "All conferences" link (a link to a directory page, not a list), so the crawl rule above holds without a directory under every page. If a crawl gap appears, fix it on `/conferences/all`.

There is **no third-party analytics or tracking** by policy (`/privacy`). The admin console (`/admin`, DB-gated by `is_platform_admin()`) is the only platform observability surface.

**The one exception: anonymous conference page visits (18 Sep 2026).** Organisers see where applicants come from on `/manage/[slug]` (`src/components/conferences/TrafficSourcesCard.tsx`: visits 7 / 30 days / all time, applications started and submitted, conversion, a per-source table and a daily sparkline). How it stays inside the policy, and must stay:
- **A visit is judged by where it BEGAN (25 Sep 2026).** MUNBU's own shared link read as "Gavelling conversion" because two things were classified as `gavelling`: any in-app hop (the navigation entry's path differed from the current one) and the auth round trip (the modal's `?auth=`, Google / Supabase OAuth returning through `/auth/callback`). `classifyLanding(slug)` (`src/lib/trafficSource.ts`) now reads the LANDING document (the performance navigation entry, i.e. the URL really loaded after any HTTP redirect, plus its `document.referrer`), never the current location: landed on any page under `/conferences/<slug>` = that landing's referrer / utm decide; landed on an auth step (`?auth=`, `/auth/*`, a referrer from accounts.google.com, *.supabase.co, appleid.apple.com, or a same-origin `/auth/*` page) = nothing is decided (except `/?auth=signin&next=/conferences/<slug>…` with an outside referrer, which a server redirect carried); landed on a discovery page (home, Explore, map, hubs, `/conferences/all`, roles, blog, another conference) = `gavelling`; landed on the visitor's own surfaces (`/my-conferences`, `/account`, `/manage`, drafts, invites, session rooms) = nothing. `classifyTraffic` returns `null` for the auth cases. An empty referrer with an in-app browser user agent (Instagram, Facebook, LinkedIn, TikTok, Snapchat, X, Telegram) is `social` + that word; the UA is read in the browser only and never leaves it. Android app referrers (`android-app://com.whatsapp/`, `com.google.android.gm` ...) map to their platform.
- **First touch** is kept on the first render of EVERY conference page by `FirstTouchCapture`, mounted by `src/app/conferences/[slug]/layout.tsx` (a layout effect, so before any page can send the visitor to sign in), also on localhost. `localStorage gavelling-first-touch:<slug>` = `{s: category, d: detail word, t, v: 2}`, 90 days, never overwritten. A version-1 entry that says `gavelling` is ignored (it was very likely an auth hop). `ConferenceApplyClient` writes it on insert to `applications.traffic_source` (category, CHECK) and `applications.traffic_detail` (migration `applications_traffic_detail_and_skip_applicant_page_views`: nullable, CHECK `^[a-z0-9][a-z0-9.-]{0,79}$`: a platform word such as `instagram`, `whatsapp`, `bing`, `gmail`, a cleaned utm_source value, or a bare referring hostname; never a path, a query string or an id). An applicant cannot change either afterwards (`applications_keep_traffic_source_trg`, now `before update of traffic_source, traffic_detail`).
- `ConferenceViewBeacon` (mounted by `/conferences/[slug]/page.tsx`; the vanity `/<acronym>` 307s there with the referrer intact) posts ONCE per browser session per conference (`sessionStorage gavelling-view:<slug>`) to `/api/conference-view` with `{slug, source, host?}` only (page views never carry the detail word). It counts the view under the landing's source when the visit began on this conference, else under the stored first touch when there is one (so a visitor who found the conference on Instagram and comes back through Explore still counts as Instagram), else under what the landing says (`direct` when it began on an auth step). utm_source / utm_medium win over the referrer. Counting is skipped on localhost, 127.0.0.1 and `*.vercel.app`, which share the production database.
- The route drops bot user agents and rate-limits 30 per minute per IP IN MEMORY; it stores no IP, no user agent, no cookie. It forwards the viewer's bearer token only so `record_conference_page_view(p_slug, p_source, p_host)` (SECURITY DEFINER, anon + authenticated) can skip the conference's own organisers AND, since 25 Sep 2026, anyone who already has an application to that conference (`reason: 'applicant'`): a returning applicant opening their conference from /my-conferences is not acquisition. A direct RPC call bypasses the route's rate limit, so the RPC caps counting at 20,000 views per conference per day.
- Storage: `conference_page_views (conference_id, day, source, views)` and `conference_page_view_hosts (conference_id, host, views, last_day)`, RLS read for `is_conference_organizer` only, no anon grant. `conference_traffic_summary(p_conference)` is the dashboard's one read (organisers only; applications counted are self-submitted ones, `invited_email is null`; "started" = submitted + open `application_drafts`).
- **Shown per application**: `ApplicationSourceMark` / `ApplicationSourceChip` (`src/components/conferences/ApplicationSourceMark.tsx`) on the Applications card (beside the submitted date) and in the applicant pop-up's hero, for every status: ONLY a logo when there is one (inline SVG in the platform's own shape and colour, no third-party request: Google, Instagram, WhatsApp, Facebook, LinkedIn, X, TikTok, Telegram, Discord, YouTube, Reddit, Bing, Gmail, Outlook, a mail glyph for other email, the Gavelling mark), otherwise plain text (the host, "Direct link", "Not tracked"); the full sentence is the tooltip and accessible name. Nothing for organiser-added rows (`invited_email`).
- Rows written before 25 Sep 2026 were NOT rewritten: many `gavelling` applications are really auth round trips (MUNBU: 37 of 41 from accounts made within 3 hours of submitting). Correcting them is the owner's call.
- Counting began 18 Sep 2026; nothing can be backfilled, so every conference's card opens on "Views are counted from today". Never add a cookie, a per-visitor id, an IP, a user agent, a full referrer URL or a third party to this pipeline.
- **Site traffic (25 Sep 2026), the same pipeline for the whole site.** `SiteViewBeacon` (root layout, `src/components/SiteViewBeacon.tsx`) posts `{page, source}` ONCE per page key per browser session (`sessionStorage gavelling-site-view:<page>`) to `/api/site-view`, which drops bot user agents, rate-limits 60 a minute per IP in memory, stores no IP, user agent or cookie, forwards no token, and calls `record_site_view(p_page, p_source)` (anon; one `(day, page, source)` counter, capped at 200,000 views per page per day). The page key (`sitePageKey` in `src/lib/siteView.ts`): home, explore, map, guides, guides/<slug>, blog, blog/<slug>, pricing, help, sessions, join, create, conference (any `/conferences/<slug>/...`), conferences/all|roles|new|in, manage, account, about, contact, organisers, cv, other. The source is ONE word decided on the first page of the session by the conference counter's own `classifyTraffic` over the landing document (the detail word when there is one, e.g. instagram, whatsapp, bing; else the category; `direct` on an auth step) and kept in `sessionStorage gavelling-site-source`. Skipped on localhost, 127.0.0.1 and `*.vercel.app`. Read in `/admin` → **Traffic** (`src/app/admin/TrafficTab.tsx`, `admin_site_traffic(7|30|90)`, platform admins only): views by day, top pages, top sources, spotlight views and clicks per conference, and Store totals (spotlight credits, email credits, sponsorship added, guide unlocks). The privacy policy names it beside the conference counter.

---

## 5. Awards (BEHIND A COMING-SOON SCREEN, 7 Sep 2026)

**Current state, read this first.** Awards are hidden from organisers. Nothing was
deleted and no data was touched:

- Manage → **Settings → Awards** renders `settings/awardsComingSoon.tsx`, a holding
  screen. The real configuration UI is still `settings/awardsUi.tsx`, on disk and
  unrendered; re-enabling it is one import plus one render line in
  `settings/page.tsx` (the comments there say exactly which).
- The standalone secretariat desk is retired. `/manage/[slug]/awards` now redirects
  to `/manage/[slug]/settings?tab=awards`, so bookmarks do not 404, and the desk
  itself is preserved unrendered as `manage/[slug]/awards/AwardsConsole.tsx`. Its
  rail entry (POST CONFERENCE / Awards) is gone, as are the two links that pointed
  at it from the organiser scoreboard and the Live modal.
- **Awards is no longer a set-up priority.** It was removed from the dashboard
  checklist (`manage/[slug]/page.tsx`, 9 rows → 8), from `conference_setup_status()`
  in the database (`setup_total` 9 → 8, it is `jsonb_array_length(v_items)`), from
  `SETUP_STEPS` in `admin/ConferencesTab.tsx`, and the `setup_total` fallback in
  `admin_conference_overview()` moved from 9 to 8. Because the organiser nudge
  emails build their "STILL TO DO" list from `conference_setup_status().items`, no
  organiser is nudged about awards any more (137 active conferences, 134 organisers,
  stopped). The blue checkmark is untouched: `awards` was never in `v_ver_keys`.
- Everything below still describes the feature as built, and everything below is
  still true of the database. `conference_awards`, `conferences.awards_config`,
  `awards_published_at`, the RLS policies and every RPC are intact. Awards already
  published stay published: they are still on the public honour roll, still on
  `MyAwardsCard`, still on `/account/cv`. The chair-side `AwardsCard` and the
  session signposts (`resolveChairAwardsHref`) were left alone deliberately, since
  they are participant surfaces and only matter at a conference that already has
  awards configured.

Model UN awards are given once per conference, at the closing ceremony. Per committee the dais names a Best Delegate, usually one or two Outstanding Delegates, a few Honourable Mentions, sometimes Verbal Commendations and a Best Position Paper. The secretariat sets categories and quotas beforehand, collects each committee's slate, ratifies it and announces. Delegation awards go to a school or society, tallied from committee honours.

Gavelling mirrors that exactly. Read `src/lib/awards.ts` (the vocabulary and config) and `src/lib/awardsService.ts` (every read and write) first.

| Step | Surface | Storage |
|---|---|---|
| Configure categories, quotas, points, deadline, ratification | Manage → Settings → **Awards** (`settings/awardsUi.tsx`, currently replaced by the coming-soon screen). There is no longer a dashboard checklist item for awards. | `conferences.awards_config` (jsonb; empty = platform defaults) |
| Chair nominates, with the session scoreboard as evidence | the chair's conference page, `participant/AwardsCard.tsx` (`/conferences/[slug]/role/chair`) | `conference_awards` rows, `status = 'nominated'` |
| Chair submits / withdraws | same card → `submit_committee_awards` / `withdraw_committee_awards` | `conference_committees.awards_submitted_*` |
| Secretariat approves / returns with a note / edits / assigns delegation awards | `manage/[slug]/awards/AwardsConsole.tsx` (unrendered; the route redirects to Settings) | `awards_approved_*`, `awards_return_note`, rows → `approved` |
| Publish (the ceremony) | same page → `publish_conference_awards()` | rows → `published`; one `gavelling_verified` `mun_cv_entries` row per recipient per conference; `conferences.awards_published_at` |
| Delegate sees it | `participant/MyAwardsCard.tsx`, `/account/cv`, public honour roll `/conferences/[slug]/awards` | RLS: only `published` rows are readable outside the dais and the organising team |

Rules:
- **Awards only on conference-linked sessions.** The live session signposts (`ScoreboardPanel` header, the End View card) only when `committee.sessionOrigin === 'conference'`. No award UI in anonymous sessions, ever.
- `award_type` keys are stable identifiers; labels are presentation. `DEFAULT_AWARD_TYPES` point values are unused: points are retired and `award_points_for()` no longer exists.
- Nothing about a nomination is visible to a delegate before `publish`. Do not add a read path that bypasses the `conference_awards` RLS.
- The chair's decision is qualitative; the scoreboard is evidence. "Suggest from the record" fills empty slots and is always editable.
- `CONFERENCES_PRD.md` rule 11 ("ratings and award badges are not in scope") is about badges on directory cards, not this feature; Part 7 of the same PRD mandates it.

---

## 5b. The verified checkmark

One seal, the one social media uses (`src/components/VerifiedCheck.tsx`). Blue means verified, grey means not yet. Two things carry it:

- **A conference** is verified automatically once every set-up stage is done: page, committees with enough seats, chairs, emails explored, secretariat, a payment method, published. The **secretariat** stage is a union of three routes: a second organiser, a pending co-organizer invite, or `conferences.solo_secretariat_ack_at` being set. That third route exists because the stage used to require a second person, which made the checkmark unreachable for the 167 conferences genuinely run by one organiser. It is stamped only when the organiser says so, from the dashboard checklist row or the Settings → Organizers tick, and it is reversible from Settings. The checklist has exactly these 7 stages (`setup_total` 7), all of them verification criteria. "Get your first delegate" (removed 8 Sep 2026) and "Set up awards" (removed when awards went behind the coming-soon screen) were the two former non-criteria. The truth is `conference_setup_status()` in the database (`scratch-setup-status.sql` is a reference copy), which also reports minutes per stage and `verification_minutes_left`. `refresh_conference_verification()` stores the mark (dashboard calls it; cron sweeps hourly); a guard trigger rejects any direct write to `conferences.is_verified`. Public surfaces show the seal only when verified. The organiser's own screens (manage rail, dashboard) always show it, grey with "About N minutes to your checkmark" until earned.
- **An MUN CV entry** is blue when `source = 'gavelling_verified'` (written by the awards pipeline), grey when self-reported.

Reminders: `queue_checkmark_emails()` (cron 10:30 daily) sends one "N minutes from its checkmark" email per organiser per conference, a follow-up after two weeks, and a congratulations when the mark lands, all through `email_outbox` and paced 48h from the organiser drip. `SetupReminderGate` (root layout) shows the same list once a day when an organiser with an unverified conference enters the site, via `my_incomplete_conferences()`.

**Sign-up asks first (18 Sep 2026).** `/auth/signup` shows nationality and date of birth
ABOVE "Sign up with Google" and refuses both ways of signing up without them (same rules as
onboarding, `validateBasics` in `src/lib/pendingBasics.ts`). For Google the confirmed answers
ride through the round trip in a 30-minute first-party cookie (`gv_pending_basics`, SameSite
Lax); `/auth/callback` writes them into the new profile (only empty columns, only for an
account created after the answers were given) and clears it, and `/auth/onboarding` retries
from it if that write did not land. "Sign in with Google" clears it and still asks nothing
before signing in, so a brand-new account made from the SIGN-IN page still meets the
unskippable basics screen in onboarding and this gate. Invite pages link to one of those two.

`CompleteBasicsGate` (root layout, 11 Sep 2026) is the backstop for accounts with no
nationality or date of birth. Google sign-up creates the account before anything can be
asked, and a user who closes the onboarding tab used to stay blank forever (1,777 of 2,627
profiles had no nationality). On the next visit a signed-in user missing either field gets a
modal that cannot be dismissed (Sign out is the only exit). Nationality is prefilled from
`/api/geo` (Vercel's IP-country header, never a third-party lookup) and shown as a guess the
user confirms with one tap, because location is not nationality. Nothing is ever written
without that tap, and nobody was backfilled. It stays off `/auth/*`, legal pages, apply
paths, `/account/profile` and every live-session route (a chair must never get a modal over
a running committee). It publishes its state through `src/lib/basicsGateState.ts` so
`CreditsWelcomeGate` and `SetupReminderGate` never open on top of it.

**Log in / sign up is a pop-up (18 Sep 2026), Airbnb's exactly, in green.** `src/components/auth/AuthModal.tsx`
(steps), `authModalKit.tsx` (white surfaces, floating-label fields, the green gradient button, KIT_CSS) and
`AuthQuestionnaire.tsx`, mounted once in the root layout, opened by `openAuth({ next?, step?, email?, apply? })`
from `src/lib/authModal.ts` (or `<AuthLink>` for links). First screen: X, gavel mark, "Log in or sign up",
one Email field, Continue, "or", a square Google tile (no Apple). Continue asks the SECURITY DEFINER RPC
`auth_email_status(email)` (`new` | `password` | `google` | `invalid`; it discloses whether an address has an
account, a trade-off the owner approved) and the dialog moves to the password step, a "signs in with Google"
step, or "Finish signing up" (name, date of birth, nationality, password) then the 6-digit code. A new
account (made here, or under a day old with no `education_level`) then gets the /auth/onboarding
questionnaire as four steps in the same pop-up (same writes: `education_level` (`high_school` | `university` | `both`,
plain text, no CHECK), `mun_countries`, `mun_experience_level`, `mun_cv_entries` via CVEntryModal). Since 23 Sep 2026
the first three are REQUIRED (Continue disabled until answered; no X, Escape or backdrop until the MUN CV step, with
Sign out in the header as the only exit) and only the MUN CV step can be skipped; /auth/onboarding follows the same rule. Google and email links return through
`/auth/callback?via=modal` to the page the visitor was on (never `/auth/onboarding`), with `?auth=finish` when
basics are missing or the account is new; the basics step is non-dismissable (Sign out is the only exit).
`/auth/signin`, `/auth/signup` and `/auth/forgot` only redirect to `/?auth=...&next=...`; redirect guards
still go through them. While the modal is open `CompleteBasicsGate` stands down and `useBasicsGateBlocking()`
is true, so no two modals stack.
Since 19 Sep 2026 it is the "Wall" split (owner picked mockup 1): from 860px wide a 400px image panel on
the LEFT on every step and the form on the right (880 x at least 560, radius 24, left-aligned brand and
heading, a one-line intro, a Terms line under the Google tile); below 860px the single 480px column, and
the full-screen sheet on phones. The image is ONE file, `public/auth/side.webp` (`AUTH_SIDE_IMAGE` /
`AUTH_SIDE_ALT` in `authModalKit.tsx`, `object-fit: cover`, top-anchored, supply 800 x 1120 or larger);
today it is a render of the mockup's wall, to be replaced by the owner's artwork.

**On a phone it is a sheet, not a squashed dialog (19 Sep 2026, owner: "the registration / log in
pop-up is not made for phone").** Below 744px the same artwork is a HERO band across the top
(`object-position` crops it to landscape; the picture is still one file) and the white form sheet has a
rounded top edge, a grab handle and overlaps it. The hero is sized so the sheet is about as tall as the
step it holds (30svh on the first screen, 50svh on the short ones, gone on the long ones: Finish signing
up, the basics and the questionnaire, where the form scrolls and the primary button is sticky above the
safe area). Google is a full-width outlined button with its label (`.gv-social-label`, the square tile is
the desktop idiom); fields are 58px and 16px, so iOS never zooms; the X and back are 44px; the first
screen's X is a glass disc on the picture. Real-phone rules: dvh/svh only, `env(safe-area-inset-*)`
padding, and AuthModal publishes the VISUAL viewport as `--gv-vvh` / `--gv-vvt` (rAF-coalesced, cleared
on unmount) which the sheet's height and top read, so the on-screen keyboard cannot cover the focused
field or the action; a `focusin` listener scrolls the tapped field into the middle of the sheet. Under
600px tall (landscape, keyboard up) the hero goes and the sheet is all form; from 744px up NOTHING
changed, and a short window there only loses the dialog's padding (`min-width:744px and
max-height:480px`). The steps are told apart in CSS by `data-step` / `data-hero` / `data-cta` on the
panel.

## 5c. Custom (parliamentary) committees

`committee_type = 'custom'` is the fourth type: seats are members of groups (political groups, parties, benches) rather than countries. Groups live in `conference_committees.groups` (jsonb), a seat's group in `committee_country_slots.group_id`, and a seat or a group can carry a crest (`logo_url`). `src/lib/slotGroups.ts` is the contract: `effectiveSlotArt` decides what a seat draws (own crest, group crest, national flag, fallback), `loadSlotArtIndex` serves surfaces that render many seats, and `PARLIAMENT_PRESETS` seeds the usual chambers. Every flag renderer that matters goes through `FlagImg` or the assignment board's `CountryFlag`, both of which accept `logoUrl`. Debate, allocation and sessions are unchanged; only the seat's identity and picture differ.

---

## 5d. Stated intent (what the organiser came here to do)

A secretariat arrives with one job in mind. Some want applications and allocations, some
only want to run the rooms on the day, some are here because their payment provider is a
spreadsheet. The creation wizard asks which, on the step before the review screen, and the
answer shapes what we lead them with afterwards.

- **Contract:** `src/lib/conferenceIntent.ts` is the only definition of the six options
  (`applications`, `payments`, `committees`, `emails`, `chairs`, `marketing`), their copy,
  their admin labels, and the `boosts` that map each one onto dashboard checklist keys.
  Never write a second option list.
- **Storage:** `conferences.intent` (jsonb, NOT NULL, default `'{}'`), shape
  `{keys, other, answered_at, skipped}`. Three states must stay distinguishable: `'{}'` is
  never asked (every conference created before this shipped), `skipped: true` is asked and
  declined, a non-empty `keys` is answered. The follow-up email depends on that distinction.
- **Asked before the insert, and required.** It is step 8 of 9 and the answer rides along
  in `insertRow` as `intent: intentPayload(keys)`, so there is no post-create UPDATE to fail
  and nothing exists yet that a failed write could cost anyone. It was briefly the other way
  round, asked after creation to protect against exactly that; requiring it up front removes
  the risk instead of mitigating it. Continue is disabled until at least one option is picked
  and `readyToCreate` enforces it, so the wizard can no longer produce `skipped: true` at all.
  The Settings editor still can, by clearing every option, which is why the three states below
  still matter.
- **The wizard around it (24 Sep 2026).** 9 steps: 1 Your conference (name, acronym, logo,
  banner, dates, one page with a live preview, `conferences/new/IdentityStep.tsx`), 2 format,
  3 level, 4 where, 5 expected delegates, 6 committees, 7 description + socials, 8 intent,
  9 review. Step 6 opens the organiser dashboard's own `CommitteeEditorModal` in DRAFT mode
  (`draft` prop: Save hands the committee back, no chairs section, nothing written until
  Create conference). Any change to that pop-up shows in both places.
- **Intent reorders, it never removes.** `intentRank` sorts the dashboard's *pending*
  checklist rows only. `doneCount`, the ring, the progress bar and `SetupCompletionNotices`
  all keep reading the full unfiltered checklist so they cannot disagree with it, and
  `publish` stays pinned last. Dropping a row would be a real bug: `financials` gates both
  the blue checkmark (`conference_setup_status()`) and publishing itself
  (`enforce_conference_publish_payment_gate`), so hiding it yields a conference that cannot
  publish and cannot be told why.
- **Follow-up email:** `queue_intent_followups(p_preview)`, cron `intent-followups` at
  09:45 daily, via `email_outbox`. Three weeks after creation it reports which of the things
  they asked for are actually live and links the ones that are not. It fires on its own
  clock rather than as a `send-setup-nudges` milestone, because that function's DRAFT and
  PUBLISHED tracks restart on publish and its 72h gap would swallow a day-21 email.
  Deduped by `conference_setup_nudges` cadence `intent`, variant/milestone **200** (a free
  band: -7..-1 run-up, 1..30 draft, 60..62 checkmark, 100..130 published), with the
  once-ever guarantee resting on the `conference_setup_nudges_milestone_once` partial index
  rather than on the query. The window is 21 to 28 days, not exactly 21, so one missed cron
  run does not lose the email. It is gated on a non-empty `keys`, which is why the first run
  emailed nobody: no conference that predates the feature can ever qualify.

---

## 5e. "Your room is live" (22 Sep 2026)

The moment a signed-in person lands on the site while one of their conference rooms is live,
`LiveRoomsGate` (root layout, `src/components/liveRooms/`) sends them straight in: an
**organiser** to `/manage/[slug]/live` (how many committees are live and in session), a
**chair** straight onto the dais with no chair code at all (`enter_live_chair_room` decides at
press time: "Start the session" for the first chair in, "Join as co-chair" for the next, and the
card shows who is already on the dais and how many delegations are present), a
**delegate** to their allocated seat (`/delegate/CODE?country=...&locked=1`, round country
flag as the headline), and a **faculty advisor** (accepted / assigned / checked-in application;
owner: "put in a note for faculty advisors to have the pop up as well") to the advisor board
`/advisor` as ONE entry per conference, "Follow your delegation", with how many of their students
sit in live rooms (24 Sep 2026; it used to be one entry per room, to `/advisor/CODE`). One prompt
at a time, organiser > chair > delegate > advisor; several
entries are a compact list. "Not now" lasts for the page visit; it stops by itself when the
conference ends or the room ends. The same rooms stay under "Live now" in the profile menu.
Source: `my_live_rooms()` (caller's own rows only, never the chair suffix). It never opens on a
live session route, /join, auth or apply paths, and never over another gate. On /sessions it
also carries the standalone rejoin. Rules in AGENTS.md, "Your room is live".

**Faculty advisor board (24 Sep 2026).** `/advisor` shows a teacher where each of their students
is in the speaking queue across many committee rooms: rooms added by session code are followed on
THIS device (nothing stored server-side), and a signed-in conference faculty advisor, head
delegate or observer gets their conference filled in with nothing typed. That comes from
`my_advisor_delegation()` (SECURITY DEFINER, `search_path = public, pg_temp`, EXECUTE for
`authenticated` only, revoked from PUBLIC and anon), read by `useMyAdvisorDelegation()`
(`src/lib/advisorDelegation.ts`, keyed on the user id, one read per account per page load,
`reload()` to retry). It returns, per conference where the caller holds an `accepted` /
`assigned` / `checked-in` application as `faculty-advisor`, head delegate (`role =
'head-delegate'` or `is_head_delegate`) or `observer` (one role per conference, in that order):
the conference (id, full name, acronym, logo, slug, dates), `myRole`, the society name, `seats` =
every allocation of the caller's OWN society (linked through the allocation's application's
`society_id`, or `conference_allocations.society_id` for a delegation block seat; withdrawn /
rejected students left out) with the session code, committee, country, seat, the student's
display name (else the invite name) and role, and `rooms` = every committee of the conference
that has a session. Observers get rooms and no seats; an advisor with no society on the
application falls back to `societies.advisor_user_id`. Never another society, never an email, a
student's user id or anything from `committees.settings`. No points, no rank on the board;
reminders are in-app only (nothing here sends email).

**Two views (24 Sep 2026, owner).** A segmented control at the top (`ViewSwitch` in
`src/app/advisor/board/AdvisorBoard.tsx`, radiogroup, arrow keys, remembered per device as
`BoardPrefs.view`, default `queue`): **Up next** is ONE speakers list across every followed student
in every room, ordered by `queueRank` (`src/lib/advisorBoard/derive.ts`): speaking now, then next,
then N speakers ahead ascending (ties by committee), then in the room, then "Needs a look"
(absent), then rooms not in session, the last three under quiet dividers. Each row (`SeatRow` in
`board/SeatCard.tsx`): the place in the room's list as the chair's sidebar numbers it (#1 = the
floor, a mic disc), the round flag, the student's name (or the country) with the country, the
committee acronym (full name as tooltip) and what the room is doing, and WHEN in plain words with
the ticking clock or estimated wait. **By committee** groups the same rows under one header per
room (acronym large, full name beneath, the room's mode and who holds the floor with their clock),
rooms where a student speaks soonest first, rooms not in session last. Tapping a row opens the
StudentSheet. **The single-room view `/advisor/[code]` was removed the same day**: it redirects to
`/advisor?add=CODE`, and nothing on the board links to a room.

---

## 6. Where things live

```
src/app/
  (sessions)   create, join, chair/[code], delegate/[code], advisor (the board; advisor/[code] only redirects to it), voting/[code]
  (public)     /, sessions, about, contact, blog/*, [slug] (vanity), conferences/{explore,map,roles,[slug]/*}
  (participant) conferences/[slug]/{apply,pay,role/[role],papers,awards}, delegation/[societyId], my-conferences, drafts/[token], invites/*
  (organiser)  manage/[slug]/{committees,applications,assignment,documents,communications,financials,financial-aid,settings,jobs,import,live,scoreboard,awards*}   (*awards = redirect only)
  (account)    account/{profile,cv,calendar,unlimited}, auth/*, cv/[id]
  (staff)      admin
  api/         ambassador, contact, geo, indexnow, emails/queue-participant, og/*
src/lib/
  sessions     types.ts, committeeService.ts (all session DB I/O + realtime), scoring.ts, sessionScoreboard.ts, settingsStore.ts, committeeFlags.ts, docNames.ts
  conferences  conferenceAccess.ts, conferenceScoreboard.ts, awards.ts, awardsService.ts, slotGroups.ts, conferenceIntent.ts, finance.ts, payments.ts, invoices.ts, emailEvents.ts, defaultEmails.ts, organizerPermissions.ts, publicFees.ts, seo.ts, vanity.ts, conferenceSlug.ts, conferenceAliases.ts
  shared       translations.ts (4 locales), countries.ts, supabase.ts (anon), supabase-auth.ts (getAuthedClient), sessionClient.ts (chair suffix header)
src/components/ neu.tsx (design tokens), DatePicker, Portal, SiteNav, ScoreboardTable, ScoreboardPanel, MotionsModal, DocumentsModal, RollCallPanel, ChatPanel, SettingsPanel, FeedbackLogPanel, TutorialOverlay, GuidedWalkthrough
```

**State, honestly:** the chair page is React state + `committeeService` + a Supabase Realtime channel, with `useSettingsStore` (zustand, `localStorage: gavelling-settings`) for per-committee settings. `src/lib/store.ts` (`useCommitteeStore`, `localStorage: mun-committees`) is legacy with no live importer (the join page stopped reading it on 14 Sep 2026, J-1: nothing writes it, so a hit could only be an old roster or chair code); `SpeakersListPanel`, `CaucusPanel` and `ResolutionsPanel` import it but are themselves unreferenced. Realtime on the chair, delegate and voting pages goes through `startSessionSync` (`src/lib/sessionSync.ts`; AGENTS.md RULE 4). The conferences layer uses no zustand at all: React state, `useAuth()` from `AuthProvider`, `getAuthedClient(session.access_token)`, and `useManage()` from the manage layout.

**Database:** there is **no `supabase/` directory and no migrations in git**. The schema lives only in the remote project; the loose `scratch-*.sql` files at the root are drafts, not truth. Inspect with the Supabase MCP tools before assuming a column exists. RLS is the security boundary everywhere; `isViewOnly`, section permissions and hidden buttons are not.

**Storage cleanup:** deleting a **conference** committee takes its CHAT attachments out of the `session-documents` bucket and leaves its submitted documents alone. Chat lives under `chat/<committee_id>/`, documents at the bucket root under `<committee_id>/`, and the cleanup only ever touches the `chat/` prefix. A BEFORE DELETE trigger queues the id in `chat_cleanup_queue` (conference rows only, RLS on with no policies, service role only) and the `cleanup-chat-attachments` edge function drains it hourly on pg_cron (`10 * * * *`). Rules and limits in AGENTS.md → FEATURE: CHAT → Attachments and GIFs.

**Email:** nothing sends inline. Every email is an `email_outbox` row (rendered by a DB trigger, delivered by the `send-emails` edge function via Resend). Add an event to `EVENT_REGISTRY` in `emailEvents.ts` and TypeScript forces a category and a default body.

**Cron-only edge functions carry a DB-held secret (24 Sep 2026).** The anon key is public, so an edge function that sends must not trust it. `public.internal_secrets` (RLS on, no policies, no grants to anon / authenticated / service_role) holds `cron_edge_secret`; `verify_internal_secret(name, value)` (SECURITY DEFINER, EXECUTE for service_role only) checks it. pg_cron puts it in an `x-cron-secret` header built by a subselect in the job command (`'x-cron-secret', (select value from public.internal_secrets where name = 'cron_edge_secret')`), and the function verifies it with its service-role client, failing closed (403). Applied to `send-setup-nudges` v14 (cron `organiser-setup-nudges`): the live run and `dryRun` need the header, and `previewTo` is honoured only for exactly petizakhar@gmail.com (it used to email any address: an open relay). Rotate by updating the row; nothing else changes. `send-emails` is deliberately NOT gated: the app kicks it from browsers after queueing (`triggerEmailDelivery`, 8 call sites), it reads no request body and only drains rows already queued. `preview-setup-nudges` is a 410 stub and `send-setup-nudges-v2` only ever writes to the owner.

**Essential confirmations are ON unless an organiser turned them off (24 Sep 2026).**
`ESSENTIAL_DEFAULT_ON_EVENTS` in `emailEvents.ts` (application_received, application_accepted,
application_rejected, allocation_assigned, payment_received, co_delegate_assigned): a MISSING
`email_templates` row means ON. `queueEventEmail` writes the enabled stub the first time the event
fires (so outbox rows keep their template_id), Communications shows it as "On: sends our default" and
its toggle writes an explicit OFF row (`turnOffDefaultEmail`). Nothing was backfilled (enabled rows
count toward the "Explore emails" checkmark stage), rows that exist with `enabled = false` are
honoured, and only future events send.

**Double delegations (24 Sep 2026).** The allocation email adds a "Your co-delegate" facts row (name +
email, or "Not assigned yet") for a seat of capacity 2 (`allocation_co_delegates`, organisers +
service role). When a partner is announced AFTER the first holder was told, the AFTER UPDATE trigger
`conference_allocations_co_delegate_notice` (`notify_co_delegate_on_allocation_sent`, fires on
allocation_sent false→true) emails the first holder `co_delegate_assigned`, once per pair
(`co_delegate_notices`), honouring an explicit OFF template and `notify_email_applications`; its copy is
a SQL mirror of `defaultEmails.ts`. Participant side: `participant/CoDelegateCard.tsx` via
`my_co_delegates(conference)` (caller's own seats only). Sharing the partner's email with their
co-delegate is the owner's decision.

**Allocation emails have two switches, and the template's OFF wins (23 Sep 2026).**
`conferences.allocation_email_auto` (Assignment → "Sending automatically" / "Manual
release") decides WHEN `allocation_assigned` is raised; the `email_templates` row's
`enabled` (Communications) decides WHETHER it sends at all. An explicit off makes
`queueEventEmail` answer `'off'` and queue nothing, silently, and `allocation_sent`
stays false. SISMUN had auto on and the template off, so 138 seated delegates were
never emailed while the bar said "Sending automatically". The Assignment bar
(`AllocationEmailBar templateOff`) now reads the template and says "Switched off"
with a Turn on button (`turnOnDefaultEmail`: future seats only, it queues nothing for
anyone already waiting; the backlog is SEND → All new, the organiser's call).
`email_templates.updated_at` has no trigger and the Communications toggle does not
bump it, so it cannot tell you when a template was switched off.

**Emailing "everyone" reaches people who have never registered, and that is
deliberate.** A recipient's address is `profiles.email ?? invited_email`, so an
imported or invited applicant who never made an account still gets the email.
They also pass every consent check: `recipientAllowsCategory` returns true when
there is no `profiles` row (`emailEvents.ts:211`), because there are no
preferences to honour yet. Roughly 157 unclaimed applicants are in that state.

Know what that means before writing a broadcast. These people never chose to
hear from the platform; an organiser uploaded their address. Their only
protection is the global unsubscribe list, which the `email_outbox` trigger
checks (`email_is_opted_out` suppresses the row before it is rendered), so the
unsubscribe link in the footer is doing real work and must never be removed
from a broadcast. Treat "everyone" as including strangers, and write it
accordingly.

**Pre-registrant credit campaign (23 Sep 2026).** cron `prereg-credit-campaign` (every 10 min) runs
`queue_prereg_credit_campaign()`: it waits until no "A thank you, and one change from us" row is pending
or held, then queues at most `120 - rows inserted in the last 10 min` (cap 100) emails per run from
`email_campaign_templates` (`prereg_credits_1` "Your 2 Gavelling credits are waiting", `prereg_credits_2`
"Still yours" 7 days later) to `pre_registrations` addresses with no account and not opted out, logged
once per address and stage in `prereg_campaign_sends`. CALLING IT SENDS once the broadcast is done. Stop:
`select cron.unschedule('prereg-credit-campaign');` Both stages skip `email_address_failed()` addresses
(24 Sep 2026). On 23 Sep 22:50 one `…@example.com` pre-registrant 422'd a whole Resend batch of 100;
the 99 real addresses were re-queued on 24 Sep (~03:50 UTC, `prereg_campaign_sends.outbox_id` and
`queued_at` moved to the new rows, so stage 2 counts 7 days from the resend).

**send-emails v17 (24 Sep 2026, Supabase version 18): one bad `to` can no longer sink a batch.** Before batching it fails,
individually, any recipient that is malformed, non-ASCII or on a reserved placeholder domain
(`example.*`, `*.example`, `*.test`, `*.invalid`, `*.localhost`), and if Resend still answers 422 for
the batch it re-sends each row alone (600 ms apart, 100 s budget, a 429 or the budget hands the rest
back to `pending`), so only the guilty row fails. Every address-level error text starts with
"Invalid recipient address", which is what `outbox_error_is_address_level()` keys on: keep it.

**Founder welcome email v2 (25 Sep 2026).** `queue_founder_welcome_emails()` (cron `founder-welcome-emails`, hourly at :25) sends every new account, 24 to 48 hours after sign-up and once (`founder_welcome_sent`), the email rendered by `founder_welcome_render(first, email)`: "Thank you for joining Gavelling", three alternating image/text rows (running a conference: the verified check; chairing: the laptop; joining: the phone and Explore near you), then the free welcome credit and what it is for. It no longer mentions the $1 price (owner). Images are `session-documents/email-assets/welcome-v2-{hero,organiser,chair,delegate,credit}.png` (rendered from the site's own device shots). No claim of a delegate-count increase is made: there is no data behind one.

### STOP ALL EMAIL

```sql
select public.email_pause('why you stopped it');   -- nothing leaves, no deploy needed
select public.email_resume();                      -- everything held goes back to pending
select * from public.email_sending_paused;         -- is it paused, who paused it, why
select status, count(*) from email_outbox group by 1;
```

Paused parks every new and every waiting row as `held`, keeping `send_after`;
`send-emails` only ever claims `pending`, so the brake works from the SQL editor
with nothing to deploy. Resume puts them back with their `send_after` intact, so
a scheduled release still fires at its own time. Suppressed rows (unsubscribed)
are never released. The one exemption is the burst alarm's own email to the
owner, which must still get out to say what happened. See
`scratchpad/cardv2/30_email_emergency_stop.sql`.

`email_burst_check()` runs every 5 minutes: over 150 outbox rows DUE in 10 minutes
(counted by `coalesce(send_after, created_at)`, between the window start and now, so
a campaign queued for later counts when it comes due, not when it was written) it
writes an `email_burst_alerts` row and emails the owner once, naming the subjects
and conferences; over 600 it also calls `email_pause`, so a runaway stops itself
and a human restarts it.

### Never more than TWO emails to one address in any rolling hour (23 Sep 2026)

Owner's hard rule, enforced in the database so every sender (SQL crons, edge
functions, the app) obeys it. `email_outbox_rate_cap_t`, a BEFORE INSERT trigger
(`email_outbox_rate_cap()`, SECURITY DEFINER, migration
`email_outbox_two_per_hour_cap`), named so it fires AFTER
`email_outbox_fill_body_html_t` and `email_outbox_hold_when_paused_t` (BEFORE
triggers run in name order) and so sees the final recipient and status:
- Counts the address's rows (`lower(recipient_email)`, status pending / held /
  sending / sent) by their effective time `coalesce(send_after, created_at)`. If
  this row would make three inside one hour, `send_after` is DEFERRED to 61 minutes
  after the earlier of the conflicting pair (the extra minute is drain slack), and
  re-checked until it fits. Never dropped. `send-emails` only claims rows whose
  `send_after` is null or past, so a deferred row simply waits.
- Deferral is always possible in practice; after 500 attempts the row is `held`
  with an `error` saying so (and `email_resume()` would release it: check first).
- Exempt: the owner's alarm (`petizakhar@gmail.com` with the `email_alert_prefix()`
  subject), and rows that are not pending / held (suppressed). Auth codes do not go
  through the outbox (Supabase Auth sends them).
- A per-address advisory lock serialises concurrent inserts; index
  `email_outbox_recipient_time_idx`. Existing rows were NOT rewritten.
- A bug in the cap fails OPEN (a warning, the row is inserted unchanged), so it can
  never stop email altogether.
- What this means for a broadcast: an address already sent two emails in the last
  hour gets the broadcast later, not never. Scheduled waves (e.g. KenyaMUN's session
  codes at one instant) still land together as long as each address gets at most two.
- Verified in a rolled-back transaction: five inserts to one test address gave
  now, now, +61 min, +61 min, +122 min; three alarm rows to the owner all stayed
  immediate.

**Inbox "waiting on your reply" and the contact form (23 Sep 2026).** The manage
rail's Communications badge counts threads WAITING ON A REPLY
(`manage/[slug]/communications/waitingOnReply.ts`: open, not a swap notice, newest
message from the participant); reading a thread no longer clears it, answering or
closing it does. Inbox rows show "Waiting 3 h". A `/contact` message that names a
conference (acronym as a whole word, full name or slug) the sender's ACCOUNT has
applied to, and exactly one such conference, is also filed in that conference's
inbox by the AFTER INSERT trigger `route_contact_submission_to_conference_t`
(metadata `source: 'contact_form'`, `sender_label` = the typed address, first line
says the address is unverified). The message's `sender_user_id` is NULL (24 Sep 2026;
the column is nullable for this alone, and the insert policy still requires a real
sender): the typed address is a label, never the account that owns it. Organisers
see it as "<address> (unverified)"; the account owner still sees the thread and the
reply but not the unverified message (read policy). The team alert is unchanged. It
inserts no email.

### AGENTS NEVER CALL A LIVE SENDING FUNCTION TO TEST ANYTHING

**Whatever the argument is called.** Testing is a rolled-back transaction
(`begin; select ...; rollback;`) or a send to the owner's own address, and
nothing else. Before calling anything that can write `email_outbox`, read its
body and find the line that skips the insert. If you cannot point at that line,
you are about to send.

Why this rule exists: on 23 Sep 2026 an agent called
`queue_checkmark_emails(null, true)` believing `p_preview` meant dry run. It did
not: it prefixed the subject with `[Preview]` and sent anyway. **440 emails
reached 424 organisers across 272 conferences** before anyone noticed, and
nothing could be recalled. The flag has since been fixed to insert nothing and
return counts plus a sample, and every other preview flag was audited (the rest
were already honest). Nineteen senders have **no** flag at all
(`queue_organizer_reminder_emails`, `queue_request_digest_emails`,
`queue_study_guide_release_emails`, `queue_chair_session_reminders`,
`compose_daily_platform_report`, `admin_email_conference_organisers`,
`mark_invoice_paid`, `settle_invoice_effects`, `review_payment_batch` and
others): calling one of those always sends, immediately, to real people.

---

## 7. Sessions runtime in one screen

- `Committee.speakersList` is the General Speakers List: permanent, never touched by a caucus. `caucusQueue` is temporary and wiped when the caucus ends. `currentSpeaker` is its own row and is never in either list.
- `SessionPhase`: `pre-session → roll-call → speakers-list → moderated-caucus | unmoderated-caucus → voting → adjourned`. `CaucusState` is a JSONB column on `committees`.
- Motions sort by `disruptiveness`, configurable per committee via `motionOrder`; end/suspend debate always outrank caucuses; custom motions sort last.
- Optimistic writes: `updateLocal()` first, DB write fire-and-forget. Incoming realtime echoes are ignored for **3 s** after a structural local write (`localUpdateTime`), with carve-outs for broadcasts, chat, feedback and the view-only Commenter, who never debounces.
- Timers are **clock-anchored**: persist `started_at` + duration once, every client derives the remaining time locally. There is no per-second write and there must never be one.
- `speakers_list.position` reorders happen in place (parallel `position` updates), never delete-and-reinsert, because a DELETE event flashes an empty list on delegate phones.
- Tables: `committees`, `delegates`, `speakers_list` (`list_type` gsl | caucus), `current_speaker`, `motions`, `documents`, `messages` (chat + the `__system__`/`__log__` scoring ledger), `feedback`, `session_broadcasts`.
- **Agenda (conference rooms with 2 or 3 topics).** Before roll call the Moderator picks the topic with big 1/2/3 numerals (`src/components/AgendaPicker.tsx`); it writes `committees.topic` and `settings.agendaTopicIndex`. Presence of the index means "chosen". The organiser editor's re-sync keeps the room's current topic text when it still exists. Single-topic and standalone rooms are unchanged.
- **Gavel knock.** `gavelSoundEnabled` / `gavelSoundAtSeconds` (default on, 15 s). A synthesised double knock (`src/lib/gavelSound.ts`, no audio file) plays once when a running countdown crosses the mark, on the Moderator's laptop only. `useGavelCue` is a read-only side effect of the timer values: rules 3 and 4 still hold.
- **Seats.** Conference rooms gate per seat: a seat with an allocation or invite is reserved for that person, every other seat is open to anyone with the code, and chairs use the chair code when nobody was invited to chair (organisers see it on the committees page only then). One person per seat through `delegate_seat_claims` and its RPCs. This stops honest collisions, not a hostile user: session writes still check only the session code. Details and limits in AGENTS.md.

Everything else, with line numbers and the reasons behind each rule, is in `AGENTS.md`.

---

## 8. Design system and copy

- Tokens in `src/components/neu.tsx`: ivory `#EDE7D8` page, `#F0EBDD` surface, forest `#1B3828`, gold `#EED98A`, ink `#1C1410`; shadows are forest-tinted, never neutral; `muted` fails contrast for body text, use `inkSoft`. The typeface is **Albert Sans** everywhere (24 Sep 2026), loaded ONCE by `next/font` in `src/app/layout.tsx` and exposed as `var(--font-brand)`: every `fontFamily` literal reads `"var(--font-brand), sans-serif"`, `font-mono` maps to it too (with tabular figures), and nothing else is loaded except Playfair Display italic for the gold accent word ("MUN done *right.*") and Noto Sans Arabic. Never name a family that is not loaded (the site named Outfit ~870 times without loading it, so every device showed its own system font). Schibsted Grotesk was tried the same day and dropped: its capital I carries serifs. `npm run check:text-overlaps` (`scripts/check-text-overlaps.mjs`, needs a running server, `-- --base=`) reports text that is clipped, truncated or overlapping ONLY with the brand font, against a system-font baseline, at 1440 and 390 wide. Tailwind v4 with no config file.
- Lucide icons only on the conferences side (Fluent 3D emoji are allowed on the organiser dashboard, and since 24 Sep 2026 on the pricing pages, the purchase pop-ups, Manage account and the help center, via `Emoji3D`). Flags come in two shapes and never mix: a **rectangle** uses `getFlagUrl` (Twemoji, 3:2 in a transparent square, so it can never fill a circle), a **circle** uses `src/components/CircleFlag.tsx` (`<CircleFlag code|country|art>` or the session `<SeatCircleFlag>`), which draws the square round-flag artwork bundled in `public/flags/1x1/` (circle-flags, MIT) so the flag fills the disc edge to edge, with crest → flag → monogram precedence. Never put a `getFlagUrl` image inside a `rounded-full` box. Every button gets `focus:outline-none`.
- **Buttons with an icon or an indicator lead with the icon** (owner, 17 Sep 2026): a big icon, the word small beneath it (e.g. Vote in Documents, Finish in an introduction). A button that is icon only still carries a tooltip and an accessible name.
- **No count or status pills like '15 delegations' or 'Observer' anywhere: show counts as plain typography and observer status as an icon.** (Owner, 17 Sep 2026. /create shows the count as a large tabular numeral and observers as the megaphone; the join seat picker shows seat state as icon + plain words.)
- **The logo is ALWAYS the image, never typed text (owner, 25 Sep 2026).** One logo everywhere: `/gavelling-lockup.webp` (.png fallback), gavel + wreath, GAVELLING, "The #1 MUN Ecosystem", 4:1. There is no Sessions or Conferences variant any more: `GavellingLogo`, `GavellingSessionsApp` and `Conferences` (.png / .webp) now hold the same artwork so old references show it, and `Brand` draws the image. Never set the word "GAVELLING" (or "Gavelling") in a font as a wordmark, never compose mark + typed name + a product eyebrow, and never generate a new logo file yourself. A square or round spot uses the gavel mark (`gavel-mark.png`, `markOnly`), never a crop of the lockup (public/README.md). Plain running text that merely mentions Gavelling is fine.
- **Never cut a name or a label off with "…" (owner, 25 Sep 2026, after it kept coming back: "delegation details like name get cut off with ... This is a common issue").** No `truncate`, `text-overflow: ellipsis` or `line-clamp` on a person's name, a delegation / school name, a committee name, a country, an email or any other identifying label. When space is short, use TWO ROWS instead, the way the allocation screens do: the short, important form large on the first line (an acronym, a first name, the key word) and the full text smaller on the line beneath, letting it wrap (`[overflow-wrap:anywhere]` so a long word or an email still breaks inside its box). The only acceptable ellipsis is on free text that is not an identity (a note, a message preview) and it must carry the full text as its `title`. Applies to every surface, organiser tables included.
- **No em dashes in user-facing copy.** Short sentences. Say what happened and what to do next.
- **Site chrome (25 Sep 2026).** ONE logo: the plain wordmark `public/gavelling-logo.png` through `src/components/BrandLogo.tsx` (`tone` ink / white / gold are CSS filters over that one file; it links to `/`); the "Gavelling Conferences" and "Gavelling Sessions app" lockups are retired (the file was deleted by mistake the day it was added and `BrandLogo` falls back to the old lockup until it is restored; drop the fallback then). ONE footer: `src/components/SiteFooter.tsx` (logo, Instagram, LinkedIn, the © line, then `FooterLegal`, whose links are dark ink and carry Help, Contact and About Gavelling) on every public page, the account area included; `LabFooter` and every inline footer are gone. The top nav reads, in sentence case, Start / Session (the small word stacked above, → `/sessions`), List your / Conference (→ `/conferences/new`), Explore, Pricing, Help (25 Sep 2026); the active item is ink with a short forest underline, Sign in is the forest gradient button. The `/create` chooser (`src/components/CreateChooser.tsx`) is no longer in the nav; Home is the logo, About and Contact live in the footer and the profile menu. ONE gold button: `src/components/GoldButton.tsx` (`GOLD_CTA_*` constants and `.gv-gold-cta`) is every gold call to action, the credits pop-up's PAY button included; `NEU_GRADIENTS.gold` stays for icon discs and progress rings only. The credits pop-up's panel green is `PANEL_GREEN` (`#0F3A28`, `purchaseKit.tsx`), the colour the Stripe Dashboard branding is set to, so the embedded form blends in. The organiser Job Board is gated "Coming soon" (`JOB_BOARD_LIVE` in `manage/[slug]/jobs/page.tsx`) until the public board opens.
- **The owner's taste rules (25 Sep 2026, after the pricing pages were rejected as "AI slop"; first enforced on pricing, the pop-ups, Manage account, the help center and the pay page, then across the whole site by prompt 54 the same day: every button label uppercase on the sessions landing and the homepage too, `t()` strings included).** No triads of short fragments ("$1 a credit · first one free · one per conference"), no "N things worth knowing" boxes, no explanatory captions under titles: one short title, at most one short plain line under it. Palette is ONLY forest, gold, cream/ivory and white (the tokens above); a title's LAST word is gold in the Playfair italic display face (`<GoldWord tone="light|dark">` in `src/components/BrandHeading.tsx`, the homepage's "MUN done *right.*" signature). Pages are never a flat cream field: green and white blocks, gold accents, green buttons. button labels were UPPERCASE on 25 Sep 2026 and are now SENTENCE CASE for new and redesigned work (see the taste-board bullets below; existing uppercase labels change only when their surface is redesigned); titles are Title Case. EVERY inline link is bold AND underlined. No full stop at the end of a title, a button or a one-line caption (a deliberate two-beat tagline may keep its stops). Every left rail (pricing tabs, help sections, the account rail) is sticky.
- **The owner's taste board (25 Sep 2026, 67 votes on real specimens; the board is https://claude.ai/artifact/9CDYVLCgb7h8apgaDPEyad). Overall direction, in the owner's words: "love airbnb!!! literally copy them".** Read these before designing anything; they are votes, not guesses.
  - **Surfaces:** plain ivory, or ivory with paper grain. NEVER a full forest band ("DEFINITELY NOT") and no ivory-to-white fade. A photo under a dark wash only sparingly.
  - **Cards:** white card with a soft shadow; photo on top with text below (Airbnb listing card); a glass card over a photo. NOT a forest card, a raised 3D (neumorphic) card, a pressed-in panel, or a flat hairline card.
  - **Icons:** duotone filled icons and Fluent 3D emoji. NOT bare thin or heavy outline icons, NEVER native emoji in text, NEVER a gold icon on a forest tile. An icon in a soft tinted disc is acceptable. A big icon stacked over a word as a button is NOT liked, but the small word under something is.
  - **Counts and indicators:** a big number with the word beside it ("LIKE A LOT") and icon + number are the way to show counts; a number with a sparkline, a coloured edge on a row, a word with a coloured underline are liked. NOT a count pill ("DEFINITELY NOT"), a status dot + word, an activity ring, segmented or signal bars, a placard tally, a rubber stamp or flip-board numerals. A half-circle gauge is only tolerated.
  - **Flags and names:** round flags and initials discs, never rectangles. Two-row names ("LIKE A LOTTT"): the short form BIG, the full text visibly smaller beneath; a plain wrap to two lines of equal size is not enough. An ellipsis on a name is "ABSOLUTELY NOT".
  - **Headings:** heavy sans, sans with the gold italic last word, a small capitals label above a heading. NOT all-capitals tracked headings, NOT a serif heading.
  - **Buttons:** nothing shown was loved (forest capitals pill: no; gold pill, outline pill, forest rounded square, gradient glow: "could be better"; near-black: meh). An underlined text link is liked; a text link with an arrow is not. Buttons are being redesigned in Airbnb's manner (see open questions).
  - **Inputs:** a label inside that floats up (the auth modal) or a label above a box. NOT underline-only or pressed-in fields.
  - **Lists:** roomy rows that read as cards. NOT dense tables.
  - **Feedback:** glass notification top right, spinner, grey skeleton shapes. NOT a forest bar at the bottom, NOT an inline banner in the page; the pulsing gavel loader is "a nice idea but could be better".
  - **Answered 25 Sep 2026:** pages are **ivory and white only**; forest is an accent (the main button, text, a small mark), never a band or a card background. This REPLACES "green and white blocks" above. The big-icon-over-word button rule STAYS ("I do like it now"), but its icons were "slightly weird": use duotone / filled icons there, not bare outline glyphs.
  - **Taste board two (25 Sep 2026, 36 votes, https://claude.ai/artifact/X9Lue9qkskg41q1z6GT78c).** Buttons: LIKED the Airbnb button (rounded rectangle, radius ~10px, SENTENCE CASE, a forest gradient left to right), an ink outline rectangle for second actions, a small icon then the word, a main button with an underlined link beside it, and the round forest search disc ("like a lot"). Coral: no, never. Gold, flat, soft-tinted, small-caps buttons: only tolerated. Tiles with a big icon over a word: DUOTONE icons, a forest line over a gold fill ("like a lot") or a pale green fill. Loaders: none of the gavel ideas (knock, sweep, ring) and three dots only tolerated. Colour: white ground, forest text, gold accents is the balance he likes. Type: price in bold with the role in grey; star + number with no pill. Scenes: YES to an Airbnb homepage search pill with a category rail, YES to a phone bottom tab bar (Explore, JOIN instead of Saved, Conferences, Inbox, Profile). NO to roomy card rows for applications ("definitely not"), to a white big-number dashboard, to an Airbnb filter modal ("a floating filter thing could be better"), to an Airbnb-style conference page (keep today's page, but take "run by" and the country flags). Conference cards: rectangles, not squares, and a flag on every card. A set-up checklist stays a list like today's.
  - **Taste board three (25 Sep 2026, https://claude.ai/artifact/HHtzZWT6bPBkp3vif7fUgV), mostly no.** "Do not change sessions": the chair console and the delegate phone are NOT to be redesigned (every console and phone idea was rejected). A conference card ALWAYS shows the conference's own logo ("no conference logo? wtf?"). Liked: a floating filter panel beside the explore grid; the MUN CV with a stats header (three big numbers) and a timeline of entries; an empty state that is one line plus one button; a "Point of order" 404; an award certificate. Rejected: letter boxes / ticket / pill for the join code, one-question-per-screen or step-rail or progress-bar apply forms, receipt and pass designs, a plain white email, confetti, bento grids, resolution-paper texture. Doodles only for blogs and informal pages; a forest/gold gradient mesh is "niche".
  - **Taste board four, real companies (25 Sep 2026, https://claude.ai/artifact/Q5WEk2qYtNsJWpCc9uEYMm).** Liked: Medium (a quiet reading column, for blog and guides), Notion (a calm document page with a cover and a sidebar, for handbooks and study guides), Strava (a person with stat blocks, for the MUN CV). Tolerated: Duolingo, LinkedIn, Revolut, Robinhood, Stripe pricing, Things. Rejected: every other company's homepage hero (Stripe, Apple, Wise, Vercel, Nike), Linear, Raycast, Attio, Figma cursors, GitHub grid, Discord, Instagram rings, Spotify, Arc, Headspace. Reading: keep Gavelling's own look and borrow calm reading and profile patterns, not another brand's landing page.
  - **Work in small steps (owner, 25 Sep 2026: "you are not doing a full redesign ... little changes for things and bigger if they are completely broken").** Apply these rules as targeted edits to existing pages. Rebuild a section only when it breaks a hard "no" (a forest band, an ellipsis on a name). The homepage was changed this way on 25 Sep 2026.
  - **Section size and rhythm (owner, 25 Sep 2026: "you make the parts so big for no reason, MyMUN does it pretty well with smaller sections").** A section is as tall as its content, never a full screen for its own sake (only a hero may be one viewport). Section padding about `clamp(40px, 4vw, 64px)` top and bottom; section titles about `clamp(24px, 2.4vw, 40px)`; one row of cards rather than two when one row says it (the homepage shows three guides, not six); explainer text is short (the What is MUN / What is Gavelling cards were cut by half). Stats are a slim bar, not a band. Carousels and media are sized down with the section, and every centring offset follows the width it centres.
  - **Overlapping devices, not fades (owner, 25 Sep 2026).** Liked: a device (the phone) hanging slightly over the edge of the section above, about 60 to 110px, drawn above it (the section gets a z-index), the laptop large and never cropped by the viewport. Disliked: a pale or white gradient painted over a photo to blend into the next section ("the white shadow"); a dark hero dissolves into the cream page through a short `mask-image` on the backdrop instead. Rejected: making the whole page one "seamless" composition with the laptop moved under the text.
  - **Premium looks premium.** Premium guides are a cover photo under frosted glass (`backdrop-filter: blur(14px)`, white at ~0.6), a lock, and the pricing page's GOLD button ("Unlock with Unlimited"); a locked page is blurred placeholder shapes under frost with gold chains across and the gold button in a glass card.
  - **Images: ask the owner.** When a design needs a specific photo, screenshot, render or illustration that is not in `public/` (or would be better than what is there), ask Peter for it rather than inventing, generating or stretching an unsuitable one ("if you need me to get you a specific image, just ask me").
  - **Buttons are SENTENCE CASE (owner, 25 Sep 2026 night, taste board two; this reverses the earlier "stay UPPERCASE" note).** New and redesigned buttons are sentence case in the Airbnb rounded rectangle with the forest gradient, exactly like the buttons Peter already ships ("Start committee" on /sessions). Existing uppercase labels change only when their surface is redesigned; never mass-rewrite them. The prompt 58 and 59 surfaces (the leader import card on /pay, Settings → Delegations, the Store page and its pop-ups) were switched to sentence case on 25 Sep 2026.
  - **Still open (was):** the QuorumRings gauges and `GavelLoader` are still unconfirmed. Button case is settled (sentence case, above).
- **Errors are written for people, never for engineers.** Never render `error.message`, `err.message`, a Postgres, PostgREST, Storage or Stripe string, or a stack trace to a user. Route every caught error through `friendlyError(error, fallback)` from `src/lib/friendlyError.ts`, with a fallback that says what failed and what to do next. When a migration adds a CHECK a user can reach, add its plain sentence to `CONSTRAINT_MESSAGES` in the same change. Better still, check the condition in the UI first so the database never has to refuse (the TBD publish rule is the example). Our own human-written thrown errors use `new UserFacingError('...')` so friendlyError passes them through. The one exemption is `src/app/admin/*`, seen only by platform admins, where raw errors are kept on purpose for debugging; do not copy that pattern anywhere else.
- **One screen, no page scroll** for consoles and dashboards at 1280x800 and up: the organiser dashboard `/manage/[slug]` (grid in `src/components/conferences/dashboardLayout.tsx`), `/chair`, `/voting` (`FitToScreen`) and the sessions set-up screens; only a list inside them scrolls. Below 1024 px wide or 600 px tall they stack and scroll. Lists and long forms (applications, assignment, the live wall, settings, apply, blog) scroll by design. Rule and list: `docs/ui-audit/00-DESIGN-RULEBOOK.md` §9.
- Dates: the shared `DatePicker` only. Popovers: through `Portal` at fixed coordinates, flipped near edges, never clipped. Info hints open on hover. Long committee names show the acronym with the full name beneath (`committeeDisplayName`).
- i18n: four locales in `src/lib/translations.ts` (en, es, fr, ar with RTL), **sessions only** (18 Sep 2026): `LanguageProvider` returns the stored language only on a sessions route (`src/lib/sessionRoutes.ts`) and English everywhere else, and only sessions surfaces show a picker. Every sessions picker offers "Request a language" (`LanguageRequestDialog`: language, email, Rules of Procedure file into the private `language-requests` bucket, a `language_requests` row (RLS insert-only, trigger rate limit 3 per email / 60 per hour, file must exist), and a team email to wearegavelling@gmail.com through `email_outbox`). The DB stores English; translate at render. Rules and the list of hand-maintained bypasses are in `.claude/TRANSLATIONS.md`, which must be updated when keys change. Manage surfaces are English-only by convention.
- Polish reference: `.claude/skills/make-interfaces-feel-better/SKILL.md` (the only UI skill installed in this repo).

---

## 9. Commands, checks and environment

```bash
npm run dev          # localhost:3000
npm run build        # runs `prebuild` first: scripts/check-brand-marks.mjs fails the build on brand-mark violations
npm run lint
npm run check:og     # validates pageMetadata / OG rules against a running production server
npm run check:indexability   # sitemap, canonicals, noindex, robots, crawl links (default https://gavelling.com; -- --base=http://localhost:3000)
npm run check:text-overlaps  # text clipped / truncated / overlapping because of the brand font (default http://localhost:3000)
```

No unit or end-to-end test suite and no CI. The build, the brand-mark gate, `check:og` and `check:indexability` are the quality gates; verify behaviour in the browser.

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Payments, email and account deletion run in Supabase edge functions with their own secrets; nothing in this repo deploys them.

Largest files (all conferences-side except the chair page): `manage/[slug]/applications/page.tsx` 5.8k, `settings/page.tsx` 5.7k, `communications/page.tsx` 5.1k, `ConferenceApplyClient.tsx` 4.8k, `assignment/page.tsx` 4.7k, `chair/[code]/page.tsx` 4.1k, `translations.ts` 4.0k. Keep diffs in these small and self-contained; put new features in new files and mount them.

---

## 10. How work happens here

- **Branches.** All work lands on `feature/conferences-auth`. Production deploys from `claude/muncommand-recreation-9yjin` and is only touched when Peter says "push to production". Commit and push after every change (`git add -A` → `git pull --rebase` → `npm run build` → push).
- **Two workstreams, one branch.** Christian Galindo owns the conferences layer and pushes to the same branch. Before editing a shared file, check `git log --author=Christian -- <file>`. Never restructure conference code as a side effect of a sessions change. The database is the real shared surface: check the live schema and his recent migrations before applying one.
- **Agents.** Investigation, implementation and verification are delegated to subagents; independent agents run in parallel; agents touching the same file are serialised; every implementation is followed by a verification agent.
- **Fix what was asked, then name what the same evidence implies**, especially when the better lever sits upstream (creation flow over checklist, email over threshold, data model over UI).
- **Docs to keep truthful:** `AGENTS.md` (sessions rules), `EXPERIENCE.md` (how a committee actually runs, with the findings register), `CONFERENCES_PRD.md` + `CONFERENCES_EXPERIENCE.md` (the conferences spec and its verified gaps), `.claude/TRANSLATIONS.md`, `docs/competitive-mymun.md`. When code changes make one of them wrong, fix the doc in the same commit.
