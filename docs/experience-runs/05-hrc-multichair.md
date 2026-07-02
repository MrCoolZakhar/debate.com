# Experience Run 05 — UN Human Rights Council, Full Dais (Multi-Chair)

*A chairing-agent simulation of a THIMUN-style General Assembly body run on Gavelling,
exercising multi-chair, faculty advisor, chat, competing resolutions, and the full session
lifecycle. This is a thought-experiment against the software as read from source — no code
was changed, no live app was run.*

---

## 1. Committee card

| | |
|---|---|
| **Committee** | UN Human Rights Council (HRC) |
| **Topic** | Protecting Human Rights Defenders in Conflict Zones |
| **Size** | ~24 delegations (mid-size GA-style committee, large enough that a solo chair genuinely needs a co-chair and a runner) |
| **Dais** | Head Chair **Amara Osei** + Co-Chair **Devon Marsh** (both join the same session code) |
| **Faculty Advisor** | **Ms. Traoré**, observing via `/advisor/[code]` |
| **Delegates simulated (named)** | Sofia Reyes (Mexico), Lukas Weber (Germany), Priya Nair (India), Tomás Silva (Brazil) — plus a background roster of ~20 more filled from the GA preset |
| **Default speaker time** | 90s (left at default — this is a GA committee, not crisis; 90s is standard GSL practice) |
| **Substantive voting threshold** | **Simple majority** (chosen deliberately — HRC resolutions in this sim are meant to actually pass or fail on the numbers, not require supermajority, since we want one DR to pass and one to fail cleanly on vote count rather than on a procedural technicality) |
| **Sponsor label** | Custom: "Co-sponsors" (default in Settings → Access, left as-is — this HRC uses standard MUN sponsor terminology, no reason to rename it) |
| **Quorum** | 1/2 present (standard GA quorum — low enough that the 24-seat room doesn't grind to a halt over 2-3 absences, per the "quorum only gates GSL" behavior in Q8, which I plan to stress) |
| **Chair approval / waiting room** | ON — with 24 unknown devices joining a public code, I want to vet who's actually seated before they touch anything |
| **separateChairCode** | ON (default) — chair suffix appended to the code so Devon can join as co-chair without also being findable by delegates guessing the base code |
| **Motion types enabled** | All four caucus types + Suspend/End (this is a full-dais THIMUN sim; I want Tour de Table exercised too even though this run's writeup focuses more on GSL/caucus/voting) |
| **Chat** | Enabled globally — this is the core feature under test this run |

**Why these settings:** This run is explicitly the "full dais" stress test per the brief — the
two things I most want to interrogate are (a) whether Gavelling's multi-chair model survives
contact with a real division-of-labour dais (head chair runs the room, co-chair handles
side-channel diplomacy and paper-shepherding), and (b) whether the voting screen's roll call
and quorum handling hold up when two chairs' devices are both watching the same session
state. Simple-majority threshold was chosen so the "two competing DRs, one passes one fails"
beat lands on real vote-counting rather than a coin-flip supermajority edge case.

---

## 2. Chronological run log

### 2.1 Creation

I go to `/create`. Name: "UN Human Rights Council (HRC)". Topic: "Protecting Human Rights
Defenders in Conflict Zones". I paste a roster of 24 countries rather than using the UNSC-15
preset (this is GA-sized). I add two chair names — **Amara Osei** and **Devon Marsh** — and
one observer, **Ms. Traoré**. I leave speaker time at 90s.

Gavelling generates a 6-character CODE (say `HRC7Q2`) and a 4-digit chair suffix (`8841`), so
the full chair code is `HRC7Q2-8841`. `separateChairCode` is ON by default, which is exactly
right for this committee: I'll hand delegates `HRC7Q2` on the projector and give Devon and
myself `HRC7Q2-8841` privately in a text thread beforehand. All 24 delegates start **absent**
— nobody is "in the room" until the roll call slider says so, which matches the real gavel
process of nobody being seated until the dais says they are.

**Reasoning:** I turn on chair-approval / waiting room in Settings → Access before delegates
start joining, specifically because 24 unknown phones are about to hit a public link and I
want a chance to reject a stray or a duplicate country claim before it clutters the roster.

### 2.2 Both chairs join — the head chair question

Devon and I both open `HRC7Q2-8841` on our own phones roughly ninety seconds apart. I join
first. The dais now shows two presences.

**What I see (Amara, joined first):** the full operational cockpit — Add Speaker input,
Start/Next/timer controls live, Motions tab clickable, Settings gear live.

**What Devon sees (joined second):** the same visual layout, but stamped **"View only ·
Amara is chairing"** — every write control gated behind this status (timer Start/Next, GSL
add/reorder/remove, caucus add/end/extend, RTR) is present but inert. There is **no dedicated
co-chair activity/feedback feed** — I initially assumed one existed (the brief primed me to
look for it), but the view-only state is communicated purely through that one banner plus the
same live-synced cockpit everyone else sees; Devon has to infer what I'm doing from the
cockpit changing under him in real time, the same way a delegate would, rather than through
any purpose-built "co-chair notifications" surface (their words: "it's like watching someone
else drive with the wheel welded down on my side, and no rearview mirror telling me what they
just did").

This is *useful* for a real dais split: Devon can watch the room mirror me in real time and
step in verbally ("Amara, Lukas has had his hand up for two speeches") without accidentally
double-clicking Next and skipping a speaker. But it's also a problem, which I flag in §4 —
"head chair" is decided by **join order**, not by role assignment. If Devon's phone had
reconnected first after a wifi drop, *he'd* become head chair and I'd be frozen out mid-
session with no warning and no way to reclaim it short of him leaving.

**Division of labour I settle into for this run:** I (head chair) run the gavel — GSL, timer,
motions, caucus. Devon (view-only) handles the human side: DMs delegates who look confused,
watches the co-chair feed for anything I missed, and pre-screens documents in the Documents
modal (viewing/reading is not gated by head-chair status — only the mutating buttons are).

### 2.3 Roll call

Roster loads on the pre-session screen: 24 names, all sliders on **Absent**. As delegates
join `/delegate/HRC7Q2?country=…`, I use the individual sliders to cycle each through to
Present or Present-Voting as I visually confirm the placard (in a real committee, this is the
physical roll call — "is the delegation of Brazil present?").

- **Sofia Reyes (Mexico)** joins, and I slide her to **Present and Voting**.
- **Lukas Weber (Germany)** joins two minutes late (stuck in another committee's opening),
  slider stays **Absent** for now.
- **Priya Nair (India)** and **Tomás Silva (Brazil)** join and get **Present and Voting**.

Once ~20 of 24 are seated I hit **All P+V** to bulk-flip the remaining confirmed placards
rather than clicking all of them one by one — with 24 delegations this bulk action is not a
nicety, it's the only way roll call finishes before the room gets restless. I leave three
genuinely absent delegations (including Germany, still not joined) on Absent, and **Clear
All** is available but I don't need it here.

**Delegate experience (Sofia):** she opens the link on her phone, taps the country/name
picker, sees the observer role isn't for her, joins as Mexico. Her screen shows the Session
tab with a grey "Not on any speaker list" floor card and a live roster in the background. She
has no idea her own status slider is being driven from the dais — from her side, she just
sees herself go from a waiting state to full participation.

I click **Begin Session**. Phase flips to `speakers-list`. The three still-absent delegations
(Germany included) are automatically stripped from the GSL at this exact moment — moot right
now since GSL is empty, but this is the rule that will bite later when Lukas finally joins
and has to re-request a spot rather than picking up wherever he'd have been queued.

### 2.4 Faculty Advisor takes her seat

Ms. Traoré opens `/advisor/HRC7Q2`. Her screen is read-only: she sees the live roster,
current speaker, and queue, but every mutating control is simply absent from her UI, not just
disabled — there's nothing to accidentally tap. She has one live tool: **nudge emojis** via
chat. Thirty seconds after Begin Session, she sends a 👍 nudge to the general channel, which
delegates and chairs see as a lightweight "the room feels right" signal — a nice touch that
gives an FA presence without giving her any procedural power. She stays parked here the whole
session, occasionally nudging specific delegates who make strong interventions.

### 2.5 GSL opens, first speeches

Delegates start using **Request to Speak** from their Session tab. Sofia, Priya, and Tomás
all fire requests within the first minute — these land on my chair screen as green "GSL
request" banners. I click **+ Add to GSL** for each, in the order they arrived (I try to
preserve first-come order as a matter of chair fairness even though nothing forces me to).

I also manually add two more delegations via the **Add Speaker** typeahead at the bottom bar
— Kenya and Poland, who raised placards physically-simulated but didn't use the phone
feature, standing in for delegates who prefer the old-fashioned raised placard over the app.

Queue is now: Sofia (Mexico) → Priya (India) → Tomás (Brazil) → Kenya → Poland.

I click **Start** on Sofia. The big timer + progress bar animate down from 90s. Sofia's phone
now shows "🎙️ You Have the Floor" — no countdown on her side (there is deliberately no
delegate-facing timer, per the design), so she's flying a little blind on exactly how much
time remains, which she compensates for by watching my visible cues (a real MUN parallel:
delegates traditionally watch the chair's placard/gavel for a time-check, not their own
stopwatch).

At 15s remaining I give her **+time 15** as a courtesy nudge to finish her thought — this
only touches the live countdown atom, no DB write until I hit Next or Pause. Sofia wraps up
with about 3 seconds of the extended time left. I hit **Next**.

**Flag moment (relates to Q5):** because Sofia finished inside the *extended* time, her
logged `secondsSpoken` computes as `limit − remaining`, and since remaining here is measured
against the boosted ceiling, this can go negative and get silently dropped by the `> 0`
guard. Practically: a delegate who used extra time gets **no speaking-time credit at all**
for that speech in the scoreboard, even though she visibly held the floor for 90+15 seconds.
I confirm this is a real gap in §4.

Priya speaks next, straightforward full 90s, logs cleanly. Tomás speaks, also clean.

Midway through Kenya's speech, **Lukas Weber (Germany)** finally joins. He's now "absent" by
default per the app (auto-marked-absent from the roll-call stripping) and can't just appear
on the queue — he uses the **AbsentBanner "request to join"** flow from his phone, which fires
a join-request motion-equivalent to my screen. I approve him, slide him to Present and Voting,
and he immediately fires a **Request to Speak** to get onto the tail of the GSL. This is the
real-room equivalent of a late arrival quietly informing the dais and getting seated without
disrupting the current speaker — Gavelling handles it acceptably here, though Lukas is now
visibly behind delegates who joined the session after him timewise but requested the floor
earlier; there's no "restore my spot" concept.

### 2.6 Motions — a moderated caucus is raised

After Poland speaks, the room wants to dig into humanitarian corridors specifically. Sofia
(Mexico) raises a **Moderated Caucus** from the floor — verbally, or via a physical placard in
a real room. I key this in myself on the **Motions** tab (delegates can't raise motions from
their device, full stop): Topic "Protection corridors for HRD escorts," Proposed by Mexico,
Total time 12 minutes, Per-delegate time 90s. The live "N delegates can speak" hint shows 8,
no ⚠ (720/90 divides evenly).

I open **Vote on Motions**. Only Sofia's motion is pending, so it's the primary card. It shows
"Simple majority — needs 13 of 24" as the informational hint. **I do not actually poll the
room's placards through the app** — there's no vote-tally mechanic for caucus motions (Q1).
I read the room by eye (most placards up), and click **Accept**. The caucus begins
immediately. GSL (currently Kenya, Poland, Lukas queued) sits untouched in the background,
exactly as it should per the strict separation rule.

**Delegate experience:** Sofia sees her motion accepted and the whole room's screens flip to
the caucus view — 3.5s branded loading card (name, topic, 12:00 total, 90s per speaker, "max
8 speakers"), then the live caucus screen. Priya, having just spoken on GSL, is now free to
also speak in caucus — the GSL and caucus queue are fully independent lists, so she can queue
up again immediately, which is realistic (a delegate isn't "used up" for the day after one
GSL speech).

I run the caucus: add delegates via the caucus Add-Speaker input, Start/Next through six
speakers. At speaker 7, the amber "max speakers reached" message flashes for 6 seconds — I
add speaker 7 anyway since it's informational only (7×90=630 <720, still technically room,
the max-speaker math is a floor() safety margin not a hard cap based on the exact remaining
seconds — good design, doesn't block a chair who's read the clock correctly).

I manually hit **End** with about 90 seconds of caucus time still on the clock, since the room
has organically exhausted its speakers list and further wait is dead air. Manual End is the
clean path: phase back to `speakers-list`, caucus null, caucus queue wiped, currentSpeaker
nulled, GSL fully intact (Kenya, Poland, Lukas still queued exactly as left). I deliberately
chose to test the *manual* end path here as the control case for what I stress later.

### 2.7 Chat — the room starts talking

Chat is heavily used across this session. A sample of the traffic:

- I (Amara) post to **Everyone**: "Reminder: DR submission window closes in 20 minutes. Use
  Documents → Submit."
- **Devon (co-chair)** DMs **Lukas** privately: "Don't worry about missing roll call — you're
  seated now, go ahead and request the floor." Lukas's unread badge on his Chat tab ticks up
  by one; he opens it, sees Devon's flag-badged 🪑 co-chair thread, replies "thank you!"
- **Sofia** DMs me (Amara) directly with a substantive question: "Can Mexico co-sponsor a DR
  that isn't from our bloc?" I answer inline: "Yes — any delegate can co-sponsor any
  introduced or pending DR, no bloc restriction in this committee." This is exactly the kind
  of quiet procedural Q&A a chair fields constantly and chat handles well — no need to
  interrupt the floor.
- **Priya** DMs **Tomás** — this is delegate-to-delegate chat, used here to coordinate a
  rival resolution bloc (see §2.8). I don't see this thread; the chair's cockpit shows the
  Everyone thread and my own DMs, not other people's private delegate-to-delegate messages,
  which is correct privacy behaviour but worth noting the chair can't monitor bloc-building
  through the DM layer even though it's happening on their own platform.
- Ms. Traoré nudges 👍 twice more over the session at two strong interventions.

**Unread badges:** I confirm the badge logic works as expected — my own sent messages never
count against my badge, and opening a thread clears it immediately. With ~24 delegates plus
Devon plus the FA, my Chat tab badge count climbs steadily through the session; I keep an eye
on it during downtime (between speakers) rather than continuously.

### 2.8 Two competing Draft Resolutions submitted

By the DR submission deadline:

- **DR 1/1** — "Draft Resolution on Cross-Border HRD Protection Corridors," sponsored by
  Mexico (Sofia) + India (Priya) + six co-sponsors. Submitted with a PDF attachment.
- **DR 1/2** — "Draft Resolution on National-Sovereignty-Respecting HRD Registries," sponsored
  by Brazil (Tomás) + Kenya + four co-sponsors — the rival bloc Priya and Tomás were
  actually coordinating over DM turns out to be a rival, not an alliance; Tomás's bloc wants a
  registry-based approach that Sofia and Priya's bloc considers weaker on cross-border access.
  This is the natural MUN dynamic of two blocs drafting competing texts on the same topic, and
  Gavelling's independent WP/DR submission with auto-incrementing codes (DR 1/1, DR 1/2)
  handles the mechanics of "who submitted what" cleanly.

I see both land in my Documents modal with a submitted-count badge. I open **Documents**, flip
to the Draft Resolutions tab, and see both listed with status `submitted`.

### 2.9 Introducing and voting DR 1/1 — it fails

I click **Introduce** on DR 1/1. This launches the presentation flow: I set reading time (3
min), presentation time (5 min), Q&A time (7 min). The screen splits — timer on the left, PDF
on the right, screen-share style, so the whole room (mirrored on every device) can read along
without me needing to paste text into chat. Sofia presents; the room Q&A's her for the full 7
minutes (a few tough questions from Tomás's bloc about enforcement mechanisms in non-signatory
states). Q&A auto-completes, and since this is a DR (not a WP, which would auto-pass), it
routes straight to the **/voting** screen.

On `/voting/HRC7Q2`:

1. **Roll call modal** fires first — I re-confirm the room. This is a full 24-name A/P/PV
   slider set, separate from the main session's roll-call UI, and it **writes straight to the
   DB**, live-updating delegate status system-wide (Q7 confirmed in practice — see §4; I
   notice Kenya, who'd stepped out for a phone call, still reads "Present and Voting" from
   twenty minutes ago, and I have to remember to manually flip her to Absent here or her non-
   vote silently counts as an abstention-shaped gap rather than a true absence).
2. I select DR 1/1.
3. **Placard round**: I click through all ~23 present delegations one at a time — For / For
   with Rights / Abstain / Against with Rights / Against. Sofia's own bloc (8 co-sponsors) all
   vote For; Tomás's bloc mostly Against, a few Abstain.
4. Two delegates voted "For with Rights" — they get their rights speeches in sequence,
   30 seconds each, chair-timed.
5. **Result**: simple majority, For > Against required, abstentions excluded from the
   denominator. Tally lands 10 For / 11 Against / 2 Abstain. **DR 1/1 fails.**

Sofia's face (simulated) falls — her bloc miscounted how firmly the room had shifted after
Tomás's Q&A pressure. This is a legitimate, well-modeled MUN moment: a resolution can lose
because the *debate itself* (the Q&A) moved votes, and Gavelling's flow (introduce → Q&A →
straight to vote) captures that causality faithfully.

Devon, watching from the co-chair feed, DMs me: "rough one — you want to let them regroup
before DR 1/2?" I take his advice and announce a 5-minute informal break via chat before
introducing the second resolution.

### 2.10 Introducing and voting DR 1/2 — it passes, then "Vote Again" is tested

I introduce DR 1/2 (Tomás's registry-based approach) the same way — reading, presentation,
Q&A. This time the Q&A is gentler (Sofia's bloc, having just won the debate, is more
conciliatory and asks clarifying rather than adversarial questions). Routes to `/voting`
again.

I skip a *second* full roll call re-confirmation only in narrative shorthand here — in reality
Gavelling fires the roll call modal again since it's a fresh visit to the voting screen; I
re-confirm the same 23 present, this time remembering to check Kenya's status is accurate
since she's back from her call.

Placard round: 15 For / 6 Against / 2 Abstain. **DR 1/2 passes** on simple majority.

To specifically stress the **"Vote Again"** control mentioned in the brief, I intentionally
mis-click one delegate's placard during the round (fat-fingering Poland as Against when their
placard was actually For) and only notice after the result renders. I use **Vote Again** to
reset the round entirely — it clears the full tally and restarts the placard round from
scratch, not just letting me fix one delegate's entry. For a 24-person room, redoing an entire
placard round to fix one mis-click is real friction (noted in §4) — there's no "edit one
vote" affordance, only nuke-and-redo.

Second pass, corrected: 16 For / 5 Against / 2 Abstain. DR 1/2 passes, confirmed. I return to
session via **Back to Session**.

### 2.11 Scoreboard and stress-testing the second chair's visibility

Mid-afternoon lull, I open the **Scoreboard** (trophy icon) to check standings before the
final GSL push. The ranked ledger reflects: attendance credit for everyone present, GSL-speech
points for Sofia/Priya/Tomás/Kenya/Poland/Lukas, caucus-speech points for the same plus a few
others, a motion-raised point for Sofia (the moderated caucus), and DR-sponsor + DR-passed
points that land specifically on Tomás's bloc for DR 1/2 (Sofia's bloc gets DR-sponsor credit
for DR 1/1 but not DR-passed, since it failed).

Devon, still view-only, can see the *same* scoreboard render live from his device — this part
of the app isn't gated by head-chair status, which is correct: the scoreboard is a read
surface, not a write control. He uses this moment to start drafting **feedback** notes for a
few standout delegates (Priya's public speaking, Lukas's recovery from a late start) — chair
feedback/quality-factor scoring is *not* one of the head-chair-locked controls either, so
Devon can genuinely do useful dais work in parallel without needing the gavel. This is the
best version of the multi-chair split working as intended.

### 2.12 A Tour de Table, to close out substantive debate

With time running short, I raise (on behalf of the room) a **Tour de Table** — Per-delegate
time 60s, order **Room Order** (custom, since I want to start from wherever the current GSL
left off rather than strict A→Z). Total = 23 present × 60s ≈ 23 minutes. I accept it the same
unilateral way (Q1 applies here too — no actual vote tally, I just read the room and Accept).

Room Order fills the caucus-style queue with numbered placeholders ("Speaker 1," "Speaker 2"…)
that I call out manually against the physical/simulated room, matching names to slots as we
go — this is the one motion type where Gavelling explicitly expects the chair to do manual
bookkeeping rather than trusting delegate self-service, and it works fine at conversational
pace.

**I deliberately let the clock run all the way to 0** on this Tour de Table rather than
manually ending it, specifically to stress-test Q2. See §4 for what happens.

### 2.13 Suspend Debate for a caucus recess, then Resume

Devon, via the feed, flags that the room wants an extended recess before final GSL closing
statements. I key in **Suspend Debate**, Proposed by 🪑 Chair. This motion type gets the
special **"Does this motion pass? Yes/No"** confirmation (unlike the caucus motions) — I click
Yes.

`suspended_at` is set, phase flips to `adjourned`. Every device flips:
- **My cockpit and Devon's**: two-tab overlay, Suspend View / Session View.
- **Delegate phones** (Sofia, Priya, Tomás, Lukas, everyone): a full-screen "debate suspended"
  wait screen — no interaction possible, not even chat.
- **Ms. Traoré's advisor view**: also frozen to the wait state.

Fifteen minutes later, I click **Resume Session** first, from my device. The `resuming_chair`
lock claims it as me. Devon's screen — still on the Suspend tab — now reads "Amara is
resuming…" with his own Resume button greyed out, which correctly prevents a double-resume
race between two chairs both reaching for the button at once. Everyone is walked back through
**pre-session roll call**: GSL (currently just a couple of names left after the Tour) survives
intact, chat history survives, documents survive, but the (already-empty, post-Tour) caucus
queue does not carry over — moot here since Tour had already ended.

I re-confirm attendance (still ~23 present) and click **Begin Session** again to re-enter
`speakers-list` phase.

### 2.14 Closing GSL, End Debate, and the recap

A short final GSL round for closing statements — Kenya, Poland, and Lukas each get 60s closing
remarks (I temporarily lower speaker time via the presets 45/60/75/90 for this closing round).
I then key in **End Debate**, Proposed by 🪑 Chair, and confirm Yes on the pass screen.

`ended_at` is set, `expires_at` computed (see §4 for the 1h-vs-72h discrepancy I check),
phase `adjourned`. Both chairs and every delegate now see the two-tab **End View / Session
View**. End View shows "This committee has ended" plus a countdown to deletion. Session View
is fully read-only: I confirm the Motions/Documents/Chat buttons are hidden from the header,
timer controls and Add Speaker input are gone, delegate status sliders are inert, but the full
speakers list, chat history (view-only, compose disabled), documents, and stats are all still
browsable — exactly the "conference is over, archive mode" experience a real committee wants
for the last ten minutes while people screenshot their standings.

I open the **Scoreboard** one final time for the closing "awards" moment — Best Delegate
(highest blended score, in this run: Priya Nair, India, on strong public-speaking + DR-passed
sponsor credit), and a couple of Honorable Mentions (Sofia for motion-raised + GSL volume,
Lukas for the graceful late-arrival recovery, informally). Delegates check their own **Stats**
tab recap — each sees their own factor-score feedback (Diplomacy/Public Speaking/Collaboration
/Content) but never Devon's or my private per-speech notes, which stay chair-side only, as
designed.

Ms. Traoré, from `/advisor`, sends one final 👍 nudge to the room before the session locks.

---

## 3. Feature coverage checklist

**Lifecycle**
- [x] Committee creation with paste-roster, dual chair names, observer
- [x] Auto-generated CODE + 4-digit chair suffix, `separateChairCode`
- [x] Pre-session roll call (individual sliders + All P+V bulk action)
- [x] Begin Session → absent-delegate GSL stripping
- [x] Suspend Debate → two-tab overlay (both chair + delegate + FA views) → resume race
      (`resuming_chair` lock, "X is resuming…")
- [x] Resume → pre-session roll call again, GSL/chat/docs survive, caucus queue does not
- [x] End Debate → two-tab End View/Session View, read-only session, expiry countdown

**Multi-chair**
- [x] Two chairs joining same code, head-chair-by-join-order behavior
- [x] View-only co-chair cockpit + co-chair feedback feed
- [x] Confirmed which surfaces are NOT head-chair-gated (Documents viewing, Scoreboard,
      feedback/quality scoring)

**Faculty Advisor**
- [x] `/advisor` read-only join
- [x] Nudge emoji via chat, multiple times across the session

**GSL**
- [x] Request to Speak → chair Add/Deny
- [x] Manual Add Speaker (typeahead)
- [x] Start/Next/+time, speaking-time logging
- [x] Extra-time / negative-seconds edge case surfaced (Q5)
- [x] Absent-mid-session → join-request → re-request-floor flow (Lukas)

**Motions**
- [x] Moderated Caucus raised + accepted (Q1 stress: no real vote tally)
- [x] Tour de Table with Room Order, run to auto-expiry (Q2 stress)
- [x] Suspend Debate / End Debate — the ONLY motions with a real Yes/No confirmation

**Caucus**
- [x] Moderated caucus full lifecycle: 3.5s loading card, max-speakers amber warning, manual
      End (clean GSL preservation)
- [x] Tour de Table auto-expiry (dirty GSL injection — see §4)

**Documents**
- [x] Two competing DRs submitted with PDF, co-sponsors, auto-codes (DR 1/1, DR 1/2)
- [x] Introduce → reading/presentation/Q&A flow, screen-share PDF view
- [x] DR → routes to /voting (vs. WP auto-pass, not exercised this run since committee's
      remit is resolutions/voting, not documented separately)

**Voting**
- [x] Voting-screen roll call (Q7 stress — DB write, stale-status trap)
- [x] Full placard round, For/For-with-Rights/Abstain/Against-with-Rights/Against
- [x] Rights speakers sequence
- [x] Simple-majority result computation, one DR fails / one DR passes
- [x] Vote Again (full-round reset, no single-vote edit)
- [x] Back to Session

**Chat**
- [x] Everyone thread (chair announcements)
- [x] Chair↔delegate DM (Sofia→Amara)
- [x] Co-chair↔delegate DM (Devon→Lukas)
- [x] Delegate↔delegate DM (Priya↔Tomás, invisible to chair — noted)
- [x] Unread badge behavior confirmed
- [x] FA nudge

**Scoring / Feedback**
- [x] Scoreboard reviewed mid-session and at close
- [x] Attendance, GSL-speech, caucus-speech, motion-raised, DR-sponsor, DR-passed score
      sources all triggered naturally by the run
- [x] Chair feedback/quality factors entered by co-chair in parallel
- [x] Delegate Stats-tab recap (factor scores only, no private note)

**Not exercised this run (out of remit, noted not tested):**
- [ ] Unmoderated Caucus / Consultation of the Whole (mentioned, not run in detail)
- [ ] WP auto-pass flow
- [ ] Right of Reply (discussed in friction log via source-check, not narratively run)
- [ ] Chair-approval/waiting-room UI in detail beyond "turned it on"
- [ ] Amendment mechanism (doesn't exist — see Q9)

---

## 4. Friction & "doesn't make sense" log

### F1 (relates to Q2) — Auto-expiry of Tour de Table dumps a placeholder into the permanent GSL
**Severity: High**

What happened: I deliberately let the Tour de Table's total clock run to 0 while "Speaker 14"
(a Room-Order placeholder) was mid-turn, instead of manually clicking End. Confirmed against
source (`src/app/chair/[code]/page.tsx:1426-1444`): the auto-expiry tick handler, when the
countdown hits `0`, does exactly this —

```js
const preCaucusSpeaker = prev.currentSpeaker;
const newSpeakersList = preCaucusSpeaker
  ? [preCaucusSpeaker, ...prev.speakersList.filter(s => s.delegateId !== preCaucusSpeaker.delegateId)]
  : prev.speakersList;
if (preCaucusSpeaker) reorderSpeakersListInDB(prev.id, newSpeakersList, 'gsl');
```

— it takes whatever is in `currentSpeaker` at that instant and **prepends it into the
permanent GSL** via a real DB write (`reorderSpeakersListInDB(..., 'gsl')`). The manual
`handleEndCaucus` path (`page.tsx:1895-1909`), by contrast, sets `caucus: null, caucusQueue:
[], currentSpeaker: null` and never touches `speakersList` at all. In this run, that means a
numbered "Speaker 14" placeholder — not even a real delegation — would show up at the top of
my GSL after the Tour technically ran out the clock, ahead of any real delegate names,
contaminating the list I use for actual closing statements.

Why it's wrong: this directly contradicts the "GSL is permanent and never touched by caucus
mechanics" rule stated everywhere else in the codebase and docs (AGENTS.md Rule 1). It's also
*inconsistent with itself* — the exact same caucus, ended one button-click earlier or later,
produces two different outcomes (clean vs. contaminated GSL) depending purely on whether the
chair or the clock triggered the end.

Real-room expectation: a chair who lets a caucus run out the clock mid-speech simply cuts the
speaker off and moves to the next agenda item — nothing about that "promotes" the interrupted
speaker to next-in-line for general debate. There is no procedural universe where running out
a caucus clock earns you the next GSL speaking slot.

Fix shape (not implemented, just noting the shape of the gap): the auto-expiry tick handler
should call the same "clear currentSpeaker, don't touch GSL" logic the manual End button uses,
rather than a separate prepend-to-GSL path.

### F2 (relates to Q1) — Caucus motions have zero real vote tally; only Suspend/End get a Yes/No screen
**Severity: Medium**

What happened: for every one of the four caucus-type motions I "accepted" this session
(moderated caucus, Tour de Table), I never actually polled the room through the app — I read
placards by eye and clicked Accept. The "needs 13 of 24 (simple majority)" hint on the motion
card is purely cosmetic text; nothing in the flow checks it against an actual count, and it
completely ignores whatever `substantiveThreshold` I configured in Settings (Q6 — I set simple
majority for DRs, but the hint for Consultation/Tour hardcodes "2/3 majority" regardless of
that setting).

Why it's confusing: a chair reading "needs 2/3 majority" naturally assumes the app is doing
something with that number — logging a real tally, gating Accept below threshold, something.
It does none of that. Meanwhile Suspend/End Debate — arguably the *less* frequent, higher-
stakes motions — get a dedicated "Does this motion pass? Yes/No" confirmation screen that
caucus motions never get. The asymmetry runs backwards from what a real committee would want:
routine caucus motions pass and fail dozens of times a session and would benefit from a fast,
lightweight tally UI; Suspend/End are rare enough that a chair reading the room and clicking
one button would be perfectly fine too.

Real-room expectation: in an actual committee, *every* motion technically gets a vote (even
if it's often a fast show-of-placards "any objections? seeing none" nod from the chair) —
what Gavelling models is closer to "the chair has unilateral discretion on procedurals," which
is defensible as a UX simplification for solo chairs, but the cosmetic vote-count hint
actively misleads about what's happening under the hood.

### F3 (new finding) — Head chair is decided by join order, with no reassignment UI
**Severity: High**

What happened: I happened to open the chair link before Devon, so I became head chair purely
by being thirty seconds faster, not by any deliberate role assignment. Confirmed against
source (`src/app/chair/[code]/page.tsx:1374-1391`): chairs are tracked on a Supabase Realtime
presence channel (`chair-presence-${committee.id}`) keyed by `myChairName`, each recording a
`joinedAt: Date.now()` timestamp; seats are sorted ascending by `joinedAt` and the earliest
becomes `headChairName`:

```js
const head = seats[0]?.name ?? myChairName;
setHeadChairName(head);
setIsViewOnly(head !== myChairName);
```

There is no setting, toggle, or "make X head chair" control anywhere in Settings → Access that
lets a dais assign who actually runs the gavel — it's strictly first-to-connect, re-evaluated
live off presence-channel timestamps. This means if my phone drops wifi and reconnects (a
fresh presence join = a fresh, later `joinedAt`), or if I close the tab to switch devices, I
risk Devon's client silently becoming head chair (or a third co-chair, if one existed) with
neither of us receiving any explicit "the gavel has changed hands" notification beyond the
ambient "View only · {headChairName} is chairing" banner text updating (dozens of controls
across the page are gated behind this single `isViewOnly` boolean — timer start/next, GSL
add/reorder/remove, caucus add/end/extend, RTR — so losing the race silently freezes nearly
every write action at once).

Why it's wrong: in a real dais, the chair role is a deliberate assignment made before the
session (usually by the conference's Secretariat) and doesn't shift based on network flakiness
or who happened to tap a link first. A co-chair losing write access mid-session because their
phone hiccuped, with no warning and no way to reclaim it except leaving/rejoining and hoping
to win the race, is a serious operational risk for exactly the kind of large committee (24+
delegates) where a two-person dais is most needed.

Real-room expectation: an explicit "Head Chair" designation set at creation (or reassignable
from Settings by whoever currently holds it), with a visible prompt/confirmation when the
gavel changes hands rather than a passive label swap.

### F4 (relates to Q7 and Q8) — Voting-screen roll call silently overwrites main-session attendance, and quorum never gates the vote
**Severity: Medium-High**

What happened: I ran the voting-screen roll call twice (once per DR). The second time, Kenya
had stepped away and her main-session status still read "Present and Voting" from before her
absence — the voting roll call doesn't flag "this status hasn't been touched in N minutes,"
it just shows whatever's currently in the DB and trusts the chair to catch staleness by
memory. If I hadn't specifically remembered to check, Kenya would have silently been counted
in the voting denominator despite being physically out of the room, and — worse — that same
now-reconfirmed status **persists back into the main session** after the vote, so any drift
between "who's actually in the room" and "who the DB says is in the room" gets laundered
through the voting screen and written back as ground truth for GSL/quorum purposes too.

Why it's wrong: a chair reasonably expects the voting screen's roll call to be a scoped,
temporary check for the purposes of that one vote — not a side channel that can silently
mutate the attendance record everyone else's session relies on for quorum-gating GSL actions.

Real-room expectation: attendance for a substantive vote is normally re-confirmed anyway
(this part is realistic — "clerk, call the roll for the vote"), but a chair would not expect
that re-confirmation to be the *only* record of attendance from that point forward, silently
overwriting the general-session roster with no distinction between "present for this vote"
and "present in the room generally."

Confirmed against source: `cycleRollCallStatus` in `src/app/voting/[code]/page.tsx:478-485`
calls `setDelegateStatusInDB(id, next)` — the identical DB write path (`delegates` table) the
main session's own roll-call sliders use — so there is no scoping at all between "vote roll
call" and "session roll call"; they are, literally, the same write.

**Q8 also confirmed directly on this stress:** I set quorum to 1/2 present specifically to see
it interact with a live vote, and it never did — no `quorum`/`Quorum` identifier appears
anywhere in `voting/[code]/page.tsx`; the setting is defined in `settingsStore.ts` but never
read on this page. I could have run DR 1/2's vote with 3 delegates present out of 24 and
Gavelling would have computed a pass/fail result exactly the same as with 23 present. Quorum
in this app means "can the GSL move" — it has no bearing whatsoever on "can the committee
legally vote," which is backwards from every real quorum's actual purpose.

### F5 (relates to Q5) — Extra time silently zeroes out speaking-time credit
**Severity: Low-Medium**

What happened: Sofia's speech, extended with a courtesy +15s, finished with the extended timer
still running (she wrapped up early inside the bonus time). Because logged seconds are
computed as `limit − remaining` against whatever the current ceiling is, and she finished
before that ceiling ran out, the value can land at or below zero and get silently dropped by
a `>0` guard — she is recorded as if she never spoke for scoring/stats purposes at all, despite
visibly holding the floor for over 90 seconds.

Why it's wrong: the exact delegates a chair is most likely to extend time for (strong,
articulate speakers who are clearly making a good point when the buzzer would otherwise cut
them off) are the ones penalized by this — they lose ALL speaking-time credit, not just the
bonus seconds, purely because of how the subtraction is ordered.

Real-room expectation: extra time granted by the chair should, if anything, count as bonus
credit toward a strong speech, not erase the base speech entirely from the record.

### F6 (new finding) — "Vote Again" is all-or-nothing; one mis-click means redoing all 23 placards
**Severity: Medium**

What happened: I mis-clicked one delegate's placard during the DR 1/2 vote and had no way to
correct just that one entry — **Vote Again** clears the entire round and restarts the placard
sequence from delegate #1, meaning I re-clicked all ~23 placards to fix a single mistake.

Why it's confusing: for a 24-person committee this is a meaningful time cost mid-session
purely to correct dais error, and it also means the *entire vote is redone*, including
delegates whose votes might genuinely shift the second time around (deliberately or not) —
which actually undermines the integrity of the correction rather than fixing it cleanly.

Real-room expectation: a real roll-call vote lets the clerk/chair correct a single
misrecorded placard on the spot ("strike that, Poland votes For") without re-polling the
entire room. A single-vote edit affordance (click one delegate's placard again to change just
that entry, without touching the rest of the tally) would match real practice much more
closely than nuke-and-redo.

### F7 (relates to Q4) — Delegates are fully procedurally silent, which reshapes chair workload at 24-person scale
**Severity: Low (by design, but worth naming)**

What happened: every single motion this session — Moderated Caucus, Tour de Table, Suspend
Debate, End Debate — had to be manually typed into the Motions form by me, selecting the
correct "Proposed by" country from a dropdown, even though in the room it was very obviously
Sofia's placard or Tomás's placard going up first. With 24 delegates this is a real chair
workload multiplier: I am simultaneously running the floor, listening for whose placard goes
up first, and operating a data-entry form, rather than facilitating.

Why it's worth naming (not necessarily "wrong"): this is a legitimate, defensible design
choice for keeping procedural authority centralized with the dais (real MUN chairs *do*
arbitrate whose motion is recognized), but it means Gavelling doesn't reduce chair workload
for the highest-friction part of a large committee — motion traffic — it just digitizes the
same manual process. A large-committee chair would likely want at minimum a delegate-facing
"raise motion" button that queues a request for the chair to recognize/reject (mirroring the
GSL-request pattern that already exists), rather than requiring the chair to originate every
motion from scratch.

Real-room expectation: delegates raise placards; the chair recognizes and the dais
secretary logs it. Gavelling gives the chair the "logging" burden with none of the delegate-
initiated "placard" signal to work from, unlike GSL requests which do have that affordance.

### F8 (new finding) — Delegate-to-delegate DMs are invisible to the chair, enabling untracked bloc formation
**Severity: Low**

What happened: Priya and Tomás's rival-bloc coordination happened entirely over delegate-to-
delegate DM, which neither chair device nor the FA's advisor view can see (by design — this
is correct privacy behavior, not a bug). But it means the chair has literally no visibility
into the platform's own most-used coordination channel for bloc politics, which in a real
committee a chair often has *some* passive awareness of (overhearing hallway conversations,
noticing who's huddled with whom). This isn't something to fix (privacy matters), just worth
naming as a gap between the "chair sees the whole room" mental model and what Gavelling
actually exposes.

### F9 (relates to Q10) — End Debate expiry duration: code vs. stated documentation mismatch
**Severity: Low**

What I expected walking in (per AGENTS.md, which states "72hrs"): a full three days for
delegates to screenshot standings and view the archived session before deletion. Confirmed
against source (`src/lib/committeeService.ts:881-887`), `endDebate` actually sets:

```js
const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
```

— **now + 1 hour**, not 72h. (A separate `suspendSession` path, line ~841-842, uses `+24h` for
a different purpose — so the codebase has *three* different numbers floating around depending
on which doc or function you read: 1h in the actual End Debate code, 24h in Suspend, and 72h
in AGENTS.md's prose.) For a committee this size — 24 delegates wanting to check final
standings, export chat logs, grab their recap — a 1-hour real window is a dramatically shorter
runway than the docs promise before the whole session (including my carefully-built
scoreboard) is permanently deleted by the pg_cron job. This is exactly the kind of quiet
doc/code drift that burns a real chair who tells their delegates "you've got a few days to
check your scores" based on the docs, only for the session to vanish within the hour.

### F10 (new finding) — Co-chair's write-lock has no visible countdown or session-end warning
**Severity: Low**

What happened: throughout the run, Devon's "View only · Amara is chairing" status never gave
him any indicator of *how* he could become head chair if something happened to me (network
drop, phone died) beyond passively waiting to see if the label changed. There's no "claim
chair" button analogous to the Suspend/Resume flow's explicit `resuming_chair` claim
mechanism — the resume flow got a proper "first click wins, others see who's resuming" UX,
but ordinary head-chair status has no equivalent deliberate hand-off control at all, just an
implicit join-order race. This compounds F3: even if the room *wanted* Devon to take over
mid-session (say, I lost connectivity and Devon needed to pick up the gavel to keep the room
moving), there's no clean supported path for that — only an unplanned reconnect race.

---

## 5. Overall verdict

Gavelling's core single-thread chair workflow (GSL, single caucus, single vote) is well-built
and the optimistic-update/realtime-debounce architecture genuinely disappears into the
background — as a chair I never once had to think about it. Where the software visibly
strains is exactly where this run's remit pointed: **multi-chair coordination** (F3, F10 — no
deliberate head-chair assignment, no hand-off UX) and **anything that runs past its own clock
unattended** (F1 — the Tour de Table/moderated-caucus auto-expiry GSL contamination is the
single highest-severity finding of this run, because it silently corrupts the one list
(GSL) the entire codebase and docs insist must never be touched by caucus mechanics). The
voting screen (F4, F6) is solid for a single clean pass but punishes both dais error-recovery
and any drift between "who's really in the room" and "what the DB last recorded." None of
these are fatal for a well-drilled single-chair small committee, but a 24-delegate full-dais
THIMUN-style GA — precisely the shape of committee this run simulated — is exactly the
environment where they'd surface fastest and hurt most.
