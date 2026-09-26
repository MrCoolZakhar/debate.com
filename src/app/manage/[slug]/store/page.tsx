'use client';

// /manage/[slug]/store — the Conference Store. Conference credits buy
// Gavelling Spotlights, delegate sponsorship, email packs and bundles. The
// page is thin: data in storeApi.ts, the look in storeKit.tsx, the pop-ups in
// SpotlightPopup / SponsorshipPopup / EmailsPopup, the list in YourSpotlights.
// A person without Store access is stopped by the manage layout (SECTION_PERMS
// store) before this renders; my_store answering can_use:false shows the
// same sentence as a backstop.

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, Store } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuIconDisc } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { InfoHint } from '../settings/applicationsUi';
import { PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { friendlyError } from '@/lib/friendlyError';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import {
  authedClient, bundleListPrice, BUNDLES, credits as creditsWord, messageOf, PLACEMENTS, priceLine, readStoreState,
  useStoreData, weeksLabel, type BundleDef, type Placement, type StoreAnswer, type StoreState,
} from './storeApi';
import { Balances, Big, StoreCard, STORE_CSS, TransferDialog, INK_SOFT } from './storeKit';
import SpotlightPopup from './SpotlightPopup';
import SponsorshipPopup from './SponsorshipPopup';
import EmailsPopup from './EmailsPopup';
import YourSpotlights from './YourSpotlights';
import YourPurchases from './YourPurchases';
import EmailPacks from './EmailPacks';
import { openCreditsPopup } from '@/lib/purchasePopup';

// Pictures from the site's own library for now; public/store/<placement>.jpg
// would be the owner's replacements (see the report).
const PHOTOS: Record<Placement, { src: string; position: string }> = {
  homepage: { src: '/landing/podium-speaker.jpg', position: '30% 45%' },
  explore: { src: '/onboarding/globe-01.jpg', position: '50% 55%' },
  region: { src: '/onboarding/city-01.jpg', position: '50% 50%' },
  country: { src: '/onboarding/hall-01.jpg', position: '52% 62%' },
};
const BUNDLE_PHOTOS: Record<string, { src: string; position: string }> = {
  boost: { src: '/onboarding/podium-01.jpg', position: '46% 42%' },
  local_boost: { src: '/onboarding/campus-01.jpg', position: '50% 50%' },
  launch: { src: '/onboarding/handshake-01.jpg', position: '50% 50%' },
  everything: { src: '/onboarding/hall-02.jpg', position: '50% 50%' },
};
const PLACEMENT_HINT: Record<Placement, string> = {
  homepage: 'Your conference in the featured row on the gavelling.com homepage, the first page every visitor sees. For reaching people who have not started looking yet.',
  explore: 'Your conference at the top of Explore and in the Conference Spotlight visitors see when they land there. For reaching people at the moment they choose a conference.',
  region: 'First in your continent on the map and in Explore’s continent filter. For delegates who already know where they want to go.',
  country: 'First in Explore’s filter for your country. For the delegates most likely to come.',
};

type Popup =
  | { kind: 'transfer' }
  | { kind: 'spotlight'; placement: Placement }
  | { kind: 'bundle'; bundle: BundleDef }
  | { kind: 'sponsorship' }
  | { kind: 'emails'; initial?: '100' | '500' | 'unlimited' }
  | null;

export default function StorePage() {
  const { conference } = useManage();
  const { data, loading, error, reload } = useStoreData(conference?.id ?? null, conference?.country ?? null);
  const [popup, setPopup] = useState<Popup>(null);
  const [state, setState] = useState<StoreState | null>(null);
  const shown = state ?? data.state;

  const [backText, setBackText] = useState('');
  const [backBusy, setBackBusy] = useState(false);
  const [backErr, setBackErr] = useState('');
  const [backOpen, setBackOpen] = useState(false);
  // Bumped after any purchase, so the email packs list re-reads.
  const [packsKey, setPacksKey] = useState(0);

  const afterBuy = useCallback((a?: StoreAnswer) => {
    const s = a ? readStoreState(a) : null;
    if (s) setState(s);
    refreshCreditsEverywhere();
    setPacksKey(k => k + 1);
    void reload().then(() => setState(null));
  }, [reload]);

  const sendBack = async () => {
    if (!conference || !shown || backBusy) return;
    const qty = Math.max(1, Math.min(shown.sponsorship.available, parseInt(backText, 10) || 0));
    setBackBusy(true);
    setBackErr('');
    try {
      const client = await authedClient();
      const { data: d, error: e } = await client.rpc('store_remove_sponsorship', { p_conf: conference.id, p_qty: qty });
      if (e) throw e;
      const a = d as StoreAnswer;
      const next = readStoreState(a);
      if (!next) { setBackErr(messageOf(a, 'Those credits could not be sent back.')); return; }
      notifyOk(`${creditsWord(qty)} back in conference credits.`, 'store');
      setBackOpen(false);
      setBackText('');
      afterBuy(a);
    } catch (err2) {
      setBackErr(friendlyError(err2, 'Those credits could not be sent back.'));
    } finally {
      setBackBusy(false);
    }
  };

  if (!conference) return null;

  const email = data.email;
  const emailCap = email ? (email.unlimited ? null : email.free + email.extra) : null;
  const emailPct = email && emailCap ? Math.min(100, Math.round((email.used / emailCap) * 100)) : 0;

  return (
    <div className="gv-st px-6 md:px-10 py-8">
      <style>{STORE_CSS}</style>
      {popup ? <style>{PURCHASE_CSS}</style> : null}

      <div className="flex items-start justify-between gap-4 flex-wrap mb-7">
        <div className="flex items-center gap-3.5">
          <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Store} emoji="Shopping bags" size={46} />
          <div>
            <p className="mb-1" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
              {conference.acronym} · Store
            </p>
            <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: NEU.ink, letterSpacing: '-0.02em', margin: 0 }}>
              Conference <GoldWord tone="light">Store</GoldWord>
            </h1>
          </div>
        </div>
        {shown && shown.can_use && (
          <Balances
            state={shown}
            onTransfer={() => setPopup({ kind: 'transfer' })}
            onAdd={(where) => openCreditsPopup({
              context: 'organizer',
              destination: { conferenceId: conference.id, initial: where },
              onComplete: () => afterBuy(),
            })}
          />
        )}
      </div>

      {loading && !shown ? (
        <p className="gv-st-quiet" aria-live="polite">Reading your Store</p>
      ) : error && !shown ? (
        <p className="gv-st-err" role="alert">{error} <button type="button" className="gv-st-link" onClick={() => { void reload(); }}>Try again</button></p>
      ) : shown && !shown.can_use ? (
        <p className="gv-st-quiet">Your organizer role for this conference doesn&apos;t include the Store. Ask the conference owner to grant it.</p>
      ) : shown ? (
        <div className="flex flex-col gap-8">
          {/* Spotlight */}
          <section aria-labelledby="gv-st-spot">
            <div className="flex items-center gap-2">
              <h2 id="gv-st-spot" className="gv-st-sec">Gavelling Spotlight</h2>
              <InfoHint label="About Gavelling Spotlight" text="A spotlight puts your conference where people are already looking: the homepage, Explore, your region or your country. Booked by the day or the week, with a report of views and clicks." size={16} />
            </div>
            <p className="gv-st-sec-line">Put your conference in front of people who are choosing one</p>
            <div className="gv-st-products">
              {PLACEMENTS.map(p => (
                <button key={p} type="button" className="gv-st-product" onClick={() => setPopup({ kind: 'spotlight', placement: p })} aria-label={`${p} spotlight, ${priceLine(data.prices[p])}`}>
                  <div className="gv-st-product-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={PHOTOS[p].src} alt="" style={{ objectPosition: PHOTOS[p].position }} loading="lazy" />
                    <span className="gv-st-product-scrim" aria-hidden />
                    <span className="gv-st-product-name">{p}</span>
                    <span className="gv-st-product-hint" onClick={(e) => e.stopPropagation()}><InfoHint label={`About the ${p} spotlight`} text={PLACEMENT_HINT[p]} size={20} /></span>
                  </div>
                  <div className="gv-st-product-foot">
                    <span className="gv-st-product-price">{priceLine(data.prices[p])}<small>credits</small></span>
                    <span className="gv-st-link" aria-hidden>Book</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Sponsorship, Emails, Import */}
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <StoreCard
              title="Delegate Sponsorship"
              line="Your conference pays applicants' credit, so applying is free for them"
              hint="Conference credits set aside to cover your applicants' Gavelling credit. Delegates, head delegates, faculty advisors and observers apply for free, your page carries the Credit sponsored heart, and Explore lists you under that filter. A rejected or withdrawn applicant's credit comes back."
            >
              <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4">
                <Big n={shown.sponsorship.available} cap={shown.sponsorship.available === 1 ? 'applicant covered' : 'applicants covered'} />
                <Big n={shown.sponsorship.used} cap="used so far" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setPopup({ kind: 'sponsorship' })}>Add credits</button>
                {shown.sponsorship.available > 0 && !backOpen && (
                  <button type="button" className="gv-st-link" onClick={() => { setBackOpen(true); setBackText(String(shown.sponsorship.available)); }}>Send unused credits back</button>
                )}
              </div>
              {backOpen && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(27,56,40,0.12)' }}>
                  <label htmlFor="gv-st-back" className="gv-st-quiet" style={{ display: 'block', marginBottom: 6 }}>How many to send back to conference credits, up to {shown.sponsorship.available}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input id="gv-st-back" type="number" inputMode="numeric" min={1} max={shown.sponsorship.available} value={backText} onChange={(e) => setBackText(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} className="gv-st-field" style={{ width: 96, height: 44, fontSize: 17 }} />
                    <button type="button" className="gv-st-btn gv-st-outline" disabled={backBusy || !(parseInt(backText, 10) > 0)} onClick={() => { void sendBack(); }}>{backBusy ? 'Sending' : 'Send back'}</button>
                    <button type="button" className="gv-st-link" onClick={() => { setBackOpen(false); setBackErr(''); }}>Keep them</button>
                  </div>
                  {backErr ? <p className="gv-st-err" role="alert">{backErr}</p> : null}
                </div>
              )}
            </StoreCard>

            <StoreCard
              title="Emails"
              line="Designed emails to your applicants from the email builder"
              hint="Every conference sends 1,000 bulk emails free from the email builder. Buy more here when you need them. Automatic notifications (confirmations, acceptances, allocations, reminders) are always free and never count."
            >
              {email ? (
                <>
                  <p style={{ margin: '0 0 8px', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700 }}>
                    {email.unlimited
                      ? <>{email.used.toLocaleString('en-US')} sent, <span style={{ color: NEU.deepGold }}>Unlimited</span></>
                      : <>{email.used.toLocaleString('en-US')} of {(emailCap ?? 1000).toLocaleString('en-US')}{email.extra > 0 ? '' : ' free'}</>}
                  </p>
                  <div className="gv-st-meter mb-4" role="meter" aria-valuemin={0} aria-valuemax={emailCap ?? undefined} aria-valuenow={email.used} aria-label="Emails used">
                    <span style={{ width: email.unlimited ? '100%' : `${emailPct}%`, opacity: email.unlimited ? 0.35 : 1 }} />
                  </div>
                  <EmailPacks conferenceId={conference.id} refreshKey={packsKey} onChanged={(a) => afterBuy(a)} />
                </>
              ) : (
                <p className="gv-st-quiet mb-4">Your email count could not be read</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/manage/${conference.slug}/communications`} className="gv-st-btn gv-st-outline">Explore email builder</Link>
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setPopup({ kind: 'emails', initial: '500' })}>Buy more</button>
              </div>
            </StoreCard>

            <StoreCard
              title="Bulk Import"
              line="Importing costs 1 credit per delegate imported, paid when you import"
              hint="Bring a spreadsheet of delegates in at once and send each of them a claim link. Each imported delegate uses one conference credit at the moment you import."
            >
              <div className="flex flex-wrap gap-2">
                <Link href={`/manage/${conference.slug}/applications`} className="gv-st-btn gv-st-outline">Imported delegates</Link>
                <Link href={`/manage/${conference.slug}/import`} className="gv-st-btn gv-st-forest">Go to importer</Link>
              </div>
            </StoreCard>
          </div>

          {/* Bundles */}
          <section aria-labelledby="gv-st-bundles">
            <div className="flex items-center gap-2">
              <h2 id="gv-st-bundles" className="gv-st-sec">Bundles</h2>
              <InfoHint label="About bundles" text="Several spotlights booked together for less than their separate prices. Boost and Local Boost can be cancelled up to 2 days before they start; Launch and Everything cannot be cancelled." size={16} />
            </div>
            <p className="gv-st-sec-line">Spotlights together, for less</p>
            <div className="gv-st-products">
              {BUNDLES.map(b => {
                const list = bundleListPrice(b, data.prices);
                const parts = [
                  ...b.items.map(it => `${weeksLabel(it.days)} ${it.placement.charAt(0).toUpperCase() + it.placement.slice(1)}`),
                  ...(b.unlimitedEmails ? ['Unlimited emails'] : []),
                  ...(b.extraCredits ? [`${b.extraCredits} extra credits`] : []),
                ];
                // The credit bundle cards' design (25 Sep 2026): a shorter photo,
                // a bigger white body, the price with the struck full price, then
                // what is included, one item per line with a check.
                return (
                  <button key={b.kind} type="button" className="gv-st-bundle" data-best={b.best || undefined} onClick={() => setPopup({ kind: 'bundle', bundle: b })} aria-label={`${b.name} bundle, ${b.price} credits`}>
                    <div className="gv-st-bundle-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={BUNDLE_PHOTOS[b.kind].src} alt="" style={{ objectPosition: BUNDLE_PHOTOS[b.kind].position }} loading="lazy" />
                      <span className="gv-st-product-scrim" aria-hidden />
                      {b.best && <span className="gv-st-flag">Best value</span>}
                      <span className="gv-st-product-name">{b.name}</span>
                    </div>
                    <div className="gv-st-bundle-body">
                      <p className="gv-st-bundle-price">
                        <b>{b.price}</b> credits
                        {list !== null && list > b.price ? <span className="gv-st-product-was">{list}</span> : null}
                      </p>
                      <ul className="gv-st-bundle-list">
                        {parts.map(pt => (
                          <li key={pt}><Check size={14} strokeWidth={3} aria-hidden />{pt}</li>
                        ))}
                      </ul>
                      {!b.cancellable && <span className="gv-st-bundle-nr">Non-refundable</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Your Spotlights and Your Purchases, side by side (stacked on phones). */}
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <YourSpotlights spotlights={data.spotlights} stats={data.stats} onChanged={() => afterBuy()} />
            <YourPurchases conferenceId={conference.id} refreshKey={packsKey} />
          </div>

          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT }}>
            Spotlight prices come from the Store&rsquo;s price list; credits are bought at the site&rsquo;s bundle prices.
          </p>
        </div>
      ) : null}

      {popup?.kind === 'transfer' && shown && (
        <TransferDialog conferenceId={conference.id} state={shown} onClose={() => setPopup(null)} onChanged={(s) => { setState(s); afterBuy(); }} />
      )}
      {(popup?.kind === 'spotlight' || popup?.kind === 'bundle') && shown && (
        <SpotlightPopup
          conference={{
            id: conference.id, full_name: conference.full_name, acronym: conference.acronym, banner_url: conference.banner_url,
            country: conference.country, start_date: conference.start_date, end_date: conference.end_date,
            dates_tbd: conference.dates_tbd, is_public: conference.is_public,
          }}
          continent={data.continent}
          prices={data.prices}
          conferenceCredits={shown.conference_credits}
          yourCredits={shown.your_credits}
          placement={popup.kind === 'spotlight' ? popup.placement : undefined}
          bundle={popup.kind === 'bundle' ? popup.bundle : undefined}
          onClose={() => setPopup(null)}
          onBooked={() => afterBuy()}
        />
      )}
      {popup?.kind === 'sponsorship' && shown && (
        <SponsorshipPopup
          conferenceId={conference.id}
          available={shown.sponsorship.available}
          used={shown.sponsorship.used}
          conferenceCredits={shown.conference_credits}
          yourCredits={shown.your_credits}
          onClose={() => setPopup(null)}
          onDone={afterBuy}
        />
      )}
      {popup?.kind === 'emails' && shown && (
        <EmailsPopup conferenceId={conference.id} email={email} yourCredits={shown.your_credits} initial={popup.initial} onClose={() => setPopup(null)} onDone={afterBuy} />
      )}
    </div>
  );
}
