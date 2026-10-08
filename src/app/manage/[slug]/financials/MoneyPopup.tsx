'use client';

// MoneyPopup — the breakdown behind the Money card (1 Oct 2026): what came in
// and how, what is still owed and for what, and what was never charged. Every
// figure is from financials_dashboard, so it always matches the card. Amounts
// go through the display currency like the rest of Financials.

import Link from 'next/link';
import { PurchaseShell } from '@/components/purchase/purchaseKit';
import { useFinancialsCurrency } from './shared';
import { KIND_ORDER, kindName, type ByKind, type FinancialsDashboard } from './financialsApi';
import { Row } from './dashboardKit';

export default function MoneyPopup({ d, slug, onClose }: { d: FinancialsDashboard; slug: string; onClose: () => void }) {
  const { disp } = useFinancialsCurrency();
  const m = (c: number) => disp((c || 0) / 100);
  const r = d.received;
  const o = d.outstanding;
  const nc = d.not_charged;

  const kindRows = (by: ByKind) => KIND_ORDER
    .filter(k => (by[k] ?? 0) !== 0)
    .map(k => <Row key={k} label={kindName(k)} amount={m(by[k] ?? 0)} />);

  const receivedKinds = kindRows(r.by_kind ?? {});
  const owedKinds = kindRows(o.by_kind ?? {});
  const notCharged = [
    nc.covered_people > 0 && <Row key="cov" label="Covered by their delegation" amount={`${nc.covered_people} ${nc.covered_people === 1 ? 'person' : 'people'}`} />,
    nc.waived_items > 0 && <Row key="waived" label="Waived" sub={`${nc.waived_items} item${nc.waived_items === 1 ? '' : 's'}`} amount={m(nc.waived_cents)} />,
    nc.aid_cents > 0 && <Row key="aid" label="Financial aid" sub={`For ${nc.aid_people} ${nc.aid_people === 1 ? 'person' : 'people'}`} amount={m(nc.aid_cents)} />,
  ].filter(Boolean);

  return (
    <PurchaseShell tone="light" label="Money breakdown" onClose={onClose} panelClass="gv-fd-mid" testId="financials-money">
      <div className="gv-fd-pop">
        <h2 className="gv-fd-pop-title">Where the Money Is</h2>

        <div>
          <p className="gv-fd-sect">Received</p>
          <div className="gv-fd-rows">
            {r.card_cents > 0 && <Row label="Card" sub={`${r.card_count} payment${r.card_count === 1 ? '' : 's'}`} amount={m(r.card_cents)} />}
            {r.manual_cents > 0 && <Row label="Manual and proofs" sub={`${r.manual_count} payment${r.manual_count === 1 ? '' : 's'}`} amount={m(r.manual_cents)} />}
            {r.refunded_cents > 0 && <Row label="Refunded or reversed" sub={`${r.refunded_count} refund${r.refunded_count === 1 ? '' : 's'}`} amount={m(r.refunded_cents)} minus />}
            <Row label="Received" amount={m(r.total_cents)} total />
          </div>
          {receivedKinds.length > 0 && (
            <>
              <p className="gv-fd-sect" style={{ marginTop: 14 }}>Received by type</p>
              <div className="gv-fd-rows">{receivedKinds}</div>
            </>
          )}
        </div>

        <div>
          <p className="gv-fd-sect">Outstanding</p>
          <div className="gv-fd-rows">
            {owedKinds}
            <Row label="Outstanding" sub={`${o.items} item${o.items === 1 ? '' : 's'} from ${o.people} ${o.people === 1 ? 'person' : 'people'}`} amount={m(o.total_cents)} total />
          </div>
          {o.unclaimed_items > 0 && (
            <p className="gv-fd-note" style={{ marginTop: 10 }}>
              Not claimed yet: {m(o.unclaimed_cents)} on {o.unclaimed_items} imported registration{o.unclaimed_items === 1 ? '' : 's'}. Not counted until they make an account
            </p>
          )}
          {d.in_review.count > 0 && (
            <p className="gv-fd-note" style={{ marginTop: 10 }}>
              {m(d.in_review.total_cents)} waiting for your review
            </p>
          )}
        </div>

        {notCharged.length > 0 && (
          <div>
            <p className="gv-fd-sect">Not charged</p>
            <div className="gv-fd-rows">{notCharged}</div>
          </div>
        )}

        <div className="gv-fd-links">
          <Link href={`/manage/${slug}/financials/invoices`} className="gv-st-link" onClick={onClose}>Open invoices</Link>
          <Link href={`/manage/${slug}/financials/history`} className="gv-st-link" onClick={onClose}>All transactions</Link>
        </div>
      </div>
    </PurchaseShell>
  );
}
