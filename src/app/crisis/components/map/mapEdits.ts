// Gavelling Crisis map: a set of map changes (country outlines and holders, drawn territories) as one value.
// The war map saves it straight away; a directive reply keeps it in its draft and saves it when the reply is
// sent. Also the helpers both sides share: laying a set over map data, and working a set out from two copies
// of the data.

import { deleteShape, saveRegionGeometries, saveShape } from '@/lib/crisis/api';
import type { MapRegion, MapShape, MapUnit, RegionGeometry } from '@/lib/crisis/types';

export type MapData = { regions: MapRegion[]; units: MapUnit[]; shapes: MapShape[] };

/** Everything one save changes (and, the other way round, what its Undo puts back). */
export interface EditSet {
  regions: Array<{ key: string; owner_cabinet_id: string | null; geometry: RegionGeometry | null }>;
  shapes: Array<{ id: string; geometry: MapShape['geometry'] }>;
  owners: Array<{ id: string; owner_cabinet_id: string | null }>;
  removeShapes: string[];
  addShapes: MapShape[];
}

export const emptySet = (): EditSet => ({ regions: [], shapes: [], owners: [], removeShapes: [], addShapes: [] });

export function isEmptySet(s: EditSet | null | undefined): boolean {
  return !s || (!s.regions.length && !s.shapes.length && !s.owners.length && !s.removeShapes.length && !s.addShapes.length);
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
  return { ...d, regions, shapes: [...shapes, ...s.addShapes] };
}

/** Saves an edit set; answers the ids the database gave the added shapes, in order. */
export async function saveSet(ref: Parameters<typeof saveShape>[0], s: EditSet): Promise<string[]> {
  await saveRegionGeometries(ref, s.regions);
  for (const x of s.shapes) await saveShape(ref, { id: x.id, geometry: x.geometry });
  for (const x of s.owners) await saveShape(ref, { id: x.id, owner_cabinet_id: x.owner_cabinet_id });
  for (const id of s.removeShapes) await deleteShape(ref, id);
  const ids: string[] = [];
  for (const a of s.addShapes) {
    ids.push(await saveShape(ref, {
      kind: a.kind, owner_cabinet_id: a.owner_cabinet_id, label: a.label, color: a.color, geometry: a.geometry, public: a.public, revealed_to: a.revealed_to,
    }));
  }
  return ids;
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
