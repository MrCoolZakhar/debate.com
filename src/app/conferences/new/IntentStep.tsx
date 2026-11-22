'use client';

// Step 9 of the creation wizard, "What will you use Gavelling for?" (owner, 22 Nov 2026:
// "slightly more interactive and always fitting on the entire page").
//
// Six compact cards that always fit one screen with the Continue button: three across from
// 720 px, two across on a phone, sizes stepped by the window's HEIGHT as well as its width, and
// the one-line descriptions folded away on a phone. The 3D icons stay (owner, 22 Nov 2026: "the
// 3d icons were better"), and Running Committees shows the product instead: the chair console
// laptop with the delegate phone over its side (public/sessions/hero-*.webp), from 720 px; a phone
// card is too narrow for it and keeps the 3D icon. Interactive: the cards rise in one after
// another, lift on hover, press in, and a picked card fills, its picture pops and a check lands.
// Real marks where they say more (owner, 22 Nov 2026): Applications is a Google Form crossed out,
// Payments carries the payment apps of Gavelling's biggest countries along its foot (India first:
// UPI, Paytm, PhonePe, Google Pay; Brazil's Pix; then PayPal, Apple Pay, Revolut, Visa,
// Mastercard; brandMarks.ts, Simple Icons, CC0), Marketing a stack of social apps; the stacks fan
// out on hover. On a phone only the crossed-out form stays; the rest keep their 3D icons.
// Everything is CSS on the cards; reduced motion keeps the colours and drops the movement.
//
// The choices themselves are unchanged: INTENT_OPTIONS (src/lib/conferenceIntent.ts) is still
// the only list, and the parent owns the picked keys.

import { Check, ClipboardList, CreditCard, Landmark, Mail, Globe, Megaphone, type LucideIcon } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { INTENT_OPTIONS } from '@/lib/conferenceIntent';
import { BRAND } from './brandMarks';

/** Drawn only if a 3D icon fails to load. */
const FALLBACK_ICONS: Record<string, LucideIcon> = {
  applications: ClipboardList,
  payments: CreditCard,
  committees: Landmark,
  emails: Mail,
  chairs: Globe,
  marketing: Megaphone,
};

const CSS = `
.gv-int-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(8px,1.8vh,18px);width:100%}
@media (min-width:720px){.gv-int-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.gv-int-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:clamp(4px,1.1vh,10px);text-align:left;
  padding:clamp(12px,2.6vh,30px) clamp(12px,1.7vw,24px);border-radius:20px;border:1.5px solid transparent;cursor:pointer;
  background:#FFFFFF;color:#1C1410;font-family:inherit;
  box-shadow:0 1px 2px rgba(27,56,40,0.06),0 8px 22px rgba(27,56,40,0.08);
  transition:transform 200ms cubic-bezier(.2,.8,.2,1),box-shadow 200ms ease,background-color 200ms ease,border-color 200ms ease;
  animation:gv-int-rise 420ms cubic-bezier(.2,.8,.2,1) both}
.gv-int-card:focus{outline:none}
.gv-int-card:focus-visible{box-shadow:0 0 0 3px #EED98A,0 8px 22px rgba(27,56,40,0.10)}
@media (hover:hover){.gv-int-card:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(27,56,40,0.07),0 14px 30px rgba(27,56,40,0.13)}}
.gv-int-card:active{transform:scale(0.97)}
.gv-int-card[aria-checked="true"]{background:#F7F1DF;border-color:#1B3828;box-shadow:0 2px 4px rgba(27,56,40,0.08),0 12px 28px rgba(27,56,40,0.14)}
.gv-int-ico{position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center;width:clamp(38px,7vh,64px);height:clamp(38px,7vh,64px);color:#1B3828;transition:transform 260ms cubic-bezier(.3,1.6,.5,1)}
.gv-int-ico img,.gv-int-ico svg{width:100%;height:100%}
.gv-int-card[aria-checked="true"] .gv-int-ico{transform:scale(1.1) rotate(-5deg)}
.gv-int-card[aria-checked="true"] .gv-int-devices{transform:scale(1.06)}
/* Running Committees: the chair console with the delegate phone over its right side. */
.gv-int-devices{position:relative;flex-shrink:0;height:clamp(44px,8.6vh,84px);aspect-ratio:1.95;margin-top:calc(-1 * clamp(2px,0.8vh,8px));transition:transform 260ms cubic-bezier(.3,1.6,.5,1);transform-origin:30% 60%}
.gv-int-devices img{position:absolute;display:block;filter:drop-shadow(0 3px 6px rgba(27,56,40,0.22))}
.gv-int-devices .gv-int-laptop{left:0;top:0;height:100%;width:auto}
.gv-int-devices .gv-int-phone{right:0;bottom:-8%;height:112%;width:auto}
.gv-int-rich + .gv-int-ico{display:none}
/* Applications: a Google Form, crossed out. */
.gv-int-forms{position:relative;display:flex;width:100%;height:100%;align-items:center;justify-content:center}
.gv-int-forms svg.gv-int-formglyph{width:78%;height:78%;filter:drop-shadow(0 3px 5px rgba(114,72,185,0.30))}
.gv-int-forms svg.gv-int-cross{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
/* Stacks of brand discs: Marketing's socials up top, Payments' apps along the foot. */
.gv-int-stack{display:flex;align-items:center}
.gv-int-disc{display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:999px;background:#FFFFFF;
  box-shadow:0 0 0 2px #FFFFFF,0 2px 6px rgba(27,56,40,0.18);transition:margin 260ms cubic-bezier(.2,.8,.2,1),transform 260ms cubic-bezier(.3,1.6,.5,1)}
.gv-int-card[aria-checked="true"] .gv-int-disc{box-shadow:0 0 0 2px #F7F1DF,0 2px 6px rgba(27,56,40,0.18)}
.gv-int-disc svg{width:58%;height:58%}
.gv-int-socials{height:clamp(38px,7vh,64px)}
.gv-int-socials .gv-int-disc{width:clamp(32px,5.6vh,50px);height:clamp(32px,5.6vh,50px)}
.gv-int-socials .gv-int-disc + .gv-int-disc{margin-left:calc(-1 * clamp(9px,1.6vh,14px))}
.gv-int-logos{margin-top:auto;padding-top:clamp(2px,0.6vh,6px)}
.gv-int-logos .gv-int-disc{width:clamp(22px,3.5vh,31px);height:clamp(22px,3.5vh,31px)}
.gv-int-logos .gv-int-disc svg{width:66%;height:66%}
.gv-int-logos .gv-int-disc + .gv-int-disc{margin-left:-6px}
.gv-int-upi{font-size:clamp(7px,1.1vh,9.5px);font-weight:900;font-style:italic;letter-spacing:-0.02em;line-height:1}
@media (hover:hover){
  .gv-int-card:hover .gv-int-socials .gv-int-disc + .gv-int-disc{margin-left:4px}
  .gv-int-card:hover .gv-int-logos .gv-int-disc + .gv-int-disc{margin-left:3px}
  .gv-int-card:hover .gv-int-disc:hover{transform:translateY(-3px) scale(1.08)}
}
.gv-int-card[aria-checked="true"] .gv-int-socials{transform:scale(1.06)}
.gv-int-badge{display:none}
.gv-int-label{font-size:clamp(14px,2.2vh,19px);font-weight:800;line-height:1.25;letter-spacing:-0.01em;overflow-wrap:normal;word-break:normal;hyphens:manual}
.gv-int-sub{font-size:clamp(12px,1.75vh,15px);font-weight:500;line-height:1.45;color:#5B4F43}
.gv-int-check{position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  background:#1B3828;color:#EED98A;transform:scale(0);opacity:0;transition:transform 260ms cubic-bezier(.3,1.6,.5,1),opacity 160ms ease}
.gv-int-card[aria-checked="true"] .gv-int-check{transform:scale(1);opacity:1}
/* Phones: icon beside the name, two across, so six cards, Select all and Continue fit above the
   tab bar; the one-liners fold away on every phone. */
@media (max-width:719px){
  .gv-int-card{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:9px;row-gap:4px;padding:9px 10px;border-radius:16px}
  .gv-int-ico{width:34px;height:34px}
  /* Too narrow for the devices, the socials and the payment row: the 3D icon instead. */
  .gv-int-rich,.gv-int-logos{display:none}
  .gv-int-rich + .gv-int-ico{display:flex}
  .gv-int-label{font-size:13.5px}
  .gv-int-sub{grid-column:1 / -1}
  /* No corner check on a phone (it ate the name's width): a small one sits on the icon. */
  .gv-int-check{display:none}
  .gv-int-badge{display:flex;position:absolute;right:-4px;bottom:-3px;width:16px;height:16px;border-radius:999px;align-items:center;justify-content:center;
    background:#1B3828;color:#EED98A;transform:scale(0);transition:transform 260ms cubic-bezier(.3,1.6,.5,1)}
  .gv-int-card[aria-checked="true"] .gv-int-badge{transform:scale(1)}
}
@media (max-width:719px){.gv-int-sub{display:none}}
@media (max-height:760px){.gv-int-sub{display:none}}
@keyframes gv-int-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  .gv-int-card,.gv-int-ico,.gv-int-devices,.gv-int-socials,.gv-int-disc,.gv-int-check,.gv-int-badge{transition:none;animation:none}
  .gv-int-card:hover,.gv-int-card:active{transform:none}
  .gv-int-card[aria-checked="true"] .gv-int-ico,.gv-int-card[aria-checked="true"] .gv-int-devices{transform:none}
}
`;

/** India first (most of Gavelling's conferences and applicants), then Brazil, then the apps
 *  people pay with everywhere. UPI is drawn as its wordmark in the row itself. */
const PAYMENT_APPS = ['paytm', 'phonepe', 'googlepay', 'pix', 'paypal', 'applepay', 'revolut', 'visa', 'mastercard'];

/** App-icon style: the brand's own colour as the disc, the mark in white. */
const SOCIALS: { slug: string; bg: string; fg: string }[] = [
  { slug: 'instagram', bg: 'radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)', fg: '#FFFFFF' },
  { slug: 'tiktok', bg: '#000000', fg: '#FFFFFF' },
  { slug: 'youtube', bg: '#FF0000', fg: '#FFFFFF' },
  { slug: 'whatsapp', bg: '#25D366', fg: '#FFFFFF' },
  { slug: 'facebook', bg: '#0866FF', fg: '#FFFFFF' },
];

function BrandDisc({ slug, bg, fg }: { slug: string; bg?: string; fg?: string }) {
  const m = BRAND[slug];
  if (!m) return null;
  return (
    <span className="gv-int-disc" style={bg ? { background: bg } : undefined}>
      <svg viewBox="0 0 24 24" fill={fg ?? m.hex}><path d={m.path} /></svg>
    </span>
  );
}

export default function IntentStep({ value, onToggle }: {
  value: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <>
      <style>{CSS}</style>
      <div className="gv-int-grid" role="group" aria-label="What you will use Gavelling for">
        {INTENT_OPTIONS.map((o, i) => {
          const on = value.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(o.key)}
              className="gv-int-card"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span className="gv-int-check" aria-hidden><Check size={14} strokeWidth={3} /></span>
              {o.key === 'committees' && (
                <span className="gv-int-devices gv-int-rich" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="gv-int-laptop" src="/sessions/hero-laptop.webp" alt="" draggable={false} decoding="async" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="gv-int-phone" src="/sessions/hero-phone.webp" alt="" draggable={false} decoding="async" />
                </span>
              )}
              {o.key === 'marketing' && (
                <span className="gv-int-stack gv-int-socials gv-int-rich" aria-hidden>
                  {SOCIALS.map((m) => <BrandDisc key={m.slug} {...m} />)}
                </span>
              )}
              <span className="gv-int-ico" aria-hidden>
                {o.key === 'applications' ? (
                  <span className="gv-int-forms">
                    <svg className="gv-int-formglyph" viewBox="0 0 24 24" fill={BRAND.googleforms.hex}><path d={BRAND.googleforms.path} /></svg>
                    <svg className="gv-int-cross" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
                      <path d="M4.5 4.5 19.5 19.5M19.5 4.5 4.5 19.5" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M4.5 4.5 19.5 19.5M19.5 4.5 4.5 19.5" stroke="#D93025" strokeWidth="2.8" />
                    </svg>
                  </span>
                ) : (
                  <Emoji3D name={o.emoji} size={64} fallback={FALLBACK_ICONS[o.key]} fallbackColor="#1B3828" style={{ width: '100%', height: '100%' }} />
                )}
                <span className="gv-int-badge"><Check size={10} strokeWidth={3.2} /></span>
              </span>
              <span className="gv-int-label">{o.label}</span>
              <span className="gv-int-sub">{o.sub}</span>
              {o.key === 'payments' && (
                <span className="gv-int-stack gv-int-logos" aria-hidden>
                  <span className="gv-int-disc"><span className="gv-int-upi"><span style={{ color: '#097939' }}>U</span><span style={{ color: '#ED752E' }}>PI</span></span></span>
                  {PAYMENT_APPS.map((slug) => <BrandDisc key={slug} slug={slug} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
