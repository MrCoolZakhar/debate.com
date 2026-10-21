// One window event for "the delegation changed on this page" (owner, 21 Oct
// 2026: the Overview's "Your Seat" did not appear after a leader allocated
// themselves until a reload). Fired after every landed write on the leader
// card (allocate, unallocate, a swap or a move, a paper uploaded for someone,
// a role change, an import); the Overview's read (useDelegationOverview)
// listens and swaps its data in place, never behind a loader.

export const DELEGATION_CHANGED_EVENT = 'gv-delegation-changed';

export function announceDelegationChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DELEGATION_CHANGED_EVENT));
}
