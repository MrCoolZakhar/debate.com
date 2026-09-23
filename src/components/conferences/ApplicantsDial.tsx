'use client';

// ── ApplicantsDial ─────────────────────────────────────────────────────────
//
// The organiser dashboard's headline ring. Since 23 Sep 2026 it shows INVITES
// ACCEPTED, per role (owner: "It should look the same, but the data should just
// be different"): the look is the original applicants dial, unchanged (one ring,
// a compact key beside it, the big number in the middle); the data comes from
// `inviteAcceptanceByRole` in ./InviteAcceptance.ts, where "accepted" and
// "invited" are defined.
//
// The segments are the accepted count of each role. Roles are disjoint (a
// person holds one role row), so the segments honestly share one ring and sum
// to the centre number. The rest of the ring, the track, is the invites still
// waiting to be accepted. Colour comes from the shared sequential ramp, as it
// did for the funnel stages.

import { OUTFIT } from '@/components/neu';
import { FUNNEL_RAMP } from './ParticipantsChart';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const MUTED = '#6B5F52';
const TRACK = '#E7E1D1';

export interface DialStage {
  key: string;
  label: string;
  /** Accepted: the segment drawn on the ring. */
  value: number;
  /** Invited: printed beside the value in the key as "value / of". */
  of: number;
  /** Deep link from the key row. */
  href?: string;
}

export interface ApplicantsDialProps {
  /** One per role, in key order. */
  stages: DialStage[];
  /** Word under the centre number. */
  caption?: string;
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
  stages, caption = 'Accepted', size = 236, onNavigate,
}: ApplicantsDialProps) {
  const current = stages.reduce((n, s) => n + Math.max(0, s.value), 0);
  const target = stages.reduce((n, s) => n + Math.max(0, s.of), 0);
  const colorOf = (i: number) => FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)] as string;

  const denom = Math.max(target, current, 1);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(18, size * 0.115);
  const r = size / 2 - stroke / 2 - 4;
  const GAP = 1.4; // degrees of surface showing between bands

  const drawn = stages
    .map((s, i) => ({ ...s, color: colorOf(i) }))
    .filter((s) => s.value > 0);
  const arcs = drawn.map((s, i) => {
    const before = drawn.slice(0, i).reduce((n, d) => n + d.value, 0);
    const from = (before / denom) * 360;
    const to = ((before + s.value) / denom) * 360;
    return { ...s, from, to: Math.max(from, to - GAP) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${current} of ${target} invites accepted. ${stages
            .map((s) => `${s.label} ${s.value} of ${s.of}`)
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
              <title>{`${a.label}: ${a.value.toLocaleString()} of ${a.of.toLocaleString()} accepted`}</title>
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
            {caption}
          </span>
        </div>
      </div>

      {/* The key. Small on purpose — the ring is the headline, these are the
          read-out: accepted / invited per role, each row a deep link. */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, minWidth: 172 }}>
        {stages.map((s) => {
          const color = colorOf(stages.indexOf(s));
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
                  color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}
              >
                {s.value.toLocaleString()}
                <span style={{ fontWeight: 700, color: MUTED }}> / {s.of.toLocaleString()}</span>
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
                    minHeight: 26, outline: 'none',
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
      </ul>
    </div>
  );
}
