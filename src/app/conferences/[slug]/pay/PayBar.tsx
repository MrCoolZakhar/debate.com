'use client';

// PayBar — the ticked items and the one pay button, pinned to the bottom of
// the screen while anything is ticked (prompt 95). Select all / Clear sit
// beside it. Items of different currencies cannot be paid together.
// Below 640px the bar holds only the total and Pay: Select all, Clear and the
// extra action are hidden here (.gv-pay-bar-aux) and drawn by the page in the
// item list's header (PayListHead) with the same handlers.
// Discount codes (prompt 107): "Have a discount code?" sits under Pay (under
// the total on phones) when the conference offers codes; an applied code shows
// as a chip with the old total struck through and the new one.

import { CreditCard, X } from 'lucide-react';
import LockedPayButton from '../participant/PaymentsLocked';

export interface BarDiscount { code: string; beforeLabel: string; afterLabel: string; onRemove: () => void }

export default function PayBar({ count, totalLabel, allTicked, onSelectAll, onClear, onPay, busy, notice, extra, discount, onHaveCode, lockedSlug }: {
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
  /** An applied checkout code; totalLabel is then the new total. */
  discount?: BarDiscount | null;
  /** Opens "Discount Code"; omitted when the conference offers no codes. */
  onHaveCode?: () => void;
  /** Payments are not set up yet (prompt 108): Pay is drawn locked, with a note
   *  and a way to ask the organizers. The conference slug for that link. */
  lockedSlug?: string;
}) {
  const codeLink = onHaveCode && count > 0 && !discount
    ? (cls: string) => <button type="button" className={`gv-pay-link gv-pay-code-link ${cls}`} onClick={onHaveCode}>Have a discount code?</button>
    : null;
  return (
    <div className="gv-pay-bar" role="region" aria-label="Pay for the selected items">
      <span className="gv-pay-bar-sum" aria-live="polite">
        {count === 0 ? 'Tick what you want to pay' : discount ? (
          <>
            {count} item{count === 1 ? '' : 's'} · <s style={{ fontWeight: 600, color: '#5A5046' }}>{discount.beforeLabel}</s> {discount.afterLabel}
          </>
        ) : `${count} item${count === 1 ? '' : 's'} · ${totalLabel}`}
        {discount && (
          <span className="gv-pay-code-chip">
            {discount.code}
            <button type="button" aria-label={`Remove the code ${discount.code}`} onClick={discount.onRemove}><X size={13} strokeWidth={2.6} aria-hidden /></button>
          </span>
        )}
        {codeLink?.('gv-pay-code-phone')}
        {notice && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8B2020' }}>{notice}</span>}
      </span>
      {!allTicked && <button type="button" className="gv-pay-link gv-pay-bar-aux" onClick={onSelectAll}>Select all</button>}
      {count > 0 && <button type="button" className="gv-pay-link gv-pay-bar-aux" onClick={onClear}>Clear</button>}
      {extra && <span className="gv-pay-bar-aux">{extra}</span>}
      <span className="gv-pay-bar-pay">
        {lockedSlug ? (
          <LockedPayButton slug={lockedSlug} className="gv-pay-btn gv-pay-forest"
            label={<>Pay{count > 0 && <span className="gv-pay-bar-btn-total"> {totalLabel}</span>}</>} />
        ) : (
          <button type="button" className="gv-pay-btn gv-pay-forest" disabled={count === 0 || busy} onClick={onPay}>
            <CreditCard size={17} strokeWidth={2.2} aria-hidden /> Pay{count > 0 && <span className="gv-pay-bar-btn-total"> {totalLabel}</span>}
          </button>
        )}
        {codeLink?.('gv-pay-code-desk')}
      </span>
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
