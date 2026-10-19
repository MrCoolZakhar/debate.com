// delegationSeatsGrid.ts: the allocation page (3C, docs/conferences/delegations.md)
// as pure data. No I/O.
//
// The page draws countries x committees for ONE selected delegation. Every cell
// is one whole country slot in one committee:
//   none    the committee does not seat that country (or only as an observer)
//   free    nobody holds any seat of the slot: tapping gives it to the delegation
//   mine    the selected delegation holds it (a block seat or a member's seat)
//   other   another delegation or a single delegate holds it
// A double slot (delegation_size 2) is two seats and counts as 2, and a
// delegation always takes a WHOLE slot, as `insertSocietyBlockAllocation` on the
// assignment page and `societySeats.ts` in Applications do.
//
// Paid spots mirror `_society_paid_delegate_spots` in scratch-delegations-rebuild.sql
// (the ledger, never `societies.spots_purchased` alone): the delegation's
// Delegate Tickets paid in full (settled `pledge_spot` invoices of its live
// leaders) plus delegates and head delegates who paid their own ticket or
// whose fee was waived.

import type { FreeSlot } from '@/app/manage/[slug]/applications/delegations/societySeats';
import { committeeDisplayName, matchPresetEmblem } from '@/lib/presetNames';

export interface GridSlot {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number | null;
  is_observer: boolean | null;
  logo_url: string | null;
}

export interface GridAllocation {
  id: string;
  country_code: string;
  seat: number | null;
  society_id: string | null;
  application_id: string | null;
  user_id: string | null;
  profiles: { display_name: string | null } | null;
  applications: { society_id: string | null; invited_name: string | null } | null;
}

export interface GridCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  committee_country_slots: GridSlot[];
  conference_allocations: GridAllocation[];
}

export interface GridSociety {
  id: string;
  name: string;
  logo_url: string | null;
}

export type SeatCell =
  | { kind: 'none' }
  | { kind: 'free'; size: number; slot: FreeSlot }
  | { kind: 'mine'; size: number; allocationIds: string[]; canTakeBack: boolean }
  | { kind: 'other'; size: number; label: string; holder: string };

export interface GridRow {
  code: string;
  name: string;
  logoUrl: string | null;
  /** One cell per committee, in the committees' order. */
  cells: SeatCell[];
  /** Seats of this country the selected delegation holds. */
  mine: number;
  freeSlots: FreeSlot[];
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'le', 'du', 'des', 'y', 'e', 'at', 'in', '&']);

/** Two letters for a delegation or a person (the same rule as DelegationAvatar's). */
export function initialsOf(name: string): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  const words = clean.split(/[\s\-_/]+/).filter(w => w && !SMALL_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return clean.slice(0, 2).toUpperCase();
  if (words.length === 1) {
    const w = words[0].replace(/[^\p{L}\p{N}]/gu, '');
    if (w.length >= 3 && w === w.toUpperCase()) return (w[0] + w[w.length - 1]).toUpperCase();
    return w.slice(0, 2).toUpperCase() || '?';
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A committee's emblem: its own logo, else the matching preset, else the UN emblem. */
export function committeeEmblemSrc(c: { logo_url: string | null; name: string; abbreviation: string | null }): string {
  return c.logo_url || matchPresetEmblem(c.name, c.abbreviation) || '/logos/un.svg';
}

export function committeeShort(c: { name: string; abbreviation: string | null }): string {
  return committeeDisplayName(c.name, c.abbreviation) || c.name;
}

function slotSize(s: GridSlot): number {
  return Math.max(1, Math.round(s.delegation_size || 1));
}

/** Which delegation holds an allocation, if any. */
export function allocationSociety(a: GridAllocation): string | null {
  return a.society_id ?? a.applications?.society_id ?? null;
}

function isEmptyBlockSeat(a: GridAllocation, societyId: string): boolean {
  return a.society_id === societyId && !a.user_id && !a.application_id;
}

/** Seats a delegation holds across the conference (each allocation row is one seat). */
export function seatsHeldBy(committees: GridCommittee[], societyId: string): number {
  let n = 0;
  for (const c of committees) for (const a of c.conference_allocations) if (allocationSociety(a) === societyId) n += 1;
  return n;
}

export function buildGridRows(
  committees: GridCommittee[],
  selectedId: string | null,
  societies: Map<string, GridSociety>,
): GridRow[] {
  const byCode = new Map<string, { name: string; logoUrl: string | null }>();
  for (const c of committees) {
    for (const s of c.committee_country_slots) {
      if (s.is_observer) continue;
      const entry = byCode.get(s.country_code);
      if (!entry) byCode.set(s.country_code, { name: s.country_name, logoUrl: s.logo_url ?? null });
      else if (!entry.logoUrl && s.logo_url) entry.logoUrl = s.logo_url;
    }
  }

  const rows: GridRow[] = [];
  for (const [code, info] of byCode) {
    const cells: SeatCell[] = [];
    const freeSlots: FreeSlot[] = [];
    let mine = 0;
    for (const c of committees) {
      const slot = c.committee_country_slots.find(s => s.country_code === code && !s.is_observer);
      if (!slot) { cells.push({ kind: 'none' }); continue; }
      const size = slotSize(slot);
      const allocs = c.conference_allocations.filter(a => a.country_code === code);
      if (allocs.length === 0) {
        const free: FreeSlot = {
          committeeId: c.id, committeeName: c.name, abbreviation: c.abbreviation, logoUrl: c.logo_url,
          countryCode: code, countryName: slot.country_name, size,
        };
        freeSlots.push(free);
        cells.push({ kind: 'free', size, slot: free });
        continue;
      }
      const ours = selectedId ? allocs.filter(a => allocationSociety(a) === selectedId) : [];
      if (selectedId && ours.length === allocs.length) {
        mine += ours.length;
        cells.push({
          kind: 'mine',
          size,
          allocationIds: ours.map(a => a.id),
          canTakeBack: ours.every(a => isEmptyBlockSeat(a, selectedId) && !a.id.startsWith('temp-')),
        });
        continue;
      }
      if (ours.length > 0) mine += ours.length;
      // The first holder that is not the selected delegation names the cell.
      const first = allocs.find(a => allocationSociety(a) !== selectedId) ?? allocs[0];
      const soc = allocationSociety(first);
      const holder = soc
        ? societies.get(soc)?.name ?? 'Another delegation'
        : first.profiles?.display_name || first.applications?.invited_name || 'A single delegate';
      cells.push({ kind: 'other', size, label: initialsOf(holder), holder });
    }
    rows.push({ code, name: info.name, logoUrl: info.logoUrl, cells, mine, freeSlots });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** The row order for a delegation: its own countries first, then A to Z. Taken
 *  once per selection so rows never jump under the pointer while seats are given. */
export function rowOrderFor(rows: GridRow[]): string[] {
  return rows.slice()
    .sort((a, b) => (b.mine > 0 ? 1 : 0) - (a.mine > 0 ? 1 : 0) || a.name.localeCompare(b.name))
    .map(r => r.code);
}

export function orderRows(rows: GridRow[], order: string[]): GridRow[] {
  const rank = new Map(order.map((c, i) => [c, i] as const));
  return rows.slice().sort((a, b) => {
    const ra = rank.get(a.code);
    const rb = rank.get(b.code);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}

// ── Paid spots (mirrors _society_paid_delegate_spots) ────────────────────────

export interface PaidApp {
  id: string;
  role: string;
  status: string;
  payment_status: string | null;
  self_paid: boolean | null;
  society_id: string | null;
}

const GONE = new Set(['rejected', 'withdrawn']);
const LEADER_ROLES = new Set(['faculty-advisor', 'head-delegate']);
const SEATED_ROLES = new Set(['delegate', 'head-delegate']);

/** Paid delegate spots per delegation, from the ledger.
 *  `settledPledgeAppIds` holds one entry per settled `pledge_spot` invoice (its application_id). */
export function paidSpotsBySociety(apps: PaidApp[], settledPledgeAppIds: (string | null)[]): Map<string, number> {
  const out = new Map<string, number>();
  const leaderSociety = new Map<string, string>();
  for (const a of apps) {
    if (!a.society_id || GONE.has(a.status)) continue;
    if (LEADER_ROLES.has(a.role)) leaderSociety.set(a.id, a.society_id);
    if (SEATED_ROLES.has(a.role) && (a.payment_status === 'waived' || (a.payment_status === 'paid' && a.self_paid === true))) {
      out.set(a.society_id, (out.get(a.society_id) ?? 0) + 1);
    }
  }
  for (const appId of settledPledgeAppIds) {
    const soc = appId ? leaderSociety.get(appId) : undefined;
    if (soc) out.set(soc, (out.get(soc) ?? 0) + 1);
  }
  return out;
}
