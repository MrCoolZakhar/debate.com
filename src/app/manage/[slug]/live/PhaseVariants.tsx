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
import { type LiveCommittee, type CaucusJson, fmtClock } from './LiveModals';

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

/** Which body this committee's card should render.
 *
 *  Voting is detected from the phase OR from a draft resolution sitting at
 *  status 'introduced': the standalone /voting/[code] screen never writes
 *  phase='voting', so an introduced DR is the only signal that survives to
 *  this surface. A caucus on the floor wins over a lingering introduced DR,
 *  because the room is demonstrably back in debate. */
export function cardVariant(data: LiveCommittee): CardVariant {
  const session = data.session;
  if (!session) return 'default';
  const caucus = session.caucus && (session.caucus.active ?? true) ? session.caucus : null;
  const unmod = !!caucus && (caucus.type === 'unmoderated' || session.phase === 'unmoderated-caucus');
  const mod = !!caucus && !unmod && (caucus.type === 'moderated' || session.phase === 'moderated-caucus');

  if (session.phase === 'voting') return 'voting';
  if (unmod) return 'unmoderated';
  if (mod) return 'moderated';
  if (data.documents.some((d) => d.type === 'draft-resolution' && d.status === 'introduced')) return 'voting';
  return 'default';
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em', ...style }}
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
        color: expired ? NEU.amber : color,
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

  return (
    <div className="mt-4">
      <Eyebrow style={{ fontSize: 10, marginBottom: 6 }}>Unmoderated caucus</Eyebrow>
      <NeuInset style={{ padding: '14px 16px', borderRadius: 18 }}>
        <div className="flex items-center gap-3.5">
          <NeuIconDisc gradient={NEU_GRADIENTS.amber} emoji="Hourglass not done" icon={Timer} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <BigClock seconds={remaining} color={NEU.forest} expired={expired} />
              <span className="text-xs font-bold" style={{ color: NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                left of {fmtClock(total)}
              </span>
            </div>
            <p className="text-[11px] font-bold uppercase mt-1" style={{ color: expired ? NEU.amber : running ? NEU.green : NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
              {expired ? 'Time elapsed' : running ? 'Counting down' : 'Clock paused'}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Track pct={pct} from={NEU_GRADIENTS.amber[0]} to={NEU_GRADIENTS.amber[1]} />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
              {fmtClock(elapsed)} used
            </span>
            <span className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.07em', fontVariantNumeric: 'tabular-nums' }}>
              {fmtClock(total)} unmod
            </span>
          </div>
        </div>

        {caucus.purpose ? (
          <p className="text-xs mt-2.5 truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }} title={caucus.purpose}>
            {caucus.purpose}
          </p>
        ) : null}
      </NeuInset>
      <p className="text-[11px] mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        The floor is informal — no speakers list runs during an unmod.
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

  return (
    <div className="mt-4">
      <Eyebrow style={{ fontSize: 10, marginBottom: 6 }}>Caucus clock</Eyebrow>
      <NeuInset style={{ padding: '13px 15px', borderRadius: 18 }}>
        <div className="flex items-center gap-3.5">
          <NeuIconDisc gradient={NEU_GRADIENTS.sage} emoji="Speaking head" icon={Mic} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <BigClock seconds={remaining} color={NEU.forest} expired={expired} />
              <span className="text-xs font-bold" style={{ color: NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                left of {fmtClock(total)}
              </span>
            </div>
            {speakingTime > 0 && (
              <p className="text-[11px] font-bold uppercase mt-1" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.07em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtClock(speakingTime)} per speaker
                {capacity > 0 && <> · {spoken}/{capacity} slots used</>}
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

  const total = data.delegates.length;
  const voting = data.delegates.filter((d) => d.status === 'present-voting').length;
  const present = data.delegates.filter((d) => d.status === 'present').length;
  const absent = total - voting - present;
  const eligible = voting + present;

  const verdict = onFloor ? null : resolved?.status ?? null;
  const verdictColor = verdict === 'passed' ? NEU.green : verdict === 'failed' ? NEU.amber : NEU.deepGold;

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
            <p className="text-[11px] truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
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
            <span className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
              Ballots expected
            </span>
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 17, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
              {eligible}
              <span className="text-xs font-bold" style={{ color: NEU.muted }}> / {total} delegations</span>
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
              { n: absent, label: 'Absent', color: NEU.muted },
            ].map((k) => (
              <span key={k.label} className="inline-flex items-center gap-1.5">
                <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: k.color }} />
                <span className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
                  {k.n} {k.label}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Resolution pipeline — how far through its DRs the committee is. */}
        {drs.length > 1 && (
          <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            <ScrollText size={12} style={{ flexShrink: 0 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {drs.filter((d) => d.status === 'passed' || d.status === 'failed').length} of {drs.length} draft resolutions voted on
            </span>
          </p>
        )}
      </NeuInset>

      {/* The honest gap, stated on the card. */}
      <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
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
