'use client';

// BalanceHeader — what this person owes, paid and has waiting (prompt 95).
// "To pay" is never a bare total: its lines are summed by type underneath.

import { FOREST, INK } from './payKit';
import { KIND_GROUP, KIND_ORDER, money, type PayOverview } from './payApi';

const OWED_STATES = new Set(['unpaid', 'rejected', 'refunded', 'started']);

export default function BalanceHeader({ o }: { o: PayOverview }) {
  const cur = o.conference.currency;
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
            <span className="gv-pay-big" style={{ color: '#B6871F' }}>{money(t.in_review_cents, cur)}</span>
            <span className="gv-pay-big-cap">Waiting for review</span>
          </div>
        )}
      </div>
    </section>
  );
}
