'use client';
// Gavelling Crisis map: landmarks (the places a crisis names, e.g. the Jacobin Club in Paris). They come from the crisis
// settings and are read-only here. Each is a small DOM marker (a round pin with a landmark icon, built with DOM calls from the
// name, never markup), shown from LANDMARK_DOT_ZOOM; its name sits to the right from LANDMARK_NAME_ZOOM and drops out when it
// would sit on a name already placed. The markers live right after the map canvas, so units and characters always draw above
// them. Clicking one opens LandmarkPopover (a small card with the name and the description).

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import Portal from '@/components/Portal';
import type { Landmark } from '@/lib/crisis/types';

/** The pin shows from this zoom; the name beside it from LANDMARK_NAME_ZOOM. */
export const LANDMARK_DOT_ZOOM = 11;
export const LANDMARK_NAME_ZOOM = 12.5;
const MAX_LANDMARKS = 200;

export const LANDMARK_CSS = `
.wm-lm{display:none;width:20px;height:20px;border-radius:50%;background:#fff;border:1.5px solid #1B3828;box-sizing:border-box;box-shadow:0 1px 4px rgba(27,56,40,0.35);place-items:center;color:#1B3828;cursor:pointer}
.wm-map[data-lmz="dot"] .wm-lm,.wm-map[data-lmz="name"] .wm-lm{display:grid}
.wm-map[data-lmtool="off"] .wm-lm{pointer-events:none}
.wm-lm svg{display:block;pointer-events:none}
.wm-lm:hover{transform:scale(1.12)}
.wm-lm:focus{outline:none}
.wm-lm:focus-visible,.wm-lm[data-sel]{box-shadow:0 0 0 3px #EED98A,0 1px 5px rgba(27,56,40,0.45)}
.wm-lm-name{display:none;position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:5px;white-space:nowrap;font:700 11px/1.1 var(--font-brand),Inter,system-ui,sans-serif;color:#1C1410;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff;pointer-events:none}
.wm-map[data-lmz="name"] .wm-lm:not([data-clash]) .wm-lm-name,.wm-map[data-lmz="name"] .wm-lm[data-sel] .wm-lm-name{display:block}
.wm-map[data-lmz="dot"] .wm-lm[data-sel] .wm-lm-name{display:block}
.wm-lmpop{position:fixed;left:0;top:0;z-index:2000;width:272px;max-width:calc(100vw - 16px);box-sizing:border-box;background:rgba(255,255,255,0.99);border-radius:14px;padding:11px 13px 12px;font-family:var(--font-brand),Inter,system-ui,sans-serif;color:#1C1410;box-shadow:inset 0 1px 0 rgba(255,255,255,0.75),0 0 0 1px rgba(27,56,40,0.08),6px 8px 20px rgba(27,56,40,0.22)}
.wm-lmpop h3{margin:0;font-size:14px;font-weight:800;line-height:1.25;overflow-wrap:anywhere}
.wm-lmpop p{margin:6px 0 0;font-size:12.5px;line-height:1.45;color:#4E463C;overflow-wrap:anywhere;white-space:pre-line}
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The Lucide "landmark" icon, drawn with DOM calls (fine line, bare ink, like every other icon on the map). */
function landmarkIcon(size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const x of [6, 10, 14, 18]) {
    const l = document.createElementNS(SVG_NS, 'line');
    l.setAttribute('x1', String(x)); l.setAttribute('x2', String(x)); l.setAttribute('y1', '18'); l.setAttribute('y2', '11');
    svg.appendChild(l);
  }
  const base = document.createElementNS(SVG_NS, 'line');
  base.setAttribute('x1', '3'); base.setAttribute('x2', '21'); base.setAttribute('y1', '22'); base.setAttribute('y2', '22');
  svg.appendChild(base);
  const roof = document.createElementNS(SVG_NS, 'polygon');
  roof.setAttribute('points', '12 2 20 7 4 7');
  svg.appendChild(roof);
  return svg;
}

export interface LandmarkLayer {
  /** Replaces the landmarks on the map. */
  setLandmarks: (list: Landmark[]) => void;
  /** Shows or hides all of them (the "Landmarks" switch). */
  setOn: (on: boolean) => void;
  /** Marks one as the open one (its name stays shown); null clears it. */
  setSelected: (id: string | null) => void;
  destroy: () => void;
}

/**
 * Creates the landmark markers. `onPick` is called when one is pressed (the caller decides whether it may open).
 * Never throws: landmarks are a nicety and must never break the map.
 */
export function createLandmarkLayer(map: MLMap, ml: typeof import('maplibre-gl'), onPick: (id: string) => void): LandmarkLayer {
  const host = map.getContainer();
  const live = new Map<string, { mk: MLMarker; el: HTMLElement; lm: Landmark }>();
  let on = true;
  let selected: string | null = null;
  let timer: number | null = null;
  let sig = '';

  const level = (): 'off' | 'dot' | 'name' => {
    if (!on) return 'off';
    const z = map.getZoom();
    return z >= LANDMARK_NAME_ZOOM ? 'name' : z >= LANDMARK_DOT_ZOOM ? 'dot' : 'off';
  };
  const syncLevel = () => { host.dataset.lmz = level(); };

  // At name zoom a name that would sit on one already placed is left out (the pin stays). The open one always shows.
  const collide = () => {
    timer = null;
    if (level() !== 'name') return;
    const placed: Array<[number, number, number, number]> = [];
    const order = [...live.values()].sort((a, b) => (a.lm.id === selected ? -1 : b.lm.id === selected ? 1 : 0));
    for (const { el, lm } of order) {
      const p = map.project([lm.lng, lm.lat]);
      const box: [number, number, number, number] = [p.x - 10, p.y - 9, p.x + 16 + lm.name.length * 6.4, p.y + 9];
      const clash = placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);
      if (clash && lm.id !== selected) el.setAttribute('data-clash', '1');
      else { el.removeAttribute('data-clash'); placed.push(box); }
    }
  };
  const schedule = () => { if (timer === null) timer = window.setTimeout(collide, 90); };
  const onZoom = () => syncLevel();
  const onEnd = () => { syncLevel(); schedule(); };
  map.on('zoom', onZoom);
  map.on('zoomend', onEnd);
  map.on('moveend', onEnd);

  const clear = () => { for (const { mk } of live.values()) mk.remove(); live.clear(); };

  const build = (lm: Landmark) => {
    const el = document.createElement('div');
    el.className = 'wm-marker wm-lm';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', lm.name);
    el.title = lm.name;
    el.appendChild(landmarkIcon(12));
    const name = document.createElement('span');
    name.className = 'wm-lm-name';
    name.textContent = lm.name;
    el.appendChild(name);
    const press = (ev: Event) => { ev.stopPropagation(); onPick(lm.id); };
    el.addEventListener('click', press);
    el.addEventListener('dblclick', (ev) => ev.stopPropagation());
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); press(ev); } });
    const mk = new ml.Marker({ element: el, anchor: 'center' }).setLngLat([lm.lng, lm.lat]).addTo(map);
    // Right after the canvas, before every other marker, so units and characters draw (and take clicks) above landmarks.
    const container = map.getCanvasContainer();
    const canvas = map.getCanvas();
    if (el.parentElement === container && canvas.parentElement === container) container.insertBefore(el, canvas.nextSibling);
    return { mk, el, lm };
  };

  syncLevel();
  return {
    setLandmarks(list) {
      try {
        // The settings are re-read now and then and arrive as a new array: rebuild only when something changed.
        const next = JSON.stringify(list.map((l) => [l.id, l.name, l.description, l.lng, l.lat]));
        if (next === sig) return;
        sig = next;
        clear();
        for (const lm of list.slice(0, MAX_LANDMARKS)) {
          if (!Number.isFinite(lm.lng) || !Number.isFinite(lm.lat)) continue;
          live.set(lm.id, build(lm));
        }
        for (const [id, h] of live) { if (id === selected) h.el.setAttribute('data-sel', '1'); }
        syncLevel();
        schedule();
      } catch { /* the map works without landmarks */ }
    },
    setOn(v) { on = v; syncLevel(); schedule(); },
    setSelected(id) {
      selected = id;
      for (const [key, h] of live) { if (key === id) h.el.setAttribute('data-sel', '1'); else h.el.removeAttribute('data-sel'); }
      schedule();
    },
    destroy() {
      map.off('zoom', onZoom); map.off('zoomend', onEnd); map.off('moveend', onEnd);
      if (timer !== null) window.clearTimeout(timer);
      clear();
      delete host.dataset.lmz;
    },
  };
}

/** The card a landmark opens: its name and description, over the map at a fixed position, flipped near the edges. */
export function LandmarkPopover({ mapRef, landmark, onClose }: { mapRef: RefObject<MLMap | null>; landmark: Landmark; onClose: () => void }) {
  const node = useRef<HTMLDivElement | null>(null);
  const place = useCallback(() => {
    const el = node.current;
    const map = mapRef.current;
    if (!el || !map) return;
    const box = map.getContainer().getBoundingClientRect();
    const p = map.project([landmark.lng, landmark.lat]);
    // The landmark has left the map's frame: close rather than float over something else.
    if (p.x < 0 || p.y < 0 || p.x > box.width || p.y > box.height) { onClose(); return; }
    const vw = window.innerWidth; const vh = window.innerHeight;
    const w = el.offsetWidth; const h = el.offsetHeight;
    const cx = box.left + p.x; const cy = box.top + p.y;
    let top = cy - h - 18;
    if (top < 8) top = cy + 18;
    top = Math.max(8, Math.min(top, vh - h - 8));
    const left = Math.max(8, Math.min(cx - w / 2, vw - w - 8));
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.visibility = 'visible';
  }, [mapRef, landmark, onClose]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let frame: number | null = null;
    const again = () => { if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; place(); }); };
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Element | null;
      if (t && (node.current?.contains(t) || t.closest('.wm-lm'))) return;
      onClose();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); onClose(); } };
    map.on('move', again);
    window.addEventListener('resize', again);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      map.off('move', again);
      window.removeEventListener('resize', again);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [mapRef, place, onClose]);

  return (
    <Portal>
      <div
        ref={(n) => { node.current = n; if (n) place(); }}
        className="wm-lmpop" role="dialog" aria-label={landmark.name} style={{ visibility: 'hidden' }}
      >
        <h3>{landmark.name}</h3>
        {landmark.description.trim() && <p>{landmark.description}</p>}
      </div>
    </Portal>
  );
}
