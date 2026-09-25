'use client';

// ── Starting a Stripe Checkout for credits or Unlimited ─────────────────────
//
// Two edge functions, both of which price everything server-side:
//   create-credit-checkout      {kind:'credits', quantity, returnTo, embedded}
//   create-subscription-checkout {plan, renew, returnTo, embedded}
// With `embedded: true` they answer a client secret for Stripe's Embedded
// Checkout, so the card form renders inside our pop-up. Without it they answer
// the old hosted `{url}`, which is the fallback when the publishable key is
// not configured: nothing here ever breaks for want of a key.
//
// The token is read fresh at call time (getFreshAuthedClient), never captured
// in React state: a person opens the pop-up, goes to find their card, comes
// back, and by then a captured token can be expired (a real production bug
// on the pay page, 5 Sep 2026).
//
// Credits are ALWAYS the signed-in person's own balance. Nothing here sends a
// societyId, whoever is buying.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { UserFacingError, friendlyError } from '@/lib/friendlyError';
import { extractFunctionErrorMessage } from '@/lib/payments';

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
/** False when the key is missing: callers fall back to the hosted flow. */
export const EMBEDDED_CHECKOUT_AVAILABLE = STRIPE_PUBLISHABLE_KEY.length > 0;

const SESSION_EXPIRED = 'Your session has expired. Refresh the page and sign in again.';

function returnToHere(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

export type CreditsCheckout =
  | { kind: 'embedded'; clientSecret: string; sessionId: string; quantity: number; amountCents: number; listCents: number; discountPct: number }
  | { kind: 'hosted'; url: string };

export async function startCreditsCheckout(quantity: number, embedded: boolean): Promise<CreditsCheckout> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError(SESSION_EXPIRED);
  const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
    body: { kind: 'credits', quantity, returnTo: returnToHere(), ...(embedded ? { embedded: true } : {}) },
  });
  if (error) throw new UserFacingError(await extractFunctionErrorMessage(error));
  const r = data as {
    ok?: boolean; error?: string; url?: string; clientSecret?: string; sessionId?: string;
    quantity?: number; amount_cents?: number; list_cents?: number; discount_pct?: number;
  } | null;
  if (!r?.ok) throw new UserFacingError(r?.error || 'Could not start the payment. Please try again.');
  if (embedded && r.clientSecret) {
    return {
      kind: 'embedded',
      clientSecret: r.clientSecret,
      sessionId: r.sessionId ?? '',
      quantity: r.quantity ?? quantity,
      amountCents: r.amount_cents ?? 0,
      listCents: r.list_cents ?? 0,
      discountPct: r.discount_pct ?? 0,
    };
  }
  if (r.url) return { kind: 'hosted', url: r.url };
  throw new UserFacingError('Could not start the payment. Please try again.');
}

export type UnlimitedPlan = 'monthly' | 'yearly';

export type UnlimitedCheckout =
  | { kind: 'embedded'; clientSecret: string; sessionId: string; plan: UnlimitedPlan; recurring: boolean }
  | { kind: 'hosted'; url: string };

/**
 * `renew` is true for every ordinary purchase (monthly always renews, yearly
 * renews every year until cancelled). The ONLY caller that passes false is the
 * failed-renewal fallback (/pricing/subscription?renew=once): one payment for
 * one year, nothing automatic after it.
 */
export async function startUnlimitedCheckout(plan: UnlimitedPlan, renew: boolean, embedded: boolean): Promise<UnlimitedCheckout> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError(SESSION_EXPIRED);
  const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
    body: { plan, renew, returnTo: returnToHere(), ...(embedded ? { embedded: true } : {}) },
  });
  if (error) {
    // 409: Unlimited is already active on this account.
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    if (status === 409) throw new UserFacingError('You already have Gavelling Unlimited. There is nothing to buy.');
    throw new UserFacingError(await extractFunctionErrorMessage(error));
  }
  const r = data as { ok?: boolean; error?: string; url?: string; clientSecret?: string; sessionId?: string; plan?: string; recurring?: boolean } | null;
  if (!r?.ok) throw new UserFacingError(r?.error || 'Could not start the payment. Please try again.');
  if (embedded && r.clientSecret) {
    return { kind: 'embedded', clientSecret: r.clientSecret, sessionId: r.sessionId ?? '', plan: (r.plan === 'monthly' ? 'monthly' : 'yearly'), recurring: r.recurring ?? renew };
  }
  if (r.url) return { kind: 'hosted', url: r.url };
  throw new UserFacingError('Could not start the payment. Please try again.');
}

/** Stripe's customer portal, where a subscription is managed or cancelled. */
export async function openBillingPortal(): Promise<string> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError(SESSION_EXPIRED);
  const { data, error } = await supabase.functions.invoke('create-billing-portal');
  if (error) throw new UserFacingError(await extractFunctionErrorMessage(error));
  const r = data as { ok?: boolean; url?: string; error?: string } | null;
  if (!r?.ok || !r.url) throw new UserFacingError(r?.error || 'Could not open your billing portal. Please try again.');
  return r.url;
}

/** One sentence for any failure above, never a raw Stripe or Postgres string. */
export function checkoutErrorText(err: unknown): string {
  return friendlyError(err, 'Could not start the payment. Please try again.');
}
