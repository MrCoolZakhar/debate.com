// Gavelling Crisis map: turning a path dragged across the map into a short list of corners.
// Pure functions: the path is simplified in screen pixels (so it looks the same at every zoom) and
// the corners are handed back as [lng, lat]. Reused by every place that draws a territory by dragging.

import type { LngLat } from './mapData';

export interface FreePt { x: number; y: number; ll: LngLat }

/** Distance from p to the segment a-b, in pixels. */
function segDist(p: FreePt, a: FreePt, b: FreePt): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Douglas-Peucker on an open path, without recursion. Keeps the first and last point. */
export function simplifyPath(pts: FreePt[], tol: number): FreePt[] {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop() as [number, number];
    let worst = -1; let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist(pts[i], pts[lo], pts[hi]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol && at > 0) {
      keep[at] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

/** Length of the path in pixels. */
export function pathLength(pts: FreePt[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * A dragged path as the corners of a closed shape: simplified until it has at most `max` corners.
 * Answers null when the path is too short or too thin to be a shape (the caller treats it as a click).
 */
export function freehandCorners(path: FreePt[], max = 36): LngLat[] | null {
  if (path.length < 3 || pathLength(path) < 40) return null;
  let tol = 3.2;
  let out = simplifyPath(path, tol);
  while (out.length > max && tol < 400) { tol *= 1.35; out = simplifyPath(path, tol); }
  // The last point often sits on top of the first one: the shape closes by itself.
  if (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < Math.max(6, tol * 1.5)) out = out.slice(0, -1);
  if (out.length < 3) return null;
  return out.map((p) => [round5(p.ll[0]), round5(p.ll[1])] as LngLat);
}
