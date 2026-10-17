<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## 6. Where things live

```
src/app/
  (sessions)   create, join, chair/[code], delegate/[code], advisor (the board; advisor/[code] only redirects to it), voting/[code]
  (public)     /, sessions, about, contact, blog/*, [slug] (vanity), conferences/{explore,map,roles,[slug]/*}
  (participant) conferences/[slug]/{apply,pay,role/[role],papers,awards,press}, my-conferences, drafts/[token], invites/*   (the /delegation portal was deleted on 27 Sep 2026)
  (organiser)  manage/[slug]/{committees,applications,assignment,documents,communications,financials (financials/aid = Financial aid),settings,store,jobs,import,live,scoreboard,awards*,financial-aid*}   (*redirect only: awards → settings?tab=awards, financial-aid → financials/aid keeping the query)
  (account)    account/{profile,cv,conferences,manage}, auth/*, cv/[id]
  (staff)      admin
  api/         ambassador, contact, geo, indexnow, emails/queue-participant, og/*
src/lib/
  sessions     types.ts, committeeService.ts (all session DB I/O + realtime), scoring.ts, sessionScoreboard.ts, settingsStore.ts, committeeFlags.ts, docNames.ts
  conferences  conferenceAccess.ts, conferenceScoreboard.ts, awards.ts, awardsService.ts, slotGroups.ts, conferenceIntent.ts, finance.ts, payments.ts, invoices.ts, emailEvents.ts, defaultEmails.ts, organizerPermissions.ts, publicFees.ts, seo.ts, vanity.ts, conferenceSlug.ts, conferenceAliases.ts
  shared       translations.ts (4 locales), countries.ts, supabase.ts (anon), supabase-auth.ts (getAuthedClient), sessionClient.ts (chair suffix header)
src/components/ neu.tsx (design tokens), DatePicker, Portal, SiteNav, ScoreboardTable, ScoreboardPanel, MotionsModal, DocumentsModal, RollCallPanel, ChatPanel, SettingsPanel, FeedbackLogPanel, TutorialOverlay, GuidedWalkthrough
```

**State, honestly:** the chair page is React state + `committeeService` + a Supabase Realtime channel, with `useSettingsStore` (zustand, `localStorage: gavelling-settings`) for per-committee settings. `src/lib/store.ts` (`useCommitteeStore`, `localStorage: mun-committees`) is legacy with no live importer (the join page stopped reading it on 14 Sep 2026, J-1: nothing writes it, so a hit could only be an old roster or chair code); `SpeakersListPanel`, `CaucusPanel` and `ResolutionsPanel` import it but are themselves unreferenced. Realtime on the chair, delegate and voting pages goes through `startSessionSync` (`src/lib/sessionSync.ts`; AGENTS.md RULE 4). The conferences layer uses no zustand at all: React state, `useAuth()` from `AuthProvider`, `getAuthedClient(session.access_token)`, and `useManage()` from the manage layout.

**A page left open never says "session expired" (27 Sep 2026).** The error reports showed PGRST303 "JWT expired" about once an hour from organisers who left `/manage/[slug]/live` open overnight: it polled with the token it had at load, and a background tab's refresh timer is throttled. Now (`src/lib/supabase-auth.ts`): every client made by `getAuthedClient` sends the SDK's CURRENT token (`latestToken`, kept by `onAuthStateChange`), not the one its caller captured; a request answered "JWT expired" refreshes the session once (shared, 8 s cap) and retries the same request once, silently; only when that refresh fails is the sign-in pop-up opened with "Your session has expired. Please sign in again." and one report sent, recorded as expected and never emailed (being asked to sign in again is the rule working). A refresh that TIMED OUT (the 8 s cap, a hung auth lock or a dead connection), or a browser that is offline, opens nothing and reports nothing (6 Oct 2026). On window focus and tab-visible the SDK is asked for its session (`refreshSessionNow`, which a page can await). The Live page and the admin Live tab get their client from `getFreshAuthedClient()` at call time, pause polling while hidden, and refresh the session before polling again on return. New pollers: do the same, and key effects on the user id, never the token.

**No page reloads by itself (11 Oct 2026, owner: "occasionally the website does a weird reload ... on a lot of different pages").** Three causes, all closed: (1) supabase-js announces SIGNED_IN every time a tab becomes visible and TOKEN_REFRESHED about hourly, each with freshly parsed objects, so every effect keyed on `user` / `session` / `profile` re-ran and pages that start with a loader flashed it over themselves. `AuthProvider` now keeps the previous `user`, `session` (same tokens) and `profile` objects when nothing changed, reads the profile once per account (`refreshProfile()` re-reads it on demand; the avatar upload used to `location.reload()`), and the page loads that keyed on `session?.access_token` (manage layout, apply, profile, MUN CV, My conferences, /pay, papers, roles, the dashboard and Financials cards) key on the user id instead. (2) The manage layout showed its full-screen loader on EVERY conference read, so a token refresh or any `refreshConference()` after a save unmounted the whole console and drew it again; only the first load of a slug shows it now, later reads swap the data in place and a failed re-read keeps the console. (3) After a production deploy, a query-only `router.replace` (filters, tabs, stripping `?open=`) fetched the page payload from the NEW build and Next fell back to a full page load of the same URL; those calls now use `replaceUrlInPlace` (`src/lib/replaceUrlInPlace.ts`, `history.replaceState`, which Next syncs into `useSearchParams` with no server request). A clicked link after a deploy still loads the target page in full (Next's own skew fallback); Vercel **Skew Protection** (project settings, a dashboard switch, not repo config; Next picks up `NEXT_DEPLOYMENT_ID` itself) removes that too. Rules: never key a page load on the token or the session object, never put a full-screen loader on a re-read, never `location.reload()` to pick up data that can be read again in place, and use `replaceUrlInPlace` for a query change on a client page.

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

**Money emails (prompt 97, owner 7 Oct 2026).** Payment received is sent ONLY by the server, whenever someone who pays for themselves goes from unpaid to paid (card, approved proof or marked paid), with the conference's own template (on unless turned off); nothing on the client queues it, and people covered by a delegation ticket get Gavelling's fixed "Your spot is covered" email instead. Four emails are fixed server emails that ALWAYS send and are not template events: the itemised payment receipt (one per payment), the refund confirmation, "Proof not accepted" with the organizer's reason, and "Your spot is covered"; Communications lists them under "Always On" at the top of Automatic emails (`communications/alwaysOnEmails.ts`, display rows only). `aid_approved`, `aid_denied`, `fee_waived`, `spot_received` and `spot_lost` joined `ESSENTIAL_DEFAULT_ON_EVENTS` (default on with our copy, an explicit OFF honoured), and `spot_lost` now sends immediately.

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

**Email campaigns: the paced newsletter and its conversion read-out (applied 8 Oct 2026, migration `email_campaigns_tracking_and_pacing`; source `scratch-email-campaigns.sql`; the cron `email-campaigns` is NOT scheduled and no campaign exists yet).** Owner: everyone gets it, over time, and every mass email shows whether it made people try Gavelling. Tables (RLS on, no policies, no grants; only the functions touch them): `email_campaigns` (slug, subject, from_name "Peter at Gavelling", from_address peter@mail.gavelling.com, reply_to wearegavelling@gmail.com, body_html, body_text, `links` = key -> https://gavelling.com URL with a `home` fallback, `per_run` <= 100, `started_at` / `paused_at` / `finished_at`), `email_campaign_recipients` (one per account per campaign, a 32-hex random `click_token`, `outbox_id`, `first_click_at`, `clicks`; `is_test` rows never block a real send and are left out of reports) and `email_campaign_clicks` (campaign, recipient row, link key, time: nothing else). Audience `everyone` = non-demo profiles with a CONFIRMED auth email, `notify_email_marketing` on, not opted out, not `email_address_failed`, not yet sent this campaign, in a stable random order. **Pacing** is the prereg campaign's rule: each run queues at most `per_run` and at most `120 - outbox rows created in the last 10 minutes`, so the burst alarm never fires; `email_pause()` stops it like everything else. Links in the email are `https://gavelling.com/r/{{CLICK_TOKEN}}/<key>` and the unsubscribe is `{{UNSUBSCRIBE_URL}}`; both are filled per recipient at queue time, so the render trigger leaves `body_html` alone. `scripts/newsletter/publish.mjs <edition>` prints the INSERT for an edition (it connects to nothing) and refuses an edition whose links are not on gavelling.com or that lacks `{{UNSUBSCRIBE_URL}}`. Functions: `queue_email_campaign(slug, p_preview default TRUE)` (preview inserts NOTHING, not even an unsubscribe token; `false` SENDS the next batch, only while started and not paused), `queue_email_campaigns_tick()` (every running campaign, oldest first; what the cron calls; SENDS), `queue_email_campaign_test(slug, email)` (one `[Test]` copy to one address, SENDS), `record_campaign_click(token, key, record)` (anon; returns the destination, or `home` for an unknown key, or null; never raises; at most 200 recorded clicks per recipient), `admin_email_campaigns()` and `admin_email_campaign_report(slug)` (platform admins; /admin → Data → Email campaigns, `src/app/admin/EmailCampaignsCard.tsx`). **The `/r/[token]/[key]` route** (`src/app/r/[token]/[key]/route.ts`) validates both segments by shape, calls `record_campaign_click` with the anon key, and 302s only to an https://gavelling.com URL (else the homepage); it stores no IP, user agent, cookie or referrer, skips counting bot user agents (the `/api/conference-view` list, in `src/lib/emailCampaigns.ts`) and HEAD requests, sends `X-Robots-Tag: noindex` and `no-store`, and `/r/` is disallowed in robots.txt (a fetch has a side effect). No open tracking (no pixel). **Conversion** = a recipient whose email was SENT did one of these in the 7 days after it was queued and had not done that same action in the 30 days before: applied to a conference (self-submitted), applied for a job-board role, created a conference, joined a secretariat, chaired a session signed in (`chair_device_claims`), joined a session as a signed-in delegate (`delegate_seat_claims` `u:` keys), added a manual MUN CV entry, bought credits, bought paid Unlimited, unlocked a guide; split clickers vs non-clickers. Anonymous sessions cannot be attributed, claim rows vanish with their rooms (read those two actions within a day or two), and with no holdout it is association, not cause. **Run it:** paste `publish.mjs`'s output; preview with `select queue_email_campaign('<slug>')`; test with `select queue_email_campaign_test('<slug>', 'petizakhar@gmail.com')`; start with `update email_campaigns set started_at = now() where slug = '<slug>'` plus the commented `cron.schedule('email-campaigns', '*/10 * * * *', ...)` in the SQL file (scheduled once for all campaigns); pause with `update email_campaigns set paused_at = now() where slug = '<slug>'` (clear it to resume) or stop everything with `email_pause()` / `cron.unschedule('email-campaigns')`. About 4,400 accounts take about 7.5 hours at full pace.

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
The alarm still goes to petizakhar@gmail.com: moving it to the team inbox needs the
SQL in the Oct 2026 handover, which has not been applied yet.

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
  subject), the team inbox `wearegavelling@gmail.com` (owner, 12 Oct 2026: test emails
  go there and must arrive at once; migration `rate_cap_exempt_team_inbox`), and rows that are not pending / held (suppressed). Auth codes do not go
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
