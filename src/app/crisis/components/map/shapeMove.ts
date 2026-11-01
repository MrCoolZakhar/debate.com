'use client';
// Gavelling Crisis map: carrying a whole shape somewhere else. A selected drawn area, a selected zone, or a shape being
// drawn or reshaped shows a small round Move button just above its middle; dragging the button (or, for a shape in hand, its body) shifts
// every corner by the same amount. The shift is worked out in Mercator space so the shape keeps its look at every
// latitude, and is limited so no corner leaves the map. This hook owns the pointer and the handle and shows a preview
// while dragging; it writes nothing: the caller turns the finished move into a map change (one undo step).

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import { bboxOf, labelPoint, pointIn, type Bbox, type Multi, type Pt } from '@/lib/crisis/geo';

const D2R = Math.PI / 180;
const LAT_LIMIT = 84;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * D2R) / 2));
const invMercY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / D2R;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** How far a shape moves: degrees of longitude, and Mercator units north. */
export interface Shift { dx: number; dy: number }

export function shiftBetween(a: Pt, b: Pt): Shift {
  return { dx: b[0] - a[0], dy: mercY(b[1]) - mercY(a[1]) };
}

/** The shift cut back so every corner of a shape inside `box` stays on the map. */
export function limitShift(box: Bbox, s: Shift): Shift {
  const dx = Math.max(-180 - box[0], Math.min(180 - box[2], s.dx));
  const lo = mercY(-LAT_LIMIT) - mercY(box[1]);
  const hi = mercY(LAT_LIMIT) - mercY(box[3]);
  const dy = lo > hi ? 0 : Math.max(lo, Math.min(hi, s.dy));
  return { dx, dy };
}

export function shiftPt(p: Pt, s: Shift): Pt {
  return [round5(p[0] + s.dx), round5(invMercY(mercY(p[1]) + s.dy))];
}

export function shiftMulti(m: Multi, s: Shift): Multi {
  return m.map((poly) => poly.map((ring) => ring.map((p) => shiftPt(p, s))));
}

/** True when a shift is more than rounding noise. */
export const isShift = (s: Shift): boolean => Math.abs(s.dx) > 1e-6 || Math.abs(s.dy) > 1e-8;

/** The layers that draw a stored shape and its selection: while one is carried, the original is hidden so only the moving copy shows. */
const SHAPE_LAYERS = ['shape-area-fill', 'shape-area-line', 'shape-line', 'zone-fill', 'zone-control', 'zone-line'];
const SELECTION_LAYERS = ['sel-fill', 'sel-halo', 'sel-line'];

/**
 * A small round white button with the four-arrow move icon. The marker element itself is positioned by MapLibre (it owns
 * its transform), so the button is a child: it scales a little on hover and while it is carried.
 */
function makeMoveHandle(): { el: HTMLElement; grab: (on: boolean) => void } {
  const el = document.createElement('div');
  el.className = 'wm-marker wm-shape-handle';
  el.title = 'Drag to move the whole shape';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Move the whole shape');
  Object.assign(el.style, { width: '34px', height: '34px', zIndex: '3', cursor: 'move', userSelect: 'none', touchAction: 'none' });
  const btn = document.createElement('div');
  Object.assign(btn.style, {
    width: '34px', height: '34px', borderRadius: '50%', background: '#FFFFFF', color: '#1B3828', display: 'grid', placeItems: 'center',
    boxShadow: '0 0 0 1px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.28)', transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
    cursor: 'move', pointerEvents: 'none',
  });
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>'
    + '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/></svg>';
  el.appendChild(btn);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let grabbing = false;
  const look = (hover: boolean) => {
    btn.style.transform = reduce ? 'none' : grabbing ? 'scale(1.12)' : hover ? 'scale(1.1)' : 'none';
    btn.style.boxShadow = grabbing || hover ? '0 0 0 1.5px #1B3828, 0 3px 10px rgba(27,56,40,0.32)' : '0 0 0 1px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.28)';
  };
  el.addEventListener('pointerenter', () => look(true));
  el.addEventListener('pointerleave', () => look(false));
  // A drag that ends on the handle must not also count as a click on the map under it.
  el.addEventListener('click', (ev) => ev.stopPropagation());
  el.addEventListener('dblclick', (ev) => ev.stopPropagation());
  return { el, grab: (on) => { grabbing = on; el.style.cursor = on ? 'grabbing' : 'move'; look(false); } };
}

interface PointerLike { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: Event; preventDefault: () => void }

export interface MoverOptions {
  /** The map exists and its sources are added. */
  ready: boolean;
  mapRef: MutableRefObject<MLMap | null>;
  mlRef: MutableRefObject<typeof import('maplibre-gl') | null>;
  /** The outline that can be moved now (a stable value: it changes only when the shape does), or null when nothing can. */
  shape: Multi | null;
  /** Pressing inside the shape may start a drag of its body (false: only the Move handle moves it). */
  body: boolean;
  /** Extra veto for a body press (such as a press on the outline, which reshapes instead). */
  blocked?: (e: PointerLike) => boolean;
  /** The id of the stored shape being carried (a drawn area or a zone): its original is hidden while the moving copy shows. */
  hideId?: string | null;
  /** The shape as it would be after the move while dragging; null when the drag ends. */
  preview: (moved: Multi | null) => void;
  /** The finished move. */
  onMove: (moved: Multi, shift: Shift) => void;
}

export interface Mover {
  /** A press on the map: starts a body drag when it is inside the shape. Answers true when it took the press. */
  press: (e: PointerLike) => boolean;
  /** The pointer moved: answers true while a body drag is down. */
  move: (e: PointerLike) => boolean;
  /** The button went up: answers true when a drag moved the shape (a plain click answers false). */
  release: () => boolean;
  /** Escape: drops the drag. Answers true when there was one. */
  cancel: () => boolean;
  isDown: () => boolean;
}

export function useShapeMover(o: MoverOptions): Mover {
  const opts = useRef(o);
  useEffect(() => { opts.current = o; });
  const down = useRef<{ from: Pt; at: { x: number; y: number }; shift: Shift; moved: boolean } | null>(null);
  const frame = useRef<number | null>(null);

  // While a shape is carried, its original and its selection outline are hidden, so there is one moving copy and no doubled outline.
  const ghost = useRef<{ filters: Map<string, unknown>; visible: Map<string, unknown> } | null>(null);
  const setGhost = useRef((on: boolean) => {
    const map = opts.current.mapRef.current;
    if (!map) { ghost.current = null; return; }
    try {
      if (on && !ghost.current) {
        const id = opts.current.hideId;
        const filters = new Map<string, unknown>(); const visible = new Map<string, unknown>();
        if (id) {
          for (const l of SHAPE_LAYERS) {
            if (!map.getLayer(l)) continue;
            const f = map.getFilter(l);
            filters.set(l, f ?? null);
            map.setFilter(l, (f ? ['all', f, ['!=', ['get', 'id'], id]] : ['!=', ['get', 'id'], id]) as never);
          }
        }
        for (const l of SELECTION_LAYERS) {
          if (!map.getLayer(l)) continue;
          visible.set(l, map.getLayoutProperty(l, 'visibility') ?? 'visible');
          map.setLayoutProperty(l, 'visibility', 'none');
        }
        ghost.current = { filters, visible };
      } else if (!on && ghost.current) {
        const g = ghost.current; ghost.current = null;
        g.filters.forEach((f, l) => { if (map.getLayer(l)) map.setFilter(l, f as never); });
        g.visible.forEach((v, l) => { if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', v as 'visible' | 'none'); });
      }
    } catch { /* the map is going away */ }
  });

  // The Move handle: a marker in the middle of the shape, dragged like any marker.
  const { ready, shape } = o;
  useEffect(() => {
    const map = o.mapRef.current; const ml = o.mlRef.current;
    if (!ready || !map || !ml || !shape || !shape.length) return;
    const box = bboxOf(shape);
    if (!box) return;
    const at: Pt = labelPoint(shape) ?? [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const handle = makeMoveHandle();
    // Just above the middle, where the shape's name sits, so it never covers the label.
    const mk: MLMarker = new ml.Marker({ element: handle.el, draggable: true, anchor: 'center', offset: [0, -26] }).setLngLat(at).addTo(map);
    mk.on('dragstart', () => { handle.grab(true); setGhost.current(true); });
    const shiftNow = (): Shift => {
      const ll = mk.getLngLat();
      return limitShift(box, shiftBetween(at, [ll.lng, ll.lat]));
    };
    mk.on('drag', () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const s = shiftNow();
        if (isShift(s)) opts.current.preview(shiftMulti(shape, s));
      });
    });
    mk.on('dragend', () => {
      handle.grab(false); setGhost.current(false);
      if (frame.current !== null) { window.cancelAnimationFrame(frame.current); frame.current = null; }
      const s = shiftNow();
      const p0 = map.project(at); const ll = mk.getLngLat(); const p1 = map.project([ll.lng, ll.lat]);
      opts.current.preview(null);
      mk.setLngLat(at);
      if (Math.hypot(p0.x - p1.x, p0.y - p1.y) < 3 || !isShift(s)) return;
      opts.current.onMove(shiftMulti(shape, s), s);
    });
    return () => {
      if (frame.current !== null) { window.cancelAnimationFrame(frame.current); frame.current = null; }
      setGhost.current(false);
      mk.remove();
    };
  }, [ready, shape, o.mapRef, o.mlRef]);

  useEffect(() => () => { if (frame.current !== null) window.cancelAnimationFrame(frame.current); }, []);

  return useMemo<Mover>(() => ({
    press: (e) => {
      const { shape: sh, body, ready: r, blocked } = opts.current;
      if (!r || !body || !sh || !sh.length) return false;
      const oe = e.originalEvent as MouseEvent;
      const tg = e.originalEvent.target as HTMLElement | null;
      // Shift and drag (or a right or middle button) moves the map instead; markers are their own handles.
      if (oe.shiftKey || oe.button > 0 || tg?.closest('.wm-marker, .maplibregl-marker')) return false;
      const from: Pt = [e.lngLat.lng, e.lngLat.lat];
      if (!pointIn(from, sh) || blocked?.(e)) return false;
      e.preventDefault();
      down.current = { from, at: { x: e.point.x, y: e.point.y }, shift: { dx: 0, dy: 0 }, moved: false };
      return true;
    },
    move: (e) => {
      const st = down.current;
      const { shape: sh } = opts.current;
      if (!st || !sh) return false;
      if (!st.moved && Math.hypot(e.point.x - st.at.x, e.point.y - st.at.y) < 4) return true;
      if (!st.moved) setGhost.current(true);
      st.moved = true;
      const box = bboxOf(sh);
      if (!box) return true;
      st.shift = limitShift(box, shiftBetween(st.from, [e.lngLat.lng, e.lngLat.lat]));
      if (frame.current === null) {
        frame.current = window.requestAnimationFrame(() => {
          frame.current = null;
          const cur = down.current; const s2 = opts.current.shape;
          if (cur && s2 && cur.moved && isShift(cur.shift)) opts.current.preview(shiftMulti(s2, cur.shift));
        });
      }
      return true;
    },
    release: () => {
      const st = down.current;
      if (!st) return false;
      down.current = null;
      if (frame.current !== null) { window.cancelAnimationFrame(frame.current); frame.current = null; }
      const { shape: sh } = opts.current;
      setGhost.current(false);
      opts.current.preview(null);
      if (!st.moved || !sh || !isShift(st.shift)) return false;
      opts.current.onMove(shiftMulti(sh, st.shift), st.shift);
      return true;
    },
    cancel: () => {
      if (!down.current) return false;
      down.current = null;
      if (frame.current !== null) { window.cancelAnimationFrame(frame.current); frame.current = null; }
      setGhost.current(false);
      opts.current.preview(null);
      return true;
    },
    isDown: () => !!down.current,
  }), []);
}
