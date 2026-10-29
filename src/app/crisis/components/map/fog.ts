'use client';
// Gavelling Crisis map: the fog of war. A canvas sits over the map, filled with a hatch and
// then "cut open" with destination-out around what the viewing cabinet can see: its own
// countries, its own areas and a small sight circle around each of its own units (drawn as a soft
// ring so players see how far their troops can see). Redrawn on every map move.

import type { Map as MLMap } from 'maplibre-gl';
import type { Geometry } from 'geojson';
import type { LngLat } from './mapData';

export interface FogHoles {
  geometries: Geometry[];
  rings: LngLat[][];
  circles: Array<{ id?: string; lng: number; lat: number; km: number }>;
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

    for (const g of holes.geometries) {
      if (g.type === 'Polygon') cut(g.coordinates);
      else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) cut(poly);
    }
    for (const r of holes.rings) cut([r.map((p) => [p[0], p[1]])]);
  }

  const seen: Array<{ x: number; y: number; r: number }> = [];
  for (const c of holes.circles) {
    const p = map.project([c.lng, c.lat]);
    // The radius in km, measured north-south on screen (Mercator grows it towards the poles, like the land).
    const q = map.project([c.lng, Math.min(84, c.lat + c.km / 111.2)]);
    const r = Math.max(8, Math.abs(p.y - q.y));
    if (p.x + r < 0 || p.y + r < 0 || p.x - r > w || p.y - r > h) continue;
    if (withFog) {
      const grad = ctx.createRadialGradient(p.x, p.y, r * 0.84, p.x, p.y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    seen.push({ x: p.x, y: p.y, r });
  }
  // The sight rings, drawn over the cleared fog.
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(142,36,36,0.5)';
  if (holes.showRings !== false) for (const s of seen) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.97, 0, Math.PI * 2); ctx.stroke(); }
  ctx.setLineDash([]);
}
