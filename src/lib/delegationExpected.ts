// A delegation's expected size as every screen shows it (owner, 22 Oct 2026):
// "always update expected everywhere based on minimum how many are paid OR how
// many have joined a delegation, whichever is bigger". The leaders' own pledge
// (spots_pledged, Christian's money side) can only raise it, never lower it
// below what has actually happened. Display only: nothing here writes a
// pledge or a ticket. Allocations default to this number as their target.

export interface ExpectedInputs {
  /** Delegate tickets paid (delegate spots, never advisor tickets). */
  paidDelegateSpots?: number | null;
  /** Delegates and head delegates in the delegation who are not rejected or withdrawn. */
  joinedDelegates?: number | null;
  /** What the leaders pledged (their expected size), when known. */
  pledged?: number | null;
}

export function delegationExpected({ paidDelegateSpots, joinedDelegates, pledged }: ExpectedInputs): number {
  const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return Math.max(n(paidDelegateSpots), n(joinedDelegates), n(pledged));
}
