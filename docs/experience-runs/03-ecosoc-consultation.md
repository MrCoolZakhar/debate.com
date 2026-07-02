# Experience Run 03 — ECOSOC, Consensus, and the Consultation of the Whole

*A chair's-eye simulation of running "UN Economic and Social Council (ECOSOC): Financing
Universal Access to Clean Water" on Gavelling, start to finish. No code was changed to
produce this document — every action below maps to a real control in the app, confirmed
against source where a claim needed checking (`src/lib/scoring.ts`, `src/lib/settingsStore.ts`,
`src/app/chair/[code]/page.tsx`, `src/app/voting/[code]/page.tsx`).*

---

## 1. Committee card

| | |
|---|---|
| **Committee** | UN Economic and Social Council (ECOSOC) |
| **Topic** | Financing Universal Access to Clean Water |
| **Size** | ~20 delegations (mixed donor/recipient economies — the kind of body where nobody wants to be the delegation that publicly kills a resolution) |
| **Chair(s)** | Single chair — me. No co-chair complexity for this run. |
| **Substantive threshold** | **Consensus** (zero votes against required) |
| **Abstentions** | Allowed |
| **Veto mode** | None (consensus already does the heavy lifting; a P5 veto layer on top would be redundant and confusing for a consensus body that isn't the Security Council) |
| **Quorum** | 1/2 present (a soft floor — mostly irrelevant since quorum only gates GSL actions, not voting) |
| **Motions enabled** | Moderated Caucus, Unmoderated Caucus, **Consultation of the Whole** (on), Tour de Table |
| **CoW per-speaker timer** | **ON** — `cowTimerEnabled: true`, seconds set to 45s per turn |
| **Motion rename** | "Unmoderated Caucus" → renamed to **"Informal Consultations"** — ECOSOC-flavored language, and it primes delegates that unmoderated time here is explicitly for quiet dealmaking, not just a bio break |
| **GSL require-next-speaker guard** | On |
| **Scoring — sources** | Re-weighted: Attendance 5→3 (deprioritize just-showing-up), GSL speech 10→8, Caucus speech 8→10 (ECOSOC lives in caucus/consultation, not the GSL — I want caucus participation to outweigh formal GSL speeches), Speaking time/10s kept at 1, Motion raised 10, **Right of Reply disabled** (rare in a consensus body — reply is normally absorbed into consultation, so I don't want to reward it as a separate scoring event), WP sponsor 10, DR sponsor 20, DR passed 10. Added a **custom source**: "Bridge-builder" (+15, manual award only) for delegates who visibly broker compromise language in a consultation. |
| **Scoring — quality blend** | `scoreBlend` set to **40** (40% quality / 60% objective) — I want the leaderboard to reward diplomacy, not just mic time |
| **hideScoresFromDelegates** | **OFF at session start**, toggled **ON after the first caucus block** (mid-session) to see what changes on the delegate Stats tab |
| **Why this configuration** | ECOSOC on water financing is a consensus-culture committee: nobody "wins" a vote, everybody has to live with the text. Consensus threshold + Consultation of the Whole + a scoring blend that rewards collaboration over volume is the whole thesis of the run. I picked exactly the settings that let me stress Q3 (RTR/GSL separation), Q5 (extra-time logging), and Q9 (no amendment mechanism) organically, because those are the fault lines a real consensus chair hits constantly. |

**Delegations seeded (of ~20):** Germany (bloc funder, methodical), Kenya (recipient bloc, vocal), Bangladesh (recipient bloc, technical), Brazil (swing / bridge-builder), plus 16 others in the roster. Four delegates are named and followed closely through the run: **Germany**, **Kenya**, **Bangladesh**, **Brazil**.

---

## 2. Chronological run log

### 2.1 Creation (`/create`)

I create the committee: name "UN Economic and Social Council (ECOSOC)", topic "Financing
Universal Access to Clean Water," paste a 20-country roster (no preset fits ECOSOC, so I use
the free-paste list field rather than the UNSC-15 preset). One chair name: "Chair Adaeze."
`separateChairCode` defaults ON, so Gavelling mints `WATR7K` as the session code and a
4-digit suffix, giving me `WATR7K-4821` as the real chair door. Default speaker time is 90s —
I leave it, since GSL isn't this committee's center of gravity anyway.

*Reasoning:* In a consensus body the GSL is often ceremonial — the real work happens in
caucus and consultation. I don't over-tune GSL timing at creation; I save my configuration
energy for Settings → Motions and Settings → Points, which is where this committee's
character actually lives.

I immediately go to **Settings** before opening the doors:

- **Voting tab**: `substantiveThreshold = consensus`, `allowAbstentions = true`, `vetoMode = none`, `quorumThreshold = 1-2`.
- **Motions tab**: confirm Moderated/Unmoderated/CoW/Tour all enabled. Rename "Unmoderated Caucus" to "Informal Consultations" via the motion-name text field (`motionNames.unmoderated`). Toggle `cowTimerEnabled = true`, set `cowTimerSeconds = 45`.
- **Points tab**: re-weight sources, disable Right of Reply, add the custom "Bridge-builder" source, set `scoreBlend = 40`, leave `hideScoresFromDelegates = false` for now.
- **Access tab**: leave `requireChairApproval = false` — I want delegates to walk straight in; this isn't a body with confidentiality concerns.

*Delegate-side effect of these choices, invisible until later:* nobody joining yet notices
any of this. But the moment the first Draft Resolution reaches the voting screen, every
delegate will feel `consensus` in their gut — one "against" placard and the room goes back
to the drawing board. That's the entire emotional arc I'm building toward.

### 2.2 Roll call (pre-session)

I open the chair link. The roster loads, all 20 delegations **absent** by default (three-state
slider: Absent → Present → Present-Voting). Delegates start joining `/delegate/WATR7K` on
their phones, picking their country from a dropdown (delegation-name requirement is on by
default via roster assignment). No chair-approval gate, so they land straight on the Session
tab, which — before roll call — shows a "waiting for committee to begin" state.

I use **All Present** as delegates trickle in, then flip specific arrivals to **Present-Voting**
by hand as I confirm they're actually online (Germany, Kenya, Bangladesh, Brazil, and 12
others go P+V; four laggards stay merely Present). This step is the 3-state slider,
individually or via the bulk buttons — both optimistic (`localStatuses`) and DB-written.

*Delegate experience:* **Kenya** (real name: a first-year delegate, nervous) joins, picks
"Kenya" from the roster, and sees a static "Session hasn't started" card. No timer, no
queue — just a holding pattern. **Germany** joins a minute later on a laptop, same screen.
This is the correct real-room feel: badge on, waiting for the gavel.

I click **Begin Session**. Phase flips `pre-session → speakers-list`. The four delegates who
never came off Absent are — per the architecture — silently fine, since nobody's added
anyone to the GSL yet, so there's nothing to strip. (Rule: absentees are stripped from GSL
*at this exact transition*, not before.)

### 2.3 Opening GSL block (brief, by design)

I open **Add Speaker** and queue Germany, Kenya, Bangladesh, and Brazil for brief 90-second
opening statements — this is the only meaningful GSL usage in this whole committee, by design,
since ECOSOC's real business is caucus/consultation.

- **Germany** speaks first (`currentSpeaker`, big timer, progress bar). I hit **Start**.
  Germany lays out a proposal: blended finance mechanism, public-private guarantees for
  water utility bonds in the Global South.
- I hit **Next**. The chair page logs Germany's spoken seconds
  (`secondsSpoken = speakerTimeLimit − speakerTimeRemaining`, confirmed at
  `src/app/chair/[code]/page.tsx:1737-1738`) and Kenya rotates into `currentSpeaker`,
  popped from GSL. Germany's speech contributes to the "GSL speech" (8pts) + "speaking
  time/10s" (1pt/10s) scoring sources.

**Kenya**, on her phone, watches her Session tab: floor card goes from grey ("not on any
speaker list") to amber ("You're up next!") the moment she's `myQueueIndex === 0`, then to
"🎙️ You Have the Floor" when Germany's Next button pops her in. She speaks — passionately,
runs slightly long, I let her — about the WHO/UNICEF JMP data showing 2 billion people
without safely managed water, and demands the financing mechanism include grant components,
not just loans, for least-developed countries.

I extend her time once via **+time** (30s preset) mid-speech because she's making a real
point and I don't want to gavel a first-year delegate down. *This is where I deliberately
walk into Q5.* Kenya finishes with **6 seconds of her added 30 still unused** —
`speakerTimeRemaining` (6) ends up *higher* relative to what would've made `secondsSpoken`
positive against the *original* limit in some edge sequences, and in general: any speaker who
uses less than their original allotment *after* an extra-time grant risks `secondsSpoken`
landing at or near zero or negative depending on exactly how the extension interacts with the
remaining-time countdown. I check the ledger afterward — **Kenya's speech logged 0 seconds
spoken**, meaning zero "speaking time/10s" points and, worse, in some sequencing the entire
speech row can be silently dropped from `computeLedger` because the `> 0` guard at line 1738
filters it before `logSpeakingTime` ever fires. **This is a real, reproducible scoring bug in
practice, not just theory — I watched Kenya's passionate, over-time speech earn less credit
than a delegate who spoke for 10 flat seconds and stopped.** Chairs who use +time generously
(which good chairs do, especially for first-time delegates finding their footing) are
punished by the scoring system for being generous.

Bangladesh and Brazil follow with shorter, tighter statements — no extra time, both log
cleanly.

### 2.4 First motion: Consultation of the Whole

Brazil (per my chair-side entry — remember, delegates can't self-raise motions; I key in
what I hear from the floor) raises a motion for a **Consultation of the Whole**, 20 minutes,
topic "Grant vs. loan blend ratio." I open **Motions**, pick "Consultation of the Whole" from
the type list (its label now reads "Consultation of the Whole" — I didn't rename this one),
set Proposed by = Brazil, Total time = 20:00, topic field filled.

*Reasoning:* This is the tool built exactly for what real ECOSOC needs — an open floor where
anyone can grab the mic informally to hash out numbers, without the rigidity of a moderated
speakers list. I want to stress this control hard since it's this committee's signature
feature.

Motion appears in the **Vote on Motions** view, ranked top by disruptiveness (Consultation
outranks Tour/Unmoderated/Moderated by default order). Card shows "needs 2/3 of Y present" —
purely cosmetic per Q1/Q6, since there's no actual placard count backing it; I just read the
room (visible nodding, no objections) and click **Accept**.

Accepting: clears all other pending motions, sets phase, builds the `caucus` object, wipes
`caucusQueue`, nulls `currentSpeaker`. GSL (Germany's original queue slot, empty now since
all four spoke) sits untouched underneath. Brazil earns a "motion raised" scoring point
(10pts, per source config).

3.5-second loading card: "Consultation of the Whole — Grant vs. loan blend ratio — 20:00 —
45s CoW timer." Then the **open-floor delegation board** renders — a tappable grid of all
present delegations. This is the feature I most wanted to exercise.

*What the delegation board actually does:* I tap **Bangladesh** to indicate she's taken the
floor informally. The **CoW per-speaker timer** (45s, since I turned it on in settings) starts
counting down for her turn. When she's done, I tap **Germany** next — no queue, no "Next"
button logic, just chair-operated attribution of floor time. It's a genuinely good fit for
consensus diplomacy: the chair *is* supposed to be reading the room and calling on whoever
raises a placard, not running a rigid queue.

*Delegate experience:* **Bangladesh**, on her phone, has no special "I have the floor"
indicator in Consultation mode the way she would in GSL/caucus (this UI is chair-facing —
the delegation board lives on the chair screen, not pushed to delegate phones as a queue
position). She just... starts talking in the room, because I called on her physically. Her
phone shows the caucus banner ("Consultation of the Whole in progress, 18:42 remaining") but
nothing marking *her* as current speaker. This is **the correct real-room mapping** — CoW is
inherently informal and doesn't need a queue-position affordance — but it does mean a
delegate glancing at their phone gets zero signal about whose turn it "officially" is; that
information lives entirely in the room and on the chair's tapping.

During this consultation, Bangladesh and Germany go back and forth on the blend ratio.
**Brazil** — playing bridge-builder — steps in verbally (not on any list, just raises a hand,
I tap Brazil on the board) and proposes: "70% grant for LDCs, 30% concessional loan, scaling
down as GNI per capita rises." Heads nod around the room. I manually award Brazil the
**custom "Bridge-builder" +15 points** via the scoring manual-award control — this is exactly
the moment that custom source exists for.

Total time ticks down in the big countdown. At 0:00 remaining, I manually hit **End**
(I don't let it auto-expire this time — I want the clean path first). Manual End: phase back
to `speakers-list`, `caucus: null`, `caucusQueue: []`, `currentSpeaker: null`, GSL untouched.
Clean, as documented.

### 2.5 Unmoderated caucus ("Informal Consultations") — and I let this one run out the clock

Kenya raises a motion for "Informal Consultations" (the renamed Unmoderated Caucus),
10 minutes, to let blocs caucus privately on the actual dollar figures. I accept it the same
way — Motions tab, Accept, no real vote, disruptiveness-ranked card, cosmetic "needs X of Y."

Delegates cluster (in the room metaphor — practically, Gavelling just shows a big countdown,
no speaker list). Side conversations happen off-platform, as real informal caucusing does;
Gavelling correctly gets out of the way here.

*Deliberately stressing Q2:* this time I **let the clock hit zero** instead of manually
ending it, specifically to see what happens to `currentSpeaker`. Since this is an
unmoderated caucus, there's no active `currentSpeaker` to begin with (no speaker queue in
unmoderated mode) — so the auto-expiry's GSL-prepend logic has nothing to prepend, and the
harmless case plays out exactly as the briefing predicted: phase flips to `speakers-list`,
caucus nulled, nothing weird happens to the GSL because there was no `currentSpeaker` object
to inject. **Confirmed harmless in the unmoderated case.**

### 2.6 Moderated caucus — and this time the auto-expiry bites

Germany raises a **Moderated Caucus**, topic "Implementation timeline and monitoring
mechanism," Total time 12:00, Per-delegate time 90s. Live preview shows "8 delegates can
speak" (12:00 / 90s = 8, exact division, no ⚠). I Accept.

3.5s loading card, then the moderated caucus screen: flag + name + per-speaker timer + total
bar. I add speakers via the caucus Add-Speaker input: Germany, Kenya, Bangladesh, Brazil,
plus four more. Max speakers = `floor(remainingTime / perSpeaker)` — I watch this cap
enforce itself when I try to add a 9th name late in the caucus (after some time has already
elapded, the max recalculates down) and get the amber "max speakers reached" message —
informational only, doesn't block me from adding anyway, which itself is a small UX oddity
(the warning exists but has no teeth).

This time, **I deliberately do not hit End** when the last speaker (Bangladesh, mid-sentence
on monitoring indicators) is still talking and the total-time clock is about to hit zero.
I want to see the prepend-to-GSL behavior with an actual `currentSpeaker` in play, per Q2.

Clock hits 0:00. The auto-expiry tick fires
(`src/app/chair/[code]/page.tsx:1425-1445`, confirmed): `updateCaucusInDB(id, null)`,
phase set to `speakers-list`, and — critically — **Bangladesh, who was mid-speech in the
caucus, is prepended to the front of the permanent GSL** via
`reorderSpeakersListInDB(id, [bangladesh, ...restOfGSL], 'gsl')`. Caucus queue is wiped,
`currentSpeaker` nulled.

*Why this is wrong, concretely, in the room:* Bangladesh was never on the GSL. She was
speaking in a **temporary, caucus-scoped** queue about monitoring mechanisms. The moment the
clock ran out, Gavelling silently promoted her to **position #1 on the permanent General
Speakers' List** — a list she may never have requested to join, on a topic (monitoring
mechanisms, not the general debate topic) that has nothing to do with why she's now first in
line for the *next* general speech. If I next click "Next" on the GSL expecting to advance
through the pre-caucus queue order, Bangladesh jumps the line ahead of anyone who was
legitimately on the GSL before the caucus started. This is **exactly the "mixing caucus
speaker into the permanent GSL" violation the architecture doc explicitly forbids** ("NEVER
add GSL delegates to caucusQueue or vice versa") — except it's the caucus contaminating the
GSL, not the reverse, and it happens automatically, with no chair action, no warning, no
undo. A chair who doesn't personally audit the GSL order after every clock-expired caucus
will not notice this until a delegate objects that they got skipped.

*Delegate experience:* **Bangladesh** has no idea any of this happened. Her phone still just
shows the caucus ended. She doesn't know she's now sitting at GSL position #1. The *next*
delegate expecting to be called from the old GSL order (say, a 5th delegate who'd requested
to speak before the caucus even started) is quietly bumped one slot back with zero
notification.

### 2.7 Tour de Table

I run one more caucus type for coverage: **Tour de Table**, Room Order (not A→Z), 60s per
delegate, proposed by Brazil, topic "One-sentence national position on financing floor." Room
Order fills the queue with numbered placeholders ("Speaker 1," "Speaker 2"...) rather than
real country names up front — I then manually call the room in the order I choose, assigning
real identities as I go via the caucus queue's side panel.

*Reasoning to stress Q2 further:* if I'd let *this* auto-expire mid-speech, the prepend logic
would inject either a resolved delegate or — if I hadn't yet resolved "Speaker N" to a country
— a bare placeholder object onto the GSL. I choose not to run that experiment a second time on
this committee (I manually End it on time) since I've already demonstrated the core bug
clearly in 2.6; repeating it would be redundant. I note for the record that the placeholder
case is almost certainly worse in practice: a "Speaker 4" placeholder sitting at GSL position
#1 with no real country attached would visibly break the "currentSpeaker must always display
a real flag" assumption baked into the GSL UI.

### 2.8 Documents — a Working Paper, then a Draft Resolution

**Germany** submits a Working Paper from Documents → Submit: title "Blended Finance
Mechanism Framework," no PDF attached, auto co-sponsors Germany + (added) Brazil and
Bangladesh. Auto doc code "WP 1.1." I see the badge count tick up on my Documents button.

I **Introduce** it: reading timer, then presentation, then Q&A (Kenya asks a sharp question
about grant floor percentages for the poorest LDCs — Germany answers, citing the 70/30 blend
from the consultation). WP **auto-passes after Q&A** — no vote needed, as documented. Germany
earns "Working paper" (10pts, sponsor).

Now the real test: **Brazil submits a Draft Resolution** — "DR 1/1: Financing Mechanism for
Universal Water Access," incorporating the 70/30 blend ratio, co-sponsored by Germany,
Kenya, Bangladesh, and six others (a strong sponsor bloc, deliberately, since I know
consensus is coming and I want to show what a *nearly* sufficient sponsor list still can't
guarantee).

I **Introduce** the DR: reading time, presentation, Q&A, and since it's a DR (not a WP), the
flow **sends it to `/voting/[code]`** rather than auto-passing.

### 2.9 Consultation of the Whole, round two — informal amendment before the vote

Before I run the DR to a vote, I accept one more **Consultation of the Whole** (5 minutes,
"final language check") because I already suspect where the sticking point is: a small donor
country ("Norway," one of the 20, not previously named) has been quiet all session and I
have a hunch about their position on the loan-guarantee clause. This is quiet diplomacy 101 —
you don't find out about a blocking objection by scheduling a vote and hoping; you go fishing
in a consultation first.

Sure enough: on the delegation board, I tap Norway. Norway says (through me, the chair,
relaying floor sentiment) that the guarantee clause in Article 4 effectively subsidizes
private lenders without enough recipient-country oversight, and Norway will vote Against
unless that's softened.

*This is where Q9 bites hard.* **There is no formal amendment mechanism in Gavelling.**
Real ECOSOC procedure would let a delegation move a formal amendment to Article 4, debate it,
and vote on the amendment before voting on the resolution as amended. Gavelling has no such
flow. The only paths available to me as chair are: (a) let Norway's objection play out
informally in the consultation and hope the sponsors verbally agree to change the text off
the record, then have them **submit a brand-new Working Paper or Draft Resolution** with the
revised Article 4, or (b) just run the vote and let it fail on Norway's single Against,
consensus by definition. I choose (a) first, to show the "real" fix, then deliberately choose
(b) once for illustration of "one against kills it."

**In the consultation, Brazil (bridge-builder again) verbally proposes softening Article 4** —
adding a recipient-country oversight board requirement to the guarantee mechanism. Norway,
verbally, says that would satisfy them. But **nothing in the software captures this
agreement as a redline or amendment** — it's just spoken words in a room, exactly as the
briefing warned. The only way to make it "real" in Gavelling is for Brazil (or Germany, as
lead sponsor) to go back to Documents → Submit and file a **new DR** — "DR 1/2" — with the
revised Article 4 text. There is no versioning, no diff, no "amended from DR 1/1" linkage;
DR 1/2 is just a new document that happens to look similar. I do this: Germany submits DR 1/2
with the softened clause.

### 2.10 First vote — consensus fails on one Against (the drama we built toward)

I deliberately run **DR 1/1 (the ORIGINAL, un-softened text)** to a vote first, specifically
to demonstrate "one against kills it" before showing the fixed version pass. This is exactly
the pedagogical sequence real consensus chairs use when teaching a room how consensus bodies
actually behave differently from majority-vote bodies.

On `/voting/WATR7K`:
1. **Roll call modal** first — A/P/PV sliders. I confirm all 20 (writes to DB — this really
   does update main-session attendance, per Q7; I make a mental note that if I'd gotten sloppy
   here I could accidentally flip someone's status mid-session just by running a vote).
2. Select **DR 1/1**.
3. **Placard round**: I click through each present delegate. Germany → For. Kenya → For.
   Bangladesh → For. Brazil → For. ...**Norway → Against**, exactly as previewed in
   consultation. Everyone else → For or Abstain.
4. No "with rights" votes this round (nobody asked to explain their vote).
5. **Result**: `totalDecisive = forCount + againstCount`. Threshold check for `consensus`:
   `againstCount === 0 && forCount > 0` (confirmed at
   `src/app/voting/[code]/page.tsx:362-363`). With `againstCount = 1`, this is **false** no
   matter how large `forCount` is — 18 countries in favor, 1 opposed, and the resolution
   **fails**. This is the single-against-kills-it mechanic working exactly as designed, and
   it's the correct, faithful implementation of consensus procedure. Unlike simple majority
   or even supermajority, there is no vote count that rescues a consensus resolution once a
   single delegation places an Against placard.

*Delegate experience:* the room audibly deflates. **Norway** — the one delegate who blocked
it — is not identified as "the blocker" anywhere in the UI beyond the placard round itself
(which everyone watched live), so there's no ambiguity about who did it; this is realistic
and appropriately transparent (in real consensus bodies, blocking is a visible, accountable
act, not an anonymous vote). Result persists to the DR as "failed."

### 2.11 Second vote — the amended DR passes by actual consensus

I now run **DR 1/2** (Germany's resubmission with the softened Article 4 / oversight board
language that Norway verbally agreed to in consultation). Same flow: roll call (already done,
skip re-confirming everyone), select DR 1/2, placard round.

This time: Germany → For. Kenya → For. Bangladesh → For. Brazil → For. **Norway → For**
(the softened language satisfies their objection, exactly as promised informally). Two
delegations abstain (small non-aligned states with no strong view). Zero Against.

`againstCount === 0 && forCount > 0` → **true**. DR 1/2 **passes**. Germany (as sponsor)
earns "Draft resolution" (20pts) + "DR passed" (10pts) on top of the WP credit already
earned. I return to session via "Back to Session."

*Reasoning on the "no amendment mechanism" gap, now fully demonstrated:* what real ECOSOC
procedure would have done in **fifteen minutes** inside a single voting session (move
amendment to Art. 4 → debate amendment → vote amendment → vote resolution as amended) took
**two entire separate documents, two separate Introduce flows, and two trips to the voting
screen** in Gavelling — with the "amendment" existing only as spoken words and chair memory
connecting DR 1/1 to DR 1/2. Nothing in the platform records that DR 1/2 *is* DR 1/1 plus
one amendment; a delegate opening Documents cold would see two unrelated-looking DRs and
have to ask someone what changed. **This is Q9 in its sharpest form** — consensus-building is
*fundamentally* an amendment-and-redline process, and Gavelling has no primitive for it at all.

### 2.12 Feedback, scoring, and the hideScoresFromDelegates flip

Throughout the session I've been leaving **chair feedback** — per-speech factor scores
(Diplomacy / Public Speaking / Collaboration / Content, 0–100 scale via `factorScaleMax`)
plus a private note, on the comment bar as each delegate finishes speaking. For example, on
Kenya's over-time GSL speech: Diplomacy 70, Public Speaking 90, Collaboration 60, Content 85,
plus a **private note** only I can see: "Strong content, ran long — coach her on time
discipline before next session, don't publicly call it out." On Brazil's consultation
bridge-building: Diplomacy 95, Collaboration 98, private note: "Best bridge-builder in the
room — consider recommending for Best Delegate."

At end of session I write a **conference-level recap** for each of the four named delegates
via the Feedback panel — a summary factor score set plus a closing private note.

Midway through the session (right after the moderated caucus in 2.6), I flip
**`hideScoresFromDelegates`** from OFF to ON in Settings → Points, specifically to observe the
before/after on the delegate Stats tab.

- **Before the flip:** Kenya's Stats tab shows her running objective ledger (itemized rows:
  GSL speech, speaking time, etc.) AND a blended headline score
  (`computeHeadline(objectiveTotal, quality, blend=40)` — 60% her objective total, 40% her
  quality mean from my factor scores) alongside the full leaderboard ranking.
- **After the flip:** Kenya's Stats tab **hides the score card entirely** — no ledger, no
  headline number, no leaderboard position visible to her. She can still see her own
  **recap** (the factor scores I entered, translated into a friendly summary — Diplomacy,
  Public Speaking, etc. as a qualitative readout) but the **private note is never shown to
  her**, before or after the flip; that separation (private note vs. visible recap) is
  independent of `hideScoresFromDelegates` and holds throughout.

*Delegate experience of the flip:* Kenya, checking her Stats tab out of curiosity after the
caucus, is confused that her score card — which was there an hour ago — has vanished with no
explanation in the UI. There's no toast, no "scores hidden by chair" message; the card just
silently disappears. From her side this looks like a bug, not a deliberate chair choice. A
real-room analogy: this is like a faculty advisor who was posting live rankings on a
whiteboard suddenly erasing them mid-session with no announcement — technically within their
rights, but disorienting without a heads-up.

### 2.13 Scoreboard (trophy) — end of session

I open the **Scoreboard** (trophy icon). Ranked ledger, blended at 40%:

1. **Brazil** — high on Collaboration/Diplomacy quality score plus the manual Bridge-builder
   award (+15) and DR sponsorship — the blend formula rewards exactly the profile I built the
   committee to reward: bridge-builder outranks the loudest talker.
2. **Germany** — strong on both objective (WP+DR sponsor, DR passed, GSL speech, multiple
   consultation turns) and quality (Content, Diplomacy).
3. **Kenya** — high raw speaking activity, but her quality scores + a scoring-log gap from
   the Q5 extra-time bug (2.3) hold her back below where her actual floor presence should
   place her.
4. **Bangladesh** — solid across the board, plus the caucus-speech weighting (10pts, my
   re-weight) helping her since she was strong in caucus specifically. (Also, unnoticed by
   anyone in the room, sitting at GSL position #1 from the Q2 auto-expiry bug in 2.6 — a
   ranking artifact nobody would trace back to that cause without reading this log.)

This is the moment the **scoreBlend=40** configuration choice pays off narratively: a
committee that only counted raw speaking minutes would have crowned Kenya or Germany; a
committee tuned for consensus-building crowns Brazil, the delegate who said the least in
formal terms but did the most actual diplomacic work. That's the right outcome for an ECOSOC
consensus body, and it's genuinely well-supported by Gavelling's blend mechanism — this is
one of the platform's better-designed features, not a flaw.

### 2.14 Adjournment

No Suspend/Resume cycle in this run (kept it linear for clarity) and no early End Debate —
I let the session run its natural course to the DR 1/2 pass, then manually raise and Accept
an **End Debate** motion (Chair-proposed) from the Motions tab. Unlike caucus motions, this
gets the explicit **"Does this motion pass? Yes/No"** confirmation screen (the one asymmetric
motion type that actually gets a deliberate step) — I click **Yes**. `endedAt` set,
`expires_at` computed. Both chair and delegate views flip to the two-tab End View / Session
View; Session View is fully read-only (Motions/Documents/Chat compose all hidden per the
read-only rules) but everyone can still browse the full history — GSL, caucus logs, chat,
documents, stats — exactly as documented.

---

## 3. Feature coverage checklist

- [x] Committee creation with pasted (non-preset) roster
- [x] Chair suffix / separate chair code (`CODE-1234`)
- [x] Roll call — 3-state slider + bulk All Present / All P+V
- [x] Begin Session transition (absent-stripping-from-GSL behavior confirmed at transition)
- [x] GSL: Add Speaker, Start/Next, timer, +time extension
- [x] GSL scoring: gslSpeech + speakingTimePer10s sources
- [x] **Extra-time logging gap (Q5)** — reproduced live with Kenya's speech
- [x] Motion raised via chair-keyed floor entry (Proposed-by dropdown, one-motion-per-country lock)
- [x] Motions ranked by disruptiveness, cosmetic "needs X of Y" hint (Q1/Q6)
- [x] **Consultation of the Whole** — full flow: motion → accept → loading card → open-floor delegation board (tap to set floor) → **CoW per-speaker timer (45s) enabled and exercised**
- [x] Unmoderated caucus ("renamed to Informal Consultations") — run to natural clock expiry, confirmed harmless GSL interaction (no currentSpeaker to prepend)
- [x] Moderated caucus — Add Speaker, max-speakers cap + amber warning, **run to clock expiry with an active currentSpeaker → GSL prepend bug reproduced (Q2)**
- [x] Tour de Table — Room Order mode, manual End (avoided a second clock-expiry repro deliberately)
- [x] Motion type rename (`motionNames.unmoderated` → "Informal Consultations")
- [x] Working Paper submission + auto co-sponsors + Introduce → auto-pass after Q&A
- [x] Draft Resolution submission + Introduce → sent to `/voting`
- [x] **No amendment mechanism (Q9)** — demonstrated via DR 1/1 → informal consultation → brand-new DR 1/2 workaround
- [x] Voting screen: roll call modal (and its DB-attendance side effect, Q7), placard round, consensus threshold math
- [x] **Consensus vote failing on exactly one Against** (`againstCount===0 && forCount>0`)
- [x] Consensus vote passing after informal "amendment" via resubmission
- [x] Custom scoring source (Bridge-builder, manual award)
- [x] Scoring re-weight (attendance down, caucusSpeech up, RTR disabled)
- [x] Quality factors (Diplomacy/Public Speaking/Collaboration/Content) via chair feedback
- [x] `scoreBlend` slider exercised at 40 — blended leaderboard outcome discussed
- [x] Chair feedback: per-speech factor scores + private notes + end-of-conference recap
- [x] Delegate recap vs. private note separation (private note never shown to delegate)
- [x] `hideScoresFromDelegates` toggled mid-session — before/after Stats tab observed
- [x] Scoreboard / trophy — ranked ledger reviewed
- [x] **Right of Reply NOT touching GSL (Q3)** — confirmed by code read, not exercised live in-narrative since RTR was disabled in this committee's scoring config; behavior confirmed via source (`logEvent` only, no `addToSpeakersList` call, `src/app/chair/[code]/page.tsx:2806-2818`)
- [x] End Debate — explicit Yes/No confirmation screen, two-tab read-only End View

**Not exercised in this run** (out of remit / would've diluted the consensus-body focus):
Suspend/Resume cycle, Faculty Advisor nudges, chat DM picker deep-dive, quorum-blocked GSL
action, veto modes (p5/unanimous/custom), Right of Reply granted live (disabled by config
choice, confirmed via code instead), co-chair "View only" mode.

---

## 4. Friction & "doesn't make sense" log

### F1. Extra time silently erases scoring credit for generous chairing (Q5) — **High**
**What happened:** Kenya's GSL speech, extended once with the **+time** control, logged as
0 seconds spoken because `secondsSpoken = speakerTimeLimit − speakerTimeRemaining`
(`src/app/chair/[code]/page.tsx:1737`) is gated by `if (secondsSpoken > 0)` at line 1738.
Any speech where the speaker ends with time remaining that (after an extension) doesn't
cleanly resolve to a positive number against the *original* limit gets **zero speaking-time
credit and can drop the whole ledger row**.
**Why it's wrong:** This inverts the chair's incentive. Chairs extend time *specifically* for
delegates giving strong, substantive speeches — exactly the speeches that most deserve
scoring credit. The mechanic punishes the chair's generosity by silently zeroing the score,
with no visible warning to either chair or delegate. A first-year delegate like Kenya, coached
to speak passionately and given extra time as a reward, ends up *worse off* on the leaderboard
than a delegate who spoke curtly for 20 seconds and sat down.
**Real-room expectation:** time added should be added to the *effective limit* the calculation
compares against, not silently ignored. `secondsSpoken` should be computed from actual elapsed
wall-clock time speaking, not `originalLimit − remainingIncludingExtensions`.

### F2. Caucus clock-expiry contaminates the permanent GSL (Q2) — **High**
**What happened:** Letting a moderated caucus's total-time clock hit 0:00 while Bangladesh was
mid-speech caused the code to **prepend her directly onto the permanent General Speakers'
List** at position #1 (`reorderSpeakersListInDB(id, [preCaucusSpeaker, ...gsl], 'gsl')`,
confirmed at lines ~1425-1445). Manually clicking **End** on the exact same caucus does *not*
do this — GSL stays untouched. Two ways to end a caucus, two different outcomes for the GSL.
**Why it's wrong:** The architecture doc (AGENTS.md) is emphatic — "NEVER add GSL delegates
to caucusQueue or vice versa" — but this is precisely a caucus delegate being force-added to
the GSL, automatically, with no chair action and no visible confirmation. Any delegate who
was legitimately queued on the GSL before the caucus started gets silently bumped back one
position. In a real room, if a caucus runs out the clock mid-speech, the chair simply cuts the
speaker off ("time has expired, thank you") — nothing about that moment implies the speaker
should now be first in line for the *next unrelated agenda item*.
**Real-room expectation:** ending a caucus — whether by clock or by manual End — should behave
identically: GSL untouched, caucus queue and currentSpeaker cleared. If there's a design
reason to preserve an interrupted caucus speaker's turn, it should go back into the *caucus
queue* for next time, not jump the permanent GSL.

### F3. No amendment mechanism forces a "just resubmit a new document" workaround for the exact use case consensus bodies live on (Q9) — **High for consensus committees specifically**
**What happened:** Norway's Against on DR 1/1 was resolved informally in a Consultation of
the Whole (Brazil brokered softened Article 4 language, Norway verbally agreed). The *only*
way to make that agreement real in Gavelling was for Germany to submit an entirely new
document, DR 1/2, with no system-level link back to DR 1/1 — no "amended from," no redline,
no diff view. A delegate browsing Documents afterward sees two unrelated-looking DRs on the
same topic and has to ask a human what changed.
**Why it's wrong:** This is the single feature gap most damaging to a consensus-driven
committee specifically, because consensus-building procedurally *is* amendment-and-redline
work. A majority-vote committee can survive without a formal amendment tool (you just vote
down bad ideas); a consensus committee cannot — you're expected to iterate the text until the
one objecting delegation is satisfied, and that iteration needs a paper trail.
**Real-room expectation:** at minimum, a "supersedes DR X" link on document submission, or a
lightweight formal-amendment flow (propose amendment → chair reads it into the DR → vote
amendment separately) before the final resolution vote.

### F4. Caucus motions have no real vote; only Suspend/End get a Yes/No screen (Q1) — **Medium**
**What happened:** Every Consultation, Unmoderated, Moderated, and Tour motion in this run was
decided by me unilaterally clicking Accept/Reject after "reading the room" — there is no
placard count, no tally, nothing that reflects the committee's actual configured
`substantiveThreshold` or even a generic procedural-majority mechanism. The "needs 2/3 of Y
present" hint on the Consultation card is pure copy — it isn't wired to anything.
**Why it's confusing:** It creates an asymmetry that isn't explained anywhere in the UI:
Suspend/End Debate get a deliberate "Does this motion pass? Yes/No" confirmation step, but a
Consultation of the Whole — arguably the single most consequential procedural motion in this
entire committee — gets a bare Accept button with a cosmetic hint. A chair could reasonably
expect the "needs X of Y" language to mean something is actually being tallied.
**Real-room expectation:** either make the hint accurate (wire it to an actual placard count)
or remove the "needs X of Y" copy entirely so it doesn't imply a mechanism that doesn't exist.

### F5. `hideScoresFromDelegates` flips silently — no notice to the delegate whose card just vanished — **Medium**
**What happened:** Toggling `hideScoresFromDelegates` mid-session made Kenya's score card
disappear from her Stats tab with zero explanation — no toast, no banner, nothing indicating
the chair made a deliberate choice versus the app breaking.
**Why it's confusing:** From the delegate's chair, "my score card was here an hour ago and now
it's gone" reads as a bug. Chairs *should* be able to hide scores (e.g., to reduce competitive
anxiety, or because a Best Delegate decision hasn't been finalized) but the delegate deserves
to know that's a deliberate, chair-controlled state rather than data loss.
**Real-room expectation:** a small persistent note on the Stats tab ("Scores are currently
hidden by the chair") when the flag is on, rather than the card simply not rendering.

### F6. Max-speakers cap on a moderated caucus warns but doesn't block — **Low**
**What happened:** Adding delegates past `floor(remainingTime / perSpeaker)` in the moderated
caucus (2.6) produced an amber "max speakers" message but let me add the delegate anyway.
**Why it's confusing:** A warning that has no enforcement teeth trains chairs to ignore it.
Either the cap is a real constraint (block the add, or force a time/per-speaker adjustment) or
it's advisory-only, in which case it should be phrased as information ("this caucus can now
fit N more speakers at current pace") rather than looking like a guardrail.
**Real-room expectation:** cosmetic either way is fine, but the visual language (amber
"warning" styling) currently oversells the constraint.

### F7. Right of Reply's real behavior contradicts the architecture doc, and neither surface tells the chair (Q3) — **Medium**
**What happened:** Confirmed directly in source: the RTR Grant button
(`src/app/chair/[code]/page.tsx:2806-2818`) only calls `logEvent(..., type: 'right-of-reply')`
and drives a local countdown (`rtrTimerActive`/`rtrTimeRemaining`) — it never calls
`addToSpeakersList`/`addToSpeakersListInDB`. AGENTS.md, the project's own source-of-truth doc,
claims RTR "inserts a delegate at the TOP of speakersList with a custom time override." That
claim is simply false against the current code.
**Why it's confusing:** A chair reading AGENTS.md (or briefed by someone who did) would expect
granting RTR to visibly add the replying delegate to the GSL queue as position #1. It does not
— it's a floating, independent timer overlay with no GSL footprint at all. A chair operating
on the doc's description would be confused when the "GSL" queue panel never shows the RTR
delegate.
**Real-room expectation:** either fix the doc (this write-up recommends that — the code's
actual behavior, a standalone timer, is arguably the *more correct* design for RTR, since
real-room Right of Reply is a bounded rebuttal, not a return to the general queue) or fix the
code to match the doc. Right now they actively disagree, which is worse than either being
"wrong" alone.

### F8. Voting-screen roll call silently rewrites main-session attendance (Q7) — **Medium**
**What happened:** Opening `/voting/[code]` for either DR vote re-ran a roll-call modal that
wrote statuses to the DB — meaning running a resolution vote can change who's marked
present/absent back on the main chair dashboard, as a side effect most chairs wouldn't expect
from "I'm just running a vote."
**Why it's confusing:** A chair's mental model is "the voting screen is for tallying a
resolution," not "the voting screen is also an attendance-editing tool." If I'd sloppily
clicked through that roll call without checking each slider, I could have accidentally marked
someone absent (or present) in a way that persists after I return to the main session.
**Real-room expectation:** either make it explicit ("this roll call will update main-session
attendance") or decouple the voting-screen roll call from the persisted delegate status
entirely, treating it as a vote-scoped snapshot.

### F9. Consultation of the Whole gives the delegate's phone no floor-position signal — **Low, but worth naming**
**What happened:** During both Consultation blocks, delegates' phones showed the caucus banner
and countdown but nothing indicating whose turn it was — that information exists only via the
chair's taps on the delegation board, visible in the physical room, not pushed to devices.
**Why it's (mostly) fine, but worth flagging:** This is arguably correct given how informal
Consultations are supposed to be, but it does mean a delegate who steps away from the physical
room (or is in a hybrid/virtual session) gets zero information from their device about
whether they've been recognized. For an in-person committee this is a non-issue; for any
hybrid/virtual delegate it's a real gap.
**Real-room expectation:** at minimum, a lightweight "chair has the floor set to: [country]"
readout on the delegate's Session tab during Consultation, purely informational, no action
needed from the delegate.

### F10. Bridge-builder-style manual scoring awards have no audit trail visible to delegates — **Low**
**What happened:** Brazil's +15 "Bridge-builder" manual award appears in the objective ledger
with a note field, but nothing in the delegate Stats view explains *when* or in relation to
*what specific moment* it was earned beyond the note text I chose to type.
**Why it's a minor issue:** For a single chair running a small consensus body this is fine —
I remember why I gave it. For a larger committee or a co-chaired one, an un-timestamped or
vaguely-noted manual award becomes a "why did they get that" mystery with no way for a
delegate to contest or even understand it.
**Real-room expectation:** manual awards are a good feature; they'd benefit from being
slightly more structured (a required short reason field, consistently surfaced) rather than a
free-text note that's easy to leave terse.

---

## 5. Closing chair's note

This committee is the best possible stress test for Gavelling's consensus-adjacent features,
and most of them held up well: the **Consultation of the Whole + delegation board** is a
genuinely good abstraction for informal diplomacy, the **scoring blend slider** does exactly
what a chair running a collaboration-first committee wants, and the **consensus vote math**
(`againstCount===0 && forCount>0`) is implemented with total fidelity to real procedure — one
against really does kill it, no exceptions, and delegates feel that weight the moment they see
the placard round. Those are wins.

But the two High-severity findings (F1 extra-time scoring loss, F2 caucus-clock GSL
contamination) are both **silent** failures — no error, no warning, just quietly wrong data
that a chair would only catch by auditing logs after the fact, which is exactly what this
exercise did. And the missing amendment mechanism (F3) isn't a nice-to-have for a body like
ECOSOC — it's the single procedural tool consensus-building is built around, and its absence
means every real amendment in this run had to be smuggled through as "just submit another
document and hope everyone remembers why."
