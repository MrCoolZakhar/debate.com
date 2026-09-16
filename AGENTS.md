# GAVELLING.COM — CLAUDE CODE RULES DOCUMENT
## The Absolute Truth About How This App Works
### For Claude Code + Claude.ai — Read Before Touching Anything

---

## INFRASTRUCTURE

- **Supabase project:** `luruhkwrgisytejswlas` (us-west-2)
- **Repo:** `github.com/MrCoolZakhar/debate.com`
- **Deploy branch:** `claude/muncommand-recreation-9yjin` → auto-deploys to gavelling.com via Vercel
- **Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Supabase
- **Workflow:** Always `git pull` before starting. Always `npm run build` before committing. Always commit + push to deploy branch.

---

## DATABASE TABLES (DO NOT MODIFY SCHEMA WITHOUT EXPLICIT INSTRUCTION)

| Table | Purpose |
|-------|---------|
| `committees` | One row per session. Stores phase, caucus (JSONB), settings (JSONB), suspended_at, ended_at, expires_at, resuming_chair, session_origin |
| `delegates` | One row per delegate. Status: absent / present / present-voting |
| `speakers_list` | GSL queue (list_type='gsl') AND caucus queue (list_type='caucus'). NEVER mix these |
| `current_speaker` | Single row per committee. Stores who is speaking RIGHT NOW + time_remaining + started_at |
| `motions` | Pending motions including join-request and gsl-request pseudo-types |
| `documents` | Working papers and draft resolutions |
| `messages` | Chat messages + system speaking logs (sender='__system__') |
| `feedback` | Delegate feedback |

---

## CRITICAL ARCHITECTURAL RULES — NEVER VIOLATE THESE

### RULE 1: GSL and Caucus Queue are STRICTLY SEPARATE
- `speakersList` (list_type='gsl') = General Speakers List — PERMANENT, survives caucuses, never wiped by any motion
- `caucusQueue` (list_type='caucus') = Caucus speaker queue — TEMPORARY, wiped when caucus ends
- **NEVER** add GSL delegates to caucusQueue or vice versa
- **NEVER** touch speakersList when accepting a caucus motion
- When a caucus ends, ONLY caucusQueue is cleared — speakersList stays intact

### RULE 2: currentSpeaker is NOT in speakersList
- When `handleNextSpeaker` is called, the next delegate is POPPED from speakersList and placed in currentSpeaker
- currentSpeaker is a separate DB row in `current_speaker` table
- currentSpeaker must ALWAYS display as position #1 in the queue panel (RollCallPanel)
- Delegates in speakersList display as position #2, #3, etc.
- currentSpeaker shows a 🎙 badge in the side panel
- currentSpeaker is NEVER re-added to speakersList (gslListIds includes their delegateId to prevent this)

### RULE 3: speakerTimeRemaining is an ISOLATED useState atom
- `speakerTimeRemaining` lives in its own `useState`, NOT inside the committee object
- The timer interval only updates this atom — it NEVER calls setCommittee
- This prevents 1-second re-renders cascading across the entire component tree
- When the timer ticks: setSpeakerTimeRemaining only. Never updateLocal. Never setCommittee.

### RULE 4: localUpdateTime debounce clock
- `localUpdateTime` is a module-level ref: `const localUpdateTime = { current: 0 }`
- It is set via `updateLocal(setCommittee, updater, structural=true)` when structural=true
- **All realtime → state flows through `startSessionSync` (`src/lib/sessionSync.ts`)** on the chair, delegate, advisor AND voting pages (14 Sep 2026, audit R-1..R-4, PERF-1..3, P-4). The voting page binds only `committees`, `delegates` and `documents` (slices `row`, `delegates`, `documents`) and re-reads vote states on a `documents` event and on every catch-up.
  - Each event marks ONE slice dirty (`committees` → the row only via `getCommitteeRowById`, `delegates`, `speakers_list` → both lists, `current_speaker`, `motions`, `documents`). Dirty slices are fetched once, ~200 ms after the first event (coalesced), so 190 "All present" events are one roster fetch.
  - **One sequence counter PER SLICE.** A result of slice X is dropped only when a NEWER result of X has already been APPLIED (`appliedSeq`); being overtaken by a fetch that merely started later is not enough, because under a burst every fetch is overtaken and the slice starved until the burst ended (S1). An older result that lands first is simply overwritten. Slice Y is never affected. NEVER go back to one shared `fetchSeq`: that is what threw away the caucus on phones (R-2).
  - `messages` are never refetched on an event: the realtime INSERT payload is merged by id (`messageFromRow` + `mergeMessagesById`). Only a catch-up refetches them. `mergeMessagesById` compares rows by CONTENT (id, sender, content, recipient, privacy, timestamp) and returns the previous array when nothing changed, so a catch-up of identical rows keeps the array identity the `parseLogEvents` memo is keyed on.
  - A failed slice read is `null` (P-4), never `[]`, and is never applied; it is retried twice.
  - Catch-up: on re-SUBSCRIBED, `visibilitychange` to visible, `online`, and a heartbeat gap > 10 s (a sleeping laptop), every slice is refetched through the same sequencing. `ConnectionPill` shows Live / Reconnecting / Offline from the same source; after `online` it shows Reconnecting until the next SUBSCRIBED (or 8 s with the socket still reading SUBSCRIBED and nothing else reported). Catch-ups are throttled to one per second; `catchUp(only, { force: true })` skips the throttle and is for a caller that KNOWS its state went stale (a conditional write that did not land, a resync that predates a local write). Every SUBSCRIBED catch-up is forced (S5), so the throttle can never swallow a reconnect. `onCatchUp` reports `'failed'` instead of `'done'` when every read of the catch-up failed, and `isFresh()` stays false (starting another catch-up) until one succeeds.
  - Vote saves: every ballot write fires one `documents` event on every surface. It is coalesced like any event (one fetch per 200 ms window) and fetches ONLY the documents slice; no page refetches the whole committee for it.
  - Delegate and advisor pages do NOT subscribe to `feedback` or `session_broadcasts` (they render neither); `subscribeToCommittee` takes a `tables` list (default all nine).
- The chair page loader has a `cancelled` guard like the delegate, advisor and voting pages (S6): an unmount or a `code` change while `getCommitteeByCode` is in flight starts no state writes, no sync, no heartbeat, no listeners and no channel.
- **Chair page apply rules** (the `apply` callback in the chair loader):
  - `localWriteSeq` (module-level, bumped by EVERY `updateLocal`, structural or not; timer ticks never call updateLocal, so ticks never move it) is stamped on each fetch. **A fetch that returns after a local write it predates is never applied over that write**; the slice is fetched again 250 ms later (R-1: a late refetch used to bring the previous speaker back after Next, and a second Next logged the speech twice).
  - `debounceLeft()` = what remains of `Date.now() - localUpdateTime.current < 3000` (always 0 for a Commenter).
  - Row inside the window: merges ONLY the gavel (`dbHeadChair`, `dbHeadChairDevice`), `chairNames`, `resumingChair`, `endedAt`, and a suspend change; phase / caucus / topic / settings are fetched once more when the window closes (R-3). Stale row (local write since the fetch started): only `chairNames` and `endedAt`.
  - Lists inside the window are not even fetched; the fetch is scheduled for when the window closes (R-3), so nothing another device did is lost.
  - Delegates are applied inside the window, with `applyPinnedStatuses`. Documents and motions are applied inside the window (not optimistic chair state).
  - Outside the window with the Moderator's speaker clock running: the row lands but keeps local `phase`, `caucus`, `speakerTimeLimit`.
  - `current_speaker`: a Commenter patches it on every event; the Moderator ignores its events (RULE 6) and reads the row back only on a catch-up, and never while its clock runs.
  - **One-off full resyncs use the same guard.** The gavel-handover resync (ROLE TRANSITION effect) and the three resume refetches (`runResumeRollCall`, `handleResumeClick`, `handleTakeOverResume`) go through `fetchCommitteeGuarded(code)` (chair page), which reports `stale` when `localWriteSeq` moved during the fetch. They still read server facts from it (still suspended? who holds the latch?) but a stale snapshot is never merged into state: they call `syncRef.current.catchUp(undefined, { force: true })` instead.
- **Automatic Moderator writes check freshness first (R-6).** The moderated-caucus expiry effect and the stop-at-zero re-anchor call `syncRef.current.isFresh()`; while a catch-up is outstanding (or the page has just woken) they stand down and run again on `catchUpTick`. The expiry write is `endModeratedCaucusIfAnchorUnchanged` (`committeeService.ts`, re-exported by `src/lib/caucusExpiryWrite.ts`): phase + caucus in one update, applied only while the row is still `moderated-caucus` with the same `caucus.totalStartedAt`. It runs through `runWrite` on the same keys as `setPhaseAndCaucus`: zero rows because the caucus moved on is `'skipped'` (not reported), zero rows while the row STILL matches (an RLS refusal) or a transport error is `'failed'` (retried, then the "Not saved" toast). When it does not land the page drops the window and forces a catch-up. It is the only caucus-ending write the expiry issues (no `setPhaseAndCaucus` fallback: the effect returns early without an anchor), and it is issued from the effect body, never inside a `setCommittee` updater (React may run an updater twice).
- **TIMER TICKS MUST NEVER SET localUpdateTime** — or delegate views lose visibility
- **NEVER set structural=true on timer tick operations**
- **The gavel knock is a read-only side effect of the timers, never a timer operation.** `useGavelCue(remaining, running, cue)` (`src/lib/useGavelCue.ts`) watches values that already exist (`speakerTimeRemaining` + `timerRunning` for the GSL, moderated caucus and Tour de Table; the unmoderated/Consultation `caucusSeconds`; the CoW timer; `rtrTimeRemaining`) with refs only, and calls `playGavelKnock()` (`src/lib/gavelSound.ts`, Web Audio synthesis, no file). It never calls setCommittee/updateLocal, never sets `localUpdateTime` and never writes the DB. A knock needs a GENUINE countdown step (15 Sep 2026, "the gavel knocks randomly"): two consecutive RUNNING samples straddling the mark, with the SAME anchor identity (the 4th argument: `speakerClockEpoch`, bumped by every `seatSpeakerClock` and never by a tick; `caucusAnchor|remainingTime` for the unmoderated total; `rtrCountry`; the CoW `cowSetSecs`), a drop of at most 2 s (`GAVEL_MAX_STEP_SECONDS`) taken within 3 s of the previous sample, and only in the tab the chair last clicked, typed in, focused or brought back into view (`window` focus and `visibilitychange` to visible claim it too, and arming claims it when the tab is visible and focused, so closing the last-clicked tab cannot silence the remaining one) (`GavelCue.scope` = the code, `localStorage gavelling-gavel-knock-tab:<CODE>`). Root causes it closes: a tab that was throttled or froze and woke past the mark (18 s → 12 s read as a crossing, a knock seconds late), a server clock offset correction or a stale derived `caucusSeconds` jumping the value, a reseat while `timerRunning` stayed true (a new time limit, the caucus seed), and a SECOND chair tab on the same device (same gavel device id, so also Moderator) that ignores current_speaker events and kept counting down an anchor the other tab had already paused or replaced, knocking while the visible clock was not started. Pausing, starting below the mark, reloading mid-countdown, Next, Restart, extra time and catch-ups never knock. Moderator's device only (the role is derived from the row, not only from `isViewOnly`), never when ended or suspended. The moderated caucus TOTAL is deliberately not wired: its speakers already knock.
- caucus queue mutations DO use structural=true (to prevent realtime flickering)
- **`feedback` is handled BEFORE the debounce check and returns early** (the sync's `onEvent`), beside
  `session_broadcasts`; `messages` land from the payload. Chair notes and factor ratings are not optimistic
  speaker/timer/caucus state, so RULE 4 does not apply to them — and this device routinely
  receives the echo of its OWN write while a chair is still typing, so swallowing it would
  only make the other chair's note invisible. The handler bumps a `feedbackVersion` counter
  rather than refetching: the two readers (the comment dock and the scoreboard) each own
  their own query and neither is always mounted.
- `subscribeToCommittee` subscribes NINE tables by default (the chair page uses all nine; delegate and advisor pass seven): committees, delegates, speakers_list,
  current_speaker, motions, documents, messages, **feedback**, session_broadcasts. No
  migration was needed for feedback — it was already in the `supabase_realtime` publication
  and its SELECT policy is `true`; writes remain gated on the chair suffix.

### RULE 5: Optimistic Updates Pattern
- ALL chair actions use `updateLocal(setCommittee, updater)` for immediate UI response
- DB writes are fire-and-forget — never await them for UI updates
- The pattern is: updateLocal first → DB write second (fire-and-forget)
- Exception: when you need the real DB UUID back (e.g. addPendingMotionInDB returns real ID)
- **Every session write reports whether it LANDED** (audit R-5, 14 Sep 2026). supabase-js resolves on an RLS rejection and returns `error: null` for a zero-row update, so each non-settings write in `committeeService.ts` asks for `.select('id')`, counts rows, and resolves `Promise<boolean>`. A DELETE that removed nothing re-reads the row (SELECT is public): still there = refused, gone = success. A conditional write that matched nothing (`updateCaucusIfUnchanged`, `stopSpeakerAtZeroIfUnchanged`, `clearCurrentSpeakerIfUnchanged`, `pauseSpeakerClockLive`, a stale second End) counts its rows and re-reads the row: no longer matching is `'skipped'` (silent), still matching is a refusal (`'failed'`, reported).
- All of them run through `runWrite` (`src/lib/writeStatus.ts`). Idempotent writes (phase, caucus, `setPhaseAndCaucus`, the speaker clock, list add / reorder / caucus clear through the RPCs, suspend, end) retry with backoff, 3 attempts max, and a newer write with the same key supersedes an older one still retrying. Non-idempotent ones (motion INSERT, `grantSpeakerTime`, list/motion delete, a delegate status tap) are reported but never auto-retried. Retries of chained writes stay INSIDE their chain, so ordering holds. "Retrying" is tracked per write call, not per key.
- **Nothing retried lands after a break (S2).** `setPhase`, `setPhaseAndCaucus`, `updateCaucus` and `updateCaucusIfUnchanged` are conditional on `ended_at is null and suspended_at is null` (zero rows on a break is `'skipped'`); no caller writes a live phase or caucus during a break (resume goes through `startResumeRollCall` / `beginSessionAfterRollCall`). `suspendDebate` / `endDebate` call `cancelPendingRetries([phase, caucus, speaker keys])` first, so a retry still backing off from before the break gives up. Writes that belong to the break itself are `survivesLifecycle` and exempt: `clearCurrentSpeakerIfUnchanged` and `pauseSpeakerClockLive`.
- **Toast Retry never re-runs a write out of context (S3).** `runWrite(..., { rerunnable: false })` failures show "Not saved" with Dismiss only: `suspendDebate`, `endDebate`, `pauseSpeakerClockLive`, `clearCaucusList`. A landed write clears stale failures of the same key; a landed PHASE write clears every stale failure of that committee.
- A bulk roll call (`set_delegate_statuses`) falls back to per-row writes ONLY on `PGRST202` (the RPC is missing). A refused single or bulk status write unpins the rows and refetches the delegates slice.
- The chair page mounts ONE `SaveStatusToast` (`src/components/notifications/SaveStatusToast.tsx`, glass): `session_save_retrying` while retries run, then `session_save_failed` with `session_save_retry` / `session_save_dismiss`. Never add a second per-button error toast for these writes.
- The boolean is handled ASYNCHRONOUSLY and only where a rollback is needed: End Debate and Suspend. Both call sites (`runBroadcastEffect` on the chair page, and MotionsModal's Suspend / End "Yes") remember phase / suspendedAt / endedAt / expiresAt and put them back when `suspendDebate` / `endDebate` resolve false; the failure itself is reported by the toast. The chair page drops its suspended / ended overlay when a stamp goes back to null. The voting page's End Debate reads `ended_at` back instead. (DocumentsModal has no suspend or end call site.)
- `speakers_list_reorder` returns void and an RLS-refused UPDATE inside it is silent, so `reorderSpeakersList` reads the list order back after the RPC (SELECT is public) and reports a mismatch as `'failed'` (retried, then the toast). Rows that vanished meanwhile are ignored. A concurrent drag on another device can also produce a mismatch; the retry re-applies this device's order, which is the same last-writer outcome as before.

### RULE 6: current_speaker subscription is SKIPPED
- The Moderator's session sync ignores `current_speaker` events (`wants: table !== 'current_speaker' || isViewOnly`)
- The Moderator owns current_speaker entirely: no re-fetch on its own echoes
- Commenters (view-only) DO process `current_speaker` events (a one-row fetch through the session sync). The Moderator reads the row back only during a catch-up (wake / reconnect / online), and never while its speaker clock runs

### RULE 6b: Clocks run on the DATABASE clock, and anchors move in single writes (14 Sep 2026)
- **Never use `Date.now()` / `new Date()` against a session timestamp.** Stamp anchors (`current_speaker.started_at`, `caucus.totalStartedAt`, `suspended_at`, `ended_at`, `expires_at`) with `serverNowIso()` and compare with `serverNow()` from `src/lib/serverClock.ts` (audit T-1: production devices were 11 s, 40 s and ~10 h off). The offset is measured against the `server_now()` RPC (SECURITY INVOKER, anon/authenticated) on load, on `online` and on tab-visible, best of 3 by round trip: `offset = serverTime + rtt/2 - receivedAt`. `caucusRemainingNow`, `speakerRemainingNow`, `moderatedCaucusRemainingNow`, `spokenSecondsFromAnchor` and `anchorCaucusClock` default to it, so the delegate and advisor clocks are corrected without touching their pages. The chair page shows `ClockSkewHint` (`session_clock_skew`) when this device is more than 5 s off. Purely local timers (presence, pins, the gavel pin, rate limits) stay on `Date.now()`.
- **Pause is ONE write** (audit G-3): `pauseSpeakerTimer(id, liveRemaining, ...)` writes `{ started_at: null, time_remaining }` together. Never `stopSpeakerTimer` + `syncSpeakerTime` again. Restart is one write too: `syncSpeakerTime(id, slot, code, suffix, slot, stop=true)` writes `{ time_remaining, time_granted, started_at: null }` together.
- **No speaker clock runs outside the GSL and the caucus phases** (audit G-4): `setPhase` / `setPhaseAndCaucus` to `pre-session`, `adjourned` or `voting`, `suspendDebate` and `endDebate` all call `pauseSpeakerClockLive`, a conditional pause at the live value read from the row.
- **Phase and caucus change in ONE update** (audit R-7): `setPhaseAndCaucus(id, phase, caucus, ...)`. Used by every caucus end on the chair page (End button, unmoderated End, expiry, Next past the total). MotionsModal's five caucus accept paths (unmoderated, consultation, moderated, both Tour de Table orders) use it too.
- **Speeches are logged from the persisted anchor** (audit T-3): `current_speaker.time_granted` (nullable int) holds the slot plus every +time. `nextSpeaker` sets it to the slot, `syncSpeakerTime(..., timeGranted)` resets it on a restart or new limit, `grantSpeakerTime` adds a grant and re-anchors in one write (not auto-retried: it reads then adds). `readSpokenSeconds` reads `time_granted - live remaining` on the current_speaker chain.
- **ONE speech logger: `src/lib/floorSpeech.ts`.** `logFloorSpeech(committee, clock)` is the only way a floor speech is written, from every path: Next (GSL), Next (caucus), Finish, a caucus accepted over a speaker, a moderated caucus ended by hand or by expiry, Suspend / End Debate (motion or organiser broadcast). The Consultation of the Whole floor holder (flag tap, caucus end) has no current_speaker anchor and uses `logTimedSpeech` with `cowTurnKey` (floor holder + the database-clock instant they took the floor). A Room Order Tour de Table has no per-turn log (its "Speaker N" placeholders are skipped) and is credited once when it ends by `creditRoomOrderTour` with `roomOrderTourTurnKey` (one speech per delegation on `caucus.roomOrderCountries`, see FEATURE: UNMODERATED CAUCUS / CONSULTATION / TOUR DE TABLE). `logSpeakingTime` and `logSpeechFromAnchor` are gone; never log a `speech` through `logEvent`.
  - Seconds: `readSpokenSeconds` first (T-3); the device-local `slot + extraTimeAddedSecsRef - live` is only the fallback for rows written before `time_granted` existed. Call `logFloorSpeech` synchronously AFTER any pause write and BEFORE the Next / clear, so its read is queued between them on the chain. Pass the clock anchor from BEFORE the pause: it names the turn.
  - Idempotency, EXACT by key (S7): `turnKey` = committee + speaker + `seat:<epoch ms of current_speaker.seated_at>`. `nextSpeaker(..., seatedAt)` stamps `seated_at` every time it seats a delegation (the chair passes the same `serverNowIso()` it puts into local `speakerSeatedAt`), and every clear nulls it, so the key is stable through pauses, restarts and +time and different for every seating. Epoch ms, because the Moderator holds "...Z" and readers get "...+00:00". There is no time window any more, on this device, in the loaded log or in `parseLogEvents`. A row seated before the column existed falls back to the old `s:` / `p:` anchor key; only those legacy `|p:` events in existing logs are still compared within 15 s in `parseLogEvents`, so today's history keeps its real repeat speeches. Event timestamps are on the database clock.
  - Consultation of the Whole: the floor holder's start is persisted as `caucus.floorSince` with the flag tap, so a reload keeps it (fallback: the last CoW speech logged in this caucus, then mount time). It is the `cowTurnKey` instant.
  - A path that logs a speech and does not seat a new speaker must CLEAR the floor (conditional clear), or a later Next logs the same turn again long after any duplicate window: Suspend / End Yes in MotionsModal and the organiser broadcast pause / end both do.
- **A legacy running moderated total with no running speaker clock** (written before the total stopped with its speaker) is paused once on load by the Moderator, at its live value capped to `caucus.totalTime`, through `updateCaucusIfUnchanged` (skipped when out of time: the expiry effect ends it).
- **Every current_speaker write rides one per-committee chain**, including the conditional clear (`clearCurrentSpeakerIfUnchanged`, which used to have its own in-flight promise) and the anchor read. MUST NEVER HAPPEN #5 still holds by the same two properties: conditional on the speaker's identity, and ordered.

---

## FEATURE: GSL (General Speakers List)

### How it works
- Delegates are added to speakersList via AddSpeakerInput (chair) or GSL Request (delegate → chair approves)
- Chair clicks "Start" to begin timer for currentSpeaker
- Chair clicks "Next" to advance: currentSpeaker logs speaking time, next delegate from speakersList becomes currentSpeaker, speakersList shrinks by 1
- Timer is isolated to speakerTimeRemaining atom
- Progress bar shows time progress

### Rules
- currentSpeaker can NEVER be re-added to speakersList
- If delegate goes absent, remove them from speakersList AND caucusQueue (but NOT during pre-session roll call)
- GSL is NEVER wiped when entering a caucus
- **The GSL may elapse by default.** `gslRequireNextSpeaker` defaults to **false**, and with it off a chair can call and time the last delegate on the list and let the GSL run dry. Only when a chair turns the setting ON does `isLastGSLSpeaker` block the Start button and the call-first button require two names, so the queue never empties mid-session. Both buttons read the same setting: the call-first button used to require two delegates unconditionally, which blocked a one-name GSL from ever starting and is what "chairs cannot start the timer" was.
- **Finish (G-1).** When the GSL behind the current speaker is empty, the Next button is replaced by **Finish** (`gsl_yield`, Moderator only, hidden when ended, and not offered while `gslRequireNextSpeaker` is on: the disabled Next shows instead). `handleYieldFloor` logs the speech through `logFloorSpeech` (`src/lib/floorSpeech.ts`, the one speech logger, see RULE 6b) and clears the floor exactly like Next with nobody queued.
- Extra time (+⏱) re-anchors the speaker clock and persists it (one `current_speaker` write per press, never per second). **In a moderated caucus / Tour de Table the grant is capped** to the room between the live speaker clock and the live total (`moderatedCaucusRemainingNow`); the total is never extended, and a cut grant flashes `caucus_extra_time_capped` ("Only {n}s left in this caucus.") for 6 s. Before reseating the speaker it re-anchors the TOTAL at that live value (running iff the speaker clock is), so a total left armed past a speaker's zero cannot read uncapped and end the caucus.
- Right of Reply is a fully INDEPENDENT movable overlay (`DraggablePopover`, see below) with its own `rtrTimeRemaining` state (`chair/[code]/page.tsx:1284-1288, 3148-3206`). It NEVER writes `speakersList` — it does not insert the delegate into the GSL, and it does not touch `currentSpeaker`. It logs a `right-of-reply` scoring event (`:3174`) and nothing else. (This line previously claimed RTR inserted at the top of speakersList with a time override; that was verified false against the code.)
- speakersList display in main view prepends currentSpeaker as position 1 (gslDisplayList)
- **On deck: there is no "No current speaker" screen (owner, 16 Sep 2026).** With nobody seated and a non-empty GSL, the chair page draws `speakersList[0]` (`onDeck`) on the floor: big flag, name, the clock at the speaker time limit (never the row's leftover `time_remaining`), the progress bar full and RTR beside it; in the strip their flag has a soft gold rim and "Ready to speak" (`gsl_on_deck`, `SpeakerStrip onDeckDelegateId`). **Nothing is written for this**: they stay an ordinary `speakers_list` row, so they stay draggable, grip-movable and removable, and a caucus, suspend/resume, reload or catch-up cannot drop or duplicate them (RULE 1 already protects the list; verified: moderated caucus in and out plus reload, still on deck, no speech logged). RULE 2 is unchanged: seating still pops them into `current_speaker`. **Start** on the floor (button or the clickable clock) calls `handleStartOnDeck`: optimistic seat + clock, then `nextSpeakerInDB(..., seatedAt)` and `startSpeakerTimerInDB` with the same `serverNowIso()` stamp, both on the current_speaker chain, so the turn key (S7) is ordinary. **Next** still reads Call first speaker and seats them without starting. Restart and Add time stay disabled until someone is really seated (`SpeakerControls` `floorReady` enables only Start). `gslRequireNextSpeaker`: `isLastGSLSpeaker` counts the queue BEHIND the floor holder (`speakersList.length - 1` while on deck), so Start is blocked on a one-name list exactly as the call-first button always was. An empty GSL shows only the strip header and `gsl_add_call_first`; the caucus no-speaker branch dropped its big heading the same way (no on deck in a caucus).
- **Strip header and size (16 Sep 2026).** `SpeakerStrip` takes `header` (`StripHeader`: icon, label, sublabel, meta) rendered above the flags even with an empty list, and the strip sits lower (`pt-4`). GSL: `ListOrdered` + `gsl_full_name` ("General Speaker's List"), the committee topic beneath, `gsl_queue_count`. Moderated caucus / Tour de Table: `Users` + `caucus.motionLabel` (the motion's chair-given name) or the fallback title, the purpose beneath, `caucus_spoke_count`. The floating "GSL" caption and the caucus's inline-start label block are gone. Up to TEN upcoming speakers (`VISIBLE = 10`, plus the seated speaker), flags still 52px; past 7 the gaps tighten and names clamp to 64px.
- **Add bar (16 Sep 2026).** One row under the speaker controls: `AddSpeakerInput` fills the width (a forest + disc, the typeahead, and up to five QUICK-ADD chips of present, unqueued delegations in roster order, `gsl_quick_add`, hidden while typing and below `md`), the speaking-time presets and custom field beside it (`gsl_time_preset_title`, `gsl_time_custom`). Enter, Escape and the recognise-absent path are unchanged.
- **Speaker buttons never disappear (15 Sep 2026).** `src/components/SpeakerControls.tsx` renders Restart (icon), Start / Pause, Next (or Finish / Call first speaker) and Add time (`ClockPlus` ICON ONLY, aria-label + tooltip, pale sky blue `#D4EAFB` with navy) for the Moderator on the GSL AND the moderated caucus / Tour de Table, with or without a speaker. With the floor empty, Next calls the first delegate (`gsl_call_first`; it carries the tutorial's `call-first-speaker` target, the old big button is gone) and Start / Restart / Add time are `aria-disabled` with a tooltip saying why. The row never wraps (max-w-3xl): Start and Next flex and truncate a long label (fr "APPELER LE PREMIER ORATEUR"), and Next's tooltip leads with its full label. Every available button carries `gv-lift` (the soft forest-tinted shadow the controls had before 84549720); unavailable ones drop it. Presentational only; every handler is the chair page's.
- **Right of Reply sits to the right of the floor's progress bar** (`FloorProgress` + `RtrButton` in SpeakerControls.tsx): the icon with a short caption beneath (`speaker_ctl_rtr_short`: RTR / DR / DR / رد), muted sand `#EBD3B6` with deep brown `#5A3413` (was saturated orange). The bar row is 46rem wide so RTR lines up above Add time. With nobody on the floor there is no bar, so RTR goes at the end of the button row instead. Not in Tour de Table, not for a Commenter, not when ended.
- **The countdown is a start / pause button** (`SpeakerClock`, 15 Sep 2026): Moderator only (a Commenter's GSL shows "is speaking", a Commenter's caucus clock is plain text), not when ended. Click, Enter or Space calls the SAME `handleToggleTimer` as the Start / Pause button, so the quorum return, the zero-clock return and the caucus cap all hold; on the GSL it also receives the Start button's `gslStartBlockedReason` (below quorum, require-next-speaker on the last speaker) and is `aria-disabled` with that tooltip while it cannot start. Pausing is always offered. Hover shows a faint tint and a play / pause glyph; `role="button"`, `aria-pressed`, focus ring. No new state, no write of its own (RULES 3 to 5).
- **The RTR and Add time popovers are movable** (`src/components/DraggablePopover.tsx`): Portal at fixed coordinates, dragged by the grip bar at the top (pointer events; Arrow keys on the focused handle move 16px, Shift 64px), clamped inside the viewport on open, drag, resize and content growth. The Portal target is FitToScreen's scaled `#fit-root`, so positions are in its local space and pointer deltas are divided by the live scale. The position is remembered per popover (`gavelling-popover-pos:right-of-reply` / `:add-time`) in sessionStorage, i.e. for this tab's session on this device. **Default spot (16 Sep 2026): above the buttons, never on them.** Each button carries `data-floor-anchor` (`add-time`, `rtr`); a panel with `anchor` sits 12px above the TOPMOST floor anchor, 2rem from the inline-end edge, and a second panel opens ABOVE the first (a remembered spot keeps the old below-else-above rule). Without an anchor on screen it falls back to `BOTTOM_CLEAR` (220px) above the bottom. **Colours and icons:** `tone` = `POPOVER_TONES` in SpeakerControls.tsx, Add time a deep blue header (`#0E3A57` / `#DCEBF8`) over `#D9E8F4`, RTR a deep orange header (`#7A3E12` / `#FBE7D1`) over `#F2DCC2`, every text pair at least AA; the header shows `ClockPlus` / `MessageSquareReply`, and so do the primary actions (Add, Grant). **Motions and Documents never cover or hide them:** `avoid={showMotions || showDocuments}` steps a panel out of the centred modal column (1072px band) to a side with room, or, when neither side has room (1280px), DOCKS it: folded to its handle bar in the bottom inline-end corner under the dialog, two docked panels side by side. The nudge never writes `homeRef` or sessionStorage (resize and content-growth refits go through `refit`, which respects it), so closing the modal puts the panel back exactly where the chair left it. **Both may be open at once** (owner, 15 Sep 2026): two independent flags (`openPopovers.extraTime` / `.rightToReply`, `setPopover(which, open | 'toggle')`), a panel that would open on top of another open one (a remembered spot) opens clear of it, and the last one pressed sits at z 51 over the other at 50. **Both close when a motion or caucus starts or ends, on Suspend, End, any phase change and when the floor speaker changes** (`floorCloseKey`: phase, suspend/end stamps and states, GSL speaker, caucus speaker, caucus type / proposer / purpose). RTR additionally closes when a speaker clock or caucus total starts (as before); Add time does not, since adding time to a running speech is its purpose, and applying a grant closes only Add time.
- **The floor speaker is round and bigger** (15 Sep 2026): the GSL and moderated caucus / Tour de Table speaker card draws `SeatCircleFlag` at 164px (`FLOOR_FLAG_PX`, crest, flag, monogram) with a soft lift, instead of the 165x110 rectangle. Room Order Tour de Table keeps its number disc. The top strip chips are `SeatCircleFlag` at 52px (gold double ring on the floor speaker).
- **Removing the speaker holding the floor (15 Sep 2026).** `handleRemoveCurrentSpeaker` (chair page), reached from the X on the floor speaker in the top strip (GSL), a click or the X on their sidebar row (`RollCallPanel` `onRemoveCurrentSpeaker`, a STABLE callback in its memo comparator), and the floor speaker going ABSENT (an effect over the floor delegate's status, any source, never in pre-session, re-run on `catchUpTick`, stands down while a catch-up is outstanding). Moderator only, not ended or suspended. Order on the current_speaker chain: pause at the live value (one write), `logFloorSpeech` (skips 0 s and Room Order), `clearCurrentSpeakerIfUnchanged`. In a moderated caucus the total is re-anchored PAUSED at its live value with `caucus.currentSpeaker: null` (the speaker joins `spokenCountries` if they spoke), so an empty floor neither drains nor expires the caucus. Leaves nobody on the floor even when the list is empty.
- **Top speaker strip reorder** (`src/components/SpeakerStrip.tsx`): pointer events (mouse, pen, touch), 6px pickup threshold, the flag follows the pointer by transform, a gold drop bar, never before the floor speaker, one `onReorder` on release (none if it lands where it started), the click after a drag swallowed, tracked by delegate id so a realtime refresh cannot move the wrong flag. Grip button: Arrow Left / Right move one place. **"Sometimes a drag does not move them" (15 Sep 2026), three causes:** (1) the dropped flag animated back from the release point over 180ms (`transition: transform`), so a press made right after a drop hit the neighbour or empty space; the flag now lands instantly. (2) A press on the X / grip corner never armed a drag (`data-strip-remove` returned early and the X covers the flag's top corner); it arms one now, and a plain tap still removes. (3) The pointer was followed by element pointer capture on the flag node, which ended silently whenever that node was replaced; it is followed on window listeners (pointermove / up / cancel, capture phase) reading the latest list through refs, detached on drop and on unmount, and the click after a real drag is swallowed on window, so a release over the clock never toggles Start. Verified: 10 consecutive drags, DB `speakers_list.position` matched every time.
- **No X beside the caucus speaker's name** (owner, 15 Sep 2026). `ModeratedCaucusMain` no longer takes `onRemoveCurrentSpeaker`; the caucus floor is cleared from its sidebar row.
- **Right of Reply closes when something else starts** (15 Sep 2026): an effect over press-driven values (phase, suspend / end stamps, the floor speaker, the caucus speaker and type, the speaker clock and caucus total going false → true) closes the overlay and resets its local timer. Nothing is logged there: the reply was logged at Grant. No setCommittee, updateLocal or localUpdateTime.

### DB operations
- `addToSpeakersList(…, at = 'end' | 'start')` / `addToCaucusList(…)` — call the `speakers_list_add` RPC (migration `speakers_list_atomic_append_and_reorder`, 14 Sep 2026), which assigns `max(position)+1` (or `min-1` for "add first") under a per-(committee, list_type) advisory lock. **NEVER pass a client-computed position** (`queue.length + 1`, `Date.now()`, `0`): after a Next or a removal leaves a gap, `length + 1` lands on an existing row, and two rows with one position have no defined order, so the queue reshuffled on every refetch (production evidence: QKUHGA caucus queue, two rows at 4 and two at 5). The RPC is SECURITY INVOKER, so the unchanged `speakers_list` RLS still gates it; it is idempotent on the (committee, delegate, list_type) unique key.
- Every queue read orders by `position, created_at, id` (`getCommitteeByCode`, `getSpeakersLists`). Keep all three keys so devices agree even on legacy tied rows.
- `removeFromSpeakersList` — deletes from speakers_list where list_type='gsl'
- `reorderSpeakersList` — ONE `speakers_list_reorder` RPC call: a single in-place UPDATE under the same list lock, listed rows get 1..n and rows the caller did not know about follow in their existing order, so no two rows can share a position. Calls are chained per list on the client, on the SAME chain as `addToSpeakersList` / `addToCaucusList`, so two quick drags reach the server in order and a drag right after an add never runs before the insert. The chain (`chained()` in `committeeService.ts`) catches and logs, so fire-and-forget callers never get an unhandled rejection. (NOT delete + reinsert: a DELETE realtime event flashes an empty list on delegate phones. NOT N parallel single-row updates either: interleaved drags produced duplicate positions and a refetch mid-batch read a half-applied order.)
- `nextSpeaker` — updates current_speaker row, optionally removes a delegate from speakers_list
- `startSpeakerTimer` — writes started_at AND time_remaining together (one anchor)
- `pauseSpeakerTimer` — writes `{ started_at: null, time_remaining: live }` in one update (the pause; see RULE 6b)
- `stopSpeakerTimer` — clears started_at only; used where the next write seats a fresh clock anyway (ending a caucus with nobody on the floor). Not for a pause, not for a restart

---

## FEATURE: MODERATED CAUCUS

### How it works
- Chair accepts a moderated caucus motion → MotionsModal calls onCommitteeUpdate with phase='moderated-caucus', caucus object, pendingMotions=[], caucusQueue=[], currentSpeaker=null
- GSL (speakersList) is PRESERVED — never touched
- caucus JSONB on the committee stores: type, purpose, totalTime, remainingTime, speakingTime, speakerTimeRemaining, currentSpeaker (string, not SpeakerEntry), proposedBy, spokenCountries
- ModeratedCaucusMain handles the caucus UI
- Chairs add delegates via side panel (RollCallPanel in caucus mode) or CaucusAddSpeakerInput
- handleNextCaucusSpeaker: advances through caucusQueue, updates caucus JSONB + currentSpeaker

### Rules
- caucusPanelLocked (useState) prevents GSL panel from flashing during caucus transition
- caucusPanelLocked=true when phase becomes 'moderated-caucus', false when caucus ends
- Aside condition: `caucusPanelLocked || committee.caucus?.type === 'moderated'` → show caucus panel
- caucusLoading (useState) shows 3.5s attractive loading screen when entering caucus
- The loading screen shows: caucus name, topic, total time, per-speaker time, max speakers
- DO NOT call clearCurrentSpeaker when entering caucus — it races with nextSpeakerInDB
- currentSpeaker is cleared via MotionsModal's onCommitteeUpdate (currentSpeaker: null) — sufficient
- caucusRollCallCommittee memo: sets speakersList=caucusQueue, currentSpeaker=null (prevents GSL speaker showing in caucus panel)
- caucus queue mutations use structural=true to prevent realtime flickering
- handleNextCaucusSpeaker uses structural=true to suppress realtime overwrites during speaker advance
- **Capacity** = `caucusQueueCapacity(liveTotal, speakingTime, queue.length, currentSpeakerLiveRemaining)` (`committeeService.ts`). A delegate fits whenever committed time (current speaker's live clock + a full speaking time per queued delegate) is below the live remaining total, even if only 10 s is left. The old `floor(remainingTime / speakingTime)` ignored the queue and read the stale anchor value, so it said "full" with minutes left. The motion card, raise form and loading screen show the same count (`ceil`).
- When capacity is reached, adding is refused with a short glass notification top right (`notifyCaucusQueueFull` on the chair page: `notify` key `caucus-queue-full`, `caucus_queue_full_title` / `caucus_queue_full_body`, 3 s, `urgent` so it shows during a speech, one card however many refusals). There is NO sidebar flash and the caucus add bar is never replaced by a message any more (owner, 15 Sep 2026); `caucus_queue_no_time` is no longer rendered. With this rule "full" can only mean no caucus time is left.
- **The last speaker's clock is capped** to what the caucus has left: `capSpeakerSlot(speakingTime, liveTotal)` on Next / Call first and on Restart, and `handleToggleTimer` caps again on start. The slot a speaker was given is persisted as `caucus.speakerTimeRemaining`, and Next / Restart / caucus end compute speaking time against THAT slot (+ extra time), not the motion's full speaking time.
- **The TOTAL is speaking time: it stops when the speaker clock reaches zero.** The speaker tick only raises `speakerExpiredRef`; an effect keyed on the `timerRunning` boolean re-anchors the caucus once (`remainingTime` = total read at the speaker's zero, `totalStartedAt` null, non-structural) and parks the speaker row at 0. If the total is itself used up, nothing is written there and the expiry effect ends the caucus. Every reader (chair `caucusSeconds`, the expiry check, delegate and advisor boards) uses `moderatedCaucusRemainingNow(caucus, speaker time_remaining, speaker started_at)`, which reads the total capped at the running speaker clock's zero, so all surfaces stop together even before the re-anchor write lands. The organiser live wall (`manage/[slug]/live`) still reads the uncapped `caucusRemainingNow` and follows once the write lands.
- **The stop-at-zero writes are conditional and ordered** (`reanchorCaucusAtSpeakerZero`). The tick records the speaker's turn key; the effect skips if the floor changed hands. The caucus write is `updateCaucusIfUnchanged` (applies only while `caucus->>currentSpeaker` and `caucus->>totalStartedAt` still match what was read; Next, pause, restart and end each change one). The speaker write is `stopSpeakerAtZeroIfUnchanged` (one statement, identity predicate like `clearCurrentSpeakerIfUnchanged`). Every `current_speaker` write this device issues (`nextSpeaker`, `startSpeakerTimer`, `pauseSpeakerTimer`, `stopSpeakerTimer`, `syncSpeakerTime`, `grantSpeakerTime`, the conditional clear, the stop-at-zero, the speech-log anchor read) rides ONE per-committee chain, so a write issued before a Next can never land after it.
- **Nobody watched the zero** (reload, gavel handover): the tick never fired, so the same re-anchor also runs once per load (effect keyed on the committee id, after the load claim) and once in the ROLE TRANSITION effect on gaining the gavel, when the moderated caucus has a running total and a speaker clock already at 0. Moderator device only.
- Ending a moderated caucus (End button or auto-expiry) logs the floor holder's speech via `logFloorSpeechOnCaucusEnd` → `logFloorSpeech`; before, only Next logged, so the last speaker of every caucus was missing from stats. Ending a Consultation of the Whole logs the current floor holder through `logTimedSpeech` with the same `cowTurnKey` as `handleCowTap`, so a tap and End racing log once.

### What happens when caucus ends
- phase → 'speakers-list'
- caucus → null
- caucusQueue → [] (cleared)
- speakersList → UNCHANGED (GSL preserved exactly as left)
- currentSpeaker → null (will be set when chair clicks Next on GSL)

---

## FEATURE: UNMODERATED CAUCUS / CONSULTATION / TOUR DE TABLE

### How it works
- Unmoderated/Consultation: simple countdown timer, no speaker queue
- Tour de Table: all present delegates in alphabetical order, each speaks for speakingTime seconds
- Tour uses caucusQueue with all delegates pre-filled in order
- **Room Order Tour de Table** (`tourOrder === 'custom'`, purpose `Tour de Table (Room Order)`) fills the queue with numbered placeholders (`room-order-N`, "Speaker N") that are NOT delegations. Their queue rows and speaker clock still cannot be persisted (`speakers_list.delegate_id` / `current_speaker.delegate_id` are uuid columns, so those writes log a 22P02 and are dropped), and no per-turn speech is logged for them. Instead (15 Sep 2026, owner's decision: "just give everyone one speech"):
  - At accept, MotionsModal snapshots the room into the caucus JSONB: `caucus.roomOrderCountries` (every delegate not absent, the tour's own eligibility rule, observers included) and `caucus.tourStartedAt` (`serverNowIso()`, the tour instance).
  - When the tour ENDS, `creditRoomOrderTour(committee)` (`src/lib/floorSpeech.ts`) writes ONE `speech` event per snapshot country, context `tour-de-table`, `seconds` = the tour's per-speaker time (`caucus.speakingTime`; placeholders cannot be mapped to seats, so no real elapsed time exists), `turnKey` = committee + country + `tour:<epoch ms of tourStartedAt>`, all in one insert.
  - Triggers, Moderator device only: End Caucus and the expiry effect (both via `logFloorSpeechOnCaucusEnd`), Next past the total or past the last placeholder (`handleNextCaucusSpeaker`), another caucus accepted over the tour (MotionsModal `clearFloorForCaucus`), End Debate Yes, and an organiser END broadcast. Suspend / an organiser pause does NOT credit (the tour resumes); ending it later does.
  - Only a tour that ran (someone was called, a speaker was logged in `spokenCountries`, or time came off the total) credits. A tour accepted before the snapshot existed credits nobody.
  - Idempotent exactly by key: this device's claims, the loaded log and `parseLogEvents` all drop a repeated `turnKey`, so a double trigger, a reload, a catch-up or a second device cannot double-credit (verified: re-ending the same tour after a reload wrote nothing).
  - A-Z / Z-A tours are unchanged: real delegations, per-turn `logFloorSpeech` with context `moderated-caucus`, no snapshot fields.
- All three clear caucusQueue when starting, preserve speakersList

### Rules
- Same GSL preservation rule as moderated caucus
- currentSpeaker: null set when accepting any of these motions
- When caucus ends, same cleanup as moderated caucus

---

## FEATURE: MOTIONS MODAL

### How it works
- Chair opens Motions → MotionsModal shows pending motions
- VotingView shows motions ranked by disruptiveness
- **Up to 15 motions on the floor** (`MAX_FLOOR_MOTIONS`, exported from `MotionsModal.tsx`; join / GSL requests do not count, Custom motions do). Client-only: there is no database limit. At 15 every Raise button is disabled with `motions_floor_full`, and `handleRaised` refuses as a backstop; editing a motion already on the floor is always allowed. (An Undo of fallen motions does not re-check the cap.) The voting view shows the first `RANKED_VISIBLE` (5: the motion being voted on plus the queue column) as normal cards; motions 6 and below are NEVER hidden (it used to be `slice(1, 5)`, so a sixth was invisible) and scroll in their own column at the side (`motions_more_on_floor`, hidden scrollbar with top/bottom fades), same ranking numbers, same drag and same temp-id guards, and the modal widens to `max-w-6xl` while that column exists. The heading shows `n/15`.
- **The queue column scrolls by MEASURED height, never by count** (16 Sep 2026, "the add motion button overlaps"). `scrolls` used to be `order.length > RANKED_VISIBLE`, so with five or fewer motions the column had no `overflow-y-auto`: on a short window, or with tall cards (long Custom names, topics, Tour de Table badges), the cards ran past the column and over the Raise a Motion button. The scroller is now always `flex-1 min-h-0 overflow-y-auto`, and a ResizeObserver on it and its cards decides the fades and focusability (`scrollHeight > clientHeight`). The button sits below the scroller (`shrink-0`), anchored at the column's foot. Verified at 1280x640 with 5 motions: 696px of cards in a 513px column, no overlap. The Raise form's footer (the Raise / Save button) has its own ivory ground and a visible hairline shadow; its old `border-white/10` drew nothing on ivory, so fields scrolled into the button with no edge.
- The ordering explanation (`motions_drag_hint`) is an "i" hint beside the heading (hover and focus, portaled), not a banner. Custom motions carry no "Informational" badge and no "Accepting this will not change the session" strip any more; the Accept button still reads "Accept & clear".
- **Motions and Documents grow out of their top-bar tab** (`src/components/GrowDialog.tsx`, located through `[data-tutorial="tab-motions"]` / `tab-documents`): transform + opacity CSS transitions written through refs (280 ms open, 180 ms softer close, a plain fade under reduced motion), one measurement in a layout effect, nothing awaited, so it renders from the committee already in memory. Closing mid-open retargets smoothly. ✕, backdrop and Escape (not inside a field) animate out; accept paths and the Suspend / End screen still close at once (a caucus loading screen takes over). The fullscreen introduction screens in DocumentsModal are not animated.
- Accept → handleMotionAccepted → starts caucus / suspend / end debate
- Reject (✗) → handleRemove → deletes motion from DB
- Suspend/End Debate → shows "Does this motion pass?" Yes/No screen
- Yes → calls suspendDebateInDB or endDebateInDB, removes motion from DB FIRST (await), then fires DB state change

### Rules
- Motions are stored with temp IDs optimistically (`temp-...`). Raising, editing and the Undo below all go through `raiseMotionOptimistic` in `src/lib/motionFlight.ts`: it swaps the temp id for the real UUID on success and **drops the temp row with a translated error (`motions_save_failed`) when the insert fails**, so a motion that can never be rejected can no longer exist.
- **Temp ids live in a module-level store keyed by committee id** (`useTempMotionIds`), not modal state: closing MotionsModal mid-insert no longer forgets them.
- **EVERY action on a motion is disabled while its id is temporary**: Accept (any type, not only Custom), Reject, both Edit buttons, the list-view ✕, and Suspend/End Yes and No. `handleMotionAccepted` also returns early on a temp id. A delete with a temp id deletes nothing, so the real row came back on the next refresh.
- `removeMotionEverywhere` removes locally and in the DB; for a temp id it remembers the id and deletes the real row the moment the insert returns.
- **When a motion passes, the other pending floor motions FALL** (`fellOtherFloorMotions`): caucus accept, Suspend Yes and End Yes delete every other non-Custom, non-request motion and show "N other motions fell" (`motions_fell_one` / `motions_fell_many`). After a caucus accept the notice offers **Undo for 8 s** (`motions_undo`), which raises them again as new rows. After Suspend or End there is NO Undo (V4), and Undo disappears (and a restore in hand does nothing) the moment the committee is suspended or ended: the chair page passes `closed` to `<MotionFlightNotice>`, which feeds `setMotionFlightClosed`. The auto-dismiss timer is per committee. The notice is `<MotionFlightNotice>`, mounted by the chair page (Moderator only) so it survives the modal closing. Accepting a Custom motion makes nothing fall.
- One floor motion per delegation: raising a second one shows `motions_proposer_has_motion` instead of returning silently.
- **The floor speaker's speech is logged when a motion passes** (G-1): caucus accept, Suspend Yes and End Yes call `logFloorSpeech` (`src/lib/floorSpeech.ts`) with the chair page's `floorClock` prop BEFORE clearing the floor. Suspend and End also clear `current_speaker` (conditional clear) so a resumed session cannot log the same turn a second time.
- When motion is rejected from VotingView: removePendingMotionInDB fires, co-chairs see it via realtime
- suspend-debate and end-debate motions: await removePendingMotionInDB BEFORE calling suspendDebateInDB/endDebateInDB to prevent race conditions
- On chair page load: stale suspend-debate/end-debate motions are auto-deleted

---

## FEATURE: SUSPEND DEBATE

### How it works
- Motion passes (or an organiser broadcast pauses the room) → the floor speech is logged (`logFloorSpeech`, `src/lib/floorSpeech.ts`) and the floor is cleared (`clearCurrentSpeakerIfUnchanged`), so the first Next after a resume cannot log that turn again → suspendDebateInDB reads the row fresh and writes ONE update: `suspended_at` (database clock), `phase='adjourned'`, and the caucus with its TOTAL frozen at the live value and NOBODY on its floor (`freezeCaucusForBreak` = `pauseCaucusLive` + `currentSpeaker: null`, `floorSince: null`; the queue rows are kept; a caucus stored outside a caucus phase is cleared to null). The optimistic suspend in MotionsModal and the broadcast pause null `caucus.currentSpeaker` locally too, and `beginSessionAfterRollCall` / `handlePhaseChange` restore through the same helper, so a restored caucus never has a phantom speaker (S4). It is conditional on `ended_at is null`, `suspended_at is null` and the phase it read, then pauses the speaker clock at its live value (`pauseSpeakerClockLive`). Resolves true when the committee IS suspended afterwards, false when it could not be (write failed, or it had ENDED: an ended committee can never be suspended). On false the caller rolls back (audit C-1, V-8, G-4).
- The chair page stops its own speaker tick whenever `sessionSuspended` or `sessionEnded` turns on (read-only effect, rules 3 and 4 hold).
- All devices detect via realtime subscription → setSessionSuspended(true)
- Chairs see: two-tab overlay (⏸ Suspend View + 🪑 Session View)
- Delegates see: fullscreen waiting screen, cannot interact
- Suspend View has "Resume Session" button → claimResumeSession (only first chair wins) → startResumeRollCall → phase='pre-session', suspended_at=null
- Once phase='pre-session': chairs go through roll call again
- Delegates stay on waiting screen until phase leaves pre-session
- Co-chairs who didn't click Resume see: greyed-out button with "X is resuming..." message

### Resuming is TWO writes against the `resuming_chair` latch — and BOTH can fail
- `resuming_chair` is an **atomic one-shot latch**. `claimResumeSession` (`committeeService.ts:1017`) writes it only `.is('resuming_chair', null)`; `startResumeRollCall` (`:1078`) is the only thing that clears it on the success path. **NEVER weaken that `.is(..., null)` guard** — it is the whole single-winner guarantee. The correct fix for a stuck latch is an explicit release or take-over, never a looser claim.
- `startResumeRollCall` returns `Promise<boolean>` and the caller **MUST** check it. It returns false on error AND on an RLS-rejected 0-row update (`.select('id').maybeSingle()`). If the claim landed and this write silently failed, the latch stays set and NO chair can ever resume the committee again.
- `releaseResumeClaim(committeeId, chairName, code, chairSuffix?)` (`:1041`) — the release valve. Compare-and-swap `.eq('resuming_chair', chairName)`, so it clears the latch ONLY if it still names you. It can never clear another chair's live claim. `runResumeRollCall` (`chair/[code]/page.tsx:2439`) calls it whenever the roll-call write fails, rolls the optimistic phase/suspendedAt back, and shows `session_resume_failed` / `session_resume_failed_locked` depending on whether the release succeeded.
- `takeOverResumeClaim(committeeId, fromChairName, toChairName, code, chairSuffix?)` (`:1061`) — CAS from a stale holder to you (`.eq('resuming_chair', fromChairName)`). Two chairs racing to take over the same stale latch still produce exactly one winner: the first write flips the value, the second matches no row and returns false.
- **`alreadyMine` self-heal** (`chair/[code]/page.tsx:2472`): a chair who reloads mid-resume already holds the latch, so re-claiming is impossible (the column is no longer null). That path skips the claim and goes straight to the second write. Before this existed the Resume button was permanently dead — that is the deadlock users actually hit. Only the chair NAMED in the latch takes this path, so it does not weaken anything.
- Lost the claim → the chair page refetches the real row (`getCommitteeByCode`) rather than leaving the button a silent no-op: if the winner already finished, drop out of suspension; if the latch turns out to be ours (our claim landed, the response was lost), finish the job; otherwise render "{name} is resuming…" off the fresh row.
- **Take-over affordance**: `foreignResumeLatch` (`:2122`) starts a 12s timer the moment ANOTHER chair is observed holding the latch (`:2126`); after that the co-chair gets a `session_resume_takeover` button (`:2862`) wired to `handleTakeOverResume` (`:2503`).
- All five resume failure/affordance strings are keyed: `session_resume_failed`, `session_resume_failed_locked`, `session_resume_retry`, `session_resume_takeover`, `session_resume_lost`.
- **All three latch writes also require the committee to STILL be suspended** (audit S-1): `claimResumeSession` and `takeOverResumeClaim` add `suspended_at is not null` and `ended_at is null`; `startResumeRollCall(committeeId, code, chairSuffix?, chairName?)` adds the same AND, when `chairName` is passed (the chair page always passes it), `resuming_chair = chairName`. Without this a device asleep through another chair's resume pressed Resume, found the latch null again, won it, and threw a running committee back into roll call. These conditions only ADD to the CAS; the `.is('resuming_chair', null)` guard is untouched. On false `runResumeRollCall` refetches first: no longer suspended → adopt the fresh row and drop the overlay (no error); latch now names someone else → `session_resume_lost`; otherwise the old release-and-report path.

### Rules
- ONLY clear suspended_at by setting phase back to pre-session via startResumeRollCall
- Roll call on resume: going absent DOES NOT remove delegates from GSL (phase='pre-session' guard in handleStatusChange and RollCallPanel.cycleStatus)
- When "Begin Session" is clicked after resume roll call (pre-session → speakers-list): absent delegates are removed from GSL at that moment only
- **Begin Session restores a paused caucus** (audit C-1): `RollCallPanel` calls `beginSessionAfterRollCall`, which reads the row and, in ONE update conditional on `phase='pre-session'`, opens the caucus's own phase (still paused, the dais presses play) when a caucus with time left is stored, or `speakers-list` with `caucus` written null explicitly and the caucus queue rows cleared. A running anchor left by pre-fix code is paused at its live value; a caucus with no time left is dropped. The chair page's `handlePhaseChange` mirrors the same decision optimistically. Caucus data must never survive into `speakers-list`.
- speakersList is PRESERVED through suspend/resume cycle
- caucusQueue is PRESERVED while a paused caucus is restored, and cleared when Begin Session opens the GSL instead
- Chat, documents, messages — ALL preserved through suspend/resume

---

## FEATURE: END DEBATE

### How it works
- Motion passes → endDebateInDB sets ended_at + expires_at (**now + 1 hour**, database clock) + phase='adjourned', freezes the caucus total and pauses the speaker clock like a suspension. **Idempotent** (audit V-8): conditional on `ended_at is null`, so a second device never rewrites `ended_at` or restarts the deletion countdown; resolves true when the committee has ended (now or earlier), false only when the write failed, and the caller rolls back. MotionsModal's optimistic mirror and the chair page's organiser-broadcast path use the same 1 hour — if one is ever changed, change all three.
- All devices detect via realtime → setSessionEnded(true)
- Both chairs and delegates see: two-tab overlay (🏁 End View + 👁 Session View)
- End View shows: "This committee has ended" + a countdown computed from `expires_at`, not a fixed promise — `Math.max(1, ceil(ms/1h))` (`chair/[code]/page.tsx:2092`, `delegate/[code]/page.tsx:894`) rendered through `session_hours_until_delete`. With the 1-hour window it reads "1 hour until committee is deleted"
- Session View: full session visible but READ-ONLY
- pg_cron job runs hourly, deletes committees where expires_at < NOW() — so with the 1-hour window an ended committee is really gone 1–2 hours after the gavel. **`delete_expired_committees()` skips `session_origin = 'conference'` entirely**: a conference room is never auto-expired, however long ago it ended
- Whenever a CONFERENCE committee is deleted (by whatever route), its chat attachments in storage go with it and its submitted documents stay. See FEATURE: CHAT → Attachments and GIFs

### Read-only rules (when sessionEnded=true)
- Hide: Roll Call / Motions / Documents tabs and the Chat icon (top bar)
- Hide: Add speaker input, timer start/next buttons, time controls
- Hide: delegate status change buttons, request to speak, document submit
- Show: all lists, timer display, documents view, stats, chat (view only — compose disabled)
- ChatPanel readOnly={true} prop disables compose input

### Rules
- endedAt is PERMANENT — no resume button, no way back
- Chair/delegate join page shows "view only" banner when endedAt is set
- Join still allowed for both roles when ended
- 'adjourned' phase with NO endedAt = suspended state (shows Resume button)
- 'adjourned' phase WITH endedAt = ended state (shows "Session Closed", no button)

---

## FEATURE: ROLL CALL

### Initial Roll Call (phase='pre-session')
- RollCallPanel with isRollCallPhase=true
- Shows: Clear All, All Present, All P+V buttons (ONLY during pre-session)
- These buttons update localStatuses immediately (optimistic) AND call the parent's `onBulkStatusChange` once → `handleBulkStatusChange` → `setDelegateStatusesBulk` → RPC `set_delegate_statuses(p_committee, p_status, p_ids)` (migration `session_bulk_delegate_status`): ONE UPDATE, SECURITY INVOKER so the delegates RLS applies, additionally requires `is_session_chair`, skips rows already at the status (no event for them). If the RPC fails the handler falls back to per-row `setDelegateStatusInDB`. Without `onBulkStatusChange` the panel still calls `onStatusChange` per delegate.
- Absent during roll call does NOT remove from GSL (isRollCallPhase guard)
- **Adding a seat: the + button** (16 Sep 2026, owner's instruction). The combined "Filter or add country / observer" field is GONE from both the full-screen roll call and the sidebar, and with it the roster filter (nothing dims or hides rows any more). Both surfaces show one `AddSeatButton` (`rollcall_add_seat`) in the panel footer, hidden for a Commenter, an ended session or a panel without `onDelegateAdd` (the footer is not drawn at all when it has neither the + nor Begin Session). It opens `AddSeatPicker` (in `RollCallPanel.tsx`): a fixed overlay inside the console (fixed height `min(600px, 92%)`, never vh, FitToScreen), a search box (`rollcall_add_seat_search`, autofocus, Enter adds the top country, or the typed name when nothing matches), an **Add as observer** switch that applies to every seat added while it is open, the not-yet-added `UN_COUNTRIES` with round `SeatCircleFlag`s A-Z (or matches, prefix first), then a free-text custom seat row (`rollcall_add_seat_custom`, `UnknownSeatIcon`). The dialog stays open for several additions, announces each (`rollcall_add_seat_added`, aria-live) and closes on Done, the X, Escape or the backdrop.
- **An added seat is PRESENT at once, in roll call and mid-session.** `onDelegateAdd(country, { observer })` → the chair page's `handleDelegateAdd` → `addDelegate(committeeId, country, code, suffix, 'present', observer)` (status and `is_observer` in the ONE insert; the defaults stay `'absent'` / `false` for other callers), then `updateLocal` appends `{ status: 'present', isObserver }`. Not optimistic before the insert, because the row id is needed (the same exception as before). Verified against the DB: Italy, European Union (observer), a custom seat and Chile (mid-session) all landed `present`.
- Begin Session → phase='speakers-list' → absent delegates removed from GSL at that moment

### Resume Roll Call (after suspend)
- Same as initial roll call — phase='pre-session'
- GSL preserved exactly
- Absent during resume roll call does NOT remove from GSL
- Begin Session again → absent delegates removed from GSL

### Status slider
- 3-state: absent → present → present-voting → absent
- localStatuses state in RollCallPanel for instant optimistic updates
- localStatuses resets when committee.id changes

### Queue view in side panel
- currentSpeaker always shown at TOP with 🎙 badge (position 1 in queuePositionMap)
- speakersList delegates shown as positions 2, 3, etc.
- queuePositionMap built: currentSpeaker → position 1, speakersList[0] → position 2, etc.

---

## FEATURE: CHAT

### Architecture (redesigned 15 Sep 2026)
- `ChatPanel` (`src/components/ChatPanel.tsx`) receives: committee, senderName, isChair, readCounts, onReadCountsChange, readOnly?, onClose? (a close button in the list header; the chair dialog no longer passes it, see Close button below), embedded? (no title / close of its own, for the delegate sheet). Pieces live in `src/components/chat/`: `ChatConversationList`, `ChatThread`, `ChatMessageGroup`, `ChatComposer`, `NewGroupSheet`, `ChatAvatar`, `chatTokens`, `ChatDialog`.
- senderName for chairs = myChairName (from URL param ?chairName=) NOT committee.chairNames[0]
- myChairName is read from useSearchParams() on the chair page
- **Layout**: two panes (list + thread) when the PANEL is at least 640px wide, one pane (list, then the thread with a back button) below that. Measured on the panel with a ResizeObserver, never the viewport, because the same component lives in the chair dialog and the delegate phone sheet.
- **Look**: WhatsApp / Instagram manner in forest, gold and ivory. Your bubbles forest on the inline-end, others white on the inline-start, the time inside each bubble, day separators and the "New messages" divider as centred pills, round flags (`SeatCircleFlag`) or chair initials. Sender name + avatar only in multi-party threads (Everyone, the delegate-side dais thread, a group, and a delegate thread on the chair side, which the whole dais shares). Composer pinned at the bottom: a growing textarea (Enter sends, Shift+Enter breaks the line, 16px so iOS never zooms) and a round send button. Read-only (ended) replaces it with `chat_view_only`. The bars are OPAQUE glass-look gradients (`CHAT.bar`): no backdrop-filter inside a dialog that animates.
- **Chair page**: chat is a dialog that grows out of the chat icon (`ChatDialog` → `GrowDialog`, origin `[data-tutorial="tab-chat"]`), no longer an overlay over the floor, so opening it no longer hides the roster sidebar. A lightweight shell animates; `ChatPanel` mounts on `onOpened`. `disableChat` renders `ChatDisabledNotice` inside the same dialog. **Delegate page**: unchanged sheet, `ChatPanel embedded`.

### The conversation list (`buildChatDirectory`, `src/lib/chatConversations.ts`)
- Every conversation the reader CAN have is listed without a "new chat" step: Everyone; the dais as a whole (`chairs`, delegates only); every other delegation; every other chair (chairs only); every group the reader is in. The DM rules are unchanged: a delegation never DMs one named chair, and delegate-to-delegate threads never appear on a chair's list.
- Order: Everyone pinned; then threads with activity, newest first (the newest message, this device's outbox, or a group's creation moves a thread up); then silent ones under `chat_section_start`: dais, groups, chairs, delegations, each by localised name. A search field filters the list.

### Group chats (stored in `messages`, no migration)
- A group is defined by ONE row: sender `__system__`, recipient `__group__`, is_private true, content `__group__:{"id","name","members","by"}`. Every chat builder and the scoring ledger already ignore `__system__` rows (the ledger also requires `__log__:`), so a definition is never shown as a message, on this bundle or an older one. Members are identities (country names, chair names); the creator is always one.
- **The definition row's primary key IS the group id** (`sendMessage(..., rowId)`), and `parseChatGroups` trusts only the row whose id matches the group id (or this device's pending copy). `messages.created_at` is writable by anon, so "earliest definition wins" alone let anyone with the code backdate a forged definition with extra members; earliest-wins survives only as a fallback for groups created before this rule. Group ids are real UUIDs even on plain http. Honest limits: membership is a name string and the sender is free text, and a chair holding the suffix can UPDATE a definition row.
- A group message is an ordinary row with recipient `group:<id>`, is_private true, sent through the same `sendMessage` / outbox path. Conversation key and read key = `group:<id>`.
- The FIRST definition row per id wins (`parseChatGroups`, memoised on array identity), so a later row cannot rename a group or add members. A group message shows only to members and only when its sender is a member; `chatConvKeyForMessage(m, name, isChair, chairNames, allMessages)` needs the committee's rows for that (the chair page passes them), and returns null for a group the reader is not in.
- `+` opens `NewGroupSheet` (name + members). Candidates follow the DM rules: a chair picks delegations and the other chairs, a delegation picks other delegations. Creation is optimistic (listed and opened at once); a refused write removes it and reopens the sheet with `chat_group_failed`. Groups cannot be edited, left or deleted yet.
- **NOT PRIVATE, and the copy says so** (`chat_group_info`). `messages` SELECT is `true` and every device downloads every row of its committee, group rows and DMs included; membership decides only what the UI shows. The chair-page chat card (Commenters) fires for a group message only when the chair is a member.
- A bundle from before this shipped would show `group:<id>` rows as a strange DM thread for their sender; it never shows definitions.

### Notification rules
- chatReadCounts: Record<string, number> — lifted to parent pages (chair + delegate)
- Persisted in localStorage under a **per-reader** key built by `chatReadStorageKey` in `src/lib/chatReadKey.ts:33`: `chat-read-${code}-${role}:${identity}` (e.g. `chat-read-ABC123-chair:Alice`). `role` is `'chair' | 'delegate'`, `identity` is `myChairName` for a chair and `country` for a delegate; a reader with no identity falls into the `~anon` bucket. Role is in the key on purpose — a chair may be named "France" while a delegate represents France.
- The old shared `chat-read-${code}` key made two chairs on one dais laptop (or a chair who also opens the delegate view) overwrite each other's read state and resurrect already-read badges. **NEVER** go back to a key without the reader identity in it.
- Both pages go through `loadChatReadCounts` / `saveChatReadCounts` (`chatReadKey.ts:66, 77`) — `chair/[code]/page.tsx:2108, 2115` and `delegate/[code]/page.tsx:851, 858`. Do not rebuild the key inline.
- **Legacy migration, still live**: when this reader has no entry yet, `loadChatReadCounts` adopts the pre-identity `chat-read-${code}` value (`legacyChatReadStorageKey`, `:39`) — copied forward, not moved. Orphaning it would give every existing user one burst of phantom unread covering the whole backlog. The legacy key is never written again, and from the first save onward the two identities diverge into their own keys.
- Loaded on committee load, saved whenever chatReadCounts changes
- Own messages NEVER count toward unread badges
- Badge clears immediately when conversation is opened
- "Opened" means the thread is ON SCREEN, not merely `activeConv`: in one-pane mode (panel under 640px) the panel shows the list OR the thread, so `ChatPanel` marks read (and re-marks on every new incoming message) only while `threadVisible`. It publishes the visible thread through `src/lib/chatViewing.ts`; the chair page's chat-card producer skips a message only when `chatConvKeyForMessage` (`chatConversations.ts`, mirrors `buildChatConversations`) matches that thread, so a DM still raises a card while the chair reads Everyone. Chat cards are keyed per conversation (`notifyKey.chat(convKey, sender)`), and bringing a thread into view calls `dismissWhere(notifyKey.chatConversation(key))`. Never go back to a blanket `if (showChat)` gate.
- Badge count = received messages (sender !== senderName) - readCounts[convKey]

### Optimistic sends
- Messages appear instantly through the module-level outbox (`src/lib/chatOutbox.ts`, keyed by committee id, survives the panel unmounting)
- sendMessageToDB is fire-and-forget; a failed write turns the bubble into "Not delivered · Retry"
- An outbox entry is retired by `reconcileOutbox` when a NEW row with the same sender + content + recipient arrives (one row retires one entry)
- There are no draft threads any more: every conversation is already in the list

### Attachments and GIFs (15 Sep 2026)
- **Contract: `src/lib/chatAttachments.ts`.** The composer has a paperclip (photo or PDF, 10 MB, JPEG / PNG / WebP / GIF / PDF) and, when the server has a GIPHY key, a GIF button. Pieces: `ChatComposer` (draft preview, progress bar, remove), `ChatAttachmentView` (bubble media), `GifPicker`, `src/lib/gifClient.ts`, `src/app/api/gifs/route.ts`. `ChatPanel` owns the draft and the upload.
- **Storage:** the `session-documents` bucket (public, anon INSERT, no UPDATE, 10 MB) under `chat/<committee_id>/<epoch>-<safe name>`, the same permission DocumentsModal uses. Migration `session_documents_bucket_allow_chat_images` widened the bucket's `allowed_mime_types` from PDF only to PDF + JPEG + PNG + WebP + GIF (document submit paths still pre-flight PDF only). The upload is an XHR to the storage REST endpoint (`SUPABASE_URL` / `SUPABASE_ANON_KEY`, exported from `src/lib/supabase.ts`) so the composer can show progress and abort; never upsert. The file is uploaded when picked; Send only posts the message, so Send stays disabled until the upload is done. Removing a finished draft cannot delete the object (anon has no storage SELECT, so the DELETE policy matches nothing): it stays orphaned.
- **Deleting the room deletes the CHAT files, never the documents, and only for a CONFERENCE committee (16 Sep 2026).** The two live in the same bucket but at different prefixes: chat at `chat/<committee_id>/…`, a submitted working paper or draft resolution at the bucket ROOT, `<committee_id>/…`. The cleanup only ever touches the `chat/` prefix, so a document cannot be caught by it.
  - A BEFORE DELETE trigger on `committees`, `queue_chat_cleanup_on_delete` → `queue_chat_cleanup_before_delete()` (SECURITY DEFINER), writes one row into `chat_cleanup_queue(committee_id pk, session_origin, committee_code, queued_at, done_at, attempts, objects_removed, last_error)` and **only when `session_origin = 'conference'`**. The row has to be written before the delete because the committee is gone by the time anything can list storage. RLS is on with NO policies and only `service_role` is granted anything; the insert is wrapped in an exception handler so cleanup bookkeeping can never block a committee delete.
  - The `cleanup-chat-attachments` edge function (service role, `verify_jwt` on) drains it: list `chat/<id>/` (paginated, follows sub-folders), remove, re-list to confirm empty, stamp `done_at` + `objects_removed`. Every path is re-checked against `chat/<uuid>/` before the remove call. Idempotent, retried up to 5 attempts with `last_error` recorded. Body: `{dryRun}`, `{limit}`, `{committeeId}` — and `committeeId` only works on a row that is ALREADY queued, so it can never be pointed at an arbitrary prefix.
  - pg_cron `chat-attachment-cleanup`, `10 * * * *` (the committee deletion job runs at `:00`), posting to the function with the publishable key exactly like `drain-email-outbox`.
  - Two things this deliberately does NOT do: standalone sessions are untouched (their chat objects still orphan, as before), and `delete_expired_committees()` is unchanged, so conference rooms are still never auto-expired — the queue fires on whatever else deletes them (an organiser, a cascade, a manual delete). Orphans created before this shipped are not backfilled.
- **Message format, compatible with old bundles:** an ordinary `messages` row, content exactly two lines: `📎 <name>` (or `GIF: <title>`) and the file URL with metadata in the URL FRAGMENT (`#gva=image|pdf|gif&m=&s=&w=&h=`, a GIF adds `p=` the small animated rendition). An older bundle shows the name and a working link. A caption is sent as a separate text message right after the file. Outbox reconcile works unchanged (same sender + content + recipient).
- **Trust:** anyone with the code can insert any content, so `parseAttachment` renders media only for URLs that are exactly this project's origin + `/storage/v1/object/public/session-documents/chat/<uuid>/<file>` (`trustedFileUrl`: parsed with `new URL()`, the raw string must equal origin + normalised pathname, and any `.`/`..` segment, `%2e`/`%2f`/`%5c` or backslash is refused, so `.../chat/../../<other-bucket>/x.png` no longer passes a prefix test) or GIPHY's media hosts (`media*.giphy.com`, `i.giphy.com`); anything else stays plain text. Images and GIFs render at their final size from `w`/`h` (no layout shift), `loading="lazy"`, and open in the in-app photo viewer (below); a PDF still opens in a new tab. The list preview reads `📷 Photo` / `📄 name.pdf` / `GIF` (`previewContent`). Chat notification cards never show content, so nothing changed there.
- Picking a file, sending it and sending a GIF all call `markDelegateActivity()` (idle logout).
- **GIFs:** `GET /api/gifs` (trending, or `?q=` search, `?offset=` pagination, 24 per page, `rating=pg-13`) proxies GIPHY with **`GIPHY_API_KEY`, a server-only env var** (no `NEXT_PUBLIC_`; set it in Vercel and `.env.local`). Without it the route answers `{enabled:false}` (200) and the GIF button is not rendered (`useGifsEnabled`, one probe per page load). Responses are trimmed to preview / send / original renditions, cached in memory 60 s (LRU, 300 entries, per server instance) and `s-maxage=60`, and rate limited to 90 requests a minute per IP (the per-IP map is pruned of expired windows every 200 requests whatever its size, and capped at 5,000 entries, dropping the oldest window). The picker sits inside the thread column above the composer (sized to the room there, never clipped), debounces search 300 ms, aborts stale requests, places tiles in a JS masonry by known heights, loads each tile's small WebP only when an IntersectionObserver brings it within 300 px, and stops at 120 GIFs. "Powered by GIPHY" is shown in the picker as GIPHY's terms require.
- **Privacy trade-off, for the owner to decide (CLAUDE.md §4 / `/privacy`):** the search itself goes server to GIPHY, so GIPHY never sees who searched. But every GIF IMAGE (in the picker and in bubbles on every device in the room) loads from GIPHY's CDN in the viewer's browser, so the viewer's IP address and user agent reach GIPHY, a third party, whenever a GIF is on screen. The privacy policy wording should say so before a key is set.

### The photo viewer (16 Sep 2026)
- A click on a photo or GIF in a bubble opens `ChatLightbox` (`src/components/chat/ChatLightbox.tsx`) over the app instead of a new tab. The bubble is still an `<a href target=_blank>`: only a plain left click is taken over, so middle-click, cmd/ctrl-click and "open in new tab" still reach the raw file. PDFs are unchanged.
- `ChatThread` owns it: the items are every photo and GIF of the OPEN conversation, oldest first, built from the same folded rows the thread renders (caption = sender label · time). Switching conversation closes it; a photo that disappears closes it.
- Dark backdrop, the picture fitted to the screen. Zoom: wheel / trackpad pinch (a non-passive native `wheel` listener), two-finger pinch, double click / double tap, the zoom buttons, `+` / `-` / `0`. Pan: drag while zoomed, clamped so an edge never leaves the stage. At rest, a touch swipe left / right changes photo and a swipe down closes. Arrow keys move between photos (mirrored in RTL), prev / next buttons, an "n of N" counter. **Open the original file** (`chat_image_open_original`) is a plain link in the top bar.
- Close: Escape, the X, a tap on the backdrop (not a tap that ended a drag). Every view change goes through `commit`, which writes `viewRef` synchronously, so a gesture's release never reads a stale view (that is what made a pinch reset itself and a swipe do nothing).
- **Portals to `document.body` at z-index 2000, not through `Portal`.** On the delegate page the chat lives in `Sheet`, a body child at z-index 1000, so a layer inside `#fit-root` would render under it. At body level the gesture maths needs no scale correction.
- Keys are handled in the CAPTURE phase with `stopPropagation`, so Escape closes only the viewer and never the `GrowDialog` (chair) or `Sheet` (delegate) underneath. Own focus trap (Tab wraps; focus that lands on the page is pulled back); focus returns to the bubble on close. `prefers-reduced-motion`: no fade, no zoom transition.
- Read-only: props only, no committee state, no `updateLocal`, no `localUpdateTime`, no write (rules 3 to 5). Verified 16 Sep 2026 on the chair dialog (desktop) and the delegate sheet (375 px).

### Delegate names in conference sessions (16 Sep 2026, chairs only)
- In a conference-linked session the chair's chat shows the allocated person beside a delegation: on the conversation row (a quieter second half of the title line, and searchable), as the thread header subtitle of a delegate thread (instead of the message count), in a group's member list ("France (Ana Pérez)") and as a second line in `NewGroupSheet`. Chair names, Everyone, the dais and groups get nothing. A double delegation shows both names, seat order.
- **Source:** `session_delegation_names(p_code)` (migration `session_delegation_names`), SECURITY DEFINER, `search_path = public, pg_temp`, EXECUTE revoked from PUBLIC and granted to anon + authenticated. Gated on `is_session_chair` (the `x-chair-suffix` header through `sessionClient`), exactly like `session_participants`. Returns `{ok, is_conference, names: [{country, country_code, seat, display_name}]}` for `conference_allocations` of the linked `conference_committees` row that have a `user_id` and a non-empty `profiles.display_name`; `{ok:false, reason:'denied' | 'not_found'}` otherwise. No email, user id, application or society. Read only. Tested as anon in rolled-back transactions: no header and a wrong suffix are `denied`, the right suffix returns names only, and anon still reads zero rows from `conference_allocations` and `profiles` directly.
- **Why chairs only.** Anon cannot read `conference_allocations` or `profiles` at all (every policy needs `auth.uid()`), and nothing makes a delegate's name public today: `conferences.show_taken_countries` publishes countries, `conference_committees.display_chairs` is a curated chair list. The session code alone is a weak credential (`sess_select` is `true`). So delegate phones see delegations exactly as before. An organiser "show delegate names" switch would be the thing to add before widening this.
- **Client:** `src/lib/sessionDelegationNames.ts`. `useSessionDelegationNames(committee, enabled)` returns null unless `sessionOrigin === 'conference'`, `enabled`, and the committee carries `dbChairJoinSuffix`; `ChatPanel` passes `isChair`. One read per session code, cached 5 minutes at module level and shared (the chat and Settings → People never read twice); `forgetSessionDelegationNames(code)` drops it. `delegationNamesFor(names, country)` / `delegationNameLabel(names, country)` match by country NAME or ISO CODE, case- and whitespace-insensitively. Not a security boundary (rule 15): the suffix is anon-readable.

### Close button (chair dialog)
- `ChatDialog` draws the close button OUTSIDE the panel, just above its top-end corner, lightbox style; the panel height is `min(86%, 100% - 112px)` so it always has room. The chair page no longer passes `onClose` to `ChatPanel`, so the list header keeps only the group `+`. Escape and the backdrop still close it.

### Opening animations (chat, scoreboard, settings)
- Chat, Scoreboard (`[data-tutorial="tab-scoreboard"]`), Motions and Documents all open with `GrowDialog`. Settings (`SettingsPanel`, also on `/voting/[code]`) is a `GrowDialog` too since 15 Sep 2026 (grows out of `[data-tutorial="tab-settings"]`, or the focused gear on the voting page); `LeftDrawer.tsx` was deleted. See FEATURE: SETTINGS → "The dialog".
- Both start their motion two animation frames after mounting (a 120 ms timer backs that up when rAF is throttled), so the expensive first commit happens before the motion instead of inside it. No backdrop-filter on either backdrop, transform + opacity only, `will-change` only while moving. `GrowDialog.onOpened` fires when the grow has finished: `ChatDialog` mounts the chat then, `ScoreboardPanel` holds a feedback read that lands mid-animation until then. Measured on the dev server (15 Sep 2026): open-animation frames 17-18 ms (1 of ~75 over 20 ms) for chat, scoreboard and motions, against first-open frames of 35-85 ms before.

---

## FEATURE: DOCUMENTS (Working Papers + Draft Resolutions)

### Chair view (DocumentsModal)
- Two tabs: Working Papers | Draft Resolutions, then a small gold **Vote** button (`documents_vote_btn`, Moderator only) that opens `/voting/[code]?chairName=...`, It is the ONLY way to the voting page from the modal: the full-width GO TO VOTING banner on the DR tab was removed on 16 Sep 2026 (owner's instruction), with its key `documents_go_to_voting`. The voting page chooses the draft resolution and runs the roll call.
- Each doc has status: submitted → on-floor → introduced → passed/failed
- Status and approval render as ONE pill set (`Pill`, `STATUS_PILL`, `APPROVAL_PILL` in `DocumentsModal.tsx`): Lucide icon + label, tinted fill with an inset-shadow ring, no border. Submitted = neutral ink (FileText), On floor = forest tint (CircleDot), Introduced = gold (Presentation), Passed = solid forest with gold text (Check), Failed = muted red (X); Approved / Rejected are outline-only (BadgeCheck / Ban). Every text colour is AA on its fill.
- "Introduce" button starts a presentation flow: setup timers → reading → presentation → Q&A → auto-pass (WP) / back to the list (DR)
- WP auto-passes after Q&A. DR goes to /voting/[code] page. The old in-modal `DocumentVote` screen and stage `'vote'` were dead code and are gone.
- **The introduction screen is document-first** (16 Sep 2026). The paper fills the screen (`IntroDocument`: the PDF iframe, or the text on a page card, or `documents_no_content`); the top bar has the code, title, stage chips, zoom (`documents_zoom_out` / `_reset` / `_in`, 50% to 300%) and close. The stage clock and its controls (Previous stage, Reset, Start / Pause / Resume, Next stage, Continue when a stage is done) are a floating panel, `IntroTimerPanel`, all inside `DocumentsModal.tsx`:
  - dragged by its grip bar and resized from its bottom corner, with the pointer (window-relative deltas divided by the `#fit-root` scale, like `DraggablePopover`) or the Arrow keys on the focused grip / corner (16px, Shift 64px); clamped inside the screen on every move, resize and window resize, never below 248x250. The clock font scales with the panel.
  - the box is remembered per device in `localStorage gavelling-intro-timer-panel` `{x,y,w,h}`, the zoom in `gavelling-intro-zoom` (try/catch: blocked storage just opens the defaults, lower inline-end corner, 100%).
  - the panel hides (`documents_timer_hide`) and comes back from a Timer button in the top bar; hiding never pauses or resets the clock (the clock is modal state).
- **Moving between Reading, Presentation and Q&A never touches the paper.** `IntroDocument` is mounted once per introduction and nothing above it is keyed on the stage; zoom and the timer-open flag live in the modal, not the stage. Before, the viewer sat inside `StageTimer key={doc-stage}` (a remount, so a PDF reloaded to page 1 and the text lost its scroll) and the split ratio was stage-local state that snapped back to 50%. Zoom is a CSS transform on the iframe (width/height 100/zoom %, `scale(zoom)`), so changing it never re-creates the frame. Verified 16 Sep 2026: same DOM node, `scrollTop` 1500 and 150% kept through Reading → Presentation → Q&A → back. Do not reintroduce a stage `key` on anything that contains the document.
- PDF inline viewer in doc cards (toggle show/hide)

### The introduction (Resume / Pass / Fail removed, 15 Sep 2026)
- **There is no Resume, Pass or Fail on a card any more** (removed at Peter's instruction). A card offers Introduce (submitted / on floor, after approval when the gate is on), and nothing else for the flow. A WP whose introduction was closed before it finished is still `introduced` and its card offers **Introduce** again (setup prefilled with the saved times), so it can always reach its automatic pass. An introduced DR shows no flow button: it is decided on the voting page.
- The stage lives only in modal state now. `documents.intro_state` is no longer written except back to `null` (on confirming the timings, finishing, and skipping), which also clears stages left by the retired Resume flow. The column, `DocIntroState` and `parseIntroState` stay so existing rows still load; nothing reads a persisted stage.
- The on-screen stage clock is still **anchor-based**: remaining = `base - (serverNow() - startedAt)` via `introRemainingNow` (`src/lib/documentFlow.ts`), stamped with `serverNowIso()` (RULE 6b), `startedAt` null = paused. `IntroTimerPanel` only refreshes a local `now` (500 ms interval, inside the panel). Nothing is written per second, and dragging, resizing, zooming and hiding write nothing at all (RULES 3 to 5).
- Confirming the timings writes timings + `status` (`introduced`, or `passed` for a WP with every timer at 0) in ONE update.
- Back skips 0-minute stages and lands on setup; a stage with a 0-minute timer renders as complete (Continue), never a blank screen.
- Every flow write is optimistic first and then checked; a failure shows `documents_intro_save_failed`. Delete is checked too and puts the card back on failure.

### Commenters, delete, codes, failed submissions (D-10, V-6)
- `DocCard` receives `isViewOnly`: a Commenter gets no approve / reject / introduce / Vote / delete (UI gate only, RULE 15).
- Delete asks first (inline "Delete this paper?" Delete / Keep).
- **Document codes are assigned by the database.** BEFORE INSERT trigger `documents_assign_doc_code` computes `WP 1.n` / `DR 1/n` per committee under a per-(committee, type) advisory lock (n = max(count, highest trailing number) + 1). The client `docCode` is a preview and is ignored; two simultaneous submissions can no longer collide.
- Both submit paths (chair `SubmitForm`, delegate submit tab) check the `addDocument` result: on failure the form stays filled and `documents_submit_failed` is shown.

### Delegate view
- "View Documents" tab: shows ALL docs (WPs + DRs) with status badges
- "Submit Documents" tab: submit form only (no list of existing docs shown)
- PDF rows resizable by dragging right edge

### Document names are renameable (Settings → Motions → Documents)
- `CommitteeSettings.documentNames` holds singular + plural for both types; defaults are the English `DEFAULT_DOCUMENT_NAMES`.
- Mirrored into `committees.settings` JSONB by the SettingsPanel `upd` helper, so delegates on other devices see the rename.
- **Every** user-facing render of the type name goes through `docName(committee, type, form, translatedFallback)` in `src/lib/docNames.ts`. Never hardcode "Working Paper" / "Draft Resolution" in UI text again.
- Renaming is presentation only — `DocumentType`, the `documents.type` column and the `'working-paper'` / `'draft-resolution'` discriminators never change.

### Document approval gate (Settings → Motions → Documents)
- `requireDocApproval` (default false). Read from the committee ROW via `requireDocApproval(committee)` in `src/lib/documentFlow.ts` (never the local store, so another chair's toggle applies); when on, each doc card gets an approve/reject control and `CommitteeDocument.approval` gates introduction. The gate covers re-introducing an already introduced working paper too (a rejected or never-approved introduced WP shows Approve / Reject instead of Introduce), so a rejection can never be walked around by reopening an introduction.
- **`documents.approval` did not exist until 14 Sep 2026** (migration `documents_intro_state_and_approval`). Every approve/reject before that was rejected by PostgREST and only logged, so with the gate on no paper could ever be introduced.

### Document limits — LEGACY, NO UI
- `wpSubmissionLimit` / `drSubmissionLimit` still exist on `CommitteeSettings` and are still ENFORCED on submit (`DocumentsModal.tsx:469`), but **nothing writes them** — the Settings UI and the `onResetDocuments` Reset button no longer exist anywhere in `src/`.
- In practice they are always `null` (unlimited) unless an old committee row still carries a value in its settings JSONB.

---

## FEATURE: SETTINGS

### WRITE side — KEY-LEVEL PATCHES ONLY (migration `session_settings_patch_and_persisted_votes`, 14 Sep 2026)
- Every write to `committees.settings` sends ONLY the changed keys through a SECURITY INVOKER RPC that merges in one statement (`settings = coalesce(settings,'{}') || patch`). There is no read first, so there is no read-modify-write race between chairs (D-1) and no failed read that can wipe the blob (D-2). RLS still applies: `sess_chair_update` checks the `x-chair-suffix` header sent by `sessionClient(code, suffix)`.
- `patchCommitteeSettings(committeeId, patch, code, suffix)` → `patch_committee_settings`. Returns `true` only when a row was updated (an RLS refusal is a zero-row result, not an error). It **raises** on `chairJoinSuffix`. `saveCommitteeSettings` is now a thin wrapper that drops `chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex` and `votingReturnPhase` from the patch and returns the same boolean.
- `SettingsPanel`'s `upd` updates the store instantly and debounces (400 ms) a patch of the keys changed since the last flush. It **never** posts `getSettings(code)`. A refused write shows `settings_write_failed`. `updScoring` → `updateCommitteeScoringInDB` patches `{ scoring }` (the scoring object is still one value, so two chairs editing different score sources in the same second resolve last-write-wins).
- The voting page's `applyRule` patches `{ [key]: value }` and is a no-op for a Commenter.
- Keys with their own writer: `chairJoinSuffix` → `updateCommitteeChairSuffixInDB` → `set_committee_chair_suffix` (four digits; RLS means the caller must hold the CURRENT code, so a committee with no code in the DB still cannot be given one from the client, exactly as before). `headChair` + `headChairDevice` → `updateCommitteeHeadChairInDB` (one patch, then appends the holder to `chair_names`). `agendaTopicIndex` + `committees.topic` → `updateCommitteeAgendaInDB` → `set_committee_agenda` (one statement). `votingReturnPhase` → `set_committee_voting_phase` only.
- `addChairName` → `add_committee_chair_name`: atomic `array_append` guarded by "not already present" in the same statement, so two chairs joining at once both land. The name is trimmed first (and `updateCommitteeHeadChairInDB` trims the gavel name), so " Alice" and "Alice" are one chair.
- `rowToCommittee` surfaces the blob as `committee.dbSettings` plus the convenience fields `dbChairJoinSuffix`, `dbHeadChair`, `dbHeadChairDevice`, `dbSeparateChairCode`, `dbScoring`.

### READ side — hydrate once, then re-hydrate changed keys
| Surface | Hydrates the store from `dbSettings`? |
|---------|----------------------------------------|
| `/chair/[code]` | In the initial loader, then on every change through `useSettingsSync(committee)` |
| `/voting/[code]` | In the loader, then through `useSettingsSync(committee)` |
| `/delegate/[code]` | **NEVER** |
| `/advisor/[code]` | **NEVER** (does not import `useSettingsStore` at all) |
- `NON_HYDRATED_SETTING_KEYS` / `stripNonHydratedSettings` in `src/lib/settingsStore.ts` is the ONE list of keys that never enter the store: `chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex`, `votingReturnPhase`. Both the chair and voting loaders hydrate through it (V5); never strip an inline copy again.
- `useSettingsSync` (`src/lib/useSettingsSync.tsx`) keys an effect on a stable serialisation of the stripped blob (never on object identity, which changes on every refetch), diffs it against the previous one and hydrates ONLY the changed keys, so a key this chair edited and has not flushed yet is never flashed back by an unrelated refetch. A changed value that matches one THIS device flushed in the last 15 s (`src/lib/settingsEcho.ts`, recorded by `patchCommitteeSettings`) is this device's own echo and is skipped: no flicker back to an older value, no notice (V3). Any other changed value that differs from this device's store came from another chair and a 4.5 s `settings_updated_by_other_chair` notice is shown. It never writes the DB and is not inside the realtime callback. It only sees what `committee.dbSettings` already carries, so a change that arrives inside the chair page's 3 s debounce lands when the session sync fetches the row again as the window closes (R-3).
- **ALWAYS** read a setting on a non-chair surface with the pure-function-of-the-committee-row pattern: `getCommitteeFlags(committee)` / `sponsorLabel(committee, fallback)` in `src/lib/committeeFlags.ts`, `getScoringConfig(committee)` in `src/lib/scoring.ts:31`, `docName(committee, ...)` in `src/lib/docNames.ts`. These read `committee.dbSettings` / `committee.dbScoring` and never touch localStorage.
- **NEVER** call `getSettings(code)` on the delegate or advisor pages — the store is empty there and you silently get `DEFAULT_SETTINGS`.
- Residual instance, **dead code, not a live bug**: `delegate/[code]/page.tsx:930` calls `getSettings(committee.code)` and `:939` builds `enabledMotionTypes` from it — but `enabledMotionTypes` is referenced nowhere (verified: the identifier appears only at its own declaration). Left over from the removed delegate Motions tab. Delete both; that removes the delegate page's last `useSettingsStore` dependency, which is the correct end state. Do **not** "fix" it by rewiring it to `dbSettings` — there is no consumer to fix.

### Chair code system
- `chairJoinSuffix`: 4-digit string, generated at committee creation (`committeeService.ts:100`) and stored in `committees.settings`.
- `SettingsPanel.tsx:415-425` regenerates it **only** when the store copy is `''`, and otherwise re-syncs the existing one to the DB via `updateCommitteeChairSuffixInDB`.
- Full chair code format: `{code}-{suffix}` e.g. "UNSC2026-4821".
- Join page validates against `foundCommittee.dbChairJoinSuffix` (from DB), falling back to localStorage only if the DB value is missing (`join/page.tsx:281`).
- Landing page: if code contains dash with 4-char suffix → auto-routes to chair tab.
- Chair code NOT shown in the top bar (only the 6-char session code is, as a copy button) — only visible in Settings → Access panel.
- The suffix is also the **only** write credential: `sessionClient(code, suffix)` sends it as the `x-chair-suffix` header and RLS checks it (see FEATURE: CHAIR ROLES).
- `separateChairCode` is **not** a `CommitteeSettings` field. It is written literally as `true` at create time (`committeeService.ts:108`), surfaced as `dbSeparateChairCode`, read by no code, and explicitly stripped on hydrate. Do not build on it.

### The dialog (redesigned 15 Sep 2026)
- `SettingsPanel.tsx` is the shell and owns every write (`upd`, `updScoring`, the chair-code adoption effect, the 400 ms debounce, flush on unmount / pagehide). The tabs live in `src/components/settings/` and only render and call those: `AccessTab`, `MotionsTab`, `VotingTab`, `PointsTab`, `PeopleTab`, `AwardsTab`. Their controls are in `settingsKit.tsx` (`GavelSwitch` role=switch, `SealChoice` role=radiogroup with arrow keys, `ClockStepper` role=spinbutton that commits on blur / Enter / a button, `NotchDial` role=slider with pointer drag and arrow / Page / Home / End keys, `SecondsDial` (the gavel knock: a LOG-scale role=slider so 5 to 60 s is not crammed into the first 10% of 1..600, a 1 / 5 / 15 s grain below 60 / 300 / above, presets drawn as rail ticks, a typed value that commits on blur / Enter, every path through `clampGavelSeconds`), `TallyStepper`, `InlineRename`, `HoverHint` through Portal, `ConfirmSheet` role=alertdialog). Never add a control that writes on its own.
- A `GrowDialog` (focus trap, Escape, focus return), `height: 90%` (never vh, #fit-root is scaled). Bookmark tabs are a vertical `role=tablist` in the forest spine (Arrow keys, Home, End); the active ribbon extends over the page edge. Labels hide below `md`. `ConfirmSheet` renders inside the panel and consumes its own Escape. Language picker at the foot of the spine. Arabic mirrors the ribbons and every control (logical insets, RTL-aware arrow keys).
- `onlineChairs` (optional prop) is the chair page's `chair-presence` set; the voting page passes nothing and the People tab then shows no online dots. The People tab never subscribes to that channel itself (a second `channel()` on the same topic would share and then remove the chair page's channel).

### Settings tabs — actual order from the `tabs` array (`SettingsPanel.tsx`)
Default open tab is **`access`**.

| Tab | Contents |
|-----|----------|
| Access | session code and chair password tickets (copy), The dais: every chair as a round avatar (round flag when the name is a country, else initials) with a live state, Moderator (the gavel, `dbHeadChair`), Commenting (on the `chair-presence` set), Offline (not on it), or Viewing when there is no presence set (voting page). Read only: "Take the gavel" stays in the GavelChip, the full roster is People. Floor rules in two columns (`requireChairApproval`, `lockDelegateRollCall`, `gslRequireNextSpeaker`, `disableChat`), Timer sound (`gavelSoundEnabled`, `gavelSoundAtSeconds` via `SecondsDial`, Test sound) beside Labels (`sponsorLabel`) |
| Motions | ranked list of the four caucus motions (drag or up/down buttons → `motionOrder`, rename → `motionNames`, enable → `motion*`), Custom motion (unranked), CoW timer (`cowTimerEnabled`, `cowTimerSeconds`), rename-only Suspend/End Debate, Documents (`requireDocApproval`, `documentNames`, `wpSubmissionLimit` / `drSubmissionLimit` with a No limit chip) |
| Voting | `substantiveThreshold` (hemicycle cards), `allowAbstentions`, `vetoMode` cards + P5 seated panel / `vetoCountries` flag chips, `quorumThreshold` (fraction cards, "Needs N of M" over voting delegations) |
| Points | score sources in two columns (stepper, switch, relative weight bar). There is NO way to create a custom source any more (16 Sep 2026); custom sources a committee already stores still render and can be renamed, disabled or removed. Quality factors + `factorScaleMax` dial, `scoreBlend` split ring with a worked example and a dial |
| People | the dais, delegations on devices, and removals (see "Settings → People" below) |
| Awards | ONLY when `committee.sessionOrigin === 'conference'`. A card that explains awards are decided in the chair portal; pressing it asks "Are you sharing your screen?" and Continue opens `resolveChairAwardsHref(code)` in a new tab (the chair's conference role page, never the unrendered secretariat console). Resolved on mount so the tab opens inside the click. |

### Settings → People (15 Sep 2026, migration `session_participants_and_chair_kick`)
- **This reverses "No chair can free a seat".** Peter's instruction on 15 Sep 2026: chairs can see everyone connected and remove them, and that lives in Settings → People. Wrappers: `src/lib/sessionParticipants.ts`.
- `session_participants(p_code)` SECURITY DEFINER, `search_path = public, pg_temp`, anon + authenticated, gated on `is_session_chair` (the `x-chair-suffix` header through `sessionClient`). Returns chair names, the gavel holder, live seat claims (country, `account` or `device`, claimed / last seen, `active` = seen in the last 2 min; claims past the 65-minute expiry are omitted), signed-in chair devices from `chair_device_claims` (`active` = 90 s), the conference's assigned chairs by `profiles.display_name` (conference sessions only), and seats kicked in the last 10 minutes. Each seat claim carries `reserved` (the holder is that reserved seat's allocated conference account; a boolean, no identity). Never an email, a user id, a holder key or a device hash; `key` is `left(sha256(committee_id || ':' || user_id), 16)`, opaque and salted per committee so one account's key cannot be linked across committees (migration `session_people_review_fixes`; `release_chair_device_claim` matches the same salted key). The tab polls it every 15 s while visible.
- `kick_delegate_seat(p_code, p_country)`, chair-gated: under the seat advisory lock only (the LAST lock in `claim_delegate_seat`'s order, so no deadlock), deletes every claim on that seat EXCEPT the allocated account of a reserved conference seat (`seat_claim_holder_is_allocated`, owner-only helper), and writes one `delegate_seat_kicks` row per removed holder (`committee_id` cascade, `country`, `holder_key`, `device_hash`, `kicked_at`; RLS on, no policies, no table grants; rows older than a day are pruned on the next kick). The client then broadcasts `kicked` `{c: seatKey(country)}` on Realtime topic `seat-kick-<committeeId>`.
- **Reserved seats are protected (review fix).** The chair suffix is anon-readable, so without this anyone with the session code could keep kicking an allocated delegate out of their own seat. When an allocated holder remains on the seat the RPC answers `{ok: false, reason: 'reserved', released: n}` (`n` = any stale non-allocated claims it did remove, e.g. one from before the allocation existed; the client still nudges when `n > 0`). People hides the Remove button on a seat whose every holder is `reserved` and shows `stg_kick_reserved` ("This seat is reserved for its allocated delegate") instead, and shows the same text if the server refuses. Honest limits: this protects only allocated ACCOUNTS on reserved seats. An open seat, an anonymous device, or a reserved seat held by someone else can still be kicked by anyone holding the (readable) chair code, and the kicked device is locked out of that seat for 10 minutes. It is a courtesy tool, not a permission.
- `claim_delegate_seat` gained exactly one check, AFTER the seat lock (the kick takes the same lock): a tombstone for THIS seat from the last 10 minutes matching this holder key or this device hash deletes this holder's / device's own claim on that seat and answers `kicked`. It used to run before the locks, so a re-verify waiting on the seat lock while the kick committed inserted a fresh claim and then answered `kicked` forever after without removing it, leaving the seat looking taken for 65 minutes. Everything else in the function is byte-for-byte the previous body (reserved before roster, lock order, 65-minute expiry, one device per account, `p_takeover` default true). Anyone else can take the seat at once. The removed device may take a DIFFERENT open seat; that is deliberate (a delegate on the wrong seat can move).
- `/delegate/[code]`: `accessState 'kicked'` renders "You were removed from this seat by the chair" (`delegate_seat_kicked_title` / `_body`) with Back to join, from the load claim or the re-verify. The page listens on `seat-kick-<committeeId>` and re-verifies at once on a matching country, but never trusts the broadcast: only the server's `kicked` stops it. Roll call status is not changed by a kick.
- `remove_session_chair(p_code, p_name)`, chair-gated: `array_remove` from `chair_names`, refused (`moderator`) for the gavel holder, which is `settings.headChair` or `chair_names[1]` when none is set (removing that name would move the gavel). A name no longer in `chair_names` answers `{ok: false, reason: 'not_found'}` (People shows `stg_chair_remove_not_found`, "That chair is no longer on the dais"); it used to answer `ok: true, removed: false` and People reported success. `release_chair_device_claim(p_code, p_key)` forgets one signed-in chair account's device claim. Neither locks anyone out: the chair password is still the only credential.
- Moderator only in the UI (`!isViewOnly`), every removal behind a `ConfirmSheet`. Commenters see the tab read only. NOT a security boundary (rule 15): the suffix is anon-readable.

There is **no** custom-session-ID control, **no** multi-chair toggle and **no** delegation-name-requirement setting. `updateCommitteeCode` (`committeeService.ts:937`) and `migrateSettings` (`settingsStore.ts:179`) are both dead code — nothing calls them. `requireDelegationName` has zero occurrences in `src/`.

### CommitteeSettings fields and where they are enforced
| Setting | What it does | Enforced at |
|---------|--------------|-------------|
| `substantiveThreshold`, `allowAbstentions`, `vetoMode`, `p5Delegations`, `vetoCountries`, `quorumThreshold` | voting maths | `/voting/[code]` + `VotingRulesPanel`; quorum also `chair/[code]/page.tsx:1818-1819` |
| `abstentionsInDenominator` | false = abstentions excluded from the threshold denominator; true = they join For + Against | `VotingRulesPanel.tsx:79` |
| `motionModeratedCaucus` / `motionUnmoderatedCaucus` / `motionCoW` / `motionTourDeTable` / `motionCustom` | which motion types delegates/chairs can raise | `MotionsModal.tsx`, `delegate/[code]/page.tsx:940-943` |
| `motionOrder` | chair-ordered disruptiveness ranking (top = most disruptive); drives motion sort order | `MotionsModal.tsx:1052-1059`, passed into `addPendingMotionInDB` |
| `motionNames` | renameable display labels for all motion types | `MotionsModal`, chair + delegate UI |
| `cowTimerEnabled` / `cowTimerSeconds` | optional standalone timer during a Consultation of the Whole | `chair/[code]/page.tsx:548-550` |
| `requireDocApproval` | chair must approve a WP/DR before it can be introduced | `DocumentsModal.tsx:856` |
| `documentNames` | renameable WP/DR labels (singular + plural) | via `docName()` — see FEATURE: DOCUMENTS |
| `wpSubmissionLimit` / `drSubmissionLimit` | legacy, no UI writes them | `DocumentsModal.tsx:469` |
| `gslRequireNextSpeaker` | **default false** (the GSL may elapse). When ON: the Start button is disabled while the current speaker is the last on the list, and the call-first button needs two delegates, and the Finish button (which empties the floor) is not offered, so the queue never empties mid-session | `chair/[code]/page.tsx` (Start button + call-first button, both gated on the setting) |
| `gavelSoundEnabled` | **default true**. A double gavel knock when a running chair countdown reaches the mark. Moderator's device only, never on a Commenter, delegate or advisor device, never when ended or suspended. Settings → Access → Timer sound, with a Test button | `useGavelCue` (`src/lib/useGavelCue.ts`), called from `chair/[code]/page.tsx` (speaker clock, unmoderated total, RTR) and `UnmoderatedCaucusView` (CoW timer) |
| `gavelSoundAtSeconds` | **default 15**, clamped 1..600 (`clampGavelSeconds`). The second mark the knock fires at: once per crossing from above to at-or-below, again only if extra time lifts it back above | same as above |
| `chairJoinSuffix` | 4-digit chair code AND the RLS write credential | join page + `sessionClient` |
| `requireChairApproval` | delegates must be approved by a chair before joining the floor | `delegate/[code]/page.tsx:931, 995, 1068` (via `getCommitteeFlags`) |
| `sponsorLabel` | overrides the visible word "Sponsors" ('' → translated default) | `sponsorLabel()` in `committeeFlags.ts`, used by delegate/voting/DocumentsModal |
| `lockDelegateRollCall` | delegates cannot change their own Present / Present-Voting status | `delegate/[code]/page.tsx:1432` |
| `disableChat` | hides chat for delegates AND chairs | `chair/[code]/page.tsx:2385`, `delegate/[code]/page.tsx:1020` |

### `scoring` sub-object (`ScoringConfig`, defaults in `settingsStore.ts:34-53`)
Persisted into `settings.scoring`; read everywhere via `getScoringConfig(committee)` — never via localStorage.
- `sources` — `ScoreSource[]` (id, name, value, enabled, builtin). Nine built-ins (attendance, gslSpeech, caucusSpeech, speakingTimePer10s, motionRaised, rightOfReply, wpSponsor, drSponsor, drPassed); chairs can edit values and disable any. Creating a custom source was removed from Settings (16 Sep 2026); custom sources already stored still render and still score. Disabled → the ledger row is omitted entirely.
- `factors` — `RankingFactor[]`, the subjective per-speech qualities chairs rate (Diplomacy, Public Speaking, Collaboration, Content & Research by default).
- **`level` is ALWAYS `'speech'`.** `FeedbackLogPanel` is the only writer of `feedback` and it hardcodes that level; nothing anywhere writes `'session'` or `'conference'`. The delegate's own recap filtered on exactly those two levels, so it was permanently blank — a delegate could be rated all session and see nothing. It now falls back to the mean of the per-speech ratings, the same fallback `computeQualityScore` already used, and says so on screen. If you ever add a real end-of-session recap, write one of the other two levels and both surfaces pick it up automatically.
- **`parseLogEvents` is memoised on `committee.messages` array identity** (`scoring.ts`). Every per-delegate fold parses the whole log, so a scoreboard over D delegates ran D full passes and D x M `JSON.parse` calls — and it got worse the longer a committee ran. Safe because the array is replaced, never mutated: `mergeMessagesById` returns `prev` only when nothing changed, and a new array otherwise. NEVER start mutating `committee.messages` in place.
- **Built-in factor and source names are localized through `src/lib/scoringNames.ts`** (`factorName` / `sourceName`), on exactly the `motionNames()` contract: a stored name that is empty or still the canonical English default means "never renamed", so the localized default wins; anything else is a genuine rename and shows verbatim in every locale. `DEFAULT_FACTOR_NAMES` / `DEFAULT_SOURCE_NAMES` must stay BYTE-IDENTICAL to `DEFAULT_SCORING` in settingsStore.ts — if they drift, rename detection silently breaks and every committee looks renamed. Applied on the session surfaces only (`buildSessionScoreboardRows` takes a `language`); the organiser board is English by design.
- `factorRatingsEnabled` — **default false**. Gates the per-speech rating sliders in the feedback dock. It gates the INPUT ONLY: ratings already recorded always render on the scoreboard, so turning it off can never hide data. Off by default because in the entire history of the product only a couple of ratings were ever set deliberately, and `scoreBlend` defaults to 0 so they moved no score anyway.
- `factorScaleMax` — upper bound of the factor rating scale (**default 10**; was 100). Committees that already held a real rating had `factorScaleMax: 100` pinned into their settings by a backfill, so the default change cannot reinterpret existing data. The Settings slider floor is 2 — a one-point scale is not a rating.
- `scoreBlend` — 0 = pure objective points … 100 = pure subjective quality. Consumed by `computeHeadline`.
- **The session scoreboard and the organiser scoreboard are ONE component**: `src/components/ScoreboardTable.tsx` (moved out of `manage/[slug]/live/`, which now re-exports its palette from `src/components/scoreboardTokens.ts` so all conferences-side importers resolve unchanged). `ScoreboardPanel` feeds it via `buildSessionScoreboardRows` (`src/lib/sessionScoreboard.ts`), a pure adapter from a live `Committee` to `ScoreboardDelegateRow[]` that reuses `scoring.ts` — no scoring maths is duplicated. Every session-specific capability is a defaulted-off prop (`locale`, `detailSummary`, `detailExtra`, `Stat.title`, and since 16 Sep 2026 `onSortChange` + `sortDir`, `circleFlags` + `flagSize`, `renderDetail`, and `sortScoreboardRows`'s optional `dir`); NO organiser call site passes any of them, and it must stay that way unless you intend to change the organiser view too. Verified by rendering the table with no session props at HEAD and after the change: byte-identical markup, collapsed and expanded.
- **The chair's scoreboard (16 Sep 2026)** has no SORT BY control: the column headers sort (press again to reverse; the button sits in a `role="columnheader"` cell carrying `aria-sort`, the header strip is `role="row"`). Rows draw `SeatCircleFlag` at 34px (26px in the Matrix). The four session figures (delegations, speeches, speaking time, chair notes) are icon chips ABOVE the tabs. Opening a delegation renders `src/components/scoreboard/DelegateProfile.tsx` through `renderDetail` (identity header, then icon-led, tinted Activity / Points / Ratings / Comments / Timeline sections; the Moderator's manual award control still rides at the bottom), never `DelegateDetail`. The third tab, **History** (`scoreboard/HistoryTab.tsx`, model `src/lib/sessionHistory.ts`), reads the session back newest first: a run of logged speeches sharing `context` + `topic` is one segment (a GSL stretch, or a caucus headed by its purpose), non-speech log events sit in the segment running when they happened, each speech shows round flag, delegation, duration, context and time, and the chair notes matched to it with their author. Notes match on country + context + seconds, resolved to the nearest speech in time and consumed once; a note with no seconds (written mid-speech) attaches to the same delegation's nearest speech within 10 minutes, otherwise it is left out of History (it is still on the profile). Newest segment open by default, others closed, several may be open. Chair-private: only `ScoreboardPanel` mounts these, and only the chair page mounts that. Pure fold of `parseLedgerEvents` + the loaded `feedback`; no I/O, no scoring maths.
- The row badge is the BLENDED headline; the ledger below it sums to the OBJECTIVE total. These legitimately differ whenever `scoreBlend > 0` — label them, never print one number in both places.
- `hideScoresFromDelegates` — **GONE.** The field, its default, the Settings toggle, the four
  translation keys, the tutorial line and the delegate factor recap it gated were all removed.
  The setting existed to hide a panel that should never have been shown: CLAUDE.md section 2
  states a delegate never sees chair notes, factor ratings or nominations before publication,
  but the recap printed the chair's ratings and the flag defaulted to **false**, so by default
  it leaked them. Deleting the flag alone would have made that leak unconditional, so the panel
  went with it. The delegate Stats tab now states no score and no rating at all: speech count,
  total time, speaking history and coaching tips only. Awards are the sanctioned route by which
  a rating becomes something a delegate can see. `getScoringConfig` spreads the stored blob over
  `DEFAULT_SCORING`, so committees whose `settings.scoring` JSONB still carries the old key just
  have an unread extra runtime field. No migration, no backfill, no data loss.

---

## FEATURE: CHAIR ROLES & THE GAVEL (Moderator vs Commenter)

### VOCABULARY — user-facing names changed, NOTHING PERSISTED DID
- The chair holding the gavel is the **Moderator** (always exactly one). Every other
  chair on the dais is a **Commenter**. These replaced "head chair" and "co-chair" in
  all user-facing copy across en/es/fr/ar.
- **The identifiers did NOT change and must not.** `headChair` (the settings JSONB key),
  `chair_names`, `resuming_chair`, the `'Chairs'` chat recipient value, the `'chair'`
  localStorage role segment, `/chair/[code]`, `isViewOnly` and `chairRole`'s `'head' | 'co'`
  values are all exactly as they were. Renaming any of them orphans live sessions,
  breaks existing dais threads, or resets every user's saved chat read counts.
- A person still JOINS as a "chair" and then holds one of the two roles — Moderator and
  Commenter are states inside a session, not credentials, and both use the same chair
  code. That is why the join tab, the chair password and the chat CHAIRS label all still
  say "chair" on purpose.
- The conferences layer is unaffected: there "chair" is a real conference role with its
  own invites, applications and CV entries. Never let a session rename reach `manage/`,
  `conferences/`, `invites/`, `account/`, `cv/` or `blog/`.

### Chair identity
- A chair's identity is **only** the `?chairName=` URL query param: `const myChairName = searchParams.get('chairName') ?? ''` (`chair/[code]/page.tsx:1160`).
- There is no session, no cookie and no DB row identifying a chair. The name is typed on the join page, appended to `committees.chair_names[]` by `addChairName`, and carried in the URL from then on.
- Everything downstream (chat sender, feedback author, gavel comparison) keys off that string.

### The gavel (head chair)
- Stored as `headChair` **inside the `committees.settings` JSONB**. It is NOT a column — the `committees` table has `resuming_chair` but no `head_chair`.
- Written by `updateCommitteeHeadChairInDB`, a key-level `patch_committee_settings` of `{ headChair, headChairDevice }` (no read, so it cannot clobber `chairJoinSuffix`), which then appends the holder's name to `chair_names`. Returns `Promise<boolean>`.
- Read back as `committee.dbHeadChair` (`committeeService.ts:80`).
- Claim-at-will — any chair may take it, from two places:
  - the join page, by picking the "head chair" role (`chairRole` defaults to `'co'`) → `join/page.tsx:256` (conference session) and `join/page.tsx:290` (anonymous session)
  - Settings → Access → "Take the gavel" → `onBecomeHeadChair` (`chair/[code]/page.tsx:2813-2817`)
- Taking the gavel flips the previous holder to view-only via the realtime `committees` refetch.

### Role derivation (client-side, `deriveGavelRole` in `src/lib/gavelDevice.ts`)
```
const head = committee?.dbHeadChair || committee?.chairNames?.[0] || myChairName || null;
const nameHolds = !(!!head && head !== myChairName);
const heldElsewhere = nameHolds && !!headChairDevice && headChairDevice !== thisDeviceId;
isModerator = nameHolds && !heldElsewhere;   // setIsViewOnly(!isModerator)
```
- Unset `headChair` → the committee creator (`chairNames[0]`) holds it.
- **No `?chairName=`** (an old rejoin link, `HomeClient.tsx`): `heldElsewhere` is always false, so "Use this device" never shows, and `claimGavelForThisDevice` refuses to write. With a device recorded the page is a view-only Commenter; with none it is the Moderator, as before devices existed.
- **The comment dock needs a REAL Commenter**: `isViewOnly && myChairName && !nameHolds`. A device that is view-only only because the same name holds the gavel on another device (or has no name) gets no dock, since it would write notes under the Moderator's own name.
- **Every** place that asks "am I the Moderator" goes through `gavelRoleOf(committee)` on the chair page: the role effect, the moderated-caucus expiry, the speaker-zero re-anchor and the gavel-knock arming. Never compare `head === myChairName` alone again.

### ONE DEVICE holds the gavel (14 Sep 2026)
- The bug: identity is a name in a URL, so the same name on two devices (one account on a laptop and a phone, or a name typed twice) made BOTH devices Moderator. Both skipped `current_speaker` events, both debounced, both ran the caucus clock and wrote, and the room drifted.
- `committees.settings.headChairDevice` records WHICH device holds the gavel for the name in `headChair`. The id is random per device and per session code, in `localStorage` under `gavelling-gavel-device:<CODE>` (`getGavelDeviceId`). It is published raw: the blob is anon-readable and the id confers nothing (rule 15). It is not the seat token. Two tabs on one device share it, and so share the role.
- `updateCommitteeHeadChairInDB(id, name, code, suffix, device = null)` writes `headChair` and `headChairDevice` in ONE read-merged update (still refusing to write if the read failed). Omitting the device clears it: a handover to another NAME records no device, and that chair's device claims it on arrival.
- **Newest wins.** A device writes its id (`claimGavelForThisDevice`) when: its page first loads (once per page load) and its name holds the gavel; the gavel reaches its name with NO device recorded; the chair joins as Moderator (join page); "Take the gavel" in the GavelChip; "Use this device". Nothing else. A re-check or realtime event NEVER steals it back once another device is recorded: the older device drops to Commenter with the `GavelDeviceBanner` ("The gavel is open on another device" + "Use this device"), and only that tap takes it back.
- Consequences to know: a Moderator with the laptop open who briefly opens the chair link on a phone moves the gavel to the phone; the laptop shows the banner and takes it back with one tap. Reloading the ACTIVE device keeps it (same id). Reloading the INACTIVE device is "opening the page", so it takes the gavel.
- The claim effect is declared BEFORE the role-derivation effect, so a freshly opened device settles straight into Moderator with no phantom lost/gained flip. The claim pins this device's id for 4 s (`gavelPinRef`), so a refetch that predates the write cannot bounce the role; `gavelPinTick` re-derives once at expiry (the timer is cleared on unmount). If two same-name devices claim inside the same 4 s, the loser acts as Moderator until its pin expires, then converges.
- The role baseline (`roleRef`) is taken only once `accessState === 'allowed'`, because the load claim waits for access too.
- `headChairDevice` is stripped on hydrate in BOTH the chair and voting loaders and excluded from write-back by SettingsPanel's `flushWrites` and the voting page's `applyRule`, exactly like `headChair` (rule 12). A client still running pre-deploy code does not strip it and could write a stale copy back once; the next load claim corrects it.
- The voting page has no Moderator/Commenter split, so it has nothing to derive; it only strips the key.
- **Resume latch:** `resuming_chair` stores a NAME, so a same-name device elsewhere used to count as "mine" and could take the `alreadyMine` self-heal and run the second write again. Ownership is now this device's marker (`markResumeClaim` / `resumeClaimIsMine`, `localStorage gavelling-resume-claim:<CODE>` = the `suspended_at` it claimed, so it can never match a later suspension). Set after a successful claim or take-over, cleared on a successful roll call or release. Without the marker a same-name latch renders as another chair's ("{name} is resuming…"), and the 12 s take-over (a CAS from that name to the same name) is the way through. The latch guards themselves are unchanged.
### ONE DEVICE PER SIGNED-IN ACCOUNT (14 Sep 2026, supersedes the same-name rule for accounts)
- The bug: a BANMUN chair opened the same committee from one account on two devices and both stayed in the room. The same-name gavel rule above only demoted the older device to Commenter; for an ACCOUNT the older device must leave the room entirely.
- **Authority:** `chair_device_claims(committee_id → committees ON DELETE CASCADE, user_id, device_hash, claimed_at, last_seen_at, UNIQUE(committee_id, user_id))`, RLS on with NO policies and no table privileges (migration `chair_device_claims_one_device_per_account`). `claim_chair_device(p_code, p_token, p_takeover)` (SECURITY DEFINER, `search_path = public, pg_temp`, per-(committee, account) advisory lock, anon + authenticated only) reads `auth.uid()`: no account → `anonymous` and nothing stored; else `claimed` (first claim, or takeover moved it), `mine` (same device, refreshes `last_seen_at`) or `other_device` (takeover false, nothing changed). The token is stored only as sha256. `chair_device_status(p_code, p_token)` → `{active_elsewhere}` for the caller only (another device seen in the last 90 s).
- **Device = the gavel device id** (`getGavelDeviceId`, `gavelling-gavel-device:<CODE>`), so both rules agree on what a device is, and the chair page, the voting page and two tabs on one device are ONE device. Wrappers: `src/lib/chairDeviceClaims.ts`.
- **Client:** `useChairDeviceLock` (`src/lib/useChairDeviceLock.ts`), mounted on `/chair/[code]` and `/voting/[code]` once access is verified, the committee is loaded and the session has not ended. The load claim passes `takeover: true` (newest device wins, and a reload of a kicked device is "opening the page", so it takes back). EVERY other check passes `false` and can only report `other_device`: the realtime hint, a 30 s re-verify, `visibilitychange`, `online`, and a channel re-subscribe. Until a takeover claim has succeeded once, retries still take over, so a failed first RPC never reads as kicked. A network/RPC error never kicks.
- **Instant kick:** after a `claimed`, the device broadcasts `taken` on the Realtime channel `chair-device-<committeeId>` with `{u: short sha256 of the user id, d: short sha256 of the device id}`. A receiver with the same `u` and a different `d` does NOT trust it: it re-verifies with `takeover: false` and is kicked only on `other_device`. A forged broadcast costs one RPC and kicks nobody.
- **Kicked device:** renders ONLY `ChairDeviceKickModal` (Portal, no close, no Escape): "Use this device instead" (`takeBack()`, a takeover claim that broadcasts too, so the other device gets the same modal) or "Leave" (`/my-conferences` for a conference session, `/join` otherwise). While kicked, `gavelRoleOf` returns Commenter (so caucus expiry, the stop-at-zero re-anchor, broadcast effects and the gavel knock all stand down), the gavel load-claim effect returns early, the handover toast is suppressed, and nothing interactive is mounted (no SettingsPanel sync, no FeedbackLogPanel autosave, no controls). Taking back also re-claims the gavel for this device when this chair's NAME holds it.
- **Relation to the same-name rule:** anonymous chairs (no account) are unaffected and keep the same-name rule exactly as above. For a signed-in chair both run: the newest device claims the account AND (via the existing load claim) the gavel if its name holds it; the older device may flash the same-name banner for a moment before the kick arrives, then shows the modal. Two DIFFERENT accounts, or an account plus an anonymous chair, never affect each other.
- **Join page:** in the chair tab, a signed-in user whose account holds the committee on another live device sees `join_chair_active_elsewhere`. It is a notice, not a block.
- **Re-activation is not a takeover (15 Sep 2026).** Only the FIRST activation per (account, committee) per mount claims with takeover. If `enabled` flickers off and on for the same key, the hook keeps `claimedOnce` / kicked and re-verifies WITHOUT takeover (`refsKeyRef`). It used to reset both and take over again, so every access re-check on one device kicked the same account's other device.

### First load retries a failed read (15 Sep 2026)
- The initial loaders on /chair, /delegate, /advisor and /voting call `getCommitteeByCodeWithRetry` (`committeeService.ts`), built on `getCommitteeByCodeResult`, which returns `ok`, `not_found` or `error` (any failed sub-query counts as `error`: an empty roster on first load is a wrong answer). Errors retry after 0.8 s and 2 s with supabase-js's own retries off, then the page shows `session_load_failed` with Try again. Only a real `not_found` shows the not-found screen. `getCommitteeByCode` is unchanged for every other caller.

### ACCESS GUARD ON /chair, /voting, /advisor: `useSessionAccess` (15 Sep 2026)
- **The bug ("the session starts loading and refreshes by itself").** All three pages ran their conference access guard in an effect keyed on `session?.access_token` that began with `setAccessState('checking')`. supabase-js refreshes the token about hourly on a visible tab, and again when a tab that slept past expiry becomes visible (`_onVisibilityChanged` → `_recoverAndRefresh` → TOKEN_REFRESHED; ~228 refresh log lines a day in production). Each refresh re-ran the guard, and the page rendered the full-screen `GavelLoader` over the live room, unmounting every panel, modal and draft, then drew it again: a spontaneous "reload". It hit every SIGNED-IN chair, advisor and voting screen, standalone rooms included (the reset ran before the conference check). Anonymous chairs never saw it, which is why it looked occasional. It also flipped `useChairDeviceLock`'s `enabled` (see above), and because the guard failed closed, a re-check that met a dropped connection or an expired token turned a live room into the sign-in or "You don't chair this committee" screen.
- **The contract now** (`src/lib/useSessionAccess.ts`, shared by the three pages): keyed on the USER ID, never the token (the token is read through a ref at check time). A re-check keeps a settled `allowed` / `standalone` on screen until it has a definite new answer. A check that could not be answered is not a verdict: `detectConferenceSessionOrNull` / `isConferenceSessionOrNull` return null on a failed read, `verifyConferenceAccess` returns `{ kind: 'error' }` on a failed read with no positive match (PGRST116 keeps its old "no match" meaning). A settled page ignores it; a first load shows `session_access_error_title` / `_body` with an inline Retry, never the loader and never a reload. `detectConferenceSession` / `isConferenceSession` still fail closed for their other callers. The join page treats `error` like `denied`, as before.
- The delegate page already keyed its seat claim on the user id and kept `allowed` across re-checks; it does not use the hook.
- **Never** key a session-page effect on `session` or `session.access_token` identity, and never reset an access state to a full-screen loader from a re-check.
- **Other reload sources, known and left alone:** `src/app/error.tsx` / `global-error.tsx` reload once per tab (`recoverFromStaleDeploy`, sessionStorage flag) when an error boundary catches a stale-deploy chunk error; the session pages have no lazy chunks at render, so a deploy under an open room only reaches it through a boundary throw. In `npm run dev`, editing a non-component module (translations, `src/lib/*`) makes Fast Refresh do a full page reload; that is dev-only.
- **Limits:** not a security boundary (rule 15): session writes are still checked only against the chair suffix, so a kicked device with the code could still write by hand. It stops one person driving the dais from two devices, honestly. Two devices opening within the same second both claim with takeover; the later RPC wins and the earlier device is kicked by its broadcast or its next re-verify. Nothing here touches committee state, `updateLocal` or `localUpdateTime` (rules 3 and 4).
- Presence (`chair-presence-${id}`) is used ONLY so the join page can show who is active. It does NOT decide the gavel — that race was deliberately removed (`chair/[code]/page.tsx:1439-1441`).

### `isViewOnly` IS A PURE UI GATE — THERE IS NO SERVER-SIDE ENFORCEMENT
- RLS policy `sess_chair_update` on `committees` is `is_session_chair(id)` for both USING and WITH CHECK.
- `is_session_chair(p_committee)` only checks that the caller's `x-chair-suffix` header equals `settings->>'chairJoinSuffix'` (and that the suffix is non-empty). It knows nothing about `headChair`.
- The header is attached by `sessionClient(code, chairSuffix)` (`src/lib/sessionClient.ts`), and every chair device has the suffix — it is displayed in Settings → Access.
- **Therefore: ANY chair holding the chair code can write ANYTHING to the session, regardless of who holds the gavel.** `isViewOnly` hides buttons; it does not stop writes. Never treat it as a security boundary, and never move a genuinely privileged operation behind it alone.

### `resuming_chair` is NOT the gavel
- `resuming_chair` is a real `text` column on `committees` and is completely unrelated to `headChair`.
- It is the one-shot claim lock for suspend/resume: `claimResumeSession` (`committeeService.ts:898-907`) updates `resuming_chair` with `.is('resuming_chair', null)`, so only the first chair to click Resume wins; the rest see "X is resuming…".
- `startResumeRollCall` clears it back to null along with `suspended_at`.
- **NEVER** merge or conflate the two.

### What actually differs in the view-only co-chair view
- Persistent "View only · {headChairName} is chairing" badge (`chair/[code]/page.tsx:2222-2238`).
- GSL: no timer/progress bar — the speaker card shows "is speaking" text instead (`:2644`); no Start/Next/restart/time controls (`:2666, 2727, 2736, 2770`); no add-speaker input; reorder and remove handlers passed as `undefined` (`:2627-2628, 2716-2717`); Extra Time and Right of Reply popovers suppressed (`:2828, 2883`).
- Caucus: no add-speaker, next-speaker, extend or end-caucus controls (`:976, 1055, 1112, 1118`); unmoderated/CoW controls hidden (`:658, 683`).
- `RollCallPanel`, `MotionsModal` and `DocumentsModal` all receive `isViewOnly` and hide their write affordances (`RollCallPanel.tsx:507, 598, 613`; `MotionsModal.tsx:692, 821, 925, 999`; `DocumentsModal.tsx:1067`). MotionsModal also opens on the `vote` view instead of `raise`.
- **`FeedbackLogPanel` is rendered ONLY when `isViewOnly` is true** (and the device is a real Commenter: it has a `?chairName=` and another NAME holds the gavel, see Role derivation) — the comment dock is a Commenter-exclusive surface, which is exactly what the role is named for. The Moderator runs the room and does not comment. A Moderator toggle for it was built and REMOVED at Peter's instruction; do not add one back without being asked. Because the gate is `isViewOnly`, which is derived from `dbHeadChair` on every committee refetch, taking or handing over the gavel makes the dock appear and disappear on both devices with no reload.
- **Feedback rows are owned by their author.** The dock claims a stored row only when `chair_name` matches this chair; other chairs' rows are read-only and render beside yours, separated by " / " and prefixed with the author (prefix appears only when more than one chair has written). NEVER go back to matching a row to a speech by country+context+seconds alone — that took the first hit regardless of author, so a second chair adopted the first chair's row id and the next keystroke overwrote their note while leaving the original name on it.
- A row written while the delegate still holds the floor has `speech_seconds` NULL and is matched to the live/next card until the reconcile effect back-patches it. Without that, every reload mid-speech creates ANOTHER row — production still carries duplicates from before this existed.
- `persist` refuses to INSERT when there is no text and no rating > 0, so blurring an untouched note box no longer creates an empty row.
- Realtime behaviour differs and must stay that way:
  - a view-only co-chair DOES process `current_speaker` events (the sync's `wants` lets them through and the `currentSpeaker` slice is patched with `withCurrentSpeaker`); the Moderator ignores them, it owns that row (RULE 6)
  - a view-only co-chair NEVER debounces (`debounceLeft()` returns 0 when `isViewOnlyRef.current`) — it writes nothing, so debouncing would make it miss the head chair's phase/caucus changes
  - a view-only co-chair always takes the fresh row rather than pinning live timer state (the `row` apply pins phase/caucus only for a Moderator with a running clock)
  - a view-only co-chair does not run the caucus expiry (the effect derives the role from the row and returns for a Commenter) — it would write a phase it does not own

---

## FEATURE: SETTING THE AGENDA (conference sessions with 2-3 topics)

- A conference committee holds up to three topics (`conference_committees.topics text[]`, CHECK 1..3). Its session is minted with `topics[0]`; the dais chooses which one opens debate and can switch later.
- Everything lives in `src/components/AgendaPicker.tsx`: `useSessionAgendaTopics` (one anon read of `conference_committees.topics` by `session_id`; the policy "Anyone can read committees by link" makes it readable for published AND unpublished conferences, so there is no RPC), `useAgendaPicker` (when to show it, the optimistic pick) and the full-screen `AgendaPicker`. The chair page only calls the hook and mounts `{agenda.picker}`.
- **Shown automatically** only when ALL hold: `sessionOrigin === 'conference'`, the query has RETURNED 2+ topics, `phase === 'pre-session'`, not suspended, not ended, `!isViewOnly`, and `settings.agendaTopicIndex` is absent. It overlays roll call; it never delays it. Standalone sessions never run the query; 0 or 1 topics render exactly as before. Commenters are never blocked.
- **Switching later**: in the masthead (`CommitteeIdentityBadge`, on the roll-call card during pre-session and in the sidebar during debate) clicking the topic text edits it INLINE (`onTopicSave`, see COMPONENT: Chair top bar and sidebar masthead); it no longer opens the picker. The picker opens from the small **Switch topic** button beneath the topic (`onSwitchAgenda`, `identity_topic_switch`) and, during pre-session only, from the topic in the top bar (the top bar shows tabs, not the topic, once debate starts). Offered only when `agenda.canSwitch` holds: 2+ topics, the Moderator, and the session has not ended.
- **Contract**: `committees.settings.agendaTopicIndex` is the 0-based index (absent = never chosen). `updateCommitteeAgendaInDB` (`committeeService.ts`) writes it AND `committees.topic` in ONE statement through the `set_committee_agenda` RPC via `sessionClient(code, suffix)` (key-level merge, no read first), and returns false when RLS refused it. `CommitteeEditorModal`'s organiser re-sync reads the key so editing the conference committee keeps the dais's choice.
- Optimistic first (`updateLocal`, non-structural), then the result is checked: on failure the topic and index roll back, the picker reopens and shows `agenda_failed`. A `localPick` guard stops a realtime snapshot that predates the write from flashing the picker back open.
- Both loaders strip `agendaTopicIndex` on hydrate (rule 12), so SettingsPanel and the voting page's `applyRule` can never post a stale copy back.

---

## FEATURE: AWARDS (conference-linked sessions only)

### CURRENT STATE: HIDDEN BEHIND A COMING-SOON SCREEN (7 Sep 2026)
The organiser-facing half of awards is switched off in the UI. Nothing was deleted
and no data was migrated:
- Settings → Awards renders `settings/awardsComingSoon.tsx`. `settings/awardsUi.tsx`
  is untouched on disk; re-enabling is one import and one render line in
  `settings/page.tsx`, both marked with comments.
- `/manage/[slug]/awards` is now a redirect to `/manage/[slug]/settings?tab=awards`.
  The secretariat desk is preserved unrendered as
  `manage/[slug]/awards/AwardsConsole.tsx`. Its rail entry is gone, and so are the
  two links into it from `manage/[slug]/scoreboard` and `live/LiveModals.tsx`.
- The `awards` set-up priority was removed from the dashboard checklist, from
  `conference_setup_status()` (setup_total 9 → 8) and from `SETUP_STEPS` in
  `admin/ConferencesTab.tsx`; `admin_conference_overview()`'s setup_total fallback
  moved 9 → 8. Verification is untouched: `awards` was never in `v_ver_keys`.
- The DATABASE IS UNCHANGED. `conference_awards`, `awards_config`,
  `awards_published_at`, the RLS policies and every RPC still exist and still work.
  Anything already published is still published and still visible to its recipient.
- Participant and public surfaces were deliberately left alone: `MyAwardsCard`,
  `/account/cv`, the public honour roll, the chair-side `AwardsCard` and the session
  signposts through `resolveChairAwardsHref`. None of them 404 and none of them can
  leak an unpublished nomination (the RLS is unchanged).

Everything below still describes the feature as built and is still true of the code
and the database. Read it before touching anything awards-related.

### The shape
- Awards are a CONFERENCE feature. The live session only signposts them. The gate is
  `committee.sessionOrigin === 'conference'` (surfaced by `rowToCommittee`); an anonymous
  standalone session must never render an award affordance (PRD rule 8).
- Vocabulary, config reader, slate lifecycle and scoreboard suggestions: `src/lib/awards.ts`.
  Every read/write: `src/lib/awardsService.ts`. Nothing else may touch `conference_awards`.
- Lifecycle: `nominated` (chair) → `approved` (secretariat, `approve_committee_awards`) →
  `published` (conference, `publish_conference_awards`). Per-committee stamps live on
  `conference_committees.awards_submitted_at / awards_approved_at / awards_return_note`;
  the ceremony moment is `conferences.awards_published_at`. Categories, quotas, points,
  deadline and `requireApproval` are `conferences.awards_config` (jsonb; `{}` = defaults).
- Publishing mints ONE `mun_cv_entries` row per recipient per conference with
  `source = 'gavelling_verified'` (upgrading a self-reported entry for the same conference in
  place) and a `points_ledger` row of type `earned_award` at paid conferences. It is
  idempotent: already-published rows are never touched, so late additions republish safely.

### Surfaces
- Chair: `conferences/[slug]/participant/AwardsCard.tsx` on their conference page, with the
  session scoreboard (`loadConferenceScoreboard(..., [committeeId])`) beside the slots.
- Secretariat: `manage/[slug]/awards/AwardsConsole.tsx` (review, return with note, edit,
  delegation standings, publish, certificates CSV) and Settings → Awards
  (`settings/awardsUi.tsx`). BOTH are currently unrendered, see CURRENT STATE above.
- Delegate: `participant/MyAwardsCard.tsx`, `/account/cv`, public `/conferences/[slug]/awards`.
- Session: `ScoreboardPanel` header link and the End View card on the chair page, both
  resolved through `resolveChairAwardsHref(code)` and both conference-only.

### Rules
- **Nominations are secret until publish.** RLS on `conference_awards` exposes unpublished
  rows only to the committee's chairs and the organising team. Never add a read path around it.
- `award_type` keys are stable identifiers. Renaming a built-in changes `label`, never `key`.
  `DEFAULT_AWARD_TYPES[].points` must match `award_points_for()` in the database.
- The chair's decision is qualitative. `suggestSlate` fills EMPTY slots from the blended
  headline score and is always editable; it must never be applied without the chair seeing it.
- `committee_awards_locked()` (approved or published) is what stops chair writes. The UI
  mirrors it with `chairCanEdit(slateState(...))`; treat the DB as the truth.

---

## FEATURE: DELEGATE VIEW

### Tabs
1. **Session** — floor card, session status, speakers list, delegation status
2. **Motions** — "Coming Soon" placeholder (not built yet)
3. **View Documents** — all WPs and DRs with status badges
4. **Submit Documents** — submit form only (no doc list)
5. **Stats** — speaking history, score, leaderboard

### Floor card (always visible in Session tab)
- Grey: "Not on any speaker list"
- Amber: "You have the floor!" (isCurrentSpeaker) OR "You're up next!" (myQueueIndex === 0)
- Yellow: "[N] speaker(s) until your speech" (myQueueIndex 1-5)
- Green: "[N] speakers until your speech" (myQueueIndex 6+)
- This card is PERMANENT — always shows, always colored based on position

### Timer
- Delegate view does NOT show a countdown timer for the current speaker
- When isCurrentSpeaker: shows "🎙️ You Have the Floor" message only
- No localTime, no timer sync — these were removed

### GSL request flow
- Delegate clicks "Request to Speak" → requestGslSpot → creates gsl-request motion
- Chair approves → delegate added to speakersList
- Chair denies → gslDenied state → shows "Your request was denied" + "Request Again" button
- gslDenied resets when delegate gets on list or becomes current speaker

### Status changes
- Rate limited: 3 changes per 3 hours (tracked in localStorage)
- Absent delegates must request to join via AbsentBanner (join request → chair approves), or the chair recognises them by clicking their row onto a list, which marks them present and answers any pending request (see COMPONENT: RollCallPanel)
- Going absent sends a join-request motion to the chair

---

## FEATURE: JOIN PAGE

### Layout and sign in (redesign, 16 Sep 2026)
- `src/app/join/page.tsx` holds the logic; `joinUi.tsx` is the visual kit (palette, `BrandPanel`, `JoinCard`, `RoleTile`, `MessageRail`, `Chip`, actions) and `JoinSeatPicker.tsx` the seat list. Every behaviour below is unchanged.
- **No `FitToScreen` any more.** It scaled the whole page to the window height and re-scaled as content appeared, which is why the page "always changed sizes". /join is an ordinary scrolling page, phone layout first: a forest brand panel (gavel mark, Playfair accent line, sticky beside the card from `lg`) and one card.
- **Fixed slots.** The card is code field, a message rail that always takes its height (hint / checking / found / error with **Try again** when the lookup failed on the network), a stage with a reserved min-height (`min-h-[632px] sm:min-h-[656px]`, measured to fit the delegate step and the chair step with a new name) that shows a warm empty state until a code resolves, then the Join button. The code field and the button do not move between the code, role and seat steps. If you add content to a step, re-measure the stage.
- **Seat picker** (`JoinSeatPicker`): round `CircleFlag` (crest, flag, monogram) + the localized name + a chip (`join_seat_taken`, `join_seat_reserved`, `join_seat_yours`, `join_observer`), a search box ranked by `countryMatchRank` (aliases and localized names; custom seats by substring), an "N of M seats open" counter, and a fixed-height list (272px / 300px). Combobox pattern: ArrowUp/Down skip blocked seats, Home/End, Enter takes, Escape clears; the cursor is drawn only while the search box has focus and scrolls the list, never the page. Rows use `content-visibility: auto` so 200 seats stay cheap. Blocked seats are `aria-disabled` and not selectable. The caller still resolves each seat's state from `seatClaims`; the picker decides nothing.
- **Sign in.** Nav button (or a "signed in as" chip), the brand panel footer on desktop and a card row below the button on phones, each with `join_signin_why`. All go to `/auth/signin?next=/join?code=<CODE>&mode=<mode>` (the auth pages honour `next` through `safeNext`). Anonymous joining is unchanged; signing in only lets the conference checks find an allocation or a chair record.
- **Chair code links.** A code typed or linked as `CODE-1234` (the homepage routes those to `/join?code=CODE-1234&mode=chair`) looks up `CODE`, switches to Chair and fills the chair code in (`join_chair_code_prefilled`). It used to look up the whole string and report "not found". Validation is unchanged: the digits are still compared with `dbChairJoinSuffix`, and a wrong code shows `join_incorrect_code` (the old hardcoded English "Incorrect password" string is gone).
- The conference strings that were hardcoded English (verifying, verified allocation, sign in to join, not linked, chair "joining as") are now `join_conf_*` / `join_chair_joining_as` keys in all four locales.

### Modes
- **Delegate**: pick a country from the roster. Seats someone already holds are disabled as "Taken" (your own reads "Your seat"). In a conference-linked session a signed-in delegate with an allocation skips the picker and gets their allocated country (`?country=…&locked=1`); everyone else picks from the OPEN seats (see "Seat gating" below).
- **Chair**: name selection (existing name or new), plus the chair code, validated against `foundCommittee.dbChairJoinSuffix`, falling back to localStorage only when the DB value is missing. A conference chair verified through `chair_user_ids` skips the code. When the conference committee has NO assigned chair and NO pending chair invite (`chairs_open`), its chairs use the code exactly like a standalone session, signed in or not.
- **Faculty Advisor**: read-only observer view, no interaction

### Seat gating and one person per seat (migrations `delegate_seat_claims_and_open_conference_seats` and `seat_claims_reserved_before_roster_holder_lock_and_cleanup`, 11 Sep 2026)
- Gating is per SEAT, not per conference. Contract and client wrappers: `src/lib/seatClaims.ts`.
- **Reserved seat** = the linked `conference_committees` row has a `conference_allocations` row for that country (matched to `delegates.country` by name OR code, case-insensitively). That covers registered delegates, imported addresses with a null `user_id`, and delegation blocks. Reserved seats keep the verified flow: sign in, allocation checked, country locked. `claim_delegate_seat` re-checks `auth.uid()` against the allocation on the server, so it is not only a UI gate. A double delegation with only seat 1 allocated is reserved as a whole.
- **Open seat** = every other seat: the session code alone, no account. A conference that never invited anyone is fully open; a partly imported one keeps its imports gated and lets everyone else in.
- **Open dais** (`chairs_open`) = `chair_user_ids` empty AND no `conference_chair_invites` row with `status = 'pending'` for the committee AND no unclaimed imported chair application (`applications.role = 'chair'`, `user_id` null, `assigned_committee_id` = the committee).
- `session_join_rules(p_code)` returns `{found, is_conference, chairs_open, reserved_countries}`. Anon-callable SECURITY DEFINER; never returns names, emails or user ids.
- **`detectConferenceSession()` now means "is the DAIS gated"**: true only for a conference session whose dais is not open. The chair and voting pages treat `false` as standalone, so a chairless conference opens with the chair code on both with no change to those pages. It FAILS CLOSED: if `session_join_rules` errors it falls back to `isConferenceSession()` (the old rule, `session_origin = 'conference'`), and that one checks supabase-js's `error` (which resolves, it does not throw) and answers true on an error or a throw. The join page no longer calls it; it reads `session_join_rules` directly, and fails closed the same way (every seat reserved).
- **The advisor view stays gated on `session_origin`, independent of the dais.** `/advisor/[code]` calls `isConferenceSession()` (`src/lib/conferenceAccess.ts`), NOT `detectConferenceSession()`: every conference session needs a verified conference advisor, observer or organiser, open dais or not, because the advisor view can nudge delegates. Using the dais switch there opened `/advisor/CODE` to anyone holding the code for every chairless conference session (316 when this was caught). The join page never offers the advisor card on the open path, which matches.
- **One pending chair invite closes the dais again**, even one that is never accepted. The moment an organiser invites a chair (or imports one), `chairs_open` goes false, and chairs who joined with the code are sent through the verified flow on their next reload of `/chair` or `/voting`, where they have no conference role and are locked out. Revoking the invite reopens it. Tell organisers this before they invite a chair mid-conference.
- **A signed-in user with no role here** gets the open-seat picker (and the Chair card when the dais is open) instead of the "not linked to your account" dead end, which now shows only when nothing is open. An allocated user still goes straight to their locked seat. The advisor card is never offered on the open path.
- **One person per seat.** `delegate_seat_claims` has RLS on and NO policies: unreadable except through the RPCs. Holder = `'u:' || auth.uid()` when signed in, else `'d:' || sha256(device token)`; the token is random, kept in `localStorage` under `gavelling-seat-token:<CODE>`, and never stored raw. Capacity = `committee_country_slots.delegation_size` for a conference seat (a double delegation holds 2). A country with NO `committee_country_slots` row falls back to `conference_committees.delegation_size` for the whole committee (so on a double-delegation committee an unlisted country also holds 2), and a standalone seat holds 1.
- **What one-person-per-seat does NOT do.** `committees.settings`, and with it `chairJoinSuffix`, is anon-readable (`sess_select` is `true`), and every session write (`delegates`, `motions`, `messages`, `speakers_list`, ...) is checked only by `has_session_code` / `is_session_chair`, never against a claim. Anyone who wants to can read the chair code or write as any delegation directly. The claim stops honest collisions (two phones, the wrong person on a seat), not a hostile user. Do not describe it as a security boundary.
- `claim_delegate_seat(p_code, p_country, p_token)` runs on every `/delegate/[code]` load and is the authority for races: `taken` renders a full-screen "This seat is already taken" with Try again and Back to join. Re-claiming your own seat is idempotent. A device claim is adopted by the account that later signs in on that device; one account never adopts another account's claim. Taking a seat lets go of any other seat the same holder had in that committee. An ended session never claims (read-only).
- **Order inside `claim_delegate_seat`: reserved BEFORE roster.** A reserved country that is not on the session roster yet (59 allocations in 8 live sessions when this was fixed, e.g. TONYSO's Nigeria) answers `signin` / `reserved` to everyone but its allocated account, matched on the trimmed requested name or code, case-insensitively. It used to answer `no_seat`, which the delegate page treats as allowed, so a stranger's page became that delegation the moment the chair added the country. `no_seat` now means "not reserved and not on the roster", or "on no roster yet, and you are its allocated user".
- **Locks:** a per-(committee, holder) advisory lock, then a per-device one when the device differs from the holder, then the per-seat lock, always in that order. The holder lock closes the race where one holder's two concurrent claims for DIFFERENT seats both won. No path takes a holder lock after a seat lock, so it cannot deadlock.
- **Deleting a `delegates` row forgets its claims.** Statement trigger `delegates_forget_seat_claims` (`seat_claim_forget_removed_delegates()`, SECURITY DEFINER) removes claims on a country that no longer has any row in that committee, so a removed and re-added country is not "taken" forever. The roster editor deletes only the removed countries, never the whole roster, so this does not wipe live claims on a save.
- **The delegate page re-verifies every 30 s** and whenever the tab becomes visible, with one `claim_delegate_seat` call (no per-second work, nothing written into committee state). Your own seat answers `mine`; a seat that was freed and is still free is re-taken. Only an explicit `taken`, `reserved` or `signin` swaps the page for the full-screen stop; a network error never ejects a delegate who was already in. A page that loaded on `no_seat` re-claims as soon as its own delegation row appears. **The re-verify is skipped once the delegate is idle** (`idle.isIdle()`, see "Idle logout" below), so an idle page stops refreshing `last_seen_at` and the server lets the seat go.
- **One account, one device** (migration `seat_claims_one_device_per_account`, 14 Sep 2026). A signed-in claim used to match on the account alone, so the same account on a phone and a laptop both got `mine` and both drove the delegation. The claim now also records the device hash, and `claim_delegate_seat(p_code, p_country, p_token, p_takeover boolean default true)` decides: same account + same device → `mine`; same account holding ANY seat in this committee from a different device → `other_device` when `p_takeover` is false (nothing changes), or the claim moves to this device (`claimed`) when it is true. The delegate page's load claim (first open, sign-in, Try again, "Use this device instead") passes `takeover: true`; the 30 s / visibilitychange re-verify passes `false`, gets `other_device` and shows the full-screen "This seat is open on another device" stop (`accessState 'elsewhere'`), which stops re-verifying, so two devices can never ping-pong. A reload of the active device answers `mine`. Two tabs on ONE device share the token and are one device. Takeover never touches another account's claim, so capacity still counts distinct holders (two different accounts on a double delegation both hold it) and reserved-before-roster is unchanged. Anonymous claims are unchanged: their holder already is the device. **`p_takeover` defaults to TRUE on purpose**: a bundle that predates it (production until this ships) calls with three arguments and must keep today's behaviour rather than lock a user out of switching devices; the old 3-arg overload was dropped so PostgREST resolves unambiguously. Never make a re-verify pass `true`.
- The reserved-seat screen offers **Switch account** (sign out, then sign in) when someone is already signed in with the wrong account, and Sign in otherwise.
- `delegate_seat_availability(p_code, p_token)` returns per seat `{capacity, claimed, full, mine}` with no holder info. The join page disables full seats. `RollCallPanel` no longer reads it (the claimed-seat phone icon and its 20 s poll were removed on 14 Sep 2026).
- **A chair CAN remove a delegate, from Settings → People only (REVERSED 15 Sep 2026).** History: the two-tap "Free seat" control in the roster, `releaseDelegateSeat` and the `release_delegate_seat` RPC were removed earlier on 15 Sep 2026 (migration `seat_claims_idle_expiry_leave_and_drop_release`) at Peter's instruction. Later the same day Peter asked for a People tab in Settings listing everyone joined on a device, "where adding an option to kick them is also possible". That is `kick_delegate_seat` plus the 10-minute `kicked` tombstone (FEATURE: SETTINGS → "Settings → People"). The roster (`RollCallPanel`) still has no seat affordance; do not put one back there. Seats also still free themselves through the idle rules below.
- **Idle expiry (server).** `claim_delegate_seat` treats a claim whose `last_seen_at` is older than **65 minutes** as expired: under the holder and seat locks it deletes expired claims on the requested seat and the caller's own expired claims (by holder or device), so they neither fill the seat nor count as `other_device`. `delegate_seat_availability` ignores expired claims, so the join page does not show them as Taken. Expired rows of seats nobody asks for simply stay until someone claims that seat or the committee is deleted; they hold nothing.
- **Idle logout (client, `/delegate/[code]` only).** `useDelegateIdleLogout` (`src/lib/delegateIdle.ts`): 60 minutes with no activity signs this device out of the seat. Activity is `pointerdown`/`pointermove`/`touchstart`/`keydown`/`wheel`/`scroll` (document, capture), the tab becoming visible or focused, and explicit actions via `markDelegateActivity()` (request to speak, status change, join request, chat send in `ChatPanel`, document submit). Realtime updates are never activity. Wall-clock timestamps, not a countdown, so a phone that slept 70 minutes logs out on wake, and an event that arrives after the deadline logs out instead of resetting it. At 58 minutes `DelegateIdleWarning` (`src/components/delegate/`) opens an `alertdialog` ("Still there? You'll be signed out in 2:00", **I'm here**), with its own 1 s tick so the page does not re-render every second; it renders on the main, adjourned and waiting-room screens. On logout the page calls `leave_delegate_seat` (best effort, 3 s cap) and `router.replace`s to `/join?code=CODE&idle=<country>`, where `join_idle_signed_out` explains what happened. Disabled on an ended session, while the session is suspended (a break longer than an hour must not sign the room out; the claim stays alive through the break and resuming starts a fresh hour), and until the seat is confirmed. Chairs, advisors and the voting page are not affected. It is a UI-side timer plus the server expiry, not a security boundary.
- `leave_delegate_seat(p_code, p_country, p_token)` removes only the CALLER'S OWN claim: an anonymous caller its `d:<hash>` claim; a signed-in caller its account claim only when that claim is recorded on THIS device (so an idle old phone cannot free the seat the same account moved to a laptop), or a device claim of this token. Same lock order as `claim_delegate_seat`. Returns `{ok, released}`.
- **Sessions that were live when this shipped had no claims.** The first holder to load (or re-verify) a seat claims it. Two devices already sharing one seat: the first to re-verify keeps it and the other sees "Taken" within 30 s. A wrongly held seat frees itself 65 minutes after that device goes idle, or a Moderator removes it in Settings → People.
- Every function of the feature runs with `search_path = public, pg_temp`. The four public RPCs are executable by `anon` and `authenticated` only (revoked from PUBLIC); the `seat_claim_*` helpers are executable by nobody but the owner.

### Chair name persistence
- When chair joins with a new name, addChairName() appends it to committee.chair_names[] in DB
- addChairName is idempotent and atomic: `add_committee_chair_name` appends with `array_append` only when the exact name is absent, in one statement

### Head chair vs co-chair at join
- The chair tab has a head/co role picker; `chairRole` defaults to `'co'` (`join/page.tsx:56`).
- Picking "head" calls `updateCommitteeHeadChairInDB` before routing — see FEATURE: CHAIR ROLES & THE GAVEL.

### Suspended/ended committees
- Suspended: delegates can join but see waiting screen. Chairs can join and auto-start resume roll call.
- Ended: both roles can join in view-only mode. Shows "view only" banner.

---

## FEATURE: FACULTY ADVISOR VIEW

- Read-only observer — sees all delegates, current speaker, queue
- Can send "nudge" emojis to delegates via chat
- Cannot modify any committee state
- Delegate cards: expandable with last motion raised, queue position, nudge buttons

---

## FEATURE: VOTING PAGE (/voting/[code])

- Separate page from main session, opened from the Vote button beside the Documents tabs (carries `?chairName=`)
- Shows delegates one by one: In Favour / In Favour with Rights / Abstain / Pass / Against with Rights / Against; a pass round follows
- Rights speakers handled in sequence after all votes
- P5 veto mode: one P5 Against = failed
- Custom veto mode (`vetoMode: 'custom'`): one Against from any delegation in `vetoCountries` = failed. Matched by country identity (`src/lib/vetoMatch.ts`, re-exported by `VotingRulesPanel`), the same `vetoListFor` → `evaluate` path as P5
- Unanimous mode: all P+V must vote For
- Result shown with pass/fail, vote counts; "Vote Again" opens the roll call for the same paper, and confirming it re-freezes the room and starts a new ballot

### The flow (redesign, 15 Sep 2026)
- **Landing = the resolution picker** (`src/components/voting/ResolutionPicker.tsx`). Every introduced DR as a card (code, title, sponsors as overlapping round flags with +N, status pill Ready / Voting now / Passed / Failed, cast progress for a live vote, for/against line for a finished one unless the tally is hidden), sorted by `docCode`, hover lift, staggered entrance (off under reduced motion), empty state with a way back to the session. The Documents "Vote" button lands here. The page decides each card (`cardState`): Moderator starts (roll call first), resumes, or reopens a stored result; a Commenter opens only a vote that exists.
- **Every new ballot passes through the roll call.** Choosing a ready card (or Vote Again) sets `pendingDocId`, which opens `PreVoteScreen` for that paper; its Start voting calls `startNewVote`, freezing `livePresent` (now always `seatStatus`, i.e. the DB row except seats this chair set on this screen). The roll call can also open on its own (`rollCallOpen`, picker button or roster notice), where the action is Done. There is no longer a roll call that opens by default, and `rollCallDone` is gone.
- **Header** (`src/components/voting/VotingHeader.tsx`): Session (quiet, `setVotingPhase(false)` for the Moderator), committee emblem + acronym (`useCommitteeIdentity`, the chair masthead's resolution), the Draft Resolutions crumb (back to the list), the DR code + title, the stage and a cast/total progress line (cast count only, safe with the tally hidden), a Moderator chip or "Following {name}" for a Commenter, the tally toggle, the rules popover (`VotingRulesPopover trigger="icon"`), settings, and End debate as red ink behind the confirmation dialog.
- **Ballot**: `VoterCarousel` (`src/components/voting/VoterCarousel.tsx`) draws the line as round flags: the voter centred large, voted delegations receding on the inline-start side and upcoming ones on the inline-end side (mirrored in RTL), four visible each side plus an invisible fifth so seats fade in and out; transform/opacity transitions keyed by seat id. Past voters wear a choice badge (none while the tally is hidden; a Pass badge always, the chair needs it for the pass round). In the pass round the line is `passedIds`.

### Back (replaces "Correct a vote", 15 Sep 2026)
- `stepBack()` is one `updateVote`, so `seq` grows and `vote_state` stays authoritative. Result or rights speakers at the first speaker → the ballot at its end, votes kept, `result` null, and the paper's `documents.status` put back to `introduced` through `persistResult` until the vote is finished again. That status write waits for Back's own vote save to land (`backStatusSeqRef` + `flushBackStatus`, including a Retry after a refusal); if the save comes back `stale` and another device's ballot wins, `introduced` is never written and the stored state is applied instead, and a new verdict before the save lands cancels it; rights speakers → previous rights speaker; pass round → the last pass-round vote is removed and that delegation is asked again; main round → `currentVoterIndex - 1`. Repeatable back to the first voter.
- After Back the delegation on screen shows its recorded choice (`Recorded: …`, or a neutral line while the tally is hidden) with the matching ballot button ringed; **Keep and continue** (`keepAndAdvance`) moves on without changing it, any ballot button replaces it.
- Invariants the derived pass round relies on: in the main round a delegation has a vote OR a Pass, never both (`castVoteAndAdvance` drops the Pass, `handlePass` drops the vote); `passedIds` stays in ballot order; pass-round votes are a prefix of `passedIds`. Commenters get none of these controls and every writer returns on `isViewOnly`.

### The pre-vote screen (15 Sep 2026, `src/components/voting/PreVoteScreen.tsx`)
- One screen with no page scroll at 1280x800 and up (checked at 1280x800 and 1920x1080): two columns; the roll call list scrolls internally (round `SeatCircleFlag`, Absent / Present / P+V segments via `setRollCallStatus`, All Present / All P+V through `setDelegateStatusesBulk` with the per-row fallback only on a missing RPC and a revert on refusal, observers apart); the other column holds a compact forest "To pass" summary (`computeVoteOutcome` for "every present delegation votes"), the rules in four tabs (Threshold, Abstentions, Veto with the custom picker, Quorum, each tab showing its current value), and ONE primary action. Below lg it stacks and the body scrolls. Back / Escape closes it. RTL via logical properties, entrance animation off under reduced motion.
- Still Moderator-only (`showRollCall` requires `!isViewOnly`, it writes delegate statuses); `readOnly` disables every control anyway. Commenters keep the read-only `VotingRulesPopover` in the header.
- Rules are written by `applyRules(patch)`: store per key, then ONE `saveCommitteeSettings` patch of only the changed keys (rule 12). `applyRule(key, value)` is a thin wrapper. On the result screen a patch that flips the verdict re-records the status, as before.
- **Custom veto picker** (`src/components/voting/VetoCountryPicker.tsx`): removable chips plus a "+" that opens a searchable list of the non-observer roster through `Portal` (positioned by `src/components/voting/anchorPosition.ts`, flipped near edges). Stores roster spellings in `vetoCountries`, the same values SettingsPanel's checkbox list compares. Also in the header popover (dark tone). An entry that matches nobody here shows "Not in this committee". P5 shows its list read-only. `changeVetoMode` seeds the list only when `committees.settings` has never stored `vetoCountries`: from P5 the P5 seats sitting here, otherwise empty; `vetoMode` and `vetoCountries` go in one patch.

### Hide tally
- The eye toggle (in `VotingHeader`) removes the running tally from the screen entirely while voting and on the all-voted screen: no `VoteScale`, no counts, no "N counted / needed" line, no choice badges on the carousel, no recorded choice after Back (only "A vote is recorded"), no for/against line on picker cards, and the header rules popover gets `hideTally` (no stats, no verdict chip, no abstention counts, no veto/unanimity block note; quorum still shows). The result screen always shows the result. Per device, remembered in `localStorage gavelling-hide-tally:<CODE>` so a projector reload does not flash the tally.

### The vote is persisted (`documents.vote_state`, `src/lib/voteState.ts`)
- One jsonb object per draft resolution: `status` (voting | rights-speakers | result), the frozen `order` (ballot order, also the P/PV numerator) and `votable` (quorum/veto denominator) as `{id, country}`, `votes`, `currentVoterIndex`, `passedIds`, `rightsOrder`, `rightsIndex`, `rightsTimerLimit`, `result`, `seq`. A column rather than a table: one live vote per document, and `documents` already has the right RLS (`sess_upd`), realtime publication and subscriptions. Cost: every ballot write fires a `documents` event. Every surface's session sync coalesces those (200 ms) and fetches only the documents slice; the voting page adds one light `loadVoteStates` read. `updatedAt` / `startedAt` are stamped with `serverNowIso()` because follower devices sort open votes by them.
- Written ONLY by `saveVoteState` → `save_document_vote_state(p_document, p_state)` (SECURITY INVOKER). `seq` must strictly grow (compared as numeric, so no cast can throw), so a stale device cannot overwrite a newer state; it returns `'ok' | 'stale' | 'denied'`, and an invalid state (not an object, a fractional or out-of-range seq) is `'denied'`, never an exception. The page writes optimistically (a ref plus state), then serialises the saves; a refused save keeps the ballot on screen with a Retry. A `stale` save re-reads: the SAME ballot (same `startedAt`) is re-applied under a seq above the stored one; a different ballot means the DB wins and the stored state is loaded.
- **The verdict write is checked (V2).** `persistResult` → `updateDocumentStatus` (now `Promise<boolean>`, row-counted); a refused write shows `voting_save_failed` with Retry. The document list treats `stored?.status === 'result'` as voted even when `documents.status` was lost (and re-records it on open), so "start a vote" is never offered over a stored result. The Moderator can reopen a voted paper that has a stored state and use Back to correct a placard after a reload. `stepBack`, `finishWithResult` and every ballot write refuse on a view-only device.
- **One device drives**: the Moderator's, by the same `deriveGavelRole(committee, chairName, getGavelDeviceId(code))` as the chair page. Every other chair device is view-only (UI gate, rule 15): no vote buttons, no roll call modal, no rules changes (`VotingRulesPanel readOnly`), no End Debate, no rights clock; it follows the open vote live (`followLive`) and can look at any stored vote.
- A reload never loses a ballot: the document list offers **Resume vote** for an unfinished one and the roll call modal stays closed while a vote is open.
- **Correcting one placard**: Back (see above). The "Correct a vote" list and `correctVote` are gone.
- The rights countdown is local to the driving device (never written per second).
- **Marking the floor speaker absent on the pre-vote roll call takes them off the floor.** The voting page only writes the delegate's status (`setRollCallStatus` → `setDelegateStatusInDB`); it never touches `current_speaker` or the caucus. The removal happens on the Moderator's CHAIR page, through its absent-floor-speaker effect (`floorAbsentId` → `handleRemoveCurrentSpeaker`): pause at the live value, `logFloorSpeech`, conditional clear, and in a moderated caucus the total re-anchored paused with nobody on its floor. It runs whenever that page next evaluates it: at once if the chair page is still open on the Moderator's device (another tab), otherwise when the Moderator returns to or reopens it. It needs this device to be the Moderator, not kicked, not ended or suspended, a fresh sync, and a phase other than pre-session / adjourned; a moderated-caucus floor holder known only by `caucus.currentSpeaker` is picked up once the room is back in `moderated-caucus`. The speech is idempotent by turnKey, so a second device or a re-run never logs it twice. Marking them present again before that does nothing.

### The room's phase (`set_committee_voting_phase`)
- Opening the page as the Moderator calls `setVotingPhase(id, true)`: in ONE statement it stores the current phase in `settings.votingReturnPhase` and sets `phase = 'voting'`, so delegate phones show "Vote in progress" and Request to Speak closes. In the same transaction it **pauses every clock** (V1): a running caucus total is frozen at its live value (the `pauseCaucusLive` math: a moderated total read at min(now, the speaker clock's zero)) and a running `current_speaker` clock is paused in one update at its live remaining, so a vote never drains a speaker or a caucus. The dais presses play after returning. Already voting = no-op (a reload never overwrites the remembered phase). A suspended or ended room is refused (`voting_phase_closed`); the entry effect is keyed on whether the room is closed, so it is attempted again the moment the room resumes.
- "Back to Session" (Moderator) calls `setVotingPhase(id, false)`: restores exactly the remembered phase; a remembered caucus phase whose `caucus` is gone falls back to the GSL; nothing remembered falls back to the caucus on the row, else the GSL; not voting = no-op. It never forces `speakers-list`. A refused write keeps the chair on the page (`voting_phase_leave_failed`). A Commenter only navigates.
- While `phase === 'voting'` the chair page renders `VotingInProgressCard` (open the voting screen; Moderator: Return to debate through the same RPC), because it has no other main view for that phase. No clock runs during a vote: entering voting paused them (above).
- The organiser live wall (`manage/[slug]/live/PhaseVariants.tsx`, `cardModel.ts`) still says ballots are not stored; it has not been updated to read `vote_state`.

### End Debate
- Calls the same `endDebate` as the chair page (`ended_at`, `expires_at`, phase), then reads `ended_at` back, because a refused update resolves with no error. Success lands on `/chair/[code]` (End View). Failure keeps the confirmation open with `voting_end_debate_failed`. The confirmation renders on every screen of the page.

---

## COMPONENT: RollCallPanel

### Props that matter
- `isRollCallPhase`: true during pre-session. Controls: show All P/PV/Clear buttons, suppress GSL removal on absent, and the plain A-Z ordering (see Ordering)
- `isReadOnly`: true when session ended. Makes status sliders non-interactive.
- `onListIds`: Set of delegateIds currently on the relevant list (GSL or caucus)
- `onReorderList`: callback for drag-to-reorder in queue view
- `speechRunning`: the chair page's `timerRunning` (a press-time state flip, never per second). Part of the scroll-to-top signal, and part of the memo comparator
- `onJoinRequestResolved(country)`: parent drops that country's `join-request` motions from local state (functional updater) when an absent delegate is recognised from the panel
- `canAddToList(delegateId)`: asked BEFORE an absent delegate is recognised. The moderated-caucus panel passes `canAddToCaucusQueue` (a stable callback over `caucusRoomRef`, assigned every render so the memoised panel reads the live caucus and speaker clock); on "no" it raises the queue-full notification (top right). The GSL passes none (always room). In the memo comparator.

### Ordering (the A-Z / QUEUE toggle is GONE, 14 Sep 2026)
- There is no view toggle and no `listView` / `onListViewChange` / `showViewToggle` prop. Chairs left the A-Z roll-call sort on for whole sessions and the queue was unreadable.
- `isRollCallPhase` (pre-session and the resume roll call) AND the mid-session ROLL CALL tab (`showStatusSliders`, the chair page's `showSliders`): the whole list is plain A-Z (`isQueueView = !isRollCallPhase && !showStatusSliders`).
- Everywhere else, including the unmoderated caucus: the speaker holding the floor (#1), then the list in order, then every delegate NOT on the list, A-Z (absent delegates sit in their A-Z place, at full brightness with the word `rollcall_absent`).
- **Any speech start leaves the Roll Call tab.** One effect on the chair page (after the `useGavelCue` calls) watches `currentSpeaker.delegateId`, `caucus.currentSpeaker` and the `timerRunning` boolean going false → true (GSL Start / Next / call first, moderated-caucus Next, Tour de Table advance) and calls `setShowSliders(false)`. Press-driven values only: nothing per second, no `setCommittee`, no `updateLocal`, no `localUpdateTime`. The panel then switches to the queue and, because its signal goes from `null` (A-Z) to a value, scrolls to the top.
- **A speech starting scrolls the list container to the top.** Signal = the speaker at #1 (`currentSpeaker`, or `caucus.currentSpeaker` in a caucus: GSL Next / call first speaker, moderated caucus and Tour de Table advance) plus `speechRunning` going true (Start, including resume after pause). The effect only calls `listRef.scrollTo`; it never touches committee state, `updateLocal` or `localUpdateTime` (RULES 3/4). Right of Reply changes neither value, so it does not scroll.
- The onboarding tutorial's `sidebar-view-toggle` step was removed with the toggle.

### Recognising an absent delegate (14 Sep 2026)
- Mid-session (NOT `isRollCallPhase`, NOT the mid-session Roll Call tab `showStatusSliders`, not read-only/ended, not a Commenter), clicking an ABSENT row on a panel that has `onAddToList` (GSL, or moderated caucus / Tour de Table queue) marks them present AND adds them, in one click. It used to be `cursor-not-allowed` and did nothing.
- Order: `applyStatus` first (`localStatuses` + the parent's `handleStatusChange` → `updateLocal` + `setDelegateStatusInDB`), then `onAddToList` (optimistic + DB). Status must go first: absent delegates are stripped from both lists.
- The status is `present`, or `present-voting` if a pending `join-request` from that country asked for it (never PV for an observer), i.e. the same answer Approve gives.
- Waiting-room requests: the parent drops them locally at once; `resolveJoinRequestsOnAdmit` (`committeeService.ts`) repeats and AWAITS the (idempotent) status write, THEN deletes the country's `join-request` motions. Same order as `approveJoinRequest`, because the delegate page reads "request vanished while still absent" as a denial.
- The delegate phone sees Present through the ordinary `delegates` realtime path, exactly like a slider change.
- **Room first, status second.** Before `applyStatus` the panel asks `canAddToList`; in a moderated caucus that is the SAME `caucusQueueCapacity` check the sidebar add uses (live total and speaker clock). If there is no time left the status is left alone and the queue-full notification shows, so a delegate is never marked Present but silently not queued.
- The status rule lives in `recognisedStatus(pendingMotions, country, isObserver)` (exported from `RollCallPanel.tsx`), shared with the typed bars.
- **The typed add bars offer absent delegates too** (`AddSpeakerInput`, `CaucusAddSpeakerInput`), tagged `rollcall_absent`, when given `onRecognise` (the chair page's `recogniseAbsentDelegate`: `handleStatusChange` with `recognisedStatus`, `handleJoinRequestResolved`, `resolveJoinRequestsOnAdmit`). They recognise only after every refusal check (already listed, current speaker, `isFull`) has passed, then add. The GSL bar gets no `onRecognise` while below quorum, because its add is then a no-op, so absent delegates are not offered there. The caucus bar stays in place when full and refuses with the queue-full notification before recognising anyone, and its handlers use the same `maxByTime`, so a recognised delegate is always queued.

### Seats
- The claimed-seat phone icon, its `delegate_seat_availability` fetch and the 20 s poll were removed, and so was the Free seat control (15 Sep 2026). The panel has no seat affordance at all; see JOIN PAGE → "Seat gating and one person per seat" for idle expiry.

### Internal state
- `localStatuses`: Record<string, DelegateStatus> — optimistic status overrides
- `localStatuses` resets on committee.id change
- All three bulk handlers (handleAllPresent, handleAllPresentVoting, handleClear) flush localStatuses atomically

### Queue view
- queuePositionMap: currentSpeaker → 1, speakersList[0] → 2, etc.
- finalQueueOrdered: currentSpeaker prepended to top
- Position 1 + currentSpeaker → gold microphone badge, a gold rim on the row and a "Speaking" caption (`rollcall_speaking`)
- All other positions → ivory number badge on the flag's inline-end corner

### Row design (15 Sep 2026)
- Round flags through `SeatCircleFlag` (crest, flag, then the unknown-user glyph): 42px, 50px for the speaker at #1, 34px in the mid-session Roll Call tab (room for the megaphone toggle at the 288px minimum sidebar width), 54px in the full-screen roll call. Names 17px (19.5px for #1, 15.5px in the Roll Call tab, 21px in the full-screen roll call).
- **A seat that is not a country and has no crest** (a custom speaker, "European Commission") draws `UnknownSeatIcon` (`src/components/UnknownSeatIcon.tsx`, Lucide `UserRound`), never the blue 🌐 emoji: `SeatCircleFlag`'s default fallback (bare glyph in the disc), `FlagImg` with no code (round badge, which covers every `SeatFlag` without a `fallback`), and every explicit `fallback=` that used 🌐 (chair page, MotionsModal, DocumentsModal, delegate, voting, CowDelegationBoard, the roster add input). Conference-side `CircleFlag` calls keep the monogram.
- **Except in the chair sidebar, which shows INITIALS** (15 Sep 2026, owner's instruction): the expanded rows and the collapsed rail pass `SeatCircleFlag fallback="initials"`, so "European Commission" reads EC and "John Speaker" JS (`flagMonogram`, 1 to 2 letters) instead of the glyph. Colours through `monogramColors`: `SIDEBAR_MONOGRAM` (gold on a lifted forest, rows) and `RAIL_MONOGRAM` (gold on forest, the rail on the ivory page), both in `CircleFlag.tsx`. Every other surface still draws the glyph.
- No borders or hairlines. Flags wear a soft two-layer drop shadow (the speaker's gold ring keeps it too).
- **Status colour is a roll-call thing only** (15 Sep 2026, owner's instruction). In slider mode (pre-session roll call and the mid-session Roll Call tab) Present rows are tinted green and Present-and-Voting gold, and the slider carries the status. Everywhere else Present and Present-and-Voting rows are IDENTICAL: one neutral ivory tint, no PV tag (`statusesMixed`, `rollcall_pv_tag` and `rollcall_pv_full` are gone). **Absent is the clear state (16 Sep 2026, owner's instruction: "visibility in the room is bad when it's darkened")**: an absent row has no tint, and its flag and name are NOT dimmed or greyed (no opacity, no grayscale, full ivory name). The backdrop appears only when the delegation goes to P or PV. Outside slider mode an absent row still says `rollcall_absent`.
- **Observer status is set ONLY while taking roll, and only SHOWN there** (16 Sep 2026, owner's instruction, supersedes the 15 Sep flag badge). Outside slider mode an observer row carries NO mark at all: no megaphone badge on the flag, no word. An observer is visible only in slider mode, see below.
- **In slider mode (pre-session / resume roll call and the mid-session Roll Call tab) every row has the observer toggle directly beside its status slider** (inline-start of it, not on the flag): its own `<button>` (`aria-pressed`, `rollcall_observer_make` / `rollcall_observer_remove` plus the country as name), gold disc + forest glyph for an observer, a faint ivory ring otherwise. Click stops propagation and a pointerdown on a button never starts a drag. It calls `toggleObserver` (a new observer drops Present-and-Voting to Present). A Commenter or an ended session gets it inert and dimmed with the slider. The slider sits in a fixed three-segment-wide box, so an observer's shorter A/P slider never knocks the megaphone column out of line. **An observer's megaphone has the word `rollcall_observer` directly beneath it** (gold, uppercase, never truncated, 10px in the full-screen roll call and 7.5px in the Roll Call tab). The megaphone + word sit in a fixed-width column on EVERY row (66px / 50px), so the word appearing never shifts the slider column.
- **The slider thumb is centred on its segment** (16 Sep 2026). The thumb and the `inset-0` label grid both measure the PADDING box (`innerW = seg x n - 3` for the 1.5px border each side, `cellW = innerW / n`, thumb at `index x cellW + (cellW - thumbW) / 2`, top `(h - 3 - thumbH) / 2`). It used to be offset against the border-box `seg`, up to 2.5px off the letter under it. Verified 0px off in both axes.
- **The full-screen roll call is projector sized** (`isRollCallPhase`, `bigRoll`; 15 Sep 2026, owner's instruction). Flags 54px, names 21px, rows at least 70px, a 44px-tall slider (44px per segment, 13.5px labels), a 44px megaphone toggle, 48px bulk buttons, a 52px + button. Begin Session sits on one row with the + button (it wraps when narrow). The chair page's pre-session card is `max-w-2xl` and takes the full height of the floor (`height: 100%`, never `vh`, because FitToScreen scales the page), with the panel in a `flex-1 min-h-0` wrapper so the list scrolls and the footer is never clipped. The mid-session Roll Call tab stays compact (34px flags, 15.5px names, 30px slider, 26px toggle).
- **No X on the speaker's row** (15 Sep 2026, owner's instruction). The floor holder leaves the floor by a click on their row (`onRemoveCurrentSpeaker`), and the floor's top speaker strip keeps its own X.
- **The list hides its scrollbar** in every engine (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`) and still scrolls by wheel, touch and keyboard (the list itself is focusable, `rollcall_list_label`). It has 48px of bottom padding, and an edge fade (a CSS mask driven by `--fade-top` / `--fade-bottom`, written straight to the node on scroll by `updateFade`, never React state) appears only at an edge with rows beyond it.

### Reordering the queue (15 Sep 2026)
- The HTML5 `draggable` rows are gone (no touch support, no `dataTransfer` so Firefox never dragged, the whole row was the handle, #1 was draggable but every drop onto it silently failed, and the line was drawn above a target that the splice then inserted BELOW when dragging down).
- Each reorderable row has a **grip button** (`GripVertical`, inline-end, faint until the row is hovered, always visible on `hover: none` screens). Reorderable = in `committee.speakersList` (the caucus panel receives the caucus queue there), not the speaker at #1, queue view, has `onReorderList`, not a Commenter, not read-only or ended.
- **The whole row drags too** (15 Sep 2026: the owner reported the queue "not draggable", because only the faint 28px grip started a drag). Mouse and pen can pick a reorderable row up anywhere except a button inside it; it lifts after 6px, so a plain click still adds / removes. Touch drags from the grip only (the grip is `touch-action: none`, the row is not, so a finger still scrolls the list).
- **Pointer drag**: `startPointerDrag` records the start and sets `armedPointer`; a layout effect keyed on it attaches `pointermove` / `pointerup` / `pointercancel` to WINDOW (same flush as the pointerdown, so even a fast click's release is seen), so a drag never depends on pointer capture or on the pointer staying over its row. 4px threshold on the grip, 6px on the row. Every screen distance is divided by the list's scale (FitToScreen draws the console inside `scale()`), so the lifted row tracks the pointer 1:1 and the slot matches the row under it. While dragging, the row follows the pointer through a direct `style.transform` write (no render per move), is lifted (opaque forest, shadow, gold rim, `z-index`), the page shows `grabbing` and selects no text, and the list auto-scrolls near its top or bottom edge. React state (`drag = {id, slot}`) changes only when the drag starts, ends, or the drop SLOT changes. A gold line with a dot marks the slot; it is never shown for the slot the row came from. Slot 0 is directly beneath the speaker at #1, so nothing can be dropped above the floor.
- **Keyboard**: ArrowUp / ArrowDown on the focused grip moves the delegation one place (`rollcall_reorder_handle`, `rollcall_reorder_hint`).
- The drop is computed against the CURRENT `speakersList` at release (`reorderedList`); a no-op drop writes nothing; a delegate who left the list mid-drag cancels. It calls `onReorderList` once: optimistic `updateLocal(..., structural=true)` plus `reorderSpeakersList` on the per-list chain (unchanged). The grip stops click propagation and a 400 ms `justDraggedRef` guard means a drag never ends in a row click (add / remove / recognise).
- The caucus panel's `onReorderList` is now the stable `handleReorderCaucusQueue` (refs for id / code / suffix) instead of an inline arrow, which re-rendered the memoised panel on every page render, timer ticks included.
- Rows are keyboard operable (`role="button"`, Enter/Space) exactly when a click would do something for this chair (`rowActionable`: has `onAddToList`, not a Commenter, and not an absent row that cannot be recognised). Focus ring is gold.
- `hideIdentity` now drops the committee heading AND the majority pies: `CommitteeIdentityBadge` above owns both (see the chair page). With `hideIdentity` the panel header holds only the bulk roll-call buttons. Both chair call sites (sidebar and the pre-session card) pass it; `MajorityPie` is still exported for the voting and advisor pages.

## COMPONENT: Chair top bar and sidebar masthead (15 Sep 2026)
- **The forest sidebar runs the full height of the screen.** The chair page's root is a flex ROW: `ChairSidebarShell` (the slot holding the `<aside>`, the collapsed `SidebarFlagRail` and `SidebarResizer`), then a column holding the top bar, the banners and the floor. That column MUST stay the shell's next element sibling: the shell animates it. There is no Gavelling logo on the chair page. `sidebarVisible` keeps the sidebar in exactly the states it used to show in: not in pre-session, not while chat covers the floor, not on the End View / Suspend View tabs.
- **Top bar** (`src/components/ChairTopBar.tsx` primitives, wired in the page): inline-start `TopBarTab`s for Roll Call, Motions, Documents, each an EQUAL share of the space left of the icon cluster with its label centred (count pills inline, never over the label); inline-end the `GavelChip` (now `inline`, in the bar instead of floating under it), the session code button (a click opens `SessionCodePresenter`: the SESSION code full screen, growing out of the button by transform/opacity, fade only under reduced motion, gavelling.com/join, a locally drawn QR from `src/lib/qrCode.ts` with no third-party request, Copy inside, click or Escape closes; it is only ever given `committee.code`, never the chair code), then `TopBarIconButton`s for Chat (unread count), Scoreboard and Settings. Chat is an icon now, not a tab. `data-tutorial` targets are unchanged: `topbar`, `tab-rollcall`, `tab-motions`, `tab-documents`, `tab-chat`, `tab-settings`, `join-code`. Header height stays 44px because `NotificationStack`'s `TOP_PX` assumes it.
- **Collapsing the sidebar** (reworked 15 Sep 2026). The masthead's `PanelLeftClose` button (sidebar only, never the pre-session card), Mod+\ outside a text field, or dragging the divider narrower folds it to **`SidebarFlagRail`**: a 64px (`SIDEBAR_RAIL_WIDTH`) column with NO panel background, floating on the page ground: the committee emblem (`CommitteeEmblem`, `onLight`) at the top, then the round flags of the queue in speaking order (the floor holder first with a gold ring and a microphone, then the list numbered 2, 3, ...; up to 12, then `sidebar_rail_more`). It reads the same committee object the expanded panel gets (the GSL, or the caucus queue in a moderated caucus / Tour de Table). The emblem, every flag and the "+N more" are buttons that reopen (`sidebar_expand`, `sidebar_rail_item`, `sidebar_rail_label`).
- **The collapsed rail reorders too** (15 Sep 2026, owner's instruction). The chair page passes `onReorderList` to `SidebarFlagRail` exactly where the expanded panel has one: `handleReorderSpeakersList` on the GSL, `handleReorderCaucusQueue` in a moderated caucus / Tour de Table, nothing in an unmoderated caucus, nothing for a Commenter or an ended session. Queued flags only (never the floor holder, never a drop above it). Mouse / pen lift after 5px from the flag; touch lifts after a 350 ms hold (moving more than 8px first cancels, so the column still scrolls), then a non-passive window `touchmove` blocks panning. A click with no movement still reopens; a 400 ms `justDraggedRef` guard stops a drop from reopening. ArrowUp / ArrowDown on a focused flag moves it one place (`rollcall_reorder_hint` in its name); Escape cancels a drag. The lifted flag follows the pointer by a direct `style.transform` write, nudged 10px toward the floor so it never hides the drop marker; React state (`drag = {id, slot}`) changes only on lift, drop and slot change. The marker is the expanded list's gold dot + line, in the darker gold `#B6871F` because it sits on ivory. The drop builds the full list the same way as `RollCallPanel.reorderedList` (only drawn flags are targets; past the 12th means "after the last drawn") and calls `onReorderList` once, so the write is the same optimistic `updateLocal(..., true)` + chained `reorderSpeakersList`. All pointer logic lives inside one layout effect keyed on the armed pointer.
- **With the sidebar collapsed the floor's bottom bar runs the full page width** (15 Sep 2026, owner's instruction). The GSL add bar (time presets + "Add to speakers list...") and the moderated-caucus bar (total + add input; Moderator only, since a Commenter's comment dock sits beneath it) are wrapped in `FloorBarExtent` (`src/components/FloorBarExtent.tsx`), which publishes the bar's height as `--floor-bar-h` on `[data-chair-root]` (a ResizeObserver, written to the DOM only when it changes, removed on unmount). The rail paints a strip of the bar's ground (same colour, top rule and paper grain, since the page grain is stacked below the slot) under itself at that height, and pads its own bottom by it, so no flag ever overlaps the bar. Nothing in the floor column changes layout, so the shell's FLIP still reflows exactly once and the input text starts where it always did. Persisted per reader like the width (`gavelling-sidebar-collapsed-chair:<name>`). Collapsed, the rail carries `data-tutorial="speakers-sidebar"`; expanded, the `<aside>` does. Pre-session has no sidebar (roll call is the centred card), so the state simply waits.
- **Drag to fold / unfold.** Below `SIDEBAR_MIN_WIDTH` (288) a divider drag previews the fold: the slot follows the pointer, the panel keeps 288px and slides away under it, the rail fades in. Released below `SIDEBAR_COLLAPSE_AT` (176, halfway) it collapses; between 176 and 288 it snaps back to 288. From the collapsed column the same divider drags the panel back out and a release past 176 expands (clamped to 288..422). Keyboard on the separator: ← at the minimum collapses, → while collapsed expands, Enter toggles; double-click while collapsed expands.
- **The fold animates on transforms only** (`ChairSidebarShell.tsx`, `SIDEBAR_ANIM_MS` 240 ms, `cubic-bezier(0.32,0.72,0,1)`). The slot width is written once; the panel slides with `translate3d` at a FIXED width (no roster reflow per frame); the floor column is FLIPped (snapped back by the width delta with a transform, then animated to 0) so it glides instead of jumping; the rail fades. All animated styles are written imperatively (never React style props, which would overwrite the slot before the FLIP measures it), nothing sets state per frame, and the first 600 ms after mount adopt the stored state without animating. The folded panel stays mounted (`visibility: hidden`, `inert`), so its scroll position survives. `prefers-reduced-motion` = no transitions.
- **SidebarResizer has zero layout width.** An 8px strip centred on the sidebar's edge takes the pointer; a 2px edge rule lights gold and a small forest grip pill (`GripVertical`) appears just OUTSIDE the sidebar on hover, focus or drag, with `pointer-events: none` while invisible so it never swallows a click on the floor. It no longer paints anything itself: per move it reports the raw width (`onLive`, never clamped to the minimum) and once on release (`onRelease`); the shell paints and decides.
- **Masthead** (`CommitteeIdentityBadge`): an 84px emblem, the name (acronym big, full name beneath), the topic (11.5px, clamped to 3 lines, full text in the tooltip), and the `QuorumRings` capsules at its foot (they carry their own 10px bottom space). `compactQuorum` packs them together; the chair page sets it on the pre-session card only (`compactQuorum={!inSidebar}`).
- **Editing the topic.** For the Moderator on a session that has not ended (`onTopicSave`), clicking the topic turns it into an inline textarea: Enter or blur saves, Escape cancels, newlines are flattened, 150 characters max (`COMMITTEE_TOPIC_MAX`), an empty or unchanged value writes nothing. The chair page updates `committee.topic` optimistically (non-structural `updateLocal`), then `updateCommitteeTopicInDB` writes `committees.topic` through `sessionClient(code, suffix)`, conditional on `ended_at is null`, counted with `.select('id')`, via `runWrite` with no retry and no toast Retry. On false the previous topic is put back (only if nothing newer replaced it) and the badge shows `identity_topic_failed`. Delegate, advisor and voting pages and the live wall read `committees.topic` from the row, so the change reaches them through the ordinary `committees` realtime event. Speech and motion logs written from then on carry the new text; earlier log rows keep what they had.
- **Topic editing vs the agenda.** On a conference committee with 2 or 3 topics (`agenda.canSwitch`) the text still edits, and a separate small `identity_topic_switch` button beneath opens the agenda picker. Editing the text never touches `settings.agendaTopicIndex`. Consequences: `useAgendaPicker` matches the room's text first, so a custom wording falls back to the stored index to mark the current topic; and the organiser's `CommitteeEditorModal` re-sync keeps the room's text only while it equals one of the conference topics, so the next organiser save of that committee replaces a custom wording with the topic the stored index points at.
- Masthead emblem order: `conference_committees.logo_url`, then the conference's `logo_url` (conference sessions only, anon read by `session_code`), then `matchPresetEmblem(name)`, then the UN emblem (`DEFAULT_EMBLEM`), then gold initials if even that fails to load.
- **QuorumRings** (`src/components/QuorumRings.tsx`, reshaped 16 Sep 2026, owner: "make them look nicer and rounder") are three **round capsules** (fully rounded ends, a faint ivory fill and hairline inset ring), each holding a FULL circular ring gauge (38px, 4.5px stroke, round caps) filled 100% / 66.7% / 50% (a static pictogram of the threshold, never animated) with the number centred inside, and the word beneath (`identity_present`, `identity_tab_two_thirds` = "2/3", `identity_tab_majority` = "1/2+1"): present, `ceil(present x 2/3)`, `floor(present / 2) + 1`. They replaced the half-circle bookmark tabs with concave foot flares (the `ground` prop is gone). Every cell keeps its full-sentence accessible name (`identity_*_aria`); the group's tooltip is `identity_observers_counted`. In the sidebar they are spread evenly (`justify-evenly`); with `compact` (the wide pre-session roll-call card) they sit together in the middle with an 8px gap. When Settings → Voting → Quorum is set, a compact pill on its OWN line above them, at the inline end, says "Quorum met" or "Quorum needs N present" (`quorumNeeded = ceil(fraction x total)`). The arc is mirrored in RTL.
- **Who the quorum numbers count (16 Sep 2026, owner's instruction: observers "still count towards quorum in the indicators, up until the final vote, where they don't count anymore. They also need to count on motion voting").** Exactly:
  - **Counted, observers INCLUDED:** the chair page's `presentCount` (every delegate not absent) and `totalCount` (every delegate), which feed BOTH the QuorumRings (Present, 2/3, 1/2+1, the quorum pill) AND `belowQuorum` / `quorumNeeded` (the GSL add gate, the Start gate `speaker_ctl_below_quorum`, the below-quorum banner). One pair of counts, so the indicator and the gate can never disagree. Motion voting in `MotionsModal` (`present` → `requiredVotes(type, present)`) counts observers too. RollCallPanel's own `present` (Begin Session enabled) always did.
  - **Excluded, observers NOT counted:** only the final substantive vote on `/voting/[code]`: `liveVotable`, `livePresentAndPv`, the frozen `order` / `votable` of a ballot, the veto roster, and so its quorum, threshold and veto maths (`isObserverSeat`). Unchanged.
  - The chair page's unused `present` const (line above the quorum block) still excludes observers; nothing reads it.

---

## THINGS THAT MUST NEVER HAPPEN

1. **Never wipe speakersList when entering a caucus**
2. **Never put GSL delegates into caucusQueue or vice versa**
3. **Never call setCommittee or updateLocal from inside the timer interval**
4. **Never set localUpdateTime from timer tick operations**
5. **Never call clearCurrentSpeaker when entering a caucus** (races with nextSpeakerInDB)
6. **Never use committee.chairNames[0] as senderName for chat** — always use myChairName from URL param
7. **Never remove a delegate from GSL when their status changes to absent during pre-session (roll call)**
8. **Never pass currentSpeaker to caucus RollCallPanel** — caucusRollCallCommittee sets it to null
9. **Never await DB writes for UI updates** — always fire-and-forget, optimistic first
10. **Never call removePendingMotionInDB with a temp ID** — wait for real UUID via pendingIds tracking
11. **Never use a native `<input type="date">` (or any other old/native date picker)** — see UI RULES
12. **Never write the settings store back to the DB as a whole blob** — send only the changed keys through `patchCommitteeSettings` / `saveCommitteeSettings` (see FEATURE: SETTINGS, WRITE side). Posting `{ ...getSettings(code), [key]: value }` is what used to revert another chair's settings and, with a hydrated `headChair`, the gavel itself. `NON_HYDRATED_SETTING_KEYS` (`chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex`, `votingReturnPhase`) never enter the store and each has its own writer.
13. **Never regenerate `chairJoinSuffix` when the DB already has one** — it is the ONLY write credential (`x-chair-suffix` → `is_session_chair`) and the code every chair typed on the join page. Overwriting it locks every chair out of a live committee. `SettingsPanel.tsx:415-425` generates one only when the store copy is `''`; keep that guard.
14. **Never read a setting via `getSettings(code)` on the delegate or advisor pages** — neither page ever hydrates the store, so it silently returns `DEFAULT_SETTINGS`. Use `getCommitteeFlags` / `sponsorLabel` / `getScoringConfig` / `docName`, which are pure functions of the committee row.
15. **Never treat `isViewOnly` as a permission** — it is a UI gate only. RLS grants full write access to anyone holding the chair suffix.
16. **Never render award UI in a standalone session, and never expose an unpublished nomination to a delegate** — awards are gated on `sessionOrigin === 'conference'` and on the `conference_awards` RLS. See FEATURE: AWARDS.

---

## UI RULES

### RULE: Always use the shared DatePicker for dates
- The native `<input type="date">` (and any other old or native date picker) must **NEVER** be used anywhere in the app.
- **EVERY** date input must use the shared friendly picker `@/components/DatePicker`.
- It takes `value` (ISO `'YYYY-MM-DD'`), `onChange(iso)`, and optional `min` / `max` / `placeholder`, and matches the forest/ivory neumorphic system.

### RULE: Popovers, dropdowns and tooltips must NEVER be clipped
- Any floating layer (menu, dropdown, typeahead list, calendar, tooltip, hover card) must **NEVER** be visually cut off by an ancestor's `overflow` (a rounded `overflow:hidden` card, or a scrollable `overflow-y:auto` panel / modal) or run off the edge of the viewport.
- Render the layer through `@/components/Portal` at **fixed** viewport coordinates computed from the trigger's `getBoundingClientRect()`. Reposition it on `scroll` (capture phase) and `resize`, and close on outside click while accounting for the portaled node.
- Near the right or bottom edge, **flip**: clamp `left` so it stays on screen, and open upward when there is not enough room below.
- Reference implementation: the applications `PaymentMenu` (`src/app/manage/[slug]/applications/page.tsx`). The shared `DatePicker` and `ConferenceRosterPicker` typeaheads follow the same pattern.
- **NEVER** un-clip a popover by loosening a shared card's `overflow` — always fix it at the popover.

### RULE: Informational "i" / hint popups open on HOVER, not click
- Small informational affordances (an "i" or "?" badge, a hint icon, a "what is this" explainer) must reveal their content on **hover** (`onMouseEnter` / `onMouseLeave` with a small close delay so the pointer can travel into the panel), never on click.
- Keep them keyboard and focus accessible (reveal on focus too), and prefer a native `title` for the simplest one-line hints.
- Click-to-toggle is reserved for menus and actions — not for read-only explanations.

### RULE: Long committee names show the ACRONYM, with the full name small beneath
- When a committee's name is long (multi-word / spelled-out), display its **acronym** as the primary, larger label, and put the full spelled-out name in **smaller letters directly beneath it** as a secondary line. Example: "Disarmament and International Security Committee" renders as **DISEC** with "Disarmament and International Security Committee" small underneath.
- Use the shared `committeeDisplayName(fullName, acronym?)` helper in `src/lib/presetNames.ts` to derive the acronym (it collapses long names to an acronym). Prefer an explicit `abbreviation` when the committee has one.
- If the acronym has no meaningful expansion (or the name is already short), just show the name once — no redundant second line.
- Applies everywhere committees render: applications, assignment, committee cards, rosters, overviews.

---

## WORKING RULES — SESSIONS WORK ON `feature/conferences-auth`

### RULE: Never push to production without explicit instruction
- All sessions work happens on **`feature/conferences-auth`**.
- The production deploy branch is `claude/muncommand-recreation-9yjin` (auto-deploys to gavelling.com via Vercel).
- **NEVER** merge into or push to the deploy branch unless Peter explicitly says "push to production" / "deploy this".
- Committing and pushing to `feature/conferences-auth` is fine and expected — that branch does not deploy.

### RULE: Always cross-check against Christian's work
- Christian Galindo (`chrisgalindoh`) owns the conferences layer that shares this branch.
- Before changing any shared surface, check `git log --author=Christian` and `git log -p <file>` for his recent commits on that file.
- Never revert, restructure, or "clean up" conference-side code (`/manage`, `/conferences`, applications, assignment, financials, auth) as a side effect of a sessions change.
- The shared surface between the two workstreams is **the database**. Schema changes must be checked against his migrations before being applied.

### RULE: Always launch agents for tasks
- Every task — investigation, audit, implementation, verification — is delegated to a subagent via the Agent tool.
- Run independent agents in parallel in a single message.
- Implementation agents that touch the same file must be serialized, not parallelized.
- Every implementation is followed by a **verification agent** that independently confirms the change works.
