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
// logo_url, a press outlet's logo (pressOutletLogo), then the national flag from country_code, then the initials
// fallback the surface already had. `effectiveSlotArt` below is that rule;
// every flag renderer that honours custom art goes through it.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { pressOutletLogo } from '@/lib/pressOutlets';

export interface SlotGroup {
  /** Stable id, generated once (`grp_` + random). Slots reference it. */
  id: string;
  name: string;
  logo_url: string | null;
  /** Accent used for the group header and as a tint when there is no crest. */
  color: string | null;
  /** Optional short form ("EPP", "S&D"), drawn on the group's disc and used to
   *  name auto-numbered seats ("EPP 1"). Optional and additive: rows written
   *  before it existed simply have none, and every reader falls back to `name`. */
  short_name?: string | null;
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

/** Text colour that reads on a group colour: ink on a light colour (gold,
 *  yellow, orange), white on a dark one. Display only. */
export function groupInk(color: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((color ?? '').trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white vs against ink (#1C1410, L ~ 0.008).
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.058) ? '#FFFFFF' : '#1C1410';
}

/** The short form a group goes by: its short name, else its name. */
export function groupShort(g: Pick<SlotGroup, 'name' | 'short_name'>): string {
  return (g.short_name ?? '').trim() || g.name;
}

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
      short_name: typeof g.short_name === 'string' && g.short_name.trim() ? g.short_name.trim() : null,
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
  const outlet = pressOutletLogo(slot.country_code);
  if (outlet) return { kind: 'logo', url: outlet, label: slot.country_code };
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
  const outlet = pressOutletLogo(countryCode);
  if (outlet) return { kind: 'logo', url: outlet, label: countryCode };
  if (isIsoCode(countryCode)) return { kind: 'flag', code: countryCode.toUpperCase() };
  return { kind: 'none' };
}

// ── Presets a custom committee can start from ───────────────────────────────
//
// Each preset group carries its full name, the short name it is known by and
// its party colour. These are real bodies, so they DATE: party line-ups were
// checked against the composition known in October 2026 (European Parliament
// 2024 to 2029 term, Bundestag elected Feb 2025, Commons elected Jul 2024,
// Lok Sabha elected Jun 2024, Canadian Commons elected Apr 2025, Australian
// House elected May 2025, the 119th US Congress). An organiser can rename,
// recolour or remove any of them after picking.

export interface PresetGroup {
  name: string;
  short: string;
  color: string;
}

export interface ParliamentPreset {
  key: string;
  label: string;
  hint: string;
  groups: PresetGroup[];
  /** Display only (the preset cards in the committee editor): the round flag
   *  of a national parliament, ISO 3166-1 alpha-2 ('EU' has its own disc). */
  flag?: string;
  /** Display only: a Fluent 3D emoji name, for a preset with no flag. */
  emoji?: string;
}

const EP_GROUPS: PresetGroup[] = [
  { name: "European People's Party", short: 'EPP', color: '#3399FF' },
  { name: 'Socialists and Democrats', short: 'S&D', color: '#DB3A3A' },
  { name: 'Patriots for Europe', short: 'PfE', color: '#2E2A5E' },
  { name: 'European Conservatives and Reformists', short: 'ECR', color: '#1C5AA6' },
  { name: 'Renew Europe', short: 'Renew', color: '#F5C400' },
  { name: 'Greens/European Free Alliance', short: 'Greens/EFA', color: '#3D9B35' },
  { name: 'The Left', short: 'The Left', color: '#8B1A1A' },
  { name: 'Europe of Sovereign Nations', short: 'ESN', color: '#0E3B57' },
  { name: 'Non-attached Members', short: 'NI', color: '#7A7A7A' },
];

export const PARLIAMENT_PRESETS: ParliamentPreset[] = [
  { key: 'mep', label: 'Model European Parliament', hint: 'The political groups of the European Parliament', flag: 'EU', groups: EP_GROUPS },
  { key: 'commons', label: 'UK House of Commons', hint: 'Government, official opposition and the other parties', flag: 'GB', groups: [
    { name: 'Labour', short: 'Lab', color: '#E4003B' },
    { name: 'Conservative', short: 'Con', color: '#0087DC' },
    { name: 'Liberal Democrats', short: 'LD', color: '#FAA61A' },
    { name: 'Reform UK', short: 'Reform', color: '#12B6CF' },
    { name: 'Scottish National Party', short: 'SNP', color: '#FDF38E' },
    { name: 'Green Party', short: 'Green', color: '#02A95B' },
    { name: 'Plaid Cymru', short: 'PC', color: '#005B54' },
    { name: 'Democratic Unionist Party', short: 'DUP', color: '#D46A4C' },
    { name: 'Independents', short: 'Ind', color: '#8C8C8C' },
  ] },
  { key: 'congress', label: 'US Congress', hint: 'The two parties and independents', flag: 'US', groups: [
    { name: 'Democratic Party', short: 'Dem', color: '#1A4FBF' },
    { name: 'Republican Party', short: 'Rep', color: '#D3202A' },
    { name: 'Independents', short: 'Ind', color: '#7A7A7A' },
  ] },
  { key: 'lok-sabha', label: 'Lok Sabha', hint: 'Treasury and opposition benches', flag: 'IN', groups: [
    { name: 'Bharatiya Janata Party', short: 'BJP', color: '#FF9933' },
    { name: 'Indian National Congress', short: 'INC', color: '#19AAED' },
    { name: 'Samajwadi Party', short: 'SP', color: '#E3170A' },
    { name: 'All India Trinamool Congress', short: 'AITC', color: '#20C646' },
    { name: 'Dravida Munnetra Kazhagam', short: 'DMK', color: '#B30000' },
    { name: 'Telugu Desam Party', short: 'TDP', color: '#F4D03F' },
    { name: 'Janata Dal (United)', short: 'JD(U)', color: '#1F7A3A' },
    { name: 'Shiv Sena (UBT)', short: 'SS(UBT)', color: '#F26F21' },
    { name: 'Independents and others', short: 'Others', color: '#8C8C8C' },
  ] },
  { key: 'bundestag', label: 'German Bundestag', hint: 'Fraktionen', flag: 'DE', groups: [
    { name: 'CDU/CSU', short: 'Union', color: '#151518' },
    { name: 'Alternative für Deutschland', short: 'AfD', color: '#009EE0' },
    { name: 'SPD', short: 'SPD', color: '#E3000F' },
    { name: 'Bündnis 90/Die Grünen', short: 'Grüne', color: '#46962B' },
    { name: 'Die Linke', short: 'Linke', color: '#BE3075' },
    { name: 'Fraktionslos', short: 'fraktionslos', color: '#8C8C8C' },
  ] },
  { key: 'canada', label: 'Canadian House of Commons', hint: 'Government and opposition parties', flag: 'CA', groups: [
    { name: 'Liberal Party', short: 'LPC', color: '#D71920' },
    { name: 'Conservative Party', short: 'CPC', color: '#1A4782' },
    { name: 'Bloc Québécois', short: 'BQ', color: '#33B2CC' },
    { name: 'New Democratic Party', short: 'NDP', color: '#F37021' },
    { name: 'Green Party', short: 'GPC', color: '#3D9B35' },
  ] },
  { key: 'australia', label: 'Australian House of Representatives', hint: 'Government, opposition and crossbench', flag: 'AU', groups: [
    { name: 'Australian Labor Party', short: 'ALP', color: '#DE3533' },
    { name: 'Liberal–National Coalition', short: 'Coalition', color: '#1C4F9C' },
    { name: 'Australian Greens', short: 'Greens', color: '#10C25B' },
    { name: 'Crossbench', short: 'Crossbench', color: '#8C8C8C' },
  ] },
  { key: 'benches', label: 'Government vs Opposition', hint: 'The simplest split', emoji: 'Ballot box with ballot', groups: [
    { name: 'Government', short: 'Gov', color: '#1B3828' },
    { name: 'Opposition', short: 'Opp', color: '#8B2020' },
    { name: 'Crossbench', short: 'Cross', color: '#B6871F' },
  ] },
  { key: 'spectrum', label: 'Left to Right', hint: 'A youth parliament by political family', emoji: 'Left-right arrow', groups: [
    { name: 'Left', short: 'Left', color: '#8B2020' },
    { name: 'Centre-left', short: 'C-Left', color: '#DB3A3A' },
    { name: 'Centre', short: 'Centre', color: '#F5C400' },
    { name: 'Centre-right', short: 'C-Right', color: '#3399FF' },
    { name: 'Right', short: 'Right', color: '#1C3F7A' },
  ] },
];
