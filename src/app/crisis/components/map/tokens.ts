'use client';
// Gavelling Crisis war map: the DOM for unit tokens, country labels, shape labels and the
// corner handles. These are plain elements handed to maplibregl.Marker (no glyph server needed).

import type { UnitKind } from '@/lib/crisis/types';
import { glyphSvg } from './glyphs';
import { NOBODY } from './mapStyle';

export function safeColor(c: string | null | undefined): string {
  return c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : NOBODY;
}

export function shortNumber(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.max(0, Math.round(n)));
}

export interface TokenSpec {
  kind: UnitKind;
  color: string;
  strength: number;
  suspected: boolean;
  selected: boolean;
  size: number;
  name: string;
}

/** (Re)draws a unit token into its marker element. */
export function paintToken(el: HTMLElement, t: TokenSpec): void {
  const size = t.size;
  // Only our own classes: assigning className would wipe maplibre's marker classes (its absolute position).
  el.classList.add('wm-marker', 'wm-unit');
  el.classList.toggle('wm-sel', t.selected);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  const label = t.suspected ? 'Suspected site' : t.name;
  el.title = label;
  el.setAttribute('aria-label', label);
  if (t.suspected) {
    el.innerHTML = `<div class="wm-tok wm-susp" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px">?</div>`;
    return;
  }
  const c = safeColor(t.color);
  el.innerHTML =
    `<div class="wm-tok" style="width:${size}px;height:${size}px;background:${c}">` +
    glyphSvg(t.kind, Math.round(size * 0.52)) +
    `<span class="wm-badge" style="color:${c};border-color:${c}">${shortNumber(t.strength)}</span>` +
    `</div>`;
}

export function makeCountryLabel(name: string, area: number): HTMLElement {
  const el = document.createElement('div');
  el.className = `wm-clabel${area > 700 ? ' wm-clabel-big' : ''}`;
  el.textContent = name;
  return el;
}

export function makeShapeLabel(text: string, color: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'wm-slabel';
  el.textContent = text;
  el.style.color = safeColor(color);
  return el;
}

export function makeVertex(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'wm-marker wm-vtx';
  el.title = 'Drag to move. Double-click to remove.';
  return el;
}

export function makeMidpoint(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'wm-marker wm-mid';
  el.title = 'Click to add a corner';
  return el;
}

export function makeGhost(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'wm-ghost';
  return el;
}

export const MAP_CSS = `
.wm-root{display:flex;flex-direction:column;height:100%;min-height:380px;font-family:var(--font-brand),Inter,system-ui,sans-serif;color:#1C1410}
.wm-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;margin-bottom:8px}
.wm-tools{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;align-items:stretch}
.wm-tool{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:transparent;color:#4E463C;padding:4px 8px;border-radius:10px;font-size:11px;font-weight:600;line-height:1.2;font-family:inherit;min-width:58px;cursor:pointer}
.wm-tool:hover:not(:disabled){background:rgba(142,36,36,0.055);color:#1C1410}
.wm-tool[aria-pressed="true"]{background:#1B3828;color:#EED98A}
.wm-tool:disabled{opacity:.45;cursor:not-allowed}
.wm-tool:focus{outline:none}
.wm-tool:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.wm-tool-sep{width:1px;background:rgba(110,30,30,0.12);margin:4px 4px}
.wm-root[data-compact] .wm-tool{flex-direction:row;min-width:0;padding:5px 8px;gap:5px}
.wm-body{position:relative;flex:1;min-height:300px}
.wm-stage{position:absolute;inset:0;border-radius:16px;overflow:hidden;background:#DCE4DA;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08)}
.wm-map{position:absolute;inset:0;touch-action:none}
.wm-drawer{position:absolute;top:12px;right:12px;z-index:5;max-height:calc(100% - 76px);display:flex}
.wm-panel{width:292px;max-width:100%;overflow:auto;background:rgba(255,255,255,0.97);border-radius:16px;padding:12px 13px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.75),0 0 0 1px rgba(27,56,40,0.07),6px 7px 18px rgba(27,56,40,0.16)}
.wm-legend{position:absolute;left:12px;right:12px;bottom:12px;z-index:4;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;pointer-events:none}
.wm-legend>div{pointer-events:auto;background:rgba(255,255,255,0.93);border-radius:12px;padding:7px 11px;font-size:12px;color:#4E463C;box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 1px 2px rgba(27,56,40,0.1),0 3px 7px -2px rgba(27,56,40,0.15);display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center}
.wm-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.wm-hint{position:absolute;left:12px;top:12px;z-index:4;max-width:min(360px,calc(100% - 340px));background:rgba(255,255,255,0.93);border-radius:12px;padding:7px 11px;font-size:12.5px;color:#4E463C;box-shadow:0 1px 2px rgba(27,56,40,0.1),0 3px 7px -2px rgba(27,56,40,0.15)}
@media (max-width:767px){
  .wm-root{height:auto!important}
  .wm-body{flex:none}
  .wm-stage{position:relative;inset:auto;height:62dvh;min-height:340px}
  .wm-drawer,.wm-legend{position:static;max-height:none;margin-top:10px;display:block}
  .wm-panel{width:auto}
  .wm-legend>div{margin-bottom:8px}
  .wm-hint{max-width:calc(100% - 24px)}
}
.wm-marker{cursor:pointer}
.wm-tok{position:relative;display:grid;place-items:center;border-radius:50%;border:2px solid #fff;box-sizing:border-box;box-shadow:0 2px 6px rgba(27,56,40,0.38)}
.wm-unit:focus{outline:none}
.wm-unit:focus-visible .wm-tok{box-shadow:0 0 0 3px #1B3828}
.wm-sel .wm-tok{box-shadow:0 0 0 3px #EED98A,0 2px 9px rgba(0,0,0,0.4)}
.wm-badge{position:absolute;top:-9px;right:-13px;min-width:19px;height:17px;padding:0 4px;border-radius:9px;background:#fff;border:1.3px solid;box-sizing:border-box;font:800 10.5px/14px var(--font-brand),Inter,sans-serif;text-align:center;font-variant-numeric:tabular-nums}
.wm-susp{background:rgba(255,255,255,0.92);border:1.6px dashed #4E463C;color:#4E463C;font-weight:800;line-height:1}
.wm-clabel{pointer-events:none;white-space:nowrap;font:700 10.5px/1 var(--font-brand),Inter,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#8C806C;text-shadow:0 0 3px #F5F0E4,0 0 3px #F5F0E4}
.wm-clabel-big{font-size:13px;letter-spacing:0.16em;color:#7E7260}
.wm-slabel{pointer-events:none;white-space:nowrap;font:800 11.5px/1 var(--font-brand),Inter,sans-serif;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff}
.wm-vtx{width:16px;height:16px;border-radius:50%;background:#fff;border:2.5px solid #8E2424;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:grab}
.wm-mid{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.85);border:1.5px solid #8E2424;box-sizing:border-box;opacity:0.75}
.wm-mid:hover{opacity:1}
.wm-ghost{width:30px;height:30px;border-radius:50%;border:2px dashed #8E2424;background:rgba(255,255,255,0.6);box-sizing:border-box;pointer-events:none}
.wm-fog{position:absolute;left:0;top:0;pointer-events:none}
`;
