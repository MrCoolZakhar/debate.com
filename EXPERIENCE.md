# EXPERIENCE.md — How Gavelling Actually Runs a Committee

> **What this is.** A reference for anyone (human or agent) working on Gavelling. It describes
> how a committee runs *as the software actually behaves* — the chair's reasoning and the
> delegate's experience at each step, mapped to the real controls — and it records where the
> software diverges from a real committee room. Consult it before changing behaviour so you
> know what the room expects.
>
> **How it was built.** Five fictional committees were run start-to-finish by separate chairing
> agents (UNSC, DISEC, ECOSOC, a Cuban-Missile-Crisis cabinet, HRC with a full dais), each
> grounded in the source (`chair/[code]/page.tsx`, `delegate/[code]/page.tsx`,
> `voting/[code]/page.tsx`, `MotionsModal.tsx`, `committeeService.ts`, `types.ts`,
> `settingsStore.ts`, `scoring.ts`). Every finding below was re-checked against the code before
> being recorded here. Full transcripts: [`docs/experience-runs/`](docs/experience-runs/).
>
> **Legend.** Verification: `CODE` = confirmed against the exact source; `OBSERVED` = seen in a
> run, not line-pinned; `DESIGN` = a deliberate design choice with real UX consequences (not a
> bug). Severity: High / Medium / Low, judged against a real committee room.

---

## 1. The mental model — room ↔ app

Gavelling digitises the **placard model**: the chair's laptop is the dais, and the chair enters
what the floor does. Delegate phones are for *following along and requesting*, not for driving
procedure.

| In the room | On Gavelling | Who acts |
|---|---|---|
| Chair gavels, runs the GSL, recognises speakers | `/chair/[code]` cockpit | Chair (writes DB directly) |
| Second chair / dais partner | Same code; **earliest-joined = "head chair"**, others **View only** | Head chair owns timer + `current_speaker` |
| Delegate raises placard to speak | **Request to Speak** → chair approves | Delegate asks, chair grants |
| Delegate raises a motion | *No delegate control* — chair keys it in via **Motions** | Chair only |
| Delegate votes on a resolution | *No delegate control* — chair clicks each placard on `/voting` | Chair only |
| Delegate submits a paper | **Documents → Submit** (with optional PDF) | Delegate |
| Faculty advisor observes | `/advisor/[code]` (read-only, can nudge) | FA |

**Consequence to keep in mind:** the chair is the single write-path for all procedure. This is
fine for a 15-seat council and becomes a throughput ceiling for a 30+ delegate GA (see F-Q4).

---

## 2. Phase-by-phase reference

Phases: `pre-session → speakers-list → (moderated-caucus | unmoderated-caucus) → voting → adjourned`.

### 2.1 Creation (`/create`)
Chair sets name, topic, chair name(s), delegate roster (presets like the 15-member UNSC exist),
optional observers. Auto-generates a 6-char CODE + a 4-digit **chair suffix** (full chair code
`CODE-1234`, `separateChairCode` ON by default). Default speaker time 90s. **All delegates start
absent.** Delegates can also be added after creation.

### 2.2 Roll call (pre-session)
The chair screen is the roster with a 3-state slider **Absent → Present → Present-Voting** plus
bulk **Clear All / All Present / All P+V** (these bulk buttons exist *only* in pre-session).
Going absent here does **not** strip anyone from the GSL. **Begin Session** → `speakers-list`;
at that transition, absent delegates are removed from the GSL.
*Delegate view:* with chair-approval OFF, a delegate self-admits by tapping Present/P+V. With
approval ON, they land in a **Waiting Room** and the chair sees an inline Approve/Deny row.

### 2.3 General Speakers' List (GSL)
The permanent list. Chair adds via the **Add Speaker** typeahead; delegates tap **Request to
Speak** → a green banner on the chair screen → **+ Add to GSL** / **Deny**. The current speaker
is a separate row shown as position #1 with flag, big timer, progress bar, and controls:
**Start/Pause · Next · ↺ · +time (15/30/60/custom) · Right of Reply**. **Next** logs the outgoing
speaker's seconds (for scoring/stats) and pops the next delegate in. Speaker-time presets
45/60/75/90. `gslRequireNextSpeaker` disables Start when only one delegate remains.
*Delegate view:* a permanent floor card ("you're up next", "N speakers until you", "you have
the floor"), the live queue, and their own request state.

### 2.4 Motions (chair-entered) — `MotionsModal`
Blocked during pre-session. Delegates cannot raise motions; the chair keys in each one and picks
**Proposed by** (a country or 🪑 Chair). One pending motion per country. Types: Moderated Caucus
(Topic\* + total + per-delegate), Unmoderated Caucus (total), Consultation of the Whole (optional
topic + total), Tour de Table (per-delegate + A→Z / Z→A / **Room Order**), and the red **Suspend
Debate** / **End Debate**. The **Vote on Motions** view ranks by *disruptiveness* (End > Suspend >
the four caucus types by configurable order) and shows a "needs X of Y present" hint. **Accept**
starts the motion immediately; **Reject** deletes it. See F-Q1/Q6 — the hint is cosmetic.

### 2.5 Caucuses
- **Moderated / Tour:** 3.5s loading card → flag + per-speaker timer + total-time bar. Chair adds
  speakers (typeahead or side panel); **max speakers = floor(remaining / perSpeaker)** and adds
  beyond it are blocked. **Next** logs the caucus speaker's seconds. Tour pre-fills the queue in
  the chosen order (Room Order = numbered `Speaker N` placeholders the chair calls manually).
- **Unmoderated / Consultation:** one big countdown + Start/Pause/Extend/End. Consultation adds
  a tap-to-set **delegation board** (who holds the floor) + an optional CoW per-speaker timer.
- **Ending:** the manual **End** button is clean (GSL untouched). **Letting the total clock hit
  0:00 on its own is NOT** — see F-Q2 (High).
*Delegate view:* a dedicated caucus card with the countdown, current speaker, and upcoming queue.

### 2.6 Documents
Delegate submits from **Documents → Submit** (type, title, auto co-sponsors, optional PDF; auto
code WP 1.1 / DR 1/1). Status: `submitted → on-floor → introduced → passed/failed`. Chair's
**Documents** modal → **Introduce** runs a reading/presentation/Q&A flow. **WP auto-passes after
Q&A; DR → `/voting`.** No amendment feature (F-Q9).

### 2.7 Voting on resolutions (`/voting/[code]`, chair-operated)
Roll-call modal (writes attendance to the DB — F-Q7) → pick an introduced DR → chair clicks each
present delegate's **For / For w/Rights / Abstain / Against w/Rights / Against** (observers
excluded) → rights speakers → **result**. Thresholds: simple (For > Against), 2/3 (For ≥ ⅔ of
For+Against), consensus (zero Against, ≥1 For). Veto: p5/custom (any listed country Against →
fail) or unanimous (all present must vote For). Result persists to the DR. Quorum is **not**
checked here (F-Q8).

### 2.8 Suspend / End / Resume
- **Suspend** (motion passes via the Yes/No screen): `suspended_at`, phase `adjourned`; delegates
  get a wait screen. **Resume** = first chair to claim it; everyone returns through **pre-session
  roll call**. GSL/chat/documents survive; caucus queue does not.
- **End Debate**: `ended_at` + `expires_at = now + 1h` (F-Q10 — docs say 72h), read-only End View,
  pg_cron deletes after expiry. No resume.

### 2.9 Settings / scoring / chat / feedback / multi-chair
Settings tabs: Voting (threshold, abstentions, veto mode + lists, quorum), Motions (enable /
**rename** / reorder types, WP/DR limits, GSL "require next", CoW timer), Access (custom code,
chair suffix, **chair approval / waiting room**, multi-chair, name requirement, lock delegate
roll call, disable chat, sponsor label), Points (scoring). Scoring is an objective ledger
(attendance, speeches, speaking-time, motions, RTR, docs) blended with chair quality factors;
`hideScoresFromDelegates` hides the delegate score card. Chat: Everyone + per-chair + per-delegate
threads; FA can nudge. Feedback: chair's private notes + factor scores; delegates see only the
factor "recap". Multi-chair: head chair by presence join-order (F-HRC-1).

---

## 3. Findings register — what doesn't make sense

Ranked by severity. Every High/Medium item was confirmed against source.

> **Resolution status (branch `ui/forest-ivory-redesign`):**
> - ✅ **Fixed** — **H1, H2, M4, M6, M7** (commit `b3b3ed4`) and **H5** (commit `e8f8109`).
> - ➖ **Accepted as-is** (working as intended per product owner) — **H3, H4, M2, M3, M5, L1**, and the crisis-primitives gap.
> - 📝 **Elaborated, not yet implemented** — **M1, M8, M9, L2, L3, L4, L5, L6**.
> Individual rows below are left as originally written (describing the pre-fix behaviour); see this banner for current state.

### High

| ID | Finding | Where | Ver. |
|---|---|---|---|
| **H1** | **Caucus/Tour auto-expiry corrupts the permanent GSL.** When a moderated caucus or Tour's total clock reaches 0:00 *on its own* while a delegate is mid-speech, that speaker is prepended into the GSL (`reorderSpeakersListInDB(..., 'gsl')`). For Room-Order Tour it injects a literal `Speaker N` placeholder. The **manual End** button (and Next-at-time-up) is clean. Same caucus, two different outcomes; the corrupting one is the passive path a distracted chair is most likely to hit. Violates the codebase's own #1 rule (GSL/caucus strictly separate). | tick: `chair/[code]/page.tsx:1435`; clean End: `:1895` | CODE |
| **H2** | **Extra time can erase a real speech from scoring.** `secondsSpoken = timeLimit − timeRemaining`; `+time` pushes `timeRemaining` above the limit, so a speaker granted extra time who yields early logs ≤ 0, and the `> 0` guard (plus `logSpeakingTime`'s own `<= 0` guard) drops the entire speech — no stats, no score, no warning. It punishes exactly the strong speeches chairs extend time for. | `chair/[code]/page.tsx:1737`; guard in `committeeService.ts` `logSpeakingTime` | CODE |
| **H3** | **Caucus/procedural motions are never actually tallied, and the "needs X of Y" hint is fake.** The threshold hint is hardcoded (`consultation/tour = 2/3`, others = simple) and ignores the committee's configured `substantiveThreshold`; Accept/Reject is a pure chair click. Only Suspend/End Debate get a real "Does this motion pass? Yes/No" gate — the asymmetry runs backwards (rare motions gated, constant ones not). | `MotionsModal.tsx:50` (`requiredVotes`), `:869`, `:1004` | CODE |
| **H4** | **The voting-screen roll call rewrites main-session attendance.** Its sliders call the same `setDelegateStatusInDB` write path as the session roll call, so "checking who can vote" silently overwrites the canonical roster (which then gates GSL/quorum). No scoping, no warning. | `voting/[code]/page.tsx:478` | CODE |
| **H5** | **"Head chair" is decided purely by presence join-order, with no assignment or hand-off UI.** Earliest `joinedAt` on the presence channel wins; ~everything write-related is gated behind the resulting `isViewOnly`. A wifi blip/reconnect (fresh, later `joinedAt`) can silently transfer or freeze the gavel with only a passive banner change. Unlike Resume, there is no "claim chair" control. | `chair/[code]/page.tsx:1374` | CODE |

### Medium

| ID | Finding | Where | Ver. |
|---|---|---|---|
| **M1** | **Quorum is never enforced on the voting screen.** Quorum gates GSL actions only; a resolution can pass with 3 of 24 present — the highest-stakes action is the one place quorum doesn't apply. | quorum computed only in `chair/[code]/page.tsx`; absent from `voting/[code]/page.tsx` | CODE |
| **M2** | **No amendment mechanism.** Documents are WP/DR only; every revision or WP→DR merge is a brand-new, unlinked document. Most damaging for consensus bodies, whose whole process is amendment/redline. | `types.ts:73` (`DocumentType`) | CODE |
| **M3** | **End Debate expiry is 1 hour in code**, not the 72h stated in AGENTS.md (Suspend uses 24h) — three different numbers. A session (chat, docs, scores) can be deleted before a same-day debrief. | `committeeService.ts:882` | CODE |
| **M4** | **Accepting one caucus motion silently deletes all other pending motions** (`pendingMotions: []` + `clearPendingMotionsInDB`) with no signal to the losing proposers — indistinguishable from a rejection, and delegates have no motions view at all. | `MotionsModal.tsx:891`+ | CODE |
| **M5** | **Delegates can't raise motions or vote from their device.** Every motion and ballot is chair-entered; the chair is a single-threaded transcription service. Defensible for a small council, a real bottleneck at GA scale (no delegate "raise motion" request analogous to the GSL request that already exists). | delegate page has no motion/vote controls (`delegate/[code]/page.tsx:1396`) | CODE / DESIGN |
| **M6** | **Room-Order Tour de Table blinds the floor and breaks scoring.** The queue shows `Speaker N` with no name mapping (delegate floor cards go dark), and **speaking time logs to the placeholder country**, so an entire round earns no per-delegate credit. | log uses `currentSpeaker.country` (= "Speaker N") in `handleNextCaucusSpeaker` | CODE |
| **M7** | **Renamed motion types are chair-side only.** Custom names (e.g. "Directive Debate") render only on the dais; the delegate/advisor views use the default/localised names and never show `caucus.motionLabel`. Half the room never sees the committee-flavour feature. | delegate `phaseDisplay` uses defaults `delegate/[code]/page.tsx:869`; caucus card shows generic label | CODE |
| **M8** | **Floor-visibility gaps.** Quorum blocks, the caucus max-speakers cap, and the Consultation floor-holder are visible only to the chair. A delegate below quorum or shut out of a full caucus sees only a hung request with no explanation; a hybrid/virtual delegate in a Consultation gets no "who has the floor" signal. | e.g. `caucusMaxReachedMsg` chair-only; CoW board is chair-tap | OBSERVED |
| **M9** | **Presence is entirely chair-asserted.** Nothing links "a device is connected" to "seat is present", so the chair can cast a veto-decisive placard for a seat no human occupies, with no "this vote will veto" signal at click time (the veto only surfaces as the final result). | `voting/[code]/page.tsx:343` (veto), chair-driven placards | CODE/DESIGN |

### Low

| ID | Finding | Where | Ver. |
|---|---|---|---|
| **L1** | **Right of Reply never touches the GSL** — it runs a standalone overlay timer + a score event. Behaviour is arguably *correct* (a reply isn't a queue slot), but AGENTS.md explicitly claims RTR "inserts a delegate at the TOP of speakersList." Fix the doc. | `chair/[code]/page.tsx:2806`; doc claim in AGENTS.md | CODE |
| **L2** | **"Vote Again" is all-or-nothing** — no way to fix a single misrecorded placard; correcting one vote means re-clicking the whole round (and re-opens every vote to change). | `voting/[code]/page.tsx` `startNewVote` | OBSERVED |
| **L3** | **`hideScoresFromDelegates` flips with no notice** — the delegate's score card just vanishes, reading as a bug rather than a chair choice. | delegate Stats tab render | OBSERVED |
| **L4** | **Suspend/Resume forces the whole room back through roll call** — right for a formal committee, too heavy for a continuous-crisis recess ("reconvene" should keep the roster). | `startResumeRollCall` → `pre-session` | CODE |
| **L5** | **Delegate self-status is rate-limited to 3 changes / 3h.** A volatile character who repeatedly leaves and returns can exhaust it; the chair can still re-seat them, but the delegate can't self-serve. | `delegate/[code]/page.tsx` rate-limit helpers | CODE |
| **L6** | **Default `motionOrder` ranks Unmoderated above Moderated** — a debatable default that surprises chairs (configurable). | `settingsStore.ts:98` | CODE |
| **L7** | **Manual score awards lack a structured/timestamped audit** visible to delegates — fine for a solo chair, a "why did they get that?" mystery in a co-chaired or large committee. | scoring ledger `manual-award` | DESIGN |
| **L8** | **Join-requests/GSL-requests are stored as motions but surfaced in the roll-call/banner UI, while the Motions tab is blocked in pre-session** — a one-time "where do I click" confusion. | `getCommitteeByCode` motions query; pre-session gate | DESIGN |

### Structural / by-design (not bugs, but shape the tool's limits)

- **No crisis primitives (High *for crisis committees*).** No updates/news feed, no per-delegate
  private-info channel, no directive object. A crisis director must smuggle every update through
  Everyone-chat and every directive through the DR/voting flow. Gavelling is a parliamentary
  engine; continuous crisis is the format it fits worst. *(Crisis run, NEW#1.)*
- **The single-chair write-path doesn't scale linearly** — attendance, GSL approvals, every
  motion, and every placard vote are sequential solo actions; no batch-approve, no delegate-side
  parallelism. *(DISEC run, NEW#3/4.)*
- **Delegate↔delegate DMs are invisible to the chair/FA** — correct for privacy, but a gap vs.
  the "chair sees the whole room" mental model (bloc-building happens off-dais). *(HRC run, F8.)*

---

## 4. Cross-cutting themes for anyone changing this code

1. **Silent failures dominate the High list.** H1, H2, H4 all *succeed quietly* and produce
   wrong data a chair only catches by auditing logs. Prefer clamping/guarding with a visible
   signal over silent drops or silent writes.
2. **Two code paths for "the same thing" drift apart.** H1 (auto-expiry vs manual End) and H4
   (voting roll call vs session roll call reusing the same write) are both "second path does
   something the first doesn't." When you fix H1, make auto-expiry call the manual-End logic.
3. **The floor is under-informed.** M8/M9 recur across every run: the chair sees gates and caps
   the delegates don't. Any chair-only guard is a candidate for a delegate-facing echo.
4. **Doc/code drift erodes trust.** L1 (RTR) and M3 (expiry) are cases where AGENTS.md describes
   behaviour the code doesn't have. Treat AGENTS.md's RTR and 72h claims as stale.
5. **Real MUN assumes delegate agency; Gavelling centralises it.** M5/M6/M7 and the crisis notes
   all stem from the same root: delegates can request but not *act*, and committee flavour
   (renames, directives, amendments) lives only on the dais.

---

## 5. The five committee runs

| # | Committee | Focus / features stressed | File |
|---|---|---|---|
| 1 | UN Security Council | P5 veto, waiting room, RTR, suspend/resume, WP→DR, veto sinks a majority DR | [01-unsc-security-council.md](docs/experience-runs/01-unsc-security-council.md) |
| 2 | UNGA DISEC (large) | 32 seats, below-quorum gating, GSL stampede, Tour A→Z, WP merge, 2/3 vote, single-chair bottleneck | [02-disec-general-assembly.md](docs/experience-runs/02-disec-general-assembly.md) |
| 3 | ECOSOC (consensus) | Consultation of the Whole + board + CoW timer, custom scoring/blend, hide-scores, feedback/recap, consensus vote | [03-ecosoc-consultation.md](docs/experience-runs/03-ecosoc-consultation.md) |
| 4 | Cuban Missile Crisis cabinet | Room-Order Tour, custom veto, observers, late joins, heavy RTR, caucus run to expiry, no-crisis-primitives | [04-crisis-cabinet.md](docs/experience-runs/04-crisis-cabinet.md) |
| 5 | UN Human Rights Council (full dais) | Multi-chair head/view-only, FA nudges, heavy chat, two rival DRs + separate votes, scoreboard, end lifecycle | [05-hrc-multichair.md](docs/experience-runs/05-hrc-multichair.md) |

*No source code was changed in producing this document or the runs. Findings are grounded in the
source files listed at the top and re-verified before recording.*
