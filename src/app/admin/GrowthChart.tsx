'use client';

// ── GrowthChart ────────────────────────────────────────────────────────────
//
// The one per-day chart on the Data tab. Hand-rolled inline SVG, like every
// other chart in this codebase — there is no charting library here and that is
// deliberate.
//
// Four decisions worth not undoing:
//
// 1. ONE METRIC AT A TIME, NOT SEVEN LINES. Sign-ups run ~50/day, sessions run
//    ~3/day. Drawn together on one axis the small series are flat lines on the
//    floor and the chart lies by omission. A pill picker keeps a single honest
//    y-axis per view instead of a shared axis nothing fits.
//
// 2. STACKED ONLY WHERE THE PARTS ARE DISJOINT. Conference vs standalone
//    sessions partition the same population, so their stack total is a real
//    number. Nothing nested is ever stacked here (see ParticipantsChart for
//    the nested case, which layers instead).
//
// 3. DIRECT LABELS, NO LEGEND. Each part is named at the right margin at the
//    height of its own recent level, de-collided so two labels can never sit
//    on top of each other. Identity therefore never rests on hue alone, which
//    matters because the two-part stacks are separated by LIGHTNESS within one
//    hue — the only separation that survives every kind of colour blindness.
//
// 4. THE 7-DAY MEAN IS DRAWN, THE DAILY BARS ARE THE DATA. Daily counts on a
//    platform this size are mostly weekday noise; the dashed mean is what a
//    trend actually looks like. It is labelled as a mean, never as a count.

import { useMemo, useRef, useState } from 'react';
import { NEU, OUTFIT, EASE, smoothPath } from '@/components/neu';

const MONO = 'ui-monospace, monospace';
const HAIRLINE = '#DDD4C0';

export interface GrowthPoint {
  d: string;
  signups: number;
  applications: number;
  conferences_created: number;
  conferences_published: number;
  sessions_conference: number;
  sessions_standalone: number;
  cv_entries: number;
  profiles_cumulative: number;
}

type Field = Exclude<keyof GrowthPoint, 'd'>;

interface Part { field: Field; label: string; color: string }
interface Metric {
  key: string;
  label: string;
  mode: 'bars' | 'area';
  parts: Part[];
  /** Shown under the chart. Says what the number actually counts. */
  note: string;
}

// Lightness-separated pairs inside one hue: the dark step reads first, the
// light step reads second, and the order survives deuteranopia unchanged.
const DARK = '#275C3D';
const LIGHT = '#7FA98C';

const METRICS: Metric[] = [
  {
    key: 'signups', label: 'Sign-ups', mode: 'bars', note: 'New profiles per day, demo accounts excluded.',
    parts: [{ field: 'signups', label: 'Sign-ups', color: DARK }],
  },
  {
    key: 'applications', label: 'Applications', mode: 'bars',
    note: 'Applications submitted to an active conference, the same population the 13:00 email counts.',
    parts: [{ field: 'applications', label: 'Applications', color: DARK }],
  },
  {
    key: 'conferences', label: 'Conferences', mode: 'bars',
    note: 'Two separate events on two separate days: a conference is created, and later published.',
    parts: [
      { field: 'conferences_created', label: 'Created', color: DARK },
      { field: 'conferences_published', label: 'Published', color: LIGHT },
    ],
  },
  {
    key: 'sessions', label: 'Sessions', mode: 'bars',
    note: 'Committees that lived longer than 30 minutes, the Live tab’s rule. Without it the count is dominated by sessions abandoned within a minute.',
    parts: [
      { field: 'sessions_conference', label: 'From a conference', color: DARK },
      { field: 'sessions_standalone', label: 'Standalone', color: LIGHT },
    ],
  },
  {
    key: 'cv', label: 'CV entries', mode: 'bars', note: 'MUN CV entries added per day, from every source.',
    parts: [{ field: 'cv_entries', label: 'CV entries', color: DARK }],
  },
  {
    key: 'profiles', label: 'Total profiles', mode: 'area',
    note: 'Running total of non-demo profiles, seeded with everyone who existed before the window opened.',
    parts: [{ field: 'profiles_cumulative', label: 'Profiles', color: DARK }],
  },
];

const W = 1000;
const H = 300;
const PAD = { top: 18, right: 132, bottom: 36, left: 54 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

/** Trailing mean over `w` days. Early buckets average what exists, so the line
 *  starts at the data rather than at zero. */
function rollingMean(vals: number[], w = 7): number[] {
  return vals.map((_, i) => {
    const from = Math.max(0, i - w + 1);
    const slice = vals.slice(from, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export default function GrowthChart({ points }: { points: GrowthPoint[] }) {
  const [metricKey, setMetricKey] = useState('signups');
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const metric = METRICS.find(m => m.key === metricKey) ?? METRICS[0];

  const geom = useMemo(() => {
    const n = points.length;
    const totals = points.map(p => metric.parts.reduce((a, part) => a + (p[part.field] as number), 0));
    const floor = metric.mode === 'area' ? Math.min(...totals, 0) : 0;
    const maxY = niceCeil(Math.max(1, ...totals) - floor) + floor;
    const step = n > 0 ? PLOT_W / n : PLOT_W;
    const bandCentre = (i: number) => PAD.left + step * (i + 0.5);
    const linePoint = (i: number) => (n <= 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (n - 1)) * PLOT_W);
    const y = (v: number) => PAD.top + PLOT_H - ((v - floor) / (maxY - floor || 1)) * PLOT_H;
    return { n, totals, maxY, floor, step, bandCentre, linePoint, y, mean: rollingMean(totals) };
  }, [points, metric]);

  if (points.length === 0) {
    return (
      <p style={{ padding: 30, textAlign: 'center', fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
        No days in the window yet.
      </p>
    );
  }

  const { n, totals, maxY, floor, step, bandCentre, linePoint, y, mean } = geom;
  const barW = Math.max(2, Math.min(26, step * 0.62));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(floor + (maxY - floor) * f));
  const last = points[points.length - 1];
  const windowTotal = totals.reduce((a, b) => a + b, 0);

  // Direct labels sit at each part's recent level (mean of the last 7 days),
  // which is far steadier than one noisy final day, then get pushed apart so
  // two of them can never overlap into an unreadable smudge.
  const tail = points.slice(-7);
  const rawLabels = metric.parts.map((part, pi) => {
    let below = 0;
    for (let k = 0; k < pi; k++) {
      below += tail.reduce((a, p) => a + (p[metric.parts[k].field] as number), 0) / tail.length;
    }
    const own = tail.reduce((a, p) => a + (p[part.field] as number), 0) / tail.length;
    return { part, yAt: y(floor + below + own / 2) };
  });
  const labels = [...rawLabels].sort((a, b) => a.yAt - b.yAt);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].yAt - labels[i - 1].yAt < 15) labels[i].yAt = labels[i - 1].yAt + 15;
  }
  for (const l of labels) l.yAt = Math.max(PAD.top + 6, Math.min(PAD.top + PLOT_H - 4, l.yAt));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.floor((px - PAD.left) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  const active = hover != null ? points[hover] : null;

  const summary = `${metric.label} per day, ${points.length} days to ${fmtDay(last.d)}. `
    + `${windowTotal.toLocaleString()} in the window. `
    + metric.parts.map(p => `${p.label} latest ${(last[p.field] as number).toLocaleString()}`).join(', ') + '.';

  return (
    <div>
      {/* Metric picker. Pills, not a select: seven options that all fit. */}
      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
        {METRICS.map(m => {
          const on = m.key === metric.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => { setMetricKey(m.key); setHover(null); }}
              aria-pressed={on}
              className="focus:outline-none"
              style={{
                border: on ? 'none' : `1px solid ${HAIRLINE}`,
                cursor: 'pointer', borderRadius: 999, padding: '5px 13px',
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em',
                background: on ? `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})` : NEU.surface,
                color: on ? NEU.gold : NEU.inkSoft,
                boxShadow: on ? `0 3px 9px rgba(27,56,40,0.30), ${NEU.outSm}` : NEU.outSm,
                transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}`,
              }}
            >
              {m.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowTable(s => !s)}
          className="focus:outline-none"
          style={{
            marginInlineStart: 'auto', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.inkSoft,
            textDecoration: 'underline', padding: '4px 2px',
          }}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {/* One readout line, so the headline number is text and not only a shape. */}
      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginBottom: 8 }}>
        <strong style={{ color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
          {metric.mode === 'area' ? (last.profiles_cumulative).toLocaleString() : windowTotal.toLocaleString()}
        </strong>{' '}
        {metric.mode === 'area' ? 'profiles today' : `over ${points.length} days`}
        {metric.mode === 'bars' && (
          <>
            {' · '}
            <strong style={{ color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
              {(windowTotal / points.length).toFixed(1)}
            </strong>{' '}a day on average
          </>
        )}
      </p>

      {showTable ? (
        <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: OUTFIT, fontSize: 12 }}>
            <thead>
              <tr>
                {['Day', ...metric.parts.map(p => p.label), ...(metric.parts.length > 1 ? ['Total'] : [])].map(h => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      textAlign: h === 'Day' ? 'start' : 'end', padding: '6px 8px', position: 'sticky', top: 0,
                      backgroundColor: NEU.surface, borderBottom: `1px solid ${HAIRLINE}`, color: NEU.inkSoft,
                      fontWeight: 800, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.d}>
                  <td style={{ padding: '5px 8px', color: NEU.inkSoft, whiteSpace: 'nowrap' }}>{fmtDay(p.d)}</td>
                  {metric.parts.map(part => (
                    <td key={part.field} style={{ padding: '5px 8px', textAlign: 'end', color: NEU.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {(p[part.field] as number).toLocaleString()}
                    </td>
                  ))}
                  {metric.parts.length > 1 && (
                    <td style={{ padding: '5px 8px', textAlign: 'end', color: NEU.ink, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {totals[i].toLocaleString()}
                    </td>
                  )}
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
          aria-label={summary}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="gc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DARK} stopOpacity="0.28" />
              <stop offset="100%" stopColor={DARK} stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {ticks.map(v => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke={HAIRLINE} strokeWidth={1} />
              <text
                x={PAD.left - 9} y={y(v) + 4} textAnchor="end"
                style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, fill: NEU.inkSoft }}
              >
                {v.toLocaleString()}
              </text>
            </g>
          ))}

          {hover != null && (
            <rect
              x={PAD.left + step * hover} y={PAD.top} width={step} height={PLOT_H}
              fill="rgba(27,56,40,0.06)" pointerEvents="none"
            />
          )}

          {metric.mode === 'bars' ? (
            points.map((p, i) => {
              let base = 0;
              return (
                <g key={p.d}>
                  {metric.parts.map(part => {
                    const v = p[part.field] as number;
                    const y0 = y(base);
                    const y1 = y(base + v);
                    base += v;
                    if (v <= 0) return null;
                    return (
                      <rect
                        key={part.field}
                        x={bandCentre(i) - barW / 2}
                        y={y1}
                        width={barW}
                        height={Math.max(1, y0 - y1)}
                        fill={part.color}
                        rx={1.5}
                        opacity={hover == null || hover === i ? 1 : 0.55}
                      />
                    );
                  })}
                </g>
              );
            })
          ) : (
            <>
              <path
                d={`${smoothPath(points.map((p, i) => ({ x: linePoint(i), y: y(p[metric.parts[0].field] as number) })))} L${linePoint(n - 1)},${PAD.top + PLOT_H} L${linePoint(0)},${PAD.top + PLOT_H} Z`}
                fill="url(#gc-area)"
              />
              <path
                d={smoothPath(points.map((p, i) => ({ x: linePoint(i), y: y(p[metric.parts[0].field] as number) })))}
                fill="none" stroke={DARK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
              />
            </>
          )}

          {/* 7-day mean, dashed so it can never be mistaken for a daily count. */}
          {metric.mode === 'bars' && n > 2 && (
            <>
              <path
                d={smoothPath(mean.map((v, i) => ({ x: bandCentre(i), y: y(v) })))}
                fill="none" stroke={NEU.deepGold} strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round"
              />
              <text
                x={W - PAD.right + 9}
                y={Math.max(PAD.top + 10, Math.min(PAD.top + PLOT_H, y(mean[mean.length - 1]) + 4))}
                style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, fill: NEU.deepGold }}
              >
                7-day mean
              </text>
            </>
          )}

          {/* Direct part labels. The legend this replaces would have been a
              fourth thing to look up; here the name is already where the data is. */}
          {labels.map(l => (
            <text
              key={l.part.field}
              x={W - PAD.right + 9}
              y={metric.mode === 'bars' && n > 2 ? l.yAt - 13 : l.yAt}
              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, fill: l.part.color }}
            >
              {l.part.label}
            </text>
          ))}

          {/* x labels: ends and middle only, so the axis never crowds. */}
          {[0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
            <text
              key={i}
              x={bandCentre(i)}
              y={H - 11}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, fill: NEU.inkSoft }}
            >
              {fmtDay(points[i].d)}
            </text>
          ))}
        </svg>
      )}

      <div
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
        style={{ marginTop: 9, minHeight: 34, fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}
      >
        {active && !showTable ? (
          <>
            <strong style={{ color: NEU.ink }}>{fmtDay(active.d)}</strong>
            {metric.parts.map(part => (
              <span key={part.field}>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: part.color, marginInlineEnd: 5 }} />
                {part.label}{' '}
                <strong style={{ color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {(active[part.field] as number).toLocaleString()}
                </strong>
              </span>
            ))}
            {metric.mode === 'bars' && (
              <span style={{ fontFamily: MONO, fontSize: 11 }}>
                7-day mean {mean[hover as number].toFixed(1)}
              </span>
            )}
          </>
        ) : (
          <span>{metric.note}</span>
        )}
      </div>
    </div>
  );
}
