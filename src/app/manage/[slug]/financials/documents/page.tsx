'use client';

/**
 * Financials → Invoices and Receipts (prompt 98). Make a formal receipt for
 * any payment, under the conference's own name and numbering:
 *   Payments   financials_payments, filterable, ticked, then "Generate receipt"
 *              (one person at a time) → create_money_document → the editor
 *   Documents  financials_documents, each opening the editor
 * The first visit opens "Your Invoice Details" (get / save_invoice_settings);
 * the "Invoice details" button reopens it. ?doc=<id> opens that document.
 * Invoices for open items are made from the Invoices page's person pop-up.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileText, Settings2 } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { friendlyError } from '@/lib/friendlyError';
import { STORE_CSS } from '../../store/storeKit';
import { DASH_CSS, READ_ONLY_LINE } from '../dashboardKit';
import { INV_CSS, PAGE_SIZE } from '../invoices/PeopleList';
import { DOCS_CSS } from './docsKit';
import {
  createDocument, readDocuments, readInvoiceSettings, readPayments,
  type DocumentRow, type InvoiceSettings, type MoneyPayment,
} from './documentsApi';
import { DocumentLine, PaymentFiltersBar, PaymentLine, filterPayments, type PayFilters } from './DocsLists';
import InvoiceDetailsPopup from './InvoiceDetailsPopup';
import DocumentEditor from './DocumentEditor';

const TABS_CSS = `
.gv-md-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:14px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08)}
.gv-md-tab{min-height:40px;padding:0 16px;border-radius:10px;border:none;background:none;font-family:inherit;font-size:14px;font-weight:700;color:#5A5046;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.gv-md-tab[aria-selected="true"]{background:#1B3828;color:#EED98A}
.gv-md-tab:focus{outline:none}
.gv-md-tab:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px #1B3828}
.gv-md-tab b{font-variant-numeric:tabular-nums;font-weight:800}
`;

type Tab = 'payments' | 'documents';

export default function InvoicesAndReceiptsPage() {
  const { conference, financialsReadOnly } = useManage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const conferenceId = conference?.id ?? null;

  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [payments, setPayments] = useState<MoneyPayment[] | null>(null);
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'documents' ? 'documents' : 'payments');
  const [filters, setFilters] = useState<PayFilters>({ q: '', how: '', kind: '' });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState(PAGE_SIZE);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editor, setEditor] = useState<{ id: string; name: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const busyRef = useRef(false);
  const autoOpened = useRef(false);
  const docParamDone = useRef(false);

  useEffect(() => {
    if (!conferenceId) return;
    let alive = true;
    Promise.all([readInvoiceSettings(conferenceId), readPayments(conferenceId), readDocuments(conferenceId)])
      .then(([s, p, d]) => { if (!alive) return; setSettings(s); setPayments(p); setDocs(d); setError(''); })
      .catch(e => { if (alive) setError(friendlyError(e, 'Your invoices and receipts could not be read. Try again in a moment.')); });
    return () => { alive = false; };
  }, [conferenceId, attempt]);

  const reload = useCallback(() => setAttempt(a => a + 1), []);

  // First visit: the walkthrough opens by itself once.
  useEffect(() => {
    if (!settings || settings.settings || autoOpened.current || financialsReadOnly) return;
    autoOpened.current = true;
    void Promise.resolve().then(() => setDetailsOpen(true));
  }, [settings, financialsReadOnly]);

  // ?doc=<id> opens that document once.
  useEffect(() => {
    if (docParamDone.current) return;
    const id = params.get('doc');
    if (!id) return;
    docParamDone.current = true;
    void Promise.resolve().then(() => setEditor({ id, name: null }));
  }, [params]);

  const all = useMemo(() => payments ?? [], [payments]);
  const filtered = useMemo(() => filterPayments(all, filters), [all, filters]);
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of all) if (p.application_id && !m.has(p.application_id)) m.set(p.application_id, p.name);
    return m;
  }, [all]);

  if (!conference) return null;

  const ready = !!settings?.settings;
  const chosen = all.filter(p => selected.has(p.key));
  const people = new Set(chosen.map(p => p.application_id));
  const onePerson = people.size <= 1;
  const page = filtered.slice(0, shown);

  const changeTab = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(params.toString());
    if (t === 'documents') next.set('tab', 'documents'); else next.delete('tab');
    next.delete('doc');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const closeEditor = () => {
    setEditor(null);
    if (params.get('doc')) {
      const next = new URLSearchParams(params.toString());
      next.delete('doc');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    reload();
  };

  const toggle = (key: string) => {
    setCreateErr('');
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const generate = async () => {
    if (busyRef.current || chosen.length === 0) return;
    if (!onePerson) { setCreateErr('Pick payments from one person at a time'); return; }
    if (!ready) { setDetailsOpen(true); return; }
    busyRef.current = true; setBusy(true); setCreateErr('');
    const person = chosen[0];
    const r = await createDocument(conference.id, 'receipt', person.application_id, chosen.map(p => p.key), null);
    busyRef.current = false; setBusy(false);
    if (!r.ok) {
      if (r.code === 'no_settings') { setDetailsOpen(true); return; }
      setCreateErr(r.error);
      return;
    }
    setSelected(new Set());
    setEditor({ id: r.data.document_id, name: person.name });
    reload();
  };

  const loading = !settings || !payments || !docs;

  return (
    <div className="gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{INV_CSS}</style>
      <style>{TABS_CSS}</style>
      {(detailsOpen || editor) ? <><style>{PURCHASE_CSS}</style><style>{DOCS_CSS}</style></> : null}

      {financialsReadOnly && <p className="gv-st-quiet" style={{ marginBottom: 14 }}>{READ_ONLY_LINE}</p>}

      {loading && error ? (
        <p className="gv-st-err" role="alert">
          {error} <button type="button" className="gv-st-link" onClick={() => { setError(''); reload(); }}>Try again</button>
        </p>
      ) : loading ? (
        <div className="gv-fd-ph" style={{ minHeight: 320 }} aria-busy="true" aria-label="Reading your payments" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 16 }}>
            <div className="gv-md-tabs" role="tablist" aria-label="Invoices and receipts">
              <button type="button" role="tab" className="gv-md-tab" aria-selected={tab === 'payments'} onClick={() => changeTab('payments')}>
                Payments <b>{all.length}</b>
              </button>
              <button type="button" role="tab" className="gv-md-tab" aria-selected={tab === 'documents'} onClick={() => changeTab('documents')}>
                Documents <b>{docs!.length}</b>
              </button>
            </div>
            <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setDetailsOpen(true)}>
              <Settings2 size={16} strokeWidth={2.4} aria-hidden /> Invoice details
            </button>
          </div>

          {!ready && (
            <div className="gv-st-card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span className="gv-fd-set-icon" style={{ marginBottom: 0 }} aria-hidden><FileText size={18} strokeWidth={2.2} /></span>
              <p style={{ margin: 0, flex: '1 1 260px', fontSize: 15, fontWeight: 700 }}>Add your invoice details first. They go at the top of every invoice and receipt</p>
              {!financialsReadOnly && <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setDetailsOpen(true)}>Add invoice details</button>}
            </div>
          )}

          {tab === 'payments' ? (
            all.length === 0 ? (
              <div className="gv-st-card" style={{ textAlign: 'center', padding: '40px 22px' }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>No payments yet</p>
              </div>
            ) : (
              <>
                <PaymentFiltersBar f={filters} onChange={patch => { setFilters(f => ({ ...f, ...patch })); setShown(PAGE_SIZE); }} />
                {filtered.length === 0 ? (
                  <div className="gv-st-card" style={{ textAlign: 'center', padding: '32px 22px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>No payments match these filters</p>
                    <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setFilters({ q: '', how: '', kind: '' })}>Clear filters</button>
                  </div>
                ) : (
                  <div className="gv-inv-list">
                    {page.map(p => (
                      <PaymentLine key={p.key} p={p} selected={selected.has(p.key)} canTick={!financialsReadOnly}
                        onToggle={() => toggle(p.key)} onOpenDoc={id => setEditor({ id, name: p.name })} />
                    ))}
                  </div>
                )}
                {filtered.length > shown && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                    <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setShown(s => s + PAGE_SIZE)}>
                      Show more ({filtered.length - shown} left)
                    </button>
                  </div>
                )}
                {!financialsReadOnly && selected.size > 0 && (
                  <div className="gv-inv-bulk" role="region" aria-label="Make a receipt for the selected payments">
                    <span className="gv-inv-bulk-count">
                      {selected.size} payment{selected.size === 1 ? '' : 's'} selected
                      {onePerson && chosen[0] ? <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#5A5046', overflowWrap: 'anywhere' }}>{chosen[0].name}</span> : null}
                      {!onePerson && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8B2020' }}>Pick payments from one person at a time</span>}
                      {createErr && onePerson && <span role="alert" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8B2020' }}>{createErr}</span>}
                    </span>
                    <button type="button" className="gv-st-btn gv-st-forest" disabled={busy || !onePerson} onClick={() => { void generate(); }}>
                      {busy ? 'Making the receipt' : 'Generate receipt'}
                    </button>
                    <button type="button" className="gv-st-link" onClick={() => { setSelected(new Set()); setCreateErr(''); }}>Clear</button>
                  </div>
                )}
              </>
            )
          ) : (
            docs!.length === 0 ? (
              <div className="gv-st-card" style={{ textAlign: 'center', padding: '40px 22px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>No invoices or receipts yet</p>
                <button type="button" className="gv-st-btn gv-st-outline" onClick={() => changeTab('payments')}>Pick a payment</button>
              </div>
            ) : (
              <div className="gv-inv-list">
                {docs!.map(d => {
                  const name = (d.application_id && names.get(d.application_id)) || d.billed_to?.institution || d.billed_to?.attn || '';
                  return <DocumentLine key={d.document_id} d={d} name={name} onOpen={() => setEditor({ id: d.document_id, name: (d.application_id && names.get(d.application_id)) || d.billed_to?.attn || null })} />;
                })}
              </div>
            )
          )}
        </>
      )}

      {detailsOpen && settings && (
        <InvoiceDetailsPopup
          conferenceId={conference.id}
          initial={settings}
          readOnly={financialsReadOnly}
          onClose={() => setDetailsOpen(false)}
          onSaved={() => { setDetailsOpen(false); reload(); }}
        />
      )}
      {editor && (
        <DocumentEditor
          documentId={editor.id}
          payerName={editor.name}
          readOnly={financialsReadOnly}
          onClose={closeEditor}
          onChanged={reload}
        />
      )}
    </div>
  );
}
