'use client';

// CardPayPopup — paying by card without leaving Gavelling (prompt 95).
// create-checkout { invoiceIds, embedded: true } mints the session ON the
// conference's Stripe account, so Embedded Checkout is loaded with
// loadStripe(pk, { stripeAccount }) (getStripeForAccount). When Stripe reports
// completion the pop-up waits for the webhook (useSettleWait) and closes once
// the items show paid. Without a publishable key it falls back to the hosted
// page. 3-D Secure may leave through the return URL; the page handles
// ?payment=success with the same waiting state.

import { useEffect, useMemo, useRef, useState } from 'react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { CircleCheck } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { getStripeForAccount } from '@/components/purchase/StripeEmbedded';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/purchaseCheckout';
import { notifyOk } from '@/lib/appNotify';
import { reportBlocked } from '@/lib/reportCrash';
import { readPayOverview, startCheckout } from './payApi';
import { useSettleWait, SLOW_LINE, WAITING_LINE } from './settleWait';

type Stage =
  | { kind: 'starting' }
  | { kind: 'form'; clientSecret: string; stripeAccount: string | null }
  | { kind: 'paid' }
  | { kind: 'error'; message: string };

export default function CardPayPopup({ conferenceId, conferenceName, invoiceIds, totalLabel, onClose, onSettled }: {
  conferenceId: string;
  conferenceName: string;
  invoiceIds: string[];
  totalLabel: string;
  /** `stillWaiting`: the card payment went through but the items do not show paid yet, so the page keeps checking. */
  onClose: (stillWaiting: boolean) => void;
  /** The items show paid: the page re-reads and the pop-up closes. */
  onSettled: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'starting' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const embedded = !!STRIPE_PUBLISHABLE_KEY;
      const r = await startCheckout(invoiceIds, embedded);
      if (!r.ok) {
        reportBlocked('start card payment', new Error(r.error), { kind: 'invoices', invoiceCount: invoiceIds.length });
        setStage({ kind: 'error', message: r.error });
        return;
      }
      if (!r.embedded) { window.location.assign(r.url); return; }
      setStage({ kind: 'form', clientSecret: r.clientSecret, stripeAccount: r.stripeAccount });
    })();
  }, [invoiceIds]);

  const paid = stage.kind === 'paid';
  const wait = useSettleWait(paid, async () => {
    const o = await readPayOverview(conferenceId);
    return invoiceIds.every(id => {
      const it = o.items.find(x => x.invoice_id === id);
      return !it || it.state === 'paid' || it.state === 'covered' || it.state === 'waived';
    });
  });

  useEffect(() => {
    if (wait !== 'done') return;
    notifyOk('Payment received. Thank you', 'pay');
    onSettled();
  }, [wait, onSettled]);

  const stripe = useMemo(
    () => (stage.kind === 'form' ? getStripeForAccount(stage.stripeAccount) : null),
    [stage],
  );
  const options = useMemo(
    () => (stage.kind === 'form'
      ? { fetchClientSecret: () => Promise.resolve(stage.clientSecret), onComplete: () => setStage({ kind: 'paid' }) }
      : null),
    [stage],
  );

  // While Stripe is processing or the webhook is on its way, closing would only hide progress.
  const closable = stage.kind !== 'paid' || wait === 'slow' || wait === 'gave_up';

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label={`Pay ${totalLabel}`} onClose={() => { if (closable) onClose(stage.kind === 'paid'); }} panelClass="gv-pay-pop" testId="pay-card">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <div style={{ paddingRight: 40 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#5A5046', overflowWrap: 'anywhere' }}>{conferenceName}</p>
            <h2 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#1C1410' }}>Pay {totalLabel}</h2>
          </div>

          {stage.kind === 'starting' && <p style={{ margin: 0, fontSize: 15, color: '#5A5046' }} aria-live="polite">Opening the card payment</p>}

          {stage.kind === 'error' && (
            <>
              <p role="alert" style={{ margin: 0, fontSize: 15, color: '#8B2020' }}>{stage.message}</p>
              <div><button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onClose(false)}>Close</button></div>
            </>
          )}

          {stage.kind === 'form' && stripe && options && (
            <EmbeddedCheckoutProvider key={stage.clientSecret} stripe={stripe} options={options}>
              <EmbeddedCheckout className="gv-buy-stripe" />
            </EmbeddedCheckoutProvider>
          )}

          {stage.kind === 'paid' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: '12px 0' }} aria-live="polite">
              <span style={{ width: 48, height: 48, borderRadius: 999, background: 'rgba(27,56,40,0.08)', color: '#1B3828', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                <CircleCheck size={26} strokeWidth={2.2} />
              </span>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1C1410' }}>
                {wait === 'slow' || wait === 'gave_up' ? SLOW_LINE : WAITING_LINE}
              </p>
              {(wait === 'slow' || wait === 'gave_up') && (
                <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onClose(true)}>Close</button>
              )}
            </div>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}
