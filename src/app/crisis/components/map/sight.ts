// Gavelling Crisis map: a unit's sight circle. The fog draws it as a circle on the screen whose radius is the
// sight in km measured north-south in Mercator (so it grows towards the poles like the land does). These
// helpers build the very same circle in map coordinates, the handle on its edge and the km for a dragged
// handle, so the ring a staff member drags is the ring the fog draws.

import { KIND_META, clampLat, type LngLat } from './mapData';
import type { UnitKind } from '@/lib/crisis/types';

const D2R = Math.PI / 180;
/** Degrees of latitude in one km. */
const KM_PER_DEG = 111.2;
export const SIGHT_MAX_KM = 5000;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * D2R) / 2));
const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) / D2R);

/** A unit's sight in km: its own setting, else the default for its kind. */
export function sightKmOf(u: { kind: UnitKind; sight_km?: number | null }): number {
  const own = u.sight_km;
  if (typeof own === 'number' && Number.isFinite(own) && own >= 0) return Math.min(SIGHT_MAX_KM, own);
  return KIND_META[u.kind]?.sight ?? KIND_META.custom.sight;
}

/** The circle's radius in Mercator units. */
function radiusMerc(lat: number, km: number): number {
  return Math.abs(mercY(Math.min(84, lat + km / KM_PER_DEG)) - mercY(lat));
}

/** The closed ring of the sight circle. */
export function sightRing(lng: number, lat: number, km: number, steps = 72): number[][] {
  const r = radiusMerc(lat, km);
  const cx = lng * D2R; const cy = mercY(lat);
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([Math.max(-180, Math.min(180, (cx + r * Math.cos(a)) / D2R)), clampLat(invMercY(cy + r * Math.sin(a)))]);
  }
  return ring;
}

/** Where the drag handle sits: due east on the ring. */
export function sightHandleAt(lng: number, lat: number, km: number): LngLat {
  return [Math.min(180, lng + radiusMerc(lat, km) / D2R), lat];
}

/** The km a pointer at `to` makes the ring: its distance from the centre, in the same Mercator terms. */
export function kmFromPointer(lng: number, lat: number, to: LngLat): number {
  const d = Math.hypot((to[0] - lng) * D2R, mercY(to[1]) - mercY(lat));
  const lat1 = invMercY(mercY(lat) + d);
  return Math.max(0, Math.min(SIGHT_MAX_KM, Math.round((lat1 - lat) * KM_PER_DEG)));
}

export function kmText(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
