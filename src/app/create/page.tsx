import type { Metadata } from 'next';
import Link from 'next/link';
import { Gavel, Globe } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';

// ── /create: what are you creating? ─────────────────────────────────────────
// The CREATE item in the nav lands here (owner, 25 Sep 2026: a page, not a
// dropdown). Two doors: a committee (one live session room, free, no account,
// the creator at /create/sessions) and a conference (applications, payments
// and every committee, the wizard at /conferences/new). Server-rendered, so
// the h1 and both links are in the raw HTML; /create stays in the sitemap and
// /create/sessions is reached from here by a plain link.

export const metadata: Metadata = pageMetadata({
  title: 'Create on Gavelling',
  description:
    'Create a Model UN committee room in under a minute, free and with no account, or list a whole conference: applications, payments and every committee, free for organisers.',
  path: '/create',
  keywords: ['create MUN committee', 'run a MUN session', 'list a MUN conference', 'free MUN software'],
});

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const OUTFIT = 'var(--font-brand), sans-serif';

export default function CreateChooserPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8', fontFamily: OUTFIT, color: INK }}>
      <style>{`
        .gv-create-main{flex:1 1 auto;width:100%;max-width:1080px;margin:0 auto;padding:40px 20px 80px}
        .gv-create-h1{margin:0;text-align:center;font-size:clamp(38px,5.6vw,62px);font-weight:800;letter-spacing:-0.03em;line-height:1.02;color:${INK}}
        .gv-create-line{margin:14px auto 0;max-width:46ch;text-align:center;font-size:clamp(16px,1.5vw,19px);line-height:1.45;font-weight:600;color:${FOREST}}
        .gv-create-grid{display:grid;grid-template-columns:1fr;gap:20px;margin-top:40px}
        .gv-create-card{display:flex;flex-direction:column;gap:14px;padding:32px 28px;border-radius:26px;text-decoration:none;color:inherit;min-height:300px;transition:transform 180ms cubic-bezier(0.22,1,0.36,1),box-shadow 180ms ease}
        .gv-create-card:hover{transform:translateY(-3px)}
        .gv-create-card:focus{outline:none}
        .gv-create-card:focus-visible{box-shadow:0 0 0 3px #EDE7D8,0 0 0 6px ${FOREST}}
        .gv-create-card-white{background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 22px 48px -34px rgba(27,56,40,0.4)}
        .gv-create-card-white:hover{box-shadow:0 1px 0 rgba(27,56,40,0.08),0 30px 56px -30px rgba(27,56,40,0.5)}
        .gv-create-card-forest{background:${FOREST};color:#FFFFFF;box-shadow:0 30px 60px -32px rgba(20,48,31,0.75)}
        .gv-create-card-forest:focus-visible{box-shadow:0 0 0 3px #EDE7D8,0 0 0 6px ${GOLD}}
        .gv-create-eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT}}
        .gv-create-card-forest .gv-create-eyebrow{color:rgba(238,217,138,0.85)}
        .gv-create-name{margin:0;font-size:clamp(30px,3.4vw,40px);font-weight:800;letter-spacing:-0.025em;line-height:1.05}
        .gv-create-card-white .gv-create-name{color:${INK}}
        .gv-create-text{margin:0;font-size:16px;line-height:1.5;color:${INK_SOFT};max-width:36ch}
        .gv-create-card-forest .gv-create-text{color:rgba(255,255,255,0.82)}
        .gv-create-cta{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 24px;border-radius:14px;font-size:14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;align-self:flex-start}
        .gv-create-card-white .gv-create-cta{background:${FOREST};color:${GOLD}}
        .gv-create-card-forest .gv-create-cta{background:${GOLD};color:${INK}}
        .gv-create-disc{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:20px}
        .gv-create-card-white .gv-create-disc{background:rgba(27,56,40,0.07)}
        .gv-create-card-forest .gv-create-disc{background:rgba(255,255,255,0.1)}
        @media (min-width:760px){
          .gv-create-main{padding:64px 32px 96px}
          .gv-create-grid{grid-template-columns:1fr 1fr;gap:28px;margin-top:48px}
          .gv-create-card{padding:40px 36px;min-height:360px}
        }
        @media (prefers-reduced-motion:reduce){.gv-create-card{transition:none}.gv-create-card:hover{transform:none}}
      `}</style>
      <SiteNav />
      <main className="gv-create-main">
        <h1 className="gv-create-h1">What are you <GoldWord tone="light">creating</GoldWord></h1>
        <p className="gv-create-line">A single committee room for today, or a whole conference with everything around it</p>

        <div className="gv-create-grid">
          <Link href="/create/sessions" className="gv-create-card gv-create-card-white" aria-label="Create a committee">
            <span className="gv-create-disc" aria-hidden>
              <Emoji3D name="Classical building" size={40} fallback={Gavel} fallbackColor={FOREST} />
            </span>
            <p className="gv-create-eyebrow">A committee</p>
            <h2 className="gv-create-name">One live session room</h2>
            <p className="gv-create-text">Roll call, the speakers list, motions, caucuses and voting from one laptop, delegates on their phones. Free, and no account needed.</p>
            <span className="gv-create-cta">Create a committee</span>
          </Link>

          <Link href="/conferences/new" className="gv-create-card gv-create-card-forest" aria-label="Create a conference">
            <span className="gv-create-disc" aria-hidden>
              <Emoji3D name="Globe with meridians" size={40} fallback={Globe} fallbackColor={GOLD} />
            </span>
            <p className="gv-create-eyebrow">A conference</p>
            <h2 className="gv-create-name">Applications, payments and every committee</h2>
            <p className="gv-create-text">Take applications, allocate delegates, get paid your way and run every committee room from one place. Free for organisers.</p>
            <span className="gv-create-cta">Create a conference</span>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
