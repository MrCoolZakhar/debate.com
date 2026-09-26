'use client';

// Manage Account: Subscription. Two columns from 900px: the current plan on
// the left (the whole my_unlimited_status() object through
// useUnlimitedDetail, plus useMySubscription for the failed-renewal case), the
// Unlimited benefits on a forest card on the right. Exactly ONE state shows
// (25 Sep 2026):
//   renewing      "Renews on {date}", Update payment method (the Stripe portal,
//                 where card changes stay), a quiet Cancel subscription
//   cancelled     "We hate to see you go" with Gavin, Unlimited stays on until
//                 {date}, and the Resume Subscription card
//   trial         ends on {date}, renews nothing, nothing to cancel
//   one-time year "Paid once. Active until {date}. Nothing renews."
//   past due      the failed renewal, Renew for a year (unchanged flow)
//   nothing       Get Unlimited, or "Come Back to Unlimited" after a lapse
// Cancel and resume go through the manage-subscription edge function and then
// RE-READ the status; nothing here trusts local state.

import { useState } from 'react';
import { Check, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { useMySubscription } from '@/lib/mySubscription';
import { openUnlimitedPopup } from '@/lib/purchasePopup';
import { openBillingPortal, checkoutErrorText } from '@/lib/purchaseCheckout';
import { formatLongDate, manageErrorText, manageSubscription, notifyPlanChanged, useUnlimitedDetail, type UnlimitedDetail } from '@/lib/subscriptionManage';
import { useAuth } from '@/components/AuthProvider';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import CancelUnlimitedSheet from '@/components/purchase/CancelUnlimitedSheet';
import { OUTFIT, T, W } from '../../accountUi';
import {
  PageHead, HelpLine, PrimaryButton, SecondaryButton, ButtonStyles, WhiteCard, ForestCard, Eyebrow, TextLink,
  FOREST, GOLD, INK, INK_SOFT, IVORY,
} from '../manageUi';

// Kept in step with the Unlimited pop-up's list (owner, 25 Sep 2026).
const BENEFITS = [
  'Apply to as many conferences as you like',
  'Premium MUN guides',
  'Your MUN archive',
  'Premium job board roles',
];

/** The sad Gavin for "We hate to see you go". There is no sad drawing yet:
 *  this is the one mascot file the site has (the welcome otter). Swap the
 *  path here when Peter's drawing lands under public/. */
export const SAD_GAVIN_SRC = '/Otter.Tutorial.Intro.png';

export default function SubscriptionPage() {
  const sub = useMySubscription();
  const { detail, loading: detailLoading, reload } = useUnlimitedDetail();
  const { user } = useAuth();
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);

  async function handlePortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const url = await openBillingPortal();
      window.location.assign(url);
    } catch (err) {
      notifyErr(checkoutErrorText(err));
      setPortalBusy(false);
    }
  }

  async function handleResume() {
    if (resumeBusy) return;
    setResumeBusy(true);
    try {
      await manageSubscription({ action: 'resume' });
      notifyOk('Welcome back. Unlimited renews as before.', 'purchase');
      await reload();
      notifyPlanChanged(user?.id);
      sub.reload();
    } catch (err) {
      notifyErr(manageErrorText(err, 'resume'));
    } finally {
      setResumeBusy(false);
    }
  }

  const loading = sub.loading || detailLoading;

  return (
    <div>
      <ButtonStyles />
      <style>{`
        .gv-sub-grid{display:grid;grid-template-columns:1fr;gap:20px;align-items:start}
        @media (min-width:900px){.gv-sub-grid{grid-template-columns:1fr 1fr;gap:24px}}
        .gv-sub-quiet{display:inline-block;background:none;border:none;padding:0;margin-top:14px;font-family:${OUTFIT};font-size:${T.body}px;font-weight:700;color:${INK_SOFT};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .gv-sub-quiet:hover{color:${INK}}
        .gv-sub-quiet:focus{outline:none}
        .gv-sub-quiet:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
        .gv-sub-bye{display:inline-flex;align-items:center;gap:10px;margin-top:10px;padding:6px 14px 6px 6px;border-radius:999px;background:${IVORY};box-shadow:inset 0 0 0 1px rgba(27,56,40,0.12);font-family:${OUTFIT};font-size:13px;font-weight:700;color:${INK}}
        .gv-sub-bye img{width:36px;height:36px;object-fit:contain;display:block}
        .gv-sub-resume{margin-top:18px;padding:18px 20px;border-radius:18px;background:${IVORY};box-shadow:inset 0 0 0 1px rgba(27,56,40,0.12)}
      `}</style>

      <PageHead title={<>Your <GoldWord>Subscription</GoldWord></>} />

      <div className="gv-sub-grid">
        <WhiteCard aria-live="polite">
          {loading || !detail ? (
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>Reading your plan</p>
          ) : (
            <PlanBlock
              sub={sub}
              detail={detail}
              portalBusy={portalBusy}
              resumeBusy={resumeBusy}
              onPortal={handlePortal}
              onCancel={() => setCancelOpen(true)}
              onResume={() => { void handleResume(); }}
            />
          )}
        </WhiteCard>

        <ForestCard>
          <Eyebrow onDark>Unlimited</Eyebrow>
          <h2 style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(24px, 5vw, 30px)', lineHeight: 1.15, color: IVORY, letterSpacing: '-0.01em' }}>
            Everything in <GoldWord tone="dark">Unlimited</GoldWord>
          </h2>
          <ul className="flex flex-col gap-3" style={{ margin: '20px 0 0', padding: 0, listStyle: 'none' }}>
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3" style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: W.label, color: IVORY, lineHeight: 1.4 }}>
                <span className="inline-flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 24, height: 24, backgroundColor: 'rgba(238,217,138,0.18)' }} aria-hidden>
                  <Check size={15} strokeWidth={3} style={{ color: GOLD }} />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <p style={{ margin: '22px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: 'rgba(250,248,243,0.85)' }}>
            <TextLink href="/pricing/subscription" onDark>Find out more</TextLink>
          </p>
        </ForestCard>
      </div>

      <HelpLine />

      {cancelOpen && (
        <CancelUnlimitedSheet
          untilDate={formatLongDate(detail?.current_period_end)}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => {
            setCancelOpen(false);
            notifyOk('Cancelled. Unlimited stays on until the end of your period.', 'purchase');
            void reload().then(() => { notifyPlanChanged(user?.id); sub.reload(); });
          }}
        />
      )}
    </div>
  );
}

function PlanBlock({ sub, detail, portalBusy, resumeBusy, onPortal, onCancel, onResume }: {
  sub: ReturnType<typeof useMySubscription>;
  detail: UnlimitedDetail;
  portalBusy: boolean;
  resumeBusy: boolean;
  onPortal: () => void;
  onCancel: () => void;
  onResume: () => void;
}) {
  const title = (text: string) => (
    <h2 style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(24px, 6vw, 30px)', lineHeight: 1.15, color: INK, letterSpacing: '-0.01em' }}>
      {text}
    </h2>
  );

  const line = (text: string) => (
    <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.5, color: INK_SOFT, maxWidth: '44ch' }}>
      {text}
    </p>
  );

  const icon = (name: 'Infinity' | 'Sparkles') => (
    <span className="flex-shrink-0 inline-flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, backgroundColor: 'rgba(238,217,138,0.32)' }} aria-hidden>
      <Emoji3D name={name} size={32} fallback={name === 'Infinity' ? InfinityIcon : Sparkles} fallbackColor={FOREST} />
    </span>
  );

  const date = formatLongDate(detail.current_period_end);
  const cadenceWord = detail.status === 'monthly' ? 'monthly' : 'yearly';
  const onUnlimited = detail.status !== 'none';

  let body: React.ReactNode;

  if (sub.kind === 'past_due' && !onUnlimited) {
    // The failed renewal, unchanged: the one-time year is the way back.
    body = (
      <>
        {title(`Unlimited, ${sub.cadence === 'monthly' ? 'monthly' : 'yearly'}`)}
        <div className="mt-5 rounded-2xl p-5" style={{ backgroundColor: GOLD }}>
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.section, fontWeight: W.section, lineHeight: 1.25, color: INK }}>
            Your renewal did not go through
          </p>
          <div className="mt-4">
            <PrimaryButton onClick={() => openUnlimitedPopup({ renewOnce: true })}>Renew for a year</PrimaryButton>
          </div>
        </div>
      </>
    );
  } else if (detail.status === 'trial') {
    body = (
      <>
        {title('Unlimited, trial')}
        {line(date ? `Your trial ends on ${date}. It does not renew, so there is nothing to cancel.` : 'Your trial does not renew, so there is nothing to cancel.')}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>Get Unlimited</PrimaryButton>
        </div>
        {date && line(`Your paid plan starts when your current Unlimited ends on ${date}`)}
      </>
    );
  } else if (onUnlimited && detail.cancel_at_period_end) {
    body = (
      <>
        {title(`Unlimited, ${cadenceWord}`)}
        <span className="gv-sub-bye">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SAD_GAVIN_SRC} alt="" aria-hidden />
          We hate to see you go
        </span>
        {line(date ? `Unlimited stays on until ${date}. After that it will not renew.` : 'Unlimited stays on until the end of your period. After that it will not renew.')}
        <div className="gv-sub-resume">
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.section, fontWeight: W.section, lineHeight: 1.25, color: INK }}>Resume Subscription</p>
          <p style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.5, color: INK_SOFT }}>
            {date ? `Pick up where you left off. Your next charge is on ${date}.` : 'Pick up where you left off.'}
          </p>
          <div className="mt-4">
            <PrimaryButton onClick={onResume} disabled={resumeBusy || !detail.can_resume}>
              {resumeBusy ? 'Resuming…' : 'Resume subscription'}
            </PrimaryButton>
          </div>
        </div>
      </>
    );
  } else if (onUnlimited && detail.renews) {
    body = (
      <>
        {title(`Unlimited, ${cadenceWord}`)}
        {date && line(`Renews on ${date}`)}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <SecondaryButton onClick={onPortal} disabled={portalBusy}>
            {portalBusy ? 'Opening…' : 'Update payment method'}
          </SecondaryButton>
        </div>
        {detail.can_cancel && (
          <button type="button" className="gv-sub-quiet" onClick={onCancel}>Cancel subscription</button>
        )}
      </>
    );
  } else if (onUnlimited) {
    // A paid plan that is not a Stripe subscription: the one-time year (or a promo grant).
    body = (
      <>
        {title(`Unlimited, ${cadenceWord}`)}
        {line(date ? `Paid once. Active until ${date}. Nothing renews.` : 'Paid once. Nothing renews.')}
      </>
    );
  } else if (detail.lapsed_plan) {
    const lapsedOn = formatLongDate(detail.lapsed_at);
    body = (
      <>
        {title('Come Back to Unlimited')}
        {line(lapsedOn ? `Your Unlimited plan ended on ${lapsedOn}` : 'Your Unlimited plan ended')}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>Get Unlimited</PrimaryButton>
        </div>
      </>
    );
  } else {
    body = (
      <>
        {title('Free')}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>Get Unlimited</PrimaryButton>
        </div>
      </>
    );
  }

  return (
    <div className="flex items-start gap-4">
      {icon(onUnlimited ? 'Infinity' : 'Sparkles')}
      <div className="min-w-0 flex-1">
        <Eyebrow>Your plan</Eyebrow>
        {body}
      </div>
    </div>
  );
}
