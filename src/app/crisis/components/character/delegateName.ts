// Gavelling Crisis: the real name of the delegate who plays a character.
// crisis_sync_roster (docs/crisis/sql/001_core.sql) fills a delegate's display_name from their profile and, when the profile has
// no name, from the SEAT NAME, which is the character's own name. Such a delegate then read as "assigned to themselves"
// (HultMUN, 23 Nov 2026). A display name equal to the character's name (or blank) is not a person's name, so it is not shown as one.

import type { Character, Member } from '@/lib/crisis/types';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** True when the member's name is really the character's own name (or empty): the person's name was never set. */
export function nameIsCharacter(m: Pick<Member, 'display_name'>, c?: Pick<Character, 'name'> | null): boolean {
  const n = (m.display_name ?? '').trim();
  return !n || (!!c && same(n, c.name));
}

/** What to show for a delegate beside the character they play: their real name, else their email, else null (name not set). */
export function delegateLabel(m: Pick<Member, 'display_name' | 'email'>, c?: Pick<Character, 'name'> | null): string | null {
  if (!nameIsCharacter(m, c)) return m.display_name.trim();
  return m.email?.trim() || null;
}
