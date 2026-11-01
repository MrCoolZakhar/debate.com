// Gavelling Crisis map: the states and provinces of the United States, Canada, Brazil and Australia as real polygons,
// so the Give land tool can hand one over by clicking it. The file (public/crisis/world-region-shapes.json, Natural Earth
// through the sane-topojson package, public domain, about 500 KB) is on our own origin and is fetched only the first time
// it is wanted. Neighbouring provinces share their border points exactly, so two provinces given to one cabinet join
// without a gap. Pure functions apart from the fetch.

import { bboxHit, bboxOf, pointIn, toMulti, type Bbox, type Multi } from '@/lib/crisis/geo';

export interface Province {
  /** Stable within the file, such as 'USA:Texas'. */
  id: string;
  name: string;
  /** Country code: USA, CAN, BRA or AUS. */
  cc: string;
  multi: Multi;
  bbox: Bbox | null;
}

interface ProvinceFile { provinces: Array<{ name: string; cc: string; g: unknown[] }> }

let cache: Promise<Province[]> | null = null;

/** Every province as polygons; fetched once per page. A failure is not remembered, so the next click tries again. */
export function loadProvinces(): Promise<Province[]> {
  if (!cache) {
    cache = fetch('/crisis/world-region-shapes.json')
      .then((r) => {
        if (!r.ok) throw new Error('The provinces did not load.');
        return r.json() as Promise<ProvinceFile>;
      })
      .then((f) => f.provinces.map((p): Province => {
        const multi = toMulti({ type: 'MultiPolygon', coordinates: p.g });
        return { id: `${p.cc}:${p.name}`, name: p.name, cc: p.cc, multi, bbox: bboxOf(multi) };
      }))
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** The province under a point (the smallest one if two files ever overlap), or null. */
export function provinceAt(list: Province[], lng: number, lat: number): Province | null {
  const probe: Bbox = [lng, lat, lng, lat];
  let best: Province | null = null; let bestSize = Infinity;
  for (const p of list) {
    if (!p.bbox || !bboxHit(p.bbox, probe)) continue;
    if (!pointIn([lng, lat], p.multi)) continue;
    const size = (p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1]);
    if (size < bestSize) { best = p; bestSize = size; }
  }
  return best;
}
