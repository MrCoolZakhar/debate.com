'use client';

// BulkBar — the actions for the people ticked on the Invoices page (prompt 93).
// Mark paid confirms what it covers first, then hands over to MarkPaidDialog;
// mark unpaid goes to MarkUnpaidDialog. Both are decided from what
// financials_people says each person has open or manually paid.

import { PurchaseShell } from '@/components/purchase/purchaseKit';

export function BulkBar({ count, canPaid, canUnpaid, onMarkPaid, onMarkUnpaid, onSelectPage, onClear, pageAllSelected }: {
  count: number;
  canPaid: boolean;
  canUnpaid: boolean;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onSelectPage: () => void;
  onClear: () => void;
  pageAllSelected: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="gv-inv-bulk" role="region" aria-label="Actions for the selected people">
      <span className="gv-inv-bulk-count">{count} selected</span>
      <button type="button" className="gv-st-btn gv-st-forest" onClick={onMarkPaid} disabled={!canPaid}
        title={canPaid ? undefined : 'Nobody selected owes anything that can be marked paid'}>
        Mark paid
      </button>
      <button type="button" className="gv-st-btn gv-st-outline" onClick={onMarkUnpaid} disabled={!canUnpaid}
        title={canUnpaid ? undefined : 'Nobody selected has a payment that was marked paid'}>
        Mark unpaid
      </button>
      {!pageAllSelected && <button type="button" className="gv-st-link" onClick={onSelectPage}>Select all on this page</button>}
      <button type="button" className="gv-st-link" onClick={onClear}>Clear</button>
    </div>
  );
}

/** The first step of a bulk Mark paid: what it covers and the total. */
export function ConfirmMarkPaid({ people, name, items, totalLabel, leftOut, onContinue, onClose }: {
  people: number;
  /** The one person's name when only one is selected. */
  name: string | null;
  items: number;
  totalLabel: string;
  /** People left out because nothing of theirs can be marked paid now. */
  leftOut: number;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <PurchaseShell tone="light" label="Mark as paid" onClose={onClose} panelClass="gv-fd-mid" testId="financials-bulk-paid">
      <div className="gv-fd-pop gv-st">
        <h2 className="gv-fd-pop-title">Mark as Paid?</h2>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>
          {people === 1 && name
            ? `This marks every invoice ${name} owes as paid`
            : `This marks every invoice these ${people} people owe as paid`}
        </p>
        <div className="gv-fd-rows">
          <div className="gv-fd-row">
            <span className="gv-fd-row-label">{items} item{items === 1 ? '' : 's'}</span>
            <span className="gv-fd-row-amt">{totalLabel}</span>
          </div>
        </div>
        {leftOut > 0 && (
          <p className="gv-fd-note">
            {leftOut} selected {leftOut === 1 ? 'person has' : 'people have'} nothing to mark paid right now (nothing owed, or a proof in review), so they are left out
          </p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" className="gv-st-btn gv-st-forest" onClick={onContinue} autoFocus>Continue</button>
          <button type="button" className="gv-st-btn gv-st-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </PurchaseShell>
  );
}
