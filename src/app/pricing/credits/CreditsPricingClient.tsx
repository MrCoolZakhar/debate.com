'use client';

// ── /pricing/credits ─────────────────────────────────────────────────────────
// What a credit is, what it buys, how it behaves, the bundles, the questions.
// Every price on the page is read from the server's price table; the prose
// states the facts the owner approved and nothing else.

import Link from 'next/link';
import { Briefcase, Inbox, Ticket } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { useCredits } from '@/hooks/useCredits';
import { formatUsd, useCreditPriceTable } from '@/lib/creditPricing';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { faqForPage } from '@/lib/pricingFaq';
import FaqList from '@/components/pricing/FaqList';
import BundlePicker from '@/components/pricing/BundlePicker';
import { ActionButton, ActionLink, P, PricingStyles, QuestionBox, SectionHeading, StatusWord } from '@/components/pricing/pricingKit';

const USES = [
  {
    name: 'Ticket',
    fallback: Ticket,
    title: 'Apply to a conference',
    text: 'One credit covers one person\'s application to one conference. Delegates, head delegates, faculty advisors and observers use one; chairs, secretariat and staff never do.',
    live: true,
  },
  {
    name: 'Inbox tray',
    fallback: Inbox,
    title: 'Import your delegates',
    text: 'Bring a whole delegation in at once, with credits from one balance.',
    live: false,
  },
  {
    name: 'Briefcase',
    fallback: Briefcase,
    title: 'The job board',
    text: 'Put your name forward for chair and secretariat roles across conferences.',
    live: false,
  },
];

const STEPS = [
  { title: 'Your first credit is free.', text: 'It is in your balance the moment you create your account.' },
  { title: 'One credit per person per conference.', text: 'Edit your application, withdraw and apply again as often as you need. The same conference never takes a second credit.' },
  { title: 'Rejected or withdrawn? It comes back.', text: 'The credit returns to your balance, and you can see it in your credit history.' },
  { title: 'Chairs, secretariat and staff never pay.', text: 'Their applications are always free, whatever the conference.' },
];

export default function CreditsPricingClient() {
  const { table } = useCreditPriceTable();
  const { user } = useAuth();
  const { balance } = useCredits();
  const faq = faqForPage('credits');
  const unit = table ? formatUsd(table.unitCents) : '…';

  return (
    <div className="gv-p" style={{ fontFamily: OUTFIT }}>
      <PricingStyles />
      <style>{`
        .gv-cr-hero{display:grid;grid-template-columns:1fr;gap:28px;align-items:center;padding-top:8px}
        .gv-cr-hero-eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${P.goldDeep}}
        .gv-cr-h1{margin:0;font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:-0.035em;line-height:0.98;color:${P.ink}}
        .gv-cr-h1 em{font-style:normal;color:${P.forestLight}}
        .gv-cr-lead{margin:20px 0 0;font-size:clamp(17px,1.6vw,19.5px);line-height:1.5;color:${P.inkSoft};max-width:44ch}
        .gv-cr-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
        .gv-cr-balance{margin:14px 0 0;font-size:14px;color:${P.inkSoft}}
        .gv-cr-facts{list-style:none;padding:24px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 20px;margin:36px 0 0;border-top:1px solid rgba(27,56,40,0.14)}
        .gv-cr-fact b{display:block;font-size:clamp(26px,3vw,34px);font-weight:900;letter-spacing:-0.03em;line-height:1;color:${P.ink};font-variant-numeric:tabular-nums;min-height:1em}
        .gv-cr-fact span{display:block;margin-top:8px;font-size:13.5px;line-height:1.35;color:${P.inkSoft}}
        .gv-cr-photo{position:relative;border-radius:28px;overflow:hidden;aspect-ratio:16/10;background:${P.forestDeep}}
        .gv-cr-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%;display:block}
        .gv-cr-photo-cap{position:absolute;left:0;right:0;bottom:0;padding:22px 24px;background:linear-gradient(to top,rgba(8,20,13,0.86),rgba(8,20,13,0));color:#FFFFFF;font-size:14px;line-height:1.45}
        .gv-cr-photo-cap b{display:block;font-size:17px;font-weight:800;letter-spacing:-0.01em}
        .gv-cr-uses{margin-top:32px;border-top:1px solid rgba(27,56,40,0.14)}
        .gv-cr-use{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px 20px;align-items:start;padding:24px 0;border-bottom:1px solid rgba(27,56,40,0.14)}
        .gv-cr-use-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}
        .gv-cr-use h3{margin:0;font-size:20px;font-weight:800;letter-spacing:-0.015em;line-height:1.2;color:${P.ink}}
        .gv-cr-use p{margin:8px 0 0;font-size:15.5px;line-height:1.55;color:${P.inkSoft};max-width:60ch}
        .gv-cr-use-lead{padding:32px 0 36px}
        .gv-cr-use-lead h3{font-size:clamp(24px,2.6vw,30px)}
        .gv-cr-use-lead p{font-size:17px;max-width:56ch}
        .gv-cr-use-pair{display:grid;grid-template-columns:1fr;gap:0 40px}
        .gv-cr-steps{list-style:none;margin:32px 0 0;padding:0;display:grid;grid-template-columns:1fr;gap:28px 40px;counter-reset:step}
        .gv-cr-step{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start}
        .gv-cr-step-n{font-size:40px;font-weight:900;letter-spacing:-0.04em;line-height:1;color:${P.goldDeep};font-variant-numeric:tabular-nums;min-width:2ch}
        .gv-cr-step h3{margin:6px 0 0;font-size:19px;font-weight:800;letter-spacing:-0.01em;line-height:1.25;color:${P.ink}}
        .gv-cr-step p{margin:8px 0 0;font-size:15.5px;line-height:1.55;color:${P.inkSoft};max-width:44ch}
        .gv-cr-faq{margin-top:28px}
        @media (min-width:640px){
          .gv-cr-use-pair{grid-template-columns:1fr 1fr}
          .gv-cr-use-pair .gv-cr-use:first-child{border-bottom:1px solid rgba(27,56,40,0.14)}
          .gv-cr-steps{grid-template-columns:1fr 1fr}
        }
        @media (min-width:900px){
          .gv-cr-hero{grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:48px;padding-top:16px}
          .gv-cr-photo{aspect-ratio:4/5}
        }
      `}</style>

      {/* HERO */}
      <section className="gv-cr-hero" aria-labelledby="gv-cr-title">
        <div>
          <p className="gv-cr-hero-eyebrow">
            <Emoji3D name="Ticket" size={28} fallback={Ticket} fallbackColor={P.forest} />
            Credits
          </p>
          <h1 id="gv-cr-title" className="gv-cr-h1">
            One credit.<br />One <em>application.</em>
          </h1>
          <p className="gv-cr-lead">
            A credit is Gavelling&apos;s own currency. It costs a dollar, it covers one person&apos;s application to one
            conference, and your first one is free. Whatever the conference charges is separate and goes to its organisers.
          </p>
          <div className="gv-cr-actions">
            <ActionButton skin="forest" onClick={() => openCreditsPopup({ context: 'pricing' })}>Buy credits</ActionButton>
            <ActionLink href="/pricing/subscription" skin="ghost">See Unlimited</ActionLink>
          </div>
          {user && balance !== null && (
            <p className="gv-cr-balance">
              You have {balance} {balance === 1 ? 'credit' : 'credits'} in your balance.{' '}
              <Link href="/account/manage/credits" style={{ color: P.forest, fontWeight: 700 }}>See your history</Link>
            </p>
          )}
          <ul className="gv-cr-facts" aria-label="The three facts about credits">
            <li className="gv-cr-fact">
              <b>{unit}</b>
              <span>a credit, every time</span>
            </li>
            <li className="gv-cr-fact">
              <b>1</b>
              <span>free when you sign up</span>
            </li>
            <li className="gv-cr-fact">
              <b>1</b>
              <span>per person, per conference</span>
            </li>
          </ul>
        </div>
        <figure className="gv-cr-photo" style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banners/preset-1.jpg" alt="A grand parliamentary chamber in full session, seen from the gallery" width={1400} height={933} decoding="async" />
          <figcaption className="gv-cr-photo-cap">
            <b>Every seat in the room</b>
            One credit is the door in. The conference sets its own fee; Gavelling asks for one dollar.
          </figcaption>
        </figure>
      </section>

      {/* WHAT A CREDIT BUYS */}
      <SectionHeading eyebrow="What credits buy" title="One currency for everything you apply to" />
      <div className="gv-cr-uses">
        {USES.slice(0, 1).map((u) => (
          <article key={u.title} className="gv-cr-use gv-cr-use-lead">
            <Emoji3D name={u.name} size={52} fallback={u.fallback} fallbackColor={P.forest} />
            <div>
              <div className="gv-cr-use-head">
                <h3>{u.title}</h3>
                <StatusWord live={u.live} />
              </div>
              <p>{u.text}</p>
            </div>
          </article>
        ))}
        <div className="gv-cr-use-pair">
          {USES.slice(1).map((u) => (
            <article key={u.title} className="gv-cr-use">
              <Emoji3D name={u.name} size={36} fallback={u.fallback} fallbackColor={P.forest} />
              <div>
                <div className="gv-cr-use-head">
                  <h3>{u.title}</h3>
                  <StatusWord live={u.live} />
                </div>
                <p>{u.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <SectionHeading eyebrow="How it works" title="Four things worth knowing" lead="Credits are simple on purpose. These are the only rules." />
      <ol className="gv-cr-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="gv-cr-step">
            <span className="gv-cr-step-n" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* BUNDLES */}
      <BundlePicker />

      {/* QUESTIONS */}
      <SectionHeading title="Questions" id="questions" />
      <div className="gv-cr-faq">
        <FaqList entries={faq} context="pricing" />
      </div>

      <QuestionBox />
    </div>
  );
}
