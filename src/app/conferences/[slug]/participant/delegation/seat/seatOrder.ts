// One order for every list of seats on the leader card (owner, 20 Oct 2026:
// "The committees should always be alphabetical within the allocations"):
// committee acronym A to Z, then country A to Z, then seat number.

import { committeeDisplayName } from '@/lib/presetNames';
import type { OpenSeat } from '../v2';

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export interface SeatKey {
  /** The committee's acronym (or its display name when it has none). */
  committee: string;
  country: string;
  seat?: number | null;
}

export function compareSeatKeys(a: SeatKey, b: SeatKey): number {
  return collator.compare(a.committee, b.committee)
    || collator.compare(a.country, b.country)
    || (a.seat ?? 1) - (b.seat ?? 1);
}

/** The acronym an open seat is shown and sorted by. */
export function openSeatCommittee(s: Pick<OpenSeat, 'committee' | 'abbreviation'>): string {
  return (s.abbreviation ?? '').trim() || committeeDisplayName(s.committee, s.abbreviation);
}

/** A sorted copy of the open seats; null stays null. */
export function sortOpenSeats<T extends Pick<OpenSeat, 'committee' | 'abbreviation' | 'country_name' | 'seat'>>(seats: T[]): T[];
export function sortOpenSeats<T extends Pick<OpenSeat, 'committee' | 'abbreviation' | 'country_name' | 'seat'>>(seats: T[] | null): T[] | null;
export function sortOpenSeats<T extends Pick<OpenSeat, 'committee' | 'abbreviation' | 'country_name' | 'seat'>>(seats: T[] | null): T[] | null {
  if (!seats) return seats;
  return [...seats].sort((a, b) => compareSeatKeys(
    { committee: openSeatCommittee(a), country: a.country_name, seat: a.seat },
    { committee: openSeatCommittee(b), country: b.country_name, seat: b.seat },
  ));
}
