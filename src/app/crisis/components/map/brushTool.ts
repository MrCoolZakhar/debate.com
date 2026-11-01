'use client';
// Gavelling Crisis map: the Paint and Erase brushes on the live map. This hook owns everything that happens between the
// pointer and the finished stroke: the round pen that follows the pointer (drawn as a map layer, so it is exactly the
// size of the stroke it will paint), the stroke as it grows while the button is down, and handing the finished stroke
// to the caller. It writes nothing: the caller turns a stroke into a map change (and one undo step). The map's own
// handlers call press / move / release; nothing here runs per second and no React state changes while dragging.

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Feature, FeatureCollection } from 'geojson';
import type { Map as MLMap } from 'maplibre-gl';
import type { Multi, Pt } from '@/lib/crisis/geo';
import { DRAFT, SRC_BRUSH } from './mapStyle';
import { brushCircle, finishStroke, growStroke } from './brush';
import { cabinetTint } from '../../crisisKit';

export type BrushMode = 'paint' | 'erase';

interface PointerLike { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: Event; preventDefault: () => void }

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface BrushOptions {
  /** The map exists and its sources are added. */
  ready: boolean;
  mapRef: MutableRefObject<MLMap | null>;
  setSource: (id: string, fc: FeatureCollection) => void;
  /** The brush tool in use, or null (any other tool). */
  mode: BrushMode | null;
  /** The pen's radius in km. */
  km: number;
  /** The painter's colour (Paint), or null (Erase, or nobody picked). */
  color: string | null;
  /** The finished stroke (outline, already simplified). Called once per stroke, on release. */
  onStroke: (mode: BrushMode, stroke: Multi) => void;
}

export interface Brush {
  /** A press on the map: starts a stroke. Answers true when the brush took the press (the map must not pan). */
  press: (e: PointerLike) => boolean;
  /** The pointer moved: moves the pen and grows the stroke. Answers true while a stroke is down. */
  move: (e: PointerLike) => boolean;
  /** The button went up: finishes the stroke. Answers true when there was one. */
  release: () => boolean;
  /** Escape: drops the stroke being dragged. Answers true when there was one. */
  cancel: () => boolean;
  /** A stroke is being dragged right now. */
  isDown: () => boolean;
}

export function useBrush(o: BrushOptions): Brush {
  const opts = useRef(o);
  useEffect(() => { opts.current = o; });
  const down = useRef<{ acc: Multi; last: Pt; at: { x: number; y: number } } | null>(null);
  /** Where the pointer last was on the screen (so the pen can be redrawn when the map moves under a still pointer). */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  const render = useMemo(() => () => {
    const { mapRef, setSource, mode, km, color, ready } = opts.current;
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!mode) { setSource(SRC_BRUSH, empty); return; }
    const edge = mode === 'paint' && color ? cabinetTint(color, 0.95) : cabinetTint(DRAFT, 0.95);
    const tint = mode === 'paint' && color ? cabinetTint(color, 0.3) : cabinetTint(DRAFT, 0.3);
    const features: Feature[] = [];
    const st = down.current;
    if (st && st.acc.length) features.push({ type: 'Feature', properties: { part: 'stroke', tint, edge }, geometry: { type: 'MultiPolygon', coordinates: st.acc } });
    const p = pointer.current;
    if (p) {
      const ll = map.unproject([p.x, p.y]);
      features.push({ type: 'Feature', properties: { part: 'cursor', edge }, geometry: { type: 'Polygon', coordinates: [brushCircle(ll.lng, ll.lat, km)] } });
    }
    setSource(SRC_BRUSH, features.length ? { type: 'FeatureCollection', features } : empty);
  }, []);

  const schedule = useMemo(() => () => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => { frame.current = null; render(); });
  }, [render]);

  // The pen follows size, colour and tool changes, and stays under the pointer while the map pans or zooms.
  const { ready, mode, km, color } = o;
  useEffect(() => {
    if (!mode) { down.current = null; pointer.current = null; }
    render();
  }, [ready, mode, km, color, render]);
  useEffect(() => {
    const map = o.mapRef.current;
    if (!ready || !map || !mode) return;
    const again = () => schedule();
    const leave = () => { pointer.current = null; schedule(); };
    const el = map.getCanvasContainer();
    map.on('move', again);
    el.addEventListener('mouseleave', leave);
    return () => { map.off('move', again); el.removeEventListener('mouseleave', leave); };
  }, [ready, mode, o.mapRef, schedule]);
  useEffect(() => () => { if (frame.current !== null) window.cancelAnimationFrame(frame.current); }, []);

  return useMemo<Brush>(() => ({
    press: (e) => {
      const { mode: m, km: size, ready: r } = opts.current;
      if (!r || !m) return false;
      const oe = e.originalEvent as MouseEvent;
      const tg = e.originalEvent.target as HTMLElement | null;
      // Shift and drag (or a right or middle button) moves the map instead.
      if (oe.shiftKey || oe.button > 0 || tg?.closest('.wm-marker')) return false;
      e.preventDefault();
      const first: Pt = [e.lngLat.lng, e.lngLat.lat];
      let acc: Multi = [];
      try { acc = growStroke([], null, first, size); } catch { acc = []; }
      down.current = { acc, last: first, at: { x: e.point.x, y: e.point.y } };
      pointer.current = { x: e.point.x, y: e.point.y };
      schedule();
      return true;
    },
    move: (e) => {
      const { mode: m, km: size } = opts.current;
      if (!m) return false;
      pointer.current = { x: e.point.x, y: e.point.y };
      const st = down.current;
      if (st) {
        // A new piece of the stroke every few pixels, not every pixel.
        const map = opts.current.mapRef.current;
        let step = 4;
        if (map) {
          const a = map.project([e.lngLat.lng, e.lngLat.lat]);
          const b = map.project([e.lngLat.lng, Math.min(84, e.lngLat.lat + size / 111.2)]);
          step = Math.max(3, Math.abs(a.y - b.y) / 6);
        }
        if (Math.hypot(e.point.x - st.at.x, e.point.y - st.at.y) >= step) {
          const to: Pt = [e.lngLat.lng, e.lngLat.lat];
          try { st.acc = growStroke(st.acc, st.last, to, size); } catch { /* keep the stroke so far */ }
          st.last = to; st.at = { x: e.point.x, y: e.point.y };
        }
      }
      schedule();
      return !!st;
    },
    release: () => {
      const st = down.current;
      if (!st) return false;
      down.current = null;
      const { mode: m, km: size } = opts.current;
      let stroke: Multi = [];
      try { stroke = finishStroke(st.acc, size); } catch { stroke = []; }
      schedule();
      if (m && stroke.length) opts.current.onStroke(m, stroke);
      return true;
    },
    cancel: () => {
      if (!down.current) return false;
      down.current = null;
      schedule();
      return true;
    },
    isDown: () => !!down.current,
  }), [schedule]);
}
