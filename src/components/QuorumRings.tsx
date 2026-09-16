'use client';

// ─────────────────────────────────────────────────────────────────────────────
// QuorumRings: the attendance and majority read-out at the foot of the chair sidebar
// masthead and of the pre-session roll-call card.
//
// Three numbers, unchanged since the unlabelled "5 4 3" pies:
//   1. Present   the delegations present                                  (full ring)
//   2. 2/3       ceil(present x 2/3), the votes a two-thirds majority needs (2/3 of it)
//   3. 1/2+1     floor(present / 2) + 1, the votes a simple majority needs  (half of it)
// Each gauge is a pictogram of its fraction, never a live value, so it never animates. The
// number sits inside the ring, the word under it, and every cell carries a full sentence as
// its accessible name.
//
// ── Shape (16 Sep 2026) ──────────────────────────────────────────────────────
// Round, not angular: each cell is a capsule (fully rounded ends) holding a complete
// circular ring, replacing the half-circle bookmark tabs with their concave foot flares. The
// tabs read as torn paper at a glance and the half gauges looked like broken circles; a full
// ring says "a whole room, this much of it" in one shape. The row floats clear of the list
// below instead of sitting flush on it, so the masthead ends on a soft edge.
//
// `compact` packs the three capsules together in the middle instead of spreading them across
// the full width. The pre-session roll-call card uses it: that card is far wider than the
// sidebar, and spread across it the three numbers stopped reading as one group.
//
// WHO IS COUNTED: everyone in the room, observers included (16 Sep 2026). The caller passes
// the counts; the chair page counts the whole roster for `present` / `total` and for its own
// `belowQuorum` gate, so this read-out and the gate can never disagree. Observers drop out
// of the maths only at the final substantive vote on /voting/[code].
// ─────────────────────────────────────────────────────────────────────────────

import { Check, TriangleAlert } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "'Outfit', sans-serif";
const RING = 38;          // gauge box, px
const STROKE = 4.5;
const R = (RING - STROKE) / 2 - 0.5;

function Ring({ fill, color, value }: { fill: number; color: string; value: number }) {
  const circ = 2 * Math.PI * R;
  const shown = Math.min(1, Math.max(0, fill));
  return (
    <span className="relative block shrink-0" style={{ width: RING, height: RING }} aria-hidden>
      {/* Mirrored in RTL so the arc fills from the reading start. */}
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 rtl:-scale-x-100">
        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="rgba(237,231,216,0.13)" strokeWidth={STROKE} />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center tabular-nums"
        style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: value > 99 ? 11 : 13, color: '#F4EFE3', lineHeight: 1 }}
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
  compact = false,
}: {
  /** Delegations present, observers included. */
  present: number;
  /** Delegations on the roster, observers included. */
  total: number;
  /** Delegations the quorum rule requires, or null when no quorum rule is set. */
  quorumNeeded?: number | null;
  /** Pack the three capsules together in the middle (the pre-session roll-call card). */
  compact?: boolean;
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
    <div role="group" aria-label={t('identity_quorum_group')} title={t('identity_observers_counted')} className="flex flex-col">
      {/* The quorum pill sits on its own line above the capsules, at the inline end, so the
          three of them keep the width to themselves. */}
      {quorumNeeded !== null && (
        <p
          className="flex items-center justify-end gap-1 m-0 mb-1.5 self-end min-w-0 text-end"
          style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, lineHeight: 1.15, color: quorumMet ? '#9FD3AE' : '#F2C77E', textWrap: 'balance' }}
        >
          {quorumMet ? <Check size={11} strokeWidth={3} aria-hidden className="shrink-0" /> : <TriangleAlert size={11} strokeWidth={2.5} aria-hidden className="shrink-0" />}
          <span>{quorumMet ? t('identity_quorum_met') : t('identity_quorum_needs', { n: quorumNeeded })}</span>
        </p>
      )}
      <ul
        className={`flex items-stretch m-0 p-0 list-none w-full ${compact ? 'justify-center gap-2' : 'justify-evenly'}`}
        style={{ paddingBottom: 10 }}
      >
        {cells.map((c) => (
          <li
            key={c.key}
            aria-label={c.aria}
            className="flex flex-col items-center gap-1"
            style={{
              width: 64,
              padding: '7px 0 8px',
              borderRadius: 999,
              backgroundColor: 'rgba(237,231,216,0.055)',
              boxShadow: 'inset 0 0 0 1px rgba(237,231,216,0.09)',
            }}
          >
            <Ring fill={c.fill} color={c.color} value={c.value} />
            <span
              aria-hidden
              className="truncate max-w-full"
              style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, lineHeight: 1.1, letterSpacing: '0.02em', color: 'rgba(237,231,216,0.78)' }}
            >
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
