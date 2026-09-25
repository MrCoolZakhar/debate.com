'use client';

// ── Stripe Embedded Checkout inside our pop-ups ──────────────────────────────
//
// The whole card form, including Stripe's own "Pay $X" button, is Stripe's
// iframe; we hand it a client secret minted by our edge function and listen
// for `onComplete`. A payment that needs 3-D Secure may leave through
// Stripe's return URL instead (returnTo?credits=success&session_id=...), which
// PurchasePopupHost picks up on the page it lands on.
//
// `loadStripe` runs once per page. With no publishable key `getStripe()` is
// null and the pop-ups use the hosted flow instead (see purchaseCheckout.ts).

import { useMemo, useRef } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/purchaseCheckout';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> | null {
  if (!STRIPE_PUBLISHABLE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
}

export function StripeEmbeddedForm({ clientSecret, onComplete }: { clientSecret: string; onComplete: () => void }) {
  const stripe = getStripe();
  // The provider reads `options` once at mount and warns if the object
  // changes, so the callback goes through a ref and the object is stable per
  // secret. A new secret remounts the whole thing (key below).
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const options = useMemo(
    () => ({ fetchClientSecret: () => Promise.resolve(clientSecret), onComplete: () => completeRef.current() }),
    [clientSecret],
  );
  if (!stripe) return null;
  return (
    <EmbeddedCheckoutProvider key={clientSecret} stripe={stripe} options={options}>
      <EmbeddedCheckout className="gv-buy-stripe" />
    </EmbeddedCheckoutProvider>
  );
}
