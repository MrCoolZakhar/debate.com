// Gavelling Crisis map: tidying land after a paint, an erase, a province claim, a drawn area or a country handed over.
// Clipping leaves dust behind: a hole too small to be anything, a sliver of a neighbour's area along a cut, a hair of a gap
// between a new stroke and the cabinet's own land. None of that is meant to be there, so after every change it is closed,
// snapped or dropped. The limits scale with the size of the brush (which already follows the zoom the map is at), with a
// floor of about 25 km2. Pure functions, no map and no network. Every function that can fail inside the clipper hands back
// what it was given, so a tidy never loses land.

import {
  AREA_EPS, areaOf, bboxHit, bboxOf, clean, differenceM, dropSlivers, unionM,
  type Bbox, type ClaimPlan, type ClaimTerr, type Multi, type Pt, type Ring,
} from '@/lib/crisis/geo';

const KM_PER_DEG = 111.2;
/** No hole, piece or gap is "tiny" above this, however small the brush. */
export const MIN_PART_KM2 = 25;
/** A first guess at a tolerance for work that is not a brush (a province, a drawn outline, a country handed over). */
export const TIDY_KM = 60;

export interface CleanTol {
  /** Holes up to this (square degrees) are closed. */
  hole: number;
  /** Pieces up to this (square degrees) are leftovers. */
  part: number;
  /** Pieces narrower than this (degrees, taken as twice the area over the perimeter) are slivers. */
  width: number;
  /** A corner this close (degrees) to a neighbouring outline of the same cabinet is snapped onto it. */
  snap: number;
}

export function cleanTolFor(km: number): CleanTol {
  const r = Math.max(10, km) / KM_PER_DEG;
  const floor = MIN_PART_KM2 / (KM_PER_DEG * KM_PER_DEG);
  const pen = Math.PI * r * r;
  return { hole: Math.max(floor, pen * 0.02), part: Math.max(floor, pen * 0.02), width: r * 0.08, snap: r * 0.05 };
}

const ringAbs = (r: Ring): number => {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(a / 2);
};
const ringLen = (r: Ring): number => {
  let l = 0;
  for (let i = 0; i < r.length - 1; i++) l += Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]);
  return l;
};
const grow = (b: Bbox, d: number): Bbox => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
const polyBox = (poly: Multi[number]): Bbox | null => bboxOf([poly]);

/** Holes up to `max` square degrees are closed (only those near `near`, when given). */
export function fillSmallHoles(m: Multi, max: number, near?: Bbox | null): Multi {
  return m.map((poly) => {
    if (poly.length < 2) return poly;
    if (near) { const pb = polyBox(poly); if (!pb || !bboxHit(pb, near)) return poly; }
    return [poly[0], ...poly.slice(1).filter((h) => ringAbs(h) > max)];
  });
}

/**
 * Drops the pieces that are leftovers: smaller than `tol.part`, or thinner than `tol.width` (and not big). With `near`,
 * only pieces that touch that box are judged, so far-away land is never touched. `keepOne` keeps the biggest piece
 * whatever happens, for land that must not vanish.
 */
export function dropSmallParts(m: Multi, tol: Pick<CleanTol, 'part' | 'width'>, near?: Bbox | null, keepOne = false): Multi {
  const keep = m.filter((poly) => {
    if (near) { const pb = polyBox(poly); if (!pb || !bboxHit(pb, near)) return true; }
    const a = areaOf([poly]);
    if (a < tol.part) return false;
    const per = ringLen(poly[0]);
    const w = per > 0 ? (2 * a) / per : 0;
    return !(w < tol.width && a < tol.part * 30);
  });
  if (keep.length || !keepOne || !m.length) return keep;
  let best = m[0]; let bestA = -1;
  for (const p of m) { const a = areaOf([p]); if (a > bestA) { best = p; bestA = a; } }
  return [best];
}

// ─────────── Closing gaps against the cabinet's own land ───────────

interface Seg { ax: number; ay: number; bx: number; by: number }

function segsNear(neigh: Multi[], box: Bbox): Seg[] {
  const out: Seg[] = [];
  for (const n of neigh) {
    const nb = bboxOf(n);
    if (!nb || !bboxHit(nb, box)) continue;
    for (const poly of n) for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i]; const b = ring[i + 1];
        if (Math.max(a[0], b[0]) < box[0] || Math.min(a[0], b[0]) > box[2] || Math.max(a[1], b[1]) < box[1] || Math.min(a[1], b[1]) > box[3]) continue;
        out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1] });
      }
    }
  }
  return out;
}

/** The point on the nearest segment within `snap` degrees of p, or null. */
function snapPoint(p: Pt, segs: Seg[], snap: number): Pt | null {
  const c = Math.max(0.2, Math.cos((p[1] * Math.PI) / 180));
  let best = snap; let at: Pt | null = null;
  for (const s of segs) {
    if (p[0] < Math.min(s.ax, s.bx) - snap / c || p[0] > Math.max(s.ax, s.bx) + snap / c || p[1] < Math.min(s.ay, s.by) - snap || p[1] > Math.max(s.ay, s.by) + snap) continue;
    const dx = (s.bx - s.ax) * c; const dy = s.by - s.ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? (((p[0] - s.ax) * c) * dx + (p[1] - s.ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = s.ax + (s.bx - s.ax) * t; const qy = s.ay + (s.by - s.ay) * t;
    const d = Math.hypot((p[0] - qx) * c, p[1] - qy);
    if (d < best) { best = d; at = [qx, qy]; }
  }
  return at && best > 1e-9 ? at : null;
}

/**
 * Closes hair-thin gaps between `m` and the outlines of land the same cabinet holds: a corner within `tol.snap` of such an
 * outline moves onto it (long sides get extra corners where they run alongside one). Gives `m` back when nothing is
 * near, or when snapping would change the land by more than a tenth.
 */
export function snapToNeighbours(m: Multi, neigh: Multi[], tol: Pick<CleanTol, 'snap'>): Multi {
  const mb = bboxOf(m);
  if (!mb || !neigh.length) return m;
  const segs = segsNear(neigh, grow(mb, tol.snap * 2));
  if (!segs.length) return m;
  let verts = 0;
  for (const poly of m) for (const ring of poly) verts += ring.length;
  if (verts * segs.length > 4e7) return m;
  let moved = false;
  const next: Multi = m.map((poly) => poly.map((ring) => {
    const out: Ring = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]; const b = ring[i + 1];
      const qa = snapPoint(a, segs, tol.snap);
      if (qa) moved = true;
      out.push(qa ?? a);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > tol.snap * 2) {
        const k = Math.min(40, Math.floor(len / (tol.snap * 2)));
        for (let j = 1; j <= k; j++) {
          const f = j / (k + 1);
          const q = snapPoint([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], segs, tol.snap);
          if (q) { out.push(q); moved = true; }
        }
      }
    }
    out.push([out[0][0], out[0][1]]);
    return out;
  }));
  if (!moved) return m;
  try {
    const cleaned = clean(next);
    const before = areaOf(m); const after = areaOf(cleaned);
    if (!cleaned.length || before <= 0 || Math.abs(after - before) > before * 0.1) return m;
    return cleaned;
  } catch { return m; }
}

/**
 * Closes the small holes that the land and the cabinet's own neighbouring land enclose together (a gap left between a
 * new stroke and an old area, or a country). The gap takes the colour of the land around it, but never ground that
 * another cabinet holds.
 */
export function closeEnclosedGaps(land: Multi, own: Multi[], theirs: Multi[], tol: Pick<CleanTol, 'hole' | 'snap'>): Multi {
  const lb = bboxOf(land);
  if (!lb || !own.length) return land;
  const box = grow(lb, tol.snap * 2);
  const near = own.filter((o) => { const b = bboxOf(o); return !!b && bboxHit(b, box); });
  if (!near.length) return land;
  try {
    let u: Multi = land;
    for (const n of near) u = unionM(u, n);
    const gaps: Multi = [];
    for (const poly of u) for (const hole of poly.slice(1)) {
      const a = ringAbs(hole);
      if (a > AREA_EPS && a <= tol.hole) gaps.push([hole]);
    }
    if (!gaps.length) return land;
    let fill: Multi = gaps;
    const gb = bboxOf(gaps);
    for (const t of theirs) {
      const b = bboxOf(t);
      if (gb && b && bboxHit(b, gb)) fill = differenceM(fill, t);
    }
    fill = dropSlivers(fill);
    return fill.length ? unionM(land, fill) : land;
  } catch { return land; }
}

/** `land` without the ground of the given countries (land a cabinet holds as a whole country is never also an area). */
export function clipOutOf(land: Multi, countries: Multi[]): Multi {
  let out = land;
  const lb = bboxOf(land);
  if (!lb) return land;
  for (const c of countries) {
    const cb = bboxOf(c);
    if (!cb || !bboxHit(cb, lb) || !out.length) continue;
    out = differenceM(out, c);
  }
  return dropSlivers(out);
}

// ─────────── The finished pieces ───────────

/** Land a cabinet just painted, drawn or claimed, tidied: small holes closed, gaps against its own land closed, specks dropped. */
export function tidyLand(land: Multi, own: Multi[], theirs: Multi[], km: number): Multi {
  if (!land.length) return land;
  const tol = cleanTolFor(km);
  try {
    let out = fillSmallHoles(land, tol.hole);
    out = closeEnclosedGaps(out, own, theirs, tol);
    out = dropSmallParts(out, { part: Math.min(tol.part, MIN_PART_KM2 / (KM_PER_DEG * KM_PER_DEG)), width: 0 }, null, true);
    return out;
  } catch { return land; }
}

/** What is left of another cabinet's area after land was cut out of it: holes that small and pieces that thin are not land. */
export function tidyLeftover(left: Multi, cutBox: Bbox | null, km: number): Multi {
  if (!left.length) return left;
  const tol = cleanTolFor(km);
  const near = cutBox ? grow(cutBox, tol.snap * 3) : null;
  try {
    return dropSmallParts(fillSmallHoles(left, tol.hole, near), tol, near);
  } catch { return left; }
}

/** The cuts of a plan with every leftover tidied; one that is left with nothing counts as emptied. */
export function tidyCuts(cuts: ClaimPlan['cuts'], cutBox: Bbox | null, km: number): ClaimPlan['cuts'] {
  return cuts.map((c) => {
    if (c.emptied) return c;
    const multi = tidyLeftover(c.multi, cutBox, km);
    return { ...c, multi, emptied: !multi.length || areaOf(multi) <= AREA_EPS };
  });
}

/**
 * Drawn areas that sit inside a country a cabinet was just given: the parts of the cabinet's own areas inside the country
 * are taken out (an area left with nothing is removed), so the country shows one colour and nothing overlaps. Another
 * cabinet's areas are left alone: that is occupation.
 */
export function absorbIntoCountry(
  areas: Array<{ id: string; owner: string | null; multi: Multi }>, owner: string, country: Multi, km = TIDY_KM,
): Array<{ id: string; multi: Multi; emptied: boolean }> {
  const cb = bboxOf(country);
  if (!cb || !country.length) return [];
  const out: Array<{ id: string; multi: Multi; emptied: boolean }> = [];
  for (const a of areas) {
    if (a.owner !== owner || !a.multi.length) continue;
    const ab = bboxOf(a.multi);
    if (!ab || !bboxHit(ab, cb)) continue;
    try {
      const before = areaOf(a.multi);
      const left = tidyLeftover(differenceM(a.multi, country), cb, km);
      const after = areaOf(left);
      if (before - after <= AREA_EPS) continue;
      out.push({ id: `a:${a.id}`, multi: left, emptied: !left.length || after <= AREA_EPS });
    } catch { /* an unreadable area is left as it is */ }
  }
  return out;
}

/**
 * The land an area may take from: other areas, and the cabinet's own countries. A drawn area never cuts a country (a country
 * that is partly occupied keeps its own outline and colour); it only lies on top of it.
 */
export function areaClaimOthers(others: ClaimTerr[], owner: string | null): ClaimTerr[] {
  return others.filter((o) => o.kind === 'area' || (owner !== null && o.owner === owner));
}

/**
 * A claim by an area (a drawn outline, a dragged border): its land is clipped away from the countries the cabinet already
 * holds whole, then tidied; what other areas lost is tidied too. `exceptId` is the cabinet's country the claim is extending
 * (never clipped away from itself).
 */
export function tidyAreaClaim(plan: ClaimPlan, owner: string | null, others: ClaimTerr[], exceptId: string | null, km = TIDY_KM): ClaimPlan {
  try {
    const own = others.filter((o) => owner !== null && o.owner === owner && o.id !== exceptId);
    const ownCountries = own.filter((o) => o.kind === 'country').map((o) => o.multi);
    const theirs = others.filter((o) => o.kind === 'area' && (owner === null || o.owner !== owner)).map((o) => o.multi);
    let land = ownCountries.length ? clipOutOf(plan.land, ownCountries) : plan.land;
    land = tidyLand(land, own.map((o) => o.multi), theirs, km);
    const box = bboxOf(plan.gained);
    return { ...plan, land, cuts: tidyCuts(plan.cuts, box, km) };
  } catch { return plan; }
}
