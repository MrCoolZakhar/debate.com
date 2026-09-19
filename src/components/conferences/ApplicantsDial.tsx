'use client';

// ── ApplicantsDial ─────────────────────────────────────────────────────────
//
// One big friendly ring: applicants against target, with the funnel shown as
// bands around it and the stage numbers reduced to a compact key beside it.
//
// The important modelling decision: the incoming stages NEST (every paid
// applicant is also assigned, accepted and counted in the total), and nested
// values cannot be drawn as segments of one ring — they would imply the stages
// are disjoint and sum to the whole, overstating the headcount fourfold. The
// earlier version solved that with four concentric rings, which was correct but
// read as busy instrumentation rather than a dashboard headline.
//
// So this converts nesting into DIFFERENCES before drawing: paid, then
// assigned-but-not-paid, then accepted-but-not-assigned, then applied-but-not-
// accepted. Those four ARE disjoint, they DO sum to the total, and they can
// honestly share a single ring. The remaining arc is the gap to target.
//
// Colour still comes from the shared sequential ramp, darkest at the furthest
// stage, so a colour means the same thing here as on the chart. Attention is a
// separate marker. The visible CHECK pill, the gold swatch ring and the dashed
// ring were removed (owner, 18 Sep 2026: "no need for a check"); a low stage is
// still named "needs attention" in the dial's accessible label.

import { OUTFIT } from '@/components/neu';
import { FUNNEL_RAMP } from './ParticipantsChart';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const MUTED = '#6B5F52';
const TRACK = '#E7E1D1';
/** Pledged spots are gold, never a green from the funnel ramp: they are people
 *  who are coming but have not applied, so they must not read as a stage of the
 *  application funnel. */
const PLEDGED = '#C79A2E';

/** A stage is flagged below this share of the stage above it — the same 70%
 *  bar the set-up priorities use, so "fine" means one thing on this page. */
const HEALTHY_RATIO = 0.7;

export interface DialStage {
  key: string;
  label: string;
  value: number;
  /** Deep link into the applications table, pre-filtered to this stage. */
  href?: string;
}

export interface ApplicantsDialProps {
  /** Ordered widest → narrowest funnel stage. */
  stages: DialStage[];
  expected: number;
  /** Delegation spots pledged that nobody has registered against yet — real
   *  people, no application row (see src/lib/pledgedSpots.ts). They join the
   *  centre number and get their own gold band and key row; they are NEVER
   *  folded into a funnel stage, because they have not applied. */
  pledged?: number;
  size?: number;
  onNavigate?: (href: string) => void;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${a.x},${a.y} A${r},${r} 0 ${large} 1 ${b.x},${b.y}`;
}

export default function ApplicantsDial({
  stages, expected, pledged = 0, size = 236, onNavigate,
}: ApplicantsDialProps) {
  const target = Math.max(expected, 0);
  const registered = stages[0]?.value ?? 0;
  const pledgedHeads = Math.max(0, Math.round(pledged));
  /* The headline is everybody expected: rows on the list plus pledged spots
     still to be filled. The funnel bands below stay row-only, so the ring can
     never claim a pledged spot has been accepted or paid. */
  const current = registered + pledgedHeads;

  /* Nested → disjoint. Walk from the narrowest stage outward, each band being
     what that stage has that the next one in does not. Clamped at zero: a
     delegate can pay before being seated, so a later stage can legitimately
     exceed an earlier one, and a negative band would render as a wrap-around. */
  const bands = stages
    .map((s, i) => {
      const inner = stages[i + 1];
      return {
        key: s.key,
        label: s.label,
        value: s.value,
        href: s.href,
        band: Math.max(0, s.value - (inner ? inner.value : 0)),
        // Widened on purpose: the pledged band appended below is gold, not a
        // member of the funnel ramp's literal union.
        color: FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)] as string,
      };
    })
    .reverse(); // draw furthest-through-the-funnel first

  const flagged = new Set(
    stages
      .filter((s, i) => {
        const above = i === 0 ? null : stages[i - 1];
        return above != null && above.value > 0 && s.value / above.value < HEALTHY_RATIO;
      })
      .map((s) => s.key),
  );

  const denom = Math.max(target, current, 1);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(18, size * 0.115);
  const r = size / 2 - stroke / 2 - 4;
  const GAP = 1.4; // degrees of surface showing between bands

  let cursor = 0;
  const arcs = bands
    .filter((b) => b.band > 0)
    .map((b) => {
      const sweep = (b.band / denom) * 360;
      const from = cursor;
      const to = cursor + sweep;
      cursor = to;
      return { ...b, from, to: Math.max(from, to - GAP) };
    });
  /* Pledged spots ride on the OUTSIDE of the funnel, after "applied but not
     accepted": they are the furthest thing from a decided application. */
  if (pledgedHeads > 0) {
    const sweep = (pledgedHeads / denom) * 360;
    const from = cursor;
    const to = cursor + sweep;
    cursor = to;
    arcs.push({
      key: 'pledged',
      label: 'Pledged spots',
      value: pledgedHeads,
      href: undefined,
      band: pledgedHeads,
      color: PLEDGED,
      from,
      to: Math.max(from, to - GAP),
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${current} of ${target} expected applicants${
            pledgedHeads > 0 ? `, of which ${registered} registered and ${pledgedHeads} pledged delegation spots` : ''
          }. ${stages
            .map((s) => `${s.label} ${s.value}${flagged.has(s.key) ? ', needs attention' : ''}`)
            .join('. ')}.`}
        >
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} strokeLinecap="round" />
          {arcs.map((a) => (
            <path
              key={a.key}
              d={arcPath(cx, cy, r, a.from, a.to)}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
            >
              <title>{`${a.label}: ${a.value.toLocaleString()}`}</title>
            </path>
          ))}
        </svg>

        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: OUTFIT, fontWeight: 900, color: INK, lineHeight: 1,
              fontSize: size * 0.2, letterSpacing: '-0.035em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {current.toLocaleString()}
          </span>
          <span
            style={{
              marginTop: 2, fontFamily: OUTFIT, fontWeight: 800, color: MUTED,
              fontSize: size * 0.085, fontVariantNumeric: 'tabular-nums',
            }}
          >
            /{target > 0 ? target.toLocaleString() : '—'}
          </span>
          <span
            style={{
              marginTop: 4, fontFamily: OUTFIT, fontSize: Math.max(8, size * 0.043),
              fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED,
            }}
          >
            Applicants
          </span>
          {/* Never let the bigger number stand alone: it is a sum, and the
              organiser has to be able to see what is on the list today. */}
          {pledgedHeads > 0 && (
            <span
              style={{
                marginTop: 2, fontFamily: OUTFIT, fontSize: Math.max(8, size * 0.042),
                fontWeight: 700, color: MUTED, fontVariantNumeric: 'tabular-nums',
              }}
            >
              {registered.toLocaleString()} registered · {pledgedHeads.toLocaleString()} pledged
            </span>
          )}
        </div>
      </div>

      {/* The key. Small on purpose — the ring is the headline, these are the
          read-out. Each row deep-links into the matching applications view. */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, minWidth: 150 }}>
        {stages.map((s) => {
          const color = FUNNEL_RAMP[Math.min(stages.indexOf(s), FUNNEL_RAMP.length - 1)];
          const inner = (
            <>
              <span
                style={{
                  width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: INK_70 }}>
                {s.label}
              </span>
              <span
                style={{
                  marginInlineStart: 'auto', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900,
                  color: INK, fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.value.toLocaleString()}
              </span>
            </>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <button
                  type="button"
                  onClick={() => onNavigate?.(s.href!)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    padding: '3px 4px', borderRadius: 7, textAlign: 'start',
                    minHeight: 26,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(27,56,40,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {inner}
                </button>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 4px', minHeight: 26 }}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
        {/* Not a funnel stage, and placed after them so it never reads as one:
            spots a delegation has pledged and nobody has taken up yet. No deep
            link, because there is no application row to open. */}
        {pledgedHeads > 0 && (
          <li>
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 4px', minHeight: 26 }}
              title="Delegation spots pledged by a head delegate or faculty advisor that nobody has registered against yet. Each one is a person coming."
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: PLEDGED, flexShrink: 0 }} />
              <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: INK_70 }}>
                Pledged spots
              </span>
              <span
                style={{
                  marginInlineStart: 'auto', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900,
                  color: INK, fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pledgedHeads.toLocaleString()}
              </span>
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
