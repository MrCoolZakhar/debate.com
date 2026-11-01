// Gavelling Crisis: custom troop types. The Crisis Director defines them in Settings (crises.settings.customUnitTypes):
// a name, an optional picture, an optional sight range and optional details. A unit points at one by key
// (crisis_units.custom_type) and may also carry its own picture and details. Pure data and helpers, no network.

export interface CustomUnitType {
  key: string;
  name: string;
  picture_url?: string | null;
  /** How far this kind of troop sees, in km (0..5000); copied onto a unit when it is made. */
  sight_km?: number | null;
  details?: string | null;
}

export const CUSTOM_UNIT_TYPE_MAX = 30;
export const CUSTOM_UNIT_NAME_MAX = 60;
export const CUSTOM_UNIT_DETAILS_MAX = 1000;

export function newCustomUnitKey(): string {
  return `ct-${new Date().getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Only plain http(s) addresses (or a site path) are drawn as a picture. */
export function safePictureUrl(u: string | null | undefined): string | null {
  return u && /^(https?:\/\/[^\s"'<>]+|\/[^/\s"'<>][^\s"'<>]*)$/.test(u) ? u : null;
}

/** Custom troop types read back from the settings blob (anything unreadable is dropped). */
export function readCustomUnitTypes(raw: unknown): CustomUnitType[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { customUnitTypes?: unknown }).customUnitTypes)
    ? (raw as { customUnitTypes: unknown[] }).customUnitTypes
    : [];
  const out: CustomUnitType[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const key = typeof o.key === 'string' && o.key ? o.key : null;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, CUSTOM_UNIT_NAME_MAX) : '';
    if (!key || !name || seen.has(key)) continue;
    seen.add(key);
    const sight = typeof o.sight_km === 'number' && Number.isFinite(o.sight_km) && o.sight_km >= 0 ? Math.min(5000, Math.round(o.sight_km)) : null;
    out.push({
      key, name,
      picture_url: safePictureUrl(typeof o.picture_url === 'string' ? o.picture_url : null),
      sight_km: sight,
      details: typeof o.details === 'string' && o.details.trim() ? o.details.slice(0, CUSTOM_UNIT_DETAILS_MAX) : null,
    });
    if (out.length >= CUSTOM_UNIT_TYPE_MAX) break;
  }
  return out;
}

type UnitLike = { custom_type?: string | null; picture_url?: string | null; details?: string | null };

export function customTypeOf(u: UnitLike, types: CustomUnitType[]): CustomUnitType | null {
  return u.custom_type ? types.find((t) => t.key === u.custom_type) ?? null : null;
}

/** The picture a unit shows: its own, else its type's. */
export function unitPictureOf(u: UnitLike, types: CustomUnitType[]): string | null {
  return safePictureUrl(u.picture_url) ?? safePictureUrl(customTypeOf(u, types)?.picture_url);
}

/** The details a unit shows: its own, else its type's. */
export function unitDetailsOf(u: UnitLike, types: CustomUnitType[]): string {
  const own = (u.details ?? '').trim();
  return own || (customTypeOf(u, types)?.details ?? '').trim();
}
