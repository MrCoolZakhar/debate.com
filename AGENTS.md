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
- The subscription callback checks `Date.now() - localUpdateTime.current < 3000`
- Within debounce: ONLY syncs pendingMotions and session state. Returns early for speakers_list and delegates events.
- Outside debounce: full setCommittee(updated) from DB
- **TIMER TICKS MUST NEVER SET localUpdateTime** — or delegate views lose visibility
- **NEVER set structural=true on timer tick operations**
- caucus queue mutations DO use structural=true (to prevent realtime flickering)

### RULE 5: Optimistic Updates Pattern
- ALL chair actions use `updateLocal(setCommittee, updater)` for immediate UI response
- DB writes are fire-and-forget — never await them for UI updates
- The pattern is: updateLocal first → DB write second (fire-and-forget)
- Exception: when you need the real DB UUID back (e.g. addPendingMotionInDB returns real ID)

### RULE 6: current_speaker subscription is SKIPPED
- The subscription callback immediately returns for `current_speaker` table events: `if (table === 'current_speaker') return;`
- The chair owns current_speaker entirely — no re-fetch needed
- Co-chairs get current speaker state via the full committee fetch when other events fire

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
- The "isLastGSLSpeaker" guard prevents starting timer when only 1 delegate is on list (to ensure queue never empties mid-session)
- Extra time (+⏱) adds seconds to speakerTimeRemaining only — no DB write until pause/next
- Right of Reply is a fully INDEPENDENT fixed overlay with its own `rtrTimeRemaining` state (`chair/[code]/page.tsx:1284-1288, 3148-3206`). It NEVER writes `speakersList` — it does not insert the delegate into the GSL, and it does not touch `currentSpeaker`. It logs a `right-of-reply` scoring event (`:3174`) and nothing else. (This line previously claimed RTR inserted at the top of speakersList with a time override; that was verified false against the code.)
- speakersList display in main view prepends currentSpeaker as position 1 (gslDisplayList)

### DB operations
- `addToSpeakersList` — inserts to speakers_list with list_type='gsl'
- `removeFromSpeakersList` — deletes from speakers_list where list_type='gsl'
- `reorderSpeakersList` — delete all gsl entries + reinsert in new order
- `nextSpeaker` — updates current_speaker row, optionally removes a delegate from speakers_list
- `startSpeakerTimer` — sets started_at timestamp
- `stopSpeakerTimer` — clears started_at

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
- Max speakers = Math.floor(remainingTime / speakingTime) — stable, computed from caucus.remainingTime not live tick
- When max is reached: flash amber message for 6 seconds, do NOT block adding (informational only)

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
- Accept → handleMotionAccepted → starts caucus / suspend / end debate
- Reject (✗) → handleRemove → deletes motion from DB
- Suspend/End Debate → shows "Does this motion pass?" Yes/No screen
- Yes → calls suspendDebateInDB or endDebateInDB, removes motion from DB FIRST (await), then fires DB state change

### Rules
- Motions are stored with temp IDs optimistically (`temp-${Date.now()}`)
- addPendingMotionInDB returns the real UUID → handleRaised replaces temp ID with real ID
- pendingIds (Set) tracks which motions still have temp IDs → Reject button disabled while pending
- handleRemove MUST use the real UUID for removePendingMotionInDB to work
- The Reject button is disabled while the motion's ID is still a temp ID (pendingIds.has(m.id))
- When motion is rejected from VotingView: removePendingMotionInDB fires, co-chairs see it via realtime
- suspend-debate and end-debate motions: await removePendingMotionInDB BEFORE calling suspendDebateInDB/endDebateInDB to prevent race conditions
- On chair page load: stale suspend-debate/end-debate motions are auto-deleted

---

## FEATURE: SUSPEND DEBATE

### How it works
- Motion passes → suspendDebateInDB sets suspended_at + phase='adjourned' in DB
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

### Rules
- ONLY clear suspended_at by setting phase back to pre-session via startResumeRollCall
- Roll call on resume: going absent DOES NOT remove delegates from GSL (phase='pre-session' guard in handleStatusChange and RollCallPanel.cycleStatus)
- When "Begin Session" is clicked after resume roll call (pre-session → speakers-list): absent delegates are removed from GSL at that moment only
- speakersList is PRESERVED through suspend/resume cycle
- caucusQueue is NOT preserved (it's cleared with phase change)
- Chat, documents, messages — ALL preserved through suspend/resume

---

## FEATURE: END DEBATE

### How it works
- Motion passes → endDebateInDB sets ended_at + expires_at (**now + 1 hour**) + phase='adjourned' (`committeeService.ts:1096`). MotionsModal's optimistic mirror uses the same 1 hour (`MotionsModal.tsx:1376`) — if one is ever changed, change both.
- All devices detect via realtime → setSessionEnded(true)
- Both chairs and delegates see: two-tab overlay (🏁 End View + 👁 Session View)
- End View shows: "This committee has ended" + a countdown computed from `expires_at`, not a fixed promise — `Math.max(1, ceil(ms/1h))` (`chair/[code]/page.tsx:2092`, `delegate/[code]/page.tsx:894`) rendered through `session_hours_until_delete`. With the 1-hour window it reads "1 hour until committee is deleted"
- Session View: full session visible but READ-ONLY
- pg_cron job runs hourly, deletes committees where expires_at < NOW() — so with the 1-hour window an ended committee is really gone 1–2 hours after the gavel

### Read-only rules (when sessionEnded=true)
- Hide: Motions button, Documents button, Chat button (header)
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
- These buttons update localStatuses immediately (optimistic) AND call setDelegateStatusInDB
- Absent during roll call does NOT remove from GSL (isRollCallPhase guard)
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

### Architecture
- ChatPanel receives: committee, senderName, isChair, onClose, speakerCard?, initialReadCounts, onReadCountsChange, readOnly?
- senderName for chairs = myChairName (from URL param ?chairName=) NOT committee.chairNames[0]
- myChairName is read from useSearchParams() on the chair page
- Conversations: Everyone (public), individual chairs (🪑), individual delegates (flag)
- NO "Chairs" group thread — was removed. Each chair has their own individual thread.

### Notification rules
- chatReadCounts: Record<string, number> — lifted to parent pages (chair + delegate)
- Persisted in localStorage under a **per-reader** key built by `chatReadStorageKey` in `src/lib/chatReadKey.ts:33`: `chat-read-${code}-${role}:${identity}` (e.g. `chat-read-ABC123-chair:Alice`). `role` is `'chair' | 'delegate'`, `identity` is `myChairName` for a chair and `country` for a delegate; a reader with no identity falls into the `~anon` bucket. Role is in the key on purpose — a chair may be named "France" while a delegate represents France.
- The old shared `chat-read-${code}` key made two chairs on one dais laptop (or a chair who also opens the delegate view) overwrite each other's read state and resurrect already-read badges. **NEVER** go back to a key without the reader identity in it.
- Both pages go through `loadChatReadCounts` / `saveChatReadCounts` (`chatReadKey.ts:66, 77`) — `chair/[code]/page.tsx:2108, 2115` and `delegate/[code]/page.tsx:851, 858`. Do not rebuild the key inline.
- **Legacy migration, still live**: when this reader has no entry yet, `loadChatReadCounts` adopts the pre-identity `chat-read-${code}` value (`legacyChatReadStorageKey`, `:39`) — copied forward, not moved. Orphaning it would give every existing user one burst of phantom unread covering the whole backlog. The legacy key is never written again, and from the first save onward the two identities diverge into their own keys.
- Loaded on committee load, saved whenever chatReadCounts changes
- Own messages NEVER count toward unread badges
- Badge clears immediately when conversation is opened
- Badge count = received messages (sender !== senderName) - readCounts[convKey]

### Optimistic sends
- Messages appear instantly via localMessages state
- sendMessageToDB is fire-and-forget (no await)
- localMessages cleared when real message arrives (matched by sender + content + recipient)
- Draft threads: created when new DM started with no messages yet
- Draft thread disappears if user navigates away without sending
- Draft thread cleared via useEffect when real conversation appears in conversations list (not in handleSend)

### DM picker
- Shows all non-absent delegates + all chairs (except self)
- No scroll limit (slice removed)
- Max-h-64 for dropdown
- Enter key or click selects recipient

---

## FEATURE: DOCUMENTS (Working Papers + Draft Resolutions)

### Chair view (DocumentsModal)
- Two tabs: Working Papers | Draft Resolutions
- Each doc has status: submitted → on-floor → introduced → passed/failed
- "Introduce" button starts a presentation flow: setup timers → reading → presentation → Q&A → vote/auto-pass
- WP auto-passes after Q&A. DR goes to /voting/[code] page
- Reading time: timer on left, PDF on right (screen share mode)
- PDF inline viewer in doc cards (toggle show/hide)

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
- `requireDocApproval` (default false). Read in `DocumentsModal.tsx:856`; when on, each doc card gets an approve/reject control and `CommitteeDocument.approval` gates introduction.

### Document limits — LEGACY, NO UI
- `wpSubmissionLimit` / `drSubmissionLimit` still exist on `CommitteeSettings` and are still ENFORCED on submit (`DocumentsModal.tsx:469`), but **nothing writes them** — the Settings UI and the `onResetDocuments` Reset button no longer exist anywhere in `src/`.
- In practice they are always `null` (unlimited) unless an old committee row still carries a value in its settings JSONB.

---

## FEATURE: SETTINGS

### Stored where? — DB IS THE SOURCE OF TRUTH ON WRITE, localStorage IS A STALE MIRROR
- The `upd` helper in `SettingsPanel.tsx:390-394` does BOTH on every single change:
  1. `updateSetting(code, key, value)` → Zustand `persist` store (`localStorage: gavelling-settings`), keyed by committee code
  2. `saveCommitteeSettings(committee.id, { ...getSettings(code), [key]: value }, ...)` → writes the **complete settings object** into the `committees.settings` JSONB (`committeeService.ts:227-236`, read-merge-write so `chairJoinSuffix` / `headChair` survive)
- Scoring is written separately by `updScoring` → `updateCommitteeScoringInDB` (`committeeService.ts:991`), into `settings.scoring`.
- `rowToCommittee` (`committeeService.ts:76-83`) surfaces the blob as `committee.dbSettings` plus the convenience fields `dbChairJoinSuffix`, `dbHeadChair`, `dbSeparateChairCode`, `dbScoring`.
- The voting page writes the same way (`voting/[code]/page.tsx:503-508`).

### The READ side is the gap — this is where the real bugs come from
| Surface | Hydrates the store from `dbSettings`? |
|---------|----------------------------------------|
| `/chair/[code]` | **Once**, in the initial loader (`page.tsx:1291-1295`). Never again — no re-hydrate in the realtime subscription, so a co-chair's setting change never reaches this device's store |
| `/voting/[code]` | **Once**, in the loader (`page.tsx:335-338`) |
| `/delegate/[code]` | **NEVER** |
| `/advisor/[code]` | **NEVER** (does not import `useSettingsStore` at all) |
- Both hydrate paths destructure away `chairJoinSuffix` and `separateChairCode` and merge everything else — including `headChair` — into the store.
- **ALWAYS** read a setting on a non-chair surface with the pure-function-of-the-committee-row pattern: `getCommitteeFlags(committee)` / `sponsorLabel(committee, fallback)` in `src/lib/committeeFlags.ts`, `getScoringConfig(committee)` in `src/lib/scoring.ts:31`, `docName(committee, ...)` in `src/lib/docNames.ts`. These read `committee.dbSettings` / `committee.dbScoring` and never touch localStorage.
- **NEVER** call `getSettings(code)` on the delegate or advisor pages — the store is empty there and you silently get `DEFAULT_SETTINGS`.
- Residual instance, **dead code, not a live bug**: `delegate/[code]/page.tsx:930` calls `getSettings(committee.code)` and `:939` builds `enabledMotionTypes` from it — but `enabledMotionTypes` is referenced nowhere (verified: the identifier appears only at its own declaration). Left over from the removed delegate Motions tab. Delete both; that removes the delegate page's last `useSettingsStore` dependency, which is the correct end state. Do **not** "fix" it by rewiring it to `dbSettings` — there is no consumer to fix.

### Chair code system
- `chairJoinSuffix`: 4-digit string, generated at committee creation (`committeeService.ts:100`) and stored in `committees.settings`.
- `SettingsPanel.tsx:415-425` regenerates it **only** when the store copy is `''`, and otherwise re-syncs the existing one to the DB via `updateCommitteeChairSuffixInDB`.
- Full chair code format: `{code}-{suffix}` e.g. "UNSC2026-4821".
- Join page validates against `foundCommittee.dbChairJoinSuffix` (from DB), falling back to localStorage only if the DB value is missing (`join/page.tsx:281`).
- Landing page: if code contains dash with 4-char suffix → auto-routes to chair tab.
- Chair code NOT shown in header — only visible in Settings → Access panel.
- The suffix is also the **only** write credential: `sessionClient(code, suffix)` sends it as the `x-chair-suffix` header and RLS checks it (see FEATURE: CHAIR ROLES).
- `separateChairCode` is **not** a `CommitteeSettings` field. It is written literally as `true` at create time (`committeeService.ts:108`), surfaced as `dbSeparateChairCode`, read by no code, and explicitly stripped on hydrate. Do not build on it.

### Settings tabs — actual order from the `tabs` array (`SettingsPanel.tsx:427-432`)
Default open tab is **`access`** (`SettingsPanel.tsx:387`).

| Tab | Contents |
|-----|----------|
| Access | session code, chair code, head-chair claim ("Take the gavel"), `requireChairApproval`, `sponsorLabel`, `lockDelegateRollCall`, `disableChat`, `gslRequireNextSpeaker` |
| Motions | drag-reorder + rename + enable/disable of the four caucus motions (`motionOrder`, `motionNames`), CoW timer toggle, rename-only Suspend/End Debate, Documents (`requireDocApproval`, `documentNames`) |
| Voting | `substantiveThreshold`, `allowAbstentions`, `vetoMode` + `p5Delegations` / `vetoCountries`, `quorumThreshold` |
| Points | scoring config — sources, factors, factor scale, score blend, hide-scores toggle |

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
| `gslRequireNextSpeaker` | blocks Next while only one delegate remains on the GSL, so the queue never empties mid-session | `chair/[code]/page.tsx:1820, 2659, 2674` |
| `chairJoinSuffix` | 4-digit chair code AND the RLS write credential | join page + `sessionClient` |
| `requireChairApproval` | delegates must be approved by a chair before joining the floor | `delegate/[code]/page.tsx:931, 995, 1068` (via `getCommitteeFlags`) |
| `sponsorLabel` | overrides the visible word "Sponsors" ('' → translated default) | `sponsorLabel()` in `committeeFlags.ts`, used by delegate/voting/DocumentsModal |
| `lockDelegateRollCall` | delegates cannot change their own Present / Present-Voting status | `delegate/[code]/page.tsx:1432` |
| `disableChat` | hides chat for delegates AND chairs | `chair/[code]/page.tsx:2385`, `delegate/[code]/page.tsx:1020` |

### `scoring` sub-object (`ScoringConfig`, defaults in `settingsStore.ts:34-53`)
Persisted into `settings.scoring`; read everywhere via `getScoringConfig(committee)` — never via localStorage.
- `sources` — `ScoreSource[]` (id, name, value, enabled, builtin). Nine built-ins (attendance, gslSpeech, caucusSpeech, speakingTimePer10s, motionRaised, rightOfReply, wpSponsor, drSponsor, drPassed); chairs can edit values, disable any, and add custom ones. Disabled → the ledger row is omitted entirely.
- `factors` — `RankingFactor[]`, the subjective per-speech qualities chairs rate (Diplomacy, Public Speaking, Collaboration, Content & Research by default).
- `factorScaleMax` — upper bound of the factor rating scale (default 100).
- `scoreBlend` — 0 = pure objective points … 100 = pure subjective quality. Consumed by `computeHeadline` (`ScoreboardPanel.tsx:63`).
- `hideScoresFromDelegates` — default false; when true the delegate Stats tab hides scores (`delegate/[code]/page.tsx:424`).

---

## FEATURE: CHAIR ROLES & THE GAVEL (head chair vs view-only co-chair)

### Chair identity
- A chair's identity is **only** the `?chairName=` URL query param: `const myChairName = searchParams.get('chairName') ?? ''` (`chair/[code]/page.tsx:1160`).
- There is no session, no cookie and no DB row identifying a chair. The name is typed on the join page, appended to `committees.chair_names[]` by `addChairName`, and carried in the URL from then on.
- Everything downstream (chat sender, feedback author, gavel comparison) keys off that string.

### The gavel (head chair)
- Stored as `headChair` **inside the `committees.settings` JSONB**. It is NOT a column — the `committees` table has `resuming_chair` but no `head_chair`.
- Written by `updateCommitteeHeadChairInDB` (`committeeService.ts:975-987`), which read-merges the existing settings blob so it does not clobber `chairJoinSuffix`.
- Read back as `committee.dbHeadChair` (`committeeService.ts:80`).
- Claim-at-will — any chair may take it, from two places:
  - the join page, by picking the "head chair" role (`chairRole` defaults to `'co'`) → `join/page.tsx:256` (conference session) and `join/page.tsx:290` (anonymous session)
  - Settings → Access → "Take the gavel" → `onBecomeHeadChair` (`chair/[code]/page.tsx:2813-2817`)
- Taking the gavel flips the previous holder to view-only via the realtime `committees` refetch.

### Role derivation (client-side, `chair/[code]/page.tsx:1449-1456`)
```
const head = committee?.dbHeadChair || committee?.chairNames?.[0] || myChairName || null;
setIsViewOnly(!!myChairName && !!head && head !== myChairName);
```
- Unset `headChair` → the committee creator (`chairNames[0]`) holds it.
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
- **`FeedbackLogPanel` is rendered ONLY when `isViewOnly` is true** (`chair/[code]/page.tsx:2780-2786`) — the live feedback dock is a co-chair-exclusive surface. Do not "restore" it for the head chair without being asked.
- Realtime behaviour differs and must stay that way:
  - a view-only co-chair DOES process `current_speaker` events (patched via `getCurrentSpeakerRow`), the head chair returns early — it owns that row (`:1318-1320`)
  - a view-only co-chair NEVER debounces (`withinDebounce = !isViewOnlyRef.current && …`, `:1360`) — it writes nothing, so debouncing would make it miss the head chair's phase/caucus changes
  - a view-only co-chair always takes the fresh row rather than pinning live timer state (`:1407`)
  - a view-only co-chair does not run the caucus clock (`:1492`) — it would refresh the debounce every second and write a phase it does not own

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
- Absent delegates must request to join via AbsentBanner (join request → chair approves)
- Going absent sends a join-request motion to the chair

---

## FEATURE: JOIN PAGE

### Modes
- **Delegate**: country selection is always required in the anonymous flow. In a conference-linked session the country comes from the delegate's allocation instead (`?country=…&locked=1`)
- **Chair**: name selection (existing name or new), plus the chair code — validated against `foundCommittee.dbChairJoinSuffix`, falling back to localStorage only when the DB value is missing (`join/page.tsx:281`). Conference chairs skip the code; access was already verified against the conference records
- **Faculty Advisor**: read-only observer view, no interaction

### Chair name persistence
- When chair joins with a new name, addChairName() appends it to committee.chair_names[] in DB
- addChairName is idempotent — checks for duplicates before inserting

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

- Separate page from main session
- Accessed when DR is introduced and presentation flow completes
- Shows delegates one by one: In Favour / In Favour with Rights / Abstain / Against with Rights / Against
- Rights speakers handled in sequence after all votes
- P5 veto mode: one P5 Against = failed
- Unanimous mode: all P+V must vote For
- Result shown with pass/fail, vote counts
- "Vote Again" button resets for another round
- "Back to Session" panel: option to raise Motion to Suspend Debate

---

## COMPONENT: RollCallPanel

### Props that matter
- `isRollCallPhase`: true during pre-session. Controls: show All P/PV/Clear buttons, suppress GSL removal on absent
- `isReadOnly`: true when session ended. Makes status sliders non-interactive.
- `onListIds`: Set of delegateIds currently on the relevant list (GSL or caucus)
- `onReorderList`: callback for drag-to-reorder in queue view

### Internal state
- `localStatuses`: Record<string, DelegateStatus> — optimistic status overrides
- `localStatuses` resets on committee.id change
- All three bulk handlers (handleAllPresent, handleAllPresentVoting, handleClear) flush localStatuses atomically

### Queue view
- queuePositionMap: currentSpeaker → 1, speakersList[0] → 2, etc.
- finalQueueOrdered: currentSpeaker prepended to top
- Position 1 + currentSpeaker → amber 🎙 badge
- All other positions → brown number badge

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
12. **Never let `headChair` ride along when the settings store is written back to the DB** — the chair and voting loaders hydrate the whole `dbSettings` blob (minus `chairJoinSuffix`/`separateChairCode`) into Zustand, and `SettingsPanel`'s `upd` / the voting page's `applyRule` then POST `{ ...getSettings(code), [key]: value }` back. A `headChair` hydrated at page load is stale the moment another chair takes the gavel, and writing it back silently reverts the gavel to the earlier holder. Strip it on hydrate or exclude it from the write — never both-ways it.
13. **Never regenerate `chairJoinSuffix` when the DB already has one** — it is the ONLY write credential (`x-chair-suffix` → `is_session_chair`) and the code every chair typed on the join page. Overwriting it locks every chair out of a live committee. `SettingsPanel.tsx:415-425` generates one only when the store copy is `''`; keep that guard.
14. **Never read a setting via `getSettings(code)` on the delegate or advisor pages** — neither page ever hydrates the store, so it silently returns `DEFAULT_SETTINGS`. Use `getCommitteeFlags` / `sponsorLabel` / `getScoringConfig` / `docName`, which are pure functions of the committee row.
15. **Never treat `isViewOnly` as a permission** — it is a UI gate only. RLS grants full write access to anyone holding the chair suffix.

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
