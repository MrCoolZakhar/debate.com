'use client';

/**
 * Financials Invoices — two sub-views behind a toggle. Transactions
 * (default) is the payment_batches ledger: every attempt to pay, however it
 * happened (Stripe checkout, a manual proof submission, an organizer-
 * recorded payment), with proof review for pending manual ones. Ledger is
 * the original per-invoice table (role_fee, app_fee, addon, pledge_spot,
 * advisor_spot), unchanged, for "what does each application still owe."
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock, CreditCard, Eye, Receipt, RotateCcw, User, X } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { isPaymentsLive } from '@/lib/payments';
import { useConfirmModal } from '@/components/ConfirmModal';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import Portal from '@/components/Portal';
import {
  type InvoiceRow, invoiceLabel, invoiceDueCents, centsToFee,
  INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, type InvoiceStatus,
} from '@/lib/invoices';
import {
  NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset, NeuIconDisc,
} from '@/components/neu';
import { inputStyle, mutedCaption, formatRowDate, roleLabel } from '../shared';

const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

// ── Ledger types (unchanged) ────────────────────────────────────────────────

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

/** Static kind label, used for the row's kind SUBTITLE (generic type) — the
 *  row's primary label already shows the specific add-on name via
 *  invoiceLabel(). The kind FILTER dropdown is built separately, per-addon. */
const KIND_LABEL: Record<string, string> = {
  role_fee: 'Registration', app_fee: 'Registration Fee', addon: 'Add-on',
  pledge_spot: 'Delegation Spot', advisor_spot: 'Advisor Ticket',
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

// ── Transactions types ──────────────────────────────────────────────────────

interface BatchLineApplication {
  invited_name: string | null;
  profiles: { display_name: string } | { display_name: string }[] | null;
}

interface BatchLineInvoice {
  kind: string;
  label: string | null;
  application: BatchLineApplication | BatchLineApplication[] | null;
}

interface BatchPayment {
  id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  invoice: BatchLineInvoice | BatchLineInvoice[] | null;
}

interface TxBatchRow {
  id: string;
  payer_user_id: string;
  method: 'stripe' | 'manual' | 'organizer';
  status: 'pending' | 'paid' | 'rejected';
  total_cents: number;
  currency: string;
  proof_path: string | null;
  proof_uploaded_at: string | null;
  paid_at: string | null;
  created_at: string;
  payments: BatchPayment[];
}

const BATCH_METHOD_LABEL: Record<string, string> = {
  stripe: 'STRIPE', manual: 'MANUAL', organizer: 'ORGANIZER',
};

const BATCH_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(184,132,74,0.18)', color: '#8A6614', label: 'AWAITING REVIEW' },
  paid: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C', label: 'PAID' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020', label: 'REJECTED' },
};

function TxStatusPill({ status }: { status: string }) {
  const s = BATCH_STATUS_STYLES[status] ?? BATCH_STATUS_STYLES.pending;
  return (
    <span
      className="px-2.5 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: 10, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
    >
      {status === 'pending' && <Clock size={10} strokeWidth={2.8} />}
      {s.label}
    </span>
  );
}

/** profiles via payer_user_id first, falling back to the first line item's
 *  owning application (invited_name, or its profile's display_name). */
function payerName(batch: TxBatchRow, payerNames: Map<string, string>): string {
  const fromProfile = payerNames.get(batch.payer_user_id);
  if (fromProfile) return fromProfile;
  const firstPayment = batch.payments[0];
  const inv = firstPayment ? first(firstPayment.invoice) : null;
  const app = inv ? first(inv.application) : null;
  if (!app) return 'Unknown';
  return first(app.profiles)?.display_name ?? app.invited_name ?? 'Unknown';
}

// ── Remove pledged spot, a quiet text trigger + portaled confirm popover ───
// Deliberately plainer than MARK PAID/MARK UNPAID (no pill, no fill) so it
// never competes for attention on the row — this cancels an open, unpaid,
// aid-free pledge_spot/advisor_spot invoice and lowers the delegation's
// pledge count by one. Portaled at fixed viewport coordinates from the
// trigger's own rect so the row's overflow:hidden card can never clip it
// (mirrors PaymentMenu's pattern in manage/[slug]/applications/page.tsx).

function RemovePledgeAction({
  onConfirm,
}: {
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const POP_W = 260;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8));
    setPos({ top: r.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await onConfirm();
    if (!result.ok) {
      setBusy(false);
      setError(result.error || 'Could not remove this spot. Please try again.');
      return;
    }
    setBusy(false);
    setOpen(false);
  }

  return (
    <span className="flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setError(''); setOpen(o => !o); }}
        className="text-xs font-semibold focus:outline-none hover:underline"
        style={{ color: NEU.muted, fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        REMOVE SPOT
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={popRef}
            className="rounded-xl p-3.5"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: POP_W,
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: NEU.out,
              animation: `neuPopIn 160ms ${EASE}`,
            }}
          >
            <style>{'@keyframes neuPopIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }'}</style>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#1C1410', lineHeight: 1.5, margin: 0 }}>
              This cancels the pledged spot and its invoice, and lowers the delegation&apos;s pledge count by one.
            </p>
            {error && (
              <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#8B2020', lineHeight: 1.45 }}>{error}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 rounded-lg py-1.5 text-xs font-bold focus:outline-none"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: busy ? 'default' : 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 rounded-lg py-1.5 text-xs font-bold focus:outline-none"
                style={{ border: 'none', color: '#FFFFFF', backgroundColor: busy ? '#C89494' : '#8B2020', fontFamily: OUTFIT, cursor: busy ? 'default' : 'pointer' }}
              >
                {busy ? '…' : 'REMOVE'}
              </button>
            </div>
          </div>
        </Portal>
      )}
    </span>
  );
}

export default function FinancialsInvoicesPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const paymentsLive = isPaymentsLive(conference?.id, conference?.connect_onboarding_status, conference?.payment_method);
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [activeView, setActiveView] = useState<'transactions' | 'ledger'>('transactions');

  // ── Ledger data ──────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<InvoiceWithApp[] | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [delegationFilter, setDelegationFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Returns the fetched rows rather than setting state itself, so both the
  // initial-load effect and a handler-triggered refetch (after approving a
  // batch) can each apply the result at their own call site.
  async function fetchInvoicesData(): Promise<InvoiceWithApp[]> {
    if (!conference || !session) return [];
    const supabase = getAuthedClient(session.access_token);
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
    return (data ?? []) as unknown as InvoiceWithApp[];
  }

  useEffect(() => {
    if (!conference || !session) return;
    (async () => { setInvoices(await fetchInvoicesData()); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conference?.id, session?.access_token]);

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

  // Cancels an open, unpaid, aid-free pledge_spot/advisor_spot invoice and
  // lowers the owning application's pledge count by one — callable here by
  // organizers (and by the pledging leader on their own /pay page).
  async function handleRemovePledgeInvoice(inv: InvoiceWithApp): Promise<{ ok: boolean; error?: string }> {
    if (!session) return { ok: false, error: 'Session expired. Please sign in again.' };
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('remove_pledged_spot_invoice', { p_invoice_id: inv.id });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      return { ok: false, error: result?.error || error?.message || 'Could not remove this spot. Please try again.' };
    }
    setInvoices(await fetchInvoicesData());
    return { ok: true };
  }

  // ── Transactions data ────────────────────────────────────────────────────
  const [batches, setBatches] = useState<TxBatchRow[] | null>(null);
  const [payerNames, setPayerNames] = useState<Map<string, string>>(new Map());
  const [txBusyIds, setTxBusyIds] = useState<Set<string>>(new Set());
  const [txActionError, setTxActionError] = useState('');
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('all');
  const [txMethodFilter, setTxMethodFilter] = useState<string>('all');
  const [txProofFilter, setTxProofFilter] = useState<'all' | 'with' | 'without'>('all');

  const [proofBatch, setProofBatch] = useState<TxBatchRow | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState('');

  // Same shape as fetchInvoicesData: returns rather than sets, so both the
  // initial-load effect and a handler-triggered refetch apply the result at
  // their own call site.
  async function fetchBatchesData(): Promise<{ rows: TxBatchRow[]; names: Map<string, string> }> {
    if (!conference || !session) return { rows: [], names: new Map() };
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('payment_batches')
      .select(`
        id, payer_user_id, method, status, total_cents, currency, proof_path, proof_uploaded_at, paid_at, created_at,
        payments (
          id, invoice_id, amount_cents, currency,
          invoice:invoices (kind, label, application:applications!invoices_application_id_fkey (invited_name, profiles (display_name)))
        )
      `)
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as TxBatchRow[];
    const payerIds = Array.from(new Set(rows.map(r => r.payer_user_id).filter(Boolean)));
    const names = new Map<string, string>();
    if (payerIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('id, display_name').in('id', payerIds);
      for (const p of (profilesData ?? []) as { id: string; display_name: string }[]) names.set(p.id, p.display_name);
    }
    return { rows, names };
  }

  useEffect(() => {
    if (!conference || !session) return;
    (async () => {
      const { rows, names } = await fetchBatchesData();
      setBatches(rows);
      setPayerNames(names);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conference?.id, session?.access_token]);

  function markTxBusy(id: string, busy: boolean) {
    setTxBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleExpandedBatch(id: string) {
    setExpandedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function openProof(batch: TxBatchRow) {
    if (!batch.proof_path || !session) return;
    setProofBatch(batch);
    setProofUrl(null);
    setProofError('');
    setProofLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(batch.proof_path, 300);
    setProofLoading(false);
    if (error || !data?.signedUrl) { setProofError('Could not load the proof image. Please try again.'); return; }
    setProofUrl(data.signedUrl);
  }

  // Optimistic-first: the row flips to PAID immediately, reverted only if the
  // RPC comes back rejected. Approving also settles every underlying invoice
  // server-side, so the Ledger view is refreshed alongside.
  async function handleApprove(batch: TxBatchRow) {
    if (!session || txBusyIds.has(batch.id)) return;
    setTxActionError('');
    markTxBusy(batch.id, true);
    const previous = batch.status;
    setBatches(cur => (cur ?? []).map(b => (b.id === batch.id ? { ...b, status: 'paid', paid_at: new Date().toISOString() } : b)));
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('review_payment_batch', { p_batch_id: batch.id, p_approve: true });
    const result = data as { ok?: boolean; error?: string } | null;
    markTxBusy(batch.id, false);
    if (error || !result?.ok) {
      setBatches(cur => (cur ?? []).map(b => (b.id === batch.id ? { ...b, status: previous, paid_at: b.paid_at } : b)));
      setTxActionError(result?.error || error?.message || 'Could not approve this payment.');
      return;
    }
    setInvoices(await fetchInvoicesData());
  }

  async function handleReject(batch: TxBatchRow) {
    if (!session || txBusyIds.has(batch.id)) return;
    const { confirmed } = await confirm({
      title: 'Reject this payment?',
      body: 'The invoices stay exactly as they are, unpaid — the payer will need to submit a new payment.',
      confirmLabel: 'Reject payment',
      danger: true,
    });
    if (!confirmed) return;
    setTxActionError('');
    markTxBusy(batch.id, true);
    const previous = batch.status;
    setBatches(cur => (cur ?? []).map(b => (b.id === batch.id ? { ...b, status: 'rejected' } : b)));
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('review_payment_batch', { p_batch_id: batch.id, p_approve: false });
    const result = data as { ok?: boolean; error?: string } | null;
    markTxBusy(batch.id, false);
    if (error || !result?.ok) {
      setBatches(cur => (cur ?? []).map(b => (b.id === batch.id ? { ...b, status: previous } : b)));
      setTxActionError(result?.error || error?.message || 'Could not reject this payment.');
    }
  }

  if (!conference) return null;

  // ── Ledger derived ───────────────────────────────────────────────────────
  const invoicesLoading = invoices === null;
  const invoiceRows = invoices ?? [];
  const availableRoles = Array.from(new Set(invoiceRows.map(r => first(r.application)?.role).filter((r): r is string => !!r))).sort();
  const availableDelegations = Array.from(
    new Set(invoiceRows.map(r => first(r.application)?.societies?.name).filter((s): s is string => !!s))
  ).sort();
  const hasIndependent = invoiceRows.some(r => !first(r.application)?.societies?.name);
  const addonKindOptions = Array.from(
    new Map(
      invoiceRows.filter(r => r.kind === 'addon' && r.config_id).map(r => [r.config_id as string, invoiceLabel(r)])
    ).entries()
  ).map(([configId, label]) => ({ value: `addon:${configId}`, label }));
  const kindOptions = [
    { value: 'role_fee', label: 'Registration' },
    { value: 'app_fee', label: 'Registration Fee' },
    ...addonKindOptions,
    { value: 'pledge_spot', label: 'Delegation Spot' },
    { value: 'advisor_spot', label: 'Advisor Ticket' },
  ];

  const filteredInvoices = invoiceRows.filter(r => {
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

  // ── Transactions derived ────────────────────────────────────────────────
  const batchesLoading = batches === null;
  const batchRows = batches ?? [];
  const awaitingCount = batchRows.filter(b => b.status === 'pending').length;
  const availableMethods = Array.from(new Set(batchRows.map(b => b.method)));

  const filteredBatches = batchRows.filter(b => {
    if (txStatusFilter !== 'all' && b.status !== txStatusFilter) return false;
    if (txMethodFilter !== 'all' && b.method !== txMethodFilter) return false;
    if (txProofFilter === 'with' && !b.proof_path) return false;
    if (txProofFilter === 'without' && b.proof_path) return false;
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
            Every payment attempt and every registration, application fee, add-on, delegation spot, and advisor ticket invoice for this conference.
          </p>
        </div>
      </div>

      {/* Transactions / Ledger toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveView('transactions')}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold focus:outline-none transition-colors"
          style={{
            border: activeView === 'transactions' ? `1.5px solid ${NEU.forest}` : '1px solid rgba(154,138,120,0.35)',
            backgroundColor: activeView === 'transactions' ? 'rgba(27,56,40,0.07)' : 'transparent',
            color: activeView === 'transactions' ? NEU.forest : NEU.muted,
            fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer',
          }}
        >
          TRANSACTIONS
          {awaitingCount > 0 && (
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{ minWidth: 18, height: 18, padding: '0 5px', backgroundColor: '#B8844A', color: '#FFFFFF', fontSize: 10, fontWeight: 900 }}
            >
              {awaitingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('ledger')}
          className="rounded-full px-4 py-2 text-xs font-bold focus:outline-none transition-colors"
          style={{
            border: activeView === 'ledger' ? `1.5px solid ${NEU.forest}` : '1px solid rgba(154,138,120,0.35)',
            backgroundColor: activeView === 'ledger' ? 'rgba(27,56,40,0.07)' : 'transparent',
            color: activeView === 'ledger' ? NEU.forest : NEU.muted,
            fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer',
          }}
        >
          LEDGER
        </button>
      </div>

      {activeView === 'transactions' ? (
        <>
          {txActionError && (
            <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{txActionError}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={txStatusFilter} onChange={e => setTxStatusFilter(e.target.value as typeof txStatusFilter)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
              <option value="all">All statuses</option>
              <option value="pending">Awaiting review</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
            {availableMethods.length > 0 && (
              <select value={txMethodFilter} onChange={e => setTxMethodFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                <option value="all">All methods</option>
                {availableMethods.map(m => <option key={m} value={m}>{BATCH_METHOD_LABEL[m] ?? m.toUpperCase()}</option>)}
              </select>
            )}
            <select value={txProofFilter} onChange={e => setTxProofFilter(e.target.value as typeof txProofFilter)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
              <option value="all">With or without proof</option>
              <option value="with">With proof</option>
              <option value="without">Without proof</option>
            </select>
          </div>

          {batchesLoading ? (
            <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          ) : batchRows.length === 0 ? (
            <NeuInset className="flex flex-col items-center text-center px-6 py-14">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={44} />
              <h2 className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink }}>No transactions yet</h2>
              <p className="mt-1 max-w-sm" style={mutedCaption}>Every payment attempt, Stripe checkout, manual proof, or organizer record, appears here once someone pays.</p>
            </NeuInset>
          ) : filteredBatches.length === 0 ? (
            <NeuInset small className="text-center px-6 py-8">
              <p style={{ ...mutedCaption, fontSize: 12 }}>No transactions match these filters.</p>
            </NeuInset>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredBatches.map(batch => {
                const expanded = expandedBatchIds.has(batch.id);
                const busy = txBusyIds.has(batch.id);
                return (
                  <NeuCard key={batch.id} style={{ padding: 0, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
                    <button
                      type="button"
                      onClick={() => toggleExpandedBatch(batch.id)}
                      className="w-full flex items-center gap-3 flex-wrap focus:outline-none"
                      style={{ padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <NeuIconDisc gradient={batch.method === 'stripe' ? NEU_GRADIENTS.forest : NEU_GRADIENTS.amber} icon={User} size={36} />
                      <div className="min-w-0" style={{ flex: '1 1 160px' }}>
                        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
                          {payerName(batch, payerNames)}
                        </p>
                        <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted }}>
                          {formatRowDate(batch.created_at)}
                        </p>
                      </div>

                      <span
                        className="px-2.5 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1"
                        style={{ backgroundColor: 'rgba(154,138,120,0.13)', color: '#6B5E4E', fontSize: 9, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
                      >
                        {batch.method === 'stripe' && <CreditCard size={10} strokeWidth={2.5} />}
                        {BATCH_METHOD_LABEL[batch.method] ?? batch.method.toUpperCase()}
                      </span>

                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                        {centsToFee(batch.total_cents, batch.currency)}
                      </span>

                      <TxStatusPill status={batch.status} />

                      {batch.method === 'manual' && batch.proof_path && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); openProof(batch); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openProof(batch); } }}
                          className="inline-flex items-center justify-center rounded-full flex-shrink-0 focus:outline-none"
                          style={{ width: 28, height: 28, border: '1px solid #DDD4C0', color: NEU.forest, cursor: 'pointer' }}
                          title="View payment proof"
                        >
                          <Eye size={13} />
                        </span>
                      )}
                    </button>

                    {expanded && (
                      <div style={{ padding: '0 18px 16px 18px', borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                        <div className="pt-3 flex flex-col gap-2">
                          {batch.payments.map(item => {
                            const inv = first(item.invoice);
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-3">
                                <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink }}>
                                  {inv ? invoiceLabel(inv) : 'Invoice'}
                                </span>
                                <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                                  {centsToFee(item.amount_cents, item.currency)}
                                </span>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between gap-3 pt-2 mt-1" style={{ borderTop: '1px dashed rgba(27,56,40,0.16)' }}>
                            <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>Total</span>
                            <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                              {centsToFee(batch.total_cents, batch.currency)}
                            </span>
                          </div>
                        </div>

                        {batch.method === 'manual' && batch.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(batch); }}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 focus:outline-none"
                              style={{
                                padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(61,122,82,0.35)',
                                backgroundColor: 'rgba(61,122,82,0.1)', color: '#2A5A3C',
                                fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.03em',
                                cursor: busy ? 'default' : 'pointer',
                              }}
                            >
                              <Check size={12} strokeWidth={2.6} />
                              APPROVE
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(batch); }}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 focus:outline-none"
                              style={{
                                padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(139,32,32,0.3)',
                                backgroundColor: 'rgba(139,32,32,0.06)', color: '#8B2020',
                                fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.03em',
                                cursor: busy ? 'default' : 'pointer',
                              }}
                            >
                              <X size={12} strokeWidth={2.6} />
                              REJECT
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </NeuCard>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
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

          {invoicesLoading ? (
            <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          ) : invoiceRows.length === 0 ? (
            <NeuInset className="flex flex-col items-center text-center px-6 py-14">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={44} />
              <h2 className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink }}>No invoices yet</h2>
              <p className="mt-1 max-w-sm" style={mutedCaption}>Invoices appear here once applicants owe something — registration, the application fee, or an add-on.</p>
            </NeuInset>
          ) : filteredInvoices.length === 0 ? (
            <NeuInset small className="text-center px-6 py-8">
              <p style={{ ...mutedCaption, fontSize: 12 }}>No invoices match these filters.</p>
            </NeuInset>
          ) : (
            <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
              {filteredInvoices.map((inv, i) => {
                const app = first(inv.application);
                const name = app?.profiles?.display_name ?? app?.invited_name ?? 'Unknown';
                const busy = busyIds.has(inv.id);
                const due = invoiceDueCents(inv);
                const canMarkPaid = !paymentsLive && (inv.status === 'open' || inv.status === 'partial');
                const canMarkUnpaid = !paymentsLive && inv.status === 'settled';
                const canRemoveSpot = (inv.kind === 'pledge_spot' || inv.kind === 'advisor_spot')
                  && inv.status === 'open' && inv.amount_paid_cents === 0 && inv.aid_applied_cents === 0;
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
                    {canRemoveSpot && (
                      <RemovePledgeAction onConfirm={() => handleRemovePledgeInvoice(inv)} />
                    )}
                  </div>
                );
              })}
            </NeuCard>
          )}
        </>
      )}

      {confirmModal}

      {proofBatch && (
        <ModalOverlay onClose={() => setProofBatch(null)}>
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Payment Proof</p>
              <button
                onClick={() => setProofBatch(null)}
                className="flex-shrink-0 focus:outline-none"
                style={{ color: '#9A8A78', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {proofLoading ? (
              <div className="rounded-xl animate-pulse" style={{ height: 260, backgroundColor: '#F0EDE6' }} />
            ) : proofError ? (
              <p className="text-sm" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{proofError}</p>
            ) : proofUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proofUrl}
                alt="Payment proof"
                className="w-full block rounded-xl"
                style={{ maxHeight: 500, objectFit: 'contain', backgroundColor: '#F0EDE6' }}
              />
            ) : null}
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
