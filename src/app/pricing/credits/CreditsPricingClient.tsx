'use client';

// ── /pricing/credits ─────────────────────────────────────────────────────────
// Forest hero with the sessions gavel film fading into the green, a white
// block for what credits do, the bundle picker on the cream ground, the
// questions on white, and the way to the help center. Every price on the
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
import { ActionButton, ActionLink, FOCUS_RING_GOLD, P, PricingStyles, QuestionBox } from '@/components/pricing/pricingKit';

export default function CreditsPricingClient() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const faq = faqForPage('credits');

  return (
    <div className="gv-p" style={{ fontFamily: OUTFIT }}>
      <PricingStyles />
      <style>{`
        .gv-cr-hero{position:relative;overflow:hidden;min-height:420px;display:flex;align-items:center;isolation:isolate}
        .gv-cr-film{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:60% 50%;opacity:0.22;filter:saturate(0.8);z-index:0;pointer-events:none}
        .gv-cr-wash{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to bottom,rgba(27,56,40,0.55) 0%,rgba(27,56,40,0.7) 55%,${P.forest} 100%)}
        .gv-cr-hero-in{position:relative;z-index:2;max-width:560px}
        .gv-cr-h1{margin:0;font-size:clamp(48px,6vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1;color:#FFFFFF}
        .gv-cr-line{margin:16px 0 0;font-size:clamp(18px,1.7vw,21px);line-height:1.4;color:rgba(255,255,255,0.86)}
        .gv-cr-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:32px}
        .gv-cr-balance{margin:18px 0 0;font-size:14.5px;color:rgba(255,255,255,0.82)}
        .gv-cr-balance a{color:${P.gold}}
        .gv-cr-uses{display:grid;grid-template-columns:1fr;gap:28px 48px;margin-top:28px}
        .gv-cr-lead{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start;padding:26px 24px;border-radius:22px;background:${P.cream}}
        .gv-cr-lead h3{margin:0;font-size:clamp(24px,2.4vw,28px);font-weight:800;letter-spacing:-0.02em;line-height:1.15;color:${P.forest}}
        .gv-cr-lead p{margin:8px 0 0;font-size:16px;line-height:1.5;color:${P.inkSoft}}
        .gv-cr-rows{list-style:none;margin:0;padding:0}
        .gv-cr-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;padding:18px 0;border-top:1px solid rgba(27,56,40,0.14)}
        .gv-cr-row:last-child{border-bottom:1px solid rgba(27,56,40,0.14)}
        .gv-cr-row h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-0.01em;line-height:1.2;color:${P.ink}}
        .gv-cr-row p{margin:4px 0 0;font-size:15px;line-height:1.45;color:${P.inkSoft}}
        .gv-cr-soon{font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${P.goldDeep};white-space:nowrap}
        .gv-cr-faq{margin-top:24px}
        @media (min-width:640px){
          .gv-cr-uses{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
        }
        @media (min-width:900px){
          .gv-cr-hero{min-height:480px}
          .gv-cr-film{left:42%;opacity:0.72;filter:saturate(0.85)}
          .gv-cr-wash{background:linear-gradient(90deg,${P.forest} 0%,${P.forest} 40%,rgba(27,56,40,0.72) 58%,rgba(27,56,40,0.22) 82%,rgba(27,56,40,0.12) 100%),linear-gradient(to bottom,rgba(27,56,40,0) 55%,${P.forest} 100%)}
        }
        @media (prefers-reduced-motion:reduce){.gv-cr-film{display:none}}
      `}</style>

      {/* HERO: forest, the gavel film fading in from the right */}
      <section className="gv-cr-hero gv-p-block gv-p-block-forest" aria-labelledby="gv-cr-title">
        {/* Plays once and rests on its last frame, as on the sessions landing. */}
        <video className="gv-cr-film" autoPlay muted playsInline preload="metadata" aria-hidden>
          <source src="/hero_no_audio.webm" type="video/webm" />
          <source src="/hero_no_audio.mp4" type="video/mp4" />
        </video>
        <div className="gv-cr-wash" aria-hidden />
        <div className="gv-cr-hero-in">
          <h1 id="gv-cr-title" className="gv-cr-h1">
            Gavelling <GoldWord tone="dark">Credits</GoldWord>
          </h1>
          <p className="gv-cr-line">One currency for everything on Gavelling</p>
          <div className="gv-cr-actions">
            <ActionButton skin="gold" big onForest onClick={() => openCreditsPopup({ context: 'pricing' })}>Buy credits</ActionButton>
            <ActionLink href="/pricing/subscription" skin="outline-ivory" onForest>See Unlimited</ActionLink>
          </div>
          {user && balance !== null && (
            <p className="gv-cr-balance">
              You have {balance} {balance === 1 ? 'credit' : 'credits'}.{' '}
              <Link href="/account/manage/credits" className={`gv-p-link ${FOCUS_RING_GOLD}`}>See your history</Link>
            </p>
          )}
        </div>
      </section>

      {/* WHAT CREDITS DO: white */}
      <section className="gv-p-block gv-p-block-white" aria-labelledby="gv-cr-uses-title">
        <h2 id="gv-cr-uses-title" className="gv-p-h2">What You Can Do With <GoldWord tone="light">Credits</GoldWord></h2>
        <p className="gv-p-line">One credit is one person&apos;s application to one conference</p>
        <div className="gv-cr-uses">
          <article className="gv-cr-lead">
            <Emoji3D name="Ticket" size={56} fallback={Ticket} fallbackColor={P.forest} />
            <div>
              <h3>Apply to a conference</h3>
              <p>Delegates, head delegates, faculty advisors and observers use one. Chairs and staff never do.</p>
            </div>
          </article>
          <ul className="gv-cr-rows">
            <li className="gv-cr-row">
              <Emoji3D name="Inbox tray" size={40} fallback={Inbox} fallbackColor={P.forest} />
              <div>
                <h3>Import your delegates</h3>
                <p>A whole delegation from one balance</p>
              </div>
              <span className="gv-cr-soon">Soon</span>
            </li>
            <li className="gv-cr-row">
              <Emoji3D name="Briefcase" size={40} fallback={Briefcase} fallbackColor={P.forest} />
              <div>
                <h3>The job board</h3>
                <p>Chair and secretariat roles across conferences</p>
              </div>
              <span className="gv-cr-soon">Soon</span>
            </li>
          </ul>
        </div>
      </section>

      {/* BUNDLES: on the cream ground */}
      <BundlePicker />

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
