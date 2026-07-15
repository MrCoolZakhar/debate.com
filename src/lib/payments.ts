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

/** Whether checkout for this conference goes through live Stripe. Organizer
 *  pages use this to gate their manual mark-paid/unpaid/received controls.
 *  When `connectOnboardingStatus` is passed, payments are only live once the
 *  conference's own Stripe Connect onboarding is 'complete' — unconnected
 *  conferences fall back to manual controls even while Stripe is the active
 *  provider globally. */
export function isPaymentsLive(conferenceId?: string | null, connectOnboardingStatus?: string | null): boolean {
  if (ACTIVE_PROVIDER !== 'stripe') return false;
  if (conferenceId && MANUAL_MODE_CONFERENCE_IDS.has(conferenceId)) return false;
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
