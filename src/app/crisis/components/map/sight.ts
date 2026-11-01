// Gavelling Crisis map: a unit's sight circle. A unit sees a point when it is within `km` of it measured over the
// ground (great circle, the same distance the database uses, and kmBetween on the client), so the circle the fog opens
// and the dashed ring are TRUE circles on the globe, drawn as a ring of points at that distance. On a flat map they
// look stretched towards the poles, exactly as far as the land does. The helpers below build that ring, the handle on its
// edge (due east) and the km for a dragged handle.

import { KIND_META, type LngLat } from './mapData';
import type { UnitKind } from '@/lib/crisis/types';

const D2R = Math.PI / 180;
const EARTH_KM = 6371;
export const SIGHT_MAX_KM = 5000;

/** A unit's sight in km: its own setting, else the default for its kind. */
export function sightKmOf(u: { kind: UnitKind; sight_km?: number | null }): number {
  const own = u.sight_km;
  if (typeof own === 'number' && Number.isFinite(own) && own >= 0) return Math.min(SIGHT_MAX_KM, own);
  return KIND_META[u.kind]?.sight ?? KIND_META.custom.sight;
}

/** The point `km` away from (lng, lat) along a bearing (radians, 0 = north, clockwise). Longitude is not wrapped. */
function destination(lng: number, lat: number, bearing: number, km: number): LngLat {
  const d = km / EARTH_KM;
  const p1 = lat * D2R;
  const sinP2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(bearing);
  const p2 = Math.asin(Math.max(-1, Math.min(1, sinP2)));
  const dl = Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * sinP2);
  return [lng + dl / D2R, Math.max(-85, Math.min(85, p2 / D2R))];
}

/** The ring of points `km` from a centre, closed, longitude not wrapped (for drawing on the screen). */
export function sightPoints(lng: number, lat: number, km: number, steps = 72): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i <= steps; i++) out.push(destination(lng, lat, (i / steps) * Math.PI * 2, km));
  return out;
}

/** The closed ring of the sight circle, kept inside the world's longitudes (for the map layer). */
export function sightRing(lng: number, lat: number, km: number, steps = 72): number[][] {
  return sightPoints(lng, lat, km, steps).map((p) => [Math.max(-180, Math.min(180, p[0])), p[1]]);
}

/** Where the drag handle sits: due east on the ring. */
export function sightHandleAt(lng: number, lat: number, km: number): LngLat {
  const p = destination(lng, lat, Math.PI / 2, km);
  return [Math.min(180, p[0]), p[1]];
}

/** The km a pointer at `to` makes the ring: its distance over the ground from the centre. */
export function kmFromPointer(lng: number, lat: number, to: LngLat): number {
  const dLat = (to[1] - lat) * D2R;
  const dLng = (to[0] - lng) * D2R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * D2R) * Math.cos(to[1] * D2R) * Math.sin(dLng / 2) ** 2;
  const km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.max(0, Math.min(SIGHT_MAX_KM, Math.round(km)));
}

export function kmText(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
