'use client';
// Gavelling Crisis map: the fog of war. A canvas sits over the map, filled with a hatch and
// then "cut open" with destination-out around what the viewing cabinet can see: its own
// countries, its own areas and a sight circle around each of its own units. The circle is a true circle on the ground
// (the same distance the database uses to decide who sees a unit), drawn with a soft inner edge and a dashed ring at
// exactly its range, so players see how far their troops can see. Redrawn on every map move.

import type { Map as MLMap } from 'maplibre-gl';
import type { Geometry } from 'geojson';
import type { LngLat } from './mapData';
import { sightPoints } from './sight';

export interface FogHoles {
  geometries: Geometry[];
  rings: LngLat[][];
  /** `ring: false` leaves the dashed ring off one circle (another layer draws it), the fog still opens around it. */
  circles: Array<{ id?: string; lng: number; lat: number; km: number; ring?: boolean }>;
  /** Land held by someone else: tinted and outlined in its holder's colour over the fog, so who holds it is never hidden. */
  owners?: Array<{ geometry: Geometry; fill: string; edge: string }>;
  /** false: no hatch and no holes, only the sight rings (a preview without the fog). Default true. */
  fog?: boolean;
  /** false: the fog is drawn without the dashed sight rings. Default true. */
  showRings?: boolean;
}

type Box = [number, number, number, number];
const boxCache = new WeakMap<object, Box>();

function boxOf(rings: number[][][]): Box {
  let minX = 180; let minY = 90; let maxX = -180; let maxY = -90;
  for (const p of rings[0] ?? []) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  }
  return [minX, minY, maxX, maxY];
}

let tile: { dpr: number; canvas: HTMLCanvasElement } | null = null;
function hatchTile(dpr: number): HTMLCanvasElement {
  if (tile && tile.dpr === dpr) return tile.canvas;
  const s = Math.round(7 * dpr);
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#D9D0BE'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#B5A88C'; g.lineWidth = 2.2 * dpr; g.lineCap = 'square';
    g.beginPath();
    g.moveTo(0, s); g.lineTo(s, 0);
    g.moveTo(-s / 2, s / 2); g.lineTo(s / 2, -s / 2);
    g.moveTo(s / 2, s * 1.5); g.lineTo(s * 1.5, s / 2);
    g.stroke();
  }
  tile = { dpr, canvas: c };
  return c;
}

/** A sight circle as screen points: the ground circle of `km` around the unit, never smaller than 8 px across. */
export function sightRingPx(map: MLMap, c: { lng: number; lat: number; km: number }): Array<{ x: number; y: number }> {
  const centre = map.project([c.lng, c.lat]);
  const pts = sightPoints(c.lng, c.lat, c.km, 72).map((p) => map.project(p));
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p.x - centre.x, p.y - centre.y));
  if (r < 0.5) {
    return Array.from({ length: 25 }, (_, i) => ({ x: centre.x + Math.cos((i / 24) * Math.PI * 2) * 8, y: centre.y + Math.sin((i / 24) * Math.PI * 2) * 8 }));
  }
  if (r >= 8) return pts;
  const k = 8 / r;
  return pts.map((p) => ({ x: centre.x + (p.x - centre.x) * k, y: centre.y + (p.y - centre.y) * k }));
}

/** How far a point of the screen is from a ring of screen points (the nearest bit of the line). */
export function distToRingPx(ring: Array<{ x: number; y: number }>, pt: { x: number; y: number }): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]; const b = ring[i + 1];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(a.x + dx * t - pt.x, a.y + dy * t - pt.y));
  }
  return best;
}

export function drawFog(canvas: HTMLCanvasElement, map: MLMap, holes: FogHoles | null): void {
  const el = map.getContainer();
  const w = el.clientWidth; const h = el.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!holes) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const withFog = holes.fog !== false;
  const bounds = map.getBounds();
  const west = bounds.getWest(); const east = bounds.getEast(); const south = bounds.getSouth(); const north = bounds.getNorth();
  // Tracing a ring and testing it against the view.
  const trace = (rings: number[][][]) => {
    ctx.beginPath();
    for (const ring of rings) {
      let lx = Infinity; let ly = Infinity; let started = false;
      for (const pt of ring) {
        const p = map.project([pt[0], pt[1]]);
        if (started && Math.abs(p.x - lx) < 0.8 && Math.abs(p.y - ly) < 0.8) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        lx = p.x; ly = p.y;
      }
      ctx.closePath();
    }
  };
  const cut = (rings: number[][][]) => {
    const key = rings[0] as unknown as object;
    let b = boxCache.get(key);
    if (!b) { b = boxOf(rings); boxCache.set(key, b); }
    if (b[2] < west || b[0] > east || b[3] < south || b[1] > north) return;
    trace(rings);
    ctx.fill('evenodd');
    ctx.lineWidth = 26; ctx.stroke();
  };

  if (withFog) {
    const pattern = ctx.createPattern(hatchTile(dpr), 'repeat');
    if (!pattern) return;
    pattern.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    ctx.lineJoin = 'round';

    for (const g of holes.geometries) {
      if (g.type === 'Polygon') cut(g.coordinates);
      else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) cut(poly);
    }
    for (const r of holes.rings) cut([r.map((p) => [p[0], p[1]])]);

    // Who holds the land the viewer cannot see into: a tint and an outline over the hatch (the sight circles cut through it).
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round';
    for (const o of holes.owners ?? []) {
      const polys = o.geometry.type === 'Polygon' ? [o.geometry.coordinates] : o.geometry.type === 'MultiPolygon' ? o.geometry.coordinates : [];
      for (const rings of polys) {
        const key = rings[0] as unknown as object;
        let b = boxCache.get(key);
        if (!b) { b = boxOf(rings); boxCache.set(key, b); }
        if (b[2] < west || b[0] > east || b[3] < south || b[1] > north) continue;
        trace(rings);
        ctx.fillStyle = o.fill; ctx.fill('evenodd');
        ctx.lineWidth = 2; ctx.strokeStyle = o.edge; ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'destination-out';
  }

  const seen: Array<{ pts: Array<{ x: number; y: number }>; ring?: boolean }> = [];
  for (const c of holes.circles) {
    const pts = sightRingPx(map, c);
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    if (maxX < 0 || maxY < 0 || minX > w || minY > h) continue;
    if (withFog) {
      // A soft inner edge: three nested cuts, so everything inside the range is clear and the fog thins out at its rim.
      const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
      ctx.fillStyle = '#000';
      for (const [k, a] of [[1, 0.35], [0.97, 0.5], [0.93, 1]]) {
        ctx.globalAlpha = a;
        ctx.beginPath();
        pts.forEach((p, i) => { const x = cx + (p.x - cx) * k; const y = cy + (p.y - cy) * k; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    seen.push({ pts, ring: c.ring });
  }
  // The sight rings, drawn over the cleared fog.
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(142,36,36,0.5)';
  if (holes.showRings !== false) for (const s of seen) {
    if (s.ring === false) continue;
    ctx.beginPath();
    s.pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
}
