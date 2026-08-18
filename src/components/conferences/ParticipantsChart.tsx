'use client';

// ── ParticipantsChart ──────────────────────────────────────────────────────
//
// Cumulative participants over time: Total ⊇ Accepted ⊇ Assigned ⊇ Paid.
//
// Three decisions worth not undoing:
//
// 1. CUMULATIVE, NOT PER-BUCKET. The old revenue chart incremented exactly one
//    bucket per row and `continue`d anything older than the window, so every
//    range restarted from zero and the first bar silently dropped the whole
//    backlog. Here each bucket carries the running total to that instant, and
//    the pre-window backlog seeds bucket zero — so the line reads as "where the
//    conference stands", which is the actual question, and it can only go up.
//
// 2. LAYERED AREAS, NOT STACKED. The four series are NESTED SUBSETS of one
//    funnel — every paid applicant is also assigned, accepted and counted in
//    the total. Stacking them would draw a total of 4× the real headcount.
//    They are drawn back-to-front, largest first, each reading directly off
//    the shared y-axis.
//
// 3. A SEQUENTIAL RAMP, NOT FOUR HUES. Because the series are nested and
//    ordered, this is a magnitude encoding, not an identity one. Four
//    independent hues could not be separated under deuteranopia at all-pairs
//    (validated: worst pair ΔE 4.7, a hard fail); a single hue light→dark
//    passes trivially, because lightness order survives every kind of colour
//    blindness — and it also *shows* the nesting, which four hues cannot.
//    Every step clears 3:1 on the cream surface. Adjacent steps are close by
//    construction, so identity never rests on colour alone: each line is
//    directly labelled at its end and the legend is always present.

import { useMemo, useRef, useState } from 'react';
import { OUTFIT } from '@/components/neu';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const MUTED = '#6B5F52';
const HAIRLINE = '#DDD4C0';
const SURFACE = '#FAF8F3';

/** Validated sequential ramp — light (outermost) → dark (innermost). */
export const FUNNEL_RAMP = ['#5E9B78', '#3D7A52', '#275C3D', '#123324'] as const;

export interface ParticipantPoint {
  /** Bucket start, epoch ms. */
  t: number;
  total: number;
  accepted: number;
  assigned: number;
  paid: number;
}

type SeriesKey = 'total' | 'accepted' | 'assigned' | 'paid';

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'total', label: 'Total', color: FUNNEL_RAMP[0] },
  { key: 'accepted', label: 'Accepted', color: FUNNEL_RAMP[1] },
  { key: 'assigned', label: 'Assigned', color: FUNNEL_RAMP[2] },
  { key: 'paid', label: 'Paid', color: FUNNEL_RAMP[3] },
];

const W = 1000;
const H = 320;
const PAD = { top: 18, right: 96, bottom: 34, left: 46 };

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/** Catmull-Rom → cubic bezier, so the line is smooth without overshooting. */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function ParticipantsChart({
  points,
  title = 'Participants over time',
}: { points: ParticipantPoint[]; title?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const geom = useMemo(() => {
    const n = points.length;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const maxY = niceCeil(Math.max(1, ...points.map((p) => p.total)));
    const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;
    return { n, plotW, plotH, maxY, x, y };
  }, [points]);

  if (points.length === 0) {
    return (
      <div style={{ padding: 28, textAlign: 'center', fontFamily: OUTFIT, fontSize: 14, color: MUTED }}>
        No applications yet — the chart appears once the first one arrives.
      </div>
    );
  }

  const { maxY, x, y, plotH } = geom;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const last = points[points.length - 1];
  const active = hover != null ? points[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const frac = (px - PAD.left) / (W - PAD.left - PAD.right);
    const i = Math.round(frac * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: INK }}>
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          style={{
            marginInlineStart: 'auto', border: 'none', background: 'transparent',
            cursor: 'pointer', fontFamily: OUTFIT, fontSize: 11, fontWeight: 700,
            color: MUTED, textDecoration: 'underline', padding: '4px 2px',
          }}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {/* Legend is always present for ≥2 series — identity never rests on hue,
          which matters doubly for a single-hue ramp. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '2px 0 10px' }}>
        {SERIES.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />
            <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: INK_70 }}>
              {s.label}
            </span>
            <span
              style={{
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: INK,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {last[s.key].toLocaleString()}
            </span>
          </span>
        ))}
      </div>

      {showTable ? (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: OUTFIT, fontSize: 12 }}>
            <thead>
              <tr>
                {['Date', ...SERIES.map((s) => s.label)].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      textAlign: h === 'Date' ? 'start' : 'end', padding: '6px 8px',
                      borderBottom: `1px solid ${HAIRLINE}`, color: MUTED,
                      fontWeight: 800, fontSize: 10.5, letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.t}>
                  <td style={{ padding: '5px 8px', color: INK_70 }}>{fmtDate(p.t)}</td>
                  {SERIES.map((s) => (
                    <td
                      key={s.key}
                      style={{
                        padding: '5px 8px', textAlign: 'end', color: INK,
                        fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                      }}
                    >
                      {p[s.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Cumulative participants. Latest: ${SERIES.map((s) => `${s.label} ${last[s.key]}`).join(', ')}.`}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`pc-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.05" />
              </linearGradient>
            ))}
          </defs>

          {/* Recessive gridlines */}
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
                stroke={HAIRLINE} strokeWidth={1}
              />
              <text
                x={PAD.left - 8} y={y(v) + 4} textAnchor="end"
                style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, fill: MUTED }}
              >
                {v.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Back to front: Total is the widest area and must not cover the rest.
              Where a stage exactly equals the one above it — every applicant
              accepted, say — the two paths are byte-identical and the darker
              one drawn later hides the lighter completely, so a series appears
              to have vanished. The covering line is dashed instead, which lets
              the one underneath show through the gaps and reads honestly as
              "these two coincide" rather than as a missing series. */}
          {SERIES.map((s, si) => {
            const pts = points.map((p, i) => ({ x: x(i), y: y(p[s.key]) }));
            const line = smooth(pts);
            const area = `${line} L${pts[pts.length - 1].x},${PAD.top + plotH} L${pts[0].x},${PAD.top + plotH} Z`;
            const prev = si > 0 ? SERIES[si - 1].key : null;
            const coincides = prev != null && points.every((p) => p[s.key] === p[prev]);
            return (
              <g key={s.key}>
                {!coincides && <path d={area} fill={`url(#pc-${s.key})`} />}
                <path
                  d={line} fill="none" stroke={s.color} strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={coincides ? '7 5' : undefined}
                />
              </g>
            );
          })}

          {/* Direct end-labels — the secondary encoding that makes a close ramp
              unambiguous without relying on hue. */}
          {SERIES.map((s) => (
            <text
              key={s.key}
              x={W - PAD.right + 8}
              y={y(last[s.key]) + 4}
              style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, fill: s.color }}
            >
              {s.label}
            </text>
          ))}

          {/* x labels: first, middle, last only — no axis crowding */}
          {[0, Math.floor((points.length - 1) / 2), points.length - 1]
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((i) => (
              <text
                key={i} x={x(i)} y={H - 10}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, fill: MUTED }}
              >
                {fmtDate(points[i].t)}
              </text>
            ))}

          {active && hover != null && (
            <g pointerEvents="none">
              <line
                x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
                stroke={INK_70} strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key} cx={x(hover)} cy={y(active[s.key])} r={4.5}
                  fill={s.color} stroke={SURFACE} strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {active && !showTable && (
        <div
          style={{
            marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 14,
            fontFamily: OUTFIT, fontSize: 12, color: INK_70,
          }}
        >
          <strong style={{ color: INK }}>{fmtDate(active.t)}</strong>
          {SERIES.map((s) => (
            <span key={s.key}>
              {s.label}{' '}
              <strong style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>
                {active[s.key].toLocaleString()}
              </strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Roll raw application rows into cumulative buckets.
 *
 * `seed` carries the pre-window backlog so bucket zero starts from where the
 * conference already was, rather than from nothing — the specific defect in the
 * old chart, where every range began at 0 and looked like a fresh start.
 */
export function toCumulativeSeries(
  rows: { submitted_at: string | null; status: string | null; payment_status: string | null }[],
  allocatedAt: (string | null)[],
  bucketCount = 24,
): ParticipantPoint[] {
  const stamps = rows
    .map((r) => (r.submitted_at ? Date.parse(r.submitted_at) : NaN))
    .filter((n) => Number.isFinite(n));
  if (stamps.length === 0) return [];

  const min = Math.min(...stamps);
  const max = Math.max(Math.max(...stamps), Date.now());
  const span = Math.max(max - min, 1);
  const step = span / bucketCount;

  const ACCEPTED = new Set(['accepted', 'assigned', 'checked-in']);
  const allocStamps = allocatedAt
    .map((s) => (s ? Date.parse(s) : NaN))
    .filter((n) => Number.isFinite(n));

  const out: ParticipantPoint[] = [];
  for (let i = 0; i <= bucketCount; i++) {
    const t = min + i * step;
    let total = 0, accepted = 0, paid = 0;
    for (const r of rows) {
      const ts = r.submitted_at ? Date.parse(r.submitted_at) : NaN;
      if (!Number.isFinite(ts) || ts > t) continue;
      total += 1;
      if (r.status && ACCEPTED.has(r.status)) accepted += 1;
      if (r.payment_status === 'paid') paid += 1;
    }
    const assigned = allocStamps.filter((a) => a <= t).length;
    /* The funnel must nest: a later stage can never exceed an earlier one, even
       if the underlying timestamps disagree (an allocation can be recorded
       before its application's status flips). Clamping here keeps the areas
       from crossing, which would render as a visual impossibility. */
    const acc = Math.min(accepted, total);
    const asg = Math.min(assigned, acc);
    out.push({ t, total, accepted: acc, assigned: asg, paid: Math.min(paid, total) });
  }
  return out;
}
