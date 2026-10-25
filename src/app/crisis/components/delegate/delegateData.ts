'use client';
// Gavelling Crisis: two small reads the delegate page needs that api.ts does not have.
// Both go through RLS, so a delegate only gets rows for directives they may see.

import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import type { DirectiveNote } from '@/lib/crisis/types';

/** Every note this person may read on the crisis, oldest first (internal staff notes are hidden by RLS). */
export async function listAllNotes(ref: CrisisRef): Promise<DirectiveNote[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.from('crisis_directive_notes').select('*').eq('crisis_id', ref.id).eq('internal', false).order('created_at').limit(5000);
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load the notes.'));
  return (res.data ?? []) as DirectiveNote[];
}

/** Co-authors of the directives this person may read. */
export async function listCoauthors(ref: CrisisRef): Promise<Array<{ directive_id: string; character_id: string }>> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.from('crisis_directive_coauthors').select('directive_id, character_id').limit(5000);
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load the co-authors.'));
  return (res.data ?? []) as Array<{ directive_id: string; character_id: string }>;
}
