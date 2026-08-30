'use client';

// Phase-specific bodies for the live committee card.
//
// The card used to render one layout no matter what the room was doing, so an
// unmoderated caucus (which has no speaker and no queue) still showed an empty
// queue strip, and a vote in progress still showed whoever last held the floor.
// Each variant below replaces the middle of the card; the header, chips and
// footer stay shared so the card remains one component to extend.
//
// CLOCKS: every countdown here is derived, never counted down. `useNowTick`
// re-reads `Date.now()` each second and `liveCaucusSeconds` recomputes
// `remaining = remainingTime - (now - totalStartedAt)` from the persisted
// anchor via the sanctioned `caucusRemainingNow` helper. A backgrounded tab
// therefore catches up on its next tick instead of drifting, and NOTHING here
// writes to the database (a per-second write would re-arm the realtime
// debounce — AGENTS.md RULE 4).

import { useSyncExternalStore } from 'react';
import { Timer, Gavel, Users, Mic, ScrollText } from 'lucide-react';
import { caucusRemainingNow } from '@/lib/committeeService';
import type { CaucusState } from '@/lib/types';
import {
  NeuInset, NeuIconDisc, NEU, NEU_GRADIENTS, OUTFIT, EASE,
} from '@/components/neu';
import { type LiveCommittee, type CaucusJson, fmtClock, votingBody } from './LiveModals';
// Readable ink. `NEU.muted` is 2.81:1 here, `NEU.amber` 2.74:1, `NEU.green`
// 4.30:1 and `NEU.deepGold` 2.72:1 — all four were carrying text in this file.
// The raw palette values survive only on dots, rails and progress fills, where
// the 3:1 non-text bar applies. See ./tokens for the measurements.
import { SOFT, AMBER_INK, GREEN_INK, RED } from './tokens';

// ── Clock plumbing ──────────────────────────────────────────────────────────

/* ── Shared wall clock ──────────────────────────────────────────────────────
   ONE interval for the whole page, not one per card. A conference with twenty
   running committees would otherwise hold twenty timers all firing on their own
   phase, waking the tab twenty times a second between them.

   Written as an external store rather than useState + useEffect on purpose: a
   clock that seeds itself with `setNow(Date.now())` inside an effect is setting
   state synchronously during commit, which cascades a second render on every
   card the moment it goes active — and lints as such. Here the value lives
   outside React, and components subscribe. */
let clockNow = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void): () => void {
  /* Refresh on first subscribe. Between all cards going idle and one waking
     again, `clockNow` is as stale as that gap — without this a returning card
     would render a minutes-old countdown for up to a second. */
  if (clockListeners.size === 0) clockNow = Date.now();
  clockListeners.add(cb);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const l of clockListeners) l();
    }, 1000);
  }
  return () => {
    clockListeners.delete(cb);
    /* Last card idle → stop the timer. Idle cards cost nothing. */
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

const noopSubscribe = () => () => {};
const readClock = () => clockNow;

/** Client-side wall clock. `active` false → this card subscribes to nothing. */
export function useNowTick(active: boolean): number {
  return useSyncExternalStore(active ? subscribeClock : noopSubscribe, readClock, readClock);
}

/** Live seconds left on the total caucus clock, re-derived from the stored anchor.
 *  Only the two fields `caucusRemainingNow` actually reads are handed over. */
export function liveCaucusSeconds(caucus: CaucusJson | null | undefined, now: number): number {
  if (!caucus) return 0;
  return caucusRemainingNow(
    { remainingTime: caucus.remainingTime ?? 0, totalStartedAt: caucus.totalStartedAt ?? null } as unknown as CaucusState,
    now,
  );
}

// ── Variant selection ───────────────────────────────────────────────────────

export type CardVariant = 'default' | 'unmoderated' | 'moderated' | 'voting';

/** THE CAUCUS BLOB IS CORROBORATION, THE PHASE IS THE TRUTH.
 *
 *  `committees.caucus` is never cleared to `active: false` by anything in the
 *  app — all 10 caucus blobs in production carry `active: true`, none carries
 *  anything else — so a room that has long since returned to its speakers list
 *  still has a full caucus object hanging off it. Selecting the card body from
 *  `caucus.active` therefore made `dc082142-2f05-4430-8b31-ba745cbe7f1a`
 *  (code OA3M60, `phase='speakers-list'`, blob `purpose:'motion 3'`) render as a
 *  live moderated caucus. It is the one row of the ten where phase and blob
 *  disagree, and the `?? true` fallback was doing all the work.
 *
 *  The phase column IS actively written on every transition (MotionsModal calls
 *  `setPhaseInDB` when a caucus starts, and the chair page writes it back when
 *  one ends), so it is the authoritative signal. The blob is only read once the
 *  phase agrees a caucus is running. */
export function activeCaucus(session: LiveCommittee['session']): CaucusJson | null {
  if (!session?.caucus) return null;
  // Honoured if anything ever starts writing it; today nothing does.
  if (session.caucus.active === false) return null;
  if (session.phase !== 'moderated-caucus' && session.phase !== 'unmoderated-caucus') return null;
  return session.caucus;
}

/** A Consultation of the Whole is stored as an UNMODERATED caucus carrying
 *  `isConsultation: true` (MotionsModal.tsx:1263) — that flag is the only thing
 *  separating it from a real unmod, and the chair console keys off exactly this
 *  (`chair/[code]/page.tsx:626, 785`). A CoW is a FORMAL proceeding, so it must
 *  never inherit the unmod's "the floor is informal" copy. */
export function isConsultation(caucus: CaucusJson | null | undefined): boolean {
  return caucus?.isConsultation === true;
}

/** Tour de Table is identified by `caucus.purpose`, NOT `motionLabel`.
 *  `motionLabel` is the renameable, translatable display label — production rows
 *  carry "Round Robin" and "Cáucus No Moderado" — whereas `purpose` is written as
 *  the stable English "Tour de Table (…)" string (MotionsModal.tsx:1308, 1344)
 *  and is what the chair console matches on (`chair/[code]/page.tsx:934`). */
export function isTourDeTable(caucus: CaucusJson | null | undefined): boolean {
  return caucus?.purpose?.startsWith('Tour de Table') ?? false;
}

/** The Room Order tour fills the queue with literal "Speaker 1".."Speaker N"
 *  placeholders instead of delegations (MotionsModal.tsx:1315-1318), which is why
 *  the chair console refuses to log speaking time for them
 *  (`chair/[code]/page.tsx:2804-2807`). They are not countries, so they must never
 *  be rendered as flags — `flagCodeFor("Speaker 1")` resolves to nothing and the
 *  strip becomes a row of identical globes. */
export function isRoomOrderTour(caucus: CaucusJson | null | undefined): boolean {
  return caucus?.purpose?.includes('Room Order') ?? false;
}

/** Phases the chair console actively owns and rewrites. If the row says the room
 *  is in one of these, it is not balloting, whatever a stale document says. */
const DEBATE_PHASES = new Set(['speakers-list', 'moderated-caucus', 'unmoderated-caucus']);

/** How long a room may show no sign of life before we stop believing it is
 *  mid-vote. `documents` has NO introduced-at timestamp — only `created_at`,
 *  which is SUBMISSION time — so document age cannot answer "is this vote live".
 *  The room's own activity can.
 *
 *  6 hours, chosen off the data: the 95th-percentile gap between consecutive
 *  ledger events inside a committee is 103 minutes, so 6h is >3x the realistic
 *  quiet stretch during a live sitting (reading time, presentation and Q&A are
 *  not logged at all, so the window has to absorb them). Every genuinely dormant
 *  room in production is 24h+ stale, so nothing real sits near the boundary. */
const VOTING_STALE_MS = 6 * 60 * 60 * 1000;

/** Is this room plausibly balloting RIGHT NOW?
 *
 *  Nothing ever clears `documents.status = 'introduced'` except the chair
 *  resolving the vote, and nothing ever clears `phase = 'voting'` either. Both
 *  are therefore one-way doors: without a staleness guard a committee that
 *  introduced a resolution once is pinned to the voting body forever, with its
 *  motion inset, floor speaker and queue all suppressed. */
function votingLooksLive(data: LiveCommittee, now: number): boolean {
  if (!data.lastActivityAt) return false;
  const t = Date.parse(data.lastActivityAt);
  return Number.isFinite(t) && now - t < VOTING_STALE_MS;
}

/** Which body this committee's card should render.
 *
 *  Order of authority: a caucus the PHASE confirms > a live vote > the default
 *  speaker-and-queue layout. Voting is still detected from an introduced draft
 *  resolution — the standalone /voting/[code] screen never writes phase='voting',
 *  so that document status is the only signal that reaches this surface — but it
 *  now has to survive both the phase check and the staleness check. */
export function cardVariant(data: LiveCommittee, now: number = Date.now()): CardVariant {
  const session = data.session;
  if (!session) return 'default';

  // A caucus the phase agrees with wins outright: the room is demonstrably in debate.
  const caucus = activeCaucus(session);
  if (caucus) return caucus.type === 'unmoderated' ? 'unmoderated' : 'moderated';

  if (session.phase === 'voting') return votingLooksLive(data, now) ? 'voting' : 'default';

  // Fallback: an introduced draft resolution. Believable only while the room is
  // in an active debate phase (a pre-session, roll-call or adjourned room is not
  // balloting) and only while the room still shows signs of life.
  const introducedDR = data.documents.some((d) => d.type === 'draft-resolution' && d.status === 'introduced');
  if (!introducedDR) return 'default';
  if (!DEBATE_PHASES.has(session.phase)) return 'default';
  return votingLooksLive(data, now) ? 'voting' : 'default';
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em', ...style }}
    >
      {children}
    </p>
  );
}

/** Pressed-in track with an extruded fill. `pct` 0…100. */
function Track({ pct, from, to, height = 9 }: { pct: number; from: string; to: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="w-full overflow-hidden"
      style={{ height, borderRadius: height, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
    >
      <div
        style={{
          // inlineSize + marginInlineStart:0 keeps the fill growing from the
          // reading-start edge in both LTR and RTL.
          inlineSize: `${clamped}%`,
          height: '100%',
          borderRadius: height,
          background: `linear-gradient(90deg, ${from}, ${to})`,
          transition: `inline-size 900ms linear`,
        }}
      />
    </div>
  );
}

/** Big tabular clock, the focal number of the two caucus variants. */
function BigClock({ seconds, color, expired }: { seconds: number; color: string; expired: boolean }) {
  return (
    <span
      style={{
        fontFamily: OUTFIT,
        fontWeight: 900,
        fontSize: 40,
        lineHeight: 1,
        letterSpacing: '0.01em',
        color: expired ? AMBER_INK : color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {fmtClock(seconds)}
    </span>
  );
}

// ── Unmoderated caucus ──────────────────────────────────────────────────────

/** No speakers list, no floor speaker — an unmod is a block of time and nothing
 *  else. So the card shows exactly that: how long the room asked for, and how
 *  much of it is left, ticking. */
export function UnmoderatedBody({ caucus }: { caucus: CaucusJson }) {
  const total = Math.max(0, caucus.totalTime ?? 0);
  const running = !!caucus.totalStartedAt;
  const now = useNowTick(running);
  const remaining = liveCaucusSeconds(caucus, now);
  const elapsed = Math.max(0, total - remaining);
  const pct = total > 0 ? (elapsed / total) * 100 : 0;
  const expired = total > 0 && remaining <= 0;

  // A Consultation of the Whole is stored as an unmod but is a FORMAL sitting —
  // the room stays in session under the chair, it does not break into informal
  // lobbying. It gets its own label and its own copy.
  const cow = isConsultation(caucus);

  return (
    <div className="mt-4">
      <Eyebrow style={{ fontSize: 10, marginBottom: 6 }}>
        {cow ? 'Consultation of the Whole' : 'Unmoderated caucus'}
      </Eyebrow>
      <NeuInset style={{ padding: '14px 16px', borderRadius: 18 }}>
        <div className="flex items-center gap-3.5">
          <NeuIconDisc gradient={NEU_GRADIENTS.amber} emoji="Hourglass not done" icon={Timer} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <BigClock seconds={remaining} color={NEU.forest} expired={expired} />
              <span className="text-xs font-bold" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                left of {fmtClock(total)}
              </span>
            </div>
            <p className="text-[11px] font-bold uppercase mt-1" style={{ color: expired ? AMBER_INK : running ? GREEN_INK : SOFT, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
              {expired ? 'Time elapsed' : running ? 'Counting down' : 'Clock paused'}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Track pct={pct} from={NEU_GRADIENTS.amber[0]} to={NEU_GRADIENTS.amber[1]} />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
              {fmtClock(elapsed)} used
            </span>
            <span className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.07em', fontVariantNumeric: 'tabular-nums' }}>
              {fmtClock(total)} {cow ? 'consultation' : 'unmod'}
            </span>
          </div>
        </div>

        {caucus.purpose ? (
          <p className="text-xs mt-2.5 truncate" style={{ color: SOFT, fontFamily: OUTFIT }} title={caucus.purpose}>
            {caucus.purpose}
          </p>
        ) : null}
      </NeuInset>
      <p className="text-[11px] mt-2" style={{ color: SOFT, fontFamily: OUTFIT }}>
        {cow
          ? 'A formal sitting of the whole committee — the chair keeps the floor, but no speakers list runs.'
          : 'The floor is informal — no speakers list runs during an unmod.'}
      </p>
    </div>
  );
}

// ── Moderated caucus ────────────────────────────────────────────────────────

/** A moderated caucus DOES have a floor speaker and a queue, so the card keeps
 *  both (the shared speaker block and the up-next strip stay rendered around
 *  this body). What it adds is the thing the default layout could not answer
 *  for an organiser walking the corridor: how much of the caucus is left, and
 *  how many speaking slots the room has already spent. */
export function ModeratedBody({ caucus }: { caucus: CaucusJson }) {
  const total = Math.max(0, caucus.totalTime ?? 0);
  const running = !!caucus.totalStartedAt;
  const now = useNowTick(running);
  const remaining = liveCaucusSeconds(caucus, now);
  const elapsed = Math.max(0, total - remaining);
  const pct = total > 0 ? (elapsed / total) * 100 : 0;
  const expired = total > 0 && remaining <= 0;

  const speakingTime = Math.max(0, caucus.speakingTime ?? 0);
  // Capacity from the caucus's own totals, not the live tick — a number that
  // reshuffles every second is unreadable. Matches the chair console's
  // "max speakers = floor(total / speakingTime)".
  const capacity = speakingTime > 0 ? Math.floor(total / speakingTime) : 0;
  const spoken = caucus.spokenCountries?.length ?? 0;

  // A Tour de Table is not a caucus with spare slots to fill — every present
  // delegation speaks exactly once, in a fixed order, and the total time IS
  // n x speakingTime. "3/12 slots used" reads as spare capacity; the true
  // reading is progress through the room.
  const tour = isTourDeTable(caucus);

  return (
    <div className="mt-4">
      <Eyebrow style={{ fontSize: 10, marginBottom: 6 }}>
        {tour ? 'Tour de Table' : 'Caucus clock'}
      </Eyebrow>
      <NeuInset style={{ padding: '13px 15px', borderRadius: 18 }}>
        <div className="flex items-center gap-3.5">
          <NeuIconDisc gradient={NEU_GRADIENTS.sage} emoji="Speaking head" icon={Mic} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <BigClock seconds={remaining} color={NEU.forest} expired={expired} />
              <span className="text-xs font-bold" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                left of {fmtClock(total)}
              </span>
            </div>
            {speakingTime > 0 && (
              <p className="text-[11px] font-bold uppercase mt-1" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.07em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtClock(speakingTime)} per speaker
                {capacity > 0 && (tour
                  ? <> · {spoken} of {capacity} spoken</>
                  : <> · {spoken}/{capacity} slots used</>)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3">
          <Track pct={pct} from={NEU_GRADIENTS.sage[1]} to={NEU_GRADIENTS.forest[0]} height={8} />
        </div>
      </NeuInset>
    </div>
  );
}

// ── Voting procedure ────────────────────────────────────────────────────────

/** WHAT IS ACTUALLY READABLE HERE.
 *
 *  Individual ballots are NOT persisted. /voting/[code] holds the whole roll in
 *  React state (`const [votes, setVotes] = useState<DelegateVote[]>([])`) and
 *  the only thing it ever writes is the finished verdict, via
 *  `updateDocumentStatusInDB(docId, 'passed' | 'failed')` — i.e. documents.status.
 *  There is no votes table, no tally column, nothing in committees.caucus.
 *
 *  So this panel refuses to invent a "14 of 30 voted" number. It shows the two
 *  things that ARE genuine and live: the ballot BASE (the roll call, which is
 *  in `delegates.status` and moves in real time as chairs mark delegations), and
 *  the VERDICT once the chair's screen persists it. The gap is stated on the
 *  card rather than papered over. */
export function VotingBody({ data }: { data: LiveCommittee }) {
  const drs = data.documents.filter((d) => d.type === 'draft-resolution');
  const onFloor = drs.find((d) => d.status === 'introduced') ?? null;
  // Most recent verdict we can see. Documents come back in insert order, so the
  // last resolved DR is the one the room just finished with.
  const resolved = [...drs].reverse().find((d) => d.status === 'passed' || d.status === 'failed') ?? null;
  const subject = onFloor ?? resolved;

  // Observers are in the room but not in the voting body, so they can never cast
  // a ballot and must not pad the denominator (chair/[code]/page.tsx:2627-2628).
  const body = votingBody(data);
  const total = body.length;
  const voting = body.filter((d) => d.status === 'present-voting').length;
  const present = body.filter((d) => d.status === 'present').length;
  const absent = total - voting - present;
  const eligible = voting + present;

  const verdict = onFloor ? null : resolved?.status ?? null;
  // Was green / amber / deepGold — 4.30:1, 2.74:1 and 2.72:1 as text, all
  // below AA, and 'failed' and 'Balloting' were nearly the same amber. Now
  // three readable, distinguishable hues: adopted, rejected, still counting.
  const verdictColor = verdict === 'passed' ? GREEN_INK : verdict === 'failed' ? RED : AMBER_INK;

  const pctOf = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="mt-4">
      <Eyebrow style={{ fontSize: 10, marginBottom: 6 }}>Voting procedure</Eyebrow>
      <NeuInset style={{ padding: '14px 16px', borderRadius: 18 }}>
        {/* Subject of the vote */}
        <div className="flex items-center gap-3">
          <NeuIconDisc gradient={NEU_GRADIENTS.gold} emoji="Ballot box with ballot" icon={Gavel} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              {subject ? (subject.docCode || subject.title || 'Draft resolution') : 'Vote in progress'}
            </p>
            <p className="text-[11px] truncate" style={{ color: SOFT, fontFamily: OUTFIT }}>
              {subject?.docCode && subject.title ? subject.title : subject?.sponsors.length ? `Sponsored by ${subject.sponsors.slice(0, 3).join(', ')}` : 'On the floor'}
            </p>
          </div>
          <span
            className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase flex-shrink-0"
            style={{
              color: verdictColor,
              backgroundColor: NEU.surface,
              boxShadow: `0 0 0 1.5px ${verdictColor}44, ${NEU.outSm}`,
              fontFamily: OUTFIT,
              letterSpacing: '0.07em',
            }}
          >
            {verdict === 'passed' ? 'Passed' : verdict === 'failed' ? 'Failed' : 'Balloting'}
          </span>
        </div>

        {/* The ballot base — genuinely live, straight off the roll call */}
        <div className="mt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
              Ballots expected
            </span>
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 17, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
              {eligible}
              <span className="text-xs font-bold" style={{ color: SOFT }}> / {total} delegations</span>
            </span>
          </div>
          {/* Three-way roll split: present & voting, present, absent. */}
          <div
            className="w-full overflow-hidden flex mt-2"
            style={{ height: 10, borderRadius: 10, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
          >
            <span
              title={`${voting} present & voting`}
              style={{ inlineSize: `${pctOf(voting)}%`, background: `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`, transition: `inline-size 600ms ${EASE}` }}
            />
            <span
              title={`${present} present (may abstain)`}
              style={{ inlineSize: `${pctOf(present)}%`, background: `linear-gradient(90deg, ${NEU_GRADIENTS.sage[1]}, ${NEU_GRADIENTS.sage[0]})`, transition: `inline-size 600ms ${EASE}` }}
            />
            <span title={`${absent} absent`} style={{ inlineSize: `${pctOf(absent)}%`, backgroundColor: 'transparent' }} />
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {[
              { n: voting, label: 'P & V', color: NEU.forest },
              { n: present, label: 'Present', color: NEU.green },
              { n: absent, label: 'Absent', color: SOFT },
            ].map((k) => (
              <span key={k.label} className="inline-flex items-center gap-1.5">
                <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: k.color }} />
                <span className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
                  {k.n} {k.label}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Resolution pipeline — how far through its DRs the committee is. */}
        {drs.length > 1 && (
          <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
            <ScrollText size={12} style={{ flexShrink: 0 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {drs.filter((d) => d.status === 'passed' || d.status === 'failed').length} of {drs.length} draft resolutions voted on
            </span>
          </p>
        )}
      </NeuInset>

      {/* The honest gap, stated on the card. */}
      <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
        <Users size={12} style={{ flexShrink: 0, marginBlockStart: 2 }} />
        <span>Ballots are cast on the chair&apos;s voting screen and are not stored — only the verdict reaches this page.</span>
      </p>
    </div>
  );
}

// ── Feedback pulse ──────────────────────────────────────────────────────────

/** Compact summary of a committee's chair feedback, for the card chip row. */
export function feedbackPulse(data: LiveCommittee): { notes: number; rated: number; delegations: number } {
  const notes = data.feedback.filter((f) => f.content.trim().length > 0).length;
  const rated = data.feedback.filter((f) => Object.values(f.factorScores).some((v) => (v ?? 0) > 0)).length;
  const delegations = new Set(data.feedback.map((f) => f.country)).size;
  return { notes, rated, delegations };
}

// ── Floor detail ────────────────────────────────────────────────────────────

/** The phase-specific body, for the RECAP MODAL rather than the card.
 *
 *  These three bodies used to sit on the card itself, which is what forced four
 *  different card shapes and, with them, the height chaos the grid suffered
 *  from. They are detail — a caucus clock only matters once you have chosen a
 *  room — so they live in the detail view now. The components and the
 *  `activeCaucus` phase-confirmation are unchanged; only the location moved.
 *
 *  It is exported from HERE, not from LiveModals, because this module already
 *  imports LiveModals and importing back the other way would make the pair
 *  circular. `RecapModal` takes it as a `floorDetail` node instead. */
export function FloorDetail({ data }: { data: LiveCommittee }) {
  const session = data.session;
  if (!session || session.endedAt) return null;
  const variant = cardVariant(data);
  const caucus = activeCaucus(session);
  if (variant === 'unmoderated' && caucus) return <div className="mb-5"><UnmoderatedBody caucus={caucus} /></div>;
  if (variant === 'moderated' && caucus) return <div className="mb-5"><ModeratedBody caucus={caucus} /></div>;
  if (variant === 'voting') return <div className="mb-5"><VotingBody data={data} /></div>;
  return null;
}
