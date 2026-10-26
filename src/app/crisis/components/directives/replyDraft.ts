// Gavelling Crisis: the reply being written is saved on this device, one draft per directive,
// restored when the directive is opened again and cleared once the reply is sent.
import type { DirectiveOutcome } from '@/lib/crisis/types';

export interface ReplyDraft { outcome: DirectiveOutcome | null; reply: string }

const keyOf = (crisisId: string, directiveId: string) => `gavelling-crisis-reply-draft:${crisisId}:${directiveId}`;

export function readReplyDraft(crisisId: string, directiveId: string): ReplyDraft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(crisisId, directiveId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ReplyDraft>;
    const reply = typeof v.reply === 'string' ? v.reply : '';
    const outcome = (['approved', 'partial', 'denied', 'clarify', 'later'] as const).find((o) => o === v.outcome) ?? null;
    return reply || outcome ? { outcome, reply } : null;
  } catch {
    return null;
  }
}

/** Saves the draft, or removes it when there is nothing to keep. Returns whether a draft is now stored. */
export function writeReplyDraft(crisisId: string, directiveId: string, draft: ReplyDraft | null): boolean {
  try {
    if (!draft || (!draft.reply.trim() && !draft.outcome)) {
      window.localStorage.removeItem(keyOf(crisisId, directiveId));
      return false;
    }
    window.localStorage.setItem(keyOf(crisisId, directiveId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
