'use client';

// ── Credits and Unlimited (/store/credits, prompt 86, 27 Nov 2026) ──────────
//
// The approved "Credits and Unlimited" board of the canvas "Motion to Save:
// Store and Black Friday", in the black Store shell: the sale hero (only
// during a buy one, get one free sale; otherwise a short header) and its
// ticker, the sticky StoreBar, Pick Your Bundle, Gavelling Unlimited (id
// "unlimited"; ?plan=unlimited scrolls to it once), Questions. The layout
// closes with the Got a question box. What credits do is on /store.
//
// Prices: the credit bundles from the server price table (StoreBundlePicker),
// Unlimited from unlimitedPricing() and the sale row's
// unlimited_year_first_cents. The doubling is display only (a database
// trigger adds the free credits after a purchase).

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { MotionPlacard } from '@/components/store/MotionPlacards';
import StoreBundlePicker from '@/components/store/StoreBundlePicker';
import { Countdown, HeroScrollCue, StoreBar } from '@/components/store/storeKit';
import FaqList from '@/components/pricing/FaqList';
import RenewOnceOpener from '@/components/pricing/RenewOnceOpener';
import { formatUsd } from '@/lib/creditPricing';
import { unlimitedPricing } from '@/lib/payments';
import { faqForStoreCredits } from '@/lib/pricingFaq';
import { openCreditsPopup, openUnlimitedPopup } from '@/lib/purchasePopup';
import { saleEndLabel, useRunningSale } from '@/lib/storeSale';
import { isUnlimited, useUnlimitedStatus } from '@/lib/unlimitedStatus';

const JOBS_ROUTE = '/jobs';

// The lists from the old subscription page, kept in step with BENEFITS in the Unlimited pop-up.
const INCLUDED: { label: string; href?: string; soon?: boolean }[] = [
  { label: 'Apply to as many conferences as you like', href: '/conferences/explore' },
  { label: 'Premium MUN guides', href: '/guides' },
  { label: 'Your MUN archive', soon: true },
  { label: 'Your applications show first to organizers' },
  { label: "Insights on every role: who's applying and how fast it fills", href: JOBS_ROUTE },
  { label: 'Job alerts by email when new roles match', href: JOBS_ROUTE },
  { label: 'Premium-only roles on the Job Board', href: JOBS_ROUTE },
];
const FREE_LIST = ['Run and join sessions', 'Find and apply to conferences', 'Browse and apply on the Job Board', 'Your MUN CV'];

type Period = 'yearly' | 'monthly';

export default function CreditsUnlimitedClient() {
  const sale = useRunningSale();
  const bogo = !!sale?.credits_bogo;
  const status = useUnlimitedStatus();
  const onUnlimited = isUnlimited(status);
  const [period, setPeriod] = useState<Period>('yearly');

  const prices = unlimitedPricing(null);
  const yearlyCents = prices.yearly * 100;
  const firstCents = sale?.unlimited_year_first_cents ?? null;
  const saleYear = firstCents !== null && firstCents < yearlyCents;
  const yearly = formatUsd(yearlyCents);
  const monthly = formatUsd(prices.monthly * 100);
  const first = formatUsd(saleYear ? firstCents : yearlyCents);
  const ends = sale ? saleEndLabel(sale.ends_at) : '';

  // ?plan=unlimited (the /pricing/subscription and /account/unlimited redirects): scroll once, URL untouched.
  const unlimitedRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let plan: string | null = null;
    try { plan = new URLSearchParams(window.location.search).get('plan'); } catch { plan = null; }
    if (plan !== 'unlimited') return;
    const id = window.requestAnimationFrame(() => unlimitedRef.current?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const tickerPhrase = `Double your MUN · A year of Unlimited for ${first} · No expiry on free credits · Ends ${ends} · `;

  return (
    <>
      <style>{CSS}</style>
      <Suspense fallback={null}>
        <RenewOnceOpener />
      </Suspense>

      {sale && bogo ? (
        <section id="gv-cu-hero" className="gv-cu-hero" aria-labelledby="gv-cu-h1">
          <span className="gv-cu-hero-glow" aria-hidden />
          <div className="gv-s-wrap gv-cu-hero-in">
            <div className="gv-cu-hero-copy">
              <p className="gv-s-label">Motion to save · {sale.title || 'Black Friday'}</p>
              <h1 id="gv-cu-h1" className="gv-s-caps gv-cu-h1"><span className="gv-cu-h1-line">Double</span><span className="gv-cu-h1-line">your MUN</span></h1>
              <p className="gv-s-line" style={{ fontSize: 19, color: '#F6F2E8', maxWidth: 560 }}>
                Buy one, get one free on all credit purchases, with no expiry on usage. Until {ends}.
              </p>
              <Countdown endsAt={sale.ends_at} />
            </div>
            <div className="gv-cu-hero-art">
              <MotionPlacard text="×2" sub="CREDITS" label="A placard raised: double credits" />
            </div>
          </div>
          <HeroScrollCue heroId="gv-cu-hero" />
        </section>
      ) : (
        <header className="gv-s-wrap gv-cu-head">
          <h1 className="gv-s-caps gv-cu-h1 gv-cu-h1-plain">Credits and Unlimited</h1>
          <p className="gv-s-line" style={{ fontSize: 19 }}>One currency for everything on Gavelling</p>
        </header>
      )}

      {sale && bogo && (
        <div className="gv-cu-ticker" aria-hidden>
          <div className="gv-cu-ticker-track">
            <span>{tickerPhrase.repeat(4)}</span>
            <span>{tickerPhrase.repeat(4)}</span>
          </div>
        </div>
      )}

      <StoreBar />

      <div className="gv-s-wrap gv-cu-body">
        {/* ── Pick your bundle ── */}
        <section aria-labelledby="gv-cu-bundle">
          <div className="gv-s-head gv-cu-head-stack">
            <h2 id="gv-cu-bundle" className="gv-s-caps gv-s-h2">Pick your bundle</h2>
            <p className="gv-s-line gv-cu-head-line">
              {bogo
                ? <>Bigger bundles cost less a credit, and every bundle is doubled this weekend. Use them in the <Link href="/store" className="gv-s-a">Gavelling Store</Link>.</>
                : <>Bigger bundles cost less a credit. Use them in the <Link href="/store" className="gv-s-a">Gavelling Store</Link>.</>}
            </p>
          </div>
          <StoreBundlePicker bogo={bogo} />
        </section>

        {/* ── Gavelling Unlimited ── */}
        <section id="unlimited" ref={unlimitedRef} aria-labelledby="gv-cu-unl" className="gv-cu-unlimited">
          <div className="gv-s-head">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <h2 id="gv-cu-unl" className="gv-s-caps gv-s-h2">Gavelling Unlimited</h2>
              <p className="gv-s-line gv-cu-head-line">{saleYear ? 'Never spend a credit to apply again. Now at a discount.' : 'Never spend a credit to apply again.'}</p>
            </div>
            <div className="gv-cu-switch" role="radiogroup" aria-label="Billing period">
              {(['yearly', 'monthly'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  tabIndex={period === p ? 0 : -1}
                  data-period={p}
                  className="gv-cu-seg"
                  onClick={() => setPeriod(p)}
                  onKeyDown={(e) => {
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault();
                      const next: Period = p === 'yearly' ? 'monthly' : 'yearly';
                      setPeriod(next);
                      e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-period="${next}"]`)?.focus();
                    }
                  }}
                >
                  <span className="gv-cu-seg-w">{p === 'yearly' ? 'Yearly' : 'Monthly'}</span>
                  <small>{p === 'yearly' ? (saleYear ? `${first} the first year` : `${yearly} a year`) : `${monthly} a month`}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="gv-cu-plans">
            <article className="gv-s-card gv-cu-plan" aria-labelledby="gv-cu-free">
              <h3 id="gv-cu-free" className="gv-s-caps gv-cu-plan-t">Free</h3>
              <p className="gv-cu-plan-line">Everything you need to take part in MUN</p>
              <div className="gv-cu-price"><b>{formatUsd(0)}</b><span>to start</span></div>
              <ul className="gv-cu-list">
                {FREE_LIST.map((item) => (
                  <li key={item}><span className="gv-cu-tick" aria-hidden><Check size={14} strokeWidth={2.6} /></span>{item}</li>
                ))}
              </ul>
              <div className="gv-cu-plan-cta">
                <button type="button" className="gv-s-btn gv-s-outline" onClick={() => openCreditsPopup({ context: 'pricing' })}>Top up credits</button>
              </div>
            </article>

            <article className="gv-cu-plan gv-cu-plan-unl" aria-labelledby="gv-cu-unl-t">
              <div className="gv-cu-unl-bg" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gv-cu-unl-photo" src="/onboarding/hall-01.jpg" alt="" width={800} height={1000} loading="lazy" decoding="async" draggable={false} />
                <span className="gv-cu-unl-glass" />
              </div>
              <div className="gv-cu-plan-top">
                <h3 id="gv-cu-unl-t" className="gv-s-caps gv-cu-plan-t">Unlimited</h3>
                {sale && <span className="gv-cu-chip">Motion to save</span>}
              </div>
              <p className="gv-cu-plan-line">Unlimited applications. Unlimited guides. Unlimited MUN. Never spend a credit to apply again.</p>
              <div aria-live="polite">
                {period === 'yearly' && saleYear ? (
                  <>
                    <div className="gv-cu-price"><b>{first}</b><span>the first year</span><s className="gv-cu-was"><span className="sr-only">instead of </span>{yearly}</s></div>
                    <p className="gv-cu-note">Renews at {yearly} a year. Cancel anytime.</p>
                  </>
                ) : period === 'yearly' ? (
                  <>
                    <div className="gv-cu-price"><b>{yearly}</b><span>a year</span></div>
                    <p className="gv-cu-note">2 months free</p>
                  </>
                ) : (
                  <div className="gv-cu-price"><b>{monthly}</b><span>a month</span></div>
                )}
              </div>
              <ul className="gv-cu-list">
                {INCLUDED.map((item) => (
                  <li key={item.label}>
                    <span className="gv-cu-tick gv-cu-tick-on" aria-hidden><Check size={14} strokeWidth={2.6} /></span>
                    <span className="gv-cu-inc">
                      {item.label}
                      {item.href ? (
                        <Link href={item.href} className="gv-cu-go" aria-label={`${item.label}: go there`}>
                          <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
                        </Link>
                      ) : item.soon ? (
                        <span className="gv-cu-soon">Coming soon</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="gv-cu-plan-cta">
                {onUnlimited ? (
                  <Link href="/account/manage/subscription" className="gv-s-btn gv-s-big gv-s-cream">You&apos;re on Unlimited</Link>
                ) : (
                  <button type="button" className="gv-s-btn gv-s-big gv-s-cream" onClick={() => openUnlimitedPopup({ plan: period })}>
                    {period === 'yearly' && saleYear ? `Get a year for ${first}` : 'Go Unlimited'}
                  </button>
                )}
              </div>
            </article>
          </div>

          <p className="gv-s-line" style={{ marginTop: 24, fontSize: 16 }}>
            Have a promo code? Redeem it in <Link href="/account/manage/promo" className="gv-s-a">Manage account</Link>
          </p>
        </section>

        {/* ── Questions ── */}
        <section aria-labelledby="gv-cu-q" id="questions" style={{ scrollMarginTop: 100 }}>
          <div className="gv-s-head" style={{ borderBottom: 'none', marginBottom: 8 }}>
            <h2 id="gv-cu-q" className="gv-s-caps gv-s-h2">Questions</h2>
          </div>
          <div className="gv-cu-faq">
            <FaqList entries={faqForStoreCredits(bogo)} context="pricing" />
          </div>
        </section>
      </div>
    </>
  );
}

const CSS = `
.gv-cu-head{display:flex;flex-direction:column;gap:16px;padding-top:clamp(40px,5vw,72px);padding-bottom:clamp(32px,4vw,56px)}
.gv-cu-h1{font-size:clamp(64px,7.4vw,124px)}
.gv-cu-h1-line{display:block;white-space:nowrap}
.gv-cu-head-stack{flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:12px}
.gv-cu-head-line{max-width:60ch;text-align:left}
.gv-cu-h1-plain{font-size:clamp(56px,7.4vw,124px)}

.gv-cu-hero{position:relative;overflow:hidden;border-top:1px solid #22251F;border-bottom:1px solid #22251F}
.gv-cu-hero-glow{position:absolute;right:-10%;bottom:-40%;width:70%;height:90%;pointer-events:none;background:radial-gradient(closest-side,rgba(42,90,60,0.55),rgba(27,56,40,0.18) 55%,rgba(14,15,13,0) 100%)}
.gv-cu-hero-in{position:relative;display:grid;grid-template-columns:1fr;gap:24px}
.gv-cu-hero-copy{display:flex;flex-direction:column;gap:16px;padding-top:clamp(28px,3.4vw,48px);padding-bottom:8px;min-width:0}
.gv-cu-hero-art{height:300px;display:flex;align-items:flex-end;justify-content:center;min-width:0}
@media (min-width:1024px){
  .gv-cu-hero-in{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:40px;align-items:end}
  .gv-cu-hero-copy{padding-bottom:clamp(64px,5vw,76px)}
  .gv-cu-hero-art{height:clamp(360px,30vw,420px)}
}

.gv-cu-ticker{overflow:hidden;background:#F6F2E8;color:#0E0F0D;white-space:nowrap;border-bottom:1px solid #22251F}
.gv-cu-ticker-track{display:inline-flex;animation:gvCuTicker 60s linear infinite;will-change:transform}
.gv-cu-ticker-track span{display:inline-block;padding:14px 0;font-size:15px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
@keyframes gvCuTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.gv-cu-ticker-track{animation:none}}

.gv-cu-body{display:flex;flex-direction:column;gap:clamp(56px,6vw,96px);padding-top:clamp(28px,3vw,44px);padding-bottom:clamp(40px,4vw,64px)}
.gv-cu-unlimited{scroll-margin-top:100px}

.gv-cu-switch{display:inline-grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;border:1px solid #2A2D27;background:#161815}
.gv-cu-seg{min-width:140px;min-height:56px;padding:6px 18px;border-radius:10px;border:none;background:transparent;color:#BDB7A8;font:inherit;cursor:pointer;text-align:center;transition:background-color 160ms ease-out,color 160ms ease-out}
.gv-cu-seg:hover{color:#F6F2E8}
.gv-cu-seg:focus{outline:none}
.gv-cu-seg:focus-visible{outline:2px solid #F6F2E8;outline-offset:2px}
.gv-cu-seg[aria-checked="true"]{background:#F6F2E8;color:#0E0F0D}
.gv-cu-seg-w{display:block;font-size:13px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.gv-cu-seg small{display:block;margin-top:3px;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}

.gv-cu-plans{display:grid;grid-template-columns:1fr;gap:20px;align-items:stretch}
@media (min-width:900px){.gv-cu-plans{grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr)}}
.gv-cu-plan{display:flex;flex-direction:column;padding:32px;box-sizing:border-box;min-width:0}
.gv-cu-plan-unl{position:relative;overflow:hidden;isolation:isolate;border-radius:18px;background:#1B3828;border:1px solid #0E0F0D;box-shadow:0 0 0 1px #2A5A3C inset}
.gv-cu-plan-unl>:not(.gv-cu-unl-bg){position:relative;z-index:1}
.gv-cu-unl-bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.gv-cu-unl-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:52% 62%;filter:blur(6px) saturate(0.8);transform:scale(1.1)}
.gv-cu-unl-glass{position:absolute;inset:0;background:linear-gradient(165deg,rgba(27,56,40,0.80) 0%,rgba(14,30,20,0.92) 100%);box-shadow:0 0 0 1px #2A5A3C inset;border-radius:inherit}
.gv-cu-plan-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.gv-cu-plan-t{font-size:clamp(36px,3.6vw,52px);line-height:.9}
.gv-cu-chip{display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:8px;background:#0E0F0D;color:#F6F2E8;font-size:11.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.gv-cu-plan-line{margin:12px 0 0;font-size:16px;line-height:1.5;color:#BDB7A8}
.gv-cu-plan-unl .gv-cu-plan-line{color:#E8E3D6}
.gv-cu-price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:24px}
.gv-cu-price b{font-size:clamp(52px,6vw,76px);font-weight:900;letter-spacing:-0.05em;line-height:.9;color:#F6F2E8;font-variant-numeric:tabular-nums}
.gv-cu-price span{font-size:18px;font-weight:700;color:#BDB7A8}
.gv-cu-plan-unl .gv-cu-price span{color:#E8E3D6}
.gv-cu-was{font-size:20px;font-weight:800;color:#BDB7A8;text-decoration-thickness:2px;font-variant-numeric:tabular-nums}
.gv-cu-note{margin:10px 0 0;font-size:15px;font-weight:800;color:#A8C9B2}
.gv-cu-list{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:12px}
.gv-cu-list li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:12px;align-items:start;font-size:16px;line-height:1.4;font-weight:600;color:#F6F2E8}
.gv-cu-tick{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(168,201,178,.14);color:#A8C9B2}
.gv-cu-tick-on{background:#F6F2E8;color:#1B3828}
.gv-cu-inc{display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px 8px}
.gv-cu-go{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:rgba(246,242,232,.14);color:#F6F2E8;transition:background-color 140ms ease,transform 140ms ease}
.gv-cu-go:hover{background:rgba(246,242,232,.26);transform:translateX(2px)}
.gv-cu-go:focus{outline:none}
.gv-cu-go:focus-visible{outline:2px solid #F6F2E8;outline-offset:2px}
.gv-cu-soon{font-size:11.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#A8C9B2}
.gv-cu-plan-cta{margin-top:auto;padding-top:28px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
@media (max-width:639px){.gv-cu-plan{padding:24px}.gv-cu-seg{min-width:0}}
@media (prefers-reduced-motion:reduce){.gv-cu-seg,.gv-cu-go{transition:none}}

/* FaqList, restyled for black (its own rules stay for /help). */
.gv-cu-faq .gv-faq{border-top:1px solid #2A2D27;font-family:var(--font-brand),sans-serif}
.gv-cu-faq .gv-faq-row{border-bottom:1px solid #2A2D27}
.gv-cu-faq .gv-faq-q{color:#F6F2E8;font-family:inherit;font-size:18px;font-weight:700;padding:20px 0}
.gv-cu-faq .gv-faq-q svg{color:#BDB7A8}
.gv-cu-faq .gv-faq-q:focus-visible{box-shadow:0 0 0 2px #F6F2E8}
.gv-cu-faq .gv-faq-a p{color:#BDB7A8;font-size:16px}
.gv-cu-faq .gv-faq-act{background:#F6F2E8;color:#0E0F0D;font-family:inherit;border-radius:10px;letter-spacing:0;text-transform:none;font-size:14px;font-weight:800}
.gv-cu-faq .gv-faq-act:hover{background:#FFFFFF}
.gv-cu-faq .gv-faq-act:focus-visible{box-shadow:0 0 0 2px #0E0F0D,0 0 0 4px #F6F2E8}
`;
