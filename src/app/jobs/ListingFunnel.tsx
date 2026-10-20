'use client';

// ── A listing's funnel (Job Board prompt 10) ───────────────────────────────
//
// Read left to right: Views, Clicked Apply, Started, Applied, each a big
// number with its word, joined by a thin chevron, with the share that went on
// between steps ("26%", hidden when the step before is 0). Under it the week:
// "This week: N views, N clicks". An outside listing (people apply on another
// site) shows only Views and Clicked their link. Started carries a quiet note
// when people were stopped by an Essential question.
//
// Used by the organizer rows (manage/[slug]/jobs/ListingRow.tsx) and Your
// Listings on /jobs. Gavelling colours. Presentational only.

import { ChevronRight } from 'lucide-react';
import type { JobFunnel } from '@/lib/jobBoard';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';

function share(next: number, prev: number): string | null {
  if (!prev) return null;
  return `${Math.round((next / prev) * 100)}%`;
}

export default function ListingFunnel({ funnel, fallback, outside }: {
  funnel: JobFunnel | null | undefined;
  /** Used when the server sent no funnel (older rows). */
  fallback: { views: number; clicks: number; applicants?: number };
  outside: boolean;
}) {
  const f: JobFunnel = funnel ?? {
    views: fallback.views, clicks: fallback.clicks, started: 0, screened_out: 0,
    submitted: fallback.applicants ?? 0, views_7d: 0, clicks_7d: 0,
  };
  const steps: { n: number; word: string; note?: string }[] = outside
    ? [{ n: f.views, word: 'Views' }, { n: f.clicks, word: 'Clicked their link' }]
    : [
      { n: f.views, word: 'Views' },
      { n: f.clicks, word: 'Clicked Apply' },
      { n: f.started, word: 'Started', note: f.screened_out > 0 ? `${f.screened_out.toLocaleString('en-US')} stopped by an Essential question` : undefined },
      { n: f.submitted, word: 'Applied' },
    ];

  return (
    <div className="gv-fn" style={{ fontFamily: FONT }}>
      <style>{CSS}</style>
      <ol className="gv-fn-steps" aria-label="How people moved through this listing">
        {steps.map((s, i) => {
          const pct = i > 0 ? share(s.n, steps[i - 1].n) : null;
          return (
            <li key={s.word} className="gv-fn-step">
              {i > 0 && (
                <span className="gv-fn-join" aria-hidden={!pct}>
                  <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
                  {pct && <span className="gv-fn-pct">{pct}</span>}
                </span>
              )}
              <span className="gv-fn-cell">
                <span className="gv-fn-n">{s.n.toLocaleString('en-US')}</span>
                <span className="gv-fn-word">{s.word}</span>
                {s.note && <span className="gv-fn-note">{s.note}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="gv-fn-week">This week: {f.views_7d.toLocaleString('en-US')} {f.views_7d === 1 ? 'view' : 'views'}, {f.clicks_7d.toLocaleString('en-US')} {f.clicks_7d === 1 ? 'click' : 'clicks'}</p>
    </div>
  );
}

const CSS = `
.gv-fn{min-width:0}
.gv-fn-steps{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 0}
.gv-fn-step{display:flex;align-items:flex-start}
.gv-fn-join{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:44px;padding:4px 6px 0;color:rgba(28,20,16,0.35)}
.gv-fn-pct{font-size:11.5px;font-weight:700;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-fn-cell{display:flex;flex-direction:column;min-width:0;max-width:170px}
.gv-fn-n{font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK};font-variant-numeric:tabular-nums}
.gv-fn-word{font-size:12.5px;font-weight:600;color:${INK_SOFT}}
.gv-fn-note{margin-top:2px;font-size:11.5px;line-height:1.35;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-fn-week{margin:6px 0 0;font-size:12.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums}
`;
