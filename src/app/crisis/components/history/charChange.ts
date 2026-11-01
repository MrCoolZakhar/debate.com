// Gavelling Crisis: a character moved on the map, as the map history tells it. The database writes every character move
// to the map history (action 'crisis_characters:update'; before and after are { id, name, kind: 'character', lng, lat,
// owner_cabinet_id, picture_url }, and everyone but staff gets no picture_url: the portrait then comes from the
// characters the page already holds). src/lib/crisis/history.ts parseChange does not know that table, so the history
// pages read rows through parseAnyChange here: a unit, border or area is parsed as before, a character move becomes a
// CharChange that sits beside them.

import {
  compassWord, distanceKm, parseChange,
  type ChangeBase, type ChangeFilter, type ChangeOp, type HistoryChange, type HistoryRow, type LngLat,
} from '@/lib/crisis/history';
import { focusForChange, type MapFocus } from '@/lib/crisis/mapFocus';

export interface CharChange extends Omit<ChangeBase, 'filter'> {
  filter: 'characters';
  type: 'character';
  charId: string;
  name: string;
  ownerFrom: string | null;
  ownerTo: string | null;
  posFrom: LngLat | null;
  posTo: LngLat | null;
  /** The picture the row itself carried (staff only); otherwise look the character up by id. */
  picture: string | null;
  moved: boolean;
  moveKm: number;
  bearing: string | null;
}

/**
 * A row the pages could not read (an unknown kind, a missing or damaged part): it is told as a plain "A change" and never breaks
 * the list around it.
 */
export interface OtherChange {
  rowId: string; at: string; by: string | null; op: ChangeOp; noBefore: boolean;
  filter: 'other'; type: 'other';
}

export type AnyChange = HistoryChange | CharChange | OtherChange;
export type AnyFilter = ChangeFilter | 'characters';

const num = (x: unknown): number | null => {
  if (x === null || x === undefined || x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
};
const str = (x: unknown): string | null => (typeof x === 'string' && x ? x : null);
const pos = (r: Record<string, unknown> | null): LngLat | null => {
  if (!r) return null;
  const lng = num(r.lng); const lat = num(r.lat);
  return lng === null || lat === null ? null : [lng, lat];
};

/** A character move as a typed change; null for any other row. */
export function parseCharChange(row: HistoryRow): CharChange | null {
  if (row.action !== 'crisis_characters:update') return null;
  const b = row.before; const a = row.after;
  const either = a ?? b;
  if (!either) return null;
  const charId = str(either.id);
  if (!charId) return null;
  const posFrom = pos(b); const posTo = pos(a);
  if (!posFrom && !posTo) return null;
  // A row that kept the old state and shows the same spot twice is not a move.
  if (posFrom && posTo && posFrom[0] === posTo[0] && posFrom[1] === posTo[1]) return null;
  const moveKm = posFrom && posTo ? distanceKm(posFrom, posTo) : 0;
  return {
    rowId: row.id, at: row.created_at, by: row.by_name, op: 'update', noBefore: !b,
    filter: 'characters', type: 'character', charId,
    name: str(a?.name) ?? str(b?.name) ?? 'A character',
    ownerFrom: str(b?.owner_cabinet_id), ownerTo: str(a?.owner_cabinet_id) ?? str(b?.owner_cabinet_id),
    posFrom, posTo, picture: str(a?.picture_url) ?? str(b?.picture_url),
    moved: !!posFrom && !!posTo, moveKm,
    bearing: posFrom && posTo && moveKm >= 0.5 ? compassWord(posFrom, posTo) : null,
  };
}

/** A plain "A change" for a row that cannot be read. */
function otherChange(row: HistoryRow): OtherChange {
  const op = row.action.split(':')[1];
  return {
    rowId: row.id, at: row.created_at, by: row.by_name, op: op === 'insert' || op === 'delete' ? op : 'update',
    noBefore: !row.before, filter: 'other', type: 'other',
  };
}

/**
 * Any row people read on the history pages: a unit, a border, an area or a character. A row that cannot be read (it
 * throws, or is damaged) becomes a plain "A change" instead of breaking the page; a row that is meant to be hidden (a border
 * that changed nothing, a kind nobody reads) is still null.
 */
export function parseAnyChange(row: HistoryRow): AnyChange | null {
  try {
    return parseChange(row) ?? parseCharChange(row);
  } catch {
    return otherChange(row);
  }
}

/** Where a change happened, for "Open the map". */
export function focusForAny(c: AnyChange): MapFocus {
  if (c.type === 'other') return {};
  if (c.type !== 'character') return focusForChange(c);
  const p = c.posTo ?? c.posFrom;
  return p ? { bbox: [p[0], p[1], p[0], p[1]] } : {};
}
