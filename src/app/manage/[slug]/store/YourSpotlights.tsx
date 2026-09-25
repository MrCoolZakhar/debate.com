'use client';

// YourSpotlights — every spotlight purchase of the conference: placements and
// dates, status as an icon plus words, views and clicks, and CANCEL while
// cancellable (up to 2 days before it starts; Launch, Everything and the
// flagship booking never). cancel_spotlight(p_purchase) cancels the whole
// purchase.

import { useRef, useState } from 'react';
import { Ban, CalendarClock, CheckCircle2, Radio } from 'lucide-react';
import { notifyOk } from '@/lib/appNotify';
import { friendlyError } from '@/lib/friendlyError';
import { authedClient, BUNDLES, fmtDay, messageOf, type SpotlightPurchase, type SpotlightStat } from './storeApi';
import { StoreCard, DEEP_GOLD, FOREST, INK_SOFT, DANGER } from './storeKit';

const STATUS: Record<SpotlightPurchase['status'], { Icon: typeof Radio; label: string; color: string }> = {
  upcoming: { Icon: CalendarClock, label: 'Upcoming', color: DEEP_GOLD },
  live: { Icon: Radio, label: 'Live now', color: FOREST },
  ended: { Icon: CheckCircle2, label: 'Ended', color: INK_SOFT },
  cancelled: { Icon: Ban, label: 'Cancelled', color: INK_SOFT },
};

function kindName(kind: string): string {
  const b = BUNDLES.find(x => x.kind === kind);
  return b ? `${b.name} bundle` : 'Spotlight';
}

export default function YourSpotlights({ spotlights, stats, onChanged }: {
  spotlights: SpotlightPurchase[]; stats: SpotlightStat[]; onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const busyRef = useRef(false);

  const cancel = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    setErr(e => ({ ...e, [id]: '' }));
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('cancel_spotlight', { p_purchase: id });
      if (error) throw error;
      const a = data as { ok?: boolean; message?: string };
      if (a?.ok !== true) { setErr(e => ({ ...e, [id]: messageOf(a, 'That spotlight could not be cancelled.') })); return; }
      notifyOk(messageOf(a, 'Spotlight cancelled. The credits are back in the conference.'), 'store');
      setConfirmId(null);
      onChanged();
    } catch (e) {
      setErr(x => ({ ...x, [id]: friendlyError(e, 'That spotlight could not be cancelled.') }));
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  return (
    <StoreCard
      title="Your Spotlights"
      hint="Every spotlight this conference has booked, with what it is doing. Views are how many people saw your card in that placement; clicks are how many opened your page from it."
    >
      {spotlights.length === 0 ? (
        <p className="gv-st-quiet">Nothing booked yet. Your bookings and their reports will show here</p>
      ) : (
        <div className="gv-st-rows">
          {spotlights.map(p => {
            const st = STATUS[p.status] ?? STATUS.upcoming;
            const views = stats.filter(s => s.purchase_id === p.purchase_id).reduce((n, s) => n + (s.views ?? 0), 0);
            const clicks = stats.filter(s => s.purchase_id === p.purchase_id).reduce((n, s) => n + (s.clicks ?? 0), 0);
            const bookings = p.bookings ?? [];
            return (
              <div key={p.purchase_id} className="gv-st-row">
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <p className="gv-st-row-title">{p.is_house ? 'Gavelling Spotlight (on the house)' : kindName(p.kind)}</p>
                  {bookings.map(b => (
                    <p key={b.placement + b.first_day} className="gv-st-row-sub">
                      <b style={{ fontWeight: 700 }}>{b.label}</b>{b.target ? ` (${b.target})` : ''}: {b.days} {b.days === 1 ? 'day' : 'days'}, {fmtDay(b.first_day)} to {fmtDay(b.last_day, true)}
                    </p>
                  ))}
                  {p.description ? <p className="gv-st-row-sub" style={{ fontStyle: 'italic' }}>&ldquo;{p.description}&rdquo;</p> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span className="gv-st-status" style={{ color: st.color }}><st.Icon size={16} strokeWidth={2.4} aria-hidden />{st.label}</span>
                  <span className="gv-st-stat"><b>{views.toLocaleString('en-US')}</b> views · <b>{clicks.toLocaleString('en-US')}</b> clicks</span>
                  <span className="gv-st-stat">{p.credits} credits</span>
                </div>
                {p.cancellable && !p.is_house && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                    {confirmId === p.purchase_id ? (
                      <>
                        <p className="gv-st-quiet">Cancel this whole booking? The credits go back to the conference</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38, color: DANGER, boxShadow: `inset 0 0 0 1.5px ${DANGER}` }} disabled={busyId === p.purchase_id} onClick={() => { void cancel(p.purchase_id); }}>
                            {busyId === p.purchase_id ? 'Cancelling' : 'Yes, cancel'}
                          </button>
                          <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38 }} onClick={() => setConfirmId(null)}>Keep it</button>
                        </div>
                      </>
                    ) : (
                      <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38 }} onClick={() => setConfirmId(p.purchase_id)}>Cancel</button>
                    )}
                    <p className="gv-st-quiet" style={{ fontSize: 12 }}>
                      Cancel up to 2 days before it starts{p.cancel_until ? `, by ${fmtDay(p.cancel_until)}` : ''}
                    </p>
                    {err[p.purchase_id] ? <p className="gv-st-err" role="alert">{err[p.purchase_id]}</p> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </StoreCard>
  );
}
