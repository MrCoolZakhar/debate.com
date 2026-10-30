// Gavelling Crisis map: a set of map changes (country outlines and holders, drawn territories) as one value.
// The war map saves it straight away, or (the setting "Map changes wait until you send them") keeps it as the
// crisis team's shared draft; a directive reply keeps it in its own draft and saves it when the reply is sent.
// Also the helpers both sides share: laying a set over map data, and working a set out from two copies of the data.

import { applyMapSet, saveCharacter, saveUnit } from '@/lib/crisis/api';
import { applyMapSetV2, deleteUnitChecked } from '@/lib/crisis/mapApi';
import type { MapRegion, MapShape, MapUnit, RegionGeometry, UnitKind } from '@/lib/crisis/types';

export type MapData = { regions: MapRegion[]; units: MapUnit[]; shapes: MapShape[] };

/** Everything one save changes (and, the other way round, what its Undo puts back). */
export interface EditSet {
  regions: Array<{ key: string; owner_cabinet_id: string | null; geometry: RegionGeometry | null }>;
  shapes: Array<{ id: string; geometry: MapShape['geometry'] }>;
  owners: Array<{ id: string; owner_cabinet_id: string | null }>;
  removeShapes: string[];
  addShapes: MapShape[];
  /** Unit changes: only the fields present are changed (sight_km: null puts back the default for its kind). */
  units: UnitChange[];
  /** Units added (their id is a local one until the set is sent), units removed, and characters moved to a new spot. */
  unitAdds?: NewUnit[];
  unitRemoves?: string[];
  chars?: CharMove[];
  /** Details of drawn shapes (name, colour, description, zone type, who sees it): only the keys present change. */
  shapeInfo?: ShapeInfo[];
}

/** What can change about a drawn shape other than its outline and holder. */
export interface ShapeInfo {
  id: string; label?: string | null; color?: string | null; description?: string | null; zone_type?: string | null;
  public?: boolean; revealed_to?: string[];
}
const INFO_KEYS = ['label', 'color', 'description', 'zone_type', 'public', 'revealed_to'] as const;

export interface UnitChange {
  id: string; lng?: number; lat?: number; strength?: number; sight_km?: number | null;
  name?: string; kind?: UnitKind; owner_cabinet_id?: string | null; note?: string | null; revealed_to?: string[];
}

/** A unit added in a set. `id` is local ('new-u-...'); the database gives the real one when the set is sent. */
export interface NewUnit {
  id: string; name: string; kind: UnitKind; strength: number; owner_cabinet_id: string | null; note: string | null;
  revealed_to: string[]; sight_km: number | null; lng: number; lat: number;
}

/** A character moved to an exact spot. */
export interface CharMove { id: string; lng: number; lat: number }

export const emptySet = (): EditSet => ({ regions: [], shapes: [], owners: [], removeShapes: [], addShapes: [], units: [], unitAdds: [], unitRemoves: [], chars: [], shapeInfo: [] });

export function isEmptySet(s: EditSet | null | undefined): boolean {
  return !s || (!s.regions.length && !s.shapes.length && !s.owners.length && !s.removeShapes.length && !s.addShapes.length && !(s.units?.length)
    && !(s.unitAdds?.length) && !(s.unitRemoves?.length) && !(s.chars?.length) && !(s.shapeInfo?.length));
}

/** A local id for a unit or shape that only exists in a draft. */
export const isLocalId = (id: string): boolean => id.startsWith('new-');

/** How many territories a set touches (each country or drawn area counts once). */
export function setSize(s: EditSet | null | undefined): number {
  if (!s) return 0;
  const ids = new Set<string>();
  for (const r of s.regions) ids.add(`c:${r.key}`);
  for (const x of s.shapes) ids.add(`a:${x.id}`);
  for (const x of s.owners) ids.add(`a:${x.id}`);
  for (const id of s.removeShapes) ids.add(`a:${id}`);
  for (const x of s.addShapes) ids.add(`a:${x.id}`);
  for (const x of s.shapeInfo ?? []) ids.add(`a:${x.id}`);
  for (const x of s.units ?? []) ids.add(`u:${x.id}`);
  for (const x of s.unitAdds ?? []) ids.add(`u:${x.id}`);
  for (const id of s.unitRemoves ?? []) ids.add(`u:${id}`);
  for (const x of s.chars ?? []) ids.add(`h:${x.id}`);
  return ids.size;
}

export function applyLocal(d: MapData, s: EditSet, crisisId: string): MapData {
  let regions = d.regions;
  for (const r of s.regions) {
    regions = regions.some((x) => x.region_key === r.key)
      ? regions.map((x) => (x.region_key === r.key ? { ...x, owner_cabinet_id: r.owner_cabinet_id, geometry: r.geometry } : x))
      : [...regions, { crisis_id: crisisId, region_key: r.key, owner_cabinet_id: r.owner_cabinet_id, geometry: r.geometry }];
  }
  const geo = new Map(s.shapes.map((x) => [x.id, x.geometry]));
  const own = new Map(s.owners.map((x) => [x.id, x.owner_cabinet_id]));
  const info = new Map((s.shapeInfo ?? []).map((x) => [x.id, x]));
  const shapes = d.shapes
    .filter((x) => !s.removeShapes.includes(x.id))
    .map((x) => {
      let y = x;
      if (geo.has(x.id)) y = { ...y, geometry: geo.get(x.id) as MapShape['geometry'] };
      if (own.has(x.id)) y = { ...y, owner_cabinet_id: own.get(x.id) ?? null };
      const i = info.get(x.id);
      if (i) {
        const { id: _id, ...rest } = i;
        void _id;
        y = { ...y, ...rest } as MapShape;
      }
      return y;
    });
  const unitPatch = new Map((s.units ?? []).map((x) => [x.id, x]));
  const gone = new Set(s.unitRemoves ?? []);
  let units = unitPatch.size ? d.units.map((u) => {
    const c = unitPatch.get(u.id);
    return c ? ({ ...u, ...c } as MapUnit) : u;
  }) : d.units;
  if (gone.size) units = units.filter((u) => !gone.has(u.id));
  const adds = (s.unitAdds ?? []).filter((a) => !units.some((u) => u.id === a.id));
  if (adds.length) {
    units = [...units, ...adds.map((a): MapUnit => ({
      id: a.id, crisis_id: crisisId, owner_cabinet_id: a.owner_cabinet_id, kind: a.kind, name: a.name, strength: a.strength, lng: a.lng, lat: a.lat,
      note: a.note, revealed_to: a.revealed_to, suspected_by: [], sight_km: a.sight_km,
    }))];
  }
  return { ...d, regions, units, shapes: [...shapes, ...s.addShapes] };
}

/** The set as the database function takes it. Added shapes lose their local ids. */
export function setPayload(s: EditSet): Record<string, unknown> {
  return {
    regions: s.regions,
    shapes: s.shapes,
    owners: s.owners,
    removeShapes: s.removeShapes,
    addShapes: s.addShapes.map((a) => ({
      kind: a.kind, owner_cabinet_id: a.owner_cabinet_id, label: a.label, color: a.color, geometry: a.geometry, public: a.public, revealed_to: a.revealed_to,
      description: a.description ?? null, zone_type: a.zone_type ?? null,
    })),
    shapeInfo: s.shapeInfo ?? [],
    units: s.units ?? [],
    addUnits: (s.unitAdds ?? []).map((a) => ({
      name: a.name, kind: a.kind, strength: a.strength, owner_cabinet_id: a.owner_cabinet_id, note: a.note, revealed_to: a.revealed_to,
      sight_km: a.sight_km, lng: a.lng, lat: a.lat,
    })),
    removeUnits: s.unitRemoves ?? [],
    chars: s.chars ?? [],
  };
}

/** The unit fields the first version of the database function knows. */
const BASE_UNIT_KEYS = ['lng', 'lat', 'strength', 'sight_km'] as const;
const EXTRA_UNIT_KEYS = ['name', 'kind', 'owner_cabinet_id', 'note', 'revealed_to'] as const;

/** True when the set holds anything the first version of the database function cannot apply. */
export function hasExtras(s: EditSet): boolean {
  return !!(s.unitAdds?.length || s.unitRemoves?.length || s.chars?.length
    || s.units.some((u) => EXTRA_UNIT_KEYS.some((k) => k in u)));
}

/** Drops what cannot be sent: patches for units that are being removed or added in the same set, and empty patches. */
export function tidySet(s: EditSet): EditSet {
  const gone = new Set(s.unitRemoves ?? []);
  const added = new Set((s.unitAdds ?? []).map((a) => a.id));
  return {
    ...s,
    units: s.units.filter((u) => !gone.has(u.id) && !added.has(u.id) && Object.keys(u).length > 1),
    unitAdds: s.unitAdds ?? [], unitRemoves: s.unitRemoves ?? [], chars: s.chars ?? [],
    shapeInfo: (s.shapeInfo ?? []).filter((x) => Object.keys(x).length > 1),
  };
}

export interface SendResult {
  /** The ids the database gave the added shapes and units, in the order they were in the set. */
  added: string[];
  addedUnits: string[];
  /** What is still unsent when something failed half way (null when everything went). */
  remaining: EditSet | null;
  error: unknown | null;
}

const pickKeys = <T extends object>(o: T, keys: readonly string[]): Partial<T> => {
  const out: Record<string, unknown> = { id: (o as { id?: unknown }).id };
  for (const k of keys) if (k in o) out[k] = (o as Record<string, unknown>)[k];
  return out as Partial<T>;
};

/**
 * Sends a whole edit set. With the database function that takes units added and removed and character moves
 * (crisis_apply_map_set_v2) it is one transaction. Without it, the part the first function knows goes in one
 * transaction and the rest follows one row at a time, and whatever did not go is handed back in `remaining`.
 */
export async function sendSet(ref: Parameters<typeof applyMapSet>[0], input: EditSet): Promise<SendResult> {
  const s = tidySet(input);
  if (isEmptySet(s)) return { added: [], addedUnits: [], remaining: null, error: null };
  try {
    if (!hasExtras(s)) {
      const added = await applyMapSet(ref, setPayload(s));
      return { added, addedUnits: [], remaining: null, error: null };
    }
    const v2 = await applyMapSetV2(ref, setPayload(s));
    if (v2) return { added: v2.added, addedUnits: v2.addedUnits, remaining: null, error: null };
  } catch (e) {
    return { added: [], addedUnits: [], remaining: s, error: e };
  }
  // The older function: the map part and the plain unit fields first, in one transaction.
  const left: EditSet = { ...emptySet(), ...s, units: s.units.map((u) => ({ ...u })), unitAdds: [...(s.unitAdds ?? [])], unitRemoves: [...(s.unitRemoves ?? [])], chars: [...(s.chars ?? [])] };
  let added: string[] = [];
  const addedUnits: string[] = [];
  const base: EditSet = {
    ...emptySet(), regions: s.regions, shapes: s.shapes, owners: s.owners, removeShapes: s.removeShapes, addShapes: s.addShapes, shapeInfo: s.shapeInfo ?? [],
    units: s.units.map((u) => pickKeys(u, BASE_UNIT_KEYS) as UnitChange).filter((u) => Object.keys(u).length > 1),
  };
  try {
    if (!isEmptySet(base)) added = await applyMapSet(ref, setPayload(base));
    left.regions = []; left.shapes = []; left.owners = []; left.removeShapes = []; left.addShapes = []; left.shapeInfo = [];
    left.units = s.units.map((u) => pickKeys(u, EXTRA_UNIT_KEYS) as UnitChange).filter((u) => Object.keys(u).length > 1);
  } catch (e) {
    return { added: [], addedUnits: [], remaining: s, error: e };
  }
  try {
    for (const u of [...left.units]) {
      const { id, ...rest } = u;
      await saveUnit(ref, { id, ...(rest as object) });
      left.units = left.units.filter((x) => x.id !== id);
    }
    for (const a of [...(left.unitAdds ?? [])]) {
      const id = await saveUnit(ref, {
        name: a.name, kind: a.kind, strength: a.strength, owner_cabinet_id: a.owner_cabinet_id, note: a.note, revealed_to: a.revealed_to,
        sight_km: a.sight_km, lng: a.lng, lat: a.lat,
      });
      addedUnits.push(id);
      left.unitAdds = (left.unitAdds ?? []).filter((x) => x.id !== a.id);
    }
    for (const id of [...(left.unitRemoves ?? [])]) {
      await deleteUnitChecked(ref, id);
      left.unitRemoves = (left.unitRemoves ?? []).filter((x) => x !== id);
    }
    for (const c of [...(left.chars ?? [])]) {
      await saveCharacter(ref, { id: c.id, location_lng: c.lng, location_lat: c.lat });
      left.chars = (left.chars ?? []).filter((x) => x.id !== c.id);
    }
  } catch (e) {
    return { added, addedUnits, remaining: isEmptySet(left) ? null : left, error: e };
  }
  return { added, addedUnits, remaining: null, error: null };
}

/** Saves an edit set (throws when it could not all be saved); answers the ids the database gave the added shapes, in order. */
export async function saveSet(ref: Parameters<typeof applyMapSet>[0], s: EditSet): Promise<string[]> {
  if (isEmptySet(s)) return [];
  const r = await sendSet(ref, s);
  if (r.error) throw r.error;
  return r.added;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** An edit set read back from the shared draft (anything unreadable is dropped); null when it holds nothing. */
export function parseSet(raw: unknown): EditSet | null {
  if (!isObj(raw)) return null;
  const out = emptySet();
  for (const r of arr(raw.regions)) {
    if (isObj(r) && typeof r.key === 'string') {
      out.regions.push({ key: r.key, owner_cabinet_id: typeof r.owner_cabinet_id === 'string' ? r.owner_cabinet_id : null, geometry: (isObj(r.geometry) ? r.geometry : null) as RegionGeometry | null });
    }
  }
  for (const r of arr(raw.shapes)) if (isObj(r) && typeof r.id === 'string' && isObj(r.geometry)) out.shapes.push({ id: r.id, geometry: r.geometry as MapShape['geometry'] });
  for (const r of arr(raw.owners)) if (isObj(r) && typeof r.id === 'string') out.owners.push({ id: r.id, owner_cabinet_id: typeof r.owner_cabinet_id === 'string' ? r.owner_cabinet_id : null });
  for (const r of arr(raw.removeShapes)) if (typeof r === 'string') out.removeShapes.push(r);
  for (const r of arr(raw.addShapes)) {
    if (isObj(r) && typeof r.id === 'string' && isObj(r.geometry) && (r.kind === 'area' || r.kind === 'line' || r.kind === 'zone')) out.addShapes.push(r as unknown as MapShape);
  }
  for (const r of arr(raw.shapeInfo)) {
    if (!isObj(r) || typeof r.id !== 'string') continue;
    const i: ShapeInfo = { id: r.id };
    for (const k of ['label', 'color', 'description', 'zone_type'] as const) if (k in r && (r[k] === null || typeof r[k] === 'string')) i[k] = r[k] as string | null;
    if (typeof r.public === 'boolean') i.public = r.public;
    if (Array.isArray(r.revealed_to)) i.revealed_to = r.revealed_to.filter((x): x is string => typeof x === 'string');
    if (Object.keys(i).length > 1) out.shapeInfo?.push(i);
  }
  for (const r of arr(raw.units)) {
    if (!isObj(r) || typeof r.id !== 'string') continue;
    const u: UnitChange = { id: r.id };
    if (typeof r.lng === 'number') u.lng = r.lng;
    if (typeof r.lat === 'number') u.lat = r.lat;
    if (typeof r.strength === 'number') u.strength = r.strength;
    if ('sight_km' in r && (r.sight_km === null || typeof r.sight_km === 'number')) u.sight_km = r.sight_km as number | null;
    if (typeof r.name === 'string') u.name = r.name;
    if (typeof r.kind === 'string') u.kind = r.kind as UnitKind;
    if ('owner_cabinet_id' in r && (r.owner_cabinet_id === null || typeof r.owner_cabinet_id === 'string')) u.owner_cabinet_id = r.owner_cabinet_id as string | null;
    if ('note' in r && (r.note === null || typeof r.note === 'string')) u.note = r.note as string | null;
    if (Array.isArray(r.revealed_to)) u.revealed_to = r.revealed_to.filter((x): x is string => typeof x === 'string');
    out.units.push(u);
  }
  for (const r of arr(raw.unitAdds)) {
    if (!isObj(r) || typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.lng !== 'number' || typeof r.lat !== 'number') continue;
    out.unitAdds?.push({
      id: r.id, name: r.name, kind: (typeof r.kind === 'string' ? r.kind : 'custom') as UnitKind, strength: typeof r.strength === 'number' ? r.strength : 1,
      owner_cabinet_id: typeof r.owner_cabinet_id === 'string' ? r.owner_cabinet_id : null, note: typeof r.note === 'string' ? r.note : null,
      revealed_to: Array.isArray(r.revealed_to) ? r.revealed_to.filter((x): x is string => typeof x === 'string') : [],
      sight_km: typeof r.sight_km === 'number' ? r.sight_km : null, lng: r.lng, lat: r.lat,
    });
  }
  for (const r of arr(raw.unitRemoves)) if (typeof r === 'string') out.unitRemoves?.push(r);
  for (const r of arr(raw.chars)) if (isObj(r) && typeof r.id === 'string' && typeof r.lng === 'number' && typeof r.lat === 'number') out.chars?.push({ id: r.id, lng: r.lng, lat: r.lat });
  return isEmptySet(out) ? null : out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What `next` changed compared with `base`: applying the result to `base` gives `next`'s territories. */
export function diffData(base: MapData, next: MapData): EditSet {
  const out = emptySet();
  const baseRegion = new Map(base.regions.map((r) => [r.region_key, r]));
  for (const r of next.regions) {
    const was = baseRegion.get(r.region_key);
    const geo = r.geometry ?? null;
    if (!was ? (r.owner_cabinet_id !== null || geo !== null) : (was.owner_cabinet_id !== r.owner_cabinet_id || !same(was.geometry, geo))) {
      out.regions.push({ key: r.region_key, owner_cabinet_id: r.owner_cabinet_id, geometry: geo });
    }
  }
  const baseShape = new Map(base.shapes.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (const s of next.shapes) {
    seen.add(s.id);
    const was = baseShape.get(s.id);
    if (!was) { out.addShapes.push(s); continue; }
    if (!same(was.geometry, s.geometry)) out.shapes.push({ id: s.id, geometry: s.geometry });
    if (was.owner_cabinet_id !== s.owner_cabinet_id) out.owners.push({ id: s.id, owner_cabinet_id: s.owner_cabinet_id });
    const info: ShapeInfo = { id: s.id };
    for (const k of INFO_KEYS) {
      if (k === 'revealed_to') {
        if ([...(was.revealed_to ?? [])].sort().join() !== [...(s.revealed_to ?? [])].sort().join()) info.revealed_to = s.revealed_to ?? [];
      } else if (k === 'public') {
        if (was.public !== s.public) info.public = s.public;
      } else if ((was[k] ?? null) !== (s[k] ?? null)) info[k] = s[k] ?? null;
    }
    if (Object.keys(info).length > 1) out.shapeInfo?.push(info);
  }
  for (const s of base.shapes) if (!seen.has(s.id)) out.removeShapes.push(s.id);
  const baseUnit = new Map(base.units.map((u) => [u.id, u]));
  const nextIds = new Set(next.units.map((u) => u.id));
  for (const u of next.units) {
    const was = baseUnit.get(u.id);
    if (!was) {
      out.unitAdds?.push({
        id: u.id, name: u.name, kind: u.kind, strength: u.strength, owner_cabinet_id: u.owner_cabinet_id, note: u.note ?? null,
        revealed_to: u.revealed_to ?? [], sight_km: u.sight_km ?? null, lng: u.lng, lat: u.lat,
      });
      continue;
    }
    const c: UnitChange = { id: u.id };
    if (was.lng !== u.lng || was.lat !== u.lat) { c.lng = u.lng; c.lat = u.lat; }
    if (was.strength !== u.strength) c.strength = u.strength;
    if ((was.sight_km ?? null) !== (u.sight_km ?? null)) c.sight_km = u.sight_km ?? null;
    if (was.name !== u.name) c.name = u.name;
    if (was.kind !== u.kind) c.kind = u.kind;
    if ((was.owner_cabinet_id ?? null) !== (u.owner_cabinet_id ?? null)) c.owner_cabinet_id = u.owner_cabinet_id ?? null;
    if ((was.note ?? null) !== (u.note ?? null)) c.note = u.note ?? null;
    if ([...(was.revealed_to ?? [])].sort().join() !== [...(u.revealed_to ?? [])].sort().join()) c.revealed_to = u.revealed_to ?? [];
    if (Object.keys(c).length > 1) out.units.push(c);
  }
  for (const u of base.units) if (!nextIds.has(u.id)) out.unitRemoves?.push(u.id);
  return out;
}

/** What a directive's map editor is given and tells back. */
export interface StageOptions {
  kind: 'unit' | 'border';
  /** The map as it is now, with the reply's earlier changes laid over it. Read once, when the map opens. */
  data: MapData;
  canUnits: boolean;
  canMap: boolean;
  /** Height of the map itself, in px (the panels sit under it). */
  height: number;
  /** Unit stage: the unit that can be dragged. */
  unitId?: string;
  /** Unit stage: places already chosen in this reply (unit id to the new place), drawn as planned trajectories. */
  moves?: Record<string, { lng: number; lat: number }>;
  onSelectUnit?: (id: string) => void;
  onUnitMove?: (id: string, lng: number, lat: number) => void;
  /** Border stage: the data after every change. */
  onData?: (d: MapData) => void;
}
