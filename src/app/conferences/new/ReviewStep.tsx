'use client';

// The creation wizard's last step, "Ready to Publish?" (owner, 22 Nov 2026).
//
// "One very brief overview with all the info ... slightly wider ... a brief render of how the page
// WILL look", then: "add the ability to edit the things directly on the ready to publish page ...
// inline within the overview", and "the publish button is still outside of the page, have it be a
// big VERY INTERESTING BUTTON".
//
// Left: PagePreview, the public page in miniature, live as anything changes. Right: one overview,
// a row per answer. Edit opens that row's own editor IN the row (one at a time; Done closes it),
// writing straight to the wizard's state through `set`, so the preview follows every keystroke;
// committees open the dashboard's committee pop-up as on step 6. The Publish dock is fixed to the
// bottom of the window, always in view: a big forest button with the 3D gavel that swings on
// hover, strikes on press and keeps tapping while it publishes, with Save as draft beside it.
// Hovering or editing a row lights the matching part of the preview.

import { useRef, useState, type ReactNode } from 'react';
import { CalendarDays, MapPin, Users, LayoutGrid, FileText, Link2, Banknote, Sparkles, Landmark, Plus, X, Upload, Check } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { DatePicker } from '@/components/DatePicker';
import GSelect from '@/components/GSelect';
import { Emoji3D } from '@/components/neu';
import { UN_COUNTRIES } from '@/lib/countries';
import { INTENT_OPTIONS } from '@/lib/conferenceIntent';
import { committeeDisplayName } from '@/lib/presetNames';
import type { CommitteeDraft } from '@/components/CommitteeEditorModal';
import { BRAND } from './brandMarks';
import PagePreview from './PagePreview';

type Committee = CommitteeDraft & { key: string };
type Row = 'conference' | 'when' | 'where' | 'delegates' | 'committees' | 'about' | 'links' | 'payments' | 'intent';
const SOCIAL_KEYS = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'website'] as const;
type SocialKey = typeof SOCIAL_KEYS[number];

export interface ReviewValues {
  fullName: string;
  acronym: string;
  logoUrl: string;
  bannerUrl: string;
  startDate: string;
  endDate: string;
  datesTbd: boolean;
  country: string;
  city: string;
  format: string;
  studentLevel: string;
  expectedDelegates: string;
  description: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  website: string;
  payChoice: '' | 'free' | 'paid';
  intentKeys: string[];
}

export interface ReviewStepProps {
  values: ReviewValues;
  /** Writes into the wizard's own state (the page maps each key to its setter). */
  set: (patch: Partial<ReviewValues>) => void;
  committees: Committee[];
  chairsToInvite: number;
  dateLabel: string;
  year: string;
  slug: string;
  todayISO: string;
  bannerPresets: string[];
  logoUploading: boolean;
  bannerUploading: boolean;
  onPickLogo: (file: File) => void;
  onPickBanner: (file: File) => void;
  onEditCommittee: (c: Committee) => void;
  onAddCommittee: () => void;
  onRemoveCommittee: (key: string) => void;
  renderEmblem: (c: Committee, size: number) => ReactNode;
  /** Contact email, the note and any error, from the page, shown under the overview. */
  extra: ReactNode;
  publish: {
    onPublish: () => void;
    onDraft: () => void;
    publishLabel: string;
    draftLabel: string;
    disabled: boolean;
    busy: 'publish' | 'draft' | null;
  };
}

const CSS = `
.gv-rv{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(18px,2.4vw,32px);width:100%;align-items:start;padding-bottom:120px}
@media (min-width:1000px){.gv-rv{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}.gv-rv-left{position:sticky;top:84px}}
.gv-rv-cap{display:flex;align-items:center;gap:8px;margin:0 0 10px 4px;font-size:13px;font-weight:700;color:#5B4F43}
.gv-rv-dot{width:8px;height:8px;border-radius:999px;background:#2F7A4D;box-shadow:0 0 0 4px rgba(47,122,77,0.16);animation:gv-rv-pulse 1.8s ease-in-out infinite}
@keyframes gv-rv-pulse{50%{box-shadow:0 0 0 7px rgba(47,122,77,0.05)}}
.gv-rv-frame{border-radius:18px;background:#FFFFFF;overflow:hidden;box-shadow:0 2px 6px rgba(27,56,40,0.08),0 24px 60px rgba(27,56,40,0.16);animation:gv-rv-in 520ms cubic-bezier(.2,.8,.2,1) both}
.gv-rv-bar{display:flex;align-items:center;gap:10px;height:34px;padding:0 12px;background:#F4EFE3;border-bottom:1px solid #E6DECB}
.gv-rv-dots{display:flex;gap:5px}.gv-rv-dots i{width:9px;height:9px;border-radius:999px;background:#D9CFBA}
.gv-rv-url{flex:1;min-width:0;height:22px;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#5B4F43;overflow-wrap:anywhere}
.gv-rv-list{background:#FFFFFF;border-radius:20px;box-shadow:0 1px 2px rgba(27,56,40,0.06),0 10px 28px rgba(27,56,40,0.10);padding:6px 0;animation:gv-rv-in 520ms 80ms cubic-bezier(.2,.8,.2,1) both}
.gv-rv-row{padding:11px 18px;transition:background-color 160ms ease}
.gv-rv-row + .gv-rv-row{box-shadow:inset 0 1px 0 #EFE8D8}
.gv-rv-row:hover,.gv-rv-row.gv-open{background:#FAF6EC}
.gv-rv-head{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;column-gap:12px}
.gv-rv-ico{color:#1C1410;display:flex}
.gv-rv-k{font-size:11.5px;font-weight:700;color:#8A7B69;margin-bottom:2px}
.gv-rv-v{font-size:14.5px;font-weight:700;color:#1C1410;line-height:1.35;overflow-wrap:anywhere}
.gv-rv-s{font-size:12.5px;font-weight:500;color:#5B4F43;line-height:1.45;margin-top:2px;overflow-wrap:anywhere}
.gv-rv-edit{font-family:inherit;font-size:12.5px;font-weight:700;color:#1C1410;text-decoration:underline;text-underline-offset:3px;background:none;border:0;padding:6px 4px;cursor:pointer;border-radius:6px}
.gv-rv-edit.gv-done{text-decoration:none;background:#1B3828;color:#EED98A;padding:6px 12px;border-radius:999px}
.gv-rv-edit:focus{outline:none}.gv-rv-edit:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-rv-thumbs{display:flex;align-items:center;gap:10px}
.gv-rv-logo{width:42px;height:42px;border-radius:999px;background:#FFFFFF;box-shadow:0 0 0 1px #E6DECB,0 3px 8px rgba(27,56,40,0.12);overflow:hidden;flex-shrink:0}
.gv-rv-logo img{width:100%;height:100%;object-fit:contain}
.gv-rv-banner{width:72px;height:40px;border-radius:9px;background:#1B3828 center/cover no-repeat;flex-shrink:0;box-shadow:0 3px 8px rgba(27,56,40,0.12)}
.gv-rv-stack{display:flex;align-items:center;margin-top:5px}
.gv-rv-stack > * + *{margin-left:-8px}
.gv-rv-chip{display:inline-flex;width:26px;height:26px;border-radius:999px;align-items:center;justify-content:center;color:#FFFFFF;box-shadow:0 0 0 2px #FFFFFF}
.gv-rv-chip svg{width:58%;height:58%}
/* Inline editors */
.gv-ed{margin:12px 0 4px 34px;display:flex;flex-direction:column;gap:10px;animation:gv-rv-open 220ms cubic-bezier(.2,.8,.2,1) both}
.gv-ed label{display:block;font-size:11.5px;font-weight:700;color:#8A7B69;margin-bottom:4px}
.gv-ed input[type=text],.gv-ed input[type=number],.gv-ed textarea{width:100%;font-family:inherit;font-size:14px;color:#1C1410;background:#FFFFFF;border:1.5px solid #E2D9C6;border-radius:12px;padding:9px 12px;outline:none;transition:border-color 160ms ease,box-shadow 160ms ease}
.gv-ed input:focus,.gv-ed textarea:focus{border-color:#1B3828;box-shadow:0 0 0 3px rgba(27,56,40,0.10)}
.gv-ed textarea{min-height:110px;resize:vertical;line-height:1.5}
.gv-ed-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:480px){.gv-ed{margin-left:0}.gv-ed-two{grid-template-columns:minmax(0,1fr)}}
.gv-seg{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:rgba(27,56,40,0.07);flex-wrap:wrap}
.gv-seg button{font-family:inherit;font-size:13px;font-weight:700;color:#5B4F43;background:transparent;border:0;border-radius:9px;padding:7px 12px;cursor:pointer}
.gv-seg button[aria-pressed="true"]{background:#FFFFFF;color:#1C1410;box-shadow:0 2px 6px rgba(27,56,40,0.12)}
.gv-seg button:focus{outline:none}.gv-seg button:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-ed-presets{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gv-ed-presets > button.gv-pre{width:62px;height:36px;border-radius:9px;border:2px solid transparent;background:#1B3828 center/cover no-repeat;cursor:pointer;padding:0}
.gv-ed-presets > button.gv-pre[aria-pressed="true"]{border-color:#1B3828;box-shadow:0 0 0 2px #EED98A}
.gv-ed-presets > button.gv-pre:focus{outline:none}.gv-ed-presets > button.gv-pre:focus-visible{box-shadow:0 0 0 3px #EED98A}
.gv-ed-btn{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:13px;font-weight:700;color:#1C1410;background:#FFFFFF;border:1.5px solid #D9CFBA;border-radius:10px;padding:7px 12px;cursor:pointer}
.gv-ed-btn:focus{outline:none}.gv-ed-btn:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-ed-tick{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1C1410;background:none;border:0;cursor:pointer;padding:2px 0;font-family:inherit;width:fit-content}
.gv-ed-tick span{width:18px;height:18px;border-radius:5px;border:1.5px solid rgba(27,56,40,0.35);display:flex;align-items:center;justify-content:center}
.gv-ed-tick[aria-checked="true"] span{background:#1B3828;border-color:#1B3828;color:#EED98A}
.gv-ed-tick:focus{outline:none}.gv-ed-tick:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-ed-comms{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gv-ed-comm{display:inline-flex;align-items:center;gap:2px;background:#FFFFFF;border:1.5px solid #E2D9C6;border-radius:14px;padding:4px 6px 4px 4px}
.gv-ed-comm button{display:inline-flex;align-items:center;gap:8px;border:0;background:none;cursor:pointer;color:#1C1410;font-family:inherit;font-weight:700;font-size:13px;padding:2px 4px;border-radius:8px}
.gv-ed-comm button:focus{outline:none}.gv-ed-comm button:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-ed-intents{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.gv-ed-intent{display:flex;align-items:center;gap:8px;text-align:left;font-family:inherit;font-size:13px;font-weight:700;color:#1C1410;background:#FFFFFF;border:1.5px solid #E2D9C6;border-radius:12px;padding:7px 9px;cursor:pointer}
.gv-ed-intent[aria-checked="true"]{border-color:#1B3828;background:#F7F1DF}
.gv-ed-intent:focus{outline:none}.gv-ed-intent:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-ed-err{font-size:12.5px;font-weight:600;color:#8B2020}
.gv-rv-extra{margin-top:10px}
/* The Publish dock */
.gv-dock{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:45;display:flex;align-items:center;gap:18px;
  padding:10px 10px 10px 22px;border-radius:26px;width:min(780px,calc(100vw - 32px));
  background:rgba(255,253,247,0.80);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
  box-shadow:0 0 0 1px rgba(27,56,40,0.08),0 18px 50px rgba(27,56,40,0.22);animation:gv-dock-in 600ms 200ms cubic-bezier(.2,.9,.2,1.1) both}
@media (max-width:767px){.gv-dock{bottom:calc(76px + env(safe-area-inset-bottom));padding:8px 8px 4px;gap:2px;border-radius:22px;flex-direction:column;align-items:stretch}.gv-dock-text{display:none}.gv-draft{order:2;padding:6px}}
/* The wizard's "Saved on this device" pill sits where the dock is on a phone: the dock wins. */
@media (max-width:1023px){.gv-draft-saved{display:none!important}}
.gv-dock-text{flex:1;min-width:0}
.gv-dock-text b{display:block;font-size:14px;font-weight:800;color:#1C1410;overflow-wrap:anywhere}
.gv-dock-text span{display:block;font-size:12px;font-weight:600;color:#5B4F43;overflow-wrap:anywhere}
.gv-draft{font-family:inherit;font-size:13px;font-weight:700;color:#1C1410;text-decoration:underline;text-underline-offset:3px;background:none;border:0;padding:8px 6px;cursor:pointer;white-space:nowrap;border-radius:8px}
.gv-draft:disabled{opacity:0.45;cursor:not-allowed}
.gv-draft:focus{outline:none}.gv-draft:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-pub{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:12px;min-height:60px;padding:0 30px 0 14px;border:0;border-radius:20px;cursor:pointer;font-family:inherit;
  background:linear-gradient(120deg,#1B3828 0%,#2A5A3C 55%,#1B3828 100%);background-size:200% 100%;color:#EED98A;font-size:18px;font-weight:800;letter-spacing:-0.01em;white-space:nowrap;
  box-shadow:0 10px 26px rgba(27,56,40,0.38),inset 0 1px 0 rgba(255,255,255,0.14);
  transition:transform 180ms cubic-bezier(.2,.8,.2,1),box-shadow 200ms ease,background-position 600ms ease;animation:gv-pub-glow 2.8s ease-in-out infinite}
@media (max-width:767px){.gv-pub{justify-content:center;min-height:56px;font-size:17px;padding:0 18px 0 10px}}
.gv-pub::after{content:"";position:absolute;top:0;bottom:0;width:60%;left:-80%;background:linear-gradient(100deg,transparent,rgba(238,217,138,0.35),transparent);transform:skewX(-18deg);animation:gv-pub-shine 3.6s ease-in-out infinite;pointer-events:none}
.gv-pub img{width:44px;height:44px;transform-origin:70% 75%;transition:transform 260ms cubic-bezier(.3,1.6,.5,1);filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35))}
@media (hover:hover){.gv-pub:hover:not(:disabled){transform:translateY(-2px) scale(1.02);background-position:100% 0;box-shadow:0 16px 36px rgba(27,56,40,0.45),inset 0 1px 0 rgba(255,255,255,0.18)}
  .gv-pub:hover:not(:disabled) img{transform:rotate(-24deg)}}
.gv-pub:active:not(:disabled){transform:scale(0.97)}
.gv-pub:active:not(:disabled) img{transform:rotate(14deg)}
.gv-pub.gv-busy img{animation:gv-gavel-tap 520ms ease-in-out infinite}
.gv-pub:disabled{cursor:not-allowed;opacity:0.55;animation:none}
.gv-pub:disabled::after{display:none}
.gv-pub:focus{outline:none}.gv-pub:focus-visible{box-shadow:0 0 0 3px #EED98A,0 10px 26px rgba(27,56,40,0.38)}
@keyframes gv-pub-shine{0%,55%{left:-80%}85%,100%{left:130%}}
@keyframes gv-pub-glow{50%{box-shadow:0 10px 30px rgba(27,56,40,0.42),0 0 0 6px rgba(238,217,138,0.22),inset 0 1px 0 rgba(255,255,255,0.14)}}
@keyframes gv-gavel-tap{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(12deg)}}
@keyframes gv-dock-in{from{opacity:0;transform:translate(-50%,30px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes gv-rv-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes gv-rv-open{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.gv-rv-frame,.gv-rv-list,.gv-rv-dot,.gv-pub,.gv-pub::after,.gv-dock,.gv-ed,.gv-pub.gv-busy img{animation:none}}
`;

const SOCIAL_STYLE: Record<string, string> = {
  instagram: 'radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)',
  facebook: '#0866FF', tiktok: '#000000', whatsapp: '#25D366', website: '#1B3828',
};
const SOCIAL_LABEL: Record<SocialKey, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', whatsapp: 'WhatsApp', website: 'Website' };
const COUNTRY_OPTIONS = UN_COUNTRIES.map((c) => ({ value: c.name, label: c.name }));

function formatLabel(f: string) { return f === 'in-person' ? 'In person' : f === 'online' ? 'Online' : f === 'hybrid' ? 'Hybrid' : 'Not set'; }
function levelLabel(l: string) { return l === 'school' ? 'High school' : l === 'university' ? 'University' : l === 'both' ? 'High school and university' : 'Not set'; }
function excerpt(text: string, max: number) {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).replace(/[\s.,;:!?]+$/, '')}…`;
}

function SocialChip({ k }: { k: string }) {
  const m = BRAND[k];
  return (
    <span className="gv-rv-chip" style={{ background: SOCIAL_STYLE[k] ?? '#1B3828' }}>
      {m ? <svg viewBox="0 0 24 24" fill="#FFFFFF"><path d={m.path} /></svg> : <Link2 strokeWidth={2.2} />}
    </span>
  );
}

function Seg<V extends string>({ value, options, onChange }: { value: string; options: { v: V; l: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="gv-seg" role="group">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

export default function ReviewStep(p: ReviewStepProps) {
  const v = p.values;
  const [open, setOpen] = useState<Row | null>(null);
  const [hover, setHover] = useState<Row | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const code = UN_COUNTRIES.find((c) => c.name.toLowerCase() === v.country.trim().toLowerCase())?.code;
  const place = [v.city.trim(), v.country.trim()].filter(Boolean).join(', ');
  const when = v.datesTbd || !p.dateLabel ? 'Dates to be decided' : p.dateLabel;
  const links = SOCIAL_KEYS.filter((k) => v[k].trim());
  const intents = INTENT_OPTIONS.filter((o) => v.intentKeys.includes(o.key)).map((o) => o.label);
  const acr = v.acronym.trim().toUpperCase();
  const lit = open ?? hover;
  const paymentSummary = v.payChoice === 'free' ? 'Free' : v.payChoice === 'paid' ? 'Paid, set up in Financials' : 'Not answered';

  const row = (r: Row, icon: ReactNode, summary: ReactNode, editor: ReactNode) => {
    const isOpen = open === r;
    return (
      <div className={`gv-rv-row${isOpen ? ' gv-open' : ''}`} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}>
        <div className="gv-rv-head">
          <span className="gv-rv-ico">{icon}</span>
          <div style={{ minWidth: 0 }}>{summary}</div>
          <button type="button" className={`gv-rv-edit${isOpen ? ' gv-done' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r)}>
            {isOpen ? 'Done' : 'Edit'}
          </button>
        </div>
        {isOpen && <div className="gv-ed">{editor}</div>}
      </div>
    );
  };

  const ico = (I: typeof Landmark) => <I size={18} strokeWidth={1.6} />;

  return (
    <>
      <style>{CSS}</style>
      <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onPickLogo(f); e.target.value = ''; }} />
      <input ref={bannerInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onPickBanner(f); e.target.value = ''; }} />
      <div className="gv-rv">
        {/* ── How the page will look ─────────────────────────────── */}
        <div className="gv-rv-left">
          <p className="gv-rv-cap"><span className="gv-rv-dot" aria-hidden />How your page will look</p>
          <div className="gv-rv-frame">
            <div className="gv-rv-bar" aria-hidden>
              <span className="gv-rv-dots"><i /><i /><i /></span>
              <span className="gv-rv-url">gavelling.com/conferences/{p.slug}</span>
            </div>
            <PagePreview
              fullName={v.fullName} acronym={v.acronym} year={p.year} logoUrl={v.logoUrl} bannerUrl={v.bannerUrl}
              countryCode={code} country={v.country} city={v.city} when={when}
              format={v.format} studentLevel={v.studentLevel} expectedDelegates={v.expectedDelegates}
              description={v.description} links={links} committees={p.committees} renderEmblem={p.renderEmblem}
              hot={lit}
            />
          </div>
        </div>

        {/* ── The brief overview, editable in place ──────────────── */}
        <div>
          <div className="gv-rv-list">
            {row('conference', ico(Landmark),
              <div className="gv-rv-thumbs">
                <span className="gv-rv-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.logoUrl && <img src={v.logoUrl} alt="Logo" />}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="gv-rv-v" style={{ display: 'block' }}>{acr}</span>
                  <span className="gv-rv-s" style={{ display: 'block', marginTop: 0 }}>{v.fullName.trim()}</span>
                </span>
                <span className="gv-rv-banner" style={{ marginLeft: 'auto', backgroundImage: v.bannerUrl ? `url("${v.bannerUrl}")` : undefined }} />
              </div>,
              <>
                <div className="gv-ed-two">
                  <div><label htmlFor="rv-name">Full name</label><input id="rv-name" type="text" value={v.fullName} onChange={(e) => p.set({ fullName: e.target.value })} /></div>
                  <div><label htmlFor="rv-acr">Acronym</label><input id="rv-acr" type="text" value={v.acronym} onChange={(e) => p.set({ acronym: e.target.value })} /></div>
                </div>
                {!v.fullName.trim() && <span className="gv-ed-err">Your conference needs its full name.</span>}
                <div>
                  <label>Logo</label>
                  <button type="button" className="gv-ed-btn" onClick={() => logoInput.current?.click()} disabled={p.logoUploading}>
                    <Upload size={15} strokeWidth={1.8} />{p.logoUploading ? 'Uploading' : 'Change logo'}
                  </button>
                </div>
                <div>
                  <label>Banner</label>
                  <div className="gv-ed-presets">
                    {p.bannerPresets.map((src) => (
                      <button key={src} type="button" className="gv-pre" aria-label="Use this banner" aria-pressed={v.bannerUrl === src} style={{ backgroundImage: `url("${src}")` }} onClick={() => p.set({ bannerUrl: src })} />
                    ))}
                    <button type="button" className="gv-ed-btn" onClick={() => bannerInput.current?.click()} disabled={p.bannerUploading}>
                      <Upload size={15} strokeWidth={1.8} />{p.bannerUploading ? 'Uploading' : 'Upload your own'}
                    </button>
                  </div>
                </div>
              </>,
            )}

            {row('when', ico(CalendarDays),
              <><div className="gv-rv-k">Dates</div><div className="gv-rv-v">{when}</div></>,
              <>
                {!v.datesTbd && (
                  <div className="gv-ed-two">
                    <div><label>First day</label><DatePicker value={v.startDate} min={p.todayISO} onChange={(iso) => p.set({ startDate: iso, ...(!v.endDate || v.endDate < iso ? { endDate: iso } : {}) })} /></div>
                    <div><label>Last day</label><DatePicker value={v.endDate} min={v.startDate || p.todayISO} onChange={(iso) => p.set({ endDate: iso })} /></div>
                  </div>
                )}
                <button type="button" role="checkbox" aria-checked={v.datesTbd} className="gv-ed-tick" onClick={() => p.set(v.datesTbd ? { datesTbd: false } : { datesTbd: true, startDate: '', endDate: '' })}>
                  <span>{v.datesTbd && <Check size={12} strokeWidth={3} />}</span>Dates are to be decided
                </button>
              </>,
            )}

            {row('where', ico(MapPin),
              <>
                <div className="gv-rv-k">Where</div>
                <div className="gv-rv-v" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {code && <CircleFlag code={code} country={v.country} size={20} decorative />}<span>{place}</span>
                </div>
                <div className="gv-rv-s">{formatLabel(v.format)} · {levelLabel(v.studentLevel)}</div>
              </>,
              <>
                <div className="gv-ed-two">
                  <div><label>Country</label><GSelect value={v.country} options={COUNTRY_OPTIONS} onChange={(c) => p.set({ country: c })} placeholder="Pick a country" searchable /></div>
                  <div><label htmlFor="rv-city">City</label><input id="rv-city" type="text" value={v.city} onChange={(e) => p.set({ city: e.target.value })} /></div>
                </div>
                {!v.city.trim() && <span className="gv-ed-err">Add the city, delegates look for it.</span>}
                <div><label>Format</label><Seg value={v.format} options={[{ v: 'in-person', l: 'In person' }, { v: 'online', l: 'Online' }]} onChange={(f) => p.set({ format: f })} /></div>
                <div><label>Level</label><Seg value={v.studentLevel} options={[{ v: 'school', l: 'High school' }, { v: 'university', l: 'University' }]} onChange={(l) => p.set({ studentLevel: l })} /></div>
              </>,
            )}

            {row('delegates', ico(Users),
              <><div className="gv-rv-k">Expected delegates</div><div className="gv-rv-v">{Number(v.expectedDelegates) > 0 ? Number(v.expectedDelegates).toLocaleString('en-US') : 'Not set'}</div></>,
              <>
                <div style={{ maxWidth: 200 }}><label htmlFor="rv-del">How many delegates</label><input id="rv-del" type="number" min={1} value={v.expectedDelegates} onChange={(e) => p.set({ expectedDelegates: e.target.value })} /></div>
                {!(Number(v.expectedDelegates) > 0) && <span className="gv-ed-err">Give a number above zero.</span>}
              </>,
            )}

            {row('committees', ico(LayoutGrid),
              <>
                <div className="gv-rv-k">{p.committees.length === 1 ? '1 committee' : `${p.committees.length} committees`}{p.chairsToInvite > 0 ? `, ${p.chairsToInvite} ${p.chairsToInvite === 1 ? 'chair' : 'chairs'} to invite` : ''}</div>
                <div className="gv-rv-s" style={{ marginTop: 0 }}>{p.committees.map((c) => committeeDisplayName(c.name, c.abbreviation)).join(', ')}</div>
              </>,
              <>
                <div className="gv-ed-comms">
                  {p.committees.map((c) => (
                    <span key={c.key} className="gv-ed-comm">
                      <button type="button" onClick={() => p.onEditCommittee(c)} aria-label={`Edit ${c.name}`}>
                        <span style={{ display: 'inline-flex' }}>{p.renderEmblem(c, 26)}</span>
                        {c.abbreviation ? c.abbreviation.toUpperCase() : c.name}
                      </button>
                      {p.committees.length > 1 && (
                        <button type="button" onClick={() => p.onRemoveCommittee(c.key)} aria-label={`Remove ${c.name}`}><X size={14} strokeWidth={2.2} /></button>
                      )}
                    </span>
                  ))}
                  <button type="button" className="gv-ed-btn" onClick={p.onAddCommittee}><Plus size={15} strokeWidth={2} />Add a committee</button>
                </div>
                <span className="gv-rv-s" style={{ marginTop: 0 }}>Tap a committee to change it or invite its chairs.</span>
              </>,
            )}

            {row('about', ico(FileText),
              <><div className="gv-rv-k">Description</div><div className="gv-rv-s" style={{ marginTop: 0 }}>{v.description.trim() ? excerpt(v.description, 150) : 'Not added'}</div></>,
              <textarea aria-label="Description" value={v.description} onChange={(e) => p.set({ description: e.target.value })} placeholder="What makes your conference worth the trip" />,
            )}

            {row('links', ico(Link2),
              <>
                <div className="gv-rv-k">Links</div>
                {links.length ? <div className="gv-rv-stack">{links.map((k) => <SocialChip key={k} k={k} />)}</div> : <div className="gv-rv-s" style={{ marginTop: 0 }}>Not added</div>}
              </>,
              <div className="gv-ed-two">
                {SOCIAL_KEYS.map((k) => (
                  <div key={k}><label htmlFor={`rv-${k}`}>{SOCIAL_LABEL[k]}</label><input id={`rv-${k}`} type="text" value={v[k]} onChange={(e) => p.set({ [k]: e.target.value } as Partial<ReviewValues>)} placeholder={k === 'website' ? 'yourconference.org' : '@handle or link'} /></div>
                ))}
              </div>,
            )}

            {row('payments', ico(Banknote),
              <><div className="gv-rv-k">Delegate payments</div><div className="gv-rv-v">{paymentSummary}</div></>,
              <Seg value={v.payChoice} options={[{ v: 'free', l: "It's free" }, { v: 'paid', l: 'Delegates pay a fee' }]} onChange={(c) => p.set({ payChoice: c })} />,
            )}

            {row('intent', ico(Sparkles),
              <><div className="gv-rv-k">Using Gavelling for</div><div className="gv-rv-s" style={{ marginTop: 0 }}>{intents.length ? intents.join(', ') : 'Not answered'}</div></>,
              <div className="gv-ed-intents">
                {INTENT_OPTIONS.map((o) => {
                  const on = v.intentKeys.includes(o.key);
                  return (
                    <button key={o.key} type="button" role="checkbox" aria-checked={on} className="gv-ed-intent"
                      onClick={() => p.set({ intentKeys: on ? v.intentKeys.filter((k) => k !== o.key) : [...v.intentKeys, o.key] })}>
                      <Emoji3D name={o.emoji} size={22} />{o.label}
                    </button>
                  );
                })}
              </div>,
            )}
          </div>

          <div className="gv-rv-extra">{p.extra}</div>
        </div>
      </div>

      {/* ── The Publish dock: always on screen ─────────────────────── */}
      <div className="gv-dock" role="region" aria-label="Publish your conference">
        <div className="gv-dock-text">
          <b>{v.fullName.trim() || 'Your conference'} is ready</b>
          <span>Goes live at gavelling.com/conferences/{p.slug}</span>
        </div>
        <button type="button" className="gv-draft" onClick={p.publish.onDraft} disabled={p.publish.disabled}>
          {p.publish.busy === 'draft' ? 'Saving' : p.publish.draftLabel}
        </button>
        <button type="button" className={`gv-pub${p.publish.busy === 'publish' ? ' gv-busy' : ''}`} onClick={p.publish.onPublish} disabled={p.publish.disabled}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gavel-3d.webp" alt="" aria-hidden draggable={false} />
          {p.publish.busy === 'publish' ? 'Publishing' : p.publish.publishLabel}
        </button>
      </div>
    </>
  );
}
