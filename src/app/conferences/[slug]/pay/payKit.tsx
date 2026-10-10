'use client';

// payKit.tsx — the /pay page's look (prompt 95), in the Store and purchase
// pop-up language: white cards on ivory, big numbers with a caption, one
// forest button, quiet outline buttons, states as an icon and plain words.

import { OUTFIT } from '@/components/neu';

export const INK = '#1C1410';
export const INK_SOFT = '#5A5046';
export const FOREST = '#1B3828';
export const GOLD = '#EED98A';
export const DEEP_GOLD = '#B6871F';
export const IVORY = '#FAF8F3';
export const LINE = 'rgba(27,56,40,0.12)';
export const DANGER = '#8B2020';
export const GREEN = '#2A5A3C';

export const PAY_CSS = `
.gv-pay{font-family:${OUTFIT};color:${INK}}
.gv-pay-card{position:relative;background:#FFFFFF;border-radius:20px;padding:20px 20px 18px;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-pay-sect{margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${INK_SOFT}}
.gv-pay-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border-radius:12px;border:none;cursor:pointer;font-family:${OUTFIT};font-size:14.5px;font-weight:700;text-decoration:none;transition:background-color 140ms ease,transform 120ms ease,opacity 140ms ease}
.gv-pay-btn:active{transform:scale(0.985)}
.gv-pay-btn:disabled{opacity:0.55;cursor:default;transform:none}
.gv-pay-btn:focus{outline:none}
.gv-pay-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-pay-forest{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:${GOLD}}
.gv-pay-forest:hover:not(:disabled){background:linear-gradient(90deg,#234a35 0%,#33694a 100%)}
.gv-pay-outline{background:#FFFFFF;color:${INK};box-shadow:inset 0 0 0 1.5px ${INK}}
.gv-pay-outline:hover:not(:disabled){background:${IVORY}}
.gv-pay-link{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:13.5px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-pay-link:focus{outline:none}
.gv-pay-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
/* 44px hit areas for the links beside Pay, in the list header and back to the conference */
.gv-pay-bar .gv-pay-link,.gv-pay-listhead .gv-pay-link,.gv-pay-link.gv-pay-back{display:inline-flex;align-items:center;min-height:44px;padding:0 6px}
.gv-pay-link.gv-pay-back{margin-left:-6px}
.gv-pay-quiet{margin:0;font-size:13.5px;line-height:1.5;color:${INK_SOFT}}
.gv-pay-err{margin:0;font-size:13.5px;line-height:1.5;color:${DANGER}}

/* Balance */
.gv-pay-bal{display:flex;flex-wrap:wrap;gap:18px 36px;align-items:flex-start}
.gv-pay-big{display:block;font-size:34px;font-weight:900;letter-spacing:-0.03em;line-height:1.05;font-variant-numeric:tabular-nums}
.gv-pay-big-cap{display:block;margin-top:4px;font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-pay-break{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
.gv-pay-break li{display:flex;justify-content:space-between;gap:14px;font-size:13.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums}

/* Items */
.gv-pay-items{display:flex;flex-direction:column;background:#FFFFFF;border-radius:20px;padding:4px 0;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-pay-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto 44px;gap:6px 8px;align-items:start;padding:12px 10px 12px 6px}
.gv-pay-item + .gv-pay-item{border-top:1px solid ${LINE}}
.gv-pay-item[data-selected]{background:rgba(238,217,138,0.16)}
.gv-pay-tick{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center}
.gv-pay-tick input{width:20px;height:20px;accent-color:${FOREST};cursor:pointer}
.gv-pay-name{margin:11px 0 0;font-size:15.5px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.gv-pay-for{margin:2px 0 0;font-size:13px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-pay-state{margin:6px 0 0;display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600}
.gv-pay-sub{margin:3px 0 0;font-size:13px;line-height:1.45;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-pay-amt{margin:11px 4px 0 0;font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.gv-pay-x{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;border-radius:12px;color:${INK_SOFT};cursor:pointer}
.gv-pay-x:hover{background:${IVORY};color:${DANGER}}
.gv-pay-x:focus{outline:none}
.gv-pay-x:focus-visible{outline:2px solid ${FOREST};outline-offset:-2px}
.gv-pay-confirm{grid-column:2 / -1;margin:6px 8px 4px 0;padding:12px 14px;border-radius:12px;background:${IVORY};display:flex;flex-direction:column;gap:10px}

/* Bottom pay bar */
.gv-pay-bar{position:sticky;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:30;margin-top:14px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:12px 14px 12px 18px;border-radius:18px;background:#FFFFFF;box-shadow:0 2px 0 rgba(27,56,40,0.06),0 18px 40px -16px rgba(27,56,40,0.5)}
.gv-pay-bar-sum{margin-right:auto;font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
@media (max-width:1023px){.gv-pay-bar{bottom:calc(74px + env(safe-area-inset-bottom,0px))}}
.gv-pay-bar span.gv-pay-bar-aux{display:contents}
/* Item list header: the bar's Select all, Clear and Upload proof, phones only */
.gv-pay-listhead{display:none}
@media (max-width:639px){
  .gv-pay-bar .gv-pay-bar-aux,.gv-pay-bar span.gv-pay-bar-aux{display:none}
  .gv-pay-bar{flex-wrap:nowrap;gap:12px;padding:10px 10px 10px 16px}
  .gv-pay-bar-sum{min-width:0;font-size:15px}
  .gv-pay-bar .gv-pay-btn{flex-shrink:0}
  .gv-pay-bar-btn-total{display:none}
  .gv-pay-listhead{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:0 0 -8px}
}

/* Receipts */
.gv-pay-receipts{display:flex;flex-direction:column;gap:8px}
.gv-pay-receipt{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:none;border-radius:16px;background:#FFFFFF;cursor:pointer;text-align:left;font-family:${OUTFIT};color:${INK};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -28px rgba(27,56,40,0.5)}
.gv-pay-receipt:hover{background:${IVORY}}
.gv-pay-receipt:focus{outline:none}
.gv-pay-receipt:focus-visible{box-shadow:0 0 0 2px ${FOREST}}

/* Right column */
.gv-pay-action{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;border:none;border-radius:16px;background:#FFFFFF;cursor:pointer;text-align:left;font-family:${OUTFIT};color:${INK};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -28px rgba(27,56,40,0.5);transition:transform 160ms ease}
.gv-pay-action:hover{transform:translateY(-1px)}
.gv-pay-action:focus{outline:none}
.gv-pay-action:focus-visible{box-shadow:0 0 0 2px ${FOREST}}
.gv-pay-action-icon{width:40px;height:40px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:rgba(238,217,138,0.45);color:${FOREST};flex-shrink:0}
.gv-pay-action b{display:block;font-size:14.5px;font-weight:800}
.gv-pay-action small{display:block;margin-top:2px;font-size:12.5px;color:${INK_SOFT}}

/* Layout (prompt 101): a sticky rail with the two tabs, the middle, the right column */
.gv-pay-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:18px 24px;align-items:start}
.gv-pay-rail{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gv-pay-tab{display:flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 16px;border:none;border-radius:14px;background:#FFFFFF;font-family:${OUTFIT};font-size:15px;font-weight:700;color:${INK_SOFT};cursor:pointer;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 10px 24px -22px rgba(27,56,40,0.5);text-align:left}
.gv-pay-tab:hover{color:${INK}}
.gv-pay-tab[aria-current="page"]{background:${FOREST};color:${GOLD}}
.gv-pay-tab:focus{outline:none}
.gv-pay-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-pay-tab-n{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
/* One column (below 1024px): the middle column dissolves into the grid so the action
   cards sit between the balance and the item list; only one ActionsColumn is mounted. */
@media (max-width:1023px){
  .gv-pay-mid{display:contents}
  .gv-pay-mid > *{order:3;min-width:0}
  .gv-pay-mid > .gv-pay-head{order:1}
  .gv-pay-side{order:2}
  .gv-pay-side:empty{display:none}
}
@media (min-width:1024px){
  .gv-pay-layout{grid-template-columns:180px minmax(0,1fr) 300px}
  .gv-pay-rail{position:sticky;top:96px;grid-template-columns:minmax(0,1fr);gap:6px}
  .gv-pay-tab{justify-content:space-between}
}

/* Pop-ups on PurchaseShell */
/* Small pop-ups (lock, QR, bank details, cancel): as tall as their content, never the
   purchase pop-up's 560px minimum; a bottom sheet on phones instead of a full screen. */
.gv-buy-panel.gv-pay-small{max-width:440px;min-height:0}
.gv-buy-panel.gv-pay-small .gv-buy-body{flex-direction:column}
@media (max-width:743px){.gv-buy-panel.gv-pay-small{height:auto;max-height:92dvh;margin-top:auto;border-radius:22px 22px 0 0}}
.gv-buy-panel.gv-pay-pop{max-width:640px}
.gv-buy-panel.gv-pay-mid{max-width:560px}
.gv-pay-rows{display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;padding:4px 14px}
.gv-pay-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;font-size:14.5px}
.gv-pay-row + .gv-pay-row{border-top:1px solid ${LINE}}
.gv-pay-row b{font-variant-numeric:tabular-nums}
`;
