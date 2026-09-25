'use client';

/**
 * Shared types, money/display helpers, and data hooks for every route under
 * /manage/[slug]/financials (Overview, History, Invoices, Settings). Money
 * math mirrors src/lib/finance.ts semantics (voucher discounts clamp at
 * zero, waived participants excluded). See financials/layout.tsx for the
 * page shell (header, currency switcher, sub-nav) that wraps every route in
 * FinancialsCurrencyProvider.
 */

import {
  createContext, useContext, useState, useEffect, useMemo, type ReactNode,
} from 'react';
import {
  Eye, Gavel, GraduationCap, User, Users,
} from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { roundMoney, formatFee, CURRENCY_CODES } from '@/lib/finance';
import { useConferenceMoney, moneyFromCents, moneyByApplication } from '@/lib/conferenceMoney';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName } from '@/lib/countries';
import { NEU, OUTFIT } from '@/components/neu';
import { convertApprox } from './VouchersSection';

export { convertApprox };

// ── Types ──────────────────────────────────────────────────────────────────

export interface FinRow {
  id: string;
  role: string;
  status: string;
  payment_status: string | null;
  fee_waiver_source: string | null;
  voucher_discount: number | null;
  submitted_at: string;
  /** True payment timestamp, set by newer payment flows only, so often null
   *  even on paid rows. Never faked: rows without it show the APPLIED date. */
  paid_at: string | null;
  /** Payment provenance (delegation flows, applications page):
   *  self_paid=true → participant funded their own fee; paid + self_paid=false
   *  + society_id → covered by a delegation pledge spot. */
  self_paid: boolean | null;
  society_id: string | null;
  stripe_payment_intent_id: string | null;
  /** Money actually collected on this application. 0 on a free registration,
   *  which the database stamps 'paid' on arrival — so "paid" alone no longer
   *  means "money changed hands". */
  amount_paid: number | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  profiles: { display_name: string } | null;
  assigned_committee: { name: string; abbreviation: string | null } | null;
}

// ── Money helpers (per-row, mirroring finance.ts) ──────────────────────────

/** What this participant owes/paid for the conference fee itself:
 *  base fee minus any recorded voucher discount, never below zero. */
export function rowAmount(fee: number, r: FinRow): number {
  return roundMoney(Math.max(0, fee - (Number(r.voucher_discount) || 0)));
}

// ── Display helpers (conventions shared with applications/page.tsx) ────────

export function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head Del.',
    'faculty-advisor': 'Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

export function RoleIcon({ role, size = 10 }: { role: string; size?: number }) {
  const Icon = role === 'chair' ? Gavel
    : role === 'head-delegate' ? Users
    : role === 'faculty-advisor' ? GraduationCap
    : role === 'observer' ? Eye
    : User;
  return <Icon size={size} strokeWidth={2.5} />;
}

export function roleTone(role: string) {
  return role === 'delegate' || role === 'head-delegate'
    ? { bg: 'rgba(42,90,60,0.14)', color: '#2A5A3C', border: 'rgba(42,90,60,0.38)' }
    : role === 'chair'
    ? { bg: 'rgba(182,135,31,0.16)', color: '#8A6614', border: 'rgba(182,135,31,0.42)' }
    : { bg: 'rgba(90,110,160,0.13)', color: '#4A5A85', border: 'rgba(90,110,160,0.35)' };
}

/** Committee shorthand, abbreviation when set, else a monogram of the name. */
export function committeeAbbr(c: { name: string; abbreviation: string | null } | null): string {
  if (!c) return '–';
  if (c.abbreviation) return c.abbreviation;
  const mono = c.name
    .split(/\s+/)
    .filter(w => /^[A-Za-z0-9]/.test(w))
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return mono || c.name.slice(0, 4).toUpperCase();
}

export function CountryFlag({ name, code, size = 14 }: { name: string | null; code?: string | null; size?: number }) {
  const resolved = code || (name ? getCountryByName(name)?.code : undefined);
  if (!resolved) return null;
  return (
    <span title={name ?? resolved} className="inline-flex items-center flex-shrink-0" style={{ lineHeight: 0 }}>
      <FlagImg code={resolved} size={size} />
    </span>
  );
}

/** Cumulative sparkline, 12 buckets from first matching row to now. Rows
 *  are bucketed by paid_at when recorded (newer payment flows), otherwise by
 *  submission time (same approximation as the dashboard chart). */
export function cumulativeSpark(rows: FinRow[], pick: (r: FinRow) => boolean, n = 12): number[] | undefined {
  const times = rows
    .filter(pick)
    .map(r => new Date(r.paid_at ?? r.submitted_at).getTime())
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return undefined;
  const start = times[0];
  const span = Math.max(1, Date.now() - start);
  const buckets = new Array<number>(n).fill(0);
  for (const t of times) {
    buckets[Math.min(n - 1, Math.floor(((t - start) / span) * n))] += 1;
  }
  let acc = 0;
  return buckets.map(v => (acc += v));
}

export const chipStyle: React.CSSProperties = {
  fontSize: 9, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.08em',
  padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
};

export function formatRowDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** HOW the money moved (or didn't). `money` is what the payments ledger holds
 *  for this application (useInvoiceTotals().byApplication); when it is given,
 *  it decides, because payment_status 'paid' alone is not money:
 *   - received through Gavelling > 0      → STRIPE
 *   - recorded offline > 0                → OFFLINE   (organiser marked paid / approved proof)
 *   - paid, no money, delegation, !self   → DELEGATION (covered by a pledge spot)
 *   - paid, no money otherwise            → NO PAYMENT (a free role, or marked paid with nothing recorded)
 *   - waived                              → fee_waiver_source (AMBASSADOR / UNLIMITED) when set
 *   - unpaid                              → no chip
 *  Without `money` (not loaded yet) it falls back to the provenance columns. */
export function paymentMethod(
  r: FinRow,
  money?: { received: number; offline: number } | null,
): { label: string; title: string } | null {
  if (r.payment_status === 'paid') {
    if (money !== undefined) {
      if (money && money.received > 0) return { label: 'STRIPE', title: 'Paid online through Gavelling' };
      if (money && money.offline > 0) return { label: 'OFFLINE', title: 'Recorded as paid outside Gavelling (marked paid or proof approved)' };
      if (r.society_id && !r.self_paid) return { label: 'DELEGATION', title: 'Covered by a delegation pledge spot, no payment of its own' };
      return { label: 'NO PAYMENT', title: 'Registered with no money received: a free role, or marked paid with no payment recorded' };
    }
    if (r.stripe_payment_intent_id) return { label: 'STRIPE', title: 'Paid online via Stripe checkout' };
    if (r.society_id && !r.self_paid) return { label: 'DELEGATION', title: 'Covered by a delegation pledge spot' };
    return { label: 'MANUAL', title: 'Marked paid manually on the Applications page' };
  }
  if (r.payment_status === 'waived' && r.fee_waiver_source) {
    return { label: r.fee_waiver_source.toUpperCase(), title: 'Fee waived by this entitlement' };
  }
  return null;
}

export const PIPELINE_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'PAID', value: 'paid' },
  { label: 'UNPAID', value: 'unpaid' },
  { label: 'WAIVED', value: 'waived' },
] as const;
export type PipelineFilter = (typeof PIPELINE_FILTERS)[number]['value'];

export type ConnectStatus = 'none' | 'pending' | 'complete';

// Neumorphic input well, pressed-in, transparent field inside (mirrors VouchersSection's inputStyle).
export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 12,
  border: 'none',
  outline: 'none',
  backgroundColor: NEU.base,
  boxShadow: NEU.inSm,
  color: NEU.ink,
  fontFamily: OUTFIT,
  fontSize: 13,
  fontWeight: 600,
};

export const fieldLabelStyle: React.CSSProperties = {
  fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
  color: NEU.muted, textTransform: 'uppercase', display: 'block', marginBottom: 6,
};

export const MAX_PAYMENT_NOTE_LENGTH = 500;

export const mutedCaption: React.CSSProperties = {
  fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.55,
};

// ── useFinancialsData ────────────────────────────────────────────────────────
// One batched query: everything the overview, estimate block, pipeline and
// history table need. Vouchers load inside their own section.

export function useFinancialsData() {
  const { conference } = useManage();
  const { session } = useAuth();
  const [rows, setRows] = useState<FinRow[] | null>(null);

  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data } = await supabase
        .from('applications')
        .select(`
          id, role, status, payment_status, fee_waiver_source, voucher_discount, submitted_at,
          paid_at, self_paid, society_id, stripe_payment_intent_id, amount_paid,
          assigned_country_code, assigned_country_name,
          profiles (display_name),
          assigned_committee:conference_committees!assigned_committee_id (name, abbreviation)
        `)
        .eq('conference_id', conference.id)
        .order('submitted_at', { ascending: false });
      setRows((data ?? []) as unknown as FinRow[]);
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived money figures ────────────────────────────────────────────────
  const fin = useMemo(() => {
    const all = rows ?? [];
    // Rejected and withdrawn applications drop out of the pipeline entirely,
    // except ones whose money was still collected. That exception now tests
    // amount_paid, not payment_status alone: a free registration is stamped
    // 'paid' with nothing paid, so status alone would drag every rejected and
    // withdrawn free applicant back into the collected figures.
    const live = all.filter(r => (r.status !== 'rejected' && r.status !== 'withdrawn')
      || (r.payment_status === 'paid' && (r.amount_paid ?? 0) > 0));

    const paidRows = live.filter(r => r.payment_status === 'paid');
    const pendingRows = live.filter(
      r => (r.status === 'accepted' || r.status === 'assigned') && r.payment_status === 'unpaid'
    );
    const waivedRows = live.filter(r => r.payment_status === 'waived');

    // No money figures here on purpose: paid rows x fee counted every free
    // chair as income. Money comes from useInvoiceTotals (the payments ledger).

    // Delegate estimate, expected_delegates is the organiser's own estimate
    // of DELEGATES, so reality is measured on the delegate pool only.
    const delegateRows = live.filter(r => r.role === 'delegate' || r.role === 'head-delegate');
    const acceptedDelegates = delegateRows.filter(r => r.status === 'accepted' || r.status === 'assigned').length;
    const paidDelegates = delegateRows.filter(r => r.payment_status === 'paid').length;

    return {
      live, paidRows, pendingRows, waivedRows,
      acceptedDelegates, paidDelegates,
    };
  }, [rows]);

  const loading = rows === null;

  return { rows, fin, loading };
}

// ── useInvoiceTotals ─────────────────────────────────────────────────────────
// The Overview stat tiles, from conference_money_summary()
// (src/lib/conferenceMoney.ts), the same definition the dashboard money card
// and /admin use. Invoices are synced first, as before.
//   received     succeeded Stripe payments: money that came in THROUGH Gavelling
//   offline      organiser mark-paid / approved proof: recorded, not received here
//   pending      open balances of ACCEPTED participants' invoices
//   waived       waived invoices of live applications
// It used to sum invoices.amount_paid_cents, which counted offline mark-paids as
// collected (and is not a payment record at all). payment_status 'paid' is never
// money: a free chair is stamped paid on arrival.
// Only the conference's own currency is shown; other currencies are listed by
// the RPC (other_currencies) and never added in.

export interface InvoiceTotals {
  received: number;
  receivedCount: number;
  offline: number;
  offlineCount: number;
  pending: number;
  pendingCount: number;
  waived: number;
  waivedCount: number;
  /** Money per application (received + offline), conference currency. */
  byApplication: Map<string, { received: number; offline: number }>;
}

export function useInvoiceTotals() {
  const { conference } = useManage();
  const { session } = useAuth();
  const { money, loading } = useConferenceMoney(session?.access_token, conference?.id, {
    detail: true,
    beforeRead: async (c) => {
      if (conference) await c.rpc('sync_conference_invoices', { p_conference_id: conference.id });
    },
  });
  const totals = useMemo<InvoiceTotals | null>(() => money && ({
    received: moneyFromCents(money.received_cents),
    receivedCount: money.received_count,
    offline: moneyFromCents(money.offline_cents),
    offlineCount: money.offline_count,
    pending: moneyFromCents(money.outstanding_cents),
    pendingCount: money.outstanding_count,
    waived: moneyFromCents(money.waived_cents),
    waivedCount: money.waived_count,
    byApplication: moneyByApplication(money),
  }), [money]);
  return { totals, loading };
}

// ── FinancialsCurrencyContext ────────────────────────────────────────────────
// All figures can be re-displayed in another currency via the header
// switcher, a static approximate FX table (see VouchersSection.tsx, which
// mirrors finance.ts USD_FX). Stored values and voucher creation stay in the
// conference currency; converted figures are prefixed with "≈".

interface FinancialsCurrencyContextValue {
  /** The conference's own stored currency (never changes). */
  currency: string;
  /** Resolved display currency, defaults to `currency` once loaded. */
  displayCurrency: string;
  setDisplayCurrency: (c: string) => void;
  /** Conference currency first, then the rest of CURRENCY_CODES, collapses
   *  to just the conference currency when no FX rate is known for it. */
  currencyOptions: string[];
  /** True once the picked display currency differs from the stored one. */
  converted: boolean;
  fxAvailable: boolean;
  /** Format an amount stored in the conference currency for display —
   *  converted values carry an "≈" prefix; unconvertible ones stay as-is. */
  disp: (n: number) => string;
}

const FinancialsCurrencyContext = createContext<FinancialsCurrencyContextValue | null>(null);

export function FinancialsCurrencyProvider({ conference, children }: { conference: Conference; children: ReactNode }) {
  const currency = conference.fee_currency ?? 'USD';
  // Displayed currency, '' until the per-conference localStorage choice is
  // loaded; falls back to the conference currency. Display-only: stored
  // values and voucher creation always stay in the conference currency.
  const [displayCurrencyState, setDisplayCurrencyState] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      const stored = window.localStorage.getItem(`gavelling-fin-currency-${conference.slug}`);
      const options = [currency, ...CURRENCY_CODES];
      setDisplayCurrencyState(stored && options.includes(stored) ? stored : currency);
    }, 0);
    return () => clearTimeout(id);
  }, [conference.slug, currency]);

  function setDisplayCurrency(c: string) {
    setDisplayCurrencyState(c);
    window.localStorage.setItem(`gavelling-fin-currency-${conference.slug}`, c);
  }

  const displayCurrency = displayCurrencyState || currency;
  const converted = displayCurrency !== currency;
  const fxAvailable = convertApprox(1, currency, 'USD') !== null;
  const currencyOptions = fxAvailable
    ? [currency, ...CURRENCY_CODES.filter(c => c !== currency)]
    : [currency];

  function disp(n: number): string {
    if (!converted) return formatFee(n, currency);
    const c = convertApprox(n, currency, displayCurrency);
    return c === null ? formatFee(n, currency) : `≈ ${formatFee(c, displayCurrency)}`;
  }

  const value: FinancialsCurrencyContextValue = {
    currency, displayCurrency, setDisplayCurrency, currencyOptions, converted, fxAvailable, disp,
  };

  return (
    <FinancialsCurrencyContext.Provider value={value}>
      {children}
    </FinancialsCurrencyContext.Provider>
  );
}

export function useFinancialsCurrency(): FinancialsCurrencyContextValue {
  const ctx = useContext(FinancialsCurrencyContext);
  if (!ctx) throw new Error('useFinancialsCurrency must be used within FinancialsCurrencyProvider');
  return ctx;
}
