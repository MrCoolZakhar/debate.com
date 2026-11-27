'use client';

// ── A listing's views and clicks, day by day (prompt 76, 26 Nov 2026) ──────
//
// Opened from a listing row's Views or Clicks (ListingFunnel). One pop-up (the
// Store shell): the listing's title, a switch between Views and Clicks to
// apply, the 30-day total, and a bar chart from job_listing_daily, one bar per
// day (plain SVG: there is no chart library in the app), the day under every
// 7th bar and the number on hover or focus. The counts are anonymous.

import { useEffect, useState } from 'react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { POSTING_CSS } from './PostingPopup';
import { dayLabel, jobListingDaily, type ListingDay } from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

type Metric = 'views' | 'clicks';

export default function ListingTrafficPopup({ listingId, title, initial, onClose }: {
  listingId: string;
  title: string;
  initial: Metric;
  onClose: () => void;
}) {
  const [days, setDays] = useState<ListingDay[] | null>(null);
  const [err, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [metric, setMetric] = useState<Metric>(initial);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void jobListingDaily(listingId, 30).then((r) => {
      if (cancelled) return;
      if (r.ok) { setDays(r.days); setErr(''); } else setErr(r.message);
    });
    return () => { cancelled = true; };
  }, [listingId, attempt]);

  const values = (days ?? []).map((d) => d[metric]);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...values);
  const word = metric === 'views' ? (total === 1 ? 'view' : 'views') : (total === 1 ? 'click to apply' : 'clicks to apply');

  // The chart's own coordinate space; the SVG scales to the pop-up's width.
  const W = 600, H = 180, GAP = 3, LABEL = 22;
  const n = Math.max(1, values.length);
  const bw = (W - GAP * (n - 1)) / n;

  return (
    <PurchaseShell tone="light" label={title} onClose={onClose} panelClass="gv-st-pop gv-jp gv-ltp" testId="job-listing-traffic">
      <style>{PURCHASE_CSS}{POSTING_CSS}{CSS}</style>
      <div className="gv-jp-col">
        <header className="gv-jp-head">
          <h2 className="gv-jp-title" style={{ marginTop: 0, overflowWrap: 'break-word' }}>{title}</h2>
        </header>

        <div className="gv-ltp-switch" role="group" aria-label="Show">
          {([['views', 'Views'], ['clicks', 'Clicks to apply']] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={metric === k} className={`gv-jp-offer${metric === k ? ' gv-jp-offer-on' : ''}`} onClick={() => { setMetric(k); setFocus(null); }}>
              {label}
            </button>
          ))}
        </div>

        {err && !days ? (
          <p className="gv-jp-err gv-jp-err-block" role="alert">
            {err} <button type="button" className="gv-jp-a" onClick={() => { setErr(''); setAttempt((a) => a + 1); }}>Try again</button>
          </p>
        ) : !days ? (
          <div aria-busy="true" aria-label="Loading">
            <span className="gv-ltp-skel" style={{ height: 34, width: 160 }} />
            <span className="gv-ltp-skel" style={{ height: 200, marginTop: 12 }} />
          </div>
        ) : (
          <div className="gv-ltp-chartcard">
            <p className="gv-ltp-total"><b>{total.toLocaleString('en-US')}</b> {word} <span>in the last 30 days</span></p>
            {focus !== null && days[focus] ? (
              <p className="gv-ltp-focus" aria-live="polite">{dayLabel(days[focus].day)}: <b>{values[focus].toLocaleString('en-US')}</b></p>
            ) : (
              <p className="gv-ltp-focus" aria-hidden>&nbsp;</p>
            )}
            <svg viewBox={`0 0 ${W} ${H + LABEL}`} className="gv-ltp-svg" role="img" aria-label={`${metric === 'views' ? 'Views' : 'Clicks to apply'} for each of the last 30 days`}>
              {days.map((d, i) => {
                const h = Math.max(values[i] > 0 ? 3 : 1.5, (values[i] / max) * (H - 4));
                const x = i * (bw + GAP);
                return (
                  <g key={d.day}>
                    <rect
                      x={x} y={H - h} width={bw} height={h} rx={Math.min(3, bw / 3)}
                      fill={FOREST} opacity={values[i] === 0 ? 0.25 : focus === i ? 1 : 0.85}
                      tabIndex={0}
                      aria-label={`${dayLabel(d.day)}: ${values[i]}`}
                      onMouseEnter={() => setFocus(i)}
                      onMouseLeave={() => setFocus((f) => (f === i ? null : f))}
                      onFocus={() => setFocus(i)}
                      onBlur={() => setFocus((f) => (f === i ? null : f))}
                      className="gv-ltp-bar"
                    />
                    {i % 7 === 0 && (
                      <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="gv-ltp-day">{dayLabel(d.day)}</text>
                    )}
                  </g>
                );
              })}
            </svg>
            <p className="gv-ltp-note">Counted without knowing who they are</p>
          </div>
        )}
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-jp.gv-ltp{max-width:720px}
.gv-ltp-switch{display:flex;flex-wrap:wrap;gap:8px}
.gv-ltp-chartcard{padding:16px 18px;border-radius:18px;background:#FAF8F3;font-family:${FONT}}
.gv-ltp-total{margin:0;font-size:15px;color:${INK}}
.gv-ltp-total b{font-size:30px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin-right:4px}
.gv-ltp-total span{color:${INK_SOFT};font-size:13.5px}
.gv-ltp-focus{margin:4px 0 6px;min-height:20px;font-size:13.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-ltp-focus b{color:${INK}}
.gv-ltp-svg{display:block;width:100%;height:auto;overflow:visible}
.gv-ltp-bar{cursor:default;outline:none}
.gv-ltp-bar:focus-visible{stroke:${INK};stroke-width:2}
.gv-ltp-day{font-family:${FONT};font-size:11px;fill:${INK_SOFT}}
.gv-ltp-note{margin:8px 0 0;font-size:12.5px;color:${INK_SOFT}}
.gv-ltp-skel{display:block;width:100%;border-radius:14px;background:rgba(28,20,16,0.08);animation:gvLtpPulse 1.2s ease-in-out infinite}
@keyframes gvLtpPulse{0%,100%{opacity:1}50%{opacity:0.55}}
@media (prefers-reduced-motion:reduce){.gv-ltp-skel{animation:none}}
`;
