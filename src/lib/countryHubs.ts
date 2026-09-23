// countryHubs.ts — /conferences/in/[country], one hub page per country with
// enough upcoming public conferences to be worth a page of its own.
//
// A hub exists for a country only while it has at least HUB_MIN upcoming
// LISTED conferences (public, not a test, not over). Below that the page 404s
// and the sitemap leaves it out, so Google never meets a thin page. The same
// function decides for both, so they cannot disagree.
//
// The slug is the country's standard name lower-cased and hyphenated
// ("united-arab-emirates", "turkiye"), taken from the UN_COUNTRIES entry the
// stored name resolves to, so "UAE", "U.A.E." and "United Arab Emirates" all
// land on one hub.

import { getCountryByName } from '@/lib/countries';
import { isListedConference, type ListableConference } from '@/lib/publicConferences';

export const HUB_MIN = 3;

export interface HubInput extends ListableConference {
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  updated_at?: string | null;
}

export interface CountryHub {
  slug: string;
  /** The standard country name. */
  name: string;
  code: string;
  count: number;
  /** Newest updated_at among its conferences (the hub's lastmod). */
  lastModified: string | null;
}

export function countrySlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isUpcoming(c: HubInput, today: string): boolean {
  const last = c.end_date || c.start_date;
  return !last || last >= today;
}

/** Hubs for the given public conferences, largest first. */
export function countryHubs(conferences: readonly HubInput[], today = new Date().toISOString().slice(0, 10)): CountryHub[] {
  const byCode = new Map<string, CountryHub>();
  for (const c of conferences) {
    if (!isListedConference(c) || !isUpcoming(c, today) || !c.country) continue;
    const country = getCountryByName(c.country.trim());
    if (!country) continue;
    const code = country.code.toUpperCase();
    const hub = byCode.get(code) ?? { slug: countrySlug(country.name), name: country.name, code, count: 0, lastModified: null };
    hub.count += 1;
    if (c.updated_at && (!hub.lastModified || c.updated_at > hub.lastModified)) hub.lastModified = c.updated_at;
    byCode.set(code, hub);
  }
  return [...byCode.values()]
    .filter(h => h.count >= HUB_MIN)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Does this conference belong to the hub with this country code? */
export function inCountry(c: { country?: string | null }, code: string): boolean {
  if (!c.country) return false;
  const hit = getCountryByName(c.country.trim());
  return !!hit && hit.code.toUpperCase() === code.toUpperCase();
}
