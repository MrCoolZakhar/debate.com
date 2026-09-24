'use client';

// ─────────────────────────────────────────────────────────────────────────────
// QuorumRings: the attendance and majority read-out at the foot of the chair sidebar
// masthead and of the pre-session roll-call card, drawn as three small bookmark tabs that
// grow up out of the speakers list.
//
// Three numbers:
//   1. Present   the delegations present                                  (full half circle)
//   2. 2/3       ceil(present x 2/3), the votes a two-thirds majority needs (2/3 of it)
//   3. 1/2+1     floor(present / 2) + 1, the votes a simple majority needs  (half of it)
// Each gauge is a HALF circle and its arc is a pictogram of the fraction, never a live
// value, so it never animates. The word sits on top, the number inside the arc, and every
// cell carries a full sentence as its accessible name.
//
// ── Shape (16 Sep 2026, back from the round capsules at the owner's request) ─────────────
// A tab with rounded top corners and concave flares at its foot, in the list's own ground
// colour (`ground`), sitting flush on the masthead's bottom edge, so each one reads as part
// of the list rather than a box floating above it. Kept small (~36px tall, 44px wide) so the
// masthead leaves the height to the speakers.
//
// `trailing` (the inline seat field, SeatAddField) sits to the inline end of the tabs on the
// same row, so adding a seat costs no extra height. With a trailing node the tabs pack at
// the start; without one they spread evenly across the width.
//
// The optional quorum pill appears only when Settings -> Voting -> Quorum is set, on its own
// line above the tabs at the inline end.
//
// WHO IS COUNTED: everyone in the room, observers included (16 Sep 2026). The caller passes
// the counts; the chair page counts the whole roster for `present` / `total` and for its own
// `belowQuorum` gate, so this read-out and the gate can never disagree. Observers drop out
// of the maths only at the final substantive vote on /voting/[code].
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "var(--font-brand), sans-serif";
const GAUGE_W = 36;
const GAUGE_H = 20;
const STROKE = 3.5;
const R = (GAUGE_W - STROKE) / 2 - 1;
const CX = GAUGE_W / 2;
const CY = GAUGE_H - 1;
const FLARE = 7;

function HalfGauge({ fill, color, value }: { fill: number; color: string; value: number }) {
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const pct = Math.min(1, Math.max(0, fill)) * 100;
  return (
    <span className="relative block shrink-0" style={{ width: GAUGE_W, height: GAUGE_H }} aria-hidden>
      {/* Mirrored in RTL so the arc fills from the reading start. */}
      <svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} className="absolute inset-0 overflow-visible rtl:-scale-x-100">
        <path d={arc} fill="none" stroke="rgba(237,231,216,0.14)" strokeWidth={STROKE} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <span
        className="absolute inset-x-0 bottom-0 text-center tabular-nums"
        style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: value > 99 ? 9 : 11, color: '#F4EFE3', lineHeight: 1 }}
      >
        {value}
      </span>
    </span>
  );
}

export default function QuorumRings({
  present,
  total,
  quorumNeeded = null,
  ground = '#1B3828',
  trailing,
}: {
  /** Delegations present, observers included. */
  present: number;
  /** Delegations on the roster, observers included. */
  total: number;
  /** Delegations the quorum rule requires, or null when no quorum rule is set. */
  quorumNeeded?: number | null;
  /** The colour of the list the tabs grow out of. */
  ground?: string;
  /** Drawn to the inline end of the tabs on the same row (the inline seat field). */
  trailing?: ReactNode;
}) {
  const t = useT();
  const twoThirds = Math.ceil((present * 2) / 3);
  const majority = Math.floor(present / 2) + 1;
  const cells = [
    { key: 'present', fill: 1, color: '#5FA877', value: present, label: t('identity_present'), aria: t('identity_present_aria', { n: present, total }) },
    { key: 'two-thirds', fill: 2 / 3, color: '#E3C166', value: twoThirds, label: t('identity_tab_two_thirds'), aria: t('identity_two_thirds_aria', { n: twoThirds }) },
    { key: 'majority', fill: 0.5, color: 'rgba(237,231,216,0.62)', value: majority, label: t('identity_tab_majority'), aria: t('identity_majority_aria', { n: majority }) },
  ];
  const quorumMet = quorumNeeded !== null && present >= quorumNeeded;
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== false;

  return (
    <div className="flex flex-col">
      {quorumNeeded !== null && (
        <p
          className="flex items-center justify-end gap-1 m-0 mb-1 self-end min-w-0 text-end"
          style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, lineHeight: 1.15, color: quorumMet ? '#9FD3AE' : '#F2C77E', textWrap: 'balance' }}
        >
          {quorumMet ? <Check size={11} strokeWidth={3} aria-hidden className="shrink-0" /> : <TriangleAlert size={11} strokeWidth={2.5} aria-hidden className="shrink-0" />}
          <span>{quorumMet ? t('identity_quorum_met') : t('identity_quorum_needs', { n: quorumNeeded })}</span>
        </p>
      )}
      <div className="flex items-end gap-2 min-w-0">
        {/* The inline padding keeps each tab's foot flare inside the masthead. */}
        <div role="group" aria-label={t('identity_quorum_group')} title={t('identity_observers_counted')} className={hasTrailing ? 'shrink-0' : 'w-full'}>
        <ul
          className={`flex items-end m-0 p-0 list-none ${hasTrailing ? 'gap-2.5' : 'w-full justify-evenly'}`}
          style={{ paddingInline: FLARE }}
        >
          {cells.map((c) => (
            <li
              key={c.key}
              aria-label={c.aria}
              className="relative flex flex-col items-center"
              style={{ minWidth: 44, padding: '4px 4px 2px', backgroundColor: ground, borderRadius: '11px 11px 0 0' }}
            >
              {/* Concave flares: the tab curves out into the list at its foot. Physical
                  left/right on purpose: each gradient's centre is a physical corner. */}
              <span aria-hidden className="pointer-events-none absolute bottom-0" style={{ left: -FLARE, width: FLARE, height: FLARE, background: `radial-gradient(circle at 0 0, transparent ${FLARE - 0.5}px, ${ground} ${FLARE}px)` }} />
              <span aria-hidden className="pointer-events-none absolute bottom-0" style={{ right: -FLARE, width: FLARE, height: FLARE, background: `radial-gradient(circle at 100% 0, transparent ${FLARE - 0.5}px, ${ground} ${FLARE}px)` }} />
              <span
                aria-hidden
                className="whitespace-nowrap"
                style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700, lineHeight: 1.1, letterSpacing: '0.02em', color: 'rgba(237,231,216,0.82)', marginBottom: 1 }}
              >
                {c.label}
              </span>
              <HalfGauge fill={c.fill} color={c.color} value={c.value} />
            </li>
          ))}
        </ul>
        </div>
        {hasTrailing && <div className="flex-1 min-w-0 flex justify-end" style={{ paddingBottom: 6 }}>{trailing}</div>}
      </div>
    </div>
  );
}
