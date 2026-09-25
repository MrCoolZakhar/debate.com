'use client';

// ── /pricing/subscription ────────────────────────────────────────────────────
// Gavelling Unlimited: the dark forest and gold identity. What it covers, the
// two plans (Free and Unlimited, monthly or yearly), the questions. Prices
// come from unlimitedPricing(); the prose states only the approved facts.

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Briefcase, FolderArchive, Infinity as InfinityIcon, Mail, Ticket, Wrench } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { formatUsd } from '@/lib/creditPricing';
import { unlimitedPricing } from '@/lib/payments';
import { openCreditsPopup, openUnlimitedPopup } from '@/lib/purchasePopup';
import { isUnlimited, useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { faqForPage } from '@/lib/pricingFaq';
import FaqList from '@/components/pricing/FaqList';
import RenewOnceOpener from '@/components/pricing/RenewOnceOpener';
import { ActionButton, ActionLink, FOCUS_RING, P, PricingStyles, QuestionBox, SectionHeading, StatusWord } from '@/components/pricing/pricingKit';

const BENEFITS = [
  { name: 'Ticket', fallback: Ticket, title: 'Apply to as many conferences as you like', text: 'Every application you make while Unlimited is active is covered. No counting, no topping up.', live: true },
  { name: 'File cabinet', fallback: FolderArchive, title: 'Your MUN archive', text: 'Everything you took part in, kept in one place.', live: false },
  { name: 'Toolbox', fallback: Wrench, title: 'Tools for your upcoming conferences', text: 'What you need before each conference you are going to.', live: false },
  { name: 'Envelope', fallback: Mail, title: 'Unlimited email builder for organizers', text: 'Every conference email, with no cap.', live: false },
  { name: 'Briefcase', fallback: Briefcase, title: 'Premium job board roles', text: 'Chair and secretariat openings across conferences.', live: false },
];

type Period = 'yearly' | 'monthly';

export default function SubscriptionPricingClient() {
  const status = useUnlimitedStatus();
  const onUnlimited = isUnlimited(status);
  const prices = unlimitedPricing(null);
  const monthly = formatUsd(prices.monthly * 100);
  const yearly = formatUsd(prices.yearly * 100);
  const [period, setPeriod] = useState<Period>('yearly');
  const faq = faqForPage('subscription');

  const unlimitedCta = onUnlimited
    ? <ActionLink href="/account/manage/subscription" skin="gold">You&apos;re on Unlimited</ActionLink>
    : <ActionButton skin="gold" onClick={() => openUnlimitedPopup()}>Go Unlimited</ActionButton>;

  return (
    <div className="gv-p" style={{ fontFamily: OUTFIT }}>
      <PricingStyles />
      <Suspense fallback={null}>
        <RenewOnceOpener />
      </Suspense>
      <style>{`
        .gv-su-hero{position:relative;display:grid;grid-template-columns:1fr;gap:28px;align-items:center;padding:clamp(28px,5vw,56px);border-radius:28px;background:${P.forestDeep};color:#FFFFFF;overflow:hidden}
        .gv-su-hero-eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${P.gold}}
        .gv-su-h1{margin:0;font-size:clamp(38px,5.6vw,68px);font-weight:900;letter-spacing:-0.035em;line-height:0.98;color:#FFFFFF}
        .gv-su-h1 em{font-style:normal;color:${P.gold}}
        .gv-su-lead{margin:20px 0 0;font-size:clamp(17px,1.6vw,19.5px);line-height:1.5;color:rgba(255,255,255,0.84);max-width:44ch}
        .gv-su-lead b{color:#FFFFFF;font-weight:700}
        .gv-su-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
        .gv-su-fine{margin:16px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.72);max-width:48ch}
        .gv-su-photo{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:16/10;background:${P.forest}}
        .gv-su-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:52% 62%;display:block}
        .gv-su-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(20,48,31,0.55),rgba(20,48,31,0) 55%);pointer-events:none}
        .gv-su-list{list-style:none;margin:28px 0 0;padding:0;border-top:1px solid rgba(27,56,40,0.14)}
        .gv-su-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px 18px;align-items:center;padding:20px 0;border-bottom:1px solid rgba(27,56,40,0.14)}
        .gv-su-row-text h3{margin:0;font-size:18px;font-weight:800;letter-spacing:-0.01em;line-height:1.25;color:${P.ink}}
        .gv-su-row-text p{margin:5px 0 0;font-size:15px;line-height:1.5;color:${P.inkSoft};max-width:60ch}
        .gv-su-row-status{grid-column:2}
        .gv-su-row-lead{padding:28px 0}
        .gv-su-row-lead h3{font-size:clamp(22px,2.4vw,27px)}
        .gv-su-row-lead p{font-size:16.5px}
        .gv-su-switch-wrap{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin-top:28px}
        .gv-su-switch{display:inline-grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:999px;background:rgba(27,56,40,0.08)}
        .gv-su-seg{min-width:112px;min-height:44px;padding:0 18px;border-radius:999px;border:none;background:transparent;color:${P.ink};font-family:${OUTFIT};font-size:15.5px;font-weight:600;cursor:pointer;transition:background-color 160ms ease-out,color 160ms ease-out}
        .gv-su-seg:hover{background:rgba(27,56,40,0.08)}
        .gv-su-seg[aria-checked="true"]{background:${P.forest};color:#FAF8F3;font-weight:700}
        .gv-su-switch-note{font-size:14px;font-weight:600;color:${P.forestLight}}
        .gv-su-plans{display:grid;grid-template-columns:1fr;gap:16px;margin-top:24px;align-items:stretch}
        .gv-su-plan{display:flex;flex-direction:column;padding:28px;border-radius:24px}
        .gv-su-plan-free{background:${P.surface};border:1px solid ${P.border}}
        .gv-su-plan-unl{background:${P.forestDeep};color:#FFFFFF;padding:36px 32px;box-shadow:0 24px 48px -28px rgba(20,48,31,0.7)}
        .gv-su-plan-name{margin:0;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase}
        .gv-su-plan-free .gv-su-plan-name{color:${P.inkSoft}}
        .gv-su-plan-unl .gv-su-plan-name{color:${P.gold}}
        .gv-su-price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:14px}
        .gv-su-price b{font-size:clamp(48px,6vw,72px);font-weight:900;letter-spacing:-0.045em;line-height:0.95;font-variant-numeric:tabular-nums}
        .gv-su-plan-free .gv-su-price b{font-size:clamp(36px,4vw,48px);color:${P.ink}}
        .gv-su-plan-unl .gv-su-price b{color:#FFFFFF}
        .gv-su-price span{font-size:18px;font-weight:600}
        .gv-su-plan-free .gv-su-price span{color:${P.inkSoft}}
        .gv-su-plan-unl .gv-su-price span{color:rgba(255,255,255,0.8)}
        .gv-su-price-note{margin:10px 0 0;font-size:15px;font-weight:700;color:${P.gold};min-height:1.4em}
        .gv-su-plan p.gv-su-plan-text{margin:16px 0 0;font-size:15.5px;line-height:1.55;max-width:44ch}
        .gv-su-plan-free p.gv-su-plan-text{color:${P.inkSoft}}
        .gv-su-plan-unl p.gv-su-plan-text{color:rgba(255,255,255,0.84)}
        .gv-su-plan-cta{margin-top:auto;padding-top:24px;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
        .gv-su-plan-small{margin:0;font-size:13.5px;line-height:1.5}
        .gv-su-plan-unl .gv-su-plan-small{color:rgba(255,255,255,0.72)}
        .gv-su-plan-free .gv-su-plan-small{color:${P.inkSoft}}
        .gv-su-promo{margin:20px 0 0;font-size:14.5px;line-height:1.55;color:${P.inkSoft}}
        .gv-su-promo a{color:${P.forest};font-weight:700}
        .gv-su-faq{margin-top:28px}
        @media (min-width:640px){
          .gv-su-row{grid-template-columns:auto minmax(0,1fr) auto}
          .gv-su-row-status{grid-column:auto}
        }
        @media (min-width:820px){
          .gv-su-plans{grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr)}
        }
        @media (min-width:900px){
          .gv-su-hero{grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:44px}
          .gv-su-photo{aspect-ratio:4/5}
        }
        @media (prefers-reduced-motion:reduce){.gv-su-seg{transition:none}}
      `}</style>

      {/* HERO */}
      <section className="gv-su-hero" aria-labelledby="gv-su-title">
        <div>
          <p className="gv-su-hero-eyebrow">
            <Emoji3D name="Infinity" size={28} fallback={InfinityIcon} fallbackColor={P.gold} />
            Gavelling Unlimited
          </p>
          <h1 id="gv-su-title" className="gv-su-h1">
            Apply to every conference.<br />
            <em>Never count a credit.</em>
          </h1>
          <p className="gv-su-lead">
            One plan that covers every application you make while it is active: <b>{monthly} a month</b> or <b>{yearly} a year</b>,
            the same everywhere. It renews until you cancel.
          </p>
          <div className="gv-su-actions">
            {unlimitedCta}
            <ActionLink href="/pricing/credits" skin="ghost-gold">Compare with credits</ActionLink>
          </div>
          <p className="gv-su-fine">Cancel any time and keep Unlimited until the end of the period you paid for. Credits you already hold stay in your balance.</p>
        </div>
        <figure className="gv-su-photo" style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/roles/chair.webp" alt="A presiding officer raising the gavel at the dais of a green-walled assembly hall" width={2500} height={1667} decoding="async" />
        </figure>
      </section>

      {/* WHAT UNLIMITED COVERS */}
      <SectionHeading eyebrow="What Unlimited covers" title="One plan, and everything that follows it" lead="Applications are covered today. The rest of the plan is on its way, and every part of it will be included." />
      <ul className="gv-su-list">
        {BENEFITS.map((b, i) => (
          <li key={b.title} className={`gv-su-row ${i === 0 ? 'gv-su-row-lead' : ''}`}>
            <Emoji3D name={b.name} size={i === 0 ? 48 : 34} fallback={b.fallback} fallbackColor={P.forest} />
            <div className="gv-su-row-text">
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
            <div className="gv-su-row-status">
              <StatusWord live={b.live} />
            </div>
          </li>
        ))}
      </ul>

      {/* PLANS */}
      <SectionHeading eyebrow="Plans" title="Free, or Unlimited" lead="Both start from the same free credit. Unlimited is for people who apply often, or apply for a delegation." id="plans" />
      <div className="gv-su-switch-wrap">
        <div className="gv-su-switch" role="radiogroup" aria-label="Billing period">
          {(['yearly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              tabIndex={period === p ? 0 : -1}
              className={`gv-su-seg ${FOCUS_RING}`}
              onClick={() => setPeriod(p)}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                  e.preventDefault();
                  const next: Period = p === 'yearly' ? 'monthly' : 'yearly';
                  setPeriod(next);
                  (e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-period="${next}"]`))?.focus();
                }
              }}
              data-period={p}
            >
              {p === 'yearly' ? 'Yearly' : 'Monthly'}
            </button>
          ))}
        </div>
        <span className="gv-su-switch-note" aria-live="polite">{period === 'yearly' ? 'Yearly gives you 2 months free' : `Monthly is ${monthly}, cancel whenever`}</span>
      </div>

      <div className="gv-su-plans">
        <article className="gv-su-plan gv-su-plan-free" aria-labelledby="gv-su-plan-free">
          <p id="gv-su-plan-free" className="gv-su-plan-name">Free</p>
          <div className="gv-su-price">
            <b>{formatUsd(0)}</b>
            <span>to start</span>
          </div>
          <p className="gv-su-plan-text">Your first credit is free, then a dollar a credit. Buy them one at a time or in a bundle, and use them whenever you apply.</p>
          <div className="gv-su-plan-cta">
            <ActionButton skin="ghost" onClick={() => openCreditsPopup({ context: 'pricing' })}>Buy credits</ActionButton>
            <p className="gv-su-plan-small">A rejected or withdrawn application returns its credit.</p>
          </div>
        </article>

        <article className="gv-su-plan gv-su-plan-unl" aria-labelledby="gv-su-plan-unl">
          <p id="gv-su-plan-unl" className="gv-su-plan-name">Unlimited</p>
          <div className="gv-su-price">
            <b>{period === 'yearly' ? yearly : monthly}</b>
            <span>{period === 'yearly' ? 'a year' : 'a month'}</span>
          </div>
          <p className="gv-su-price-note">{period === 'yearly' ? '2 months free' : `Or ${yearly} a year, with 2 months free`}</p>
          <p className="gv-su-plan-text">Every application covered while it is active. Renews until you cancel. Cancel any time and keep it until the end of the paid period.</p>
          <div className="gv-su-plan-cta">
            {unlimitedCta}
            <p className="gv-su-plan-small">Credits you already hold stay put while you are on Unlimited.</p>
          </div>
        </article>
      </div>
      <p className="gv-su-promo">
        Have a promo code? Redeem it in <Link href="/account/manage/promo">Manage account</Link>. A code adds credits or days of Unlimited straight away.
      </p>

      {/* QUESTIONS */}
      <SectionHeading title="Questions" id="questions" />
      <div className="gv-su-faq">
        <FaqList entries={faq} context="pricing" />
      </div>

      <QuestionBox />
    </div>
  );
}
