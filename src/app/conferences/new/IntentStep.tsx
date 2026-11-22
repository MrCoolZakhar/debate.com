'use client';

// Step 9 of the creation wizard, "What will you use Gavelling for?" (owner, 22 Nov 2026:
// "slightly more interactive and always fitting on the entire page").
//
// Six compact cards that always fit one screen with the Continue button: three across from
// 720 px, two across on a phone, sizes stepped by the window's HEIGHT as well as its width, and
// the one-line descriptions folded away on a short phone. Style A icons (fine line, bare ink),
// no Fluent emoji. Interactive: the cards rise in one after another, lift on hover, press in,
// and a picked card fills, its icon pops and a check lands in the corner. Everything is CSS on
// the cards; reduced motion keeps the colours and drops the movement.
//
// The choices themselves are unchanged: INTENT_OPTIONS (src/lib/conferenceIntent.ts) is still
// the only list, and the parent owns the picked keys.

import { Check, ClipboardList, CreditCard, Landmark, Mail, Gavel, Megaphone, type LucideIcon } from 'lucide-react';
import { INTENT_OPTIONS } from '@/lib/conferenceIntent';

const ICONS: Record<string, LucideIcon> = {
  applications: ClipboardList,
  payments: CreditCard,
  committees: Landmark,
  emails: Mail,
  chairs: Gavel,
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
.gv-int-ico{display:flex;align-items:center;justify-content:center;width:clamp(34px,6.4vh,58px);height:clamp(34px,6.4vh,58px);border-radius:999px;color:#1C1410;transition:color 200ms ease,transform 260ms cubic-bezier(.3,1.6,.5,1)}
.gv-int-ico svg{width:clamp(22px,4vh,36px);height:clamp(22px,4vh,36px)}
.gv-int-card[aria-checked="true"] .gv-int-ico{color:#1B3828;transform:scale(1.12) rotate(-6deg)}
.gv-int-label{font-size:clamp(14px,2.2vh,19px);font-weight:800;line-height:1.25;letter-spacing:-0.01em;overflow-wrap:normal;word-break:normal;hyphens:manual}
.gv-int-sub{font-size:clamp(12px,1.75vh,15px);font-weight:500;line-height:1.45;color:#5B4F43}
.gv-int-check{position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  background:#1B3828;color:#EED98A;transform:scale(0);opacity:0;transition:transform 260ms cubic-bezier(.3,1.6,.5,1),opacity 160ms ease}
.gv-int-card[aria-checked="true"] .gv-int-check{transform:scale(1);opacity:1}
/* Phones: icon beside the name, two across, so six cards, Select all and Continue fit above the
   tab bar; the one-liners fold away on every phone. */
@media (max-width:719px){
  .gv-int-card{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:9px;row-gap:4px;padding:9px 10px;border-radius:16px}
  .gv-int-ico{width:32px;height:32px;transition:color 200ms ease,background-color 200ms ease,transform 260ms cubic-bezier(.3,1.6,.5,1)}
  .gv-int-ico svg{width:20px;height:20px}
  .gv-int-label{font-size:13.5px}
  .gv-int-sub{grid-column:1 / -1}
  /* No corner check on a phone (it ate the name's width): the icon disc fills instead. */
  .gv-int-check{display:none}
  .gv-int-card[aria-checked="true"] .gv-int-ico{background:#1B3828;color:#EED98A;transform:scale(1.06)}
}
@media (max-width:719px){.gv-int-sub{display:none}}
@media (max-height:600px){.gv-int-sub{display:none}}
@keyframes gv-int-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  .gv-int-card,.gv-int-ico,.gv-int-check{transition:none;animation:none}
  .gv-int-card:hover,.gv-int-card:active{transform:none}
  .gv-int-card[aria-checked="true"] .gv-int-ico{transform:none}
}
`;

export default function IntentStep({ value, onToggle }: {
  value: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <>
      <style>{CSS}</style>
      <div className="gv-int-grid" role="group" aria-label="What you will use Gavelling for">
        {INTENT_OPTIONS.map((o, i) => {
          const Icon = ICONS[o.key] ?? ClipboardList;
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
              <span className="gv-int-ico" aria-hidden><Icon strokeWidth={1.5} /></span>
              <span className="gv-int-label">{o.label}</span>
              <span className="gv-int-sub">{o.sub}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
