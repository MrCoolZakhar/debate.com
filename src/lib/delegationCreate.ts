// delegationCreate.ts: what a NEW delegation carries when an applicant
// creates it from the apply flow (a Head Delegate or Faculty Advisor typing a
// name that does not exist yet at this conference).
//
// Storage: public.societies, columns `city` (text, 1..80 chars), `country_code`
// (ISO 3166-1 alpha-2, upper case) and `logo_url` (https, in the public
// `conference-assets` bucket under delegations/<conference>/...). All three are
// nullable in the database, because delegations created before 23 Sep 2026 and
// organiser imports have none; the apply flow requires city and country for a
// delegation it creates, and the picture stays optional.
//
// Nothing here writes a society row on its own: the apply flow creates the
// delegation at submit, in the same place it always did, with
// `societyInsertRow`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCountryByName } from '@/lib/countries';
import { friendlyError } from '@/lib/friendlyError';

export interface NewDelegationDetails {
  city: string;
  /** Country NAME as typed or picked (CountryField works in names). The ISO
   *  code is derived at insert, so a half-typed name is never stored. */
  countryName: string;
  logoUrl: string | null;
}

export const EMPTY_NEW_DELEGATION: NewDelegationDetails = { city: '', countryName: '', logoUrl: null };

export const DELEGATION_CITY_MAX = 80;

/** Old drafts, or anything else unexpected, come back as a clean object. */
export function normalizeNewDelegation(raw: unknown): NewDelegationDetails {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_NEW_DELEGATION };
  const r = raw as Partial<Record<keyof NewDelegationDetails, unknown>>;
  return {
    city: typeof r.city === 'string' ? r.city.slice(0, DELEGATION_CITY_MAX) : '',
    countryName: typeof r.countryName === 'string' ? r.countryName : '',
    logoUrl: typeof r.logoUrl === 'string' && r.logoUrl.startsWith('https://') ? r.logoUrl : null,
  };
}

export type NewDelegationProblems = { city?: string; country?: string };

/** The two required answers, checked the same way everywhere. Empty = fine. */
export function newDelegationProblems(d: NewDelegationDetails): NewDelegationProblems {
  const out: NewDelegationProblems = {};
  if (!d.city.trim()) out.city = 'Add the city your delegation is based in.';
  if (!d.countryName.trim()) out.country = 'Add the country your delegation is based in.';
  else if (!getCountryByName(d.countryName)) out.country = 'Pick the country from the list.';
  return out;
}

export function hasNewDelegationProblems(d: NewDelegationDetails): boolean {
  const p = newDelegationProblems(d);
  return !!(p.city || p.country);
}

/** The row the apply flow inserts into public.societies. */
export function societyInsertRow(conferenceId: string, name: string, d: NewDelegationDetails): Record<string, unknown> {
  const trimmed = name.trim();
  const country = getCountryByName(d.countryName);
  const city = d.city.trim().slice(0, DELEGATION_CITY_MAX);
  return {
    conference_id: conferenceId,
    name: trimmed,
    name_normalized: trimmed.toLowerCase(),
    city: city || null,
    country_code: country ? country.code.toUpperCase() : null,
    logo_url: d.logoUrl && d.logoUrl.startsWith('https://') ? d.logoUrl : null,
  };
}

/** Same list as the conference-assets bucket's allowed_mime_types. */
export const DELEGATION_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Upload a delegation picture (already cropped to a square PNG by
 *  LogoCropModal) to the public conference-assets bucket. The path carries a
 *  timestamp, so no upsert is needed. */
export async function uploadDelegationLogo(
  client: SupabaseClient,
  conferenceId: string,
  userId: string,
  file: Blob,
): Promise<{ url: string } | { error: string }> {
  const type = file.type || 'image/png';
  if (!DELEGATION_LOGO_TYPES.includes(type)) return { error: 'Use a JPEG, PNG, WebP or GIF picture.' };
  if (file.size > 5 * 1024 * 1024) return { error: 'The picture must be under 5MB.' };
  const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
  const path = `delegations/${conferenceId}/${userId}-${Date.now()}.${ext}`;
  const { error } = await client.storage
    .from('conference-assets')
    .upload(path, file, { contentType: type, upsert: false });
  if (error) return { error: friendlyError(error, 'We could not upload that picture. Please try another one.') };
  const { data } = client.storage.from('conference-assets').getPublicUrl(path);
  if (!data?.publicUrl?.startsWith('https://')) return { error: 'We could not upload that picture. Please try another one.' };
  return { url: data.publicUrl };
}
