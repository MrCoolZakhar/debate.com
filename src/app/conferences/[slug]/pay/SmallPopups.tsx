'use client';

// The /pay page's small pop-ups (prompt 96):
//   RefundRequestPopup   ask for a refund of paid items (whole items, a reason required)
//   NotReceivedPopup     "I haven't received it" for a manual refund, an optional note
//   LockPopup            why an item in a started payment cannot be ticked

import { useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { DANGER, INK_SOFT } from './payKit';
import { money, type PayItem } from './payApi';
import { reportRefundNotReceived, requestRefund } from './manualApi';

const REASON_MAX = 500;

function Shell({ label, children, onClose, busyRef }: { label: string; children: React.ReactNode; onClose: () => void; busyRef?: React.RefObject<boolean> }) {
  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label={label} onClose={() => { if (!busyRef?.current) onClose(); }} panelClass="gv-pay-mid" testId="pay-small">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>{children}</div>
      </PurchaseShell>
    </>
  );
}

export function RefundRequestPopup({ items, preselect, onClose, onDone }: {
  /** Every paid item that can be refunded. */
  items: PayItem[];
  preselect: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(preselect ? [preselect] : []));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const send = async () => {
    if (busyRef.current || ticked.size === 0 || !reason.trim()) return;
    busyRef.current = true; setBusy(true); setErr('');
    const r = await requestRefund([...ticked], reason);
    busyRef.current = false; setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    notifyOk('Refund request sent to the organizers', 'pay');
    onDone();
  };

  return (
    <Shell label="Request a refund" onClose={onClose} busyRef={busyRef}>
      <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Request a Refund</h2>
      <div className="gv-pay-rows">
        {items.map(i => (
          <label key={i.invoice_id} className="gv-pay-row" style={{ alignItems: 'center', cursor: 'pointer' }}>
            <span className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <input type="checkbox" checked={ticked.has(i.invoice_id)} disabled={busy} style={{ width: 20, height: 20, accentColor: '#1B3828' }}
                onChange={e => { const n = new Set(ticked); if (e.target.checked) n.add(i.invoice_id); else n.delete(i.invoice_id); setTicked(n); }} />
              <span style={{ overflowWrap: 'anywhere' }}>{i.label}{i.for_name ? ` (for ${i.for_name})` : ''}</span>
            </span>
            <b>{money(i.paid_cents, i.currency)}</b>
          </label>
        ))}
      </div>
      <div>
        <label htmlFor="gv-refund-why" style={{ display: 'block', margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Why?</label>
        <textarea id="gv-refund-why" value={reason} maxLength={REASON_MAX} disabled={busy} onChange={e => setReason(e.target.value)}
          style={{ width: '100%', minHeight: 96, padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(27,56,40,0.28)', background: '#FFFFFF', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.5 }} />
        <p style={{ margin: '4px 0 0', fontSize: 12, color: INK_SOFT, textAlign: 'right' }}>{reason.length} / {REASON_MAX}</p>
      </div>
      {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: DANGER }}>{err}</p>}
      <div>
        <button type="button" className="gv-pay-btn gv-pay-forest" disabled={busy || ticked.size === 0 || !reason.trim()} onClick={() => { void send(); }}>
          {busy ? 'Sending' : 'Send request'}
        </button>
      </div>
    </Shell>
  );
}

export function NotReceivedPopup({ item, onClose, onDone }: { item: PayItem; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const send = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr('');
    const r = await reportRefundNotReceived(item.invoice_id, note);
    busyRef.current = false; setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    notifyOk('We told the organizers', 'pay');
    onDone();
  };

  return (
    <Shell label="I haven't received it" onClose={onClose} busyRef={busyRef}>
      <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Refund Not Received</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>We&apos;ll tell the organizers you haven&apos;t received the refund for {item.label}</p>
      <div>
        <label htmlFor="gv-notrec-note" style={{ display: 'block', margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Anything they should know? (optional)</label>
        <textarea id="gv-notrec-note" value={note} maxLength={REASON_MAX} disabled={busy} onChange={e => setNote(e.target.value)}
          style={{ width: '100%', minHeight: 80, padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(27,56,40,0.28)', background: '#FFFFFF', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.5 }} />
      </div>
      {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: DANGER }}>{err}</p>}
      <div><button type="button" className="gv-pay-btn gv-pay-forest" disabled={busy} onClick={() => { void send(); }}>{busy ? 'Sending' : 'Tell the organizers'}</button></div>
    </Shell>
  );
}

export function LockPopup({ mine, onGo, onClose }: { mine: boolean; onGo: () => void; onClose: () => void }) {
  return (
    <Shell label="In a started payment" onClose={onClose}>
      <span style={{ width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,217,138,0.45)', color: '#1B3828' }} aria-hidden>
        <Lock size={22} strokeWidth={2.2} />
      </span>
      <h2 style={{ margin: 0, paddingRight: 40, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>In a Started Payment</h2>
      <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55 }}>
        {mine
          ? 'This item is already in one of your started payments. Complete that one or cancel it to continue.'
          : 'Another leader of your delegation started a payment for this item. They can finish it or cancel it.'}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        {mine && <button type="button" className="gv-pay-btn gv-pay-forest" onClick={onGo}>Go to that payment</button>}
        <button type="button" className="gv-pay-btn gv-pay-outline" onClick={onClose}>Close</button>
      </div>
    </Shell>
  );
}
