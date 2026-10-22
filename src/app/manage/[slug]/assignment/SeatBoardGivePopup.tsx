'use client';

// ── The committee pop-up in "Give to <Delegation>" mode ──────────────────────
// Opened from the seat board's Delegations tab (SeatBoardDelegations.tsx) by a
// committee ring while a delegation is open, or by a delegation dropped on a
// ring. It IS the classic board's committee pop-up (CommitteeDetailModal.tsx,
// owner, 22 Oct 2026: "similar to BEFORE in a committee"): the same card,
// header, allocations-filled bar and rows by importance, in its give mode:
//   * an open seat this delegation can take reads "Give": one tap gives the
//     country (every seat of it still open to them, a double is both seats)
//     and the pop-up STAYS OPEN for the next tap, with a running tally and
//     what the delegation still needs;
//   * a country given here reads "Given" with Undo, and the whole row is the
//     Undo: tapping it again takes it back (only its empty seats go back);
//   * nothing is locked while a write runs; the Delegations tab queues the
//     taps in order and reconciles its overlay with what lands.
// One pop-up at a time. Nothing here writes: onGive / onUndo are the
// Delegations tab's writes.

import { allocationSocietyId } from '@/lib/assignmentFit';
import { type AllocationRow, type CommitteeData, type SlotRow } from '@/app/manage/[slug]/assignment/assignmentKit';
import { CommitteeOverviewModal } from '@/app/manage/[slug]/assignment/CommitteeDetailModal';

export interface GiveSociety {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** Who holds an allocation: a delegation, or a person. */
export interface HolderView {
  kind: 'delegation' | 'person';
  name: string;
  avatarUrl: string | null;
  logoUrl: string | null;
}

export function holderOf(a: AllocationRow, societyName: (id: string) => { name: string; logoUrl: string | null } | null): HolderView {
  if (a.application_id || a.user_id) {
    const name = a.profiles?.display_name?.trim() || a.applications?.invited_name?.trim() || a.profiles?.email?.trim() || 'Someone';
    return { kind: 'person', name, avatarUrl: a.profiles?.avatar_url ?? null, logoUrl: null };
  }
  const sid = allocationSocietyId(a);
  const s = sid ? societyName(sid) : null;
  return { kind: 'delegation', name: s?.name ?? a.delegation?.name ?? 'A delegation', avatarUrl: null, logoUrl: s?.logoUrl ?? null };
}

export function SeatBoardGivePopup({
  committee, society, skip, givenNow, stillNeeds, busyCodes, societyName, onGive, onUndo, onClose,
}: {
  /** The committee with this tab's writes laid over it. */
  committee: CommitteeData;
  society: GiveSociety;
  /** Country codes never given to a delegation here (observer seats). */
  skip: ReadonlySet<string>;
  /** Countries given while this pop-up is open. */
  givenNow: ReadonlySet<string>;
  /** Allocations the delegation still needs (paid tickets and accepted delegates). */
  stillNeeds?: number;
  /** Countries with a write still running. */
  busyCodes: ReadonlySet<string>;
  societyName: (id: string) => { name: string; logoUrl: string | null } | null;
  onGive: (slot: SlotRow, seats: number[]) => void;
  onUndo: (slot: SlotRow) => void;
  onClose: () => void;
}) {
  return (
    <CommitteeOverviewModal
      committee={committee}
      onClose={onClose}
      mode={{
        kind: 'give',
        societyId: society.id,
        societyName: society.name,
        skip,
        givenNow,
        stillNeeds,
        busyCodes,
        delegationName: id => societyName(id)?.name ?? null,
        onGive,
        onUndo,
      }}
    />
  );
}
