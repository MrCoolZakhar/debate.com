// memberOrder.ts: the ONE order people of a delegation are listed in (owner,
// 21 Oct 2026): faculty advisors first, then head delegates, then delegates,
// then everyone else (observers and other roles), A to Z by name inside each
// group. Used by the People tab, the pop-up's leader lines, the Delegations
// list rows and the seat board's delegation views. Pure.

export interface OrderableMember {
  role: string;
  is_head_delegate?: boolean | null;
}

/** 0 faculty advisor, 1 head delegate, 2 delegate, 3 anyone else. */
export function memberRank(m: OrderableMember): number {
  if (m.role === 'faculty-advisor') return 0;
  if (m.role === 'head-delegate' || (m.role === 'delegate' && m.is_head_delegate)) return 1;
  if (m.role === 'delegate') return 2;
  return 3;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Faculty advisors, head delegates, delegates, others; A to Z inside each. */
export function sortMembers<T extends OrderableMember>(list: readonly T[], nameOf: (m: T) => string): T[] {
  return [...list].sort((a, b) => memberRank(a) - memberRank(b) || collator.compare(nameOf(a), nameOf(b)));
}

/** The most leaders any delegation screen names (owner, 21 Oct 2026). */
export const LEADERS_SHOWN_MAX = 2;

export interface LeaderCandidate extends OrderableMember {
  user_id: string | null;
}

/**
 * The leaders a delegation screen names, at most LEADERS_SHOWN_MAX (owner,
 * 21 Oct 2026): the person who CREATED the delegation always (even after being
 * moved to delegate), then faculty advisors, then head delegates. With one
 * advisor and two head delegates that is the advisor and one head delegate.
 * Order: the creator first when they are a leader, then advisors, then head
 * delegates; a creator who is no longer a leader comes last. `members` is
 * already filtered to the caller's statuses (live or accepted). Pure.
 */
export function shownLeaders<T extends LeaderCandidate>(
  members: readonly T[],
  creatorUserId: string | null | undefined,
  nameOf: (m: T) => string,
  max: number = LEADERS_SHOWN_MAX,
): T[] {
  const creator = creatorUserId ? members.find(m => m.user_id === creatorUserId) ?? null : null;
  const leaders = sortMembers(members.filter(m => memberRank(m) <= 1 && m !== creator), nameOf);
  const room = Math.max(0, max - (creator ? 1 : 0));
  const picked = leaders.slice(0, room);
  if (!creator) return picked;
  return memberRank(creator) <= 1 ? [creator, ...picked] : [...picked, creator];
}

/** Every leader a delegation has (advisors and head delegates, plus the
 *  creator), for "+N more" counts beside the shown ones. */
export function leaderCount<T extends LeaderCandidate>(members: readonly T[], creatorUserId: string | null | undefined): number {
  return members.filter(m => memberRank(m) <= 1 || (!!creatorUserId && m.user_id === creatorUserId)).length;
}
