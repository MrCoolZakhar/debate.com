# Delegate Sign-up & Application — QA Findings

**Date:** 2026-07-03
**Branch:** `feature/conferences-auth` @ `001d6a9`
**Tester:** QA agent (API-level curl against Supabase `luruhkwrgisytejswlas` + code audit)
**Scope:** The delegate journey — account sign-up, browsing conferences, applying, post-application visibility, `/join` gating. No browser; every step below was exercised against the live PostgREST/Auth API the same way the client code does, and cross-checked against RLS policies via SQL.

> Note on fixtures: the brief named `harvard-worldmun-2026` and `gavmun2`, which do **not** exist in this DB. Real conferences: `limun-2027` (public, $95, delegate `must_pay_before_allocation=true`, 3 custom Qs), `testmun-seed-2026` (public, free), `gavelling-test-mun-1-9ugut` (public), `gavelling-mun-test-2-sq2x7` (**private**, £100). Testing used `limun-2027` as the primary target and the private conf for RLS probes.

---

## JOURNEY MAP — what happens today, step by step

### 1. Sign up (`/auth/signup`)
- Client calls `supabase.auth.signUp({ email, password, data:{ full_name }, emailRedirectTo:/auth/callback?next=/ })`.
- **Email domain validation is strict.** `qa.delegate.test1@gavellingqa.com` was rejected by GoTrue: `email_address_invalid`. `@gmail.com` succeeded. So placeholder/vanity domains a real user might use (e.g. a school's own mail domain that fails GoTrue's deliverability heuristics) can be bounced with a raw, unfriendly error surfaced verbatim in the red banner.
- **Email confirmation is REQUIRED and blocks everything.** After signup, `signup` returns a user with `email_verified:false`. Signing in immediately returns `400 email_not_confirmed`. The signup page shows a "Check your email" screen — correct — but there is **no resend-confirmation** button and no way forward in-app until the user finds the email. (For this test the account was confirmed via SQL `update auth.users set email_confirmed_at = now()`.)
- **Rate limiting is aggressive.** After 1 successful send, the next two signups (different addresses) returned `429 over_email_send_rate_limit`. A society registering several delegates from one network/IP in quick succession will hit this.

### 2. Browse conferences (anonymous)
- `GET /conferences` (anon) returns only `is_public=true` rows. The private conf is invisible. ✓
- `GET /conference_committees`, `committee_country_slots`, and `rpc/get_committee_occupancy` are all anon-readable for public conferences and drive the detail page's roster/occupancy/availability sort. ✓ Occupancy RPC returns `{conference_committee_id, country_code}` per taken seat.

### 3. Conference detail (`/conferences/[slug]`)
- Anon sees hero, stat strip, committees carousel, pricing medallion, "Sign in to apply".
- Signed-in: `applications` (own), `conference_allocations` (own), `position_papers` (own) are fetched. The right rail shows an APPLY button per open role; if you already applied it becomes a disabled `Applied ✓`.
- Documents tab is **locked until you have an allocation** ("Study guides and position paper submissions unlock once you receive your committee allocation"). Gate is client-side on `myAllocation`.

### 4. Apply (`/conferences/[slug]/apply?role=delegate`)
- Auth gate: no user → redirect to `/auth/signin?next=...`.
- 4 steps for delegate/head-delegate (Role → Society → Preferences → Experience); 3 for observer/others.
- Society step: free-text autocomplete over `societies`; unknown names are **inserted** into `societies` on submit (any authed user can create a society row — see UX/Sec notes).
- Preferences step: requires ≥3 (committee + country) rows; countries come from `committee_country_slots`.
- Submit inserts one `applications` row with `status = auto_accept ? 'accepted' : 'submitted'`, then inserts `application_preferences`. Verified end-to-end: created `applications.id=4516c730…` (limun delegate, submitted).
- On success → `/conferences/[slug]/apply/confirmation` ("You're in the queue!").

### 5. Post-application
- Re-visiting `/apply` shows "You've already applied — status is {status}". The `applications` unique key `(conference_id,user_id,role)` prevents a second app for the same role (verified: duplicate → `23505`).
- The **conference detail page never shows the application's status** — only a disabled "Applied ✓" button. Accepted/waitlisted/rejected is invisible unless the user manually re-opens `/apply`.

### 6. `/join` (session entry)
- `detectConferenceSession(code)` reads `committees.session_origin` (anon) → if `'conference'`, gates the flow.
- `verifyConferenceAccess()` (authed) reads `conference_committees` by `session_code`, then the user's `conference_allocations` row → returns `delegate` with country, else `denied`. Delegate joins locked to their allocated country (`?locked=1`). RLS on `conference_allocations` (own-row SELECT + self-insert blocked) makes this the true, safe access boundary. ✓

---

## BUGS (with repro + severity)

### BUG-1 — Position paper submission is broken (schema mismatch) — **HIGH**
`position_papers` has **no `country_name` column** (columns: id, conference_committee_id, user_id, country_code, file_url, file_name, file_size_bytes, status, chair_feedback, reviewed_by, reviewed_at, notify_on_feedback, submitted_at, updated_at, conference_id).
But `ConferenceDetailClient.tsx` `handlePPSubmit()` (~line 398) inserts `country_name: myAllocation.country_name` and does **not** insert `conference_id`.
- Repro (API mirror of client insert): `POST /position_papers` with `country_name` → `PGRST204 Could not find the 'country_name' column of 'position_papers'`.
- Impact: the core delegate deliverable — uploading a position paper — throws. The PDF uploads to storage first, then the DB insert fails, leaving an orphan file and a silent failure (only `setPPError('Upload failed.')` is wired for the storage step; the insert error is unhandled).
- Fix: drop `country_name` from the insert (or add the column); confirm `conference_id` is defaulted by trigger, else add it.

### BUG-2 — Required custom application questions are not enforced — **MEDIUM**
`limun-2027` delegate config has 3 custom questions, 2 marked `required:true`. `renderStepExperience()` renders them but `handleSubmit()` performs **no validation** that required answers are filled, and the DB accepts any JSON. Verified: inserted an application with `custom_answers:{"q1":"…"}` (keys don't even match the question ids `q_motivation`/`q_experience`/`q_dietary`) — accepted. Organizers receive blank/garbage answers to "required" questions.

### BUG-3 — `gavellingqa.com` / vanity domains rejected with raw error — **LOW**
GoTrue rejects some syntactically-valid domains (`email_address_invalid`) and the message is shown verbatim. No friendly guidance ("try another email"). Low, but confusing for real users on niche school domains.

### BUG-4 — No resend-confirmation path — **LOW/MEDIUM**
Sign-up dead-ends on "Check your email". If the mail is lost/delayed (and sends are rate-limited to ~1), the user is stuck with no in-app recovery. Combined with the 429 rate limit this can hard-block a delegate on the day applications open.

---

## SECURITY FINDINGS (RLS evidence)

### SEC-1 — `applications` INSERT/UPDATE let a delegate forge status, payment, and allocation fields — **HIGH**
The only INSERT check is `with_check: (user_id = auth.uid())` — **no constraint on `status`, `payment_status`, `assigned_committee_id`, `assigned_country_*`, `paid_amount`, `organizer_note`.** The user UPDATE policy is `USING (user_id = auth.uid() AND status = 'submitted')` with **no WITH CHECK**, so those same sensitive columns are freely writable as long as `status` stays `'submitted'`.

Evidence (all as the QA delegate, authed anon key + user JWT):
- **Self-accept at INSERT:** created `applications.id=6edad003…` role `head-delegate` with `status:'accepted'`, `payment_status:'paid'`, `paid_amount:0`, `assigned_country_code:'US'`, `assigned_committee_id:'cc…0001'`. Accepted.
- **Self-pay + self-assign via UPDATE (status kept 'submitted'):** PATCHed `4516c730…` to `payment_status:'paid'`, `assigned_country_name:'France'`, `assigned_committee_id:'cc…0001'`, `organizer_note:'hacked'`. Accepted.
- **Blocked (good):** PATCH that also flipped `status:'accepted'` → `42501 RLS violation` (the missing WITH CHECK falls back to the USING `status='submitted'`, so only the status flip is blocked — not the other fields).
- **Apply to a PRIVATE, invisible conference:** created `37cdbb73…` against `gavelling-mun-test-2-sq2x7` (which anon/this user cannot even read) with `status:'accepted'`, `payment_status:'paid'`. Accepted. INSERT ignores conference visibility, application window (`applications_open_at/close_at`), and whether the role's config is enabled.

Impact: an attacker can (a) mark their own application `accepted` and `paid` without paying, (b) forge `assigned_country`/`assigned_committee`, (c) spam applications into any conference by UUID including private ones. If any organizer allocation/export/payment-reconciliation flow trusts `applications.status` or `applications.payment_status` (and `limun` delegate has `must_pay_before_allocation=true`), this bypasses the paywall and pollutes the review pipeline. **Actual session access is NOT granted** (that requires `conference_allocations`, which is safe — see SEC-2), so this is integrity/financial/fraud, not session takeover.

Fix: add a `WITH CHECK` to both the INSERT and user-UPDATE policies pinning `status='submitted'` (or auto-derived) AND `payment_status='unpaid'` AND `assigned_* IS NULL` AND `organizer_note IS NULL` AND `paid_* IS NULL`; validate `conference_id` against an enabled, in-window role config (a `SECURITY DEFINER` insert RPC would be cleaner than trusting client-set `status`).

### SEC-2 — Real access boundary is sound — **PASS**
- `conference_allocations` self-insert → `42501 RLS violation`. ✓ (Cannot grant self a seat.)
- Reading others' `conference_allocations`, `applications`, `application_preferences` → all return `[]`. ✓ (Own-row only.)
- Private conference row hidden from anon (`[]`). ✓
- Bogus role string (`supreme-overlord`) → `23514 applications_role_check`. ✓ (Role enum enforced by CHECK.)
- `conference_reviews` INSERT requires `user_attended_conference(conference_id)` → a non-attendee cannot post fake reviews. ✓

### SEC-3 — Any authed user can create `societies` rows — **LOW**
The apply flow inserts unknown society names into `societies` (no dedupe beyond exact `name_normalized`, no org approval). Enables junk/spoofed delegation names ("Harvard University" typosquats) and mild data pollution. Low.

---

## UX GAPS (prioritized, delegate perspective)

1. **No application-status visibility after applying (HIGH).** The delegate cannot see "submitted / under review / waitlisted / accepted / rejected" anywhere except by manually reopening `/apply`. There is no "My Applications" dashboard across conferences. A parent/advisor asking "did it go through, what's the status?" has no answer in-app.
2. **No confirmation email / receipt (HIGH).** Submitting shows only an on-screen "You're in the queue!" There is no email confirmation of the application and — given payment fields exist — no payment receipt. Delegates expect a paper trail.
3. **No withdraw or edit (MEDIUM).** Once submitted there is no "withdraw application" or "edit answers/preferences" UI. The RLS technically allows the owner to update while `status='submitted'`, but no UI exposes it. Delegates who fat-finger a committee preference are stuck.
4. **Payment is a dead concept in the delegate UI (HIGH).** `fee_amount`, `pay_at_application`, `must_pay_before_allocation`, `payment_status`, `stripe_payment_intent_id` all exist, and pricing copy promises "a 5% Gavelling surcharge applies at checkout" — but there is **no checkout anywhere in the delegate flow**. A `limun` delegate (`must_pay_before_allocation=true`, $95) has no way to pay, so they can never be allocated. This is a journey dead-end.
5. **Required questions look required but aren't (MEDIUM).** See BUG-2 — the "(required)" label is cosmetic.
6. **Society/head-delegate has no team view (MEDIUM).** A delegate can't see who else from their society applied, and a Head Delegate has no roster/coordination surface despite the "help coordinate the delegation" copy.
7. **Documents tab lock gives no timeline (LOW).** "unlock once you receive your allocation" — no ETA, no notification opt-in, no way to know when allocations drop.
8. **No calendar export / visa letter / logistics (LOW).** No add-to-calendar, no invitation/visa-letter request — table stakes for international conferences like a "London IMUN".
9. **Confirmation page is a dead-end for status (LOW).** It links to "View Conference" / "Explore" but not to a status view (because none exists).
10. **Email-confirmation friction on apply day (MEDIUM).** Sign-up → confirm-email → sign-in → apply is a lot of hops with a rate-limited, non-resendable email in the middle.

---

## QUICK WINS

- **BUG-1:** remove `country_name` from the `position_papers` insert in `ConferenceDetailClient.tsx` (one line) — unbreaks position papers. Also handle the insert error (delete the just-uploaded storage object on failure).
- **BUG-2:** add a required-answer check in `handleSubmit()` before insert (block if any `q.required && !customAnswers[q.id]?.trim()`).
- **SEC-1 (highest priority):** add `WITH CHECK` guards to the `applications` "Users create own applications" and "Users update own submitted applications" policies so delegates cannot set `status`/`payment_status`/`assigned_*`/`organizer_note`/`paid_*`. Cheap, high-impact.
- **UX-1:** surface `myApplications[].status` on the conference detail right rail (the data is already fetched) — turn "Applied ✓" into "Submitted / Accepted / Waitlisted".
- **BUG-4:** add a "Resend confirmation email" link on the signup success screen.
- **SEC-3:** dedupe/normalize society names server-side or require organizer approval for new societies.

---

## Rows created by this QA run (left in place as evidence — all traceable to the QA user)

| Table | id / key | Notes |
|-------|----------|-------|
| `auth.users` | `1772eedc-ec6b-45ba-83dc-24e5d5abfdbd` — `qa.delegate.test1@gmail.com` | email confirmed via SQL (documented above) |
| `applications` | `4516c730-f7c0-4349-9160-43d71b543c5c` | limun delegate; later PATCHed to `payment_status=paid`, `assigned_country=France`, `organizer_note=hacked` (SEC-1 evidence) |
| `applications` | `6edad003-a315-46b0-b1fd-127f23f72143` | limun head-delegate; self-`accepted`/`paid`/assigned US at INSERT (SEC-1 evidence) |
| `applications` | `37cdbb73-03ce-4f3f-b6de-83b9ac906063` | PRIVATE conf `gavelling-mun-test-2`; self-`accepted`/`paid` (SEC-1 evidence — apply to invisible conf) |

No existing rows were modified or deleted. No sessions-layer tables were touched.
