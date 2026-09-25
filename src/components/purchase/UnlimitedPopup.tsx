'use client';

// ── The Unlimited pop-up ─────────────────────────────────────────────────────
//
// Its own world: forest and gold on both sides, so the switch from Credits
// is felt. LEFT: "Gavelling Unlimited" with the Infinity beside it and the
// benefit list. RIGHT: Monthly / Yearly (the caller's plan opens selected,
// Yearly by default; $30 a year is two months free), plain words that it
// renews until cancelled and can be cancelled any time, then the payment,
// exactly as in the Credits pop-up. Opened with `renewOnce` (the
// failed-renewal email's /pricing/subscription?renew=once) it offers only
// "PAY $30 ONCE", the single place `renew: false` is ever sent.
//
// Who may buy (owner, 25 Sep 2026): someone on a TRIAL or promo Unlimited may
// pay now; the line above the button says the paid plan starts when the
// current one ends. Someone on a PAID plan is told they already have it.
// renewOnce ignores both.

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Infinity as InfinityIcon, Loader2, Mail, Archive, Wrench } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Emoji3D } from '@/components/neu';
import { openAuth } from '@/lib/authModal';
import { unlimitedPricing } from '@/lib/payments';
import { formatUsd } from '@/lib/creditPricing';
import { closePurchasePopup, swapToCredits, type UnlimitedPopupRequest } from '@/lib/purchasePopup';
import { EMBEDDED_CHECKOUT_AVAILABLE, checkoutErrorText, startUnlimitedCheckout, type UnlimitedPlan } from '@/lib/purchaseCheckout';
import { notifyUnlimitedChanged } from '@/lib/unlimitedStatus';
import { formatPlanDate, useMySubscription } from '@/lib/mySubscription';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { notifyOk } from '@/lib/appNotify';
import { StripeEmbeddedForm } from './StripeEmbedded';
import { BenefitList, BrandTitle, ErrorLine, Eyebrow, GOLD, GoldButton, PurchaseShell, SwapLine, type Benefit } from './purchaseKit';

const BENEFITS: Benefit[] = [
  { emoji: 'Infinity', fallback: InfinityIcon, title: 'Apply to as many conferences as you like', note: 'Every application covered while you are on Unlimited.', live: true },
  { emoji: 'File cabinet', fallback: Archive, title: 'Your MUN archive', note: 'Every conference, committee and award, kept for you.', live: false },
  { emoji: 'Toolbox', fallback: Wrench, title: 'Tools for your upcoming conferences', live: false },
  { emoji: 'Envelope', fallback: Mail, title: 'Unlimited email builder for organizers', live: false },
  { emoji: 'Briefcase', fallback: Briefcase, title: 'Premium job board roles', live: false },
];

export default function UnlimitedPopup({ request }: { request: UnlimitedPopupRequest }) {
  const { renewOnce = false } = request;
  const { user, loading: authLoading } = useAuth();
  const sub = useMySubscription();
  const price = unlimitedPricing(null);
  const monthlyCents = Math.round(price.monthly * 100);
  const yearlyCents = Math.round(price.yearly * 100);

  const [plan, setPlan] = useState<UnlimitedPlan>(request.plan ?? 'yearly');
  const [stage, setStage] = useState<'choose' | 'pay'>('choose');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checkout, setCheckout] = useState<{ clientSecret: string; plan: UnlimitedPlan; recurring: boolean } | null>(null);

  const effectivePlan: UnlimitedPlan = renewOnce ? 'yearly' : plan;
  const amountCents = effectivePlan === 'monthly' ? monthlyCents : yearlyCents;

  async function pay() {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const result = await startUnlimitedCheckout(effectivePlan, !renewOnce, EMBEDDED_CHECKOUT_AVAILABLE);
      if (result.kind === 'hosted') {
        window.location.assign(result.url);
        return;
      }
      setCheckout({ clientSecret: result.clientSecret, plan: result.plan, recurring: result.recurring });
      setStage('pay');
    } catch (e) {
      setErr(checkoutErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  const onComplete = useCallback(() => {
    closePurchasePopup();
    notifyOk('Welcome to Gavelling Unlimited.', 'purchase');
    notifyUnlimitedChanged(user?.id);
    refreshCreditsEverywhere();
    request.onComplete?.();
  }, [request, user?.id]);

  const signedOut = !authLoading && !user;
  // While the subscription row is still on its way we show nothing to buy, so
  // someone already on a paid plan never sees a pay button flash first.
  const checkingPlan = !renewOnce && !signedOut && sub.loading;
  const alreadyOn = !renewOnce && sub.kind === 'paid';
  const onTrial = !renewOnce && sub.kind === 'trial';
  const trialLine = onTrial && sub.endsAt
    ? <p className="gv-buy-renew">Your paid plan starts when your current Unlimited ends on <strong>{formatPlanDate(sub.endsAt)}</strong></p>
    : null;

  return (
    <PurchaseShell tone="dark" label="Get Gavelling Unlimited" onClose={closePurchasePopup} testId="unlimited-popup">
      <div className="gv-buy-left">
        <BrandTitle
          word="Unlimited"
          tone="dark"
          icon={<Emoji3D name="Infinity" size={44} fallback={InfinityIcon} fallbackColor={GOLD} />}
          sub="Apply as much as you like. One plan, everything included."
        />
        <div>
          <Eyebrow>What you get</Eyebrow>
          <BenefitList items={BENEFITS} tone="dark" />
        </div>
      </div>

      <div className="gv-buy-right">
        {signedOut ? (
          <>
            <h3 className="gv-buy-rtitle">Log in to go Unlimited</h3>
            <p className="gv-buy-sub" style={{ margin: 0 }}>Unlimited lives on your account, so we need to know whose it is.</p>
            <GoldButton onClick={() => { closePurchasePopup(); openAuth(); }}>LOG IN OR SIGN UP</GoldButton>
          </>
        ) : checkingPlan ? (
          <p className="gv-buy-wait"><Loader2 size={15} className="animate-spin" aria-hidden /> Checking your plan…</p>
        ) : alreadyOn ? (
          <>
            <h3 className="gv-buy-rtitle">You&apos;re already on Unlimited</h3>
            <p className="gv-buy-note">
              Every application is covered. Your plan and its renewal date are in{' '}
              <Link href="/account/manage/subscription" onClick={closePurchasePopup}>Manage subscription</Link>.
            </p>
            <SwapLine lead="Looking for credits?" action="Top up here" onClick={() => swapToCredits('header')} />
          </>
        ) : stage === 'pay' && checkout ? (
          <>
            <h3 className="gv-buy-rtitle">Pay with card</h3>
            <div className="gv-buy-change">
              <span>
                <strong>Unlimited, {checkout.plan === 'monthly' ? 'monthly' : 'yearly'}</strong> for <strong>{formatUsd(amountCents)}</strong>
                {checkout.recurring ? (checkout.plan === 'monthly' ? ' a month' : ' a year') : ', once'}
              </span>
              <button type="button" className="gv-buy-changebtn" onClick={() => { setStage('choose'); setCheckout(null); }}>Change</button>
            </div>
            {trialLine}
            <div className="gv-buy-formwell">
              <div className="gv-buy-form">
                <StripeEmbeddedForm clientSecret={checkout.clientSecret} onComplete={onComplete} />
              </div>
            </div>
          </>
        ) : renewOnce ? (
          <>
            <h3 className="gv-buy-rtitle">Pay once for a year</h3>
            <div className="gv-buy-plans" style={{ gridTemplateColumns: '1fr' }} role="radiogroup" aria-label="Plan">
              <button type="button" role="radio" aria-checked className="gv-buy-plan">
                <span className="gv-buy-plan-name">One year</span>
                <span className="gv-buy-plan-price">{formatUsd(yearlyCents)}</span>
                <span className="gv-buy-plan-per">for a year of Unlimited</span>
                <span className="gv-buy-plan-note">Nothing automatic. It ends after the year unless you come back</span>
              </button>
            </div>
            <p className="gv-buy-renew">Your renewal did not go through, so this is a single payment: <strong>{formatUsd(yearlyCents)}, once</strong>, for the next twelve months.</p>
            {err ? <ErrorLine>{err}</ErrorLine> : null}
            <GoldButton onClick={pay} busy={busy} busyText="PREPARING YOUR PAYMENT…" testId="unlimited-pay">PAY {formatUsd(yearlyCents)} ONCE</GoldButton>
            {busy && !EMBEDDED_CHECKOUT_AVAILABLE ? <p className="gv-buy-wait"><Loader2 size={15} className="animate-spin" aria-hidden /> Taking you to Stripe…</p> : null}
          </>
        ) : (
          <>
            <h3 className="gv-buy-rtitle">Choose how you pay</h3>
            <div className="gv-buy-plans" role="radiogroup" aria-label="Plan">
              <button type="button" role="radio" aria-checked={plan === 'yearly'} className="gv-buy-plan" onClick={() => { setPlan('yearly'); setErr(''); }}>
                <span className="gv-buy-plan-badge">2 months free</span>
                <span className="gv-buy-plan-name">Yearly</span>
                <span className="gv-buy-plan-price">{formatUsd(yearlyCents)}</span>
                <span className="gv-buy-plan-per">a year</span>
                <span className="gv-buy-plan-note">{formatUsd(Math.round(yearlyCents / 12))} a month, paid once a year</span>
              </button>
              <button type="button" role="radio" aria-checked={plan === 'monthly'} className="gv-buy-plan" onClick={() => { setPlan('monthly'); setErr(''); }}>
                <span className="gv-buy-plan-name">Monthly</span>
                <span className="gv-buy-plan-price">{formatUsd(monthlyCents)}</span>
                <span className="gv-buy-plan-per">a month</span>
                <span className="gv-buy-plan-note">Stop whenever you like</span>
              </button>
            </div>
            <p className="gv-buy-renew">
              Renews {plan === 'yearly' ? 'every year' : 'every month'} until you cancel. <strong>Cancel any time</strong> and keep Unlimited until the end of the period you paid for.
            </p>
            {trialLine}
            {err ? <ErrorLine>{err}</ErrorLine> : null}
            <GoldButton onClick={pay} busy={busy} busyText="PREPARING YOUR PAYMENT…" testId="unlimited-pay">
              {plan === 'yearly' ? `PAY ${formatUsd(yearlyCents)} A YEAR` : `PAY ${formatUsd(monthlyCents)} A MONTH`}
            </GoldButton>
            {busy && !EMBEDDED_CHECKOUT_AVAILABLE ? <p className="gv-buy-wait"><Loader2 size={15} className="animate-spin" aria-hidden /> Taking you to Stripe…</p> : null}
            <SwapLine lead="Looking for credits?" action="Top up here" onClick={() => swapToCredits('header')} />
          </>
        )}
      </div>
    </PurchaseShell>
  );
}
