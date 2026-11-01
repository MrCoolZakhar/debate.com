'use client';
// Gavelling Crisis map: the corner handles of a selected zone, the same ones a drawn area has. A white corner on every
// corner of every piece (and every hole): drag it to move it, double-click it to remove it. A small dot in the middle of
// every side: drag it out into a new corner (a plain click adds the corner where the dot is). This only shows the handles
// and a preview while one is dragged; it writes nothing: `commit` gets the finished outline (one change, one undo step).

import type { Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import { AREA_EPS, areaOf, clean, withCornerAdded, withCornerMoved, withCornerRemoved, type Multi } from '@/lib/crisis/geo';
import { clampLat, clampLng, type LngLat } from './mapData';
import { makeCorner, makeMidpoint } from './tokens';

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const snap = (ll: { lng: number; lat: number }): LngLat => [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))];

export function mountZoneHandles(o: {
  map: MLMap; ml: typeof import('maplibre-gl'); base: Multi;
  /** Shows the outline as it would be while a handle is dragged; null puts the ordinary view back. */
  preview: (m: Multi | null) => void;
  /** The outline the handles made, already tidied. */
  commit: (next: Multi) => void;
  fail: (text: string) => void;
}): () => void {
  const { map, ml, base, preview, commit, fail } = o;
  const marks: MLMarker[] = [];
  const keep = (next: Multi | null, undo: () => void) => {
    preview(null);
    if (!next) { undo(); return; }
    try {
      const tidy = clean(next);
      if (areaOf(tidy) <= AREA_EPS) { undo(); fail('That shape has no area. Try a smaller move.'); return; }
      commit(tidy);
    } catch {
      undo();
      fail('That shape could not be worked out. Try a smaller move.');
    }
  };
  base.forEach((poly, pi) => poly.forEach((ring, ri) => {
    for (let vi = 0; vi < ring.length - 1; vi++) {
      const el = makeCorner();
      const start = ring[vi];
      const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(start).addTo(map);
      mk.on('drag', () => { const ll = mk.getLngLat(); preview(withCornerMoved(base, pi, ri, vi, [ll.lng, ll.lat])); });
      mk.on('dragend', () => {
        const ll = mk.getLngLat();
        const a = map.project(start); const b = map.project([ll.lng, ll.lat]);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 2) { preview(null); return; }
        keep(withCornerMoved(base, pi, ri, vi, snap(ll)), () => mk.setLngLat(start));
      });
      el.addEventListener('click', (ev) => ev.stopPropagation());
      el.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        const next = withCornerRemoved(base, pi, ri, vi);
        if (!next) { fail('A shape needs at least three corners.'); return; }
        keep(next, () => undefined);
      });
      marks.push(mk);
    }
    for (let si = 0; si < ring.length - 1; si++) {
      const a = ring[si]; const b = ring[si + 1];
      const at: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const el = makeMidpoint();
      const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(at).addTo(map);
      let moved = false;
      mk.on('dragstart', () => { moved = true; });
      mk.on('drag', () => { const ll = mk.getLngLat(); preview(withCornerAdded(base, pi, ri, si, [ll.lng, ll.lat])); });
      mk.on('dragend', () => {
        const ll = mk.getLngLat();
        const p0 = map.project(at); const p1 = map.project([ll.lng, ll.lat]);
        window.setTimeout(() => { moved = false; }, 80);
        if (Math.hypot(p0.x - p1.x, p0.y - p1.y) < 3) { mk.setLngLat(at); preview(null); return; }
        keep(withCornerAdded(base, pi, ri, si, snap(ll)), () => mk.setLngLat(at));
      });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (moved) return;
        keep(withCornerAdded(base, pi, ri, si, [round5(at[0]), round5(at[1])]), () => undefined);
      });
      el.addEventListener('dblclick', (ev) => ev.stopPropagation());
      marks.push(mk);
    }
  }));
  return () => { for (const m of marks) m.remove(); };
}
