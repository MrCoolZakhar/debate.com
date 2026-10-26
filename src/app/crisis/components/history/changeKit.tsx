'use client';
// Gavelling Crisis: how a map change is told. One typed change (src/lib/crisis/history.ts parseChange) becomes
// a plain title, a few detail lines (numbers and owners with a real arrow icon, never "->" text), an icon and
// colour, and the spec for the still map picture. The history page, the notification pop-up and the change
// pop-up all read it, so a change looks the same everywhere.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUp, Flag, MapPinOff, MapPinPlus, MoveUpRight, PenTool, TrendingDown, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { Cabinet } from '@/lib/crisis/types';
import type { HistoryChange } from '@/lib/crisis/history';
import { amount } from '@/lib/crisis/format';
import { CK, cabinetTint } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { loadWorldData, type WorldData } from '../map/mapData';
import { safeColor } from '../map/tokens';
import type { SnapshotSpec } from './MapSnapshot';

const NOBODY = '#6B6256';
const AREA_BLUE = '#2F6690';

export function useWorld(): WorldData | null {
  const [w, setW] = useState<WorldData | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadWorldData().then((x) => { if (!cancelled) setW(x); }).catch(() => { /* names fall back to "a country" */ });
    return () => { cancelled = true; };
  }, []);
  return w;
}

export interface ChangeCtx { cabinets: Map<string, Cabinet>; world: WorldData | null }

export function useChangeCtx(): ChangeCtx {
  const { core } = useCrisis();
  const world = useWorld();
  const cabinets = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);
  return useMemo(() => ({ cabinets, world }), [cabinets, world]);
}

export type Piece =
  | { t: 'text'; s: string }
  | { t: 'num'; from: number | null; to: number | null }
  | { t: 'owner'; from: string | null; to: string | null }
  | { t: 'who'; id: string | null };

export interface Described {
  Icon: LucideIcon;
  color: string;
  title: string;
  kindLabel: string;
  lines: Piece[][];
}

const countryName = (ctx: ChangeCtx, key: string) => ctx.world?.byKey.get(key)?.name ?? 'A country';
const km = (v: number) => (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v)).toLocaleString('en-US');

export function describe(c: HistoryChange, ctx: ChangeCtx): Described {
  if (c.noBefore) {
    // An older row: say what it looked like after the change, without inventing a "from".
    const held: Piece[] = c.ownerTo ? [{ t: 'text', s: 'Held by' }, { t: 'who', id: c.ownerTo }] : [];
    if (c.type === 'region') return { Icon: Flag, color: CK.goldDeep, kindLabel: 'Territory', title: `${countryName(ctx, c.key)} changed`, lines: held.length ? [held] : [] };
    if (c.type === 'shape') return { Icon: PenTool, color: AREA_BLUE, kindLabel: 'Area on the map', title: `${c.label ?? 'An area'} changed`, lines: held.length ? [held] : [] };
    const lines: Piece[][] = [];
    if (c.strengthTo !== null) lines.push([{ t: 'text', s: 'Strength now' }, { t: 'num', from: null, to: c.strengthTo }]);
    if (held.length) lines.push(held);
    return { Icon: MoveUpRight, color: CK.red, kindLabel: 'Troops', title: `${c.name} changed`, lines };
  }
  if (c.type === 'region') {
    return {
      Icon: Flag, color: CK.goldDeep, kindLabel: 'Territory', title: `${countryName(ctx, c.key)} changed hands`,
      lines: [[{ t: 'owner', from: c.ownerFrom, to: c.ownerTo }]],
    };
  }
  if (c.type === 'shape') {
    const label = c.label ?? (c.shapeKind === 'line' ? 'Unnamed line' : 'Unnamed area');
    const noun = c.shapeKind === 'line' ? 'line' : 'area';
    const ownerChanged = c.ownerFrom !== c.ownerTo;
    const lines: Piece[][] = [];
    let title: string;
    if (c.op === 'insert') {
      title = `New ${noun} drawn: ${label}`;
      if (c.ownerTo) lines.push([{ t: 'text', s: 'Held by' }, { t: 'who', id: c.ownerTo }]);
    } else if (c.op === 'delete') {
      title = `${noun === 'line' ? 'Line' : 'Area'} removed: ${label}`;
    } else if (c.geometryChanged) {
      title = `${noun === 'line' ? 'Line' : 'Area'} changed: ${label}`;
      if (ownerChanged) lines.push([{ t: 'owner', from: c.ownerFrom, to: c.ownerTo }]);
    } else if (ownerChanged) {
      title = `${label} changed hands`;
      lines.push([{ t: 'owner', from: c.ownerFrom, to: c.ownerTo }]);
    } else {
      title = `${noun === 'line' ? 'Line' : 'Area'} updated: ${label}`;
    }
    return { Icon: PenTool, color: AREA_BLUE, kindLabel: 'Area on the map', title, lines };
  }
  // A unit.
  const lines: Piece[][] = [];
  let title: string; let Icon: LucideIcon = MoveUpRight; let color: string = CK.red;
  const up = c.strengthFrom !== null && c.strengthTo !== null && c.strengthTo > c.strengthFrom;
  if (c.op === 'insert') {
    title = `New on the map: ${c.name}`; Icon = MapPinPlus;
    if (c.strengthTo !== null) lines.push([{ t: 'text', s: 'Strength' }, { t: 'num', from: null, to: c.strengthTo }]);
    if (c.ownerTo) lines.push([{ t: 'text', s: 'Held by' }, { t: 'who', id: c.ownerTo }]);
  } else if (c.op === 'delete') {
    title = `${c.name} was removed from the map`; Icon = MapPinOff;
  } else {
    if (c.moved && c.bearing) title = `${c.name} moved ${km(c.moveKm)} km ${c.bearing}`;
    else if (c.moved) title = `${c.name} moved`;
    else if (c.strengthChanged) { title = `${c.name} ${up ? 'grew' : 'lost strength'}`; Icon = up ? TrendingUp : TrendingDown; color = up ? CK.ok : CK.danger; }
    else if (c.ownerChanged) { title = `${c.name} changed hands`; Icon = Flag; color = CK.goldDeep; }
    else if (c.nameFrom && c.nameFrom !== c.name) title = `${c.nameFrom} was renamed ${c.name}`;
    else title = `${c.name} was updated`;
    if (c.strengthChanged) lines.push([{ t: 'text', s: 'Strength' }, { t: 'num', from: c.strengthFrom, to: c.strengthTo }]);
    if (c.ownerChanged) lines.push([{ t: 'owner', from: c.ownerFrom, to: c.ownerTo }]);
  }
  return { Icon, color, kindLabel: c.moved || c.op === 'insert' ? 'Troop movement' : 'Troops', title, lines };
}

// ─────────── Drawing the pieces ───────────

export function CabinetChip({ id, ctx }: { id: string | null; ctx: ChangeCtx }) {
  const cab = id ? ctx.cabinets.get(id) : null;
  const color = cab ? safeColor(cab.color) : NOBODY;
  return (
    <span className="inline-flex items-center" style={{ gap: 5, fontWeight: 800, color: cab ? CK.ink : CK.muted, background: cab ? cabinetTint(color, 0.12) : CK.well, borderRadius: 8, padding: '1px 8px 1px 6px', overflowWrap: 'anywhere' }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} />
      {cab ? (cab.short_name || cab.name) : 'Nobody'}
    </span>
  );
}

export function PieceLine({ pieces, ctx }: { pieces: Piece[]; ctx: ChangeCtx }) {
  const arrow = <ArrowRight size={14} strokeWidth={1.8} aria-label="to" style={{ flex: 'none', color: CK.muted }} />;
  const out: ReactNode[] = pieces.map((p, i) => {
    if (p.t === 'text') return <span key={i}>{p.s}</span>;
    if (p.t === 'who') return <CabinetChip key={i} id={p.id} ctx={ctx} />;
    if (p.t === 'owner') return (
      <span key={i} className="inline-flex items-center flex-wrap" style={{ gap: 6 }}>
        <CabinetChip id={p.from} ctx={ctx} />{arrow}<CabinetChip id={p.to} ctx={ctx} />
      </span>
    );
    const dir = p.from !== null && p.to !== null ? (p.to > p.from ? 1 : p.to < p.from ? -1 : 0) : 0;
    return (
      <span key={i} className="inline-flex items-center" style={{ gap: 6, fontWeight: 800, color: CK.ink, fontVariantNumeric: 'tabular-nums' }}>
        {p.from !== null && <>{amount(p.from)}{arrow}</>}
        {p.to !== null ? amount(p.to) : ''}
        {dir !== 0 && (dir > 0
          ? <ArrowUp size={15} strokeWidth={2} aria-label="up" style={{ color: CK.ok }} />
          : <ArrowDown size={15} strokeWidth={2} aria-label="down" style={{ color: CK.danger }} />)}
      </span>
    );
  });
  return <span className="inline-flex items-center flex-wrap" style={{ gap: '3px 8px', fontSize: 13.5, color: CK.inkSoft }}>{out}</span>;
}

/** The disc a change carries in a list or a pop-up. */
export function ChangeDisc({ d, size = 38 }: { d: Described; size?: number }) {
  const I = d.Icon;
  return (
    <span className="flex-shrink-0 grid place-items-center" aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: d.color, color: '#fff', boxShadow: CK.shadowSm }}>
      <I size={Math.round(size * 0.5)} strokeWidth={1.6} />
    </span>
  );
}

// ─────────── The picture ───────────

export function snapshotSpec(c: HistoryChange, ctx: ChangeCtx, opts: { reveal?: boolean } = {}): SnapshotSpec {
  const cabColor = (id: string | null) => { const cab = id ? ctx.cabinets.get(id) : null; return cab ? safeColor(cab.color) : NOBODY; };
  if (c.type === 'region') {
    const col = cabColor(c.ownerTo);
    return {
      tokens: [], shapes: [],
      countries: [{ key: c.key, fill: c.ownerTo ? cabinetTint(col, 0.5) : 'rgba(107,98,86,0.28)', stroke: col, label: ctx.world?.byKey.get(c.key)?.name }],
    };
  }
  if (c.type === 'shape') {
    const col = cabColor(c.ownerTo ?? c.ownerFrom);
    const shapes: SnapshotSpec['shapes'] = [];
    if (c.geomFrom && c.geomTo && c.geometryChanged) shapes.push({ geometry: c.geomFrom, color: col, ghost: true });
    const g = c.geomTo ?? c.geomFrom;
    if (g) shapes.push({ geometry: g, color: col, ghost: c.op === 'delete' });
    return { tokens: [], countries: [], shapes };
  }
  const col = cabColor(c.ownerTo ?? c.ownerFrom);
  if (opts.reveal) {
    const at = c.posTo ?? c.posFrom;
    return { tokens: at ? [{ kind: c.kind, color: col, at, label: c.name }] : [], countries: [], shapes: [] };
  }
  if (c.op === 'delete') {
    return { tokens: c.posFrom ? [{ kind: c.kind, color: col, at: c.posFrom, ghost: true, label: 'Removed' }] : [], countries: [], shapes: [] };
  }
  if (c.moved && c.posFrom && c.posTo) {
    return {
      tokens: [{ kind: c.kind, color: col, at: c.posFrom, ghost: true, label: 'Before' }, { kind: c.kind, color: col, at: c.posTo, label: 'Now' }],
      arrow: { from: c.posFrom, to: c.posTo, color: col }, countries: [], shapes: [],
    };
  }
  const at = c.posTo ?? c.posFrom;
  return { tokens: at ? [{ kind: c.kind, color: col, at, label: c.op === 'insert' ? 'New' : undefined }] : [], countries: [], shapes: [] };
}
