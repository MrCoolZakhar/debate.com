'use client';
// Gavelling Crisis: the map.
// A real-world map drawn offline (Natural Earth 50m through world-atlas) with MapLibre GL and a blank
// style: no tile server, no glyph server, no third-party request. A territory is a country (held by a
// cabinet, with an outline this crisis may have changed) or a drawn area. Staff with map power select a
// territory and drag its outline; land it grows over is cut out of every other side's territory
// (src/lib/crisis/geo.ts), so two sides never hold the same ground. Units are round tokens, characters are
// portraits (staff only), and the fog of war is a hatched canvas with a small sight circle around each of
// the viewing cabinet's units. Every change is saved through src/lib/crisis/api.ts and logged by the database.

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GeoJSONSource, Map as MLMap, MapMouseEvent, Marker as MLMarker } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Cloud, Flag, Maximize2, MousePointer2, Plus, Ship, UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { readMapFocus, type MapFocus } from '@/lib/crisis/mapFocus';
import {
  crisisError, deleteShape, deleteUnit, loadMap, saveRegionGeometries, saveShape, saveUnit, setRegionOwner,
} from '@/lib/crisis/api';
import {
  AREA_EPS, HANDLE_LIMIT, applyTent, areaOf, bboxOf, clean, cutOverlaps, differenceM, kmBetween, labelPoint, nearestEdge, pointIn,
  tentRegion, toGeometry, toMulti, vertexCount, withCornerAdded, withCornerMoved, withCornerRemoved,
  type Bbox, type EdgeHit, type Multi, type Pt, type ScreenPt, type TerritoryShape,
} from '@/lib/crisis/geo';
import { useCrisisLive } from '@/lib/crisis/live';
import type { MapRegion, MapShape, MapUnit, RegionGeometry, UnitKind } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, CK, Segmented, cabinetTint } from '../../crisisKit';
import { drawFog, type FogHoles } from './fog';
import {
  KIND_META, centroidOf, clampLat, clampLng, loadWorldData, shapePoints, type CountryLabel, type LngLat, type WorldData,
} from './mapData';
import {
  BLANK_STYLE, DRAFT, L_LAND, L_SHAPE_FILL, NOBODY, SRC_COUNTRIES, SRC_DRAFT, SRC_EDIT, SRC_HOVER, SRC_SEL, SRC_SHAPES,
  editLayers, mapLayers,
} from './mapStyle';
import {
  CharacterCard, KindPicker, NewTerritoryPanel, PlaceUnitPanel, TerritoryCard, UnitEditor, UnitViewer, type PanelCabinet, type UnitDraft,
} from './MapPanels';
import {
  MAP_CSS, makeCorner, makeCountryLabel, makeGhost, makeMidpoint, makeShapeLabel, makeVertex, paintCharacter, paintToken, safeColor,
} from './tokens';

type Tool = 'select' | 'borders' | 'unit';
type MapData = { regions: MapRegion[]; units: MapUnit[]; shapes: MapShape[] };
type TerrRef = { kind: 'country'; key: string } | { kind: 'area'; id: string };

/** A new territory being drawn with the Borders tool. */
interface Draft {
  sid: number;
  phase: 'draw' | 'refine';
  points: LngLat[];
  owner: string | null;
}

interface PendingMove { id: string; name: string; lng: number; lat: number }

/** A press on a selected territory's outline, while it is being dragged. */
interface OutlineDrag {
  terr: TerrRef;
  base: Multi;
  hit: EdgeHit;
  /** 'tent' bends a detailed outline from the pressed point; 'corner' adds a corner on a simple one. */
  mode: 'tent' | 'corner';
  screen: ScreenPt[];
  start: ScreenPt;
  to: Pt | null;
  moved: boolean;
}

/** Everything one save changes (and, the other way round, what its Undo puts back). */
interface EditSet {
  regions: Array<{ key: string; owner_cabinet_id: string | null; geometry: RegionGeometry | null }>;
  shapes: Array<{ id: string; geometry: MapShape['geometry'] }>;
  owners: Array<{ id: string; owner_cabinet_id: string | null }>;
  removeShapes: string[];
  addShapes: MapShape[];
}
const emptySet = (): EditSet => ({ regions: [], shapes: [], owners: [], removeShapes: [], addShapes: [] });

interface UndoChip { sid: number; text: string; note: string | null; restore: () => void }

type PressEvent = { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: Event; preventDefault: () => void };

interface Live {
  onMapClick: (e: MapMouseEvent) => void;
  onMapDblClick: (e: MapMouseEvent) => void;
  onPress: (e: PressEvent) => void;
  onPointerMove: (e: PressEvent) => void;
  onRelease: () => void;
  onUnitClick: (id: string) => void;
  onCharClick: (id: string) => void;
  onUnitMoved: (id: string, lng: number, lat: number) => void;
  redrawFog: () => void;
  escape: () => void;
}

const MIN_POINTS = 3;
const EDGE_PX = 12;
const emptyFc: FeatureCollection = { type: 'FeatureCollection', features: [] };

function round5(n: number): number { return Math.round(n * 1e5) / 1e5; }

/** The new-territory preview: filled and outlined in the owner's colours, exactly like that cabinet's countries. */
function draftFc(pts: LngLat[], color: string | null): FeatureCollection {
  if (pts.length < 2) return emptyFc;
  const props = color ? { tint: cabinetTint(color, 0.27), edge: cabinetTint(color, 0.95) } : {};
  const f: Feature = pts.length >= 3
    ? { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } }
    : { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: pts } };
  return { type: 'FeatureCollection', features: [f] };
}

function multiFc(m: Multi, tint?: string | null): FeatureCollection {
  if (!m.length) return emptyFc;
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: tint ? { tint } : {}, geometry: toGeometry(m) as unknown as Geometry }] };
}

/** Territory takes its owner's colour, so it reads as the cabinet's border; a line may carry its own. */
function shapeColor(s: MapShape, cabById: Map<string, PanelCabinet>): string {
  const owner = s.owner_cabinet_id ? cabById.get(s.owner_cabinet_id)?.color : undefined;
  return safeColor(s.kind === 'area' ? owner ?? s.color ?? NOBODY : s.color ?? owner ?? DRAFT);
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The outline a crisis stored for a country: undefined when it uses the world map's own. */
function storedOutline(d: MapData, key: string): Multi | undefined {
  const g = d.regions.find((r) => r.region_key === key)?.geometry;
  return g ? toMulti(g) : undefined;
}

function applyLocal(d: MapData, s: EditSet, crisisId: string): MapData {
  let regions = d.regions;
  for (const r of s.regions) {
    regions = regions.some((x) => x.region_key === r.key)
      ? regions.map((x) => (x.region_key === r.key ? { ...x, owner_cabinet_id: r.owner_cabinet_id, geometry: r.geometry } : x))
      : [...regions, { crisis_id: crisisId, region_key: r.key, owner_cabinet_id: r.owner_cabinet_id, geometry: r.geometry }];
  }
  const geo = new Map(s.shapes.map((x) => [x.id, x.geometry]));
  const own = new Map(s.owners.map((x) => [x.id, x.owner_cabinet_id]));
  const shapes = d.shapes
    .filter((x) => !s.removeShapes.includes(x.id))
    .map((x) => {
      let y = x;
      if (geo.has(x.id)) y = { ...y, geometry: geo.get(x.id) as MapShape['geometry'] };
      if (own.has(x.id)) y = { ...y, owner_cabinet_id: own.get(x.id) ?? null };
      return y;
    });
  return { ...d, regions, shapes: [...shapes, ...s.addShapes] };
}

/** Saves an edit set; answers the ids the database gave the added shapes, in order. */
async function saveSet(ref: Parameters<typeof saveShape>[0], s: EditSet): Promise<string[]> {
  await saveRegionGeometries(ref, s.regions);
  for (const x of s.shapes) await saveShape(ref, { id: x.id, geometry: x.geometry });
  for (const x of s.owners) await saveShape(ref, { id: x.id, owner_cabinet_id: x.owner_cabinet_id });
  for (const id of s.removeShapes) await deleteShape(ref, id);
  const ids: string[] = [];
  for (const a of s.addShapes) {
    ids.push(await saveShape(ref, {
      kind: a.kind, owner_cabinet_id: a.owner_cabinet_id, label: a.label, color: a.color, geometry: a.geometry, public: a.public, revealed_to: a.revealed_to,
    }));
  }
  return ids;
}

/** The Undo chip's small note when an edit swallowed a territory whole. */
function goneNote(gone: string[]): string | null {
  return gone.length ? `${gone.join(', ')} ${gone.length === 1 ? 'was' : 'were'} fully taken` : null;
}

function areaGeometry(m: Multi): MapShape['geometry'] {
  return toGeometry(m) as MapShape['geometry'];
}

export default function WarMap({ compact = false, title, actions }: { compact?: boolean; title?: ReactNode; actions?: ReactNode }) {
  const v = useCrisis();
  const { ref, cabinetId, staff, director, settings, core } = v;
  const canMap = staff && (director || settings.backroomPowers.map);
  const canUnits = staff && (director || settings.backroomPowers.units);

  const cabinets = useMemo<PanelCabinet[]>(
    () => core.cabinets.map((c) => ({ id: c.id, name: c.name, short: c.short_name || c.name, color: safeColor(c.color) })),
    [core.cabinets],
  );
  const cabById = useMemo(() => new Map(cabinets.map((c) => [c.id, c])), [cabinets]);

  // ── data ──
  const [data, setData] = useState<MapData | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const writes = useRef(0);
  const seq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [last, setLast] = useState<{ at: number; text: string } | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const d = await loadMap(ref);
      if (mine !== seq.current || writes.current > 0) return;
      setData(d);
      setLoadError(null);
    } catch (e) {
      if (mine === seq.current) setLoadError(crisisError(e, 'Could not load the map.'));
    }
  }, [ref]);

  useEffect(() => { void reload(); }, [reload]);

  useCrisisLive(ref.id, ['crisis_map_regions', 'crisis_units', 'crisis_shapes', 'crisis_cabinets'], (changed, pings) => {
    const p = pings[pings.length - 1];
    if (p) {
      let text = '';
      if (p.t === 'crisis_units') {
        const name = dataRef.current?.units.find((u) => u.id === p.id)?.name;
        text = p.op === 'insert' ? 'A unit was added' : p.op === 'delete' ? `${name ?? 'A unit'} was removed` : `${name ?? 'A unit'} was updated`;
      } else if (p.t === 'crisis_map_regions') text = 'A border changed';
      else if (p.t === 'crisis_shapes') text = 'A territory or line changed';
      if (text) setLast({ at: new Date().getTime(), text });
    }
    if (changed === null || changed.size) void reload();
  });

  /** Runs a save while holding back live re-reads, then re-reads so the screen shows the database. */
  const run = useCallback(async (fn: () => Promise<void>) => {
    writes.current += 1;
    setBusy(true);
    try { await fn(); } finally {
      writes.current -= 1;
      if (writes.current === 0) setBusy(false);
      void reload();
    }
  }, [reload]);

  // ── the world ──
  const [world, setWorld] = useState<WorldData | null>(null);
  /** Every base country as polygons with its bounding box, made once. */
  const baseShapes = useMemo(() => {
    const m = new Map<string, { multi: Multi; bbox: Bbox | null }>();
    if (!world) return m;
    for (const [key, c] of world.byKey) {
      const multi = toMulti(c.geometry as { type: string; coordinates: unknown });
      m.set(key, { multi, bbox: bboxOf(multi) });
    }
    return m;
  }, [world]);
  const baseRef = useRef(baseShapes);
  useEffect(() => { baseRef.current = baseShapes; }, [baseShapes]);

  /** Countries whose outline this crisis changed (an empty list: all their land was taken). */
  const overrides = useMemo(() => {
    const m = new Map<string, Multi>();
    for (const r of data?.regions ?? []) if (r.geometry) m.set(r.region_key, toMulti(r.geometry));
    return m;
  }, [data]);

  const countryMulti = useCallback((key: string): Multi => overrides.get(key) ?? baseShapes.get(key)?.multi ?? [], [overrides, baseShapes]);

  // ── view ──
  const [viewAs, setViewAs] = useState<string>('all');
  const [fogOn, setFogOn] = useState(true);
  const [charsOn, setCharsOn] = useState(true);
  const staffViewer = viewAs !== 'all' && cabById.has(viewAs) ? viewAs : null;
  const viewer: string | null = staff ? staffViewer : cabinetId;
  const fogActive = !!viewer && (staff && !compact ? fogOn : true);

  // What the viewer sees. A delegate gets only what the database lets their cabinet see (its own units, units
  // shown to it, and any unit inside one of its sight circles). Staff looking as a cabinet get the same rule here.
  const shownUnits = useMemo(() => {
    const all = data?.units ?? [];
    if (!staff || !viewer) return all;
    const own = all.filter((u) => u.owner_cabinet_id === viewer);
    return all.filter((u) => u.owner_cabinet_id === viewer || u.revealed_to.includes(viewer)
      || own.some((o) => kmBetween([o.lng, o.lat], [u.lng, u.lat]) <= KIND_META[o.kind].sight));
  }, [data, viewer, staff]);

  const shownShapes = useMemo(
    () => (data?.shapes ?? []).filter((s) => !viewer || s.public || s.owner_cabinet_id === viewer || s.revealed_to.includes(viewer)),
    [data, viewer],
  );

  // ── tools and selection ──
  const [tool, setTool] = useState<Tool>('select');
  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [selTerr, setSelTerr] = useState<TerrRef | null>(null);
  const [selChar, setSelChar] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<UnitKind | null>(null);
  const [newUnit, setNewUnit] = useState<{ lng: number; lat: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const unitMarkers = useRef(new Map<string, { marker: MLMarker; el: HTMLElement; sig: string }>());
  const charMarkers = useRef(new Map<string, { marker: MLMarker; el: HTMLElement; sig: string }>());
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const pendingMoveRef = useRef<PendingMove | null>(null);
  const dragRef = useRef<OutlineDrag | null>(null);
  const suppressClickUntil = useRef(0);

  // New units and territory go to the cabinet being viewed, else the first cabinet.
  const defaultOwner = viewer ?? cabinets[0]?.id ?? null;

  const setPending = useCallback((p: PendingMove | null) => {
    pendingMoveRef.current = p;
    setPendingMove(p);
  }, []);

  /** Puts a dragged unit back where the database has it. */
  const cancelMove = useCallback(() => {
    const p = pendingMoveRef.current;
    if (!p) return;
    const u = dataRef.current?.units.find((x) => x.id === p.id);
    const mk = unitMarkers.current.get(p.id);
    if (u && mk) mk.marker.setLngLat([u.lng, u.lat]);
    setPending(null);
  }, [setPending]);

  const clearSelection = useCallback(() => { setSelUnit(null); setSelTerr(null); setSelChar(null); }, []);

  const changeTool = useCallback((t: Tool) => {
    cancelMove();
    setTool(t);
    clearSelection();
    setNewUnit(null); setAddKind(null); setDraft(null);
  }, [cancelMove, clearSelection]);

  const changeView = useCallback((val: string) => { setViewAs(val); }, []);

  // Staff can still add units and change borders while looking through a cabinet's eyes.
  const editable = staff && !compact;
  const canEditTerr = editable && canMap && tool !== 'unit' && !draft;

  // The selected territory as it stands (a territory that no longer exists is no longer selected).
  const selShape = selTerr?.kind === 'area' ? shownShapes.find((s) => s.id === selTerr.id && s.kind === 'area') ?? null : null;
  const selValid = !!selTerr && (selTerr.kind === 'country' ? !!world?.byKey.has(selTerr.key) : !!selShape);
  const selMulti = useMemo<Multi>(() => {
    if (!selTerr || !selValid) return [];
    if (selTerr.kind === 'country') return countryMulti(selTerr.key);
    return selShape ? toMulti(selShape.geometry) : [];
  }, [selTerr, selValid, selShape, countryMulti]);
  const selOwner: string | null = !selTerr || !selValid ? null
    : selTerr.kind === 'country' ? (data?.regions.find((r) => r.region_key === selTerr.key)?.owner_cabinet_id ?? null)
      : selShape?.owner_cabinet_id ?? null;
  const selDetailed = vertexCount(selMulti) > HANDLE_LIMIT;
  const selOwnerColor = selOwner ? cabById.get(selOwner)?.color ?? null : null;

  // ── map plumbing ──
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const resizeObs = useRef<ResizeObserver | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const fogCanvas = useRef<HTMLCanvasElement | null>(null);
  const fogHolesRef = useRef<FogHoles | null>(null);
  const fogFrame = useRef<number | null>(null);
  const liveRef = useRef<Live | null>(null);
  const labelsRef = useRef<CountryLabel[]>([]);
  const syncLabelsRef = useRef<(() => void) | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const didFit = useRef(false);

  const redrawFog = useCallback(() => {
    if (fogFrame.current !== null) return;
    fogFrame.current = window.requestAnimationFrame(() => {
      fogFrame.current = null;
      const map = mapRef.current; const cvs = fogCanvas.current;
      if (map && cvs) drawFog(cvs, map, fogHolesRef.current);
    });
  }, []);

  const setSource = useCallback((id: string, fc: FeatureCollection) => {
    (mapRef.current?.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
  }, []);

  // ── names ──
  const nameOf = useCallback((t: TerrRef, d: MapData | null): string => {
    if (t.kind === 'country') return world?.byKey.get(t.key)?.name ?? 'This country';
    return d?.shapes.find((s) => s.id === t.id)?.label || 'A drawn territory';
  }, [world]);

  // ── undo ──
  const [undo, setUndo] = useState<UndoChip | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 12000);
    return () => window.clearTimeout(t);
  }, [undo]);

  // ── actions ──
  const moveUnit = useCallback(async (id: string, lng: number, lat: number) => {
    const before = dataRef.current;
    const unit = before?.units.find((u) => u.id === id);
    if (!before || !unit) return;
    const nl = round5(clampLng(lng)); const nt = round5(clampLat(lat));
    setData({ ...before, units: before.units.map((u) => (u.id === id ? { ...u, lng: nl, lat: nt } : u)) });
    await run(async () => {
      try {
        await saveUnit(ref, { id, lng: nl, lat: nt });
        setLast({ at: new Date().getTime(), text: `You moved ${unit.name}` });
      } catch (e) {
        setData(before);
        notifyErr(crisisError(e, 'Could not move the unit.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  /** Saves a set of border changes at once, shows them first, and offers Undo (which puts `undoOf` back). */
  const applyEdits = useCallback(async (set: EditSet, text: string, undoOf: ((ids: string[]) => EditSet) | null, note: string | null = null) => {
    const before = dataRef.current;
    if (!before) return;
    setData(applyLocal(before, set, ref.id));
    await run(async () => {
      try {
        const ids = await saveSet(ref, set);
        setLast({ at: new Date().getTime(), text });
        if (undoOf) {
          const back = undoOf(ids);
          setUndo({ sid: new Date().getTime(), text, note, restore: () => { setUndo(null); void applyEdits(back, 'You undid a border change', null); } });
        } else setUndo(null);
      } catch (e) {
        setData(before);
        notifyErr(crisisError(e, 'Could not change the border.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  /** Every territory but `t`, for cutting overlaps. */
  const othersFor = useCallback((t: TerrRef | null, d: MapData): TerritoryShape[] => {
    const owner = new Map(d.regions.map((r) => [r.region_key, r.owner_cabinet_id]));
    const list: TerritoryShape[] = [];
    for (const [key, b] of baseRef.current) {
      if (t?.kind === 'country' && t.key === key) continue;
      const o = storedOutline(d, key);
      list.push({ id: `c:${key}`, owner: owner.get(key) ?? null, multi: o ?? b.multi, bbox: o ? bboxOf(o) : b.bbox });
    }
    for (const s of d.shapes) {
      if (s.kind !== 'area' || (t?.kind === 'area' && t.id === s.id)) continue;
      const m = toMulti(s.geometry);
      list.push({ id: `a:${s.id}`, owner: s.owner_cabinet_id, multi: m, bbox: bboxOf(m) });
    }
    return list;
  }, []);

  /**
   * Adds to `set` (and its undo) the land cut out of other territories by `growth`. Answers the names of the
   * territories that lost all their land, for the Undo chip.
   */
  const addCuts = useCallback((growth: Multi, owner: string | null, t: TerrRef | null, d: MapData, set: EditSet, back: EditSet): string[] => {
    const gone: string[] = [];
    for (const c of cutOverlaps(growth, owner, othersFor(t, d))) {
      if (c.id.startsWith('c:')) {
        const key = c.id.slice(2);
        const row = d.regions.find((r) => r.region_key === key);
        set.regions.push({ key, owner_cabinet_id: row?.owner_cabinet_id ?? null, geometry: toGeometry(c.emptied ? [] : c.multi) });
        back.regions.push({ key, owner_cabinet_id: row?.owner_cabinet_id ?? null, geometry: row?.geometry ?? null });
        if (c.emptied) gone.push(world?.byKey.get(key)?.name ?? 'A country');
      } else {
        const id = c.id.slice(2);
        const shape = d.shapes.find((s) => s.id === id);
        if (!shape) continue;
        if (c.emptied) {
          set.removeShapes.push(id);
          back.addShapes.push(shape);
          gone.push(shape.label || 'A drawn territory');
        } else {
          set.shapes.push({ id, geometry: areaGeometry(c.multi) });
          back.shapes.push({ id, geometry: shape.geometry });
        }
      }
    }
    return gone;
  }, [othersFor, world]);

  /**
   * Saves a territory's new outline and cuts the land it grew over out of every other side. `knownGrowth` is the
   * land gained when the caller already knows it (a bend outwards); otherwise it is worked out from the outlines.
   */
  const commitOutline = useCallback((t: TerrRef, next: Multi, reset = false, knownGrowth?: Multi) => {
    const d = dataRef.current;
    if (!d) return;
    if (!reset && areaOf(next) <= AREA_EPS) { notifyErr('That would leave no land at all. Try a smaller move.', 'crisis-map'); return; }
    const prev = t.kind === 'country' ? storedOutline(d, t.key) ?? baseRef.current.get(t.key)?.multi ?? [] : toMulti(d.shapes.find((s) => s.id === t.id)?.geometry);
    const set = emptySet(); const back = emptySet();
    const name = nameOf(t, d);
    let gone: string[] = [];
    try {
      const owner = t.kind === 'country' ? d.regions.find((r) => r.region_key === t.key)?.owner_cabinet_id ?? null : d.shapes.find((s) => s.id === t.id)?.owner_cabinet_id ?? null;
      gone = addCuts(knownGrowth ?? differenceM(next, prev), owner, t, d, set, back);
      if (t.kind === 'country') {
        const row = d.regions.find((r) => r.region_key === t.key);
        set.regions.push({ key: t.key, owner_cabinet_id: row?.owner_cabinet_id ?? null, geometry: reset ? null : toGeometry(next) });
        back.regions.push({ key: t.key, owner_cabinet_id: row?.owner_cabinet_id ?? null, geometry: row?.geometry ?? null });
      } else {
        const shape = d.shapes.find((s) => s.id === t.id);
        if (!shape) return;
        set.shapes.push({ id: t.id, geometry: areaGeometry(next) });
        back.shapes.push({ id: t.id, geometry: shape.geometry });
      }
    } catch {
      notifyErr('That border could not be worked out. Try a smaller move.', 'crisis-map');
      return;
    }
    void applyEdits(set, reset ? `You put back the real border of ${name}` : `You moved the border of ${name}`, () => back, goneNote(gone));
  }, [addCuts, applyEdits, nameOf]);

  const pickOwner = useCallback((t: TerrRef, owner: string | null) => {
    const d = dataRef.current;
    if (!d) return;
    const name = nameOf(t, d);
    const who = owner ? cabById.get(owner)?.name ?? 'a cabinet' : 'nobody';
    if (t.kind === 'country') {
      const current = d.regions.find((r) => r.region_key === t.key)?.owner_cabinet_id ?? null;
      if (current === owner) return;
      const before = d;
      const has = d.regions.some((r) => r.region_key === t.key);
      const regions = has
        ? d.regions.map((r) => (r.region_key === t.key ? { ...r, owner_cabinet_id: owner } : r))
        : [...d.regions, { crisis_id: ref.id, region_key: t.key, owner_cabinet_id: owner }];
      setData({ ...d, regions });
      void run(async () => {
        try {
          await setRegionOwner(ref, t.key, owner);
          setLast({ at: new Date().getTime(), text: `You gave ${name} to ${who}` });
          setUndo({ sid: new Date().getTime(), text: `${name} changed hands`, note: null, restore: () => { setUndo(null); pickOwner(t, current); } });
        } catch (e) {
          setData(before);
          notifyErr(crisisError(e, 'Could not change the border.'), 'crisis-map');
        }
      });
      return;
    }
    const shape = d.shapes.find((s) => s.id === t.id);
    if (!shape || shape.owner_cabinet_id === owner) return;
    const set = emptySet(); const back = emptySet();
    set.owners.push({ id: t.id, owner_cabinet_id: owner });
    back.owners.push({ id: t.id, owner_cabinet_id: shape.owner_cabinet_id });
    void applyEdits(set, `You gave ${name} to ${who}`, () => back);
  }, [ref, run, cabById, nameOf, applyEdits]);

  /** Saves a newly drawn territory; land it covers is taken from whoever held it. */
  const submitNewArea = useCallback((dr: Draft) => {
    const d = dataRef.current;
    if (!d || dr.points.length < MIN_POINTS) return;
    let multi: Multi;
    const set = emptySet(); const back = emptySet();
    let gone: string[] = [];
    try {
      multi = clean(toMulti({ type: 'Polygon', coordinates: [[...dr.points, dr.points[0]]] }));
      if (areaOf(multi) <= AREA_EPS) { notifyErr('That shape has no area. Draw at least three points apart.', 'crisis-map'); return; }
      gone = addCuts(multi, dr.owner, null, d, set, back);
    } catch {
      notifyErr('That shape could not be worked out. Try drawing it again.', 'crisis-map');
      return;
    }
    set.addShapes.push({
      id: `new-${dr.sid}`, crisis_id: ref.id, kind: 'area', owner_cabinet_id: dr.owner, label: null, color: null,
      geometry: areaGeometry(multi), public: true, revealed_to: [],
    });
    setDraft(null);
    notifyOk('Territory saved', 'crisis-map');
    void applyEdits(set, 'You drew new territory', (ids) => ({ ...back, removeShapes: [...back.removeShapes, ...ids] }), goneNote(gone));
  }, [ref.id, addCuts, applyEdits]);

  const removeArea = useCallback((id: string) => {
    const d = dataRef.current;
    const shape = d?.shapes.find((s) => s.id === id);
    if (!shape) return;
    setSelTerr(null);
    const set = emptySet(); const back = emptySet();
    set.removeShapes.push(id);
    back.addShapes.push(shape);
    void applyEdits(set, 'You removed a territory', () => back);
  }, [applyEdits]);

  const submitUnit = useCallback(async (dd: UnitDraft, existing: MapUnit | null) => {
    const before = dataRef.current;
    const patch = {
      name: dd.name.trim(), kind: dd.kind, strength: dd.strength, owner_cabinet_id: dd.owner,
      note: dd.note.trim() ? dd.note.trim() : null, revealed_to: dd.revealed,
    };
    if (existing && before) setData({ ...before, units: before.units.map((u) => (u.id === existing.id ? { ...u, ...patch } : u)) });
    await run(async () => {
      try {
        if (existing) await saveUnit(ref, { id: existing.id, ...patch });
        else if (newUnit) {
          const lng = round5(clampLng(newUnit.lng)); const lat = round5(clampLat(newUnit.lat));
          const id = await saveUnit(ref, { ...patch, lng, lat });
          const cur = dataRef.current;
          if (cur) setData({ ...cur, units: [...cur.units.filter((u) => u.id !== id), { id, crisis_id: ref.id, suspected_by: [], lng, lat, ...patch }] });
        }
        setLast({ at: new Date().getTime(), text: existing ? `You updated ${patch.name}` : `You added ${patch.name}` });
        notifyOk(existing ? 'Unit saved' : 'Unit added', 'crisis-map');
        if (!existing) changeTool('select');
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not save the unit.'), 'crisis-map');
      }
    });
  }, [ref, run, newUnit, changeTool]);

  const removeUnit = useCallback(async (u: MapUnit) => {
    const before = dataRef.current;
    if (before) setData({ ...before, units: before.units.filter((x) => x.id !== u.id) });
    setSelUnit(null);
    await run(async () => {
      try {
        await deleteUnit(ref, u.id);
        setLast({ at: new Date().getTime(), text: `You removed ${u.name}` });
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not remove the unit.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  /** The unit was dragged: ask in place before saving. */
  const askMove = useCallback((id: string, lng: number, lat: number) => {
    const map = mapRef.current;
    const u = dataRef.current?.units.find((x) => x.id === id);
    if (!map || !u) return;
    const was = pendingMoveRef.current;
    if (was && was.id !== id) cancelMove();
    const a = map.project([u.lng, u.lat]); const b = map.project([lng, lat]);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 4) { cancelMove(); return; }
    setPending({ id, name: u.name, lng, lat });
  }, [cancelMove, setPending]);

  const confirmMove = useCallback(() => {
    const p = pendingMoveRef.current;
    if (!p) return;
    setPending(null);
    void moveUnit(p.id, p.lng, p.lat);
  }, [moveUnit, setPending]);

  const fitView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = shownUnits.map((u) => [u.lng, u.lat] as LngLat);
    if (!pts.length) { map.fitBounds([[-168, -48], [178, 76]], { padding: 24, duration: 0 }); return; }
    let minX = 180; let minY = 90; let maxX = -180; let maxY = -90;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: compact ? 50 : 110, maxZoom: 5.5, duration: 0 });
  }, [shownUnits, compact]);

  /** The outline point under the pointer, if it is within reach of the selected territory's outline. */
  const edgeAt = useCallback((map: MLMap, multi: Multi, point: { x: number; y: number }, ll: { lng: number; lat: number }): EdgeHit | null => {
    if (!multi.length) return null;
    const far = map.unproject([point.x + EDGE_PX, point.y + EDGE_PX]);
    const tol = Math.max(Math.abs(far.lng - ll.lng), Math.abs(far.lat - ll.lat)) * 1.6 + 1e-6;
    return nearestEdge(multi, { x: point.x, y: point.y }, [ll.lng, ll.lat], tol, EDGE_PX, (p) => map.project(p));
  }, []);

  /**
   * The outline after a drag: a simple outline gets a corner where it was pressed; a detailed one bends from
   * that point as a "tent" whose base widens the further it is pulled.
   */
  const dragResult = (dr: OutlineDrag, to: Pt): { region: Pt[] | null; next: Multi | null } => {
    if (dr.mode === 'corner') return { region: null, next: withCornerAdded(dr.base, dr.hit.pi, dr.hit.ri, dr.hit.si, to) };
    const ring = dr.base[dr.hit.pi]?.[dr.hit.ri];
    const map = mapRef.current;
    const p = map ? map.project(to) : dr.start;
    const half = Math.max(14, Math.min(520, Math.hypot(p.x - dr.start.x, p.y - dr.start.y) * 0.8));
    return { region: ring ? tentRegion(ring, dr.screen, dr.hit, to, half) : null, next: null };
  };
  const hoverShown = useRef(false);

  const previewFrame = useRef<number | null>(null);

  // ── map events read the latest state through this ──
  useEffect(() => {
    liveRef.current = {
      onMapClick: (e) => {
        const map = mapRef.current;
        if (!map) return;
        if (performance.now() < suppressClickUntil.current) return;
        const target = e.originalEvent.target as HTMLElement | null;
        if (target?.closest('.wm-marker')) return;
        if (compact) { setSelUnit(null); return; }
        if (tool === 'unit') {
          if (editable && canUnits && addKind) {
            setSelUnit(null);
            setNewUnit({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          }
          return;
        }
        if (tool === 'borders' && draft) {
          if (draft.phase !== 'draw') return;
          const pts = draft.points;
          const lastPt = pts[pts.length - 1];
          if (lastPt) {
            const lp = map.project(lastPt);
            if (Math.hypot(lp.x - e.point.x, lp.y - e.point.y) < 6) return;
          }
          if (pts.length >= MIN_POINTS) {
            const fp = map.project(pts[0]);
            if (Math.hypot(fp.x - e.point.x, fp.y - e.point.y) < 12) { setDraft({ ...draft, phase: 'refine' }); return; }
          }
          setDraft({ ...draft, points: [...pts, [round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))]] });
          return;
        }
        // Select and Borders: a click picks a territory (a drawn area sits on top of a country).
        const area = map.queryRenderedFeatures(e.point, { layers: [L_SHAPE_FILL] })[0];
        const sid = area?.properties?.id as string | undefined;
        if (sid && dataRef.current?.shapes.some((s) => s.id === sid && s.kind === 'area')) {
          setSelUnit(null); setSelChar(null); setSelTerr({ kind: 'area', id: sid });
          return;
        }
        const f = map.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0];
        const key = f?.properties?.key as string | undefined;
        if (key) {
          setSelUnit(null); setSelChar(null); setSelTerr({ kind: 'country', key });
          return;
        }
        // Open sea: let go of what is selected; with nothing selected, Borders starts new territory here.
        if (selTerr || selUnit || selChar) { clearSelection(); return; }
        if (tool === 'borders' && editable && canMap) {
          setDraft({ sid: new Date().getTime(), phase: 'draw', points: [[round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))]], owner: defaultOwner });
        }
      },
      onMapDblClick: (e) => {
        if (draft && draft.phase === 'draw' && draft.points.length >= MIN_POINTS) {
          e.preventDefault();
          setDraft({ ...draft, phase: 'refine' });
        }
      },
      onPress: (e) => {
        const map = mapRef.current;
        if (!map || !canEditTerr || !selTerr || !selValid || dragRef.current) return;
        const target = e.originalEvent.target as HTMLElement | null;
        if (target?.closest('.wm-marker')) return;
        const hit = edgeAt(map, selMulti, e.point, e.lngLat);
        if (!hit) return;
        e.preventDefault();
        const detailed = vertexCount(selMulti) > HANDLE_LIMIT;
        const ring = selMulti[hit.pi][hit.ri];
        dragRef.current = {
          terr: selTerr, base: selMulti, hit, mode: detailed ? 'tent' : 'corner',
          screen: detailed ? ring.slice(0, -1).map((p) => map.project(p)) : [],
          start: { x: e.point.x, y: e.point.y }, to: null, moved: false,
        };
        setSource(SRC_HOVER, emptyFc);
        hoverShown.current = false;
        map.getCanvasContainer().style.cursor = 'grabbing';
      },
      onPointerMove: (e) => {
        const map = mapRef.current;
        if (!map) return;
        const dr = dragRef.current;
        if (dr) {
          if (Math.hypot(e.point.x - dr.start.x, e.point.y - dr.start.y) > 3) dr.moved = true;
          dr.to = [round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))];
          if (previewFrame.current === null) {
            previewFrame.current = window.requestAnimationFrame(() => {
              previewFrame.current = null;
              const cur = dragRef.current;
              if (!cur || !cur.to || !cur.moved) return;
              const r = dragResult(cur, cur.to);
              const tint = selOwnerColor ? cabinetTint(selOwnerColor, 0.3) : null;
              if (r.next) setSource(SRC_EDIT, multiFc(r.next, tint));
              // Land being added shows in the holder's colour; land being taken away in red.
              else if (r.region) setSource(SRC_EDIT, multiFc([[r.region]], pointIn(cur.to, cur.base) ? null : tint));
            });
          }
          return;
        }
        // Hover: the point the outline would be pulled from, and the right cursor.
        let near = false;
        if (canEditTerr && selTerr && selValid) {
          const hit = edgeAt(map, selMulti, e.point, e.lngLat);
          near = !!hit;
          if (hit) setSource(SRC_HOVER, { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: hit.at } }] });
        }
        if (!near && hoverShown.current) setSource(SRC_HOVER, emptyFc);
        hoverShown.current = near;
        const drawing = tool === 'borders' && !!draft;
        map.getCanvasContainer().style.cursor = near ? 'grab'
          : drawing || (tool === 'unit' && addKind) ? 'crosshair'
            : tool === 'borders' ? 'pointer' : '';
      },
      onRelease: () => {
        const dr = dragRef.current;
        if (!dr) return;
        dragRef.current = null;
        if (previewFrame.current !== null) { window.cancelAnimationFrame(previewFrame.current); previewFrame.current = null; }
        setSource(SRC_EDIT, emptyFc);
        const map = mapRef.current;
        if (map) map.getCanvasContainer().style.cursor = '';
        if (!dr.moved || !dr.to) return;
        suppressClickUntil.current = performance.now() + 400;
        let next: Multi;
        let growth: Multi | undefined;
        try {
          const r = dragResult(dr, dr.to);
          if (r.next) next = clean(r.next);
          else if (r.region) {
            next = applyTent(dr.base, r.region, dr.to);
            // Bending out gains exactly the tent minus what was already held; bending in gains nothing.
            growth = pointIn(dr.to, dr.base) ? [] : differenceM([[r.region]], dr.base);
          } else return;
        } catch {
          notifyErr('That border could not be worked out. Try a smaller move.', 'crisis-map');
          return;
        }
        commitOutline(dr.terr, next, false, growth);
      },
      onUnitClick: (id) => {
        if (tool !== 'select') return;
        setNewUnit(null); setSelTerr(null); setSelChar(null);
        setSelUnit(id);
      },
      onCharClick: (id) => {
        if (tool !== 'select' || compact) return;
        setSelUnit(null); setSelTerr(null);
        setSelChar(id);
      },
      onUnitMoved: (id, lng, lat) => { askMove(id, lng, lat); },
      redrawFog,
      escape: () => {
        if (dragRef.current) {
          dragRef.current = null;
          setSource(SRC_EDIT, emptyFc);
          const map = mapRef.current;
          if (map) map.getCanvasContainer().style.cursor = '';
          return;
        }
        if (pendingMoveRef.current) { cancelMove(); return; }
        if (draft) { setDraft(null); return; }
        if (tool === 'unit') {
          if (newUnit) setNewUnit(null);
          else if (addKind) setAddKind(null);
          else changeTool('select');
          return;
        }
        clearSelection();
      },
    };
  });

  // ── create the map (once) ──
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    const labelMarkers = new Map<string, { mk: MLMarker; at: LngLat }>();
    const release = () => liveRef.current?.onRelease();
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
    (async () => {
      try {
        const [ml, w] = await Promise.all([import('maplibre-gl'), loadWorldData()]);
        if (cancelled || !hostRef.current) return;
        // The worker script is served from our own origin (public/maplibre), never a CDN.
        ml.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
        mlRef.current = ml;
        map = new ml.Map({
          container: hostRef.current,
          style: BLANK_STYLE,
          center: [-30, 28],
          zoom: 1.5,
          minZoom: 0.8,
          maxZoom: 9,
          renderWorldCopies: false,
          attributionControl: false,
          // Keeps the drawn frame so screenshots and image exports see the map (owner wants every update checked).
          canvasContextAttributes: { preserveDrawingBuffer: true },
          dragRotate: false,
          pitchWithRotate: false,
          maxPitch: 0,
        });
        map.touchZoomRotate.disableRotation();
        // The host can change size without a window resize (rail, drawer, phone layout, the Command card).
        const ro = new ResizeObserver(() => { map?.resize(); });
        ro.observe(hostRef.current);
        resizeObs.current = ro;
        map.touchPitch.disable();
        const m = map;
        mapRef.current = m;
        labelsRef.current = w.labels;

        const syncLabels = () => {
          const z = m.getZoom();
          const list = labelsRef.current;
          const keep = new Set<string>();
          for (const l of list) {
            const show = z >= l.minZoom;
            const has = labelMarkers.get(l.key);
            if (show) keep.add(l.key);
            if (show && !has) {
              const mk = new ml.Marker({ element: makeCountryLabel(l.name, l.area), anchor: 'center' }).setLngLat(l.center).addTo(m);
              labelMarkers.set(l.key, { mk, at: l.center });
            } else if (show && has && (has.at[0] !== l.center[0] || has.at[1] !== l.center[1])) {
              has.mk.setLngLat(l.center); has.at = l.center;
            }
          }
          for (const [key, has] of [...labelMarkers]) if (!keep.has(key)) { has.mk.remove(); labelMarkers.delete(key); }
        };
        syncLabelsRef.current = syncLabels;

        m.on('load', () => {
          if (cancelled) return;
          m.addSource(SRC_COUNTRIES, { type: 'geojson', data: w.collection, promoteId: 'key' });
          m.addSource(SRC_SHAPES, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_DRAFT, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_SEL, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_EDIT, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_HOVER, { type: 'geojson', data: emptyFc });
          for (const layer of mapLayers()) m.addLayer(layer);
          for (const layer of editLayers()) m.addLayer(layer);

          const cvs = document.createElement('canvas');
          cvs.classList.add('wm-fog');
          m.getCanvasContainer().insertBefore(cvs, m.getCanvas().nextSibling);
          fogCanvas.current = cvs;

          m.on('click', (e) => liveRef.current?.onMapClick(e));
          m.on('dblclick', (e) => liveRef.current?.onMapDblClick(e));
          m.on('mousedown', (e) => liveRef.current?.onPress(e));
          m.on('touchstart', (e) => { if (e.points.length === 1) liveRef.current?.onPress(e); });
          m.on('touchmove', (e) => { if (dragRef.current && e.points.length === 1) liveRef.current?.onPointerMove(e); });
          let hover: string | null = null;
          let moveFrame: number | null = null;
          let lastMove: MapMouseEvent | null = null;
          m.on('mousemove', (e) => {
            lastMove = e;
            if (moveFrame !== null) return;
            moveFrame = window.requestAnimationFrame(() => {
              moveFrame = null;
              const ev = lastMove;
              if (!ev || cancelled) return;
              liveRef.current?.onPointerMove(ev);
              // The country under the pointer lights up while the Borders tool waits for a click.
              const el = m.getCanvasContainer();
              const want = el.dataset.tool === 'borders' && !el.dataset.busy && !dragRef.current;
              const f = want ? m.queryRenderedFeatures(ev.point, { layers: [L_LAND] })[0] : undefined;
              const key = (f?.properties?.key as string | undefined) ?? null;
              if (key === hover) return;
              if (hover) m.setFeatureState({ source: SRC_COUNTRIES, id: hover }, { hi: false });
              hover = key;
              if (key) m.setFeatureState({ source: SRC_COUNTRIES, id: key }, { hi: true });
            });
          });
          m.on('move', () => liveRef.current?.redrawFog());
          m.on('resize', () => liveRef.current?.redrawFog());
          m.on('zoom', syncLabels);
          syncLabels();
          setWorld(w);
          m.once('idle', () => { if (!cancelled) setMapReady(true); });
          // Re-measure and draw once the page has settled: the first frame was sometimes never painted.
          m.resize(); m.triggerRepaint();
          window.requestAnimationFrame(() => { if (!cancelled) { m.resize(); m.triggerRepaint(); } });
        });
        m.on('error', (ev) => {
          const msg = String((ev as { error?: { message?: string } }).error?.message ?? '');
          if (/webgl/i.test(msg)) setMapError('This browser could not start the map. Try another browser or turn on hardware acceleration.');
        });
      } catch (e) {
        if (!cancelled) setMapError(crisisError(e, 'The map could not start. Try reloading the page.'));
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
      window.removeEventListener('touchcancel', release);
      for (const l of labelMarkers.values()) l.mk.remove();
      labelMarkers.clear();
      syncLabelsRef.current = null;
      if (fogFrame.current !== null) { window.cancelAnimationFrame(fogFrame.current); fogFrame.current = null; }
      fogCanvas.current = null;
      resizeObs.current?.disconnect(); resizeObs.current = null;
      if (map) map.remove();
      mapRef.current = null;
      mlRef.current = null;
    };
  }, []);

  // The Borders hover reads the tool from the map element (the handler is made once).
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const el = map.getCanvasContainer();
    el.dataset.tool = canMap && editable ? tool : '';
    if (draft) el.dataset.busy = '1'; else delete el.dataset.busy;
    el.style.cursor = (tool === 'borders' && !!draft) || (tool === 'unit' && addKind) ? 'crosshair' : tool === 'borders' ? 'pointer' : '';
    if (draft) map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
    if (tool !== 'borders' || draft) {
      for (const key of world.byKey.keys()) map.setFeatureState({ source: SRC_COUNTRIES, id: key }, { hi: false });
    }
  }, [tool, world, addKind, draft, canMap, editable]);

  // Escape backs out of whatever is open.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const t = ev.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      liveRef.current?.escape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── countries: changed outlines, labels and owner colours ──
  const countriesFc = useMemo(() => {
    if (!world) return null;
    if (!overrides.size) return world.collection;
    return {
      type: 'FeatureCollection' as const,
      features: world.collection.features.flatMap((f) => {
        const o = overrides.get(f.properties.key);
        if (!o) return [f];
        if (!o.length) return [];
        return [{ ...f, geometry: toGeometry(o) as unknown as Geometry }];
      }),
    };
  }, [world, overrides]);
  useEffect(() => {
    if (!world || !countriesFc) return;
    setSource(SRC_COUNTRIES, countriesFc as FeatureCollection);
    labelsRef.current = world.labels.flatMap((l) => {
      const o = overrides.get(l.key);
      if (!o) return [l];
      const at = labelPoint(o);
      return at ? [{ ...l, center: at }] : [];
    });
    syncLabelsRef.current?.();
  }, [world, countriesFc, overrides, setSource]);

  // Where to open: a link from a notification or a history row names a unit, a country or an area
  // (src/lib/crisis/mapFocus.ts). The small map on Command ignores it.
  const searchParams = useSearchParams();
  const focusKey = compact ? '' : (searchParams?.toString() ?? '');
  const appliedFocus = useRef<string | null>(null);
  const focusOn = useCallback((f: MapFocus): boolean => {
    const map = mapRef.current;
    if (!map) return false;
    if (f.unit) {
      const hit = shownUnits.find((u) => u.id === f.unit);
      if (!hit) return false; // gone, or not visible to this viewer
      map.jumpTo({ center: [hit.lng, hit.lat], zoom: Math.max(map.getZoom(), 6) });
      setSelUnit(hit.id);
      return true;
    }
    const b = f.region ? bboxOf(countryMulti(f.region)) : f.bbox;
    if (!b) return false;
    if (b[0] === b[2] && b[1] === b[3]) map.jumpTo({ center: [b[0], b[1]], zoom: 6 });
    else map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: compact ? 50 : 110, maxZoom: 6, duration: 0 });
    return true;
  }, [shownUnits, countryMulti, compact]);

  // First fit once there is data, and again whenever the link names a new place.
  useEffect(() => {
    if (!world || !data) return;
    const focus = focusKey ? readMapFocus(focusKey) : null;
    const key = focus ? focusKey : '';
    if (didFit.current && appliedFocus.current === key) return;
    didFit.current = true;
    appliedFocus.current = key;
    if (!focus || !focusOn(focus)) fitView();
  }, [world, data, fitView, focusKey, focusOn]);

  const applied = useRef(new Map<string, string>());
  const ownerOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.regions ?? []) if (r.owner_cabinet_id) m.set(r.region_key, r.owner_cabinet_id);
    return m;
  }, [data]);
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const next = new Map<string, string>();
    for (const [key, cab] of ownerOf) {
      const c = cabById.get(cab);
      if (c && world.byKey.has(key)) next.set(key, c.color);
    }
    for (const [key, color] of next) {
      if (applied.current.get(key) === color) continue;
      map.setFeatureState({ source: SRC_COUNTRIES, id: key }, { tint: cabinetTint(color, 0.27), edge: cabinetTint(color, 0.95) });
      applied.current.set(key, color);
    }
    for (const key of [...applied.current.keys()]) {
      if (next.has(key)) continue;
      map.removeFeatureState({ source: SRC_COUNTRIES, id: key }, 'tint');
      map.removeFeatureState({ source: SRC_COUNTRIES, id: key }, 'edge');
      applied.current.delete(key);
    }
  }, [world, ownerOf, cabById]);

  // ── shapes ──
  const shapeLabels = useRef(new Map<string, MLMarker>());
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: shownShapes.map((s) => {
        const color = shapeColor(s, cabById);
        // Territory is filled and outlined exactly like the cabinet's countries.
        const props = s.kind === 'area' ? { tint: cabinetTint(color, 0.27), edge: cabinetTint(color, 0.95) } : {};
        return {
          type: 'Feature' as const,
          properties: { id: s.id, kind: s.kind, color, ...props },
          geometry: s.geometry as unknown as Feature['geometry'],
        };
      }),
    };
    setSource(SRC_SHAPES, fc);
    const wanted = new Set<string>();
    for (const s of shownShapes) {
      if (!s.label) continue;
      wanted.add(s.id);
      const color = shapeColor(s, cabById);
      const at = centroidOf(shapePoints(s.geometry));
      const old = shapeLabels.current.get(s.id);
      if (old) old.remove();
      shapeLabels.current.set(s.id, new ml.Marker({ element: makeShapeLabel(s.label, color), anchor: 'center' }).setLngLat(at).addTo(map));
    }
    for (const [id, mk] of [...shapeLabels.current]) {
      if (!wanted.has(id)) { mk.remove(); shapeLabels.current.delete(id); }
    }
  }, [world, shownShapes, cabById, setSource]);

  // The selected territory's outline.
  useEffect(() => {
    if (!world) return;
    setSource(SRC_SEL, multiFc(compact ? [] : selMulti));
    if (!selMulti.length || !canEditTerr) setSource(SRC_HOVER, emptyFc);
  }, [world, selMulti, compact, canEditTerr, setSource]);

  // Corner handles on a simple selected outline (a drawn area, a small country). Detailed outlines have none:
  // they bend from wherever the outline is pressed.
  const corners = useRef<MLMarker[]>([]);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    for (const h of corners.current) h.remove();
    corners.current = [];
    if (!world || !map || !ml || !canEditTerr || !selTerr || !selMulti.length || selDetailed) return;
    const terr = selTerr; const base = selMulti;
    const tint = selOwnerColor ? cabinetTint(selOwnerColor, 0.3) : null;
    base.forEach((poly, pi) => poly.forEach((ring, ri) => {
      for (let vi = 0; vi < ring.length - 1; vi++) {
        const el = makeCorner();
        const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(ring[vi]).addTo(map);
        const start = ring[vi];
        mk.on('drag', () => {
          const ll = mk.getLngLat();
          setSource(SRC_EDIT, multiFc(withCornerMoved(base, pi, ri, vi, [ll.lng, ll.lat]), tint));
        });
        mk.on('dragend', () => {
          setSource(SRC_EDIT, emptyFc);
          const ll = mk.getLngLat();
          const a = map.project(start); const b = map.project([ll.lng, ll.lat]);
          if (Math.hypot(a.x - b.x, a.y - b.y) < 2) return;
          try {
            commitOutline(terr, clean(withCornerMoved(base, pi, ri, vi, [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))])));
          } catch {
            mk.setLngLat(start);
            notifyErr('That border could not be worked out. Try a smaller move.', 'crisis-map');
          }
        });
        el.addEventListener('click', (ev) => ev.stopPropagation());
        el.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          const next = withCornerRemoved(base, pi, ri, vi);
          if (!next) { notifyErr('A shape needs at least three corners.', 'crisis-map'); return; }
          try { commitOutline(terr, clean(next)); } catch { notifyErr('That border could not be worked out.', 'crisis-map'); }
        });
        corners.current.push(mk);
      }
    }));
    return () => { for (const h of corners.current) h.remove(); corners.current = []; };
  }, [world, canEditTerr, selTerr, selMulti, selDetailed, selOwnerColor, commitOutline, setSource]);

  // New territory preview, in its owner's colours.
  const draftColor = draft && draft.owner ? cabById.get(draft.owner)?.color ?? null : null;
  useEffect(() => {
    if (!world) return;
    setSource(SRC_DRAFT, draft ? draftFc(draft.points, draftColor) : emptyFc);
  }, [world, draft, draftColor, setSource]);

  // Corner handles of the new territory.
  const handles = useRef<MLMarker[]>([]);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    for (const h of handles.current) h.remove();
    handles.current = [];
    if (!draft) return;
    const pts = draft.points;
    const live: LngLat[] = pts.map((p) => [p[0], p[1]]);
    pts.forEach((p, i) => {
      const el = makeVertex();
      if (i === 0 && draft.phase === 'draw' && pts.length >= MIN_POINTS) el.title = 'Click to close the shape';
      const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(p).addTo(map);
      mk.on('drag', () => {
        const ll = mk.getLngLat();
        live[i] = [ll.lng, ll.lat];
        setSource(SRC_DRAFT, draftFc(live, draftColor));
      });
      mk.on('dragend', () => {
        const ll = mk.getLngLat();
        live[i] = [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))];
        setDraft((d) => (d && d.sid === draft.sid ? { ...d, points: live.map((q) => [q[0], q[1]] as LngLat) } : d));
      });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (i === 0) setDraft((d) => (d && d.sid === draft.sid && d.phase === 'draw' && d.points.length >= MIN_POINTS ? { ...d, phase: 'refine' } : d));
      });
      el.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        if (draft.phase !== 'refine' || pts.length <= MIN_POINTS) return;
        setDraft((d) => (d && d.sid === draft.sid ? { ...d, points: d.points.filter((_, j) => j !== i) } : d));
      });
      handles.current.push(mk);
    });
    if (draft.phase === 'refine') {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]; const b = pts[(i + 1) % pts.length];
        const el = makeMidpoint();
        const mk = new ml.Marker({ element: el, anchor: 'center' }).setLngLat([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]).addTo(map);
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const at: LngLat = [round5((a[0] + b[0]) / 2), round5((a[1] + b[1]) / 2)];
          setDraft((d) => {
            if (!d || d.sid !== draft.sid) return d;
            const next = [...d.points];
            next.splice(i + 1, 0, at);
            return { ...d, points: next };
          });
        });
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        handles.current.push(mk);
      }
    }
    return () => { for (const h of handles.current) h.remove(); handles.current = []; };
  }, [world, draft, draftColor, setSource]);

  // The spot where a new unit will go.
  const ghost = useRef<MLMarker | null>(null);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    ghost.current?.remove(); ghost.current = null;
    if (newUnit) ghost.current = new ml.Marker({ element: makeGhost(), anchor: 'center' }).setLngLat([newUnit.lng, newUnit.lat]).addTo(map);
    return () => { ghost.current?.remove(); ghost.current = null; };
  }, [world, newUnit]);

  // The move confirmation sits next to the unit's new spot and follows the map as it pans.
  const moveCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const map = mapRef.current; const card = moveCard.current;
    if (!world || !map || !card || !pendingMove) return;
    const place = () => {
      const p = map.project([pendingMove.lng, pendingMove.lat]);
      const w = map.getContainer().clientWidth;
      card.style.left = `${Math.max(136, Math.min(w - 136, p.x))}px`;
      card.style.top = `${p.y}px`;
      card.style.transform = p.y < 130 ? 'translate(-50%, 28px)' : 'translate(-50%, calc(-100% - 28px))';
    };
    place();
    map.on('move', place); map.on('resize', place);
    return () => { map.off('move', place); map.off('resize', place); };
  }, [world, pendingMove]);

  // ── unit tokens ──
  const canDrag = editable && canUnits && tool === 'select';
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const markers = unitMarkers.current;
    const size = compact ? 26 : 32;
    const wanted = new Set(shownUnits.map((u) => u.id));
    for (const [id, m] of [...markers]) {
      if (!wanted.has(id)) { m.marker.remove(); markers.delete(id); }
    }
    for (const u of shownUnits) {
      const color = u.owner_cabinet_id ? cabById.get(u.owner_cabinet_id)?.color ?? NOBODY : NOBODY;
      let m = markers.get(u.id);
      if (!m) {
        const el = document.createElement('div');
        const marker = new ml.Marker({ element: el, draggable: canDrag, anchor: 'center' }).setLngLat([u.lng, u.lat]).addTo(map);
        const id = u.id;
        marker.on('dragstart', () => { el.dataset.drag = '1'; });
        marker.on('dragend', () => {
          delete el.dataset.drag;
          el.dataset.dragged = '1';
          window.setTimeout(() => { delete el.dataset.dragged; }, 80);
          const ll = marker.getLngLat();
          liveRef.current?.onUnitMoved(id, ll.lng, ll.lat);
        });
        const press = (ev: Event) => {
          if (el.dataset.dragged) return;
          ev.stopPropagation();
          liveRef.current?.onUnitClick(id);
        };
        el.addEventListener('click', press);
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); press(ev); } });
        m = { marker, el, sig: '' };
        markers.set(u.id, m);
      } else if (!m.el.dataset.drag && pendingMoveRef.current?.id !== u.id) {
        m.marker.setLngLat([u.lng, u.lat]);
      }
      m.marker.setDraggable(canDrag);
      const selected = u.id === selUnit;
      const sig = `${u.kind}|${u.strength}|${color}|${selected}|${size}|${u.name}`;
      if (m.sig !== sig) {
        paintToken(m.el, { kind: u.kind, color, strength: u.strength, selected, size, name: u.name });
        m.sig = sig;
      }
    }
  }, [world, shownUnits, cabById, selUnit, canDrag, compact]);

  // ── characters (staff only; never in a preview of what a cabinet sees) ──
  const placedChars = useMemo(
    () => core.characters.filter((c) => typeof c.location_lng === 'number' && typeof c.location_lat === 'number'),
    [core.characters],
  );
  const showChars = staff && (compact || charsOn) && !(staffViewer && fogActive);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const markers = charMarkers.current;
    const list = showChars ? placedChars : [];
    const size = compact ? 24 : 34;
    const wanted = new Set(list.map((c) => c.id));
    for (const [id, m] of [...markers]) {
      if (!wanted.has(id)) { m.marker.remove(); markers.delete(id); }
    }
    for (const c of list) {
      const at: LngLat = [c.location_lng as number, c.location_lat as number];
      let m = markers.get(c.id);
      if (!m) {
        const el = document.createElement('div');
        const marker = new ml.Marker({ element: el, anchor: 'center' }).setLngLat(at).addTo(map);
        const id = c.id;
        const press = (ev: Event) => { ev.stopPropagation(); liveRef.current?.onCharClick(id); };
        el.addEventListener('click', press);
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); press(ev); } });
        m = { marker, el, sig: '' };
        markers.set(c.id, m);
      } else m.marker.setLngLat(at);
      const color = c.cabinet_id ? cabById.get(c.cabinet_id)?.color ?? NOBODY : NOBODY;
      const selected = c.id === selChar;
      const sig = `${c.name}|${c.title}|${c.picture_url}|${color}|${selected}|${size}`;
      if (m.sig !== sig) {
        paintCharacter(m.el, { name: c.name, title: c.title, picture: c.picture_url, color, selected, size, showLabel: !compact });
        m.sig = sig;
      }
    }
  }, [world, placedChars, showChars, cabById, selChar, compact]);

  useEffect(() => {
    const markers = unitMarkers.current;
    const chars = charMarkers.current;
    const labels = shapeLabels.current;
    const owners = applied.current;
    return () => {
      for (const m of markers.values()) m.marker.remove();
      markers.clear();
      for (const m of chars.values()) m.marker.remove();
      chars.clear();
      for (const m of labels.values()) m.remove();
      labels.clear();
      owners.clear();
    };
  }, []);

  // ── fog: what the viewing cabinet holds, and a small sight circle around each of its units ──
  const fogHoles = useMemo<FogHoles | null>(() => {
    if (!fogActive || !viewer || !world) return null;
    const geometries: Geometry[] = [];
    for (const [key, cab] of ownerOf) {
      if (cab !== viewer) continue;
      const m = countryMulti(key);
      if (m.length) geometries.push(toGeometry(m) as unknown as Geometry);
    }
    for (const s of shownShapes) {
      if (s.kind === 'area' && s.owner_cabinet_id === viewer) geometries.push(s.geometry as unknown as Geometry);
    }
    const circles = shownUnits
      .filter((u) => u.owner_cabinet_id === viewer)
      .map((u) => ({ lng: u.lng, lat: u.lat, km: KIND_META[u.kind].sight }));
    return { geometries, circles, rings: [] };
  }, [fogActive, viewer, world, ownerOf, countryMulti, shownUnits, shownShapes]);
  useEffect(() => {
    fogHolesRef.current = fogHoles;
    redrawFog();
  }, [fogHoles, redrawFog]);

  // ── panel ──
  const selUnitRow = selUnit ? shownUnits.find((u) => u.id === selUnit) ?? null : null;
  const selCharRow = selChar && showChars ? placedChars.find((c) => c.id === selChar) ?? null : null;

  const unitDraftOf = (u: MapUnit): UnitDraft => ({
    name: u.name, kind: u.kind, strength: u.strength, owner: u.owner_cabinet_id, note: u.note ?? '', revealed: u.revealed_to,
  });

  let panel: ReactNode = null;
  if (!compact) {
    if (draft && editable) {
      panel = (
        <NewTerritoryPanel
          key={draft.sid} phase={draft.phase} owner={draft.owner} pointCount={draft.points.length}
          minPoints={MIN_POINTS} cabinets={cabinets} busy={busy}
          onOwner={(id) => setDraft((d) => (d ? { ...d, owner: id } : d))}
          onUndo={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })}
          onFinish={() => setDraft({ ...draft, phase: 'refine' })}
          onSave={() => submitNewArea(draft)}
          onClose={() => setDraft(null)}
        />
      );
    } else if (tool === 'unit' && editable && canUnits) {
      if (addKind && newUnit) {
        panel = (
          <UnitEditor
            key="new-unit" isNew busy={busy} cabinets={cabinets}
            initial={{ name: '', kind: addKind, strength: 1, owner: defaultOwner, note: '', revealed: [] }}
            onSubmit={(d) => { void submitUnit(d, null); }} onClose={() => changeTool('select')}
          />
        );
      } else if (addKind) {
        panel = <PlaceUnitPanel kind={addKind} onBack={() => setAddKind(null)} onClose={() => changeTool('select')} />;
      } else {
        panel = <KindPicker onPick={(k) => { setNewUnit(null); setAddKind(k); }} onClose={() => changeTool('select')} />;
      }
    } else if (selUnitRow) {
      const u = selUnitRow;
      panel = editable && canUnits ? (
        <UnitEditor
          key={`${u.id}:${u.name}:${u.kind}:${u.strength}:${u.owner_cabinet_id}:${u.revealed_to.join()}:${u.note}`}
          isNew={false} busy={busy} cabinets={cabinets} initial={unitDraftOf(u)}
          onSubmit={(d) => { void submitUnit(d, u); }} onDelete={() => { void removeUnit(u); }} onClose={() => setSelUnit(null)}
        />
      ) : (
        <UnitViewer key={u.id} unit={u} cabinets={cabinets} onClose={() => setSelUnit(null)} />
      );
    } else if (selCharRow) {
      panel = (
        <CharacterCard
          key={selCharRow.id} character={selCharRow}
          cabinet={selCharRow.cabinet_id ? cabById.get(selCharRow.cabinet_id) ?? null : null} onClose={() => setSelChar(null)}
        />
      );
    } else if (selTerr && selValid) {
      const t = selTerr;
      const isCountry = t.kind === 'country';
      panel = (
        <TerritoryCard
          key={isCountry ? `c:${t.key}` : `a:${t.id}`}
          name={nameOf(t, data)} kind={t.kind} owner={selOwner} cabinets={cabinets}
          editable={editable && canMap} detailed={selDetailed} busy={busy}
          edited={isCountry ? overrides.has(t.key) : false}
          onOwner={(id) => pickOwner(t, id)}
          onReset={isCountry ? () => { const b = baseShapes.get(t.key)?.multi; if (b) commitOutline(t, b, true); } : undefined}
          onDelete={!isCountry ? () => removeArea(t.id) : undefined}
          onClose={() => setSelTerr(null)}
        />
      );
    }
  }

  // ── controls ──
  const viewOptions = [{ value: 'all', label: 'Crisis team' }, ...cabinets.map((c) => ({ value: c.id, label: c.short }))];
  const viewerCabinet = viewer ? cabById.get(viewer) : null;
  const showAdd = editable && canUnits;

  const hint = compact ? null
    : tool === 'unit' && addKind && !newUnit ? `Click the map to place the ${KIND_META[addKind].label.toLowerCase()}.`
      : draft ? null
        : canEditTerr && selTerr && selValid ? 'Press on the red outline and drag to move the border.'
          : tool === 'borders' && editable && canMap ? 'Click a country to select it, or click the sea to draw new territory.'
            : null;

  const compactInfo = compact && selUnitRow
    ? `${selUnitRow.name} · ${KIND_META[selUnitRow.kind].label} · ${fmtAmount(selUnitRow.strength)}`
    : null;

  const viewControl = staff ? (
    cabinets.length <= (compact ? 3 : 4) ? (
      <Segmented value={staffViewer ?? 'all'} options={viewOptions} onChange={changeView} ariaLabel="See the map as" />
    ) : (
      <div style={{ minWidth: compact ? 160 : 200 }}>
        <GSelect size="sm" value={staffViewer ?? 'all'} options={viewOptions} onChange={changeView} aria-label="See the map as" />
      </div>
    )
  ) : viewerCabinet ? (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>Viewing as {viewerCabinet.name}</span>
  ) : null;

  return (
    <div className="wm-root" data-compact={compact ? '1' : undefined}>
      <style>{MAP_CSS}</style>

      {compact ? (
        <div className="wm-top">
          {title && <div className="wm-top-title">{title}</div>}
          {viewControl}
          {actions && <div className="wm-top-actions">{actions}</div>}
        </div>
      ) : (
        <>
          <div className="wm-top">
            <div className="wm-top-title">{title}</div>
            {viewControl}
          </div>
          <div className="wm-tools" role="toolbar" aria-label="Map tools">
            <button type="button" className="wm-tool" aria-pressed={tool === 'select'} onClick={() => changeTool('select')} title="Select a unit, a country or a territory">
              <MousePointer2 size={17} strokeWidth={1.5} /><span>Select</span>
            </button>
            {editable && canMap && (
              <button type="button" className="wm-tool" aria-pressed={tool === 'borders'} onClick={() => changeTool('borders')} title="Change who holds land and where borders run">
                <Flag size={17} strokeWidth={1.5} /><span>Borders</span>
              </button>
            )}
            <span className="wm-tool-sep" aria-hidden />
            {staff && (
              <button
                type="button" className="wm-tool" aria-pressed={fogOn && !!staffViewer} disabled={!staffViewer}
                onClick={() => setFogOn((f) => !f)}
                title={staffViewer ? 'Hide or show what this side cannot see' : 'Pick a side above to see its fog of war'}
              >
                <Cloud size={17} strokeWidth={1.5} /><span>Fog of war</span>
              </button>
            )}
            {staff && (
              <button
                type="button" className="wm-tool" aria-pressed={charsOn} onClick={() => setCharsOn((c) => !c)}
                title={placedChars.length ? 'Show or hide where the characters are' : 'No character has a place on the map yet'}
              >
                <UserRound size={17} strokeWidth={1.5} /><span>Characters</span>
              </button>
            )}
            <button type="button" className="wm-tool" aria-pressed={false} onClick={fitView} title="Fit the units in view">
              <Maximize2 size={17} strokeWidth={1.5} /><span>Fit view</span>
            </button>
          </div>
        </>
      )}

      <div className="wm-body">
        <div className="wm-stage">
          <div ref={hostRef} className="wm-map" role="application" aria-label="Map. Drag to move, pinch or scroll to zoom." />
          {!world && !mapError && !loadError && (
            <div className="animate-pulse" style={{ position: 'absolute', inset: 0, background: 'rgba(110,30,30,0.06)' }} aria-busy="true" />
          )}
          {(mapError || loadError) && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontSize: 14, color: CK.inkSoft, background: 'rgba(255,255,255,0.6)' }}>
              <div>
                <p style={{ margin: '0 0 10px' }}>{mapError ?? loadError}</p>
                {!mapError && <button type="button" className="wm-tool" style={{ margin: '0 auto' }} onClick={() => { void reload(); }}>Try again</button>}
              </div>
            </div>
          )}
          {!mapReady && !mapError && !loadError && (
            <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.55)', pointerEvents: 'none' }}>
              <span className="inline-flex items-center" style={{ gap: 10, fontFamily: CK.font, fontSize: 14, fontWeight: 700, color: CK.ink }}>
                <span className="animate-spin" aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', border: `2.5px solid ${CK.hair}`, borderTopColor: CK.ink }} />
                Loading the map
              </span>
            </div>
          )}
          {undo && !compact && (
            <div role="status" className="wm-undo" style={{ fontFamily: CK.font }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>{undo.text}</span>
                {undo.note && <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{undo.note}</span>}
              </span>
              <Btn size="sm" tone="ghost" disabled={busy} onClick={undo.restore}>Undo</Btn>
            </div>
          )}
          {hint && <div className="wm-hint">{hint}</div>}
          {showAdd && (
            <button
              type="button" className="wm-add" aria-pressed={tool === 'unit'} title="Add a unit"
              onClick={() => changeTool(tool === 'unit' ? 'select' : 'unit')}
            >
              <span className="wm-add-icons"><Plus size={26} strokeWidth={1.5} /><Ship size={19} strokeWidth={1.5} /></span>
              <span>Add unit</span>
            </button>
          )}
          {pendingMove && (
            <div ref={moveCard} className="wm-move" role="group" aria-label="Confirm the move" style={{ fontFamily: CK.font }}>
              <p style={{ margin: '0 0 9px', fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>Move {pendingMove.name} here?</p>
              <div className="flex" style={{ gap: 8 }}>
                <Btn size="sm" disabled={busy} onClick={confirmMove}>Move</Btn>
                <Btn size="sm" tone="ghost" onClick={cancelMove}>Cancel</Btn>
              </div>
            </div>
          )}
        </div>

        {panel && <div className="wm-drawer" data-add={showAdd ? '' : undefined}>{panel}</div>}

        <div className="wm-legend">
          <div>
            {cabinets.map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}</span>)}
            {fogActive && !compact && <span><i style={{ border: `1.5px dashed ${CK.red}`, background: 'transparent' }} />Sight range</span>}
            {compactInfo && <b style={{ color: CK.ink }}>{compactInfo}</b>}
          </div>
          {!compact && <div>{last ? `Last change ${clock(last.at)} · ${last.text}` : staff ? 'No changes yet this visit' : 'Updates live'}</div>}
        </div>
      </div>
    </div>
  );
}
