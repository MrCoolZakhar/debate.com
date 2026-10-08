'use client';

// The Registration fee, Add-ons and Vouchers pop-ups (prompt 94). Each holds
// the section it always was (ApplicationFeeSection, AddonsSection,
// VouchersSection: their writes and validation unchanged), drawn bare inside
// the Store's pop-up shell. Add-ons also show what each one sold, from
// financials_addon_stats. Closing re-reads the dashboard (the page does that).

import { useEffect, useState } from 'react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { STORE_CSS } from '../../store/storeKit';
import { DASH_CSS, READ_ONLY_LINE } from '../dashboardKit';
import { cents } from '../financialsApi';
import { useFinancialsCurrency } from '../shared';
import ApplicationFeeSection from '../ApplicationFeeSection';
import AddonsSection from '../AddonsSection';
import VouchersSection from '../VouchersSection';

function Shell({ title, line, readOnly, onClose, children }: {
  title: string; line: string; readOnly: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label={title} onClose={onClose} panelClass="gv-fd-wide" testId="financials-settings-popup">
        <div className="gv-fd-pop gv-st">
          <div style={{ paddingRight: 40 }}>
            <h2 className="gv-fd-pop-title" style={{ paddingRight: 0 }}>{title}</h2>
            <p className="gv-fd-note" style={{ marginTop: 6, fontSize: 15 }}>{line}</p>
          </div>
          {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
          {children}
        </div>
      </PurchaseShell>
    </>
  );
}

export function FeePopup({ conference, readOnly, onClose }: { conference: Conference; readOnly: boolean; onClose: () => void }) {
  return (
    <Shell title="Registration Fee" line="A fee charged once per delegation, or once per delegate, on top of the conference ticket" readOnly={readOnly} onClose={onClose}>
      <ApplicationFeeSection conference={conference} bare />
    </Shell>
  );
}

interface AddonStat { addon_id: string; label: string; active: boolean; bought: number; waiting: number; revenue_cents: number; currency: string }

export function AddonsPopup({ conference, readOnly, onClose }: { conference: Conference; readOnly: boolean; onClose: () => void }) {
  const [stats, setStats] = useState<Map<string, AddonStat>>(() => new Map());
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await getFreshAuthedClient();
      if (!c) return;
      const { data, error } = await c.rpc('financials_addon_stats', { p_conference_id: conference.id });
      const a = (data ?? null) as { ok?: boolean; addons?: AddonStat[] } | null;
      if (!alive || error || !a?.ok || !Array.isArray(a.addons)) return;
      setStats(new Map(a.addons.map(x => [x.addon_id, x])));
    })();
    return () => { alive = false; };
  }, [conference.id]);

  return (
    <Shell title="Add-ons" line="Extras payers can add, like a gala ticket or a T-shirt" readOnly={readOnly} onClose={onClose}>
      <AddonsSection
        conference={conference}
        bare
        renderStats={(id) => {
          const s = stats.get(id);
          if (!s) return null;
          return (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#5A5046', fontVariantNumeric: 'tabular-nums' }}>
              {s.bought} bought · {s.waiting} not paid yet · {cents(s.revenue_cents, s.currency)}
            </p>
          );
        }}
      />
    </Shell>
  );
}

export function VouchersPopup({ conference, readOnly, onClose }: { conference: Conference; readOnly: boolean; onClose: () => void }) {
  const { displayCurrency } = useFinancialsCurrency();
  return (
    <Shell title="Vouchers" line="Discount codes for partner schools or early supporters, and how often each was used" readOnly={readOnly} onClose={onClose}>
      <VouchersSection conference={conference} displayCurrency={displayCurrency} bare />
    </Shell>
  );
}
