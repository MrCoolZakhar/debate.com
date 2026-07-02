# Experience Run 01 — UN Security Council: The Situation in the Red Sea Shipping Corridor

**Format:** Simulated live run of a single fictional committee on Gavelling, narrated from the chair's seat.
**Purpose:** Stress-test the platform's real-time committee-management surface against real UNSC procedure and surface every place the software and the room disagree.
**Grounding:** All control names, state transitions, and code behavior below are taken from `/private/tmp/.../BRIEFING.md` (ground truth read directly from source) and confirmed against `src/app/chair/[code]/page.tsx`, `src/lib/committeeService.ts`, `src/lib/settingsStore.ts`, `src/components/MotionsModal.tsx`, and `src/app/voting/[code]/page.tsx` where a claim needed double-checking. No code was changed to produce this document.

---

## 1. Committee card

| Field | Value |
|---|---|
| Committee name | **UN Security Council** |
| Topic | **The Situation in the Red Sea Shipping Corridor** |
| Size | 15 members: United States, United Kingdom, France, China, Russia (P5) + Denmark, Greece, Pakistan, Panama, Somalia, Bahrain, Colombia, DR Congo, Latvia, Liberia (10 elected) |
| Chair mode | Single chair (no co-chair) — I am the only device writing to `current_speaker` |
| `vetoMode` | **`p5`** — `p5Delegations` left at the Gavelling default `['China','France','Russia','United Kingdom','United States']`, which happens to be exactly my P5 anyway |
| `substantiveThreshold` | **`simple`** — real UNSC is 9-of-15 with no P5 veto cast against, which is closest to "simple majority + veto gate" of the three options Gavelling ships (simple / supermajority-2-3 / consensus) |
| `quorumThreshold` | **`1-3`** — realistic UNSC quorum is low; I picked 1/3 so the room doesn't stall if a few delegations are momentarily absent |
| `requireChairApproval` | **ON** — this is the "waiting room": new joiners sit in a pending queue as `join-request` motions until I click Approve |
| `allowAbstentions` | ON (default) — P5 abstention theatre is part of the point of this committee |
| Chair suffix | Auto-generated 4-digit suffix appended to the 6-char code (`separateChairCode` ON by default) — the only way in as chair is `CODE-1234` |
| Default speaker time | 90s on GSL (left at default) |

**Why these settings:** A UNSC simulation is only interesting if the veto is live and the room has to actually be admitted rather than trusting a link. `p5` veto against the "simple" substantive threshold reproduces the real dynamic — a resolution can clear 9/15 easily and still die to one Against vote from a P5 seat. Chair approval was switched on specifically to exercise the waiting-room flow the briefing calls out, and because a crisis-flavoured 15-seat council is exactly the kind of "controlled door" scenario where a chair wants to vet who's claiming to be "Russia" before handing them the floor.

---

## 2. Chronological run log

### 2.1 Creation

I go to `/create`. Name: **UN Security Council**. Topic: **The Situation in the Red Sea Shipping Corridor**. I pick the UNSC 15-member preset roster rather than typing 15 names by hand — it's already in the right P5/elected shape. I set my chair name to "Chair Adaeze M." (I'll use `?chairName=` on the URL going forward — the app tells me this is how my chat messages get attributed, not `committee.chairNames[0]`, so I make a mental note to always join through the same link with that param).

Gavelling mints a 6-character code — say `RSC7QK` — and a 4-digit chair suffix, `4821`. Full chair code: `RSC7QK-4821`. `separateChairCode` is on by default, which I keep: I don't want a delegate who guesses the plain code to accidentally land on the chair dashboard.

Every one of the 15 delegates starts **absent**. The committee is created in `pre-session` phase automatically — this **is** the roll call screen, there's no separate step.

Before delegates arrive I pop into **Settings** and set: Voting tab → threshold `simple`, veto `p5`, quorum `1-3`; Access tab → toggle **chair approval / waiting room ON**. I leave motion types, WP/DR limits, and scoring at defaults — I want to see the platform's out-of-the-box defaults survive a real session, not a hand-tuned one.

### 2.2 Roll call — and the waiting room bites immediately

I share `RSC7QK` (delegate link) and separately DM the chair link with the suffix to my co-chair-in-spirit (there isn't one today, single-chair run).

**Delegate experience — the United States delegate (Jordan, on his phone in the hallway):** he opens the join page, picks Delegate, selects "United States" from the roster, and because `requireChairApproval` is ON, submitting the join form doesn't just drop him into the room — it fires `requestJoinSession()`, which inserts a `join-request` pseudo-motion with `disruptiveness: 99_000_000` (the single highest priority value in the whole system, higher even than End Debate at 6,000,000-something). Jordan sees a spinner / "waiting for chair approval" state. He is not on my roster yet as present — he's a name on a queue I haven't looked at.

I open the **Motions** tab. But wait — motions are **blocked during `pre-session`** per the briefing. Here's the first real friction: join-requests are *stored* as motions and ranked by the same `disruptiveness` field, but the tab that displays and lets me act on `motions` is gated shut in the exact phase (`pre-session`/roll call) where join-requests are most likely to be piling up. I have to rely on a separate roll-call-panel affordance (not the Motions tab) to actually admit people — the two queues (join-requests, GSL/caucus motions) share a data model but not a UI surface at this phase. I found the roster/roll-call view instead: it's showing Jordan's join request inline, with **+ Add** / **Deny** actions right there, so practically it works — but the mental model of "motions are blocked pre-session" almost had me looking in the wrong tab for a full minute.

I approve Jordan → `approveJoinRequest()` runs, sets his delegate status to `present` (or `present-voting`, whichever he requested) and deletes the join-request motion. He materializes on my roster as United States, status Present.

Three more devices connect over the next two minutes:
- **Farah (Russia)** — requests `present-voting` directly (she wants a vote-holding seat from the jump).
- **Amina (Somalia)** — requests `present`.
- **Luis (Panama)** — requests `present-voting`.

Each shows up as a join-request; I click through and Approve all three. The other 11 delegations I mark by hand from the roll-call roster using the 3-state slider (Absent → Present → Present-Voting), since their "delegates" are just me simulating no-shows and late arrivals for realism — DR Congo and Bahrain I deliberately leave **Absent** to test quorum math later.

**Bulk buttons:** I use **All Present** once to snap the remaining stragglers to Present, then hand-correct DR Congo and Bahrain back to Absent (I want 13/15 present — well above the 1/3 quorum floor, but I want two visibly empty seats for realism and to test what happens when they "arrive" mid-session).

Crucially: none of this absent/present toggling touches the GSL, because we're still in `pre-session` — the roll-call guard suppresses GSL removal here exactly as documented. Good, matches spec.

**Chair reasoning on Begin Session:** I count 13 present (11 present-voting, 2 present-only — Denmark and Latvia I leave as observer-flavoured "present" only, non-voting, to mirror how some seats behave in real committee). I click **Begin Session**. Phase flips `pre-session → speakers-list`. The 2 delegations I'd left Absent (DR Congo, Bahrain) are — per spec — stripped from the GSL at this exact transition. They weren't on it yet anyway (nobody's added speakers pre-session), so this is a no-op today, but I make a note that in a fast-moving committee this is the one moment absence silently prunes queue state.

### 2.3 GSL opens — first speeches, a request-to-speak, and a Right of Reply

I open the **Add Speaker** typeahead at the bottom of the chair dashboard and build the initial GSL in speaking-block order: United States, Russia, France, United Kingdom, China, Somalia, Panama, Pakistan, Colombia, Greece.

**currentSpeaker mechanics:** the moment I add the list, "United States" is not yet in `currentSpeaker` — that's a separate row. I click **Next** for the first time, which pops Jordan (US) off `speakersList` into `currentSpeaker`. He now displays as queue position #1 with the flag, a big countdown, and a progress bar. Everyone else shifts up one.

I click **Start**. The isolated `speakerTimeRemaining` atom starts ticking — this never touches `setCommittee`, so the whole dashboard doesn't re-render every second (confirmed in source: the timer effect and `speakerTimeRemaining` state are wired independently of the committee object).

**Delegate experience — Jordan (US), mid-speech:** on his phone the Session tab shows a big amber "You have the floor!" card. There's no countdown shown to him — the briefing is explicit that the delegate view intentionally dropped a synced timer for delegates; he just sees the floor-status message. He delivers 90 seconds accusing "certain flag states" of turning a blind eye to Red-Sea transit violations — pointed enough that Farah (Russia), watching the chat/session tab, immediately fires a DM to me: *"that was aimed at us, request Right of Reply for our delegation before the caucus motions start."*

I click **Next** on Jordan. Behind the scenes: `secondsSpoken = speakerTimeLimit - speakerTimeRemaining` gets logged via `logSpeakingTime()` for scoring (he used his full 90, so this logs cleanly, `secondsSpoken = 90 > 0`). Russia (next in queue) pops into `currentSpeaker`.

Before Russia's turn finishes, I decide the accusation was pointed enough to warrant an RTR. I open the **Right of Reply** overlay, type "Russia," pick **30s**, and click **Grant**. Here's a subtlety I want to flag proactively (this maps to the briefing's Q3): granting RTR does **not** touch the GSL at all — it fires a `logEvent(..., type: 'right-of-reply')` scoring record and pops open a **completely separate countdown overlay** (its own `useState` atoms: `rtrOpen`, `rtrCountry`, `rtrSeconds`, `rtrTimerActive` — verified directly in `chair/[code]/page.tsx`). Russia's RTR runs as a floating 30-second timer *while the regular GSL underneath is untouched* — France, next up on the list, is still sitting there waiting, unaffected. This is genuinely useful in one sense (RTR shouldn't need to burn a real queue slot) but it means the **AGENTS.md architecture doc is simply wrong** where it claims RTR "inserts a delegate at the top of speakersList with a custom time override" — the code does not do this.

Somalia's delegate, Amina, wants to speak but isn't on the GSL yet. She taps **Request to Speak** on her phone (Session tab). This creates a `gsl-request` pseudo-motion (`disruptiveness: 98_000_000` — just under join-requests, above every real motion). On my dashboard it shows as a green "GSL request" banner. I click **+ Add to GSL** — she's appended to the tail of the list. (Had I clicked Deny instead, she'd see "Your request was denied — Request Again," and that denial state clears automatically once she does land on the list or becomes current speaker.)

### 2.4 First moderated caucus — blocs start forming

After UK, China, and Somalia speak, Farah (Russia) DMs me privately: *"Chair, we'd like to raise a moderated caucus on flagging-state accountability, 10 minutes, 60 sec speakers."* Since delegates cannot raise motions from their own device — the Motions tab was removed from the delegate view entirely — this has to come to me as a floor request (chat, or literally someone waving a placard if this were in-person) and **I key it into the system on her behalf**.

I open **Motions → Raise a Motion → Moderated Caucus**. Fields: Topic "Flagging-state accountability," Proposed by **Russia**, Total time 600s, Per-delegate time 60s. The form live-shows "10 delegates can speak" (600/60, divides evenly, no ⚠). I submit — this goes in as a pending motion with a temp ID (`temp-<timestamp>`) until the real UUID round-trips from the DB.

A minute later, Luis (Panama) also wants a caucus — on canal-state neutrality — but the system **blocks him from being proposer** in the dropdown while Russia's motion is still pending, since only one pending motion per country is allowed at a time... except that rule is keyed to the *proposer* field, not "one motion in the room at a time," so I could actually add Panama's motion concurrently with a different `proposedBy`. I do — Panama's Unmoderated Caucus, 5 minutes, "let blocs huddle before the vote."

**Now the room votes with placards** (in theory) — but here's where **Q1 bites for real**: I open **Vote on Motions**. The two pending motions are ranked by `disruptiveness` — moderated and unmoderated differ only by `motionOrder` position (default order is `['consultation','tour','unmoderated','moderated']`, so **unmoderated actually outranks moderated** by default!). Panama's unmoderated motion shows as the primary card, Russia's moderated motion queues on the right. Each card shows a "needs X of Y present" hint — for Panama's unmoderated motion: "Simple majority," computed as `floor(present/2)+1` with **13 present** → needs 7. But this number is **entirely cosmetic**. There is no tally screen, no placard count entered anywhere. I just look at my (imaginary) room, judge the mood is with Russia's moderated caucus first, and click **Accept** on Russia's card after manually reordering it up via drag. The 7-of-13 hint never gets checked against anything — I could accept a motion I personally believe has 3 supporters and the system will not stop me, nor did it ever ask me to enter a count. Reject (✗) is available for Panama's for now — I leave it pending to accept after the moderated caucus ends.

**Accepting Russia's moderated caucus**: this clears *all* other pending motions... wait, does it clear Panama's unmoderated motion too? Per spec, accepting a caucus "clears ALL other pending motions" — so Panama's unmoderated motion is wiped from the queue by the act of accepting Russia's. Panama didn't get rejected with a reason, or voted down — his motion just vanishes because a different motion got Accepted first. From the floor's perspective this is indistinguishable from the chair unilaterally killing his motion. I have to remember to verbally (in chat) tell Luis his motion needs to be re-raised after the caucus, because the system gives him no such notice.

**Entering caucus:** the phase flips to `moderated-caucus`, the caucus JSONB is built (type, purpose, totalTime 600, speakingTime 60), the caucus queue is cleared (was empty anyway), `currentSpeaker` nulls, and — critically — **GSL is left completely intact**. My dashboard shows a 3.5-second loading card: caucus name, topic "Flagging-state accountability," total 10:00, per-speaker 0:60, max speakers computed as `floor(600/60) = 10`.

I add speakers to the caucus queue via the caucus Add-Speaker input: Russia (proposer, first), then US, UK, China, Somalia, Panama, Colombia, Greece, Pakistan, France — filling all 10 slots exactly at the max. Trying an 11th shows the amber "max speakers reached" warning — informational only, doesn't block, matching spec.

**Delegate experience — Farah (Russia), first speaker in her own caucus:** she gets 60 seconds to argue that unilateral naval escorts are destabilizing, not stabilizing. Real theatre: she's visibly baiting the US into using its RTR-style comeback later. I click Next through the queue — Jordan (US) responds sharply that "certain P5 members' arms shipments" are the actual destabilizer — another pointed jab, but I decide one RTR per session is enough drama and let it go this time (there's no hard limit on RTR grants in the software, purely a chair judgment call, which is correct to real procedure).

**Q2, live and ugly:** I let the caucus run past speaker #8 (Panama) without paying close attention to the total-time bar — I'm simultaneously fielding a chat DM from Amina (Somalia) about a Working Paper she wants to submit. The **total caucus clock hits 0 seconds while Panama is still mid-speech** (I hadn't clicked Next yet). The auto-tick logic fires: phase flips back to `speakers-list`, the caucus object nulls, the caucus queue clears — and **Panama, who was `currentSpeaker` inside the caucus, gets prepended directly into the permanent GSL** (confirmed directly in source: `chair/[code]/page.tsx` lines ~1429-1440, the tick handler builds `newSpeakersList = [preCaucusSpeaker, ...speakersList.filter(...)]` and writes it to the DB with `list_type='gsl'` via `reorderSpeakersListInDB`). Luis (Panama) is now sitting at the very top of the General Speakers List — a list he was never added to by request, by chair action, or by any deliberate motion. He didn't ask to be on the GSL; he was mid-caucus-speech when the clock ran out. This directly contradicts the "GSL and caucus queue are strictly separate, never mix" rule the codebase's own architecture doc insists on. Had I instead clicked the **manual End** button one speaker earlier, the exact same code path (I checked: `handleEndCaucus` at a different call site) does **not** do this — it just nulls the caucus and clears the queue, full stop, GSL untouched. So the same real-world event ("caucus is over") produces two different, inconsistent outcomes for the GSL depending on whether the clock or the chair pulled the trigger. This is squarely Q2 and it's the single most structurally confusing thing I hit all session.

I manually pull Panama back out of GSL position 1 and re-file him at the tail, muttering to myself. A chair running this for real, mid-crisis-committee, with fifteen countries and this happening during a fast caucus chain, would absolutely not notice this every time — it would quietly corrupt speaking order for the rest of the session.

### 2.5 Second motion, unmoderated caucus, and a delegate goes absent

I re-raise Panama's unmoderated caucus motion myself (telling him via DM "resubmitting for you since the last one got cleared") — 5 minutes, "let blocs huddle." No topic field required for unmoderated (only moderated/consultation have the topic field). I accept it directly this time (only one motion pending, easy call). Phase → `unmoderated-caucus`. One big countdown, Start/Pause/Extend/End, no queue.

**Delegate experience during unmod:** Amina (Somalia) uses this downtime to actually submit her Working Paper from **Documents → Submit**. Type: Working Paper. Title: "Framework for a Multinational Escort Coordination Cell." Co-sponsors: auto-includes herself; she adds Colombia and Greece as she DMs them to co-sign in the chat. No PDF this time, just typed content. Auto doc code assigned: **WP 1.1**. Status: `submitted`.

Also during the unmod break, **Bahrain's seat "arrives late"** — I flip Bahrain from Absent to Present-Voting directly from the roll-call-style panel (now mid-session, not pre-session — this is the "resume/late arrival" path, not the roll-call-phase path, so the guard against GSL-stripping specifically for pre-session doesn't apply here, but Bahrain wasn't on any list yet, so nothing to strip).

Partway through the unmod, I need to simulate an absence: **Luis (Panama) has to step out** (phone call). I flip his status to Absent. Per spec, mid-session absence removes a delegate from **both** GSL and caucus queue. Panama was sitting at the tail of the GSL (from the earlier mis-injection cleanup) — he's cleanly removed. Good, this path works exactly as documented, no surprises.

The unmod timer runs out naturally this time (I let it hit zero rather than ending early) — and since there's no `currentSpeaker` concept in a plain unmoderated caucus, the same auto-expiry tick has nothing to prepend into the GSL. Confirmed harmless exactly as the briefing predicted: unmoderated's own tick handler just clamps to 0 and stops, no speaker object exists to inject.

### 2.6 Right back onto GSL, extra time, and the silently-dropped speech

Phase returns to `speakers-list`. Remaining GSL: France, Colombia, Greece, Pakistan (Panama removed while absent), plus Somalia had already spoken in caucus so isn't re-queued. I click Next repeatedly to burn through France, Colombia.

**Greece's turn** — I grant **+time**: he's making a nuanced legal point about UNCLOS Article 110 and I want to let him finish. I click **+30s** mid-speech. This only bumps the `speakerTimeRemaining` atom — no DB write happens yet (per spec, extra time is DB-lazy until pause/next). Greece finishes with **12 seconds of his added 30 left over** — meaning when I click **Next**, `speakerTimeRemaining (42s incl. the 12 leftover computed against the 90s baseline... )`. Let me be precise about what actually happens: baseline limit is 90s. He was down to, say, 8s remaining when I added 30, bringing remaining to 38s. He speaks for 26 more seconds and I click Next with 12s still showing. `secondsSpoken = limit(90) - remaining(12) = 78`. That's positive, so it logs fine *in this instance* — good, no bug here.

But I deliberately reproduce **Q5** on Pakistan's turn to see it happen: Pakistan is winding down, I add +60s "just in case" when he only had 10s left (remaining jumps 10→70), and then he wraps up almost immediately, clicking off the floor with 65s still showing when I hit Next. `secondsSpoken = 90 - 65 = 25` — still positive here too, actually, because the limit is the *original* 90, not something that shrinks. I have to re-derive this: the bug only manifests if the leftover `speakerTimeRemaining` at Next-time **exceeds the original `speakerTimeLimit`** — which only happens if you add enough extra time that the delegate finishes *before burning back down past the original limit*. I test this directly: Colombia has an unusually short 45s slot (I'd set a custom shorter time for her via the speaker-time presets), I add +60s extra almost immediately, and she finishes speaking after only 20 seconds of actual talking, hitting Next with `speakerTimeRemaining = 85s` (45 + 60 - 20). `secondsSpoken = 45 - 85 = -40`. The `if (secondsSpoken > 0)` guard at the call site drops it, and — belt and suspenders — `logSpeakingTime()` itself has its own `if (seconds <= 0) return;` guard. **Colombia spoke for a real 20 seconds and it is completely invisible to scoring, stats, and the delegate's own recap.** She gets zero speaking-time credit, zero "GSL speech" score event, nothing — not even a diminished credit, just silence. This is confirmed directly in source (`chair/[code]/page.tsx` line ~1737-1738 and `committeeService.ts` `logSpeakingTime`). For a scoring-motivated committee (many real conferences gate awards on the ledger), this is a real and silent integrity gap — the failure mode is invisible to both chair and delegate; neither gets an error, the speech just doesn't count.

### 2.7 Working paper becomes a draft resolution; PDF; co-sponsors

Amina's WP 1.1 gathers enough informal support in chat DMs (Colombia, Greece, and now also UK and France ping me wanting to co-sign) that the bloc decides to escalate it into a **Draft Resolution**. Because there's no "convert WP to DR" button — this is the "no formal amendment feature" gap the briefing flags (Q9) manifesting adjacent to a real workflow — Amina has to **submit an entirely new document** from scratch as a DR. She does: Documents → Submit → type Draft Resolution, title "Multinational Red Sea Escort Coordination Mechanism," this time attaching an actual **PDF** (the full resolution text, uploaded to storage). Sponsors: Somalia (main), Colombia, Greece, UK, France as co-sponsors/signatories. Auto doc code: **DR 1/1**.

**Chair reasoning:** I open the **Documents** modal, Draft Resolutions tab, see DR 1/1 with a submitted badge. I click **Introduce**. This launches the presentation flow: I set reading time 3 min, presentation 5 min, Q&A 8 min. The PDF renders in a side-by-side "screen share" view with the countdown on the left. Somalia's delegate reads her resolution theatrically over chat/voice (outside the app) while the room follows the PDF on their own phones.

After Q&A, **because it's a DR (not a WP), it does NOT auto-pass** — it routes to the **/voting screen** instead, exactly as documented. A WP would have auto-passed right here; the asymmetry is real and, in this case, correct procedure (WPs are working documents, DRs need a real vote).

### 2.8 The voting screen — roll call surprise, placards, and the veto

I navigate to `/voting/RSC7QK`. First thing that happens: a **roll call modal** — A/P/PV sliders again, separate from the main session roll call. I go through it: everyone's status from the main session mostly carries over, but I notice Bahrain (added mid-session, Present-Voting) and Panama (still Absent from his earlier phone call, hasn't rejoined) reflected correctly. But — and this is genuinely surprising the first time you hit it — **this roll call writes directly back to the DB's delegate statuses**. If I'd sloppily fat-fingered Pakistan to Absent here just to move faster, that change would silently propagate back into the main session's attendance record, which a delegate would see reflected on their own Session tab. Running a vote should not be a side channel for editing session attendance, but it is (Q7, confirmed by design — the same `setDelegateStatus` write path is used).

Present + voting count: 12 (Panama absent, DR Congo absent, Denmark/Latvia present-but-non-voting). I select **DR 1/1**. Placard round begins — I click through each present-voting delegate: US **For**, UK **For**, France **For**, China **Abstain**, Somalia **For** (sponsor), Denmark/Latvia excluded from voting (non-voting present), Pakistan **For**, Colombia **For with Rights**, Greece **For**, Bahrain **For**, DR Congo n/a (absent), and — this is the whole point of the exercise — **Russia: Against.**

Colombia's "For with Rights" queues her into the rights-speaker round afterward; she gets her timed moment to explain her vote once the placard round closes.

**Result computation** (I verified this directly in `voting/[code]/page.tsx`): `vetoList` resolves to the `p5Delegations` setting; `p5Veto = true` because Russia is in the veto list and voted Against; `thresholdMet` would have been true under `simple` (8 For vs. 1 Against among voting delegates, comfortably a majority) — **but `passed = !p5Veto && !unanimousFail && thresholdMet` short-circuits to false the instant `p5Veto` is true**, regardless of the lopsided tally. The result screen renders **FAILED**, in the deep red "adjourned" styling, with a "🛡️ P5 Veto" badge — the veto is visually called out as the failure reason, which is exactly the theatre a UNSC simulation needs: everyone in the room can see it wasn't the numbers, it was the veto. This is the single most procedurally satisfying moment of the whole run — the mechanic works exactly as billed.

**Delegate experience — the room reacts:** Farah (Russia) gets immediate DMs from Jordan (US) and Amina (Somalia) — the chat blows up. This is good simulation fodder but it's all happening in the chat panel, completely disconnected from the voting screen itself; there's no "explanation of vote" field tied to the Against click, so Russia's justification has to be improvised verbally/in chat, same as the RTR-adjacent point earlier.

I click **Back to Session**. The "Back to Session" panel offers a **Motion to Suspend Debate** shortcut right there — a nice touch, since after a veto blow-up real committees often want a breather.

### 2.9 Suspend Debate mid-session

I take that exact shortcut: raise **Suspend Debate** (proposed by 🪑 Chair, since procedurally after a veto it's often the chair or a shaken delegation asking for recess). Unlike caucus motions, Suspend/End get the genuine **"Does this motion pass? Yes / No"** confirmation screen — the one piece of real "vote" gating anywhere in the motions flow. I click **Yes**.

Per the documented sequencing rule: the motion is removed from the DB **first** (await), *then* `suspendDebateInDB()` fires — `suspended_at` set, phase → `adjourned`. My own dashboard flips to the two-tab **Suspend View / Session View** overlay. Delegate phones (Jordan, Farah, Amina, Luis whenever he reconnects) all snap to a **full-screen "debate suspended" wait screen** — no Session tab, no Documents, nothing. This is a hard stop, correctly total.

I let it sit "suspended" for a beat (simulating a real recess/security issue), then click **Resume Session**. Since I'm the only chair today, I trivially claim the resume lock (`resuming_chair`) — in a multi-chair room, the first chair to click would win it and everyone else would see "X is resuming…" greyed out, which I don't get to exercise solo but is worth noting as designed-for.

**Resume → back through pre-session roll call.** Exactly as documented: GSL, chat, and documents (WP 1.1, DR 1/1 with its FAILED status) all survive intact. The caucus queue does not (it was already empty, so no visible effect). I go through roll call again — this time Luis (Panama) has returned from his call and rejoins as Present-Voting; I also flip DR Congo to Present (finally, a full-ish room). Absent-during-this-roll-call does not touch GSL, same guard as the first roll call. I click **Begin Session** again → phase back to `speakers-list`; any still-absent delegate (none, this time) would be stripped from GSL at that instant.

### 2.10 Second resolution — passed, then End Debate

Given the political heat, the bloc drafts a scaled-back version dropping the "coordination cell" language Russia objected to, in favor of an "information-sharing mechanism" — softer, sponsor list expanded to include **China** this time as a co-sponsor (a deliberate bloc-building move to pre-empt a second veto). Amina submits it as a fresh DR (again, no amendment path — a wholly new document, **DR 1/2**), PDF attached, sponsors Somalia/China/Colombia/Greece/UK/France.

I run the same Introduce → reading → presentation → Q&A flow, then to `/voting/RSC7QK`. Roll call again (all 15 minus nobody absent this time — full room). Placard round: **For** across the board including China and Russia this time (the softened text worked) — a clean **consensus-flavored pass**, no veto cast, `thresholdMet` true, `passed = true`. Green **PASSED** screen. DR 1/2 status persists as `passed`.

With a passed resolution as a natural high note to end on, I raise **End Debate** myself (🪑 Chair), get the same Yes/No confirmation, click **Yes**. `endDebate()` fires: `ended_at` set, and — this is the detail worth being loud about — `expires_at` is computed in the **actual code** as `now + 1 hour`, not the 72 hours implied by the UI copy/docs elsewhere (Q10, confirmed directly: `endDebate()` in `committeeService.ts` literally does `Date.now() + 1 * 60 * 60 * 1000`). Every device flips to the two-tab **End View / Session View**, read-only: Motions/Documents/Chat-compose buttons hidden, but the full record — GSL history, both DRs with their real pass/fail outcomes, the chat log, delegate stats — remains browsable in Session View. No resume button. This committee is done.

---

## 3. Feature coverage checklist

- [x] Committee creation with UNSC 15-member preset roster
- [x] Auto-generated code + 4-digit chair suffix, `separateChairCode`
- [x] Settings: veto mode `p5`, substantive threshold `simple`, quorum `1-3`, chair approval ON
- [x] Pre-session roll call: 3-state slider, bulk **All Present**, individual corrections
- [x] Waiting room: `join-request` pseudo-motions, chair Approve/Deny
- [x] Begin Session transition (absent → stripped from GSL at that instant)
- [x] GSL: Add Speaker typeahead, currentSpeaker as position #1, Start/Next, progress bar
- [x] GSL "Request to Speak" (`gsl-request`) → chair Add/Deny → delegate "denied, request again" state
- [x] Right of Reply: standalone overlay, independent of GSL, scoring event only
- [x] Moderated caucus: motion form with live "N delegates can speak," Accept, 3.5s loading card, max-speakers cap + amber warning
- [x] Unmoderated caucus: simple countdown, Start/Pause/Extend/End
- [x] Motions ranked by `disruptiveness`, cosmetic "needs X of Y" hint, chair-unilateral Accept/Reject (no real tally)
- [x] Accepting a caucus silently clears other pending motions (Panama's motion wiped)
- [x] Auto-expiry of moderated caucus at 0:00 → GSL injection bug reproduced live
- [x] Manual End button on caucus → clean, no GSL injection (inconsistency confirmed)
- [x] Mid-session absence removes delegate from both GSL and caucus queue
- [x] Late-arrival mid-session status flip (Bahrain)
- [x] Extra time (+time) — one clean case, one deliberately reproduced negative-seconds silent-drop case
- [x] Working Paper submission (no PDF) with co-sponsors gathered via chat
- [x] Draft Resolution submission with PDF + expanded sponsor list (twice — DR 1/1 and DR 1/2)
- [x] Document Introduce flow: reading/presentation/Q&A timers, PDF screen-share view
- [x] Voting screen: its own roll call (writes back to DB attendance), placard round, rights-speaker queue
- [x] Veto cast (Russia, Against) sinking a majority-supported DR — P5 veto badge
- [x] Second DR passing cleanly with a full room and no veto
- [x] Suspend Debate: Yes/No confirmation, two-tab Suspend View/Session View, delegate full-screen wait
- [x] Resume: claim lock, back through pre-session roll call, GSL/chat/documents preserved, caucus queue not
- [x] End Debate: Yes/No confirmation, two-tab End View/Session View, read-only session, no resume
- [x] Chat: DMs to individual chair (senderName via `?chairName=` param), reactions to the veto moment
- [x] Named delegate simulation: Jordan (US), Farah (Russia), Amina (Somalia), Luis (Panama) — joining, speaking, requesting floor, submitting docs, going absent, rejoining

Not exercised (out of scope for this committee's remit, noted for completeness): Faculty Advisor "nudge" chat, Tour de Table, Consultation of the Whole, co-chair "view only" mode, custom veto country list, `gslRequireNextSpeaker` guard, scoring/feedback UI in depth, WP/DR submission limits, disableChat toggle, delegation-name requirement.

---

## 4. Friction & "doesn't make sense" log

### F1 — Caucus auto-expiry injects the mid-speech delegate into the permanent GSL; manual End does not (Q2) — **HIGH**
**What happened:** Letting Russia's moderated caucus clock hit 0:00 while Panama was mid-speech caused Panama to be prepended directly into `speakersList` (the GSL) via `reorderSpeakersListInDB(..., 'gsl')`. Ending the same caucus type manually one speaker earlier does not do this.
**Why it's wrong:** This is the single most emphasized invariant in the codebase's own architecture doc — "NEVER put GSL delegates into caucusQueue or vice versa," repeated three separate times across different feature sections. The auto-expiry path violates it in the one place a chair is least likely to be watching (the exact second a countdown hits zero, usually while doing something else — like I was, mid-DM).
**Real-room expectation:** A caucus ending — whether the chair gavels it or the clock runs out — should always return the room to the exact GSL state it had before the caucus started. A delegate who happened to be talking when time expired should not be teleported to the front of an unrelated permanent queue.
**Severity: High** — this silently corrupts speaking order, and for Room-Order Tour de Table specifically (per the briefing) it would inject a numbered placeholder like "Speaker 4" as a literal GSL entry, which is even more obviously broken and user-visible.

### F2 — Caucus motions have no real vote; the "needs X of Y" hint is decorative and ignores settings (Q1 + Q6) — **HIGH**
**What happened:** Every caucus-type motion (moderated, unmoderated, consultation, tour) shows a computed "needs 7 of 13" style hint, but Accept/Reject is a pure chair click with no tally UI anywhere. Worse, the hint's threshold logic (`Math.ceil(present*2/3)` for consultation/tour, `Math.floor(present/2)+1` for the rest) is **hardcoded** in `MotionsModal.tsx` and never reads the committee's actual `substantiveThreshold` setting — so a chair who configured `consensus` or `supermajority-2-3` still sees a UI implying "simple majority" governs moderated caucuses.
**Why it's wrong:** It presents false precision. A hint that looks like a live computed requirement, sourced from committee settings, is actually a static formula unrelated to any settings the chair configured. A chair could reasonably believe the software is enforcing something it isn't enforcing at all.
**Real-room expectation:** Either genuinely implement a placard/tally-based accept, or remove the "needs X of Y" language entirely and replace it with something honestly informational like "typical guideline: simple majority" without a specific number tied to the live present count.
**Severity: High** for the false-precision aspect; the "no real vote at all" part is arguably fine for a chair-operated tool (real committees do let chairs read the room without a strict formal count for procedural motions) but the fake math compounds it.

### F3 — Accepting a caucus motion silently deletes every other pending motion, with no notice to the losing proposer — **MEDIUM**
**What happened:** Panama's unmoderated-caucus motion vanished from the queue the instant I accepted Russia's moderated-caucus motion — not rejected, not voted down, just gone as a side effect.
**Why it's wrong:** From the floor's perspective (Luis, on his phone), his motion simply disappears with zero explanation — no "your motion was superseded" message, nothing in his Motions view (which doesn't exist for delegates anyway — see F4) or Session tab. The chair has to manually remember to tell him out-of-band.
**Real-room expectation:** At minimum, some visible/inferable signal that a motion was cleared as a side effect of another motion being accepted, rather than indistinguishable from a rejection.
**Severity: Medium** — recoverable (I just re-raised it), but it's an information gap that would confuse a delegate in a live room.

### F4 — Delegates cannot raise motions or vote from their device at all (Q4) — **MEDIUM, situational**
**What happened:** Every single motion in this run — both caucuses, both Suspend/End Debate motions — had to be typed in by me on behalf of a delegate who requested it via chat/DM, essentially off-app.
**Why it's wrong (situationally):** For a 15-person committee with one attentive chair, this is manageable — it's genuinely how many real chairs already operate (reading a physical placard and writing the motion down themselves). But it does mean **the chair is a mandatory bottleneck and single point of failure for all procedure**, and a delegate has zero way to prove they actually raised a motion (no timestamped self-serve record) — everything procedural is chair-attested. In a larger or faster committee (GA-sized, 50+ delegates), this becomes a real scaling risk: the chair cannot type fast enough to keep up with a floor that's used to raising motions themselves.
**Real-room expectation:** This is defensible as designed ("chair enters what the floor does," a deliberate simplification), but is worth flagging because it's a genuine ceiling on how large or fast-moving a Gavelling committee can be before the single chair-input-queue becomes the bottleneck.
**Severity: Medium** — not a bug, a scope/scaling limitation with real UX consequences at scale.

### F5 — Extra time can make a real, spoken speech vanish from scoring with zero feedback (Q5) — **HIGH**
**What happened:** Colombia's genuinely-delivered 20-second speech produced `secondsSpoken = -40` after I added 60s of extra time she didn't fully use, and both the call-site guard (`if (secondsSpoken > 0)`) and the internal guard inside `logSpeakingTime` (`if (seconds <= 0) return`) silently dropped the entire log entry.
**Why it's wrong:** There is no partial credit, no floor at zero, no chair-visible warning — the speech simply never happened as far as scoring, stats, and the delegate's own recap are concerned. This is worse than under-crediting; it's total erasure, and it's triggered by a chair being generous with extra time, which is exactly the kind of chair behavior the feature is supposed to encourage.
**Real-room expectation:** At minimum, clamp to `Math.max(0, secondsSpoken)` so a speech that undershoots its padded allotment still logs *something* close to the truth, or track actual elapsed wall-clock speaking time independently of the "limit minus remaining" arithmetic.
**Severity: High** — silent data loss in the scoring ledger, which several real conferences use for actual awards.

### F6 — Voting-screen roll call writes back to live session attendance (Q7) — **MEDIUM**
**What happened:** The `/voting/[code]` screen's own roll call modal uses the same `setDelegateStatus` write path as the main session roll call, meaning a status change made "just for the vote" persists into the delegate's real, ongoing session attendance.
**Why it's wrong:** A chair moving quickly through a pre-vote attendance check (which naturally happens under time pressure, right after a tense veto) could accidentally demote or promote someone's real standing in the committee, with the change silently reflected back on that delegate's own phone.
**Severity: Medium** — plausible real-world accident vector, not a dramatic one, but it's a side-channel a chair wouldn't expect ("I'm just checking who can vote" shouldn't also mean "I'm editing the roster").

### F7 — Quorum is enforced on the GSL but has zero presence on the voting screen (Q8) — **MEDIUM**
**What happened:** My `1-3` quorum setting gates adding speakers and starting the GSL timer, but I could have run the entire placard vote on DR 1/1 with only 2 of 15 delegates present and the voting screen would not have blinked.
**Why it's wrong:** Quorum existing at all implies the chair configured a floor for legitimate committee action — a substantive vote is the single highest-stakes action in the whole app, and it's the one place quorum silently doesn't apply.
**Severity: Medium-High** — for a committee that cares about quorum (most do, for exactly resolution votes), this is the most consequential place for the check to be missing.

### F8 — No amendment mechanism forces "new document" for every substantive change (Q9) — **LOW/MEDIUM**
**What happened:** Escalating WP 1.1 into a DR, and later softening DR 1/1's language into DR 1/2 after the veto, both required submitting an entirely fresh document rather than amending in place.
**Why it's wrong:** Real committees track amendment lineage (this DR is "DR 1/1 as amended," friendly/unfriendly amendment counts, etc.); Gavelling has no concept of document versioning or lineage — DR 1/2 has no system-visible relationship to DR 1/1 beyond a chair's memory and a shared topic.
**Real-room expectation:** Not necessarily full amendment tracking, but at minimum a "supersedes / relates to" link between documents would help delegates and the chair follow the paper trail.
**Severity: Low-Medium** — informally solvable (as I did) via chat and title conventions, but the record left behind for later review is thinner than a real committee's dais folder.

### F9 — End Debate expiry is 1 hour in code, contradicting UI/docs claiming 72 hours (Q10) — **LOW (but a trust issue)**
**What happened:** `endDebate()` computes `expires_at` as exactly `now + 1 hour`, confirmed directly in `committeeService.ts`.
**Why it's wrong:** If any surface (settings copy, AGENTS.md, delegate-facing messaging) tells a chair or delegate "this record will be viewable for 72 hours," that's simply false — it's gone in one. For a committee that wants to let delegates screenshot their recap or stats after the fact, an hour is a tight window nobody was told to expect.
**Severity: Low** in isolated impact (the committee still functioned), but it's the kind of silent contract-breaking detail that erodes trust once someone notices their "72 hour" window closed after 60 minutes.

### F10 (new) — Motions are gated shut during exactly the phase where join-requests and GSL-requests are most likely to be waiting — **LOW**
**What happened:** Chasing down Jordan's initial join-request, my first instinct was to open the **Motions** tab, since join-requests are internally *stored* as motions (`type: 'join-request'`, ranked by `disruptiveness`). But the Motions tab is blocked during `pre-session` — precisely the phase where a `requireChairApproval` waiting room is doing all its work. Admission actually happens through the roll-call panel's inline Approve/Deny affordance instead.
**Why it's confusing:** The data model unifies join-requests, GSL-requests, and real procedural motions under one `disruptiveness`-ranked table, but the UI splits them across two different surfaces gated by two different phase rules, with no visible cue pointing a first-time chair to the right one.
**Severity: Low** — a one-time "where do I click" confusion, not a functional bug; the correct control does exist and works once found.

### F11 (new) — Default `motionOrder` ranks Unmoderated above Moderated caucus, which is a debatable default — **LOW**
**What happened:** With `motionOrder` left at its default (`['consultation','tour','unmoderated','moderated']`), an unmoderated caucus motion outranks a moderated caucus motion of equal or even shorter duration on the "Vote on Motions" primary-card ranking, purely by list position, regardless of which was raised first or which has more support.
**Why it's mildly wrong:** Many real committees' informal convention leans the other way (moderated caucuses, being more structured/substantive, are often taken more seriously procedurally) — not a hard rule, but a chair unfamiliar with this default could be surprised the "quieter" motion visually outranks the more structured one on the queue.
**Severity: Low** — fully configurable, just a default worth a chair double-checking before their first session.

---

## Summary of top findings by severity

1. **High** — Caucus auto-expiry corrupts the GSL by injecting the mid-speech delegate (or a Room-Order placeholder) into the permanent speakers list, while manual End does not (F1/Q2).
2. **High** — The "needs X of Y" motion-vote hint is fully decorative, hardcoded independent of the committee's actual `substantiveThreshold` setting, and no caucus motion is ever really tallied (F2/Q1/Q6).
3. **High** — Extra time granted generously enough can push `secondsSpoken` negative, silently erasing a genuinely-delivered speech from all scoring/stats with no warning to the chair (F5/Q5).
