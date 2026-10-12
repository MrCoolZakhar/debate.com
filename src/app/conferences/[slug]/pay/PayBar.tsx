'use client';

// PayBar — the ticked items and the one pay button, pinned to the bottom of
// the screen while anything is ticked (prompt 95). Select all / Clear sit
// beside it. Items of different currencies cannot be paid together.
// Below 640px the bar holds only the total and Pay: Select all, Clear and the
// extra action are hidden here (.gv-pay-bar-aux) and drawn by the page in the
// item list's header (PayListHead) with the same handlers.

import { CreditCard } from 'lucide-react';

export default function PayBar({ count, totalLabel, allTicked, onSelectAll, onClear, onPay, busy, notice, extra }: {
  count: number;
  totalLabel: string;
  allTicked: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onPay: () => void;
  busy: boolean;
  /** One quiet line, e.g. why an item could not be ticked. */
  notice?: string;
  /** A second action beside Pay (manual conferences: Upload proof). */
  extra?: React.ReactNode;
}) {
  return (
    <div className="gv-pay-bar" role="region" aria-label="Pay for the selected items">
      <span className="gv-pay-bar-sum" aria-live="polite">
        {count > 0 ? `${count} item${count === 1 ? '' : 's'} · ${totalLabel}` : 'Tick what you want to pay'}
        {notice && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8B2020' }}>{notice}</span>}
      </span>
      {!allTicked && <button type="button" className="gv-pay-link gv-pay-bar-aux" onClick={onSelectAll}>Select all</button>}
      {count > 0 && <button type="button" className="gv-pay-link gv-pay-bar-aux" onClick={onClear}>Clear</button>}
      {extra && <span className="gv-pay-bar-aux">{extra}</span>}
      <button type="button" className="gv-pay-btn gv-pay-forest" disabled={count === 0 || busy} onClick={onPay}>
        <CreditCard size={17} strokeWidth={2.2} aria-hidden /> Pay{count > 0 && <span className="gv-pay-bar-btn-total"> {totalLabel}</span>}
      </button>
    </div>
  );
}

/** The item list's header below 640px: the bar's Select all, Clear and extra action. */
export function PayListHead({ count, allTicked, onSelectAll, onClear, extra }: {
  count: number;
  allTicked: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  extra?: React.ReactNode;
}) {
  if (allTicked && count === 0 && !extra) return null;
  return (
    <div className="gv-pay-listhead">
      {!allTicked && <button type="button" className="gv-pay-link" onClick={onSelectAll}>Select all</button>}
      {count > 0 && <button type="button" className="gv-pay-link" onClick={onClear}>Clear</button>}
      {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
    </div>
  );
}
