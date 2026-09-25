'use client';

// ── Visual kit for the Credits and Unlimited pop-ups ─────────────────────────
//
// The login pop-up's language (src/components/auth/authModalKit.tsx): white
// surfaces, 1px grey borders, 12px field radii, the 24px panel radius, the
// green gradient button. Credits is the light pop-up; Unlimited is the one
// deliberate exception, dark forest with gold, so switching between the two
// feels like walking into a different room.
//
// From 860px the panel is two columns: what this is on the LEFT, the purchase
// on the RIGHT. Below that a single column. On a phone (≤743px) it is a
// full-height sheet, like the login sheet, with safe-area padding and dvh
// heights so the card form is never under the keyboard.
//
// Icons here are Microsoft Fluent 3D emoji through Emoji3D (owner: the
// dashboard's 3D icons, not line icons), each with a lucide fallback.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { BORDER, FOCUS, FOREST, HAIR, INK, INK_SOFT, OUTFIT } from '@/components/auth/authModalKit';

export type Tone = 'light' | 'dark';

export const DARK_BG = '#14301F';
export const DARK_INK = '#F4F1E8';
export const DARK_SOFT = 'rgba(244,241,232,0.72)';
export const GOLD = '#EED98A';
export const DEEP_GOLD = '#B6871F';

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
        className="gv-buy-panel"
        data-tone={tone}
        data-testid={testId}
      >
        <button type="button" onClick={onClose} aria-label="Close" className={`gv-buy-x ${FOCUS}`}>
          <X size={18} strokeWidth={2.2} />
        </button>
        <div className="gv-buy-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** "Gavelling" small over the product word large, the same on both pop-ups. */
export function BrandTitle({ word, sub }: { word: string; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="gv-buy-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gavelling-mark.png" alt="" width={22} height={22} className="gv-buy-mark" />
        <span className="gv-buy-brandword">Gavelling</span>
      </div>
      <h2 className="gv-buy-title">{word}</h2>
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

export function BenefitList({ items }: { items: Benefit[] }) {
  return (
    <ul className="gv-buy-benefits">
      {items.map((b) => (
        <li key={b.title} className="gv-buy-benefit">
          <span className="gv-buy-benefit-disc" aria-hidden>
            <Emoji3D name={b.emoji} size={24} fallback={b.fallback} fallbackColor={FOREST} />
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

export function SecureLine() {
  return <p className="gv-buy-fine">Secure payment with Stripe.</p>;
}

/** The link line that swaps to the other pop-up. */
export function SwapLine({ lead, action, onClick }: { lead: string; action: string; onClick: () => void }) {
  return (
    <p className="gv-buy-swap">
      {lead}{' '}
      <button type="button" onClick={onClick} className={`gv-buy-swapbtn ${FOCUS}`}>{action}</button>
    </p>
  );
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="gv-buy-err">{children}</p>;
}

/** Gold, for the dark pop-up. The light one uses the kit's GreenButton. */
export function GoldButton({ children, onClick, busy, busyText, disabled }: {
  children: React.ReactNode; onClick: () => void; busy?: boolean; busyText?: string; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} aria-busy={busy || undefined} className={`gv-buy-gold ${FOCUS}`}>
      {busy ? busyText ?? 'One moment…' : children}
    </button>
  );
}

export const PURCHASE_CSS = `
.gv-buy-backdrop{position:fixed;inset:0;z-index:9090;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(0,0,0,0.5);animation:gvBuyFade 200ms ease;font-family:${OUTFIT};color:${INK}}
.gv-buy-panel{position:relative;width:100%;max-width:520px;max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:#FFFFFF;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,0.55);overflow:hidden;animation:gvBuyRise 360ms cubic-bezier(0.2,0.8,0.2,1);outline:none}
.gv-buy-panel[data-tone="dark"]{background:${DARK_BG};color:${DARK_INK}}
.gv-buy-x{position:absolute;top:14px;right:14px;z-index:5;width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;border:none;background:rgba(255,255,255,0.82);color:${INK};cursor:pointer;transition:background-color 160ms ease}
.gv-buy-x:hover{background:#F2F2F2}
.gv-buy-panel[data-tone="dark"] .gv-buy-x{background:rgba(255,255,255,0.1);color:${DARK_INK}}
.gv-buy-panel[data-tone="dark"] .gv-buy-x:hover{background:rgba(255,255,255,0.18)}
.gv-buy-body{overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;min-height:0}
.gv-buy-left{padding:30px 28px 26px;background:#F6F3EC;display:flex;flex-direction:column;gap:22px}
.gv-buy-panel[data-tone="dark"] .gv-buy-left{background:rgba(0,0,0,0.2)}
.gv-buy-right{padding:30px 28px 26px;display:flex;flex-direction:column;gap:14px}
.gv-buy-brand{display:flex;align-items:center;gap:8px}
.gv-buy-mark{display:block;width:22px;height:22px;object-fit:contain}
.gv-buy-brandword{font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${INK_SOFT}}
.gv-buy-panel[data-tone="dark"] .gv-buy-brandword{color:${GOLD}}
.gv-buy-title{margin:6px 0 0;font-size:36px;font-weight:800;letter-spacing:-0.025em;line-height:1.02;color:${INK}}
.gv-buy-panel[data-tone="dark"] .gv-buy-title{color:${DARK_INK}}
.gv-buy-sub{margin:8px 0 0;font-size:15px;line-height:1.5;color:${INK_SOFT};text-wrap:pretty}
.gv-buy-panel[data-tone="dark"] .gv-buy-sub{color:${DARK_SOFT}}
.gv-buy-eyebrow{margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT}}
.gv-buy-panel[data-tone="dark"] .gv-buy-eyebrow{color:${DARK_SOFT}}
.gv-buy-rtitle{margin:0;font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${INK}}
.gv-buy-panel[data-tone="dark"] .gv-buy-rtitle{color:${DARK_INK}}
.gv-buy-benefits{display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none}
.gv-buy-benefit{display:flex;align-items:center;gap:12px}
.gv-buy-benefit-disc{width:42px;height:42px;border-radius:12px;background:#FFFFFF;border:1px solid ${HAIR};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.gv-buy-panel[data-tone="dark"] .gv-buy-benefit-disc{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14)}
.gv-buy-benefit-text{flex:1;min-width:0;font-size:15px;font-weight:600;line-height:1.3;color:${INK}}
.gv-buy-panel[data-tone="dark"] .gv-buy-benefit-text{color:${DARK_INK}}
.gv-buy-benefit-note{display:block;margin-top:2px;font-size:12.5px;font-weight:400;line-height:1.4;color:${INK_SOFT}}
.gv-buy-panel[data-tone="dark"] .gv-buy-benefit-note{color:${DARK_SOFT}}
.gv-buy-tag{flex-shrink:0;font-size:10.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
.gv-buy-tag-live{background:#E4F2E8;color:${FOREST}}
.gv-buy-tag-soon{background:#F2F2F2;color:#6A6A6A}
.gv-buy-panel[data-tone="dark"] .gv-buy-tag-live{background:rgba(238,217,138,0.2);color:${GOLD}}
.gv-buy-panel[data-tone="dark"] .gv-buy-tag-soon{background:rgba(255,255,255,0.08);color:${DARK_SOFT}}
.gv-buy-balance{margin-top:auto;padding-top:18px;border-top:1px solid ${HAIR}}
.gv-buy-balance-row{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
.gv-buy-balance-cell{display:flex;flex-direction:column;gap:4px}
.gv-buy-balance-big{font-size:38px;font-weight:800;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;color:${INK}}
.gv-buy-balance-big.gv-buy-after{color:${FOREST}}
.gv-buy-balance-cap{font-size:12px;font-weight:600;color:${INK_SOFT}}
.gv-buy-balance-arrow{align-self:center;color:${INK_SOFT};padding-bottom:18px}
.gv-buy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.gv-buy-chip{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:94px;padding:14px 12px 12px;border:1px solid ${BORDER};border-radius:14px;background:#FFFFFF;cursor:pointer;text-align:left;font-family:${OUTFIT};color:${INK};transition:border-color 140ms ease,box-shadow 140ms ease,transform 120ms ease}
.gv-buy-chip:hover{border-color:${INK}}
.gv-buy-chip:active{transform:scale(0.985)}
.gv-buy-chip[aria-checked="true"]{border-color:${FOREST};box-shadow:inset 0 0 0 1.5px ${FOREST};background:#F4F9F5}
.gv-buy-chip-qty{font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums}
.gv-buy-chip-unit{font-size:11.5px;font-weight:600;color:${INK_SOFT}}
.gv-buy-chip-price{margin-top:auto;padding-top:6px;font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums}
.gv-buy-save{position:absolute;top:-9px;right:10px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;padding:3px 8px;border-radius:999px;background:${FOREST};color:${GOLD};box-shadow:0 2px 6px rgba(27,56,40,0.28)}
.gv-buy-stepper{display:flex;align-items:center;gap:8px;margin-top:6px}
.gv-buy-step{width:34px;height:34px;border-radius:999px;border:1px solid ${BORDER};background:#FFFFFF;color:${INK};display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.gv-buy-step:disabled{opacity:0.4;cursor:default}
.gv-buy-stepin{width:70px;height:34px;border:1px solid ${BORDER};border-radius:8px;background:#FFFFFF;text-align:center;font-family:${OUTFIT};font-size:16px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gv-buy-stepin::-webkit-outer-spin-button,.gv-buy-stepin::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gv-buy-stepin:focus{outline:none;border-color:${INK};box-shadow:inset 0 0 0 1px ${INK}}
.gv-buy-total{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 0 2px;border-top:1px solid ${HAIR};margin-top:4px}
.gv-buy-total-label{font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-buy-total-amount{font-size:30px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;color:${INK}}
.gv-buy-total-saving{font-size:13px;font-weight:700;color:${FOREST}}
.gv-buy-fine{margin:2px 0 0;font-size:12.5px;line-height:1.5;color:${INK_SOFT};text-align:center}
.gv-buy-panel[data-tone="dark"] .gv-buy-fine{color:${DARK_SOFT}}
.gv-buy-swap{margin:0;font-size:13.5px;line-height:1.5;color:${INK_SOFT};text-align:center}
.gv-buy-panel[data-tone="dark"] .gv-buy-swap{color:${DARK_SOFT}}
.gv-buy-swapbtn{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:13.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-buy-panel[data-tone="dark"] .gv-buy-swapbtn{color:${GOLD}}
.gv-buy-err{margin:0;font-size:13.5px;line-height:1.45;color:#C13515}
.gv-buy-panel[data-tone="dark"] .gv-buy-err{color:#FFB4A2}
.gv-buy-form{border:1px solid ${HAIR};border-radius:16px;padding:6px;background:#FFFFFF;min-height:340px}
.gv-buy-panel[data-tone="dark"] .gv-buy-form{border-color:rgba(255,255,255,0.16)}
.gv-buy-stripe{min-height:320px}
.gv-buy-change{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid ${HAIR};border-radius:12px;background:#F7F7F7;font-size:14px;color:${INK}}
.gv-buy-panel[data-tone="dark"] .gv-buy-change{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.14);color:${DARK_INK}}
.gv-buy-change strong{font-weight:700}
.gv-buy-changebtn{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:13.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;cursor:pointer;white-space:nowrap}
.gv-buy-panel[data-tone="dark"] .gv-buy-changebtn{color:${GOLD}}
.gv-buy-gold{position:relative;width:100%;height:52px;padding:0 20px;border:none;border-radius:10px;cursor:pointer;color:#1C1410;font-family:${OUTFIT};font-size:16px;font-weight:700;background:linear-gradient(90deg,${GOLD} 0%,#E2C66A 55%,#D3AE49 100%);box-shadow:0 6px 18px rgba(238,217,138,0.18);transition:transform 120ms ease,opacity 160ms ease}
.gv-buy-gold:active{transform:scale(0.985)}
.gv-buy-gold:disabled{cursor:default;opacity:0.6}
.gv-buy-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gv-buy-plan{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px 14px 14px;min-height:112px;border:1px solid rgba(255,255,255,0.18);border-radius:16px;background:rgba(255,255,255,0.05);color:${DARK_INK};font-family:${OUTFIT};text-align:left;cursor:pointer;transition:border-color 140ms ease,background-color 140ms ease,transform 120ms ease}
.gv-buy-plan:hover{border-color:rgba(238,217,138,0.6)}
.gv-buy-plan:active{transform:scale(0.985)}
.gv-buy-plan[aria-checked="true"]{border-color:${GOLD};background:rgba(238,217,138,0.1);box-shadow:inset 0 0 0 1px ${GOLD}}
.gv-buy-plan-name{font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${DARK_SOFT}}
.gv-buy-plan[aria-checked="true"] .gv-buy-plan-name{color:${GOLD}}
.gv-buy-plan-price{font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums}
.gv-buy-plan-per{font-size:12.5px;color:${DARK_SOFT}}
.gv-buy-plan-note{margin-top:auto;padding-top:8px;font-size:12px;font-weight:700;color:${GOLD}}
.gv-buy-plan-badge{position:absolute;top:-9px;right:10px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;padding:3px 8px;border-radius:999px;background:${GOLD};color:#1C1410}
.gv-buy-renew{margin:0;font-size:13.5px;line-height:1.5;color:${DARK_SOFT}}
.gv-buy-renew strong{color:${DARK_INK};font-weight:600}
.gv-buy-note{margin:0;padding:12px 14px;border-radius:12px;background:#F1F6F2;color:${FOREST};font-size:14px;line-height:1.45}
.gv-buy-panel[data-tone="dark"] .gv-buy-note{background:rgba(238,217,138,0.12);color:${DARK_INK}}
.gv-buy-note a,.gv-buy-note button{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px;background:none;border:none;padding:0;font-family:inherit;font-size:inherit;cursor:pointer}
.gv-buy-wait{display:flex;align-items:center;gap:10px;font-size:14px;color:${INK_SOFT}}
.gv-buy-panel[data-tone="dark"] .gv-buy-wait{color:${DARK_SOFT}}
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
  .gv-buy-title{font-size:32px}
  .gv-buy-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .gv-buy-chip{min-height:88px}
  .gv-buy-step{width:44px;height:44px}
  .gv-buy-stepin{height:44px;font-size:16px}
  .gv-buy-balance{margin-top:0}
  .gv-buy-plans{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){.gv-buy-backdrop,.gv-buy-panel{animation:none}}
`;
