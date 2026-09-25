'use client';

// Manage Account: Subscription. Two columns from 900px: the current plan on
// the left (read through useMySubscription, the one definition the pop-up
// shares), the Unlimited benefits on a forest card on the right. GO UNLIMITED
// opens the global pop-up; MANAGE OR CANCEL opens Stripe's billing portal, the
// one place a paid plan changes. There is no in-app cancel flow on purpose.

import { useState } from 'react';
import { Check, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { useMySubscription, formatPlanDate } from '@/lib/mySubscription';
import { openUnlimitedPopup } from '@/lib/purchasePopup';
import { openBillingPortal, checkoutErrorText } from '@/lib/purchaseCheckout';
import { notifyErr } from '@/lib/appNotify';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { OUTFIT, T, W } from '../../accountUi';
import {
  PageHead, HelpLine, PrimaryButton, ButtonStyles, WhiteCard, ForestCard, Eyebrow, TextLink,
  FOREST, GOLD, INK, INK_SOFT, IVORY,
} from '../manageUi';

// Kept in step with the Unlimited pop-up's list (owner, 25 Sep 2026).
const BENEFITS = [
  'Apply to as many conferences as you like',
  'Premium MUN guides',
  'Your MUN archive',
  'Premium job board roles',
];

export default function SubscriptionPage() {
  const sub = useMySubscription();
  const [portalBusy, setPortalBusy] = useState(false);

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

  return (
    <div>
      <ButtonStyles />
      <style>{`
        .gv-sub-grid{display:grid;grid-template-columns:1fr;gap:20px;align-items:start}
        @media (min-width:900px){.gv-sub-grid{grid-template-columns:1fr 1fr;gap:24px}}
      `}</style>

      <PageHead title={<>Your <GoldWord>Subscription</GoldWord></>} />

      <div className="gv-sub-grid">
        <WhiteCard aria-live="polite">
          {sub.loading ? (
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>Reading your plan</p>
          ) : (
            <PlanBlock sub={sub} portalBusy={portalBusy} onPortal={handlePortal} />
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
    </div>
  );
}

function PlanBlock({ sub, portalBusy, onPortal }: {
  sub: ReturnType<typeof useMySubscription>;
  portalBusy: boolean;
  onPortal: () => void;
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

  const date = sub.endsAt ? formatPlanDate(sub.endsAt) : null;
  const cadenceWord = sub.cadence === 'monthly' ? 'monthly' : 'yearly';

  let body: React.ReactNode;

  if (sub.kind === 'trial') {
    body = (
      <>
        {title('Unlimited, trial')}
        {date && line(`Ends on ${date}`)}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>GO UNLIMITED</PrimaryButton>
        </div>
        {date && line(`Your paid plan starts when your current Unlimited ends on ${date}`)}
      </>
    );
  } else if (sub.kind === 'paid') {
    body = (
      <>
        {title(`Unlimited, ${cadenceWord}`)}
        {date && line(`Renews on ${date}`)}
        <div className="mt-5">
          <PrimaryButton onClick={onPortal} disabled={portalBusy}>
            {portalBusy ? 'OPENING' : 'MANAGE OR CANCEL'}
          </PrimaryButton>
        </div>
        {line('Cancelling keeps Unlimited until the end of the period you paid for')}
      </>
    );
  } else if (sub.kind === 'past_due') {
    body = (
      <>
        {title(`Unlimited, ${cadenceWord}`)}
        <div className="mt-5 rounded-2xl p-5" style={{ backgroundColor: GOLD }}>
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.section, fontWeight: W.section, lineHeight: 1.25, color: INK }}>
            Your renewal did not go through
          </p>
          <div className="mt-4">
            <PrimaryButton onClick={() => openUnlimitedPopup({ renewOnce: true })}>RENEW FOR A YEAR</PrimaryButton>
          </div>
        </div>
      </>
    );
  } else if (sub.kind === 'lapsed') {
    body = (
      <>
        {title('Free')}
        {line(date ? `Your Unlimited plan ended on ${date}` : 'Your Unlimited plan ended')}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>GO UNLIMITED</PrimaryButton>
        </div>
      </>
    );
  } else {
    body = (
      <>
        {title('Free')}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>GO UNLIMITED</PrimaryButton>
        </div>
      </>
    );
  }

  const onUnlimited = sub.kind === 'trial' || sub.kind === 'paid' || sub.kind === 'past_due';

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
