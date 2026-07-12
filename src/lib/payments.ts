// payments.ts — the Stripe-in-a-heartbeat seam.
//
// ALL payment UI must consume ONLY this module + src/lib/finance.ts. The
// provider is selected here, in one place, so wiring Stripe later touches
// exactly this file: the line items are built FROM the same
// CheckoutBreakdown the UI rendered, guaranteeing what the user saw is what
// gets charged.
//
// Today there is ONE real provider — 'manual': the intent is acknowledged
// client-side and the organizer's existing manual mark-paid flow stays
// authoritative (applications.payment_status is flipped by the organizer;
// the unlimited-slot consumption trigger fires on that transition).

import type { CheckoutBreakdown } from '@/lib/finance';
import { formatFee } from '@/lib/finance';

// ── Provider seam ──────────────────────────────────────────────────────────

export type PaymentProvider = 'manual' | 'stripe';

/** Flip to 'stripe' once the Stripe provider below is implemented. */
export const ACTIVE_PROVIDER: PaymentProvider = 'manual';

export interface PaymentIntentInput extends CheckoutBreakdown {
  applicationId: string;
  userId: string;
}

export interface PaymentResult {
  /** 'recorded' = manual provider acknowledged; 'redirect' = hosted checkout. */
  status: 'recorded' | 'redirect' | 'error';
  message?: string;
  /** Set by hosted-checkout providers (Stripe Checkout session URL). */
  redirectUrl?: string;
}

export async function createPaymentIntent(input: PaymentIntentInput): Promise<PaymentResult> {
  switch (ACTIVE_PROVIDER) {
    case 'manual':
      return manualProvider(input);
    // case 'stripe':
    //   return stripeProvider(input);
    default:
      return manualProvider(input);
  }
}

// ── Provider: manual (today) ───────────────────────────────────────────────
// Records the intent client-side and tells the participant the organizing
// team confirms payments manually. Nothing is written to the DB here — the
// application row already carries voucher_id / voucher_discount /
// fee_waiver_source from submission, so the organizer sees the exact same
// breakdown when they mark the application paid.

async function manualProvider(input: PaymentIntentInput): Promise<PaymentResult> {
  return {
    status: 'recorded',
    message:
      `Secure card payment is being connected — your total of ${formatFee(input.total, input.currency)} ` +
      'is locked in, and the organizing team can confirm your payment manually in the meantime.',
  };
}

// ── Provider: stripe (skeleton — NOT active) ───────────────────────────────
// When Stripe lands, implement a server route (e.g. /api/checkout) that:
//
//   const session = await stripe.checkout.sessions.create({
//     mode: 'payment',
//     customer: profile.stripe_customer_id ?? undefined,   // profiles.stripe_customer_id exists
//     line_items: [
//       // Built FROM the same CheckoutBreakdown the UI rendered:
//       {
//         price_data: {
//           currency: input.currency.toLowerCase(),
//           unit_amount: Math.round(input.postDiscount * 100), // fee minus voucher
//           product_data: { name: 'Conference registration fee' },
//         },
//         quantity: 1,
//       },
//       ...(input.platformFee > 0 ? [{
//         price_data: {
//           currency: input.currency.toLowerCase(),
//           unit_amount: Math.round(input.platformFee * 100),
//           product_data: { name: 'Gavelling platform fee (5%)' },
//         },
//         quantity: 1,
//       }] : []),
//     ],
//     // Metadata carries everything the webhook needs to reconcile:
//     metadata: {
//       applicationId: input.applicationId,
//       userId: input.userId,
//       voucherId: input.voucher?.voucherId ?? '',
//       waiverSource: input.waiverSource ?? '',
//     },
//     success_url: `${origin}/conferences/[slug]/participant?paid=1`,
//     cancel_url: `${origin}/conferences/[slug]/participant`,
//     // Conference payouts: pass conferences.stripe_account_id via
//     // payment_intent_data.transfer_data.destination +
//     // application_fee_amount = Math.round(input.platformFee * 100).
//   });
//
// then the webhook (checkout.session.completed) sets
// applications.payment_status = 'paid' + stripe_payment_intent_id — the
// consume-unlimited trigger and points award fire off that same transition,
// identically to the manual path.
//
// async function stripeProvider(input: PaymentIntentInput): Promise<PaymentResult> {
//   const res = await fetch('/api/checkout', { method: 'POST', body: JSON.stringify(input) });
//   const { url } = await res.json();
//   window.location.assign(url);
//   return { status: 'redirect', redirectUrl: url };
// }

// ── Legacy stub (kept for PaymentPanel backwards-compatibility) ────────────
// PaymentPanel (participant view) predates the seam and calls this directly.
// It now routes through the same manual provider message.

export interface InitiatePaymentArgs {
  applicationId: string;
  amountCents: number;
}

export interface InitiatePaymentResult {
  status: 'stub';
  message: string;
}

export async function initiatePayment(_args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
  return {
    status: 'stub',
    message: 'Secure card payment is being connected — the organizing team can confirm payments manually in the meantime.',
  };
}
