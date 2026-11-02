// Gavelling Crisis map: the Erase brush on countries a cabinet holds. A country has one outline and one holder, so it cannot
// be cut in place. Instead the part the stroke leaves becomes a drawn area for the same cabinet (the country's polygon, minus
// the stroke, tidied) and the country itself goes back to nobody, all in one change set (and so one undo step). Pure
// functions: no map and no network. The caller adds the set to the same change a send uses (regions + addShapes).

import { bboxHit, bboxOf, differenceM, dropSlivers, toGeometry, toMulti, type Bbox, type ClaimTerr, type Multi } from '@/lib/crisis/geo';
import type { MapShape } from '@/lib/crisis/types';
import { planErase, roundMulti } from './brush';
import type { EditSet, MapData } from './mapEdits';

/** What a stroke leaves of one held country. */
export interface CountryCut {
  key: string;
  owner: string;
  /** The land of the country that is left once the stroke is cut out (and the land other areas already cover is left to them). */
  left: Multi;
  /** Nothing of the country is left. */
  emptied: boolean;
}

type BaseShapes = { get: (key: string) => { multi: Multi; bbox: Bbox | null } | undefined };

/** Every country that a cabinet holds, as the clipper takes it (its edited outline, else the world's own). */
export function ownedCountryTerrs(d: MapData, base: BaseShapes): ClaimTerr[] {
  const list: ClaimTerr[] = [];
  for (const r of d.regions) {
    if (!r.owner_cabinet_id) continue;
    const stored = r.geometry ? toMulti(r.geometry) : undefined;
    const b = base.get(r.region_key);
    const multi = stored ?? b?.multi ?? [];
    list.push({ id: `c:${r.region_key}`, kind: 'country', owner: r.owner_cabinet_id, multi, bbox: stored ? bboxOf(stored) : b?.bbox ?? null });
  }
  return list;
}

/** The held countries a stroke overlaps, each with what is left of it. `areas` are all the drawn areas (the new land never overlaps one). */
export function planEraseCountries(stroke: Multi, countries: ClaimTerr[], areas: ClaimTerr[], km: number): CountryCut[] {
  if (!countries.length) return [];
  return planErase(stroke, countries, km).cuts.map((c) => {
    let left = c.multi;
    if (!c.emptied) {
      const lb = bboxOf(left);
      for (const a of areas) {
        if (a.multi.length && a.bbox && lb && bboxHit(a.bbox, lb)) left = dropSlivers(differenceM(left, a.multi));
      }
      left = roundMulti(left);
    }
    const owner = countries.find((x) => x.id === c.id)?.owner ?? null;
    return { key: c.id.slice(2), owner: owner ?? '', left, emptied: c.emptied || !left.length };
  }).filter((c) => !!c.owner);
}

let counter = 0;

/**
 * Puts the country cuts into `set` (and what undoes them into `back`): the country's holder is cleared and its outline put
 * back to the world's own, and the land left becomes a drawn area of the same cabinet. Answers the names of countries that
 * lost all their land. The shapes added are in `set.addShapes`, so Undo removes them by the ids the save gives back.
 */
export function writeCountryCuts(
  cuts: CountryCut[], d: MapData, crisisId: string, nameOf: (key: string) => string, set: EditSet, back: EditSet,
): string[] {
  const gone: string[] = [];
  for (const c of cuts) {
    const row = d.regions.find((r) => r.region_key === c.key);
    set.regions.push({ key: c.key, owner_cabinet_id: null, geometry: null });
    back.regions.push({ key: c.key, owner_cabinet_id: row?.owner_cabinet_id ?? null, geometry: row?.geometry ?? null });
    if (c.emptied) { gone.push(nameOf(c.key)); continue; }
    counter += 1;
    set.addShapes.push({
      id: `new-b${new Date().getTime().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      crisis_id: crisisId, kind: 'area', owner_cabinet_id: c.owner, label: nameOf(c.key) || null, color: null,
      geometry: toGeometry(c.left) as MapShape['geometry'], public: true, revealed_to: [],
    });
  }
  return gone;
}
