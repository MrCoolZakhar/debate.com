# Experience Run 04 — Crisis / Historical Cabinet

**"Continuous Crisis Committee — The Cuban Missile Crisis, 1962 (ExComm)"**
A start-to-finish simulation run on Gavelling, narrated from the crisis director's seat, grounded strictly in what the software actually does (per `BRIEFING.md`). No code was changed. This is a thought-experiment stress-test, not a live app run.

---

## 1. Committee Card

| Field | Value |
|---|---|
| **Committee name** | Continuous Crisis Committee — The Cuban Missile Crisis, 1962 (ExComm) |
| **Topic** | "Sixteen days: the Soviet emplacement of medium-range ballistic missiles in Cuba, and the American response." |
| **Format** | Continuous crisis cabinet (US ExComm + adjacent powers), fast pace, directives, backroom deals |
| **Chair** | Single **Crisis Director** (me) — no co-chairs. Crisis rooms need one decisive voice on the dais; a second chair sharing `current_speaker`/timer ownership would slow the tempo and split authority. |
| **Voting members** | ~14 named seats playing US cabinet figures + adjacent nations |
| **Observers** | 2 — "Press Pool" and "UN Secretariat" — present in the room, excluded from votes/quorum |
| **Default speaker time** | 60s (crisis rooms run short; I lowered from the 90s default) |
| **Chair code** | `separateChairCode` ON (default). Full chair code = `EXCOMM62-####`. Only I hold the suffix. |

### Roster (all start absent, per Gavelling's creation default)

**Voting seats (14):**
1. President John F. Kennedy — *"POTUS"* (the President)
2. Robert F. Kennedy — *"Attorney General"*
3. Robert McNamara — *"SecDef"* (Secretary of Defense)
4. Dean Rusk — *"SecState"*
5. Gen. Curtis LeMay — *"USAF Chief"* (the hawkish general)
6. Gen. Maxwell Taylor — *"JCS Chairman"*
7. McGeorge Bundy — *"National Security Advisor"*
8. Adlai Stevenson — *"UN Ambassador (US)"*
9. Douglas Dillon — *"Treasury"*
10. John McCone — *"DCI"* (CIA)
11. Llewellyn Thompson — *"Soviet Affairs"*
12. Nikita Khrushchev — *"USSR Premier"* (played as an in-room adjacent power, crisis-style)
13. Anatoly Dobrynin — *"Soviet Ambassador"*
14. Fidel Castro — *"Cuba"*

**Observers (2, `isObserver: true`):**
15. Press Pool — *"Press Pool"*
16. UN Secretariat — *"UN Secretariat"*

### Key settings chosen, and *why*

- **Veto mode = CUSTOM**, veto list = **{ President (POTUS), USSR Premier (Khrushchev) }**.
  *Why:* This is a two-superpower standoff. A "directive" that neither Washington's principal nor Moscow's principal will accept should be dead on arrival — exactly what a custom veto models. I deliberately did **not** use P5 mode (this isn't the Security Council) and not unanimous (a crisis cabinet that requires every seat including Castro and LeMay to say "For" would never pass anything). Custom lets me hand-pick the two seats whose "Against" is fatal.
- **Substantive threshold = simple majority** (For > Against, abstentions excluded).
  *Why:* Crisis directives should pass on a clear majority; the drama comes from the veto layer, not the base threshold. (Foreshadowing Q6: this base threshold will turn out to be *ignored* for procedural motions anyway.)
- **Motion renaming (Settings → Motions):**
  - Moderated Caucus → **"Directive Debate"**
  - Unmoderated Caucus → **"Backroom"**
  - Tour de Table → **"Round the Table"**
  - Consultation of the Whole → **"War Room Consultation"**
  *Why:* Crisis theatre. I think in cabinet language on the dais, not MUN jargon — "the Attorney General moves for a Directive Debate on the naval quarantine" is the room, not "motion for a moderated caucus."
  **Reality check (confirmed from source):** these renames are **chair-side only**. The renamed label (`caucus.motionLabel`) is written and displayed on the chair cockpit, but the delegate and advisor views never import the motions UI (`MotionsModal` is imported only in `chair/[code]/page.tsx`), and the delegate "Motions" tab is a placeholder. So the crisis flavour lives entirely on my screen; delegates never see "Directive Debate" — their phones just show the caucus running. (New finding — see §4, NEW #9.)
- **Waiting room / chair approval = OFF** (self-admit).
  *Why:* Crisis characters arrive late, get pulled out, come back. I don't want a join-request queue slowing me down when the Soviet Ambassador storms back in mid-crisis. Off = delegates self-admit by opening the link and picking a country.
- **Quorum = none.**
  *Why:* A cabinet of 14 with characters constantly stepping out shouldn't have its GSL frozen because three people are in the "situation room" (i.e. AFK). Crisis > strict quorum. (Also — per Q8 — quorum wouldn't gate the vote screen anyway, so enforcing it on GSL only would just annoy me.)
- **Abstentions = allowed, excluded from denominator.** Standard.
- **`gslRequireNextSpeaker` = OFF.** Crisis GSL is thin and improvised; I don't want the Start button locking because only one person is queued. I'll manage the queue by hand.
- **`hideScoresFromDelegates` = ON.** In a crisis, a visible scoreboard makes delegates play the ledger instead of the crisis. I'll score privately and reveal at the end.

---

## 2. Chronological Run Log

Notation: **[CHAIR]** = what I do on the dais laptop / which Gavelling control. **[FLOOR]** = the delegate's-eye experience on their phone. **[REASONING]** = why. **[FRICTION]** = a friction point (cross-referenced to Q1–Q10 or a NEW finding, detailed in §4).

---

### PHASE 0 — Creation (`/create`)

**[CHAIR]** I open `/create`. There's no "crisis cabinet" preset, so I skip the UNSC-15 preset and **paste my own roster** into the delegate list: the 14 named seats. Name = "Continuous Crisis Committee — The Cuban Missile Crisis, 1962 (ExComm)". Topic as above. Chair name = "Crisis Director." Default speaker time I set to **60s**.

For the two observers, I add "Press Pool" and "UN Secretariat" to the roster like any other seat. **Confirmed from source:** there is **no observer checkbox at creation** — `isObserver` is a *per-delegate toggle the chair flips later* on the roster/roll-call panel (`RollCallPanel` → `toggleObserver` → `setDelegateObserverInDB`), and flipping it also downgrades a Present-Voting delegate to Present. So at creation they're just two extra seats; I'll mark them observers on the roll-call screen in Phase 1. Gavelling generates a 6-char code — call it **`EXCOMM62`** — and a 4-digit chair suffix, say **`4417`**, so the full chair code is **`EXCOMM62-4417`**. `separateChairCode` is ON by default; I keep it. All 16 delegates land in the roster as **absent**.

**[REASONING]** Crisis wants a small, named, character-driven roster. I front-load the whole cabinet but I *know* several "characters" will actually connect late — that's the crisis conceit, and it's a genuine Gavelling flow I want to test (delegates joining after creation / mid-session with self-admit ON).

**[FRICTION — NEW #1, Low]** There is no "crisis committee" primitive at all. No directives feed, no crisis notes/updates channel, no private-info distribution. A crisis director's core loop — *"a U-2 has been shot down over Cuba; here's a crisis update to the room"* — has **no home** in Gavelling. I have to smuggle every crisis update through **chat** (the "Everyone" thread) or verbally. Gavelling is a *parliamentary-procedure* tool; a continuous crisis cabinet is procedurally the thinnest and informationally the richest committee type, and Gavelling optimizes for the opposite. (More in §4.)

**[FRICTION — Q1 preview]** I note at creation that my carefully chosen **substantive threshold (simple majority)** and **custom veto list** will only ever matter on the **resolution voting screen**. Every *caucus* motion in this committee — and a crisis lives on caucus motions — will be Accept/Reject by my unilateral read of the room, with a cosmetic "needs X of Y" hint that ignores my settings entirely (Q1, Q6). I'm effectively configuring a voting system that governs one vote all day.

---

### PHASE 1 — Pre-session / Roll Call (`phase = pre-session`)

**[CHAIR]** I open `/chair/EXCOMM62?chairName=Crisis%20Director`. The cockpit loads on the **roll call screen**: the roster with a 3-state slider (Absent → Present → Present-Voting) per seat, plus bulk **Clear All / All Present / All P+V**.

Reality of a crisis start: not everyone is here. As characters connect I watch them flip. Let me narrate the live joins.

**[FLOOR — President Kennedy joins]** The player for POTUS opens `/delegate/EXCOMM62?country=POTUS`. Waiting room is OFF, so he **self-admits** — picks "President John F. Kennedy" from the country list and he's in. His phone shows four tabs: **Session / Documents / Chat / Stats**. Session tab shows a grey floor card: *"Not on any speaker list."* Session status: *pre-session / roll call.* He can't do anything procedural yet.

**[CHAIR]** I flip POTUS to **Present-Voting**. Same for SecDef (McNamara), SecState (Rusk), NSA (Bundy), Soviet Affairs (Thompson), Treasury (Dillon), DCI (McCone), JCS (Taylor), UN Amb Stevenson, Cuba (Castro). I use the sliders individually because I want to *see* who's actually connected vs. who I'm marking optimistically.

**[FLOOR — the hawk arrives loud]** Gen. Curtis LeMay (USAF Chief) self-admits. First thing he does: opens **Chat → Everyone** and posts *"We should take out the missile sites Monday morning. Full airstrike. This talk of a blockade is weakness."* Every phone in the room and my dais both light up. Classic LeMay. **[REASONING]** I let it stand — crisis chat is the room's texture — but I make a private note (feedback) that LeMay is pre-committing to escalation, which will matter for scoring "Diplomacy" later.

**[FLOOR — the Soviets]** Dobrynin (Soviet Ambassador) self-admits and immediately DMs me privately (**Chat → individual chair 🪑**): *"Director — for the record, the USSR will characterize any airstrike as an act of war. I request the floor early."* Khrushchev (USSR Premier) is **not connected yet** — his player is late. I mark Khrushchev **Present-Voting anyway** (optimistically) because he's a *veto seat* and I need him countable; I'll correct if he never shows.

**[FRICTION — NEW #2, Medium]** I just marked a **veto-list seat present without the player being connected.** Gavelling has no link between "is this delegate's device actually connected" and "is this seat present/voting." Presence is 100% chair-asserted. In a crisis where a veto seat's vote is decisive, I can (accidentally or deliberately) mark an absent human as Present-Voting, and later the voting screen will happily let me record a veto "Against" for a seat nobody is operating. The tool trusts the dais completely. (Detail in §4.)

**[CHAIR]** Observers: on the roll-call panel I hit the **observer toggle** for **Press Pool** and **UN Secretariat** (`toggleObserver`). This flips `is_observer = true` and — confirmed from source — automatically downgrades them from any Present-Voting state to plain **Present** (observers can't be voting). From this point they're excluded from the voting roster (`voting/[code]` filters `!d.isObserver`) and from quorum math (`chair/[code]` computes `presentCount`/`totalCount` over `!d.isObserver`). I set quorum to none anyway, so quorum is moot; the observer exclusion matters on the voting screen.

**[CHAIR]** Not connected / left absent at start: **RFK (Attorney General)** and **Gen. Maxwell Taylor's** player is flaky — actually Taylor I already marked present. Let me hold **RFK absent**: his player texted (out-of-band) he'll join in ~15 minutes. Perfect — RFK will be my scripted **late join mid-crisis** test.

**[CHAIR]** I press **Begin Session**. Phase → `speakers-list`. At this transition Gavelling strips any absent delegates from the GSL — but the GSL is empty right now (nobody queued during roll call), so nothing is stripped. RFK, being absent, simply isn't in the session's active voting count yet.

**[FLOOR]** Every connected phone flips from "roll call" to the live session. Floor cards go grey ("Not on any speaker list"). The room is live.

**[REASONING]** In real ExComm the meeting just *starts* — there's no roll call ritual. Gavelling forces a pre-session roll call gate. For a crisis that's mild friction (a few seconds), but it's a reminder that the tool's spine is formal MUN, not cabinet improvisation.

---

### PHASE 2 — Opening GSL (`phase = speakers-list`)

**[CHAIR]** I want to take the room's temperature before anyone moves for a caucus. I open the **Add Speaker** typeahead in the bottom bar and seed a short GSL: **SecDef (McNamara)**, then **SecState (Rusk)**, then **UN Amb (Stevenson)**. Speaker time is 60s.

**[FLOOR — McNamara]** McNamara's floor card flips to **amber: "You have the floor!"** as I set him current. Note: the delegate view shows **no countdown timer** — just "🎙️ You Have the Floor." The countdown lives only on my dais. **[REASONING/FRICTION — Q4-adjacent, Low]** Delegates can't see their own clock. In a crisis where a 60s directive pitch is precious, the speaker is flying blind on time; they rely on me to signal. Fine for a small room where I can call "ten seconds," annoying at scale.

**[CHAIR]** I press **Start**. McNamara lays out the blockade concept ("quarantine," to avoid the word "blockade" = act of war). At 0:00 I press **Next**. Gavelling logs McNamara's ~60 spoken seconds (scoring/stats: GSL speech + speaking-time), pops Rusk into currentSpeaker, resets the timer to 60. Rusk speaks. **Next** → Stevenson. Stevenson makes the "take it to the UN Security Council" case.

**[FLOOR — a GSL request]** Thompson (Soviet Affairs) taps **Request to Speak** on his Session tab. My dais shows a green **"GSL request — Soviet Affairs"** banner with **+ Add to GSL / Deny**. I click **+ Add to GSL**. Thompson's card flips to yellow: *"2 speakers until your speech."*

**[FLOOR — LeMay demands the floor, gets denied]** LeMay also taps **Request to Speak**, but he's already spamming Everyone-chat with airstrike advocacy and I want the opening list to stay measured. I click **Deny**. LeMay's phone shows *"Your request was denied"* + a **Request Again** button. He immediately taps Request Again (of course he does). **[REASONING]** I let the second request sit; I'll bring him in during the Directive Debate where his hawkishness is on-topic. **[FRICTION — Low]** From LeMay's seat, "denied" with no reason feels arbitrary — real chairs say *why* ("we'll get to you in the caucus"). Gavelling's deny is silent. I compensate with a DM.

**[CHAIR]** I run **Next** through Stevenson → Thompson. Room's warmed up. Now the crisis engine kicks in: someone will move to caucus.

---

### PHASE 3 — First motion: "Directive Debate" (renamed Moderated Caucus)

**[FLOOR]** RFK **finally connects** — this is my **mid-session late join**. He self-admits (waiting room OFF) into `phase = speakers-list`. His phone drops him straight into a live session already in progress; floor card grey. **[FRICTION — NEW #3, Medium]** RFK joined mid-crisis, but on the dais his delegate status is still **absent** from before — self-admitting as a delegate does **not** flip his attendance to Present. I have to manually notice he's connected and, since we're past pre-session, I have no roll-call slider on the main screen to flip him. The clean way to change his status now is... limited. His seat won't be counted present/voting until I either re-run roll call (via the vote screen's roll-call modal, Q7) or he's implicitly handled elsewhere. A crisis director should be able to mark a walk-in "present" in one tap from the main cockpit; the roll-call UI is gated to pre-session. (Detail in §4.)

**[CHAIR]** Procedurally, since delegates can't raise motions from their phones (Q4), RFK raises his motion **verbally / via DM**: he DMs me *"Move for a moderated caucus — 10 minutes, 1 minute each — on the naval quarantine option."* I open the **Motions** tab (it was blocked during pre-session; fine now). I click **Raise a Motion**, pick type **"Directive Debate"** (my renamed Moderated Caucus), **Proposed by = Attorney General (RFK)**, Topic = "Naval quarantine of Cuba," Total = 10:00, Per-delegate = 1:00. The form live-shows **"10 delegates can speak"** and no ⚠ (10 divides evenly).

**[FRICTION — NEW #3 continued]** RFK shows in the "Proposed by" dropdown even though his attendance is ambiguous — the dropdown is roster-based, not presence-based for observers/absent nuance. It let me attribute a motion to a seat whose present-status I never cleanly set. Works, but it's a data-integrity soft spot.

**[CHAIR]** I open the **Vote on Motions** view. RFK's Directive Debate is the top card. It shows **"Simple majority — needs 8 of 14 present"** (Moderated/Unmoderated = simple majority hint). There are **Accept / Reject / Edit** buttons.

**[FRICTION — Q1, High]** There is **no actual vote.** No placards, no tally, nothing counted. I *read the room* — the cabinet clearly wants to debate the quarantine — and I click **Accept**. The "needs 8 of 14" text was pure decoration; it ignored my configured settings and counted nothing. In real MUN a moderated caucus is *voted* (simple majority of present). Here the chair is a benevolent dictator on procedure. For a fast crisis this is arguably a *feature* (speed!), but it's dishonest UI: it shows a threshold it never checks. (Q1 + Q6 both bite; see §4.)

**[CHAIR]** On Accept: Gavelling clears all other pending motions (LeMay's re-request... wait — that's a GSL request, not a motion; it survives), sets phase → `moderated-caucus`, builds the `caucus` object (type moderated, topic, total 600s, per-speaker 60s), clears the caucus queue, nulls currentSpeaker. **GSL is untouched** — Thompson etc. still queued underneath, preserved. RFK earns a "motion raised" scoring point.

**[FLOOR]** Every phone shows the **3.5s caucus loading card**: *"Directive Debate — Naval quarantine of Cuba — 10:00 total — 1:00 per speaker — max 10 speakers."* Then the caucus main screen: flag + per-speaker timer + total-time bar.

---

### PHASE 4 — Directive Debate runs; Right of Reply chaos

**[CHAIR]** In the caucus I add speakers via the caucus **Add-Speaker** input (or the side panel flipped to caucus-queue mode). I add, in order: **LeMay** (time to let the hawk speak on-topic), **Dobrynin** (he asked early), **McNamara**, **Rusk**, **Stevenson**, **Castro**.

Max speakers = floor(600/60) = 10; I'm at 6, fine.

**[FLOOR — LeMay, first caucus speaker]** LeMay gets the floor. He goes hot: *"A quarantine is a half-measure. The Soviets put offensive weapons 90 miles from Miami. We should be planning airstrikes for Monday and an invasion by Friday. Anyone counseling restraint is inviting a second Pearl Harbor."* He name-checks Dobrynin: *"The Ambassador's protests are theater."*

**[CHAIR]** That's a direct, personal accusation against a specific delegation. In crisis, **Right of Reply** is the pressure valve. As soon as LeMay's minute ends and I press **Next** (logging his 60s), Dobrynin's phone lights up — but he wants his reply *now*, not in queue. He taps... nothing; delegates can't request RTR from their device. He **DMs me: "Right of reply. He called our position theater and invoked Pearl Harbor."**

**[CHAIR]** I open the **Right of Reply** overlay from the caucus controls (RTR is available in moderated caucus; it's hidden only for Tour). I type "Soviet Ambassador," pick **60s**, click **Grant**. An **independent countdown overlay** runs. Dobrynin (verbally, over voice/room) delivers a blistering reply about American missiles in Turkey.

**[FRICTION — Q3, Medium]** RTR **does not touch the GSL or the caucus queue.** It ran a standalone timer and logged a right-of-reply scoring event for Dobrynin — nothing more. AGENTS.md *claims* RTR inserts the delegate at the top of the queue with a time override; the code does not. This actually matches *real* MUN (a reply is a reply, not a queue insertion), so I *like* the behavior — but the internal docs lie about it, which means a chair reading AGENTS.md would expect Dobrynin to now be "next" in the caucus and be confused when he isn't. **The bug is in the documentation's promise, not the crisis experience.** (Flagged in §4 as Q3.)

**[CHAIR]** Now it escalates. Dobrynin's reply accuses **Stevenson** (US UN Amb) of "lying to the Security Council." Stevenson wants a reply. I **Grant** a second RTR (30s). Stevenson fires back ("I'm prepared to wait for your answer until hell freezes over"). Castro then wants a reply *to Stevenson.* I grant a **third RTR** (30s).

**[FRICTION — NEW #4, Low/Medium]** I'm now three Rights of Reply deep, each a **standalone overlay timer** with no record in any queue and no ordering relationship to the caucus. The caucus's own per-speaker timer and total-time bar are *paused* (or worse, ambiguous) while these overlays run. In a heavy-RTR crisis, RTR is a **modal side-channel** that the caucus total-time accounting doesn't cleanly absorb — I can burn five real minutes on replies while the "10 minute" caucus bar barely moves, or moves confusingly. There's no "RTR stack" view: I'm juggling three reply grants from memory. Real crisis chairs *do* run rapid-fire replies; Gavelling handles one-at-a-time as a blocking modal with no history. (Detail in §4.)

**[CHAIR]** I close out the RTR storm and resume the caucus queue: **Next** → Dobrynin (his actual caucus slot), **Next** → McNamara, and here's where I engineer the **run-out-the-clock** test.

---

### PHASE 5 — Deliberately letting the caucus clock hit 0 (Q2 test)

**[REASONING]** The briefing (Q2) says: when a **moderated caucus total timer hits 0 via the per-second tick** while a delegate is mid-speech, the auto-end handler **prepends the current caucus speaker into the GSL** — mixing a caucus speaker into the permanent GSL, violating strict separation. Manual **End** does *not* do this. I want to *see* it, so instead of ending cleanly I let it expire.

**[CHAIR]** With ~1:10 left on the 10:00 total and McNamara mid-speech (his per-speaker timer running, ~50s into a fresh minute), I **do not** press Next or End. I let both timers tick. The per-speaker timer ends but I let the *total* keep bleeding. When **total time hits 0:00** on the tick, the caucus **auto-ends.**

**[FLOOR]** Every phone snaps out of the caucus back to the session (`phase = speakers-list`). The caucus object nulls, caucus queue clears.

**[FRICTION — Q2, HIGH]** But look at the GSL. **McNamara — the caucus speaker who was mid-speech when the clock died — has been prepended to the top of the General Speakers' List.** He was never on the GSL. The permanent GSL now leads with a speaker who got there via a *caucus timer expiring*, not via Add Speaker or a GSL request. Underneath him, my preserved GSL (Thompson, and whoever else) sits at positions 2+. This is a **direct violation of the GSL/caucus separation** that AGENTS.md swears is inviolable ("THINGS THAT MUST NEVER HAPPEN #1/#2"). And it only happens on **auto-expiry**, not manual End — so the *same* committee state produces *different* GSL contents depending on whether the chair happened to click End at 0:01 vs. let it tick to 0:00. In a crisis, where clocks routinely run out mid-speech because the director is juggling ten things, this will fire *constantly* and silently corrupt the GSL. **This is the single worst finding of the run.** (Full write-up §4.)

**[CHAIR]** I quietly clean up: I use **Remove from GSL** on McNamara to restore the intended GSL. A less vigilant crisis director would never notice, and McNamara would jump the GSL for free.

---

### PHASE 6 — "Backroom" (renamed Unmoderated Caucus) — the deal

**[FLOOR]** RFK DMs: *"Move for a backroom — 8 minutes — to let delegations negotiate directly. The President wants to talk to Thompson and the Soviets privately."* (In real ExComm, RFK's back-channel to Dobrynin is *the* pivotal move — an unmoderated caucus is exactly the mechanic.)

**[CHAIR]** Motions → **Raise a Motion** → type **"Backroom"** (renamed Unmoderated), Proposed by = Attorney General, Total = 8:00. Vote on Motions view: top card, **"Simple majority — needs 8 of 14."** I **Accept** (again, no real tally — Q1). Phase → `unmoderated-caucus`. One big **8:00 countdown**, Start/Pause, Extend, End. No speaker queue.

**[FLOOR]** Phones show the unmod countdown. Delegates get up (metaphorically) and cluster: RFK and Dobrynin in the corner, LeMay lobbying Taylor and McCone for airstrike votes, Castro DMing Khrushchev's (still-absent) seat into the void. The **Chat** carries the backroom: a flurry of DMs. I watch the Everyone thread and the individual threads I'm part of.

**[FRICTION — NEW #5, Medium]** A "backroom" in crisis is *private*, per-delegation dealing. Gavelling gives me the **countdown** and the general **chat**, but delegate-to-delegate DMs happen on their phones **without the chair seeing them** (chair only sees Everyone + threads the chair is in). As crisis director I have **no visibility into the backroom deals** unless delegates loop me in. That's realistic in one sense (backrooms *are* private) but it means the *crisis-defining* activity is invisible to the person running the crisis. There's no "read the room's private traffic" affordance, and no way to inject a crisis twist *into* a specific backroom. (Detail §4.)

**[CHAIR]** Mid-backroom, I **Extend** by 2:00 (RFK signals they're close to a deal). At the deal's conclusion I press **End**. **[REASONING]** I press End *manually* and *before* the clock hits 0 — I do NOT want to trigger Q2 again. For an unmoderated caucus Q2's prepend is harmless (no currentSpeaker), but I'm being disciplined.

**[FLOOR]** Back to `speakers-list`. GSL intact.

---

### PHASE 6b — A general goes rogue; a delegate walks out and rejoins

**[FLOOR — LeMay goes rogue]** The backroom didn't go LeMay's way — the room is coalescing around the quarantine, not his airstrike. He escalates in **Chat → Everyone**: *"Let the record show I formally dissent. If this committee chooses appeasement, the consequences are on this table, not on the Air Force."* Then he DMs me privately (🪑): *"Director, I want a formal Right of Reply against the Attorney General's characterization of airstrike planning as 'reckless.' And I want it on the record for scoring."*

**[REASONING]** This is the crisis director's judgment call. We're between caucuses in `speakers-list`; there's no active speaker for LeMay to reply *to*. **Right of Reply, per source, is only wired into the caucus/GSL speaker controls** (the inline handler at `chair/[code]:2806-2818`) — there's no "standalone RTR outside a live speech" affordance I can cleanly invoke against a *chat* message. **[FRICTION — NEW #10, Low]** A rogue delegate's *dissent* has no procedural home between caucuses. In a real cabinet, LeMay's dissent-for-the-record is a normal beat; in Gavelling I can only (a) note it in his private feedback, or (b) seed him onto the GSL so he can say it aloud on a timer. I choose (b): I **Add Speaker → LeMay** to the GSL, **Start**, let him burn 60s of formal dissent, and **Next**. His dissent is now logged as a GSL speech (scoring credit) — but only because I improvised a GSL slot for what should have been a point of order / RTR. The tool has no "dissent" or "point of order" primitive at all.

**[FLOOR — Castro walks out]** Castro, furious the room is treating Cuba as a bargaining chip between superpowers, **changes his own status to absent** from his Session tab (the 3-per-3h self status control). His phone flips to the **AbsentBanner**; he can no longer request the floor or be queued. On my dais his card greys to absent. **[REASONING]** Because we're mid-session (not pre-session), Gavelling's rule is that going absent **removes the delegate from both the GSL and any caucus queue** — so if Castro had been queued, he'd be pulled automatically. He wasn't queued at that moment, so nothing to strip. This is *correct* crisis behavior (a walkout should drop you from the speaking order), and it worked cleanly.

**[FLOOR — Castro rejoins]** Two minutes later Castro cools off and wants back in. Because **waiting room is OFF (self-admit)**, he taps to set himself **Present-Voting** again directly — no join-request motion, no chair approval needed. **[FRICTION — NEW #11, Low]** But note the rate limit: delegate status changes are capped at **3 per 3 hours**. Castro's walkout + rejoin already burned **2 of his 3** changes. If he storms out one more time (very in-character), he'll be **locked out of changing his own status for the rest of the crisis** and will have to reach me to be re-seated — and, per NEW #3, I have **no main-cockpit slider** to re-seat him mid-session without the vote-screen roll-call side effect (Q7). A volatile crisis character can rate-limit themselves into a corner. Real-room expectation: a chair can always re-seat a delegate; a walkout/return cycle isn't a scarce resource.

**[FLOOR — the Soviet Ambassador's threat]** With Castro back, Dobrynin DMs me one more private line before the round: *"Director — Moscow's position depends entirely on whether the Premier is in the room when the vote comes. He is... en route."* (Khrushchev's player is still not connected.) This is Dobrynin quietly flagging the veto-seat problem back to me — the very issue in NEW #2. I acknowledge and make a decision I'll execute at the vote: I'll voice Khrushchev's seat myself if his player hasn't arrived.

---

### PHASE 7 — "Round the Table" (renamed Tour de Table) in ROOM ORDER

**[REASONING]** The crisis has reached a decision point: quarantine vs. airstrike. I want *every* seat on record, fast, in the physical order of the cabinet table — a **Room Order Tour de Table**. In real ExComm, going "round the table" for each principal's position is exactly how Kennedy polled the room.

**[CHAIR]** Motions → **Raise a Motion** → type **"Round the Table"** (renamed Tour de Table), Per-delegate time = **45s**, order = **Room Order (custom)**. Total = presentCount × 45s (auto-computed). I **Accept** (no vote — Q1, and note the hint here would say **"2/3 majority — needs 9 of 14"** because Consultation & Tour use the 2/3 hint — see Q6). Phase → moderated-type caucus (Tour runs as a moderated caucus under the hood), queue **pre-filled with numbered placeholders**: "Speaker 1," "Speaker 2," … "Speaker N." The **total bar is hidden** (Tour), and there's an **End button in the add bar**. Right of Reply is **hidden** in Tour mode.

**[FLOOR]** Phones show the Tour caucus. But here's the delegate experience: **a delegate looking at the queue sees "Speaker 1, Speaker 2, Speaker 3…" — not names.** A delegate cannot tell *when it's their turn* from the queue, because the placeholders aren't mapped to seats. Their floor card also can't compute "N speakers until you," because there's no delegate identity in the queue. **[FRICTION — NEW #6, Medium]** Room Order Tour is a **chair-driven blind queue** from the delegate's side. I call the room manually ("Speaker 1 — the President"), and only *I* know who "Speaker 1" is. The delegate floor-position feedback (the whole point of the colored floor cards) **goes dark** for the entire Tour. (Detail §4.)

**[CHAIR]** I run the Tour by **calling the room manually**: I press **Start** on "Speaker 1" and *say* "The President." POTUS speaks 45s ("We proceed with the quarantine; we do not fire the first shot"). **Next** → "Speaker 2" — I call "Secretary McNamara." And so on around the table. Because there's no name mapping, the **spoken-time logging attaches to the placeholder, not the real seat** — so my per-delegate speaking-time scoring for the Tour is effectively lost or mis-attributed. **[FRICTION — NEW #6b, Medium]** Room Order Tour speeches **don't credit the real delegate's stats/score** — the queue entry is "Speaker N," not the seat. In a scored crisis, an entire round-the-table of substantive speeches produces no per-delegate scoring. (Detail §4.)

**[CHAIR — Q2 danger, again]** Tour is a moderated-type caucus, so **if a Tour runs out its (hidden) total clock while "Speaker N" is mid-speech, Q2 fires and prepends the "Speaker N" PLACEHOLDER into the GSL.** I now risk a literal *"Speaker 7"* ghost entry contaminating the permanent GSL. I make **very sure** to press **End** manually the instant the last seat finishes, before any auto-expiry. **[REASONING]** This is Q2 at its ugliest: not just a mis-placed real delegate, but a *meaningless placeholder* injected into the GSL. I dodge it by hand, but a distracted crisis director would ship a "Speaker 7" into the GSL and then be baffled when a nonexistent delegate is "next to speak."

**[CHAIR]** I press **End** on the Tour. Phase → `speakers-list`. GSL intact (I verified — no placeholder leaked).

---

### PHASE 8 — The Directive as a Draft Resolution (documents flow)

**[REASONING]** Crisis "directives" have no native Gavelling home (NEW #1). The closest real mechanism is a **Draft Resolution** taken to the **voting screen** — which is exactly where my **custom veto** finally gets to matter. So the "Directive: Naval Quarantine of Cuba" becomes a DR.

**[FLOOR — RFK submits the DR]** RFK opens **Documents → Submit**, type = **Draft Resolution**, title = *"Directive 1: Naval Quarantine of Cuba,"* co-sponsors auto = self (Attorney General) + he adds **President** and **SecDef** as co-sponsors, and attaches a **PDF** of the directive text (uploaded to storage). Gavelling assigns an auto code (**DR 1/1**), status **submitted**. My dais shows a **badge count** on the Documents button.

**[FLOOR — a competing paper]** LeMay, furious the quarantine is winning, submits a **Working Paper**: *"WP: Contingency Air Strike Plan"* (co-sponsors LeMay + Taylor + McCone). Status submitted. **[FRICTION — Q9, Medium]** There's **no amendment mechanism.** LeMay can't *amend* RFK's directive to add "reserve the right to airstrike if the quarantine is run"; he can only file a *competing* document. In real crisis you amend the directive on the floor. Here, amendments are informal-only — I'd have to have someone submit a *new* DR or handle it verbally. For a resolution that's the whole point of the committee, "no amendments" is a real gap. (Detail §4.)

**[CHAIR]** I open the **Documents** modal (two tabs: Working Papers | Draft Resolutions). I decide the **quarantine directive is the live one.** I click **Introduce** on DR 1/1. This launches the **presentation flow**: I set reading time, presentation time, Q&A time; a PDF **screen-share view** shows the directive. RFK (as lead sponsor) presents; Q&A runs.

**[FLOOR]** During Q&A, Dobrynin and Castro grill the sponsors. Delegates on the **View Documents** tab can see DR 1/1 (status **introduced**) and LeMay's WP (status **submitted**) with badges. **[REASONING]** WPs **auto-pass after Q&A**; DRs **go to the /voting screen.** So if I'd introduced LeMay's WP it would just auto-pass with no vote — but I don't introduce it; the directive is a DR and needs the placard vote where my custom veto lives.

**[CHAIR]** Q&A ends. Because DR 1/1 is a Draft Resolution, Gavelling **sends it to `/voting/EXCOMM62`.**

---

### PHASE 9 — The vote (`/voting/[code]`) — custom veto exercised

**[CHAIR]** I open the **voting screen**. First up: the **roll-call modal** (A/P/PV sliders). It shows present count + majority pies. This is a *second* roll call.

**[FRICTION — Q7, HIGH]** This roll-call modal **writes attendance back to the main session DB.** Whatever I set here silently overrides the session's present/absent state. So if I "clean up" the vote roster here — say I finally mark **Khrushchev absent** because his player never showed, or flip **RFK to Present-Voting** to fix the mid-join gap from Phase 3 — I've just **changed who's present in the entire live committee** as a side effect of opening a vote. A crisis director opening the vote screen to *count a vote* does not expect to *mutate session attendance.* (Detail §4.)

**[CHAIR — decision]** This actually *helps* me fix NEW #3: I use the voting roll-call to finally set **RFK = Present-Voting** (he's been operating for an hour). And I confront NEW #2 head-on: **Khrushchev's player never connected.** He's a **veto seat.** Do I mark him absent (removing a veto vote from the roster) or leave him "present-voting" and vote his placard myself as the director playing the NPC? In a continuous crisis, the director often *does* voice absent principals. I choose to **keep Khrushchev present-voting and vote his seat myself** as the crisis NPC — which is defensible crisis practice but means a **veto-decisive vote is cast by the chair, for a seat with no human, with zero guardrail.** (§4, NEW #2.)

**[CHAIR]** **Observers excluded:** Press Pool and UN Secretariat (`isObserver`) **do not appear** in the placard round — correctly excluded from the voting roster. Good: this is the one place my observer setup pays off exactly as intended.

**[CHAIR]** **Placard round.** I click each present delegate's choice — **For / For with Rights / Abstain / Against with Rights / Against** — reading the room from the Tour and backroom:
- **For:** President (POTUS), RFK, McNamara, Rusk, Bundy, Stevenson, Dillon, McCone, Taylor, Thompson — the American consensus for quarantine.
- **Against with Rights:** LeMay (he wants the airstrike; "with rights" so he can speak).
- **Against:** Castro, Dobrynin.
- **The veto seat:** **Khrushchev.** Here's the crisis theatre. I, playing Khrushchev the NPC, must decide his placard. If Khrushchev votes **Against**, my **custom veto** kills the directive **regardless of the 10-For landslide.**

**[REASONING — the veto moment]** Dramatically: does Moscow veto the American quarantine directive? Historically Khrushchev *didn't* stop the quarantine — he blinked. To make the veto mechanic *fire* for the test, I first vote Khrushchev **Against** and watch the result, then re-run.

**[CHAIR — first tally, veto fires]** I finish the round. **Rights speakers** go in order: LeMay speaks his "Against with rights" (airstrike advocacy, 60s on my timer), Dobrynin and Castro have plain Against (no rights). **Result computed by settings:** even though it's **10 For / 3 Against** (a crushing simple-majority win, and well over 2/3), the **custom veto** sees **Khrushchev (veto seat) voted Against → the directive FAILS regardless of tally.** The screen shows **FAILED — vetoed.** DR 1/1 status → **failed**, persisted.

**[FRICTION / FEATURE — custom veto, working as designed]** This is the *one* moment all my careful settings work correctly and meaningfully: a hand-picked veto seat overrides a landslide. It's exactly the crisis dynamic I wanted. **Confirmed from source (`voting/[code]/page.tsx:337-343`):** the veto fires on **either** plain **"Against"** **or** **"Against with Rights"** — line 343 checks both `v.choice === 'against' || v.choice === 'against-rights'`. So a veto principal who reserves a right of reply and still votes against *does* trigger the veto — which is the correct, robust behavior (a veto is a veto). No trap here; I flag the *good* news for the record, and I note the one residual gap is that the UI doesn't visibly signal "this placard just vetoed" beyond the final FAILED result. (§4, NEW #7.)

**[CHAIR — "Vote Again" — the blink]** For the actual crisis narrative, Khrushchev blinks. I hit **Vote Again**, re-run the placard round identically **except Khrushchev now votes For** (Moscow accepts the quarantine to de-escalate). Tally **11 For / 2 Against (Castro, Dobrynin), 0 vetoes against.** Simple majority: For > Against → **PASSED.** Custom veto: no veto seat voted Against → no veto. DR 1/1 status → **passed.** The Directive: Naval Quarantine of Cuba is **adopted.**

**[FLOOR]** Delegate **View Documents** tabs update DR 1/1 → **passed.** The room exhales.

**[FRICTION — Q8, Low]** Note quorum was never checked here — the voting screen doesn't enforce quorum. I set quorum to none anyway, so it's moot for me, but a committee that *relies* on quorum would be surprised that a resolution can pass below quorum. (§4.)

**[FRICTION — Q5 near-miss]** During the rights-speaker phase I gave LeMay **+30s** extra time once. Because `secondsSpoken = limit − remaining`, if LeMay had *ended with leftover added time* the log would go negative and the `> 0` guard would **drop his speech from scoring entirely.** I watched for it: I let his clock run to 0 before Next, so it logged. But this is a live trap in every timed speech where I add time — a crisis, where I hand out +time constantly to let a principal finish a critical point, is the **highest-exposure** committee for Q5. (§4.)

---

### PHASE 10 — Suspend, then End

**[CHAIR]** The room's had a marathon. From the voting screen's **"Back to Session"** panel there's an option to **raise a Motion to Suspend Debate** — convenient. RFK (verbally) moves to suspend for a recess. I use it.

**[CHAIR]** **Suspend Debate** is one of only two motion types that gets a real **"Does this motion pass? Yes / No"** confirmation screen (unlike every caucus — Q1 asymmetry). I click **Yes.** `suspended_at` set, phase → `adjourned`.

**[FLOOR]** Every **delegate phone → full-screen "debate suspended" wait screen.** They can't interact. My dais shows the **two-tab overlay (Suspend View / Session View).**

**[CHAIR — resume test]** After the "recess," I click **Resume** in the Suspend View. As the only chair, I claim the `resuming_chair` lock instantly (no "X is resuming…" contention since I'm solo). Resume sends **everyone back through pre-session roll call.** GSL, chat, documents **survive**; the caucus queue does not (there was none). 

**[FLOOR]** Phones flip from the wait screen back to the **roll-call** view. Delegates wait for me to Begin Session again. **[FRICTION — NEW #8, Low/Medium]** For a *continuous* crisis, a "suspend → recess → resume" that forces the **entire cabinet back through a roll call** is heavy ceremony. In a real crisis recess you just... reconvene. Re-doing the 3-state slider roll call for 14 seats to resume mid-crisis is friction the crisis format specifically doesn't want. (§4.)

**[CHAIR]** I re-run roll call fast (bulk **All P+V**, then knock Khrushchev/absentees down), press **Begin Session** → `speakers-list`. Session live again.

**[CHAIR — End Debate]** The crisis has resolved (quarantine adopted, Soviets blink). Time to close. RFK moves to **End Debate.** This is the other motion with a **Yes/No** confirmation. I click **Yes.**

**[CHAIR]** `ended_at` set, `expires_at = now + 1h` **in code** (Q10 — the docs/UI imply **72h**), phase → `adjourned`.

**[FRICTION — Q10, Medium]** The committee now shows an **End View / Session View** two-tab (read-only). If the End View surfaces a countdown to deletion, it will be **~1 hour**, but any 72h expectation (from docs/UI copy) is wrong — a chair who tells the room "the recap will be available for three days" is misinformed; **pg_cron deletes after 1h.** For a crisis conference where debriefs happen the next morning, a 1h retention window is potentially *destructive* — the whole session (chat, docs, scores, feedback) could be gone before the debrief. (§4.)

**[FLOOR]** All phones → **End View (read-only):** *"This committee has ended,"* countdown, and the session visible but frozen. Delegates can view lists, docs, their **Stats** (speaking history, score, recap) — except I set `hideScoresFromDelegates` = ON, so the numeric score card is hidden; they see factor **recaps** (Diplomacy / Public Speaking / Collaboration / Content) but never my private notes.

**[CHAIR — scoring/feedback wrap]** Before the 1h window closes (Q10 pressure!), I open the **Scoreboard** (trophy icon): objective ledger (attendance, GSL speeches, caucus speeches, speaking-time/10s, motions raised, RTR events, WP/DR sponsorships, DR passed) blended with my **quality factor** scores. I leave **per-delegate feedback**: e.g. LeMay — high Public Speaking, low Diplomacy/Collaboration (he pre-committed to escalation and personalized attacks); RFK — high Collaboration/Content (he drove the quarantine directive and the backroom deal); Dobrynin — high Diplomacy under pressure. **[FRICTION — Q6 + scoring]** I notice the **Room Order Tour speeches** (Phase 7) contributed **nothing** to caucus-speech or speaking-time scoring — they logged to "Speaker N," not the seats — so my scoring under-credits everyone for a whole round-the-table. And the whole DR-passed scoring point went to the *sponsors* of a directive that only passed on my second re-run vote; the first (vetoed/failed) run left DR 1/1 momentarily "failed" — I re-ran, so it's "passed," and sponsors get credit. Timing-sensitive.

**Adjourned. Crisis resolved. Committee ended.**

---

## 3. Feature Coverage Checklist

| Feature | Exercised? | Where |
|---|---|---|
| Committee creation, pasted roster, custom speaker time | ✅ | Phase 0 |
| **Observers** (`isObserver`), present, excluded from vote roster | ✅ | Phase 1, Phase 9 |
| Separate chair code / suffix (`separateChairCode`) | ✅ | Phase 0 |
| **Single chair** (no co-chair) | ✅ | throughout |
| Pre-session roll call (3-state slider, bulk P/PV/Clear) | ✅ | Phase 1, Phase 10 |
| Begin Session → speakers-list (absent stripped from GSL) | ✅ | Phase 1 |
| **Delegate self-admit (waiting room OFF)** | ✅ | Phase 1 (JFK, LeMay, Dobrynin) |
| **Late join mid-session** | ✅ | Phase 3 (RFK) |
| GSL: Add Speaker typeahead | ✅ | Phase 2 |
| GSL: **Request to Speak** (approve + **Deny** + Request Again) | ✅ | Phase 2 (Thompson approved, LeMay denied) |
| currentSpeaker card, Start/Pause, Next, timer logging | ✅ | Phase 2 |
| Delegate floor cards (grey/amber/yellow/green) | ✅ | Phase 1–2 |
| Delegate view has **no countdown** | ✅ (noted) | Phase 2 |
| Motions tab (chair-entered; blocked pre-session) | ✅ | Phase 3 |
| **Renamed motion types** (Directive Debate / Backroom / Round the Table / War Room Consultation) | ✅ | Phase 3, 6, 7 |
| Moderated caucus ("Directive Debate") full run | ✅ | Phase 3–5 |
| Vote-on-Motions view, Accept/Reject/Edit, disruptiveness ranking, cosmetic "needs X of Y" | ✅ | Phase 3 |
| Caucus loading card (3.5s), max-speakers = floor(total/per) | ✅ | Phase 3–4 |
| **Right of Reply** (grant, standalone timer, no GSL touch) — heavy use | ✅ | Phase 4 (3× stacked) |
| Unmoderated caucus ("Backroom") — countdown, Extend, manual End | ✅ | Phase 6 |
| **Tour de Table — ROOM ORDER** (numbered placeholders, chair calls room) | ✅ | Phase 7 |
| **Deliberate caucus auto-expiry** (Q2 trigger, moderated) | ✅ | Phase 5 |
| Documents: WP + **DR** submit, co-sponsors, PDF, auto codes | ✅ | Phase 8 |
| Documents: **Introduce** presentation flow (reading/presentation/Q&A, PDF screen-share) | ✅ | Phase 8 |
| WP auto-pass vs DR → voting screen | ✅ (noted) | Phase 8 |
| **No amendment feature** (Q9) | ✅ (noted) | Phase 8 |
| Voting screen: roll-call modal (writes to DB — Q7) | ✅ | Phase 9 |
| Placard round (For / For w/Rights / Abstain / Against w/Rights / Against) | ✅ | Phase 9 |
| Rights speakers phase (chair timer) | ✅ | Phase 9 |
| **CUSTOM VETO** exercised (fails a landslide, then re-run passes) | ✅ | Phase 9 |
| **Vote Again** re-run | ✅ | Phase 9 |
| Result persists to DR (failed → passed) | ✅ | Phase 9 |
| Quorum NOT enforced on vote screen (Q8) | ✅ (noted) | Phase 9 |
| Suspend Debate (Yes/No confirm) → wait screen → **Resume** (roll call again) | ✅ | Phase 10 |
| End Debate (Yes/No confirm), read-only End View, **1h expiry** (Q10) | ✅ | Phase 10 |
| Chat: Everyone thread + chair DMs + delegate DMs | ✅ | Phase 1, 4, 6 |
| Scoreboard / objective ledger + quality factors + private feedback | ✅ | Phase 10 |
| `hideScoresFromDelegates` (recap only, no numeric) | ✅ | Phase 10 |
| **Consultation of the Whole** ("War Room Consultation") | ⚪ renamed but not run | — (would duplicate Backroom; noted only) |

---

## 4. Friction & "Doesn't Make Sense" Log

Cross-referenced to the briefing's Q1–Q10, plus NEW findings. Severity: **High / Medium / Low**, judged against a real crisis cabinet.

### Confirmed briefing quirks, as they bit this crisis

**Q1 — Caucus motions aren't actually voted; "needs X of Y" is cosmetic.** **Severity: High (for a scored/serious committee), but arguably a Feature for pure crisis speed.**
What happened: Every crisis-defining motion (Directive Debate, Backroom, Round the Table) was **Accept/Reject by my sole judgment**, with a threshold hint that counts nothing and ignores my configured simple-majority setting. Why it's wrong: it displays a specific numeric bar ("needs 8 of 14") it never enforces — that's actively misleading to a chair who thinks the system is tallying placards. Real-room expectation: a moderated caucus is *voted* by present members. **Crisis nuance:** for a fast crisis I *want* to accept a caucus instantly without a formal count — so the *behavior* suits crisis, but the **UI lies** about what it's doing. Fix would be: either show no threshold, or actually count it.

**Q2 — Auto-expiry of a moderated caucus / Tour prepends the current caucus speaker (or "Speaker N" placeholder) into the GSL.** **Severity: HIGH — the worst finding of this run.**
What happened (Phase 5): I let the 10-minute Directive Debate hit 0:00 with McNamara mid-speech; McNamara was **injected at the top of the permanent GSL**. Manual End would not have done this. Why it's wrong: it violates the strict GSL/caucus separation the codebase treats as sacred ("THINGS THAT MUST NEVER HAPPEN"), and it's **non-deterministic from the chair's perspective** — clicking End at 0:01 vs. letting it tick to 0:00 produces different GSL contents. Crisis exposure is maximal: crisis directors let clocks expire *constantly* while juggling RTRs, chat, and documents. **Worse for Room Order Tour (Phase 7):** the injected entry is a meaningless **"Speaker N" placeholder** — a ghost delegate that will then be "next to speak" on the GSL, baffling everyone. Real-room expectation: a caucus ending (by clock or by hand) returns to the GSL *exactly as it was*; a caucus speaker never becomes a GSL speaker. This should be fixed so auto-expiry behaves identically to manual End (no prepend).

**Q3 — Right of Reply doesn't touch the GSL.** **Severity: Low (behavior good), Medium (docs wrong).**
What happened (Phase 4): three stacked RTRs ran as standalone timers + score events; none entered any queue. The *behavior matches real MUN* (a reply is not a queue insertion), so I actually approve. But **AGENTS.md explicitly claims RTR inserts at the top of the GSL with a time override**, which is false. A chair trusting the docs would expect the replying delegate to be "next" and be confused. Real-room expectation: RTR ≠ queue entry (Gavelling is right; its docs are wrong). Fix: correct AGENTS.md.

**Q4 — Delegates can't raise motions or vote from their device.** **Severity: Medium for crisis specifically.**
What happened: RFK's motions to caucus, to suspend, to end — all had to reach me **verbally or via DM**, and I keyed them in. Delegates' phones are follow-along + request-floor + submit-paper + chat only. Why it matters in crisis: crisis is *high motion-density* — directives, caucuses, and side-motions fly every minute. Routing every one through the chair's keyboard makes the **chair the bottleneck** exactly when the room is fastest. In a 14-seat crisis it's survivable (I can type fast); at 40+ it would gridlock. Real-room expectation: delegates raise motions by placard and the chair recognizes them — Gavelling's chair-enters-everything model is a faithful *digitization* of the placard model, but it removes the *parallelism* a real room has (many placards up at once; chair picks). The floor experience for a delegate is oddly passive: you can't *do* procedure, only ask.

**Q5 — +time can make speaking-time logging silently drop a speech.** **Severity: Medium, High-exposure in crisis.**
What happened (Phase 9, near-miss): I gave LeMay +30s. Because `secondsSpoken = limit − remaining`, a speaker who ends with leftover *added* time yields a negative value that the `> 0` guard drops — **no scoring/stats credit for that speech.** Crisis is the highest-exposure committee because I hand out +time constantly to let a principal land a critical point. I avoided it by running his clock to 0, but any distracted +time-then-Next combo loses the log. Real-room expectation: extra time extends the speech; it never *erases* the record of it. Fix: clamp `secondsSpoken` at 0 and account for the extension.

**Q6 — Procedural motion thresholds are hardcoded (2/3 for Consultation/Tour, simple for others) and ignore `substantiveThreshold`.** **Severity: Medium.**
What happened (Phase 7): my "Round the Table" showed a **"2/3 majority — needs 9 of 14"** hint even though (a) I never voted it (Q1) and (b) my committee's threshold config is irrelevant to it. Compounds Q1: the hint is both *uncounted* and *not derived from my settings*. Real-room expectation: procedural thresholds follow the committee's rules of procedure; here they're baked in and cosmetic.

**Q7 — Voting-screen roll call writes attendance to the main session DB.** **Severity: High.**
What happened (Phase 9): opening the vote's roll-call modal let me change present/absent, and that **mutated the live session's attendance.** I *used* this to fix RFK's mid-join status — but that's a workaround exploiting a side effect, not a designed flow. The danger: a chair who merely re-confirms the roster to run a vote can silently flip who's "present" in the whole committee (e.g. mark a briefly-AFK principal absent), affecting GSL eligibility afterward. Real-room expectation: counting votes present ≠ redefining session attendance. These should be decoupled, or at least warned.

**Q8 — Quorum not enforced on the voting screen.** **Severity: Low (moot here).**
I set quorum to none, so a resolution could pass below quorum with no complaint. A quorum-reliant committee would be surprised. For crisis, not enforcing quorum is arguably correct (crisis > quorum), but the inconsistency (quorum gates GSL actions but not the *actual vote*) is odd.

**Q9 — No amendment mechanism.** **Severity: Medium.**
What happened (Phase 8): LeMay could only file a *competing* WP, not **amend** RFK's directive to insert an airstrike-contingency clause. Real crisis and real MUN both amend directives/resolutions live. Gavelling forces amendments to be informal (new doc or verbal). For any committee whose product is a negotiated resolution, this is a genuine feature gap.

**Q10 — End Debate expiry is 1h in code, 72h in docs/UI.** **Severity: Medium (potentially High/destructive).**
What happened (Phase 10): ending set `expires_at = now + 1h`; pg_cron deletes after that. Any 72h promise is wrong. For a crisis conference debriefed the next morning, **the entire session — chat, docs, scores, feedback — can be deleted within the hour**, before anyone reviews it. At minimum the UI/docs must agree; ideally the retention should be long enough to survive a same-day debrief.

### NEW findings surfaced by this crisis run

**NEW #1 — No crisis primitive at all (no directives feed, no crisis-update channel, no private-info distribution).** **Severity: High for this committee type.**
A continuous crisis cabinet's core loop is *the director pushing crisis updates and private intel into the room and to individuals.* Gavelling has **no home** for a "crisis update," no per-delegate private briefing mechanism, and no directive object. I had to smuggle every update through the Everyone chat and every "directive" through the DR/voting flow. Gavelling is a parliamentary-procedure engine; crisis is the format it's least built for. Real-room expectation: a crisis platform has an updates/notes feed and private backroom-info tooling. This is the biggest *structural* mismatch, distinct from any single bug.

**NEW #2 — Presence is 100% chair-asserted; a veto-decisive vote can be cast for a seat no human operates.** **Severity: Medium (High when a veto seat is involved).**
I marked Khrushchev (a **veto seat**) Present-Voting though his player never connected (Phase 1), and on the voting screen I voted his placard myself (Phase 9). No guardrail links "device connected" to "seat present," and nothing warns that I'm casting a *veto-decisive* placard for an unoccupied seat. Voicing absent NPCs is normal crisis practice — but the tool gives zero visibility or friction around it, so accidental (not just intentional) phantom voting is trivially possible. Real-room expectation: at least surface which seats have a live device, especially for veto seats.

**NEW #3 — Mid-session self-admit doesn't set attendance, and there's no way to mark a walk-in present from the main cockpit.** **Severity: Medium.**
RFK self-admitted mid-crisis (Phase 3) but his dais status stayed **absent**; the 3-state roll-call slider is gated to pre-session, so I had **no one-tap way** to mark a live walk-in present without either re-running roll call or (as it turned out) using the voting-screen roll call (Q7 side effect). A crisis director must be able to seat a walk-in instantly. Real-room expectation: "delegate connected mid-session" → one-tap present.

**NEW #4 — Right of Reply is a blocking, historyless modal; a heavy-RTR crisis can't be managed cleanly.** **Severity: Medium.**
Three stacked replies (Phase 4) meant three separate overlay timers with **no RTR queue, no history, and murky interaction with the caucus total-time bar.** Crisis rooms run rapid-fire replies; Gavelling handles one at a time from memory. Real-room expectation: an ordered reply stack and clear accounting of reply time against the caucus clock.

**NEW #5 — The chair can't see (or shape) backroom/DM dealing — the crisis-defining activity is invisible to the director.** **Severity: Medium.**
During the "Backroom" (Phase 6), delegate-to-delegate DMs are private to their phones; I see only Everyone + threads I'm in. I had **no visibility into the deals** and **no way to inject a twist into a specific negotiation.** Backrooms *should* be private from the *room*, but a crisis *director* needs situational awareness and the ability to interfere. Real-room expectation: crisis directors monitor and manipulate backrooms.

**NEW #6 — Room Order Tour de Table blinds the delegate floor cards AND breaks per-delegate scoring.** **Severity: Medium.**
(a) The queue shows "Speaker 1..N" with **no name mapping**, so delegates can't tell when it's their turn and their floor cards go dark for the whole Tour (Phase 7). (b) Spoken time logs to the **placeholder, not the seat**, so an entire round-the-table produces **no per-delegate caucus-speech/speaking-time scoring** (Phase 7, Phase 10). There's no affordance to bind "Speaker N" → a real delegate. Real-room expectation: even a manually-called round should credit the actual speaker and let delegates see their position. Combined with Q2, Room Order is the most fragile motion type here.

**NEW #7 — Veto correctly fires on BOTH "Against" and "Against with Rights," but the moment isn't surfaced in the UI.** **Severity: Low (behavior correct); Medium (feedback gap).**
Confirmed from source (`voting/[code]/page.tsx:343`): the veto check is `vetoList.includes(v.country) && (v.choice === 'against' || v.choice === 'against-rights')`. So a veto principal who votes against *while reserving a right of reply* still triggers the veto — this is the **correct, robust behavior** (a veto is a veto regardless of a right of explanation), and it's a genuine strength worth recording. The residual gap: during the placard round the chair gets **no live signal** that a given placard is veto-decisive — the veto only reveals itself as the final "FAILED — vetoed" result. In a fast crisis where the director is voting an NPC veto seat's placard themselves, a "this vote will veto the resolution" indicator at the moment of the click would prevent surprises. Real-room expectation: the presiding officer knows in the moment that a permanent-member "no" is fatal; the tool should mirror that visibly.

**NEW #9 — Renamed motion types are chair-side only; delegates never see the crisis-flavoured names.** **Severity: Low/Medium.**
Confirmed from source: `MotionsModal` (which builds the renamed `motionLabel`) is imported only in `chair/[code]/page.tsx`; the delegate and advisor views don't import it, and the delegate "Motions" tab is a placeholder. So "Directive Debate," "Backroom," and "Round the Table" render **only on my dais** (`caucus.motionLabel` on the chair cockpit). On a delegate's phone, the caucus just... runs, unnamed in crisis terms. Why it matters: renaming is sold (in Settings) as a committee-flavour feature, but half the room — the delegates — never benefit. In crisis, where the *language* is half the immersion ("the President has convened a Directive Debate"), the flavour dies at the dais. Real-room expectation: if you rename the procedure, the whole room hears the new name. Fix: surface `motionLabel` on the delegate caucus view.

**NEW #8 — Suspend/Resume forces the entire cabinet back through roll call — too heavy for a continuous crisis recess.** **Severity: Low/Medium.**
A crisis "recess and reconvene" (Phase 10) dumped all 14 seats back onto the roll-call screen and made me re-run attendance to resume. Real crisis recesses just reconvene. The ceremony is fine for a formal GA committee, wrong for continuous crisis. Real-room expectation: a "quick resume" that keeps the last-known roster.

**NEW #10 — No "point of order" / "dissent for the record" / out-of-caucus RTR primitive.** **Severity: Low/Medium.**
When LeMay went rogue between caucuses (Phase 6b) and wanted a formal dissent-for-the-record and a Right of Reply against a chat message, there was **no procedural home** for it: RTR is only wired into live speaker controls (`chair/[code]:2806-2818`), and there's no point-of-order or dissent object. I had to improvise a GSL slot so he could say it aloud on a timer. Crisis (and even standard MUN) leans on points of order, points of personal privilege, and formal dissents; Gavelling has none of these. Real-room expectation: standard procedural interjections exist and are logged.

**NEW #11 — Delegate self-status rate limit (3 per 3h) can lock a volatile crisis character out of re-seating.** **Severity: Low.**
Castro's walkout + rejoin (Phase 6b) burned 2 of his 3 allowed status changes. One more in-character storm-out would lock him out of re-seating himself, and — compounding NEW #3 — I'd have no clean main-cockpit way to re-seat him without the vote-screen roll-call side effect (Q7). The rate limit is sensible against spam but wrong for crisis characters who legitimately walk out and return. Real-room expectation: the chair can always re-seat; walkout/return isn't a scarce, self-inflicted lockout.

---

### Top-line severity summary

| # | Finding | Severity |
|---|---|---|
| Q2 | Auto-expiry injects caucus speaker / "Speaker N" placeholder into GSL | **High** |
| Q7 | Voting-screen roll call silently mutates session attendance | **High** |
| NEW #1 | No crisis primitive (updates feed / private info / directives) | **High** |
| Q1 | Caucus motions unvoted; threshold hint cosmetic & misleading | High / (Feature for speed) |
| Q10 | End-debate expiry 1h (code) vs 72h (docs) — data can vanish pre-debrief | Medium (→High) |
| Q4 | Delegates can't raise motions/vote — chair is the procedural bottleneck | Medium |
| Q5 | +time can silently drop a speech from scoring/stats | Medium (High-exposure) |
| Q6 | Hardcoded procedural thresholds ignore settings | Medium |
| Q9 | No amendment mechanism | Medium |
| NEW #2 | Phantom presence; veto-decisive vote castable for an unoccupied seat | Medium (→High) |
| NEW #3 | Mid-session walk-in can't be marked present from cockpit | Medium |
| NEW #4 | RTR is a blocking, historyless modal; heavy-RTR unmanageable | Medium |
| NEW #5 | Chair can't see/shape backroom DMs | Medium |
| NEW #6 | Room Order Tour blinds delegate cards + breaks scoring | Medium |
| NEW #7 | Veto correctly fires on both Against + Against-w/Rights; no live "this vetoes" signal | Low (correct) / Medium (feedback gap) |
| NEW #9 | Renamed motion types are chair-side only; delegates never see them | Low/Medium |
| NEW #10 | No point-of-order / dissent / out-of-caucus RTR primitive | Low/Medium |
| NEW #11 | Self-status rate limit can lock a volatile character out of re-seating | Low |
| Q3 | RTR doesn't touch GSL — behavior good, AGENTS.md wrong | Low (docs) |
| Q8 | Quorum not enforced on vote screen | Low (moot here) |
| NEW #8 | Suspend/Resume forces full re-roll-call | Low/Medium |

---

*End of run. Continuous Crisis Committee adjourned: Directive 1 (Naval Quarantine of Cuba) adopted 11–2 after Moscow withdrew its veto. No source code was modified during this simulation.*
