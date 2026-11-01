// Gavelling Crisis map: the maths of the Paint and Erase brushes. A brush stroke is a path dragged across the map; here it
// becomes a polygon (a round pen of a given size in km, so it is the very circle the cursor shows), and the polygon is
// then added to a cabinet's land or taken away from drawn land. Pure functions, no map and no network.
//
// The rules, all on drawn areas only (crisis_shapes kind 'area'):
//   Paint  the stroke joins the painting cabinet's own area it touches (else it becomes a new area) and is cut out of every
//          other cabinet's area it overlaps, so two sides never hold the same ground.
//   Erase  the stroke is cut out of every drawn area under it; an area left with nothing is removed.
// Whole countries are never split by a brush: painting over a country another cabinet holds only puts an area on top of
// it, and land of a country the painter already holds adds nothing. Zones are never touched.

import {
  AREA_EPS, areaOf, bboxHit, bboxOf, clean, cutOverlaps, differenceM, dropSlivers, pickClaimTarget, planClaim,
  type ClaimPlan, type ClaimTerr, type Multi, type Pt, type Ring,
} from '@/lib/crisis/geo';
import { clampLat } from './mapData';
import { cleanTolFor, clipOutOf, dropSmallParts, fillSmallHoles, snapToNeighbours, tidyCuts, tidyLand } from './geomClean';

const D2R = Math.PI / 180;
/** Degrees of latitude in one km (the same constant the sight circle uses, so a brush and a sight ring agree). */
const KM_PER_DEG = 111.2;

export const BRUSH_MIN_KM = 10;
export const BRUSH_MAX_KM = 2000;
export const BRUSH_DEFAULT_KM = 150;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * D2R) / 2));
const invMercY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / D2R;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** The brush radius in Mercator units at a latitude (it grows towards the poles like the land does). */
function radiusMerc(lat: number, km: number): number {
  return Math.abs(mercY(Math.min(84, lat + km / KM_PER_DEG)) - mercY(lat));
}

const toLL = (x: number, y: number): Pt => [Math.max(-180, Math.min(180, x / D2R)), clampLat(invMercY(y))];

/** The closed ring of the round pen centred on a point: what the cursor shows and what one click paints. */
export function brushCircle(lng: number, lat: number, km: number, steps = 40): Ring {
  const r = radiusMerc(lat, km);
  const cx = lng * D2R; const cy = mercY(lat);
  const ring: Ring = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push(toLL(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

/** The pen dragged from a to b: two half circles joined by straight sides (a "capsule"). */
function capsule(a: Pt, b: Pt, km: number, half = 14): Ring | null {
  const ax = a[0] * D2R; const ay = mercY(a[1]);
  const bx = b[0] * D2R; const by = mercY(b[1]);
  const dx = bx - ax; const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const r = radiusMerc((a[1] + b[1]) / 2, km);
  const th = Math.atan2(dy, dx);
  const ring: Ring = [];
  // Around b from the left of the direction of travel to the right, then around a back again.
  for (let i = 0; i <= half; i++) { const t = th + Math.PI / 2 - (i / half) * Math.PI; ring.push(toLL(bx + r * Math.cos(t), by + r * Math.sin(t))); }
  for (let i = 0; i <= half; i++) { const t = th - Math.PI / 2 - (i / half) * Math.PI; ring.push(toLL(ax + r * Math.cos(t), ay + r * Math.sin(t))); }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

/**
 * The stroke so far, grown by the pen moving from `from` to `to` (`from` null: a single dab). A long move is cut into
 * pieces no longer than the pen's radius so the width stays right at every latitude. Throws when the clipper cannot
 * make sense of the shapes: the caller keeps the stroke it had.
 */
export function growStroke(acc: Multi, from: Pt | null, to: Pt, km: number): Multi {
  const pieces: Multi = [];
  if (!from) {
    pieces.push([brushCircle(to[0], to[1], km)]);
  } else {
    const r = radiusMerc((from[1] + to[1]) / 2, km);
    const dist = Math.hypot((to[0] - from[0]) * D2R, mercY(to[1]) - mercY(from[1]));
    const n = Math.max(1, Math.min(24, Math.ceil(dist / Math.max(r * 0.9, 1e-9))));
    let prev = from;
    for (let i = 1; i <= n; i++) {
      const lng = from[0] + ((to[0] - from[0]) * i) / n;
      const y = mercY(from[1]) + ((mercY(to[1]) - mercY(from[1])) * i) / n;
      const next: Pt = i === n ? to : toLL(lng * D2R, y);
      const c = capsule(prev, next, km);
      if (c) pieces.push([c]);
      prev = next;
    }
    if (!pieces.length) pieces.push([brushCircle(to[0], to[1], km)]);
  }
  return clean([...acc, ...pieces]);
}

// ─────────── Keeping the geometry light ───────────

function sqDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0]; const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Douglas-Peucker on an open run of points, without recursion; the first and last point stay. */
function simplifyRun(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const tol2 = tol * tol;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop() as [number, number];
    let worst = -1; let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = sqDist(pts[i], pts[lo], pts[hi]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol2 && at > 0) { keep[at] = 1; stack.push([lo, at], [at, hi]); }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

/** A closed ring with fewer corners: split at the point farthest from the first corner, simplify both runs. */
function simplifyRing(ring: Ring, tol: number): Ring {
  const open = ring.slice(0, -1);
  if (open.length <= 4) return ring;
  let far = 1; let farD = -1;
  for (let i = 1; i < open.length; i++) {
    const d = (open[i][0] - open[0][0]) ** 2 + (open[i][1] - open[0][1]) ** 2;
    if (d > farD) { farD = d; far = i; }
  }
  const a = simplifyRun(open.slice(0, far + 1), tol);
  const b = simplifyRun([...open.slice(far), open[0]], tol);
  const out = [...a, ...b.slice(1, -1)];
  out.push([out[0][0], out[0][1]]);
  return out;
}

/** Rounds every point to 5 decimals (about a metre), drops points that land on the previous one and rings too small to be land. */
export function roundMulti(m: Multi): Multi {
  const out: Multi = [];
  for (const poly of m) {
    const rings: Ring[] = [];
    for (const ring of poly) {
      const r: Ring = [];
      for (const p of ring) {
        const q: Pt = [round5(p[0]), round5(p[1])];
        const l = r[r.length - 1];
        if (l && l[0] === q[0] && l[1] === q[1]) continue;
        r.push(q);
      }
      if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push([r[0][0], r[0][1]]);
      if (r.length >= 4) rings.push(r);
      else if (!rings.length) break;
    }
    if (rings.length) out.push(rings);
  }
  return out;
}

/** A finished stroke: simplified to a short outline (a few percent of the pen's radius), rounded, tidied. */
export function finishStroke(acc: Multi, km: number): Multi {
  if (!acc.length) return [];
  const tol = Math.max(1e-4, (km / KM_PER_DEG) * 0.03);
  const simple: Multi = acc.map((poly) => poly.map((ring) => simplifyRing(ring, tol)));
  return dropSlivers(clean(roundMulti(simple)));
}

// ─────────── What a stroke does to the land ───────────

/** The plan with every outline rounded, so what is saved stays light. */
function roundPlan(p: ClaimPlan): ClaimPlan {
  return {
    ...p,
    land: roundMulti(p.land),
    cuts: p.cuts.map((c) => ({ ...c, multi: roundMulti(c.multi) })),
  };
}

export interface PaintPlan {
  /** The cabinet's own area the stroke grows (null: it becomes a new area). */
  target: ClaimTerr | null;
  plan: ClaimPlan;
  /** True when the stroke adds no land (everything under it already belongs to the painter). */
  nothing: boolean;
  /** True when the area the stroke grows has no land left of its own (it lay inside a country the painter holds whole). */
  targetEmptied: boolean;
}

/**
 * Adds `stroke` to `owner`'s land. `areas` are all the drawn areas; `ownCountries` the countries the painter already
 * holds (land under the stroke that is already theirs adds nothing, and an area of theirs never lies inside such a
 * country). Other cabinets' countries are not passed in, so a brush never changes a country. Afterwards the land is
 * tidied (small holes closed, gaps against the painter's own land closed, specks dropped), scaled by the pen's size `km`.
 */
export function planPaint(stroke: Multi, owner: string, areas: ClaimTerr[], ownCountries: ClaimTerr[], km = BRUSH_DEFAULT_KM): PaintPlan {
  const tol = cleanTolFor(km);
  const own = [...areas.filter((a) => a.owner === owner), ...ownCountries];
  const ownCountryShapes = ownCountries.map((c) => c.multi);
  let s = stroke;
  try { s = dropSmallParts(snapToNeighbours(stroke, own.map((o) => o.multi), tol), tol, null, true); } catch { s = stroke; }
  const target = pickClaimTarget(s, owner, areas);
  const growth = target ? differenceM(s, target.multi) : s;
  const plan = planClaim(growth, owner, target ? { id: target.id, multi: target.multi } : null, [...areas, ...ownCountries], true);
  const added = dropSlivers(plan.gained);
  // The painter's area never overlaps a country the painter holds whole, and what is left is tidied.
  const theirs = areas.filter((a) => a.owner !== owner).map((a) => a.multi);
  const land = tidyLand(ownCountryShapes.length ? clipOutOf(plan.land, ownCountryShapes) : plan.land, own.map((o) => o.multi).filter((m) => m !== target?.multi), theirs, km);
  const cuts = tidyCuts(plan.cuts, bboxOf(plan.gained), km);
  const tidy: ClaimPlan = { ...plan, land, cuts };
  const nothing = !plan.land.length || !added.length || areaOf(added) <= AREA_EPS || (!target && !land.length);
  return { target, plan: roundPlan(tidy), nothing, targetEmptied: !!target && !land.length };
}

/** Takes `stroke` out of every drawn area it covers; an area left with nothing is marked emptied. Leftovers are tidied. */
export function planErase(stroke: Multi, areas: ClaimTerr[], km = BRUSH_DEFAULT_KM): ClaimPlan {
  const sb = bboxOf(stroke);
  const near = sb ? areas.filter((a) => a.bbox && bboxHit(a.bbox, sb)) : [];
  const tol = cleanTolFor(km);
  const cuts = cutOverlaps(stroke, null, near).map((c) => {
    let left = dropSlivers(c.multi);
    try { left = dropSmallParts(fillSmallHoles(left, tol.hole, sb), tol, sb); } catch { /* keep what the cut left */ }
    return { id: c.id, multi: roundMulti(left), emptied: !left.length };
  });
  return { land: [], absorbed: [], cuts, gained: [] };
}

/** The size slider's 0 to 100 as km, on a log scale (small sizes get as much travel as big ones). */
export function kmFromSlider(v: number): number {
  const t = Math.max(0, Math.min(100, v)) / 100;
  const km = BRUSH_MIN_KM * (BRUSH_MAX_KM / BRUSH_MIN_KM) ** t;
  return km < 100 ? Math.round(km / 5) * 5 : km < 500 ? Math.round(km / 10) * 10 : Math.round(km / 50) * 50;
}
export function sliderFromKm(km: number): number {
  const k = Math.max(BRUSH_MIN_KM, Math.min(BRUSH_MAX_KM, km));
  return Math.round((Math.log(k / BRUSH_MIN_KM) / Math.log(BRUSH_MAX_KM / BRUSH_MIN_KM)) * 100);
}

/** A tidy brush size close to `km`, for a first suggestion. */
export function niceKm(km: number): number {
  return Math.max(BRUSH_MIN_KM, Math.min(BRUSH_MAX_KM, kmFromSlider(sliderFromKm(km))));
}

/** A first brush size for the map as it is zoomed now: a pen about `px` pixels across its radius. */
export function brushKmForPixels(pxPerDegLat: number, px = 28): number {
  if (!(pxPerDegLat > 0)) return BRUSH_DEFAULT_KM;
  return niceKm((KM_PER_DEG / pxPerDegLat) * px);
}
