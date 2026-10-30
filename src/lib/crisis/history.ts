'use client';
// Gavelling Crisis: a resource's history (the graph on Command, Resources and the delegate card).
// One RPC, crisis_resource_history(p_resource), oldest first. Staff also get the reason and who changed it;
// everyone else gets reason = null and by_name = null (the database decides, never the client).

import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, type CrisisRef } from './api';
import { getCrisisClient } from './client';
import type { UnitKind } from './types';

export interface ResourceHistoryRow {
  delta: number;
  amount_after: number;
  created_at: string;
  reason: string | null;
  by_name: string | null;
}

const num = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

/** The changes to one resource, oldest first. Throws a plain sentence on failure. */
export async function resourceHistory(ref: CrisisRef, resourceId: string): Promise<ResourceHistoryRow[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.rpc('crisis_resource_history', { p_resource: resourceId });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load the history.'));
  // A table function answers an array; a jsonb function may wrap it in { rows }.
  const raw = res.data as unknown;
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { rows?: unknown })?.rows) ? (raw as { rows: unknown[] }).rows : [];
  return list
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        delta: num(o.delta),
        amount_after: num(o.amount_after),
        created_at: typeof o.created_at === 'string' ? o.created_at : '',
        reason: typeof o.reason === 'string' && o.reason ? o.reason : null,
        by_name: typeof o.by_name === 'string' && o.by_name ? o.by_name : null,
      };
    })
    .filter((r) => r.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// ─────────── The map history (units, borders, areas) ───────────
// One RPC, crisis_history(p_crisis, p_ref, p_until, p_limit), newest first. Staff get every row and who made
// it (by_name); everyone else gets only the rows concerning their cabinet and by_name = null (the database
// decides, never the client). The functions below read it and turn a row into a typed change.


export type LngLat = [number, number];
export type ChangeFilter = 'troops' | 'borders' | 'areas';
export type ChangeOp = 'insert' | 'update' | 'delete';

export interface HistoryRow {
  id: string;
  action: string;   // 'crisis_units:update' ...
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  by_name: string | null;
  created_at: string;
}

export interface HistoryQuery {
  /** A unit or shape id, or a region key (ISO numeric like '214'). Omit for the whole crisis. */
  ref?: string | null;
  /** Only rows up to this time (the database adds 2 seconds). Used with a notification's created_at. */
  until?: string | null;
  limit?: number;
}

const asRecord = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null);

/** The map history, newest first. Throws a plain sentence on failure. */
export async function crisisHistory(ref: CrisisRef, q: HistoryQuery = {}): Promise<HistoryRow[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.rpc('crisis_history', { p_crisis: ref.id, p_ref: q.ref ?? null, p_until: q.until ?? null, p_limit: q.limit ?? 200 });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load the history.'));
  const raw = res.data as unknown;
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { rows?: unknown })?.rows) ? (raw as { rows: unknown[] }).rows : [];
  return list
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        id: String(o.id ?? ''),
        action: typeof o.action === 'string' ? o.action : '',
        before: asRecord(o.before),
        after: asRecord(o.after),
        by_name: typeof o.by_name === 'string' && o.by_name ? o.by_name : null,
        created_at: typeof o.created_at === 'string' ? o.created_at : '',
      };
    })
    .filter((r) => r.id && r.created_at && r.action)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export interface ChangeBase {
  rowId: string;
  at: string;
  by: string | null;
  op: ChangeOp;
  filter: ChangeFilter;
  /** Logged before the history kept the old state: only the state after is known. */
  noBefore: boolean;
}
export interface UnitChange extends ChangeBase {
  type: 'unit';
  unitId: string;
  name: string;
  nameFrom: string | null;
  kind: UnitKind;
  ownerFrom: string | null;
  ownerTo: string | null;
  strengthFrom: number | null;
  strengthTo: number | null;
  posFrom: LngLat | null;
  posTo: LngLat | null;
  moved: boolean;
  moveKm: number;
  bearing: string | null;
  strengthChanged: boolean;
  ownerChanged: boolean;
}
export interface RegionChange extends ChangeBase {
  type: 'region';
  key: string;
  ownerFrom: string | null;
  ownerTo: string | null;
}
export interface ShapeChange extends ChangeBase {
  type: 'shape';
  shapeId: string;
  label: string | null;
  shapeKind: 'line' | 'area';
  ownerFrom: string | null;
  ownerTo: string | null;
  geomFrom: { type: string; coordinates: unknown } | null;
  geomTo: { type: string; coordinates: unknown } | null;
  geometryChanged: boolean;
}
export type HistoryChange = UnitChange | RegionChange | ShapeChange;

const n = (x: unknown): number | null => {
  if (x === null || x === undefined || x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
};
const s = (x: unknown): string | null => (typeof x === 'string' && x ? x : null);
const UNIT_KINDS: UnitKind[] = ['army', 'navy', 'air', 'missile', 'base', 'spy', 'sub', 'custom'];
const pos = (r: Record<string, unknown> | null): LngLat | null => {
  if (!r) return null;
  const lng = n(r.lng); const lat = n(r.lat);
  return lng === null || lat === null ? null : [lng, lat];
};
const geom = (x: unknown): { type: string; coordinates: unknown } | null => {
  const o = asRecord(x);
  return o && typeof o.type === 'string' && 'coordinates' in o ? { type: o.type, coordinates: o.coordinates } : null;
};

/** Great-circle distance in km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** "south-east": the direction of travel from a to b. */
export function compassWord(a: LngLat, b: LngLat): string {
  const rad = Math.PI / 180;
  const dLng = (b[0] - a[0]) * rad;
  const y = Math.sin(dLng) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) / rad) + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

/** Turns one history row into a typed change; null when the row is not something people read. */
export function parseChange(row: HistoryRow): HistoryChange | null {
  const [table, opRaw] = row.action.split(':');
  const op: ChangeOp | null = opRaw === 'insert' || opRaw === 'update' || opRaw === 'delete' ? opRaw : null;
  if (!op) return null;
  const b = row.before; const a = row.after;
  const either = a ?? b;
  if (!either) return null;
  // Rows logged before 26 Oct 2026 kept only the new state: the "from" side is unknown, never "nobody".
  const base = { rowId: row.id, at: row.created_at, by: row.by_name, op, noBefore: op === 'update' && !b };

  if (table === 'crisis_units') {
    const unitId = s(either.id);
    if (!unitId) return null;
    const posFrom = pos(b); const posTo = pos(a);
    const moveKm = posFrom && posTo ? distanceKm(posFrom, posTo) : 0;
    const moved = moveKm >= 0.5;
    const strengthFrom = n(b?.strength); const strengthTo = n(a?.strength);
    const kindRaw = s(either.kind) as UnitKind | null;
    return {
      ...base, filter: 'troops', type: 'unit', unitId,
      name: s(a?.name) ?? s(b?.name) ?? 'A unit',
      nameFrom: s(b?.name),
      kind: kindRaw && UNIT_KINDS.includes(kindRaw) ? kindRaw : 'custom',
      ownerFrom: s(b?.owner_cabinet_id), ownerTo: s(a?.owner_cabinet_id),
      strengthFrom, strengthTo, posFrom, posTo, moved, moveKm,
      bearing: moved && posFrom && posTo ? compassWord(posFrom, posTo) : null,
      strengthChanged: op === 'update' && strengthFrom !== null && strengthTo !== null && strengthFrom !== strengthTo,
      ownerChanged: op === 'update' && !!b && s(b?.owner_cabinet_id) !== s(a?.owner_cabinet_id),
    };
  }
  if (table === 'crisis_map_regions') {
    const key = s(either.region_key);
    if (!key) return null;
    // A removed border row: the country goes from its holder to nobody (the log keeps the removed row as "after").
    const from = op === 'delete' ? s((b ?? a)?.owner_cabinet_id) : s(b?.owner_cabinet_id);
    const to = op === 'delete' ? null : s(a?.owner_cabinet_id);
    if (!base.noBefore && from === to) return null; // nothing changed hands
    return { ...base, filter: 'borders', type: 'region', key, ownerFrom: from, ownerTo: to };
  }
  if (table === 'crisis_shapes') {
    const shapeId = s(either.id);
    if (!shapeId) return null;
    const gf = geom(b?.geometry); const gt = geom(a?.geometry);
    const kindRaw = s(either.kind);
    return {
      ...base, filter: 'areas', type: 'shape', shapeId,
      label: s(a?.label) ?? s(b?.label),
      shapeKind: kindRaw === 'line' ? 'line' : gt?.type === 'LineString' || gf?.type === 'LineString' ? 'line' : 'area',
      ownerFrom: s(b?.owner_cabinet_id), ownerTo: s(a?.owner_cabinet_id),
      geomFrom: gf, geomTo: gt,
      geometryChanged: JSON.stringify(gf?.coordinates ?? null) !== JSON.stringify(gt?.coordinates ?? null),
    };
  }
  return null;
}

// ─────────── Batches ───────────
// Everything sent together is one entry: one Send of the unsent map changes, one directive answer (each is one
// transaction, so its rows share a time), or a quick burst by one person within a minute.

export interface HistoryBatch {
  /** The id of the newest row: stable while older rows are added below it. */
  id: string;
  /** The time of the newest row. */
  at: string;
  /** The time of the oldest row. */
  from: string;
  by: string | null;
  /** Every row of the batch, newest first (including rows nobody reads, so a restore sees them all). */
  rows: HistoryRow[];
}

export const BATCH_WINDOW_MS = 60_000;

/** Groups rows (newest first) into batches: the same person, each row within a minute of the batch's newest. */
export function groupBatches(rows: HistoryRow[], windowMs = BATCH_WINDOW_MS): HistoryBatch[] {
  const out: HistoryBatch[] = [];
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const cur = out[out.length - 1];
    if (cur && cur.by === r.by_name && new Date(cur.at).getTime() - t <= windowMs) {
      cur.rows.push(r);
      cur.from = r.created_at;
    } else {
      out.push({ id: r.id, at: r.created_at, from: r.created_at, by: r.by_name, rows: [r] });
    }
  }
  return out;
}
