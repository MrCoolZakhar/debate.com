'use client';

/**
 * Financials Invoices — every invoices row for this conference (role_fee,
 * app_fee, addon, pledge_spot), synced from sync_conference_invoices on
 * load. Filterable by status/kind/role. Manual mark-paid/unpaid only shows
 * for conferences not on live Stripe (create-checkout + its webhook own
 * that state once Stripe is live), matching the isPaymentsLive gate used
 * on the Applications page. Gavelling credit purchases are a separate
 * system entirely and never appear here.
 */

import { useEffect, useState } from 'react';
import { Check, Receipt, RotateCcw } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { isPaymentsLive } from '@/lib/payments';
import {
  type InvoiceRow, invoiceLabel, invoiceDueCents, centsToFee,
  INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, type InvoiceStatus,
} from '@/lib/invoices';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuInset, NeuIconDisc,
} from '@/components/neu';
import { inputStyle, mutedCaption, roleLabel } from '../shared';

interface InvoiceApplication {
  id: string;
  role: string;
  user_id: string | null;
  invited_name: string | null;
  society_id: string | null;
  profiles: { display_name: string } | null;
  societies: { name: string } | null;
}

interface InvoiceWithApp extends InvoiceRow {
  application: InvoiceApplication | InvoiceApplication[] | null;
}

const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Static kind label, used for the row's kind SUBTITLE (generic type) — the
 *  row's primary label already shows the specific add-on name via
 *  invoiceLabel(). The kind FILTER dropdown is built separately, per-addon. */
const KIND_LABEL: Record<string, string> = {
  role_fee: 'Registration', app_fee: 'Registration Fee', addon: 'Add-on', pledge_spot: 'Delegation Spot',
};

const INDEPENDENT_DELEGATION = '__independent__';

const STATUS_OPTIONS: InvoiceStatus[] = ['open', 'partial', 'settled', 'waived', 'void'];

function StatusPill({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS_STYLE[status];
  return (
    <span
      className="px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: 10, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
    >
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}

export default function FinancialsInvoicesPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const paymentsLive = isPaymentsLive(conference?.id, conference?.connect_onboarding_status, conference?.payment_method);

  const [invoices, setInvoices] = useState<InvoiceWithApp[] | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [delegationFilter, setDelegationFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      await supabase.rpc('sync_conference_invoices', { p_conference_id: conference.id });
      const { data } = await supabase
        .from('invoices')
        .select(`
          id, conference_id, kind, label, amount_cents, amount_paid_cents, currency, status,
          gates_acceptance, payable_before_acceptance, application_id, society_id, config_id,
          aid_applied_cents, created_at,
          application:applications!invoices_application_id_fkey (
            id, role, user_id, invited_name, society_id,
            profiles (display_name), societies (name)
          )
        `)
        .eq('conference_id', conference.id)
        .neq('status', 'void')
        .order('created_at', { ascending: false });
      setInvoices((data ?? []) as unknown as InvoiceWithApp[]);
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function handleMarkPaid(inv: InvoiceWithApp) {
    if (!session || busyIds.has(inv.id)) return;
    setActionError('');
    markBusy(inv.id, true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('mark_invoice_paid', { p_invoice_id: inv.id });
    const result = data as { ok?: boolean; error?: string } | null;
    markBusy(inv.id, false);
    if (!result?.ok) { setActionError(result?.error || 'Could not mark this invoice paid.'); return; }
    setInvoices(cur => (cur ?? []).map(i => (i.id === inv.id ? { ...i, status: 'settled', amount_paid_cents: i.amount_cents } : i)));
  }

  async function handleMarkUnpaid(inv: InvoiceWithApp) {
    if (!session || busyIds.has(inv.id)) return;
    setActionError('');
    markBusy(inv.id, true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('mark_invoice_unpaid', { p_invoice_id: inv.id });
    const result = data as { ok?: boolean; error?: string } | null;
    markBusy(inv.id, false);
    if (!result?.ok) { setActionError(result?.error || 'Could not mark this invoice unpaid.'); return; }
    setInvoices(cur => (cur ?? []).map(i => (i.id === inv.id ? { ...i, status: 'open', amount_paid_cents: 0 } : i)));
  }

  if (!conference) return null;

  const loading = invoices === null;
  const rows = invoices ?? [];
  const availableRoles = Array.from(new Set(rows.map(r => first(r.application)?.role).filter((r): r is string => !!r))).sort();
  const availableDelegations = Array.from(
    new Set(rows.map(r => first(r.application)?.societies?.name).filter((s): s is string => !!s))
  ).sort();
  const hasIndependent = rows.some(r => !first(r.application)?.societies?.name);
  // Per-add-on kind options, distinct by config_id — "Add-on" as a single
  // bucket doesn't distinguish a Gala Dinner invoice from a Socials Ticket
  // one, so each active add-on gets its own filter entry.
  const addonKindOptions = Array.from(
    new Map(
      rows.filter(r => r.kind === 'addon' && r.config_id).map(r => [r.config_id as string, invoiceLabel(r)])
    ).entries()
  ).map(([configId, label]) => ({ value: `addon:${configId}`, label }));
  const kindOptions = [
    { value: 'role_fee', label: 'Registration' },
    { value: 'app_fee', label: 'Registration Fee' },
    ...addonKindOptions,
    { value: 'pledge_spot', label: 'Delegation Spot' },
  ];

  const filtered = rows.filter(r => {
    if (search.trim()) {
      const app = first(r.application);
      const name = (app?.profiles?.display_name ?? app?.invited_name ?? '').toLowerCase();
      if (!name.includes(search.trim().toLowerCase())) return false;
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (kindFilter !== 'all') {
      if (kindFilter.startsWith('addon:')) {
        if (!(r.kind === 'addon' && r.config_id === kindFilter.slice('addon:'.length))) return false;
      } else if (r.kind !== kindFilter) return false;
    }
    if (delegationFilter !== 'all') {
      const socName = first(r.application)?.societies?.name ?? null;
      if (delegationFilter === INDEPENDENT_DELEGATION) { if (socName) return false; }
      else if (socName !== delegationFilter) return false;
    }
    if (roleFilter !== 'all' && first(r.application)?.role !== roleFilter) return false;
    return true;
  });

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Invoices
          </h2>
          <p style={mutedCaption}>
            Every registration, application fee, add-on, and delegation spot invoice for this conference.
          </p>
        </div>
      </div>

      {actionError && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{actionError}</p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search delegate…"
          style={{ ...inputStyle, width: 200 }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'all')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>)}
        </select>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="all">All kinds</option>
          {kindOptions.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        {(availableDelegations.length > 0 || hasIndependent) && (
          <select value={delegationFilter} onChange={e => setDelegationFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="all">All delegations</option>
            {hasIndependent && <option value={INDEPENDENT_DELEGATION}>Independent</option>}
            {availableDelegations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {availableRoles.length > 0 && (
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="all">All roles</option>
            {availableRoles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
      ) : rows.length === 0 ? (
        <NeuInset className="flex flex-col items-center text-center px-6 py-14">
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={44} />
          <h2 className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink }}>No invoices yet</h2>
          <p className="mt-1 max-w-sm" style={mutedCaption}>Invoices appear here once applicants owe something — registration, the application fee, or an add-on.</p>
        </NeuInset>
      ) : filtered.length === 0 ? (
        <NeuInset small className="text-center px-6 py-8">
          <p style={{ ...mutedCaption, fontSize: 12 }}>No invoices match these filters.</p>
        </NeuInset>
      ) : (
        <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
          {filtered.map((inv, i) => {
            const app = first(inv.application);
            const name = app?.profiles?.display_name ?? app?.invited_name ?? 'Unknown';
            const busy = busyIds.has(inv.id);
            const due = invoiceDueCents(inv);
            const canMarkPaid = !paymentsLive && (inv.status === 'open' || inv.status === 'partial');
            const canMarkUnpaid = !paymentsLive && inv.status === 'settled';
            return (
              <div
                key={inv.id}
                className="flex items-center gap-3 flex-wrap px-5 py-3"
                style={{ ...(i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : {}), opacity: busy ? 0.6 : 1 }}
              >
                <div className="min-w-0" style={{ flex: '1 1 160px' }}>
                  <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{name}</p>
                  {app?.role && (
                    <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted }}>{roleLabel(app.role)}</p>
                  )}
                </div>

                <div className="min-w-0" style={{ flex: '1 1 160px' }}>
                  <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
                    {invoiceLabel(inv)}
                  </p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted }}>
                    {KIND_LABEL[inv.kind] ?? inv.kind}
                  </p>
                </div>

                <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                  {centsToFee(inv.amount_cents, inv.currency)}
                </span>
                <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>
                  {inv.status === 'settled' || inv.status === 'waived'
                    ? 'paid in full'
                    : `${centsToFee(inv.amount_paid_cents, inv.currency)} paid`}
                </span>

                <StatusPill status={inv.status} />

                {(canMarkPaid || canMarkUnpaid) && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {canMarkPaid && (
                      <button
                        onClick={() => handleMarkPaid(inv)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 focus:outline-none"
                        style={{
                          padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(61,122,82,0.35)',
                          backgroundColor: 'rgba(61,122,82,0.1)', color: '#2A5A3C',
                          fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.03em',
                          cursor: busy ? 'default' : 'pointer',
                        }}
                        title={`Mark ${centsToFee(due, inv.currency)} as paid manually`}
                      >
                        <Check size={11} strokeWidth={2.6} />
                        MARK PAID
                      </button>
                    )}
                    {canMarkUnpaid && (
                      <button
                        onClick={() => handleMarkUnpaid(inv)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 focus:outline-none"
                        style={{
                          padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(139,32,32,0.3)',
                          backgroundColor: 'rgba(139,32,32,0.06)', color: '#8B2020',
                          fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.03em',
                          cursor: busy ? 'default' : 'pointer',
                        }}
                      >
                        <RotateCcw size={11} strokeWidth={2.6} />
                        MARK UNPAID
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </NeuCard>
      )}
    </section>
  );
}
