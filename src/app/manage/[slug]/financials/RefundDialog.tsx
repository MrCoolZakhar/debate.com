'use client';

// RefundDialog — refunding whole items (1 Oct 2026). Reused by the Invoices
// page (prompt 93), so its props stay general.
//
// Two paths, decided per item by how it was paid:
//   card   -> refund-items (Stripe sends the money back; Stripe keeps its fee)
//   manual -> the organizer sends the money back themselves, then records it
//             here with record_manual_refund (method required, proof optional
//             but confirmed when missing).
// A mixed selection shows both sections, each with its own button. Whole items
// only: there is never an amount field. When every section has landed the
// dialog closes, toasts, and calls onDone; closing after only one of two
// sections landed calls onDone too, so the page behind re-reads.

import { useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { PurchaseShell } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import {
  cents, recordManualRefund, refundCardItems, uploadRefundProof, type RefundItem,
} from './financialsApi';
import { Row } from './dashboardKit';

type Method = 'bank_transfer' | 'cash' | 'other';
const METHODS: { v: Method; label: string }[] = [
  { v: 'bank_transfer', label: 'Bank transfer' },
  { v: 'cash', label: 'Cash' },
  { v: 'other', label: 'Other' },
];
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export default function RefundDialog({ items, currency, conferenceId, todoId, onDone, onClose }: {
  items: RefundItem[];
  currency: string;
  conferenceId: string;
  todoId?: string;
  /** Called once a refund has landed (the dialog has closed by then). */
  onDone: () => void;
  /** Closed with nothing refunded. */
  onClose: () => void;
}) {
  const card = items.filter(i => i.paid_by_card);
  const manual = items.filter(i => !i.paid_by_card);
  const cardTotal = card.reduce((s, i) => s + i.amount_cents, 0);
  const manualTotal = manual.reduce((s, i) => s + i.amount_cents, 0);

  const [cardDone, setCardDone] = useState(card.length === 0);
  const [manualDone, setManualDone] = useState(manual.length === 0);
  const landedRef = useRef(false);

  // Card section
  const [reason, setReason] = useState('');
  const [cardBusy, setCardBusy] = useState(false);
  const [cardErr, setCardErr] = useState('');
  const cardBusyRef = useRef(false);

  // Manual section
  const [method, setMethod] = useState<Method | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [confirmNoProof, setConfirmNoProof] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErr, setManualErr] = useState('');
  const manualBusyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const finishIfAll = (nextCard: boolean, nextManual: boolean, message: string) => {
    landedRef.current = true;
    if (nextCard && nextManual) {
      notifyOk(message, 'financials');
      onDone();
    }
  };

  const close = () => {
    if (landedRef.current) onDone();
    else onClose();
  };

  const runCard = async () => {
    if (cardBusyRef.current || cardDone) return;
    cardBusyRef.current = true;
    setCardBusy(true);
    setCardErr('');
    try {
      const res = await refundCardItems(card.map(i => i.invoice_id), reason, todoId);
      if (!res.ok) {
        setCardErr(res.error);
        if (res.partial) landedRef.current = true;
        return;
      }
      setCardDone(true);
      finishIfAll(true, manualDone, `${cents(cardTotal, currency)} is on its way back to their card`);
    } finally {
      cardBusyRef.current = false;
      setCardBusy(false);
    }
  };

  const runManual = async () => {
    if (manualBusyRef.current || manualDone) return;
    if (!method) { setManualErr('Choose how you sent the money back.'); return; }
    if (!file && !confirmNoProof) { setConfirmNoProof(true); setManualErr(''); return; }
    manualBusyRef.current = true;
    setManualBusy(true);
    setManualErr('');
    try {
      let path: string | null = null;
      if (file) {
        const up = await uploadRefundProof(conferenceId, file);
        if ('error' in up) { setManualErr(up.error); return; }
        path = up.path;
      }
      const res = await recordManualRefund(manual.map(i => i.invoice_id), method, path, note, todoId);
      if (!res.ok) { setManualErr(res.error); return; }
      setManualDone(true);
      finishIfAll(cardDone, true, `Refund of ${cents(manualTotal, currency)} recorded`);
    } finally {
      manualBusyRef.current = false;
      setManualBusy(false);
    }
  };

  const pickFile = (f: File | null) => {
    setManualErr('');
    if (!f) { setFile(null); return; }
    const ok = f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!ok) { setManualErr('Attach an image or a PDF.'); return; }
    if (f.size > MAX_PROOF_BYTES) { setManualErr('That file is over 10 MB. Attach a smaller one.'); return; }
    setFile(f);
    setConfirmNoProof(false);
  };

  return (
    <PurchaseShell tone="light" label="Refund" onClose={close} panelClass="gv-fd-mid" testId="financials-refund">
      <div className="gv-fd-pop">
        <h2 className="gv-fd-pop-title">Refund</h2>

        {card.length > 0 && (
          <section aria-label="Card refund" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {manual.length > 0 && <p className="gv-fd-sect">Paid by card</p>}
            <div className="gv-fd-rows">
              {card.map(i => <Row key={i.invoice_id} label={i.label} amount={cents(i.amount_cents, currency)} />)}
            </div>
            {cardDone ? (
              <p className="gv-st-ok" role="status">Sent back to their card</p>
            ) : (
              <>
                <p className="gv-fd-note">This sends {cents(cardTotal, currency)} back to their card through Stripe. Stripe keeps its fee</p>
                <div>
                  <label className="gv-fd-label" htmlFor="gv-fd-refund-reason">Reason (optional)</label>
                  <textarea id="gv-fd-refund-reason" className="gv-fd-text" style={{ minHeight: 72 }} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                {cardErr && <p className="gv-st-err" role="alert">{cardErr}</p>}
                <div>
                  <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void runCard(); }} disabled={cardBusy}>
                    {cardBusy ? 'Refunding' : `Refund ${cents(cardTotal, currency)}`}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {manual.length > 0 && (
          <section aria-label="Manual refund" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {card.length > 0 && <p className="gv-fd-sect">Paid manually</p>}
            <div className="gv-fd-rows">
              {manual.map(i => <Row key={i.invoice_id} label={i.label} amount={cents(i.amount_cents, currency)} />)}
            </div>
            {manualDone ? (
              <p className="gv-st-ok" role="status">Refund recorded</p>
            ) : (
              <>
                <p className="gv-fd-note">Send the money back yourself first, then record it here</p>
                <div>
                  <span className="gv-fd-label" id="gv-fd-refund-how">How did you send it?</span>
                  <div className="gv-fd-seg" role="radiogroup" aria-labelledby="gv-fd-refund-how">
                    {METHODS.map(x => (
                      <button key={x.v} type="button" role="radio" aria-checked={method === x.v} onClick={() => { setMethod(x.v); setManualErr(''); }}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="gv-fd-label">Proof of the refund (optional)</span>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => pickFile(e.target.files?.[0] ?? null)} />
                  {file ? (
                    <div className="flex items-center gap-2" style={{ fontSize: 14 }}>
                      <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{file.name}</span>
                      <button type="button" className="gv-st-link" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove the proof">
                        <X size={14} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px' }} /> Remove
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="gv-st-btn gv-st-outline" onClick={() => fileRef.current?.click()}>
                      <FileUp size={16} strokeWidth={2.2} /> Attach a file
                    </button>
                  )}
                </div>
                <div>
                  <label className="gv-fd-label" htmlFor="gv-fd-refund-note">Note (optional)</label>
                  <textarea id="gv-fd-refund-note" className="gv-fd-text" style={{ minHeight: 72 }} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
                </div>
                {confirmNoProof && !file && (
                  <p className="gv-fd-warn" role="alert">No proof attached. Record the refund anyway?</p>
                )}
                {manualErr && <p className="gv-st-err" role="alert">{manualErr}</p>}
                <div>
                  <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void runManual(); }} disabled={manualBusy}>
                    {manualBusy ? 'Recording' : confirmNoProof && !file ? 'Record without proof' : 'Record refund'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </PurchaseShell>
  );
}
