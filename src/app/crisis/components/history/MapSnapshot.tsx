'use client';
// Gavelling Crisis: a still picture of one change on the map, drawn as plain SVG from the same world data the
// war map uses (no second map engine, nothing to pan). It fits the places that matter, shows where a unit WAS
// (faint, "Before") and where it IS (solid, "Now") with an arrow between them, a country in its new owner's
// colour, or a drawn area. Read only and non-interactive.

import { useMemo } from 'react';
import type { Geometry, MultiPolygon, Polygon } from 'geojson';
import type { UnitKind } from '@/lib/crisis/types';
import { GLYPH_MARKUP } from '../map/glyphs';
import { LAND, LAND_LINE, SEA, type LngLat, type WorldData } from '../map/mapData';
import { CK, Skeleton } from '../../crisisKit';

export interface SnapToken { kind: UnitKind; color: string; at: LngLat; ghost?: boolean; label?: string }
export interface SnapCountry { key: string; fill: string; stroke: string; label?: string }
export interface SnapShape { geometry: { type: string; coordinates: unknown }; color: string; ghost?: boolean }
export interface SnapshotSpec {
  tokens: SnapToken[];
  arrow?: { from: LngLat; to: LngLat; color: string };
  countries: SnapCountry[];
  shapes: SnapShape[];
}

const W = 640;
const H = 340;
const R = 15;

const mercY = (lat: number): number => {
  const l = (Math.max(-80, Math.min(80, lat)) * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + l / 2)) * 180) / Math.PI;
};
const latOf = (y: number): number => ((2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2) * 180) / Math.PI;

function polysOf(g: Geometry): number[][][][] {
  if (g.type === 'Polygon') return [(g as Polygon).coordinates];
  if (g.type === 'MultiPolygon') return (g as MultiPolygon).coordinates;
  return [];
}

function bboxOf(ring: number[][]): [number, number, number, number] {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const p of ring) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

/** Points of a stored shape geometry (a polygon's outer ring or a line). */
function shapePts(g: { type: string; coordinates: unknown }): LngLat[] {
  const raw = g.type === 'Polygon' ? ((g.coordinates as number[][][])[0] ?? []) : ((g.coordinates as number[][]) ?? []);
  return raw.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1]] as LngLat);
}

/** The bounding box of a country's biggest piece (so Russia's far-east islands do not zoom the picture out). */
function mainBox(world: WorldData, key: string): [number, number, number, number] | null {
  const f = world.byKey.get(key);
  if (!f) return null;
  let best: [number, number, number, number] | null = null; let bestA = -1;
  for (const poly of polysOf(f.geometry)) {
    const b = bboxOf(poly[0] ?? []);
    const a = (b[2] - b[0]) * (b[3] - b[1]);
    if (a > bestA) { bestA = a; best = b; }
  }
  return best;
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
    if (!xs.length) return null;
    const area = spec.shapes.length > 0 || spec.countries.length > 0;
    let vw = Math.max(Math.max(...xs) - Math.min(...xs), 5);
    let vh = Math.max(Math.max(...ys) - Math.min(...ys), 5 * (H / W));
    const pad = area ? 1.25 : 1.7;
    vw *= pad; vh *= pad;
    if (vw / vh < W / H) vw = vh * (W / H); else vh = vw * (H / W);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return { x0: cx - vw / 2, x1: cx + vw / 2, y0: cy - vh / 2, y1: cy + vh / 2, k: W / vw };
  }, [world, spec]);

  const drawn = useMemo(() => {
    if (!world || !view) return null;
    const { x0, x1, y0, y1, k } = view;
    const latLo = latOf(y0); const latHi = latOf(y1);
    const X = (lng: number) => (lng - x0) * k;
    const Y = (lat: number) => (y1 - mercY(lat)) * k;
    const pathOf = (g: Geometry): string => {
      let d = '';
      for (const poly of polysOf(g)) {
        const outer = poly[0];
        if (!outer || outer.length < 3) continue;
        const b = bboxOf(outer);
        if (b[2] < x0 || b[0] > x1 || b[3] < latLo || b[1] > latHi) continue;
        for (const ring of poly) {
          ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`; });
          d += 'Z';
        }
      }
      return d;
    };
    const land: string[] = [];
    for (const f of world.collection.features) {
      const d = pathOf(f.geometry);
      if (d) land.push(d);
    }
    const marked = spec.countries.map((c) => {
      const b = mainBox(world, c.key);
      return { c, d: pathOf(world.byKey.get(c.key)?.geometry ?? { type: 'GeometryCollection', geometries: [] }), lx: b ? X((b[0] + b[2]) / 2) : 0, ly: b ? Y((b[1] + b[3]) / 2) : 0 };
    });
    const labels = world.labels
      .filter((l) => l.center[0] > x0 && l.center[0] < x1 && l.center[1] > latLo && l.center[1] < latHi)
      .sort((a, b) => b.area - a.area)
      .slice(0, 6)
      .map((l) => ({ name: l.name, x: X(l.center[0]), y: Y(l.center[1]) }));
    const shapes = spec.shapes.map((sh) => ({
      sh, pts: shapePts(sh.geometry).map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' '),
    }));
    const px = (p: LngLat): [number, number] => [X(p[0]), Y(p[1])];
    return { land, marked, labels, shapes, px };
  }, [world, view, spec]);

  if (!world || !view || !drawn) {
    return <div style={{ aspectRatio: `${W} / ${H}`, borderRadius: 18, overflow: 'hidden' }}><Skeleton h={H} r={0} /></div>;
  }
  const { px } = drawn;
  const arrow = spec.arrow ? (() => {
    const [ax, ay] = px(spec.arrow.from); const [bx, by] = px(spec.arrow.to);
    const dx = bx - ax; const dy = by - ay; const len = Math.hypot(dx, dy);
    if (len < 2 * R + 14) return null;
    const ux = dx / len; const uy = dy / len;
    const sx = ax + ux * (R + 4); const sy = ay + uy * (R + 4);
    const ex = bx - ux * (R + 12); const ey = by - uy * (R + 12);
    const hx = bx - ux * (R + 3); const hy = by - uy * (R + 3);
    const nx = -uy; const ny = ux;
    return { sx, sy, ex, ey, head: `${hx},${hy} ${ex + nx * 7},${ey + ny * 7} ${ex - nx * 7},${ey - ny * 7}`, color: spec.arrow.color };
  })() : null;
  const halo = { paintOrder: 'stroke', stroke: '#F5F0E4', strokeWidth: 3, strokeLinejoin: 'round' } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ display: 'block', width: '100%', height: 'auto', background: SEA, borderRadius: 18, fontFamily: CK.font, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.1)' }}>
      {drawn.land.map((d, i) => <path key={i} d={d} fill={LAND} stroke={LAND_LINE} strokeWidth={0.8} strokeLinejoin="round" />)}
      {drawn.marked.map(({ c, d }) => d && <path key={c.key} d={d} fill={c.fill} stroke={c.stroke} strokeWidth={2.4} strokeLinejoin="round" />)}
      {drawn.marked.map(({ c, lx, ly }) => c.label && <text key={`l${c.key}`} x={lx} y={ly} textAnchor="middle" fontSize={13} fontWeight={800} letterSpacing="0.08em" fill={CK.ink} {...halo}>{c.label.toUpperCase()}</text>)}
      {drawn.labels.map((l) => (
        <text key={l.name} x={l.x} y={l.y} textAnchor="middle" fontSize={10.5} fontWeight={700} letterSpacing="0.1em" fill="#8C806C" {...halo}>{l.name.toUpperCase()}</text>
      ))}
      {drawn.shapes.map(({ sh, pts }, i) => sh.geometry.type === 'Polygon'
        ? <polygon key={i} points={pts} fill={sh.color} fillOpacity={sh.ghost ? 0.08 : 0.28} stroke={sh.color} strokeWidth={2.4} strokeDasharray={sh.ghost ? '6 5' : undefined} strokeLinejoin="round" opacity={sh.ghost ? 0.7 : 1} />
        : <polyline key={i} points={pts} fill="none" stroke={sh.color} strokeWidth={3.2} strokeDasharray="7 5" opacity={sh.ghost ? 0.5 : 1} />)}
      {arrow && (
        <g>
          <line x1={arrow.sx} y1={arrow.sy} x2={arrow.ex} y2={arrow.ey} stroke={arrow.color} strokeWidth={3.2} strokeDasharray="8 6" strokeLinecap="round" />
          <polygon points={arrow.head} fill={arrow.color} />
        </g>
      )}
      {spec.tokens.map((t, i) => {
        const [x, y] = px(t.at);
        const glyph = GLYPH_MARKUP[t.kind] ?? GLYPH_MARKUP.custom;
        return (
          <g key={i} opacity={t.ghost ? 0.55 : 1}>
            <circle cx={x} cy={y} r={R} fill={t.ghost ? '#fff' : t.color} stroke={t.ghost ? t.color : '#fff'} strokeWidth={t.ghost ? 2.2 : 2.5} strokeDasharray={t.ghost ? '4 3' : undefined} />
            <g transform={`translate(${x - 8} ${y - 8}) scale(${16 / 24})`} fill="none" stroke={t.ghost ? t.color : '#fff'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: glyph }} />
            {t.label && <text x={x} y={y + R + 15} textAnchor="middle" fontSize={11.5} fontWeight={800} fill={CK.ink} {...halo}>{t.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
