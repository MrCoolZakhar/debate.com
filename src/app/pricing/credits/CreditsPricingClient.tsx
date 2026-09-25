'use client';

// ── /pricing/credits ─────────────────────────────────────────────────────────
// A hero straight on the ivory page with the sessions gavel film, the bundle
// picker, a white block for what credits do, the questions on white, and the
// way to the help center. Every price on the
// page is read from the server's price table.

import Link from 'next/link';
import { Briefcase, Inbox, Ticket } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { useAuth } from '@/components/AuthProvider';
import { useCredits } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { faqForPage } from '@/lib/pricingFaq';
import FaqList from '@/components/pricing/FaqList';
import BundlePicker from '@/components/pricing/BundlePicker';
import { ActionButton, ActionLink, FOCUS_RING, P, PricingStyles, QuestionBox } from '@/components/pricing/pricingKit';

export default function CreditsPricingClient() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const faq = faqForPage('credits');

  return (
    <div className="gv-p" style={{ fontFamily: OUTFIT }}>
      <PricingStyles />
      <style>{`
        .gv-cr-hero{position:relative;display:grid;grid-template-columns:1fr;gap:20px;align-items:center;padding:12px 8px 8px;margin-bottom:28px}
        .gv-cr-hero-in{position:relative;z-index:2;max-width:560px}
        .gv-cr-h1{margin:0;font-size:clamp(42px,5.2vw,58px);font-weight:800;letter-spacing:-0.03em;line-height:1;color:${P.ink}}
        .gv-cr-line{margin:14px 0 0;font-size:clamp(17px,1.6vw,20px);line-height:1.4;font-weight:600;color:${P.forest}}
        .gv-cr-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:24px}
        .gv-cr-balance{margin:16px 0 0;font-size:14.5px;color:${P.inkSoft}}
        .gv-cr-balance a{color:${P.forest}}
        .gv-cr-filmwrap{display:none}
        .gv-cr-uses{display:grid;grid-template-columns:1fr;gap:28px 48px;margin-top:28px}
        .gv-cr-lead{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start;padding:26px 24px;border-radius:22px;background:${P.cream}}
        .gv-cr-lead h3{margin:0;font-size:clamp(24px,2.4vw,28px);font-weight:800;letter-spacing:-0.02em;line-height:1.15;color:${P.forest}}
        .gv-cr-lead p{margin:8px 0 0;font-size:16px;line-height:1.5;color:${P.inkSoft}}
        .gv-cr-rows{list-style:none;margin:0;padding:0}
        .gv-cr-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;padding:18px 0;border-top:1px solid rgba(27,56,40,0.14)}
        .gv-cr-row:last-child{border-bottom:1px solid rgba(27,56,40,0.14)}
        .gv-cr-row h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-0.01em;line-height:1.2;color:${P.ink}}
        .gv-cr-row p{margin:4px 0 0;font-size:15px;line-height:1.45;color:${P.inkSoft}}
        .gv-cr-soon{font-size:14px;font-weight:700;color:${P.goldDeep};white-space:nowrap}
        .gv-cr-faq{margin-top:24px}
        @media (min-width:640px){
          .gv-cr-uses{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
        }
        @media (min-width:900px){
          .gv-cr-hero{grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:36px}
          /* The gavel film on the right, no box: its edges fade into the page. */
          .gv-cr-filmwrap{display:block;position:relative;justify-self:end;width:100%;max-width:440px;aspect-ratio:16/10;-webkit-mask-image:radial-gradient(ellipse 72% 78% at 52% 50%,#000 48%,transparent 100%);mask-image:radial-gradient(ellipse 72% 78% at 52% 50%,#000 48%,transparent 100%)}
          .gv-cr-film{display:block;width:100%;height:100%;object-fit:cover;object-position:60% 50%;filter:saturate(0.9)}
        }
        @media (prefers-reduced-motion:reduce){.gv-cr-filmwrap{display:none}}
      `}</style>

      {/* HERO: straight on the page, no card (owner, 25 Sep 2026: the green
          card was too heavy and pushed the bundles below the fold). Ink title
          with the gold word, the line in forest, the gavel film on the right
          with no box, smaller. */}
      <section className="gv-cr-hero" aria-labelledby="gv-cr-title">
        <div className="gv-cr-hero-in">
          <h1 id="gv-cr-title" className="gv-cr-h1">
            Gavelling <GoldWord tone="light">Credits</GoldWord>
          </h1>
          <p className="gv-cr-line">One currency for everything on Gavelling</p>
          <div className="gv-cr-actions">
            <ActionButton skin="forest" big onClick={() => openCreditsPopup({ context: 'pricing' })}>Buy credits</ActionButton>
            <ActionLink href="/pricing/subscription" skin="outline">See Unlimited</ActionLink>
          </div>
          {user && balance !== null && (
            <p className="gv-cr-balance">
              You have {balance} {balance === 1 ? 'credit' : 'credits'}.{' '}
              <Link href="/account/manage/credits" className={`gv-p-link ${FOCUS_RING}`}>See your history</Link>
            </p>
          )}
        </div>
        <div className="gv-cr-filmwrap" aria-hidden>
          {/* Plays once and rests on its last frame, as on the sessions landing. */}
          <video className="gv-cr-film" autoPlay muted playsInline preload="metadata">
            <source src="/hero_no_audio.webm" type="video/webm" />
            <source src="/hero_no_audio.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      {/* BUNDLES first, straight under the hero (owner, 25 Sep 2026), on the
          cream ground */}
      <BundlePicker />

      {/* WHAT CREDITS DO: white */}
      <section className="gv-p-block gv-p-block-white" aria-labelledby="gv-cr-uses-title">
        <h2 id="gv-cr-uses-title" className="gv-p-h2">What You Can Do With <GoldWord tone="light">Credits</GoldWord></h2>
        <div className="gv-cr-uses">
          <article className="gv-cr-lead">
            <Emoji3D name="Ticket" size={56} fallback={Ticket} fallbackColor={P.forest} />
            <div>
              <h3>Apply to a Conference</h3>
              <p>Delegates, head delegates, faculty advisors and observers use one. Chairs and staff never do.</p>
            </div>
          </article>
          <ul className="gv-cr-rows">
            <li className="gv-cr-row">
              <Emoji3D name="Inbox tray" size={40} fallback={Inbox} fallbackColor={P.forest} />
              <div>
                <h3>Import Your Delegates</h3>
                <p>A whole delegation from one balance</p>
              </div>
              <span className="gv-cr-soon">Soon</span>
            </li>
            <li className="gv-cr-row">
              <Emoji3D name="Briefcase" size={40} fallback={Briefcase} fallbackColor={P.forest} />
              <div>
                <h3>The Job Board</h3>
                <p>Chair and secretariat roles across conferences</p>
              </div>
              <span className="gv-cr-soon">Soon</span>
            </li>
          </ul>
        </div>
      </section>

      {/* QUESTIONS: white */}
      <section className="gv-p-block gv-p-block-white" aria-labelledby="gv-cr-faq-title" id="questions" style={{ scrollMarginTop: 96 }}>
        <h2 id="gv-cr-faq-title" className="gv-p-h2">Common <GoldWord tone="light">Questions</GoldWord></h2>
        <div className="gv-cr-faq">
          <FaqList entries={faq} context="pricing" />
        </div>
      </section>

      <QuestionBox />
    </div>
  );
}
