// Gavelling Crisis map: bring the map back to an earlier point.
// The history keeps the old row of every change (crisis_map_log.before). To go back to the point right after a batch, every
// change made after it is undone: for each unit, country and drawn shape touched since, the state it had just before its
// first change since that point is the state to return to. The result is an edit set against the map as it is saved now,
// so it can wait in the unsent changes or be applied at once, like any other edit set.

import type { HistoryRow } from '@/lib/crisis/history';
import type { MapShape, UnitKind } from '@/lib/crisis/types';
import { emptySet, type EditSet, type MapData, type NewUnit, type ShapeInfo, type UnitChange } from './mapEdits';

type Row = Record<string, unknown>;
type Target = { kind: 'absent' } | { kind: 'default' } | { kind: 'row'; row: Row } | { kind: 'unknown' };

export interface RestorePlan {
  set: EditSet;
  /** Changes that were logged before the history kept the old state: they cannot be undone and are left as they are. */
  skipped: number;
}

const isObj = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown): string | null => (typeof x === 'string' && x ? x : null);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const KINDS: UnitKind[] = ['army', 'navy', 'air', 'missile', 'base', 'spy', 'sub', 'custom'];
const ids = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);

/**
 * `rows` are the whole history, newest first. `batchNewestId` is the id of the newest row of the batch to go back to:
 * every row above it in the list is newer and is undone. Answers null when that row is not in the list (too far back).
 */
export function buildRestoreSet(current: MapData, rows: HistoryRow[], batchNewestId: string, crisisId: string): RestorePlan | null {
  const at = rows.findIndex((r) => r.id === batchNewestId);
  if (at < 0) return null;
  const newer = rows.slice(0, at);

  // The first change since that point, per thing, decides what it looked like then.
  const targets = new Map<string, Target>();
  for (let i = newer.length - 1; i >= 0; i--) {
    const r = newer[i];
    const [table, op] = r.action.split(':');
    const old = isObj(r.before) ? r.before : null;
    const gone = old ?? (isObj(r.after) ? r.after : null);
    const either = isObj(r.after) ? r.after : old;
    if (!either) continue;
    let key: string | null = null;
    let target: Target;
    if (table === 'crisis_units') {
      key = str(either.id) && `u:${str(either.id)}`;
      target = op === 'insert' ? { kind: 'absent' } : op === 'update' ? (old ? { kind: 'row', row: old } : { kind: 'unknown' }) : gone ? { kind: 'row', row: gone } : { kind: 'unknown' };
    } else if (table === 'crisis_map_regions') {
      key = str(either.region_key) && `r:${str(either.region_key)}`;
      target = op === 'insert' ? { kind: 'default' } : op === 'update' ? (old ? { kind: 'row', row: old } : { kind: 'unknown' }) : gone ? { kind: 'row', row: gone } : { kind: 'default' };
    } else if (table === 'crisis_shapes') {
      key = str(either.id) && `s:${str(either.id)}`;
      target = op === 'insert' ? { kind: 'absent' } : op === 'update' ? (old ? { kind: 'row', row: old } : { kind: 'unknown' }) : gone ? { kind: 'row', row: gone } : { kind: 'unknown' };
    } else continue;
    if (key && !targets.has(key)) targets.set(key, target);
  }

  const set = emptySet();
  let skipped = 0;
  let n = 0;
  const units = new Map(current.units.map((u) => [u.id, u]));
  const regions = new Map(current.regions.map((r) => [r.region_key, r]));
  const shapes = new Map(current.shapes.map((s) => [s.id, s]));

  for (const [key, t] of targets) {
    const id = key.slice(2);
    if (t.kind === 'unknown') { skipped += 1; continue; }

    if (key.startsWith('u:')) {
      const u = units.get(id);
      if (t.kind === 'absent') { if (u) set.unitRemoves?.push(id); continue; }
      if (t.kind !== 'row') continue;
      const r = t.row;
      if (!u) {
        // Removed since: it comes back (under a new id; the database gives the real one when this is applied).
        const lng = r.lng; const lat = r.lat; const name = str(r.name);
        if (typeof lng !== 'number' || typeof lat !== 'number' || !name) { skipped += 1; continue; }
        const kind = str(r.kind) as UnitKind | null;
        const add: NewUnit = {
          id: `new-u-r${n++}`, name, kind: kind && KINDS.includes(kind) ? kind : 'custom',
          strength: typeof r.strength === 'number' ? r.strength : 1, owner_cabinet_id: str(r.owner_cabinet_id), note: str(r.note),
          revealed_to: ids(r.revealed_to), sight_km: typeof r.sight_km === 'number' ? r.sight_km : null, lng, lat,
        };
        set.unitAdds?.push(add);
        continue;
      }
      const c: UnitChange = { id };
      const rl = r.lng; const rt = r.lat; const rs = r.strength; const rn = str(r.name);
      if (typeof rl === 'number' && typeof rt === 'number' && (rl !== u.lng || rt !== u.lat)) { c.lng = rl; c.lat = rt; }
      if (typeof rs === 'number' && rs !== u.strength) c.strength = rs;
      if (rn && rn !== u.name) c.name = rn;
      const kind = str(r.kind) as UnitKind | null;
      if (kind && KINDS.includes(kind) && kind !== u.kind) c.kind = kind;
      if ('owner_cabinet_id' in r && str(r.owner_cabinet_id) !== (u.owner_cabinet_id ?? null)) c.owner_cabinet_id = str(r.owner_cabinet_id);
      if ('note' in r && str(r.note) !== (u.note ?? null)) c.note = str(r.note);
      if (Array.isArray(r.revealed_to) && [...ids(r.revealed_to)].sort().join() !== [...u.revealed_to].sort().join()) c.revealed_to = ids(r.revealed_to);
      if ('sight_km' in r) {
        const sk = typeof r.sight_km === 'number' ? r.sight_km : null;
        if (sk !== (u.sight_km ?? null)) c.sight_km = sk;
      }
      if (Object.keys(c).length > 1) set.units.push(c);
      continue;
    }

    if (key.startsWith('r:')) {
      const was = regions.get(id);
      const owner = t.kind === 'row' ? str(t.row.owner_cabinet_id) : null;
      const geometry = t.kind === 'row' && isObj(t.row.geometry) ? (t.row.geometry as unknown as NonNullable<MapData['regions'][number]['geometry']>) : null;
      if ((was?.owner_cabinet_id ?? null) !== owner || !same(was?.geometry ?? null, geometry)) {
        set.regions.push({ key: id, owner_cabinet_id: owner, geometry });
      }
      continue;
    }

    // A drawn shape.
    const s = shapes.get(id);
    if (t.kind === 'absent') { if (s) set.removeShapes.push(id); continue; }
    if (t.kind !== 'row') continue;
    const r = t.row;
    if (!isObj(r.geometry)) { skipped += 1; continue; }
    const geometry = r.geometry as unknown as MapShape['geometry'];
    if (s) {
      if (!same(s.geometry, geometry)) set.shapes.push({ id, geometry });
      if ('owner_cabinet_id' in r && (s.owner_cabinet_id ?? null) !== str(r.owner_cabinet_id)) set.owners.push({ id, owner_cabinet_id: str(r.owner_cabinet_id) });
      // Name, colour, description, zone type and who sees it.
      const info: ShapeInfo = { id };
      for (const k of ['label', 'color', 'description', 'zone_type'] as const) {
        if (k in r && (s[k] ?? null) !== str(r[k])) info[k] = str(r[k]);
      }
      if ('public' in r && typeof r.public === 'boolean' && r.public !== s.public) info.public = r.public;
      if (Array.isArray(r.revealed_to) && [...ids(r.revealed_to)].sort().join() !== [...(s.revealed_to ?? [])].sort().join()) info.revealed_to = ids(r.revealed_to);
      if (Object.keys(info).length > 1) set.shapeInfo?.push(info);
    } else {
      const kind = r.kind === 'line' ? 'line' : r.kind === 'zone' ? 'zone' : 'area';
      set.addShapes.push({
        id: `new-s-r${n++}`, crisis_id: crisisId, kind, owner_cabinet_id: str(r.owner_cabinet_id), label: str(r.label), color: str(r.color),
        geometry, public: r.public !== false, revealed_to: ids(r.revealed_to), description: str(r.description), zone_type: str(r.zone_type),
      });
    }
  }
  return { set, skipped };
}
