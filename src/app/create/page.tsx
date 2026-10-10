import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import CreateDoorEmoji from './CreateDoorEmoji';
import { GoldWord } from '@/components/BrandHeading';

// ── /create: what are you creating? ─────────────────────────────────────────
// The CREATE item in the nav lands here (owner, 25 Sep 2026: a page, not a
// dropdown). Two doors: a committee (one live session room, free, no account,
// the creator at /create/sessions) and a conference (applications, payments
// and every committee, the wizard at /conferences/new). Server-rendered, so
// the h1 and both links are in the raw HTML; /create stays in the sitemap and
// /create/sessions is reached from here by a plain link.
//
// Look (27 Sep 2026): ivory page, two white cards with a soft forest-tinted
// shadow, each a visual on top and the words below (the listing-card shape the
// owner voted for). The committee door shows the real laptop and phone renders
// (the phone hangs over the visual's bottom edge); the conference door has no
// dashboard screenshot in public/, so it draws a small dashboard in CSS.

export const metadata: Metadata = pageMetadata({
  title: 'Create on Gavelling',
  description:
    'Create a Model UN committee room in under a minute, free and with no account, or list a whole conference: applications, payments and every committee, free for organisers.',
  path: '/create',
  keywords: ['create MUN committee', 'run a MUN session', 'list a MUN conference', 'free MUN software'],
});

const IVORY = '#EDE7D8';
const FOREST = '#1B3828';
const FOREST_MID = '#2A5A3C';
const GOLD = '#EED98A';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const BRAND = 'var(--font-brand), sans-serif';
const CTA_GRADIENT = 'linear-gradient(90deg, #1B3828 0%, #2A5A3C 55%, #1E4A31 100%)';

const COMMITTEE_POINTS = [
  'Free, and nobody needs an account',
  'Roll call, speakers, motions and voting from one laptop',
  'Delegates join on their phones with the session code',
];

const CONFERENCE_POINTS = [
  'Take applications and allocate every seat',
  'Get paid by card or by your own method, with no platform fee',
  'Run every committee room and follow them all from one page',
];

function Points({ items }: { items: string[] }) {
  return (
    <ul className="gv-create-points">
      {items.map((p) => (
        <li key={p}>
          <span className="gv-create-tick" aria-hidden>
            <Check size={14} strokeWidth={3} />
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

// A small dashboard drawn in CSS, decorative only. Committees are shown the
// allocation screens' way: the acronym, with nothing cut off.
function ConferenceMock() {
  const rows = [
    { name: 'UNSC', seats: 15, of: 15 },
    { name: 'DISEC', seats: 31, of: 40 },
    { name: 'WHO', seats: 22, of: 36 },
  ];
  return (
    <div className="gv-create-dash" aria-hidden>
      <div className="gv-create-dash-top">
        <div>
          <p className="gv-create-dash-label">Applications</p>
          <p className="gv-create-dash-big">
            312 <span>of 400 seats</span>
          </p>
        </div>
        <svg width="54" height="54" viewBox="0 0 54 54" className="gv-create-dash-ring">
          <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(27,56,40,0.1)" strokeWidth="7" />
          <circle
            cx="27" cy="27" r="22" fill="none" stroke={FOREST_MID} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${0.78 * 2 * Math.PI * 22} ${2 * Math.PI * 22}`} transform="rotate(-90 27 27)"
          />
        </svg>
      </div>
      <div className="gv-create-dash-rows">
        {rows.map((r) => (
          <div key={r.name} className="gv-create-dash-row">
            <span className="gv-create-dash-name">{r.name}</span>
            <span className="gv-create-dash-bar">
              <span style={{ width: `${Math.round((r.seats / r.of) * 100)}%` }} />
            </span>
            <span className="gv-create-dash-num">{r.seats}/{r.of}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreateChooserPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: IVORY, fontFamily: BRAND, color: INK }}>
      <style>{`
        .gv-create-main{flex:1 1 auto;width:100%;max-width:1120px;margin:0 auto;padding:36px 16px 72px}
        .gv-create-h1{margin:0;text-align:center;font-size:clamp(32px,4.6vw,54px);font-weight:800;letter-spacing:-0.03em;line-height:1.05;color:${INK}}
        .gv-create-line{margin:12px auto 0;max-width:44ch;text-align:center;font-size:clamp(15px,1.4vw,18px);line-height:1.45;color:${INK_SOFT}}
        .gv-create-grid{display:grid;grid-template-columns:1fr;gap:24px;margin-top:32px}
        .gv-create-card{position:relative;display:flex;flex-direction:column;border-radius:24px;background:#FFFFFF;text-decoration:none;color:inherit;
          box-shadow:0 1px 0 rgba(27,56,40,0.06),0 24px 50px -32px rgba(27,56,40,0.45);
          transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease}
        .gv-create-card:hover{transform:translateY(-4px);box-shadow:0 1px 0 rgba(27,56,40,0.06),0 34px 64px -30px rgba(27,56,40,0.55)}
        .gv-create-card:active{transform:translateY(-1px) scale(0.995)}
        .gv-create-card:focus{outline:none}
        .gv-create-card:focus-visible{box-shadow:0 0 0 3px ${IVORY},0 0 0 6px ${FOREST}}

        .gv-create-visual{position:relative;height:230px;margin:10px 10px 0;border-radius:18px;background:#F4F0E6}
        .gv-create-laptop{position:absolute;left:4%;bottom:16px;width:80%;height:auto;filter:drop-shadow(0 18px 22px rgba(27,56,40,0.18))}
        .gv-create-phone{position:absolute;right:5%;bottom:-26px;height:calc(100% + 4px);width:auto;z-index:2;filter:drop-shadow(0 16px 20px rgba(27,56,40,0.25))}

        .gv-create-dash{position:absolute;left:7%;right:7%;top:22px;padding:14px 16px;border-radius:14px;background:#FFFFFF;
          box-shadow:0 1px 0 rgba(27,56,40,0.06),0 18px 34px -22px rgba(27,56,40,0.45)}
        .gv-create-dash-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .gv-create-dash-label{margin:0;font-size:12px;font-weight:600;color:${INK_SOFT}}
        .gv-create-dash-big{margin:2px 0 0;font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:${FOREST};font-variant-numeric:tabular-nums}
        .gv-create-dash-big span{font-size:13px;font-weight:600;letter-spacing:0;color:${INK_SOFT}}
        .gv-create-dash-ring{flex:none}
        .gv-create-dash-rows{display:flex;flex-direction:column;gap:8px;margin-top:12px}
        .gv-create-dash-row{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:10px}
        .gv-create-dash-name{font-size:12.5px;font-weight:800;color:${INK}}
        .gv-create-dash-bar{height:7px;border-radius:99px;background:rgba(27,56,40,0.08);overflow:hidden}
        .gv-create-dash-bar span{display:block;height:100%;border-radius:99px;background:${FOREST_MID}}
        .gv-create-dash-num{font-size:12px;font-weight:600;color:${INK_SOFT};font-variant-numeric:tabular-nums}
        .gv-create-toast{position:absolute;right:5%;bottom:-24px;z-index:2;display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;border-radius:14px;
          background:rgba(255,255,255,0.94);box-shadow:0 1px 0 rgba(27,56,40,0.06),0 18px 30px -16px rgba(27,56,40,0.4)}
        .gv-create-toast-disc{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:99px;background:rgba(42,90,60,0.12);color:${FOREST_MID}}
        .gv-create-toast p{margin:0;font-size:12.5px;line-height:1.25;font-weight:700;color:${INK}}
        .gv-create-toast p span{display:block;font-weight:500;color:${INK_SOFT}}

        .gv-create-body{display:flex;flex-direction:column;flex:1 1 auto;padding:34px 22px 24px}
        .gv-create-name-row{display:flex;align-items:center;gap:10px}
        .gv-create-name{margin:0;font-size:clamp(24px,2.4vw,30px);font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK}}
        .gv-create-text{margin:8px 0 0;font-size:15.5px;line-height:1.5;color:${INK_SOFT};max-width:40ch}
        .gv-create-points{list-style:none;margin:18px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
        .gv-create-points li{display:flex;align-items:flex-start;gap:10px;font-size:15px;line-height:1.4;color:${INK}}
        .gv-create-tick{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-top:-1px;border-radius:99px;background:${GOLD};color:${FOREST}}
        .gv-create-cta{margin-top:24px;display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 24px;border-radius:10px;
          background:${CTA_GRADIENT};color:#FFFFFF;font-size:16px;font-weight:700;box-shadow:0 10px 22px -14px rgba(27,56,40,0.7)}

        @media (min-width:760px){
          .gv-create-main{padding:56px 32px 88px}
          .gv-create-grid{grid-template-columns:1fr 1fr;gap:28px;margin-top:44px}
          .gv-create-visual{height:270px}
          .gv-create-body{padding:40px 30px 28px}
          .gv-create-cta{align-self:flex-start;min-width:230px;margin-top:auto}
          .gv-create-points{margin-bottom:28px}
          .gv-create-dash{top:30px;padding:18px 20px}
        }
        /* Phones: both doors on one screen. The preview art goes (it is decorative and
           aria-hidden), the body loses the room it kept for the hanging phone, and on a
           short screen the tick list folds away too; the name, the line and the button
           say enough to choose. */
        @media (max-width:759px){
          .gv-create-main{padding-top:20px;padding-bottom:40px}
          .gv-create-grid{gap:14px;margin-top:20px}
          .gv-create-visual{display:none}
          .gv-create-body{padding:20px 20px 20px}
          .gv-create-cta{margin-top:16px;min-height:48px}
        }
        @media (max-width:759px) and (max-height:899px){
          .gv-create-points{display:none}
        }
        @media (prefers-reduced-motion:reduce){.gv-create-card{transition:none}.gv-create-card:hover,.gv-create-card:active{transform:none}}
      `}</style>
      <SiteNav />
      <main className="gv-create-main">
        <h1 className="gv-create-h1">What Are You <GoldWord tone="light">Creating?</GoldWord></h1>
        <p className="gv-create-line">One committee room for today, or a whole conference with everything around it</p>

        <div className="gv-create-grid">
          <Link href="/create/sessions" className="gv-create-card" aria-label="Start a committee: a free committee session, no account needed">
            <div className="gv-create-visual" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sessions/hero-laptop.webp" alt="" width={1000} height={610} className="gv-create-laptop" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sessions/hero-phone.webp" alt="" width={660} height={1141} className="gv-create-phone" />
            </div>
            <div className="gv-create-body">
              <div className="gv-create-name-row">
                <CreateDoorEmoji name="Classical building" fallback="gavel" color={FOREST} />
                <h2 className="gv-create-name">A committee session</h2>
              </div>
              <p className="gv-create-text">Run one room from a laptop while delegates follow on their phones</p>
              <Points items={COMMITTEE_POINTS} />
              <span className="gv-create-cta">Start a committee</span>
            </div>
          </Link>

          <Link href="/conferences/new" className="gv-create-card" aria-label="Organise a conference: applications, allocations, payments and every committee, free for organisers">
            <div className="gv-create-visual" aria-hidden>
              <ConferenceMock />
              <div className="gv-create-toast">
                <span className="gv-create-toast-disc"><Check size={16} strokeWidth={3} /></span>
                <p>Payment received<span>Delegation of 12, Kenya</span></p>
              </div>
            </div>
            <div className="gv-create-body">
              <div className="gv-create-name-row">
                <CreateDoorEmoji name="Globe with meridians" fallback="globe" color={FOREST} />
                <h2 className="gv-create-name">A conference</h2>
              </div>
              <p className="gv-create-text">Applications, allocations, payments and every committee in one place. Free for organisers</p>
              <Points items={CONFERENCE_POINTS} />
              <span className="gv-create-cta">Organise a conference</span>
            </div>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
