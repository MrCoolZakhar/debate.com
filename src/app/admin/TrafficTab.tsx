'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Traffic. The site-wide anonymous page counter
// (site_page_views, written by /api/site-view) and the Spotlight and Store
// numbers, for 7, 30 or 90 days. One RPC, admin_site_traffic(p_days), gated
// in the database on is_platform_admin(). Raw errors are kept on purpose here.
//
// Charts follow the Data tab's rules: one metric per chart, direct labels,
// the bar is a magnitude cue and the number beside it is the data.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { BarChart3, Compass, Globe2, RefreshCw, Sparkles, Store } from 'lucide-react';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuIconDisc, NeuInset, smoothPath } from '@/components/neu';
import { int, NUM } from './staffBits';

interface Traffic {
  ok: boolean;
  by_day: { day: string; views: number }[];
  by_page: { page: string; views: number }[];
  by_source: { source: string; views: number }[];
  spotlights: { conference: string; placement: string; target: string; views: number; clicks: number }[];
  store: { spotlight_credits: number; email_credits: number; sponsorship_added: number; guide_unlocks: number };
}

type Days = 7 | 30 | 90;

interface PageSeries { page: string | null; pages: string[]; by_day: { day: string; views: number }[] }

// The daily chart's page filter: page FAMILIES (the part of the page key
// before any '/'), matched by admin_site_page_series(p_days, p_page), where
// 'guides' also counts 'guides/<slug>'. Any other family the server saw in the
// window is appended with its key as the label.
const PAGE_FAMILIES: { key: string; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'explore', label: 'Explore' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'map', label: 'Map' },
  { key: 'create', label: 'Create' },
  { key: 'conference', label: 'Conference pages' },
  { key: 'guides', label: 'Guides' },
  { key: 'blog', label: 'Blog' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'help', label: 'Help' },
  { key: 'join', label: 'Join' },
];
const familyLabel = (k: string) => PAGE_FAMILIES.find(f => f.key === k)?.label ?? k.charAt(0).toUpperCase() + k.slice(1);

export default function TrafficTab() {
  const { session, loading: authLoading } = useAuth();
  const [days, setDays] = useState<Days>(30);
  const [t, setT] = useState<Traffic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // null = Whole site.
  const [page, setPage] = useState<string | null>(null);
  const [series, setSeries] = useState<{ key: string; data: PageSeries } | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    let alive = true;
    setBusy(true);
    const supabase = getAuthedClient(session.access_token);
    void supabase.rpc('admin_site_traffic', { p_days: days }).then(({ data, error: e }) => {
      if (!alive) return;
      setBusy(false);
      if (e) { setError(e.message); return; }
      const d = data as Traffic;
      if (!d?.ok) { setError('not authorised'); return; }
      setError(null);
      setT(d);
    });
    return () => { alive = false; };
  }, [authLoading, session, days]);

  // The daily chart: one read per (window, page family).
  const seriesKey = `${days}|${page ?? ''}`;
  useEffect(() => {
    if (authLoading || !session) return;
    let alive = true;
    const supabase = getAuthedClient(session.access_token);
    void supabase.rpc('admin_site_page_series', { p_days: days, p_page: page }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) { setSeriesError(e.message); return; }
      setSeriesError(null);
      setSeries({ key: `${days}|${page ?? ''}`, data: data as PageSeries });
    });
    return () => { alive = false; };
  }, [authLoading, session, days, page]);

  if (error) return <p style={{ fontFamily: OUTFIT, color: '#8B2020', fontSize: 13 }}>{error}</p>;
  if (!t) return <div className="py-16 flex justify-center"><Loader /></div>;

  const current = series && series.key === seriesKey ? series.data : null;
  // Whole site falls back to admin_site_traffic's own series until the page read lands.
  const dayPoints = current?.by_day ?? (page === null ? t.by_day : []);
  const totalViews = dayPoints.reduce((n, d) => n + d.views, 0);
  const familyKeys = [
    ...PAGE_FAMILIES.map(f => f.key),
    ...(series?.data.pages ?? []).filter(k => k && !PAGE_FAMILIES.some(f => f.key === k)),
  ];
  const chartTitle = page === null ? 'Daily views: Whole site' : `Daily views: ${familyLabel(page)}`;
  const totalSpotViews = t.spotlights.reduce((n, s) => n + s.views, 0);
  const totalSpotClicks = t.spotlights.reduce((n, s) => n + s.clicks, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div role="radiogroup" aria-label="Window" className="inline-flex gap-1">
          {([7, 30, 90] as Days[]).map(d => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className="focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                backgroundColor: days === d ? NEU.forest : 'rgba(27,56,40,0.08)', color: days === d ? NEU.gold : NEU.ink,
              }}
            >
              {d} days
            </button>
          ))}
        </div>
        {busy && <RefreshCw size={14} className="animate-spin" style={{ color: NEU.inkSoft }} />}
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, margin: 0 }}>
          Anonymous daily counts. No cookie, no IP, no identifier. Counting began 25 Sep 2026.
        </p>
      </div>

      <Section icon={BarChart3} gradient={NEU_GRADIENTS.forest} title={chartTitle} kicker={`${int(totalViews)} views in ${days} days`}>
        <div role="radiogroup" aria-label="Page" className="flex flex-wrap gap-1 mb-3">
          {[null, ...familyKeys].map(k => (
            <button
              key={k ?? '__site'}
              type="button"
              role="radio"
              aria-checked={page === k}
              onClick={() => setPage(k)}
              className="focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                backgroundColor: page === k ? NEU.forest : 'rgba(27,56,40,0.07)', color: page === k ? '#FFFFFF' : NEU.ink,
              }}
            >
              {k === null ? 'Whole site' : familyLabel(k)}
            </button>
          ))}
        </div>
        {seriesError ? (
          <p style={{ fontFamily: OUTFIT, color: '#8B2020', fontSize: 12 }}>{seriesError}</p>
        ) : !current && page !== null ? (
          <div className="py-10 flex justify-center"><Loader /></div>
        ) : (
          <DayChart points={dayPoints} days={days} label={chartTitle} />
        )}
      </Section>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <Section icon={Compass} gradient={NEU_GRADIENTS.sage} title="Top pages">
          <RankedBars rows={t.by_page.slice(0, 14).map(p => ({ key: p.page, label: p.page, n: p.views }))} />
        </Section>
        <Section icon={Globe2} gradient={NEU_GRADIENTS.amber} title="Top sources">
          <RankedBars rows={t.by_source.slice(0, 14).map(s => ({ key: s.source, label: s.source, n: s.views }))} />
        </Section>
      </div>

      <Section icon={Sparkles} gradient={NEU_GRADIENTS.gold} title="Spotlights" kicker={`${int(totalSpotViews)} views, ${int(totalSpotClicks)} clicks`}>
        {t.spotlights.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No spotlight views in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: OUTFIT, fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: NEU.inkSoft, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Conference</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Placement</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Views</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Clicks</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Click rate</th>
                </tr>
              </thead>
              <tbody>
                {t.spotlights.map((s, i) => (
                  <tr key={`${s.conference}-${s.placement}-${s.target}-${i}`} style={{ borderTop: '1px solid rgba(27,56,40,0.09)' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 700, color: NEU.ink }}>{s.conference}</td>
                    <td style={{ padding: '7px 8px', color: NEU.inkSoft }}>{s.placement}{s.target ? ` (${s.target})` : ''}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 800, ...NUM }}>{int(s.views)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 800, ...NUM }}>{int(s.clicks)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: NEU.inkSoft, ...NUM }}>{s.views > 0 ? `${((s.clicks / s.views) * 100).toFixed(1)}%` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={Store} gradient={NEU_GRADIENTS.forest} title="Store" kicker="Credits, not money">
        <StatStrip items={[
          { label: 'Spotlight credits', value: int(t.store.spotlight_credits) },
          { label: 'Email credits', value: int(t.store.email_credits) },
          { label: 'Sponsorship added', value: int(t.store.sponsorship_added) },
          { label: 'Guide unlocks', value: int(t.store.guide_unlocks) },
        ]} />
      </Section>
    </div>
  );
}

// ── Pieces, in the Data tab's manner ─────────────────────────────────────────

function Section({ icon, gradient, title, kicker, children }: {
  icon: typeof BarChart3; gradient: [string, string]; title: string; kicker?: string; children: React.ReactNode;
}) {
  return (
    <NeuCard style={{ padding: '18px 20px 20px' }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <NeuIconDisc gradient={gradient} icon={icon} size={36} />
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>{title}</h2>
          {kicker && <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 1 }}>{kicker}</p>}
        </div>
      </div>
      {children}
    </NeuCard>
  );
}

function StatStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <NeuInset small style={{ display: 'flex', flexWrap: 'wrap', gap: 0, padding: '10px 4px' }}>
      {items.map((it, i) => (
        <div key={it.label} className="flex-1" style={{ minWidth: 78, padding: '2px 12px', borderInlineStart: i === 0 ? 'none' : '1px solid rgba(27,56,40,0.09)' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 900, color: NEU.ink, lineHeight: 1.1, ...NUM }}>{it.value}</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, color: NEU.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>{it.label}</p>
        </div>
      ))}
    </NeuInset>
  );
}

function RankedBars({ rows }: { rows: { key: string; label: string; n: number }[] }) {
  const top = Math.max(1, ...rows.map(r => r.n));
  if (rows.length === 0) return <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, padding: '8px 2px' }}>Nothing yet.</p>;
  return (
    <div className="flex flex-col" style={{ gap: 7 }}>
      {rows.map(r => (
        <div key={r.key} className="flex items-center gap-2.5">
          <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, width: 150, flexShrink: 0, overflowWrap: 'anywhere' }} title={r.label}>{r.label}</span>
          <span className="flex-1" style={{ minWidth: 40, height: 9, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
            <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `max(${((r.n / top) * 100).toFixed(1)}%, 9px)`, background: `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`, transition: `width 600ms ${EASE}` }} />
          </span>
          <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, width: 52, textAlign: 'end', flexShrink: 0, ...NUM }}>{int(r.n)}</span>
        </div>
      ))}
    </div>
  );
}

/** Daily bars with a dashed 7-day mean, like the Data tab's growth chart. Days
 *  with no row are drawn as zero so the axis is a real calendar. */
/** Whole-number gridlines with no repeats: a 1, 2 or 5 step (times a power of
 *  ten, never under 1) that reaches the maximum. All zero draws 0 and 1. */
function dayTicks(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(1, [1, 2, 5, 10].map(m => m * pow).find(v => v >= raw) ?? 10 * pow);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

function DayChart({ points, days, label }: { points: { day: string; views: number }[]; days: number; label: string }) {
  const byDay = new Map(points.map(p => [p.day.slice(0, 10), p.views]));
  const series: { d: string; v: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    series.push({ d: iso, v: byDay.get(iso) ?? 0 });
  }
  const W = 720, H = 160, padL = 34, padB = 22, padT = 10;
  const { top: max, ticks } = dayTicks(Math.max(0, ...series.map(s => s.v)));
  const empty = series.every(s => s.v === 0);
  const innerW = W - padL - 6, innerH = H - padT - padB;
  const bw = innerW / series.length;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const mean = series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((n, s) => n + s.v, 0) / slice.length;
  });
  const meanPts = mean.map((m, i) => ({ x: padL + bw * i + bw / 2, y: y(m) }));
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420, display: 'block', fontFamily: OUTFIT }} role="img" aria-label={`${label}, per day over ${days} days`}>
        {ticks.map((tk, i) => (
          <g key={`${i}-${tk}`}>
            <line x1={padL} x2={W - 6} y1={y(tk)} y2={y(tk)} stroke="#DDD4C0" strokeDasharray="2 3" />
            <text x={padL - 6} y={y(tk) + 3} fontSize="9" textAnchor="end" fill={NEU.inkSoft}>{int(tk)}</text>
          </g>
        ))}
        {series.map((s, i) => (
          <rect key={s.d} x={padL + bw * i + bw * 0.15} y={y(s.v)} width={bw * 0.7} height={Math.max(0, padT + innerH - y(s.v))} rx={2} fill={NEU.forest} opacity={0.85}>
            <title>{`${s.d}: ${int(s.v)} views`}</title>
          </rect>
        ))}
        <path d={smoothPath(meanPts)} fill="none" stroke="#B6871F" strokeWidth={2} strokeDasharray="5 4" />
        {series.map((s, i) => (i === 0 || i === series.length - 1 || (days > 7 && i % Math.round(days / 6) === 0)) && (
          <text key={`t${s.d}`} x={padL + bw * i + bw / 2} y={H - 6} fontSize="9" textAnchor="middle" fill={NEU.inkSoft}>{s.d.slice(5)}</text>
        ))}
      </svg>
      <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 4 }}>
        {empty ? 'No views in this window.' : 'Bars are the daily count; the dashed line is the 7-day mean.'}
      </p>
    </div>
  );
}
