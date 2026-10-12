'use client';

// MarkPaidDialog — recording money that came in outside Gavelling (prompt 93).
// Used by the Invoices page (bulk and per person) and the Applications page, so
// a manual payment is recorded the same way wherever it is marked: one
// mark_invoices_paid call for every item, which writes a payment line per item
// naming who did it and how, settles them, and emails each payer one itemized
// receipt. How the money came in is required; a note and a proof are not, but
// marking without a proof asks first.

import { useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from './dashboardKit';
import { markInvoicesPaid, proofFileProblem, uploadMarkedProof, type ManualMethod } from './financialsApi';

const METHODS: { v: ManualMethod; label: string }[] = [
  { v: 'bank_transfer', label: 'Bank transfer' },
  { v: 'cash', label: 'Cash' },
  { v: 'other', label: 'Other' },
];
const NOTE_MAX = 500;

export default function MarkPaidDialog({ conferenceId, invoiceIds, totalLabel, onDone, onClose, extraLine }: {
  conferenceId: string;
  invoiceIds: string[];
  /** The total already formatted in the right currency, e.g. "€240.00". */
  totalLabel: string;
  /** Called after the items were marked paid (the dialog has closed by then). */
  onDone: () => void;
  onClose: () => void;
  /** One more quiet line, e.g. how many items were left out because a proof is in review. */
  extraLine?: string;
}) {
  const [method, setMethod] = useState<ManualMethod | null>(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [askNoProof, setAskNoProof] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [methodErr, setMethodErr] = useState('');
  const [noteErr, setNoteErr] = useState('');
  const busyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const n = invoiceIds.length;

  const pick = (f: File | null) => {
    setErr('');
    if (!f) { setFile(null); return; }
    const problem = proofFileProblem(f);
    if (problem) { setErr(problem); return; }
    setFile(f);
    setAskNoProof(false);
  };

  const submit = async (anyway: boolean) => {
    if (busyRef.current) return;
    if (!method) { setMethodErr('Choose how the money came in.'); return; }
    if (!file && !anyway) { setAskNoProof(true); return; }
    busyRef.current = true;
    setBusy(true);
    setErr(''); setMethodErr(''); setNoteErr('');
    try {
      let path: string | null = null;
      if (file) {
        const up = await uploadMarkedProof(conferenceId, file);
        if ('error' in up) { setErr(up.error); return; }
        path = up.path;
      }
      const r = await markInvoicesPaid(invoiceIds, method, note, path);
      if (!r.ok) {
        if (r.field === 'method') setMethodErr(r.error);
        else if (r.field === 'note') setNoteErr(r.error);
        else setErr(r.error);
        setAskNoProof(false);
        return;
      }
      const marked = typeof r.data.marked === 'number' ? r.data.marked : n;
      notifyOk(`${marked} item${marked === 1 ? '' : 's'} marked paid. We emailed a receipt`, 'financials');
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
      <PurchaseShell tone="light" label="Mark as paid" onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-fd-mid" testId="financials-mark-paid">
        <div className="gv-fd-pop gv-st">
          <div>
            <h2 className="gv-fd-pop-title">Mark as Paid</h2>
            <p className="gv-fd-note" style={{ marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {n} item{n === 1 ? '' : 's'} · {totalLabel}
            </p>
            {extraLine && <p className="gv-fd-note" style={{ marginTop: 4 }}>{extraLine}</p>}
          </div>

          <div>
            <span className="gv-fd-label" id="gv-fd-mp-how">How did the money come in?</span>
            <div className="gv-fd-seg" role="radiogroup" aria-labelledby="gv-fd-mp-how" aria-invalid={!!methodErr}>
              {METHODS.map(m => (
                <button key={m.v} type="button" role="radio" aria-checked={method === m.v} disabled={busy} onClick={() => { setMethod(m.v); setMethodErr(''); }}>
                  {m.label}
                </button>
              ))}
            </div>
            {methodErr && <p className="gv-st-err" role="alert">{methodErr}</p>}
          </div>

          <div>
            <label className="gv-fd-label" htmlFor="gv-fd-mp-note">Note (optional)</label>
            <textarea id="gv-fd-mp-note" className="gv-fd-text max-sm:text-[16px]!" style={{ minHeight: 72 }} maxLength={NOTE_MAX} value={note} disabled={busy}
              onChange={e => { setNote(e.target.value); setNoteErr(''); }} aria-invalid={!!noteErr} />
            <p className="gv-fd-count">{note.length} / {NOTE_MAX}</p>
            {noteErr && <p className="gv-st-err" role="alert" style={{ marginTop: 2 }}>{noteErr}</p>}
          </div>

          <div>
            <span className="gv-fd-label">Proof (optional)</span>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => pick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{file.name}</span>
                <button type="button" className="gv-st-link" disabled={busy} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  <X size={14} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden /> Remove
                </button>
              </div>
            ) : (
              <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                <FileUp size={16} strokeWidth={2.2} aria-hidden /> Attach proof
              </button>
            )}
          </div>

          {err && <p className="gv-st-err" role="alert">{err}</p>}

          {askNoProof && !file ? (
            <div className="gv-fd-warn" role="alertdialog" aria-label="No proof attached">
              <p style={{ margin: '0 0 12px' }}>These have no proof uploaded. Mark them paid anyway?</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void submit(true); }} disabled={busy} autoFocus>
                  {busy ? 'Marking paid' : 'Mark paid anyway'}
                </button>
                <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setAskNoProof(false)} disabled={busy}>Go back</button>
              </div>
            </div>
          ) : (
            <div>
              <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void submit(false); }} disabled={busy}>
                {busy ? 'Marking paid' : `Mark ${n} item${n === 1 ? '' : 's'} paid`}
              </button>
            </div>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}
