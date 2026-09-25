'use client';

// ── /pricing/subscription ────────────────────────────────────────────────────
// Gavelling Unlimited. A forest hero with a gold infinity composition, the
// two plan cards straight under it (Yearly by default, the switch passes
// its state into the pop-up), the feature strip, the promo line, the
// questions. Prices come from unlimitedPricing().

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Check, FolderArchive, Infinity as InfinityIcon, Mail, Ticket, Wrench } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { formatUsd } from '@/lib/creditPricing';
import { unlimitedPricing } from '@/lib/payments';
import { openCreditsPopup, openUnlimitedPopup } from '@/lib/purchasePopup';
import { isUnlimited, useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { faqForPage } from '@/lib/pricingFaq';
import FaqList from '@/components/pricing/FaqList';
import RenewOnceOpener from '@/components/pricing/RenewOnceOpener';
import { ActionButton, ActionLink, FOCUS_RING, P, PricingStyles, QuestionBox } from '@/components/pricing/pricingKit';

const INCLUDED = [
  { name: 'Ticket', fallback: Ticket, label: 'Every application covered' },
  { name: 'Briefcase', fallback: Briefcase, label: 'Premium job board roles' },
  { name: 'File cabinet', fallback: FolderArchive, label: 'Your MUN archive' },
  { name: 'Toolbox', fallback: Wrench, label: 'Tools for your upcoming conferences' },
  { name: 'Envelope', fallback: Mail, label: 'Unlimited email builder for organizers' },
];

const FREE_LIST = ['Run and join sessions', 'Find and apply to conferences', 'The job board', 'Your MUN CV'];
const UNLIMITED_LIST = INCLUDED.map((i) => i.label);

type Period = 'yearly' | 'monthly';

export default function SubscriptionPricingClient() {
  const status = useUnlimitedStatus();
  const onUnlimited = isUnlimited(status);
  const prices = unlimitedPricing(null);
  const monthly = formatUsd(prices.monthly * 100);
  const yearly = formatUsd(prices.yearly * 100);
  const [period, setPeriod] = useState<Period>('yearly');
  const faq = faqForPage('subscription');

  const unlimitedCta = (big: boolean, onForest: boolean) => onUnlimited
    ? <ActionLink href="/account/manage/subscription" skin="gold" big={big} onForest={onForest}>You&apos;re on Unlimited</ActionLink>
    : <ActionButton skin="gold" big={big} onForest={onForest} onClick={() => openUnlimitedPopup({ plan: period })}>Go Unlimited</ActionButton>;

  return (
    <div className="gv-p" style={{ fontFamily: OUTFIT }}>
      <PricingStyles />
      <Suspense fallback={null}>
        <RenewOnceOpener />
      </Suspense>
      <style>{`
        .gv-su-hero{position:relative;padding:12px 8px 8px;margin-bottom:28px}
        .gv-su-hero-in{position:relative;z-index:2;max-width:640px}
        .gv-su-h1{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin:0;font-size:clamp(42px,5.2vw,58px);font-weight:800;letter-spacing:-0.03em;line-height:1;color:${P.ink}}
        .gv-su-line{margin:14px 0 0;font-size:clamp(17px,1.6vw,20px);line-height:1.4;font-weight:600;color:${P.forest}}
        .gv-su-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:24px}
        .gv-su-fine{margin:12px 0 0;font-size:13.5px;line-height:1.45;color:${P.inkSoft};text-align:left}
        .gv-su-plans-wrap{margin-top:28px}
        .gv-su-switch-row{display:flex;justify-content:center;margin-bottom:20px}
        .gv-su-switch{display:inline-grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:999px;background:${P.white};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 12px 28px -24px rgba(27,56,40,0.5)}
        .gv-su-seg{min-width:128px;min-height:44px;padding:0 18px;border-radius:999px;border:none;background:transparent;color:${P.ink};font-family:${OUTFIT};font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:background-color 160ms ease-out,color 160ms ease-out}
        .gv-su-seg:hover{background:rgba(27,56,40,0.07)}
        .gv-su-seg[aria-checked="true"]{background:${P.forest};color:${P.gold}}
        .gv-su-seg small{display:block;margin-top:2px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:none;opacity:0.8}
        .gv-su-plans{display:grid;grid-template-columns:1fr;gap:16px;align-items:stretch}
        .gv-su-plan{display:flex;flex-direction:column;padding:30px 28px;border-radius:26px}
        .gv-su-plan-free{background:${P.white};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
        .gv-su-plan-unl{background:${P.forest};color:#FFFFFF;padding:38px 32px;box-shadow:0 28px 56px -30px rgba(20,48,31,0.75)}
        .gv-su-plan-name{margin:0;font-size:clamp(28px,3vw,34px);font-weight:800;letter-spacing:-0.02em;line-height:1.05}
        .gv-su-plan-free .gv-su-plan-name{color:${P.ink}}
        .gv-su-plan-unl .gv-su-plan-name{color:#FFFFFF}
        .gv-su-plan-line{margin:8px 0 0;font-size:15.5px;line-height:1.45}
        .gv-su-plan-free .gv-su-plan-line{color:${P.inkSoft}}
        .gv-su-plan-unl .gv-su-plan-line{color:rgba(255,255,255,0.82)}
        .gv-su-price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:22px}
        .gv-su-price b{font-size:clamp(48px,6vw,68px);font-weight:900;letter-spacing:-0.045em;line-height:0.95;font-variant-numeric:tabular-nums}
        .gv-su-plan-free .gv-su-price b{font-size:clamp(40px,4.4vw,52px);color:${P.forest}}
        .gv-su-plan-unl .gv-su-price b{color:#FFFFFF}
        .gv-su-price span{font-size:18px;font-weight:600}
        .gv-su-plan-free .gv-su-price span{color:${P.inkSoft}}
        .gv-su-plan-unl .gv-su-price span{color:rgba(255,255,255,0.82)}
        .gv-su-price-note{margin:8px 0 0;font-size:14px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${P.gold};min-height:1.4em}
        .gv-su-list{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:12px}
        .gv-su-list li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:12px;align-items:start;font-size:16px;line-height:1.4;font-weight:600}
        .gv-su-plan-free .gv-su-list li{color:${P.ink}}
        .gv-su-plan-unl .gv-su-list li{color:#FFFFFF}
        .gv-su-tick{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;margin-top:0}
        .gv-su-plan-free .gv-su-tick{background:${P.forest};color:${P.gold}}
        .gv-su-plan-unl .gv-su-tick{background:${P.gold};color:${P.forest}}
        .gv-su-plan-cta{margin-top:auto;padding-top:28px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
        .gv-su-plan-small{margin:0;font-size:13.5px;line-height:1.45;color:${P.inkSoft}}
        .gv-su-strip{display:grid;grid-template-columns:1fr;gap:14px 24px}
        .gv-su-strip-item{display:flex;align-items:center;gap:14px;min-height:56px;font-size:15.5px;font-weight:700;line-height:1.3;color:${P.ink}}
        .gv-su-promo{margin:24px 0 0;padding:0 8px;font-size:15.5px;line-height:1.5;color:${P.inkSoft}}
        .gv-su-promo a{color:${P.forest}}
        .gv-su-faq{margin-top:24px}
        @media (min-width:640px){
          .gv-su-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media (min-width:820px){
          .gv-su-plans{grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr)}
          .gv-su-plan-unl{margin:-10px 0}
        }
        @media (min-width:1100px){
          .gv-su-strip{grid-template-columns:repeat(5,minmax(0,1fr))}
          .gv-su-strip-item{flex-direction:column;align-items:flex-start;gap:12px;min-height:0}
        }
        @media (prefers-reduced-motion:reduce){.gv-su-seg{transition:none}}
      `}</style>

      {/* HERO: straight on the page, no card and no ring decoration (owner,
          25 Sep 2026). Ink title with the gold word, the line in forest. */}
      <section className="gv-su-hero" aria-labelledby="gv-su-title">
        <div className="gv-su-hero-in">
          <h1 id="gv-su-title" className="gv-su-h1">
            <Emoji3D name="Infinity" size={48} fallback={InfinityIcon} fallbackColor={P.goldDeep} />
            <span>Gavelling <GoldWord tone="light">Unlimited</GoldWord></span>
          </h1>
          <p className="gv-su-line">Unlock Unlimited MUN and Unlimited Gavelling</p>
          <div className="gv-su-actions">
            {unlimitedCta(true, false)}
            <ActionButton skin="outline" onClick={() => openCreditsPopup({ context: 'pricing' })}>Top up credits</ActionButton>
          </div>
          <p className="gv-su-fine">Cancel anytime and keep Unlimited until the end of the period you paid for</p>
        </div>
      </section>

      {/* PLANS: straight under the hero */}
      <div className="gv-su-plans-wrap gv-p-open">
        <div className="gv-su-switch-row">
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
                <small>{p === 'yearly' ? `${yearly} a year` : `${monthly} a month`}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="gv-su-plans">
          <article className="gv-su-plan gv-su-plan-free" aria-labelledby="gv-su-plan-free">
            <h2 id="gv-su-plan-free" className="gv-su-plan-name">Free</h2>
            <p className="gv-su-plan-line">Everything you need to take part in MUN</p>
            <div className="gv-su-price">
              <b>{formatUsd(0)}</b>
              <span>to start</span>
            </div>
            <ul className="gv-su-list">
              {FREE_LIST.map((item) => (
                <li key={item}>
                  <span className="gv-su-tick" aria-hidden><Check size={14} strokeWidth={3.2} /></span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="gv-su-plan-cta">
              <ActionButton skin="forest" onClick={() => openCreditsPopup({ context: 'pricing' })}>Top up credits</ActionButton>
              <p className="gv-su-plan-small">Applications use credits</p>
            </div>
          </article>

          <article className="gv-su-plan gv-su-plan-unl" aria-labelledby="gv-su-plan-unl">
            <h2 id="gv-su-plan-unl" className="gv-su-plan-name">Unlimited</h2>
            <p className="gv-su-plan-line">Unlimited MUN and Unlimited Gavelling</p>
            <div className="gv-su-price" aria-live="polite">
              <b>{period === 'yearly' ? yearly : monthly}</b>
              <span>{period === 'yearly' ? 'a year' : 'a month'}</span>
            </div>
            <p className="gv-su-price-note">{period === 'yearly' ? '2 months free' : `Or ${yearly} a year`}</p>
            <ul className="gv-su-list">
              {UNLIMITED_LIST.map((item) => (
                <li key={item}>
                  <span className="gv-su-tick" aria-hidden><Check size={14} strokeWidth={3.2} /></span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="gv-su-plan-cta">
              {unlimitedCta(true, true)}
            </div>
          </article>
        </div>
      </div>

      {/* WHAT UNLIMITED INCLUDES: the strip, no heading */}
      <section className="gv-p-block gv-p-block-white" aria-label="What Unlimited includes">
        <div className="gv-su-strip">
          {INCLUDED.map((i) => (
            <div key={i.label} className="gv-su-strip-item">
              <Emoji3D name={i.name} size={44} fallback={i.fallback} fallbackColor={P.forest} />
              <span>{i.label}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="gv-su-promo gv-p-open">
        Have a promo code? Redeem it in <Link href="/account/manage/promo" className={`gv-p-link ${FOCUS_RING}`}>Manage account</Link>
      </p>

      {/* QUESTIONS: white */}
      <section className="gv-p-block gv-p-block-white" aria-labelledby="gv-su-faq-title" id="questions" style={{ scrollMarginTop: 96 }}>
        <h2 id="gv-su-faq-title" className="gv-p-h2">Common <GoldWord tone="light">Questions</GoldWord></h2>
        <div className="gv-su-faq">
          <FaqList entries={faq} context="pricing" />
        </div>
      </section>

      <QuestionBox />
    </div>
  );
}
