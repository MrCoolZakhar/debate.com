'use client';

/**
 * The final roll call's quorum read-out, turned on its side (owner, 18 Sep 2026: "move the
 * quorum indicators to the left side of the card, attached rotated 90 degrees, and bigger").
 *
 * The same three bookmark tabs as the chair sidebar's `QuorumRings` (Present, 2/3, 1/2+1),
 * with the SAME numbers and the SAME sentences for assistive technology, but growing sideways
 * out of the card's inline-start edge instead of up out of its list: rounded on the outer
 * side, concave flares where each tab meets the card, in the card's own forest so they read
 * as part of it. Larger than the sidebar's (a 52x30 gauge, 16px numbers), since the roll call
 * is projected. The text stays upright; only the tab is turned.
 *
 * Counted exactly as QuorumRings counts, i.e. as the chair sidebar does: everyone in the
 * room, OBSERVERS INCLUDED, and a quorum figure over every seat. The ballot's own
 * observer-free denominators live in the Threshold drawer, not here.
 *
 * Positioned by the caller: this renders an absolutely placed column whose inline-end edge is
 * the card's inline-start edge (it overlaps the card's 1.5px border so the join is seamless).
 */

import { Check, TriangleAlert } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "var(--font-brand), sans-serif";
const GAUGE_W = 52;
const GAUGE_H = 30;
const STROKE = 5;
const R = (GAUGE_W - STROKE) / 2 - 1;
const CX = GAUGE_W / 2;
const CY = GAUGE_H - 1.5;
const FLARE = 10;
const BORDER = 1.5;

function HalfGauge({ fill, color, value }: { fill: number; color: string; value: number }) {
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const pct = Math.min(1, Math.max(0, fill)) * 100;
  return (
    <span className="relative block shrink-0" style={{ width: GAUGE_W, height: GAUGE_H }} aria-hidden>
      <svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} className="absolute inset-0 overflow-visible rtl:-scale-x-100">
        <path d={arc} fill="none" stroke="rgba(237,231,216,0.14)" strokeWidth={STROKE} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <span
        className="absolute inset-x-0 bottom-0 text-center tabular-nums"
        style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: value > 99 ? 13 : 16, color: '#F4EFE3', lineHeight: 1 }}
      >
        {value}
      </span>
    </span>
  );
}

export function SideQuorumTabs({ present, total, quorumNeeded = null, ground, rtl = false, top = 22 }: {
  /** Delegations present, observers included. */
  present: number;
  /** Delegations on the roster, observers included. */
  total: number;
  /** Delegations the quorum rule requires, or null when no quorum rule is set. */
  quorumNeeded?: number | null;
  /** The card's colour. */
  ground: string;
  rtl?: boolean;
  /** Distance from the card's top edge, px. */
  top?: number;
}) {
  const t = useT();
  // Identical to QuorumRings.
  const twoThirds = Math.ceil((present * 2) / 3);
  const majority = Math.floor(present / 2) + 1;
  const cells = [
    { key: 'present', fill: 1, color: '#5FA877', value: present, label: t('identity_present'), aria: t('identity_present_aria', { n: present, total }) },
    { key: 'two-thirds', fill: 2 / 3, color: '#E3C166', value: twoThirds, label: t('identity_tab_two_thirds'), aria: t('identity_two_thirds_aria', { n: twoThirds }) },
    { key: 'majority', fill: 0.5, color: 'rgba(237,231,216,0.62)', value: majority, label: t('identity_tab_majority'), aria: t('identity_majority_aria', { n: majority }) },
  ];
  const quorumMet = quorumNeeded !== null && present >= quorumNeeded;

  // Physical sides on purpose: every radius and gradient centre below is a physical corner.
  const outer = rtl ? 'right' : 'left';
  const inner = rtl ? 'left' : 'right';
  const radius = rtl ? '0 16px 16px 0' : '16px 0 0 16px';
  const topFlare = `radial-gradient(circle at ${rtl ? '100% 0' : '0 0'}, transparent ${FLARE - 0.5}px, ${ground} ${FLARE}px)`;
  const bottomFlare = `radial-gradient(circle at ${rtl ? '100% 100%' : '0 100%'}, transparent ${FLARE - 0.5}px, ${ground} ${FLARE}px)`;

  return (
    <div
      role="group"
      aria-label={t('identity_quorum_group')}
      title={t('identity_observers_counted')}
      className="absolute z-[3] flex flex-col"
      style={{ top, [outer]: 'auto', [inner]: `calc(100% - ${BORDER}px)`, alignItems: rtl ? 'flex-start' : 'flex-end' }}
    >
      <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 12, paddingBlock: FLARE, alignItems: rtl ? 'flex-start' : 'flex-end' }}>
        {cells.map((c) => (
          <li
            key={c.key}
            aria-label={c.aria}
            className="relative flex flex-col items-center"
            style={{ width: 78, padding: rtl ? '8px 12px 7px 10px' : '8px 10px 7px 12px', backgroundColor: ground, borderRadius: radius, boxShadow: `${rtl ? '6px' : '-6px'} 8px 18px rgba(27,56,40,0.18)` }}
          >
            <span aria-hidden className="pointer-events-none absolute" style={{ top: -FLARE, [inner]: 0, width: FLARE, height: FLARE, background: topFlare }} />
            <span aria-hidden className="pointer-events-none absolute" style={{ bottom: -FLARE, [inner]: 0, width: FLARE, height: FLARE, background: bottomFlare }} />
            <span
              aria-hidden
              className="whitespace-nowrap"
              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, lineHeight: 1.1, letterSpacing: '0.02em', color: 'rgba(237,231,216,0.85)', marginBottom: 3 }}
            >
              {c.label}
            </span>
            <HalfGauge fill={c.fill} color={c.color} value={c.value} />
          </li>
        ))}
      </ul>
      {quorumNeeded !== null && (
        <p
          className="m-0 mt-1 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-center"
          style={{
            width: 78, [inner === 'right' ? 'marginRight' : 'marginLeft']: 6,
            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, lineHeight: 1.15,
            backgroundColor: quorumMet ? 'rgba(61,122,82,0.14)' : 'rgba(182,135,31,0.16)',
            color: quorumMet ? '#2F6B45' : '#7A5812', textWrap: 'balance',
          }}
        >
          {quorumMet ? <Check size={13} strokeWidth={3} aria-hidden className="shrink-0" /> : <TriangleAlert size={13} strokeWidth={2.5} aria-hidden className="shrink-0" />}
          <span>{quorumMet ? t('identity_quorum_met') : t('identity_quorum_needs', { n: quorumNeeded })}</span>
        </p>
      )}
    </div>
  );
}
