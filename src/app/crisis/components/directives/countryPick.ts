'use client';
// Gavelling Crisis: the countries a backroomer can pick by name (a unit's destination, a border).
// Same offline world file the war map draws; each country gets a centre point inside its biggest land piece.

import type { Geometry, MultiPolygon, Polygon } from 'geojson';
import { loadWorldData, type LngLat } from '../map/mapData';

export interface CountryOption { key: string; name: string; center: LngLat }

function polygonsOf(g: Geometry): number[][][][] {
  if (g.type === 'Polygon') return [(g as Polygon).coordinates];
  if (g.type === 'MultiPolygon') return (g as MultiPolygon).coordinates;
  return [];
}

/** Centroid and area of an outer ring (planar, like the map's own label centres). */
function ringCentroid(ring: number[][]): { area: number; c: LngLat } {
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i]; const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return { area: 0, c: [ring[0]?.[0] ?? 0, ring[0]?.[1] ?? 0] };
  return { area: Math.abs(a / 2), c: [cx / (3 * a), cy / (3 * a)] };
}

function centerOf(g: Geometry): LngLat {
  let best = -1; let c: LngLat = [0, 0];
  for (const poly of polygonsOf(g)) {
    if (!poly[0]?.length) continue;
    const r = ringCentroid(poly[0]);
    if (r.area > best) { best = r.area; c = r.c; }
  }
  return c;
}

let cache: Promise<CountryOption[]> | null = null;

/** Every country by name (A to Z) with a point to send a unit to. Loaded once, only when asked. */
export function loadCountries(): Promise<CountryOption[]> {
  if (!cache) {
    cache = loadWorldData().then((w) => {
      const out: CountryOption[] = [];
      for (const [key, v] of w.byKey) out.push({ key, name: v.name, center: centerOf(v.geometry) });
      return out.sort((a, b) => a.name.localeCompare(b.name));
    }).catch((e) => { cache = null; throw e; });
  }
  return cache;
}
