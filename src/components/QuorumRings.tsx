'use client';

// ─────────────────────────────────────────────────────────────────────────────
// QuorumRings: the attendance and majority read-out in the chair sidebar masthead.
//
// Same three numbers the old unlabelled "5 4 3" pies carried (MajorityPie in
// RollCallPanel, still used by the voting and advisor pages):
//   1. Present          the delegations present (full ring)
//   2. Two thirds       ceil(present x 2/3), the votes a two-thirds majority needs
//   3. Majority         floor(present / 2) + 1, the votes a simple majority needs
// The ring arcs are pictograms of the fraction (whole, two thirds, half), never a
// live gauge, so they never animate. Every number now has a word under it and a
// full sentence as its accessible name, so nothing depends on colour or on the
// chair remembering which pie meant what.
//
// The optional quorum pill appears only when Settings -> Voting -> Quorum is set.
// ─────────────────────────────────────────────────────────────────────────────

import { Check, TriangleAlert } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "'Outfit', sans-serif";
const RING = 30;
const STROKE = 3.5;

function Ring({ fill, color, value }: { fill: number; color: string; value: number }) {
  const r = (RING - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: RING, height: RING }} aria-hidden>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 rtl:-scale-x-100">
        <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="rgba(237,231,216,0.12)" strokeWidth={STROKE} />
        <circle
          cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={color} strokeWidth={STROKE}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(1, Math.max(0, fill)))}
          strokeLinecap="round" transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </svg>
      <span
        className="relative tabular-nums"
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
}: {
  /** Voting delegations present (observers excluded). */
  present: number;
  /** Voting delegations on the roster (observers excluded). */
  total: number;
  /** Delegations the quorum rule requires, or null when no quorum rule is set. */
  quorumNeeded?: number | null;
}) {
  const t = useT();
  const twoThirds = Math.ceil((present * 2) / 3);
  const majority = Math.floor(present / 2) + 1;
  const cells = [
    { key: 'present', fill: 1, color: '#5FA877', value: present, label: t('identity_present'), aria: t('identity_present_aria', { n: present, total }) },
    { key: 'two-thirds', fill: 2 / 3, color: '#E3C166', value: twoThirds, label: t('identity_two_thirds'), aria: t('identity_two_thirds_aria', { n: twoThirds }) },
    { key: 'majority', fill: 0.5, color: 'rgba(237,231,216,0.62)', value: majority, label: t('identity_majority'), aria: t('identity_majority_aria', { n: majority }) },
  ];
  const quorumMet = quorumNeeded !== null && present >= quorumNeeded;

  return (
    <div
      role="group"
      aria-label={t('identity_quorum_group')}
      title={t('identity_observers_excluded')}
      className="rounded-xl"
      style={{ backgroundColor: 'rgba(0,0,0,0.16)', padding: '7px 6px 6px' }}
    >
      <ul className="grid grid-cols-3 gap-1 m-0 p-0 list-none">
        {cells.map((c) => (
          <li key={c.key} className="flex flex-col items-center gap-1 min-w-0" aria-label={c.aria}>
            <Ring fill={c.fill} color={c.color} value={c.value} />
            <span
              aria-hidden
              className="truncate max-w-full"
              style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 600, lineHeight: 1.1, color: 'rgba(237,231,216,0.8)' }}
            >
              {c.label}
            </span>
          </li>
        ))}
      </ul>
      {quorumNeeded !== null && (
        <p
          className="flex items-center justify-center gap-1.5 m-0 mt-1.5"
          style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: quorumMet ? '#9FD3AE' : '#F2C77E' }}
        >
          {quorumMet ? <Check size={12} strokeWidth={3} aria-hidden /> : <TriangleAlert size={12} strokeWidth={2.5} aria-hidden />}
          {quorumMet ? t('identity_quorum_met') : t('identity_quorum_needs', { n: quorumNeeded })}
        </p>
      )}
    </div>
  );
}
