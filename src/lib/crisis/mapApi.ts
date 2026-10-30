'use client';
// Gavelling Crisis: the map's bigger writes. crisis_apply_map_set_v2 takes everything the first function takes plus
// units added and removed, every field of a unit, and character moves, all in one transaction (SQL part 22, see
// docs/crisis/sql/022_map_set_v2.sql). Until it exists the caller falls back to the first function and one-row writes
// (src/app/crisis/components/map/mapEdits.ts sendSet), so the map works either way.

import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, type CrisisRef } from './api';
import { getCrisisClient } from './client';

/** null = not known yet; false = the database has no v2 function (asked once, remembered for the page). */
let v2Known: boolean | null = null;

const missingFunction = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? ''));

/** One transaction for a whole map edit set. Answers null when the database does not have the v2 function yet. */
export async function applyMapSetV2(ref: CrisisRef, set: Record<string, unknown>): Promise<{ added: string[]; addedUnits: string[] } | null> {
  if (v2Known === false) return null;
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.rpc('crisis_apply_map_set_v2', { p_crisis: ref.id, p_set: set });
  if (res.error) {
    if (missingFunction(res.error)) { v2Known = false; return null; }
    throw new UserFacingError(crisisError(res.error, 'Could not save the map changes.'));
  }
  const out = res.data as { ok?: boolean; added?: string[]; addedUnits?: string[] } | null;
  if (!out?.ok) throw new UserFacingError('Could not save the map changes.');
  v2Known = true;
  return { added: Array.isArray(out.added) ? out.added : [], addedUnits: Array.isArray(out.addedUnits) ? out.addedUnits : [] };
}

/**
 * Removes a unit and checks a row really went. A delete that RLS refuses answers no error and no rows, so it is read
 * back: gone already is fine, still there means this person has no power over units.
 */
export async function deleteUnitChecked(ref: CrisisRef, id: string): Promise<void> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.from('crisis_units').delete().eq('id', id).select('id');
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not remove the unit.'));
  if (res.data?.length) return;
  const left = await client.from('crisis_units').select('id').eq('id', id).maybeSingle();
  if (left.error) throw new UserFacingError(crisisError(left.error, 'Could not remove the unit.'));
  if (left.data) throw new UserFacingError('Only someone with power over units can remove a unit.');
}
