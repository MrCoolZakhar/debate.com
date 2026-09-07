# GAVELLING CONFERENCES — EXPERIENCE & GAP REGISTER
**Companion to `CONFERENCES_PRD.md`. Verified by hands-on QA, not by reading code alone.**

Author: Claude (Opus 4.8), QA pass on branch `feature/conferences-auth`
Date of run: 2026-07-03 — **two passes**: an initial walkthrough, then a same-day re-test after merges landed on the branch (creation bug fixes, previous-editions lineage, role-aware detail page + review system).
Environment: local dev (`localhost:3000`) against production Supabase project `luruhkwrgisytejswlas`
Method: real signup + real browser clicks driving the live UI, cross-checked against the database after every action. Findings that the same-day merges fixed stay in the register marked **FIXED (re-verified)** — the before/after is part of the record.

This document mirrors how `EXPERIENCE.md` documents the sessions product: a verified click-by-click account of how the thing behaves **today**, a numbered findings register, a gap analysis, and a delta against the PRD. Anything marked VERIFIED was observed directly in the running app and/or confirmed in the database.

---

## 0. QA ARTIFACTS CREATED (clean-up manifest)

All rows below are QA evidence. `Creation Lab MUN 2027` is intentionally kept **private and intact** as the evidence conference.

| Kind | Identifier | Notes |
|------|-----------|-------|
| Auth user (organiser) | `qa.organiser.lab@gavellingqa.com` / id `7680ee6f-5f6e-457f-87d2-4932149e0851` | password `GavTest123!`. Created via SQL (see Finding 1). |
| Profile | same id | auto-created by `on_auth_user_created` trigger |
| Auth user (delegate) | `qa.delegate.lab@gavellingqa.com` / id `1cbd0d6e-8912-4142-b347-0af3b9329082` | password `GavTest123!`. Used to seed one applicant. |
| Conference | slug `creation-lab-mun-2027-qalab` / id `cacfd25f-806d-42c4-8c1b-9d131363912d` | **PRIVATE**, status `private`, fee £75 GBP |
| Committee (GA) | `UN General Assembly` / id `ac20c8d3-e558-4b38-82bd-feb47b3b885b` | 8 country slots; session `4MW8YD` minted via UI |
| Committee (Crisis) | `The Cuban Missile Crisis, 1962` / id `6bfd54a4-e776-4918-a9c2-ed5622797e6c` | 6 character slots; no session yet |
| Application | id `21f175ab-85ff-40fd-b1d2-51b5d2e5a068` | delegate, accepted → assigned France (UNGA) |
| Allocation | France / UNGA | `allocation_sent=true` (tested Send All) |
| Role configs | 5 rows for the conference | auto-seeded; delegate re-enabled after test |
| Conference (retest, deleted) | slug `retest-fix-mun-2027-a90zw` | created via the UI in pass 2 to verify the creation fixes, then deleted |

No sessions-layer production data was modified. All writes were confined to these QA rows. Context note: the seed conference "Harvard WorldMUN 2026" was renamed to "London International Model United Nations 2027" (same row, slug `limun-2027`) between passes — visible in the predecessor search test below.

---

## 1. HOW CREATION ACTUALLY WORKS TODAY (verified click-by-click)

### 1.1 Account / auth
- **Signup** (`/auth/signup`): name + email + password (min 8). Google OAuth button present but not exercised. On submit it calls `supabase.auth.signUp` which triggers a confirmation email.
- **VERIFIED BLOCKER:** real signup returned **"email rate limit exceeded"** and created **no** auth user. Supabase's default (shared) SMTP is rate-limited and was already exhausted. A first-time organiser hitting this at launch cannot create an account at all. To proceed, the QA organiser was created by direct SQL insert into `auth.users` (bcrypt via `pgcrypto`, `email_confirmed_at` set, plus a matching `auth.identities` row and blanked token columns so GoTrue's schema query doesn't 500). Sign-in then worked and issued a valid ES256 JWT with `role: authenticated`.
- **Sign-in** (`/auth/signin`) then lands on `/` with the account menu showing name + email + SIGN OUT. Session is persisted in **cookies** (`@supabase/ssr`), not localStorage.
- DB effect: `auth.users` + `auth.identities` + `public.profiles` (via `on_auth_user_created` trigger, which copies `full_name` → `display_name`).

### 1.2 Two-step conference creation (`/conferences/new`)
- **Step 1 — The Basics:** full name, acronym (uppercased live; validated on blur to be ≥4 chars and contain "MUN"), organiser email (pre-filled from profile), student level toggle (School/University/Both), start/end date pickers, country + city (free text), format toggle (In-Person/Online/Hybrid), expected delegates (number), fee (currency GBP/USD/EUR/CHF + amount). "CONTINUE TO DETAILS →".
- **Step 2 — Details:** banner upload (image, 5MB client cap), description (**plain `<textarea>`, not rich text**), social links (IG/FB/TikTok/WhatsApp/Website), a **Previous Editions** block (new in pass 2 — see below), visibility radio (**PRIVATE default** / PUBLIC). "CREATE CONFERENCE".
- **Previous Editions (pass 2, VERIFIED):** "Have you organised previous editions of this conference on Gavelling?" NO/YES. YES reveals a debounced search over your own + public conferences; picking one sets `predecessor_conference_id` on the new row. Copy explains "A past edition may belong to a different account — its Main Organiser approves the link", and the DB backs this with a `guard_predecessor_fields` trigger that forces `predecessor_approved=false` on insert and only allows approval via `approve_predecessor_link()`. Searching "LIMUN" correctly returned the renamed "London International Model United Nations 2027". Solid design; not exercised past search (linking to a real conference would create a pending approval on production data).
- **BEFORE (pass 1, VERIFIED BLOCKER — now fixed):** submit failed **every time**. Root cause: the insert sent `status: 'draft'`, but the DB CHECK constraint `conferences_status_check` allows only `{'public','private','archived'}`. Because the code used `.insert().select('slug').single()` (`return=representation`), the surfaced error was a misleading **"new row violates row-level security policy"** (403) masking the real 400 CHECK violation — the read-back SELECT also independently failed RLS for private conferences, because the RETURNING is evaluated before the `handle_new_conference` ownership trigger's row is visible to `is_conference_organizer()`. Confirmed by REST probes (`return=minimal` with `status:'draft'` → `23514 conferences_status_check`; valid status + `return=representation` → 403). The pass-1 QA conference was therefore created by inserting the exact form payload with `status:'private'`; the trigger correctly wrote the `owner` row into `conference_organizers`.
- **AFTER (pass 2, FIXED, re-verified in the browser):** the merged fixes send `status: isPublic ? 'public' : 'private'` and drop the `.select()` read-back entirely (the code comment matches the diagnosis above: "the new row is only SELECT-visible once the ownership trigger has run, so RETURNING fails RLS for private conferences"). Full UI run with "Retest Fix MUN 2027" succeeded end-to-end: submit → routed to `/manage/retest-fix-mun-2027-a90zw`, DB row `status='private'`, `is_public=false`, one `owner` row in `conference_organizers`. Retest conference deleted afterwards.

### 1.3 Organiser dashboard (`/manage/[slug]`)
- Renders: "Complete Your Setup" checklist (Add Committees → Configure Applications → Setup Payments → Publish Conference) with a progress bar, four stat tiles (Total / Accepted / Assigned / Paid), and Quick Actions.
- Checklist completion is computed: committees = "has ≥1 committee" (real), payments = `stripe_account_id != null` (real), published = `is_public` (real). **`applications` is hardcoded `false`** with an inline code comment "will be real in later prompt".
- Publish (both the checklist "PUBLISH →" and the quick-action) calls `handlePublishClick`, which requires `committees && applications` complete. Since `applications` can never be true, **the dashboard Publish path is permanently blocked** — VERIFIED: with committees created, applications configured, an applicant accepted + allocated, clicking Publish shows "Complete the steps above first." (See Finding 3.)
- Left nav (desktop sidebar / mobile drawer): Dashboard, View Page, Committees, Applications, Assignment, Documents, Email Builder, Financials, Settings, Job Board.

### 1.4 Committees (`/manage/[slug]/committees`)
- "ADD COMMITTEE" → type chooser: **GENERAL ASSEMBLY** or **CRISIS** only (no Security Council / Specialised as distinct types).
- GA editor: `CommitteeNameInput` with **preset autocomplete** (UNSC, UNEP, WHO, IMF, World Bank, UNGA, UNHRC, ECOSOC, NATO, G20, EU, AU, Arab League, ASEAN). Selecting UNGA auto-filled the name and **193 countries**. Difficulty select, topics (1–3), and a `CountryMatrixPicker` with **Quick Bundles** (P5, G7, BRICS+, G20, EU, NATO, ASEAN, Arab League), search, and a "Paste country list + Auto-match" tool. Crisis editor: free-text name + "characters" instead of countries.
- **VERIFIED write path:** creating a committee writes `conference_committees` + one `committee_country_slots` row per country, and **mints a real live session** (`committees` row with `session_origin='conference'` + `current_speaker` + seeded `delegates`). "GENERATE CODE" on a committee card was tested in the browser → minted session code `4MW8YD` linked back to the committee. So manage-side writes genuinely work.
- **VERIFIED friction:** my scripted committee-create clicks did **not** persist (three attempts, 0 rows), while an identical authed REST insert with the same session cookie succeeded instantly. The differentiator is the app's `getAuthedClient(session.access_token)` reading `useAuth().session`, which the `AuthProvider` may render as logged-out after its 2.5s failsafe. Rated Medium confidence as a product bug vs. a scripted-timing artifact (a human clicking slowly likely succeeds, as GENERATE CODE did). Committees for the evidence conference were therefore seeded via SQL matching the editor's exact writes.

### 1.5 Applications config (Settings → Applications tab, `/manage/[slug]/settings`)
- On first load the page **auto-seeds** `application_role_configs` for all 5 roles (delegate + chair `is_enabled`, others disabled). VERIFIED in DB.
- Per role: Opens/Closes datetimes, Max Accepted, Fee (currency + amount), and toggles Auto-accept / Pay at application / Must pay before allocation. Custom Questions section per role (add/remove). Toggling a role's enable/auto-accept writes immediately (VERIFIED — an errant toggle click flipped `delegate.is_enabled` in the DB, later restored).
- **VERIFIED discrepancy:** the seeded per-role delegate fee is **£0**, independent of the conference headline fee (£75). Two fee concepts coexist (headline fee on the conference row + per-role fee) with no reconciliation; unclear which is actually charged (moot today since payments don't exist — Finding 4).

### 1.6 Visual / logo / fee (Settings → Visual tab)
- Banner upload, **Conference Logo upload** (this is the ONLY place a logo can be set — the PRD put it in creation Step 2; it is absent there), Registration Fee (currency list here is broader: GBP/USD/EUR/CHF/CAD/AUD/JPY/CNY/INR/BRL/MXN — vs only 4 in creation), Description, Social links. Copy explicitly says "Per-role fees are set in the Applications tab."
- **No Terms & Conditions PDF upload** anywhere (PRD promised it in creation Step 2).

### 1.7 Organisers & Privacy (Settings tabs)
- **Organizers:** team list (owner shown) + "Invite by email". VERIFIED render.
- **Privacy & Publishing:** a **Public listing** toggle (writes `is_public` + `status`), and a Danger Zone "ARCHIVE CONFERENCE". This toggle is the **only working publish path** (the dashboard checklist one is blocked). Left the conference private.

### 1.8 Applications queue (`/manage/[slug]/applications`)
- Filters (status / role / payment), EXPORT CSV, stat tiles, applicant cards with preferences, experience, status + payment pills, and REVIEW / ACCEPT / REJECT.
- VERIFIED: seeded applicant appeared; **ACCEPT** transitioned `applications.status` submitted → accepted.
- Minor: the card renders only the first 2 of 3 committee preferences.

### 1.9 Assignment board (`/manage/[slug]/assignment`)
- Delegates/Chairs toggle, "SUGGESTED ASSIGNMENTS" panel with **fit scoring** (showed France / UNGA / "1ST CHOICE" / "COUNTRY PICK" / score 102) and one-click **ASSIGN**; an UNASSIGNED drag pool; committee columns with fill counts and open slots; rectangular flags rendered.
- VERIFIED: **ASSIGN** created a `conference_allocations` row (France), set `applications.status`→assigned with `assigned_committee_id` + `assigned_country_name`, and UNGA fill moved to 1/8.
- VERIFIED: **SEND ALL ALLOCATIONS** set `allocation_sent=true` + timestamp with **no confirmation dialog** and (per Finding 4) **no actual email** — it only flips a DB flag. Allocations are not auto-sent on assign (PRD rule 7 upheld), but "send" is a misnomer today.

### 1.10 Documents / Communications / Job Board
- **Documents:** per-committee tabs, Study Guide upload, Position Papers with deadline + status filters. Renders; structurally matches PRD Part 8.
- **Communications (Email Builder):** audience segmentation, rich-text-ish toolbar, immediate/scheduled send. "SEND NOW" only inserts an `email_sends` row — **no email is dispatched** (Finding 4).
- **Job Board:** stats + category filters (Chairs / Secretariat / Staff), "POST A POSITION" form (category, role name, committee, description, requirements, compensation, deadline). Renders; matches PRD Part 14.
- **Financials:** **stub** — literally "This section is being built. Check back soon." (Finding 4.)

### 1.11 Public conference + apply
- Detail page (`/conferences/[slug]`) is reachable by direct link even while private (PRD-correct). Shows hero, dates, location, fee (£75), description, organiser, and a "Committees will be announced soon" placeholder (committees not shown while private/pre-publish).
- Apply gate (`/conferences/[slug]/apply`) only checks `roleConfig.is_enabled` (NOT the open/close window). With a role disabled it shows "Applications are not open". Detail page treats "no dates set" as **open-always**.

---

## 2. VERIFIED FINDINGS REGISTER

Severity: **P0** = blocks launch, **P1** = major, **P2** = notable, **P3** = polish.

### Finding 1 — Signup is dead: "email rate limit exceeded" (P0, VERIFIED)
Real signup via `/auth/signup` returns "email rate limit exceeded" and creates no user. Supabase's default email sender is rate-limited/exhausted; every new organiser is blocked at the front door.
- **Repro:** `/auth/signup`, fill valid details, submit → error banner, no `auth.users` row.
- **Fix direction:** configure a real transactional SMTP/provider (Resend/SendGrid per PRD) in Supabase Auth, and/or disable "confirm email" for password signup, and raise the rate limit. This is the single most launch-critical item.

### Finding 2 — Conference creation was 100% broken: `status:'draft'` violated CHECK + RLS read-back (P0 → **FIXED, re-verified same day**)
`/conferences/new` inserted `status: 'draft'`, but `conferences_status_check` allows only `public|private|archived` — every "CREATE CONFERENCE" failed. Compounding it, the `.insert().select().single()` read-back independently failed RLS for private conferences (RETURNING evaluated before the ownership trigger's row is visible), so the user saw a misleading **"violates row-level security policy"** 403 either way.
- **Repro (pass 1):** complete both steps, submit → red "Failed to create conference: new row violates row-level security policy". REST probes isolated both layers (`23514 conferences_status_check`, then 403 on read-back with a valid status).
- **Fix (merged same day, pass 2 re-verified):** the branch now sends `status: isPublic ? 'public' : 'private'` and removed the `.select()` read-back (slug is generated client-side). A full UI creation run succeeded → `/manage/retest-fix-mun-2027-a90zw`, row `status='private'`, owner row present. **Closed.** Residual: the swallowed-error pattern remains elsewhere (Finding 12).

### Finding 3 — Dashboard "Publish" is permanently blocked (P0/P1, VERIFIED)
The dashboard checklist gates Publish on `committees && applications`, but the `applications` step is hardcoded `false` ("will be real in later prompt"). No amount of setup unblocks it.
- **Repro:** with committees + role configs + an accepted/allocated applicant, click "PUBLISH →" → "Complete the steps above first." Progress bar stuck ~25%.
- **Workaround that exists:** Settings → Privacy → Public listing toggle (the real publish path). Two publish paths, one broken, is confusing.
- **Re-checked after the pass-2 merges: still present** (`applications: false, // will be real in later prompt` remains in `manage/[slug]/page.tsx`).
- **Fix direction:** compute `applications` completion from `application_role_configs` (≥1 enabled role), and/or unify publish on the Privacy toggle.

### Finding 4 — No payments and no email: two headline features are absent (P0, VERIFIED)
- **Financials/Payments** is a 15-line "being built" stub. No Stripe Connect, no onboarding, no transactions, no refunds. Fees are configured but **cannot be collected**. The dashboard "Setup Payments" step links to this dead end.
- **Email** has no infrastructure at all (no Resend/SendGrid, no edge functions). "Send allocation", "SEND NOW" (Email Builder), study-guide publish, and every automated trigger only write DB flags/`email_sends` rows. Nothing reaches an inbox.
- **Fix direction:** these are large builds. For a July launch, at minimum wire Stripe Connect + a transactional email provider, or explicitly scope the launch to free, email-less conferences and remove/relabel the promises.

### Finding 5 — "Send Allocations" flips a flag with no email and no confirm (P1, VERIFIED)
`SEND ALL ALLOCATIONS` and the per-assign "send email" toggle set `allocation_sent=true`/timestamp but dispatch nothing (Finding 4) and show no confirmation. Organisers will believe delegates were notified when they were not. Delegates never receive their country + session code.

### Finding 6 — Applicant-visibility depends on unreliable `useAuth().session` (P1, MEDIUM confidence)
The manage pages build a Supabase client from `useAuth().session.access_token`. When the `AuthProvider` failsafe (2.5s) renders logged-out, `getAuthedClient` is created without an auth header → writes silently fail RLS and `.insert().select().single()` returns a null row that the UI treats as success (editor closes, no error). Observed as committee-create writes not persisting under scripted timing, while identical authed REST inserts succeeded. Needs confirmation with a slow human click, but the swallowed-error pattern is real and dangerous. The pass-2 creation fix's own code comment confirms the underlying read-back-RLS mechanism is real — the creation flow removed its `.select()`, but other manage inserts still use the pattern.
- **Fix direction:** await a settled session before enabling writes; surface `.single()` null/errors instead of closing the modal.

### Finding 7 — Crisis committees are shoehorned into the country model (P2, VERIFIED)
`committee_country_slots` has a UNIQUE `(conference_committee_id, country_code)`. Crisis "characters" have no country code, so the editor falls back to using the character name as the code. Multiple characters from the same nation (e.g. three US ExComm members) only work because each name is unique; the schema has no first-class notion of a portfolio/character with a real nationality flag. Committee cards also hardcode the label "N countries" even for crisis committees.

### Finding 8 — Freshly-configured conference is un-applyable, with no warning (P2, VERIFIED)
The detail page treats "no application-window dates" as open-always, but nothing in the organiser UI prompts the organiser to open a window or enable roles, and the dashboard never flags "no role is applyable". An organiser can publish and still have zero applyable roles.

### Finding 9 — Two disconnected fee fields (P2, VERIFIED)
Conference headline fee (creation + Visual tab, £75 in QA) and per-role fee (Applications tab, seeded £0) are independent. No UI reconciles them; it is unclear which is authoritative. Moot until payments exist, but a data-integrity trap.

### Finding 10 — GENERATE CODE does not seed the committee's countries into the session (P3, VERIFIED)
Creating a committee seeds the live session's `delegates` from its countries, but generating a code later calls the mint with an empty country array, so a later-minted session starts with 0 delegates and the country roster is not backfilled.

### Finding 11 — PRD-promised creation fields missing from the flow (P3, VERIFIED)
Creation Step 2 has no **logo upload** (only banner; logo lives in Settings → Visual), no **Terms & Conditions PDF**, and description is a plain textarea rather than a rich-text editor.

### Finding 12 — Applicant card truncates preferences; misleading RLS errors elsewhere (P3, VERIFIED)
Applications cards show only 2 of 3 preferences. Separately, the read-back-RLS pattern that masked Finding 2 recurs across manage inserts and will make future debugging harder — the pass-2 merge fixed it only in the creation flow (e.g. the committee editor still does `.insert().select('id').single()`).

---

## 3. GAP ANALYSIS

Rated by launch-criticality for **test launch July 12** and **official launch July 15** (today is July 3 2026). Legend: **T12** = needed for the July 12 test; **T15** = needed for the official launch; **Post** = fast-follow; each with a size hint.

### 3.1 As an MUN platform (feature-parity + PRD promises)
| Gap | Detail | Criticality |
|-----|--------|-------------|
| Working signup | Finding 1 — no account = no product | **T12 (must)** |
| ~~Working conference creation~~ | Finding 2 — **FIXED and re-verified** during pass 2 | ~~T12~~ Done |
| Payments (Stripe Connect) | Finding 4 — fees configured, cannot be collected; the whole "transparent 5% + Stripe" model is vapor | **T15 (must if any paid conf)** |
| Transactional email + triggers | Finding 4 — allocations, acceptances, study-guide, reminders all silent | **T15 (must)** |
| Publish that actually works from the primary CTA | Finding 3 | **T12** |
| Awards / MUN CV write-back | PRD Parts 7 & 12 — **built September 2026**: Settings → Awards, chair Awards card, `/manage/[slug]/awards`, `publish_conference_awards()` writes `gavelling_verified` CV entries and points | Done |
| Gavelling Points earning/spending | PRD Part 15 — `points_balance` column only | Post |
| Gavelling Unlimited (surcharge waiver) | PRD 1.4 — `unlimited_status` column only; no billing | Post (needed before charging) |
| Conference calendar + overlap warning | PRD Part 13 — not observed | Post |
| Position-paper review workflow (chair feedback) | PRD Part 8 — submission scaffolding exists; feedback loop unverified | T15 (if PP-heavy confs) |
| Security-Council / Specialised committee types | Only GA + Crisis offered vs PRD's fuller list; SC veto ties to sessions layer | Post |
| Chair invitation by email on committees | PRD 4.3 — no chair-assign UI in committee editor | T15 |
| Society/head-delegate dedup logic | PRD Part 5 — `is_head_delegate`/`society_id` columns exist; flow unverified | T15 |

### 3.2 As a general event platform (beyond MUN — where mymun-style directories are also weak)
| Gap | Why it matters | Criticality |
|-----|----------------|-------------|
| **Refund / cancellation policy handling** | Paid events need refunds; PRD mentions it, UI has none | **T15 (if paid)** |
| **Check-in / badges / QR** | On-site arrival, name badges, day-of ops — nothing exists | Post (in-person confs) |
| **Multi-day agenda / schedule / program builder** | 3-day conference (QA data is 5–8 Mar) has no schedule/venue/rooms/timetable at all | Post (high value) |
| **Ticketing tiers** | Only per-role flat fees; no early-bird, group, add-ons, merch | Post |
| **Delegate communications hub** | Broadcast + 1:1 to registrants; Email Builder is a non-sending stub | T15 |
| **Dietary / accessibility data capture** | Custom questions could cover it, but there's no structured field, export, or aggregation | Post (duty-of-care) |
| **GDPR / data export / deletion** | Storing minors' PII (school level) with no export/erasure tooling is a legal exposure | **T15 (compliance)** |
| **Post-event analytics** | Dashboard promises charts/maps/feed; only 4 static tiles exist | Post |
| **Sponsorships / partners** | No sponsor tiers, logos, or placement | Post |
| **Certificates of participation** | Common MUN deliverable; not present | Post |
| **Social / photo wall, announcements feed** | Community/engagement surface absent | Post |
| **Accessibility (a11y)** | Toggles are custom `<button>`s without ARIA/keyboard semantics; needs an audit | T15 |
| **Venue / capacity / rooms** | No physical-logistics model for in-person events | Post |

---

## 4. PRD DELTAS (reality vs `CONFERENCES_PRD.md`)

| PRD says | Reality (VERIFIED) |
|----------|--------------------|
| Google OAuth primary, email/password fallback (Part 1) | Both present; email path **blocked by rate limit** (Finding 1). |
| Creation Step 2: logo upload, T&C PDF, **rich-text** description (Part 3.1) | No logo in creation (it's in Settings → Visual), **no T&C upload anywhere**, description is a plain textarea. Step 2 gained a **Previous Editions / predecessor-lineage** block instead — useful, but not in the PRD. |
| Created as Private, organiser publishes when ready (Part 3.1) | Was broken (`status:'draft'` CHECK violation, Finding 2); **fixed in the pass-2 merge and re-verified** — creates as `private` and lands on the dashboard. |
| Dashboard: income charts, applications-over-time, geo map, activity feed (Part 4.1) | Only 4 static stat tiles + checklist + quick actions. |
| Setup checklist Add Committees → Configure Applications → Setup Payments → Publish (Part 4.1) | Present, but **Configure Applications never completes** and **Publish is blocked** (Finding 3); Setup Payments → stub. |
| Committee types GA / SC / Specialised / Crisis (Part 4.3) | Only **GA + Crisis**. |
| Per committee: chair assignment by email, delegation size 1-vs-2 (Part 4.3) | No chair-assign UI in the editor; `delegation_size` always written as 1. |
| Smart assignment with fit scores + auto-suggest (Part 4.5) | **Delivered and works** (fit score, 1-click ASSIGN, drag pool). One of the strongest areas. |
| Allocations never auto-sent; manual "Send All" emails country + session code (Part 4.5, rule 7) | Not auto-sent (upheld), but "Send" **dispatches no email** — only flips `allocation_sent` (Finding 5). |
| Payments: Stripe Connect, 5% surcharge, refunds, financial dashboard (Part 10) | **Entirely absent** — Financials is a stub (Finding 4). |
| Communications: full email builder + smart triggers (Part 9) | Builder UI exists but **sends nothing**; no triggers wired (Finding 4). |
| Private conferences reachable via direct link (Part 2.3) | **Upheld** — detail page loads while private. |
| Acronym must include "MUN", inline error not hard block (rule 10) | **Upheld** — live uppercase + on-blur validation. |
| Session–conference integration: committee mints a joinable, account-locked session (Part 6) | Session **minting works** (`session_origin='conference'`, delegates seeded on create); account-lock enforcement on join not tested this pass. |
| Awards / MUN CV / Points / Unlimited / Calendar (Parts 7, 12, 13, 15) | Awards (Part 7) and the verified-CV write-back (Part 12) are built as of September 2026; award points (Part 15) mint at paid conferences. Calendar and Unlimited-specific perks remain as before. |
| **"Conference ratings and award badges are not in scope. Do not build or reference these."** (rule 11) | **Violated by the pass-2 merge:** the role-aware detail page now ships a 1–5 **star review system** (`StarRow`, `ReviewCard`, reviews state). Either the rule or the feature needs a decision before launch. |
| (not in PRD) | **Previous-editions lineage** with organiser-approved predecessor links (`predecessor_conference_id`, `guard_predecessor_fields` trigger, `approve_predecessor_link()`) — a new, well-guarded feature the PRD should absorb. |

---

## 5. OVERALL READINESS (one-paragraph verdict)

The **management surface is genuinely impressive** where it exists — committees with preset country matrices, a real fit-scored assignment board, per-role application config, documents, a job board, and now predecessor lineage — and the session-conference integration mints real joinable sessions. The spine improved measurably **within this QA day**: conference creation was 100% broken at the first pass and was **fixed and re-verified by end of day** (Finding 2 closed). Two P0s remain: **signup is still dead** on the email rate limit (Finding 1 — SMTP config, small) and the **dashboard Publish CTA is still hard-blocked** by a hardcoded flag (Finding 3 — one line). Fix those two and July 12 is achievable as a **free-conference, email-silent test**. Payments and email (Finding 4) remain large absences that gate any **paid** conference and all delegate notifications for July 15; a defensible official launch scopes to free conferences and pulls the payment/email promises from the marketing until Stripe Connect + a transactional provider land.
