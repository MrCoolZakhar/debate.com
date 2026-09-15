'use client';

// ─────────────────────────────────────────────────────────────────────────────
// QuorumRings: the attendance and majority read-out at the foot of the chair sidebar
// masthead, drawn as three small bookmark tabs that grow up out of the speakers list.
//
// Same three numbers the old unlabelled "5 4 3" pies carried (MajorityPie in
// RollCallPanel, still used by the voting and advisor pages):
//   1. Present   the delegations present                         (full half circle)
//   2. 2/3       ceil(present x 2/3), the votes a two-thirds majority needs   (2/3 of it)
//   3. 1/2+1     floor(present / 2) + 1, the votes a simple majority needs    (half of it)
// Each gauge is a HALF circle and its arc is a pictogram of the fraction, never a live
// value, so it never animates. The word sits on top, the number inside the arc, and every
// cell carries a full sentence as its accessible name.
//
// Shape (15 Sep 2026): a tab with rounded top corners and concave flares at its foot, in
// the list's own ground colour (`ground`), sitting flush on the masthead's bottom edge, so
// each one reads as part of the list rather than a box floating above it. The whole row is
// ~40px tall, which is what moved the list up.
//
// The three tabs are spread evenly across the sidebar (justify-evenly), not packed at the
// start. The optional quorum pill appears only when Settings -> Voting -> Quorum is set, on
// its own line above the tabs at the inline end, so it never squeezes the spacing.
// ─────────────────────────────────────────────────────────────────────────────

import { Check, TriangleAlert } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "'Outfit', sans-serif";
const GAUGE_W = 40;
const GAUGE_H = 22;
const STROKE = 4;
const R = (GAUGE_W - STROKE) / 2 - 1; // 17
const CX = GAUGE_W / 2;
const CY = GAUGE_H - 1;
const FLARE = 8;

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
        style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: value > 99 ? 9.5 : 11.5, color: '#F4EFE3', lineHeight: 1 }}
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
}: {
  /** Voting delegations present (observers excluded). */
  present: number;
  /** Voting delegations on the roster (observers excluded). */
  total: number;
  /** Delegations the quorum rule requires, or null when no quorum rule is set. */
  quorumNeeded?: number | null;
  /** The colour of the list the tabs grow out of. */
  ground?: string;
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

  return (
    <div
      role="group"
      aria-label={t('identity_quorum_group')}
      title={t('identity_observers_excluded')}
      className="flex flex-col"
    >
      {/* The quorum pill sits on its own line above the tabs, at the inline end, so the three
          tabs keep the full width to themselves and stay evenly spaced (15 Sep 2026). */}
      {quorumNeeded !== null && (
        <p
          className="flex items-center justify-end gap-1 m-0 mb-1.5 self-end min-w-0 text-end"
          style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, lineHeight: 1.15, color: quorumMet ? '#9FD3AE' : '#F2C77E', textWrap: 'balance' }}
        >
          {quorumMet ? <Check size={11} strokeWidth={3} aria-hidden className="shrink-0" /> : <TriangleAlert size={11} strokeWidth={2.5} aria-hidden className="shrink-0" />}
          <span>{quorumMet ? t('identity_quorum_met') : t('identity_quorum_needs', { n: quorumNeeded })}</span>
        </p>
      )}
      {/* Evenly distributed across the whole width (space-evenly: the same gap between the
          tabs and at both edges), so they spread as the sidebar is resized. The inline
          padding keeps each tab's foot flare inside the masthead. */}
      <ul className="flex items-end justify-evenly m-0 p-0 list-none w-full" style={{ paddingInline: FLARE }}>
        {cells.map((c) => (
          <li
            key={c.key}
            aria-label={c.aria}
            className="relative flex flex-col items-center"
            style={{ width: 52, padding: '5px 0 3px', backgroundColor: ground, borderRadius: '12px 12px 0 0' }}
          >
            {/* Concave flares: the tab curves out into the list at its foot. Physical left/right
                on purpose: each gradient's centre is a physical corner. */}
            <span aria-hidden className="pointer-events-none absolute bottom-0" style={{ left: -FLARE, width: FLARE, height: FLARE, background: `radial-gradient(circle at 0 0, transparent ${FLARE - 0.5}px, ${ground} ${FLARE}px)` }} />
            <span aria-hidden className="pointer-events-none absolute bottom-0" style={{ right: -FLARE, width: FLARE, height: FLARE, background: `radial-gradient(circle at 100% 0, transparent ${FLARE - 0.5}px, ${ground} ${FLARE}px)` }} />
            <span
              aria-hidden
              className="truncate max-w-full"
              style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, lineHeight: 1.1, letterSpacing: '0.02em', color: 'rgba(237,231,216,0.82)', marginBottom: 2 }}
            >
              {c.label}
            </span>
            <HalfGauge fill={c.fill} color={c.color} value={c.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}
