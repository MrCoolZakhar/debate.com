'use client';

// The Gavelling Crisis look of the "Log in or sign up" pop-up (owner, 19 Nov 2026: crisis themed, says Crisis needs an
// account, shows the core features). Redrawn the same day after the owner's "the side is too weird": no feature list and
// no icons in tiles ("the icons in curved rectangles? HATE"), but a small bento of the real demo crisis instead, the
// Cuban Missile Crisis everyone signs in to try: its map, a directive and the backroom's reply, a cabinet's resources,
// the two connected cabinets with their characters' portraits, and a front page.
// Everything is drawn here, never a screenshot: the map is public/crisis/auth-map.svg (the live map's land, sea, borders
// and cabinet tints, generated once from public/crisis/world-countries-50m.json) with the demo's units on top, drawn
// like the map's own tokens (map/tokens.ts) at their real positions. The texts are excerpts of the demo's own rows.
// Desktop: the bento on the left. Phone: the red band above the sheet keeps the title and a row of portraits.
// openAuth({ variant: 'crisis' }) mounts it; the sign-in steps themselves are the ordinary ones.

import { Check } from 'lucide-react';
import { glyphSvg } from '@/app/crisis/components/map/glyphs';
import type { UnitKind } from '@/lib/crisis/types';

const MEDIA = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://luruhkwrgisytejswlas.supabase.co'}/storage/v1/object/public/crisis-media/a752264b-2a6f-4719-b71d-992a2d6423c4`;
const face = (file: string) => `${MEDIA}/characters/${file}.jpg`;

const EXCOMM = '#3D7A52';
const PRESIDIUM = '#8E2424';

/** The demo's units around Cuba, placed on the 440 x 190 map in percent (from their lng / lat). */
const UNITS: Array<{ kind: UnitKind; name: string; strength: number; color: string; x: number; y: number }> = [
  { kind: 'missile', name: 'R-12 site, Sagua la Grande', strength: 15, color: PRESIDIUM, x: 156.3, y: 108.3 },
  { kind: 'navy', name: 'Destroyer group Essex', strength: 6, color: EXCOMM, x: 263.4, y: 117.1 },
  { kind: 'air', name: 'Strategic Air Command, Key West', strength: 24, color: EXCOMM, x: 120.8, y: 66 },
  { kind: 'sub', name: 'Submarine B-59', strength: 1, color: PRESIDIUM, x: 355.9, y: 26 },
];

const CABINETS: Array<{ name: string; logo: string; color: string; people: Array<[string, string]> }> = [
  { name: 'ExComm', logo: `${MEDIA}/cabinets/us-president.png`, color: EXCOMM,
    people: [['John F. Kennedy', 'jfk'], ['Robert F. Kennedy', 'rfk'], ['Robert McNamara', 'mcnamara'], ['Dean Rusk', 'rusk'], ['McGeorge Bundy', 'bundy']] },
  { name: 'Soviet Presidium', logo: `${MEDIA}/cabinets/ussr.png`, color: PRESIDIUM,
    people: [['Nikita Khrushchev', 'khrushchev'], ['Fidel Castro', 'castro'], ['Andrei Gromyko', 'gromyko'], ['Che Guevara', 'guevara'], ['Anatoly Dobrynin', 'dobrynin']] },
];

const BAND_FACES: Array<[string, string]> = [
  ['John F. Kennedy', 'jfk'], ['Nikita Khrushchev', 'khrushchev'], ['Fidel Castro', 'castro'], ['Robert F. Kennedy', 'rfk'],
  ['Andrei Gromyko', 'gromyko'], ['Robert McNamara', 'mcnamara'], ['Che Guevara', 'guevara'],
];

function Faces({ people, ring }: { people: Array<[string, string]>; ring?: string }) {
  return (
    <span className="gv-cb-faces">
      {people.map(([name, file]) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={file} className="gv-cb-face" src={face(file)} alt={name} title={name} style={ring ? { borderColor: ring } : undefined} />
      ))}
    </span>
  );
}

function MapTile() {
  return (
    <div className="gv-cb-tile gv-cb-map">
      <div className="gv-cb-mapart" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gv-cb-mapimg" src="/crisis/auth-map.svg" alt="" />
        {UNITS.map((u) => (
          <span key={u.name} className="gv-cb-tok" title={u.name} style={{ left: `${(u.x / 440) * 100}%`, top: `${(u.y / 190) * 100}%`, background: u.color }}>
            <span dangerouslySetInnerHTML={{ __html: glyphSvg(u.kind, 13) }} />
            <b style={{ color: u.color, borderColor: u.color }}>{u.strength}</b>
          </span>
        ))}
        <span className="gv-cb-pin" style={{ left: `${(108.3 / 440) * 100}%`, top: `${(101.1 / 190) * 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gv-cb-pinimg" src={face('castro')} alt="" />
          <i>Castro</i>
        </span>
        <span className="gv-cb-arc">Quarantine line</span>
      </div>
      <p className="gv-cb-label">Interactive Map</p>
    </div>
  );
}

function DirectiveTile() {
  return (
    <div className="gv-cb-tile gv-cb-dir">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gv-cb-author" src={face('jfk')} alt="John F. Kennedy" title="John F. Kennedy" />
      <p className="gv-cb-meta">No. 3 · John F. Kennedy · ExComm</p>
      <b className="gv-cb-dtitle">Order a naval quarantine around Cuba</b>
      <p className="gv-cb-quote">To Admiral Anderson. Following the vote in ExComm this afternoon and my address last night, I direct the Navy to establish a quarantine…</p>
      <p className="gv-cb-reply"><Check size={14} strokeWidth={2} aria-hidden />Flag plot to the President. Approved. The quarantine order has gone out on the fleet net as of 20:10…</p>
      <p className="gv-cb-label">Directives</p>
    </div>
  );
}

function ResourcesTile() {
  return (
    <div className="gv-cb-tile gv-cb-res">
      <span className="gv-cb-resfor">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gv-cb-logo" src={`${MEDIA}/cabinets/us-president.png`} alt="" />ExComm
      </span>
      <span className="gv-cb-num"><b>203</b>Ships at sea</span>
      <span className="gv-cb-num"><b>1,290</b>Aircraft ready</span>
      <span className="gv-cb-num"><b>66</b>Public standing</span>
      <p className="gv-cb-label">Resources</p>
    </div>
  );
}

function CabinetsTile() {
  return (
    <div className="gv-cb-tile gv-cb-cabs">
      {CABINETS.map((c) => (
        <div key={c.name} className="gv-cb-cab">
          <span className="gv-cb-cabname">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gv-cb-logo" src={c.logo} alt="" />{c.name}
          </span>
          <Faces people={c.people} ring={c.color} />
        </div>
      ))}
      <p className="gv-cb-label">Connected Cabinets</p>
    </div>
  );
}

function NewsTile() {
  return (
    <div className="gv-cb-tile gv-cb-news">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gv-cb-banner" src={`${MEDIA}/news/1792926753123-banner.jpg`} alt="" />
      <span className="gv-cb-newstext">
        <span className="gv-cb-source">TASS · October 23</span>
        <b>Moscow calls U.S. quarantine piracy and an act of aggression</b>
        <p className="gv-cb-label">Breaking News</p>
      </span>
    </div>
  );
}

export function CrisisAuthSide() {
  return (
    <div className="gv-auth-side gv-crisis-side">
      <div className="gv-cb-inner">
        <h3 className="gv-cb-title">Try the Cuban Missile Crisis, Live</h3>
        <div className="gv-cb-band" aria-hidden><Faces people={BAND_FACES} /></div>
        <div className="gv-cb-grid">
          <MapTile />
          <DirectiveTile />
          <ResourcesTile />
          <CabinetsTile />
          <NewsTile />
        </div>
      </div>
    </div>
  );
}

const RED_GRAD = 'linear-gradient(165deg, #9A2A2A 0%, #6A1919 52%, #3A0E0F 100%)';
const RED_BTN = 'linear-gradient(90deg, #741C1C 0%, #8E2424 45%, #A83030 100%)';
const RED = '#8E2424';
const INK = '#1C1410';
const SOFT = '#5E5340';

/** Scoped to .gv-crisis (the panel), so the ordinary pop-up is untouched. Mounted only with the crisis variant.
 *  Every image rule is `.gv-crisis .gv-auth-side img.<class>` so the shared "an image covers the side" rules never reach it. */
export const CRISIS_AUTH_CSS = `
.gv-crisis .gv-crisis-side{background:${RED_GRAD};color:#FFF4E6}
.gv-crisis .gv-crisis-side::after{content:none}
.gv-cb-inner{position:relative;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:26px 22px 22px;overflow:hidden}
.gv-cb-inner::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(420px 260px at 110% -10%,rgba(238,217,138,0.18),transparent 60%),radial-gradient(360px 240px at -20% 110%,rgba(0,0,0,0.28),transparent 65%)}
.gv-cb-inner>*{position:relative}
.gv-cb-title{margin:0;font-size:24px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;color:#FFF4E6;text-wrap:balance}
.gv-cb-band{display:none}
.gv-cb-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start}
.gv-cb-tile{position:relative;min-width:0;background:#FFFFFF;color:${INK};border-radius:16px;padding:12px;box-shadow:0 12px 26px rgba(20,4,4,0.34);display:flex;flex-direction:column;gap:5px}
.gv-cb-label{margin:auto 0 0;padding-top:4px;font-size:12px;font-weight:800;color:${RED}}
.gv-cb-map,.gv-cb-dir,.gv-cb-news{grid-column:span 2}
/* Map */
.gv-cb-map{padding:6px 6px 10px}
.gv-cb-mapart{position:relative;border-radius:11px;overflow:hidden;aspect-ratio:440/190}
.gv-crisis .gv-auth-side img.gv-cb-mapimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.gv-cb-map .gv-cb-label{padding:4px 6px 0}
.gv-cb-tok{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;border:2px solid #fff;box-sizing:border-box;display:grid;place-items:center;box-shadow:0 2px 6px rgba(27,56,40,0.38)}
.gv-cb-tok>span{display:grid;place-items:center}
.gv-cb-tok b{position:absolute;top:-8px;right:-12px;min-width:17px;height:15px;padding:0 3px;border-radius:8px;background:#fff;border:1.3px solid;box-sizing:border-box;font-size:9.5px;line-height:12px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums}
.gv-cb-pin{position:absolute;margin:-14px 0 0 -14px;display:flex;flex-direction:column;align-items:center}
.gv-crisis .gv-auth-side img.gv-cb-pinimg{position:static;width:28px;height:28px;border-radius:50%;border:2.5px solid ${PRESIDIUM};box-sizing:border-box;object-fit:cover;object-position:50% 20%;background:#fff;box-shadow:0 2px 7px rgba(27,56,40,0.35)}
.gv-cb-pin i{font-style:normal;margin-top:1px;font-size:9.5px;font-weight:800;color:${INK};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff}
.gv-cb-arc{position:absolute;right:8px;top:7px;font-size:10px;font-weight:800;color:${RED};text-shadow:0 0 3px #fff,0 0 3px #fff}
/* Directive */
.gv-cb-dir{padding:12px 13px 11px 40px;margin-left:12px}
.gv-crisis .gv-auth-side img.gv-cb-author{position:absolute;left:-14px;top:-8px;width:44px;height:44px;border-radius:50%;border:3px solid #fff;box-sizing:border-box;object-fit:cover;object-position:50% 20%;box-shadow:0 6px 14px rgba(20,4,4,0.35);background:#fff}
.gv-cb-meta{margin:0;font-size:11px;font-weight:700;color:#7A6E5E}
.gv-cb-dtitle{font-size:14.5px;line-height:1.25;font-weight:800}
.gv-cb-quote{margin:0;font-size:12px;line-height:1.4;color:${SOFT};font-style:italic}
.gv-cb-reply{margin:2px 0 0;display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.4;font-weight:600;color:#2F6143}
.gv-cb-reply svg{flex:none;margin-top:2px}
/* Resources */
.gv-cb-resfor,.gv-cb-cabname{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:${INK}}
.gv-crisis .gv-auth-side img.gv-cb-logo{position:static;width:20px;height:20px;border-radius:50%;object-fit:cover;flex:none;background:#fff;box-shadow:0 0 0 1px rgba(28,20,16,0.12)}
.gv-cb-num{display:flex;align-items:baseline;gap:6px;font-size:11.5px;font-weight:600;color:${SOFT};line-height:1.2}
.gv-cb-num b{font-size:19px;font-weight:800;color:${INK};letter-spacing:-0.01em;font-variant-numeric:tabular-nums}
/* Cabinets */
.gv-cb-cabs{gap:8px}
.gv-cb-cab{display:flex;flex-direction:column;gap:4px}
.gv-cb-faces{display:flex}
.gv-crisis .gv-auth-side img.gv-cb-face{position:static;width:27px;height:27px;border-radius:50%;border:2px solid #fff;box-sizing:border-box;object-fit:cover;object-position:50% 20%;margin-left:-8px;background:#fff;box-shadow:0 2px 5px rgba(20,4,4,0.22)}
.gv-crisis .gv-auth-side img.gv-cb-face:first-child{margin-left:0}
/* News */
.gv-cb-news{flex-direction:row;gap:11px;padding:8px;align-items:stretch}
.gv-crisis .gv-auth-side img.gv-cb-banner{position:static;width:96px;min-height:72px;height:auto;border-radius:10px;object-fit:cover;flex:none;display:block}
.gv-cb-newstext{display:flex;flex-direction:column;gap:3px;min-width:0;padding:2px 2px 0 0}
.gv-cb-newstext b{font-size:13.5px;line-height:1.28;font-weight:800}
.gv-cb-source{font-size:11px;font-weight:700;color:#7A6E5E}
/* The form side, in the crisis reds. */
.gv-crisis .gv-auth-main{background:linear-gradient(180deg,#FBEDE7 0%,#FFFFFF 200px)}
.gv-crisis .gv-auth-word{color:${RED}}
.gv-crisis .gv-green{background:${RED_BTN}}
.gv-crisis .gv-green-shine{background:radial-gradient(circle at var(--spot-x,50%) var(--spot-y,50%),rgba(255,190,160,0.40) 0%,rgba(255,190,160,0) 60%)}
.gv-crisis .gv-notice{background:#FBEDE7;color:#6E1A1A}
.gv-crisis-need{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px;padding:12px 14px;border-radius:12px;background:#FBEDE7;color:#6E1A1A;font-size:14px;line-height:1.45;font-weight:600}
.gv-crisis-need svg{flex:none;margin-top:1px}
@media (min-width:860px){
  .gv-crisis.gv-split .gv-auth-side{flex-basis:470px}
  .gv-crisis.gv-auth-panel.gv-split{max-width:960px;min-height:min(680px,calc(100dvh - 48px))}
}
@media (min-width:860px) and (max-height:760px){
  .gv-cb-quote,.gv-cb-news{display:none}
}
/* Phone: the red band above the sheet keeps the title and a row of the crisis's people. */
@media (max-width:743px){
  .gv-cb-inner{padding:calc(18px + env(safe-area-inset-top)) 20px 34px;gap:12px;justify-content:flex-end}
  .gv-cb-title{font-size:22px}
  .gv-cb-grid{display:none}
  .gv-cb-band{display:block}
  .gv-crisis .gv-auth-side img.gv-cb-face{width:38px;height:38px;margin-left:-10px;border-width:2.5px}
  .gv-crisis .gv-auth-side{height:auto;min-height:clamp(150px,26svh,240px)}
}
`;
