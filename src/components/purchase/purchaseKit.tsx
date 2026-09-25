'use client';

// ── Visual kit for the Credits and Unlimited pop-ups ─────────────────────────
//
// The login pop-up's language (src/components/auth/authModalKit.tsx): the 24px
// panel radius, 12px field radii, the phone sheet. Two grounds only: CREAM
// (#F6F3EC, ink type) and FOREST (#1B3828, white and gold type).
//
//   Credits    LEFT cream (what they are for, the balance)  RIGHT forest (the purchase)
//   Unlimited  LEFT deep forest                              RIGHT forest
//
// Anything inside an element carrying `gv-buy-dark` takes the forest styles,
// so one set of rules serves the Unlimited panel and the Credits right column.
// The pay control on both is the GoldButton: gold fill, ink, UPPERCASE.
//
// From 860px the panel is two columns; below that one column; on a phone
// (≤743px) a full-height sheet with safe-area padding and dvh heights so the
// card form is never under the keyboard.
//
// Icons are Microsoft Fluent 3D emoji through Emoji3D, each with a lucide
// fallback. Titles end in a GoldWord (the site's title signature).

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { OUTFIT } from '@/components/auth/authModalKit';
import { GOLD_CTA_BG, GOLD_CTA_BG_HOVER, GOLD_CTA_INK, GOLD_CTA_SHADOW, GOLD_CTA_SHADOW_HOVER } from '@/components/GoldButton';

export type Tone = 'light' | 'dark';

export const FOREST = '#1B3828';
export const FOREST_DEEP = '#14301F';
/**
 * The ground around Stripe's form on the Credits pop-up. The owner sets the
 * Stripe Dashboard brand colour to this same value so the card form and the
 * panel read as one surface; change it here and in the Stripe Dashboard
 * together, nowhere else.
 */
export const PANEL_GREEN = '#0F3A28';
export const CREAM = '#F6F3EC';
export const IVORY = '#FAF8F3';
export const INK = '#1C1410';
export const INK_SOFT = '#5A5046';
export const DARK_INK = '#F4F1E8';
export const DARK_SOFT = 'rgba(244,241,232,0.72)';
export const GOLD = '#EED98A';
export const GOLD_HOVER = '#F5E6A8';
export const DEEP_GOLD = '#B6871F';
const HAIR_LIGHT = 'rgba(28,20,16,0.12)';
const HAIR_DARK = 'rgba(255,255,255,0.14)';
const LINE_DARK = 'rgba(255,255,255,0.22)';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

/** The dialog: backdrop, panel, close. `label` is its accessible name. */
export function PurchaseShell({
  tone, label, onClose, children, testId,
}: { tone: Tone; label: string; onClose: () => void; children: React.ReactNode; testId?: string }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useModalEscape(onClose, true);
  useScrollLock(true);
  useEffect(() => {
    // Focus lands on the panel, so Tab starts inside the dialog and Escape
    // has somewhere to fire from.
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="gv-buy-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`gv-buy-panel${tone === 'dark' ? ' gv-buy-dark' : ''}`}
        data-tone={tone}
        data-testid={testId}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="gv-buy-x">
          <X size={18} strokeWidth={2.2} />
        </button>
        <div className="gv-buy-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * "Gavelling <Word>" on one line, the word in gold (Playfair italic), with an
 * optional picture beside it (the Gavelling mark, the Infinity emoji).
 */
export function BrandTitle({ word, tone, icon, sub }: {
  word: string; tone: Tone; icon?: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="gv-buy-title">
        {icon ? <span className="gv-buy-title-icon" aria-hidden>{icon}</span> : null}
        <span className="gv-buy-title-text">Gavelling <GoldWord tone={tone}>{word}</GoldWord></span>
      </h2>
      {sub ? <p className="gv-buy-sub">{sub}</p> : null}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="gv-buy-eyebrow">{children}</p>;
}

export interface Benefit {
  /** Fluent 3D emoji folder name, e.g. "Ticket". */
  emoji: string;
  fallback: LucideIcon;
  title: string;
  note?: string;
  /** Live today, or coming soon. */
  live: boolean;
}

export function BenefitList({ items, tone }: { items: Benefit[]; tone: Tone }) {
  return (
    <ul className="gv-buy-benefits">
      {items.map((b) => (
        <li key={b.title} className="gv-buy-benefit">
          <span className="gv-buy-benefit-disc" aria-hidden>
            <Emoji3D name={b.emoji} size={24} fallback={b.fallback} fallbackColor={tone === 'dark' ? GOLD : FOREST} />
          </span>
          <span className="gv-buy-benefit-text">
            {b.title}
            {b.note ? <span className="gv-buy-benefit-note">{b.note}</span> : null}
          </span>
          <span className={`gv-buy-tag ${b.live ? 'gv-buy-tag-live' : 'gv-buy-tag-soon'}`}>{b.live ? 'Live' : 'Soon'}</span>
        </li>
      ))}
    </ul>
  );
}

/** The link line that swaps to the other pop-up: bold and underlined, always. */
export function SwapLine({ lead, action, onClick }: { lead: string; action: string; onClick: () => void }) {
  return (
    <p className="gv-buy-swap">
      {lead}{' '}
      <button type="button" onClick={onClick} className="gv-buy-swapbtn">{action}</button>
    </p>
  );
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="gv-buy-err">{children}</p>;
}

/**
 * THE pay control on both pop-ups: full width, 54px, gold fill, ink type,
 * UPPERCASE with tabular numerals. Give it uppercase children ("PAY $21.25").
 */
export function GoldButton({ children, onClick, busy, busyText, disabled, testId }: {
  children: React.ReactNode; onClick: () => void; busy?: boolean; busyText?: string; disabled?: boolean; testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className="gv-buy-gold"
      data-testid={testId}
    >
      {busy ? busyText ?? 'ONE MOMENT…' : children}
    </button>
  );
}

export const PURCHASE_CSS = `
.gv-buy-backdrop{position:fixed;inset:0;z-index:9090;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(0,0,0,0.5);animation:gvBuyFade 200ms ease;font-family:${OUTFIT};color:${INK}}
.gv-buy-panel{position:relative;width:100%;max-width:520px;max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:${CREAM};border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,0.55);overflow:hidden;animation:gvBuyRise 360ms cubic-bezier(0.2,0.8,0.2,1);outline:none}
.gv-buy-panel.gv-buy-dark{background:${FOREST};color:${DARK_INK}}

/* Focus rings: forest on the light ground, gold on the forest ground. */
.gv-buy-panel :is(button,input,a):focus{outline:none}
.gv-buy-panel :is(button,input,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-buy-dark :is(button,input,a):focus-visible{outline:2px solid ${GOLD};outline-offset:2px}

/* The X is an ivory disc with a soft shadow, so it reads on cream AND on forest. */
.gv-buy-x{position:absolute;top:14px;right:14px;z-index:5;width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;border:none;background:${IVORY};color:${INK};cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.18),0 0 0 1px rgba(28,20,16,0.06);transition:background-color 160ms ease}
.gv-buy-x:hover{background:#FFFFFF}
.gv-buy-body{overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;min-height:0}
.gv-buy-left{padding:30px 28px 26px;background:${CREAM};display:flex;flex-direction:column;gap:22px}
.gv-buy-dark .gv-buy-left{background:${FOREST_DEEP}}
.gv-buy-right{padding:30px 28px 26px;display:flex;flex-direction:column;gap:14px;background:${CREAM}}
.gv-buy-dark .gv-buy-right{background:${FOREST};color:${DARK_INK}}
/* The Credits right column (the Stripe side) is PANEL_GREEN, matching the Stripe brand colour. */
.gv-buy-right.gv-buy-dark{background:${PANEL_GREEN};color:${DARK_INK}}

/* Title: "Gavelling Word", the word in gold Playfair italic, a picture beside it. */
.gv-buy-title{margin:0;display:flex;align-items:center;gap:10px;font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1.08;color:${INK}}
.gv-buy-dark .gv-buy-title{color:${DARK_INK}}
.gv-buy-title-text{min-width:0}
.gv-buy-title-icon{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}
.gv-buy-mark{display:block;width:26px;height:26px;object-fit:contain}
.gv-buy-sub{margin:10px 0 0;font-size:15px;line-height:1.5;color:${INK_SOFT};text-wrap:pretty}
.gv-buy-dark .gv-buy-sub{color:${DARK_SOFT}}
.gv-buy-eyebrow{margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT}}
.gv-buy-dark .gv-buy-eyebrow{color:${DARK_SOFT}}
.gv-buy-rtitle{margin:0;font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${INK}}
.gv-buy-dark .gv-buy-rtitle{color:${DARK_INK}}

/* Benefits */
.gv-buy-benefits{display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none}
.gv-buy-benefit{display:flex;align-items:center;gap:12px}
.gv-buy-benefit-disc{width:42px;height:42px;border-radius:12px;background:${IVORY};border:1px solid ${HAIR_LIGHT};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.gv-buy-dark .gv-buy-benefit-disc{background:rgba(255,255,255,0.08);border-color:${HAIR_DARK}}
.gv-buy-benefit-text{flex:1;min-width:0;font-size:15px;font-weight:600;line-height:1.3;color:${INK}}
.gv-buy-dark .gv-buy-benefit-text{color:${DARK_INK}}
.gv-buy-benefit-note{display:block;margin-top:2px;font-size:12.5px;font-weight:400;line-height:1.4;color:${INK_SOFT}}
.gv-buy-dark .gv-buy-benefit-note{color:${DARK_SOFT}}
.gv-buy-tag{flex-shrink:0;font-size:10.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
.gv-buy-tag-live{background:rgba(27,56,40,0.1);color:${FOREST}}
.gv-buy-tag-soon{background:rgba(28,20,16,0.07);color:${INK_SOFT}}
.gv-buy-dark .gv-buy-tag-live{background:rgba(238,217,138,0.2);color:${GOLD}}
.gv-buy-dark .gv-buy-tag-soon{background:rgba(255,255,255,0.08);color:${DARK_SOFT}}

/* Your credits: now -> after, two big tabular numbers */
.gv-buy-balance{margin-top:auto;padding-top:18px;border-top:1px solid ${HAIR_LIGHT}}
.gv-buy-balance-row{display:flex;align-items:flex-start;gap:16px}
.gv-buy-balance-cell{display:flex;flex-direction:column;gap:6px;min-width:0}
.gv-buy-balance-big{font-size:46px;font-weight:800;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;color:${INK}}
.gv-buy-balance-big.gv-buy-after{color:${FOREST}}
.gv-buy-balance-cap{font-size:12.5px;font-weight:600;color:${INK_SOFT};line-height:1.3}
.gv-buy-balance-arrow{flex-shrink:0;margin-top:11px;color:${FOREST}}

/* Bundle chips on forest: white outlines, gold when chosen */
.gv-buy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.gv-buy-chip{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:94px;padding:14px 12px 12px;border:1px solid ${LINE_DARK};border-radius:14px;background:transparent;cursor:pointer;text-align:left;font-family:${OUTFIT};color:${DARK_INK};transition:border-color 140ms ease,box-shadow 140ms ease,background-color 140ms ease,transform 120ms ease}
.gv-buy-chip:hover{border-color:rgba(255,255,255,0.5)}
.gv-buy-chip:active{transform:scale(0.985)}
.gv-buy-chip[aria-checked="true"]{border-color:${GOLD};box-shadow:inset 0 0 0 1.5px ${GOLD};background:rgba(238,217,138,0.12)}
.gv-buy-chip-qty{font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;color:#FFFFFF}
.gv-buy-chip-unit{font-size:11.5px;font-weight:600;color:${DARK_SOFT}}
.gv-buy-chip-price{margin-top:auto;padding-top:6px;font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;color:${DARK_INK}}
.gv-buy-save{position:absolute;top:-9px;right:10px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;padding:3px 8px;border-radius:999px;background:${GOLD};color:${INK};box-shadow:0 2px 6px rgba(0,0,0,0.25)}

/* Another amount: the stepper */
.gv-buy-stepper{display:flex;align-items:center;gap:8px;margin-top:6px}
.gv-buy-step{width:36px;height:36px;border-radius:999px;border:1px solid ${LINE_DARK};background:transparent;color:${DARK_INK};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color 140ms ease,background-color 140ms ease}
.gv-buy-step:hover:not(:disabled){border-color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.06)}
.gv-buy-step:disabled{opacity:0.4;cursor:default}
.gv-buy-stepin{width:74px;height:36px;border:1px solid ${LINE_DARK};border-radius:8px;background:rgba(0,0,0,0.2);text-align:center;font-family:${OUTFIT};font-size:16px;font-weight:700;color:#FFFFFF;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gv-buy-stepin::-webkit-outer-spin-button,.gv-buy-stepin::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gv-buy-stepin:focus{border-color:${GOLD};box-shadow:inset 0 0 0 1px ${GOLD}}

/* Total */
.gv-buy-total{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 0 2px;border-top:1px solid ${HAIR_DARK};margin-top:4px}
.gv-buy-total-label{font-size:13px;font-weight:600;color:${DARK_SOFT}}
.gv-buy-total-amount{font-size:32px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;color:#FFFFFF}
.gv-buy-total-saving{margin-top:3px;font-size:13px;font-weight:700;color:${GOLD}}

/* The nudge: a small gold flag that is a button */
.gv-buy-nudge{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:6px 12px 6px 10px;border:none;border-radius:8px;background:${GOLD};color:${INK};font-family:${OUTFIT};font-size:13px;font-weight:700;line-height:1.2;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.22);transition:background-color 140ms ease,transform 120ms ease}
.gv-buy-nudge:hover{background:${GOLD_HOVER}}
.gv-buy-nudge:active{transform:scale(0.985)}
.gv-buy-nudge b{font-weight:800;font-variant-numeric:tabular-nums}

/* Small print, swap line, errors */
.gv-buy-fine{margin:2px 0 0;font-size:12.5px;line-height:1.5;color:${INK_SOFT};text-align:center}
.gv-buy-dark .gv-buy-fine{color:${DARK_SOFT}}
.gv-buy-swap{margin:0;font-size:13.5px;line-height:1.5;color:${INK_SOFT};text-align:center}
.gv-buy-dark .gv-buy-swap{color:${DARK_SOFT}}
.gv-buy-swapbtn{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:13.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-buy-dark .gv-buy-swapbtn{color:${GOLD}}
.gv-buy-err{margin:0;font-size:13.5px;line-height:1.45;color:#9E2A12}
.gv-buy-dark .gv-buy-err{color:#FFB4A2}

/* Stripe's white form sits on PANEL_GREEN, the same colour the Stripe
   Dashboard branding is set to, so nothing around the form is a different
   green: the well is the panel colour with no darkening overlay. The form's
   own colours come from the Stripe Dashboard branding, not from us. */
.gv-buy-formwell{padding:8px;border-radius:20px;background:${PANEL_GREEN};box-shadow:none}
.gv-buy-form{border-radius:14px;padding:6px;background:#FFFFFF;min-height:340px}
.gv-buy-stripe{min-height:320px}
.gv-buy-change{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid ${HAIR_LIGHT};border-radius:12px;background:${IVORY};font-size:14px;color:${INK}}
.gv-buy-dark .gv-buy-change{background:${PANEL_GREEN};border-color:${HAIR_DARK};color:${DARK_INK}}
.gv-buy-change strong{font-weight:700}
.gv-buy-changebtn{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:13.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;cursor:pointer;white-space:nowrap}
.gv-buy-dark .gv-buy-changebtn{color:${GOLD}}

/* THE pay button: the one gold CTA (src/components/GoldButton.tsx), full width. */
.gv-buy-gold{width:100%;min-height:54px;padding:0 20px;border:none;border-radius:12px;cursor:pointer;color:${GOLD_CTA_INK};font-family:${OUTFIT};font-size:15.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-variant-numeric:tabular-nums;background:${GOLD_CTA_BG};box-shadow:${GOLD_CTA_SHADOW};transition:transform 120ms ease,box-shadow 160ms ease,background 160ms ease,opacity 160ms ease}
.gv-buy-gold:hover:not(:disabled){background:${GOLD_CTA_BG_HOVER};box-shadow:${GOLD_CTA_SHADOW_HOVER};transform:translateY(-1px)}
.gv-buy-gold:active:not(:disabled){transform:translateY(0) scale(0.985)}
.gv-buy-gold:disabled{cursor:default;opacity:0.55;transform:none}

/* Unlimited plans */
.gv-buy-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gv-buy-plan{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px 14px 14px;min-height:112px;border:1px solid ${LINE_DARK};border-radius:16px;background:transparent;color:${DARK_INK};font-family:${OUTFIT};text-align:left;cursor:pointer;transition:border-color 140ms ease,background-color 140ms ease,transform 120ms ease}
.gv-buy-plan:hover{border-color:rgba(255,255,255,0.5)}
.gv-buy-plan:active{transform:scale(0.985)}
.gv-buy-plan[aria-checked="true"]{border-color:${GOLD};background:rgba(238,217,138,0.12);box-shadow:inset 0 0 0 1.5px ${GOLD}}
.gv-buy-plan-name{font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${DARK_SOFT}}
.gv-buy-plan[aria-checked="true"] .gv-buy-plan-name{color:${GOLD}}
.gv-buy-plan-price{font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;color:#FFFFFF}
.gv-buy-plan-per{font-size:12.5px;color:${DARK_SOFT}}
.gv-buy-plan-note{margin-top:auto;padding-top:8px;font-size:12px;font-weight:700;color:${GOLD}}
.gv-buy-plan-badge{position:absolute;top:-9px;right:10px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;padding:3px 8px;border-radius:999px;background:${GOLD};color:${INK};box-shadow:0 2px 6px rgba(0,0,0,0.25)}
.gv-buy-renew{margin:0;font-size:13.5px;line-height:1.5;color:${DARK_SOFT}}
.gv-buy-renew strong{color:${DARK_INK};font-weight:600}
.gv-buy-note{margin:0;padding:12px 14px;border-radius:12px;background:rgba(27,56,40,0.08);color:${FOREST};font-size:14px;line-height:1.45}
.gv-buy-dark .gv-buy-note{background:rgba(238,217,138,0.12);color:${DARK_INK}}
.gv-buy-note a,.gv-buy-note button{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px;background:none;border:none;padding:0;font-family:inherit;font-size:inherit;cursor:pointer}
.gv-buy-dark .gv-buy-note a,.gv-buy-dark .gv-buy-note button{color:${GOLD}}
.gv-buy-wait{display:flex;align-items:center;gap:10px;margin:0;font-size:14px;color:${INK_SOFT}}
.gv-buy-dark .gv-buy-wait{color:${DARK_SOFT}}

@keyframes gvBuyFade{from{opacity:0}to{opacity:1}}
@keyframes gvBuyRise{from{opacity:0;transform:translateY(80px)}to{opacity:1;transform:none}}
@keyframes gvBuySheet{from{transform:translateY(100%)}to{transform:none}}
@media (min-width:860px){
  .gv-buy-panel{max-width:940px;min-height:min(560px,calc(100dvh - 48px))}
  .gv-buy-body{flex-direction:row;flex:1 1 auto}
  .gv-buy-left{flex:0 0 380px;padding:34px 32px 30px}
  .gv-buy-right{flex:1 1 auto;min-width:0;padding:34px 36px 30px;overflow-y:auto}
  .gv-buy-x{top:16px;right:16px}
}
@media (max-width:743px){
  .gv-buy-backdrop{padding:0;align-items:stretch;background:rgba(0,0,0,0.6);overscroll-behavior:none}
  .gv-buy-panel{max-width:none;width:100%;height:100%;max-height:none;border-radius:0;box-shadow:none;animation:gvBuySheet 340ms cubic-bezier(0.2,0.8,0.2,1)}
  .gv-buy-x{top:calc(10px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right));width:44px;height:44px}
  .gv-buy-body{flex:1 1 auto;-webkit-overflow-scrolling:touch}
  .gv-buy-left{padding:calc(22px + env(safe-area-inset-top)) 20px 20px;gap:18px}
  .gv-buy-right{padding:22px 20px calc(24px + env(safe-area-inset-bottom))}
  .gv-buy-title{font-size:26px}
  .gv-buy-balance-big{font-size:44px}
  .gv-buy-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .gv-buy-chip{min-height:88px}
  .gv-buy-step{width:44px;height:44px}
  .gv-buy-stepin{height:44px;font-size:16px}
  .gv-buy-nudge{min-height:44px}
  .gv-buy-swapbtn,.gv-buy-changebtn{min-height:44px;display:inline-flex;align-items:center}
  .gv-buy-balance{margin-top:0}
  .gv-buy-plans{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){.gv-buy-backdrop,.gv-buy-panel{animation:none}}
`;
