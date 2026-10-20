'use client';

// DelegationCrest: a delegation's round crest, everywhere one is drawn (owner,
// 20 Oct 2026: the organiser's delegation pop-up "looks very bland: no image").
//
//   * The delegation's own logo (`societies.logo_url`) in a circle, when it has
//     one and it loads.
//   * Otherwise OUR OWN drawn crest, in the spirit of MyMUN's designed
//     placeholders: a soft round badge in one of six muted tones of the house
//     palette (neu.tsx tokens, so a conference's own colours carry through),
//     a fine inner ring, a laurel wreath drawn in fine line (icon direction A:
//     bare ink, no gradients, no emoji) and the delegation's initials in Inter.
//     The tone is picked from the name, so a delegation always looks the same.
//     Below 40px the wreath is left out so the initials stay readable.
//
// Presentational only; no reads, no writes.

import { useState } from 'react';
import { NEU, OUTFIT } from '@/components/neu';
import { delegationInitials } from '@/app/manage/[slug]/applications/DelegationAvatar';

interface Tone { bg: string; ink: string }

/** Six muted tones built from the neu.tsx palette (forest, gold, amber, sage, ivory, stone). */
export const CREST_TONES: Tone[] = [
  { bg: `color-mix(in srgb, ${NEU.forest} 11%, #FFFFFF)`, ink: NEU.forest },
  { bg: `color-mix(in srgb, ${NEU.gold} 42%, #FFFFFF)`, ink: `color-mix(in srgb, ${NEU.deepGold} 62%, #1C1410)` },
  { bg: `color-mix(in srgb, ${NEU.amber} 17%, #FFFFFF)`, ink: `color-mix(in srgb, ${NEU.amber} 72%, #1C1410)` },
  { bg: `color-mix(in srgb, ${NEU.green} 20%, #FFFFFF)`, ink: `color-mix(in srgb, ${NEU.forest} 82%, ${NEU.green})` },
  { bg: NEU.base, ink: NEU.forest },
  { bg: `color-mix(in srgb, ${NEU.ink} 7%, #FFFFFF)`, ink: `color-mix(in srgb, ${NEU.ink} 82%, #FFFFFF)` },
];

/** The tone a delegation's name always lands on. */
export function crestTone(name: string): Tone {
  let h = 0;
  const key = name.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CREST_TONES[h % CREST_TONES.length];
}

// The left branch of the wreath, in a 100 x 100 box: a stem on a circle of
// radius 33 round the centre, from just left of the bottom up the left side,
// with a pair of leaves (outer and inner) every 20 degrees, tilted forward.
const STEM_R = 33;
const LEAF_ANGLES = [116, 136, 156, 176, 196];
const rad = (d: number) => (d * Math.PI) / 180;
const at = (r: number, deg: number) => ({ x: 50 + r * Math.cos(rad(deg)), y: 50 + r * Math.sin(rad(deg)) });
const STEM_FROM = at(STEM_R, 100);
const STEM_TO = at(STEM_R, 214);
const STEM_PATH = `M ${STEM_FROM.x.toFixed(2)} ${STEM_FROM.y.toFixed(2)} A ${STEM_R} ${STEM_R} 0 0 1 ${STEM_TO.x.toFixed(2)} ${STEM_TO.y.toFixed(2)}`;
const LEAVES = LEAF_ANGLES.flatMap(deg => {
  const outer = at(STEM_R + 3.6, deg);
  const inner = at(STEM_R - 3.6, deg);
  return [
    { cx: outer.x, cy: outer.y, rot: deg + 55 },
    { cx: inner.x, cy: inner.y, rot: deg + 125 },
  ];
});
const TOP_LEAF = at(STEM_R, 222);

function Wreath({ ink }: { ink: string }) {
  const line = { stroke: ink, strokeWidth: 1, fill: 'none', vectorEffect: 'non-scaling-stroke' as const, strokeLinecap: 'round' as const };
  const branch = (
    <g>
      <path d={STEM_PATH} style={line} />
      {LEAVES.map((l, i) => (
        <ellipse key={i} cx={l.cx} cy={l.cy} rx={6.2} ry={2.6} transform={`rotate(${l.rot.toFixed(1)} ${l.cx.toFixed(2)} ${l.cy.toFixed(2)})`} style={line} />
      ))}
      <ellipse cx={TOP_LEAF.x} cy={TOP_LEAF.y} rx={5.6} ry={2.4} transform={`rotate(${(222 + 90).toFixed(1)} ${TOP_LEAF.x.toFixed(2)} ${TOP_LEAF.y.toFixed(2)})`} style={line} />
    </g>
  );
  return (
    <g style={{ opacity: 0.72 }}>
      {branch}
      <g transform="translate(100 0) scale(-1 1)">{branch}</g>
      {/* Where the two branches cross under the initials. */}
      <path d={`M ${STEM_FROM.x.toFixed(2)} ${STEM_FROM.y.toFixed(2)} L ${(100 - STEM_FROM.x + 3).toFixed(2)} ${(STEM_FROM.y + 3.5).toFixed(2)} M ${(100 - STEM_FROM.x).toFixed(2)} ${STEM_FROM.y.toFixed(2)} L ${(STEM_FROM.x - 3).toFixed(2)} ${(STEM_FROM.y + 3.5).toFixed(2)}`} style={line} />
      <circle cx={50} cy={16.5} r={1.5} style={{ fill: ink, stroke: 'none' }} />
    </g>
  );
}

export default function DelegationCrest({ name, logoUrl, size = 48, selected = false, className, title }: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  /** A forest ring round the crest (a picked delegation in a list). */
  selected?: boolean;
  className?: string;
  /** Hover text; the crest is decorative (aria-hidden) unless the caller names it. */
  title?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const ring = selected
    ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${NEU.forest}`
    : 'inset 0 0 0 1px rgba(0,0,0,0.06)';

  if (logoUrl && failed !== logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        title={title}
        onError={() => setFailed(logoUrl)}
        className={`flex-shrink-0 select-none ${className ?? ''}`}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#FFFFFF', boxShadow: ring }}
      />
    );
  }

  const tone = crestTone(name);
  const initials = delegationInitials(name);
  const withWreath = size >= 40;
  return (
    <span
      aria-hidden
      title={title}
      className={`inline-flex flex-shrink-0 select-none ${className ?? ''}`}
      style={{ width: size, height: size, borderRadius: '50%', boxShadow: selected ? ring : 'none', lineHeight: 0 }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} focusable="false" style={{ display: 'block' }}>
        <circle cx={50} cy={50} r={50} style={{ fill: tone.bg }} />
        <circle cx={50} cy={50} r={45.5} style={{ fill: 'none', stroke: tone.ink, strokeWidth: 1, opacity: 0.3, vectorEffect: 'non-scaling-stroke' }} />
        {withWreath && <Wreath ink={tone.ink} />}
        <text
          x={50}
          y={51}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: tone.ink, fontFamily: OUTFIT, fontWeight: 600,
            fontSize: withWreath ? (initials.length > 1 ? 25 : 28) : 36,
            letterSpacing: initials.length > 1 ? '0.02em' : 0,
          }}
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}
