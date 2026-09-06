// ============================================================
// src/lib/slotGroups.ts
//
// Seat groups and custom seat logos for parliamentary-style committees.
//
// HOW PARLIAMENTARY SIMULATIONS ALLOCATE
// Model European Parliament seats delegates as MEPs inside political groups
// (EPP, S&D, Renew, Greens/EFA, ECR, Patriots, The Left), Model Lok Sabha and
// youth parliaments seat MPs by party (government benches vs opposition),
// Model Congress by party and state, Model Bundestag by Fraktion. The unit of
// allocation is still one seat per delegate, but the seat's identity is a
// member of a GROUP, and the group's crest, not a national flag, is what the
// room shows. Gavelling keeps the seat model and adds the group on top.
//
// STORAGE
//   conference_committees.committee_type = 'custom'   the parliamentary type
//   conference_committees.groups (jsonb)              [{ id, name, logo_url, color }]
//   committee_country_slots.group_id (text)           which group a seat sits in
//   committee_country_slots.logo_url (text)           a seat's own crest
//
// A seat renders, in order of preference: its own logo_url, its group's
// logo_url, then the national flag from country_code, then the initials
// fallback the surface already had. `effectiveSlotArt` below is that rule;
// every flag renderer that honours custom art goes through it.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SlotGroup {
  /** Stable id, generated once (`grp_` + random). Slots reference it. */
  id: string;
  name: string;
  logo_url: string | null;
  /** Accent used for the group header and as a tint when there is no crest. */
  color: string | null;
}

export interface SlotArtSource {
  country_code: string;
  logo_url?: string | null;
  group_id?: string | null;
}

export type SlotArt =
  | { kind: 'logo'; url: string; label: string }
  | { kind: 'flag'; code: string }
  | { kind: 'none' };

/** Palette for group accents, in the order they are handed out. */
export const GROUP_COLORS = ['#1B3828', '#8B2020', '#B6871F', '#2A5A9C', '#5A2A7A', '#3D7A52', '#8A4B1F', '#4C5563'];

export function newGroupId(): string {
  return `grp_${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads `conference_committees.groups` defensively. */
export function parseGroups(raw: unknown): SlotGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: SlotGroup[] = [];
  for (const g of raw as Partial<SlotGroup>[]) {
    if (!g || typeof g.id !== 'string' || typeof g.name !== 'string') continue;
    out.push({
      id: g.id,
      name: g.name,
      logo_url: typeof g.logo_url === 'string' && g.logo_url ? g.logo_url : null,
      color: typeof g.color === 'string' && g.color ? g.color : null,
    });
  }
  return out;
}

/** Two-letter ISO code test, the same rule the assignment board uses. */
export function isIsoCode(code: string): boolean {
  return /^[A-Za-z]{2}$/.test(code);
}

/** What to draw for a seat. */
export function effectiveSlotArt(slot: SlotArtSource, groups: SlotGroup[] = []): SlotArt {
  if (slot.logo_url) return { kind: 'logo', url: slot.logo_url, label: slot.country_code };
  if (slot.group_id) {
    const g = groups.find((x) => x.id === slot.group_id);
    if (g?.logo_url) return { kind: 'logo', url: g.logo_url, label: g.name };
  }
  if (isIsoCode(slot.country_code)) return { kind: 'flag', code: slot.country_code.toUpperCase() };
  return { kind: 'none' };
}

// ── Index for surfaces that render many seats across committees ─────────────

export interface SlotArtEntry {
  logoUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  groupLogoUrl: string | null;
  groupColor: string | null;
}

export type SlotArtIndex = Map<string, SlotArtEntry>;

export function slotArtKey(conferenceCommitteeId: string, countryCode: string): string {
  return `${conferenceCommitteeId}|${countryCode}`;
}

/**
 * One query pair for a whole conference (or a set of committees): every seat
 * that has custom art or a group, keyed by committee + country_code. Surfaces
 * that already have the slot rows in hand should call `effectiveSlotArt`
 * directly instead.
 */
export async function loadSlotArtIndex(
  supabase: SupabaseClient,
  conferenceCommitteeIds: string[],
): Promise<SlotArtIndex> {
  const index: SlotArtIndex = new Map();
  if (conferenceCommitteeIds.length === 0) return index;
  const ids = [...new Set(conferenceCommitteeIds)];
  const [{ data: ccRows }, { data: slotRows }] = await Promise.all([
    supabase.from('conference_committees').select('id, groups').in('id', ids),
    supabase
      .from('committee_country_slots')
      .select('conference_committee_id, country_code, logo_url, group_id')
      .in('conference_committee_id', ids)
      .or('logo_url.not.is.null,group_id.not.is.null'),
  ]);
  const groupsByCc = new Map<string, SlotGroup[]>();
  for (const r of (ccRows ?? []) as { id: string; groups: unknown }[]) groupsByCc.set(r.id, parseGroups(r.groups));
  for (const s of (slotRows ?? []) as { conference_committee_id: string; country_code: string; logo_url: string | null; group_id: string | null }[]) {
    const g = s.group_id ? groupsByCc.get(s.conference_committee_id)?.find((x) => x.id === s.group_id) ?? null : null;
    index.set(slotArtKey(s.conference_committee_id, s.country_code), {
      logoUrl: s.logo_url ?? null,
      groupId: s.group_id ?? null,
      groupName: g?.name ?? null,
      groupLogoUrl: g?.logo_url ?? null,
      groupColor: g?.color ?? null,
    });
  }
  return index;
}

/** Resolves art from an index entry (or its absence) plus the country code. */
export function artFromIndex(entry: SlotArtEntry | undefined, countryCode: string): SlotArt {
  if (entry?.logoUrl) return { kind: 'logo', url: entry.logoUrl, label: countryCode };
  if (entry?.groupLogoUrl) return { kind: 'logo', url: entry.groupLogoUrl, label: entry.groupName ?? countryCode };
  if (isIsoCode(countryCode)) return { kind: 'flag', code: countryCode.toUpperCase() };
  return { kind: 'none' };
}

// ── Presets a custom committee can start from ───────────────────────────────

export interface ParliamentPreset {
  key: string;
  label: string;
  hint: string;
  groups: string[];
}

export const PARLIAMENT_PRESETS: ParliamentPreset[] = [
  { key: 'ep', label: 'European Parliament', hint: 'Political groups of the EP', groups: ['EPP', 'S&D', 'Patriots for Europe', 'ECR', 'Renew Europe', 'Greens/EFA', 'The Left', 'ESN', 'Non-attached'] },
  { key: 'lok-sabha', label: 'Lok Sabha', hint: 'Treasury and opposition benches', groups: ['BJP', 'INC', 'SP', 'AITC', 'DMK', 'TDP', 'JD(U)', 'Independents'] },
  { key: 'commons', label: 'House of Commons', hint: 'Government and opposition', groups: ['Government', 'Official Opposition', 'Liberal Democrats', 'SNP', 'Reform UK', 'Green', 'DUP', 'Independents'] },
  { key: 'congress', label: 'US Congress', hint: 'Two parties and the chair', groups: ['Democrats', 'Republicans', 'Independents'] },
  { key: 'bundestag', label: 'Bundestag', hint: 'Fraktionen', groups: ['CDU/CSU', 'AfD', 'SPD', 'Grüne', 'Die Linke', 'Fraktionslos'] },
  { key: 'benches', label: 'Government vs Opposition', hint: 'The simplest split', groups: ['Government', 'Opposition', 'Crossbench'] },
];
