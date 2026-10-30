// Gavelling Crisis: territory geometry for the map's border tools. Countries and drawn areas are handled as
// lists of polygons (rings of [lng, lat], closed). Editing moves one point of an outline; the result is cleaned
// with polygon-clipping (MIT), and land a territory grows over is cut out of every other territory that
// overlaps it, so two sides never hold the same ground. Pure functions, no map and no network.

import * as pcNs from 'polygon-clipping';
import type { RegionGeometry } from './types';

type PC = typeof pcNs;
// The ESM build exports one default object; the types declare named functions. Take whichever is there.
const pc: PC = ((pcNs as unknown as { default?: PC }).default ?? pcNs);

export type Pt = [number, number];
export type Ring = Pt[];          // closed: the last point repeats the first
export type Poly = Ring[];        // outer ring, then holes
export type Multi = Poly[];
export type Bbox = [number, number, number, number];
export interface ScreenPt { x: number; y: number }

/** Below this (square degrees, about a thousand square metres) a change is floating-point noise, not land. */
export const AREA_EPS = 1e-7;
/** Outlines with at most this many corners show a handle on every corner. */
export const HANDLE_LIMIT = 60;

function closeRing(r: Ring): Ring {
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push([r[0][0], r[0][1]]);
  return r;
}

/** Any stored Polygon / MultiPolygon (or nothing) as a list of polygons with closed rings. */
export function toMulti(g: { type?: string; coordinates?: unknown } | null | undefined): Multi {
  if (!g || !Array.isArray(g.coordinates)) return [];
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? (g.coordinates as unknown[]) : [];
  const out: Multi = [];
  for (const poly of polys) {
    if (!Array.isArray(poly)) continue;
    const rings: Poly = [];
    for (const ring of poly) {
      if (!Array.isArray(ring)) continue;
      const r: Ring = [];
      for (const p of ring) {
        if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) r.push([Number(p[0]), Number(p[1])]);
      }
      closeRing(r);
      if (r.length >= 4) rings.push(r);
      else if (!rings.length) break;   // no outer ring: drop the polygon
    }
    if (rings.length) out.push(rings);
  }
  return out;
}

/** Back to GeoJSON: one polygon is a Polygon, several (or none) a MultiPolygon. */
export function toGeometry(m: Multi): RegionGeometry {
  if (m.length === 1) return { type: 'Polygon', coordinates: m[0] };
  return { type: 'MultiPolygon', coordinates: m };
}

/**
 * Drops repeated points and rings too small to be land. Coordinates are never rounded: every border shares its
 * exact points with its neighbour, so a cut leaves no slivers or gaps.
 */
function tidy(m: Multi): Multi {
  const out: Multi = [];
  for (const poly of m) {
    const rings: Poly = [];
    for (const ring of poly) {
      const r: Ring = [];
      for (const p of ring) {
        const q: Pt = [p[0], p[1]];
        const last = r[r.length - 1];
        if (last && last[0] === q[0] && last[1] === q[1]) continue;
        r.push(q);
      }
      closeRing(r);
      if (r.length >= 4) rings.push(r);
      else if (!rings.length) break;
    }
    if (rings.length) out.push(rings);
  }
  return out;
}

/** Fixes crossings and spikes: the union of a shape with itself. Throws when the shape cannot be read. */
export function clean(m: Multi): Multi {
  if (!m.length) return [];
  return tidy(pc.union(m as pcNs.MultiPolygon) as Multi);
}

export function unionM(a: Multi, b: Multi): Multi {
  if (!a.length) return clean(b);
  if (!b.length) return clean(a);
  return tidy(pc.union(a as pcNs.MultiPolygon, b as pcNs.MultiPolygon) as Multi);
}

export function differenceM(a: Multi, b: Multi): Multi {
  if (!a.length) return [];
  if (!b.length) return a;
  // Polygons nowhere near the cut pass through untouched (and much faster).
  const bb = bboxOf(b);
  if (!bb) return a;
  const near: Multi = []; const far: Multi = [];
  for (const poly of a) { const pb = bboxOf([poly]); (pb && bboxHit(pb, bb) ? near : far).push(poly); }
  if (!near.length) return a;
  return [...tidy(pc.difference(near as pcNs.MultiPolygon, b as pcNs.MultiPolygon) as Multi), ...far];
}

export function bboxOf(m: Multi): Bbox | null {
  let w = Infinity; let s = Infinity; let e = -Infinity; let n = -Infinity;
  for (const poly of m) for (const p of poly[0] ?? []) {
    if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0];
    if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1];
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

export function bboxHit(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return a / 2;
}

/** Planar area in square degrees (holes taken away). Only ever compared with itself. */
export function areaOf(m: Multi): number {
  let a = 0;
  for (const poly of m) poly.forEach((ring, i) => { a += (i === 0 ? 1 : -1) * Math.abs(ringArea(ring)); });
  return a;
}

export function vertexCount(m: Multi): number {
  let n = 0;
  for (const poly of m) for (const ring of poly) n += Math.max(0, ring.length - 1);
  return n;
}

function inRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]; const [xj, yj] = r[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointIn(p: Pt, m: Multi): boolean {
  for (const poly of m) {
    if (!poly[0] || !inRing(p, poly[0])) continue;
    if (poly.slice(1).some((h) => inRing(p, h))) continue;
    return true;
  }
  return false;
}

/** Where a label goes: the middle of the largest piece. */
export function labelPoint(m: Multi): Pt | null {
  let best = 0; let at: Pt | null = null;
  for (const poly of m) {
    const ring = poly[0];
    let a = 0; let cx = 0; let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      a += f; cx += (ring[i][0] + ring[i + 1][0]) * f; cy += (ring[i][1] + ring[i + 1][1]) * f;
    }
    const area = Math.abs(a / 2) * Math.cos((ring[0][1] * Math.PI) / 180);
    if (area > best && Math.abs(a) > 1e-12) { best = area; at = [cx / (3 * a), cy / (3 * a)]; }
  }
  return at;
}

// ─────────── Finding and moving a point of an outline ───────────

/** A spot on an outline: polygon, ring and segment (from corner si to the next), t along it. */
export interface EdgeHit { pi: number; ri: number; si: number; t: number; at: Pt; dist: number }

/**
 * The outline segment nearest a screen point, within maxPx. `tolDeg` is maxPx in degrees (generous), so
 * only segments near the pointer are ever projected; a country of thousands of corners stays fast.
 */
export function nearestEdge(m: Multi, mouse: ScreenPt, mouseLL: Pt, tolDeg: number, maxPx: number, project: (p: Pt) => ScreenPt): EdgeHit | null {
  let best: EdgeHit | null = null;
  const [mx, my] = mouseLL;
  m.forEach((poly, pi) => poly.forEach((ring, ri) => {
    for (let si = 0; si < ring.length - 1; si++) {
      const a = ring[si]; const b = ring[si + 1];
      if (Math.min(a[0], b[0]) - tolDeg > mx || Math.max(a[0], b[0]) + tolDeg < mx) continue;
      if (Math.min(a[1], b[1]) - tolDeg > my || Math.max(a[1], b[1]) + tolDeg < my) continue;
      const A = project(a); const B = project(b);
      const dx = B.x - A.x; const dy = B.y - A.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((mouse.x - A.x) * dx + (mouse.y - A.y) * dy) / len2)) : 0;
      const d = Math.hypot(A.x + dx * t - mouse.x, A.y + dy * t - mouse.y);
      if (d <= maxPx && (!best || d < best.dist)) {
        best = { pi, ri, si, t, dist: d, at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
      }
    }
  }));
  return best;
}

function cloneMulti(m: Multi): Multi {
  return m.map((poly) => poly.map((ring) => ring.map((p) => [p[0], p[1]] as Pt)));
}

/** The outline with corner vi (an index into the open ring) moved to `to`. Not cleaned. */
export function withCornerMoved(m: Multi, pi: number, ri: number, vi: number, to: Pt): Multi {
  const out = cloneMulti(m);
  const ring = out[pi]?.[ri];
  if (!ring) return out;
  const n = ring.length - 1;
  ring[vi] = [to[0], to[1]];
  if (vi === 0) ring[n] = [to[0], to[1]];
  return out;
}

/** The outline with a new corner at `to` after corner si. Not cleaned. */
export function withCornerAdded(m: Multi, pi: number, ri: number, si: number, to: Pt): Multi {
  const out = cloneMulti(m);
  const ring = out[pi]?.[ri];
  if (ring) ring.splice(si + 1, 0, [to[0], to[1]]);
  return out;
}

/** The outline without corner vi, or null when that ring would have fewer than three corners. */
export function withCornerRemoved(m: Multi, pi: number, ri: number, vi: number): Multi | null {
  const out = cloneMulti(m);
  const ring = out[pi]?.[ri];
  if (!ring || ring.length - 1 <= 3) return null;
  const open = ring.slice(0, -1);
  open.splice(vi, 1);
  out[pi][ri] = [...open, [open[0][0], open[0][1]]];
  return out;
}

/**
 * Pulling a detailed outline from one point: the region between the old outline and a "tent" from `to` down
 * to two points on the outline, halfPx either side of the press (measured along the outline on screen).
 * `screen` is the ring's open corners projected once when the press began.
 */
export function tentRegion(ring: Ring, screen: ScreenPt[], hit: EdgeHit, to: Pt, halfPx: number): Ring | null {
  const n = ring.length - 1;
  if (n < 3 || screen.length < n) return null;
  const A = screen[hit.si]; const B = screen[(hit.si + 1) % n];
  const h: ScreenPt = { x: A.x + (B.x - A.x) * hit.t, y: A.y + (B.y - A.y) * hit.t };
  const cap = Math.max(1, Math.floor((n - 2) / 2));
  const walk = (dir: 1 | -1): { pt: Pt; passed: number[] } => {
    let rem = halfPx; let curS = h; let curL: Pt = hit.at;
    let idx = dir === -1 ? hit.si : (hit.si + 1) % n;
    const passed: number[] = [];
    for (let step = 0; step < cap; step++) {
      const vS = screen[idx]; const vL = ring[idx];
      const d = Math.hypot(vS.x - curS.x, vS.y - curS.y);
      if (d >= rem) {
        const f = d > 0 ? rem / d : 0;
        return { pt: [curL[0] + (vL[0] - curL[0]) * f, curL[1] + (vL[1] - curL[1]) * f], passed };
      }
      rem -= d; passed.push(idx); curS = vS; curL = vL;
      idx = (idx + dir + n) % n;
    }
    const last = passed.pop();
    return { pt: last !== undefined ? ring[last] : hit.at, passed };
  };
  const back = walk(-1); const fwd = walk(1);
  const inner: Pt[] = [...back.passed.slice().reverse(), ...fwd.passed].map((i) => ring[i]);
  const coast: Pt[] = [back.pt, ...inner, fwd.pt];   // the old outline from a to b
  return [[to[0], to[1]], ...coast.reverse().map((p) => [p[0], p[1]] as Pt), [to[0], to[1]]];
}

/** The territory after a tent pull: land added when the point went out, land taken when it went in. */
export function applyTent(m: Multi, region: Ring, to: Pt): Multi {
  const piece: Multi = [[region]];
  return pointIn(to, m) ? differenceM(m, piece) : unionM(m, piece);
}

// ─────────── No overlap ───────────

export interface TerritoryShape { id: string; owner: string | null; multi: Multi; bbox: Bbox | null }

/**
 * Cuts `growth` (land a territory just gained) out of every other territory it overlaps, except those held by
 * the same cabinet. Returns only the territories that actually lost land.
 */
export function cutOverlaps(growth: Multi, owner: string | null, others: TerritoryShape[]): Array<{ id: string; multi: Multi; emptied: boolean }> {
  const gb = bboxOf(growth);
  if (!gb || areaOf(growth) <= AREA_EPS) return [];
  const out: Array<{ id: string; multi: Multi; emptied: boolean }> = [];
  // Hair-thin pieces are floating-point dust, not land.
  const land = growth.filter((poly) => areaOf([poly]) > AREA_EPS);
  if (!land.length) return [];
  for (const o of others) {
    if (owner && o.owner === owner) continue;
    if (!o.bbox || !bboxHit(o.bbox, gb) || !o.multi.length) continue;
    const before = areaOf(o.multi);
    const after = differenceM(o.multi, land);
    const left = areaOf(after);
    if (before - left <= AREA_EPS) continue;
    out.push({ id: o.id, multi: after, emptied: left <= AREA_EPS });
  }
  return out;
}

// ─────────── Territory belongs to a cabinet ───────────
// A cabinet's land never overlaps anyone else's. Growing a territory (a new area, a border dragged outward)
// joins it to the cabinet's own land it touches or overlaps and cuts the new ground out of everybody else's.

export interface ClaimTerr extends TerritoryShape { kind: 'country' | 'area' }

export function intersectM(a: Multi, b: Multi): Multi {
  if (!a.length || !b.length) return [];
  return tidy(pc.intersection(a as pcNs.MultiPolygon, b as pcNs.MultiPolygon) as Multi);
}

/** Drops pieces and holes too small to be land (floating-point dust left by clipping). */
export function dropSlivers(m: Multi): Multi {
  const out: Multi = [];
  for (const poly of m) {
    if (!poly[0] || Math.abs(ringArea(poly[0])) <= AREA_EPS) continue;
    out.push([poly[0], ...poly.slice(1).filter((h) => Math.abs(ringArea(h)) > AREA_EPS)]);
  }
  return out;
}

/** True when the two shapes overlap or share an edge (their union is fewer pieces than the two together). */
export function joins(a: Multi, b: Multi): boolean {
  if (!a.length || !b.length) return false;
  const ba = bboxOf(a); const bb = bboxOf(b);
  if (!ba || !bb || !bboxHit(ba, bb)) return false;
  return (pc.union(a as pcNs.MultiPolygon, b as pcNs.MultiPolygon) as Multi).length < a.length + b.length;
}

/** The cabinets (never "nobody") whose territory `land` touches or overlaps. */
export function ownersTouching(land: Multi, others: ClaimTerr[]): string[] {
  const out: string[] = [];
  for (const o of others) {
    if (!o.owner || out.includes(o.owner) || !o.multi.length) continue;
    try { if (joins(land, o.multi)) out.push(o.owner); } catch { /* an unreadable shape touches nothing */ }
  }
  return out;
}

/** The cabinet's own territory a new area builds on: the one it overlaps most, else the first it touches. */
export function pickClaimTarget(land: Multi, owner: string | null, others: ClaimTerr[]): ClaimTerr | null {
  if (!owner) return null;
  let best: ClaimTerr | null = null; let bestScore = -1;
  for (const o of others) {
    if (o.owner !== owner || !o.multi.length) continue;
    let score = -1;
    try { if (joins(land, o.multi)) score = areaOf(intersectM(land, o.multi)); } catch { score = -1; }
    if (score > bestScore) { best = o; bestScore = score; }
  }
  return best;
}

export interface ClaimPlan {
  /** The claiming territory's land afterwards. */
  land: Multi;
  /** Drawn areas of the same cabinet that were joined into it (to be removed). */
  absorbed: string[];
  /** Territories of others that lost land. */
  cuts: Array<{ id: string; multi: Multi; emptied: boolean }>;
  /** The ground that is new to the claimer. */
  gained: Multi;
}

/**
 * `growth` is ground the cabinet `owner` just claimed. With a `target` it is that territory's growth; without one
 * it is a new area. Same-cabinet drawn areas it touches are joined in (when `merge`), same-cabinet countries keep
 * their own land, and everybody else's territory loses what the growth covers.
 */
export function planClaim(growth: Multi, owner: string | null, target: { id: string | null; multi: Multi } | null, others: ClaimTerr[], merge: boolean): ClaimPlan {
  let gained = dropSlivers(growth);
  const rest = others.filter((o) => o.id !== target?.id);
  const mine = owner ? rest.filter((o) => o.owner === owner) : [];
  const theirs = owner ? rest.filter((o) => o.owner !== owner) : rest;
  const gb = bboxOf(gained);
  if (gb) for (const o of mine) {
    if (o.kind === 'country' && o.bbox && bboxHit(o.bbox, gb)) gained = dropSlivers(differenceM(gained, o.multi));
  }
  const base = target?.multi ?? [];
  let result = !gained.length ? base : base.length ? unionM(base, gained) : clean(gained);
  const absorbed: string[] = [];
  if (merge && result.length) {
    let changed = true; let guard = 0;
    while (changed && guard++ < 8) {
      changed = false;
      for (const o of mine) {
        if (o.kind !== 'area' || absorbed.includes(o.id) || !o.multi.length) continue;
        if (joins(result, o.multi)) { result = unionM(result, o.multi); absorbed.push(o.id); changed = true; }
      }
    }
  }
  result = dropSlivers(result);
  const cuts = gained.length ? cutOverlaps(gained, owner, theirs) : [];
  return { land: result, absorbed, cuts, gained };
}

/** Distance in km between two [lng, lat] points (haversine). */
export function kmBetween(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
