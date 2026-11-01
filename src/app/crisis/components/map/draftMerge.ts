// Gavelling Crisis map: the crisis team's shared unsent draft is edited by several people at once. Each editor keeps the
// version they last saw (crisis_map_drafts.version) and the draft as it was at that version (the "base"). When the
// database answers that someone saved in between, or a live ping brings a newer draft, the newer draft ("theirs") and
// this editor's current draft ("mine") are merged item by item: whatever this editor changed since the base wins, and
// everything else comes from the newer draft. Pure: no React, no database.

import { emptySet, isEmptySet, type EditSet, type UnitChange, type ShapeInfo } from './mapEdits';

const MISSING = '\u0000missing';
const enc = (x: unknown): string => (x === undefined ? MISSING : JSON.stringify(x ?? null));

function keyed<T>(list: T[] | undefined, key: (t: T) => string): Map<string, T> {
  return new Map((list ?? []).map((x) => [key(x), x]));
}

/** Whole items: an item this editor changed (added, edited or removed) since the base stays as this editor has it. */
function mergeItems<T>(base: Map<string, T>, mine: Map<string, T>, theirs: Map<string, T>): T[] {
  const out: T[] = [];
  for (const k of new Set([...base.keys(), ...mine.keys(), ...theirs.keys()])) {
    const touched = enc(base.get(k)) !== enc(mine.get(k));
    const pick = touched ? mine.get(k) : theirs.get(k);
    if (pick !== undefined) out.push(pick);
  }
  return out;
}

/** Patches (a unit's changes, a shape's details): field by field, so one person moves a unit while another changes its strength. */
function mergePatches<T extends { id: string }>(base: Map<string, T>, mine: Map<string, T>, theirs: Map<string, T>): T[] {
  const out: T[] = [];
  for (const k of new Set([...base.keys(), ...mine.keys(), ...theirs.keys()])) {
    const b = base.get(k) as Record<string, unknown> | undefined;
    const m = mine.get(k) as Record<string, unknown> | undefined;
    const t = theirs.get(k) as Record<string, unknown> | undefined;
    const fields = new Set([...Object.keys(b ?? {}), ...Object.keys(m ?? {}), ...Object.keys(t ?? {})]);
    fields.delete('id');
    const item: Record<string, unknown> = { id: k };
    for (const f of fields) {
      const touched = enc(b && f in b ? b[f] : undefined) !== enc(m && f in m ? m[f] : undefined);
      const src = touched ? m : t;
      if (src && f in src) item[f] = src[f];
    }
    if (Object.keys(item).length > 1) out.push(item as unknown as T);
  }
  return out;
}

/**
 * The draft after merging. `base` is the draft as the database held it at the version this editor last saw, `mine` is
 * this editor's draft now, `theirs` the newer draft from the database. Any of them may be null (nothing).
 */
export function mergeDrafts(base: EditSet | null, mine: EditSet | null, theirs: EditSet | null): EditSet | null {
  const b = base ?? emptySet(); const m = mine ?? emptySet(); const t = theirs ?? emptySet();
  const out: EditSet = {
    regions: mergeItems(keyed(b.regions, (x) => x.key), keyed(m.regions, (x) => x.key), keyed(t.regions, (x) => x.key)),
    shapes: mergeItems(keyed(b.shapes, (x) => x.id), keyed(m.shapes, (x) => x.id), keyed(t.shapes, (x) => x.id)),
    owners: mergeItems(keyed(b.owners, (x) => x.id), keyed(m.owners, (x) => x.id), keyed(t.owners, (x) => x.id)),
    removeShapes: mergeItems(keyed(b.removeShapes, (x) => x), keyed(m.removeShapes, (x) => x), keyed(t.removeShapes, (x) => x)),
    addShapes: mergeItems(keyed(b.addShapes, (x) => x.id), keyed(m.addShapes, (x) => x.id), keyed(t.addShapes, (x) => x.id)),
    units: mergePatches<UnitChange>(keyed(b.units, (x) => x.id), keyed(m.units, (x) => x.id), keyed(t.units, (x) => x.id)),
    unitAdds: mergeItems(keyed(b.unitAdds, (x) => x.id), keyed(m.unitAdds, (x) => x.id), keyed(t.unitAdds, (x) => x.id)),
    unitRemoves: mergeItems(keyed(b.unitRemoves, (x) => x), keyed(m.unitRemoves, (x) => x), keyed(t.unitRemoves, (x) => x)),
    chars: mergeItems(keyed(b.chars, (x) => x.id), keyed(m.chars, (x) => x.id), keyed(t.chars, (x) => x.id)),
    shapeInfo: mergePatches<ShapeInfo>(keyed(b.shapeInfo, (x) => x.id), keyed(m.shapeInfo, (x) => x.id), keyed(t.shapeInfo, (x) => x.id)),
  };
  // A unit removed by one person no longer takes edits from the other.
  const gone = new Set(out.unitRemoves ?? []);
  if (gone.size) out.units = out.units.filter((u) => !gone.has(u.id));
  return isEmptySet(out) ? null : out;
}
