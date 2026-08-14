'use client';

// ── ApplicantsDial ─────────────────────────────────────────────────────────
//
// Applicants against target, broken out by funnel stage.
//
// Why concentric arcs rather than one segmented ring: the stages are NESTED
// subsets (every paid applicant is also assigned, accepted and counted in the
// total), so slicing a single ring into four segments would imply they are
// disjoint and sum to the whole — they don't, and it would overstate the
// headcount fourfold. Concentric arcs, all measured against the same target,
// show both each stage's progress and the nesting between them.
//
// Colour comes from the same validated sequential ramp as the chart, so a
// stage means the same thing on both. Attention is deliberately NOT another
// ramp step — it is a separate gold marker plus a dot and a label, because a
// status must never be carried by hue alone.

import { OUTFIT } from '@/components/neu';
import { FUNNEL_RAMP } from './ParticipantsChart';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const MUTED = '#6B5F52';
const TRACK = '#E4DECD';
const ATTENTION = '#B6871F';

/** A stage is flagged when it has fallen below this share of the stage above
 *  it — the same 70% bar the set-up priorities use, so "fine" means one thing
 *  across the dashboard. */
const HEALTHY_RATIO = 0.7;

export interface DialStage {
  key: string;
  label: string;
  value: number;
}

export interface ApplicantsDialProps {
  /** Ordered outermost → innermost, i.e. widest funnel stage first. */
  stages: DialStage[];
  /** Denominator for every arc. */
  expected: number;
  size?: number;
}

interface Ring extends DialStage {
  color: string;
  pct: number;
  needsAttention: boolean;
  reason?: string;
}

export default function ApplicantsDial({ stages, expected, size = 210 }: ApplicantsDialProps) {
  const target = Math.max(expected, 0);
  const current = stages[0]?.value ?? 0;

  /* The arc is clamped to the stage outside it; the label is not.
     These stages nest logically, but not always in the data — a delegate can
     pay before an organiser seats them, so Paid can genuinely exceed Assigned.
     Clamping the NUMBER would print a falsehood; letting the arc run long
     draws an inner ring visibly longer than the one containing it, which reads
     as a rendering bug. So the geometry is clamped and the count stays true. */
  let ceiling = Infinity;
  const rings: Ring[] = stages.map((s, i) => {
    const above = i === 0 ? null : stages[i - 1];
    const ratio = above && above.value > 0 ? s.value / above.value : 1;
    const flagged = above != null && above.value > 0 && ratio < HEALTHY_RATIO;
    const arcValue = Math.min(s.value, ceiling);
    ceiling = arcValue;
    return {
      ...s,
      color: FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)],
      pct: target > 0 ? Math.min(1, arcValue / target) : 0,
      needsAttention: flagged,
      reason: flagged && above ? `${Math.round(ratio * 100)}% of ${above.label.toLowerCase()}` : undefined,
    };
  });

  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(9, size * 0.058);
  const gap = stroke * 0.62;
  const outer = size / 2 - stroke / 2 - 6;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${current} of ${target} expected applicants. ${rings
            .map((r) => `${r.label} ${r.value}${r.needsAttention ? ', needs attention' : ''}`)
            .join('. ')}.`}
          /* Rotated so every arc starts at 12 o'clock. */
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          {rings.map((r, i) => {
            const radius = outer - i * (stroke + gap);
            if (radius <= stroke) return null;
            const circ = 2 * Math.PI * radius;
            return (
              <g key={r.key}>
                <circle
                  cx={cx} cy={cy} r={radius} fill="none"
                  stroke={TRACK} strokeWidth={stroke}
                />
                {r.needsAttention && (
                  /* The attention marker sits OUTSIDE the arc as its own ring,
                     so it never competes with the value the arc is encoding. */
                  <circle
                    cx={cx} cy={cy} r={radius + stroke / 2 + 2} fill="none"
                    stroke={ATTENTION} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.9}
                  />
                )}
                <circle
                  cx={cx} cy={cy} r={radius} fill="none"
                  stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={`${circ * r.pct} ${circ}`}
                  style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
                />
              </g>
            );
          })}
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
              fontSize: size * 0.155, letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {current.toLocaleString()}
            <span style={{ color: MUTED, fontWeight: 800 }}>/</span>
            <span style={{ color: INK_70, fontSize: size * 0.11 }}>
              {target > 0 ? target.toLocaleString() : '—'}
            </span>
          </span>
          <span
            style={{
              marginTop: 5, fontFamily: OUTFIT, fontSize: Math.max(8, size * 0.048),
              fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED,
            }}
          >
            Applicants
          </span>
        </div>
      </div>

      {/* Legend doubles as the attention report — the flag is never colour-only. */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 7, minWidth: 168 }}>
        {rings.map((r) => (
          <li key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0,
                boxShadow: r.needsAttention ? `0 0 0 2px ${ATTENTION}` : 'none',
              }}
            />
            <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: INK_70 }}>
              {r.label}
            </span>
            <span
              style={{
                marginInlineStart: 'auto', fontFamily: OUTFIT, fontSize: 13, fontWeight: 900,
                color: INK, fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.value.toLocaleString()}
            </span>
            {r.needsAttention && (
              <span
                title={r.reason}
                style={{
                  flexShrink: 0, padding: '1px 6px', borderRadius: 999,
                  background: 'rgba(182,135,31,0.14)', color: ATTENTION,
                  fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 900, letterSpacing: '0.05em',
                }}
              >
                CHECK
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
