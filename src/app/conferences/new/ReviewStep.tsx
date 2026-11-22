'use client';

// The creation wizard's last step, "Ready to Publish?" (owner, 22 Nov 2026: "completely
// redesigned. one very brief overview with all the info - pictures, icons, logos, country flag in
// circle, committee overview, description, social links ... slightly wider ... a brief render of
// how the page WILL look like when they publish").
//
// Two columns from 1000 px (one below): on the left a miniature of the public conference page in
// a browser frame, drawn from what the organiser typed (banner, logo, name, flag and dates, the
// Format / Level / Delegates tiles, About, committees, links, the "Choose how you apply" panel).
// It is sized in container units (cqw), so it scales with its column and never needs a measure.
// On the right one short overview, a row per answer, each with Edit. Hovering a row lights up the
// matching part of the preview. The page's own buttons, contact email and notes come in through
// `actions`, unchanged. Writes nothing.

import { useState, type ReactNode } from 'react';
import { CalendarDays, MapPin, Users, LayoutGrid, FileText, Link2, Banknote, Sparkles, Globe, ArrowRight, Landmark } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { UN_COUNTRIES } from '@/lib/countries';
import { INTENT_OPTIONS } from '@/lib/conferenceIntent';
import { committeeDisplayName } from '@/lib/presetNames';
import type { CommitteeDraft } from '@/components/CommitteeEditorModal';
import { BRAND } from './brandMarks';

type Committee = CommitteeDraft & { key: string };
type Sec = 'conference' | 'when' | 'where' | 'delegates' | 'committees' | 'about' | 'links' | null;

export interface ReviewStepProps {
  fullName: string;
  acronym: string;
  logoUrl: string;
  bannerUrl: string;
  /** Already formatted by the page ("4 to 7 Feb 2027"), or '' when not set. */
  dateLabel: string;
  datesTbd: boolean;
  year: string;
  slug: string;
  country: string;
  city: string;
  format: string;
  studentLevel: string;
  expectedDelegates: string;
  committees: Committee[];
  chairsToInvite: number;
  description: string;
  socials: { instagram: string; facebook: string; tiktok: string; whatsapp: string; website: string };
  paymentSummary: string;
  intentKeys: string[];
  renderEmblem: (c: Committee, size: number) => ReactNode;
  onEdit: (step: number) => void;
  /** Contact email, notes, error and the Publish / Save as draft buttons, from the page. */
  actions: ReactNode;
}

const CSS = `
.gv-rv{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(18px,2.4vw,32px);width:100%;align-items:start}
@media (min-width:1000px){.gv-rv{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}}
.gv-rv-cap{display:flex;align-items:center;gap:8px;margin:0 0 10px 4px;font-size:13px;font-weight:700;color:#5B4F43}
.gv-rv-dot{width:8px;height:8px;border-radius:999px;background:#2F7A4D;box-shadow:0 0 0 4px rgba(47,122,77,0.16);animation:gv-rv-pulse 1.8s ease-in-out infinite}
@keyframes gv-rv-pulse{50%{box-shadow:0 0 0 7px rgba(47,122,77,0.05)}}
/* The browser frame */
.gv-rv-frame{border-radius:18px;background:#FFFFFF;overflow:hidden;box-shadow:0 2px 6px rgba(27,56,40,0.08),0 24px 60px rgba(27,56,40,0.16);animation:gv-rv-in 520ms cubic-bezier(.2,.8,.2,1) both}
@media (min-width:1000px){.gv-rv-left{position:sticky;top:88px}}
.gv-rv-bar{display:flex;align-items:center;gap:10px;height:34px;padding:0 12px;background:#F4EFE3;border-bottom:1px solid #E6DECB}
.gv-rv-dots{display:flex;gap:5px}.gv-rv-dots i{width:9px;height:9px;border-radius:999px;background:#D9CFBA}
.gv-rv-url{flex:1;min-width:0;height:22px;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11.5px;font-weight:600;color:#5B4F43;overflow-wrap:anywhere}
.gv-rv-page{container-type:inline-size;background:#EDE7D8}
/* The miniature, in cqw so it scales with the column */
.gv-pv-hero{position:relative;aspect-ratio:16/6.4;background:#1B3828 center/cover no-repeat}
.gv-pv-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(12,22,16,0.88) 0%,rgba(12,22,16,0.35) 55%,rgba(12,22,16,0.05) 100%)}
.gv-pv-head{position:absolute;left:3.6cqw;right:3.6cqw;bottom:3cqw;z-index:1;display:flex;align-items:flex-end;gap:2.6cqw}
.gv-pv-logo{flex-shrink:0;width:14cqw;height:14cqw;border-radius:999px;background:#FFFFFF;box-shadow:0 0 0 0.6cqw rgba(255,255,255,0.9),0 1cqw 3cqw rgba(0,0,0,0.35);overflow:hidden;display:flex;align-items:center;justify-content:center}
.gv-pv-logo img{width:100%;height:100%;object-fit:contain}
.gv-pv-eyebrow{font-size:1.45cqw;font-weight:800;letter-spacing:0.06em;color:#EED98A;margin-bottom:0.6cqw}
.gv-pv-title{font-size:4.3cqw;font-weight:800;line-height:1.05;letter-spacing:-0.02em;color:#FFFFFF;overflow-wrap:normal}
.gv-pv-meta{display:flex;align-items:center;flex-wrap:wrap;gap:1cqw;margin-top:1cqw;font-size:1.6cqw;font-weight:600;color:rgba(255,255,255,0.88)}
.gv-pv-body{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:2.4cqw;padding:2.8cqw 3.6cqw 3.6cqw}
.gv-pv-col{display:flex;flex-direction:column;gap:2cqw;min-width:0}
.gv-pv-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.4cqw}
.gv-pv-tile{background:#FFFFFF;border-radius:1.6cqw;padding:1.4cqw 1.6cqw;box-shadow:0 0.3cqw 1.2cqw rgba(27,56,40,0.08)}
.gv-pv-tile b{display:block;font-size:1.15cqw;font-weight:800;letter-spacing:0.05em;color:#8A7B69}
.gv-pv-tile span{display:block;margin-top:0.3cqw;font-size:1.7cqw;font-weight:800;color:#1C1410}
.gv-pv-card{background:#FFFFFF;border-radius:1.8cqw;padding:2cqw 2.2cqw;box-shadow:0 0.3cqw 1.2cqw rgba(27,56,40,0.08)}
.gv-pv-card h4{margin:0 0 1cqw;font-size:2cqw;font-weight:800;color:#1C1410}
.gv-pv-about{margin:0;font-size:1.45cqw;line-height:1.55;color:#4A3F35;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.gv-pv-empty{font-size:1.45cqw;color:#9A8A78;font-style:italic}
.gv-pv-comms{display:flex;flex-wrap:wrap;gap:1.6cqw}
.gv-pv-comm{display:flex;flex-direction:column;align-items:center;gap:0.6cqw;width:9cqw;text-align:center;font-size:1.3cqw;font-weight:800;color:#1C1410;overflow-wrap:anywhere}
.gv-pv-socials{display:flex;gap:1cqw;margin-top:1.4cqw}
.gv-pv-soc{width:3.6cqw;height:3.6cqw;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#FFFFFF}
.gv-pv-soc svg{width:58%;height:58%}
.gv-pv-apply{background:linear-gradient(160deg,#1B3828,#264D37);border-radius:2cqw;padding:2.2cqw;display:flex;flex-direction:column;gap:1.1cqw;align-self:start}
.gv-pv-apply h4{margin:0 0 0.4cqw;font-size:1.9cqw;font-weight:800;color:#FFFFFF}
.gv-pv-role{display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border-radius:1.2cqw;padding:1.1cqw 1.3cqw;font-size:1.45cqw;font-weight:800;color:#1C1410}
.gv-pv-role i{width:2.6cqw;height:2.6cqw;border-radius:999px;background:#1B3828;color:#EED98A;display:flex;align-items:center;justify-content:center}
.gv-pv-role i svg{width:60%;height:60%}
/* Hovering an overview row lights the matching part of the preview */
.gv-pv-sec{transition:box-shadow 200ms ease,outline-color 200ms ease;outline:0.5cqw solid transparent;outline-offset:0.4cqw;border-radius:1.8cqw}
.gv-pv-sec.gv-hot{outline-color:#C9A227;box-shadow:0 0 0 1.4cqw rgba(238,217,138,0.55)}
/* The overview */
.gv-rv-list{background:#FFFFFF;border-radius:20px;box-shadow:0 1px 2px rgba(27,56,40,0.06),0 10px 28px rgba(27,56,40,0.10);padding:6px 0;animation:gv-rv-in 520ms 80ms cubic-bezier(.2,.8,.2,1) both}
.gv-rv-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;column-gap:12px;padding:11px 18px;transition:background-color 160ms ease}
.gv-rv-row + .gv-rv-row{box-shadow:inset 0 1px 0 #EFE8D8}
.gv-rv-row:hover{background:#FAF6EC}
.gv-rv-ico{color:#1C1410;display:flex}
.gv-rv-k{font-size:11.5px;font-weight:700;color:#8A7B69;margin-bottom:2px}
.gv-rv-v{font-size:14.5px;font-weight:700;color:#1C1410;line-height:1.35;overflow-wrap:anywhere}
.gv-rv-s{font-size:12.5px;font-weight:500;color:#5B4F43;line-height:1.45;margin-top:2px;overflow-wrap:anywhere}
.gv-rv-edit{font-family:inherit;font-size:12.5px;font-weight:700;color:#1C1410;text-decoration:underline;text-underline-offset:3px;background:none;border:0;padding:6px 4px;cursor:pointer;border-radius:6px}
.gv-rv-edit:focus{outline:none}.gv-rv-edit:focus-visible{box-shadow:0 0 0 2px #EED98A}
.gv-rv-thumbs{display:flex;align-items:center;gap:10px}
.gv-rv-logo{width:42px;height:42px;border-radius:999px;background:#FFFFFF;box-shadow:0 0 0 1px #E6DECB,0 3px 8px rgba(27,56,40,0.12);overflow:hidden;flex-shrink:0}
.gv-rv-logo img{width:100%;height:100%;object-fit:contain}
.gv-rv-banner{width:72px;height:40px;border-radius:9px;background:#1B3828 center/cover no-repeat;flex-shrink:0;box-shadow:0 3px 8px rgba(27,56,40,0.12)}
.gv-rv-stack{display:flex;align-items:center;margin-top:5px}
.gv-rv-stack > * + *{margin-left:-8px}
.gv-rv-chip{display:inline-flex;width:26px;height:26px;border-radius:999px;align-items:center;justify-content:center;color:#FFFFFF;box-shadow:0 0 0 2px #FFFFFF}
.gv-rv-chip svg{width:58%;height:58%}
.gv-rv-actions{margin-top:6px}
@keyframes gv-rv-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.gv-rv-frame,.gv-rv-list,.gv-rv-dot{animation:none}}
`;

const ROLES = ['Delegate', 'Head Delegate', 'Faculty Advisor', 'Observer', 'Chair'];

const SOCIAL_STYLE: Record<string, { bg: string }> = {
  instagram: { bg: 'radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)' },
  facebook: { bg: '#0866FF' },
  tiktok: { bg: '#000000' },
  whatsapp: { bg: '#25D366' },
};

function formatLabel(f: string): string {
  return f === 'in-person' ? 'In person' : f === 'online' ? 'Online' : f === 'hybrid' ? 'Hybrid' : 'Not set';
}
function levelLabel(l: string): string {
  return l === 'school' ? 'High school' : l === 'university' ? 'University' : l ? 'High school and university' : 'Not set';
}
function excerpt(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).replace(/[\s.,;:!?]+$/, '')}…`;
}

function SocialMark({ slug, className }: { slug: string; className: string }) {
  if (slug === 'website') {
    return <span className={className} style={{ background: '#1B3828' }}><Globe strokeWidth={2} /></span>;
  }
  const m = BRAND[slug];
  if (!m) return null;
  return (
    <span className={className} style={{ background: SOCIAL_STYLE[slug]?.bg ?? m.hex }}>
      <svg viewBox="0 0 24 24" fill="#FFFFFF"><path d={m.path} /></svg>
    </span>
  );
}

export default function ReviewStep(p: ReviewStepProps) {
  const [hot, setHot] = useState<Sec>(null);
  const code = UN_COUNTRIES.find((c) => c.name.toLowerCase() === p.country.trim().toLowerCase())?.code;
  const place = [p.city.trim(), p.country.trim()].filter(Boolean).join(', ');
  const when = p.datesTbd || !p.dateLabel ? 'Dates to be decided' : p.dateLabel;
  const links = (['instagram', 'tiktok', 'facebook', 'whatsapp', 'website'] as const).filter((k) => p.socials[k].trim());
  const intents = INTENT_OPTIONS.filter((o) => p.intentKeys.includes(o.key)).map((o) => o.label);
  const sec = (s: Exclude<Sec, null>) => `gv-pv-sec${hot === s ? ' gv-hot' : ''}`;
  const row = (s: Sec) => ({ onMouseEnter: () => setHot(s), onMouseLeave: () => setHot(null), onFocus: () => setHot(s), onBlur: () => setHot(null) });
  const acr = p.acronym.trim().toUpperCase();

  return (
    <>
      <style>{CSS}</style>
      <div className="gv-rv">
        {/* ── How the page will look ─────────────────────────────── */}
        <div className="gv-rv-left">
          <p className="gv-rv-cap"><span className="gv-rv-dot" aria-hidden />How your page will look</p>
          <div className="gv-rv-frame" aria-hidden>
            <div className="gv-rv-bar">
              <span className="gv-rv-dots"><i /><i /><i /></span>
              <span className="gv-rv-url">gavelling.com/conferences/{p.slug}</span>
            </div>
            <div className="gv-rv-page">
              <div className={`gv-pv-hero ${sec('conference')}`} style={{ borderRadius: 0, backgroundImage: p.bannerUrl ? `url("${p.bannerUrl}")` : undefined }}>
                <div className="gv-pv-head">
                  <span className="gv-pv-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.logoUrl && <img src={p.logoUrl} alt="" />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="gv-pv-eyebrow" style={{ display: 'block' }}>{acr}{p.year ? ` ${p.year}` : ''}</span>
                    <span className="gv-pv-title" style={{ display: 'block' }}>{p.fullName.trim() || 'Your conference'}</span>
                    <span className="gv-pv-meta">
                      {code && <CircleFlag code={code} country={p.country} size={14} decorative />}
                      <span className={sec('where')} style={{ borderRadius: 4 }}>{place || 'Somewhere'}</span>
                      <span aria-hidden>·</span>
                      <span className={sec('when')} style={{ borderRadius: 4 }}>{when}</span>
                    </span>
                  </span>
                </div>
              </div>
              <div className="gv-pv-body">
                <div className="gv-pv-col">
                  <div className="gv-pv-tiles">
                    <div className="gv-pv-tile"><b>FORMAT</b><span>{formatLabel(p.format)}</span></div>
                    <div className="gv-pv-tile"><b>LEVEL</b><span>{p.studentLevel === 'school' ? 'High school' : p.studentLevel === 'university' ? 'University' : 'Both'}</span></div>
                    <div className={`gv-pv-tile ${sec('delegates')}`}><b>DELEGATES</b><span>{p.expectedDelegates ? Number(p.expectedDelegates).toLocaleString('en-US') : 'Not set'}</span></div>
                  </div>
                  <div className={`gv-pv-card ${sec('about')}`}>
                    <h4>About the Conference</h4>
                    {p.description.trim()
                      ? <p className="gv-pv-about">{p.description.trim()}</p>
                      : <span className="gv-pv-empty">Your description goes here</span>}
                    {links.length > 0 && (
                      <div className={`gv-pv-socials ${sec('links')}`}>
                        {links.map((k) => <SocialMark key={k} slug={k} className="gv-pv-soc" />)}
                      </div>
                    )}
                  </div>
                  <div className={`gv-pv-card ${sec('committees')}`}>
                    <h4>Committees</h4>
                    <div className="gv-pv-comms">
                      {p.committees.slice(0, 6).map((c) => (
                        <span key={c.key} className="gv-pv-comm">
                          <span style={{ width: '6.4cqw', height: '6.4cqw', display: 'flex' }}>{p.renderEmblem(c, 64)}</span>
                          {(c.abbreviation || c.name).toUpperCase().slice(0, 14)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="gv-pv-apply">
                  <h4>Choose how you apply</h4>
                  {ROLES.map((r) => (
                    <span key={r} className="gv-pv-role">{r}<i><ArrowRight strokeWidth={2.6} /></i></span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── The brief overview ─────────────────────────────────── */}
        <div>
          <div className="gv-rv-list">
            <div className="gv-rv-row" {...row('conference')}>
              <span className="gv-rv-ico"><Landmark size={18} strokeWidth={1.6} /></span>
              <div className="gv-rv-thumbs" style={{ minWidth: 0 }}>
                <span className="gv-rv-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.logoUrl && <img src={p.logoUrl} alt="Logo" />}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="gv-rv-v" style={{ display: 'block' }}>{acr}</span>
                  <span className="gv-rv-s" style={{ display: 'block', marginTop: 0 }}>{p.fullName.trim()}</span>
                </span>
                <span className="gv-rv-banner" style={{ marginLeft: 'auto', backgroundImage: p.bannerUrl ? `url("${p.bannerUrl}")` : undefined }} aria-label="Banner" />
              </div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(1)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row('when')}>
              <span className="gv-rv-ico"><CalendarDays size={18} strokeWidth={1.6} /></span>
              <div><div className="gv-rv-k">Dates</div><div className="gv-rv-v">{when}</div></div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(1)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row('where')}>
              <span className="gv-rv-ico"><MapPin size={18} strokeWidth={1.6} /></span>
              <div>
                <div className="gv-rv-k">Where</div>
                <div className="gv-rv-v" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {code && <CircleFlag code={code} country={p.country} size={20} decorative />}
                  <span>{place}</span>
                </div>
                <div className="gv-rv-s">{formatLabel(p.format)} · {levelLabel(p.studentLevel)}</div>
              </div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(4)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row('delegates')}>
              <span className="gv-rv-ico"><Users size={18} strokeWidth={1.6} /></span>
              <div><div className="gv-rv-k">Expected delegates</div><div className="gv-rv-v">{p.expectedDelegates ? Number(p.expectedDelegates).toLocaleString('en-US') : 'Not set'}</div></div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(5)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row('committees')}>
              <span className="gv-rv-ico"><LayoutGrid size={18} strokeWidth={1.6} /></span>
              <div>
                <div className="gv-rv-k">{p.committees.length === 1 ? '1 committee' : `${p.committees.length} committees`}{p.chairsToInvite > 0 ? `, ${p.chairsToInvite} ${p.chairsToInvite === 1 ? 'chair' : 'chairs'} to invite` : ''}</div>
                <div className="gv-rv-stack">
                  {p.committees.slice(0, 6).map((c) => (
                    <span key={c.key} style={{ display: 'inline-flex', borderRadius: 999, boxShadow: '0 0 0 2px #FFFFFF' }}>{p.renderEmblem(c, 28)}</span>
                  ))}
                </div>
                <div className="gv-rv-s">{p.committees.map((c) => committeeDisplayName(c.name, c.abbreviation)).join(', ')}</div>
              </div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(6)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row('about')}>
              <span className="gv-rv-ico"><FileText size={18} strokeWidth={1.6} /></span>
              <div><div className="gv-rv-k">Description</div><div className="gv-rv-s" style={{ marginTop: 0 }}>{p.description.trim() ? excerpt(p.description, 150) : 'Not added'}</div></div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(7)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row('links')}>
              <span className="gv-rv-ico"><Link2 size={18} strokeWidth={1.6} /></span>
              <div>
                <div className="gv-rv-k">Links</div>
                {links.length
                  ? <div className="gv-rv-stack">{links.map((k) => <SocialMark key={k} slug={k} className="gv-rv-chip" />)}</div>
                  : <div className="gv-rv-s" style={{ marginTop: 0 }}>Not added</div>}
              </div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(7)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row(null)}>
              <span className="gv-rv-ico"><Banknote size={18} strokeWidth={1.6} /></span>
              <div><div className="gv-rv-k">Delegate payments</div><div className="gv-rv-v">{p.paymentSummary}</div></div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(8)}>Edit</button>
            </div>

            <div className="gv-rv-row" {...row(null)}>
              <span className="gv-rv-ico"><Sparkles size={18} strokeWidth={1.6} /></span>
              <div><div className="gv-rv-k">Using Gavelling for</div><div className="gv-rv-s" style={{ marginTop: 0 }}>{intents.length ? intents.join(', ') : 'Not answered'}</div></div>
              <button type="button" className="gv-rv-edit" onClick={() => p.onEdit(9)}>Edit</button>
            </div>
          </div>

          <div className="gv-rv-actions">{p.actions}</div>
        </div>
      </div>
    </>
  );
}
