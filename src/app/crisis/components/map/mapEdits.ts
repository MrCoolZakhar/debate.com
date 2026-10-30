// Gavelling Crisis map: a set of map changes (country outlines and holders, drawn territories) as one value.
// The war map saves it straight away, or (the setting "Map changes wait until you send them") keeps it as the
// crisis team's shared draft; a directive reply keeps it in its own draft and saves it when the reply is sent.
// Also the helpers both sides share: laying a set over map data, and working a set out from two copies of the data.

import { applyMapSet } from '@/lib/crisis/api';
import type { MapRegion, MapShape, MapUnit, RegionGeometry } from '@/lib/crisis/types';

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
}

export interface UnitChange { id: string; lng?: number; lat?: number; strength?: number; sight_km?: number | null }

export const emptySet = (): EditSet => ({ regions: [], shapes: [], owners: [], removeShapes: [], addShapes: [], units: [] });

export function isEmptySet(s: EditSet | null | undefined): boolean {
  return !s || (!s.regions.length && !s.shapes.length && !s.owners.length && !s.removeShapes.length && !s.addShapes.length && !(s.units?.length));
}

/** How many territories a set touches (each country or drawn area counts once). */
export function setSize(s: EditSet | null | undefined): number {
  if (!s) return 0;
  const ids = new Set<string>();
  for (const r of s.regions) ids.add(`c:${r.key}`);
  for (const x of s.shapes) ids.add(`a:${x.id}`);
  for (const x of s.owners) ids.add(`a:${x.id}`);
  for (const id of s.removeShapes) ids.add(`a:${id}`);
  for (const x of s.addShapes) ids.add(`a:${x.id}`);
  for (const x of s.units ?? []) ids.add(`u:${x.id}`);
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
  const shapes = d.shapes
    .filter((x) => !s.removeShapes.includes(x.id))
    .map((x) => {
      let y = x;
      if (geo.has(x.id)) y = { ...y, geometry: geo.get(x.id) as MapShape['geometry'] };
      if (own.has(x.id)) y = { ...y, owner_cabinet_id: own.get(x.id) ?? null };
      return y;
    });
  const unitPatch = new Map((s.units ?? []).map((x) => [x.id, x]));
  const units = unitPatch.size ? d.units.map((u) => {
    const c = unitPatch.get(u.id);
    return c ? { ...u, ...c } : u;
  }) : d.units;
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
    })),
    units: s.units ?? [],
  };
}

/** Saves an edit set in one transaction; answers the ids the database gave the added shapes, in order. */
export async function saveSet(ref: Parameters<typeof applyMapSet>[0], s: EditSet): Promise<string[]> {
  if (isEmptySet(s)) return [];
  return applyMapSet(ref, setPayload(s));
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
    if (isObj(r) && typeof r.id === 'string' && isObj(r.geometry) && (r.kind === 'area' || r.kind === 'line')) out.addShapes.push(r as unknown as MapShape);
  }
  for (const r of arr(raw.units)) {
    if (!isObj(r) || typeof r.id !== 'string') continue;
    const u: UnitChange = { id: r.id };
    if (typeof r.lng === 'number') u.lng = r.lng;
    if (typeof r.lat === 'number') u.lat = r.lat;
    if (typeof r.strength === 'number') u.strength = r.strength;
    if ('sight_km' in r && (r.sight_km === null || typeof r.sight_km === 'number')) u.sight_km = r.sight_km as number | null;
    out.units.push(u);
  }
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
  }
  for (const s of base.shapes) if (!seen.has(s.id)) out.removeShapes.push(s.id);
  const baseUnit = new Map(base.units.map((u) => [u.id, u]));
  for (const u of next.units) {
    const was = baseUnit.get(u.id);
    if (!was) continue;
    const c: UnitChange = { id: u.id };
    if (was.lng !== u.lng || was.lat !== u.lat) { c.lng = u.lng; c.lat = u.lat; }
    if (was.strength !== u.strength) c.strength = u.strength;
    if ((was.sight_km ?? null) !== (u.sight_km ?? null)) c.sight_km = u.sight_km ?? null;
    if (Object.keys(c).length > 1) out.units.push(c);
  }
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
