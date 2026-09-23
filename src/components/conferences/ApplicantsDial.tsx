'use client';

// ── ApplicantsDial ─────────────────────────────────────────────────────────
//
// The organiser dashboard's headline ring, in its original look (one ring, a
// compact key beside it, the big number in the middle). Since 23 Sep 2026 it
// reads APPLIED against the EXPECTED HEAD COUNT, per role (owner: "based on how
// many people in total they are expecting and how many people have applied, ok
// maybe not just accepted"). The counts come from `applicationsByRole` in
// ./InviteAcceptance.ts, where "applied" and "accepted" are defined.
//
// The ring's whole is the expected head count (conferences.expected_delegates);
// with none set it falls back to the total applied, so the ring is simply full.
// Each role is one colour from the shared sequential ramp and draws two bands:
// accepted in the solid tone, then still pending in a lighter tint of the same
// colour, so both "applied" and "accepted" read. Roles are disjoint (a person
// holds one role row), so the bands honestly share one ring. The track left
// over is the gap to the expected head count.

import { OUTFIT } from '@/components/neu';
import { FUNNEL_RAMP } from './ParticipantsChart';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const MUTED = '#6B5F52';
const TRACK = '#E7E1D1';
/** The card surface the pending tint is mixed towards. */
const SURFACE = '#F0EBDD';

export interface DialStage {
  key: string;
  label: string;
  /** Live applications of this role (accepted + pending). */
  applied: number;
  /** Of those, accepted by the organiser: the solid band. */
  accepted: number;
  /** Deep link from the key row. */
  href?: string;
}

export interface ApplicantsDialProps {
  /** One per role, in key order. */
  stages: DialStage[];
  /** Expected head count; 0 or less = not set. */
  expected: number;
  size?: number;
  onNavigate?: (href: string) => void;
}

/** A solid lighter tint of `hex`, `t` of the way to the card surface. */
function tint(hex: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map(i => Math.round(p(hex, i) + (p(SURFACE, i) - p(hex, i)) * t));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
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
  stages, expected, size = 236, onNavigate,
}: ApplicantsDialProps) {
  const applied = stages.reduce((n, s) => n + Math.max(0, s.applied), 0);
  const accepted = stages.reduce((n, s) => n + Math.max(0, Math.min(s.accepted, s.applied)), 0);
  const target = Math.max(expected, 0);
  const colorOf = (i: number) => FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)] as string;

  /* The whole: the expected head count, or with none set the total applied. */
  const denom = Math.max(target > 0 ? target : applied, applied, 1);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(18, size * 0.115);
  const r = size / 2 - stroke / 2 - 4;
  const GAP = 1.4; // degrees of surface showing between bands

  /* Per role: the accepted band (solid), then the pending band (tint). */
  const bands: { key: string; label: string; value: number; color: string; title: string }[] = [];
  stages.forEach((s, i) => {
    const color = colorOf(i);
    const acc = Math.max(0, Math.min(s.accepted, s.applied));
    const pending = Math.max(0, s.applied - acc);
    if (acc > 0) bands.push({ key: `${s.key}-acc`, label: s.label, value: acc, color, title: `${s.label}: ${acc.toLocaleString()} accepted` });
    if (pending > 0) bands.push({ key: `${s.key}-pend`, label: s.label, value: pending, color: tint(color, 0.58), title: `${s.label}: ${pending.toLocaleString()} still pending` });
  });
  let cursor = 0;
  const arcs = bands.map((b) => {
    const from = cursor;
    const to = cursor + (b.value / denom) * 360;
    cursor = to;
    return { ...b, from, to: Math.max(from, to - GAP) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${applied} applied${target > 0 ? ` of ${target} expected` : ''}, ${accepted} accepted. ${stages
            .map((s) => `${s.label} ${s.applied} applied, ${s.accepted} accepted`)
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
              <title>{a.title}</title>
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
            {applied.toLocaleString()}
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
            Applied
          </span>
          <span
            style={{
              marginTop: 2, fontFamily: OUTFIT, fontSize: Math.max(8, size * 0.042),
              fontWeight: 700, color: MUTED, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {accepted.toLocaleString()} accepted
          </span>
        </div>
      </div>

      {/* The key. Small on purpose: the ring is the headline, these are the
          read-out, applied and accepted per role, each row a deep link. */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, minWidth: 196 }}>
        {stages.map((s, i) => {
          const color = colorOf(i);
          const inner = (
            <>
              <span
                aria-hidden
                style={{
                  width: 9, height: 9, borderRadius: 3, flexShrink: 0,
                  background: `linear-gradient(90deg, ${color} 50%, ${tint(color, 0.58)} 50%)`,
                }}
              />
              <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: INK_70, minWidth: 0 }}>
                {s.label}
              </span>
              <span
                style={{
                  marginInlineStart: 'auto', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900,
                  color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {s.applied.toLocaleString()}
                <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}> · {s.accepted.toLocaleString()} accepted</span>
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
