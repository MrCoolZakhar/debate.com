'use client';

// PayDocuments — a payer's invoices and receipts on /pay (prompt 98). Only
// rendered once the conference has set up its invoice details.
//   DocumentsSection  the documents already made, each with Download, and
//                     "Download an invoice or receipt"
//   MakeDocPopup      tick payments (a receipt) or open items (an invoice), say
//                     who it is made out to the first time, then it is made
//                     (create_my_money_document) and the PDF downloads
//   DocViewPopup      one document on screen (?doc=<id>, or a row), with Download

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, ReceiptText } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import MoneyDocumentView from '@/components/money/MoneyDocumentView';
import { readMoneyDocument } from '@/components/money/readMoneyDocument';
import { DOWNLOAD_FAILED, downloadMoneyDocument } from '@/components/money/downloadMoneyDocument';
import { docShortDate, type MoneyDoc, type MoneyDocKind } from '@/components/money/moneyDocument';
import { friendlyError } from '@/lib/friendlyError';
import { DANGER, FOREST, INK, INK_SOFT, LINE } from './payKit';
import { money, shortDate, type PayItem, type PayPayment } from './payApi';
import { howWords } from './ReceiptsList';
import { createMyDocument, saveMyBilling, type Billing, type MyDocument } from './payDocsApi';

export const PAYDOCS_CSS = `
.gv-buy-panel.gv-pd-view{max-width:860px}
.gv-pd-input,.gv-pd-area{width:100%;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:inherit;font-size:16px;line-height:1.45}
.gv-pd-input{height:46px;padding:0 14px}
.gv-pd-area{min-height:72px;padding:11px 14px;resize:vertical}
.gv-pd-input:focus,.gv-pd-area:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.14)}
.gv-pd-label{display:block;margin:0 0 6px;font-size:13.5px;font-weight:700;color:${INK}}
.gv-pd-label small{font-weight:500;color:${INK_SOFT}}
.gv-pd-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
@media (max-width:480px){.gv-pd-two{grid-template-columns:minmax(0,1fr)}}
.gv-pd-check{display:flex;align-items:center;gap:12px;padding:12px 0;cursor:pointer}
.gv-pd-check + .gv-pd-check{border-top:1px solid ${LINE}}
.gv-pd-check input{width:20px;height:20px;accent-color:${FOREST};flex-shrink:0}
.gv-pd-seg{display:inline-grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;background:#FFFFFF}
.gv-pd-seg button{min-height:40px;padding:0 16px;border:none;border-radius:10px;background:none;font-family:inherit;font-size:14px;font-weight:700;color:${INK_SOFT};cursor:pointer}
.gv-pd-seg button[aria-checked="true"]{background:${FOREST};color:#EED98A}
.gv-pd-seg button:disabled{opacity:0.45;cursor:default}
.gv-pd-docs{display:flex;flex-direction:column;background:#FFFFFF;border-radius:16px;padding:4px 0;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -28px rgba(27,56,40,0.5)}
.gv-pd-doc{display:flex;align-items:center;gap:12px;padding:12px 16px}
.gv-pd-doc + .gv-pd-doc{border-top:1px solid ${LINE}}
.gv-pd-doc-open{flex:1;min-width:0;display:flex;align-items:center;gap:12px;background:none;border:none;padding:0;text-align:left;font-family:inherit;color:${INK};cursor:pointer}
.gv-pd-doc-open:focus{outline:none}
.gv-pd-doc-open:focus-visible{outline:2px solid ${FOREST};outline-offset:4px;border-radius:6px}
`;

// ── The list on the page ────────────────────────────────────────────────────

export function DocumentsSection({ docs, canMake, onMake, onOpen, onDownload, downloading, error }: {
  docs: MyDocument[];
  canMake: boolean;
  onMake: () => void;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  downloading: string | null;
  error?: string;
}) {
  if (!canMake && docs.length === 0) return null;
  return (
    <section aria-labelledby="gv-pay-docs">
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 10 }}>
        <p className="gv-pay-sect" id="gv-pay-docs" style={{ margin: 0 }}>Invoices and Receipts</p>
        {canMake && (
          <button type="button" className="gv-pay-btn gv-pay-outline" style={{ minHeight: 40 }} onClick={onMake}>
            <Download size={16} strokeWidth={2.4} aria-hidden /> Download an invoice or receipt
          </button>
        )}
      </div>
      {docs.length > 0 && (
        <div className="gv-pd-docs">
          {docs.map(d => {
            const receipt = d.kind === 'receipt';
            return (
              <div key={d.document_id} className="gv-pd-doc">
                <button type="button" className="gv-pd-doc-open" onClick={() => onOpen(d.document_id)} aria-label={`Open ${receipt ? 'receipt' : 'invoice'} ${d.number}`}>
                  <span style={{ display: 'inline-flex', color: FOREST }} aria-hidden>
                    {receipt ? <ReceiptText size={18} strokeWidth={2.2} /> : <FileText size={18} strokeWidth={2.2} />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{d.number}</span>
                    <span style={{ display: 'block', fontSize: 13, color: INK_SOFT }}>
                      {receipt ? 'Receipt' : 'Invoice'} · {docShortDate(d.created_at)} · {money(receipt ? d.paid_cents : d.balance_cents, d.currency)}
                    </span>
                  </span>
                </button>
                <button type="button" className="gv-pay-link" disabled={downloading === d.document_id} onClick={() => onDownload(d.document_id)}>
                  {downloading === d.document_id ? 'Making the PDF' : 'Download'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="gv-pay-err" role="alert" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  );
}

// ── Billing details ─────────────────────────────────────────────────────────

const EMPTY: Billing = { institution: '', address: '', phone: '', tax_number: '', attn: '' };

function billingSummary(b: Billing | null): string {
  if (!b) return '';
  return [b.institution, b.attn].map(x => (x ?? '').trim()).filter(Boolean).join(', ');
}

function BillingForm({ value, onChange, disabled }: { value: Billing; onChange: (b: Billing) => void; disabled: boolean }) {
  const f = (k: keyof Billing) => ({
    value: value[k] ?? '',
    disabled,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value }),
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="gv-pd-label" htmlFor="pd-inst">Institution <small>(school or organization, optional)</small></label>
        <input id="pd-inst" className="gv-pd-input" maxLength={200} autoComplete="organization" {...f('institution')} />
      </div>
      <div>
        <label className="gv-pd-label" htmlFor="pd-attn">Attn <small>(person, optional)</small></label>
        <input id="pd-attn" className="gv-pd-input" maxLength={200} autoComplete="name" {...f('attn')} />
      </div>
      <div>
        <label className="gv-pd-label" htmlFor="pd-addr">Address <small>(optional)</small></label>
        <textarea id="pd-addr" className="gv-pd-area" rows={2} maxLength={400} autoComplete="street-address" {...f('address')} />
      </div>
      <div className="gv-pd-two">
        <div>
          <label className="gv-pd-label" htmlFor="pd-phone">Phone <small>(optional)</small></label>
          <input id="pd-phone" className="gv-pd-input" maxLength={60} inputMode="tel" autoComplete="tel" {...f('phone')} />
        </div>
        <div>
          <label className="gv-pd-label" htmlFor="pd-tax">Tax number <small>(optional)</small></label>
          <input id="pd-tax" className="gv-pd-input" maxLength={80} {...f('tax_number')} />
        </div>
      </div>
    </div>
  );
}

// ── Make a document ─────────────────────────────────────────────────────────

export interface MakePreset { kind: MoneyDocKind; keys: string[] }

type Step = 'pick' | 'billing' | 'making' | 'done';

export function MakeDocPopup({ conferenceId, payments, openItems, billing, preset, onClose, onMade }: {
  conferenceId: string;
  payments: PayPayment[];
  /** Items with something still to pay: what an invoice can list. */
  openItems: PayItem[];
  billing: Billing | null;
  /** A receipt for one payment, from the receipt pop-up: skips the picking. */
  preset?: MakePreset | null;
  onClose: () => void;
  /** A document was made: the list re-reads. */
  onMade: () => void;
}) {
  const [kind, setKind] = useState<MoneyDocKind>(preset?.kind ?? (payments.length > 0 ? 'receipt' : 'invoice'));
  const [keys, setKeys] = useState<Set<string>>(() => new Set(preset?.keys ?? []));
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [step, setStep] = useState<Step>(preset ? (billing ? 'making' : 'billing') : 'pick');
  const [form, setForm] = useState<Billing>(() => ({ ...EMPTY, ...(billing ?? {}) }));
  const [err, setErr] = useState('');
  const [made, setMade] = useState<MoneyDoc | null>(null);
  const busyRef = useRef(false);
  const presetRan = useRef(false);

  const make = async (saveFirst: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true; setErr(''); setStep('making');
    if (saveFirst) {
      const s = await saveMyBilling(conferenceId, form);
      if (!s.ok) { busyRef.current = false; setErr(s.error); setStep('billing'); return; }
    }
    const r = kind === 'receipt'
      ? await createMyDocument(conferenceId, 'receipt', [...keys], null)
      : await createMyDocument(conferenceId, 'invoice', null, [...ids]);
    if (!r.ok) { busyRef.current = false; setErr(r.error); setStep(preset ? 'billing' : 'pick'); return; }
    onMade();
    try {
      const doc = await readMoneyDocument(r.data.document_id);
      setMade(doc);
      const ok = await downloadMoneyDocument(doc);
      if (!ok) setErr(DOWNLOAD_FAILED);
    } catch (e) {
      setErr(friendlyError(e, 'Your document was made but could not be opened. Find it in the list and download it there.'));
    }
    busyRef.current = false;
    setStep('done');
  };

  // A receipt from the receipt pop-up with billing details already saved: make it straight away.
  useEffect(() => {
    if (!preset || !billing || presetRan.current) return;
    presetRan.current = true;
    void Promise.resolve().then(() => make(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosenCount = kind === 'receipt' ? keys.size : ids.size;
  const word = kind === 'receipt' ? 'receipt' : 'invoice';
  const flip = (set: Set<string>, id: string, on: boolean) => { const n = new Set(set); if (on) n.add(id); else n.delete(id); return n; };

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label="Download an invoice or receipt" onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-pay-pop" testId="pay-make-doc">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {step === 'pick' && (
            <>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Download an Invoice or Receipt</h2>
              <div className="gv-pd-seg" role="radiogroup" aria-label="What to make">
                <button type="button" role="radio" aria-checked={kind === 'receipt'} disabled={payments.length === 0} onClick={() => setKind('receipt')}>Receipt</button>
                <button type="button" role="radio" aria-checked={kind === 'invoice'} disabled={openItems.length === 0} onClick={() => setKind('invoice')}>Invoice</button>
              </div>
              <p className="gv-pay-quiet">{kind === 'receipt' ? 'Tick the payments to put on the receipt' : 'Tick the items still to pay to put on the invoice'}</p>
              <div className="gv-pay-rows">
                {kind === 'receipt' ? payments.map(p => (
                  <label key={p.key} className="gv-pd-check">
                    <input type="checkbox" checked={keys.has(p.key)} onChange={e => setKeys(flip(keys, p.key, e.target.checked))} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{howWords(p.how)} · {shortDate(p.at)}</span>
                      <span style={{ display: 'block', fontSize: 13, color: INK_SOFT, overflowWrap: 'anywhere' }}>{p.items.map(i => i.label).join(', ')}</span>
                    </span>
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(p.total_cents, p.currency)}</b>
                  </label>
                )) : openItems.map(i => (
                  <label key={i.invoice_id} className="gv-pd-check">
                    <input type="checkbox" checked={ids.has(i.invoice_id)} onChange={e => setIds(flip(ids, i.invoice_id, e.target.checked))} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{i.label}</span>
                      {i.for_name && <span style={{ display: 'block', fontSize: 13, color: INK_SOFT, overflowWrap: 'anywhere' }}>for {i.for_name}</span>}
                    </span>
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(i.due_cents, i.currency)}</b>
                  </label>
                ))}
              </div>
              {billing && (
                <p className="gv-pay-quiet">
                  Made out to {billingSummary(billing) || 'you'}{' '}
                  <button type="button" className="gv-pay-link" onClick={() => setStep('billing')}>Change</button>
                </p>
              )}
              {err && <p className="gv-pay-err" role="alert">{err}</p>}
              <div>
                <button type="button" className="gv-pay-btn gv-pay-forest" disabled={chosenCount === 0}
                  onClick={() => { if (billing) void make(false); else setStep('billing'); }}>
                  <Download size={16} strokeWidth={2.4} aria-hidden /> Download {word}
                </button>
              </div>
            </>
          )}

          {step === 'billing' && (
            <>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Who Should It Be Made Out To?</h2>
              <p className="gv-pay-quiet">We keep these for your next {word} too</p>
              <BillingForm value={form} onChange={setForm} disabled={false} />
              {err && <p className="gv-pay-err" role="alert">{err}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" className="gv-pay-btn gv-pay-forest" onClick={() => { void make(true); }}>
                  <Download size={16} strokeWidth={2.4} aria-hidden /> Save and download
                </button>
                {!preset && <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => { setErr(''); setStep('pick'); }}>Back</button>}
              </div>
            </>
          )}

          {step === 'making' && (
            <p className="gv-pay-quiet" aria-live="polite" style={{ padding: '24px 0', fontSize: 15 }}>Making your {word}</p>
          )}

          {step === 'done' && (
            <>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {made ? (made.kind === 'receipt' ? 'Your Receipt' : 'Your Invoice') : 'Your Document'}
              </h2>
              {made && !err && <p className="gv-pay-quiet" aria-live="polite">{made.number} is downloading</p>}
              {err && <p className="gv-pay-err" role="alert" style={{ color: DANGER }}>{err}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                {made && <DownloadButton doc={made} label="Download again" outline />}
                <button type="button" className="gv-pay-btn gv-pay-forest" onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}

// ── One document ────────────────────────────────────────────────────────────

function DownloadButton({ doc, label, outline }: { doc: MoneyDoc; label: string; outline?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className={`gv-pay-btn ${outline ? 'gv-pay-outline' : 'gv-pay-forest'}`} disabled={busy}
        onClick={async () => {
          setBusy(true); setErr('');
          const ok = await downloadMoneyDocument(doc);
          setBusy(false);
          if (!ok) setErr(DOWNLOAD_FAILED);
        }}>
        <Download size={16} strokeWidth={2.4} aria-hidden /> {busy ? 'Making the PDF' : label}
      </button>
      {err && <span className="gv-pay-err" role="alert">{err}</span>}
    </span>
  );
}

export function DocViewPopup({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [doc, setDoc] = useState<MoneyDoc | null>(null);
  const [err, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    readMoneyDocument(documentId)
      .then(d => { if (alive) { setDoc(d); setErr(''); } })
      .catch(e => { if (alive) setErr(friendlyError(e, 'This document could not be read. Try again in a moment.')); });
    return () => { alive = false; };
  }, [documentId, attempt]);

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label={doc ? `${doc.kind === 'receipt' ? 'Receipt' : 'Invoice'} ${doc.number}` : 'Document'} onClose={onClose} panelClass="gv-pd-view" testId="pay-doc">
        <div style={{ padding: '24px 22px 26px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {!doc && !err && <p className="gv-pay-quiet" aria-live="polite">Opening the document</p>}
          {err && (
            <p className="gv-pay-err" role="alert">
              {err} <button type="button" className="gv-pay-link" onClick={() => { setErr(''); setAttempt(a => a + 1); }}>Try again</button>
            </p>
          )}
          {doc && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap" style={{ paddingRight: 44 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{doc.number}</h2>
                <DownloadButton doc={doc} label="Download PDF" />
              </div>
              <div style={{ background: '#E4DCCA', borderRadius: 16, padding: 'clamp(10px, 3vw, 28px)' }}>
                <MoneyDocumentView doc={doc} />
              </div>
            </>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}

/** Downloads a listed document: reads it, then makes the PDF. Resolves with the sentence to show, or null. */
export async function downloadById(id: string): Promise<string | null> {
  try {
    const doc = await readMoneyDocument(id);
    return (await downloadMoneyDocument(doc)) ? null : DOWNLOAD_FAILED;
  } catch (e) {
    return friendlyError(e, DOWNLOAD_FAILED);
  }
}
