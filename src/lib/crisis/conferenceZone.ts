'use client';
// Gavelling Crisis: the conference's time zone, for "today" counts (answered today and the like).
// conferences.timezone is stored when an organiser set it (most have not), so a missing one is taken from the
// conference's country (its capital's zone; a country with several zones uses its main one). Nothing known = the
// browser's own zone, which is what these counts did before.

import { supabase } from '@/lib/supabase';
import type { CrisisRef } from './api';
import { getCrisisClient } from './client';
import { dayInZone } from '@/lib/applicationWindow';
import { dayStartMs } from '@/lib/advisorBoard/conferenceWindow';

const COUNTRY_ZONE: Record<string, string> = {
  'India': 'Asia/Kolkata', 'United States': 'America/New_York', 'Pakistan': 'Asia/Karachi', 'United Arab Emirates': 'Asia/Dubai',
  'United Kingdom': 'Europe/London', 'Netherlands': 'Europe/Amsterdam', 'Germany': 'Europe/Berlin', 'Türkiye': 'Europe/Istanbul',
  'Turkey': 'Europe/Istanbul', 'Greece': 'Europe/Athens', 'Indonesia': 'Asia/Jakarta', 'Egypt': 'Africa/Cairo', 'Spain': 'Europe/Madrid',
  'Czech Republic': 'Europe/Prague', 'Czechia': 'Europe/Prague', 'Colombia': 'America/Bogota', 'Italy': 'Europe/Rome', 'Romania': 'Europe/Bucharest',
  'France': 'Europe/Paris', 'Switzerland': 'Europe/Zurich', 'Jordan': 'Asia/Amman', 'Mexico': 'America/Mexico_City', 'Nepal': 'Asia/Kathmandu',
  'Poland': 'Europe/Warsaw', 'Canada': 'America/Toronto', 'Bangladesh': 'Asia/Dhaka', 'Singapore': 'Asia/Singapore', 'Portugal': 'Europe/Lisbon',
  'Peru': 'America/Lima', 'Thailand': 'Asia/Bangkok', 'Slovakia': 'Europe/Bratislava', 'Denmark': 'Europe/Copenhagen', 'Ecuador': 'America/Guayaquil',
  'Morocco': 'Africa/Casablanca', 'Cyprus': 'Asia/Nicosia', 'Belgium': 'Europe/Brussels', 'Saudi Arabia': 'Asia/Riyadh', 'Philippines': 'Asia/Manila',
  'Brazil': 'America/Sao_Paulo', 'Kuwait': 'Asia/Kuwait', 'Oman': 'Asia/Muscat', 'Malaysia': 'Asia/Kuala_Lumpur', 'Qatar': 'Asia/Qatar',
  'Estonia': 'Europe/Tallinn', 'Russia': 'Europe/Moscow', 'Ireland': 'Europe/Dublin', 'China': 'Asia/Shanghai', 'Kazakhstan': 'Asia/Almaty',
  'Bahrain': 'Asia/Bahrain', 'Taiwan': 'Asia/Taipei', 'South Korea': 'Asia/Seoul', 'Costa Rica': 'America/Costa_Rica', 'Austria': 'Europe/Vienna',
  'Slovenia': 'Europe/Ljubljana', 'Tanzania': 'Africa/Dar_es_Salaam', 'Dominican Republic': 'America/Santo_Domingo', 'Latvia': 'Europe/Riga',
  'New Zealand': 'Pacific/Auckland', 'Andorra': 'Europe/Andorra', 'Norway': 'Europe/Oslo', 'Chile': 'America/Santiago', 'Bulgaria': 'Europe/Sofia',
  'Sweden': 'Europe/Stockholm', 'Finland': 'Europe/Helsinki', 'Hungary': 'Europe/Budapest', 'Croatia': 'Europe/Zagreb', 'Serbia': 'Europe/Belgrade',
  'Ukraine': 'Europe/Kyiv', 'Lithuania': 'Europe/Vilnius', 'Luxembourg': 'Europe/Luxembourg', 'Malta': 'Europe/Malta', 'Iceland': 'Atlantic/Reykjavik',
  'Japan': 'Asia/Tokyo', 'Vietnam': 'Asia/Ho_Chi_Minh', 'Sri Lanka': 'Asia/Colombo', 'Hong Kong': 'Asia/Hong_Kong', 'Israel': 'Asia/Jerusalem',
  'Lebanon': 'Asia/Beirut', 'Iraq': 'Asia/Baghdad', 'Iran': 'Asia/Tehran', 'Azerbaijan': 'Asia/Baku', 'Georgia': 'Asia/Tbilisi', 'Uzbekistan': 'Asia/Tashkent',
  'Australia': 'Australia/Sydney', 'South Africa': 'Africa/Johannesburg', 'Nigeria': 'Africa/Lagos', 'Kenya': 'Africa/Nairobi', 'Ghana': 'Africa/Accra',
  'Tunisia': 'Africa/Tunis', 'Algeria': 'Africa/Algiers', 'Argentina': 'America/Argentina/Buenos_Aires', 'Uruguay': 'America/Montevideo',
  'Panama': 'America/Panama', 'Guatemala': 'America/Guatemala', 'Bolivia': 'America/La_Paz', 'Venezuela': 'America/Caracas', 'Jamaica': 'America/Jamaica',
  'Maldives': 'Indian/Maldives', 'Bhutan': 'Asia/Thimphu', 'Cambodia': 'Asia/Phnom_Penh', 'Mongolia': 'Asia/Ulaanbaatar', 'Brunei': 'Asia/Brunei',
  'Albania': 'Europe/Tirane', 'North Macedonia': 'Europe/Skopje', 'Bosnia and Herzegovina': 'Europe/Sarajevo', 'Montenegro': 'Europe/Podgorica',
  'Moldova': 'Europe/Chisinau', 'Belarus': 'Europe/Minsk', 'Armenia': 'Asia/Yerevan', 'Kyrgyzstan': 'Asia/Bishkek', 'Ethiopia': 'Africa/Addis_Ababa',
  'Uganda': 'Africa/Kampala', 'Rwanda': 'Africa/Kigali', 'Senegal': 'Africa/Dakar', 'Zambia': 'Africa/Lusaka', 'Zimbabwe': 'Africa/Harare',
};

function validZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return null; }
}

/** The zone to count days in: the stored one, else the country's, else null (the browser's own). */
export function zoneOf(c: { timezone?: string | null; country?: string | null }): string | null {
  return validZone(c.timezone) ?? validZone(c.country ? COUNTRY_ZONE[c.country.trim()] : null);
}

let activeZone: string | null = null;
const cache = new Map<string, string | null>();

/** The crisis page sets this once the conference is known; day counts read it. */
export function setCrisisZone(zone: string | null): void { activeZone = zone; }
export function crisisZone(): string | null { return activeZone; }

/** Reads the conference's zone once per conference (conferences are readable with the link). null = unknown. */
export async function loadConferenceZone(conferenceId: string): Promise<string | null> {
  if (cache.has(conferenceId)) return cache.get(conferenceId) ?? null;
  try {
    const { data, error } = await supabase.from('conferences').select('timezone, country').eq('id', conferenceId).maybeSingle();
    if (error) return null;
    const zone = data ? zoneOf(data as { timezone: string | null; country: string | null }) : null;
    cache.set(conferenceId, zone);
    return zone;
  } catch {
    return null;
  }
}

/** Midnight at the start of `nowMs`'s day in `zone` (the browser's own zone when null), as epoch ms. */
export function startOfDayMs(nowMs: number, zone: string | null = activeZone): number {
  if (zone) {
    const ms = dayStartMs(dayInZone(new Date(nowMs).toISOString(), zone), zone);
    if (Number.isFinite(ms)) return ms;
  }
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const primed = new Map<string, Promise<void>>();

/** Finds the conference of this crisis once and makes its zone the one day counts use; resolves when that is done (a failed read
 *  leaves the browser's own zone). Call it before computing "today" figures. */
export function primeCrisisZone(ref: CrisisRef): Promise<void> {
  let p = primed.get(ref.id);
  if (!p) {
    p = (async () => {
      try {
        const client = await getCrisisClient(ref.conf, ref.crisis);
        const { data } = await client.from('crises').select('conference_id').eq('id', ref.id).maybeSingle();
        const id = (data as { conference_id?: string } | null)?.conference_id;
        if (id) setCrisisZone(await loadConferenceZone(id));
      } catch { primed.delete(ref.id); /* try again next time; the browser's zone stands */ }
    })();
    primed.set(ref.id, p);
  }
  return p;
}
