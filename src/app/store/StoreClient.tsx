'use client';

// ── The Gavelling Store (/store, prompt 85, 27 Nov 2026) ────────────────────
//
// The approved canvas "Motion to Save: Store and Black Friday". Top to bottom:
// the sale hero (only while a sale runs; otherwise a short header), the
// ticker (sale only), the sticky StoreBar, the two offer cards (credits,
// Unlimited), For Delegates, Marketing and Visibility, For Organisers. The
// layout closes the page with the Got a question box.
//
// No price is typed here. Unlimited comes from unlimitedPricing() and the sale
// row (unlimited_year_first_cents), spotlights from spotlight_placements (the
// conference Store's PlacementPrice and the same read), the Job Board
// promotion from job_prices. The counts in the copy (1 credit an application,
// 100 emails for 1 credit) are the product's rules as the prompt wrote them.

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { MotionPlacards } from '@/components/store/MotionPlacards';
import { ComingSoon, Countdown, StoreBar, StoreSectionHead, WaitlistButton, type WaitlistItem } from '@/components/store/storeKit';
import { openAuth } from '@/lib/authModal';
import { formatUsd } from '@/lib/creditPricing';
import { unlimitedPricing } from '@/lib/payments';
import { saleEndLabel, useRunningSale } from '@/lib/storeSale';
import { supabase } from '@/lib/supabase';
import { PLACEMENTS, type Placement, type PlacementPrice } from '@/app/manage/[slug]/store/storeApi';

const ORGANISER_HOME = '/account/conferences';

// ── Prices read once per page ───────────────────────────────────────────────

function useStorePrices() {
  const [prices, setPrices] = useState<Record<string, PlacementPrice>>({});
  const [promoFrom, setPromoFrom] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      // The conference Store's read of spotlight_placements (storeApi.useStoreData), anon here.
      supabase.from('spotlight_placements').select('placement, day_price, week_price, capacity, label'),
      supabase.from('job_prices').select('key, credits'),
    ]).then(([sp, jp]) => {
      if (cancelled) return;
      const next: Record<string, PlacementPrice> = {};
      for (const row of (sp.data ?? []) as PlacementPrice[]) next[row.placement] = row;
      setPrices(next);
      const promos = ((jp.data ?? []) as { key: string; credits: number }[])
        .filter((r) => typeof r.key === 'string' && r.key.startsWith('promo_') && typeof r.credits === 'number' && r.credits > 0)
        .map((r) => r.credits);
      setPromoFrom(promos.length ? Math.min(...promos) : null);
    }).catch(() => { /* prices stay hidden; nothing typed in their place */ });
    return () => { cancelled = true; };
  }, []);
  return { prices, promoFrom };
}

/** "25" "credits a week" when a week is the natural unit, else "1" "credit a day" (the conference Store's priceLine rule). */
function spotlightUnit(p: PlacementPrice | undefined): { n: string; unit: string } | null {
  if (!p) return null;
  if (p.day_price * 7 > p.week_price) return { n: p.week_price.toLocaleString('en-US'), unit: p.week_price === 1 ? 'credit a week' : 'credits a week' };
  return { n: p.day_price.toLocaleString('en-US'), unit: p.day_price === 1 ? 'credit a day' : 'credits a day' };
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** Signed in: a link to the organiser's conferences. Signed out: the auth pop-up, then there. */
function OrganiserAction({ label, variant }: { label: string; variant: 'link' | 'button' }) {
  const { user } = useAuth();
  const cls = variant === 'link' ? 'gv-s-a gv-st-linkbtn' : 'gv-s-btn gv-s-small gv-s-cream';
  if (user) return <Link href={ORGANISER_HOME} className={cls}>{label}</Link>;
  return <button type="button" className={cls} onClick={() => openAuth({ next: ORGANISER_HOME })}>{label}</button>;
}

function Price({ n, unit }: { n: ReactNode; unit?: string }) {
  return (
    <span className="gv-st-price">
      <b>{n}</b>{unit ? <> {unit}</> : null}
    </span>
  );
}

function PhotoCard({ name, img, line, price, action, soon }: {
  name: string; img: string; line: string; price: ReactNode; action: ReactNode; soon?: boolean;
}) {
  return (
    <article className="gv-st-pc">
      <div className="gv-st-pc-img">
        <Image src={img} alt="" fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw" style={{ objectFit: 'cover' }} />
        <span className="gv-st-pc-shade" aria-hidden />
        {soon && <span className="gv-st-pc-tag"><ComingSoon /></span>}
        <h3 className="gv-st-pc-name">{name}</h3>
      </div>
      <div className="gv-st-pc-body">
        <p className="gv-st-pc-line">{line}</p>
        <div className="gv-st-pc-foot">
          {price}
          {action}
        </div>
      </div>
    </article>
  );
}

function DarkCard({ name, line, price, action, soon }: {
  name: string; line: string; price: ReactNode; action: ReactNode; soon?: boolean;
}) {
  return (
    <article className="gv-s-card gv-st-dc">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {soon && <span><ComingSoon /></span>}
        <h3 className="gv-st-dc-name">{name}</h3>
        <p className="gv-st-pc-line">{line}</p>
      </div>
      <div className="gv-st-pc-foot">
        {price}
        {action}
      </div>
    </article>
  );
}

function Waitlist({ item }: { item: WaitlistItem }) {
  return <WaitlistButton item={item} />;
}

// ── The page ────────────────────────────────────────────────────────────────

export default function StoreClient() {
  const sale = useRunningSale();
  const { prices, promoFrom } = useStorePrices();

  const yearlyCents = unlimitedPricing(null).yearly * 100;
  const firstCents = sale?.unlimited_year_first_cents ?? null;
  const saleYear = firstCents !== null && firstCents < yearlyCents;
  const yearPrice = formatUsd(saleYear ? firstCents : yearlyCents);
  const yearlyPrice = formatUsd(yearlyCents);
  const bogo = !!sale?.credits_bogo;
  const ends = sale ? saleEndLabel(sale.ends_at) : '';

  const spot: { key: Placement; name: string; img: string; line: string }[] = [
    { key: 'homepage', name: 'Homepage', img: '/onboarding/hall-01.jpg', line: 'The first conference everyone sees on Gavelling.' },
    { key: 'explore', name: 'Explore', img: '/onboarding/globe-01.jpg', line: 'First in the search delegates use to choose.' },
    { key: 'region', name: 'Region', img: '/onboarding/city-01.jpg', line: 'Top of the page for one region.' },
    { key: 'country', name: 'Country', img: '/onboarding/podium-01.jpg', line: 'Top of the page for one country.' },
  ];
  const spotSorted = PLACEMENTS.map((k) => spot.find((s) => s.key === k)!).filter(Boolean);

  const tickerPhrase = `Double your MUN · A year of Unlimited for ${yearPrice} · No expiry on free credits · Ends ${ends} · `;

  return (
    <>
      <style>{CSS}</style>

      {sale ? (
        <section className="gv-st-hero" aria-labelledby="gv-st-h1">
          <span className="gv-st-hero-glow" aria-hidden />
          <div className="gv-s-wrap gv-st-hero-in">
            <div className="gv-st-hero-copy">
              <p className="gv-s-label">{sale.title || 'Black Friday'} · Until {ends}</p>
              <h1 id="gv-st-h1" className="gv-s-caps gv-st-h1">Motion<br />to save</h1>
              <p className="gv-s-line" style={{ fontSize: 19, color: '#F6F2E8' }}>Discounts all weekend on Gavelling</p>
              <Countdown endsAt={sale.ends_at} />
              <div className="gv-st-hero-cta">
                {bogo && <Link href="/store/credits" className="gv-s-btn gv-s-big gv-s-cream">Double my credits</Link>}
                <Link href="/store/credits#unlimited" className="gv-s-btn gv-s-big gv-s-outline">Get a year for {yearPrice}</Link>
              </div>
            </div>
            <div className="gv-st-hero-art">
              <MotionPlacards right={yearPrice} label={`Two placards raised: double credits and a year of Unlimited for ${yearPrice}`} />
            </div>
          </div>
        </section>
      ) : (
        <header className="gv-s-wrap gv-st-head">
          <h1 className="gv-s-caps gv-st-h1 gv-st-h1-plain">The Gavelling Store</h1>
          <p className="gv-s-line" style={{ fontSize: 19 }}>Everything you can do with credits, in one place</p>
        </header>
      )}

      {sale && (
        <div className="gv-st-ticker" aria-hidden>
          <div className="gv-st-ticker-track">
            <span>{tickerPhrase.repeat(4)}</span>
            <span>{tickerPhrase.repeat(4)}</span>
          </div>
        </div>
      )}

      <StoreBar />

      <div className="gv-s-wrap gv-st-body">
        {/* ── The two offers ── */}
        <section className="gv-st-offers" aria-label="Offers">
          <article className="gv-st-offer">
            <div className="gv-st-offer-in">
              <p className="gv-s-label">{bogo ? 'Credits · Buy one, get one free' : 'Gavelling credits'}</p>
              <h2 className="gv-s-caps gv-st-offer-t">{bogo ? <>Double<br />your MUN</> : <>One credit,<br />one application</>}</h2>
              <p className="gv-st-offer-line">{bogo ? 'Buy one, get one free on all credit purchases, with no expiry on usage.' : 'Bigger bundles cost less a credit.'}</p>
            </div>
            <Link href="/store/credits" className="gv-s-a gv-st-offer-a">Pick a bundle</Link>
          </article>
          <article className="gv-st-offer gv-st-offer-photo">
            <Image src="/onboarding/hall-01.jpg" alt="" fill sizes="(max-width: 1023px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
            <span className="gv-st-offer-glass" aria-hidden />
            <div className="gv-st-offer-in">
              <p className="gv-s-label">Gavelling Unlimited · Yearly</p>
              <h2 className="gv-s-caps gv-st-offer-t">
                {yearPrice}
                {saleYear && <s className="gv-st-was"><span className="sr-only">instead of </span>{yearlyPrice}</s>}
              </h2>
              <p className="gv-st-offer-line">
                Unlimited applications. Unlimited guides. Unlimited MUN. Never spend a credit to apply again{saleYear ? `, now ${yearPrice} for your first year.` : '.'}
              </p>
            </div>
            <Link href="/store/credits#unlimited" className="gv-s-a gv-st-offer-a">Go Unlimited</Link>
          </article>
        </section>

        {/* ── For delegates ── */}
        <section aria-labelledby="gv-st-del">
          <StoreSectionHead
            id="gv-st-del"
            title="For delegates"
            line={<>Applications and guides are free with <Link href="/store/credits#unlimited" className="gv-s-a">Unlimited</Link></>}
          />
          <div className="gv-st-grid4">
            <PhotoCard name="Apply" img="/landing/podium-speaker.jpg" line="Apply to any conference. Turned down? The credit comes back." price={<Price n="1" unit="credit" />} action={<Link href="/conferences/explore" className="gv-s-a gv-st-linkbtn">Explore</Link>} />
            <PhotoCard name="Premium Guides" img="/onboarding/campus-01.jpg" line="Unlock one guide forever." price={<Price n="1" unit="credit each" />} action={<Link href="/guides" className="gv-s-a gv-st-linkbtn">See guides</Link>} />
            <PhotoCard name="Gift Credits" img="/onboarding/handshake-01.jpg" soon line="Send credits to a friend or your whole delegation." price={<Price n="Price at launch" />} action={<Waitlist item="gift_credits" />} />
            <PhotoCard name="MUN Archive" img="/onboarding/hall-02.jpg" soon line="Every conference, award and paper you have done, in one place." price={<Price n="Price at launch" />} action={<Waitlist item="mun_archive" />} />
          </div>
        </section>

        {/* ── Marketing and visibility ── */}
        <section aria-labelledby="gv-st-mkt">
          <StoreSectionHead id="gv-st-mkt" title="Marketing and visibility" line="Put your conference in front of people who are choosing one" />
          <div className="gv-st-grid4">
            {spotSorted.map((s) => {
              const u = spotlightUnit(prices[s.key]);
              return (
                <PhotoCard
                  key={s.key}
                  name={s.name}
                  img={s.img}
                  line={s.line}
                  price={u ? <Price n={u.n} unit={u.unit} /> : <span className="gv-st-price-skel" aria-hidden />}
                  action={<OrganiserAction label="Book" variant="link" />}
                />
              );
            })}
          </div>
          <div className="gv-st-grid3" style={{ marginTop: 20 }}>
            <DarkCard
              name="Job Board Promotion"
              line="Your chair and staff roles first on the Job Board and in job alerts."
              price={promoFrom !== null ? <Price n={`From ${promoFrom.toLocaleString('en-US')}`} unit={promoFrom === 1 ? 'credit' : 'credits'} /> : <span className="gv-st-price-skel" aria-hidden />}
              action={<Link href="/jobs" className="gv-s-btn gv-s-small gv-s-cream">Pick a listing</Link>}
            />
            <DarkCard name="Social Media Feature" soon line="A post or story about your conference on our Instagram and LinkedIn." price={<Price n="Price at launch" />} action={<Waitlist item="social_feature" />} />
            <DarkCard name="Email Feature" soon line="Your conference in front of our whole mailing list." price={<Price n="Price at launch" />} action={<Waitlist item="email_feature" />} />
          </div>
        </section>

        {/* ── For organisers ── */}
        <section aria-labelledby="gv-st-org">
          <StoreSectionHead id="gv-st-org" title="For organisers" line="Paid from your conference's credits" />
          <div className="gv-st-grid3">
            <DarkCard name="Delegate Sponsorship" line="Your conference pays applicants' credit, so applying is free for them." price={<Price n="1" unit="credit each" />} action={<OrganiserAction label="Add credits" variant="button" />} />
            <DarkCard name="Emails" line="1,000 free per conference. After that, buy a pack." price={<Price n="100" unit="for 1 credit" />} action={<OrganiserAction label="Buy emails" variant="button" />} />
            <DarkCard name="External Applications" soon line="Keep your conference page on Gavelling and send applicants to your own form or website to apply." price={<Price n="Price at launch" />} action={<Waitlist item="external_applications" />} />
          </div>
        </section>
      </div>
    </>
  );
}

const CSS = `
.gv-st-head{display:flex;flex-direction:column;gap:16px;padding-top:clamp(40px,5vw,72px);padding-bottom:clamp(32px,4vw,56px)}
.gv-st-h1{font-size:clamp(84px,9vw,148px)}
.gv-st-h1-plain{font-size:clamp(56px,7.4vw,124px)}

.gv-st-hero{position:relative;overflow:hidden;border-top:1px solid #22251F;border-bottom:1px solid #22251F}
.gv-st-hero-glow{position:absolute;right:-10%;bottom:-40%;width:70%;height:90%;pointer-events:none;background:radial-gradient(closest-side,rgba(42,90,60,0.55),rgba(27,56,40,0.18) 55%,rgba(14,15,13,0) 100%)}
.gv-st-hero-in{position:relative;display:grid;grid-template-columns:1fr;gap:24px}
.gv-st-hero-copy{display:flex;flex-direction:column;gap:22px;padding-top:clamp(40px,5vw,72px);padding-bottom:8px;min-width:0}
.gv-st-hero-cta{display:flex;flex-wrap:wrap;gap:12px}
.gv-st-hero-art{height:340px;display:flex;align-items:flex-end;justify-content:center;min-width:0}
@media (min-width:1024px){
  .gv-st-hero-in{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:40px;align-items:end}
  .gv-st-hero-copy{padding-bottom:clamp(48px,5vw,80px)}
  .gv-st-hero-art{height:560px}
}

.gv-st-ticker{overflow:hidden;background:#F6F2E8;color:#0E0F0D;white-space:nowrap;border-bottom:1px solid #22251F}
.gv-st-ticker-track{display:inline-flex;animation:gvStTicker 60s linear infinite;will-change:transform}
.gv-st-ticker-track span{display:inline-block;padding:14px 0;font-size:15px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
@keyframes gvStTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.gv-st-ticker-track{animation:none}}

.gv-st-body{display:flex;flex-direction:column;gap:clamp(56px,6vw,96px);padding-top:clamp(28px,3vw,44px);padding-bottom:clamp(40px,4vw,64px)}

.gv-st-offers{display:grid;grid-template-columns:1fr;gap:20px}
@media (min-width:1024px){.gv-st-offers{grid-template-columns:1fr 1fr}}
.gv-st-offer{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;gap:20px;min-height:280px;padding:36px;border-radius:18px;background:#1B3828;border:1px solid #0E0F0D;box-shadow:0 0 0 1px #2A5A3C inset;box-sizing:border-box}
.gv-st-offer-photo{background:#1B3828}
.gv-st-offer-glass{position:absolute;inset:0;background:linear-gradient(180deg,rgba(27,56,40,0.78),rgba(27,56,40,0.9));backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);box-shadow:0 0 0 1px #2A5A3C inset;border-radius:inherit}
.gv-st-offer-in{position:relative;display:flex;flex-direction:column;gap:14px}
.gv-st-offer-t{font-size:clamp(40px,4.4vw,64px);line-height:.9;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 16px}
.gv-st-was{font-size:.45em;font-weight:800;letter-spacing:-0.02em;color:#BDB7A8;text-decoration-thickness:3px}
.gv-st-offer-line{margin:0;max-width:520px;font-size:16.5px;line-height:1.5;color:#E8E3D6}
.gv-st-offer-a{position:relative;align-self:flex-start;font-size:16px}
@media (max-width:639px){.gv-st-offer{padding:24px}}

.gv-st-grid4{display:grid;grid-template-columns:1fr;gap:20px}
@media (min-width:640px){.gv-st-grid4{grid-template-columns:1fr 1fr}}
@media (min-width:1100px){.gv-st-grid4{grid-template-columns:repeat(4,minmax(0,1fr))}}
.gv-st-grid3{display:grid;grid-template-columns:1fr;gap:20px}
@media (min-width:900px){.gv-st-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}}

.gv-st-pc{display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:#161815;border:1px solid #2A2D27;min-width:0}
.gv-st-pc-img{position:relative;height:180px;background:#22251F}
.gv-st-pc-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,15,13,0.05) 30%,rgba(14,15,13,0.85) 100%)}
.gv-st-pc-tag{position:absolute;top:14px;left:14px}
.gv-st-pc-name{position:absolute;left:18px;right:18px;bottom:14px;margin:0;font-size:24px;font-weight:900;letter-spacing:-0.02em;line-height:1.1;color:#FFFFFF;overflow-wrap:break-word}
.gv-st-pc-body{display:flex;flex-direction:column;justify-content:space-between;gap:18px;flex:1;padding:18px}
.gv-st-pc-line{margin:0;font-size:15.5px;line-height:1.5;color:#BDB7A8}
.gv-st-pc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:14px;border-top:1px solid #2A2D27}
.gv-st-price{font-size:14.5px;color:#BDB7A8}
.gv-st-price b{font-size:20px;font-weight:900;color:#F6F2E8;font-variant-numeric:tabular-nums}
.gv-st-price-skel{display:inline-block;width:96px;height:22px;border-radius:6px;background:#22251F}
.gv-st-linkbtn{display:inline-flex;align-items:center;min-height:44px;font-size:15.5px;background:none;border:none;padding:0;cursor:pointer;font-family:inherit}
.gv-st-dc{display:flex;flex-direction:column;justify-content:space-between;gap:22px;padding:24px;min-width:0}
.gv-st-dc-name{margin:0;font-size:24px;font-weight:900;letter-spacing:-0.02em;line-height:1.1;color:#F6F2E8}
`;
