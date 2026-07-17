// payments.ts — the Stripe-in-a-heartbeat seam.
//
// ALL payment UI must consume ONLY this module (+ src/lib/finance.ts for the
// pure fee math). The provider is selected here, in one place. Stripe is now
// live: createCheckout invokes the deployed `create-checkout` edge function,
// which recomputes every amount server-side (active fee phase, voucher,
// surcharge, partial clamp) and mints a real Checkout Session. The client
// never does money math for what actually gets charged — it only mirrors
// that math (via finance.ts) to render a preview.

import { getAuthedClient } from '@/lib/supabase-auth';
import { formatFee } from '@/lib/finance';

// ── Provider seam ──────────────────────────────────────────────────────────

export type PaymentProvider = 'manual' | 'stripe';

export const ACTIVE_PROVIDER: PaymentProvider = 'stripe';

/**
 * Conferences that stay on manual payment confirmation even while Stripe is
 * the global active provider (e.g. test/demo conferences that shouldn't hit
 * real checkout). Add a conference id here to re-enable manual mode for it
 * without touching ACTIVE_PROVIDER globally.
 */
export const MANUAL_MODE_CONFERENCE_IDS = new Set<string>([]);

/**
 * ISO-2 codes of countries whose bank accounts Stripe Connect can pay out to
 * from our UK platform (self-serve cross-border payouts: UK, US, Canada,
 * Switzerland, plus the EEA). Conferences based elsewhere (India, Pakistan,
 * LATAM, etc.) stay on manual payments. Update this list when Stripe expands
 * cross-border payout coverage for UK platforms.
 */
export const SUPPORTED_PAYOUT_COUNTRIES = new Set<string>([
  'GB', 'US', 'CA', 'CH',
  // EEA
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** ISO-2 codes of countries Stripe Connect actually supports for onboarding
 *  a merchant account (not just cross-border payouts to our UK platform —
 *  this is the full "where can a conference open its own Stripe account"
 *  list). The Financials "Onboard payments" flow gates its Stripe-vs-manual
 *  branch on this set; SUPPORTED_PAYOUT_COUNTRIES stays for whatever other
 *  callers still reference it. */
export const STRIPE_CONNECT_COUNTRIES = new Set<string>([
  'AU', 'AT', 'BE', 'BR', 'BG', 'CA', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
  'FR', 'DE', 'GI', 'GR', 'HK', 'HU', 'IE', 'IT', 'JP', 'LV', 'LI', 'LT',
  'LU', 'MY', 'MT', 'MX', 'NL', 'NZ', 'NO', 'PL', 'PT', 'RO', 'SG', 'SK',
  'SI', 'ES', 'SE', 'CH', 'TH', 'AE', 'GB', 'US',
]);

/** Whether Stripe Connect onboarding is offered for this payout country —
 *  the gate the Financials "Onboard payments" flow uses to decide between
 *  showing the Stripe card or manual-only. */
export function isStripeCountrySupported(code: string | null | undefined): boolean {
  return !!code && STRIPE_CONNECT_COUNTRIES.has(code.toUpperCase());
}

/** ISO-2 codes charged Gavelling Unlimited's region A price (EU/EEA +
 *  Switzerland, UK, US, Middle East). Everyone else pays region B. Mirrors
 *  create-subscription-checkout v2, which prices by the BUYER's location and
 *  is the pricing authority — this list is DISPLAY ONLY. */
export const UNLIMITED_REGION_A = new Set<string>([
  // EU 27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
  // Rest of EEA + Switzerland, UK, US
  'NO', 'IS', 'LI', 'CH', 'GB', 'US',
  // Middle East
  'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'IL', 'JO', 'LB', 'IQ', 'TR', 'EG',
]);

/** Gavelling Unlimited pricing for display purposes only — the server
 *  (create-subscription-checkout) recomputes and enforces the real price by
 *  the buyer's location. Keep in sync with that function: region A when the
 *  code is in UNLIMITED_REGION_A, or when the code is null/unknown (missing
 *  geo defaults to region A, same as the server), else region B. */
export function unlimitedPricing(countryCode: string | null): { monthly: number; yearly: number; currency: string } {
  const code = countryCode?.toUpperCase();
  const isRegionA = !code || UNLIMITED_REGION_A.has(code);
  return isRegionA
    ? { monthly: 5, yearly: 45, currency: 'USD' }
    : { monthly: 2.5, yearly: 25, currency: 'USD' };
}

/** Gavelling credit (one-off, non-expiring) pricing for display purposes only
 *  — create-credit-checkout recomputes and enforces the real price. Mirrors
 *  unlimitedPricing's region split (UNLIMITED_REGION_A). */
export function creditPricing(countryCode: string | null): { each: number; currency: string } {
  const code = countryCode?.toUpperCase();
  const isRegionA = !code || UNLIMITED_REGION_A.has(code);
  return isRegionA ? { each: 3, currency: 'USD' } : { each: 1, currency: 'USD' };
}

/** Gavelling Pro (1 credit/month + archive & upcoming tools) pricing for
 *  display purposes only — create-credit-checkout recomputes and enforces
 *  the real price. Mirrors unlimitedPricing's region split. */
export function proPricing(countryCode: string | null): { monthly: number; currency: string } {
  const code = countryCode?.toUpperCase();
  const isRegionA = !code || UNLIMITED_REGION_A.has(code);
  return isRegionA ? { monthly: 3, currency: 'USD' } : { monthly: 1.5, currency: 'USD' };
}

/** Whether checkout for this conference goes through live Stripe. Organizer
 *  pages use this to gate their manual mark-paid/unpaid/received controls.
 *  When `connectOnboardingStatus` is passed, payments are only live once the
 *  conference's own Stripe Connect onboarding is 'complete' — unconnected
 *  conferences fall back to manual controls even while Stripe is the active
 *  provider globally. When `paymentMethod` is passed too, Stripe must also
 *  be the conference's ACTIVE payout method — a conference that switched to
 *  manual keeps its dormant Stripe account 'complete', but organizers still
 *  need manual mark-paid controls while manual is active. */
export function isPaymentsLive(
  conferenceId?: string | null,
  connectOnboardingStatus?: string | null,
  paymentMethod?: string | null,
): boolean {
  if (ACTIVE_PROVIDER !== 'stripe') return false;
  if (conferenceId && MANUAL_MODE_CONFERENCE_IDS.has(conferenceId)) return false;
  if (paymentMethod !== undefined && paymentMethod !== null && paymentMethod !== 'stripe') return false;
  if (connectOnboardingStatus !== undefined && connectOnboardingStatus !== null) {
    return connectOnboardingStatus === 'complete';
  }
  return true;
}

export type CheckoutKind = 'role_fee' | 'pledge_spots';

export interface CreateCheckoutArgs {
  applicationId: string;
  /** Used only to resolve isPaymentsLive for this conference (manual-mode override). */
  conferenceId?: string;
  /** The caller's session access token — create-checkout reads the user off it. */
  accessToken: string;
  kind: CheckoutKind;
  /** role_fee only: a partial payment target in major currency units (e.g. 12.50). */
  amount?: number;
  /** role_fee only: a voucher code the participant entered. */
  voucherCode?: string;
  /** pledge_spots only: how many spots to pay for in this session (default 1). */
  spotCount?: number;
  /** Manual-mode message only — never sent to the server. */
  feeAmount?: number;
  feeCurrency?: string;
}

export interface PaymentResult {
  /** 'recorded' = manual provider acknowledged; 'redirect' = hosted checkout; 'error' = surfaced inline. */
  status: 'recorded' | 'redirect' | 'error';
  message?: string;
  /** Set on 'redirect' — the caller performs the navigation (window.location.assign). */
  redirectUrl?: string;
}

export async function createCheckout(args: CreateCheckoutArgs): Promise<PaymentResult> {
  return isPaymentsLive(args.conferenceId) ? stripeProvider(args) : manualProvider(args);
}

// ── Provider: manual ────────────────────────────────────────────────────────
// Records the intent client-side and tells the participant the organizing
// team confirms payments manually. Nothing is written to the DB here.

async function manualProvider(args: CreateCheckoutArgs): Promise<PaymentResult> {
  const amountLabel = args.feeAmount != null && args.feeCurrency
    ? ` of ${formatFee(args.feeAmount, args.feeCurrency)}`
    : '';
  return {
    status: 'recorded',
    message:
      `Secure card payment is being connected. Your payment${amountLabel} is locked in, ` +
      'and the organizing team can confirm your payment manually in the meantime.',
  };
}

// ── Provider: stripe (live) ─────────────────────────────────────────────────
// Invokes the deployed create-checkout edge function (verify_jwt on — it
// reads the caller off the bearer token). On success it returns a Checkout
// Session URL; the call site performs the redirect. All server-side
// rejections (bad voucher, currency mismatch, nothing owed, partials
// disabled, ...) come back as { ok:false, error } and are surfaced verbatim.

async function stripeProvider(args: CreateCheckoutArgs): Promise<PaymentResult> {
  const supabase = getAuthedClient(args.accessToken);
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      applicationId: args.applicationId,
      kind: args.kind,
      ...(args.voucherCode ? { voucherCode: args.voucherCode } : {}),
      ...(args.amount != null ? { amount: args.amount } : {}),
      ...(args.spotCount != null ? { spotCount: args.spotCount } : {}),
    },
  });

  if (error) {
    return { status: 'error', message: await extractFunctionErrorMessage(error) };
  }
  const result = data as { ok?: boolean; url?: string; error?: string; covered?: boolean; message?: string } | null;
  if (result?.ok && result.covered) {
    return { status: 'recorded', message: result.message || "Your delegation's financial aid covered these spots — nothing to pay." };
  }
  if (!result?.ok || !result.url) {
    return { status: 'error', message: result?.error || 'Could not start checkout. Please try again.' };
  }
  return { status: 'redirect', redirectUrl: result.url };
}

// ── Pay-by-invoice (create-checkout v15+, the invoiceId path) ─────────────
// Charges ONE specific invoices row directly (app_fee / addon / pledge_spot /
// a raw role_fee), no recompute — the invoice's own amount_cents minus
// amount_paid_cents is what gets charged. Manual-mode conferences never call
// this (the /pay page shows the organizer's manual instructions instead), so
// there's no manualProvider branch here the way createCheckout has one.

export interface PayInvoiceArgs {
  invoiceId: string;
  /** The caller's session access token — create-checkout reads the user off it. */
  accessToken: string;
}

export async function payInvoiceCheckout(args: PayInvoiceArgs): Promise<PaymentResult> {
  const supabase = getAuthedClient(args.accessToken);
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { invoiceId: args.invoiceId },
  });
  if (error) {
    return { status: 'error', message: await extractFunctionErrorMessage(error) };
  }
  const result = data as { ok?: boolean; url?: string; error?: string } | null;
  if (!result?.ok || !result.url) {
    return { status: 'error', message: result?.error || 'Could not start checkout. Please try again.' };
  }
  return { status: 'redirect', redirectUrl: result.url };
}

/** supabase.functions.invoke surfaces non-2xx responses as an error whose
 *  original JSON body (our { ok:false, error } shape) lives on error.context.
 *  Exported for reuse by other edge-function call sites (e.g. connect-onboard). */
export async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    } catch {
      // non-JSON error body, fall through to the generic message
    }
  }
  return (error as Error | null)?.message || 'Could not start checkout. Please try again.';
}
