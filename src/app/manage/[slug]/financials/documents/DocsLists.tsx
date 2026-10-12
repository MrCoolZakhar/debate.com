'use client';

// DocsLists — the two lists on Invoices and Receipts (prompt 98):
//   PaymentsList   every payment from financials_payments, filterable, a tick each,
//                  and the numbers of the documents already made for it as links
//   DocumentsList  every document from financials_documents, each opening the editor
// The rows reuse the Invoices page's look (INV_CSS).

import { CreditCard, FileText, Landmark, ReceiptText, Search } from 'lucide-react';
import { docShortDate } from '@/components/money/moneyDocument';
import { FOREST, INK_SOFT } from '../dashboardKit';
import { KIND_NAME, KIND_ORDER, cents } from '../financialsApi';
import type { DocumentRow, MoneyPayment } from './documentsApi';

export type How = '' | 'card' | 'proof' | 'marked';
export interface PayFilters { q: string; how: How; kind: string }

export function howWords(h: MoneyPayment['how']): string {
  return h === 'card' ? 'Card' : h === 'proof' ? 'Proof approved' : 'Marked paid';
}

export function filterPayments(list: MoneyPayment[], f: PayFilters): MoneyPayment[] {
  const q = f.q.trim().toLowerCase();
  return list.filter(p => {
    if (q && ![p.name, p.delegation ?? '', ...p.documents.map(d => d.number)].some(s => (s ?? '').toLowerCase().includes(q))) return false;
    if (f.how && p.how !== f.how) return false;
    if (f.kind && !(p.kinds ?? []).includes(f.kind)) return false;
    return true;
  });
}

export function PaymentFiltersBar({ f, onChange }: { f: PayFilters; onChange: (patch: Partial<PayFilters>) => void }) {
  return (
    <div className="gv-inv-filters" role="search">
      <label className="gv-inv-search">
        <Search size={16} strokeWidth={2.4} aria-hidden />
        <input type="search" value={f.q} placeholder="Name, delegation or number" aria-label="Search payments"
          onChange={e => onChange({ q: e.target.value })} />
      </label>
      <select className="gv-inv-select" aria-label="How it was paid" value={f.how} onChange={e => onChange({ how: e.target.value as How })}>
        <option value="">Every way of paying</option>
        <option value="card">Card</option>
        <option value="proof">Proof approved</option>
        <option value="marked">Marked paid</option>
      </select>
      <select className="gv-inv-select" aria-label="Item type" value={f.kind} onChange={e => onChange({ kind: e.target.value })}>
        <option value="">All item types</option>
        {KIND_ORDER.map(k => <option key={k} value={k}>{KIND_NAME[k]}</option>)}
      </select>
    </div>
  );
}

export function PaymentLine({ p, selected, onToggle, onOpenDoc, canTick }: {
  p: MoneyPayment;
  selected: boolean;
  onToggle: () => void;
  onOpenDoc: (documentId: string) => void;
  canTick: boolean;
}) {
  const sub = [p.delegation, howWords(p.how), docShortDate(p.at)].filter(Boolean).join(' · ');
  return (
    <div className="gv-inv-row" data-selected={selected || undefined} style={{ cursor: canTick ? 'pointer' : 'default' }}
      onClick={() => { if (canTick) onToggle(); }}>
      <span onClick={e => e.stopPropagation()}>
        {canTick && <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select the payment from ${p.name} on ${docShortDate(p.at)}`} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <p className="gv-inv-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', color: '#2A5A3C', flexShrink: 0 }} aria-hidden>
            {p.how === 'card' ? <CreditCard size={16} strokeWidth={2.2} /> : <Landmark size={16} strokeWidth={2.2} />}
          </span>
          <span style={{ minWidth: 0 }}>{p.name}</span>
        </p>
        <p className="gv-inv-sub">{sub}</p>
        <p className="gv-inv-sub">{p.items.map(i => i.label).join(', ')}</p>
        {p.documents.length > 0 && (
          <p className="gv-inv-sub" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
            {p.documents.map(d => (
              <button key={d.document_id} type="button" className="gv-st-link" style={{ fontSize: 13 }}
                onClick={e => { e.stopPropagation(); onOpenDoc(d.document_id); }}>
                {d.number}
              </button>
            ))}
          </p>
        )}
      </div>
      <div className="gv-inv-nums">
        <div className="gv-inv-num">
          <b style={{ color: FOREST }}>{cents(p.total_cents, p.currency)}</b>
          {p.returned_cents > 0
            ? <span style={{ color: '#8B2020' }}>{cents(p.returned_cents, p.currency)} refunded</span>
            : <span>Paid</span>}
        </div>
      </div>
    </div>
  );
}

export function DocumentLine({ d, name, onOpen }: { d: DocumentRow; name: string; onOpen: () => void }) {
  const receipt = d.kind === 'receipt';
  return (
    <div className="gv-inv-row" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={`${receipt ? 'Receipt' : 'Invoice'} ${d.number}, open it`}>
      <span style={{ display: 'inline-flex', color: FOREST }} aria-hidden>
        {receipt ? <ReceiptText size={18} strokeWidth={2.2} /> : <FileText size={18} strokeWidth={2.2} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <p className="gv-inv-name" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.number}</p>
        <p className="gv-inv-sub">{[receipt ? 'Receipt' : 'Invoice', name, docShortDate(d.created_at)].filter(Boolean).join(' · ')}</p>
        {d.sent_to_payer_at && <p className="gv-inv-sub" style={{ color: INK_SOFT }}>Sent on {docShortDate(d.sent_to_payer_at)}</p>}
      </div>
      <div className="gv-inv-nums">
        <div className="gv-inv-num">
          <b>{cents(receipt ? d.paid_cents : d.balance_cents, d.currency)}</b>
          <span>{receipt ? 'Paid' : 'Balance due'}</span>
        </div>
      </div>
    </div>
  );
}
