// Gavelling Crisis: the name one staff member writes under in a committee room's chat: "Crisis Team · Lena". The chat shows
// the sender's name on every message, so every message says WHICH member of the crisis team wrote it. The name always starts with
// "Crisis Team", so command's "no chair" checks (isCrisisTeamName in staffChatName.ts) still ignore it.

import { CRISIS_TEAM_NAME } from './staffChatName';

const MAX = 80;

/** "Crisis Team · <person>", or just "Crisis Team" when the person's name is not known (an organiser looking in). */
export function staffSenderName(person: string | null | undefined): string {
  const who = (person ?? '').replace(/\s+/g, ' ').trim();
  if (!who) return CRISIS_TEAM_NAME;
  return `${CRISIS_TEAM_NAME} · ${who}`.slice(0, MAX).trim();
}
