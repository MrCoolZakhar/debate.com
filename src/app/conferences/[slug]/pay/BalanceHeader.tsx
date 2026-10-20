'use client';

// BalanceHeader — what this person owes, paid and has waiting (prompt 95).
// "To pay" is never a bare total: its lines are summed by type underneath.

import { FOREST, INK } from './payKit';
import { KIND_GROUP, KIND_ORDER, money, type PayOverview } from './payApi';

const OWED_STATES = new Set(['unpaid', 'rejected', 'refunded', 'started']);

/** The currency most of this person's items are in, owed items first. */
export function itemsCurrency(o: PayOverview): string | null {
  const count = new Map<string, number>();
  const owed = o.items.filter(it => OWED_STATES.has(it.state) && it.due_cents > 0);
  for (const it of owed.length > 0 ? owed : o.items) {
    const c = (it.currency || '').toUpperCase();
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [c, n] of count) if (best === null || n > (count.get(best) ?? 0)) best = c;
  return best;
}

export default function BalanceHeader({ o }: { o: PayOverview }) {
  // The items' own currency wins over the conference's (OAKMUN, 14 Oct 2026:
  // fees in INR on a conference still saved as GBP drew "£1,800" over "₹1,800"
  // lines). Invoices carry the currency the person is really charged in.
  const cur = itemsCurrency(o) ?? o.conference.currency;
  const t = o.totals;
  const byKind = new Map<string, number>();
  for (const it of o.items) {
    if (!OWED_STATES.has(it.state) || it.due_cents <= 0) continue;
    byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + it.due_cents);
  }
  const lines = KIND_ORDER.filter(k => (byKind.get(k) ?? 0) > 0)
    .concat([...byKind.keys()].filter(k => !KIND_ORDER.includes(k)));

  return (
    <section className="gv-pay-card" aria-label="Your balance">
      <div className="gv-pay-bal">
        <div style={{ minWidth: 180 }}>
          <span className="gv-pay-big" style={{ color: INK }}>{money(t.owed_cents, cur)}</span>
          <span className="gv-pay-big-cap">To pay</span>
          {lines.length > 0 && (
            <ul className="gv-pay-break">
              {lines.map(k => (
                <li key={k}><span>{KIND_GROUP[k] ?? 'Other'}</span><span>{money(byKind.get(k) ?? 0, cur)}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <span className="gv-pay-big" style={{ color: FOREST }}>{money(t.paid_cents, cur)}</span>
          <span className="gv-pay-big-cap">Paid</span>
        </div>
        {t.in_review_cents > 0 && (
          <div>
            <span className="gv-pay-big" style={{ color: 'var(--gv-accent)' }}>{money(t.in_review_cents, cur)}</span>
            <span className="gv-pay-big-cap">Waiting for review</span>
          </div>
        )}
      </div>
    </section>
  );
}
