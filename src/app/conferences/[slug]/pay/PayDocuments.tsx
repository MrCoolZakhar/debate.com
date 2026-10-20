'use client';

// PayDocuments — a payer's invoices, receipts and refund receipts on /pay
// (prompt 98; refund receipts and the download states since prompt 109). Only
// rendered once the conference has set up its invoice details.
//   DocumentsSection  the documents already made, each with Download, and
//                     "Download an invoice or receipt"
//   MakeDocPopup      tick payments (a receipt), open items (an invoice) or
//                     refunds (a refund receipt), then ALWAYS "Who Should It Be
//                     Made Out To?" (prefilled with the saved details, else the
//                     delegation and the person), then it is made
//                     (create_my_money_document) and the PDF downloads
//   DocViewPopup      one document on screen (?doc=<id>, or a row), with Download
// Every download says what is happening: "Making the PDF" with cycling dots,
// then "Downloaded" with a check for a few seconds (DownloadStatus).

import { useEffect, useRef, useState } from 'react';
import { Check, Download, FileText, ReceiptText, Undo2 } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import MoneyDocumentView from '@/components/money/MoneyDocumentView';
import { readMoneyDocument } from '@/components/money/readMoneyDocument';
import { DOWNLOAD_FAILED, downloadMoneyDocument } from '@/components/money/downloadMoneyDocument';
import { docShortDate, kindWord, type MoneyDoc, type MoneyDocKind } from '@/components/money/moneyDocument';
import CyclingDots from '@/components/CyclingDots';
import { friendlyError } from '@/lib/friendlyError';
import { DANGER, FOREST, INK, INK_SOFT, LINE } from './payKit';
import { money, shortDate, type PayItem, type PayPayment, type PayRefund } from './payApi';
import { howWords } from './ReceiptsList';
import { createMyDocument, saveMyBilling, type Billing, type BillingSuggestion, type MyDocument } from './payDocsApi';

export const PAYDOCS_CSS = `
.gv-buy-panel.gv-pd-view{max-width:860px}
.gv-pd-input,.gv-pd-area{width:100%;border-radius:12px;border:1.5px solid color-mix(in srgb, var(--gv-main) 28%, transparent);background:#FFFFFF;color:${INK};font-family:inherit;font-size:16px;line-height:1.45}
.gv-pd-input{height:46px;padding:0 14px}
.gv-pd-area{min-height:72px;padding:11px 14px;resize:vertical}
.gv-pd-input:focus,.gv-pd-area:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px color-mix(in srgb, var(--gv-main) 14%, transparent)}
.gv-pd-label{display:block;margin:0 0 6px;font-size:13.5px;font-weight:700;color:${INK}}
.gv-pd-label small{font-weight:500;color:${INK_SOFT}}
.gv-pd-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
@media (max-width:480px){.gv-pd-two{grid-template-columns:minmax(0,1fr)}}
.gv-pd-check{display:flex;align-items:center;gap:12px;padding:12px 0;cursor:pointer}
.gv-pd-check + .gv-pd-check{border-top:1px solid ${LINE}}
.gv-pd-check input{width:20px;height:20px;accent-color:${FOREST};flex-shrink:0}
.gv-pd-seg{display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;max-width:100%;padding:4px;border-radius:14px;background:#FFFFFF}
.gv-pd-seg button{min-height:40px;padding:0 14px;border:none;border-radius:10px;background:none;font-family:inherit;font-size:14px;font-weight:700;color:${INK_SOFT};cursor:pointer}
.gv-pd-seg button[aria-checked="true"]{background:${FOREST};color:var(--gv-accent-light)}
.gv-pd-seg button:disabled{opacity:0.45;cursor:default}
.gv-pd-docs{display:flex;flex-direction:column;background:#FFFFFF;border-radius:16px;padding:4px 0;box-shadow:0 1px 0 color-mix(in srgb, var(--gv-main) 8%, transparent),0 14px 30px -28px color-mix(in srgb, var(--gv-main) 50%, transparent)}
.gv-pd-doc{display:flex;align-items:center;gap:12px;padding:12px 16px}
.gv-pd-doc + .gv-pd-doc{border-top:1px solid ${LINE}}
.gv-pd-doc-open{flex:1;min-width:0;display:flex;align-items:center;gap:12px;background:none;border:none;padding:0;text-align:left;font-family:inherit;color:${INK};cursor:pointer}
.gv-pd-doc-open:focus{outline:none}
.gv-pd-doc-open:focus-visible{outline:2px solid ${FOREST};outline-offset:4px;border-radius:6px}
@media (max-width:420px){.gv-pd-seg{grid-auto-flow:row}}
.gv-pd-doc-icon{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:color-mix(in srgb, var(--gv-accent-light) 40%, transparent);color:${FOREST};flex-shrink:0}
.gv-pd-doc-text{display:flex;flex-direction:column;min-width:0}
.gv-pd-doc-dl{flex-shrink:0;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.gv-pd-ok{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#2F7A4D}
`;

/** "Making the PDF..." while it is made, then "Downloaded" with a check (prompt 109). */
export type DownloadPhase = 'idle' | 'making' | 'done';

export function DownloadStatus({ phase, idle, making = 'Making the PDF', done = 'Downloaded' }: {
  phase: DownloadPhase; idle: React.ReactNode; making?: string; done?: string;
}) {
  if (phase === 'making') return <>{making}<CyclingDots /></>;
  if (phase === 'done') return <span className="gv-pd-ok"><Check size={16} strokeWidth={2.8} aria-hidden /> {done}</span>;
  return <>{idle}</>;
}

const DONE_FOR_MS = 3500;

/** The phase of one download: idle, making, then done for a few seconds. */
function useDownloadPhase() {
  const [phase, setPhase] = useState<DownloadPhase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const run = async (fn: () => Promise<boolean>): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    setPhase('making');
    const ok = await fn();
    if (!ok) { setPhase('idle'); return false; }
    setPhase('done');
    timer.current = setTimeout(() => setPhase('idle'), DONE_FOR_MS);
    return true;
  };
  return { phase, run };
}

/** The icon of a document kind. */
function KindIcon({ kind, size = 18 }: { kind: MoneyDocKind; size?: number }) {
  if (kind === 'refund') return <Undo2 size={size} strokeWidth={2.2} />;
  if (kind === 'receipt') return <ReceiptText size={size} strokeWidth={2.2} />;
  return <FileText size={size} strokeWidth={2.2} />;
}

/** Every refund of the payer's payments, newest first (prompt 109). */
export function allRefunds(payments: PayPayment[]): (PayRefund & { currency: string })[] {
  return payments.flatMap(p => (p.refunds ?? []).map(r => ({ ...r, currency: p.currency })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** "Delegate Ticket · $95.01 refunded on 12 Oct 2026". */
export function refundLine(r: PayRefund, currency: string): string {
  return `${r.label} · ${money(r.amount_cents, currency)} refunded on ${shortDate(r.at)}`;
}

// ── The list on the page ────────────────────────────────────────────────────

export function DocumentsSection({ docs, canMake, onMake, onOpen, onDownload, downloading, downloaded, error }: {
  docs: MyDocument[];
  canMake: boolean;
  onMake: () => void;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  /** The document being made into a PDF now, and the one that just finished. */
  downloading: string | null;
  downloaded: string | null;
  error?: string;
}) {
  if (!canMake && docs.length === 0) return null;
  return (
    <section aria-labelledby="gv-pay-docs">
      {/* Mounted with the section itself: the rows draw from these classes (prompt 109). */}
      <style>{PAYDOCS_CSS}</style>
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
            const word = kindWord(d.kind);
            const amount = d.kind === 'invoice' ? d.balance_cents : d.paid_cents;
            const phase: DownloadPhase = downloading === d.document_id ? 'making' : downloaded === d.document_id ? 'done' : 'idle';
            return (
              <div key={d.document_id} className="gv-pd-doc">
                <button type="button" className="gv-pd-doc-open" onClick={() => onOpen(d.document_id)} aria-label={`Open ${word.toLowerCase()} ${d.number}`}>
                  <span className="gv-pd-doc-icon" aria-hidden><KindIcon kind={d.kind} /></span>
                  <span className="gv-pd-doc-text">
                    <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{d.number}</span>
                    <span style={{ fontSize: 13, color: INK_SOFT }}>{word} · {docShortDate(d.created_at)} · {money(amount, d.currency)}</span>
                  </span>
                </button>
                <button type="button" className="gv-pay-link gv-pd-doc-dl" disabled={phase === 'making'} aria-live="polite" onClick={() => onDownload(d.document_id)}>
                  <DownloadStatus phase={phase} idle="Download" />
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

export function MakeDocPopup({ conferenceId, payments, openItems, billing, suggestion, preset, onClose, onMade }: {
  conferenceId: string;
  payments: PayPayment[];
  /** Items with something still to pay: what an invoice can list. */
  openItems: PayItem[];
  billing: Billing | null;
  /** The delegation and the person, prefilled when nothing is saved yet (prompt 109). */
  suggestion?: BillingSuggestion | null;
  /** A receipt for one payment, or a refund receipt for one refund, from the receipt pop-up: skips the picking. */
  preset?: MakePreset | null;
  onClose: () => void;
  /** A document was made: the list re-reads. */
  onMade: () => void;
}) {
  const refunds = allRefunds(payments);
  const [kind, setKind] = useState<MoneyDocKind>(preset?.kind ?? (payments.length > 0 ? 'receipt' : 'invoice'));
  const [keys, setKeys] = useState<Set<string>>(() => new Set(preset && preset.kind === 'receipt' ? preset.keys : []));
  const [refundKeys, setRefundKeys] = useState<Set<string>>(() => new Set(preset && preset.kind === 'refund' ? preset.keys : []));
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  // "Who Should It Be Made Out To?" every time (prompt 109), so a preset starts there.
  const [step, setStep] = useState<Step>(preset ? 'billing' : 'pick');
  const [form, setForm] = useState<Billing>(() => (billing
    ? { ...EMPTY, ...billing }
    : { ...EMPTY, institution: suggestion?.institution ?? '', attn: suggestion?.attn ?? '' }));
  const [err, setErr] = useState('');
  const [made, setMade] = useState<MoneyDoc | null>(null);
  const busyRef = useRef(false);

  // The details are saved first (they are kept for next time), then the document is made.
  const make = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setErr(''); setStep('making');
    const s = await saveMyBilling(conferenceId, form);
    if (!s.ok) { busyRef.current = false; setErr(s.error); setStep('billing'); return; }
    const r = kind === 'receipt'
      ? await createMyDocument(conferenceId, 'receipt', [...keys], null)
      : kind === 'refund'
        ? await createMyDocument(conferenceId, 'refund', [...refundKeys], null)
        : await createMyDocument(conferenceId, 'invoice', null, [...ids]);
    if (!r.ok) { busyRef.current = false; setErr(r.error); setStep('billing'); return; }
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

  const chosenCount = kind === 'receipt' ? keys.size : kind === 'refund' ? refundKeys.size : ids.size;
  const word = kind === 'receipt' ? 'receipt' : kind === 'refund' ? 'refund receipt' : 'invoice';
  const flip = (set: Set<string>, id: string, on: boolean) => { const n = new Set(set); if (on) n.add(id); else n.delete(id); return n; };

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{PAYDOCS_CSS}</style>
      <PurchaseShell tone="light" label="Download an invoice or receipt" onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-pay-pop" testId="pay-make-doc">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {step === 'pick' && (
            <>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Download an Invoice or Receipt</h2>
              <div className="gv-pd-seg" role="radiogroup" aria-label="What to make">
                <button type="button" role="radio" aria-checked={kind === 'receipt'} disabled={payments.length === 0} onClick={() => setKind('receipt')}>Receipt</button>
                <button type="button" role="radio" aria-checked={kind === 'invoice'} disabled={openItems.length === 0} onClick={() => setKind('invoice')}>Invoice</button>
                {refunds.length > 0 && (
                  <button type="button" role="radio" aria-checked={kind === 'refund'} onClick={() => setKind('refund')}>Refund receipt</button>
                )}
              </div>
              <p className="gv-pay-quiet">
                {kind === 'receipt' ? 'Tick the payments to put on the receipt'
                  : kind === 'refund' ? 'Tick the refunds to put on the refund receipt'
                  : 'Tick the items still to pay to put on the invoice'}
              </p>
              <div className="gv-pay-rows">
                {kind === 'refund' ? refunds.map(r => (
                  <label key={r.key} className="gv-pd-check">
                    <input type="checkbox" checked={refundKeys.has(r.key)} onChange={e => setRefundKeys(flip(refundKeys, r.key, e.target.checked))} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{r.label}</span>
                      <span style={{ display: 'block', fontSize: 13, color: INK_SOFT }}>Refunded on {shortDate(r.at)}</span>
                    </span>
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(r.amount_cents, r.currency)}</b>
                  </label>
                )) : kind === 'receipt' ? payments.map(p => (
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
              {err && <p className="gv-pay-err" role="alert">{err}</p>}
              <div>
                <button type="button" className="gv-pay-btn gv-pay-forest" disabled={chosenCount === 0}
                  onClick={() => { setErr(''); setStep('billing'); }}>
                  <Download size={16} strokeWidth={2.4} aria-hidden /> Download {word}
                </button>
              </div>
            </>
          )}

          {step === 'billing' && (
            <>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Who Should It Be Made Out To?</h2>
              <p className="gv-pay-quiet">Check the details, then download. We keep them for next time</p>
              <BillingForm value={form} onChange={setForm} disabled={false} />
              {err && <p className="gv-pay-err" role="alert">{err}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" className="gv-pay-btn gv-pay-forest" onClick={() => { void make(); }}>
                  <Download size={16} strokeWidth={2.4} aria-hidden /> Download {word}
                </button>
                {!preset && <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => { setErr(''); setStep('pick'); }}>Back</button>}
              </div>
            </>
          )}

          {step === 'making' && (
            <p className="gv-pay-quiet" aria-live="polite" style={{ padding: '24px 0', fontSize: 15 }}>Making your {word}<CyclingDots /></p>
          )}

          {step === 'done' && (
            <>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {made ? (made.kind === 'receipt' ? 'Your Receipt' : made.kind === 'refund' ? 'Your Refund Receipt' : 'Your Invoice') : 'Your Document'}
              </h2>
              {made && !err && (
                <p aria-live="polite" style={{ margin: 0, fontSize: 15 }}>
                  <span className="gv-pd-ok"><Check size={16} strokeWidth={2.8} aria-hidden /> {made.number} downloaded</span>
                </p>
              )}
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
  const { phase, run } = useDownloadPhase();
  const [err, setErr] = useState('');
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className={`gv-pay-btn ${outline ? 'gv-pay-outline' : 'gv-pay-forest'}`} disabled={phase === 'making'} aria-live="polite"
        onClick={async () => {
          if (phase === 'making') return;
          setErr('');
          const ok = await run(() => downloadMoneyDocument(doc));
          if (!ok) setErr(DOWNLOAD_FAILED);
        }}>
        {phase === 'idle' && <Download size={16} strokeWidth={2.4} aria-hidden />} <DownloadStatus phase={phase} idle={label} />
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
      <PurchaseShell tone="light" label={doc ? `${kindWord(doc.kind)} ${doc.number}` : 'Document'} onClose={onClose} panelClass="gv-pd-view" testId="pay-doc">
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
