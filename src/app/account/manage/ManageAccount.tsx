'use client';

// Manage account: ONE page (26 Sep 2026, owner: "Manage account with the
// credits and everything could be much smarter and nicer looking ... linked
// with the pricing page ... There doesn't need to be 3 pages for this").
//
//   hero            "Credits and Plan", a link to pricing
//   #credits        the balance as a big number + "credits", Top up (the
//                   credits pop-up), three figures             CreditsSection
//   #subscription   the plan card, every state of CLAUDE.md §3 (renewing,
//                   cancelled, trial, one-time year, failed renewal, nothing,
//                   Come Back to Unlimited); on Unlimited it is the pricing
//                   page's dark glass Unlimited card            SubscriptionSection
//   the 30-day usage chart, then
//   #promo          a small promo code card                     PromoSection
//   the history (my_credit_activity, middle column "Action")
//
// Served at /account/manage. /account/manage/credits, /subscription and
// /promo render this same page scrolled to their section (not redirected:
// browsers cached the old 308 from /account/manage to /credits).

import { useEffect } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { AccountHero } from '../accountShell';
import { ButtonStyles, HelpLine } from './manageUi';
import CreditsSection from './CreditsSection';
import SubscriptionSection from './SubscriptionSection';
import PromoSection from './PromoSection';

export type ManageFocus = 'credits' | 'subscription' | 'promo';

export default function ManageAccount({ focus }: { focus?: ManageFocus }) {
  // Bring the asked-for section into view once the cards have laid out: the
  // hash (#credits, #subscription, #promo) wins, else the old sub-path.
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    const target = (['credits', 'subscription', 'promo'] as const).find((k) => k === hash) ?? focus;
    if (!target) return;
    const t = setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
    return () => clearTimeout(t);
  }, [focus]);

  return (
    <div>
      <ButtonStyles />
      <AccountHero
        label="Manage account"
        title={<>Credits and <GoldWord>Plan</GoldWord></>}
        line="Your balance, your plan and promo codes, in one place"
        emoji="Coin"
        fallback={Coins}
        aside={<Link href="/pricing/credits" className="gv-acct-btn2">See pricing</Link>}
      />
      <CreditsSection plan={<SubscriptionSection />} promo={<PromoSection />} />
      <div className="px-2 sm:px-4 md:px-6"><HelpLine /></div>
    </div>
  );
}
