// Gavelling Crisis map: the animation shown when a new map arrives from the server (a send, a reply's map
// effects, or a live change). Pure helpers plus one small controller. Nothing here is React state: frames
// move markers with setLngLat and update two overlay sources; the real layers always hold the final data,
// so an animation that is cut short can never leave the map wrong.

import type { Feature, FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import type { Multi, Pt } from '@/lib/crisis/geo';
import { toGeometry, vertexCount } from '@/lib/crisis/geo';
import type { MapData } from './mapEdits';

type LL = [number, number];

export interface MapDiff {
  moved: Array<{ id: string; from: LL; to: LL }>;
  added: string[];
  removed: string[];
  regions: Array<{ key: string; ownerFrom: string | null; ownerTo: string | null; geomFrom: unknown; geomTo: unknown; geomChanged: boolean }>;
  shapes: Array<{ id: string; kind: string; ownerFrom: string | null; ownerTo: string | null; geomFrom: unknown; geomTo: unknown; colorFrom: string | null; colorTo: string | null }>;
}

/** Element clones of removed unit tokens, collected by the marker effect and faded out by the controller. */
export interface PendingAnim { diff: MapDiff; ghosts: Array<{ el: HTMLElement; at: LL }>; /** Where each moved unit was DRAWN on this screen just before the new data landed. */ drawn: Map<string, LL> }

export function prefersReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

const MAX_UNIT_ANIMS = 40;

/** What changed between two server reads of the map. Null when nothing worth animating changed. */
export function diffMapData(prev: MapData, next: MapData): MapDiff | null {
  const diff: MapDiff = { moved: [], added: [], removed: [], regions: [], shapes: [] };
  const pu = new Map(prev.units.map((u) => [u.id, u]));
  const nu = new Map(next.units.map((u) => [u.id, u]));
  for (const [id, u] of nu) {
    const o = pu.get(id);
    if (!o) { diff.added.push(id); continue; }
    if (o.lng !== u.lng || o.lat !== u.lat) diff.moved.push({ id, from: [o.lng, o.lat], to: [u.lng, u.lat] });
  }
  for (const id of pu.keys()) if (!nu.has(id)) diff.removed.push(id);
  diff.moved = diff.moved.slice(0, MAX_UNIT_ANIMS);

  const pr = new Map(prev.regions.map((r) => [r.region_key, r]));
  const nr = new Map(next.regions.map((r) => [r.region_key, r]));
  for (const key of new Set([...pr.keys(), ...nr.keys()])) {
    const a = pr.get(key); const b = nr.get(key);
    const ownerFrom = a?.owner_cabinet_id ?? null; const ownerTo = b?.owner_cabinet_id ?? null;
    const geomFrom = a?.geometry ?? null; const geomTo = b?.geometry ?? null;
    const geomChanged = JSON.stringify(geomFrom) !== JSON.stringify(geomTo);
    if (ownerFrom !== ownerTo || geomChanged) diff.regions.push({ key, ownerFrom, ownerTo, geomFrom, geomTo, geomChanged });
  }

  const ps = new Map(prev.shapes.map((s) => [s.id, s]));
  const ns = new Map(next.shapes.map((s) => [s.id, s]));
  for (const id of new Set([...ps.keys(), ...ns.keys()])) {
    const a = ps.get(id); const b = ns.get(id);
    const kind = (b ?? a)!.kind;
    if (kind === 'line') continue;
    if (a && b && JSON.stringify(a.geometry) === JSON.stringify(b.geometry) && a.owner_cabinet_id === b.owner_cabinet_id) continue;
    diff.shapes.push({
      id, kind, ownerFrom: a?.owner_cabinet_id ?? null, ownerTo: b?.owner_cabinet_id ?? null,
      geomFrom: a?.geometry ?? null, geomTo: b?.geometry ?? null, colorFrom: a?.color ?? null, colorTo: b?.color ?? null,
    });
  }

  const any = diff.moved.length || diff.added.length || diff.removed.length || diff.regions.length || diff.shapes.length;
  return any ? diff : null;
}

export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/** Runs `frame(t)` for `ms` milliseconds (t from 0 to 1, always ending on exactly 1), then `done`. Returns a cancel that jumps to the end. */
export function runFrames(ms: number, frame: (t: number) => void, done: () => void): () => void {
  let raf = 0; let over = false;
  const t0 = performance.now();
  const finish = () => {
    if (over) return;
    over = true;
    window.cancelAnimationFrame(raf);
    try { frame(1); } finally { done(); }
  };
  const tick = (now: number) => {
    if (over) return;
    const t = Math.min(1, (now - t0) / ms);
    if (t >= 1) { finish(); return; }
    frame(t);
    raf = window.requestAnimationFrame(tick);
  };
  raf = window.requestAnimationFrame(tick);
  return finish;
}

function rawPoints(m: Multi): Pt[] {
  const out: Pt[] = [];
  for (const poly of m) for (const ring of poly) for (const p of ring) out.push(p);
  return out;
}

function sameShape(a: Multi, b: Multi): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) if (a[i][j].length !== b[i][j].length) return false;
  }
  return true;
}

/** Vertex by vertex blend between two outlines with the same structure. */
function lerpMulti(a: Multi, b: Multi, t: number): Multi {
  return b.map((poly, i) => poly.map((ring, j) => ring.map((p, k): Pt => {
    const q = a[i][j][k];
    return [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t];
  })));
}

function scaleMulti(m: Multi, about: Pt, k: number): Multi {
  return m.map((poly) => poly.map((ring) => ring.map((p): Pt => [about[0] + (p[0] - about[0]) * k, about[1] + (p[1] - about[1]) * k])));
}

export interface GrowItem { from: Multi | null; to: Multi | null; color: string }

const SRC_TRAILS = 'anim-trails';
const SRC_GROW = 'anim-grow';
const L_TRAIL = 'anim-trail';
const L_GROW_FILL = 'anim-grow-fill';
const L_GROW_LINE = 'anim-grow-line';
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const MOVE_MS = 1500;
const TRAIL_FADE_MS = 700;
const GROW_MS = 1700;
const MORPH_VERTEX_LIMIT = 12000;

/** Owns every running animation of one map. `cancelAll` jumps each to its real final state. */
export function createMapAnimator(getMap: () => MLMap | null) {
  const cancels = new Set<() => void>();
  const ghostMarkers = new Set<MLMarker>();

  const ensureLayers = (map: MLMap) => {
    if (map.getSource(SRC_TRAILS)) return;
    map.addSource(SRC_TRAILS, { type: 'geojson', data: EMPTY });
    map.addSource(SRC_GROW, { type: 'geojson', data: EMPTY });
    const before = map.getLayer('draft-fill') ? 'draft-fill' : undefined;
    map.addLayer({ id: L_GROW_FILL, type: 'fill', source: SRC_GROW, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0 } }, before);
    map.addLayer({ id: L_GROW_LINE, type: 'line', source: SRC_GROW, layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3.2, 'line-opacity': 0 } }, before);
    map.addLayer({ id: L_TRAIL, type: 'line', source: SRC_TRAILS, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0 } }, before);
  };
  const setSrc = (map: MLMap, id: string, fc: FeatureCollection) => {
    try { (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc); } catch { /* style still loading */ }
  };
  const setPaint = (map: MLMap, layer: string, prop: string, v: number) => {
    try { map.setPaintProperty(layer, prop as Parameters<MLMap["setPaintProperty"]>[1], v); } catch { /* layer not there */ }
  };
  const track = (cancel: () => void, finishHook?: () => void): void => {
    const wrapped = () => { cancels.delete(wrapped); cancel(); finishHook?.(); };
    cancels.add(wrapped);
  };

  /** Units glide from the old spot to the new one, with a trail that fades. `finalOf` is the real position now. */
  const moveUnits = (
    moves: Array<MapDiff['moved'][number] & { still?: boolean }>,
    markerOf: (id: string) => { marker: MLMarker; el: HTMLElement } | undefined,
    finalOf: (id: string) => LL | undefined,
    colorOf: (id: string) => string,
  ) => {
    const map = getMap();
    const live = moves.filter((m) => markerOf(m.id));
    if (!map || !live.length) return;
    ensureLayers(map);
    const total = MOVE_MS + TRAIL_FADE_MS;
    const fc = (t: number): FeatureCollection => {
      const e = easeInOut(Math.min(1, (t * total) / MOVE_MS));
      return {
        type: 'FeatureCollection',
        features: live.map((m): Feature => ({
          type: 'Feature', properties: { color: colorOf(m.id) },
          geometry: { type: 'LineString', coordinates: [m.from, m.still ? m.to : [m.from[0] + (m.to[0] - m.from[0]) * e, m.from[1] + (m.to[1] - m.from[1]) * e]] },
        })),
      };
    };
    const cancel = runFrames(total, (t) => {
      const e = easeInOut(Math.min(1, (t * total) / MOVE_MS));
      for (const m of live) {
        const mk = markerOf(m.id);
        if (!mk || m.still || mk.el.dataset.drag) continue;
        const fin = finalOf(m.id) ?? m.to;
        // While moving, blend to the real final spot (it can change if another read lands mid-glide).
        const to: LL = t >= 1 ? fin : [m.from[0] + (fin[0] - m.from[0]) * e, m.from[1] + (fin[1] - m.from[1]) * e];
        mk.marker.setLngLat(to);
      }
      const moving = t * total < MOVE_MS;
      setSrc(map, SRC_TRAILS, t >= 1 ? EMPTY : fc(t));
      setPaint(map, L_TRAIL, 'line-opacity', t >= 1 ? 0 : moving ? 0.75 : 0.75 * (1 - (t * total - MOVE_MS) / TRAIL_FADE_MS));
    }, () => {
      for (const m of live) {
        const mk = markerOf(m.id); const fin = finalOf(m.id);
        if (mk && fin && !m.still && !mk.el.dataset.drag) mk.marker.setLngLat(fin);
      }
      setSrc(map, SRC_TRAILS, EMPTY);
      setPaint(map, L_TRAIL, 'line-opacity', 0);
    });
    track(cancel);
    // Frame 0 now, so the token is never seen at its new place for a frame.
    for (const m of live) if (!m.still) markerOf(m.id)?.marker.setLngLat(m.from);
  };

  /** New units pop in; removed ones (their cloned token) shrink away. */
  const popUnits = (added: Array<HTMLElement | undefined>, ghosts: PendingAnim['ghosts']) => {
    const map = getMap();
    for (const el of added) {
      const tok = el?.firstElementChild as HTMLElement | null | undefined;
      if (!tok?.animate) continue;
      tok.animate(
        [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 650, easing: 'ease-out' },
      );
    }
    if (!map) return;
    void import('maplibre-gl').then((ml) => {
      const m2 = getMap();
      if (!m2) return;
      for (const g of ghosts.slice(0, MAX_UNIT_ANIMS)) {
        const mk = new ml.Marker({ element: g.el, anchor: 'center' }).setLngLat(g.at).addTo(m2);
        ghostMarkers.add(mk);
        g.el.style.pointerEvents = 'none';
        const tok = (g.el.firstElementChild as HTMLElement | null) ?? g.el;
        const a = tok.animate?.([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.4)', opacity: 0 }], { duration: 700, easing: 'ease-in', fill: 'forwards' });
        const drop = () => { mk.remove(); ghostMarkers.delete(mk); };
        if (a) a.onfinish = drop; else drop();
      }
    });
  };

  /** Territory that changed shape or hands: its new outline sweeps out from the old one; lost land fades away. */
  const growAreas = (items: GrowItem[]) => {
    const map = getMap();
    if (!map || !items.length) return;
    ensureLayers(map);
    const heavy = items.reduce((n, it) => n + vertexCount(it.to ?? []) + vertexCount(it.from ?? []), 0) > MORPH_VERTEX_LIMIT;
    const fcAt = (e: number): FeatureCollection => ({
      type: 'FeatureCollection',
      features: items.flatMap((it): Feature[] => {
        let m: Multi;
        if (!it.to) m = it.from ?? [];
        else if (heavy || it.from === it.to) m = it.to;
        else if (it.from && it.from.length && sameShape(it.from, it.to)) m = lerpMulti(it.from, it.to, e);
        else if (!it.from || !it.from.length) {
          const pts = rawPoints(it.to);
          if (!pts.length) return [];
          const c: Pt = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
          m = scaleMulti(it.to, c, 0.55 + 0.45 * e);
        } else m = it.to;
        if (!m.length) return [];
        return [{ type: 'Feature', properties: { color: it.color }, geometry: toGeometry(m) as unknown as Feature['geometry'] }];
      }),
    });
    const anyMorph = !heavy && items.some((it) => it.to && it.from !== it.to);
    let staticSet = false;
    const opacity = (t: number) => (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
    const cancel = runFrames(GROW_MS, (t) => {
      const e = easeInOut(Math.min(1, t / 0.7));
      if (anyMorph) setSrc(map, SRC_GROW, fcAt(e));
      else if (!staticSet) { staticSet = true; setSrc(map, SRC_GROW, fcAt(1)); }
      const o = opacity(t);
      setPaint(map, L_GROW_FILL, 'fill-opacity', 0.42 * o);
      setPaint(map, L_GROW_LINE, 'line-opacity', o);
    }, () => {
      setSrc(map, SRC_GROW, EMPTY);
      setPaint(map, L_GROW_FILL, 'fill-opacity', 0);
      setPaint(map, L_GROW_LINE, 'line-opacity', 0);
    });
    track(cancel);
  };

  /** A plain 0..1 tween (country tints) that always lands on its final call. */
  const tween = (ms: number, frame: (e: number) => void, done: () => void) => {
    track(runFrames(ms, (t) => frame(easeInOut(t)), done));
  };

  const cancelAll = () => {
    for (const c of [...cancels]) { try { c(); } catch { /* map already gone */ } }
    cancels.clear();
    for (const mk of ghostMarkers) mk.remove();
    ghostMarkers.clear();
  };

  return { moveUnits, popUnits, growAreas, tween, cancelAll };
}
