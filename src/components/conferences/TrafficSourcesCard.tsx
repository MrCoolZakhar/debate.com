'use client';

// ── Where applicants come from ──────────────────────────────────────────────
//
// The organiser dashboard's traction card: visits to the public conference
// page, applications started and submitted, the conversion between them, and
// the same split by source (Google, Gavelling, social media, direct link ...).
//
// Data: `conference_traffic_summary(p_conference)` (organisers only), built on
// `conference_page_views` (one anonymous counter per day and source, no
// cookies, no personal data) and `applications.traffic_source` (the category
// the applicant's browser remembered from their first visit). A "visit" is one
// browser session on the page, counted once, so it approximates unique views.
// Counting started when this shipped: there is no backfill, and applications
// filed before a conference's first counted visit are left out of conversion.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, X, ArrowRight } from 'lucide-react';
import Portal from '@/components/Portal';
import { useScrollLock } from '@/hooks/useScrollLock';
import { NeuCard, NEU, OUTFIT } from '@/components/neu';
import { BENTO_BORDER } from '@/components/conferences/bento';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { TRAFFIC_SOURCES, TRAFFIC_SOURCE_LABEL, type TrafficSource } from '@/lib/trafficSource';

export interface TrafficSummary {
  today: string;
  first_day: string | null;
  views: { day: string; source: TrafficSource; views: number }[];
  applications: { day: string; source: TrafficSource | 'unknown'; n: number }[];
  drafts: { day: string; n: number }[];
  hosts: { host: string; views: number }[];
}

type Range = 7 | 30 | 'all';
type Row = TrafficSource | 'unknown';

/** Identity colours, one per source; every one clears 3:1 on the cream surface
 *  and the label always sits beside the bar, so colour is never the only cue. */
const SOURCE_COLOR: Record<Row, string> = {
  google: '#2F63B0',
  gavelling: '#1B3828',
  social: '#A83E73',
  other_search: '#2A7471',
  email: '#96641A',
  direct: '#5A5E6B',
  other: '#7C6A4F',
  unknown: '#9A8F80',
};

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(iso + 'T00:00:00Z') / DAY_MS);
const fmtPct = (num: number, den: number) =>
  den > 0 ? `${(Math.round((num / den) * 1000) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%` : '–';
const fmtInt = (n: number) => n.toLocaleString('en-GB');

function Sparkline({ series, color }: { series: { day: number; v: number }[]; color: string }) {
  const W = 300, H = 44, P = 3;
  const max = Math.max(1, ...series.map(s => s.v));
  const n = series.length;
  const pts = series.map((s, i) => ({
    x: n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1),
    y: H - P - (s.v / max) * (H - 2 * P),
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z` : '';
  const label = (d: number) => new Date(d * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 44, display: 'block' }} role="img"
      aria-label={`Visits per day, ${label(series[0]?.day ?? 0)} to ${label(series[n - 1]?.day ?? 0)}, peak ${max}`}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => (
        <rect key={i} x={p.x - (W / Math.max(n, 1)) / 2} y={0} width={W / Math.max(n, 1)} height={H} fill="transparent">
          <title>{`${label(series[i].day)}: ${series[i].v} visit${series[i].v === 1 ? '' : 's'}`}</title>
        </rect>
      ))}
    </svg>
  );
}

function Figure({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 800, color: NEU.ink, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 3 }}>{label}</div>
    </div>
  );
}

/** Pure view, so it can be rendered from any summary (also by a harness). */
export function TrafficSourcesView({ summary, inDialog = false }: { summary: TrafficSummary | null; inDialog?: boolean }) {
  const [range, setRange] = useState<Range>(30);

  const model = useMemo(() => {
    if (!summary) return null;
    const today = dayNum(summary.today);
    const first = summary.first_day ? dayNum(summary.first_day) : null;
    const from = range === 'all' ? (first ?? today) : Math.max(today - range + 1, first ?? today);
    const inWin = (d: string) => { const n = dayNum(d); return n >= from && n <= today; };

    const viewsBy = new Map<Row, number>();
    const perDay = new Map<number, number>();
    let visits = 0;
    for (const v of summary.views) {
      if (!inWin(v.day)) continue;
      visits += v.views;
      viewsBy.set(v.source, (viewsBy.get(v.source) ?? 0) + v.views);
      perDay.set(dayNum(v.day), (perDay.get(dayNum(v.day)) ?? 0) + v.views);
    }
    const appsBy = new Map<Row, number>();
    let submitted = 0;
    for (const a of summary.applications) {
      if (first === null || !inWin(a.day)) continue;
      submitted += a.n;
      appsBy.set(a.source, (appsBy.get(a.source) ?? 0) + a.n);
    }
    let drafts = 0;
    for (const d of summary.drafts) if (first !== null && inWin(d.day)) drafts += d.n;

    const rows: { key: Row; views: number; apps: number }[] = ([...TRAFFIC_SOURCES, 'unknown'] as Row[])
      .map(key => ({ key, views: viewsBy.get(key) ?? 0, apps: appsBy.get(key) ?? 0 }))
      .filter(r => r.views > 0 || r.apps > 0)
      .sort((a, b) => b.views - a.views || b.apps - a.apps);

    // Sparkline: every day of the window (at least 7, at most the last 90).
    const start = Math.min(Math.max(from, today - 89), today - 6);
    const series: { day: number; v: number }[] = [];
    for (let d = start; d <= today; d++) series.push({ day: d, v: perDay.get(d) ?? 0 });

    return { visits, submitted, started: submitted + drafts, rows, series, maxViews: Math.max(1, ...rows.map(r => r.views)) };
  }, [summary, range]);

  const empty = !!summary && !summary.first_day;

  return (
    <NeuCard className="flex flex-col flex-shrink-0" style={{ padding: inDialog ? '18px 22px 20px' : '14px 18px 16px', border: BENTO_BORDER }}>
      <div className="flex items-start justify-between gap-3 flex-wrap" style={inDialog ? { paddingInlineEnd: 36 } : undefined}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>
            Where applicants come from
            <span
              tabIndex={0}
              aria-label="How this is counted"
              title="One visit is one browser session on your public conference page. Counted anonymously, with no cookies and no personal data. Your own team's visits and applicants coming back to their application are not counted. Gavelling means they found you on Gavelling itself (Explore, the map, the homepage), not your own shared link. Conversion is submitted applications divided by visits."
              className="inline-flex focus:outline-none"
              style={{ color: NEU.inkSoft, cursor: 'help' }}
            >
              <Info size={13} />
            </span>
          </h2>
        </div>
        {!empty && summary && (
          <div role="group" aria-label="Period" className="flex items-center" style={{ gap: 2 }}>
            {([7, 30, 'all'] as Range[]).map(r => {
              const on = r === range;
              return (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={on}
                  className="focus:outline-none focus-visible:ring-2 rounded-full"
                  style={{
                    fontFamily: OUTFIT, fontSize: 11, fontWeight: on ? 800 : 600, padding: '4px 10px',
                    color: on ? NEU.ink : NEU.inkSoft,
                    background: on ? 'color-mix(in srgb, var(--gv-main) 9%, transparent)' : 'transparent',
                    cursor: 'pointer', border: 'none',
                  }}
                >
                  {r === 'all' ? 'All time' : `${r} days`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!summary && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 10 }}>Loading…</p>
      )}

      {empty && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }}>Views are counted from today.</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 3, maxWidth: 520 }}>
            Share your conference page. Each visit and each application will show up here by source.
          </p>
        </div>
      )}

      {model && !empty && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginTop: 12 }}>
            <Figure value={fmtInt(model.visits)} label="Page visits" hint="Browser sessions on your public page, not counting your team or people who already applied" />
            <Figure value={fmtInt(model.started)} label="Applications started" hint="Submitted, plus applications begun and not yet sent" />
            <Figure value={fmtInt(model.submitted)} label="Applications submitted" />
            <Figure value={fmtPct(model.submitted, model.visits)} label="Conversion" hint="Submitted applications divided by page visits" />
          </div>

          <div style={{ marginTop: 12 }}>
            <Sparkline series={model.series} color="var(--gv-main)" />
          </div>

          <div role="table" aria-label="Visits and applications by source" style={{ marginTop: 12 }}>
            <div role="row" className="grid items-end" style={{ gridTemplateColumns: 'minmax(0,1fr) 56px 56px 64px', gap: 10, paddingBottom: 5 }}>
              {['Source', 'Visits', 'Applied', 'Conv.'].map((h, i) => (
                <span key={h} role="columnheader" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.inkSoft, textAlign: i ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>
            {model.rows.length === 0 && (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, padding: '6px 0' }}>No visits in this period.</p>
            )}
            {model.rows.map(r => (
              <div key={r.key} role="row" className="grid items-center" style={{ gridTemplateColumns: 'minmax(0,1fr) 56px 56px 64px', gap: 10, padding: '5px 0' }}>
                <div role="cell" className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: SOURCE_COLOR[r.key], flexShrink: 0 }} />
                    <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.ink }}>{TRAFFIC_SOURCE_LABEL[r.key]}</span>
                  </div>
                  {r.key !== 'unknown' && <div aria-hidden style={{ height: 6, marginTop: 4, borderRadius: 999, background: 'color-mix(in srgb, var(--gv-main) 7%, transparent)' }}>
                    <div style={{ height: '100%', width: `${(r.views / model.maxViews) * 100}%`, minWidth: r.views ? 4 : 0, borderRadius: 999, background: SOURCE_COLOR[r.key] }} />
                  </div>}
                </div>
                <span role="cell" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.key === 'unknown' ? '–' : fmtInt(r.views)}</span>
                <span role="cell" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.apps)}</span>
                <span role="cell" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.inkSoft, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.key === 'unknown' ? '–' : fmtPct(r.apps, r.views)}</span>
              </div>
            ))}
          </div>

          {summary && summary.hosts.length > 0 && model.rows.some(r => r.key === 'other') && (
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 8 }}>
              Other websites, all time: {summary.hosts.slice(0, 5).map(h => `${h.host} (${fmtInt(h.views)})`).join(', ')}
            </p>
          )}
        </>
      )}
    </NeuCard>
  );
}

// ── Compact card (sits beside "Applicants against target") ──────────────────
// Headline conversion, visits and submitted over the last 30 days, and one
// stacked bar of visits by source. The full table opens in a pop-up.

function last30(summary: TrafficSummary) {
  const today = dayNum(summary.today);
  const first = summary.first_day ? dayNum(summary.first_day) : today;
  const from = Math.max(today - 29, first);
  const inWin = (d: string) => { const n = dayNum(d); return n >= from && n <= today; };
  const by = new Map<Row, number>();
  let visits = 0;
  for (const v of summary.views) if (inWin(v.day)) { visits += v.views; by.set(v.source, (by.get(v.source) ?? 0) + v.views); }
  let submitted = 0;
  for (const a of summary.applications) if (summary.first_day && inWin(a.day)) submitted += a.n;
  const segs = [...by.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return { visits, submitted, segs };
}

function TrafficDialog({ summary, onClose }: { summary: TrafficSummary; onClose: () => void }) {
  useScrollLock(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [onClose]);
  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 80, background: 'rgba(28,20,16,0.38)', padding: 16 }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div role="dialog" aria-modal="true" aria-label="Where applicants come from" className="relative w-full" style={{ maxWidth: 680, maxHeight: '90%', overflowY: 'auto', borderRadius: 22 }}>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute inline-flex items-center justify-center focus:outline-none focus-visible:ring-2"
            style={{ top: 12, insetInlineEnd: 12, width: 30, height: 30, borderRadius: 999, border: 'none', background: 'color-mix(in srgb, var(--gv-main) 8%, transparent)', color: NEU.ink, cursor: 'pointer', zIndex: 1 }}
          >
            <X size={15} />
          </button>
          <TrafficSourcesView summary={summary} inDialog />
        </div>
      </div>
    </Portal>
  );
}

export function TrafficCompactView({ summary }: { summary: TrafficSummary | null }) {
  const [open, setOpen] = useState(false);
  const m = useMemo(() => (summary ? last30(summary) : null), [summary]);
  const empty = !!summary && !summary.first_day;
  const label = { fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft } as const;
  return (
    <NeuCard className="flex flex-col" style={{ padding: '15px 16px', border: BENTO_BORDER, height: '100%' }}>
      <h2 className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink, lineHeight: 1.2 }}>
        Where applicants come from
      </h2>
      {!summary && <p style={{ ...label, marginTop: 8 }}>Loading…</p>}
      {empty && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>Views are counted from today.</p>
          <p style={{ ...label, marginTop: 3 }}>Share your conference page. Visits and applications will show here by source.</p>
        </div>
      )}
      {m && !empty && summary && (
        <>
          <p style={{ ...label, marginTop: 1 }}>Last 30 days</p>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: OUTFIT, fontSize: 34, fontWeight: 800, color: NEU.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmtPct(m.submitted, m.visits)}
            </div>
            <div style={label}>Conversion</div>
          </div>
          <div className="flex" style={{ gap: 18, marginTop: 10 }}>
            <div>
              <div style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(m.visits)}</div>
              <div style={label}>Visits</div>
            </div>
            <div>
              <div style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(m.submitted)}</div>
              <div style={label}>Submitted</div>
            </div>
          </div>
          <div
            role="img"
            aria-label={`Visits by source: ${m.segs.map(([k, n]) => `${TRAFFIC_SOURCE_LABEL[k]} ${n}`).join(', ') || 'none yet'}`}
            className="flex overflow-hidden"
            style={{ height: 8, borderRadius: 999, marginTop: 12, gap: 2, background: 'color-mix(in srgb, var(--gv-main) 7%, transparent)' }}
          >
            {m.segs.map(([k, n]) => (
              <span key={k} title={`${TRAFFIC_SOURCE_LABEL[k]}: ${n}`} style={{ flex: n, background: SOURCE_COLOR[k] }} />
            ))}
          </div>
          <div className="flex flex-wrap" style={{ gap: '3px 10px', marginTop: 7 }}>
            {m.segs.slice(0, 3).map(([k]) => (
              <span key={k} className="inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.ink }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: SOURCE_COLOR[k] }} />
                {TRAFFIC_SOURCE_LABEL[k]}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 self-start focus:outline-none focus-visible:ring-2 rounded transition-opacity hover:opacity-70"
            style={{ marginTop: 'auto', paddingTop: 10, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.forest, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            See every source
            <ArrowRight size={13} />
          </button>
          {open && <TrafficDialog summary={summary} onClose={() => setOpen(false)} />}
        </>
      )}
    </NeuCard>
  );
}

/** Fetching wrapper mounted on /manage/[slug]. Renders nothing on a refusal. */
export default function TrafficSourcesCard({ conferenceId }: { conferenceId: string }) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!token || !conferenceId) return;
    let cancelled = false;
    getAuthedClient(token)
      .rpc('conference_traffic_summary', { p_conference: conferenceId })
      .then(({ data, error }) => {
        if (cancelled) return;
        const d = data as ({ ok: boolean } & TrafficSummary) | null;
        if (error || !d?.ok) { setDenied(true); return; }
        setSummary(d);
      });
    return () => { cancelled = true; };
  }, [token, conferenceId]);

  if (denied) return null;
  return <TrafficCompactView summary={summary} />;
}
