// Gavelling Crisis: zone types. A zone is a drawn area on the map that is NOT territory (a blockade line, a no-fly
// zone, a contested area, radiation). It never cuts or merges territory and may overlap other zones. The Crisis
// Director defines up to 20 zone types in Settings (crises.settings.zoneTypes); a zone points at one by id and takes its
// colour. Pure data and helpers, no map and no network.

export interface ZoneType {
  id: string;
  name: string;
  /** '#RRGGBB'. */
  color: string;
  description: string;
}

export const ZONE_TYPE_MAX = 20;
export const ZONE_NAME_MAX = 60;
export const ZONE_TYPE_DESCRIPTION_MAX = 300;

/** 20 colours that read on the pale land and sea, apart from each other. */
export const ZONE_COLORS: string[] = [
  '#C0392B', '#E67E22', '#F1C40F', '#7CB342', '#27AE60', '#00897B', '#00ACC1', '#2980B9', '#1F3A93', '#5E35B1',
  '#8E44AD', '#D81B60', '#AD1457', '#FF7043', '#6D4C41', '#827717', '#455A64', '#546E7A', '#3949AB', '#9E9D24',
];

/** A neutral colour for a zone that has no type. */
export const ZONE_NO_TYPE_COLOR = '#B4552F';

/** A starting set the Crisis Director can add in one press. */
export const SUGGESTED_ZONE_TYPES: Array<Omit<ZoneType, 'id'>> = [
  { name: 'Blockade line', color: '#2980B9', description: 'Ships and goods cannot pass.' },
  { name: 'No-fly zone', color: '#8E44AD', description: 'Aircraft that enter are shot down.' },
  { name: 'Contested', color: '#E67E22', description: 'More than one side claims this ground.' },
  { name: 'Radiation', color: '#9E9D24', description: 'Dangerous to enter or stay in.' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function newZoneTypeId(): string {
  return `zt-${new Date().getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Zone types read back from the settings blob (anything unreadable is dropped, at most 20). */
export function readZoneTypes(raw: unknown): ZoneType[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { zoneTypes?: unknown }).zoneTypes)
    ? ((raw as { zoneTypes: unknown[] }).zoneTypes)
    : Array.isArray(raw) ? raw : [];
  const out: ZoneType[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id ? o.id : null;
    if (!id || seen.has(id)) continue;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, ZONE_NAME_MAX) : '';
    if (!name) continue;
    seen.add(id);
    out.push({
      id,
      name,
      color: typeof o.color === 'string' && HEX.test(o.color) ? o.color : ZONE_COLORS[out.length % ZONE_COLORS.length],
      description: typeof o.description === 'string' ? o.description.slice(0, ZONE_TYPE_DESCRIPTION_MAX) : '',
    });
    if (out.length >= ZONE_TYPE_MAX) break;
  }
  return out;
}
