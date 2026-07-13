// finance.ts — pure checkout math for conference fees, vouchers and the
// Gavelling platform fee. No I/O, no Supabase: everything here is a pure
// function so it can be unit-tested in isolation and reused verbatim when
// Stripe line items are built (see src/lib/payments.ts).
//
// currencySymbol/formatFee: the app's single source of truth already lives
// in src/lib/utils.ts (emailEvents-era duplicates were consolidated there,
// per its F14 comment) — we import and re-export rather than mirror.

import { currencySymbol, formatFee, formatFeeAmount } from '@/lib/utils';

export { currencySymbol, formatFee, formatFeeAmount };

/** Gavelling's platform fee: 5% of the post-discount total. */
export const PLATFORM_FEE_RATE = 0.05;

// ── Types ──────────────────────────────────────────────────────────────────

export interface VoucherInput {
  voucherId: string;
  code: string;
  kind: 'percent' | 'flat';
  /** percent: 1–100; flat: amount in the voucher's currency. */
  amount: number;
  /** flat vouchers only; null = currency-agnostic. */
  currency?: string | null;
}

export interface FinanceProfile {
  is_ambassador: boolean;
  unlimited_conferences_remaining: number;
  /** Optional: an active Unlimited subscription (unlimited_status !== 'none',
   *  not expired). Used only to suppress the upsell — the fee waiver itself
   *  keys off is_ambassador / unlimited_conferences_remaining. */
  has_active_subscription?: boolean;
}

export type WaiverSource = 'ambassador' | 'unlimited' | null;

export interface CheckoutBreakdown {
  currency: string;
  /** The role/conference registration fee. */
  baseFee: number;
  /** Amount taken off by the voucher (>= 0, <= baseFee). */
  voucherDiscount: number;
  /** baseFee - voucherDiscount. */
  postDiscount: number;
  /** The 5% Gavelling fee actually charged (0 when waived or baseFee is 0). */
  platformFee: number;
  platformFeeRate: number;
  platformFeeWaived: boolean;
  waiverSource: WaiverSource;
  /** postDiscount + platformFee. */
  total: number;
  /** Echo of the applied voucher, for line-item rendering + Stripe metadata. */
  voucher: VoucherInput | null;
}

// ── Phased fees ─────────────────────────────────────────────────────────────
// application_role_configs.fee_phases: jsonb array of
//   { label, start_date 'YYYY-MM-DD', end_date 'YYYY-MM-DD', amount }.
// If any phase's [start_date, end_date] window contains "today", that phase's
// amount is the role fee; empty array or a gap between phases falls back to
// the flat fee_amount.

export interface FeePhase {
  label: string;
  start_date: string;
  end_date: string;
  amount: number;
}

/** The phase whose date window contains `today` (local date), or null. */
export function activeFeePhase(phases: FeePhase[] | null | undefined, today: Date = new Date()): FeePhase | null {
  if (!phases || phases.length === 0) return null;
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return phases.find(p => p.start_date && p.end_date && p.start_date <= iso && iso <= p.end_date) ?? null;
}

/**
 * Resolve the fee a role charges today: the ACTIVE phase's amount when one
 * exists, otherwise the flat fee. Returns the resolved amount plus the phase
 * (for "Phase 1 Delegate Fee" style labels).
 */
export function activePhaseFee(
  roleConfig: { fee_amount: number | null; fee_phases?: FeePhase[] | null },
  today: Date = new Date()
): { amount: number; phase: FeePhase | null } {
  const phase = activeFeePhase(roleConfig.fee_phases, today);
  return { amount: phase ? Number(phase.amount) : (roleConfig.fee_amount ?? 0), phase };
}

// ── Math ───────────────────────────────────────────────────────────────────

/** Round to 2dp, avoiding float dust (0.1 + 0.2 style). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute the full line-item breakdown for a conference checkout.
 *
 * Waiver rules (also enforced server-side — see report/migration):
 *  - is_ambassador        → platform fee waived, always, forever.
 *  - unlimited_conferences_remaining > 0 → platform fee waived; the counter
 *    is decremented by a DB trigger when the application is actually PAID
 *    (applications.fee_waiver_source = 'unlimited'), never client-side.
 *  - Ambassador takes precedence (it never consumes an unlimited slot).
 */
export function computeCheckout({
  feeAmount,
  feeCurrency,
  voucher,
  profile,
}: {
  feeAmount: number;
  feeCurrency: string;
  voucher?: VoucherInput | null;
  profile: FinanceProfile;
}): CheckoutBreakdown {
  const baseFee = roundMoney(Math.max(0, feeAmount));

  // Voucher discount — clamped so the post-discount total never goes below 0.
  let voucherDiscount = 0;
  let appliedVoucher: VoucherInput | null = null;
  if (voucher && baseFee > 0) {
    if (voucher.kind === 'percent') {
      const pct = Math.min(100, Math.max(0, voucher.amount));
      voucherDiscount = roundMoney(baseFee * (pct / 100));
      appliedVoucher = voucher;
    } else {
      // Flat vouchers with an explicit currency only apply to matching fees;
      // currency-less flat vouchers are treated as fee-currency amounts.
      const currencyOk = !voucher.currency
        || voucher.currency.toUpperCase() === feeCurrency.toUpperCase();
      if (currencyOk) {
        voucherDiscount = roundMoney(Math.min(baseFee, Math.max(0, voucher.amount)));
        appliedVoucher = voucher;
      }
    }
  }

  const postDiscount = roundMoney(baseFee - voucherDiscount);

  // Platform fee: 5% of the post-discount total, waived for ambassadors
  // (always) or holders of remaining unlimited-conference credits.
  const waiverSource: WaiverSource = profile.is_ambassador
    ? 'ambassador'
    : profile.unlimited_conferences_remaining > 0
      ? 'unlimited'
      : null;
  const platformFeeWaived = waiverSource !== null;
  const rawPlatformFee = roundMoney(postDiscount * PLATFORM_FEE_RATE);
  const platformFee = platformFeeWaived || postDiscount <= 0 ? 0 : rawPlatformFee;

  return {
    currency: feeCurrency,
    baseFee,
    voucherDiscount,
    postDiscount,
    platformFee,
    platformFeeRate: PLATFORM_FEE_RATE,
    platformFeeWaived,
    waiverSource,
    total: roundMoney(postDiscount + platformFee),
    voucher: appliedVoucher,
  };
}

// ── Localized savings approximation (Gavin upsell) ─────────────────────────
// The upsell quotes "~$10/month" savings in the viewer's own currency. We
// don't need a live FX feed for a marketing approximation, so this is a
// small static table of ≈mid-2026 rates from USD, deliberately rounded to
// friendly price points. /api/geo gives the viewer's country; we map
// country → currency → localized figure. Anything unmapped falls back to USD.
// Rates (1 USD ≈): GBP 0.78, EUR 0.92, CAD 1.36, AUD 1.5, INR 84, TRY 34,
// JPY 155, CHF 0.88, SEK 10.5, NOK 10.7, DKK 6.9, PLN 4.0, CZK 23,
// MXN 18, BRL 5.5, ZAR 18, SGD 1.34, HKD 7.8, NZD 1.65, KRW 1350, AED 3.67.
const USD_FX: Record<string, number> = {
  USD: 1, GBP: 0.78, EUR: 0.92, CAD: 1.36, AUD: 1.5, INR: 84, TRY: 34,
  JPY: 155, CHF: 0.88, SEK: 10.5, NOK: 10.7, DKK: 6.9, PLN: 4.0, CZK: 23,
  MXN: 18, BRL: 5.5, ZAR: 18, SGD: 1.34, HKD: 7.8, NZD: 1.65, KRW: 1350,
  AED: 3.67, CNY: 7.2, PKR: 278, IDR: 16000,
};

// ── Offered currencies ──────────────────────────────────────────────────────
// The canonical list every currency picker in the app draws from — the world's
// most-used currencies plus Gavelling's key growth markets (India, Pakistan,
// Indonesia, the Gulf). Single source of truth so pickers never drift.
export interface CurrencyOption { code: string; symbol: string; label: string; }
export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'PKR', symbol: '₨', label: 'Pakistani Rupee' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah' },
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
];
export const CURRENCY_CODES: string[] = CURRENCIES.map((c) => c.code);

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
  NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR',
  SI: 'EUR', LU: 'EUR', LV: 'EUR', LT: 'EUR', EE: 'EUR', CY: 'EUR', MT: 'EUR',
  CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', TR: 'TRY', JP: 'JPY', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', MX: 'MXN', BR: 'BRL',
  ZA: 'ZAR', SG: 'SGD', HK: 'HKD', KR: 'KRW', AE: 'AED',
};

/**
 * "~$10/month" localized: converts a USD figure to the viewer's currency
 * (via their ISO country code from /api/geo) and rounds to a clean number.
 * Returns e.g. "≈ £8", "≈ €9", "≈ ₹850", "≈ $10".
 */
export function localizedApproxSavings(usdAmount: number, countryCode?: string | null): string {
  const cur = (countryCode && COUNTRY_CURRENCY[countryCode.toUpperCase()]) || 'USD';
  const rate = USD_FX[cur] ?? 1;
  const raw = usdAmount * rate;
  // Friendly rounding: big-denomination currencies snap to 50s, others to 1s.
  const rounded = raw >= 200 ? Math.round(raw / 50) * 50 : Math.round(raw);
  return `≈ ${currencySymbol(cur)}${rounded}`;
}
