// seatPeople.ts: a delegation's seats as the pop-up draws them, pure, no I/O.
//
// Every allocation the delegation holds (societySeats.societyAllocations) in the
// shape the leader card's SeatCell draws (participant/delegation/seat/SeatCell:
// flag, country, committee emblem and acronym), with who sits in it. A seat with
// nobody on it is an Open seat. One order everywhere: committee acronym A to Z,
// then country, then seat number (participant/delegation/seat/seatOrder).

import type { Seat } from '@/app/conferences/[slug]/participant/delegation/seat/SeatCell';
import { compareSeatKeys } from '@/app/conferences/[slug]/participant/delegation/seat/seatOrder';
import { committeeEmblemSrc, committeeShort } from './kit';
import { societyAllocations, type SeatCommittee } from './societySeats';

export interface HeldSeat {
  allocationId: string;
  committeeId: string;
  countryCode: string;
  countryName: string;
  seatNo: number;
  /** The application on the seat, or null when it is open. */
  applicationId: string | null;
  /** Somebody is on the seat (an application, or an account with no application row). */
  filled: boolean;
  /** The allocation carries the delegation itself (a block seat), not only a member's seat. */
  block: boolean;
  /** The seat as SeatCell draws it. */
  seat: Seat;
}

export function heldSeats(committees: SeatCommittee[] | null, societyId: string, memberIds: ReadonlySet<string>): HeldSeat[] {
  if (!committees) return [];
  return societyAllocations(committees, societyId, memberIds)
    .map(({ committee, allocation }) => {
      const slot = committee.committee_country_slots.find(s => s.country_code === allocation.country_code);
      const countryName = allocation.country_name || slot?.country_name || allocation.country_code;
      const label = committeeShort(committee.name, committee.abbreviation);
      return {
        allocationId: allocation.id,
        committeeId: committee.id,
        countryCode: allocation.country_code,
        countryName,
        seatNo: allocation.seat ?? 1,
        applicationId: allocation.application_id,
        filled: !!(allocation.application_id || allocation.user_id),
        block: allocation.society_id === societyId,
        seat: {
          country_name: countryName,
          country_code: allocation.country_code,
          seatLogo: slot?.logo_url ?? null,
          committee_id: committee.id,
          committee_label: label,
          committee_full: committee.name,
          emblem: committeeEmblemSrc(committee.logo_url, committee.name, committee.abbreviation),
        },
      };
    })
    .sort((a, b) => compareSeatKeys(
      { committee: a.seat.committee_label, country: a.countryName, seat: a.seatNo },
      { committee: b.seat.committee_label, country: b.countryName, seat: b.seatNo },
    ));
}

/** "Germany · UNHRC", the words a seat goes by in a confirm. */
export function seatWords(s: Pick<HeldSeat, 'countryName' | 'seat'>): string {
  return `${s.countryName} · ${s.seat.committee_label}`;
}
