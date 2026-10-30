'use client';
// Gavelling Crisis: a resource's history as a chart. Up is green, down is red.
//
// Props (both exports):
//   resource  { id, amount }   the resource row; `amount` is its amount NOW (the line ends there and
//                              the history is read again whenever it changes)
//   typeName  string           the resource's name, "Public standing"
//   unit      string | null    the unit, shown beside the amount
//   color     string?          an accent (the cabinet colour); defaults to the crisis red
//   eyebrow   string?          small line above the title, e.g. the cabinet's name
//
// ResourceHistoryDialog (default) is the whole pop-up: `onClose` closes it. Use it from a page that has no
// other pop-up open. A pop-up never opens another on top of itself, so a screen that is already a pop-up
// (Cabinet Resources "See all") renders ResourceHistoryBody inside its own dialog and shows a back button.
//
// Data: resourceHistory() -> crisis_resource_history(p_resource). Staff see the reason and who for every change;
// everyone else gets those two as null and the list simply leaves them out.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { crisisError } from '@/lib/crisis/api';
import { amount as fmtAmount, timeAgo } from '@/lib/crisis/format';
import { resourceHistory, type ResourceHistoryRow } from '@/lib/crisis/history';
import { Btn, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import { serverNow } from '@/lib/serverClock';

export interface HistoryResource { id: string; amount: number }

interface Props {
  resource: HistoryResource;
  typeName: string;
  unit?: string | null;
  color?: string;
  eyebrow?: string;
}

const signedText = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmtAmount(Math.abs(n))}`;

// ─────────── The chart ───────────

const W = 640;
const H = 250;
const M = { l: 52, r: 16, t: 16, b: 30 };

interface Pt { t: number; v: number; delta: number }

function niceTicks(min: number, max: number): number[] {
  if (min === max) return [min];
  return [min, min + (max - min) / 2, max];
}

function HistoryChart({ rows, current, now, color }: { rows: ResourceHistoryRow[]; current: number; now: number; color: string }) {
  const model = useMemo(() => {
    const first = rows[0];
    const firstT = new Date(first.created_at).getTime();
    const lastT = new Date(rows[rows.length - 1].created_at).getTime();
    const end = Math.max(now, lastT);
    const span = Math.max(end - firstT, 60_000);
    const start = firstT - span * 0.08;
    const pts: Pt[] = [{ t: start, v: first.amount_after - first.delta, delta: 0 }];
    for (const r of rows) pts.push({ t: new Date(r.created_at).getTime(), v: r.amount_after, delta: r.delta });
    // The line ends at what it is now (a change the history has not caught up with yet shows as the last move).
    pts.push({ t: end + span * 0.02, v: current, delta: current - rows[rows.length - 1].amount_after });
    const vals = pts.map((p) => p.v);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const x = (t: number) => M.l + ((t - t0) / (t1 - t0 || 1)) * (W - M.l - M.r);
    const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
    return { pts, lo, hi, t0, t1, x, y };
  }, [rows, current, now]);

  const { pts, lo, hi, x, y, t0, t1 } = model;
  const ticks = niceTicks(lo, hi);
  const xTicks = [t0, t0 + (t1 - t0) / 2, t1];
  const segColor = (d: number) => (d > 0 ? CK.ok : d < 0 ? CK.danger : CK.muted);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Amount over time" style={{ display: 'block', width: '100%', height: 'auto', fontFamily: CK.font }}>
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={M.l} x2={W - M.r} y1={y(tv)} y2={y(tv)} stroke={CK.hair} strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 4'} />
          <text x={M.l - 8} y={y(tv) + 4} textAnchor="end" fontSize={11.5} fontWeight={600} fill={CK.inkSoft} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(Math.round(tv * 100) / 100)}</text>
        </g>
      ))}
      {xTicks.map((tt, i) => (
        <text key={i} x={x(tt)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize={11.5} fontWeight={600} fill={CK.inkSoft}>
          {i === 2 ? 'Now' : timeAgo(new Date(tt).toISOString(), now)}
        </text>
      ))}
      {pts.slice(1).map((p, i) => {
        const a = pts[i];
        const c = segColor(p.delta);
        return <line key={i} x1={x(a.t)} y1={y(a.v)} x2={x(p.t)} y2={y(p.v)} stroke={c} strokeWidth={3} strokeLinecap="round" />;
      })}
      {pts.slice(1, -1).map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r={4.5} fill="#fff" stroke={segColor(p.delta)} strokeWidth={2.5} />
      ))}
      <circle cx={x(pts[pts.length - 1].t)} cy={y(pts[pts.length - 1].v)} r={5.5} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

// ─────────── The body (also embedded in another dialog) ───────────

export function ResourceHistoryBody({ resource, typeName, unit, color = CK.red }: Props) {
  const { ref } = useCrisis();
  const [rows, setRows] = useState<ResourceHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => serverNow());

  const load = useCallback(async () => {
    try {
      const r = await resourceHistory(ref, resource.id);
      setRows(r);
      setError(null);
      setNow(serverNow());
    } catch (e) {
      setError(crisisError(e, 'Could not load the history.'));
    }
  }, [ref, resource.id]);

  // Read again whenever the amount changes underneath the pop-up.
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load, resource.amount]);

  const newestFirst = useMemo(() => (rows ? [...rows].reverse() : []), [rows]);
  const net = rows && rows.length ? resource.amount - (rows[0].amount_after - rows[0].delta) : 0;
  const unitText = unit ? ` ${unit}` : '';

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap" style={{ gap: '6px 16px', marginBottom: 10 }}>
        <p style={{ margin: 0, lineHeight: 1 }}>
          <b style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{fmtAmount(resource.amount)}</b>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: CK.inkSoft }}>{unitText} now</span>
        </p>
        {rows && rows.length > 0 && net !== 0 && (
          <span className="inline-flex items-center" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, color: net > 0 ? CK.ok : CK.danger, fontVariantNumeric: 'tabular-nums' }}>
            {net > 0 ? <TrendingUp size={17} strokeWidth={1.6} aria-hidden /> : <TrendingDown size={17} strokeWidth={1.6} aria-hidden />}
            {signedText(net)} since the start
          </span>
        )}
      </div>

      {error && !rows ? (
        <div role="alert" className="flex items-center flex-wrap" style={{ gap: 10, padding: '14px 0' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: CK.red }}>{error}</span>
          <Btn size="sm" tone="ghost" onClick={() => { void load(); }}>Try again</Btn>
        </div>
      ) : rows === null ? (
        <div className="flex flex-col" style={{ gap: 10 }}><Skeleton h={210} r={16} /><Skeleton h={34} /><Skeleton h={34} /></div>
      ) : rows.length === 0 ? (
        <p style={{ margin: '14px 0 4px', fontSize: 14, color: CK.inkSoft }}>This has not changed yet. The graph appears after the first change.</p>
      ) : (
        <>
          <div style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm, padding: '10px 8px 4px' }}>
            <HistoryChart rows={rows} current={resource.amount} now={now} color={color} />
          </div>

          <h3 className="flex items-baseline" style={{ margin: '16px 0 4px', gap: 8, fontSize: 13.5, fontWeight: 800, color: CK.ink }}>
            Changes
            <span style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{rows.length}</b> {rows.length === 1 ? 'change' : 'changes'}</span>
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {newestFirst.map((r, i) => {
              const up = r.delta > 0;
              const down = r.delta < 0;
              return (
                <li key={`${r.created_at}-${i}`} className="flex items-start" style={{ gap: 12, padding: '8px 0', borderTop: `1px solid ${CK.hair}` }}>
                  <b style={{ flex: 'none', minWidth: 52, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: up ? CK.ok : down ? CK.danger : CK.muted }}>{signedText(r.delta)}</b>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                      {timeAgo(r.created_at, now)}
                      <span style={{ color: CK.muted }}> · now {fmtAmount(r.amount_after)}</span>
                    </span>
                    {(r.reason || r.by_name) && (
                      <span style={{ display: 'block', fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>
                        {r.reason}{r.reason && r.by_name ? ' · ' : ''}{r.by_name && <b>{r.by_name}</b>}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <span className="sr-only">{typeName}</span>
    </div>
  );
}

// ─────────── The pop-up ───────────

export default function ResourceHistoryDialog({ resource, typeName, unit, color, eyebrow, onClose }: Props & { onClose: () => void }) {
  return (
    <CrisisDialog title={typeName} eyebrow={eyebrow ?? 'Resource history'} onClose={onClose} width={680}>
      <ResourceHistoryBody resource={resource} typeName={typeName} unit={unit} color={color} />
    </CrisisDialog>
  );
}
