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
