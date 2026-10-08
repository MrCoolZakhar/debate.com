'use client';

/**
 * Financials → Invoices (prompt 93). One row per person who is BILLED, from
 * financials_people (a leader's delegate and advisor tickets sit under the
 * leader), with filters kept in the URL, bulk Mark paid / Mark unpaid, and a
 * pop-up per person (financials_person) with every item, payment, refund,
 * ledger line and audit row. Every write is mark_invoices_paid,
 * mark_invoices_unpaid or a refund; after each one the list is read again.
 * Proofs are reviewed in the dashboard's Things to do, not here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useManage } from '@/app/manage/[slug]/layout';
import { PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { friendlyError } from '@/lib/friendlyError';
import { STORE_CSS } from '../../store/storeKit';
import { DASH_CSS, READ_ONLY_LINE } from '../dashboardKit';
import { cents } from '../financialsApi';
import { useFinancialsCurrency } from '../shared';
import MarkPaidDialog from '../MarkPaidDialog';
import MarkUnpaidDialog from '../MarkUnpaidDialog';
import { readPeople, type PersonRow } from './invoicesApi';
import { FiltersBar, INV_CSS, PAGE_SIZE, PersonLine, filterPeople, type Filters, type StatusFilter, STATUS_OPTIONS } from './PeopleList';
import { BulkBar, ConfirmMarkPaid } from './BulkBar';
import PersonPopup from './PersonPopup';

type Step =
  | { kind: 'confirm-paid' }
  | { kind: 'paid' }
  | { kind: 'unpaid'; ids: string[]; cardOnly: number };

export default function FinancialsInvoicesPage() {
  const { conference, financialsReadOnly } = useManage();
  const { currency, disp } = useFinancialsCurrency();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState(PAGE_SIZE);
  const [personId, setPersonId] = useState<string | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const conferenceId = conference?.id ?? null;

  useEffect(() => {
    if (!conferenceId) return;
    let alive = true;
    readPeople(conferenceId)
      .then(p => { if (!alive) return; setPeople(p); setError(''); })
      .catch(e => { if (alive) setError(friendlyError(e, 'The people billed could not be read. Try again in a moment.')); });
    return () => { alive = false; };
  }, [conferenceId, attempt]);

  const reload = useCallback(() => setAttempt(a => a + 1), []);

  const statusParam = params.get('status') ?? 'all';
  const filters: Filters = {
    q: params.get('q') ?? '',
    delegation: params.get('delegation') ?? '',
    status: (STATUS_OPTIONS.some(o => o.v === statusParam) ? statusParam : 'all') as StatusFilter,
    type: params.get('type') ?? '',
  };

  const setFilters = (patch: Partial<Filters>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === 'all') next.delete(k); else next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setShown(PAGE_SIZE);
  };

  const all = useMemo(() => people ?? [], [people]);
  const delegations = useMemo(
    () => Array.from(new Set(all.map(p => p.delegation).filter((d): d is string => !!d))).sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const filtered = filterPeople(all, filters);
  const page = filtered.slice(0, shown);

  if (!conference) return null;

  const money = (c: number, cur: string | null) =>
    !cur || cur.toUpperCase() === currency.toUpperCase() ? disp((c || 0) / 100) : cents(c, cur);

  const sameCur = all.filter(p => !p.currency || p.currency.toUpperCase() === currency.toUpperCase());
  const totalOwed = sameCur.reduce((s, p) => s + (p.closed ? 0 : p.owed_cents), 0);
  const totalPaid = sameCur.reduce((s, p) => s + p.paid_cents, 0);

  const chosen = all.filter(p => selected.has(p.application_id));
  const payable = chosen.filter(p => p.open_invoice_ids.length > 0);
  const payIds = payable.flatMap(p => p.open_invoice_ids);
  const payTotal = payable.reduce((s, p) => s + Math.max(0, p.owed_cents - p.in_review_cents), 0);
  const unpayable = chosen.filter(p => p.manual_paid_invoice_ids.length > 0);
  const cardOnly = chosen.filter(p => p.manual_paid_invoice_ids.length === 0 && p.any_card).length;
  const pageAllSelected = page.length > 0 && page.every(p => selected.has(p.application_id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const afterWrite = () => { setStep(null); setSelected(new Set()); reload(); };

  return (
    <div className="gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{INV_CSS}</style>
      {(step || personId) ? <style>{PURCHASE_CSS}</style> : null}

      {people && (
        <p className="gv-st-quiet" style={{ margin: '-14px 0 18px', fontSize: 14.5, fontVariantNumeric: 'tabular-nums' }}>
          {all.length} {all.length === 1 ? 'person' : 'people'} billed · {money(totalOwed, null)} outstanding · {money(totalPaid, null)} paid
        </p>
      )}
      {financialsReadOnly && <p className="gv-st-quiet" style={{ marginBottom: 14 }}>{READ_ONLY_LINE}</p>}

      {!people && error ? (
        <p className="gv-st-err" role="alert">
          {error} <button type="button" className="gv-st-link" onClick={() => { setError(''); reload(); }}>Try again</button>
        </p>
      ) : !people ? (
        <div className="gv-fd-ph" style={{ minHeight: 320 }} aria-busy="true" aria-label="Reading the people billed" />
      ) : all.length === 0 ? (
        <div className="gv-st-card" style={{ textAlign: 'center', padding: '40px 22px' }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nobody has been billed yet</p>
        </div>
      ) : (
        <>
          <FiltersBar f={filters} delegations={delegations} onChange={setFilters} />
          {filtered.length === 0 ? (
            <div className="gv-st-card" style={{ textAlign: 'center', padding: '32px 22px' }}>
              <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Nobody matches these filters</p>
              <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setFilters({ q: '', delegation: '', status: 'all', type: '' })}>Clear filters</button>
            </div>
          ) : (
            <div className="gv-inv-list">
              {page.map(p => (
                <PersonLine
                  key={p.application_id}
                  p={p}
                  selected={selected.has(p.application_id)}
                  onToggle={() => toggle(p.application_id)}
                  onOpen={() => setPersonId(p.application_id)}
                  money={money}
                  readOnly={financialsReadOnly}
                />
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
          {!financialsReadOnly && (
            <BulkBar
              count={selected.size}
              canPaid={payIds.length > 0}
              canUnpaid={unpayable.length > 0}
              pageAllSelected={pageAllSelected}
              onMarkPaid={() => setStep({ kind: 'confirm-paid' })}
              onMarkUnpaid={() => setStep({ kind: 'unpaid', ids: unpayable.flatMap(p => p.manual_paid_invoice_ids), cardOnly })}
              onSelectPage={() => setSelected(new Set([...selected, ...page.map(p => p.application_id)]))}
              onClear={() => setSelected(new Set())}
            />
          )}
        </>
      )}

      {step?.kind === 'confirm-paid' && (
        <ConfirmMarkPaid
          people={payable.length}
          name={payable.length === 1 ? payable[0].name : null}
          items={payIds.length}
          totalLabel={cents(payTotal, currency)}
          leftOut={chosen.length - payable.length}
          onClose={() => setStep(null)}
          onContinue={() => setStep({ kind: 'paid' })}
        />
      )}
      {step?.kind === 'paid' && (
        <MarkPaidDialog
          conferenceId={conference.id}
          invoiceIds={payIds}
          totalLabel={cents(payTotal, currency)}
          onClose={() => setStep(null)}
          onDone={afterWrite}
        />
      )}
      {step?.kind === 'unpaid' && (
        <MarkUnpaidDialog
          invoiceIds={step.ids}
          title="Mark as Unpaid?"
          body={[
            `${step.ids.length} item${step.ids.length === 1 ? '' : 's'} that were marked paid go back to owed.`,
            step.cardOnly > 0 ? `Card payments can only be refunded, so ${step.cardOnly} ${step.cardOnly === 1 ? 'person is' : 'people are'} left out.` : '',
          ].filter(Boolean).join(' ')}
          onClose={() => setStep(null)}
          onDone={afterWrite}
        />
      )}
      {personId && (
        <PersonPopup
          applicationId={personId}
          conferenceId={conference.id}
          slug={conference.slug}
          readOnly={financialsReadOnly}
          onClose={() => setPersonId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
