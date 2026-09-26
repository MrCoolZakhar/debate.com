'use client';

// Your Purchases (25 Sep 2026): a card at the bottom of the Store with the
// credits used and returned so far; clicking it opens the list from
// conference_purchases(p_conf): date, what, who, and the credits (spent in
// ink with a minus, returned in green with a plus). Transfers are not
// purchases and are left out by the database.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { authedClient } from './storeApi';
import { StoreCard, FOREST, INK, INK_SOFT } from './storeKit';

interface PurchaseItem {
  at: string;
  kind: 'spotlight' | 'emails' | 'sponsorship' | 'import' | 'bonus' | 'refund' | string;
  label: string;
  credits: number;
  by: string | null;
}

const GREEN = '#2A5A3C';

export default function YourPurchases({ conferenceId, refreshKey }: { conferenceId: string; refreshKey: number }) {
  const [items, setItems] = useState<PurchaseItem[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('conference_purchases', { p_conf: conferenceId, p_limit: 200 });
      if (error) throw error;
      const a = (data ?? {}) as { ok?: boolean; items?: PurchaseItem[] };
      setItems(a.ok === true && Array.isArray(a.items) ? a.items : []);
    } catch {
      setItems([]);
    }
  }, [conferenceId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const totals = useMemo(() => {
    const list = items ?? [];
    const spent = list.filter(i => i.credits < 0).reduce((n, i) => n - i.credits, 0);
    const back = list.filter(i => i.credits > 0).reduce((n, i) => n + i.credits, 0);
    return { spent, back };
  }, [items]);

  return (
    <>
      <StoreCard
        title="Your Purchases"
        hint="Everything this conference bought in the Store and every credit that came back. Transfers between you and the conference are not purchases, so they are not listed."
      >
        {items === null ? (
          <p className="gv-st-quiet">Reading your purchases</p>
        ) : items.length === 0 ? (
          <p className="gv-st-quiet">Nothing bought yet</p>
        ) : (
          <button type="button" className="gv-st-summary" onClick={() => setOpen(true)}>
            <span>
              <span className="gv-st-summary-big">{totals.spent.toLocaleString('en-US')} {totals.spent === 1 ? 'credit' : 'credits'} used</span>
              <span className="gv-st-summary-sub">
                {totals.back > 0 ? `${totals.back.toLocaleString('en-US')} returned · ` : ''}{items.length} {items.length === 1 ? 'entry' : 'entries'}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
          </button>
        )}
      </StoreCard>

      {open && items && (
        <PurchaseShell tone="light" label="Your Purchases" onClose={() => setOpen(false)} panelClass="gv-ypu" testId="your-purchases">
          <style>{PURCHASE_CSS}{CSS}</style>
          <div className="gv-ypu-body">
            <h2 className="gv-buy-rtitle" style={{ fontSize: 24, fontWeight: 800, paddingRight: 40 }}>Your Purchases</h2>
            {items.length === 0 ? (
              <p className="gv-st-quiet">Nothing bought yet</p>
            ) : (
              <ul className="gv-ypu-list">
                {items.map((i, ix) => (
                  <li key={`${i.at}-${ix}`}>
                    <span className="gv-ypu-when">{new Date(i.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="gv-ypu-what">
                      <b>{i.label}</b>
                      {i.by ? <span>{i.by}</span> : null}
                    </span>
                    <span className="gv-ypu-credits" style={{ color: i.credits > 0 ? GREEN : INK }}>
                      {i.credits > 0 ? `+${i.credits}` : i.credits < 0 ? `−${Math.abs(i.credits)}` : '0'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PurchaseShell>
      )}
    </>
  );
}

const CSS = `
.gv-buy-panel.gv-ypu{max-width:620px;min-height:0}
.gv-buy-panel.gv-ypu .gv-buy-body{flex-direction:column}
.gv-ypu-body{padding:30px 28px 26px;display:flex;flex-direction:column;gap:14px;font-family:${OUTFIT};color:${INK}}
.gv-ypu-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.gv-ypu-list li{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;gap:4px 14px;padding:10px 2px;border-bottom:1px solid rgba(28,20,16,0.08)}
.gv-ypu-when{font-size:12.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums;white-space:nowrap}
.gv-ypu-what{min-width:0;font-size:14px;line-height:1.35;overflow-wrap:anywhere}
.gv-ypu-what b{font-weight:700;color:${INK}}
.gv-ypu-what span{display:block;font-size:12px;color:${INK_SOFT}}
.gv-ypu-credits{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:743px){.gv-ypu-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
`;
