'use client';

/**
 * Organiser financial dashboard — revenue overview, delegate estimate,
 * read-only payment pipeline and voucher management. Neumorphic throughout
 * (neu.tsx primitives); money math mirrors src/lib/finance.ts semantics
 * (voucher discounts clamp at zero, waived participants excluded).
 *
 * All figures can be re-displayed in another currency via the header
 * switcher — a static approximate FX table (see VouchersSection.tsx, which
 * mirrors finance.ts USD_FX). Stored values and voucher creation stay in the
 * conference currency; converted figures are prefixed with "≈".
 *
 * The Stripe seam is a single integration point consistent with
 * src/lib/payments.ts: conference.stripe_account_id null → connect teaser
 * (stub, "coming soon"); set → CONNECTED pill. No payment writes happen on
 * this page — marking paid stays on the Applications page.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BadgePercent, CircleCheck, Clock, CreditCard, Eye, Gavel,
  GraduationCap, HandCoins, Hourglass, PiggyBank, TrendingUp,
  User, Users, Wallet,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { roundMoney, formatFee, currencySymbol } from '@/lib/finance';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName } from '@/lib/countries';
import {
  NEU, NEU_GRADIENTS, OUTFIT,
  NeuCard, NeuInset, NeuStatTile, NeuProgress, NeuPill, NeuButton, NeuIconDisc,
} from '@/components/neu';
import VouchersSection, { convertApprox } from './VouchersSection';

// ── Types ──────────────────────────────────────────────────────────────────

interface FinRow {
  id: string;
  role: string;
  status: string;
  payment_status: string | null;
  fee_waiver_source: string | null;
  voucher_discount: number | null;
  submitted_at: string;
  /** True payment timestamp — set by newer payment flows only, so often null
   *  even on paid rows. Never faked: rows without it show the APPLIED date. */
  paid_at: string | null;
  /** Payment provenance (delegation flows, applications page):
   *  self_paid=true → participant funded their own fee; paid + self_paid=false
   *  + society_id → covered by a delegation pledge spot. */
  self_paid: boolean | null;
  society_id: string | null;
  stripe_payment_intent_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  profiles: { display_name: string } | null;
  assigned_committee: { name: string; abbreviation: string | null } | null;
}

// ── Money helpers (per-row, mirroring finance.ts) ──────────────────────────

/** What this participant owes/paid for the conference fee itself:
 *  base fee minus any recorded voucher discount, never below zero. */
function rowAmount(fee: number, r: FinRow): number {
  return roundMoney(Math.max(0, fee - (Number(r.voucher_discount) || 0)));
}

// ── Display helpers (conventions shared with applications/page.tsx) ────────

function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head Del.',
    'faculty-advisor': 'Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

function RoleIcon({ role, size = 10 }: { role: string; size?: number }) {
  const Icon = role === 'chair' ? Gavel
    : role === 'head-delegate' ? Users
    : role === 'faculty-advisor' ? GraduationCap
    : role === 'observer' ? Eye
    : User;
  return <Icon size={size} strokeWidth={2.5} />;
}

function roleTone(role: string) {
  return role === 'delegate' || role === 'head-delegate'
    ? { bg: 'rgba(42,90,60,0.14)', color: '#2A5A3C', border: 'rgba(42,90,60,0.38)' }
    : role === 'chair'
    ? { bg: 'rgba(182,135,31,0.16)', color: '#8A6614', border: 'rgba(182,135,31,0.42)' }
    : { bg: 'rgba(90,110,160,0.13)', color: '#4A5A85', border: 'rgba(90,110,160,0.35)' };
}

/** Committee shorthand — abbreviation when set, else a monogram of the name. */
function committeeAbbr(c: { name: string; abbreviation: string | null } | null): string {
  if (!c) return '—';
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

function CountryFlag({ name, code, size = 14 }: { name: string | null; code?: string | null; size?: number }) {
  const resolved = code || (name ? getCountryByName(name)?.code : undefined);
  if (!resolved) return null;
  return (
    <span title={name ?? resolved} className="inline-flex items-center flex-shrink-0" style={{ lineHeight: 0 }}>
      <FlagImg code={resolved} size={size} />
    </span>
  );
}

/** Cumulative sparkline — 12 buckets from first matching row to now. Rows
 *  are bucketed by paid_at when recorded (newer payment flows), otherwise by
 *  submission time (same approximation as the dashboard chart). */
function cumulativeSpark(rows: FinRow[], pick: (r: FinRow) => boolean, n = 12): number[] | undefined {
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

const chipStyle: React.CSSProperties = {
  fontSize: 9, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.08em',
  padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
};

function formatRowDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** HOW the money moved (or didn't) — derived from payment provenance columns.
 *  Mapping (in priority order):
 *   - paid + stripe_payment_intent_id     → STRIPE      (online checkout)
 *   - paid + self_paid                    → SELF-PAID   (participant funded own fee)
 *   - paid + !self_paid + society_id      → DELEGATION  (covered by a delegation pledge spot)
 *   - paid otherwise                      → MANUAL      (organiser marked paid, no provenance)
 *   - waived                              → fee_waiver_source (AMBASSADOR / UNLIMITED) when set
 *   - unpaid                              → no chip
 */
function paymentMethod(r: FinRow): { label: string; title: string } | null {
  if (r.payment_status === 'paid') {
    if (r.stripe_payment_intent_id) return { label: 'STRIPE', title: 'Paid online via Stripe checkout' };
    if (r.self_paid) return { label: 'SELF-PAID', title: 'Participant funded their own fee' };
    if (r.society_id) return { label: 'DELEGATION', title: 'Covered by a delegation pledge spot' };
    return { label: 'MANUAL', title: 'Marked paid manually on the Applications page' };
  }
  if (r.payment_status === 'waived' && r.fee_waiver_source) {
    return { label: r.fee_waiver_source.toUpperCase(), title: 'Fee waived by this entitlement' };
  }
  return null;
}

/** Displayed-currency options: conference currency first, then the majors. */
const BASE_CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP'];

const PIPELINE_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'PAID', value: 'paid' },
  { label: 'UNPAID', value: 'unpaid' },
  { label: 'WAIVED', value: 'waived' },
] as const;
type PipelineFilter = (typeof PIPELINE_FILTERS)[number]['value'];

// ── Page ───────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const [rows, setRows] = useState<FinRow[] | null>(null);
  const [filter, setFilter] = useState<PipelineFilter>('all');
  // Displayed currency — '' until the per-conference localStorage choice is
  // loaded; falls back to the conference currency. Display-only: stored
  // values and voucher creation always stay in the conference currency.
  const [displayCurrency, setDisplayCurrency] = useState('');

  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      // One batched query: everything the overview, estimate block and
      // pipeline table need. Vouchers load inside their own section.
      const { data } = await supabase
        .from('applications')
        .select(`
          id, role, status, payment_status, fee_waiver_source, voucher_discount, submitted_at,
          paid_at, self_paid, society_id, stripe_payment_intent_id,
          assigned_country_code, assigned_country_name,
          profiles (display_name),
          assigned_committee:conference_committees!assigned_committee_id (name, abbreviation)
        `)
        .eq('conference_id', conference.id)
        .order('submitted_at', { ascending: false });
      setRows((data ?? []) as unknown as FinRow[]);
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fee = conference?.fee_amount ?? 0;
  const currency = conference?.fee_currency ?? 'USD';

  // Load the persisted per-conference display currency (client-only).
  useEffect(() => {
    if (!conference) return;
    const stored = window.localStorage.getItem(`gavelling-fin-currency-${conference.slug}`);
    const options = [conference.fee_currency, ...BASE_CURRENCY_OPTIONS];
    setDisplayCurrency(stored && options.includes(stored) ? stored : conference.fee_currency);
  }, [conference?.slug, conference?.fee_currency]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived money figures ────────────────────────────────────────────────
  const fin = useMemo(() => {
    const all = rows ?? [];
    // Rejected applications drop out of the pipeline entirely — except paid
    // ones, whose money was still collected.
    const live = all.filter(r => r.status !== 'rejected' || r.payment_status === 'paid');

    const paidRows = live.filter(r => r.payment_status === 'paid');
    const pendingRows = live.filter(
      r => (r.status === 'accepted' || r.status === 'assigned') && r.payment_status === 'unpaid'
    );
    const waivedRows = live.filter(r => r.payment_status === 'waived');

    const collected = roundMoney(paidRows.reduce((s, r) => s + rowAmount(fee, r), 0));
    const pending = roundMoney(pendingRows.reduce((s, r) => s + rowAmount(fee, r), 0));
    const waived = roundMoney(waivedRows.length * fee);
    const expectedTotal = roundMoney(collected + pending);

    // Delegate estimate — expected_delegates is the organiser's own estimate
    // of DELEGATES, so reality is measured on the delegate pool only.
    const delegateRows = live.filter(r => r.role === 'delegate' || r.role === 'head-delegate');
    const acceptedDelegates = delegateRows.filter(r => r.status === 'accepted' || r.status === 'assigned').length;
    const paidDelegates = delegateRows.filter(r => r.payment_status === 'paid').length;

    return {
      live, paidRows, pendingRows, waivedRows,
      collected, pending, waived, expectedTotal,
      acceptedDelegates, paidDelegates,
    };
  }, [rows, fee]);

  if (!conference) return null;

  const loading = rows === null;
  const stripeConnected = !!conference.stripe_account_id;
  const expectedDelegates = conference.expected_delegates || 0;

  // ── Display-currency conversion (approximate, display-only) ─────────────
  // Switcher only renders when the conference currency has a known FX rate.
  const dispCur = displayCurrency || currency;
  const converted = dispCur !== currency;
  const fxAvailable = convertApprox(1, currency, 'USD') !== null;
  const currencyOptions = fxAvailable
    ? [currency, ...BASE_CURRENCY_OPTIONS.filter(c => c !== currency)]
    : [currency];

  function pickCurrency(c: string) {
    setDisplayCurrency(c);
    window.localStorage.setItem(`gavelling-fin-currency-${conference!.slug}`, c);
  }

  /** Format an amount (stored in the conference currency) for display —
   *  converted values carry an "≈" prefix; unconvertible ones stay as-is. */
  const money = (n: number): string => {
    if (!converted) return formatFee(n, currency);
    const c = convertApprox(n, currency, dispCur);
    return c === null ? formatFee(n, currency) : `≈ ${formatFee(c, dispCur)}`;
  };

  const pipelineRows = fin.live.filter(r => {
    if (filter === 'paid') return r.payment_status === 'paid';
    if (filter === 'unpaid') return r.payment_status === 'unpaid';
    if (filter === 'waived') return r.payment_status === 'waived';
    return true;
  });

  const mutedCaption: React.CSSProperties = {
    fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.55,
  };

  return (
    <div className="px-6 md:px-10 py-8">
      <div style={{ maxWidth: 1020, margin: '0 auto' }}>

        {/* ── 1 · Header + Stripe seam ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <p
              className="mb-1"
              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}
            >
              {conference.acronym} · Financials
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: NEU.ink, letterSpacing: '-0.01em' }}>
                Financials
              </h1>
              {/* Display-currency switcher — conference currency + majors. */}
              <div className="flex items-center gap-1.5">
                {currencyOptions.map(c => (
                  <NeuPill
                    key={c}
                    active={dispCur === c}
                    gradient={NEU_GRADIENTS.forest}
                    onClick={currencyOptions.length > 1 ? () => pickCurrency(c) : undefined}
                  >
                    {currencySymbol(c)} {c}
                  </NeuPill>
                ))}
              </div>
              {stripeConnected && (
                <NeuPill active gradient={NEU_GRADIENTS.green}>
                  <CircleCheck size={11} strokeWidth={2.6} />
                  STRIPE CONNECTED
                </NeuPill>
              )}
            </div>
            {converted && (
              <p className="mt-1" style={mutedCaption}>
                Approximate conversion — payments settle in {currency}.
              </p>
            )}
          </div>
        </div>

        {/* Stripe connect teaser — the single integration seam (payments.ts) */}
        {!stripeConnected && (
          <div
            className="flex items-center gap-4 flex-wrap rounded-[20px] px-5 py-4 mb-6"
            style={{
              background: 'linear-gradient(150deg, #16301F 0%, #1B3828 52%, #2A5A3C 100%)',
              boxShadow: '0 2px 8px rgba(27,56,40,0.14), 0 16px 40px rgba(27,56,40,0.22)',
            }}
          >
            <span
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 44, height: 44,
                background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.34) 0%, rgba(27,56,40,0) 74%)',
                border: '1.5px solid rgba(238,217,138,0.5)',
              }}
            >
              <Wallet size={20} strokeWidth={2} style={{ color: NEU.gold }} />
            </span>
            <div className="flex-1 min-w-[220px]">
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: '#FAF8F3', lineHeight: 1.3 }}>
                Connect Stripe to collect payments automatically
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: 'rgba(250,248,243,0.68)', lineHeight: 1.5 }}>
                Until then, mark payments manually on the Applications page — every figure below stays accurate either way.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <NeuButton icon={CreditCard} disabled gradient={NEU_GRADIENTS.gold}>
                CONNECT
              </NeuButton>
              <span style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(238,217,138,0.65)' }}>
                COMING SOON
              </span>
            </div>
          </div>
        )}

        {/* ── 2 · Revenue overview ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-[22px] animate-pulse" style={{ height: 118, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            <NeuStatTile
              emoji="Money bag"
              icon={PiggyBank}
              gradient={NEU_GRADIENTS.green}
              value={money(fin.collected)}
              label={`Collected · ${fin.paidRows.length} paid`}
              spark={cumulativeSpark(rows ?? [], r => r.payment_status === 'paid')}
            />
            <NeuStatTile
              emoji="Hourglass not done"
              icon={Hourglass}
              gradient={NEU_GRADIENTS.amber}
              value={money(fin.pending)}
              label={`Pending · ${fin.pendingRows.length} accepted unpaid`}
              spark={cumulativeSpark(rows ?? [], r => (r.status === 'accepted' || r.status === 'assigned') && r.payment_status === 'unpaid')}
            />
            <NeuStatTile
              emoji="Money with wings"
              icon={HandCoins}
              gradient={NEU_GRADIENTS.sage}
              value={money(fin.waived)}
              label={`Waived · ${fin.waivedRows.length} fee${fin.waivedRows.length === 1 ? '' : 's'} forgone`}
              style={{ opacity: 0.72 }}
            />
            <NeuStatTile
              emoji="Chart increasing"
              icon={TrendingUp}
              gradient={NEU_GRADIENTS.gold}
              value={money(fin.expectedTotal)}
              label="Expected total · collected + pending"
              spark={cumulativeSpark(rows ?? [], r =>
                r.payment_status === 'paid'
                || ((r.status === 'accepted' || r.status === 'assigned') && r.payment_status === 'unpaid'))}
            />
          </div>
        )}

        {/* ── 3 · Delegate estimate block ── */}
        <NeuCard style={{ padding: '20px 22px', marginTop: 20, marginBottom: 32 }}>
          <div className="flex items-center gap-3 mb-4">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users} emoji="Busts in silhouette" size={36} />
            <div>
              <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 16, color: NEU.ink, lineHeight: 1.2 }}>
                Delegate estimate vs reality
              </h2>
              <p style={mutedCaption}>
                Your estimate of {expectedDelegates} delegates comes from the conference settings.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl animate-pulse" style={{ height: 84, backgroundColor: NEU.base, boxShadow: NEU.inSm }} />
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {fin.acceptedDelegates} accepted · {fin.paidDelegates} paid
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                  estimate {expectedDelegates}
                </p>
              </div>
              <NeuProgress value={fin.acceptedDelegates} max={Math.max(1, expectedDelegates)} thumb height={12} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <NeuInset small className="px-4 py-3">
                  <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
                    Projected revenue at estimate
                  </p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                    {money(roundMoney(expectedDelegates * fee))}
                  </p>
                  <p style={mutedCaption}>
                    {expectedDelegates} delegates × {money(fee)} fee — assumes every
                    delegate pays the full fee, before vouchers and waivers.
                  </p>
                </NeuInset>
                <NeuInset small className="px-4 py-3">
                  <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
                    Revenue at current acceptance
                  </p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: NEU.forest, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                    {money(roundMoney(fin.acceptedDelegates * fee))}
                  </p>
                  <p style={mutedCaption}>
                    {fin.acceptedDelegates} accepted delegate{fin.acceptedDelegates === 1 ? '' : 's'} × {money(fee)} —
                    same full-fee assumption; the tiles above show actual discounted figures.
                  </p>
                </NeuInset>
              </div>
            </>
          )}
        </NeuCard>

        {/* ── 4 · Payment pipeline ── */}
        <section className="mb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-3">
              <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={HandCoins} emoji="Receipt" size={36} />
              <div>
                <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
                  Payment pipeline
                </h2>
                <p style={mutedCaption}>
                  Read-only here — mark payments on the{' '}
                  <Link
                    href={`/manage/${conference.slug}/applications`}
                    style={{ color: NEU.forest, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}
                  >
                    Applications page
                  </Link>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {PIPELINE_FILTERS.map(f => (
                <NeuPill key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
                  {f.label}
                </NeuPill>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          ) : fin.live.length === 0 ? (
            <NeuInset className="flex flex-col items-center text-center px-6 py-10">
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>
                No applications yet
              </p>
              <p className="mt-1 max-w-sm" style={{ ...mutedCaption, fontSize: 11.5 }}>
                Fees appear here as people apply. Share your conference page to start filling the pipeline.
              </p>
              <Link
                href={`/manage/${conference.slug}/applications`}
                className="inline-flex items-center gap-1.5 mt-4"
                style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: NEU.forest, textDecoration: 'none' }}
              >
                GO TO APPLICATIONS <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </NeuInset>
          ) : pipelineRows.length === 0 ? (
            <NeuInset small className="text-center px-6 py-8">
              <p style={{ ...mutedCaption, fontSize: 12 }}>
                No {filter} applications right now.
              </p>
            </NeuInset>
          ) : (
            <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
              {pipelineRows.map((r, i) => {
                const paid = r.payment_status === 'paid';
                const waived = r.payment_status === 'waived';
                const amount = rowAmount(fee, r);
                const discounted = (Number(r.voucher_discount) || 0) > 0;
                // True paid_at when recorded; otherwise the application date,
                // labelled APPLIED so it never masquerades as a payment date.
                const hasPaidAt = paid && !!r.paid_at;
                const method = paymentMethod(r);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 flex-wrap px-5 py-2.5"
                    style={i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : undefined}
                  >
                    {/* Name */}
                    <span
                      className="truncate"
                      style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, flex: '1 1 140px', minWidth: 120 }}
                    >
                      {r.profiles?.display_name ?? 'Unknown'}
                    </span>

                    {/* Role chip */}
                    <span
                      className="inline-flex items-center gap-1"
                      style={{
                        ...chipStyle,
                        backgroundColor: roleTone(r.role).bg,
                        color: roleTone(r.role).color,
                        border: `1px solid ${roleTone(r.role).border}`,
                      }}
                    >
                      <RoleIcon role={r.role} />
                      {roleLabel(r.role).toUpperCase()}
                    </span>

                    {/* Committee + flag */}
                    <span
                      className="inline-flex items-center gap-1.5"
                      title={r.assigned_committee?.name ?? undefined}
                      style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.muted, minWidth: 64 }}
                    >
                      {committeeAbbr(r.assigned_committee)}
                      <CountryFlag name={r.assigned_country_name} code={r.assigned_country_code} />
                    </span>

                    {/* Date — real payment date when recorded, else application date */}
                    <span
                      className="inline-flex items-baseline gap-1.5"
                      title={hasPaidAt ? 'Payment recorded on this date' : 'Application submitted on this date — no payment date recorded'}
                      style={{ minWidth: 118 }}
                    >
                      <span style={{ fontFamily: OUTFIT, fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, opacity: 0.85 }}>
                        {hasPaidAt ? 'PAID' : 'APPLIED'}
                      </span>
                      <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRowDate(hasPaidAt ? r.paid_at! : r.submitted_at)}
                      </span>
                    </span>

                    {/* Amount */}
                    <span
                      title={discounted ? `Voucher discount of ${money(Number(r.voucher_discount) || 0)} applied` : undefined}
                      style={{
                        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900,
                        color: waived ? NEU.muted : NEU.ink,
                        textDecoration: waived ? 'line-through' : 'none',
                        textDecorationColor: 'rgba(154,138,120,0.55)',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: 64, textAlign: 'right', marginLeft: 'auto',
                      }}
                    >
                      {money(waived ? fee : amount)}
                      {discounted && !waived && (
                        <BadgePercent size={11} strokeWidth={2.5} style={{ display: 'inline', marginLeft: 4, color: NEU.deepGold, verticalAlign: '-1.5px' }} />
                      )}
                    </span>

                    {/* Status chip */}
                    {waived ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ ...chipStyle, backgroundColor: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.42)' }}
                      >
                        <HandCoins size={10} strokeWidth={2.5} />
                        WAIVED
                      </span>
                    ) : paid ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ ...chipStyle, backgroundColor: 'rgba(61,122,82,0.17)', color: '#2A5A3C', border: '1px solid rgba(61,122,82,0.45)' }}
                      >
                        <CircleCheck size={10} strokeWidth={2.5} />
                        PAID
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ ...chipStyle, backgroundColor: 'rgba(184,132,74,0.12)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.3)' }}
                      >
                        <Clock size={10} strokeWidth={2.5} />
                        UNPAID
                      </span>
                    )}

                    {/* Method chip — HOW the payment happened (see paymentMethod) */}
                    {method && (
                      <span
                        title={method.title}
                        style={{
                          ...chipStyle, fontSize: 8.5,
                          backgroundColor: 'rgba(154,138,120,0.13)', color: '#6B5E4E',
                          border: '1px solid rgba(154,138,120,0.35)',
                        }}
                      >
                        {method.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </NeuCard>
          )}
        </section>

        {/* ── 5 · Vouchers ── */}
        <VouchersSection conference={conference} displayCurrency={dispCur} />
      </div>
    </div>
  );
}
