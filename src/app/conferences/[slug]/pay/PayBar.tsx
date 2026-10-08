'use client';

// PayBar — the ticked items and the one pay button, pinned to the bottom of
// the screen while anything is ticked (prompt 95). Select all / Clear sit
// beside it. Items of different currencies cannot be paid together.

import { CreditCard } from 'lucide-react';

export default function PayBar({ count, totalLabel, allTicked, onSelectAll, onClear, onPay, busy, notice }: {
  count: number;
  totalLabel: string;
  allTicked: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onPay: () => void;
  busy: boolean;
  /** One quiet line, e.g. why an item could not be ticked. */
  notice?: string;
}) {
  return (
    <div className="gv-pay-bar" role="region" aria-label="Pay for the selected items">
      <span className="gv-pay-bar-sum" aria-live="polite">
        {count > 0 ? `${count} item${count === 1 ? '' : 's'} · ${totalLabel}` : 'Tick what you want to pay'}
        {notice && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8B2020' }}>{notice}</span>}
      </span>
      {!allTicked && <button type="button" className="gv-pay-link" onClick={onSelectAll}>Select all</button>}
      {count > 0 && <button type="button" className="gv-pay-link" onClick={onClear}>Clear</button>}
      <button type="button" className="gv-pay-btn gv-pay-forest" disabled={count === 0 || busy} onClick={onPay}>
        <CreditCard size={17} strokeWidth={2.2} aria-hidden /> {count > 0 ? `Pay ${totalLabel}` : 'Pay'}
      </button>
    </div>
  );
}
