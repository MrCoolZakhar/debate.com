'use client';
// Gavelling Crisis: the small animated map of "N changes to the map". Plain SVG drawn from the same world data as the
// still picture (MapSnapshot), but a function of one number `t` (0 to 1) so it can be played, paused, rewound and
// scrubbed like a short video: units glide from where they were to where they are, new ones pop in, removed ones fade
// out, countries blend from one holder's colour to the next, drawn areas morph or fade. The changes start one after the
// other (each has its own share of the timeline) so a long list reads as a sequence, not a blur.
// `t` is set by the dialog; this component only draws. The land is drawn once per view, never per frame.

import { memo, useMemo, type ReactElement } from 'react';
import type { Geometry } from 'geojson';
import type { HistoryChange, LngLat } from '@/lib/crisis/history';
import type { UnitKind } from '@/lib/crisis/types';
import { easeInOut } from '../map/mapAnimate';
import { GLYPH_MARKUP } from '../map/glyphs';
import { LAND, LAND_LINE, SEA, type WorldData } from '../map/mapData';
import { safeColor } from '../map/tokens';
import { CK, Skeleton } from '../../crisisKit';
import { H, R, W, latOf, mainBox, mercY, polysOf, ringBbox, shapePts } from './MapSnapshot';
import type { ChangeCtx } from './changeKit';

const NOBODY = '#6B6256';
/** The share of the whole timeline one change takes to play; the rest is the stagger between the first and the last. */
const SPAN = 0.55;

/** When change `i` of `n` starts (0 to 1 of the timeline). */
export const startOf = (i: number, n: number): number => (n <= 1 ? 0 : (i / (n - 1)) * (1 - SPAN));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** How far along change `i` is at time `t` (eased, 0 to 1). */
export const progressOf = (t: number, i: number, n: number): number => easeInOut(clamp01((t - startOf(i, n)) / SPAN));

interface View { x0: number; x1: number; y0: number; y1: number; k: number }

function viewFor(world: WorldData, changes: HistoryChange[]): View | null {
  const xs: number[] = []; const ys: number[] = [];
  const add = (p: LngLat | null) => { if (p) { xs.push(p[0]); ys.push(mercY(p[1])); } };
  let area = false;
  for (const c of changes) {
    if (c.type === 'unit') { add(c.posFrom); add(c.posTo); }
    else if (c.type === 'shape') {
      area = true;
      for (const g of [c.geomFrom, c.geomTo]) if (g) for (const p of shapePts(g)) add(p);
    } else {
      area = true;
      const b = mainBox(world, c.key);
      if (b) { add([b[0], b[1]]); add([b[2], b[3]]); }
    }
  }
  if (!xs.length) return null;
  let vw = Math.max(Math.max(...xs) - Math.min(...xs), 5);
  let vh = Math.max(Math.max(...ys) - Math.min(...ys), 5 * (H / W));
  const pad = area ? 1.25 : 1.7;
  vw *= pad; vh *= pad;
  if (vw / vh < W / H) vw = vh * (W / H); else vh = vw * (H / W);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { x0: cx - vw / 2, x1: cx + vw / 2, y0: cy - vh / 2, y1: cy + vh / 2, k: W / vw };
}

/** The land under everything: made once for a view, so playing never redraws it. */
const Land = memo(function Land({ world, view }: { world: WorldData; view: View }) {
  const paths = useMemo(() => {
    const { x0, x1, y0, y1, k } = view;
    const latLo = latOf(y0); const latHi = latOf(y1);
    const out: string[] = [];
    for (const f of world.collection.features) {
      let d = '';
      for (const poly of polysOf(f.geometry as Geometry)) {
        const outer = poly[0];
        if (!outer || outer.length < 3) continue;
        const b = ringBbox(outer);
        if (b[2] < x0 || b[0] > x1 || b[3] < latLo || b[1] > latHi) continue;
        for (const ring of poly) {
          ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${((p[0] - x0) * k).toFixed(1)} ${((y1 - mercY(p[1])) * k).toFixed(1)}`; });
          d += 'Z';
        }
      }
      if (d) out.push(d);
    }
    return out;
  }, [world, view]);
  return <>{paths.map((d, i) => <path key={i} d={d} fill={LAND} stroke={LAND_LINE} strokeWidth={0.8} strokeLinejoin="round" />)}</>;
});

interface Prepared {
  c: HistoryChange;
  color: string;
  fromColor: string | null;
  toColor: string | null;
  /** A country's outline as a path. */
  d?: string;
  /** A drawn shape's points, before and after, in picture pixels. */
  ptsFrom?: Array<[number, number]> | null;
  ptsTo?: Array<[number, number]> | null;
  polygon?: boolean;
  from?: [number, number] | null;
  to?: [number, number] | null;
}

const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

function Token({ x, y, kind, color, ghost, scale = 1, opacity = 1, label, hot }: {
  x: number; y: number; kind: string; color: string; ghost?: boolean; scale?: number; opacity?: number; label?: string; hot?: boolean;
}) {
  const glyph = GLYPH_MARKUP[kind as UnitKind] ?? GLYPH_MARKUP.custom;
  const halo = { paintOrder: 'stroke', stroke: '#F5F0E4', strokeWidth: 3, strokeLinejoin: 'round' } as const;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`} opacity={opacity}>
      {hot && <circle r={R + 6} fill="none" stroke={CK.goldDeep} strokeWidth={3} />}
      <circle r={R} fill={ghost ? '#fff' : color} stroke={ghost ? color : '#fff'} strokeWidth={ghost ? 2.2 : 2.5} strokeDasharray={ghost ? '4 3' : undefined} />
      <g transform={`translate(-8 -8) scale(${16 / 24})`} fill="none" stroke={ghost ? color : '#fff'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: glyph }} />
      {label && <text y={R + 15} textAnchor="middle" fontSize={11.5} fontWeight={800} fill={CK.ink} {...halo}>{label}</text>}
    </g>
  );
}

export default function ChangesReplay({ world, changes, ctx, t, hot }: {
  world: WorldData | null; changes: HistoryChange[]; ctx: ChangeCtx;
  /** 0 is how the map was before the send, 1 is how it is now. */
  t: number;
  /** The row the pointer is on: drawn with a ring. */
  hot: string | null;
}) {
  const view = useMemo(() => (world ? viewFor(world, changes) : null), [world, changes]);
  const prepared = useMemo<Prepared[]>(() => {
    if (!world || !view) return [];
    const { x0, y1, k, x1, y0 } = view;
    const latLo = latOf(y0); const latHi = latOf(y1);
    const X = (lng: number) => (lng - x0) * k;
    const Y = (lat: number) => (y1 - mercY(lat)) * k;
    const cab = (id: string | null) => { const c = id ? ctx.cabinets.get(id) : null; return c ? safeColor(c.color) : null; };
    const px = (p: LngLat | null): [number, number] | null => (p ? [X(p[0]), Y(p[1])] : null);
    const ptsOf = (g: { type: string; coordinates: unknown } | null) => (g ? shapePts(g).map((p): [number, number] => [X(p[0]), Y(p[1])]) : null);
    return changes.map((c): Prepared => {
      const fromColor = cab(c.ownerFrom); const toColor = cab(c.ownerTo);
      const color = toColor ?? fromColor ?? NOBODY;
      if (c.type === 'unit') return { c, color, fromColor, toColor, from: px(c.posFrom), to: px(c.posTo) };
      if (c.type === 'shape') {
        const g = c.geomTo ?? c.geomFrom;
        return { c, color, fromColor, toColor, ptsFrom: ptsOf(c.geomFrom), ptsTo: ptsOf(c.geomTo), polygon: g?.type !== 'LineString' && c.shapeKind !== 'line' };
      }
      let d = '';
      const geometry = world.byKey.get(c.key)?.geometry;
      if (geometry) {
        for (const poly of polysOf(geometry)) {
          const outer = poly[0];
          if (!outer || outer.length < 3) continue;
          const b = ringBbox(outer);
          if (b[2] < view.x0 || b[0] > x1 || b[3] < latLo || b[1] > latHi) continue;
          for (const ring of poly) { ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`; }); d += 'Z'; }
        }
      }
      return { c, color, fromColor, toColor, d };
    });
  }, [world, view, changes, ctx.cabinets]);

  if (!world || !view) {
    return <div style={{ aspectRatio: `${W} / ${H}`, borderRadius: 18, overflow: 'hidden' }}><Skeleton h={H} r={0} /></div>;
  }
  const n = prepared.length;
  const shapes: ReactElement[] = [];
  const trails: ReactElement[] = [];
  const tokens: ReactElement[] = [];

  prepared.forEach((p, i) => {
    const e = progressOf(t, i, n);
    const active = e > 0 && e < 1;
    const isHot = hot === p.c.rowId;
    if (p.c.type === 'region') {
      if (!p.d) return;
      if (p.fromColor) shapes.push(<path key={p.c.rowId + 'a'} d={p.d} fill={p.fromColor} fillOpacity={0.4 * (1 - e)} stroke={p.fromColor} strokeOpacity={1 - e} strokeWidth={isHot ? 4 : 2.4} strokeLinejoin="round" />);
      if (p.toColor) shapes.push(<path key={p.c.rowId + 'b'} d={p.d} fill={p.toColor} fillOpacity={0.4 * e} stroke={p.toColor} strokeOpacity={e} strokeWidth={isHot ? 4 : 2.4} strokeLinejoin="round" />);
      return;
    }
    if (p.c.type === 'shape') {
      const from = p.ptsFrom; const to = p.ptsTo;
      const sw = isHot ? 4.4 : 2.4;
      const draw = (key: string, pts: Array<[number, number]>, op: number, ghost?: boolean) => {
        const str = pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
        shapes.push(p.polygon
          ? <polygon key={key} points={str} fill={p.color} fillOpacity={0.28 * op} stroke={p.color} strokeOpacity={op} strokeWidth={sw} strokeDasharray={ghost ? '6 5' : undefined} strokeLinejoin="round" />
          : <polyline key={key} points={str} fill="none" stroke={p.color} strokeOpacity={op} strokeWidth={isHot ? 4.4 : 3.2} strokeDasharray="7 5" />);
      };
      if (from && to && from.length === to.length) draw(p.c.rowId, from.map((q, j) => [lerp(q[0], to[j][0], e), lerp(q[1], to[j][1], e)] as [number, number]), 1);
      else {
        if (from) draw(p.c.rowId + 'f', from, 1 - e, true);
        if (to) draw(p.c.rowId + 't', to, e);
      }
      return;
    }
    // A unit.
    const c = p.c;
    const color = p.color;
    const name = active || isHot ? c.name : undefined;
    if (c.op === 'insert' && p.to) {
      tokens.push(<Token key={c.rowId} x={p.to[0]} y={p.to[1]} kind={c.kind} color={color} scale={0.4 + 0.6 * e} opacity={e} label={name} hot={isHot} />);
    } else if (c.op === 'delete' && p.from) {
      tokens.push(<Token key={c.rowId} x={p.from[0]} y={p.from[1]} kind={c.kind} color={color} scale={1 - 0.5 * e} opacity={1 - e} label={name} hot={isHot} />);
    } else if (c.moved && p.from && p.to) {
      const x = lerp(p.from[0], p.to[0], e); const y = lerp(p.from[1], p.to[1], e);
      trails.push(<line key={c.rowId} x1={p.from[0]} y1={p.from[1]} x2={x} y2={y} stroke={color} strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" opacity={0.75} />);
      tokens.push(<Token key={c.rowId + 'g'} x={p.from[0]} y={p.from[1]} kind={c.kind} color={color} ghost opacity={0.5 * (1 - e) + 0.2} />);
      tokens.push(<Token key={c.rowId} x={x} y={y} kind={c.kind} color={color} label={name} hot={isHot} />);
    } else {
      const at = p.to ?? p.from;
      if (!at) return;
      const pulse = c.strengthChanged || c.ownerChanged ? Math.sin(Math.PI * e) : 0;
      tokens.push(<Token key={c.rowId} x={at[0]} y={at[1]} kind={c.kind} color={color} scale={1 + 0.25 * pulse} label={name} hot={isHot} />);
    }
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The changes to the map, played from before to after" style={{ display: 'block', width: '100%', height: 'auto', background: SEA, borderRadius: 18, fontFamily: CK.font, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.1)' }}>
      <Land world={world} view={view} />
      {shapes}
      {trails}
      {tokens}
    </svg>
  );
}
