'use client';
// Gavelling Crisis: a still picture of one change on the map, drawn as plain SVG from the same world data the
// war map uses (no second map engine). It fits the places that matter, shows where a unit WAS (faint, "Before") and
// where it IS (solid, "Now") with an arrow between them, a country in its new owner's colour, or a drawn area. It can be
// zoomed and moved (scroll or pinch, drag, + and -); icons and labels keep their small size however far you zoom.

import { useId, useMemo } from 'react';
import type { Geometry, MultiPolygon, Polygon } from 'geojson';
import type { UnitKind } from '@/lib/crisis/types';
import { GLYPH_MARKUP } from '../map/glyphs';
import { LAND, LAND_LINE, SEA, type LngLat, type WorldData } from '../map/mapData';
import { CK, Skeleton } from '../../crisisKit';
import ZoomSvg, { ZOOM_MARGIN, zoomPt, zoomTransform } from './ZoomSvg';

export interface SnapToken {
  kind: UnitKind; color: string; at: LngLat; ghost?: boolean; label?: string;
  /** A character: the portrait is drawn in the disc (initials on the colour when it has no picture). */
  portrait?: { src: string | null; name: string };
}
export interface SnapCountry { key: string; fill: string; stroke: string; label?: string }
export interface SnapShape { geometry: { type: string; coordinates: unknown }; color: string; ghost?: boolean }
export interface SnapshotSpec {
  tokens: SnapToken[];
  arrow?: { from: LngLat; to: LngLat; color: string };
  countries: SnapCountry[];
  shapes: SnapShape[];
}

export const W = 640;
export const H = 340;
/** The radius of a token's disc: small, so the map stays readable. */
export const R = 11;
/** The size of a token's glyph, and of its label. */
export const GLYPH = 12;
export const LABEL_PX = 9.5;

export const mercY = (lat: number): number => {
  const l = (Math.max(-80, Math.min(80, lat)) * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + l / 2)) * 180) / Math.PI;
};
export const latOf = (y: number): number => ((2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2) * 180) / Math.PI;

export function polysOf(g: Geometry): number[][][][] {
  if (g.type === 'Polygon') return [(g as Polygon).coordinates];
  if (g.type === 'MultiPolygon') return (g as MultiPolygon).coordinates;
  return [];
}

export function ringBbox(ring: number[][]): [number, number, number, number] {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const p of ring) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

const okPt = (p: unknown): p is number[] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const cleanRing = (r: unknown): LngLat[] => (Array.isArray(r) ? r.filter(okPt).map((p) => [p[0], p[1]] as LngLat) : []);

/**
 * Every piece of a stored shape as rings of points: a polygon (its outer ring and holes), a multi-polygon (all its pieces),
 * a line or several lines. A shape that is none of those (or is damaged) answers no rings and is simply not drawn.
 */
export function shapeRings(g: { type: string; coordinates: unknown } | null | undefined): { rings: LngLat[][]; closed: boolean } {
  if (!g || !Array.isArray(g.coordinates)) return { rings: [], closed: false };
  const c = g.coordinates as unknown[];
  let rings: LngLat[][] = []; let closed = false;
  if (g.type === 'Polygon') { rings = c.map(cleanRing); closed = true; }
  else if (g.type === 'MultiPolygon') { rings = c.flatMap((poly) => (Array.isArray(poly) ? (poly as unknown[]).map(cleanRing) : [])); closed = true; }
  else if (g.type === 'LineString') rings = [cleanRing(c)];
  else if (g.type === 'MultiLineString') rings = c.map(cleanRing);
  return { rings: rings.filter((r) => r.length >= 2), closed };
}

/** Points of a stored shape geometry (all its rings, flattened). */
export function shapePts(g: { type: string; coordinates: unknown } | null | undefined): LngLat[] {
  return shapeRings(g).rings.flat();
}

/** The extent of a list of numbers (a loop, not Math.max(...list): a big shape has more points than a call can take). */
export function extent(list: number[]): [number, number] {
  let lo = Infinity; let hi = -Infinity;
  for (const v of list) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/**
 * The frame that fits the places that matter, with a little padding: tight on the changed things (a single move shows a few
 * degrees, not a continent). Longitudes in degrees, latitudes in Mercator degrees; `k` is picture pixels per degree.
 */
export interface FrameBox { x0: number; x1: number; y0: number; y1: number; k: number }
export function frameFor(xs: number[], ys: number[], area: boolean): FrameBox | null {
  if (!xs.length) return null;
  const [xlo, xhi] = extent(xs); const [ylo, yhi] = extent(ys);
  // At least about two degrees across, so one unit's move still shows its surroundings.
  let vw = Math.max(xhi - xlo, 2);
  let vh = Math.max(yhi - ylo, 2 * (H / W));
  const pad = area ? 1.14 : 1.4;
  vw *= pad; vh *= pad;
  if (vw / vh < W / H) vw = vh * (W / H); else vh = vw * (H / W);
  const cx = (xhi + xlo) / 2; const cy = (yhi + ylo) / 2;
  return { x0: cx - vw / 2, x1: cx + vw / 2, y0: cy - vh / 2, y1: cy + vh / 2, k: W / vw };
}

/** The land of a frame and its surroundings (one more picture on every side, so the map can be moved), as paths in picture pixels. */
export function landPaths(world: WorldData, view: FrameBox): string[] {
  const { x0, x1, y0, y1, k } = view;
  const mx = (x1 - x0) * ZOOM_MARGIN; const my = (y1 - y0) * ZOOM_MARGIN;
  const latLo = latOf(y0 - my); const latHi = latOf(y1 + my);
  const out: string[] = [];
  for (const f of world.collection.features) {
    let d = '';
    for (const poly of polysOf(f.geometry as Geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const b = ringBbox(outer);
      if (b[2] < x0 - mx || b[0] > x1 + mx || b[3] < latLo || b[1] > latHi) continue;
      for (const ring of poly) {
        ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${((p[0] - x0) * k).toFixed(1)} ${((y1 - mercY(p[1])) * k).toFixed(1)}`; });
        d += 'Z';
      }
    }
    if (d) out.push(d);
  }
  return out;
}

/** The bounding box of a country's biggest piece (so Russia's far-east islands do not zoom the picture out). */
export function mainBox(world: WorldData, key: string): [number, number, number, number] | null {
  const f = world.byKey.get(key);
  if (!f) return null;
  let best: [number, number, number, number] | null = null; let bestA = -1;
  for (const poly of polysOf(f.geometry)) {
    const b = ringBbox(poly[0] ?? []);
    const a = (b[2] - b[0]) * (b[3] - b[1]);
    if (a > bestA) { bestA = a; best = b; }
  }
  return best;
}

/** A shape's rings as one path in picture pixels (rings are closed when the shape is a polygon). */
export function ringsPath(rings: Array<Array<[number, number]>>, closed: boolean): string {
  let d = '';
  for (const r of rings) {
    r.forEach((p, i) => { d += `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`; });
    if (closed) d += 'Z';
  }
  return d;
}

/** A character's round portrait at the origin of its parent group, in a ring of its cabinet's colour. */
export function PortraitDisc({ r, color, src, name, ghost }: { r: number; color: string; src: string | null; name: string; ghost?: boolean }) {
  const cid = `pd${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ini = name.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  return (
    <g>
      <clipPath id={cid}><circle r={r - 1.2} /></clipPath>
      <circle r={r} fill={src || ghost ? '#fff' : color} />
      {src
        ? <image href={src} x={-r} y={-r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} />
        : <text y={r * 0.34} textAnchor="middle" fontSize={r * 0.95} fontWeight={800} fill={ghost ? color : '#fff'}>{ini}</text>}
      <circle r={r - 1.2} fill="none" stroke={color} strokeWidth={2.2} strokeDasharray={ghost ? '3 2.5' : undefined} />
    </g>
  );
}

/** Shown when a change has nothing to draw (so the pop-up never waits on a picture that cannot come). */
export function NoPicture() {
  return (
    <div className="grid place-items-center" style={{ aspectRatio: `${W} / ${H}`, borderRadius: 18, background: SEA, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.1)' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>There is no picture for this change</span>
    </div>
  );
}

export default function MapSnapshot({ world, spec, label }: { world: WorldData | null; spec: SnapshotSpec; label: string }) {
  const view = useMemo(() => {
    if (!world) return null;
    const xs: number[] = []; const ys: number[] = [];
    const add = (lng: number, lat: number) => { xs.push(lng); ys.push(mercY(lat)); };
    for (const t of spec.tokens) add(t.at[0], t.at[1]);
    for (const sh of spec.shapes) for (const p of shapePts(sh.geometry)) add(p[0], p[1]);
    for (const c of spec.countries) {
      const b = mainBox(world, c.key);
      if (b) { add(b[0], b[1]); add(b[2], b[3]); }
    }
    return frameFor(xs, ys, spec.shapes.length > 0 || spec.countries.length > 0);
  }, [world, spec]);

  const drawn = useMemo(() => {
    if (!world || !view) return null;
    const { x0, x1, y0, y1, k } = view;
    const mx = (x1 - x0) * ZOOM_MARGIN; const my = (y1 - y0) * ZOOM_MARGIN;
    const latLo = latOf(y0 - my); const latHi = latOf(y1 + my);
    const X = (lng: number) => (lng - x0) * k;
    const Y = (lat: number) => (y1 - mercY(lat)) * k;
    const pathOf = (g: Geometry): string => {
      let d = '';
      for (const poly of polysOf(g)) {
        const outer = poly[0];
        if (!outer || outer.length < 3) continue;
        const b = ringBbox(outer);
        if (b[2] < x0 - mx || b[0] > x1 + mx || b[3] < latLo || b[1] > latHi) continue;
        for (const ring of poly) {
          ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`; });
          d += 'Z';
        }
      }
      return d;
    };
    const land = landPaths(world, view);
    const marked = spec.countries.map((c) => {
      const b = mainBox(world, c.key);
      return { c, d: pathOf(world.byKey.get(c.key)?.geometry ?? { type: 'GeometryCollection', geometries: [] }), lx: b ? X((b[0] + b[2]) / 2) : 0, ly: b ? Y((b[1] + b[3]) / 2) : 0 };
    });
    const labels = world.labels
      .filter((l) => l.center[0] > x0 - mx && l.center[0] < x1 + mx && l.center[1] > latLo && l.center[1] < latHi)
      .sort((a, b) => b.area - a.area)
      .slice(0, 12)
      .map((l) => ({ name: l.name, x: X(l.center[0]), y: Y(l.center[1]) }));
    const shapes = spec.shapes.map((sh) => {
      const { rings, closed } = shapeRings(sh.geometry);
      return { sh, closed, d: ringsPath(rings.map((r) => r.map((p): [number, number] => [X(p[0]), Y(p[1])])), closed) };
    });
    const px = (p: LngLat): [number, number] => [X(p[0]), Y(p[1])];
    return { land, marked, labels, shapes, px };
  }, [world, view, spec]);

  if (!world) {
    return <div style={{ aspectRatio: `${W} / ${H}`, borderRadius: 18, overflow: 'hidden' }}><Skeleton h={H} r={0} /></div>;
  }
  if (!view || !drawn) return <NoPicture />;
  const { px } = drawn;
  const halo = { paintOrder: 'stroke', stroke: '#F5F0E4', strokeWidth: 2.4, strokeLinejoin: 'round' } as const;

  return (
    <ZoomSvg w={W} h={H} label={label} style={{ background: SEA, borderRadius: 18, fontFamily: CK.font, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.1)' }}>
      {(z) => {
        const T = (p: [number, number]) => zoomPt(z, p);
        const arrow = spec.arrow ? (() => {
          const [ax, ay] = T(px(spec.arrow.from)); const [bx, by] = T(px(spec.arrow.to));
          const dx = bx - ax; const dy = by - ay; const len = Math.hypot(dx, dy);
          if (len < 2 * R + 12) return null;
          const ux = dx / len; const uy = dy / len;
          const sx = ax + ux * (R + 3); const sy = ay + uy * (R + 3);
          const ex = bx - ux * (R + 9); const ey = by - uy * (R + 9);
          const hx = bx - ux * (R + 2); const hy = by - uy * (R + 2);
          const nx = -uy; const ny = ux;
          return { sx, sy, ex, ey, head: `${hx},${hy} ${ex + nx * 5},${ey + ny * 5} ${ex - nx * 5},${ey - ny * 5}`, color: spec.arrow.color };
        })() : null;
        return (
          <>
            <g transform={zoomTransform(z)}>
              {drawn.land.map((d, i) => <path key={i} d={d} fill={LAND} stroke={LAND_LINE} strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
              {drawn.marked.map(({ c, d }) => d && <path key={c.key} d={d} fill={c.fill} stroke={c.stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
              {drawn.shapes.map(({ sh, d, closed }, i) => (closed
                ? <path key={i} d={d} fillRule="evenodd" fill={sh.color} fillOpacity={sh.ghost ? 0.08 : 0.28} stroke={sh.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray={sh.ghost ? '6 5' : undefined} strokeLinejoin="round" opacity={sh.ghost ? 0.7 : 1} />
                : <path key={i} d={d} fill="none" stroke={sh.color} strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeDasharray="7 5" opacity={sh.ghost ? 0.5 : 1} />))}
            </g>
            {drawn.labels.map((l) => {
              const [x, y] = T([l.x, l.y]);
              return <text key={l.name} x={x} y={y} textAnchor="middle" fontSize={LABEL_PX} fontWeight={700} letterSpacing="0.1em" fill="#8C806C" {...halo}>{l.name.toUpperCase()}</text>;
            })}
            {drawn.marked.map(({ c, lx, ly }) => {
              if (!c.label) return null;
              const [x, y] = T([lx, ly]);
              return <text key={`l${c.key}`} x={x} y={y} textAnchor="middle" fontSize={11} fontWeight={800} letterSpacing="0.08em" fill={CK.ink} {...halo}>{c.label.toUpperCase()}</text>;
            })}
            {arrow && (
              <g>
                <line x1={arrow.sx} y1={arrow.sy} x2={arrow.ex} y2={arrow.ey} stroke={arrow.color} strokeWidth={2.4} strokeDasharray="6 5" strokeLinecap="round" />
                <polygon points={arrow.head} fill={arrow.color} />
              </g>
            )}
            {spec.tokens.map((t, i) => {
              const [x, y] = T(px(t.at));
              const glyph = GLYPH_MARKUP[t.kind] ?? GLYPH_MARKUP.custom;
              if (t.portrait) {
                return (
                  <g key={i} transform={`translate(${x} ${y})`} opacity={t.ghost ? 0.6 : 1}>
                    <PortraitDisc r={R + 2} color={t.color} src={t.portrait.src} name={t.portrait.name} ghost={t.ghost} />
                    {t.label && <text y={R + 14} textAnchor="middle" fontSize={LABEL_PX} fontWeight={800} fill={CK.ink} {...halo}>{t.label}</text>}
                  </g>
                );
              }
              return (
                <g key={i} opacity={t.ghost ? 0.55 : 1}>
                  <circle cx={x} cy={y} r={R} fill={t.ghost ? '#fff' : t.color} stroke={t.ghost ? t.color : '#fff'} strokeWidth={t.ghost ? 1.8 : 2} strokeDasharray={t.ghost ? '3 2.5' : undefined} />
                  <g transform={`translate(${x - GLYPH / 2} ${y - GLYPH / 2}) scale(${GLYPH / 24})`} fill="none" stroke={t.ghost ? t.color : '#fff'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: glyph }} />
                  {t.label && <text x={x} y={y + R + 11} textAnchor="middle" fontSize={LABEL_PX} fontWeight={800} fill={CK.ink} {...halo}>{t.label}</text>}
                </g>
              );
            })}
          </>
        );
      }}
    </ZoomSvg>
  );
}
