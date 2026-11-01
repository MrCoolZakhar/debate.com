// Gavelling Crisis: when "Map changes wait until you send them" is on (the default), the MAP parts of a staff reply
// (unit moves and amounts, country holders, drawn borders and areas) do not run with the reply. They are added to the
// crisis team's shared unsent map (crisis_map_drafts) and reach delegates with the next "Send to delegates", like any
// other staff map edit. Resources, character status and news still apply with the reply.
// Pure builders plus one function that writes the shared draft. Adding is idempotent: laying the same items over a
// draft that already holds them changes nothing, so a retried reply never duplicates anything.

import { loadMap, loadMapDraftVersioned, saveMapDraftVersioned, type CrisisRef } from '@/lib/crisis/api';
import { UserFacingError } from '@/lib/friendlyError';
import type { RegionGeometry } from '@/lib/crisis/types';
import { emptySet, isEmptySet, parseSet, type EditSet, type UnitChange } from '../map/mapEdits';
import { mergeDrafts } from '../map/draftMerge';
import type { EffectsDraft } from './replyDraft';
import type { ReplyPowers } from './ReplyActions';

/** The line shown before sending when the reply holds map changes and they wait. */
export const MAP_WAITS_NOTE = 'Map changes go to the unsent map and reach delegates when someone presses Send to delegates.';

/** The staged unit changes the staffer may send (units power). */
function stagedUnits(effects: EffectsDraft, powers: ReplyPowers): UnitChange[] {
  if (!powers.units) return [];
  const out: UnitChange[] = [];
  for (const [id, u] of Object.entries(effects.units)) {
    const c: UnitChange = { id };
    if (u.lng !== undefined && u.lat !== undefined) { c.lng = u.lng; c.lat = u.lat; }
    if (u.strength !== undefined) c.strength = u.strength;
    if (Object.keys(c).length > 1) out.push(c);
  }
  return out;
}

/** The staged territory changes the staffer may send (map power): country holders and the map edit set. */
function stagedRegions(effects: EffectsDraft, powers: ReplyPowers): Array<[string, string | null]> {
  return powers.map ? Object.entries(effects.regions) : [];
}

/** True when the reply holds anything that would go to the unsent map instead of running with the reply. */
export function hasReplyMapParts(effects: EffectsDraft, powers: ReplyPowers): boolean {
  return stagedUnits(effects, powers).length > 0 || stagedRegions(effects, powers).length > 0 || (powers.map && !isEmptySet(effects.map));
}

/**
 * The reply's map parts as one edit set. A country holder staged on its own keeps the outline that country has now
 * (`geometryOf`), because a set entry replaces holder and outline together; the reply's own edit set wins over the plain
 * holders and unit changes for the items it touches.
 */
export function replyMapSet(effects: EffectsDraft, powers: ReplyPowers, geometryOf: (key: string) => RegionGeometry | null): EditSet | null {
  const plain = emptySet();
  for (const [key, owner] of stagedRegions(effects, powers)) plain.regions.push({ key, owner_cabinet_id: owner, geometry: geometryOf(key) });
  plain.units = stagedUnits(effects, powers);
  const own = powers.map ? parseSet(effects.map) : null;
  const both = mergeDrafts(null, own, isEmptySet(plain) ? null : plain);
  return both && !isEmptySet(both) ? both : null;
}

/** Order- and key-order-insensitive text of a set, to tell whether laying the reply over a draft changed anything. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).sort().join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/**
 * Adds the reply's map parts to the team's shared unsent map. Saved on the version it last saw; when someone saved in
 * between, their draft is merged with the reply's items again and saved on their version (bounded). A draft that already
 * holds all of it is left alone (no save). Throws when it could not be saved: the caller must then NOT send the answer.
 */
export async function addReplyMapToDraft(ref: CrisisRef, effects: EffectsDraft, powers: ReplyPowers): Promise<void> {
  if (!hasReplyMapParts(effects, powers)) return;
  // The outline each staged holder keeps comes from the sent map; only read when a plain holder is staged.
  let sentGeometry: Map<string, RegionGeometry | null> | null = null;
  if (stagedRegions(effects, powers).length) {
    const sent = await loadMap(ref);
    sentGeometry = new Map(sent.regions.map((r) => [r.region_key, (r.geometry ?? null) as RegionGeometry | null]));
  }
  let cur = await loadMapDraftVersioned(ref);
  for (let attempt = 0; attempt < 5; attempt++) {
    const theirs = parseSet(cur.payload);
    // The team's unsent outline for a country, if any, is the one to keep; else the sent one.
    const draftGeometry = new Map((theirs?.regions ?? []).map((r) => [r.key, r.geometry]));
    const mine = replyMapSet(effects, powers, (key) => (draftGeometry.has(key) ? (draftGeometry.get(key) ?? null) : (sentGeometry?.get(key) ?? null)));
    if (!mine) return;
    const merged = mergeDrafts(null, mine, theirs);
    if (merged && canon(merged) === canon(theirs ?? emptySet())) return;   // already in the draft
    const res = await saveMapDraftVersioned(ref, (merged ?? emptySet()) as unknown as Record<string, unknown>, cur.version);
    if (res.ok) return;
    cur = { payload: res.payload, version: res.version, updated_by: res.updated_by };
  }
  throw new UserFacingError('The team is changing the unsent map right now. Try sending again.');
}
