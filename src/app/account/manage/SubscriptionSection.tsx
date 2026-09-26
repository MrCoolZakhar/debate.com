'use client';

// Manage account, the plan card (one page since 26 Sep 2026, see
// ManageAccount.tsx): the whole my_unlimited_status() object through
// useUnlimitedDetail, plus useMySubscription for the failed-renewal case. On
// Unlimited the card is the pricing page's dark glass Unlimited card; on Free
// (or after a lapse, or a failed renewal) a white card with the benefits. Exactly ONE state shows
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
import CancelledPopup from '@/components/purchase/CancelledPopup';
import { GOLD_CTA_BG, GOLD_CTA_INK, GOLD_CTA_SHADOW } from '@/components/GoldButton';
import { OUTFIT, T, W } from '../accountUi';
import {
  PrimaryButton, SecondaryButton, WhiteCard, Eyebrow, TextLink,
  FOREST, GOLD, INK, INK_SOFT, IVORY,
} from './manageUi';

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

/** The plan card of Manage account: every state, the cancel sheet, resume,
 *  the billing portal and 'We hate to see you go'. */
export default function SubscriptionSection() {
  const sub = useMySubscription();
  const { detail, loading: detailLoading } = useUnlimitedDetail();
  const { user } = useAuth();
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  // "We hate to see you go...", opened when a cancel lands.
  const [byeOpen, setByeOpen] = useState(false);
  const [byeErr, setByeErr] = useState('');

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

  async function handleResume(fromBye = false) {
    if (resumeBusy) return;
    setResumeBusy(true);
    setByeErr('');
    try {
      await manageSubscription({ action: 'resume' });
      notifyOk('Welcome back. Unlimited renews as before.', 'purchase');
      setByeOpen(false);
      // One refresh updates every plan reader on the page and in the chrome.
      notifyPlanChanged(user?.id);
    } catch (err) {
      if (fromBye) setByeErr(manageErrorText(err, 'resume'));
      else notifyErr(manageErrorText(err, 'resume'));
    } finally {
      setResumeBusy(false);
    }
  }

  const loading = sub.loading || detailLoading;

  const onUnlimited = !!detail && detail.status !== 'none';

  return (
    <>
      <style>{`
        .gv-sub-quiet{display:inline-block;background:none;border:none;padding:0;margin-top:14px;font-family:${OUTFIT};font-size:${T.body}px;font-weight:700;color:${INK_SOFT};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .gv-sub-quiet:hover{color:${INK}}
        .gv-sub-dark .gv-sub-quiet{color:rgba(255,255,255,0.78)}
        .gv-sub-dark .gv-sub-quiet:hover{color:#FFFFFF}
        .gv-sub-quiet:focus{outline:none}
        .gv-sub-quiet:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
        .gv-sub-dark .gv-sub-quiet:focus-visible{outline-color:#EED98A}
        .gv-sub-dark .gv-btn-primary{background:${GOLD_CTA_BG} !important;color:${GOLD_CTA_INK} !important;box-shadow:${GOLD_CTA_SHADOW} !important}
        .gv-sub-bye{display:inline-flex;align-items:center;gap:10px;margin-top:10px;padding:6px 14px 6px 6px;border-radius:999px;background:${IVORY};box-shadow:inset 0 0 0 1px rgba(27,56,40,0.12);font-family:${OUTFIT};font-size:13px;font-weight:700;color:${INK}}
        .gv-sub-bye img{width:36px;height:36px;object-fit:contain;display:block}
        .gv-sub-resume{margin-top:18px;padding:18px 20px;border-radius:18px;background:${IVORY};box-shadow:inset 0 0 0 1px rgba(27,56,40,0.12)}
        .gv-sub-glass{position:relative;overflow:hidden;isolation:isolate;border-radius:24px;padding:28px 26px;color:#FFFFFF;background:#14301F;
          box-shadow:inset 0 0 0 1px rgba(238,217,138,0.55),0 28px 56px -30px rgba(20,48,31,0.75)}
        .gv-sub-glass>:not(.gv-sub-glass-bg){position:relative;z-index:1}
        .gv-sub-glass-bg{position:absolute;inset:0;z-index:0;pointer-events:none}
        .gv-sub-glass-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:52% 62%;filter:blur(8px) saturate(0.8);transform:scale(1.12)}
        .gv-sub-glass-bg span{position:absolute;inset:0;background:radial-gradient(90% 60% at 100% 0%,rgba(238,217,138,0.22) 0%,rgba(238,217,138,0) 60%),linear-gradient(165deg,rgba(20,48,31,0.74) 0%,rgba(10,28,18,0.88) 100%)}
      `}</style>

      {onUnlimited && detail && !loading ? (
        // On Unlimited: the pricing page's glass Unlimited card (dark glass
        // over the hall photo, a gold edge), with the plan's state inside.
        <section id="subscription" className="gv-sub-glass gv-sub-dark" style={{ scrollMarginTop: 96 }} aria-live="polite">
          <div className="gv-sub-glass-bg" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/onboarding/hall-01.jpg" alt="" width={800} height={1000} loading="lazy" decoding="async" draggable={false} />
            <span />
          </div>
          <PlanBlock
            dark
            sub={sub}
            detail={detail}
            portalBusy={portalBusy}
            resumeBusy={resumeBusy}
            onPortal={handlePortal}
            onCancel={() => setCancelOpen(true)}
            onResume={() => { void handleResume(); }}
          />
        </section>
      ) : (
        <WhiteCard id="subscription" aria-live="polite" style={{ scrollMarginTop: 96 }}>
          {loading || !detail ? (
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>Reading your plan</p>
          ) : (
            <>
              <PlanBlock
                sub={sub}
                detail={detail}
                portalBusy={portalBusy}
                resumeBusy={resumeBusy}
                onPortal={handlePortal}
                onCancel={() => setCancelOpen(true)}
                onResume={() => { void handleResume(); }}
              />
              {/* What Unlimited adds, as on /pricing/subscription */}
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(27,56,40,0.10)' }}>
                <p style={{ margin: 0, fontFamily: OUTFIT, fontWeight: W.title, fontSize: 17, color: INK }}>
                  Everything in <GoldWord>Unlimited</GoldWord>
                </p>
                <ul className="flex flex-col gap-2.5" style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-center gap-3" style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: W.label, color: INK, lineHeight: 1.4 }}>
                      <span className="inline-flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 24, height: 24, background: 'linear-gradient(135deg, rgba(238,217,138,0.6), rgba(238,217,138,0.3))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }} aria-hidden>
                        <Check size={14} strokeWidth={3} style={{ color: FOREST }} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <p style={{ margin: '14px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>
                  <TextLink href="/pricing/subscription">Find out more</TextLink>
                </p>
              </div>
            </>
          )}
        </WhiteCard>
      )}

      {cancelOpen && (
        <CancelUnlimitedSheet
          untilDate={formatLongDate(detail?.current_period_end)}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => {
            setCancelOpen(false);
            setByeErr('');
            setByeOpen(true);
            notifyPlanChanged(user?.id);
          }}
        />
      )}

      {byeOpen && (
        <CancelledPopup
          untilDate={formatLongDate(detail?.current_period_end)}
          gavinSrc={SAD_GAVIN_SRC}
          busy={resumeBusy}
          err={byeErr}
          onResume={() => { void handleResume(true); }}
          onClose={() => setByeOpen(false)}
        />
      )}
    </>
  );
}

function PlanBlock({ sub, detail, portalBusy, resumeBusy, onPortal, onCancel, onResume, dark = false }: {
  /** Drawn inside the dark glass Unlimited card. */
  dark?: boolean;
  sub: ReturnType<typeof useMySubscription>;
  detail: UnlimitedDetail;
  portalBusy: boolean;
  resumeBusy: boolean;
  onPortal: () => void;
  onCancel: () => void;
  onResume: () => void;
}) {
  const title = (text: string) => (
    <h2 style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(24px, 6vw, 30px)', lineHeight: 1.15, color: dark ? '#FFFFFF' : INK, letterSpacing: '-0.01em' }}>
      {text}
    </h2>
  );

  const line = (text: string) => (
    <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.5, color: dark ? 'rgba(255,255,255,0.84)' : INK_SOFT, maxWidth: '44ch' }}>
      {text}
    </p>
  );

  const icon = (name: 'Infinity' | 'Sparkles') => (
    <span className="flex-shrink-0 inline-flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, backgroundColor: dark ? 'rgba(238,217,138,0.18)' : 'rgba(238,217,138,0.32)' }} aria-hidden>
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
          <SecondaryButton
            onClick={onPortal}
            disabled={portalBusy}
            style={dark ? { backgroundColor: 'transparent', color: '#FFFFFF', borderColor: 'rgba(250,248,243,0.75)' } : undefined}
          >
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
        {line('Free is the basic plan: apply to conferences with credits, run sessions and keep your MUN CV. Upgrade to Unlimited whenever you like, and cancel any time.')}
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
        <Eyebrow onDark={dark}>Your plan</Eyebrow>
        {body}
      </div>
    </div>
  );
}
