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
