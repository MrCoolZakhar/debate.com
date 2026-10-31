// ============================================================
// src/lib/sessionFlags.ts
//
// What a LIVE SESSION draws for a seat.
//
// This is the session-side twin of `effectiveSlotArt` in `src/lib/slotGroups.ts`.
// The two must agree for the same seat, but they start from different rows and
// so cannot be the same function:
//
//   conferences side   committee_country_slots row
//                      country_code is a 2-letter ISO code
//                      logo_url is the seat's own crest
//                      group_id still has to be resolved against
//                        conference_committees.groups to reach the group crest
//
//   sessions side      delegates row
//                      country is a NAME ("Türkiye"), never a code — the live
//                        session has always resolved it with getCountryByName
//                      logo_url is ALREADY FLATTENED: the migration that added
//                        the column backfilled it with the seat's own crest,
//                        falling back to its group's crest, so there is no
//                        group lookup to do here and no groups blob to carry
//                        into the session
//
// Because the backfill flattens the group step, the preference order below is
// the same order effectiveSlotArt applies:
//     seat crest  →  group crest (already folded into logoUrl)  →  press
//     outlet logo  →  national flag  →  nothing (the surface's own initials/globe fallback)
//
// If you ever change the precedence in one of the two functions, change it in
// the other in the same commit, or a delegate's crest in the room stops
// matching the same delegate's crest on the organiser's board.
//
// Standalone (non-conference) sessions never have logo_url set, so every seat
// takes the flag branch and behaves exactly as it did before this file existed.
//
// Pure: no React, no Supabase. Renderers go through <SeatFlag> or the
// SeatArtProvider in `src/components/SeatFlag.tsx`.
// ============================================================

import { getCountryByName } from '@/lib/countries';
import type { SlotArt } from '@/lib/slotGroups';
import { pressOutletLogo } from '@/lib/pressOutlets';

export type { SlotArt };

/** The minimum a render site needs to know about a seat. A `Delegate` satisfies it. */
export interface SessionSeat {
  country: string;
  logoUrl?: string | null;
  /** The seat's party, custom committees only (see Delegate.groupColor). */
  groupColor?: string | null;
  groupShort?: string | null;
}

/** A seat's party as the room carries it. */
export interface SeatGroup { color: string | null; short: string | null }

/** country name → its party, built once per roster (seats with a party only). */
export type SeatGroupIndex = ReadonlyMap<string, SeatGroup>;

export function buildSeatGroupIndex(delegates: readonly SessionSeat[] | undefined | null): SeatGroupIndex {
  const index = new Map<string, SeatGroup>();
  for (const d of delegates ?? []) {
    if (d?.country && (d.groupColor || d.groupShort)) {
      index.set(seatKey(d.country), { color: d.groupColor ?? null, short: d.groupShort ?? null });
    }
  }
  return index;
}

export function seatGroupFor(index: SeatGroupIndex | null | undefined, country: string): SeatGroup | null {
  if (!index || !country) return null;
  return index.get(seatKey(country)) ?? null;
}

/** Ink or white on a party colour, whichever reads better (WCAG relative luminance). */
export function partyTextColor(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return '#1C1410';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white (1.05 / (L + .05)) vs against ink (#1C1410, L about 0.008).
  const onWhite = 1.05 / (L + 0.05);
  const onInk = (L + 0.05) / 0.058;
  return onWhite >= onInk ? '#FFFFFF' : '#1C1410';
}

/** What to draw for a seat in a live session. */
export function sessionSeatArt(d: SessionSeat): SlotArt {
  if (d.logoUrl) return { kind: 'logo', url: d.logoUrl, label: d.country };
  // A press seat named for an outlet draws the outlet's logo (after any crest, before a flag).
  const outlet = pressOutletLogo(d.country);
  if (outlet) return { kind: 'logo', url: outlet, label: d.country };
  const country = getCountryByName(d.country);
  if (country) return { kind: 'flag', code: country.code.toUpperCase() };
  return { kind: 'none' };
}

// ── Resolving a crest when all you have is a name ────────────────────────────
//
// Most session render sites do not hold a Delegate. They hold a SpeakerEntry, a
// motion's proposedBy, a document sponsor or a caucus currentSpeaker — all of
// which are bare country-name strings. They resolve the seat by matching that
// name against the roster, which is exactly what the flag lookup already did.

/** country name (case/space-insensitive) → crest URL, built once per roster. */
export type SeatLogoIndex = ReadonlyMap<string, string>;

export function buildSeatLogoIndex(delegates: readonly SessionSeat[] | undefined | null): SeatLogoIndex {
  const index = new Map<string, string>();
  for (const d of delegates ?? []) {
    if (d?.logoUrl && d.country) index.set(seatKey(d.country), d.logoUrl);
  }
  return index;
}

export function seatLogoFor(index: SeatLogoIndex | null | undefined, country: string): string | null {
  if (!index || !country) return null;
  return index.get(seatKey(country)) ?? null;
}

/** Resolve art for a bare country name against a roster index. */
export function sessionSeatArtByName(country: string, index?: SeatLogoIndex | null): SlotArt {
  return sessionSeatArt({ country, logoUrl: seatLogoFor(index, country) });
}

function seatKey(country: string): string {
  return country.trim().toLowerCase();
}
