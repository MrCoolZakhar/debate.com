'use client';

// DocumentEditor — one invoice or receipt (prompt 98), in the manner of the
// Email Builder: the words on the left, the document on the right, saved by
// itself a moment after typing stops ("Saving" / "Saved"). Only the words and
// the billed-to block can change (update_money_document); there is no amount
// field anywhere, because the lines and totals are a snapshot of the ledger.
// Download makes the PDF in the browser; the two sends email a link.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, Mail, Send } from 'lucide-react';
import { PurchaseShell } from '@/components/purchase/purchaseKit';
import MoneyDocumentView from '@/components/money/MoneyDocumentView';
import { BILLED_KEYS, EDITABLE_KEYS, docDate, docTitle, type BilledTo, type Editable, type MoneyDoc } from '@/components/money/moneyDocument';
import { readMoneyDocument } from '@/components/money/readMoneyDocument';
import { DOWNLOAD_FAILED, downloadMoneyDocument } from '@/components/money/downloadMoneyDocument';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { READ_ONLY_LINE } from '../dashboardKit';
import { Field } from './docsKit';
import { sendDocument, updateDocument } from './documentsApi';

const SAVE_AFTER_MS = 800;
const MAX = 1500;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function pick<T extends string>(o: Record<string, unknown> | null | undefined, keys: readonly T[]): Record<T, string> {
  const out = {} as Record<T, string>;
  for (const k of keys) out[k] = typeof o?.[k] === 'string' ? (o[k] as string) : '';
  return out;
}

export default function DocumentEditor({ documentId, payerName, readOnly, onClose, onChanged }: {
  documentId: string;
  /** The person's name from the list; the billed-to name is used when absent. */
  payerName?: string | null;
  readOnly: boolean;
  onClose: () => void;
  /** Something about the document changed (sent): let the lists re-read. */
  onChanged?: () => void;
}) {
  const [doc, setDoc] = useState<MoneyDoc | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [ed, setEd] = useState<Record<(typeof EDITABLE_KEYS)[number], string> | null>(null);
  const [billed, setBilled] = useState<Record<(typeof BILLED_KEYS)[number], string> | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const [saveErr, setSaveErr] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [dlBusy, setDlBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState<'me' | 'payer' | null>(null);
  const [actionErr, setActionErr] = useState('');
  const [sentAt, setSentAt] = useState<string | null>(null);

  // Autosave: one write in flight; the newest words go out when it lands.
  const latest = useRef<{ ed: Editable; billed: BilledTo } | null>(null);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef(false);

  useEffect(() => {
    let alive = true;
    readMoneyDocument(documentId)
      .then(d => {
        if (!alive) return;
        setDoc(d);
        setEd(pick(d.editable as Record<string, unknown>, EDITABLE_KEYS));
        setBilled(pick(d.billed_to as Record<string, unknown>, BILLED_KEYS));
        setSentAt(d.sent_to_payer_at);
        setLoadErr('');
      })
      .catch(e => { if (alive) setLoadErr(friendlyError(e, 'This document could not be read. Try again in a moment.')); });
    return () => { alive = false; };
  }, [documentId, attempt]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inFlight.current || !dirty.current || !latest.current || readOnly) return;
    const sending = latest.current;
    dirty.current = false;
    inFlight.current = true;
    setSave('saving');
    const r = await updateDocument(documentId, sending.ed, sending.billed);
    inFlight.current = false;
    if (!r.ok) {
      dirty.current = true;
      setSave('error');
      if (r.field) setFieldErr({ [r.field]: r.error }); else setSaveErr(r.error);
      return;
    }
    setSaveErr('');
    setFieldErr({});
    if (dirty.current) { void flush(); return; }
    setSave('saved');
  }, [documentId, readOnly]);

  // Anything still unsaved goes out when the editor closes or the tab is hidden.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  if (!doc || !ed || !billed) {
    return (
      <PurchaseShell tone="light" label="Document" onClose={onClose} panelClass="gv-fd-mid" testId="money-document">
        <div className="gv-fd-pop">
          {loadErr ? (
            <p className="gv-st-err" role="alert">
              {loadErr} <button type="button" className="gv-st-link" onClick={() => { setLoadErr(''); setAttempt(a => a + 1); }}>Try again</button>
            </p>
          ) : <p className="gv-st-quiet" aria-live="polite">Opening the document</p>}
        </div>
      </PurchaseShell>
    );
  }

  const change = (part: 'ed' | 'billed', key: string, value: string) => {
    const nextEd = part === 'ed' ? { ...ed, [key]: value } : ed;
    const nextBilled = part === 'billed' ? { ...billed, [key]: value } : billed;
    if (part === 'ed') setEd(nextEd); else setBilled(nextBilled);
    if (fieldErr[key]) setFieldErr(prev => { const n = { ...prev }; delete n[key]; return n; });
    latest.current = { ed: nextEd, billed: nextBilled };
    dirty.current = true;
    setSave('idle');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_AFTER_MS);
  };

  const merged: MoneyDoc = { ...doc, editable: { ...doc.editable, ...ed }, billed_to: { ...doc.billed_to, ...billed } };
  const receipt = doc.kind === 'receipt';
  const who = (payerName || doc.billed_to.attn || '').trim() || 'the payer';
  const noAccount = !doc.payer_user_id;

  const download = async () => {
    if (dlBusy) return;
    setDlBusy(true); setActionErr('');
    const ok = await downloadMoneyDocument(merged);
    setDlBusy(false);
    if (!ok) setActionErr(DOWNLOAD_FAILED);
  };

  const send = async (to: 'me' | 'payer') => {
    if (sendRef.current || readOnly) return;
    sendRef.current = true; setSendBusy(to); setActionErr('');
    await flush();
    const r = await sendDocument(documentId, to);
    sendRef.current = false; setSendBusy(null);
    if (!r.ok) { setActionErr(r.error); return; }
    if (to === 'payer') {
      setSentAt(new Date().toISOString());
      notifyOk(`Sent to ${who}`, 'financials');
      onChanged?.();
    } else notifyOk('A preview is on its way to your inbox', 'financials');
  };

  const area = (key: (typeof EDITABLE_KEYS)[number], label: React.ReactNode, hint?: string, rows = 3) => (
    <Field id={`md-ed-${key}`} label={label} hint={hint} error={fieldErr[key]}>
      <textarea id={`md-ed-${key}`} className="gv-md-area" rows={rows} maxLength={MAX} value={ed[key]}
        aria-invalid={fieldErr[key] ? true : undefined}
        onChange={e => change('ed', key, e.target.value)} />
    </Field>
  );
  const input = (part: 'ed' | 'billed', key: string, label: React.ReactNode, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <Field id={`md-${part}-${key}`} label={label} error={fieldErr[key]}>
      <input id={`md-${part}-${key}`} className="gv-md-input" maxLength={part === 'ed' ? 200 : 300}
        value={part === 'ed' ? ed[key as (typeof EDITABLE_KEYS)[number]] : billed[key as (typeof BILLED_KEYS)[number]]}
        aria-invalid={fieldErr[key] ? true : undefined}
        onChange={e => change(part, key, e.target.value)} {...extra} />
    </Field>
  );

  return (
    <PurchaseShell tone="light" label={`${docTitle(merged)} ${doc.number}`} onClose={() => { void flush(); onClose(); }} panelClass="gv-md-studio" testId="money-document">
      <div className="gv-md-left">
        <div>
          <p className="gv-md-sect" style={{ marginBottom: 6 }}>{receipt ? 'Receipt' : 'Invoice'} · {doc.number}</p>
          <h2 className="gv-md-title">Edit the Words</h2>
          <p className="gv-md-sub">The items and amounts come from your records and cannot be changed</p>
          {readOnly && <p className="gv-md-sub">{READ_ONLY_LINE}</p>}
        </div>

        <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="gv-md-group">
            {input('ed', 'title', 'Title')}
            {area('intro', <>Intro <small>(optional)</small></>, 'A line above the items', 2)}
          </div>
          <div className="gv-md-group">
            <p className="gv-md-sect">Billed To</p>
            {input('billed', 'institution', <>Institution <small>(school or organization)</small></>, { autoComplete: 'organization' })}
            {input('billed', 'attn', <>Attn <small>(person)</small></>)}
            <Field id="md-billed-address" label="Address" error={fieldErr.address}>
              <textarea id="md-billed-address" className="gv-md-area" rows={2} maxLength={400} value={billed.address}
                onChange={e => change('billed', 'address', e.target.value)} />
            </Field>
            <div className="gv-md-two">
              {input('billed', 'phone', 'Phone', { inputMode: 'tel' })}
              {input('billed', 'tax_number', 'Tax number')}
            </div>
            {input('billed', 'email', 'Email', { inputMode: 'email' })}
          </div>
          <div className="gv-md-group">
            {receipt
              ? area('receipt_paragraph', 'Receipt paragraph', 'Confirms what was received, from whom and how')
              : area('receipt_paragraph', <>Payment paragraph <small>(optional)</small></>, 'For example, how to pay and by when')}
            {input('ed', 'tax_line', <>Tax line <small>(optional)</small></>)}
            <p className="gv-md-hint" style={{ marginTop: -6 }}>Shown as the Tax row of the totals, for example VAT 0%. Left empty, it reads None</p>
            {area('tax_note', <>Tax note <small>(optional)</small></>, undefined, 2)}
            {area('notes', <>Notes <small>(optional)</small></>, undefined, 2)}
            {area('footer', <>Footer <small>(optional)</small></>, undefined, 2)}
          </div>
        </fieldset>

        <div className="gv-md-foot">
          <div className="gv-md-foot-row" style={{ justifyContent: 'space-between' }}>
            <span className="gv-md-save" aria-live="polite">
              {save === 'saving' && <><Loader2 size={14} strokeWidth={2.4} className="animate-spin" aria-hidden /> Saving</>}
              {save === 'saved' && <><CheckCircle2 size={14} strokeWidth={2.4} aria-hidden style={{ color: '#2A5A3C' }} /> Saved</>}
              {save === 'error' && !Object.keys(fieldErr).length && <span style={{ color: '#8B2020' }}>Not saved yet</span>}
            </span>
            {sentAt && <span className="gv-md-save">Sent on {docDate(sentAt)}</span>}
          </div>
          {saveErr && save === 'error' && (
            <p className="gv-md-err" role="alert">{saveErr} <button type="button" className="gv-st-link" onClick={() => { dirty.current = true; void flush(); }}>Try again</button></p>
          )}
          <div className="gv-md-foot-row">
            <button type="button" className="gv-st-btn gv-st-forest" disabled={dlBusy} onClick={() => { void download(); }}>
              <Download size={16} strokeWidth={2.4} aria-hidden /> {dlBusy ? 'Making the PDF' : 'Download PDF'}
            </button>
            <button type="button" className="gv-st-btn gv-st-outline" disabled={readOnly || sendBusy !== null} onClick={() => { void send('me'); }}>
              <Mail size={16} strokeWidth={2.4} aria-hidden /> {sendBusy === 'me' ? 'Sending' : 'Send a preview to me'}
            </button>
          </div>
          <div className="gv-md-foot-row">
            <button type="button" className="gv-st-btn gv-st-outline" disabled={readOnly || noAccount || sendBusy !== null}
              title={noAccount ? `${who} has no Gavelling account yet, so there is nowhere to send it` : undefined}
              onClick={() => { void send('payer'); }}>
              <Send size={16} strokeWidth={2.4} aria-hidden /> {sendBusy === 'payer' ? 'Sending' : sentAt ? `Send again to ${who}` : `Send to ${who}`}
            </button>
          </div>
          {noAccount && <p className="gv-md-hint">{who} has no Gavelling account yet, so there is nowhere to send it. Download the PDF and send it yourself</p>}
          {actionErr && <p className="gv-md-err" role="alert">{actionErr}</p>}
        </div>
      </div>
      <div className="gv-md-right" aria-label="Preview">
        <div className="gv-md-paper">
          <MoneyDocumentView doc={merged} />
        </div>
      </div>
    </PurchaseShell>
  );
}
