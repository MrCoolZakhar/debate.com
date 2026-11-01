'use client';
// Gavelling Crisis: the small animated map of "N changes to the map". Plain SVG drawn from the same world data as the
// still picture (MapSnapshot), but a function of one number `t` (0 to 1) so it can be played, paused, rewound and
// scrubbed like a short video: units glide from where they were to where they are, new ones pop in, removed ones fade
// out, countries blend from one holder's colour to the next, drawn areas morph or fade. The changes start one after the
// other (each has its own share of the timeline) so a long list reads as a sequence, not a blur.
// `t` is set by the dialog; this component only draws. The land is drawn once per view, never per frame. Each kind of change has
// its own colour and motion (CATEGORY_COLOR), the frame is tight on what changed, tokens and labels are small, and the map can be
// zoomed and moved (ZoomSvg) without the tokens growing.

import { memo, useMemo, type ReactElement } from 'react';
import type { LngLat } from '@/lib/crisis/history';
import type { UnitKind } from '@/lib/crisis/types';
import { easeInOut, mixHex } from '../map/mapAnimate';
import { GLYPH_MARKUP } from '../map/glyphs';
import { LAND, LAND_LINE, SEA, type WorldData } from '../map/mapData';
import { safeColor } from '../map/tokens';
import { CK, Skeleton } from '../../crisisKit';
import { GLYPH, H, LABEL_PX, NoPicture, PortraitDisc, R, W, frameFor, landPaths, latOf, mainBox, mercY, polysOf, ringBbox, ringsPath, shapePts, shapeRings, type FrameBox } from './MapSnapshot';
import ZoomSvg, { ZOOM_MARGIN, zoomPt, zoomTransform, type Zoom } from './ZoomSvg';
import type { AnyChange, AnyFilter } from './charChange';
import { charPicture, portraitSrc, type ChangeCtx } from './changeKit';

const NOBODY = '#6B6256';
/** The share of the whole timeline one change takes to play; the rest is the stagger between the first and the last. */
const SPAN = 0.55;

/** Each kind of change has its own colour (chips, rings and flashes) and its own motion. */
export const CATEGORY_COLOR: Record<AnyFilter, string> = {
  troops: '#8E2424',     // troops glide along a dashed trail and land with a ring
  borders: '#A8841F',    // borders cross-fade from one holder's colour to the next, with a gold flash along the edge
  areas: '#2F6690',      // areas morph, leaving a faint dashed outline of where they were
  characters: '#5B4A8A', // characters glide on a dotted trail, in a soft halo
};

/** When change `i` of `n` starts (0 to 1 of the timeline). */
export const startOf = (i: number, n: number): number => (n <= 1 ? 0 : (i / (n - 1)) * (1 - SPAN));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** How far along change `i` is at time `t` (eased, 0 to 1). */
export const progressOf = (t: number, i: number, n: number): number => easeInOut(clamp01((t - startOf(i, n)) / SPAN));

function viewFor(world: WorldData, changes: AnyChange[]): FrameBox | null {
  const xs: number[] = []; const ys: number[] = [];
  const add = (p: LngLat | null) => { if (p) { xs.push(p[0]); ys.push(mercY(p[1])); } };
  let area = false;
  for (const c of changes) {
    if (c.type === 'unit' || c.type === 'character') { add(c.posFrom); add(c.posTo); }
    else if (c.type === 'shape') {
      area = true;
      for (const g of [c.geomFrom, c.geomTo]) for (const p of shapePts(g)) add(p);
    } else if (c.type === 'region') {
      area = true;
      const b = mainBox(world, c.key);
      if (b) { add([b[0], b[1]]); add([b[2], b[3]]); }
    }
  }
  return frameFor(xs, ys, area);
}

/** The land under everything: made once for a view, so playing never redraws it (zooming only moves its group). */
const Land = memo(function Land({ world, view }: { world: WorldData; view: FrameBox }) {
  const paths = useMemo(() => landPaths(world, view), [world, view]);
  return <>{paths.map((d, i) => <path key={i} d={d} fill={LAND} stroke={LAND_LINE} strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}</>;
});

type Rings = Array<Array<[number, number]>>;
interface Prepared {
  c: AnyChange;
  color: string;
  fromColor: string | null;
  toColor: string | null;
  /** A country's outline as a path. */
  d?: string;
  /** A drawn shape's rings (picture pixels), before and after. */
  ringsFrom?: Rings | null;
  ringsTo?: Rings | null;
  closed?: boolean;
  from?: [number, number] | null;
  to?: [number, number] | null;
  /** A character's portrait. */
  portrait?: { src: string | null; name: string };
}

const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

function Token({ x, y, kind, color, ghost, scale = 1, opacity = 1, label, hot, portrait }: {
  x: number; y: number; kind: string; color: string; ghost?: boolean; scale?: number; opacity?: number; label?: string; hot?: boolean;
  /** A character: its portrait replaces the unit glyph. */
  portrait?: { src: string | null; name: string };
}) {
  const glyph = GLYPH_MARKUP[kind as UnitKind] ?? GLYPH_MARKUP.custom;
  const halo = { paintOrder: 'stroke', stroke: '#F5F0E4', strokeWidth: 2.4, strokeLinejoin: 'round' } as const;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`} opacity={opacity}>
      {hot && <circle r={R + 5} fill="none" stroke={CK.goldDeep} strokeWidth={2.4} />}
      {portrait ? <PortraitDisc r={R + 2} color={color} src={portrait.src} name={portrait.name} ghost={ghost} /> : (
        <>
          <circle r={R} fill={ghost ? '#fff' : color} stroke={ghost ? color : '#fff'} strokeWidth={ghost ? 1.8 : 2} strokeDasharray={ghost ? '3 2.5' : undefined} />
          <g transform={`translate(${-GLYPH / 2} ${-GLYPH / 2}) scale(${GLYPH / 24})`} fill="none" stroke={ghost ? color : '#fff'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: glyph }} />
        </>
      )}
      {label && <text y={R + (portrait ? 14 : 11)} textAnchor="middle" fontSize={LABEL_PX} fontWeight={800} fill={CK.ink} {...halo}>{label}</text>}
    </g>
  );
}

export default function ChangesReplay({ world, changes, ctx, t, hot }: {
  world: WorldData | null; changes: AnyChange[]; ctx: ChangeCtx;
  /** 0 is how the map was before the send, 1 is how it is now. */
  t: number;
  /** The row the pointer is on: drawn with a ring. */
  hot: string | null;
}) {
  const view = useMemo(() => (world ? viewFor(world, changes) : null), [world, changes]);
  const prepared = useMemo<Prepared[]>(() => {
    if (!world || !view) return [];
    const { x0, y1, k, x1, y0 } = view;
    const mx = (x1 - x0) * ZOOM_MARGIN;
    const latLo = latOf(y0 - (y1 - y0) * ZOOM_MARGIN); const latHi = latOf(y1 + (y1 - y0) * ZOOM_MARGIN);
    const X = (lng: number) => (lng - x0) * k;
    const Y = (lat: number) => (y1 - mercY(lat)) * k;
    const cab = (id: string | null) => { const c = id ? ctx.cabinets.get(id) : null; return c ? safeColor(c.color) : null; };
    const px = (p: LngLat | null): [number, number] | null => (p ? [X(p[0]), Y(p[1])] : null);
    const ringsOf = (g: { type: string; coordinates: unknown } | null): { rings: Rings; closed: boolean } | null => {
      if (!g) return null;
      const r = shapeRings(g);
      return r.rings.length ? { rings: r.rings.map((ring) => ring.map((p): [number, number] => [X(p[0]), Y(p[1])])), closed: r.closed } : null;
    };
    return changes.map((c): Prepared => {
      const fromColor = c.type === 'other' ? null : cab(c.ownerFrom); const toColor = c.type === 'other' ? null : cab(c.ownerTo);
      const color = toColor ?? fromColor ?? NOBODY;
      if (c.type === 'unit') return { c, color, fromColor, toColor, from: px(c.posFrom), to: px(c.posTo) };
      if (c.type === 'character') return { c, color, fromColor, toColor, from: px(c.posFrom), to: px(c.posTo), portrait: { src: portraitSrc(charPicture(c, ctx)), name: c.name } };
      if (c.type === 'shape') {
        const f = ringsOf(c.geomFrom); const g = ringsOf(c.geomTo);
        return { c, color, fromColor, toColor, ringsFrom: f?.rings ?? null, ringsTo: g?.rings ?? null, closed: (g ?? f)?.closed ?? c.shapeKind !== 'line' };
      }
      if (c.type !== 'region') return { c, color, fromColor, toColor };
      let d = '';
      const geometry = world.byKey.get(c.key)?.geometry;
      if (geometry) {
        for (const poly of polysOf(geometry)) {
          const outer = poly[0];
          if (!outer || outer.length < 3) continue;
          const b = ringBbox(outer);
          if (b[2] < x0 - mx || b[0] > x1 + mx || b[3] < latLo || b[1] > latHi) continue;
          for (const ring of poly) { ring.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`; }); d += 'Z'; }
        }
      }
      return { c, color, fromColor, toColor, d };
    });
  }, [world, view, changes, ctx]);

  if (!world) {
    return <div style={{ aspectRatio: `${W} / ${H}`, borderRadius: 18, overflow: 'hidden' }}><Skeleton h={H} r={0} /></div>;
  }
  if (!view) return <NoPicture />;
  const n = prepared.length;

  return (
    <ZoomSvg w={W} h={H} label="The changes to the map, played from before to after" style={{ background: SEA, borderRadius: 18, fontFamily: CK.font, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.1)' }}>
      {(z: Zoom) => {
        const T = (p: [number, number]) => zoomPt(z, p);
        const under: ReactElement[] = [];   // in the zoomed group: borders, areas and trails
        const tokens: ReactElement[] = [];  // moved to their zoomed spot, never scaled

        prepared.forEach((p, i) => {
          const e = progressOf(t, i, n);
          const active = e > 0 && e < 1;
          const isHot = hot === p.c.rowId;
          if (p.c.type === 'region') {
            // Borders: one holder's colour cross-fades into the next, with a gold flash along the edge.
            if (!p.d) return;
            const w = isHot ? 3.6 : 2.2;
            if (p.fromColor) under.push(<path key={p.c.rowId + 'a'} d={p.d} fill={p.fromColor} fillOpacity={0.4 * (1 - e)} stroke={p.fromColor} strokeOpacity={1 - e} strokeWidth={w} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />);
            if (p.toColor) under.push(<path key={p.c.rowId + 'b'} d={p.d} fill={p.toColor} fillOpacity={0.4 * e} stroke={p.toColor} strokeOpacity={e} strokeWidth={w} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />);
            if (active) under.push(<path key={p.c.rowId + 'f'} d={p.d} fill="none" stroke={CATEGORY_COLOR.borders} strokeOpacity={0.9 * Math.sin(Math.PI * e)} strokeWidth={4.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />);
            return;
          }
          if (p.c.type === 'shape') {
            // Areas: the shape morphs from how it was to how it is, leaving a faint dashed outline of where it was.
            const from = p.ringsFrom; const to = p.ringsTo;
            const hue = p.fromColor && p.toColor && p.fromColor !== p.toColor ? mixHex(p.fromColor, p.toColor, e) : p.color;
            const closed = !!p.closed;
            const sw = isHot ? 3.8 : closed ? 2 : 2.6;
            const draw = (key: string, rings: Rings, op: number, ghost?: boolean) => {
              const d = ringsPath(rings, closed);
              under.push(closed
                ? <path key={key} d={d} fillRule="evenodd" fill={hue} fillOpacity={0.28 * op} stroke={hue} strokeOpacity={op} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeDasharray={ghost ? '6 5' : undefined} strokeLinejoin="round" />
                : <path key={key} d={d} fill="none" stroke={hue} strokeOpacity={op} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeDasharray="7 5" />);
            };
            const sameShape = !!from && !!to && from.length === to.length && from.every((r, j) => r.length === to[j].length);
            if (from && to && sameShape) {
              draw(p.c.rowId, from.map((r, j) => r.map((q, m) => [lerp(q[0], to[j][m][0], e), lerp(q[1], to[j][m][1], e)] as [number, number])), 1);
              if (active) under.push(<path key={p.c.rowId + 'g'} d={ringsPath(from, closed)} fill="none" stroke={CATEGORY_COLOR.areas} strokeOpacity={0.4} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeDasharray="3 4" />);
            } else {
              if (from) draw(p.c.rowId + 'f', from, 1 - e, true);
              if (to) draw(p.c.rowId + 't', to, e);
            }
            return;
          }
          if (p.c.type === 'character') {
            // Characters: the portrait glides on a dotted trail, in a soft halo of the character colour.
            const c = p.c;
            const name = active || isHot ? c.name : undefined;
            const portrait = p.portrait;
            if (p.from && p.to) {
              const x = lerp(p.from[0], p.to[0], e); const y = lerp(p.from[1], p.to[1], e);
              under.push(<line key={c.rowId} x1={p.from[0]} y1={p.from[1]} x2={x} y2={y} stroke={CATEGORY_COLOR.characters} strokeWidth={3} strokeDasharray="0.1 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.85} />);
              const [gx, gy] = T(p.from); const [nx, ny] = T([x, y]);
              tokens.push(<Token key={c.rowId + 'g'} x={gx} y={gy} kind="custom" color={p.color} ghost portrait={portrait} opacity={0.5 * (1 - e) + 0.2} />);
              if (active) tokens.push(<circle key={c.rowId + 'h'} cx={nx} cy={ny} r={R + 7} fill={CATEGORY_COLOR.characters} fillOpacity={0.18} />);
              tokens.push(<Token key={c.rowId} x={nx} y={ny} kind="custom" color={p.color} portrait={portrait} label={name} hot={isHot} />);
            } else {
              const at = p.to ?? p.from;
              if (at) { const [ax, ay] = T(at); tokens.push(<Token key={c.rowId} x={ax} y={ay} kind="custom" color={p.color} portrait={portrait} scale={0.4 + 0.6 * e} opacity={e} label={name} hot={isHot} />); }
            }
            return;
          }
          if (p.c.type !== 'unit') return;
          // Troops: a token glides along a dashed trail and lands with a ring; new ones pop in, removed ones fade out.
          const c = p.c;
          const color = p.color;
          const name = active || isHot ? c.name : undefined;
          if (c.op === 'insert' && p.to) {
            const [ax, ay] = T(p.to);
            tokens.push(<Token key={c.rowId} x={ax} y={ay} kind={c.kind} color={color} scale={0.4 + 0.6 * e} opacity={e} label={name} hot={isHot} />);
          } else if (c.op === 'delete' && p.from) {
            const [ax, ay] = T(p.from);
            tokens.push(<Token key={c.rowId} x={ax} y={ay} kind={c.kind} color={color} scale={1 - 0.5 * e} opacity={1 - e} label={name} hot={isHot} />);
          } else if (c.moved && p.from && p.to) {
            const x = lerp(p.from[0], p.to[0], e); const y = lerp(p.from[1], p.to[1], e);
            under.push(<line key={c.rowId} x1={p.from[0]} y1={p.from[1]} x2={x} y2={y} stroke={color} strokeWidth={2.2} strokeDasharray="7 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.8} />);
            const [gx, gy] = T(p.from); const [nx, ny] = T([x, y]); const [ex, ey] = T(p.to);
            tokens.push(<Token key={c.rowId + 'g'} x={gx} y={gy} kind={c.kind} color={color} ghost opacity={0.5 * (1 - e) + 0.2} />);
            tokens.push(<Token key={c.rowId} x={nx} y={ny} kind={c.kind} color={color} label={name} hot={isHot} />);
            if (e > 0.7 && e < 1) tokens.push(<circle key={c.rowId + 'r'} cx={ex} cy={ey} r={R + 3 + 12 * ((e - 0.7) / 0.3)} fill="none" stroke={CATEGORY_COLOR.troops} strokeWidth={2} strokeOpacity={1 - (e - 0.7) / 0.3} />);
          } else {
            const at = p.to ?? p.from;
            if (!at) return;
            const [ax, ay] = T(at);
            const pulse = c.strengthChanged || c.ownerChanged ? Math.sin(Math.PI * e) : 0;
            tokens.push(<Token key={c.rowId} x={ax} y={ay} kind={c.kind} color={color} scale={1 + 0.25 * pulse} label={name} hot={isHot} />);
          }
        });

        return (
          <>
            <g transform={zoomTransform(z)}>
              <Land world={world} view={view} />
              {under}
            </g>
            {tokens}
          </>
        );
      }}
    </ZoomSvg>
  );
}
