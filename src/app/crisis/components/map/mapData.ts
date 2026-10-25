'use client';
// Gavelling Crisis war map: the offline world (Natural Earth 50m through world-atlas), unit kinds
// and the small geometry helpers the map needs. Nothing here makes a network request: the
// TopoJSON is bundled with the app and loaded only when a map mounts.

import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { UnitKind } from '@/lib/crisis/types';

export const SEA = '#DCE4DA';
export const LAND = '#F5F0E4';
export const LAND_LINE = '#CBBE9F';

export const KIND_META: Record<UnitKind, { label: string; sight: number }> = {
  army: { label: 'Army', sight: 450 },
  navy: { label: 'Navy', sight: 650 },
  air: { label: 'Air force', sight: 950 },
  missile: { label: 'Missiles', sight: 800 },
  base: { label: 'Base', sight: 450 },
  spy: { label: 'Spy', sight: 220 },
  sub: { label: 'Submarine', sight: 500 },
  custom: { label: 'Other', sight: 400 },
};
export const KIND_ORDER: UnitKind[] = ['army', 'navy', 'air', 'missile', 'base', 'spy', 'sub', 'custom'];

export type LngLat = [number, number];

export interface CountryLabel {
  key: string;
  name: string;
  center: LngLat;
  area: number;
  minZoom: number;
}

export interface WorldData {
  /** Every country, with `key` (the world-atlas id) and `name` as properties. */
  collection: FeatureCollection<Geometry, { key: string; name: string }>;
  byKey: Map<string, { name: string; geometry: Geometry }>;
  labels: CountryLabel[];
}

function ringArea(ring: number[][]): { area: number; cx: number; cy: number } {
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i]; const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return { area: 0, cx: ring[0]?.[0] ?? 0, cy: ring[0]?.[1] ?? 0 };
  return { area: a / 2, cx: cx / (6 * (a / 2)), cy: cy / (6 * (a / 2)) };
}

function polygonsOf(g: Geometry): number[][][][] {
  if (g.type === 'Polygon') return [(g as Polygon).coordinates];
  if (g.type === 'MultiPolygon') return (g as MultiPolygon).coordinates;
  return [];
}


/** Cuts a ring that straddles the antimeridian into a west piece and an east piece (shifted back). */
function clipHalf(ring: number[][], keepWest: boolean): number[][] {
  const inside = (p: number[]) => (keepWest ? p[0] <= 180 : p[0] >= 180);
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]; const b = ring[(i + 1) % ring.length];
    const ia = inside(a); const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (180 - a[0]) / (b[0] - a[0]);
      out.push([180, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/**
 * world-atlas keeps Russia and Fiji as polygons that hop from lng 180 to -180 inside one ring, which a
 * flat map draws as a streak across the world. Unwrap such a ring and cut it at the antimeridian.
 */
export function fixAntimeridian(g: Geometry): Geometry {
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return g;
  const polys = polygonsOf(g);
  const out: number[][][][] = [];
  for (const poly of polys) {
    const outer = poly[0];
    let jumps = false;
    for (let i = 1; i < outer.length; i++) if (Math.abs(outer[i][0] - outer[i - 1][0]) > 180) { jumps = true; break; }
    if (!jumps) { out.push(poly); continue; }
    const open = outer.slice(0, outer.length - 1).map((p) => [p[0] < 0 ? p[0] + 360 : p[0], p[1]]);
    const west = clipHalf(open, true);
    const east = clipHalf(open, false).map((p) => [p[0] - 360, p[1]]);
    for (const part of [west, east]) {
      if (part.length >= 3) out.push([[...part, part[0]]]);
    }
  }
  return { type: 'MultiPolygon', coordinates: out };
}

function labelZoom(area: number): number {
  if (area > 700) return 1.4;
  if (area > 220) return 2.3;
  if (area > 70) return 3.1;
  if (area > 22) return 3.9;
  if (area > 7) return 4.6;
  if (area > 2) return 5.6;
  return 99;
}

let cache: Promise<WorldData> | null = null;

/** Loads and prepares the world once per page visit. Both libraries are imported only here. */
export function loadWorldData(): Promise<WorldData> {
  if (!cache) {
    cache = (async () => {
      // The world (world-atlas 2.0.2 countries-50m, Natural Earth) is a static file on our own origin,
      // public/crisis/world-countries-50m.json: importing the JSON as a module made the build run out of memory.
      const [{ feature }, atlas] = await Promise.all([
        import('topojson-client'),
        fetch('/crisis/world-countries-50m.json').then((r) => {
          if (!r.ok) throw new Error('The world map file did not load.');
          return r.json() as Promise<unknown>;
        }),
      ]);
      const topo = atlas as Parameters<typeof feature>[0];
      const objects = (topo as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects;
      const raw = feature(topo, objects.countries) as unknown as FeatureCollection<Geometry, { name?: string }>;
      const features: Array<Feature<Geometry, { key: string; name: string }>> = [];
      const byKey = new Map<string, { name: string; geometry: Geometry }>();
      const labels: CountryLabel[] = [];
      for (const f of raw.features) {
        if (!f.geometry) continue;
        const name = f.properties?.name ?? 'Unnamed';
        if (name === 'Antarctica') continue;               // no armies there, and Mercator cannot draw the pole
        const key = f.id !== undefined && f.id !== null ? String(f.id) : `x:${name}`;
        const geometry = fixAntimeridian(f.geometry);
        features.push({ type: 'Feature', properties: { key, name }, geometry });
        byKey.set(key, { name, geometry });
        let total = 0; let best = 0; let center: LngLat = [0, 0];
        for (const poly of polygonsOf(geometry)) {
          const r = ringArea(poly[0]);
          const a = Math.abs(r.area) * Math.cos((r.cy * Math.PI) / 180);
          total += a;
          if (a > best) { best = a; center = [r.cx, r.cy]; }
        }
        const minZoom = labelZoom(total);
        if (minZoom < 99) labels.push({ key, name, center, area: total, minZoom });
      }
      return { collection: { type: 'FeatureCollection' as const, features }, byKey, labels };
    })().catch((e) => { cache = null; throw e; });
  }
  return cache as Promise<WorldData>;
}

/** Corner points of a stored shape geometry (an area drops its closing point). */
export function shapePoints(g: { type: string; coordinates: unknown }): LngLat[] {
  if (g.type === 'Polygon') {
    const ring = ((g.coordinates as number[][][])[0] ?? []).map((p) => [p[0], p[1]] as LngLat);
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    return ring;
  }
  return ((g.coordinates as number[][]) ?? []).map((p) => [p[0], p[1]] as LngLat);
}

export function geometryFor(kind: 'line' | 'area', pts: LngLat[]): { type: 'LineString' | 'Polygon'; coordinates: unknown } {
  if (kind === 'line') return { type: 'LineString', coordinates: pts };
  return { type: 'Polygon', coordinates: [[...pts, pts[0]]] };
}

export function centroidOf(pts: LngLat[]): LngLat {
  if (!pts.length) return [0, 0];
  let x = 0; let y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

export function clampLng(v: number): number { return Math.max(-180, Math.min(180, v)); }
export function clampLat(v: number): number { return Math.max(-90, Math.min(90, v)); }
