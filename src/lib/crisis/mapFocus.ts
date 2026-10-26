// Gavelling Crisis: where the war map should open. "Open the map" from a notification or a history row
// adds one of these to the map link; the map zooms there once its data is in (and selects the unit).
//   ?unit=<id>        a unit: select it and zoom to where it is now
//   ?region=<key>     a country (world-atlas key): zoom to its outline
//   ?bbox=w,s,e,n     an area or line, or a place with nothing left to select

import type { HistoryChange } from './history';

export interface MapFocus {
  unit?: string;
  region?: string;
  bbox?: [number, number, number, number];
}

type Pt = [number, number];

function bboxOf(points: Pt[]): MapFocus['bbox'] | undefined {
  if (!points.length) return undefined;
  let w = 180; let s = 90; let e = -180; let n = -90;
  for (const [x, y] of points) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [w, s, e, n];
}

/** Every [lng, lat] pair inside a GeoJSON coordinates array, however deeply nested. */
export function coordsOf(coords: unknown): Pt[] {
  const out: Pt[] = [];
  const walk = (c: unknown) => {
    if (!Array.isArray(c)) return;
    if (c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') { out.push([c[0], c[1]]); return; }
    for (const x of c) walk(x);
  };
  walk(coords);
  return out;
}

export function geometryBbox(g: { coordinates?: unknown } | null | undefined): MapFocus['bbox'] | undefined {
  return g ? bboxOf(coordsOf(g.coordinates)) : undefined;
}

/** Where a history change happened. */
export function focusForChange(c: HistoryChange): MapFocus {
  if (c.type === 'unit') {
    if (c.op === 'delete') {
      const p = c.posFrom ?? c.posTo;
      return p ? { bbox: [p[0], p[1], p[0], p[1]] } : {};
    }
    return { unit: c.unitId };
  }
  if (c.type === 'region') return { region: c.key };
  const b = geometryBbox(c.geomTo ?? c.geomFrom);
  return b ? { bbox: b } : {};
}

export function mapHref(base: string, focus: MapFocus | null | undefined): string {
  const q = new URLSearchParams();
  if (focus?.unit) q.set('unit', focus.unit);
  else if (focus?.region) q.set('region', focus.region);
  else if (focus?.bbox) q.set('bbox', focus.bbox.map((v) => Math.round(v * 1e4) / 1e4).join(','));
  const s = q.toString();
  return `${base}/map${s ? `?${s}` : ''}`;
}

export function readMapFocus(search: string): MapFocus | null {
  const q = new URLSearchParams(search);
  const unit = q.get('unit');
  if (unit) return { unit };
  const region = q.get('region');
  if (region) return { region };
  const raw = q.get('bbox');
  if (raw) {
    const v = raw.split(',').map(Number);
    if (v.length === 4 && v.every((x) => Number.isFinite(x))) return { bbox: [v[0], v[1], v[2], v[3]] };
  }
  return null;
}
