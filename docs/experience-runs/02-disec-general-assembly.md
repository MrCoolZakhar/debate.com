# Experience Run 02 — UN General Assembly First Committee (DISEC)

*A start-to-finish chair's-eye simulation on Gavelling, grounded in the software as actually implemented (see `BRIEFING.md`, §8 Q1–Q10). This is a thought-experiment, not a live app run. No code was changed.*

---

## 1. Committee Card

| Field | Value |
|-------|-------|
| **Committee** | UN General Assembly First Committee (DISEC) |
| **Topic** | Preventing an Arms Race in Outer Space (PAROS) |
| **Size** | 32 delegations (large GA) |
| **Session code** | `DISEC7` (auto-generated 6-char) |
| **Chair code** | `DISEC7-3092` (`separateChairCode` ON by default; suffix auto-generated) |
| **Chairs** | Single chair — "Chair Nadia Okonkwo" (`?chairName=Nadia`) |
| **Default speaker time** | 90s (GA norm; I keep the platform default) |

### Settings I chose, and why

| Setting | Value | Reasoning |
|---------|-------|-----------|
| `substantiveThreshold` | `supermajority-2-3` | GA First Committee substantive resolutions traditionally clear a two-thirds bar. This is the realistic threshold for a PAROS resolution and I want the grind of a 2/3 vote to actually bite at the end. |
| `allowAbstentions` | `true` | Abstentions are the lifeblood of a First Committee vote — blocs signal displeasure without killing a text. With 2/3 of (For+Against) as the denominator, abstentions are effectively "free passes" and I want to see that dynamic. |
| `vetoMode` | `none` | DISEC is a plenary committee — no P5 veto here (that's a Security Council fiction). I deliberately turn veto OFF so Russia/US/China are just five votes among 32, not gatekeepers. |
| `quorumThreshold` | `1-2` | Half the roster (16 of 32) must be present-and-counted before the GSL, timer, or motions unlock. I *want* to arrive under quorum early and feel the gate slam shut, then watch it open (Q8). |
| Chairs | Single | The briefing scenario calls for a single chair. This maximizes the "one human keys in everything for 32 people" pressure (Q4). |
| Motion types | All four enabled (`moderated`, `unmoderated`, `consultation`, `tour`) | A large GA needs the full toolkit: Tour de Table to hear all 32 once, unmod for paper-writing, moderated for topic drilling. |
| `motionOrder` | default `[consultation, tour, unmoderated, moderated]` | Left as default; this drives disruptiveness ranking when several motions stack up. |
| `wpSubmissionLimit` / `drSubmissionLimit` | `null` / `null` | Unlimited. A 32-delegate room will produce many working papers; I don't want to throttle bloc paper-writing. |
| `gslRequireNextSpeaker` | `false` | Default. I'll note where the "queue must never empty" guard would have helped and where it didn't fire. |

### The four delegates I'll follow closely

To keep 32 delegations from being a blur, I track four vividly across blocs:

- **Nigeria** — "Amb. Chukwu." African Group energizer; wants an equitable-access framing (space is not just for spacefaring powers). Bloc-builder, fast on the request button.
- **Russia** — "Amb. Volkov." P5, but with veto OFF he's just a loud vote. Obstruction-by-procedure specialist; will try to run out clocks and stack motions.
- **Singapore** — "Amb. Tan." Small-state efficiency; drafts crisp language, co-sponsors widely, hates wasted time. My canary for delegate-side friction.
- **Brazil** — "Amb. Costa." GRULAC coalition-builder; the person who actually merges the working papers into one draft resolution.

---

## 2. Chronological Run Log

### 2.0 Creation (`/create`)

**Chair's eye.** I open `/create`. There's no 32-member GA preset (the presets skew toward UNSC-15-style bodies), so I paste the roster into the delegate field — 32 lines:

> United States, United Kingdom, France, Russia, China, Germany, Poland, Italy, Netherlands, Sweden, Nigeria, Kenya, South Africa, Egypt, Algeria, Brazil, Mexico, Argentina, Cuba, Chile, Saudi Arabia, United Arab Emirates, Jordan, Qatar, Indonesia, Vietnam, Philippines, Thailand, Singapore, India, Japan, Australia, Israel, Iran, Turkey

*(That's 35 in the paste; I trim to a clean 32 by dropping three overlaps — final roster below.)* I set name = "UN General Assembly First Committee (DISEC)", topic = "Preventing an Arms Race in Outer Space", chair = "Nadia". Gavelling generates `DISEC7` and a chair suffix `3092`. All 32 delegations are created **absent**. Speaker time defaults to 90s. I land on `/chair/DISEC7?chairName=Nadia`.

**Friction (Low).** For a *General Assembly* tool, the absence of a large-plenary preset means the chair hand-pastes 32 names and prays the parser splits cleanly. Not broken — just the first sign the app's mental model is a 15-ish-seat crisis committee, not a 190-seat GA.

**Final roster (32), by bloc** — this is the spread I use throughout:
- **P5:** United States, United Kingdom, France, Russia, China
- **EU (non-P5):** Germany, Poland, Italy, Netherlands, Sweden
- **African Group:** Nigeria, Kenya, South Africa, Egypt, Algeria
- **GRULAC:** Brazil, Mexico, Argentina, Cuba, Chile
- **Arab Group:** Saudi Arabia, United Arab Emirates, Jordan, Qatar
- **ASEAN:** Indonesia, Vietnam, Philippines, Thailand, Singapore
- **Other key states:** India, Japan, Australia, Israel, Iran

That's 5+5+5+5+4+5+3 = **32**.

---

### 2.1 Pre-session / Roll Call (phase `pre-session`)

**Chair's eye.** The dais screen shows the full 32-row roster with a 3-state slider (Absent → Present → Present-Voting) per delegation, plus bulk **Clear All / All Present / All P+V**. Everyone is red/absent. The Motions tab is greyed out — you can't caucus before the session begins, correct per real procedure.

Delegates trickle in. I do NOT hit "All P+V" — I want to feel the quorum gate. I mark them one at a time as placards go up (which is, itself, the Q4 reality in miniature: even *attendance* is me clicking 32 sliders).

**Delegate's eye — the early arrivals.**
- **Singapore (Amb. Tan)** joins first via `/delegate/DISEC7?country=Singapore`. Tabs: Session / Documents / Chat / Stats. Tan flips their own slider to **Present-Voting**. On the Session tab, the floor card reads grey: *"Not on any speaker list."* Tan waits.
- **Nigeria (Amb. Chukwu)** joins, sets **Present-Voting**, and immediately taps **Request to Speak** on the Session tab — eager to open. On my dais a green **GSL request** banner appears: *"Nigeria requests the floor."*
- **Brazil (Amb. Costa)** and **Russia (Amb. Volkov)** join, both **Present-Voting**.

**The quorum gate bites (Q8).** At this point I've counted only ~12 present-and-voting. I try to click **+ Add to GSL** on Nigeria's request. Nothing productive happens — with `quorumThreshold: '1-2'` the GSL is gated below 16 present. The Add-Speaker typeahead and the timer Start are also inert. This is *correct and useful*: it mirrors a chair refusing to open debate before quorum.

**Delegate's eye of the gate.** Nigeria's phone still shows the grey floor card. Chukwu tapped "Request to Speak" and… the request is *pending on the chair's banner* but can't be actioned. From Nigeria's seat there's **no explanation** that the room is under quorum — the delegate just sees their request hang. That's a real gap: the gate is legible to the chair, invisible to the floor.

**Friction — NEW (Medium): quorum is silent to delegates.** The chair knows why "Add to GSL" won't fire (below 1/2). The delegate who requested the floor gets no "committee is not yet in quorum" signal — their request just sits. In a 32-seat room where a dozen people are mashing "Request to Speak," that's a lot of confused thumbs. Real-room expectation: the chair announces "we are not in quorum, please take your seats." The software gives the chair no floor-facing quorum indicator to reproduce that.

**Reaching quorum.** More placards go up. I keep sliding delegations to Present-Voting. Once I cross **16**, the gate releases — the Add-Speaker field lights up, Nigeria's **+ Add to GSL** becomes actionable. I end roll call with **29 of 32 present** (Cuba, Iran, and Vietnam still absent — a realistic late/no-show tail). I press **Begin Session**.

**At the transition:** phase → `speakers-list`. Any delegation still absent (Cuba, Iran, Vietnam) is stripped from the GSL at this moment (they weren't on it anyway). Debate is open.

---

### 2.2 Opening General Speakers' List (phase `speakers-list`)

**Chair's eye.** Now the "scale problem of a big GSL" arrives immediately. I approve Nigeria's pending request (**+ Add to GSL**). Then the request banner *keeps stacking*: as soon as debate opens, phones light up.

**Delegate's eye — the request stampede.** Within seconds of "Begin Session," a wall of delegates tap **Request to Speak**: Brazil, Singapore, Russia, Germany, Kenya, India, Egypt, Saudi Arabia, Indonesia, Chile… On the Session tab each of them sees their floor card flip from grey to (eventually) a colored "N speakers until your speech" state — *once I approve them*. Until I approve, they're in limbo.

**The chair's approval bottleneck (Q4).** Every one of those requests lands as a separate green banner on my single dais screen. There is no "approve all" — I click **+ Add to GSL** eleven times, one per banner, deciding order as I go. Meanwhile placards are *also* going up from delegates who didn't use their phone, and I'm keying *those* into the Add-Speaker typeahead by name. For a 32-seat room, the chair is a single-threaded queue processor.

I build an opening GSL (order reflects my read of the room — regional balance, open with the mover):

1. **Nigeria** (currentSpeaker, position #1 — flag, 90s timer, progress bar)
2. Brazil
3. Germany
4. Kenya
5. Singapore
6. India
7. Egypt
8. Saudi Arabia
9. Indonesia
10. Chile
11. Russia

The queue panel shows position #1 (Nigeria, live) and then a scrollable list. With 11 on the list, the panel shows the first several and a **"+N more in queue"** roll-up — the large-GSL affordance. Good: it doesn't try to render 11 full rows.

**First speech.** I press **Start**. Nigeria's 90s counts down; the progress bar fills.

**Delegate's eye — Nigeria has the floor.** Chukwu's phone shows the amber floor card: *"You have the floor!"* — but **no countdown timer** (delegate view deliberately omits the speaker timer). Chukwu speaks to equitable access: space belongs to all humankind, not a spacefaring club. At ~85s I can see they're wrapping. I press **Next**.

**What `Next` does.** It logs Nigeria's spoken seconds (`limit − remaining ≈ 90 − 5 = 85s`, cleanly positive → scoring/stats credit), pops **Brazil** into currentSpeaker, resets the timer to 90s. Nigeria drops off the list; the "+N more" count ticks down.

**Delegate's eye — the waiting many.** Singapore (position 5 → now 4) sees a yellow card: *"3 speakers until your speech."* India (deeper) sees a green *"5 speakers until your speech."* Russia, at the tail, sees a green card too. Everyone can follow their own countdown-by-position without a timer — this scales gracefully and is one of the nicer large-room touches.

**Chair's eye — the +time / scoring trap (Q5).** Brazil is mid-sentence at 0:03 remaining and asks for a moment. I hit **+time (30s)**, bumping the clock to 33s. Brazil finishes with ~20s left on the *extended* clock. When I press **Next**, the outgoing-seconds math is `limit − remaining`. Here the "limit" the code compares against is the base 90 (not 90+30), and Brazil finished with time to spare on the extended clock — the arithmetic can land at or below zero. Per Q5, when `secondsSpoken` isn't `> 0`, the log is **dropped entirely**: Brazil gets *no* GSL-speech credit and *no* speaking-time credit for a real, delivered speech.

**Friction — Q5 bit hard (High).** A delegate who spoke — and to whom I granted extra time as a *courtesy* — silently loses all scoring/stats for that speech because the +time math underflows the `> 0` guard. From Brazil's Stats tab later, that speech simply isn't there. In a scored GA where the leaderboard matters, penalizing a delegate for the chair's own generosity is exactly backwards. Real-room expectation: extra time is a favor, never a penalty. **This one I'd fix first.**

**The grind continues.** I gavel through Germany, Kenya, Singapore, India. Each `Next` is a manual press; each new request that arrives mid-GSL is another banner I approve or defer. By the time Singapore speaks (crisp, 60s, sits early — a gift), the GSL has *refilled* from new requests: Poland, Mexico, South Africa, UAE, Japan, Australia have all queued. The list is perpetually 7–10 deep. This is the authentic large-GA experience: the GSL never empties, and the chair is the sole valve.

---

### 2.3 Motion: Tour de Table (hear all 32 once)

**Chair's eye.** After ~8 GSL speeches the room wants breadth, not depth — everyone wants their one minute on record. A delegate (I record it as **proposed by India**) raises, from the floor, a **Motion for a Tour de Table**. Delegates can't raise it from their phones (Q4), so India catches my eye and I key it in.

I open **Motions → Raise a Motion → Tour de Table**: Per-delegate time = **60s**, order = **A→Z**. Live preview: Total = presentCount × 60. With 29 present that's 29 × 60 = **1740s (29 min)**. That's long, but it's the point of a Tour — everyone speaks once.

**Voting-on-motions view.** The Tour card surfaces with a hint: **"2/3 majority — needs 20 of 29 present."** Only India's motion is pending, so it's the primary card with **Accept / Reject / Edit**.

**Friction — Q1 + Q6 (Medium).** That "2/3 majority — needs 20 of 29" text is *cosmetic*. There is **no tally** — I just read the room's placards and click **Accept**. And the 2/3 figure is **hardcoded for Tour/Consultation**; it ignores my committee's configured `substantiveThreshold` entirely (though here they happen to coincide at 2/3). If I'd set the substantive bar to simple majority, the Tour hint would *still* say 2/3, misleading me. The room votes with placards; the software's number is theater. I click **Accept**.

**What Accept does.** Clears all other pending motions (none here), sets phase, builds the `caucus` object as a moderated-type run with the queue **pre-filled A→Z starting from the proposer** (India), nulls currentSpeaker, GSL **untouched** (my 9-deep GSL is preserved intact — good, RULE 1 holds). India earns a "motion raised" scoring point.

**Delegate's eye — the loading card.** Every phone and the dais show the 3.5s caucus loading card: name (Tour de Table), total (29 min), per-speaker (60s), and a max-speakers figure. Then the Tour screen: flag + name + per-speaker timer. The **Total-time bar is hidden** for a Tour (you're going through a fixed roster, not a budget).

**Running the Tour.** The queue is Algeria → Argentina → Australia → Brazil → … → Vietnam (A→Z of *present* delegations, wrapping from India the proposer per the A→Z-from-proposer rule). I press **Start**; 60s per speaker; **Next** advances and logs each caucus speech's seconds. Twenty-nine 60-second turns.

**Delegate's eye — the Tour felt fair.** Every present delegation gets exactly one minute, in a predictable order they can see coming. Small states (Qatar, Jordan, Chile) *love* this — in a real GA they'd wait an hour for a GSL slot; here they're guaranteed the floor. This is Gavelling at its best for a large room.

**Chair's eye — the End-button landmine (Q2).** Here's the trap, and it runs *opposite* to intuition. When I press the manual **End** button, `handleEndCaucus` takes the current caucus speaker and **prepends it to the top of the permanent GSL** — injecting a caucus speaker (or, for Room-Order, a "Speaker N" placeholder) into my GSL and violating strict GSL/caucus separation. If instead I let the Tour's total time run out to **0**, the per-second tick just calls `setRunning(false)` (it stops the clock and does *nothing* to the GSL). So the "clean" path is to let it expire, and the *corrupting* path is the End button a chair naturally reaches for. Knowing this, after Vietnam (the last A→Z speaker) finishes I clear the live caucus speaker (press **Next** past the end, so there is no `currentSpeaker` to inject) *before* I hit **End** — so `handleEndCaucus` has nothing to prepend, and my GSL survives intact.

**Friction — Q2 confirmed (High), and it's counter-intuitive.** The only reason my GSL didn't get corrupted is that I engineered the caucus to have no live speaker at the moment I pressed **End**. A chair who ends a Tour the obvious way — last speaker still showing as currentSpeaker, click **End** — gets that speaker (or a "Speaker N" placeholder) jammed at the top of their permanent GSL. The naming makes it worse: the button literally called "End" is the one that mutates the GSL, while silently running out the clock is safe. Real-room expectation: ending a Tour, by any means, never adds anyone to the GSL. The asymmetry between the End button (injects) and clock-expiry (clean) is a trap laid for exactly the chairs who do the obvious thing.

---

### 2.4 Back to GSL, then Unmoderated Caucus (bloc paper-writing)

**Chair's eye.** Post-Tour I'm back on the preserved GSL (still ~9 deep). Two more GSL speeches (Poland, Mexico), then the room is ready to *write*. Brazil (GRULAC) and Nigeria (African Group) both want drafting time.

**Motion — Unmoderated Caucus (proposed by Brazil).** I key it in via Motions → **Unmoderated Caucus**: Proposed by Brazil, Total = **20 min**. The voting-on-motions card hints **"Simple majority — needs 15 of 29"** (unmod = simple; again cosmetic, Q1). Placards up, I **Accept**.

**What it runs as.** One big countdown (20:00), buttons Start/Pause/Extend/End. **No speaker queue.** GSL preserved.

**Delegate's eye — the caucus scrum.** Phones show the unmod countdown. This is where the *real* work happens off-platform: delegates cluster by bloc. On the Chat tab, side conversations light up:
- **Singapore → Brazil** (DM, 🇸🇬→🇧🇷): *"Sending you PP2 language on transparency & confidence-building measures. Merge into your draft?"*
- **Nigeria → Brazil**: *"African Group wants an equitable-access OP. Non-negotiable for our votes."*
- **Everyone (public thread):** Volkov (Russia) posts *"Any text banning ASAT tests is a non-starter for the Russian Federation."* — classic bloc-signaling.

**Documents submitted (many WPs).** During the unmod, delegates submit working papers from **Documents → Submit**:
- **WP 1.1** — "Transparency & Confidence-Building Measures in Outer Space" — sponsors: Singapore, Japan, Australia, Netherlands (Tan drafts, adds co-sponsors in the form; optional PDF attached).
- **WP 1.2** — "Equitable Access & Non-Weaponization Principles" — sponsors: Nigeria, Kenya, South Africa, Egypt, Brazil.
- **WP 1.3** — "No-First-Placement of Weapons in Outer Space" — sponsors: Russia, China, Iran… (Volkov's counter-text).

On my dais a **badge count of submitted docs** ticks up to 3. Each auto-gets a code (WP 1.1, 1.2, 1.3) and status `submitted`.

**Chair's eye — Extend.** Blocs need five more minutes to reconcile WP 1.1 and WP 1.2. I hit **Extend** (+5 min). This is the clean way to add caucus time — note it's *different* from the +time-on-speaker path that triggers Q5; extending a bare countdown has no per-speech logging to underflow.

**End (Q2-safe here by luck of type).** Because an unmoderated caucus has **no currentSpeaker**, `handleEndCaucus`'s prepend has nothing to grab — so hitting **End** is harmless *for this motion type*. That's the only reason the End button is safe here; on a moderated caucus or Tour with a live speaker it would inject (see §2.3, §2.5). I press **End**. Phase → `speakers-list`, GSL intact.

---

### 2.5 Moderated Caucus — and the max-speakers cap bites (Q-cap)

**Chair's eye.** The room has three WPs and wants to *debate the merge* — specifically, whether an ASAT-test moratorium (WP 1.2/1.1 flavor) or mere "no-first-placement" (WP 1.3) is the spine of the eventual DR. That's a focused topic → **Moderated Caucus**.

**Motion — Moderated Caucus (proposed by Germany).** Motions → **Moderated Caucus**: Topic (required) = "ASAT-test moratorium vs. no-first-placement", Proposed by Germany, Total time = **10 min (600s)**, Per-delegate = **90s**. The form's live preview: **"6 delegates can speak"** (floor(600/90) = 6) and, since 600/90 = 6.67 doesn't divide evenly, a **⚠ "time doesn't divide evenly"** warning. I accept the ragged fit — real caucuses do this all the time.

Voting-on-motions card: **"Simple majority — needs 15 of 29"** (moderated = simple; cosmetic). **Accept.**

**Delegate's eye — loading card.** 3.5s card shows topic, total 10:00, per-speaker 90s, **max speakers 6**. Then the moderated screen: flag + per-speaker timer + **Total-time bar** (visible for moderated, unlike Tour).

**The scramble for six slots.** This is the intended stress test. The moment the caucus opens, delegates rush the caucus Add-Speaker input via requests / placards. I add, in order: **Germany** (mover), **China**, **Nigeria**, **United States**, **India**, **France** — that's **six**, the max.

**Chair's eye — the cap actually bites.** Russia (Volkov, of course) wants in. I try to add Russia via the caucus typeahead. **Blocked** — an **amber message**: adding beyond max speakers isn't allowed (max = floor(remaining/perSpeaker) = 6, and 6 are queued). Then Brazil wants in too — also blocked. Two eager delegations, no room.

**Delegate's eye — shut out.** Russia's phone shows… nothing special. Volkov requested the floor; the request just doesn't get actioned, and there's **no "caucus is full" signal to the delegate** (same class of gap as the quorum silence). From Volkov's seat it looks like the chair is ignoring him — which, procedurally, is exactly what's happening, but the software gives the delegate no reason.

**Friction — NEW (Medium): the max-speakers cap is invisible to delegates.** The chair sees the amber "full" message; the shut-out delegate sees silence. In a 32-seat room where six slots fill in three seconds, that's ~26 delegations who requested and got no acknowledgment. Real-room expectation: "the moderated caucus is full, no further speakers." The cap is sound; its one-sided visibility is the problem.

**Running the moderated caucus.** Six 90s speeches. Germany frames the merge; China defends "no-first-placement" as the only verifiable regime; Nigeria insists any text carry an equitable-access OP; the US pushes verification/TCBMs; India threads the needle; France backs a hybrid. **Next** logs each caucus speech's seconds (all clean positives — I don't touch +time this round, having learned from Q5).

**The Total bar runs low.** After France finishes, I first press **Next** to clear France out of the currentSpeaker slot (leaving no live caucus speaker), *then* press **End** — so `handleEndCaucus` has nothing to prepend into the GSL (Q2). Had I clicked **End** while France was still the currentSpeaker, France would have been injected at the top of my permanent GSL. Phase → `speakers-list`, GSL still intact.

---

### 2.6 Right of Reply — and it does NOT enter the GSL (Q3)

**Chair's eye.** During the moderated caucus, China (in its 90s) named Russia's ASAT test as "the very behavior this committee must curb." Back on the GSL floor, Russia demands a **Right of Reply**. I open the **Right of Reply** overlay, type "Russia," pick **30s**, click **Grant**.

**What RTR does (Q3).** An **independent 30s countdown overlay** runs. Volkov replies (indignantly). Crucially: **RTR does NOT insert Russia into the GSL.** It runs a standalone timer and logs a right-of-reply scoring event — nothing more.

**Friction — Q3 confirmed (Low, but documentation-critical).** `AGENTS.md` claims RTR "inserts a delegate at the TOP of speakersList with a custom time override." The code does **not** do that (per briefing §2 and Q3) — it's a standalone timer + score event. My GSL order is unchanged after Russia's reply; the next GSL speaker is whoever was already position #2. In practice this is *fine* for the room (an RTR shouldn't jump the GSL queue anyway), but the internal docs are wrong, which will mislead the next engineer. Severity Low for the room, but flag-worthy for maintainers.

**Delegate's eye.** Russia's phone during RTR: the Session floor card doesn't change to "you have the floor" via the GSL machinery (Volkov isn't *in* the GSL) — the reply is a chair-run overlay. Volkov speaks, timer ends, and the GSL simply resumes with its pre-existing next speaker. From the floor it reads as a clean interjection.

---

### 2.7 Merging Working Papers → a single Draft Resolution (many co-sponsors)

**Chair's eye.** The room has consolidated. In the corridors (unmod + chat), WP 1.1 (TCBMs, Singapore-led) and WP 1.2 (equitable access, Nigeria-led) have reconciled; Brazil (Costa) has done the actual merging work and even folded in a watered "no-first-placement" nod to keep China/Russia at the table. There is **no formal amendment feature** in Gavelling (Q9) — so "merging" happens the only way it can: **a brand-new document is submitted**, superseding the WPs.

**Draft Resolution submitted.** Brazil submits from **Documents → Submit**: type **DR**, title "Preventing an Arms Race in Outer Space — A Comprehensive Framework," auto-code **DR 1/1**, and a **long co-sponsor list** added in the form: **Brazil, Singapore, Nigeria, Kenya, South Africa, Egypt, Japan, Australia, Netherlands, Germany, India, Mexico, Chile, Indonesia** — 14 co-sponsors. Status `submitted`. My dais doc badge shows the DR alongside the three now-superseded WPs.

**Friction — Q9 confirmed (Medium).** In a real GA the merge would be *amendments* to a lead WP, or a friendly consolidation with a documented trail. Gavelling has no amendment object, so the three WPs just sit at `submitted` forever while a fourth doc (the DR) carries the actual consensus. There's no linkage — a reader of the Documents tab can't tell that DR 1/1 *is* WP 1.1 + 1.2 merged. The history is lost. Real-room expectation: amendments and merges are tracked; here they're informal and orphaned.

**Chair's eye — the WPs' fate.** WP 1.3 (Russia/China no-first-placement) was *not* merged — Volkov refused to co-sponsor a text with verification teeth. It remains `submitted`, a live alternative. I could **Introduce** it too, but the room's momentum is behind DR 1/1. I leave WP 1.3 on the docket as the dissent-of-record.

---

### 2.8 Introducing the DR + presentation flow

**Chair's eye.** I open the **Documents** modal → Draft Resolutions tab → **Introduce** on DR 1/1. This launches the presentation flow: I set reading time (2 min), presentation time (3 min for Brazil to speak to it), and Q&A time (5 min). PDF screen-share view shows the text on the dais while the reading timer runs.

**Delegate's eye — reading & Q&A.** Every phone can view DR 1/1 in the Documents tab (status now `introduced`). During Q&A, delegates want to grill Brazil — but **they can't raise a point or question from their device** (Q4). Q&A is run verbally; I call on placard-raisers and time them off my dais. Volkov uses his Q&A slot to attack the verification annex.

**WP vs DR divergence.** Per the flow: a **WP would auto-pass after Q&A**. A **DR does not** — after the presentation flow, DR 1/1 is routed to the standalone **`/voting/[code]`** screen for a real placard vote. Correct: a substantive text deserves a real vote.

---

### 2.9 The 2/3 Substantive Vote (`/voting/DISEC7`) — the grind

**Chair's eye.** I open the voting screen. It's chair-operated end to end.

**Step 1 — Voting roll call modal (Q7 lurks).** The screen *first* forces a roll-call modal (A/P/PV sliders) with a present count and majority pies. I re-confirm attendance. **Q7:** this modal **writes statuses back to the DB** — so if I so much as toggle someone here, I've silently changed the *main session's* attendance. I'm careful to only confirm, not change. Cuba and Iran (absent all session) I leave absent; Vietnam wandered in during the unmod, so it's present now. Present-and-voting count: **28**.

**Friction — Q7 confirmed (Medium) + Q8 confirmed (Low-Medium).**
- *Q7:* The voting roll call double-writes to session attendance. A chair who "cleans up" attendance on the voting screen (e.g., marks a delegation absent because they stepped out for the vote) has just altered the canonical session record. That's a surprising side effect of what looks like a vote-only screen. Real-room expectation: a voting roll call is a snapshot, not an edit of the day's attendance ledger.
- *Q8:* Quorum (`1-2`) is **not enforced here**. If enough delegations had left that the room dropped below 16, the voting screen would happily run the vote anyway — quorum only ever gated the GSL/timer/motions. In a real GA, a vote taken out of quorum is invalid. Here nothing stops it.

**Step 2 — Select the DR.** I pick DR 1/1.

**Step 3 — Placard round (the grind, Q4 at its peak).** The screen shows delegations one at a time. For **each of 28 present delegations** I click one of: **For / For with Rights / Abstain / Against with Rights / Against** (or **Pass**, revisited later). Observers excluded. This is 28 manual clicks, and it's the sharpest expression of Q4: in a real GA, delegations raise their own placards and tellers count; here the chair *is* the entire voting apparatus, transcribing 28 placards into 28 clicks under the room's gaze. It's slow, and any misclick is a mis-recorded vote with no delegate-side confirmation.

I record the room:
- **For (broad coalition):** Brazil, Singapore, Nigeria, Kenya, South Africa, Egypt, Japan, Australia, Netherlands, Germany, India, Mexico, Chile, Indonesia, Philippines, Thailand, Argentina, Jordan, Qatar, Sweden, Poland, Italy — **22 For** (the 14 co-sponsors + 8 more won over).
- **For with Rights:** United States (wants to explain its yes-with-caveats on verification) — counts as For, speaks after.
- **Against:** Russia, China, Iran — **3 Against** (no-first-placement bloc; the DR's verification teeth are their red line).
- **Against with Rights:** — none.
- **Abstain:** United Kingdom, France — **2 Abstain** (P5 hedging; won't oppose an equitable-access text, won't endorse the moratorium).

Tally: **For = 23** (22 + US-with-rights), **Against = 3**, **Abstain = 2**. Present-voting = 28. (23+3+2 = 28.)

**Step 4 — Rights speakers.** The US voted "For with Rights," so after the placards the screen runs the rights-speaker sequence: I give the US its chair-timed slot to explain-vote. (Had anyone voted "Against with Rights," they'd speak here too.)

**Step 5 — Result (2/3 supermajority).** Per `substantiveThreshold: 'supermajority-2-3'`: pass requires **For ≥ ⅔ of (For + Against)**. Denominator = For + Against = 23 + 3 = **26** (abstentions excluded, exactly as the room expects). ⅔ of 26 = **17.33 → need ≥ 18**. We have **23 For**. **23 ≥ 18 → PASSES.**

**Delegate's eye — the room reacts.** The result screen shows PASS with the counts. On phones, Documents shows DR 1/1 status → `passed`. Nigeria (Chukwu) and Brazil (Costa) — co-sponsors — light up in the public chat: 🎉. Singapore (Tan) posts a crisp *"TCBM annex adopted. Good work, room."* Russia (Volkov) is stone-faced; the three Against are on record. The two abstainers (UK/France) shrug — abstention did exactly what abstention is for: displeasure without obstruction, and with abstentions out of the denominator, they didn't even raise the 2/3 bar.

**Chair's eye — the grind, quantified.** That single vote was: 1 roll-call reconfirmation modal + 28 placard clicks + 1 rights-speaker timer. On a phone-per-delegate model this would be 28 taps by 28 people in parallel; on Gavelling it's ~30 sequential chair actions. For a 32-seat GA, the vote alone is a five-minute clickathon for one human.

---

### 2.10 A delegate goes absent and rejoins (mid-session dynamics)

**Chair's eye.** Rewind slightly — worth recording that mid-session, **Chile stepped out** during the moderated caucus (real thing: delegate takes a call). When I marked Chile absent, the software removed Chile from **both** the GSL and the caucus queue (correct mid-session behavior — *not* the pre-session guard). Later, Chile's delegate returned and, being absent, had to **request to rejoin** via the AbsentBanner (a join-request → I approve). Chile came back Present-Voting in time for the vote.

**Delegate's eye.** While absent, Chile's Session tab showed the absent state with a "request to join" affordance; on my dais it arrived as a join-request banner alongside the GSL-request banners — *another* thing competing for my single-threaded attention in a 32-seat room.

---

### 2.11 Motion to End Debate (the close)

**Chair's eye.** DR 1/1 has passed; WP 1.3 has no path to the floor without a new caucus, and the room is spent. **United States** (with its rights speech delivered and its caveats on record) moves to **End Debate**. I key it in: Motions → **End Debate** (red button, no time fields).

**The one motion that gets a real yes/no (Q1 asymmetry).** Unlike the caucus motions I merely Accepted, End Debate surfaces an explicit **"Does this motion pass? Yes / No"** confirmation screen. I read the room — the coalition wants to bank the win, the no-first-placement bloc has nothing left to gain — and click **Yes**.

**Friction — Q1 asymmetry confirmed (Medium).** It's genuinely odd that *ending the entire committee* gets a Yes/No gate while *starting a 30-minute caucus* (a far more common, still-consequential act) gets a unilateral Accept with a cosmetic threshold. The gating is inverted relative to how often each is used. Real-room expectation: procedural votes are procedural votes; the ceremony shouldn't depend on the motion type.

**What End Debate does.** `ended_at` set, `expires_at = now + 1h` **in code** (Q10 — the UI/docs imply 72h). Phase → `adjourned`. Both chair and delegates get a two-tab **End View / Session View**, everything read-only. No resume.

**Friction — Q10 confirmed (Medium).** The end screen (and `AGENTS.md`) tell delegates the record persists ~**72 hours**; the code sets **1 hour**. A delegate who returns that evening to pull their Stats/recap or download DR 1/1 finds the committee **gone** — pg_cron reaped it after 60 minutes. Real-room expectation: "you have days" ≠ "you have an hour." This will burn someone who trusts the on-screen promise. Data-loss-adjacent, so I rate it Medium (High if any delegate relied on the record).

**Delegate's eye — the close.** Phones flip to the End View: "This committee has ended," a countdown to deletion. Chukwu screenshots the passed DR before it's gone (wise). Tan checks the Stats tab one last time — and here the Q5 scar shows: Brazil's extended-time GSL speech from §2.2 is missing from Brazil's speech history, so Costa's objective score is one GSL speech + speaking-time light despite having done the most drafting work in the room. The leaderboard under-credits the MVP.

---

### 2.12 Adjournment

Committee adjourned via End Debate. DR 1/1 **passed** under a 2/3 supermajority (23–3–2, denominator 26, needed 18). WP 1.3 remains on record as dissent. Session read-only for one hour, then deleted.

---

## 3. Feature Coverage Checklist

| Feature | Exercised? | Where |
|---------|:---:|-------|
| Committee creation, pasted large roster | ✅ | §2.0 |
| `separateChairCode` / chair suffix | ✅ | §1, §2.0 |
| Settings: `substantiveThreshold = supermajority-2-3` | ✅ | §1, §2.9 |
| Settings: `allowAbstentions = true` (excluded from 2/3 denominator) | ✅ | §2.9 |
| Settings: `vetoMode = none` | ✅ | §1, §2.9 |
| Settings: `quorumThreshold = 1-2` (gate hit + released) | ✅ | §2.1 |
| Single-chair operation | ✅ | throughout |
| Pre-session roll call (3-state sliders, bulk buttons) | ✅ | §2.1 |
| **Below-quorum gating** of GSL/timer/motions (Q8) | ✅ | §2.1 |
| Begin Session → strip absent from GSL | ✅ | §2.1 |
| GSL: chair Add-Speaker typeahead | ✅ | §2.2 |
| GSL: delegate **Request to Speak** → chair Add/Deny | ✅ | §2.1, §2.2 |
| **Large-GSL scale** (7+ queued, "+N more in queue") | ✅ | §2.2 |
| **Simultaneous request stampede** (many delegates) | ✅ | §2.2 |
| currentSpeaker as position #1 (flag/timer/progress) | ✅ | §2.2 |
| Speaker Start / Next / +time / restart | ✅ | §2.2 |
| **Next logs spoken seconds** (scoring) | ✅ | §2.2 |
| **+time scoring underflow (Q5)** | ✅ | §2.2 |
| **Tour de Table (A→Z, all present speak once)** | ✅ | §2.3 |
| Tour queue pre-filled from proposer, Total bar hidden | ✅ | §2.3 |
| **End-button GSL injection vs clean clock-expiry (Q2)** | ✅ | §2.3, §2.5 |
| Unmoderated Caucus (countdown, Extend, End) | ✅ | §2.4 |
| **Bloc/paper-writing during unmod** | ✅ | §2.4 |
| Chat: public thread + DMs (delegate↔delegate) | ✅ | §2.4 |
| **Multiple Working Papers submitted** | ✅ | §2.4 |
| Doc auto-codes (WP 1.1/1.2/1.3), submitted badge | ✅ | §2.4 |
| Moderated Caucus (topic req, per-speaker, Total bar) | ✅ | §2.5 |
| "N delegates can speak" + ⚠ uneven-time warning | ✅ | §2.5 |
| **Max-speakers cap floor(remaining/perSpeaker) bites** | ✅ | §2.5 |
| **Right of Reply — standalone, NOT in GSL (Q3)** | ✅ | §2.6 |
| **WP merge → single DR with many co-sponsors** | ✅ | §2.7 |
| **No amendment feature (Q9)** | ✅ | §2.7 |
| Introduce DR → presentation/reading/Q&A flow | ✅ | §2.8 |
| WP-auto-pass vs DR→voting divergence | ✅ | §2.8 |
| **Voting screen roll-call modal (writes DB — Q7)** | ✅ | §2.9 |
| **Placard round (For/Rights/Abstain/Against)** | ✅ | §2.9 |
| Rights-speaker sequence | ✅ | §2.9 |
| **2/3 supermajority result that PASSES** | ✅ | §2.9 |
| **Quorum NOT enforced on voting screen (Q8)** | ✅ | §2.9 |
| Delegate goes absent mid-session (GSL+caucus removal) | ✅ | §2.10 |
| Absent delegate rejoin via join-request | ✅ | §2.10 |
| **Caucus motions: no tally, cosmetic hint (Q1)** | ✅ | §2.3, §2.4, §2.5 |
| **Hardcoded procedural thresholds (Q6)** | ✅ | §2.3 |
| **End Debate — Yes/No confirm, 1h expiry (Q10)** | ✅ | §2.11 |
| Scoring ledger (motion raised, GSL/caucus speech, DR passed) | ✅ | throughout |
| Feature NOT reached: Consultation of the Whole (CoW board) | ❌ | — used Unmod instead; noted |
| Feature NOT reached: Suspend Debate / resume roll call | ❌ | — closed via End, not Suspend |
| Feature NOT reached: Faculty Advisor nudge | ❌ | — no FA in this room |
| Feature NOT reached: Co-chair / head-chair handoff | ❌ | — single-chair by design |
| Feature NOT reached: veto modes (p5/unanimous/custom) | ❌ | — veto=none by design |

---

## 4. Friction & "Doesn't Make Sense" Log

### Confirmed briefing quirks that bit this run

**Q5 — Extra-time scoring underflow drops the speech (Severity: HIGH).**
*What happened:* I granted Brazil +30s as a courtesy in the opening GSL (§2.2). Brazil finished with time to spare on the extended clock, so `secondsSpoken = limit − remaining` landed ≤ 0, and the `> 0` guard dropped the speech from scoring/stats entirely.
*Why it's wrong:* A delegate who *actually spoke* gets zero credit — and specifically because the chair was generous. It also silently corrupts the leaderboard (Brazil, the room's hardest worker, ends up under-credited, §2.11).
*Real-room expectation:* Extra time is a favor. A delivered speech always counts. Fix: clamp `secondsSpoken` to ≥ 0 and log whenever a speaker actually started, or compute against the *extended* limit.

**Q2 — Auto-expiry of a moderated caucus / Tour injects the current caucus speaker into the permanent GSL; manual End does not (Severity: HIGH).**
> **Correction (verified post-run against source):** this run's original draft had the direction
> backwards. The definitive behaviour, confirmed in `src/app/chair/[code]/page.tsx`, is:
> the **auto-expiry tick** (total caucus clock reaching 0:00 while running, lines ~1426-1445)
> is the path that prepends `currentSpeaker` into the GSL via `reorderSpeakersListInDB(..., 'gsl')`;
> the **manual End button** (`handleEndCaucus`, lines ~1895-1909) is clean — it nulls
> `currentSpeaker` and never touches `speakersList`. (`handleNextCaucusSpeaker` at the time-up
> branch is also clean.) The unmoderated view's own end handler contains the same prepend but
> is a no-op because unmoderated caucuses never hold a `currentSpeaker`.
>
*What happened:* Letting the moderated caucus (§2.5) run its total clock to 0:00 with a delegate still mid-speech prepended that delegate straight into the permanent GSL at position #1. Clicking **End** one moment earlier would have avoided it.
*Why it's wrong:* Two ways to end the same caucus produce two different GSL outcomes, and the corrupting one is the passive path a distracted chair is most likely to hit (the clock ticking to zero while they're doing something else). It violates the app's own strict GSL/caucus-separation rule (RULE 1), and for Room-Order Tour de Table it injects a literal "Speaker N" placeholder as a GSL entry.
*Real-room expectation:* Ending a caucus — by button or by timer — never touches the GSL. Fix: make the auto-expiry tick reuse the same "clear currentSpeaker, don't touch GSL" logic as the manual End button.

**Q1 + Q6 — Caucus motions aren't tallied; the "needs X of Y" hint is cosmetic and ignores configured thresholds (Severity: MEDIUM).**
*What happened:* Every caucus motion (Tour, Unmod, Moderated — §2.3–2.5) showed a "needs N of M" hint but had **no vote** — I just clicked Accept off the placards. The Tour/Consultation hint is hardcoded to 2/3 and the others to simple, regardless of `substantiveThreshold`.
*Why it's wrong:* The number lies to the chair (it would say 2/3 even if I'd configured simple majority) and there's no mechanism to actually count the room. It's procedural theater.
*Real-room expectation:* Either count the vote or don't show a threshold. If shown, it should reflect the committee's real settings.

**Q1 asymmetry — only Suspend/End Debate get a Yes/No gate (Severity: MEDIUM).**
*What happened:* Starting a 30-minute caucus was a unilateral Accept; ending the whole committee got a formal "Does this motion pass? Yes/No" (§2.11).
*Why it's wrong:* The ceremony is inverted relative to frequency and reversibility. Caucus motions are constant; the biggest procedural act (ending) is rare — yet only the rare one is gated.
*Real-room expectation:* Consistent handling of procedural motions.

**Q7 — Voting-screen roll call writes attendance back to the session (Severity: MEDIUM).**
*What happened:* The voting screen's mandatory roll-call modal (§2.9) writes statuses to the DB. Any toggle there silently edits the canonical session attendance.
*Why it's wrong:* A vote-only screen shouldn't mutate the day's attendance ledger. A chair "tidying up" who's in the room for the vote unknowingly rewrites history.
*Real-room expectation:* A voting roll call is a snapshot for that vote, not an edit of session attendance.

**Q9 — No amendment mechanism; WP→DR merges are orphaned (Severity: MEDIUM).**
*What happened:* The three WPs merged into DR 1/1 only by submitting a brand-new document (§2.7). The superseded WPs stay `submitted` forever with no link to the DR that absorbed them.
*Why it's wrong:* A GA runs on amendments and documented consolidations. Here the merge history is lost; the Documents tab can't show that DR 1/1 = WP 1.1 + 1.2.
*Real-room expectation:* Amendments/merges are first-class, tracked objects.

**Q10 — End Debate expiry is 1h in code but UI/docs imply 72h (Severity: MEDIUM).**
*What happened:* End Debate set `expires_at = now + 1h` (§2.11) while the end screen implies days.
*Why it's wrong:* Delegates who trust "72 hours" to grab their stats/recap or the passed DR find the committee deleted after 60 minutes.
*Real-room expectation:* The promised retention window is the actual one.

**Q3 — Right of Reply does not enter the GSL, contradicting `AGENTS.md` (Severity: LOW for the room, but doc-critical).**
*What happened:* Russia's RTR (§2.6) ran as a standalone overlay + score event; the GSL order was unchanged.
*Why it's wrong:* Behaviorally *correct* for the room (an RTR shouldn't jump the GSL), but `AGENTS.md` explicitly says RTR inserts at the top of the GSL. The docs will mislead the next engineer.
*Real-room expectation:* Fine as-is; fix the docs.

**Q8 — Quorum only gates the GSL, never the voting screen (Severity: LOW–MEDIUM).**
*What happened:* The `1-2` quorum blocked GSL/timer/motions pre-session (§2.1), but the voting screen (§2.9) would run a substantive vote regardless of present count.
*Why it's wrong:* A vote out of quorum is invalid in real procedure. Nothing stops it here.
*Real-room expectation:* Quorum gates the *vote* above all else.

### NEW findings from this run

**NEW-1 — Quorum status is invisible to delegates (Severity: MEDIUM).**
*What happened:* Under quorum in pre-session (§2.1), a dozen delegates tapped "Request to Speak" and their requests just hung with no explanation. The chair sees the gate; the floor sees silence.
*Why it's wrong:* In a 32-seat room the chair can't verbally reach everyone, and the app offers no floor-facing "not in quorum" indicator. Delegates conclude the chair is ignoring them.
*Real-room expectation:* The room is told, out loud, that it's not in quorum.

**NEW-2 — The moderated-caucus max-speakers cap is one-sided (Severity: MEDIUM).**
*What happened:* Six slots filled in seconds (§2.5); Russia and Brazil were blocked with an amber message *on the chair's screen only*. The shut-out delegates got no "caucus full" signal.
*Why it's wrong:* ~26 delegations requested and got no acknowledgment. The cap is correct; its invisibility to the floor is the problem (same class as NEW-1 and the quorum gap).
*Real-room expectation:* "The caucus is full, no further speakers" is announced.

**NEW-3 — The single chair is a hard throughput ceiling for a 32-seat room (Severity: MEDIUM, structural).**
*What happened:* Every attendance toggle (32), every GSL request-approval (dozens), every `Next`, every join-request, and every one of 28 placard votes is a single sequential chair action (§2.2, §2.9). There is no batch-approve, no delegate-side motion/vote, no parallelism.
*Why it's wrong:* Q4 as a design premise (delegates can't raise motions or vote from their device) is *defensible* for a 15-seat crisis committee but becomes a genuine bottleneck at GA scale — the chair is a single-threaded transcription service for 32 people, and the vote is a ~30-click solo marathon under time pressure.
*Real-room expectation:* At GA scale, delegations act in parallel (placards, own motions); a real GA has tellers. Gavelling's model doesn't scale linearly with roster size — the chair's workload does.

**NEW-4 — No batch-approve for the GSL request stampede (Severity: LOW).**
*What happened:* When debate opened, ~11 requests landed at once (§2.2) and I approved each with a separate "+ Add to GSL." No "add all" / multi-select.
*Why it's wrong:* Minor at 11, painful at 30. It compounds NEW-3.
*Real-room expectation:* A chair can seat a batch of requesters at once.

**NEW-5 — Odd per-speaker/total division leaves an unusable remainder, and that remainder feeds the Q2 auto-expiry hazard (Severity: LOW).**
*What happened:* 600s / 90s = 6.67 (§2.5) → ⚠ warning, 6 max speakers, ~60s of unusable remainder. Because the last ~60s can't fit another full speaker, the chair often lets the clock simply drain to 0:00 with a speaker still live — precisely the passive auto-expiry state that triggers the Q2 GSL injection.
*Why it's wrong:* The uneven-division warning is cosmetic; combined with the auto-expiry prepend (Q2) the leftover remainder makes it more likely the clock hits zero with a live speaker and corrupts the GSL.
*Real-room expectation:* Either forbid uneven division, or (better) make auto-expiry GSL-safe regardless of whether a speaker is live.

---

*End of run. No source code was modified. Findings above are grounded in `BRIEFING.md` §8 (Q1–Q10) plus the settings enums in `src/lib/settingsStore.ts` confirmed during setup.*
