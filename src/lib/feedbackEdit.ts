// ============================================================
// src/lib/feedbackEdit.ts
//
// EDITING A CHAIR NOTE THAT IS ALREADY WRITTEN — the one write behind the
// click-to-edit comments on the Scoreboard's History tab and in a delegation's
// profile.
//
// WHY IT IS NOT `updateFeedback` IN committeeService.ts. That function is the
// comment dock's own writer (`FeedbackLogPanel`), it returns void, and supabase-js
// resolves with `error: null` both for an RLS refusal and for an update that
// matched no row (AGENTS.md RULE 5). A chair correcting a note on the scoreboard
// has no dock open to show them the text again, so a silent failure would read as
// a successful edit that quietly reverts on the next refetch. This one asks for
// `.select('id')`, counts the rows, and says whether it LANDED.
//
// IT IS ALSO CONDITIONAL ON THE AUTHOR. `feedback` rows are owned by the chair
// who wrote them (AGENTS.md, chair roles: a chair claims a stored row only when
// `chair_name` matches). The `.eq('chair_name', chairName)` here is that rule in
// the statement itself, so a UI slip can never overwrite another chair's note
// even though RLS would allow it (rule 15: the chair suffix is the only write
// credential and every chair device has it). Zero rows therefore means one of
// "not yours", "gone", or "refused", and all three are reported the same way: the
// edit did not land, put the old text back.
//
// Content only. Ratings stay where they are written, in the dock.
// ============================================================

import { sessionClient } from './sessionClient';
import type { FeedbackEntry, FeedbackLevel } from './committeeService';

export async function updateFeedbackContent(
  id: string,
  chairName: string,
  content: string,
  code: string,
  chairSuffix?: string,
): Promise<boolean> {
  if (!id || !chairName) return false;
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('feedback')
    .update({ content })
    .eq('id', id)
    .eq('chair_name', chairName)
    .select('id');
  if (error) {
    console.error('Error editing feedback note:', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

// ============================================================
// THE COMMENT DOCK'S OWN WRITES (Oct 2026, Asia WorldMUN / TY7ZZ3)
//
// `addFeedback` / `updateFeedback` in committeeService.ts were fire-and-forget: they
// returned void (or null) whatever happened, so a note whose write was refused or lost
// on venue Wi-Fi was simply gone, and two UPDATEs sent a second apart could land in the
// wrong order and leave the SHORTER text in the database. The dock now writes through
// `src/lib/commentDockSync.ts`, which sends one write per note at a time and needs to
// know whether each one LANDED. These three are its transport.
// ============================================================


export interface DockNoteRow {
  id: string;
  committeeId: string;
  country: string;
  chairName: string;
  content: string;
  factorScores: Record<string, number>;
  speechContext: string | null;
  speechSeconds: number | null;
  speechTopic: string | null;
  spokenAt: string | null;
}

/** INSERT with a CLIENT-CHOSEN id, so a retry after a lost response can never make a
 *  second row: the primary key refuses it with 23505, which means the first attempt landed.
 *  'ok' = inserted now, 'exists' = an earlier attempt already inserted it, 'error' = not saved. */
export async function insertDockNote(row: DockNoteRow, code: string, chairSuffix?: string): Promise<'ok' | 'exists' | 'error'> {
  const { data, error } = await sessionClient(code, chairSuffix).from('feedback').insert({
    id: row.id,
    committee_id: row.committeeId,
    country: row.country,
    chair_name: row.chairName,
    content: row.content,
    level: 'speech',
    factor_scores: row.factorScores,
    speech_context: row.speechContext,
    speech_seconds: row.speechSeconds,
    speech_topic: row.speechTopic,
    spoken_at: row.spokenAt,
  }).select('id');
  if (error) {
    if ((error as { code?: string }).code === '23505') return 'exists';
    console.error('Error saving a dock note:', error);
    return 'error';
  }
  return (data?.length ?? 0) > 0 ? 'ok' : 'error';
}

/** UPDATE one of THIS chair's rows, counting rows (RULE 5). 'gone' = the statement ran and
 *  matched nothing (deleted, or not this chair's): the caller re-inserts or gives up. */
export async function patchDockNote(
  id: string,
  chairName: string,
  patch: Partial<Pick<DockNoteRow, 'content' | 'factorScores' | 'speechContext' | 'speechSeconds' | 'speechTopic' | 'spokenAt'>>,
  code: string,
  chairSuffix?: string,
): Promise<'ok' | 'gone' | 'error'> {
  const update: Record<string, unknown> = {};
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.factorScores !== undefined) update.factor_scores = patch.factorScores;
  if (patch.speechContext !== undefined) update.speech_context = patch.speechContext;
  if (patch.speechSeconds !== undefined) update.speech_seconds = patch.speechSeconds;
  if (patch.speechTopic !== undefined) update.speech_topic = patch.speechTopic;
  if (patch.spokenAt !== undefined) update.spoken_at = patch.spokenAt;
  if (Object.keys(update).length === 0) return 'ok';
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('feedback').update(update).eq('id', id).eq('chair_name', chairName).select('id');
  if (error) {
    console.error('Error updating a dock note:', error);
    return 'error';
  }
  return (data?.length ?? 0) > 0 ? 'ok' : 'gone';
}

/** Every feedback row of a committee, or NULL when the read failed. `getFeedbackForCommittee`
 *  answers [] on an error, which the dock used to apply: every other chair's note vanished
 *  from the screen until the next successful read. */
export async function fetchDockFeedback(committeeId: string, code: string, chairSuffix?: string): Promise<FeedbackEntry[] | null> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('feedback').select('*').eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error || !data) return null;
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    country: row.country as string,
    chairName: row.chair_name as string,
    content: (row.content as string) ?? '',
    level: ((row.level as FeedbackLevel) ?? 'speech'),
    factorScores: (row.factor_scores as Record<string, number>) ?? {},
    speechContext: (row.speech_context as string | null) ?? null,
    speechSeconds: (row.speech_seconds as number | null) ?? null,
    speechTopic: (row.speech_topic as string | null) ?? null,
    spokenAt: (row.spoken_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}
