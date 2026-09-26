'use client';

// Your Spotlights (25 Sep 2026): a card at the bottom of the Store with a
// short summary ("2 live, 1 upcoming", total views and clicks). Clicking it
// opens "Choose Your Spotlight", the list of bookings; choosing one turns the
// pop-up into that spotlight's dashboard: placement and dates, status, the
// description, views, clicks, click rate, views and clicks by day, and Cancel
// (the existing cancel_spotlight flow and confirm) while it is cancellable. A
// back button returns to the list; the X closes. With no bookings the card
// says so and points at the Spotlight cards above.
//
// Reads come from the page (my_spotlights, my_spotlight_stats); the only
// write is cancel_spotlight(p_purchase), as before.

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, CalendarClock, CheckCircle2, ChevronRight, Radio } from 'lucide-react';
import { notifyOk } from '@/lib/appNotify';
import { friendlyError } from '@/lib/friendlyError';
import { OUTFIT } from '@/components/neu';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { authedClient, BUNDLES, fmtDay, messageOf, type SpotlightPurchase, type SpotlightStat } from './storeApi';
import { StoreCard, DEEP_GOLD, FOREST, INK, INK_SOFT, DANGER } from './storeKit';

const STATUS: Record<SpotlightPurchase['status'], { Icon: typeof Radio; label: string; color: string }> = {
  upcoming: { Icon: CalendarClock, label: 'Upcoming', color: DEEP_GOLD },
  live: { Icon: Radio, label: 'Live now', color: FOREST },
  ended: { Icon: CheckCircle2, label: 'Ended', color: INK_SOFT },
  cancelled: { Icon: Ban, label: 'Cancelled', color: INK_SOFT },
};

interface DayStat { day: string; views: number; clicks: number }
type StatWithDays = SpotlightStat & { by_day?: DayStat[] };

function kindName(p: SpotlightPurchase): string {
  if (p.is_house) return 'Gavelling Spotlight (on the house)';
  const b = BUNDLES.find(x => x.kind === p.kind);
  if (b) return `${b.name} bundle`;
  const first = p.bookings?.[0];
  return first?.label ?? 'Spotlight';
}

function datesLine(p: SpotlightPurchase): string {
  const bs = p.bookings ?? [];
  if (bs.length === 0) return '';
  const first = bs.map(b => b.first_day).sort()[0];
  const last = bs.map(b => b.last_day).sort().slice(-1)[0];
  return first === last ? fmtDay(first, true) : `${fmtDay(first)} to ${fmtDay(last, true)}`;
}

function totalsFor(stats: StatWithDays[], purchaseId: string) {
  const rows = stats.filter(s => s.purchase_id === purchaseId);
  const views = rows.reduce((n, s) => n + (s.views ?? 0), 0);
  const clicks = rows.reduce((n, s) => n + (s.clicks ?? 0), 0);
  const byDay = new Map<string, DayStat>();
  for (const r of rows) for (const d of r.by_day ?? []) {
    const k = d.day.slice(0, 10);
    const cur = byDay.get(k) ?? { day: k, views: 0, clicks: 0 };
    cur.views += d.views ?? 0;
    cur.clicks += d.clicks ?? 0;
    byDay.set(k, cur);
  }
  return { views, clicks, byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)) };
}

/** One metric per strip, each on its own scale, direct labels. */
function DayStrip({ label, days, pick, color }: { label: string; days: DayStat[]; pick: (d: DayStat) => number; color: string }) {
  const max = Math.max(1, ...days.map(pick));
  const total = days.reduce((n, d) => n + pick(d), 0);
  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: INK }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString('en-US')} in {days.length} {days.length === 1 ? 'day' : 'days'}</span>
      </div>
      <div className="flex items-end" style={{ gap: 2, height: 56 }} role="img" aria-label={`${label} by day`}>
        {days.map(d => (
          <span
            key={d.day}
            title={`${fmtDay(d.day)}: ${pick(d).toLocaleString('en-US')} ${label.toLowerCase()}`}
            style={{ flex: '1 1 0', minWidth: 3, height: `${Math.max(4, (pick(d) / max) * 100)}%`, background: color, borderRadius: 3, opacity: pick(d) === 0 ? 0.25 : 1 }}
          />
        ))}
      </div>
      {days.length > 0 && (
        <div className="flex justify-between" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: INK_SOFT, marginTop: 3 }}>
          <span>{fmtDay(days[0].day)}</span>
          <span>{fmtDay(days[days.length - 1].day)}</span>
        </div>
      )}
    </div>
  );
}

export default function YourSpotlights({ spotlights, stats, onChanged }: {
  spotlights: SpotlightPurchase[]; stats: SpotlightStat[]; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const statRows = stats as StatWithDays[];
  const summary = useMemo(() => {
    const live = spotlights.filter(p => p.status === 'live').length;
    const upcoming = spotlights.filter(p => p.status === 'upcoming').length;
    const views = statRows.reduce((n, s) => n + (s.views ?? 0), 0);
    const clicks = statRows.reduce((n, s) => n + (s.clicks ?? 0), 0);
    return { live, upcoming, views, clicks };
  }, [spotlights, statRows]);

  const chosen = chosenId ? spotlights.find(p => p.purchase_id === chosenId) ?? null : null;

  const close = () => { setOpen(false); setChosenId(null); setConfirming(false); setErr(''); };

  const cancel = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('cancel_spotlight', { p_purchase: id });
      if (error) throw error;
      const a = data as { ok?: boolean; message?: string };
      if (a?.ok !== true) { setErr(messageOf(a, 'That spotlight could not be cancelled.')); return; }
      notifyOk(messageOf(a, 'Spotlight cancelled. The credits are back in the conference.'), 'store');
      setConfirming(false);
      onChanged();
    } catch (e) {
      setErr(friendlyError(e, 'That spotlight could not be cancelled.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const parts: string[] = [];
  if (summary.live) parts.push(`${summary.live} live`);
  if (summary.upcoming) parts.push(`${summary.upcoming} upcoming`);

  return (
    <>
      <StoreCard
        title="Your Spotlights"
        hint="Every spotlight this conference has booked. Views are how many people saw your card in that placement; clicks are how many opened your page from it."
      >
        {spotlights.length === 0 ? (
          <p className="gv-st-quiet">
            No spotlights yet. <a href="#gv-st-spot" className="gv-st-link">Book one above</a>
          </p>
        ) : (
          <button type="button" className="gv-st-summary" onClick={() => setOpen(true)}>
            <span>
              <span className="gv-st-summary-big">{parts.length ? parts.join(', ') : `${spotlights.length} booked`}</span>
              <span className="gv-st-summary-sub">
                {summary.views.toLocaleString('en-US')} views · {summary.clicks.toLocaleString('en-US')} clicks
              </span>
            </span>
            <ChevronRight size={18} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
          </button>
        )}
      </StoreCard>

      {open && (
        <PurchaseShell tone="light" label={chosen ? kindName(chosen) : 'Choose Your Spotlight'} onClose={close} panelClass="gv-ysp" testId="your-spotlights">
          <style>{PURCHASE_CSS}{CSS}</style>
          <div className="gv-ysp-body">
            {!chosen ? (
              <>
                <h2 className="gv-buy-rtitle" style={{ fontSize: 24, fontWeight: 800, paddingRight: 40 }}>Choose Your Spotlight</h2>
                <ul className="gv-ysp-list">
                  {spotlights.map(p => {
                    const st = STATUS[p.status] ?? STATUS.upcoming;
                    return (
                      <li key={p.purchase_id}>
                        <button type="button" className="gv-ysp-row" onClick={() => { setChosenId(p.purchase_id); setConfirming(false); setErr(''); }}>
                          <span className="min-w-0">
                            <span className="gv-ysp-row-title">{kindName(p)}</span>
                            <span className="gv-ysp-row-sub">{(p.bookings ?? []).map(b => b.label).join(', ')} · {datesLine(p)}</span>
                          </span>
                          <span className="gv-st-status" style={{ color: st.color, flexShrink: 0 }}><st.Icon size={15} strokeWidth={2.4} aria-hidden />{st.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (() => {
              const st = STATUS[chosen.status] ?? STATUS.upcoming;
              const t = totalsFor(statRows, chosen.purchase_id);
              const rate = t.views > 0 ? `${((t.clicks / t.views) * 100).toFixed(1)}%` : '–';
              return (
                <>
                  <div className="flex items-center gap-2" style={{ paddingRight: 40 }}>
                    <button type="button" className="gv-ysp-back" onClick={() => { setChosenId(null); setConfirming(false); setErr(''); }} aria-label="Back to your spotlights">
                      <ArrowLeft size={18} aria-hidden />
                    </button>
                    <h2 className="gv-buy-rtitle" style={{ fontSize: 22, fontWeight: 800 }}>{kindName(chosen)}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="gv-st-status" style={{ color: st.color }}><st.Icon size={15} strokeWidth={2.4} aria-hidden />{st.label}</span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT }}>{datesLine(chosen)}</span>
                  </div>
                  <ul className="gv-ysp-bookings">
                    {(chosen.bookings ?? []).map(b => (
                      <li key={b.placement + b.first_day}>
                        <b>{b.label}</b>{b.target ? ` (${b.target})` : ''}: {b.days} {b.days === 1 ? 'day' : 'days'}, {fmtDay(b.first_day)} to {fmtDay(b.last_day, true)}
                      </li>
                    ))}
                  </ul>
                  {chosen.description ? <p className="gv-ysp-desc">&ldquo;{chosen.description}&rdquo;</p> : null}
                  <div className="gv-ysp-stats">
                    <div><b>{t.views.toLocaleString('en-US')}</b><span>views</span></div>
                    <div><b>{t.clicks.toLocaleString('en-US')}</b><span>clicks</span></div>
                    <div><b>{rate}</b><span>click rate</span></div>
                  </div>
                  {t.byDay.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      <DayStrip label="Views" days={t.byDay} pick={d => d.views} color={FOREST} />
                      <DayStrip label="Clicks" days={t.byDay} pick={d => d.clicks} color={DEEP_GOLD} />
                    </div>
                  ) : (
                    <p className="gv-st-quiet">Views and clicks show here, day by day, once it is live</p>
                  )}
                  {chosen.cancellable && !chosen.is_house && (
                    <div className="gv-ysp-cancel">
                      {confirming ? (
                        <>
                          <p className="gv-st-quiet" style={{ color: INK }}>Cancel this whole booking? The credits go back to the conference</p>
                          <div className="flex gap-2 mt-2">
                            <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38, color: DANGER, boxShadow: `inset 0 0 0 1.5px ${DANGER}` }} disabled={busy} onClick={() => { void cancel(chosen.purchase_id); }}>
                              {busy ? 'Cancelling' : 'Yes, cancel'}
                            </button>
                            <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38 }} onClick={() => setConfirming(false)}>Keep it</button>
                          </div>
                        </>
                      ) : (
                        <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38 }} onClick={() => setConfirming(true)}>Cancel</button>
                      )}
                      <p className="gv-st-quiet" style={{ fontSize: 12, marginTop: 6 }}>
                        Cancel up to 2 days before it starts{chosen.cancel_until ? `, by ${fmtDay(chosen.cancel_until)}` : ''}
                      </p>
                      {err ? <p className="gv-st-err" role="alert">{err}</p> : null}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </PurchaseShell>
      )}
    </>
  );
}

const CSS = `
.gv-buy-panel.gv-ysp{max-width:640px;min-height:0}
.gv-buy-panel.gv-ysp .gv-buy-body{flex-direction:column}
.gv-ysp-body{padding:30px 28px 26px;display:flex;flex-direction:column;gap:14px;font-family:${OUTFIT};color:${INK}}
.gv-ysp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.gv-ysp-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:none;border-radius:14px;background:#FFFFFF;box-shadow:0 1px 3px rgba(27,56,40,0.08);text-align:left;cursor:pointer;font-family:${OUTFIT}}
.gv-ysp-row:hover{background:#FAF8F3}
.gv-ysp-row:focus{outline:none}
.gv-ysp-row:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-ysp-row-title{display:block;font-size:15px;font-weight:800;color:${INK};overflow-wrap:anywhere}
.gv-ysp-row-sub{display:block;margin-top:2px;font-size:12.5px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-ysp-back{width:36px;height:36px;border-radius:999px;border:1px solid rgba(27,56,40,0.2);background:#FFFFFF;color:${FOREST};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.gv-ysp-back:focus{outline:none}
.gv-ysp-back:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-ysp-bookings{list-style:none;margin:0;padding:0;font-size:13.5px;line-height:1.5;color:${INK}}
.gv-ysp-desc{margin:0;font-size:13.5px;font-style:italic;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-ysp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.gv-ysp-stats div{padding:10px 12px;border-radius:12px;background:#FAF8F3}
.gv-ysp-stats b{display:block;font-size:24px;font-weight:900;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-ysp-stats span{font-size:12px;color:${INK_SOFT}}
.gv-ysp-cancel{padding-top:12px;border-top:1px solid rgba(28,20,16,0.1)}
@media (max-width:743px){.gv-ysp-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
`;
