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
| `committees` | One row per session. Stores phase, caucus (JSONB), settings (JSONB), suspended_at, ended_at, expires_at, resuming_chair |
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
- Right of Reply inserts a delegate at the TOP of speakersList with a custom time override
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
- Motion passes → endDebateInDB sets ended_at + expires_at (now + 72hrs) + phase='adjourned'
- All devices detect via realtime → setSessionEnded(true)
- Both chairs and delegates see: two-tab overlay (🏁 End View + 👁 Session View)
- End View shows: "This committee has ended", countdown in hours until deletion
- Session View: full session visible but READ-ONLY
- pg_cron job runs hourly, deletes committees where expires_at < NOW()

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
- Persisted in localStorage keyed as `chat-read-${committee.code}`
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

### Document limits (Settings → Motions)
- wpSubmissionLimit: number | null (null = unlimited)
- drSubmissionLimit: number | null
- Reset button deletes docs from DB AND removes from local state via onResetDocuments prop

---

## FEATURE: SETTINGS

### Stored where?
- CommitteeSettings stored in Zustand (localStorage), keyed by committee code
- chairJoinSuffix ALSO stored in DB (committees.settings JSONB) so other devices can read it
- On chair page load: DB suffix synced to localStorage via updateSetting

### Chair code system
- separateChairCode: boolean (default true)
- chairJoinSuffix: 4-digit string, generated on committee creation, stored in DB
- Full chair code format: `{code}-{suffix}` e.g. "UNSC2026-4821"
- Only the full chair code with correct suffix grants chair access
- Join page validates suffix against foundCommittee.dbChairJoinSuffix (from DB) — NOT localStorage
- Landing page: if code contains dash with 4-char suffix → auto-routes to chair tab
- Chair code NOT shown in header — only visible in Settings → Access panel

### Settings tabs
- Voting: thresholds (simple/supermajority/consensus), abstentions, veto mode, quorum
- Motions: enabled motion types, motion names (renameable), WP/DR submission limits
- Access: custom session ID, chair code, chair approval, multi-chair, delegation name requirement
- Points: delegate leaderboard with score breakdown

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
- **Delegate**: requires country selection if requireDelegationName is enabled
- **Chair**: requires full chair code with suffix (if separateChairCode enabled), then name selection
- **Faculty Advisor**: read-only observer view, no interaction

### Chair name persistence
- When chair joins with a new name, addChairName() appends it to committee.chair_names[] in DB
- addChairName is idempotent — checks for duplicates before inserting

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
