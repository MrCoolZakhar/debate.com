'use client';

// The Gavelling Crisis look of the "Log in or sign up" pop-up (owner, 19 Nov 2026: "the pop up should be different for
// crisis log in, it should be crisis themed ... indicate that they can't try crisis without an account. Showcase briefly a
// few core features like directive management, interactive map, resources, cabinets connected").
// openAuth({ variant: 'crisis' }) swaps the picture on the left for this panel and re-colours the form in the crisis reds.
// The steps themselves (email, password, sign-up, Google, the questionnaire) are the ordinary ones, unchanged.
// Desktop: the full panel on the left. Phone: the same panel as the red band above the sheet, title and feature names only.
// No <img> inside: the shared side rules size every image in .gv-auth-side to cover the panel.

import { CheckCircle2, Coins, Gavel, Map as MapIcon, Network, Newspaper, ScrollText } from 'lucide-react';

const FEATURES: Array<{ icon: React.ReactNode; title: string; line: string }> = [
  { icon: <ScrollText size={18} strokeWidth={1.6} />, title: 'Directives', line: 'Delegates send them, the backroom answers, chairs sign off.' },
  { icon: <MapIcon size={18} strokeWidth={1.6} />, title: 'Interactive Map', line: 'Zones, units and borders that move as the crisis does.' },
  { icon: <Coins size={18} strokeWidth={1.6} />, title: 'Resources', line: 'Troops, money and oil, spent and tracked for every character.' },
  { icon: <Network size={18} strokeWidth={1.6} />, title: 'Connected Cabinets', line: 'Joint crises where one cabinet’s move lands on the other.' },
  { icon: <Newspaper size={18} strokeWidth={1.6} />, title: 'Breaking News', line: 'The press and the backroom publish to every screen at once.' },
];

/** A drawn directive card with made-up data, in the live app's shape (never a screenshot). */
function DirectiveMock() {
  return (
    <div className="gv-cs-card" aria-hidden>
      <span className="gv-cs-disc">JFK</span>
      <span className="gv-cs-card-meta">No. 14 · ExComm · Joint directive</span>
      <b className="gv-cs-card-title">Naval Quarantine of Cuba</b>
      <span className="gv-cs-card-row">
        <span className="gv-cs-ok"><CheckCircle2 size={14} strokeWidth={1.8} />Approved by the backroom</span>
        <span className="gv-cs-faces">
          <i style={{ background: '#2C5440' }}>RM</i>
          <i style={{ background: '#9A6E14' }}>DR</i>
          <i style={{ background: '#6E1A1A' }}>RK</i>
        </span>
      </span>
    </div>
  );
}

export function CrisisAuthSide() {
  return (
    <div className="gv-auth-side gv-crisis-side">
      <div className="gv-cs-inner">
        <p className="gv-cs-eyebrow"><Gavel size={15} strokeWidth={1.7} aria-hidden />Gavelling Crisis</p>
        <h3 className="gv-cs-title">A Live Crisis, Run From One Screen</h3>
        <DirectiveMock />
        <ul className="gv-cs-list">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="gv-cs-icon" aria-hidden>{f.icon}</span>
              <span className="gv-cs-text"><b>{f.title}</b><span className="gv-cs-line">{f.line}</span></span>
            </li>
          ))}
        </ul>
        <p className="gv-cs-foot">Free with a Gavelling account</p>
      </div>
    </div>
  );
}

const RED_GRAD = 'linear-gradient(165deg, #9A2A2A 0%, #6A1919 52%, #3A0E0F 100%)';
const RED_BTN = 'linear-gradient(90deg, #741C1C 0%, #8E2424 45%, #A83030 100%)';
const GOLD = '#EED98A';
const CREAM = '#FFE8D6';
const RED = '#8E2424';

/** Scoped to .gv-crisis (the panel), so the ordinary pop-up is untouched. Mounted only with the crisis variant. */
export const CRISIS_AUTH_CSS = `
.gv-crisis .gv-crisis-side{background:${RED_GRAD};color:${CREAM}}
.gv-crisis .gv-crisis-side::after{content:none}
.gv-cs-inner{position:relative;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:18px;padding:34px 30px 28px;overflow:hidden}
.gv-cs-inner::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(420px 260px at 110% -10%,rgba(238,217,138,0.20),transparent 60%),radial-gradient(360px 240px at -20% 110%,rgba(0,0,0,0.28),transparent 65%)}
.gv-cs-inner>*{position:relative}
.gv-cs-eyebrow{display:flex;align-items:center;gap:7px;margin:0;font-size:12.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD}}
.gv-cs-title{margin:0;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;color:#FFF4E6;text-wrap:balance}
.gv-cs-card{position:relative;display:flex;flex-direction:column;gap:4px;margin:6px 0 2px 14px;padding:14px 14px 12px 34px;border-radius:16px;background:#FFFFFF;color:#1C1410;
  box-shadow:0 14px 30px rgba(20,4,4,0.38),0 1px 0 rgba(255,255,255,0.6) inset}
.gv-cs-disc{position:absolute;left:-16px;top:-10px;width:42px;height:42px;border-radius:999px;display:grid;place-items:center;
  background:linear-gradient(160deg,#2C5440,#1B3828);color:${GOLD};font-size:12px;font-weight:800;border:3px solid #FFFFFF;box-shadow:0 6px 14px rgba(20,4,4,0.35)}
.gv-cs-card-meta{font-size:11.5px;font-weight:700;color:#7A6E5E}
.gv-cs-card-title{font-size:15.5px;font-weight:800;line-height:1.25}
.gv-cs-card-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;flex-wrap:wrap}
.gv-cs-ok{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:#3D7A52}
.gv-cs-faces{display:inline-flex}
.gv-cs-faces i{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;font-style:normal;font-size:9px;font-weight:800;color:#FFF4E6;border:2px solid #FFFFFF;margin-left:-7px}
.gv-cs-faces i:first-child{margin-left:0}
.gv-cs-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px}
.gv-cs-list li{display:flex;align-items:flex-start;gap:12px}
.gv-cs-icon{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;color:${GOLD};background:rgba(255,232,214,0.10);box-shadow:inset 0 0 0 1px rgba(238,217,138,0.28)}
.gv-cs-text{display:flex;flex-direction:column;min-width:0}
.gv-cs-text b{font-size:14.5px;font-weight:800;color:#FFF4E6;line-height:1.3}
.gv-cs-line{font-size:13px;line-height:1.4;color:rgba(255,232,214,0.80)}
.gv-cs-foot{margin:auto 0 0;font-size:12.5px;font-weight:700;color:rgba(238,217,138,0.9)}
/* The form side, in the crisis reds. */
.gv-crisis .gv-auth-main{background:linear-gradient(180deg,#FBEDE7 0%,#FFFFFF 200px)}
.gv-crisis .gv-auth-word{color:${RED}}
.gv-crisis .gv-green{background:${RED_BTN}}
.gv-crisis .gv-green-shine{background:radial-gradient(circle at var(--spot-x,50%) var(--spot-y,50%),rgba(255,190,160,0.40) 0%,rgba(255,190,160,0) 60%)}
.gv-crisis .gv-notice{background:#FBEDE7;color:#6E1A1A}
.gv-crisis-need{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px;padding:12px 14px;border-radius:12px;background:#FBEDE7;color:#6E1A1A;font-size:14px;line-height:1.45;font-weight:600}
.gv-crisis-need svg{flex:none;margin-top:1px}
@media (min-width:860px){
  .gv-crisis.gv-split .gv-auth-side{flex-basis:420px}
  .gv-crisis.gv-auth-panel.gv-split{max-width:900px;min-height:min(600px,calc(100dvh - 48px))}
}
/* Phone: the red band above the sheet keeps the title and the feature names; the card and the long lines go. */
@media (max-width:743px){
  .gv-cs-inner{padding:calc(18px + env(safe-area-inset-top)) 20px 34px;gap:10px;justify-content:flex-end}
  .gv-cs-title{font-size:22px}
  .gv-cs-card,.gv-cs-line,.gv-cs-foot{display:none}
  .gv-cs-list{flex-direction:row;flex-wrap:wrap;gap:6px}
  .gv-cs-list li{align-items:center;gap:6px;padding:5px 10px 5px 6px;border-radius:999px;background:rgba(255,232,214,0.10);box-shadow:inset 0 0 0 1px rgba(238,217,138,0.25)}
  .gv-cs-icon{width:22px;height:22px;border-radius:999px;background:none;box-shadow:none}
  .gv-cs-icon svg{width:15px;height:15px}
  .gv-cs-text b{font-size:12.5px;font-weight:700}
  .gv-crisis .gv-auth-side{height:auto;min-height:clamp(170px,30svh,268px)}
}
@media (max-width:743px) and (max-height:740px){
  .gv-cs-title{font-size:20px}
  .gv-cs-eyebrow{display:none}
}
`;
