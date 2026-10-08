'use client';

// MarkUnpaidDialog — taking back a manual "paid" (prompt 93). One confirm with
// an optional note, then ONE mark_invoices_unpaid call: a minus line per manual
// payment on those items, the items reopen, and the delegation pool and
// coverage undo themselves on the server. Card-paid items are refused by the
// server ("... Refund it instead"); callers leave them out first.

import { useRef, useState } from 'react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from './dashboardKit';
import { markInvoicesUnpaid } from './financialsApi';

const NOTE_MAX = 500;

export default function MarkUnpaidDialog({ invoiceIds, title, body, onDone, onClose }: {
  invoiceIds: string[];
  title: string;
  body?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const go = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const r = await markInvoicesUnpaid(invoiceIds, note);
      if (!r.ok) { setErr(r.error); return; }
      const items = typeof r.data.items === 'number' ? r.data.items : invoiceIds.length;
      notifyOk(`${items} item${items === 1 ? '' : 's'} marked unpaid`, 'financials');
      onDone();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label={title} onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-fd-mid" testId="financials-mark-unpaid">
        <div className="gv-fd-pop gv-st">
          <div>
            <h2 className="gv-fd-pop-title">{title}</h2>
            {body && <p className="gv-fd-note" style={{ marginTop: 6 }}>{body}</p>}
          </div>
          <div>
            <label className="gv-fd-label" htmlFor="gv-fd-mu-note">Why? Only your team sees this</label>
            <textarea id="gv-fd-mu-note" className="gv-fd-text" style={{ minHeight: 72 }} maxLength={NOTE_MAX} value={note} disabled={busy} onChange={e => setNote(e.target.value)} />
            <p className="gv-fd-count">{note.length} / {NOTE_MAX}</p>
          </div>
          {err && <p className="gv-st-err" role="alert">{err}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void go(); }} disabled={busy}>
              {busy ? 'Marking unpaid' : 'Mark unpaid'}
            </button>
            <button type="button" className="gv-st-btn gv-st-outline" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
        </div>
      </PurchaseShell>
    </>
  );
}
