# GAVELLING.COM: CLAUDE CODE RULES DOCUMENT
## The Absolute Truth About How This App Works
### For Claude Code and Claude.ai. Read before touching anything

This is the rulebook for the live-session runtime: `/create`, `/join`, `/chair/[code]`, `/delegate/[code]`, `/advisor`, `/voting/[code]` and `src/lib/committeeService.ts`. CLAUDE.md is the map of the whole product. Every section here ends with a pointer to its long form in `docs/sessions/`, which holds the history, the owner's quotes and the verification notes. The full previous version is `docs/history/AGENTS.md.2026-10-17.md`.

---

## INFRASTRUCTURE

- **Supabase project:** `luruhkwrgisytejswlas` (us-west-2). There is no `supabase/` directory in git: inspect the live schema before assuming a column exists.
- **Repo:** `github.com/MrCoolZakhar/debate.com`
- **Branches:** all work lands on `feature/conferences-auth`. Production deploys from `claude/muncommand-recreation-9yjin` (Vercel, gavelling.com) and is touched ONLY when Peter says "push to production".
- **Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Supabase.
- **Workflow:** `git pull` before starting, `npm run build` before committing, commit and push to `feature/conferences-auth`.

Long form: docs/sessions/infrastructure.md

---

## DATABASE TABLES (DO NOT MODIFY SCHEMA WITHOUT EXPLICIT INSTRUCTION)

| Table | Purpose |
|-------|---------|
| `committees` | One row per session: phase, caucus (JSONB), settings (JSONB), topic, suspended_at, ended_at, expires_at, resuming_chair, chair_names, session_origin |
| `delegates` | One row per seat. Status absent / present / present-voting, `is_observer` |
| `speakers_list` | GSL queue (`list_type='gsl'`) AND caucus queue (`list_type='caucus'`). NEVER mix these |
| `current_speaker` | One row per committee: who speaks now, `time_remaining`, `started_at`, `time_granted`, `seated_at` |
| `motions` | Pending motions, plus the `join-request` and `gsl-request` pseudo-types; `status` pending / approved / denied |
| `documents` | Working papers and draft resolutions, `approval`, `intro_state`, `vote_state` (JSONB) |
| `messages` | Chat, plus the scoring ledger (sender `__system__`, recipient `__log__`) and system rows (sender `__system__`: group definitions and edits, recipient `__group__`) |
| `feedback` | Chair notes and factor ratings (`level` speech or document) |
| `session_broadcasts` | Organiser broadcasts and press releases shown in Everyone and as chair cards |
| `delegate_seat_claims` | One holder per seat (RLS on, no policies, RPC only) |
| `delegate_seat_kicks` | 10-minute tombstones written by `kick_delegate_seat` |
| `chair_device_claims` | One device per signed-in chair account per committee |
| `delegate_status_log` | Roll-call history, written by a trigger on `delegates` |
| `document_device_votes`, `document_device_ballots` | Device ballots: choices hidden until the reveal |
| `committee_analytics` | Archive written by the BEFORE DELETE trigger when a room is deleted |

Long form: docs/sessions/database-tables.md

---

## CRITICAL ARCHITECTURAL RULES: NEVER VIOLATE THESE

### RULE 1: GSL and Caucus Queue are STRICTLY SEPARATE
- `speakersList` (list_type='gsl') = General Speakers List. PERMANENT. Survives caucuses, never wiped by any motion.
- `caucusQueue` (list_type='caucus') = caucus speaker queue. TEMPORARY. Wiped when the caucus ends.
- **NEVER** add GSL delegates to caucusQueue or vice versa. **NEVER** wipe, reorder or remove from speakersList when accepting a caucus motion; the one write is putting an interrupted GSL floor holder back at its FRONT (see MOTIONS MODAL, `src/lib/gslFloorReturn.ts`). When a caucus ends, ONLY caucusQueue is cleared.

### RULE 2: currentSpeaker is NOT in speakersList
- `handleNextSpeaker` POPS the next delegate from speakersList into currentSpeaker, a separate row in `current_speaker`.
- currentSpeaker ALWAYS displays as position #1 in the queue panel; speakersList delegates are #2, #3, and so on.
- currentSpeaker is NEVER re-added to speakersList (`gslListIds` includes their delegateId).

### RULE 3: speakerTimeRemaining is an ISOLATED useState atom
- `speakerTimeRemaining` lives in its own `useState`, NOT inside the committee object. The timer interval only updates this atom. It NEVER calls setCommittee and NEVER calls updateLocal.

### RULE 4: localUpdateTime debounce clock
- `localUpdateTime` is a module-level ref, set by `updateLocal(setCommittee, updater, structural=true)` when structural is true.
- **All realtime → state flows through `startSessionSync` (`src/lib/sessionSync.ts`)** on the chair, delegate AND voting pages.
  - Each event marks ONE slice dirty (`committees` → the row only via `getCommitteeRowById`, `delegates`, `speakers_list` → both lists, `current_speaker`, `motions`, `documents`). Dirty slices are fetched once, about 200 ms after the first event.
  - **One sequence counter PER SLICE.** A result of slice X is dropped only when a NEWER result of X has already been APPLIED (`appliedSeq`). NEVER go back to one shared `fetchSeq`: under a burst every fetch is overtaken and the slice starves.
  - `messages` are never refetched on an event: the INSERT payload is merged by id (`messageFromRow` + `mergeMessagesById`, which compares by content and returns the previous array when nothing changed). Only a catch-up refetches them.
  - A failed slice read is `null`, never `[]`, is never applied, and is retried twice.
  - **The floor holder is dropped from the GSL only outside a moderated caucus**: `withCurrentSpeaker` / `withLists` and `getCommitteeByCode` drop the current speaker from `speakersList` as a transient duplicate only when `gslDedupeApplies(committee)` (phase not `moderated-caucus` and caucus not moderated). In a moderated caucus the current_speaker row is the CAUCUS speaker, who may also hold a GSL place. The delegate page marks the `lists` slice dirty whenever the floor changes hands.
  - Catch-up: on re-SUBSCRIBED, `visibilitychange` to visible, `online`, and a heartbeat gap over 10 s, every slice is refetched through the same sequencing. Catch-ups are throttled to one per second; `catchUp(only, { force: true })` skips the throttle for a caller that KNOWS its state went stale, and every SUBSCRIBED catch-up is forced. `onCatchUp` reports `'failed'` when every read failed and `isFresh()` stays false until one succeeds. `ConnectionPill` reads Live / Reconnecting / Offline from it.
  - Vote saves fire one `documents` event per write; it is coalesced like any event and fetches ONLY the documents slice.
  - `subscribeToCommittee` takes a `tables` list (default all nine: committees, delegates, speakers_list, current_speaker, motions, documents, messages, feedback, session_broadcasts). The delegate page passes everything but `feedback`.
- Every page loader has a `cancelled` guard: an unmount or a `code` change mid-load starts no state writes, sync, heartbeat, listeners or channel.
- **Chair page apply rules** (the `apply` callback in the chair loader):
  - `localWriteSeq` (module-level, bumped by EVERY `updateLocal`, never by a tick) is stamped on each fetch. **A fetch that returns after a local write it predates is never applied over that write**; the slice is fetched again 250 ms later.
  - `debounceLeft()` = what remains of `Date.now() - localUpdateTime.current < 3000` (always 0 for a Commenter).
  - Row inside the window: merges ONLY the gavel (`dbHeadChair`, `dbHeadChairDevice`), `chairNames`, `resumingChair`, `endedAt` and a suspend change; phase / caucus / topic / settings are fetched once more when the window closes. Stale row: only `chairNames` and `endedAt`. Lists inside the window are not fetched; the fetch is scheduled for when the window closes. Delegates (with `applyPinnedStatuses`), documents and motions are applied inside the window.
  - Outside the window with the Moderator's speaker clock running: the row lands but keeps local `phase`, `caucus`, `speakerTimeLimit`.
  - `current_speaker`: a Commenter patches it on every event; the Moderator ignores its events (RULE 6) and reads the row back only on a catch-up, never while its clock runs.
  - One-off full resyncs (the gavel-handover resync, the three resume refetches) go through `fetchCommitteeGuarded(code)`, which reports `stale` when `localWriteSeq` moved; a stale snapshot is never merged, they call `catchUp(undefined, { force: true })` instead.
- **Automatic Moderator writes check freshness first.** The moderated-caucus expiry effect and the stop-at-zero re-anchor call `isFresh()`; while a catch-up is outstanding they stand down and run again on `catchUpTick`. The expiry write is `endModeratedCaucusIfAnchorUnchanged` (phase + caucus in one update, only while the row is still `moderated-caucus` with the same `caucus.totalStartedAt`; zero rows because the caucus moved on is `'skipped'`, zero rows while the row STILL matches is `'failed'`), issued from the effect body, never inside a `setCommittee` updater.
- **TIMER TICKS MUST NEVER SET localUpdateTime** and **NEVER set structural=true on timer tick operations.** Caucus queue mutations DO use structural=true.
- **The gavel knock is a read-only side effect of the timers.** `useGavelCue(remaining, running, cue, anchorIdentity)` (`src/lib/useGavelCue.ts`) watches values that already exist with refs only and calls `playGavelKnock()` (`src/lib/gavelSound.ts`, Web Audio, no file). It never calls setCommittee / updateLocal, never sets `localUpdateTime`, never writes. A knock needs a GENUINE countdown step: two consecutive RUNNING samples straddling the mark with the SAME anchor identity, a drop of at most `GAVEL_MAX_STEP_SECONDS` within 3 s, only in the tab the chair last interacted with (`localStorage gavelling-gavel-knock-tab:<CODE>`), Moderator's device only, never when ended or suspended. Pausing, starting below the mark, reloading, Next, Restart, extra time and catch-ups never knock.
- **`feedback` is handled BEFORE the debounce check and returns early**, beside `session_broadcasts`. The handler bumps `feedbackVersion`; the two readers (comment dock, scoreboard) own their own queries. The chair page's `onCatchUp` also bumps `feedbackVersion` on every catch-up that ends `'done'`.

### RULE 5: Optimistic Updates Pattern
- ALL chair actions use `updateLocal(setCommittee, updater)` first; the DB write is fire-and-forget. Exception: when the real DB UUID is needed back (`addPendingMotionInDB`, `addDelegate`).
- **Every session write reports whether it LANDED.** supabase-js resolves on an RLS rejection and returns `error: null` for a zero-row update, so each non-settings write in `committeeService.ts` asks for `.select('id')`, counts rows, and resolves `Promise<boolean>`. A DELETE that removed nothing re-reads the row: still there = refused, gone = success. A conditional write that matched nothing (`updateCaucusIfUnchanged`, `stopSpeakerAtZeroIfUnchanged`, `clearCurrentSpeakerIfUnchanged`, `pauseSpeakerClockLive`, a stale second End) re-reads: no longer matching is `'skipped'`, still matching is `'failed'`.
- All run through `runWrite` (`src/lib/writeStatus.ts`). Idempotent writes (phase, caucus, `setPhaseAndCaucus`, the speaker clock, list add / reorder / caucus clear, suspend, end) retry with backoff, 3 attempts, and a newer write with the same key supersedes an older one still retrying. Non-idempotent writes (motion INSERT, `grantSpeakerTime`, list / motion delete, a delegate status tap) are reported but never auto-retried. Retries of chained writes stay INSIDE their chain.
- **Nothing retried lands after a break.** `setPhase`, `setPhaseAndCaucus`, `updateCaucus` and `updateCaucusIfUnchanged` are conditional on `ended_at is null and suspended_at is null`; no caller writes a live phase or caucus during a break. Writes that belong to the break are `survivesLifecycle` and exempt: `clearCurrentSpeakerIfUnchanged` and `pauseSpeakerClockLive`.
- **Toast Retry never re-runs a write out of context.** `runWrite(..., { rerunnable: false })` failures show "Not saved" with Dismiss only: `suspendDebate`, `endDebate`, `reopenEndedSession`, `pauseSpeakerClockLive`, `clearCaucusList`. A landed write clears stale failures of its key; a landed PHASE write clears every stale failure of the committee.
- A bulk roll call (`set_delegate_statuses`) falls back to per-row writes ONLY on `PGRST202`. A refused status write unpins the rows and refetches the delegates slice.
- The chair page mounts ONE `SaveStatusToast`. Never add a second per-button error toast for these writes.
- The boolean is handled asynchronously and only where a rollback is needed: End Debate and Suspend (`runBroadcastEffect`, MotionsModal's Suspend / End "Yes") put phase / suspendedAt / endedAt / expiresAt back on false.
- `reorderSpeakersList` reads the list order back after the RPC and reports a mismatch as `'failed'`.

### RULE 6: current_speaker subscription is SKIPPED
- The Moderator's session sync ignores `current_speaker` events (`wants: table !== 'current_speaker' || isViewOnly`). The Moderator owns that row. Commenters DO process them. The Moderator reads the row back only during a catch-up, never while its clock runs.

### RULE 6b: Clocks run on the DATABASE clock, and anchors move in single writes
- **Never use `Date.now()` / `new Date()` against a session timestamp.** Stamp anchors (`current_speaker.started_at`, `caucus.totalStartedAt`, `suspended_at`, `ended_at`, `expires_at`) with `serverNowIso()` and compare with `serverNow()` from `src/lib/serverClock.ts` (offset measured against the `server_now()` RPC on load, `online` and tab-visible). `caucusRemainingNow`, `speakerRemainingNow`, `moderatedCaucusRemainingNow`, `spokenSecondsFromAnchor` and `anchorCaucusClock` default to it. Purely local timers (presence, pins, rate limits) stay on `Date.now()`.
- **Pause is ONE write**: `pauseSpeakerTimer(id, liveRemaining, ...)` writes `{ started_at: null, time_remaining }` together. Never `stopSpeakerTimer` + `syncSpeakerTime`. Restart is one write too: `syncSpeakerTime(..., stop=true)` writes `{ time_remaining, time_granted, started_at: null }`.
- **No speaker clock runs outside the GSL and the caucus phases**: `setPhase` / `setPhaseAndCaucus` to `pre-session`, `adjourned` or `voting`, `suspendDebate` and `endDebate` all call `pauseSpeakerClockLive`.
- **Phase and caucus change in ONE update**: `setPhaseAndCaucus(id, phase, caucus, ...)`, used by every caucus end and every caucus accept.
- **Speeches are logged from the persisted anchor**: `current_speaker.time_granted` holds the slot plus every +time. `nextSpeaker` sets it to the slot, `syncSpeakerTime(..., timeGranted)` resets it, `grantSpeakerTime` adds and re-anchors in one write. `readSpokenSeconds` reads `time_granted - live remaining` on the current_speaker chain.
- **ONE speech logger: `src/lib/floorSpeech.ts`.** `logFloorSpeech(committee, clock)` is the only way a floor speech is written, from every path: Next (GSL and caucus), Finish, a caucus accepted over a speaker, a moderated caucus ended by hand or expiry, Suspend / End Debate. The Consultation of the Whole floor holder uses `logTimedSpeech` with `cowTurnKey`. A GSL floor holder interrupted with time left is HELD instead of logged and logged once, whole, when the resumed turn ends (`src/lib/gslFloorReturn.ts`, see GSL); a held part that can no longer resume is logged by `settleHeldFloors` through `logTimedSpeech` with the SAME turn key. A Room Order Tour de Table is credited once at its end by `creditRoomOrderTour`. Never log a `speech` through `logEvent`. Two guards: `logFloorSpeech` never logs while the room is in `unmoderated-caucus`, and `logTimedSpeech` with context `unmoderated-caucus` writes only when `caucus.isConsultation` is true and the key is a `cowTurnKey`. A GSL yield is logged by `logYield`, never as a speech.
  - Seconds: `readSpokenSeconds` first; the device-local fallback only for rows written before `time_granted` existed. Call `logFloorSpeech` synchronously AFTER any pause write and BEFORE the Next / clear, so its read is queued between them. Pass the clock anchor from BEFORE the pause.
  - Idempotency, EXACT by key: `turnKey` = committee + speaker + `seat:<epoch ms of current_speaker.seated_at>`. `nextSpeaker(..., seatedAt)` stamps `seated_at` on every seating and every clear nulls it. Epoch ms, because the Moderator holds "...Z" and readers get "...+00:00". Rows seated before the column existed fall back to the old `s:` / `p:` key, compared within 15 s only in `parseLogEvents`.
  - A path that logs a speech and does not seat a new speaker MUST clear the floor (conditional clear), or a later Next logs the same turn again.
- **Every current_speaker write rides one per-committee chain**, including the conditional clear and the anchor read: conditional on the speaker's identity, and ordered.

### Offline resilience
The Moderator's laptop on dropped venue Wi-Fi. **Kill switch:** `OFFLINE_RESILIENCE` in `src/lib/offlineResilience.ts`; `false` restores the behaviour before it. RULES 3 to 6 are untouched: nothing here runs per second, touches `updateLocal` / `localUpdateTime`, or reads current_speaker events for the Moderator.
- **Network-class vs refusal.** `failedFrom(error)` (`writeStatus.ts`) returns `'failed-network'` when `isNetworkClassError` says no answer came back (fetch failure wording, our timeout, a gateway status 502 / 503 / 504 / 52x / 530 on a WRITE, `PGRST002`), else `'failed'`. A bare TypeError from our own code and a 500 are NOT network-class. Callers only ever see `'ok' | 'skipped' | 'failed'`.
- **What parks.** A `runWrite` with `retry: true` and rerunnable whose three attempts all ended network-class is PARKED: its promise stays pending (a chain keeps its order behind it) and it is tried again on `online`, tab visible, every catch-up start (`nudgeParkedWrites`) and every 5 s. It ends when it lands, becomes a correct no-op, is superseded by a newer write with the same key, is cancelled, or is dropped (role loss). A REAL refusal on a retry takes the ordinary "Not saved" path. Parks: phase, caucus, `setPhaseAndCaucus`, the conditional caucus writes, begin-session, speaker-limit, the speaker clock writes, Next, the conditional floor clear, stop-at-zero, list add / reorder / removal, log inserts, chair roll-call writes, observer placards, the topic, the agenda pick and key-level settings patches.
- **What does NOT park:** Suspend / End Debate, the reopen, the live pause and the caucus list clear (`rerunnable: false`: landing minutes later would act out of context), and every non-retried write.
- **Roll call** (`setDelegateStatus`, `setDelegateObserver`, `setDelegateStatusesBulk` with explicit ids): each press is recorded in `src/lib/pendingRollCall.ts` (`claimRollCall`, newest value per (row, field)); an older write that no longer owns its row ends `'skipped'`. Every chair status and placard write of the committee rides ONE chain (`rollCallChain(code)`). `overlayPendingRollCall` lays pending values over every fetched roster. The ledger is per tab in `localStorage gavelling-pending-roll-call:<CODE>:<tabId>`; `resumePendingRollCall` re-issues it after a reload and on `online` (a press older than 3 hours is not re-issued); `settleRollCall` is called whatever the outcome.
- **List removals** are idempotent (`retry: true`; a row already gone is `'skipped'`). **Topic** (key `<id>:topic`) and **agenda** (its OWN key `<id>:agenda`) are `retry: true`, false only on a refusal. **Settings patches** are parked with per-key ownership: an attempt sends only the keys it still owns, and a late landing counts as this device's echo (`noteFlushedSettings`).
- **Log rows** (`insertLogRows`): each `messages` row gets a client uuid and the insert is a retried, parkable `runWrite`; `23505` = landed. Log inserts are `keepOnRoleLoss`. MotionsModal's Suspend / End "Yes" writes the `motion-passed` and `fell` rows only after the break resolved true.
- **Speech seconds when the clock write is stuck**: if a current_speaker write of the room is stalled (`speakerWriteTrouble`) when `logFloorSpeech` is called, it uses the press-time local seconds (`floorSpeechSeconds`) instead of the read-back.
- **Cancel only once the break LANDED.** `suspendDebate` / `endDebate` take `issueMark()` and cancel NOTHING before the break. Only when it resolved true does `cancelWritesIssuedBefore(keys, mark)` cancel every phase / caucus / speaker write issued before it. Safe because every phase / caucus writer is conditional and every `speaker` write rides the current_speaker chain. `survivesLifecycle` writes are exempt.
- **Role loss.** The ROLE TRANSITION effect calls `dropParkedWrites(committeeId, code)` when this device loses the gavel or is kicked: every write of that committee it issued ends `'skipped'`. Roll-call writes carry `scope: rollCallScope(code)` so the code drops them too. Log rows are exempt.
- **Timeouts.** `sessionClient` and `sessionReadClient` use `resilientFetch`: writes / RPCs abort after 20 s, GET after 12 s (named AbortError so postgrest-js does not re-run it), the timer covers the BODY. `sessionClient(code, suffix, { timeout: false })` opts out: `CommitteeEditorModal`, `createCommittee`, `batchAddToCaucusList`. The initial load gives up after 15 s per attempt (owner, 23 Oct 2026): `getCommitteeByCodeResult` races each attempt against `COMMITTEE_LOAD_TIMEOUT_MS` and answers `'error'` (never `not_found`), so the retries and the `session_load_failed` Try again screen take over; the access check in `useSessionAccess` gives each read 15 s too, a timeout being `{ kind: 'error' }` / null (not a verdict: a settled `allowed` / `standalone` is kept). Message history, join lookup, realtime, auth and every conference client are unchanged.
- **Slice protection (chair page, Moderator only).** `beginPendingWrite` counts every write from issue to settle, per committee and slice (row, lists, currentSpeaker). A held slice is treated like the debounce window, refetched at the latest every 2 s, and fetched once more the moment its last pending write settles (`createPendingSliceGuard`). Commenters, delegates and the voting page are never held. Honest limit: while a parkable write keeps failing, a held slice keeps `isFresh()` false, so automatic writes stand down until it lands.
- **Toast.** While anything is parked, `SaveStatusToast` shows `session_save_offline` with no buttons; a real failure is never hidden by it. A parked write is logged once when it parks and once when it ends, never per attempt.
- **Clock.** `serverClock.ts` stores the last offset in `localStorage gavelling-server-clock-offset` and starts from it on the next load (ignored after 7 days or beyond ±2 days) until a fresh measurement succeeds; `serverClockMeasured()` stays false until then.

Long form: docs/sessions/critical-architectural-rules-never-violate-these.md

---
## FEATURE: GSL (General Speakers List)

### How it works
- Delegates join speakersList through `AddSpeakerInput` (chair) or a GSL request (delegate asks, chair approves). Start runs the clock for currentSpeaker. Next logs the speech, pops the next delegate into currentSpeaker and shrinks speakersList by one. The timer is the isolated `speakerTimeRemaining` atom (RULE 3).

### Rules
- currentSpeaker can NEVER be re-added to speakersList. A delegate who goes absent is removed from speakersList AND caucusQueue, except during the pre-session roll call. The GSL is NEVER wiped when entering a caucus.
- **The GSL may always elapse.** `gslRequireNextSpeaker` has NO effect: nothing reads it and Settings has no row for it; it stays on the type so old rows load. Start is blocked only below quorum; Finish is always offered on the last speaker.
- **Finish**: with an empty GSL behind the speaker, Next becomes Finish (Moderator only). `handleYieldFloor` logs the speech through `logFloorSpeech` and clears the floor like Next with nobody queued.
- `handleRemoveFromSpeakersList` ignores presses for `LIST_SWAP_GUARD_MS` after a moderated caucus ends, because the sidebar swaps from the caucus queue to the GSL under the chair's pointer.
- **Auto start** (`autoStartSpeakerTimer`, default off): Next (GSL), caucus Next and a Tour de Table advance seat the next speaker WITH the clock running, ONE `serverNowIso()` stamp as both `seated_at` and `started_at` in the same single `nextSpeakerInDB` update; in a caucus the total is re-anchored running from the same stamp in the same caucus write. Read at press time (`autoStartOn()`), never below quorum, suspended or ended.
- **Yield** (`src/components/YieldPopover.tsx`; Moderator, GSL, a seated speaker with time left) gives away the REMAINING time, never more. To the next speaker: `handleNextSpeaker({ yieldBonus, run })` seats them with `speakerTimeLimit + remaining` as the slot in one write. To another delegation: pause at the live value, `handleYieldFloor`, then the panel times the recipient LOCALLY like Right of Reply. Both write ONE `yield` ledger row through `logYield`, idempotent by `yieldTurnKey`; it scores nothing. Known limit: Restart after a yield reseats the plain limit.
- Extra time re-anchors the speaker clock in one `current_speaker` write per press. In a moderated caucus the grant is capped to the room between the live speaker clock and the live total (`moderatedCaucusRemainingNow`); the total is never extended and is re-anchored at its live value first.
- **Changing the speaking time on the GSL** (`handleSetSpeakerTimeLimit`, owner 23 Oct 2026) resets the seated speaker to the new limit with the clock STOPPED, in ONE `syncSpeakerTime(..., stop=true)` write like Restart (extra time cleared); an unchanged value writes nothing. In a caucus only the limit is stored.
- **Right of Reply** is an INDEPENDENT movable overlay with its own `rtrTimeRemaining`. It NEVER writes `speakersList` or `currentSpeaker`; it logs a `right-of-reply` event and nothing else.
- **On deck: the floor is never empty while the list is not.** With nobody seated and a non-empty GSL the chair page draws `speakersList[0]` (`onDeck`) at the speaker time limit (a HELD delegation at its held `remaining`, see the held floor below). **Nothing is written for this**: they stay an ordinary `speakers_list` row. Start calls `handleStartOnDeck`: optimistic seat + clock, then ONE current_speaker update `nextSpeakerInDB(..., seatedAt, startedAt)` with the same stamp for both. While a delegation is on deck, Next is `aria-disabled` and never skips past them. Add time on deck adds to `onDeckGrant` (no write, no log); Start then seats them with `speakerTimeLimit + grant`, so `time_granted` starts at the extended slot. The sidebar mirrors it (`gslReadyDelegateId`). Removing the seated speaker puts the next delegation on deck at once.
- **The held floor: an interrupted GSL speaker comes back with exactly the time they had left, as ONE speech** (owner, 18 Oct 2026: "coming back still has the same time remaining and doesn't skew with the amount of times they spoke"). On caucus accept, Suspend Yes and an organiser pause the GSL floor holder goes back to the FRONT of the GSL (see MOTIONS MODAL) and the interrupted part is held, not logged: `holdInterruptedGslSpeaker` writes `committees.settings.gslHeldFloors` (`[{ delegateId, country, remaining, granted, seatedAt, heldAt }]`, a key-level `patchCommitteeSettings`, parkable; read only from the row as `committee.dbGslHeldFloors`, overlaid on the Moderator by `heldFloorsOf` until its patch lands): `remaining` = the live seconds at the press, `granted` = `current_speaker.time_granted` (read on the current_speaker chain before the clear by `readSpeakerGrant`; local `speakerTimeLimit + extraSecs` when that read fails or a speaker write is stalled), `seatedAt` = the ORIGINAL `seated_at`. On deck the floor clock (and `CommenterClock`) shows `remaining` (+ any `onDeckGrant`). **Resume**: Start on deck (`handleStartOnDeck`) and Next (`handleNextSpeaker`, a yield bonus included) seat a held delegation in the SAME single `nextSpeakerInDB` update with `time_remaining = remaining (+ grant / bonus)`, `time_granted = granted (+ grant / bonus)` (the new `timeGranted` argument) and `seated_at = the original seatedAt`, then `releaseHeldFloor`. Same turn key, so `logFloorSpeech` logs ONE speech of every second spoken; a re-interruption holds again with the same nonce. **Safety net**: a chair-page effect (Moderator device, phase `speakers-list`, no caucus, not suspended or ended, `isFresh()`, outside the debounce window, judged `HELD_FLOOR_SETTLE_DELAY_MS` after the state) calls `settleHeldFloors(c, 'orphaned')`: a hold whose delegation is neither on the GSL nor seated under its nonce is logged once (`granted - remaining` s, same turn key, `logTimedSpeech`) and dropped. End Debate (End Yes, the organiser END, the voting page's End) calls `settleHeldFloors(c, 'all')` first. Honest limits: Restart on a resumed speaker reseats the plain slot (its grant resets, so the part before the interruption is not counted, like any Restart); a room abandoned with a hold and never ended keeps the held part unlogged. A clock already at zero, a caucus speaker, a legacy row with no `seated_at` and End Debate put nobody back on hold (they are logged as before).
- **Speaker buttons never disappear** (`src/components/SpeakerControls.tsx`): Restart, Start / Pause, Next (or Finish) and Add time render for the Moderator on the GSL and the moderated caucus with or without a speaker; unavailable ones are `aria-disabled` with a reason. **The countdown is a start / pause button** (`SpeakerClock`) calling the SAME `handleToggleTimer`. Presentational only; every handler is the chair page's.
- **The RTR and Add time popovers** (`DraggablePopover`, Portal into `#fit-root`) sit BELOW every dialog (z 40 / 41; dialogs are 50+) and are never moved by one. Both may be open at once and both STICK until `floorCloseKey` changes (phase, suspend / end stamps, caucus identity); the floor speaker is NOT in the key, so `addTimeHasTarget` disables Add time without a target. Keep new floor dialogs at z 50 or above and never raise these panels past 49.
- **Removing the speaker holding the floor** (`handleRemoveCurrentSpeaker`: the strip X, the sidebar row, or the speaker going ABSENT outside pre-session; Moderator only, not ended or suspended). Order on the current_speaker chain: pause at the live value, `logFloorSpeech` (skips 0 s and Room Order), `clearCurrentSpeakerIfUnchanged`. In a moderated caucus the total is re-anchored PAUSED with `caucus.currentSpeaker: null`. The caucus strip draws the seated caucus speaker at #1 with the same X; its `onReorder` strips the floor holder back out so a drag can never insert them into `caucusQueue`.
- `SpeakerStrip` reorders by pointer events, tracked by delegate id, never before the floor speaker, one `onReorder` on release.
- **No ghost speaker** (owner, 23 Oct 2026): when the floor holder's seat no longer exists (an organiser removed it in Manage → Committees; `current_speaker.delegate_id` is SET NULL and the country stays), the Moderator's device clears the floor ONCE through `handleRemoveCurrentSpeaker` (`floorGoneKey`, chair page; never a Room Order placeholder, never in a roll call or a break, only when `isFresh()`). The editor itself asks in place first when a removed seat is speaking, listed or in an open vote, and clears the floor of that seat before the delete (`src/lib/liveSeatRemoval.ts`).

### DB operations
- `addToSpeakersList(…, at = 'end' | 'start')` / `addToCaucusList(…)` call the `speakers_list_add` RPC, which assigns `max(position)+1` (or `min-1`) under a per-(committee, list_type) advisory lock. **NEVER pass a client-computed position**: two rows with one position reshuffle on every refetch. SECURITY INVOKER, idempotent on (committee, delegate, list_type).
- Every queue read orders by `position, created_at, id`. Keep all three keys.
- `reorderSpeakersList` is ONE `speakers_list_reorder` RPC (an in-place UPDATE under the list lock; listed rows get 1..n, unknown rows follow), chained per list on the SAME chain as the adds (`chained()`). NOT delete + reinsert (a DELETE event flashes an empty list on phones), NOT N parallel updates.
- `nextSpeaker` updates the current_speaker row and optionally removes a delegate from speakers_list. `startSpeakerTimer` writes started_at AND time_remaining together. `pauseSpeakerTimer` writes `{ started_at: null, time_remaining: live }`. `stopSpeakerTimer` clears started_at only, where the next write seats a fresh clock anyway; not for a pause or a restart.

Long form: docs/sessions/gsl.md

---
## FEATURE: MODERATED CAUCUS

### How it works
- Accepting a moderated caucus motion: MotionsModal calls onCommitteeUpdate with phase='moderated-caucus', the caucus object, pendingMotions=[], caucusQueue=[], currentSpeaker=null. speakersList is PRESERVED (plus an interrupted GSL floor holder with time left back at its front, see MOTIONS MODAL).
- The `caucus` JSONB stores type, purpose, motionLabel, totalTime, remainingTime, totalStartedAt, speakingTime, speakerTimeRemaining, currentSpeaker (a string), proposedBy, spokenCountries. `ModeratedCaucusMain` draws it; `handleNextCaucusSpeaker` advances through caucusQueue and updates the JSONB + current_speaker.

### Rules
- `caucusPanelLocked` keeps the GSL panel from flashing during the transition (true when the phase becomes 'moderated-caucus', false when it ends); aside condition `caucusPanelLocked || committee.caucus?.type === 'moderated'`. `caucusLoading` shows the loading screen.
- DO NOT call clearCurrentSpeaker when entering a caucus (it races `nextSpeakerInDB`); MotionsModal's onCommitteeUpdate with currentSpeaker null is sufficient.
- `caucusRollCallCommittee` sets speakersList=caucusQueue and currentSpeaker=null so the GSL speaker never shows in the caucus panel. Queue mutations and `handleNextCaucusSpeaker` use structural=true.
- **Capacity** = `caucusQueueCapacity(liveTotal, speakingTime, queue.length, currentSpeakerLiveRemaining)`: a delegate fits whenever committed time is below the live remaining total. The motion card, raise form and loading screen show the same count. A refused add shows ONE glass card (`notifyCaucusQueueFull`, key `caucus-queue-full`); a full caucus's `CaucusAddSpeakerInput` is `disabled` and re-enables when room appears.
- Notification cards (`src/lib/sessionNotifications.ts`, `NotificationStack.tsx`): TTL cards leave on their own, the x is always the hit target, a re-raised key refreshes one card (`dismissIfUnchanged`), hover or focus holds the TTL. `NOTIFY_TTL.notice` 4 s, `NOTIFY_TTL.chat` 5 s; GSL requests 60 s, broadcasts sticky.
- **On deck in a caucus**: with nobody on the caucus floor and a non-empty queue, `caucusQueue[0]` is drawn on the floor at `capSpeakerSlot(speakingTime, liveTotal)`; nothing is written. Start calls `handleStartCaucusOnDeck` (Moderator, quorum, not ended / suspended, total left): optimistic seat + both clocks with ONE stamp, `updateCaucusInDB` (`currentSpeaker`, `speakerTimeRemaining`, `remainingTime`, `totalStartedAt`), `removeFromCaucusListInDB`, and ONE current_speaker update that seats and starts. Next on deck never skips them.
- **The last speaker's clock is capped** to what the caucus has left (`capSpeakerSlot` on Next / Start / Restart, and `handleToggleTimer` caps again). The slot given is persisted as `caucus.speakerTimeRemaining`, and speaking time is computed against THAT slot plus extra time.
- **The TOTAL is speaking time: it stops when the speaker clock reaches zero.** The speaker tick only raises `speakerExpiredRef`; an effect keyed on `timerRunning` re-anchors the caucus once (`remainingTime` read at the speaker's zero, `totalStartedAt` null, non-structural) and parks the speaker row at 0. Every reader uses `moderatedCaucusRemainingNow(caucus, time_remaining, started_at)`, which caps the total at the running speaker clock's zero, so all surfaces stop together before the write lands. The organiser live wall reads the uncapped `caucusRemainingNow` and follows once the write lands.
- **The stop-at-zero writes are conditional and ordered** (`reanchorCaucusAtSpeakerZero`): `updateCaucusIfUnchanged` (only while `caucus->>currentSpeaker` and `caucus->>totalStartedAt` still match) and `stopSpeakerAtZeroIfUnchanged`, on the one per-committee chain. The same re-anchor runs once per load and once on gaining the gavel when the total runs and the speaker clock is already at 0 (Moderator device only).
- **The Starting caucus splash is keyed on the caucus IDENTITY** (`src/lib/caucusIdentity.ts`: proposer, type, purpose, label, tour stamp, `caucus.acceptedAt` written at accept), never `totalTime`: Extend just adds time with the floor mounted (owner, 23 Oct 2026), a reload never replays it, and an identity change while still in a caucus stops and reseats the speaker clock.
- Ending a moderated caucus (End, expiry, Next past the total) clears the caucus queue rows (`clearCaucusListInDB`; expiry only once the end landed), never the GSL.
- Ending a moderated caucus (End or expiry) logs the floor holder's speech through `logFloorSpeechOnCaucusEnd` → `logFloorSpeech`. Ending a Consultation logs the floor holder through `logTimedSpeech` with the same `cowTurnKey` as `handleCowTap`.
- `CaucusProposer` (round flag + name, a gavel disc for `__chair__`) draws who raised it. Presentation only.

### What happens when caucus ends
- phase → 'speakers-list'; caucus → null; caucusQueue → []; speakersList → UNCHANGED; currentSpeaker → null.

Long form: docs/sessions/moderated-caucus.md

---
## FEATURE: UNMODERATED CAUCUS / CONSULTATION / TOUR DE TABLE

- Unmoderated and Consultation: a countdown, no speaker queue. Tour de Table: all present delegates in order, each speaks `speakingTime`; the queue is pre-filled.
- **Room Order Tour de Table** (`tourOrder === 'custom'`) fills the queue with numbered placeholders (`room-order-N`) that are NOT delegations. They are never stored as rows: the queue is derived from the caucus (`caucus.roomOrderSize`, the roster snapshot for older tours, minus `spokenCountries` and the floor; `src/lib/roomOrderQueue.ts`) wherever `caucusQueue` is built, so a refetch, reload or handover keeps it and Commenters see it; `batchAddToCaucusList` drops any id that is not a real seat. No per-turn speech is logged. Instead: at accept, MotionsModal snapshots `caucus.roomOrderCountries` (every delegate not absent, observers included) and `caucus.tourStartedAt`. When the tour ENDS, `creditRoomOrderTour(committee)` writes ONE `speech` per snapshot country, context `tour-de-table`, `seconds` = `caucus.speakingTime`, `turnKey` = committee + country + `tour:<epoch ms of tourStartedAt>`, in one insert. Triggers (Moderator device only): End Caucus, expiry, Next past the total or the last placeholder, another caucus accepted over the tour, End Debate Yes, an organiser END broadcast. Suspend does NOT credit. Only a tour that reached its full number of turns credits (owner, 23 Oct 2026); an interrupted tour credits nobody. Idempotent exactly by key. A-Z / Z-A tours are real delegations with per-turn `logFloorSpeech`.
- All three clear caucusQueue when starting and preserve speakersList; currentSpeaker is null at accept; the end cleanup is the moderated caucus's.
- **Consultation of the Whole credit.** A plain unmoderated caucus has NO floor and logs no speech. Only the Moderator sets the floor holder (`cowCanTap` = `caucus.isConsultation && !isViewOnly`). A tap stamps `caucus.floorSince` AND `caucus.floorRemaining` (the live total at the tap). The holder is credited with `cowHolderSeconds`: the CAUCUS CLOCK time since the tap (`floorRemaining` minus the live total), never more than wall time. Extending the caucus moves `floorRemaining` by the same seconds. The fallback start (`cowFloorStart`, when `floorSince` is missing) searches only this consultation's speeches, bounded by the newest `motion-passed` of type `consultation`. The holder is also logged (`logCowHolder`, `src/lib/floorSpeech.ts`, same `cowTurnKey`) BEFORE the caucus is frozen or replaced on Suspend Yes, End Yes, an organiser pause / end and a caucus passed over the consultation. History, the profile and the export label such a speech with the committee's consultation name (`motionNames(...).consultation`).
- Auto start applies to caucus Next and a Tour de Table advance (see GSL → Auto start).

Long form: docs/sessions/unmoderated-caucus-consultation-tour-de-table.md

---

## FEATURE: MOTIONS MODAL

### How it works
- `VotingView` ranks motions by disruptiveness; Accept → `handleMotionAccepted`; Reject → `handleRemove`; Suspend / End Debate → "Does this motion pass?"; Yes awaits `removePendingMotionInDB` FIRST, then `suspendDebateInDB` / `endDebateInDB`.
- **Up to 15 motions on the floor** (`MAX_FLOOR_MOTIONS`, client-only; join and GSL requests do not count, Custom motions do): every Raise button is disabled at 15 and `handleRaised` refuses. The first `RANKED_VISIBLE` are normal cards; the rest are NEVER hidden, they scroll in their own column, which scrolls by MEASURED height, never by count.
- **One card format for every motion** (`src/components/motions/MotionCard.tsx`, `MotionSummary`): the committee's `motionNames` or a Custom name, the topic, "Raised by" with a ROUND flag (a gavel disc for `__chair__`, `MOTION_CHAIR_KEY`), the times in fixed slots (`motionClock`). Presentation only.
- Motions and Documents grow out of their top-bar tab (`src/components/GrowDialog.tsx`), transform + opacity through refs, nothing awaited.

### Rules
- Motions are stored optimistically with temp ids (`temp-...`). Raising, editing and Undo go through `raiseMotionOptimistic` (`src/lib/motionFlight.ts`): it swaps the temp id for the real UUID on success and **drops the temp row with `motions_save_failed` when the insert fails**, so a motion that can never be rejected cannot exist. Temp ids live in a module-level store keyed by committee id (`useTempMotionIds`).
- **EVERY action on a motion is disabled while its id is temporary**: Accept, Reject, Edit, the list ✕, Suspend / End Yes and No. `removeMotionEverywhere` remembers a temp id and deletes the real row when the insert returns.
- **When a motion passes, the other pending floor motions FALL** (`fellOtherFloorMotions`): caucus accept, Suspend Yes and End Yes delete every other non-Custom, non-request motion and show `MotionFlightNotice` (mounted by the chair page, Moderator only). After a caucus accept it offers Undo for 8 s (raises them again as new rows). After Suspend or End there is NO Undo, and Undo disappears the moment the committee is suspended or ended (`setMotionFlightClosed`). Accepting a Custom motion makes nothing fall.
- One floor motion per delegation (`motions_proposer_has_motion`).
- **Every motion is on the ledger** (`src/lib/motionLog.ts`): `motions` rows are hard-deleted on accept and reject, so the `__log__` channel is the only record. `motion-raised` when the INSERT lands (real UUID in `motionId`, scored by `motionRaised`); `motion-passed` on every accept (a caucus is logged LAST inside `clearFloorForCaucus`, after the interrupted speech; scored by `motionPassed`); `motion-failed` scores nothing and carries `outcome` `rejected` | `failed` | `fell`; `motion-edited` links the new id to the old (`prevMotionId`) so it never scores a second raise. Every event carries `motionType`, `topic`, `totalTime`, `speakingTime`, `tourOrder`. The chair's own motions log country `__chair__` (no points). Nothing here touches committee state.
- **The floor speaker's speech is logged when a motion passes**: caucus accept, Suspend Yes and End Yes call `logFloorSpeech` with the chair page's `floorClock` BEFORE clearing the floor; Suspend and End also clear `current_speaker` (conditional clear). Exception: a GSL floor holder with time left on a caucus accept or Suspend Yes is HELD (`holdInterruptedGslSpeaker`, see GSL) and not logged; End Yes settles every hold first (`settleHeldFloors(c, 'all')`).
- **An interrupted GSL speaker keeps their GSL place** (owner, 18 Oct 2026: "the GSL should stay absolutely the same, even if they have time remaining"). A seated delegation is no longer a `speakers_list` row (RULE 2), so clearing the floor used to drop them from the GSL. On caucus accept, Suspend Yes and an organiser pause, when the floor holder is a GSL speaker (phase `speakers-list`, no caucus), not absent, with time left on the live clock, `interruptedGslSpeaker` + `returnSpeakerToGslFront` (`src/lib/gslFloorReturn.ts`) put them back at the FRONT of the GSL: optimistic first, then ONE idempotent `speakers_list_add` at `'start'` on the GSL chain. They are on deck when the room returns to the GSL, HELD with the time they had left (see GSL → the held floor).
- On chair page load, stale suspend-debate / end-debate motions are auto-deleted.

Long form: docs/sessions/motions-modal.md

---
## FEATURE: SUSPEND DEBATE

### How it works
- Motion passes (or an organiser broadcast pauses the room) → the floor speech is logged (`logFloorSpeech`) and the floor is cleared (`clearCurrentSpeakerIfUnchanged`); a GSL floor holder with time left goes back to the front of the GSL and is HELD with the time they had left instead of logged (`src/lib/gslFloorReturn.ts`, see GSL), so after the resume they finish the same turn → `suspendDebateInDB` reads the row fresh and writes ONE update: `suspended_at` (database clock), `phase='adjourned'`, and the caucus with its TOTAL frozen at the live value and NOBODY on its floor (`freezeCaucusForBreak` = `pauseCaucusLive` + `currentSpeaker: null`, `floorSince: null`; queue rows kept). Conditional on `ended_at is null`, `suspended_at is null` and the phase it read; then `pauseSpeakerClockLive`. Resolves true when the committee IS suspended afterwards, false otherwise (an ended committee can never be suspended); on false the caller rolls back. The optimistic suspend in MotionsModal and the broadcast pause null `caucus.currentSpeaker` locally too.
- The chair page stops its own speaker tick whenever `sessionSuspended` or `sessionEnded` turns on.
- Chairs see a two-tab overlay (Suspend View + Session View); delegates see a waiting screen. "Resume Session" → `claimResumeSession` (first chair wins) → `startResumeRollCall` → phase='pre-session', suspended_at=null; chairs take roll again; delegates wait until the phase leaves pre-session. Co-chairs see "{name} is resuming…".

### Resuming is TWO writes against the `resuming_chair` latch, and BOTH can fail
- `resuming_chair` is an **atomic one-shot latch**. `claimResumeSession` writes it only `.is('resuming_chair', null)`; `startResumeRollCall` is the only thing that clears it on the success path. **NEVER weaken that `.is(..., null)` guard.** The fix for a stuck latch is an explicit release or take-over, never a looser claim.
- `startResumeRollCall` returns `Promise<boolean>` and the caller **MUST** check it (false on error AND on a zero-row update). If the claim landed and this write silently failed, no chair could ever resume.
- `releaseResumeClaim(committeeId, chairName, code, chairSuffix?)`: compare-and-swap `.eq('resuming_chair', chairName)`, clears the latch ONLY if it still names you. `runResumeRollCall` calls it when the roll-call write fails, rolls the optimistic phase / suspendedAt back and shows `session_resume_failed` / `session_resume_failed_locked`.
- `takeOverResumeClaim(committeeId, fromChairName, toChairName, code, chairSuffix?)`: CAS from a stale holder to you; two racing take-overs produce exactly one winner.
- **`alreadyMine` self-heal**: a chair who reloads mid-resume already holds the latch and goes straight to the second write. Only the chair NAMED in the latch takes that path.
- Lost the claim → refetch the real row: the winner finished → drop out of suspension; the latch is ours → finish the job; otherwise render "{name} is resuming…".
- **Take-over affordance**: `foreignResumeLatch` starts a 12 s timer when ANOTHER chair holds the latch; after it the co-chair gets `session_resume_takeover` → `handleTakeOverResume`.
- **All three latch writes also require the committee to STILL be suspended**: `suspended_at is not null` and `ended_at is null`, and `startResumeRollCall(..., chairName)` adds `resuming_chair = chairName`. On false `runResumeRollCall` refetches first: no longer suspended → adopt the row; latch names someone else → `session_resume_lost`; otherwise release and report.
- **Latch ownership is per DEVICE for a same-name chair**: `markResumeClaim` / `resumeClaimIsMine` (`localStorage gavelling-resume-claim:<CODE>` = the `suspended_at` it claimed). Without the marker a same-name latch renders as another chair's.

### Rules
- ONLY clear suspended_at by setting the phase back to pre-session via `startResumeRollCall`.
- Going absent during the resume roll call does NOT remove delegates from the GSL (`phase='pre-session'` guard). Absent delegates leave the GSL when Begin Session is pressed.
- **Begin Session restores a paused caucus**: `RollCallPanel` calls `beginSessionAfterRollCall`, which in ONE update conditional on `phase='pre-session'` opens the caucus's own phase (still paused) when a caucus with time left is stored, or `speakers-list` with `caucus` null and the caucus queue rows cleared. A running anchor left by old code is paused at its live value; a caucus with no time left is dropped. `handlePhaseChange` mirrors the decision optimistically. Caucus data must never survive into `speakers-list`.
- speakersList, chat, documents and messages are PRESERVED through suspend / resume; caucusQueue is preserved while a paused caucus is restored.

### How long a suspended STANDALONE room is kept
- `delete_expired_committees()` (pg_cron hourly, conference rooms never) deletes a suspended room `SUSPENDED_DEBATED_KEEP_HOURS` (72) after `suspended_at` when it held debate (`committee_held_debate(id)`), else `SUSPENDED_KEEP_HOURS` (36); a live room 24 h after its last activity; an ended one at `expires_at`. The numbers are mirrored in `src/lib/roomRetention.ts`: change both together. The chair is told before it happens (`motions_suspend_kept_until`, `session_suspended_kept_until`, through `roomKeptUntil`, which returns null for a conference room).

Long form: docs/sessions/suspend-debate.md

---

## FEATURE: END DEBATE

### How it works
- Motion passes → `endDebateInDB` sets `ended_at`, `expires_at` (now + `ENDED_KEEP_HOURS`, 24 h, database clock), phase='adjourned', freezes the caucus total and pauses the speaker clock like a suspension. **Idempotent**: conditional on `ended_at is null`; resolves true when the committee has ended (now or earlier), false only when the write failed, and the caller rolls back. MotionsModal's optimistic mirror and the broadcast path read `ENDED_KEEP_HOURS` from `src/lib/roomRetention.ts`.
- All devices see the End View + Session View overlay; Session View is read-only.
- **Download the record**: `downloadSessionRecord(committee, feedback?)` (`src/lib/sessionRecordExport.ts`, `xlsx` loaded lazily) writes `<CODE> <committee> record.xlsx` with History, Scores, Per motion, Speeches, Attendance (`delegate_status_history`) and Documents, all from `buildSessionScoreboardRows` / `buildSessionHistory`, so the file matches the screen. Writes nothing.
- The End View's countdown is computed from `expires_at` (`session_hours_until_delete`), standalone rooms only.
- The hourly cron deletes ONLY the `committees` rows; every child FK cascades after the BEFORE DELETE trigger `archive_committee_on_delete` (which fills `committee_analytics` and swallows its own errors). **`delete_expired_committees()` skips `session_origin = 'conference'` entirely.** Deleting a conference committee also removes its chat attachments (see CHAT).

### Read-only rules (sessionEnded)
- Hide Roll Call / Motions / Documents tabs, the Chat icon, every add / timer / status / request / submit control. Show lists, timers, documents, stats, chat view-only (`ChatPanel readOnly`).

### Rules
- **An end can be undone for `REOPEN_WINDOW_HOURS` (24); a CONFERENCE room until its conference's last day is over** (owner, 23 Oct 2026). `endedAt` is NOT permanent; never write on the assumption that it is. `ENDED_KEEP_HOURS` and `REOPEN_WINDOW_HOURS` are deliberately equal: a room must still exist to be reopened. `canReopenEndedRoom(committee, nowMs, conferenceEndsAtMs?)` is the one test and `nowMs` is ALWAYS `serverNow()`. For `sessionOrigin === 'conference'` the window is `max(ended_at + 24 h, 23:59 on the last day)` in the conference's timezone (UTC-12 when none is stored), read once per room by `useConferenceRoomEndsAt` / `loadConferenceRoomEndsAt` (`src/lib/conferenceRoomWindow.ts`, anon read); unknown = the 24 h. A conference room is never auto-expired, so `expires_at` on it is inert. Past the window the room is retired: `start_my_chair_session` mints a fresh room and relinks the committee (scratch-conference-rooms.sql section C1; the database mirrors the same window), and the chair's dashboard offers "Start your committee room" again.
  - "Restart the session" (`session_restart_btn`) on the chair's End View, drawn only while `canReopenEndedRoom` holds, asks first inline. Offered to ANY chair device, Commenter included (the join page sends every chair on an ended room down the Commenter path). After the reopen lands, the device takes the gavel when it is free or already names this chair (one attempt, silent on failure).
  - `reopenEndedSession(committeeId, code, chairSuffix?)` sets `{ ended_at: null, expires_at: null, suspended_at: null, resuming_chair: null, phase: 'pre-session' }` in ONE conditional statement (`ended_at` set and within the window), row-counted, through `runWrite(lifecycleKey(id), …, { retry: true, rerunnable: false })`. **`rerunnable: false` is load-bearing**: a parked reopen would leave the caller's rollback never running. One statement because `setPhase` is conditional on `ended_at is null`. Optimistic first, then checked: on false the row fields and both overlay flags go back and `session_restart_failed` shows.
  - It lands in `pre-session`, so Begin Session restores a paused caucus and a reopened room can never come back with a running clock or a phantom speaker.
  - **An END always wins over a stale read.** An un-end crosses to other devices only through the non-stale branch and only while `rowHeld` is false; the STALE branch never carries one, because our own End Debate bumps `localWriteSeq` before its write. The overlay flags are cleared by the `prevLifecycleRef` effect, never from the event. The delegate page keeps `wasEverEnded`, so a restarted room shows the WAITING screen. The voting page's entry effect stands down while the phase is `pre-session`.
  - Honest limits: the window is a PostgREST filter built from this device's corrected clock, not a server `now()` (a conference room inside its conference window has no lower bound on `ended_at`; `reopenEndedSession(..., conferenceEndsAtMs)`); the reopen never touches `current_speaker`.
  - The `gavelling-rejoin` blob survives the end while the room is restartable (`REJOIN_MAX_AGE_MS` reads `REOPEN_WINDOW_HOURS`; `checkStandaloneRoom` offers an ended room with `ended: true`).
- 'adjourned' with NO endedAt = suspended (Resume). 'adjourned' WITH endedAt = ended (Session Closed, plus Restart inside the window). Join is allowed for both roles when ended, view-only.

Long form: docs/sessions/end-debate.md

---

## FEATURE: ROLL CALL

### Initial roll call (phase='pre-session')
- `RollCallPanel` with `isRollCallPhase=true` shows Clear All, All Present, All P+V (pre-session only). They update `localStatuses` at once and call `onBulkStatusChange` once → `handleBulkStatusChange` → `setDelegateStatusesBulk` → RPC `set_delegate_statuses(p_committee, p_status, p_ids)`: ONE UPDATE, SECURITY INVOKER, requires `is_session_chair`, skips rows already at the status. With a chair suffix and `OFFLINE_RESILIENCE` on the bulk is parked like a single tap; the per-row fallback runs only on `PGRST202`.
- Absent during roll call does NOT remove from the GSL.
- **Adding a seat** is `src/components/SeatAddField.tsx`, mounted through `CommitteeIdentityBadge seatField` → `QuorumRings trailing`, on the same row as the quorum tabs. Not rendered for a Commenter or an ended session. Nothing is suggested until a character is typed; the list opens through `Portal`: not-yet-added `UN_COUNTRIES`, then the typed name as a custom seat. Shift+Enter or the megaphone adds an observer. A seat named like a current chair is refused (`chairNameRules`).
- **An added seat is PRESENT at once**: `handleDelegateAdd` → `addDelegate(committeeId, country, code, suffix, 'present', observer)` (status and `is_observer` in the ONE insert; defaults stay `'absent'` / `false` for other callers), then `updateLocal` appends the row. Not optimistic before the insert, because the row id is needed.
- Begin Session → phase='speakers-list' → absent delegates leave the GSL at that moment.
- **"Will delegates join on their phones?"** (`src/components/RollCallJoinPanel.tsx`, `RollCallWithJoin`): Yes shows the SESSION code, gavelling.com/join and a locally drawn QR (`encodeQr`); remembered per room on this device (`localStorage gavelling-phones-join:<CODE>`). Pre-session only. Writes nothing.

### Resume roll call
- Same as the initial roll call: GSL preserved, absent does not remove, Begin Session removes.
- **One plain line says the statuses were kept** (owner, 21 Oct 2026): `rollcall_resume_kept` ("Statuses kept from the last session. Change only who is different, then Begin Session.") at the top of the full-screen roll call when `heldPriorSession(committee)` (`RollCallPanel.tsx`: a `__log__` ledger row, a non-empty GSL, a stored caucus or a held GSL turn; a fresh room has none). Also shown after a Restart. Writes nothing; Begin Session stays one press.

### Status picker and queue view
- **Direct picker, not a cycle** (owner, 21 Oct 2026): every roll-call row (pre-session and the mid-session Roll Call tab) has `StatusPicker`, three segments A / P / PV (full names `rollcall_status_*` as titles and accessible names); one press sets that status. An observer gets A / P only. Arrow keys, Home and End move between segments, Enter or Space sets the focused one (walking never writes). The press runs `setStatus`, the old cycle's write path unchanged: optimistic `localStatuses`, the parent's `onStatusChange` (the chair's `rollCallChain` / `claimRollCall` write), and the join-request admit when an ABSENT delegation goes to P or PV. A Commenter or an ended session gets it disabled and dimmed. `localStatuses` resets when `committee.id` changes.
- currentSpeaker is always at the TOP of the queue (position 1 in `queuePositionMap`), speakersList at 2, 3, and so on.

Long form: docs/sessions/roll-call.md

---

## FEATURE: CHAT

### Architecture
- `ChatPanel` (`src/components/ChatPanel.tsx`) and the pieces in `src/components/chat/`. senderName for chairs = `myChairName` (from `?chairName=`), NOT `committee.chairNames[0]`. Two panes when the PANEL is at least 640px wide (flips at 660 / 620, measured on the panel, never the viewport). Chair page: `ChatDialog` → `GrowDialog`; `disableChat` renders `ChatDisabledNotice` inside it. Delegate page: a `Sheet`, `ChatPanel embedded`.
- **A new conversation stays open**: the open conversation, the one-pane thread flag and the unsent text live in `src/lib/chatOpenConversation.ts` (keyed by committee and reader), so a re-render or remount keeps them; a key missing from the list for a render keeps its conversation open instead of falling back to Everyone. `npm run test:e2e` covers it.

### The conversation list (`buildChatDirectory`, `src/lib/chatConversations.ts`)
- **A chair name that equals a seat is not a chair**: `buildChatConversations`, `chatConvKeyForMessage` and `chatUnreadTotal` take the committee's `seats` and `chairNamesExcludingSeats` (`src/lib/chairNameRules.ts`) drops any chair name that is also a seat. Every caller passes the seats.
- Listed: Everyone; the dais as a whole (`chairs`, delegates only); every other delegation; every other chair (chairs only); every group the reader is in. A delegation never DMs one named chair; delegate-to-delegate threads never appear on a chair's list.

### Group chats (stored in `messages`, no migration)
- A group is ONE row: sender `__system__`, recipient `__group__`, is_private true, content `__group__:{"id","name","members","by"}`. **The row's primary key IS the group id** and `parseChatGroups` trusts only the row whose id matches (earliest-wins is only a fallback for old groups; `created_at` is client-writable, so never rely on it alone).
- A group message is a row with recipient `group:<id>`, shown only to members and only when its sender is a member; `chatConvKeyForMessage(m, name, isChair, chairNames, allMessages)` returns null for a group the reader is not in.
- Renames and added members are append-only edit rows (`__group_edit__:{"group","name"?,"add"?,"by","at"}`, `encodeGroupEdit`), never an UPDATE, folded by `parseChatGroups` in `created_at` order; an edit applies only when its `by` is a member at that point. Members are only ADDED.
- **NOT PRIVATE, and the copy says so** (`chat_group_info`): `messages` SELECT is `true`; membership decides only what the UI shows. Honest limit: anyone with the code can forge a definition or an edit.

### Notification rules
- `chatReadCounts` is persisted under the per-reader key from `chatReadStorageKey` (`src/lib/chatReadKey.ts`): `chat-read-${code}-${role}:${identity}`. **NEVER** go back to a key without the reader identity. Both pages use `loadChatReadCounts` / `saveChatReadCounts`; the legacy `chat-read-${code}` value is adopted once, never written again.
- Own messages never count. Badge = received messages minus `readCounts[convKey]`.
- "Opened" means the thread is ON SCREEN: `ChatPanel` marks read only while `threadVisible` and publishes the visible thread through `src/lib/chatViewing.ts`; the chair page's chat-card producer skips a message only when `chatConvKeyForMessage` matches that thread. Never go back to a blanket `if (showChat)` gate.
- Optimistic sends go through the module-level outbox (`src/lib/chatOutbox.ts`); a failed write shows "Not delivered · Retry"; `reconcileOutbox` retires an entry when a NEW row with the same sender + content + recipient arrives.

### Attachments and GIFs (`src/lib/chatAttachments.ts`)
- Files go to the `session-documents` bucket under `chat/<committee_id>/<epoch>-<safe name>` (anon INSERT, no UPDATE, 10 MB, PDF / JPEG / PNG / WebP / GIF), uploaded when picked, never upsert. Message format: two lines, `📎 <name>` (or `GIF: <title>`) and the URL with metadata in the fragment (`#gva=…`); an older bundle shows the name and a link.
- **Deleting a CONFERENCE committee deletes its chat files, never its documents** (documents live at the bucket ROOT `<id>/`): the BEFORE DELETE trigger `queue_chat_cleanup_before_delete()` writes `chat_cleanup_queue` (conference rows only, service role only, errors swallowed) and the `cleanup-chat-attachments` edge function drains it hourly, touching only the `chat/` prefix. Standalone rooms are untouched.
- **Trust**: `parseAttachment` renders media only for URLs that are exactly this origin + `/storage/v1/object/public/session-documents/chat/<uuid>/<file>` (`trustedFileUrl`, parsed with `new URL()`, dot segments and encoded slashes refused) or GIPHY's media hosts.
- GIFs: `GET /api/gifs` proxies GIPHY with the server-only `GIPHY_API_KEY`; without it the button is not rendered (`useGifsEnabled`). Privacy trade-off for the owner: GIF images load from GIPHY's CDN in every viewer's browser. Every send calls `markDelegateActivity()`.
- `ChatLightbox` portals to `document.body` at z 2000 (over the delegate `Sheet` at 1000) and handles keys in the CAPTURE phase, so Escape never closes the dialog or sheet underneath. Props only, no write.

### Delegate names in conference sessions (chairs only)
- `session_delegation_names(p_code)` (SECURITY DEFINER, gated on `is_session_chair`) returns `{country, country_code, seat, display_name}` only; client `src/lib/sessionDelegationNames.ts`, cached 5 min. Chairs only because nothing makes a delegate's name public. Not a security boundary.

### Organiser broadcasts are Secretariat messages in Everyone
- A broadcast reaches the dais as a sticky card (`getActiveBroadcasts`, dismissal in `gavelling-broadcast-seen-<CODE>`, `src/lib/broadcastHistory.ts`); the rows stay (no expiry delete). `session_broadcasts`: `kind` informational | actionable, `message`, `image_url`, `action` pause | end, `action_at`, `expires_at`, `source` organiser | press, `author_label`. The organiser insert policy requires `source = 'organiser'` and `author_label` null; SELECT `true`, no UPDATE.
- **A scheduled Pause / End is carried out by the Moderator's device only** (`runBroadcastEffect`, chair page), and only within `BROADCAST_LATE_FIRE_GRACE_MS` (5 min) of `action_at`, checked when armed AND again when the timer fires (a slept laptop never pauses late). Ids it carried out are kept per code in `localStorage gavelling-broadcast-fired:<CODE>` (removed again on a rollback), so a reload never re-applies one. The organiser live wall says per room whether a due one took (`unappliedRooms`, `manage/[slug]/live/BroadcastComposer.tsx`: suspended / ended at or after `action_at`, or any room write since, else "Not applied yet in …, no chair device open") and offers Pause now / End it now through `apply_due_broadcast_action` (scratch-conference-rooms.sql C3, not applied: until then the press says so).
- **Merged at render time, never written** (`src/lib/broadcastMessages.ts`): `withBroadcastMessages(messages, broadcasts)` interleaves each broadcast as a VIRTUAL public message (id `bc-<uuid>`, sender `SECRETARIAT_SENDER` = `__secretariat__`, a `broadcast` field). `committee.messages` is never touched. A REAL row with that sender has no `broadcast` field and `isSystemLog` drops it. Every caller (chair icon, delegate badge, voting header, `ChatPanel`) counts over the SAME merged array; dealing with a card marks its message read (`markBroadcastReadInChat`).
- Images live in the PUBLIC `conference-assets` bucket at `broadcasts/<conference uuid>-<epoch ms>.<ext>`; `trustedBroadcastImageUrl` (its own function; `parseAttachment` is NOT loosened) accepts exactly that path.
- `useBroadcastHistory(committeeId, version, enabled)` reads them on the chair, delegate and voting pages in its OWN state, bumped on a `session_broadcasts` event and every catch-up that ends `'done'`. Nothing written, nothing per second.
- **Press releases** (`scratch-press.sql` is applied): `send_press_release` writes ONE informational row per open room with `source = 'press'`, `author_label` = the outlet, `expires_at = now()`. `broadcastAuthor()` labels it "Press · {outlet}" and `buildChatRows` never groups it with a Secretariat run. **Releases are never chair cards**: `getActiveBroadcasts` filters `source === 'press'` out. No reply, no chat with the press.
- **Chat off**: delegates get no chat of their own; once the room has a broadcast or a press release, the phone's chat sheet is `ChatPanel secretariatOnly` read only (badge `secretariatUnread`), else `ChatDisabledNotice`. Whether chat is on or off, a broadcast or release created in the last 30 minutes and not dismissed on this device comes up on the phone as a glass card (`src/components/delegate/DelegateBroadcastCards.tsx`, the one `NotificationStack`; press cards leave after 20 s, Secretariat cards stay until dismissed; owner, 23 Oct 2026). Chairs in a conference room (or one that received a broadcast) get `ChatPanel secretariatOnly` (only the Secretariat messages, read state under `SECRETARIAT_READ_KEY`, count `secretariatUnread`); otherwise `ChatDisabledNotice`.

Long form: docs/sessions/chat.md

---
## FEATURE: DOCUMENTS (Working Papers + Draft Resolutions)

### Chair view (DocumentsModal)
- Two tabs: Working Papers | Draft Resolutions. **Vote** (Moderator only) opens `/voting/[code]?chairName=...` only when a DR is `introduced`, `passed` or `failed`, else a small portaled note; it is the ONLY way to the voting page from the modal.
- Status: submitted → on-floor → introduced → passed / failed. Introduce: setup (`ProceedingsSetup.tsx`, draft numbers only; Begin calls `handleTimingConfirmed`, which writes timings + status in ONE update) → reading → presentation → Q&A → a WP passes, a DR stays `introduced` for the voting page.
- **Papers render through pdf.js** (`pdfjs-dist`, `src/components/documents/pdfLoader.ts` lazy, worker from our origin, documents cached by URL; `PdfViewer.tsx` with lazy canvases and a caller-owned `zoom`; any failure falls back to the iframe). `PdfThumb` draws page one for cards.
- **There is no close X on a stage screen**: a presentation is left only by Finish (asks first while time is left), Continue out of the last stage (both `finishIntroduction`), or the timer's Timings key back to setup, whose Back returns to the list. Escape never leaves a stage; on the SETUP screen it leaves. The stage lives only in modal state.
- **The chair's top bar stays usable during an introduction**: both screens render through `introFrame` (a Portal at z 45 under the header); `onIntroChange(active)` makes the chair page give the header z 46 and replace its tabs with a spacer. Layering: intro 45 < header 46 < every GrowDialog 50 < GavelChip menu 60. Do not raise the intro to 50 or the header past 49.
- **Moving between stages never touches the paper**: `IntroDocument` is mounted once per introduction and nothing above it is keyed on the stage. Do not reintroduce a stage `key` on anything containing the document.
- The stage clock is anchor-based (`introRemainingNow(clock, serverNow())`, `src/lib/documentFlow.ts`, `startedAt` null = paused); `StageTimerDevice` refreshes a local `now` only while running. Nothing is written per second; drag, resize, zoom and hide write nothing. **Add time** (`StageAddTime.tsx`) re-anchors the clock in state (cap 99:59, kept in `stageExtra`; Reset restores the stage's time); not offered to a Commenter. A paper with nothing to show renders the timer centred and large instead.
- **Sponsor notes for Commenters** (`SponsorNotesView.tsx`, `src/lib/documentNotes.ts`): one `feedback` row per (author chair, document, sponsor), `level = 'document'`, `speech_context = 'document'`, `speech_topic` = the doc code, `speech_seconds` 0, `spoken_at` null; edits only the author's rows (`updateFeedbackContent`). Every speech reader filters `level === 'speech'`, so a paper note never lands on a speech. Not for the Moderator.

### The introduction, codes and gates
- No Resume, Pass or Fail on a card. A card offers Introduce (submitted / on floor, after approval when the gate is on); an introduced WP offers Introduce again so it can always reach its pass; an introduced DR shows no flow button. `documents.intro_state` is written only back to `null`; nothing reads a persisted stage. Every flow write is optimistic then checked (`documents_intro_save_failed`); Delete is checked and asks first.
- `DocCard` receives `isViewOnly`: a Commenter gets no approve / reject / introduce / Vote / delete (UI gate only).
- **Document codes are assigned by the database**: BEFORE INSERT trigger `documents_assign_doc_code` computes `WP 1.n` / `DR 1/n` under a per-(committee, type) advisory lock; the client `docCode` is a preview. Both submit paths check the `addDocument` result and keep the form filled on failure.
- `CommitteeSettings.documentNames` (defaults `DEFAULT_DOCUMENT_NAMES`), mirrored into `committees.settings`. **Every** user-facing render goes through `docName(committee, type, form, translatedFallback)` (`src/lib/docNames.ts`); never hardcode "Working Paper" / "Draft Resolution". `DocumentType` and the `documents.type` discriminators never change.
- `requireDocApproval` (default false) is read from the committee ROW (`requireDocApproval(committee)`, `src/lib/documentFlow.ts`); when on, `CommitteeDocument.approval` gates introduction and re-introduction. `wpSubmissionLimit` / `drSubmissionLimit` are set in Settings → Motions → Documents and enforced on BOTH submit paths through `docLimitReached(committee, type)` (reads `dbSettings`); `null` = unlimited; the count is per COMMITTEE.

Long form: docs/sessions/documents.md

---
## FEATURE: SETTINGS

### WRITE side: KEY-LEVEL PATCHES ONLY
- Every write to `committees.settings` sends ONLY the changed keys through the SECURITY INVOKER RPC `patch_committee_settings` (`settings = coalesce(settings,'{}') || patch`). No read first, so no read-modify-write race between chairs and no failed read that can wipe the blob. RLS still applies through the `x-chair-suffix` header.
- `patchCommitteeSettings(committeeId, patch, code, suffix)` returns `true` only when a row was updated and **raises** on `chairJoinSuffix`; parkable, so `false` means a real refusal. `saveCommitteeSettings` drops `chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex`, `votingReturnPhase`, `gslHeldFloors`.
- `SettingsPanel`'s `upd` updates the store instantly and debounces (400 ms) a patch of the keys changed since the last flush; it **never** posts `getSettings(code)`. `updScoring` → `updateCommitteeScoringInDB` patches `{ scoring }`. The voting page's `applyRule` patches `{ [key]: value }` and is a no-op for a Commenter.
- Keys with their own writer: `chairJoinSuffix` → `set_committee_chair_suffix` (the caller must hold the CURRENT code); `headChair` + `headChairDevice` → `updateCommitteeHeadChairInDB`; `agendaTopicIndex` + `committees.topic` → `set_committee_agenda`; `votingReturnPhase` → `set_committee_voting_phase` only. `addChairName` → `add_committee_chair_name` (atomic, trimmed).
- `rowToCommittee` surfaces the blob as `committee.dbSettings` plus `dbChairJoinSuffix` (always a string), `dbHeadChair`, `dbHeadChairDevice`, `dbSeparateChairCode`, `dbScoring`, `dbGslHeldFloors` (`parseGslHeldFloors`, malformed entries dropped).

### READ side: hydrate once, then re-hydrate changed keys
- `/chair/[code]` and `/voting/[code]` hydrate the store in the loader, then through `useSettingsSync(committee)`. `/delegate/[code]` NEVER hydrates it and holds no reference to `useSettingsStore`. `/advisor` reads no settings.
- `NON_HYDRATED_SETTING_KEYS` / `stripNonHydratedSettings` (`src/lib/settingsStore.ts`) is the ONE list of keys that never enter the store: `chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex`, `votingReturnPhase`, `gslHeldFloors`. Never strip an inline copy again.
- `useSettingsSync` (`src/lib/useSettingsSync.tsx`) diffs a stable serialisation of the stripped blob and hydrates ONLY the changed keys; a value this device flushed in the last 15 s (`src/lib/settingsEcho.ts`) is its own echo and skipped; any other change shows `settings_updated_by_other_chair`. It never writes.
- **ALWAYS** read a setting on a non-chair surface as a pure function of the committee row: `getCommitteeFlags(committee)` / `sponsorLabel(committee, fallback)` (`src/lib/committeeFlags.ts`), `getScoringConfig(committee)` (`src/lib/scoring.ts`), `docName` / `docLimitReached` (`src/lib/docNames.ts`), `vetoRulesFromRow`. **NEVER** call `getSettings(code)` on the delegate or advisor pages: it silently returns `DEFAULT_SETTINGS`.

### Chair code system
- `chairJoinSuffix` is a 4-digit string generated at creation and stored in `committees.settings`. `SettingsPanel` regenerates it **only** when the store copy is `''`; keep that guard. People see it as the "chair password" (the 4 digits; `CODE-1234` typed as the code still fills it in). The join page validates against `dbChairJoinSuffix`. It is the **only** write credential (`x-chair-suffix` → `is_session_chair`) and it is anon-readable. `separateChairCode` is written `true` at create time, read by nothing; do not build on it.

### The dialog
- `SettingsPanel.tsx` is the shell and owns every write; the tabs in `src/components/settings/` (`AccessTab`, `MotionsTab`, `VotingTab`, `PointsTab`, `PeopleTab`, `AwardsTab`) only render and call those, with controls from `settingsKit.tsx`. Never add a control that writes on its own. A `GrowDialog`, `height: 90%` (never vh). **Never write a literal fontSize or fontWeight in `SettingsPanel.tsx` or `src/components/settings/*`**: use `T.*` / `W.*` / `LH`. Glyphs take `var(--stg-accent)`; **never draw a glyph in `K.deepGold`**; colour is never the signal. One short lead per tab; a setting's explanation is an `InfoHint`, never a sentence under it. `.stg-page` has no max width.
- Access shows "What delegates can do" as replicas of the phone controls, inverted through `upd`: Chat on = `disableChat: false`, Change own status on = `lockDelegateRollCall: false`, Join without approval on = `requireChairApproval: false`. Awards renders only for a conference session when offered and opens `resolveChairAwardsHref(code)` in a new tab. Points offers no way to create a custom source.

### Settings → People
- `session_participants(p_code)` (SECURITY DEFINER, gated on `is_session_chair`) returns chair names, the gavel holder, live seat claims (`account` / `device`, `active`, `reserved`), chair devices and recent kicks; never an email, user id, holder key or device hash. Wrappers: `src/lib/sessionParticipants.ts`.
- `kick_delegate_seat(p_code, p_country)`: under the seat lock deletes every claim on the seat EXCEPT the allocated account of a reserved seat (`reason: 'reserved'`), writes 10-minute `delegate_seat_kicks` tombstones; the client broadcasts `kicked` on `seat-kick-<committeeId>`. **The kick does NOT touch the floor**: the seat is the delegation, not the person. The delegate page re-verifies on the broadcast but trusts only the server's `kicked`; `seatLost` stops its session sync. `remove_session_chair` / `release_chair_device_claim` exist but no UI calls them. Moderator only in the UI, behind `ConfirmSheet`. NOT a security boundary.
- **One person of a double delegation** (owner, 23 Oct 2026; `scratch-seat-kick-and-allowance.sql`, NOT APPLIED until the lead runs it): `session_participants` also returns per claim an opaque `claim_id` (the claim row's uuid), `name` (only for the seat's allocated account) and `ordinal`; `kick_delegate_seat_claim(p_code, p_claim_id)` removes THAT claim only, same seat lock, same 10-minute tombstone for that holder and device, same reserved-seat exception (`gone` when the claim already left). People shows one row and one Kick per person when a seat has two live claims with ids (`kickDelegateSeatClaim`, `src/lib/sessionParticipants.ts`); before the SQL the seat keeps its one Kick. The broadcast still goes to the seat: only the tombstoned phone hears `kicked` back, the other re-verifies as `mine`.

### CommitteeSettings fields and where they are enforced
| Setting | What it does | Enforced at |
|---------|--------------|-------------|
| `substantiveThreshold`, `allowAbstentions`, `abstentionsInDenominator`, `vetoMode`, `p5Delegations`, `vetoCountries`, `quorumThreshold` | voting maths | `/voting/[code]`, `VotingRulesPanel`; quorum also the chair page |
| `allowRightsVotes`, `allowPass` (default true) | ballot choices; `cast_device_vote` refuses rights with `no_rights` | voting page, `DeviceBallotScreen` |
| `votingMethod` 'rollcall' \| 'device' | frozen into the ballot as `vote_state.method` | voting page |
| `motion*` flags, `motionOrder`, `motionNames` | which motions, their rank and labels (`motionNames()`) | `MotionsModal`, delegate page |
| `cowTimerEnabled` / `cowTimerSeconds` | optional Consultation timer | chair page |
| `requireDocApproval`, `documentNames`, `wpSubmissionLimit` / `drSubmissionLimit` | approval gate, labels via `docName()`, per-committee caps via `docLimitReached` | `DocumentsModal`, delegate page |
| `gslRequireNextSpeaker` | **legacy, no effect** | nowhere |
| `gavelSoundEnabled` (default true), `gavelSoundAtSeconds` (default 15, `clampGavelSeconds` 1..600) | the double knock, Moderator's device only | `useGavelCue` |
| `autoStartSpeakerTimer` (default false) | Next seats the next speaker with the clock running | chair page `autoStartOn()` |
| `chairJoinSuffix` | chair password AND the RLS write credential | join page + `sessionClient` |
| `requireChairApproval` | every join waits for a chair | delegate page via `getCommitteeFlags` |
| `sponsorLabel` | overrides "Sponsors" | `sponsorLabel()` |
| `lockDelegateRollCall` | delegates cannot change their own status | delegate page |
| `disableChat` | hides chat for delegates and chairs | chair + delegate pages |

### `scoring` sub-object (`ScoringConfig`, defaults in `settingsStore.ts`)
- Read everywhere via `getScoringConfig(committee)`, never localStorage. `sources`: ten built-ins (attendance, gslSpeech, caucusSpeech, speakingTimePer10s, motionRaised, motionPassed, rightOfReply, wpSponsor, drSponsor, drPassed). **A stored `sources` list REPLACES the defaults**, so a later built-in is appended at READ time by `withBuiltinSources` / `withBuiltinScoring`. Disabled → the ledger row is omitted.
- `factors`: the per-speech qualities. **`level` is `'speech'` with ONE exception**: the document sponsor notes write `'document'`; nothing writes `'session'` or `'conference'`. `factorRatingsEnabled` (default false) gates the INPUT only. `factorScaleMax` default 10. `scoreBlend` 0 = objective, 100 = subjective (`computeHeadline`).
- **`parseLogEvents` is memoised on `committee.messages` array identity.** NEVER mutate `committee.messages` in place.
- Built-in names are localized through `src/lib/scoringNames.ts` on the `motionNames()` contract; `DEFAULT_FACTOR_NAMES` / `DEFAULT_SOURCE_NAMES` must stay BYTE-IDENTICAL to `DEFAULT_SCORING`.
- **The session and organiser scoreboards are ONE component**, `src/components/ScoreboardTable.tsx`, fed by `buildSessionScoreboardRows` (`src/lib/sessionScoreboard.ts`), a pure adapter over `scoring.ts`. Session capabilities are defaulted-off props. No chair-note counts anywhere.
- `scoreboard/DelegateProfile.tsx` opens a delegation: `sessionPointSlices` sums to `row.objective`; ratings only when any exist; the timeline newest first. `ManualAdjust` is offered to every chair while the session has not ended and writes one `manual-award` / `manual-deduct` ledger row with a `by` field (`manualAuthorIndex`); never on the organiser board.
- **History** (`scoreboard/HistoryTab.tsx`, `src/lib/sessionHistory.ts`): a pure fold of `parseLedgerEvents` + `feedback`, newest first throughout. A `motion-passed` of a caucus type OPENS a segment; a speech with context `unmoderated-caucus` opens a `consultation` segment; `liveSegment` appends the live one. Document notes (`isDocumentNote`) never reach History. Chair-private. Honest limit: nothing logs "the caucus ended".
- **Chair comments are edited where they are read** (`scoreboard/EditableNote.tsx`), only the author's own rows, enforced in the UI, in `ScoreboardPanel.saveNote` and in the statement (`.eq('chair_name', chairName)`); the write is `updateFeedbackContent` (row-counted), NOT the dock's `updateFeedback`; an EMPTY box is a cancel, never a write.
- The row badge is the BLENDED headline; the ledger sums to the OBJECTIVE total. Label them, never print one number in both places.
- `hideScoresFromDelegates` is GONE with the recap it gated: a delegate sees no score and no rating (CLAUDE.md §2).

Long form: docs/sessions/settings.md

---
## FEATURE: CHAIR ROLES & THE GAVEL (Moderator vs Commenter)

### Vocabulary: user-facing names changed, NOTHING PERSISTED DID
- The chair holding the gavel is the **Moderator** (exactly one); every other chair is a **Commenter**. **The identifiers did NOT change and must not**: `headChair`, `chair_names`, `resuming_chair`, the `'Chairs'` chat recipient, the `'chair'` localStorage role segment, `/chair/[code]`, `isViewOnly`, `chairRole`'s `'head' | 'co'`. A person JOINS as a "chair" and then holds a role; both use the same chair password. Never let a session rename reach `manage/`, `conferences/`, `invites/`, `account/`, `cv/` or `blog/`.

### Chair identity and the gavel
- A chair's identity is **only** `?chairName=` (`myChairName`). No session, cookie or DB row; the name is appended to `committees.chair_names[]` by `addChairName`.
- The gavel is `headChair` inside `committees.settings` (NOT a column), written by `updateCommitteeHeadChairInDB` (a key-level patch of `{ headChair, headChairDevice }`, then the `chair_names` append), read as `committee.dbHeadChair`. Claim-at-will from the join page (role Moderator) or the GavelChip's "Take the gavel". Every chair device gets one glass card when the holder's NAME changes (`notifyKey.gavel(holder)`), read-only.

### Role derivation (`deriveGavelRole`, `src/lib/gavelDevice.ts`)
```
const head = committee?.dbHeadChair || committee?.chairNames?.[0] || myChairName || null;
const nameHolds = !(!!head && head !== myChairName);
const heldElsewhere = nameHolds && !!headChairDevice && headChairDevice !== thisDeviceId;
isModerator = nameHolds && !heldElsewhere;   // setIsViewOnly(!isModerator)
```
- Unset `headChair` → the creator holds it. No `?chairName=` → `heldElsewhere` is false and `claimGavelForThisDevice` refuses to write. **The comment dock needs a REAL Commenter**: `isViewOnly && myChairName && !nameHolds`. **Every** "am I the Moderator" question goes through `gavelRoleOf(committee)`; never compare `head === myChairName` alone.

### ONE DEVICE holds the gavel
- `settings.headChairDevice` records WHICH device holds the gavel for the name in `headChair`: a random id per device and code (`localStorage gavelling-gavel-device:<CODE>`, `getGavelDeviceId`), published raw, confers nothing. **Newest wins.** A device claims only when: its page first loads and its name holds the gavel; the gavel reaches its name with NO device recorded; it joins as Moderator; "Take the gavel"; "Use this device". A re-check or realtime event NEVER steals it back: the older device drops to Commenter with `GavelDeviceBanner`. The claim pins the id for 4 s (`gavelPinRef`); the role baseline is taken only once `accessState === 'allowed'`. Stripped on hydrate like `headChair`.

### ONE DEVICE PER SIGNED-IN ACCOUNT
- `chair_device_claims` (RLS on, no policies). `claim_chair_device(p_code, p_token, p_takeover)` answers `anonymous`, `claimed`, `mine` or `other_device`; `chair_device_status` → `{active_elsewhere}`. Device = the gavel device id. Wrappers `src/lib/chairDeviceClaims.ts`.
- `useChairDeviceLock` (`src/lib/useChairDeviceLock.ts`) on `/chair` and `/voting` once access is verified. The load claim passes `takeover: true`; EVERY other check (realtime hint, 30 s re-verify, visibility, `online`, re-subscribe) passes `false` and can only report `other_device`. A network error never kicks. **Re-activation is not a takeover** (`refsKeyRef`). After a `claimed` the device broadcasts `taken` on `chair-device-<committeeId>` with hashed ids; a receiver re-verifies with `takeover: false`.
- A kicked device renders ONLY `ChairDeviceKickModal` ("Use this device instead" = `takeBack()`, or Leave); `gavelRoleOf` returns Commenter and nothing interactive is mounted. Anonymous chairs keep the same-name rule only; two accounts never affect each other.

### Loading and access
- The loaders call `getCommitteeByCodeWithRetry` (`ok` | `not_found` | `error`; any failed sub-query is `error`, retried twice, then `session_load_failed` with Try again). Only a real `not_found` shows the not-found screen.
- `useSessionAccess` (`/chair`, `/voting`) is keyed on the USER ID, never the token. A re-check keeps a settled `allowed` / `standalone` until it has a definite new answer; a read that failed is not a verdict (`detectConferenceSessionOrNull`, `verifyConferenceAccess` → `{ kind: 'error' }`). **Never** key a session-page effect on `session` or `session.access_token`, and never reset access to a full-screen loader from a re-check.
- Presence (`chair-presence-${id}`) only tells the join page who is active. It does NOT decide the gavel.

### `isViewOnly` IS A PURE UI GATE: THERE IS NO SERVER-SIDE ENFORCEMENT
- `sess_chair_update` is `is_session_chair(id)`, which only compares `x-chair-suffix` with `settings->>'chairJoinSuffix'`; it knows nothing about `headChair`, and every chair device has the suffix. **ANY chair holding the chair password can write ANYTHING to the session.** `isViewOnly` hides buttons. Never move a privileged operation behind it alone.
- `resuming_chair` is a real column, the resume latch (SUSPEND DEBATE), unrelated to `headChair`. **NEVER** merge the two.

### What differs in the Commenter view
- **"Only the Moderator can do this"**: a REAL Commenter who presses a Moderator-only control gets ONE glass card (`notifyCommenterOnly`, `src/lib/commenterNotice.ts`). Raised ONLY by a control, never by reading (a row, a flag, a name, the Commenter floor, a scroll or drag). The speaker button row and the typed add bars are not drawn for a Commenter. UI only.
- A Commenter adjusts points (`ManualAdjust`) and takes sponsor notes on a paper. `RollCallPanel`, `MotionsModal`, `DocumentsModal` receive `isViewOnly` and hide their write affordances.
- **`FeedbackLogPanel` (the comment dock) is rendered ONLY for a real Commenter.** The Moderator does not comment; a Moderator toggle was removed on purpose. The gate derives from `dbHeadChair`, so a handover moves the dock without a reload.
- **The Commenter's floor is ONE ROW** (`src/components/CommenterFloor.tsx`, writes nothing). **`CommenterClock`** never counts: it re-derives from the persisted anchor (`current_speaker.time_remaining` + `started_at`) against `serverNow()`, no writes, no audio.
- **The comment dock always has an open note field**: `dockFloorCountry` = the seated speaker, else the on-deck delegation (never a Room Order placeholder); a note typed on deck is stored without `speech_seconds` and adopted onto the speech when logged.
- **The comment dock** (`FeedbackLogPanel.tsx` draws; `src/lib/commentDockSync.ts` is the store and matcher; writes in `src/lib/feedbackEdit.ts`): notes keep ONE key through an alias map from the first keystroke to the logged speech; a turn with a note waits for its speech however late (only empty held turns are dropped, `HOLD_CAP`); a delegation back within `TURN_RESUME_MS` with no speech logged is the SAME turn. Writes go through `NoteSync` (one store per committee + chair, one write in flight per card, `NOTE_SAVE_DEBOUNCE_MS`, client-chosen row ids so 23505 = landed, never an empty insert, local text wins until the server holds exactly it, drafts mirrored in `localStorage gavelling-dock-drafts:<code>:<chairName>`). `matchDockRows` files rows: rights of reply, exact `spoken_at`, context + seconds, orphans onto the first later speech, then the floor, then upcoming cards; a row is filed once. The dock never moves a chair off the note they are writing (`TYPING_IDLE_MS`) and re-reads every `feedback` bump and every `POLL_MS`. **Feedback rows are owned by their author**: a row is this chair's only when `chair_name` matches; NEVER match by country + context + seconds alone. A right of reply note has `speech_context = 'right-of-reply'`, `speech_seconds = 0` (NEVER null), `spoken_at` = the event.
- **The organiser side renders the chair's scoreboard, History, papers and roll, read only**: `manage/[slug]/live/SessionBoard.tsx` is the chair's `ScoreboardPanel` body fed by the same builders (no `ManualAdjust`, no `NoteEditingProvider`), `SessionDocuments.tsx`, `SessionAttendance.tsx` (from `delegate_status_history(p_committee)`, written by the trigger `delegates_log_status` → `delegate_status_log`, readable by the conference's organisers and the session's chairs). The live wall scores like the chair (`sessionHeadlineScores`).
- Realtime for a Commenter: processes `current_speaker` events, NEVER debounces, always takes the fresh row, never runs the caucus expiry.
- **The secretariat's silent view** (owner, 23 Oct 2026): `/chair/CODE?secretariat=1` (`secretariatRoomHref`, `src/lib/secretariatView.ts`), opened from the organiser live wall's "Open chair room". It has NO chair name (`myChairName` is '' and the rejoin blob is neither read nor written), `gavelRoleOf` forces it to Commenter, it takes no device lock, joins no presence channel, never appears in `chair_names` or the chat's chair list, and draws no Resume, Restart, waiting-room answers, gavel chip or chat composer. Access is the ordinary 'organizer' verdict. A UI gate like `isViewOnly`.

Long form: docs/sessions/chair-roles-the-gavel.md

---
## FEATURE: SETTING THE AGENDA (conference sessions with 2-3 topics)

- `conference_committees.topics text[]` (CHECK 1..3). The session is minted with `topics[0]`; the dais chooses which opens debate and can switch later.
- Everything is in `src/components/AgendaPicker.tsx`: `useSessionAgendaTopics` (one anon read of `conference_committees.topics` by `session_id`), `useAgendaPicker`, the full-screen `AgendaPicker`.
- **Shown automatically** only when ALL hold: `sessionOrigin === 'conference'`, the query RETURNED 2+ topics, `phase === 'pre-session'`, not suspended or ended, `!isViewOnly`, `settings.agendaTopicIndex` absent. It overlays roll call and never delays it. Commenters are never blocked.
- Switching later: the picker opens from the Switch topic button under the topic (`agenda.canSwitch`: 2+ topics, Moderator, not ended). Clicking the topic text edits it inline instead.
- **Contract**: `committees.settings.agendaTopicIndex` is the 0-based index (absent = never chosen). `updateCommitteeAgendaInDB` writes it AND `committees.topic` in ONE statement through `set_committee_agenda` via `sessionClient(code, suffix)`, returning false when refused. `CommitteeEditorModal`'s re-sync reads the key. Optimistic first (non-structural), rolled back with `agenda_failed` on failure; a `localPick` guard stops a stale snapshot reopening the picker. Both loaders strip `agendaTopicIndex` on hydrate.

Long form: docs/sessions/setting-the-agenda.md

---

## FEATURE: AWARDS (conference-linked sessions only)

- Awards are a CONFERENCE feature; the live session only signposts them. Set-up, review and publish live in Manage → Settings → Awards (CLAUDE.md §5). Vocabulary and config: `src/lib/awards.ts`; every read and write: `src/lib/awardsService.ts`. Nothing else may touch `conference_awards`.
- `conferences.awards_config` carries `setUp`, `sameForAll` and `perCommittee`; `getAwardsConfig` reports `enabled` only when `setUp === true`, so `{}` reads as NOT set up.
- **The chair gate is `awardsOfferedFor(config, conferenceCommitteeId)` and nothing else**: the chair's `AwardsCard`, and in a session `useChairAwards` / `resolveChairAwards` (`src/lib/sessionAwardsLink.ts`, an anon read cached 5 min; a failed lookup is "not offered") for the ScoreboardPanel link, the End View card, the top-bar CTA and Settings → Awards. Never add a chair award affordance that does not pass it. Published awards are read by status and never gated.
- Lifecycle: `nominated` (chair) → `approved` (`approve_committee_awards`) → `published` (`publish_conference_awards`), stamps on `conference_committees.awards_submitted_at / awards_approved_at / awards_return_note`, `conferences.awards_published_at`. Publishing mints one `gavelling_verified` `mun_cv_entries` row per recipient per conference, idempotently. It writes no points: points are retired.
- **Nominations are secret until publish.** RLS on `conference_awards` exposes unpublished rows only to the committee's chairs and the organising team. Never add a read path around it.
- `award_type` keys are stable identifiers; labels are presentation.
- `suggestSlate` fills EMPTY slots from the blended headline and is always editable; never apply it without the chair seeing it.
- `committee_awards_locked()` (approved or published) stops chair writes; the UI mirrors it with `chairCanEdit(slateState(...))`; the DB is the truth.
- The database enforces no award-type gate today; `scratch-awards-setup.sql` is an unapplied draft.

Long form: docs/sessions/awards.md

---

## FEATURE: DELEGATE VIEW

### Structure (`src/app/delegate/[code]/page.tsx`)
- One scrolling board, no tabs. A sticky header (session code, copy, language picker with "Request a language", leave). A hero: the delegation's round flag and name, the floor status (`delegate_floor_now` when speaking, in the queue or not), the roll-call switch, a documents tile and a stat rail (time spoken, speeches, messages) that opens the stats sheet. A queue panel (the current speaker, then the list; "View all" opens the queue sheet). A bottom action row: the speak button (`speakCta`), Submit document, Chat.
- **Every secondary surface is a bottom sheet** (`DelegateSheet = null | 'stats' | 'documents' | 'chat' | 'queue'`, `Sheet` from `DelegateUI.tsx`, one open at a time, `openSheet(next, section?)`): stats (`StatisticsTab`: speech count, total time, history and tips; NO score and NO rating), queue, chat (`ChatPanel embedded`), documents (`DelegateDocumentsTab`, `view` or `submit` section).
- The page reads every setting from the committee row (`getCommitteeFlags`, `motionNames`, `docName`, `docLimitReached`) and holds no reference to `useSettingsStore` (RULE 14).
- There is no countdown for the current speaker on the delegate board. The caucus band shows the caucus clock from the shared anchors (`moderatedCaucusRemainingNow`, `caucusRemainingNow`).
- Screens over the board: the pre-session / suspended waiting screen (`wasEverSuspended`, `wasEverEnded` keep it after a restart), the Waiting Room, the seat stops (taken, reserved, signin, elsewhere, kicked), the ended view, `DeviceBallotScreen`, `DelegateIdleWarning`.

### GSL request flow
- "Request to Speak" → `requestGslSpot` → a `gsl-request` motion. Chair approves → the delegate is added to speakersList; denies → `gslDenied`, "Request Again". A request already pending is nudged, not ignored (a fresh `at` in its topic plus a Realtime nudge, `src/lib/gslRequestNudge.ts`), and a chair card dismissed with x comes back on a nudge (`hasNotification`). Two persisted cooldowns per committee AND country (`GSL_RETRY_MS` 60 s on a chair who has not acted, `GSL_DENIED_MS` 15 min after a denial), so a reload cannot skip them. **Shared by every phone of the delegation** once `scratch-seat-kick-and-allowance.sql` is applied (`src/lib/delegateAllowance.ts`): `delegate_allowance` / `record_delegate_allowance` (anon, session code, no personal data) keep the request and denial stamps per committee + country in `delegate_allowance_events`; a denial is stamped by the trigger `motions_gsl_request_allowance` when a pending request is deleted while the delegation is not on the GSL or the floor (an approval stamps `gsl_clear`); the phone lays the server stamps over its own as the later of the two. PGRST202 = the per-phone behaviour above.

### Join without approval: Blocked = every join waits
- With `requireChairApproval` on, EVERY join of a seat from a tab waits in the Waiting Room for the chair, Present or not.
- `src/lib/seatAdmission.ts`: the approval for this tab and seat lives in `sessionStorage gavelling-seat-admission:<CODE>:<country>`, kept ONLY across a reload of the delegate page itself (`isReloadOfThisPage`, the navigation entry); a client navigation from /join, a live-room link or a fresh open clears it, so each of those is a new join. Losing the seat (removed, taken, elsewhere) clears it too. With approval off the device in the room is recorded as admitted, so switching approval on later never sends a phone already inside back to the Waiting Room.
- The request is a `join-request` motion inserted with an id the phone chose (`requestSeatAdmission`). The chair's Approve / Deny set the row's `status` to `approved` / `denied` (`answerJoinRequest`, falling back to the old delete if the update is refused) instead of deleting it; every motion read filters on `pending`, so it leaves every list. Roll Call's admit (`resolveJoinRequestsOnAdmit`) marks it `approved` too. The phone follows its own row (`readJoinRequestStatus`, on every motions / roster change and every 5 s while waiting): `approved` lets it in, `denied` shows the denial with Request again, a row that is GONE (an older chair bundle) counts as approved when the delegation is Present.
- A Present delegation sees "Ask to join" (`delegate_admit_*`, `src/lib/translationsSeatAdmission.ts`) and asks with its current status, so Approve changes nothing about attendance; an Absent one keeps the P / PV choice. Answered rows stay in `motions` (status not pending). Not a security boundary: session writes still check only the session code.
- With approval off, `handleRequestJoin` self-admits: the status write is pinned in `pendingStatusWrites` so an in-flight refetch cannot drop the delegate back to absent.

### Identity, Leave and observers (owner, 23 Oct 2026)
- Once the seat is matched (case and spaces ignored, `seatKey`), the phone's identity is the ROOM's spelling (`myDelegate.country`) for chat, sponsors, ballots, requests and storage keys, and the URL is rewritten to it in place. Leave (and Escape on the break / ended screens) calls `leaveDelegateSeat` (3 s cap) before navigating. An observer is offered Absent / Present only, never PV. During a moderated caucus the flag shows the caucus position (View all opens the caucus queue). A delegation not on the roster sees "Not in the Room Yet". With `lockDelegateRollCall` on, the Absent banner writes nothing and says the chair marks attendance.

### Status changes
- Rate limited: 3 changes per 3 hours per committee and country (`statusChangesRemaining`, localStorage). Once `scratch-seat-kick-and-allowance.sql` is applied the count is the DELEGATION's, shared by all its phones: `record_delegate_allowance(code, country, 'status')` is asked before the write and a `limit` answer puts the switch back without writing; a refused write gives the slot back (`status_refund`). No answer or PGRST202 = the per-phone count decides.
- A chair marking an absent delegation present in Roll Call also answers any pending request; adding an absent delegation to a list is refused (see RollCallPanel).

Long form: docs/sessions/delegate-view.md

---

## FEATURE: JOIN PAGE

- `src/app/join/page.tsx` holds the logic; `joinUi.tsx` the kit; `JoinSeatPicker.tsx` the seat list (open seats first, blocked ones marked with an icon and plain words; the caller resolves each seat's state from `seatClaims`, the picker decides nothing); `JoinGuide.tsx` the Q&A under the card, whose English values are also the `/join` FAQ JSON-LD (`src/app/join/sessionsSchema.ts`), so every answer must stay true to the product. No `FitToScreen`. The brand panel reads the room from the lookup that already ran. `/join` mounts `MobileTabBar` itself; never on /chair, /delegate or /voting.
- The card is fixed slots (code field, message rail, a stage with a reserved min-height, Join). If you add content to a step, re-measure the stage.
- A code typed as `CODE-1234` looks up `CODE`, switches to Chair and fills the chair password in. Sign in goes to `/auth/signin?next=/join?code=<CODE>&mode=<mode>`; anonymous joining is unchanged.
- **Modes.** Delegate: pick a seat; a signed-in delegate with an allocation skips the picker (`?country=…&locked=1`). Chair: FIRST the role (`src/components/chairRole/ChairRoleChoice.tsx`, `chairRole` `'head' | 'co' | null`; Moderator = `updateCommitteeHeadChairInDB(..., getGavelDeviceId(code))` before routing, Commenter = nothing; taking over a live Moderator asks first through `ModeratorTakeoverDialog`, advisory like presence), then an existing or new name plus the chair password, validated against `dbChairJoinSuffix`. A conference chair verified through `chair_user_ids` skips the password; an open dais uses it like a standalone session. Faculty advisor: `/advisor` or `/advisor?add=CODE`.
- **A chair name never equals a seat** (`src/lib/chairNameRules.ts`): a NEW name is refused when it matches a seat or is reserved by the chat (`Chairs`, `Everyone`, starting `__` or `group:`); names nobody typed go through `safeChairName`. Client-side only. `addChairName` is idempotent and atomic.
- Suspended: delegates wait, chairs join into the resume roll call. Ended: both join view-only.

### Seat gating and one person per seat (`src/lib/seatClaims.ts`)
- Gating is per SEAT. **Reserved seat** = the linked `conference_committees` row has a `conference_allocations` row for that country (by name OR code) that names a person (`user_id` or `application_id` set; `seat_claim_is_reserved`, 20 Oct 2026): a delegation's open seat with nobody in it reserves nothing, so the country stays an open seat in the room. A reserved seat means sign in, allocation checked, country locked, re-checked by `claim_delegate_seat` on the server. **Open seat** = everything else: the code alone. **Open dais** (`chairs_open`) = `chair_user_ids` empty AND no pending `conference_chair_invites` AND no unclaimed imported chair application; one pending invite closes it again.
- `session_join_rules(p_code)` → `{found, is_conference, chairs_open, reserved_countries}`, anon-callable, never names or ids. **`detectConferenceSession()` means "is the DAIS gated"** and FAILS CLOSED (falls back to `isConferenceSession()`, true on an error); the join page reads `session_join_rules` directly and fails closed too (every seat reserved). The advisor card is never offered on the open path.
- **One person per seat.** `delegate_seat_claims` has RLS on and NO policies. Holder = `'u:' || auth.uid()` or `'d:' || sha256(device token)` (`localStorage gavelling-seat-token:<CODE>`, never stored raw). Capacity = `committee_country_slots.delegation_size`, else `conference_committees.delegation_size`, else 1.
- **What it does NOT do**: the chair password is anon-readable and every session write is checked only by `has_session_code` / `is_session_chair`, never against a claim. It stops honest collisions, not a hostile user. Never describe it as a security boundary.
- `claim_delegate_seat(p_code, p_country, p_token, p_takeover default true)` runs on every `/delegate/[code]` load and is the authority for races. **Reserved BEFORE roster**: a reserved country not yet on the roster answers `signin` / `reserved` to everyone but its allocated account. Locks: holder, then device, then seat, always in that order. Same account + same device → `mine`; same account from another device → `other_device` when `p_takeover` is false, else the claim moves. The load claim passes `takeover: true`; every re-verify (30 s, tab-visible, `online`) passes `false`, and `other_device` shows the "open on another device" stop. **`p_takeover` defaults to TRUE on purpose** for older bundles. Never make a re-verify pass `true`. Only `taken`, `reserved`, `signin`, `other_device` or `kicked` eject; a network error never does.
- Deleting a `delegates` row forgets its claims (trigger `delegates_forget_seat_claims`). `delegate_seat_availability(p_code, p_token)` returns per seat `{capacity, claimed, full, mine, removed, removed_minutes}`, no holder info; `removed` is per CALLER.
- **Idle**: a claim whose `last_seen_at` is older than 65 minutes is expired by the server. On the client (`useDelegateIdleLogout`, `src/lib/delegateIdle.ts`, `/delegate/[code]` only) 60 minutes without activity (pointer, keys, visibility, focus, `markDelegateActivity()`; realtime is never activity) signs the device out with a 2-minute warning, `leave_delegate_seat` best effort, then `/join?code=CODE&idle=<country>`. Disabled when ended, while suspended, until the seat is confirmed, and **never while on the floor or in a queue** (`isProtected`). The routine heartbeat is skipped once idle; forced checks are not. `leave_delegate_seat` removes only the CALLER'S OWN claim on THIS device.

### "Your room is live" and the profile menu
- `LiveRoomsGate` (`src/components/liveRooms/`, root layout) opens for a signed-in user on the first page of a visit, NEVER on /chair, /delegate, /voting, /advisor, /join, /auth, /unsubscribe, /drafts, /invites, /api, apply or pay paths, and never over another gate or modal.
- `my_live_rooms()` (SECURITY DEFINER, authenticated only, the CALLER's rows, never `committees.settings`). `organiser` → `/manage/[slug]/live`; `chair` → the same role question, then `enter_live_chair_room(code, name, device)` (checks `chair_user_ids`, appends the name and claims the gavel ONLY when nobody holds it, under the row lock; writes no phase, caucus or clock) and `/chair/CODE?chairName=…`, a refused call falling back to `/join?code=CODE&mode=chair`; `delegate` → `/delegate/CODE?country=…&locked=1`; `advisor` → one entry per conference (`groupAdvisorRows`) → `/advisor`. One prompt at a time; "Not now" lasts the page visit; the standalone rejoin is offered on /sessions only. `LiveNowMenuSection` in `ProfileDropdown` reads the same cache (`useLiveRooms`), never keyed on the token.

Long form: docs/sessions/join-page.md

---
## FEATURE: FACULTY ADVISOR VIEW

- The single-room view `/advisor/[code]` is a redirect to `/advisor?add=<CODE>`. Faculty advisors use the board `/advisor` (CLAUDE.md §5e): read only, nothing there writes to a session, no nudges. Two views remembered per device (`BoardPrefs.view`): Up next (one list across every followed student, ordered by `queueRank`) and By committee. Nothing on the board links out to a room.
- **A conference's rooms are on the board only on its days** (owner, 23 Oct 2026): from 00:00 of the start date in the conference's time zone (local midnight without one) until the day after the last day (`src/lib/advisorBoard/conferenceWindow.ts`); before, one line says when it opens and no code is printed; dates to be decided open when the conference starts. The old advisor release date is not read on the advisor side. Roll call (once the room has started or someone is present) and voting are in session, never "not in session".
- A delegation block seat nobody fills is never followed; two students in one country and room are ONE row naming both, with one reminder. `my_advisor_delegation()` is re-read every 5 minutes and on tab visible (at most every 2 minutes); a failed read is never cached. Each room's ledger is held in memory and only newer rows are read (30 s overlap, a full re-read every 4 minutes). The board reads `settings->motionNames` only, never the settings blob. `scratch-advisor-board.sql` (not applied) makes the RPC enforce the window too.
- **Alerts on a phone in a pocket (web push, owner 23 Oct 2026)**: "Get alerts on this phone" (`board/PushAlerts.tsx`, `src/lib/advisorBoard/push.ts`, worker `public/sw-advisor.js`, scope `/advisor`, push and notificationclick only, no fetch handler) asks permission only on that tap and saves the subscription through `save_advisor_push_subscription`; the database decides the same moments as `reminders.ts` (2 speakers away, speaking) during the conference's days and the edge function `advisor-push` sends them. Rooms added by code go to the server as (code, country) only; typed names stay in the phone's IndexedDB. The control renders only when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set. Server side NOT applied yet: `scratch-advisor-push.sql`, `supabase-functions/advisor-push/`, steps in `docs/sessions/advisor-push.md`.

Long form: docs/sessions/faculty-advisor-view.md

---

## FEATURE: VOTING PAGE (/voting/[code])

- Opened from the Documents Vote button with `?chairName=`. Choices: For / For with Rights / Abstain / Pass / Against with Rights / Against, gated by `allowRightsVotes` / `allowPass`. P5 veto: one P5 Against fails; custom veto by `vetoCountries` (`src/lib/vetoMatch.ts`); unanimous: every P+V must vote For.
- **Landing = the resolution picker** (`ResolutionPicker.tsx`); `cardState` decides each card (Moderator starts, resumes or reopens; a Commenter opens only a vote that exists).
- **Every new ballot passes through the roll call** (`VotingRollCall.tsx`). With exactly ONE introduced DR, no stored `vote_state` and no open vote, the page opens its roll call itself, derived DURING RENDER (`autoDocId` → `effectivePendingDocId`) so the paper list never flashes. Start voting calls `startNewVote`, freezing `livePresent` into `order` (each seat with its status), the denominator into `votable`, and `votingMethod` into `method`; observers present open `ObserverConfirm` first. Commenters never get it. The bookmarks (threshold, abstain, veto, Voting) write through `applyRules(patch)` (store per key, ONE patch of the changed keys); statuses through `setRollCallStatus` / `setDelegateStatusesBulk`; observers through `toggleObserverSeat` (PV drops to P), optimistic, dropped only when the write landed and the row agrees. The quorum tabs count the ROOM, observers included; the ballot drops observers.
- The header's inline-end is identical to the chair top bar on every screen (code presenter, Chat, Scoreboard, Settings); there is no voting-rules popover. End debate is Moderator only behind a confirmation; it calls the same `endDebate`, reads `ended_at` back, lands on `/chair/[code]`. Hide tally is per device (`localStorage gavelling-hide-tally:<CODE>`).
- **The line** = `order` then `passedIds`; `currentVoterIndex` points into it. A delegation that passes is asked again at the end and must vote For or Against (no Pass, no Abstain). In the main ballot a delegation has a vote OR a Pass, never both. Every step is `advance(make)`, one `updateVote`; after the last vote it goes straight to the rights speakers or the result (`persistResult`).
- **Back** (`stepBack`, one `updateVote`): result or first rights speaker → the ballot at its end, votes kept, `result` null, `documents.status` back to `introduced` (waiting for Back's own save, `backStatusSeqRef`); rights → previous speaker; ballot → one seat back with its choice shown ("Keep and continue" = `keepAndAdvance`). Disabled on a device ballot at status `voting`.
- **Moving along the line**: `VoterCarousel` takes `onPick` / `canPick`: a seat is pickable when DONE (`lineSeatDone`) or the FRONTIER (`firstOpenSeat`), never beyond it. `goToVoter(index)` is ONE `updateVote`. Moderator only, status `voting`, never on a device ballot.
- **Rights speakers**: one speaking time for the round (`vote_state.rightsTimerLimit`; `rightsTimes` is no longer read); `RightsQueue` reorders upcoming speakers (`moveRightsSpeaker`, ONE `updateVote`); the countdown is local to the driving device.
- **The vote is persisted in `documents.vote_state`** (`src/lib/voteState.ts`: `status`, `order` / `votable` `{id, country, status}`, `votes`, `currentVoterIndex`, `passedIds`, `rightsOrder`, `rightsIndex`, `rightsTimerLimit`, `result`, `vetoed`, `method`, `seq`, `startedAt`, `updatedAt` stamped with `serverNowIso()`). Written ONLY by `saveVoteState` → `save_document_vote_state(p_document, p_state)` (SECURITY INVOKER; `seq` must strictly grow; `'ok' | 'stale' | 'denied'`). A `stale` save re-reads: the SAME ballot is re-applied above the stored seq, a different ballot wins. **The verdict write is checked** (`persistResult` → `updateDocumentStatus`, row-counted, Retry); a stored `status === 'result'` counts as voted even when `documents.status` was lost.
- **One device drives**: the Moderator's, by `deriveGavelRole`. Every other chair device is view-only (UI gate) and follows the open vote live (`followLive`); every ballot write refuses on `isViewOnly`.
- **Veto holders**: ONE helper, `voting/vetoHolders.ts` (`vetoListFor`, `holdsVeto`, `isVetoChoice`, `vetoRulesFromRow`), used by `evaluate`, the ballot and the delegate phone. An Against from a holder goes through `castOrAskVeto` → `VetoConfirm`; `VetoFlash` flashes once when a holder's vote BECOMES an Against (no state, no write).
- **The result card**: Passed, Failed, Vetoed (`vote_state.vetoed`; `documents.status` stays `failed`), Unanimous (derived on screen, never stored). Each has a hardcoded GIPHY id in `ResultBackdrop.tsx` (no API call; a privacy trade-off for the owner).
- **The room's phase**: opening as the Moderator calls `setVotingPhase(id, true)` → `set_committee_voting_phase`: ONE statement storing the current phase in `settings.votingReturnPhase`, setting `phase = 'voting'` and **pausing every clock**. Already voting = no-op; suspended or ended = refused. "Back to Session" restores the remembered phase (a caucus phase whose caucus is gone falls back to the GSL). The chair page renders `VotingInProgressCard` while `phase === 'voting'`. **A room is never left stuck in `voting`** (`src/lib/votingPhaseUnload.ts`): the voting page, as the Moderator with NO open vote_state (read at least once), restores the phase on `pagehide` by a keepalive fetch and stamps `localStorage gavelling-voting-tab-alive:<CODE>` every 20 s; the chair page restores it once per load only when the row was ALREADY `voting` at its first load, is still `voting`, no tab stamped in the last 45 s and `loadVoteStates` finds no open vote.
- The organiser live wall (`manage/[slug]/live/PhaseVariants.tsx`, `cardModel.ts`) may not read `vote_state`; check it before relying on it. Marking the floor speaker absent on the voting roll call writes only the status; the chair page's absent-floor-speaker effect removes them when it next evaluates.

### Device voting
- `votingMethod` frozen into the ballot (`parseVoteState` reads a missing `method` as `'rollcall'`). Contract `src/lib/deviceVoting.ts`; chair UI `voting/DeviceVotingPanel.tsx`; delegate UI `delegate/DeviceBallotScreen.tsx`.
- `DeviceVoteGate` polls `session_participants` and blocks Start while a delegation in the ballot has no live seat claim; absent is the escape hatch, there is no "Start anyway".
- Storage `document_device_votes` and `document_device_ballots` (RLS on, NO policies); `ballot_id` = `vote_state.startedAt`. Choices are NOT in `vote_state` until the reveal (`documents` SELECT is public).
- RPCs (SECURITY DEFINER): `cast_device_vote(p_code, p_document, p_country, p_choice, p_token)` (reasons `not_found`, `closed`, `bad_choice`, `no_ballot`, `revealed`, `not_in_ballot`, `not_holder` with `detail: 'voted_elsewhere'`, `no_abstain`, `no_rights`; **abstain eligibility is frozen** from `order[].status`; **one holder per delegation per ballot** by `holder_hash`); `my_device_ballot` (never a ballot whose `revealed_at` is set); `device_vote_status` (chair-gated, never a direction); `reveal_device_votes(p_code, p_document, p_force)` (chair-gated, refuses `incomplete` without force, stamps `revealed_at` once, idempotent).
- The chair's panel polls every 2 s while visible and reveals by itself at `cast >= total`; `applyDeviceReveal` is ONE `updateVote` (`votes`, `passedIds: []`, `currentVoterIndex = order.length`), then rights speakers or the result. `DeviceBallotScreen` covers the delegate board while `my_device_ballot` says open; every cast calls `markDelegateActivity()`.
- Honest limits: the chair password is anon-readable, so hiding choices until the reveal is a courtesy; a hostile device on an empty seat can vote it.

Long form: docs/sessions/voting-page.md

---
## COMPONENT: RollCallPanel

- **Status is picked, never cycled** (21 Oct 2026): `StatusPicker` (A / P / PV, an observer A / P) sets the pressed status through `setStatus`; see ROLL CALL. The full-screen roll call shows `rollcall_resume_kept` on a resumed or restarted room (`heldPriorSession`, also in the memo comparator while taking roll).
- Props that matter: `isRollCallPhase` (pre-session: bulk buttons, no GSL removal on absent, plain A-Z), `isReadOnly`, `onListIds`, `onReorderList`, `speechRunning` (the chair page's `timerRunning`, a press-time flip), `onJoinRequestResolved(country)`, `canAddToList` (kept on the props and in the memo comparator). `localStatuses` holds optimistic statuses and resets on `committee.id`.
- **Ordering (there is no A-Z / QUEUE toggle)**: `isRollCallPhase` and the mid-session Roll Call tab (`showStatusSliders`) are plain A-Z. Everywhere else: the floor holder (#1), the list in order, every PRESENT delegate not on the list A-Z, then every ABSENT delegate A-Z at the bottom. `queuePositionMap`: currentSpeaker → 1, speakersList[0] → 2.
- **Any speech start leaves the Roll Call tab** (a chair-page effect over `currentSpeaker.delegateId`, `caucus.currentSpeaker` and `timerRunning` false → true calls `setShowSliders(false)`) and scrolls the list to the top. Press-driven values only; nothing per second, no `setCommittee`, no `updateLocal`, no `localUpdateTime`.
- **An absent delegate is never added to a list.** Attendance changes ONLY through Roll Call (the status picker, the bulk buttons, the waiting room's Approve). Every add entry point (the sidebar row on the GSL and the caucus queue, `AddSpeakerInput`, `CaucusAddSpeakerInput` including Add first / Add last) refuses an ABSENT delegation, changes nothing and raises ONE card (`notifyDelegationAbsent`, `src/lib/absentNotice.ts`). **Waiting-room requests are answered by Roll Call**: `setStatus` (the status picker), moving an ABSENT delegation with a pending `join-request` to P or PV, drops the request locally (`onJoinRequestResolved`) and calls `resolveJoinRequestsOnAdmit`, which repeats and awaits the status write, then marks the request `approved`. `recogniseAbsentDelegate` and its relatives are gone.
- The panel has no seat affordance (no phone icon, no Free seat): seats are kicked in Settings → People and expire by idle.
- **Long seat names are never cut**: every delegation or character name in the session runtime renders through `<SeatName>` (`src/components/SeatName.tsx`, rule in `splitSeatName`, `src/lib/seatName.ts`). A known country's short form ("USA", "UK", "UAE", "DRC") shows ALONE, one row, with the full name as the `title` and for screen readers (`alone`, owner 21 Oct 2026); any other long name (a character) is two rows, the short form at the surface's size with the full name smaller beneath; a short name renders once. A name still too long for a narrow slot (the floor queue `SpeakerStrip`, this sidebar) steps its font down to fit (`fit` → `seatFitFontPx` / `seatFitFontCss`, measure-free from the character counts), never an ellipsis and never a word broken. Presentational only.
- Round flags through `SeatCircleFlag` (crest, flag, then `UnknownSeatIcon`, never a native emoji); the chair sidebar passes `fallback="initials"`. **Status colour is a roll-call thing only**: in slider mode P rows are green and PV gold; elsewhere P and PV rows are IDENTICAL and an absent row is the clear state, never dimmed. **Observer status is set ONLY while taking roll**; outside slider mode an observer row carries a megaphone badge (`role="img"`), never a control; a new observer drops PV to P. No X on the speaker's row: the floor holder leaves by a click on their row (`onRemoveCurrentSpeaker`). The list hides its scrollbar and keeps an edge fade written straight to the node, never React state.
- **Reordering**: no HTML5 `draggable`. Each reorderable row (in `committee.speakersList`, not #1, queue view, has `onReorderList`, not a Commenter, not ended) has a grip; mouse and pen drag the whole row (threshold, except buttons), touch drags from the grip only. `startPointerDrag` arms window pointer listeners; distances are divided by the list's scale (FitToScreen); the lifted row follows through a direct `style.transform`; React state (`drag = {id, slot}`) changes only on start, end and slot change; slot 0 is directly beneath #1. ArrowUp / ArrowDown on the grip. The drop is computed against the CURRENT `speakersList` (`reorderedList`), a no-op writes nothing, and `onReorderList` is called once (optimistic `updateLocal(..., true)` + chained `reorderSpeakersList`); a `justDraggedRef` guard means a drag never ends in a row click. The caucus panel's `onReorderList` is the stable `handleReorderCaucusQueue`.
- `hideIdentity` drops the committee heading and the majority pies (`CommitteeIdentityBadge` owns both); `MajorityPie` stays exported for the voting page.

Long form: docs/sessions/rollcallpanel.md

---
## COMPONENT: Chair top bar and sidebar masthead

- **The forest sidebar runs the full height.** The chair page's root is a flex ROW: `ChairSidebarShell` (the `<aside>`, the collapsed `SidebarFlagRail`, `SidebarResizer`), then the column holding the top bar, banners and floor, which MUST stay the shell's next element sibling (the shell animates it). `sidebarVisible`: not in pre-session, not while chat covers the floor, not on the End / Suspend View tabs.
- **Top bar** (`src/components/ChairTopBar.tsx`): inline-start `TopBarTab`s (Roll Call, Motions, Documents, equal shares); inline-end the `GavelChip`, the session code button (opens `SessionCodePresenter`: the SESSION code full screen, a locally drawn QR from `src/lib/qrCode.ts`; only ever `committee.code`, never the chair password; the text is measured so the code never leaves the screen), then `TopBarIconButton`s for Chat (unread count), Scoreboard, Settings. `data-tutorial` targets: `topbar`, `tab-rollcall`, `tab-motions`, `tab-documents`, `tab-chat`, `tab-settings`, `join-code`. `useTopBarTwoRows` moves the tabs to a second row when they are short of room (measured by ResizeObserver, state only when the answer changes); the chair page passes `NotificationStack topPx` from the header height.
- Roll Call expands a collapsed sidebar and opens the Roll Call tab.
- **Collapsing**: the masthead's collapse button, Mod+\ outside a text field, or dragging the divider narrower folds the sidebar to `SidebarFlagRail` (`SIDEBAR_RAIL_WIDTH`): the emblem, then the queue's round flags in speaking order (the floor holder first, up to 12), every one a button that reopens. **The rail reorders too**: the chair page passes `onReorderList` exactly where the expanded panel has one; queued flags only, never above the floor holder; the drop builds the full list like `RollCallPanel.reorderedList` and calls `onReorderList` once.
- With the sidebar collapsed the floor's bottom bar runs the full width: `FloorBarExtent` (`src/components/FloorBarExtent.tsx`) publishes the bar's height as `--floor-bar-h` on `[data-chair-root]` (ResizeObserver, written only on change) and the rail pads itself by it. Collapsed state persists per reader (`gavelling-sidebar-collapsed-chair:<name>`).
- **Width is proportional to the screen**: `sidebarBoundsFor(layoutWidth)` (`src/lib/sidebarWidth.ts`), layout width = `innerWidth x 820 / innerHeight`; a stored width is CAPPED on a smaller screen but never rewritten. The fold animates on transforms only (`ChairSidebarShell.tsx`, styles written imperatively, never React style props; the folded panel stays mounted, `inert`); `SidebarResizer` has zero layout width and reports raw widths (`onLive` / `onRelease`), the shell paints and decides.
- **Masthead** (`CommitteeIdentityBadge`): emblem, acronym with the full name beneath, the topic after a fixed "Topic:" label that is never editable, and `QuorumRings` flush on its bottom edge with the `seatField` beside them. Emblem order: `conference_committees.logo_url`, the conference's `logo_url`, `matchPresetEmblem(name)`, `DEFAULT_EMBLEM`, initials.
- **Editing the topic is writing in place**: the Moderator (`onTopicSave`, not ended) clicks the text or the pencil; Enter or blur saves, Escape cancels, newlines flattened, `COMMITTEE_TOPIC_MAX` 150, empty or unchanged writes nothing. Optimistic (non-structural `updateLocal`), then `updateCommitteeTopicInDB` through `sessionClient(code, suffix)`, conditional on `ended_at is null`, row-counted, via `runWrite` (parkable; false only on a refusal). On a conference committee with 2 or 3 topics the text still edits and a separate Switch topic button opens the agenda picker; editing never touches `agendaTopicIndex`, so `useAgendaPicker` matches the room's text first and falls back to the stored index, and the organiser's re-sync keeps a custom wording only while it equals a conference topic.
- **QuorumRings** (`src/components/QuorumRings.tsx`): three bookmark tabs (Present, 2/3, 1/2+1) with a static half-circle pictogram: present, `ceil(present x 2/3)`, `floor(present / 2) + 1`. **Who the quorum numbers count**: observers INCLUDED in the chair page's `presentCount` / `totalCount` (QuorumRings, `belowQuorum` / `quorumNeeded`, the GSL add gate, the Start gate) and in MotionsModal's motion voting; observers EXCLUDED only on the final substantive vote on `/voting/[code]` (`liveVotable`, the frozen `order` / `votable`, the veto roster). One pair of counts, so indicator and gate can never disagree.

Long form: docs/sessions/chair-top-bar-and-sidebar-masthead.md

---

## COMPONENT: Floor emblem

- `src/components/FloorEmblemBackdrop.tsx`, the first child of the chair page's floor `<main>` (which is `relative isolate` for it): the Gavelling mark drawn very large and faint as an emboss (`/gavelling-mark.png`'s alpha as a CSS mask, never a picture). Do not raise its strength without being asked.
- Centred on the element with class `floor-emblem-anchor` inside `<main>` (the floor flag, the Room Order disc, the unmoderated countdown); no anchor = the floor's centre. Keep that class on whatever you draw as the floor speaker.
- z-index -1 inside `<main>`, `pointer-events: none`, `aria-hidden`, static.
- **No React state and nothing per second**: position and size are written to the node, re-measured only on a ResizeObserver or a `childList` MutationObserver (a clock tick never triggers it), coalesced into one rAF with a timer behind it. Rects are divided by the FitToScreen scale.
- Side effect of `isolate`: floor content with its own z-index stacks inside `<main>`; portaled layers are unaffected.

Long form: docs/sessions/floor-emblem.md

---

## COMPONENT: Conference promo pop-up

- `src/components/ConferencePromoDialog.tsx`, mounted by the chair page beside `{agenda.picker}`: one heading, one line, Explore conferences (opens `/` in a NEW tab) and Not now. Keys `promo_conf_*`.
- **Shown only when all hold**: Moderator device (`!isViewOnly`), `sessionOrigin !== 'conference'`, `phase === 'unmoderated-caucus'` and NOT `caucus.isConsultation`, not during the caucus loading screen, not suspended or ended, the caucus clock has run 3 minutes (database clock), nothing else open (`blocked`: Motions, Documents, Settings, Scoreboard, Chat, tutorial, presenter, any `[aria-modal]` / dialog in the DOM), the tab visible, never shown before for this code on this device (`localStorage gavelling-conference-promo:<CODE>`, stamped when it opens).
- Checked on a 15 s interval and on `visibilitychange`. No committee state, no writes. If eligibility drops while open it disappears for good. A `GrowDialog`, no em dashes in the copy.

Long form: docs/sessions/conference-promo-pop-up.md

---

## THINGS THAT MUST NEVER HAPPEN

1. **Never wipe speakersList when entering a caucus**
2. **Never put GSL delegates into caucusQueue or vice versa**
3. **Never call setCommittee or updateLocal from inside the timer interval**
4. **Never set localUpdateTime from timer tick operations**
5. **Never call clearCurrentSpeaker when entering a caucus** (races with nextSpeakerInDB)
6. **Never use committee.chairNames[0] as senderName for chat**: always use myChairName from URL param
7. **Never remove a delegate from GSL when their status changes to absent during pre-session (roll call)**
8. **Never pass currentSpeaker to caucus RollCallPanel**: caucusRollCallCommittee sets it to null
9. **Never await DB writes for UI updates**: always fire-and-forget, optimistic first
10. **Never call removePendingMotionInDB with a temp ID**: wait for real UUID via pendingIds tracking
11. **Never use a native `<input type="date">` (or any other old/native date picker)**: see UI RULES
12. **Never write the settings store back to the DB as a whole blob**: send only the changed keys through `patchCommitteeSettings` / `saveCommitteeSettings` (see FEATURE: SETTINGS, WRITE side). Posting `{ ...getSettings(code), [key]: value }` is what used to revert another chair's settings and, with a hydrated `headChair`, the gavel itself. `NON_HYDRATED_SETTING_KEYS` (`chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex`, `votingReturnPhase`, `gslHeldFloors`) never enter the store and each has its own writer (`gslHeldFloors`: `src/lib/gslFloorReturn.ts` only).
13. **Never regenerate `chairJoinSuffix` when the DB already has one**: it is the ONLY write credential (`x-chair-suffix` → `is_session_chair`) and the code every chair typed on the join page. Overwriting it locks every chair out of a live committee. `SettingsPanel.tsx` generates one only when the store copy is `''`; keep that guard.
14. **Never read a setting via `getSettings(code)` on the delegate or advisor pages**: neither page ever hydrates the store, so it silently returns `DEFAULT_SETTINGS`. Use `getCommitteeFlags` / `sponsorLabel` / `getScoringConfig` / `docName`, which are pure functions of the committee row.
15. **Never treat `isViewOnly` as a permission**: it is a UI gate only. RLS grants full write access to anyone holding the chair suffix.
16. **Never render award UI in a standalone session, and never expose an unpublished nomination to a delegate**: awards are gated on `sessionOrigin === 'conference'` and on the `conference_awards` RLS. See FEATURE: AWARDS.
17. **Never let a phone into a seat without the chair's Approve while requireChairApproval is on, Present or not** (`src/lib/seatAdmission.ts`).

Long form: docs/sessions/things-that-must-never-happen.md

---

## UI RULES

### RULE: Always use the shared DatePicker for dates
- The native `<input type="date">` (and any other old or native date picker) must **NEVER** be used anywhere in the app. **EVERY** date input uses `@/components/DatePicker` (`value` ISO `'YYYY-MM-DD'`, `onChange(iso)`, optional `min` / `max` / `placeholder`).

### RULE: Popovers, dropdowns and tooltips must NEVER be clipped
- Any floating layer must **NEVER** be cut off by an ancestor's `overflow` or run off the viewport. Render it through `@/components/Portal` at **fixed** coordinates from the trigger's `getBoundingClientRect()`; reposition on `scroll` (capture) and `resize`; close on outside click accounting for the portaled node; **flip** near the right or bottom edge. Inside FitToScreen, convert into `#fit-root`'s scaled space (`voting/anchorPosition.ts`). Reference: the applications `PaymentMenu`, the shared `DatePicker`, `ConferenceRosterPicker`.
- **NEVER** un-clip a popover by loosening a shared card's `overflow`. Fix it at the popover.

### RULE: Informational "i" / hint popups open on HOVER, not click
- Reveal on hover (with a small close delay) and on focus; prefer a native `title` for one-line hints. Click-to-toggle is for menus and actions only.

### RULE: Long committee names show the ACRONYM, with the full name small beneath
- The acronym is the primary larger label, the full name a smaller second line; use `committeeDisplayName(fullName, acronym?)` in `src/lib/presetNames.ts`, preferring an explicit `abbreviation`. If the name is already short, show it once. Applies everywhere committees render. (Delegation and character names follow the same two-row rule through `SeatName`.)

Long form: docs/sessions/ui-rules.md

---

## WORKING RULES: SESSIONS WORK ON `feature/conferences-auth`

### RULE: Never push to production without explicit instruction
- All sessions work lands on **`feature/conferences-auth`**. The production deploy branch is `claude/muncommand-recreation-9yjin` (Vercel → gavelling.com). **NEVER** merge into or push to it unless Peter explicitly says "push to production" / "deploy this". Committing and pushing to `feature/conferences-auth` is expected.

### RULE: Always cross-check against Christian's work
- Christian Galindo (`chrisgalindoh`) owns the conferences layer on the same branch. Before changing a shared surface, check `git log --author=Christian` and `git log -p <file>`. Never revert, restructure or "clean up" conference-side code (`/manage`, `/conferences`, applications, assignment, financials, auth) as a side effect of a sessions change. The shared surface is **the database**: check his migrations before applying one.

### RULE: Always launch agents for tasks
- Every task (investigation, audit, implementation, verification) is delegated to a subagent. Independent agents run in parallel in a single message; agents touching the same file are serialised; every implementation is followed by a **verification agent**. At most 3 agents at once.

Long form: docs/sessions/working-rules-sessions-work-on-feature-conferenc.md
