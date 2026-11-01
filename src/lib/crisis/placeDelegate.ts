// Gavelling Crisis: put a delegate on a character (used by "Give a character" and "Assign a spare delegate" in Staff and Access).
// A delegate's cabinet always follows their character (a database trigger), and every active character already has its seat in
// the cabinet's room. A SPARE character goes through crisis_give_spare (the database's own path); if that refuses for any other
// reason than "someone else got it first", the delegate is set on the character directly and the character is made active.

import { crisisError, giveSpare, saveCharacter, saveMember, type CrisisRef } from './api';
import { UserFacingError } from '@/lib/friendlyError';
import { getCrisisClient } from './client';
import type { Character, Member } from './types';

export type PlaceResult = { ok: true } | { ok: false; reason: 'taken' };

export async function placeDelegate(ref: CrisisRef, member: Pick<Member, 'id'>, character: Pick<Character, 'id' | 'status'>): Promise<PlaceResult> {
  // Somebody may have been given this character a moment ago: ask the database, not the page.
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const taken = await client.from('crisis_members').select('id').eq('character_id', character.id).neq('id', member.id).limit(1);
  if (taken.error) throw new UserFacingError(crisisError(taken.error, 'Could not check the character.'));
  if (taken.data?.length) return { ok: false, reason: 'taken' };

  if (character.status === 'spare') {
    try {
      const r = await giveSpare(ref, member.id, character.id);
      if (r.ok) return { ok: true };
      if (r.reason === 'taken') return { ok: false, reason: 'taken' };
    } catch { /* fall through to the direct way below */ }
    await saveMember(ref, member.id, { character_id: character.id });
    await saveCharacter(ref, { id: character.id, status: 'active' });
    return { ok: true };
  }
  await saveMember(ref, member.id, { character_id: character.id });
  return { ok: true };
}
