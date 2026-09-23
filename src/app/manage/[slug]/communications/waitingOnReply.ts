// "Waiting on your reply": the one definition shared by the manage rail's
// Communications badge (manage/[slug]/layout.tsx) and the inbox rows on the
// Communications page.
//
// A thread is waiting when it is open, it is a real conversation (a
// swap_notice is an informational record, never a question), and its newest
// message came from the participant side: nobody on the team has answered
// since they last wrote. Reading a thread does not answer it, so this is not
// the old "unread" count, which cleared the moment a thread was opened.

export interface WaitingThreadLike {
  status: string;
  kind: string;
}

export interface WaitingMessageLike {
  is_organizer: boolean;
  created_at: string;
}

/** When the participant started waiting (their first message after the
 *  team's last one), or null when the thread is not waiting on a reply.
 *  `messages` may be in any order. */
export function waitingSince(thread: WaitingThreadLike, messages: WaitingMessageLike[]): string | null {
  if (thread.status === 'closed' || thread.kind === 'swap_notice') return null;
  if (messages.length === 0) return null;
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (sorted[sorted.length - 1].is_organizer) return null;
  let since = sorted[sorted.length - 1].created_at;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].is_organizer) break;
    since = sorted[i].created_at;
  }
  return since;
}

/** "12 min", "3 h", "2 days": how long someone has been waiting. */
export function waitAgeLabel(sinceIso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}
