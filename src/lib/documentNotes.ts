// ============================================================
// src/lib/documentNotes.ts
//
// A CHAIR'S NOTE ON ONE SPONSOR OF ONE DOCUMENT (Oct 2026, after Asia WorldMUN
// DISEC: "a commenter view during the presentation and Q&A of a doc, the
// sponsors in three fields at the same time, so chairs can take comments").
//
// STORED IN `feedback`, LIKE THE COMMENT DOCK, BUT NEVER AS A SPEECH NOTE.
// One row per (author chair, document, sponsor country):
//   level          = 'document'   (the column has no CHECK; nothing else writes it)
//   speech_context = 'document'
//   speech_topic   = the document's code ("WP 1.2", "DR 1/3"), which the
//                    database assigns once and never changes (documents_assign_doc_code)
//   speech_seconds = 0, spoken_at = null, factor_scores = {}
//
// WHY A LEVEL OF ITS OWN. Every reader that places a note on a speech filters
// `level === 'speech'` first: the comment dock (FeedbackLogPanel, all three claim
// passes), the scoreboard History (`attachNotes`, `attachReplyNotes` in
// sessionHistory.ts) and the quality score's per-speech fallback (scoring.ts).
// A 'speech' row with no matching speech would be attached by History to the
// delegation's nearest speech within ten minutes, i.e. a paper note would read as
// a speech note. With level 'document' none of them can claim it. The quality
// score's recap path only reads 'session' / 'conference', so an empty
// factor_scores never moves a score either. The note still reaches the
// delegation's profile on the scoreboard, under "Other comments", because that
// list is every comment of the delegation not placed on a speech.
//
// AUTHOR RULE. A chair edits only rows whose `chair_name` is theirs: updates go
// through `updateFeedbackContent`, which is conditional on the author in the
// statement itself (rule 15: RLS lets any chair-suffix holder write anything).
// ============================================================

import { sessionClient } from './sessionClient';
import { updateFeedbackContent } from './feedbackEdit';

export const DOC_NOTE_LEVEL = 'document';
export const DOC_NOTE_CONTEXT = 'document';

export interface DocumentNote {
  id: string;
  country: string;
  chairName: string;
  content: string;
  createdAt: string;
}

/** Every chair's notes on one document, oldest first. `null` when the read failed,
 *  so a caller never mistakes a dropped connection for "nobody wrote anything". */
export async function loadDocumentNotes(
  committeeId: string, docCode: string, code: string, chairSuffix?: string,
): Promise<DocumentNote[] | null> {
  try {
    const { data, error } = await sessionClient(code, chairSuffix).from('feedback')
      .select('id, country, chair_name, content, created_at')
      .eq('committee_id', committeeId)
      .eq('level', DOC_NOTE_LEVEL)
      .eq('speech_context', DOC_NOTE_CONTEXT)
      .eq('speech_topic', docCode)
      .order('created_at', { ascending: true });
    if (error || !data) return null;
    return (data as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      country: (r.country as string) ?? '',
      chairName: (r.chair_name as string) ?? '',
      content: (r.content as string) ?? '',
      createdAt: (r.created_at as string) ?? '',
    }));
  } catch {
    return null;
  }
}

/** Insert this chair's note. Returns the new row id, or null when it did not land. */
export async function insertDocumentNote(
  committeeId: string, country: string, chairName: string, content: string, docCode: string,
  code: string, chairSuffix?: string,
): Promise<string | null> {
  if (!chairName || !docCode) return null;
  try {
    const { data, error } = await sessionClient(code, chairSuffix).from('feedback').insert({
      committee_id: committeeId,
      country,
      chair_name: chairName,
      content,
      level: DOC_NOTE_LEVEL,
      factor_scores: {},
      speech_context: DOC_NOTE_CONTEXT,
      speech_seconds: 0,
      speech_topic: docCode,
      spoken_at: null,
    }).select('id').single();
    if (error || !data) { if (error) console.error('Error adding document note:', error); return null; }
    return data.id as string;
  } catch (e) {
    console.error('Error adding document note:', e);
    return null;
  }
}

/** Update this chair's own note. True only when a row of this author was changed. */
export function updateDocumentNote(
  id: string, chairName: string, content: string, code: string, chairSuffix?: string,
): Promise<boolean> {
  return updateFeedbackContent(id, chairName, content, code, chairSuffix).catch(() => false);
}
