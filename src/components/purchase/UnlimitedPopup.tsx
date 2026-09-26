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

import { useCallback, useRef, useState } from 'react';
import { GoldWord } from '@/components/BrandHeading';
import { formatLongDate, manageErrorText, manageSubscription, notifyPlanChanged, useUnlimitedDetail } from '@/lib/subscriptionManage';
import Link from 'next/link';
import { BookOpen, Briefcase, Infinity as InfinityIcon, Loader2, Archive } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Emoji3D } from '@/components/neu';
import { openAuth } from '@/lib/authModal';
import { unlimitedPricing } from '@/lib/payments';
import { formatUsd } from '@/lib/creditPricing';
import { closePurchasePopup, swapToCredits, type UnlimitedPopupRequest } from '@/lib/purchasePopup';
import { EMBEDDED_CHECKOUT_AVAILABLE, checkoutErrorText, startUnlimitedCheckout, type UnlimitedPlan } from '@/lib/purchaseCheckout';
import { waitForUnlimited } from '@/lib/unlimitedStatus';
import { formatPlanDate, useMySubscription } from '@/lib/mySubscription';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { notifyOk } from '@/lib/appNotify';
import { StripeEmbeddedForm } from './StripeEmbedded';
import { BenefitList, BrandTitle, ErrorLine, Eyebrow, GOLD, GoldButton, PurchaseShell, SwapLine, type Benefit } from './purchaseKit';

// Only what is real, as titles (owner, 25 Sep 2026): no caption under any
// of them, so the pop-up fits a 1280x800 screen. Kept in step with INCLUDED
// on /pricing/subscription and BENEFITS on /account/manage/subscription.
const BENEFITS: Benefit[] = [
  { emoji: 'Infinity', fallback: InfinityIcon, title: 'Apply to as many conferences as you like', live: true },
  { emoji: 'Books', fallback: BookOpen, title: 'Premium MUN guides', live: true },
  { emoji: 'File cabinet', fallback: Archive, title: 'Your MUN archive', live: false },
  { emoji: 'Briefcase', fallback: Briefcase, title: 'Premium job board roles', live: false },
];

// Resume mode: the benefits a touch more prominent, and the one sentence-case button.
const RESUME_CSS = `
.gv-buy-benefits-hl .gv-buy-benefit-disc{background:rgba(238,217,138,0.16);border-color:rgba(238,217,138,0.5)}
.gv-buy-benefits-hl .gv-buy-benefit-text{color:#FFFFFF;font-size:18px!important;font-weight:700}
.gv-buy-benefits-hl .gv-buy-benefits{gap:18px}
[data-testid="unlimited-resume"]{text-transform:none;letter-spacing:0.01em}
`;

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

  // Resume mode (25 Sep 2026): a plan cancelled at period end can be resumed
  // here, wherever the pop-up was opened from, with no checkout and no plan
  // picker. "Come Back to Unlimited" is the normal buy flow after a lapse.
  const { detail } = useUnlimitedDetail();
  // The plan as it was before paying: the poll waits for it to change.
  const planBeforeRef = useRef(detail?.status ?? null);
  if (detail && planBeforeRef.current === null) planBeforeRef.current = detail.status;
  const resumeMode = !renewOnce && !!detail?.can_resume;
  const comeBack = !renewOnce && !!detail && detail.status === 'none' && !!detail.lapsed_plan;
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeErr, setResumeErr] = useState('');

  async function resume() {
    if (resumeBusy) return;
    setResumeBusy(true);
    setResumeErr('');
    try {
      await manageSubscription({ action: 'resume' });
      // Re-read the status, then continue exactly as a purchase would.
      notifyPlanChanged(user?.id);
      closePurchasePopup();
      notifyOk('Welcome back. Unlimited renews as before.', 'purchase');
      refreshCreditsEverywhere();
      request.onComplete?.();
    } catch (e) {
      setResumeErr(manageErrorText(e, 'resume'));
    } finally {
      setResumeBusy(false);
    }
  }

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
    // The webhook writes the plan a few seconds after the payment: poll until
    // it lands, then every reader (this page, the rail, the menu, guides)
    // updates at once. `before` is the plan the popup opened with.
    void waitForUnlimited(user?.id, planBeforeRef.current);
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
    <PurchaseShell tone="dark" label={resumeMode ? 'Resume Unlimited' : comeBack ? 'Come back to Gavelling Unlimited' : 'Get Gavelling Unlimited'} onClose={closePurchasePopup} testId="unlimited-popup">
      <style>{RESUME_CSS}</style>
      <div className="gv-buy-left">
        {resumeMode || comeBack ? (
          <div>
            <span className="gv-buy-title-icon" aria-hidden><Emoji3D name="Infinity" size={44} fallback={InfinityIcon} fallbackColor={GOLD} /></span>
            <h2 className="gv-buy-title">
              <span className="gv-buy-title-text">
                {resumeMode ? <>Resume <GoldWord tone="dark">Unlimited</GoldWord></> : <>Come Back to <GoldWord tone="dark">Unlimited</GoldWord></>}
              </span>
            </h2>
            {resumeMode ? (
              <p className="gv-buy-sub">
                {formatLongDate(detail?.current_period_end)
                  ? `You still have Unlimited until ${formatLongDate(detail?.current_period_end)}. Resume now and keep everything.`
                  : 'You still have Unlimited until the end of your period. Resume now and keep everything.'}
              </p>
            ) : null}
          </div>
        ) : (
          <BrandTitle
            word="Unlimited"
            tone="dark"
            icon={<Emoji3D name="Infinity" size={44} fallback={InfinityIcon} fallbackColor={GOLD} />}
          />
        )}
        <div className={resumeMode ? 'gv-buy-benefits-hl' : undefined}>
          <Eyebrow>{resumeMode ? 'What you keep' : 'What you get'}</Eyebrow>
          <BenefitList items={BENEFITS} tone="dark" />
        </div>
      </div>

      {/* Resume mode: the title, the line and the button sit in the middle of
          the panel, not stuck to its top (26 Sep 2026). */}
      <div className="gv-buy-right" style={resumeMode ? { justifyContent: 'center' } : undefined}>
        {resumeMode ? (
          <>
            <h3 className="gv-buy-rtitle">Pick Up Where You Left Off</h3>
            <p className="gv-buy-renew">
              Your plan renews again on <strong>{formatLongDate(detail?.current_period_end) ?? 'its usual date'}</strong>, as before. Nothing to pay today.
            </p>
            {resumeErr ? <ErrorLine>{resumeErr}</ErrorLine> : null}
            <GoldButton onClick={() => { void resume(); }} busy={resumeBusy} busyText="Resuming…" testId="unlimited-resume">Resume subscription</GoldButton>
          </>
        ) : signedOut ? (
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
            <h3 className="gv-buy-rtitle">Pay with Card</h3>
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
            <h3 className="gv-buy-rtitle">Pay Once for a Year</h3>
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
            <h3 className="gv-buy-rtitle">Choose How You Pay</h3>
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
