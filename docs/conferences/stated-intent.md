<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

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
- **Asked before the insert, and required.** It is step 9 of 10 and the answer rides along
  in `insertRow` as `intent: intentPayload(keys)`, so there is no post-create UPDATE to fail
  and nothing exists yet that a failed write could cost anyone. It was briefly the other way
  round, asked after creation to protect against exactly that; requiring it up front removes
  the risk instead of mitigating it. Continue is disabled until at least one option is picked
  and `readyToCreate` enforces it, so the wizard can no longer produce `skipped: true` at all.
  Settings no longer edits it (owner, 12 Oct 2026: "this is just initial question for us as
  organisers to know"; the card and the dashboard's "Change this" link were removed), so
  nothing in the app writes `skipped: true` any more; rows that already carry it, and `'{}'`
  for conferences never asked, are why the three states below still matter.
- **The wizard around it (24 Sep 2026, a tenth step on 7 Oct 2026).** 10 steps: 1 Your
  conference (name, acronym, logo, banner, dates, one page with a live preview,
  `conferences/new/IdentityStep.tsx`), 2 format, 3 level, 4 where, 5 expected delegates,
  6 committees, 7 description + socials, 8 how delegates pay, 9 intent, 10 review. Step 6
  opens the organiser dashboard's own `CommitteeEditorModal` in DRAFT mode
  (`draft` prop: Save hands the committee back, no chairs section, nothing written until
  Create conference). Any change to that pop-up shows in both places.
- **Step 8, how delegates pay (owner, 7 Oct 2026).** 181 of 302 non-demo conferences had no
  `payment_method` at all. (Since 12 Oct 2026 applications never wait for payments; only
  paying on /pay waits, see "Applications never wait for payments".) Three answers, all real: "It's free" writes `payment_method: 'manual'` with a
  fixed `external_payment_note` ("This conference is free."); "A payment link or
  instructions" writes `'manual'` plus the ONE thing they typed, as `external_payment_url`
  when it reads as a web address, else as `external_payment_note` (`paymentLinkValue` in
  `conferences/new/page.tsx` decides, always stores a link as `https://`, and the field's
  `maxLength` is 500, so `conferences_external_payment_url_https` and
  `conferences_external_payment_note_len` can never refuse the insert); "I'll set this up
  later" writes NOTHING, exactly the behaviour before the step existed. It rides along in
  `insertRow` (`...paymentColumns`, an empty spread for "later"), `readyToCreate` requires an
  answer, and there is a ReviewRow. It asks the METHOD and never a price: the wizard still
  asks no amount, and applications still start closed.
- **The conference is PUBLISHED on create (owner, 7 Oct 2026): "so many conferences get left
  in the draft even though they are fully ready to be published".** 216 of 302 non-demo
  conferences had NEVER been published, 95 of them created in the last 30 days, and 32 were
  already collecting applications while invisible to every applicant. So `handleCreate`
  publishes, and Settings → Privacy takes it back to private in one switch (that direction is
  never gated, which is the owner's "they can always bring private afterwards").
  **It is a SECOND write, never part of the insert**: that insert is all-or-nothing and
  aborts the whole creation on any refusal, and two database rules can refuse a publish
  (`conferences_tbd_not_public`, and a publish payment gate before 12 Oct 2026), so a
  refusal inside it would cost the organiser every step they filled in; the
  `expected_delegates` comment in that file is the scar from exactly that. As a separate
  `.update({ is_public: true, status: 'public' }).eq('id', …).select('id')` after the
  conference AND its committees are saved, a refusal costs nothing: it is **swallowed**
  (a `console.warn`, never an error on screen, never retried), the conference stays a draft,
  and the dashboard checklist's own "Publish your conference" row says what to do. On success
  it pings `/api/indexnow` fire-and-forget, exactly as the dashboard's `PublishModal` does.
  **It is attempted, not preconditioned on `conferencePaymentsReady()`** (payments never
  block publishing since 12 Oct 2026). **TBD dates are attempted
  too since 12 Oct 2026** (next bullet); the review step's last line says the conference goes
  live, listed under Dates to be decided when it has no dates.
- **Dates to be decided are public (owner, 12 Oct 2026).** A conference with `dates_tbd` or no
  `start_date` becomes public like any other: the wizard attempts the publish, Settings →
  Visibility and `PublishModal` no longer refuse it, the dashboard checklist no longer says it
  "can't be published" (the 'page' item still needs real dates to be done, it is a verification
  stage). `hasNoDates(c)` and `DATES_TO_BE_DECIDED` in `src/lib/conferenceDates.ts` are the one
  test and the one wording ("Dates to be decided") on every public card, row, hub list and the
  conference page. **The database half is applied** (12 Oct 2026, migration
  `tbd_conferences_may_be_public`): the CHECK `conferences_tbd_not_public` is dropped, so a TBD
  conference publishes on create like any other. `scratch-tbd-public.sql` still carries,
  commented out, the one UPDATE that would publish the 63 existing never-published TBD
  conferences (owner's call, not run). Spotlights stay dated only
  (`book_spotlight` / `hold_spotlight_days` / `featured_conferences` skip TBD on purpose).
- **Wizard drafts and listing without an account (owner, 12 Oct 2026). The SQL is APPLIED
  (migration `conference_drafts`, 12 Oct 2026); the reminder cron is NOT scheduled**: `scratch-conference-drafts.sql` (table `conference_drafts`, RLS on, no policies,
  no grants; RPCs `save_conference_draft`, `load_conference_draft`,
  `stop_conference_draft_reminders`, `delete_conference_draft` (anon + authenticated),
  `my_conference_drafts`, `claim_conference_drafts`, `finish_conference_draft`
  (authenticated), `queue_conference_draft_reminders(p_preview default TRUE)` (owner /
  service role; TRUE inserts nothing, FALSE SENDS), no cron scheduled: that needs Peter's
  go). Until it is applied every call answers `missing` and the wizard is exactly as before
  (signed-out visitors go to sign in, progress lives in React state). Once applied:
  - **Autosave.** `conferences/new/useConferenceDraft.ts` (wrappers in
    `src/lib/conferenceDrafts.ts`) saves every answer as one JSON object (`draftData` /
    `restoreDraft` in the page, plus the conference id minted at mount, because uploads went
    under it) about 1 s after a change, at once on a step change, and by a keepalive fetch on
    `pagehide`; a quiet "Saved" sits bottom left (`DraftChrome.tsx`). It resumes from
    `?draft=<token>` or this browser's token (`localStorage gavelling-conference-draft`) at the
    saved step, then strips the token from the address bar. Signed-in drafts are created only
    once a name is typed or step 1 is passed.
  - **Signed out.** A new first screen, `EmailStep.tsx` (step 0, outside the 10-step count):
    "Where Should We Save Your Conference?" with the privacy line under the field. The server
    mints the 64-hex token on the first save. Logo and banner uploads still need an account
    (they open the sign-in pop-up). "Sign in and create" on the review step saves, opens
    `openAuth` with the email prefilled, and a sessionStorage flag creates the conference
    once they are back and the pop-up has closed (`useBasicsGateBlocking`). Signed-in users
    never see the email step; their account address is used.
  - **Ownership.** A draft becomes an account's only by its browser token (a signed-in save or
    load) or by the VERIFIED auth email (`claim_conference_drafts`, run by My conferences and
    on the wizard's first load), never by a typed email. A claimed draft opened by anyone else
    answers `sign_in` / `not_yours` and never its answers. Limits: 512 KB of data, 240 saves
    per token per 10 minutes, 3 new drafts per email per day, 5 open per email, 500 new
    anonymous drafts per hour, 5 email changes per token.
  - **Shown like application drafts.** My conferences carries "Finish listing"
    (`account/conferences/ConferenceDraftsSection.tsx`) above "Drafts to complete": logo,
    acronym over name, step, last edited, Continue (`/conferences/new?draft=<token>`) and
    delete. The profile menu is not changed (owner decision).
  - **Four reminders**, each a different true benefit (pay nothing; applications, allocations
    and payments in one place; live rooms with the free session tool; a public page and
    Spotlight on Explore) at 1 hour, 1 day, 4 days and 10 days after the last edit, through
    `email_outbox` with the house template (`gavelling_email_html`, whose unsubscribe mark the
    outbox trigger fills), from "Peter at Gavelling". Only drafts with a name; stops when
    created, deleted, `?stop=1` (`/conferences/new?draft=<token>&stop=1`, safe on GET,
    disallowed in robots), opted out, a failed address, or an account with reminders off. A
    typed name that looks like a link is replaced by "your conference". `?draft=` is noindex.
- **The founders' thank-you (owner, 12 Oct 2026).** After Create conference the wizard lands on `/manage/[slug]?welcome=1`; `src/components/conferences/FoundersWelcome.tsx` (mounted on the dashboard) strips the flag with `replaceUrlInPlace`, shows ONCE per conference per browser (`localStorage gavelling-founders-welcome:<conference id>`) a pop-up with the cut-out photo of Peter and Christian rising out of its top edge (`public/founders/peter-christian.webp`), a short thank-you and Peter's personal number (+44 7478 115292: call, WhatsApp, Copy). Writes nothing. The same number is already in every organiser set-up email (`send-setup-nudges`, signature and body; Christian's on the day-7 email).
- **Intent reorders, it never removes.** `intentRank` sorts the dashboard's *pending*
  checklist rows only. `doneCount`, the ring, the progress bar and `SetupCompletionNotices`
  all keep reading the full unfiltered checklist so they cannot disagree with it, and
  `store` stays pinned last (it was `publish` before checklist v2). Dropping a row would be a real bug: `financials` gates both
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
