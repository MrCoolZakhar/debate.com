'use client';
// Gavelling Crisis: the map.
// A real-world map drawn offline (Natural Earth 50m through world-atlas) with MapLibre GL and a blank
// style: no tile server, no glyph server, no third-party request. A territory is a country (held by a
// cabinet, with an outline this crisis may have changed) or a drawn area. Staff with map power select a
// territory and drag its outline; land it grows over is cut out of every other side's territory
// (src/lib/crisis/geo.ts), so two sides never hold the same ground. Units are round tokens, characters are
// portraits (staff only), and the fog of war is a hatched canvas with a small sight circle around each of
// the viewing cabinet's units. Every change is saved through src/lib/crisis/api.ts and logged by the database.
// With the setting "Map changes wait until you send them" the crisis team's edits go into one shared draft
// (crisis_map_drafts) shown over the sent map; Send to delegates applies it in one transaction.

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GeoJSONSource, Map as MLMap, MapMouseEvent, Marker as MLMarker } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Building2, Cloud, Eye, Flag, Maximize2, MousePointer2, Pencil, Plus, Send, Ship, Undo2, UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { readMapFocus, type MapFocus } from '@/lib/crisis/mapFocus';
import {
  crisisError, deleteUnit, loadMap, loadMapDraft, saveCharacter, saveMapDraft, saveUnit,
} from '@/lib/crisis/api';
import {
  AREA_EPS, HANDLE_LIMIT, applyTent, areaOf, bboxOf, clean, differenceM, kmBetween, labelPoint, nearestEdge, ownersTouching, pickClaimTarget,
  planClaim, pointIn, tentRegion, toGeometry, toMulti, vertexCount, withCornerAdded, withCornerMoved, withCornerRemoved,
  type Bbox, type ClaimPlan, type ClaimTerr, type EdgeHit, type Multi, type Pt, type ScreenPt,
} from '@/lib/crisis/geo';
import { useCrisisLive } from '@/lib/crisis/live';
import { applyLocal, diffData, emptySet, isEmptySet, parseSet, saveSet, setSize, type EditSet, type MapData, type StageOptions, type UnitChange } from './mapEdits';
import type { MapShape, MapUnit, UnitKind } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, CK, Segmented, cabinetTint } from '../../crisisKit';
import { mayEditCharacters } from '../character/characterStatus';
import { drawFog, type FogHoles } from './fog';
import { freehandCorners, type FreePt } from './freehand';
import { SIGHT_MAX_KM, kmFromPointer, kmText, sightHandleAt, sightKmOf, sightRing } from './sight';
import {
  addCityLayers, createCityLabels, fillCities, loadCities, setCitiesVisible, type City,
} from './cities';
import {
  KIND_META, centroidOf, clampLat, clampLng, loadWorldData, shapePoints, type CountryLabel, type LngLat, type WorldData,
} from './mapData';
import {
  BLANK_STYLE, DRAFT, L_BASE_FILL, L_LAND, L_SHAPE_FILL, NOBODY, SRC_BASE, SRC_COUNTRIES, SRC_DRAFT, SRC_EDIT, SRC_HOVER, SRC_PLANS,
  SRC_SEL, SRC_SHAPES, SRC_SIGHT, editLayers, mapLayers,
} from './mapStyle';
import {
  CharacterCard, KindPicker, NewTerritoryPanel, PlaceUnitPanel, TerritoryCard, UnitEditor, UnitViewer, type PanelCabinet, type UnitDraft,
} from './MapPanels';
import {
  MAP_CSS, makeCorner, makeCountryLabel, makeGhost, makeMidpoint, makeShapeLabel, makeSightHandle, makeVertex,
  paintCharacter, paintToken, safeColor,
} from './tokens';

type Tool = 'select' | 'borders' | 'draw' | 'unit';
type TerrRef = { kind: 'country'; key: string } | { kind: 'area'; id: string };

/** A new territory being drawn with the Borders tool. */
interface Draft {
  sid: number;
  phase: 'draw' | 'refine';
  points: LngLat[];
  owner: string | null;
  /** True once someone picked the holder (Nobody included); until then it follows the land the shape touches. */
  ownerChosen: boolean;
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

interface UndoChip { sid: number; text: string; note: string | null }

/** One step Go back can undo. */
interface HistoryStep { text: string; undo: () => void | Promise<void> }

const HISTORY_MAX = 60;

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
  onUnitDrag: (id: string, lng: number, lat: number) => void;
  onCharMoved: (id: string, lng: number, lat: number) => void;
  redrawFog: () => void;
  regroupChars: () => void;
  /** Backs out of whatever is open; answers whether it did anything. */
  escape: () => boolean;
}

const MIN_POINTS = 3;
const EDGE_PX = 12;
/** Pressing within this many px of a sight ring's line grabs it. */
const RING_HIT_PX = 9;
/** The sight handle never sits closer than this to its unit (the token is about 16 px across). */
const HANDLE_MIN_PX = 28;
const emptyFc: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Runs a style call (feature state, layer settings) so it can never throw while the style is still loading.
 * If the style is not ready it waits for the map to settle and tries once more; after that it gives up quietly
 * (the next change of data runs it again).
 */
function whenStyleReady(map: MLMap, fn: () => void): void {
  const attempt = (): boolean => {
    try { fn(); return true; } catch { return false; }
  };
  if (attempt()) return;
  let tries = 0;
  const retry = () => {
    tries += 1;
    if (attempt() || tries >= 3) return;
    map.once('idle', retry);
  };
  map.once('idle', retry);
}

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

/** The Undo chip's small note when an edit swallowed a territory whole. */
function goneNote(gone: string[]): string | null {
  return gone.length ? `${gone.join(', ')} ${gone.length === 1 ? 'was' : 'were'} fully taken` : null;
}

function areaGeometry(m: Multi): MapShape['geometry'] {
  return toGeometry(m) as MapShape['geometry'];
}

/**
 * The war map. With `stage` it is the same map used inside a directive's reply: nothing is saved or read from the
 * database, every change is handed back to the reply (stage.onData / stage.onUnitMove) and is only written when
 * the reply is sent.
 */
export default function WarMap({ compact = false, title, actions, stage }: { compact?: boolean; title?: ReactNode; actions?: ReactNode; stage?: StageOptions }) {
  const v = useCrisis();
  const { ref, cabinetId, staff, director, settings, core } = v;
  const canMap = stage ? stage.canMap : staff && (director || settings.backroomPowers.map);
  const canUnits = stage ? stage.canUnits : staff && (director || settings.backroomPowers.units);

  const cabinets = useMemo<PanelCabinet[]>(
    () => core.cabinets.map((c) => ({ id: c.id, name: c.name, short: c.short_name || c.name, color: safeColor(c.color) })),
    [core.cabinets],
  );
  const cabById = useMemo(() => new Map(cabinets.map((c) => [c.id, c])), [cabinets]);

  // ── data ──
  const isStage = !!stage;
  const stageKind = stage?.kind ?? null;
  const stageRef = useRef(stage);
  useEffect(() => { stageRef.current = stage; });
  // rawData is the sent map (what delegates see). The crisis team's unsent draft (draftSet) is laid over it.
  const [rawData, setData] = useState<MapData | null>(() => stage?.data ?? null);
  const [draftSet, setDraftSet] = useState<EditSet | null>(null);
  const draftRef = useRef<EditSet | null>(null);
  const rawRef = useRef<MapData | null>(null);
  const dataRef = useRef<MapData | null>(null);
  // In a reply, units already moved by it show at their new place (the unit's real place stays in rawData).
  const stageMoves = stage?.moves;
  const overlaid = useMemo<MapData | null>(() => {
    if (!rawData || isStage || !draftSet || isEmptySet(draftSet)) return rawData;
    return applyLocal(rawData, draftSet, ref.id);
  }, [rawData, draftSet, isStage, ref.id]);
  const data = useMemo<MapData | null>(() => {
    if (!overlaid || !stageMoves || !Object.keys(stageMoves).length) return overlaid;
    return { ...overlaid, units: overlaid.units.map((u) => (stageMoves[u.id] ? { ...u, lng: stageMoves[u.id].lng, lat: stageMoves[u.id].lat } : u)) };
  }, [overlaid, stageMoves]);
  const draftCount = setSize(draftSet);
  // Staff edits wait in the shared draft while the setting is on (never inside a directive's reply).
  const draftMode = staff && !isStage && settings.mapChangesWait && (canMap || canUnits);
  const draftModeRef = useRef(false);
  useEffect(() => { draftModeRef.current = draftMode; draftRef.current = draftSet; });
  const [loadError, setLoadError] = useState<string | null>(null);
  const writes = useRef(0);
  const seq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [last, setLast] = useState<{ at: number; text: string } | null>(null);

  useEffect(() => { dataRef.current = data; rawRef.current = rawData; }, [data, rawData]);

  const reload = useCallback(async () => {
    if (isStage) return;   // a reply's map is only what the reply stages
    const mine = ++seq.current;
    try {
      const [d, dr] = await Promise.all([
        loadMap(ref),
        staff ? loadMapDraft(ref).catch(() => undefined) : Promise.resolve(null),
      ]);
      if (mine !== seq.current || writes.current > 0) return;
      setData(d);
      if (dr !== undefined) setDraftSet(parseSet(dr));
      setLoadError(null);
    } catch (e) {
      if (mine === seq.current) setLoadError(crisisError(e, 'Could not load the map.'));
    }
  }, [ref, isStage, staff]);

  useEffect(() => { void reload(); }, [reload]);

  useCrisisLive(isStage ? null : ref.id, ['crisis_map_regions', 'crisis_map_drafts', 'crisis_units', 'crisis_shapes', 'crisis_cabinets'], (changed, pings) => {
    const p = pings[pings.length - 1];
    if (p) {
      let text = '';
      if (p.t === 'crisis_units') {
        const name = dataRef.current?.units.find((u) => u.id === p.id)?.name;
        text = p.op === 'insert' ? 'A unit was added' : p.op === 'delete' ? `${name ?? 'A unit'} was removed` : `${name ?? 'A unit'} was updated`;
      } else if (p.t === 'crisis_map_regions') text = 'A border changed';
      else if (p.t === 'crisis_shapes') text = 'A territory or line changed';
      else if (p.t === 'crisis_map_drafts') text = 'The team changed the unsent map';
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
  const [rangesOn, setRangesOn] = useState(true);
  const [citiesOn, setCitiesOn] = useState(true);
  const staffViewer = viewAs !== 'all' && cabById.has(viewAs) ? viewAs : null;
  const viewer: string | null = staff ? staffViewer : cabinetId;
  const fogActive = !!viewer && (staff && !compact ? fogOn : true);

  // What the viewer sees. A delegate gets only what the database lets their cabinet see (its own units, units
  // shown to it, and any unit inside one of its sight circles). Staff looking as a cabinet get the same rule here.
  // A spy is never spotted: only its own cabinet and the cabinets it was shown to (revealed_to) see it, even on
  // their land or inside their sight range (the database enforces the same in crisis_units RLS).
  const shownUnits = useMemo(() => {
    const all = data?.units ?? [];
    if (!staff || !viewer) return all;
    const own = all.filter((u) => u.owner_cabinet_id === viewer);
    return all.filter((u) => u.owner_cabinet_id === viewer || u.revealed_to.includes(viewer)
      || (u.kind !== 'spy' && own.some((o) => kmBetween([o.lng, o.lat], [u.lng, u.lat]) <= sightKmOf(o))));
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
  const stageUnitId = stage?.unitId ?? null;
  useEffect(() => { if (stageKind === 'unit') setSelUnit(stageUnitId); }, [stageKind, stageUnitId]);
  const [addKind, setAddKind] = useState<UnitKind | null>(null);
  const [newUnit, setNewUnit] = useState<{ lng: number; lat: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const unitMarkers = useRef(new Map<string, { marker: MLMarker; el: HTMLElement; sig: string }>());
  const charMarkers = useRef(new Map<string, { marker: MLMarker; el: HTMLElement; sig: string }>());
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const pendingMoveRef = useRef<PendingMove | null>(null);
  const dragRef = useRef<OutlineDrag | null>(null);
  const suppressClickUntil = useRef(0);
  /** A path being dragged with the Draw tool, and the head of the move arrow. */
  const freeRef = useRef<{ pts: FreePt[] } | null>(null);
  const freeFrame = useRef<number | null>(null);
  const arrowSvg = useRef<SVGSVGElement>(null);
  const dragTip = useRef<HTMLDivElement>(null);

  // New units go to the cabinet being viewed, else the first cabinet. New territory never defaults to the first
  // cabinet: it takes the cabinet it touches, or asks.
  const defaultOwner = viewer ?? cabinets[0]?.id ?? null;
  const draftColor = draft && draft.owner ? cabById.get(draft.owner)?.color ?? null : null;

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

  // Looking through another cabinet's eyes starts again from Select.
  const changeView = useCallback((val: string) => { setViewAs(val); changeTool('select'); }, [changeTool]);

  // Staff can still add units and change borders while looking through a cabinet's eyes.
  const editable = stage ? stage.kind === 'border' : staff && !compact;
  const canEditTerr = editable && canMap && tool !== 'unit' && tool !== 'draw' && !draft;

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
  const fogLatest = useRef<FogHoles | null>(null);
  const fogFrame = useRef<number | null>(null);
  const liveRef = useRef<Live | null>(null);
  const labelsRef = useRef<CountryLabel[]>([]);
  const syncLabelsRef = useRef<(() => void) | null>(null);
  const cityCtl = useRef<ReturnType<typeof createCityLabels> | null>(null);
  const citiesRef = useRef<City[]>([]);
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
    const map = mapRef.current;
    if (!map) return;
    try { (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc); } catch { /* the style is still loading: the next change sets it */ }
  }, []);

  // ── names ──
  const nameOf = useCallback((t: TerrRef, d: MapData | null): string => {
    if (t.kind === 'country') return world?.byKey.get(t.key)?.name ?? 'This country';
    return d?.shapes.find((s) => s.id === t.id)?.label || 'A drawn territory';
  }, [world]);

  // ── undo ──
  const [undo, setUndo] = useState<UndoChip | null>(null);
  const historyRef = useRef<HistoryStep[]>([]);
  const [historyN, setHistoryN] = useState(0);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 12000);
    return () => window.clearTimeout(t);
  }, [undo]);

  // ── the move arrow ──
  // From where the unit is now to where the pointer is (while it is dragged) or where it was dropped (while
  // the move waits for a yes). It is drawn as a small SVG laid over the map and moved in the same frame as the
  // token, so the line always reaches the arrowhead. The tip beside it says what is being moved and how far;
  // it only shows while the unit is being dragged (the confirm card says the same afterwards).
  const showMove = useCallback((u: MapUnit | null, to: LngLat | null, withTip = true) => {
    const map = mapRef.current;
    const svg = arrowSvg.current;
    const tip = dragTip.current;
    if (!map) return;
    const part = (name: string) => svg?.querySelector<SVGElement>(`[data-p="${name}"]`) ?? null;
    if (!u || !to) {
      if (svg) svg.style.display = 'none';
      if (tip) tip.style.display = 'none';
      return;
    }
    const from: LngLat = [u.lng, u.lat];
    const a = map.project(from); const b = map.project(to);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (svg) {
      svg.style.display = 'block';
      const ux = len ? (b.x - a.x) / len : 0; const uy = len ? (b.y - a.y) / len : 0;
      // The head's tip sits just short of the unit's token; the line runs from the unit to the head's base.
      const showHead = len >= 44;
      const tipX = showHead ? b.x - ux * 20 : b.x; const tipY = showHead ? b.y - uy * 20 : b.y;
      const baseX = showHead ? tipX - ux * 15 : b.x; const baseY = showHead ? tipY - uy * 15 : b.y;
      for (const n of ['halo', 'line']) {
        const l = part(n);
        l?.setAttribute('x1', String(a.x)); l?.setAttribute('y1', String(a.y));
        l?.setAttribute('x2', String(baseX + ux * 1.5)); l?.setAttribute('y2', String(baseY + uy * 1.5));
      }
      const head = part('head');
      if (head) {
        head.style.display = showHead ? 'block' : 'none';
        const px = -uy * 9; const py = ux * 9;
        head.setAttribute('points', `${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`);
      }
      const origin = part('from');
      origin?.setAttribute('cx', String(a.x)); origin?.setAttribute('cy', String(a.y));
    }
    if (tip) {
      if (!withTip) { tip.style.display = 'none'; return; }
      const owner = u.owner_cabinet_id ? cabById.get(u.owner_cabinet_id)?.name ?? 'A cabinet' : 'Nobody';
      const name = document.createElement('b'); name.textContent = u.name;
      const what = document.createElement('div'); what.textContent = `${KIND_META[u.kind].label} · ${fmtAmount(u.strength)} · ${owner}`;
      const dist = document.createElement('div');
      dist.append('Distance so far: ');
      const km = document.createElement('i'); km.textContent = kmText(kmBetween(from, to)); dist.append(km);
      tip.replaceChildren(name, what, dist);
      tip.style.display = 'block';
      const w = map.getContainer().clientWidth;
      const tw = tip.offsetWidth; const th = tip.offsetHeight;
      const left = b.x + 28 + tw > w - 8 ? b.x - 28 - tw : b.x + 28;
      tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, b.y - th / 2)}px)`;
    }
  }, [cabById]);

  // ── actions ──
  const pushHistory = useCallback((step: HistoryStep) => {
    historyRef.current = [...historyRef.current, step].slice(-HISTORY_MAX);
    setHistoryN(historyRef.current.length);
  }, []);
  const clearHistory = useCallback(() => { historyRef.current = []; setHistoryN(0); setUndo(null); }, []);

  /** Go back: undoes the last thing done (several steps). */
  const goBack = useCallback(() => {
    const step = historyRef.current[historyRef.current.length - 1];
    if (!step) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryN(historyRef.current.length);
    setUndo(null);
    void step.undo();
  }, []);

  /** The shared draft is written one request at a time, in order, so the last change is the one that stays. */
  const draftChain = useRef<Promise<void>>(Promise.resolve());
  const persistDraft = useCallback((set: EditSet | null): Promise<void> => {
    const job = draftChain.current.then(() => saveMapDraft(ref, set && !isEmptySet(set) ? (set as unknown as Record<string, unknown>) : null));
    draftChain.current = job.catch(() => undefined);
    return job;
  }, [ref]);

  /**
   * Shows a set of map changes at once, then keeps them: in the shared draft (when changes wait until sent), in the
   * database (live), or only in the reply (a directive's map). `undoOf` builds the set that puts them back.
   */
  const applyEdits = useCallback(async (
    set: EditSet, text: string, undoOf: ((ids: string[]) => EditSet) | null, note: string | null = null,
    opts: { noHistory?: boolean; fail?: string } = {},
  ) => {
    const before = dataRef.current;
    if (!before || isEmptySet(set)) return;
    const fail = opts.fail ?? 'Could not change the border.';
    const record = (ids: string[]) => {
      setLast({ at: new Date().getTime(), text });
      if (undoOf && !opts.noHistory) {
        const back = undoOf(ids);
        pushHistory({ text, undo: () => applyEdits(back, 'You went back', null, null, { noHistory: true, fail }) });
        setUndo({ sid: new Date().getTime(), text, note });
      } else setUndo(null);
    };
    if (draftModeRef.current) {
      // Built from the sent map and the draft as they are right now, so two quick edits never lose the first.
      const sent = rawRef.current ?? before;
      const current = draftRef.current ? applyLocal(sent, draftRef.current, ref.id) : sent;
      const shown = applyLocal(current, set, ref.id);
      const next = diffData(sent, shown);
      const prev = draftRef.current;
      draftRef.current = isEmptySet(next) ? null : next;
      setDraftSet(draftRef.current);
      await run(async () => {
        try {
          await persistDraft(draftRef.current);
          record(set.addShapes.map((a) => a.id));
        } catch (e) {
          draftRef.current = prev;
          setDraftSet(prev);
          notifyErr(crisisError(e, fail), 'crisis-map');
        }
      });
      return;
    }
    // A reply's moves are laid over the map for show only; they are not part of the border changes handed back.
    const base = rawRef.current ?? before;
    const shown = applyLocal(base, set, ref.id);
    setData(shown);
    stageRef.current?.onData?.(shown);
    await run(async () => {
      try {
        // In a reply nothing is saved: the added territories keep their local ids, and the reply keeps the result.
        record(isStage ? set.addShapes.map((a) => a.id) : await saveSet(ref, set));
      } catch (e) {
        setData(base);
        stageRef.current?.onData?.(base);
        notifyErr(crisisError(e, fail), 'crisis-map');
      }
    });
  }, [ref, run, isStage, persistDraft, pushHistory]);

  const moveUnit = useCallback(async (id: string, lng: number, lat: number) => {
    const before = dataRef.current;
    const unit = before?.units.find((u) => u.id === id);
    if (!before || !unit) return;
    const nl = round5(clampLng(lng)); const nt = round5(clampLat(lat));
    if (isStage) { stageRef.current?.onUnitMove?.(id, nl, nt); return; }   // a reply only plans the move
    const set = emptySet(); const back = emptySet();
    set.units.push({ id, lng: nl, lat: nt });
    back.units.push({ id, lng: unit.lng, lat: unit.lat });
    await applyEdits(set, `You moved ${unit.name}`, () => back, null, { fail: 'Could not move the unit.' });
  }, [applyEdits, isStage]);

  /** Every territory but `t`, for working out who loses land. */
  const othersFor = useCallback((t: TerrRef | null, d: MapData): ClaimTerr[] => {
    const owner = new Map(d.regions.map((r) => [r.region_key, r.owner_cabinet_id]));
    const list: ClaimTerr[] = [];
    for (const [key, b] of baseRef.current) {
      if (t?.kind === 'country' && t.key === key) continue;
      const o = storedOutline(d, key);
      list.push({ id: `c:${key}`, kind: 'country', owner: owner.get(key) ?? null, multi: o ?? b.multi, bbox: o ? bboxOf(o) : b.bbox });
    }
    for (const s of d.shapes) {
      if (s.kind !== 'area' || (t?.kind === 'area' && t.id === s.id)) continue;
      const m = toMulti(s.geometry);
      list.push({ id: `a:${s.id}`, kind: 'area', owner: s.owner_cabinet_id, multi: m, bbox: bboxOf(m) });
    }
    return list;
  }, []);

  /**
   * Puts what a claim took from others, and the drawn areas it joined in, into `set` (and what undoes them).
   * Answers the names of the territories that lost all their land, for the Undo chip.
   */
  const writePlan = useCallback((plan: ClaimPlan, d: MapData, set: EditSet, back: EditSet): string[] => {
    const gone: string[] = [];
    for (const c of plan.cuts) {
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
    for (const id of plan.absorbed) {
      const shape = d.shapes.find((s) => s.id === id);
      if (!shape) continue;
      set.removeShapes.push(id);
      back.addShapes.push(shape);
    }
    return gone;
  }, [world]);

  /**
   * Saves a territory's new outline. Land it gained joins the cabinet's own land it touches and is cut out of every
   * other territory (the same rule for dragging a border and for drawing). `knownGrowth` is the land gained when
   * the caller already knows it (a bend outwards); otherwise it is worked out from the outlines.
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
      const row = t.kind === 'country' ? d.regions.find((r) => r.region_key === t.key) : undefined;
      const shape = t.kind === 'area' ? d.shapes.find((s) => s.id === t.id) : undefined;
      if (t.kind === 'area' && !shape) return;
      const owner = t.kind === 'country' ? row?.owner_cabinet_id ?? null : shape?.owner_cabinet_id ?? null;
      const growth = knownGrowth ?? differenceM(next, prev);
      const plan = planClaim(growth, owner, { id: t.kind === 'country' ? `c:${t.key}` : `a:${t.id}`, multi: next }, othersFor(t, d), !reset && !!owner && areaOf(growth) > AREA_EPS);
      gone = writePlan(plan, d, set, back);
      if (t.kind === 'country') {
        set.regions.push({ key: t.key, owner_cabinet_id: owner, geometry: reset ? null : toGeometry(plan.land) });
        back.regions.push({ key: t.key, owner_cabinet_id: owner, geometry: row?.geometry ?? null });
      } else if (shape) {
        set.shapes.push({ id: t.id, geometry: areaGeometry(plan.land) });
        back.shapes.push({ id: t.id, geometry: shape.geometry });
      }
    } catch {
      notifyErr('That border could not be worked out. Try a smaller move.', 'crisis-map');
      return;
    }
    void applyEdits(set, reset ? `You put back the real border of ${name}` : `You moved the border of ${name}`, () => back, goneNote(gone));
  }, [writePlan, othersFor, applyEdits, nameOf]);

  const pickOwner = useCallback((t: TerrRef, owner: string | null) => {
    const d = dataRef.current;
    if (!d) return;
    const name = nameOf(t, d);
    const who = owner ? cabById.get(owner)?.name ?? 'a cabinet' : 'nobody';
    const set = emptySet(); const back = emptySet();
    if (t.kind === 'country') {
      const row = d.regions.find((r) => r.region_key === t.key);
      const current = row?.owner_cabinet_id ?? null;
      if (current === owner) return;
      set.regions.push({ key: t.key, owner_cabinet_id: owner, geometry: row?.geometry ?? null });
      back.regions.push({ key: t.key, owner_cabinet_id: current, geometry: row?.geometry ?? null });
    } else {
      const shape = d.shapes.find((s) => s.id === t.id);
      if (!shape || shape.owner_cabinet_id === owner) return;
      set.owners.push({ id: t.id, owner_cabinet_id: owner });
      back.owners.push({ id: t.id, owner_cabinet_id: shape.owner_cabinet_id });
    }
    void applyEdits(set, `You gave ${name} to ${who}`, () => back);
  }, [cabById, nameOf, applyEdits]);

  /**
   * Saves a newly drawn territory. It joins the territory of its cabinet that it touches or overlaps (building on
   * your own land just extends it); the ground it covers is taken from everybody else.
   */
  const submitNewArea = useCallback((dr: Draft) => {
    const d = dataRef.current;
    if (!d || dr.points.length < MIN_POINTS) return;
    if (!dr.ownerChosen && dr.owner === null) { notifyErr('Choose who holds this land first.', 'crisis-map'); return; }
    const set = emptySet(); const back = emptySet();
    let gone: string[] = [];
    let text = 'You drew new territory';
    let grown = false;
    try {
      const multi = clean(toMulti({ type: 'Polygon', coordinates: [[...dr.points, dr.points[0]]] }));
      if (areaOf(multi) <= AREA_EPS) { notifyErr('That shape has no area. Draw at least three points apart.', 'crisis-map'); return; }
      const others = othersFor(null, d);
      const target = pickClaimTarget(multi, dr.owner, others);
      const growth = target ? differenceM(multi, target.multi) : multi;
      const holder = dr.owner ? cabById.get(dr.owner)?.name ?? 'that cabinet' : 'nobody';
      if (target && areaOf(growth) <= AREA_EPS) { notifyErr(`That land already belongs to ${holder}.`, 'crisis-map'); return; }
      const plan = planClaim(growth, dr.owner, target ? { id: target.id, multi: target.multi } : null, others, !!dr.owner);
      if (!plan.land.length) { notifyErr('That shape has no land of its own to claim. Draw it over land nobody holds.', 'crisis-map'); return; }
      gone = writePlan(plan, d, set, back);
      if (target) {
        grown = true;
        if (target.id.startsWith('c:')) {
          const key = target.id.slice(2);
          const row = d.regions.find((r) => r.region_key === key);
          set.regions.push({ key, owner_cabinet_id: dr.owner, geometry: toGeometry(plan.land) });
          back.regions.push({ key, owner_cabinet_id: dr.owner, geometry: row?.geometry ?? null });
          text = `You extended ${world?.byKey.get(key)?.name ?? 'a country'}`;
        } else {
          const id = target.id.slice(2);
          const shape = d.shapes.find((s) => s.id === id);
          if (!shape) return;
          set.shapes.push({ id, geometry: areaGeometry(plan.land) });
          back.shapes.push({ id, geometry: shape.geometry });
          text = `You extended ${shape.label || 'a drawn territory'}`;
        }
      } else {
        set.addShapes.push({
          id: `new-${dr.sid}`, crisis_id: ref.id, kind: 'area', owner_cabinet_id: dr.owner, label: null, color: null,
          geometry: areaGeometry(plan.land), public: true, revealed_to: [],
        });
      }
    } catch {
      notifyErr('That shape could not be worked out. Try drawing it again.', 'crisis-map');
      return;
    }
    setDraft(null);
    notifyOk(isStage ? 'Territory added to the reply' : draftModeRef.current ? 'Territory added to the unsent changes' : 'Territory saved', 'crisis-map');
    void applyEdits(set, text, grown ? () => back : (ids) => ({ ...back, removeShapes: [...back.removeShapes, ...ids] }), goneNote(gone));
  }, [ref.id, othersFor, writePlan, applyEdits, isStage, cabById, world]);

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

  /** The saved row of a unit, as the database takes it (for putting an edit back). */
  const unitRow = (u: MapUnit) => ({
    name: u.name, kind: u.kind, strength: u.strength, owner_cabinet_id: u.owner_cabinet_id, note: u.note, revealed_to: u.revealed_to,
    sight_km: u.sight_km ?? null,
  });

  /** Puts a unit's earlier details back (Go back after an edit). */
  const revertUnit = useCallback(async (prev: MapUnit) => {
    const before = rawRef.current;
    if (before) setData({ ...before, units: before.units.map((u) => (u.id === prev.id ? { ...u, ...unitRow(prev) } : u)) });
    await run(async () => {
      try {
        await saveUnit(ref, { id: prev.id, ...unitRow(prev) });
        setLast({ at: new Date().getTime(), text: `You put back ${prev.name}` });
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not put the unit back.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  /** Removes a unit by id (Go back after adding one). */
  const dropUnit = useCallback(async (id: string) => {
    const before = rawRef.current;
    if (before) setData({ ...before, units: before.units.filter((x) => x.id !== id) });
    setSelUnit((cur) => (cur === id ? null : cur));
    await run(async () => {
      try {
        await deleteUnit(ref, id);
        setLast({ at: new Date().getTime(), text: 'You removed a unit' });
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not remove the unit.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  /** Adds a removed unit back (Go back after deleting one); it comes back under a new id. */
  const restoreUnit = useCallback(async (u: MapUnit) => {
    await run(async () => {
      try {
        await saveUnit(ref, { ...unitRow(u), lng: u.lng, lat: u.lat });
        setLast({ at: new Date().getTime(), text: `You put back ${u.name}` });
      } catch (e) {
        notifyErr(crisisError(e, 'Could not put the unit back.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  const submitUnit = useCallback(async (dd: UnitDraft, existing: MapUnit | null) => {
    const before = rawRef.current;
    const patch = {
      name: dd.name.trim(), kind: dd.kind, strength: dd.strength, owner_cabinet_id: dd.owner,
      note: dd.note.trim() ? dd.note.trim() : null, revealed_to: dd.revealed,
      ...(existing || dd.sight !== null ? { sight_km: dd.sight } : {}),
    };
    // Amount and sight range are map changes: they wait in the draft with the moves. The rest saves at once.
    if (existing && !isStage && draftModeRef.current) {
      const same = patch.name === existing.name && patch.kind === existing.kind && patch.owner_cabinet_id === existing.owner_cabinet_id
        && (patch.note ?? null) === (existing.note ?? null) && [...patch.revealed_to].sort().join() === [...existing.revealed_to].sort().join();
      if (same) {
        const set = emptySet(); const back = emptySet();
        const c: UnitChange = { id: existing.id }; const b: UnitChange = { id: existing.id };
        if (patch.strength !== existing.strength) { c.strength = patch.strength; b.strength = existing.strength; }
        if ('sight_km' in patch && (patch.sight_km ?? null) !== (existing.sight_km ?? null)) { c.sight_km = patch.sight_km ?? null; b.sight_km = existing.sight_km ?? null; }
        if (Object.keys(c).length > 1) {
          set.units.push(c); back.units.push(b);
          await applyEdits(set, `You updated ${patch.name}`, () => back, null, { fail: 'Could not save the unit.' });
          notifyOk('Unit saved to the unsent changes', 'crisis-map');
        }
        return;
      }
    }
    if (existing && before) setData({ ...before, units: before.units.map((u) => (u.id === existing.id ? { ...u, ...patch } : u)) });
    await run(async () => {
      try {
        if (existing) {
          await saveUnit(ref, { id: existing.id, ...patch });
          pushHistory({ text: `You updated ${patch.name}`, undo: () => revertUnit(existing) });
        } else if (newUnit) {
          const lng = round5(clampLng(newUnit.lng)); const lat = round5(clampLat(newUnit.lat));
          const id = await saveUnit(ref, { ...patch, lng, lat });
          const cur = rawRef.current;
          if (cur) setData({ ...cur, units: [...cur.units.filter((u) => u.id !== id), { id, crisis_id: ref.id, suspected_by: [], lng, lat, ...patch }] });
          pushHistory({ text: `You added ${patch.name}`, undo: () => dropUnit(id) });
        }
        setLast({ at: new Date().getTime(), text: existing ? `You updated ${patch.name}` : `You added ${patch.name}` });
        notifyOk(existing ? 'Unit saved' : 'Unit added', 'crisis-map');
        if (!existing) changeTool('select');
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not save the unit.'), 'crisis-map');
      }
    });
  }, [ref, run, newUnit, changeTool, applyEdits, isStage, pushHistory, revertUnit, dropUnit]);

  const removeUnit = useCallback(async (u: MapUnit) => {
    const before = rawRef.current;
    if (before) setData({ ...before, units: before.units.filter((x) => x.id !== u.id) });
    setSelUnit(null);
    await run(async () => {
      try {
        await deleteUnit(ref, u.id);
        pushHistory({ text: `You removed ${u.name}`, undo: () => restoreUnit(u) });
        setLast({ at: new Date().getTime(), text: `You removed ${u.name}` });
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not remove the unit.'), 'crisis-map');
      }
    });
  }, [ref, run, pushHistory, restoreUnit]);

  /** A unit's sight ring was dragged: keep the new radius (shown first, put back if it cannot be kept). */
  const saveSight = useCallback(async (id: string, km: number) => {
    const unit = dataRef.current?.units.find((u) => u.id === id);
    if (!unit) return;
    const val = Math.max(0, Math.min(SIGHT_MAX_KM, Math.round(km)));
    if (val === sightKmOf(unit) && unit.sight_km === val) return;
    const set = emptySet(); const back = emptySet();
    set.units.push({ id, sight_km: val });
    back.units.push({ id, sight_km: unit.sight_km ?? null });
    await applyEdits(set, `${unit.name} now sees ${kmText(val)}`, () => back, null, { fail: 'Could not change how far it sees.' });
  }, [applyEdits]);

  // ── the unsent changes: send them to delegates, or go back to what delegates see ──
  const [sending, setSending] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => { if (!draftCount) setConfirmDiscard(false); }, [draftCount]);
  const sendDraft = useCallback(async () => {
    const local = draftRef.current;
    if (!local || isEmptySet(local) || sending) return;
    const hasMap = !!(local.regions.length || local.shapes.length || local.owners.length || local.removeShapes.length || local.addShapes.length);
    if ((hasMap && !canMap) || (local.units.length && !canUnits)) {
      notifyErr('Only someone with both map and unit power can send these changes.', 'crisis-map');
      return;
    }
    setSending(true);
    await run(async () => {
      try {
        // Send what the team shares now (another member may have added to it), once.
        const fresh = parseSet(await loadMapDraft(ref));
        if (!fresh) {
          draftRef.current = null; setDraftSet(null); clearHistory();
          notifyOk('Those changes were already sent', 'crisis-map');
          return;
        }
        await saveSet(ref, fresh);
        draftRef.current = null; setDraftSet(null); clearHistory();
        setLast({ at: new Date().getTime(), text: 'You sent the map changes to delegates' });
        try { await persistDraft(null); } catch { notifyErr('Sent, but the unsent copy could not be cleared. Press Back to what delegates see.', 'crisis-map'); return; }
        notifyOk('Sent to delegates', 'crisis-map');
      } catch (e) {
        notifyErr(crisisError(e, 'Could not send the changes.'), 'crisis-map');
      }
    });
    setSending(false);
  }, [ref, run, sending, canMap, canUnits, clearHistory, persistDraft]);

  const discardDraft = useCallback(async () => {
    const prev = draftRef.current;
    setConfirmDiscard(false);
    draftRef.current = null; setDraftSet(null); clearHistory();
    setSelUnit(null); setSelTerr(null);
    await run(async () => {
      try {
        await persistDraft(null);
        notifyOk('Back to what delegates see', 'crisis-map');
      } catch (e) {
        draftRef.current = prev; setDraftSet(prev);
        notifyErr(crisisError(e, 'Could not throw away the unsent changes.'), 'crisis-map');
      }
    });
  }, [run, persistDraft, clearHistory]);

  /** Staff dragged a character to a new spot: the marker is already there; save it, put it back if that fails. */
  const charOverride = useRef(new Map<string, LngLat>());
  const moveChar = useCallback(async (id: string, lng: number, lat: number) => {
    const c = core.characters.find((x) => x.id === id);
    if (!c) return;
    const prev: LngLat | null = typeof c.location_lng === 'number' && typeof c.location_lat === 'number' ? [c.location_lng, c.location_lat] : null;
    const nl = round5(clampLng(lng)); const nt = round5(clampLat(lat));
    charOverride.current.set(id, [nl, nt]);
    try {
      await saveCharacter(ref, { id, location_lng: nl, location_lat: nt });
      setLast({ at: new Date().getTime(), text: `You moved ${c.name}` });
      await v.reloadCore();
      charOverride.current.delete(id);
    } catch (e) {
      charOverride.current.delete(id);
      const mk = charMarkers.current.get(id);
      if (mk && prev) mk.marker.setLngLat(prev);
      notifyErr(crisisError(e, 'Could not move the character.'), 'crisis-map');
    }
  }, [core.characters, ref, v]);

  /** The unit was dragged: ask in place before saving. */
  const askMove = useCallback((id: string, lng: number, lat: number) => {
    const map = mapRef.current;
    const u = dataRef.current?.units.find((x) => x.id === id);
    const base = rawRef.current?.units.find((x) => x.id === id);
    if (!map || !u || !base) return;
    const was = pendingMoveRef.current;
    if (was && was.id !== id) cancelMove();
    const a = map.project([u.lng, u.lat]); const b = map.project([lng, lat]);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 4) { cancelMove(); showMove(null, null); return; }
    // Unsent changes need no yes: the move joins them, shows its line, and Go back takes it away.
    if (draftModeRef.current) { showMove(null, null); void moveUnit(id, lng, lat); return; }
    setPending({ id, name: u.name, lng, lat });
    showMove(base, [lng, lat], false);
  }, [cancelMove, setPending, showMove, moveUnit]);

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
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: compact || isStage ? 50 : 110, maxZoom: 5.5, duration: 0 });
  }, [shownUnits, compact, isStage]);

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

  /** The selected unit's sight ring: a press anywhere on its line starts the resize, like its round handle. */
  const sightCtl = useRef<{ active: boolean; hit: (p: { x: number; y: number }) => boolean; begin: () => void; move: (ll: Pt) => void; end: () => void } | null>(null);

  // Characters standing on one spot are fanned out a little so none covers another; zooming in separates them.
  const regroupFrame = useRef<number | null>(null);
  const regroupChars = useCallback(() => {
    if (regroupFrame.current !== null) return;
    regroupFrame.current = window.requestAnimationFrame(() => {
      regroupFrame.current = null;
      const map = mapRef.current;
      if (!map) return;
      const size = compact ? 24 : 34;
      const gap = size * 1.08;
      const items = [...charMarkers.current.entries()]
        .filter(([, m]) => !m.el.dataset.drag)
        .map(([id, m]) => ({ id, m, p: map.project(m.marker.getLngLat()) }))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      const done = new Set<string>();
      for (const a of items) {
        if (done.has(a.id)) continue;
        const group = items.filter((b) => !done.has(b.id) && Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < gap);
        for (const g of group) done.add(g.id);
        if (group.length < 2) { a.m.marker.setOffset([0, 0]); continue; }
        const cx = group.reduce((t, g) => t + g.p.x, 0) / group.length;
        const cy = group.reduce((t, g) => t + g.p.y, 0) / group.length;
        const n = group.length;
        const r = n === 2 ? gap / 2 : gap / (2 * Math.sin(Math.PI / n));
        group.forEach((g, k) => {
          const ang = n === 2 ? (k === 0 ? Math.PI : 0) : -Math.PI / 2 + (2 * Math.PI * k) / n;
          g.m.marker.setOffset([Math.round(cx + r * Math.cos(ang) - g.p.x), Math.round(cy + r * Math.sin(ang) - g.p.y)]);
        });
      }
    });
  }, [compact]);

  // ── map events read the latest state through this ──
  useEffect(() => {
    liveRef.current = {
      onMapClick: (e) => {
        const map = mapRef.current;
        if (!map) return;
        if (performance.now() < suppressClickUntil.current) return;
        const target = e.originalEvent.target as HTMLElement | null;
        if (target?.closest('.wm-marker')) return;
        if (stageKind === 'unit') return;
        if (compact) { setSelUnit(null); return; }
        if (tool === 'unit') {
          if (editable && canUnits && addKind) {
            setSelUnit(null);
            setNewUnit({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          }
          return;
        }
        if ((tool === 'borders' || tool === 'draw') && draft) {
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
        // Draw: a click starts a new outline, whatever is under it (land it covers is taken from its holder).
        if (tool === 'draw') {
          if (editable && canMap) {
            setSelTerr(null); setSelUnit(null); setSelChar(null);
            setDraft({ sid: new Date().getTime(), phase: 'draw', points: [[round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))]], owner: viewer, ownerChosen: !!viewer });
          }
          return;
        }
        // Select and Borders: a click picks a territory (a drawn area sits on top of a country).
        const area = map.queryRenderedFeatures(e.point, { layers: [L_SHAPE_FILL] })[0];
        const sid = area?.properties?.id as string | undefined;
        if (sid && dataRef.current?.shapes.some((s) => s.id === sid && s.kind === 'area')) {
          setSelUnit(null); setSelChar(null); setSelTerr({ kind: 'area', id: sid });
          return;
        }
        // The real outline under a changed border counts as the country too (so a country that lost all its land
        // can still be picked and put back).
        const f = map.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0] ?? map.queryRenderedFeatures(e.point, { layers: [L_BASE_FILL] })[0];
        const key = f?.properties?.key as string | undefined;
        if (key) {
          setSelUnit(null); setSelChar(null); setSelTerr({ kind: 'country', key });
          return;
        }
        // Open sea: let go of what is selected; with nothing selected, Borders starts new territory here.
        if (selTerr || selUnit || selChar) { clearSelection(); return; }
        if (tool === 'borders' && editable && canMap) {
          setDraft({ sid: new Date().getTime(), phase: 'draw', points: [[round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))]], owner: viewer, ownerChosen: !!viewer });
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
        // Draw: press and drag draws an outline freehand (hold Shift to move the map instead).
        if (map && editable && canMap && !dragRef.current && !freeRef.current
          && (tool === 'draw' || (tool === 'borders' && draft?.phase === 'draw')) && (!draft || draft.phase === 'draw')) {
          const oe = e.originalEvent as MouseEvent;
          const tg = e.originalEvent.target as HTMLElement | null;
          if (oe.shiftKey || oe.button > 0 || tg?.closest('.wm-marker')) return;
          e.preventDefault();
          freeRef.current = { pts: [{ x: e.point.x, y: e.point.y, ll: [e.lngLat.lng, e.lngLat.lat] }] };
          return;
        }
        // The sight ring of the selected unit: pressing anywhere on its dashed line resizes it.
        const sightPress = sightCtl.current;
        if (map && sightPress && canUnits && editable && tool === 'select' && !dragRef.current && !freeRef.current) {
          const tg = e.originalEvent.target as HTMLElement | null;
          if (!tg?.closest('.wm-marker') && sightPress.hit(e.point)) { e.preventDefault(); sightPress.begin(); return; }
        }
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
        if (sightCtl.current?.active) { sightCtl.current.move([e.lngLat.lng, e.lngLat.lat]); return; }
        const fh = freeRef.current;
        if (fh) {
          const last = fh.pts[fh.pts.length - 1];
          if (Math.hypot(e.point.x - last.x, e.point.y - last.y) >= 3) {
            fh.pts.push({ x: e.point.x, y: e.point.y, ll: [round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))] });
            if (freeFrame.current === null) {
              freeFrame.current = window.requestAnimationFrame(() => {
                freeFrame.current = null;
                const cur = freeRef.current;
                if (cur) setSource(SRC_DRAFT, draftFc(cur.pts.map((p) => p.ll), draftColor));
              });
            }
          }
          return;
        }
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
        const onRing = !near && !!sightCtl.current && canUnits && editable && tool === 'select' && sightCtl.current.hit(e.point);
        map.getCanvasContainer().style.cursor = near ? 'grab'
          : onRing ? 'ew-resize'
          : drawing || (tool === 'unit' && addKind) ? 'crosshair'
            : tool === 'borders' ? 'pointer' : '';
      },
      onRelease: () => {
        if (sightCtl.current?.active) { suppressClickUntil.current = performance.now() + 400; sightCtl.current.end(); return; }
        const fh = freeRef.current;
        if (fh) {
          freeRef.current = null;
          if (freeFrame.current !== null) { window.cancelAnimationFrame(freeFrame.current); freeFrame.current = null; }
          const corners = freehandCorners(fh.pts);
          setSource(SRC_DRAFT, draft ? draftFc(draft.points, draftColor) : emptyFc);
          if (fh.pts.length > 2) suppressClickUntil.current = performance.now() + 400;
          if (!corners) {
            if (fh.pts.length > 2) notifyErr('Draw a bigger shape, or click points one by one.', 'crisis-map');
            return;
          }
          if (draft && draft.points.length >= 2) setDraft({ ...draft, phase: 'refine', points: [...draft.points, ...corners] });
          else setDraft({ sid: draft?.sid ?? new Date().getTime(), phase: 'refine', points: corners, owner: draft ? draft.owner : viewer, ownerChosen: draft ? draft.ownerChosen : !!viewer });
          return;
        }
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
        if (stageKind === 'unit') { stageRef.current?.onSelectUnit?.(id); return; }
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
      onUnitDrag: (id, lng, lat) => {
        const u = rawRef.current?.units.find((x) => x.id === id);
        if (u) showMove(u, [lng, lat]);
      },
      onCharMoved: (id, lng, lat) => { void moveChar(id, lng, lat); },
      redrawFog,
      regroupChars,
      escape: () => {
        if (freeRef.current) {
          freeRef.current = null;
          setSource(SRC_DRAFT, draft ? draftFc(draft.points, draftColor) : emptyFc);
          return true;
        }
        if (dragRef.current) {
          dragRef.current = null;
          setSource(SRC_EDIT, emptyFc);
          const map = mapRef.current;
          if (map) map.getCanvasContainer().style.cursor = '';
          return true;
        }
        if (pendingMoveRef.current) { cancelMove(); return true; }
        if (draft) { setDraft(null); return true; }
        if (tool === 'unit') {
          if (newUnit) setNewUnit(null);
          else if (addKind) setAddKind(null);
          else changeTool('select');
          return true;
        }
        const had = !!(selTerr || selUnit || selChar) && stageKind !== 'unit';
        if (stageKind !== 'unit') clearSelection();
        return had;
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
              const el = makeCountryLabel(l.name, l.area);
              if (l.key.startsWith('b:')) el.classList.add('wm-clabel-orig');
              const mk = new ml.Marker({ element: el, anchor: 'center' }).setLngLat(l.center).addTo(m);
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
          m.addSource(SRC_BASE, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_COUNTRIES, { type: 'geojson', data: w.collection, promoteId: 'key' });
          m.addSource(SRC_SHAPES, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_DRAFT, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_SEL, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_EDIT, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_HOVER, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_PLANS, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_SIGHT, { type: 'geojson', data: emptyFc });
          for (const layer of mapLayers()) m.addLayer(layer);
          addCityLayers(m);
          for (const layer of editLayers()) m.addLayer(layer);
          const labels = createCityLabels(m, ml);
          cityCtl.current = labels;
          void loadCities().then((list) => {
            if (cancelled) return;
            citiesRef.current = list;
            fillCities(m, list);
            labels.setCities(list);
          }).catch(() => { /* no cities: the map still works */ });

          const cvs = document.createElement('canvas');
          cvs.classList.add('wm-fog');
          m.getCanvasContainer().insertBefore(cvs, m.getCanvas().nextSibling);
          fogCanvas.current = cvs;

          m.on('click', (e) => liveRef.current?.onMapClick(e));
          m.on('dblclick', (e) => liveRef.current?.onMapDblClick(e));
          m.on('mousedown', (e) => liveRef.current?.onPress(e));
          m.on('touchstart', (e) => { if (e.points.length === 1) liveRef.current?.onPress(e); });
          m.on('touchmove', (e) => { if ((dragRef.current || freeRef.current || sightCtl.current?.active) && e.points.length === 1) liveRef.current?.onPointerMove(e); });
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
              const was = hover;
              hover = key;
              whenStyleReady(m, () => {
                if (was) m.setFeatureState({ source: SRC_COUNTRIES, id: was }, { hi: false });
                if (key) m.setFeatureState({ source: SRC_COUNTRIES, id: key }, { hi: true });
              });
            });
          });
          m.on('move', () => liveRef.current?.redrawFog());
          m.on('resize', () => liveRef.current?.redrawFog());
          m.on('zoom', () => { syncLabels(); liveRef.current?.regroupChars(); });
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
      cityCtl.current?.destroy(); cityCtl.current = null;
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
    el.style.cursor = tool === 'draw' || (tool === 'borders' && !!draft) || (tool === 'unit' && addKind) ? 'crosshair' : tool === 'borders' ? 'pointer' : '';
    if (draft || tool === 'draw') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
    if (tool !== 'borders' || draft) {
      whenStyleReady(map, () => {
        for (const key of world.byKey.keys()) map.setFeatureState({ source: SRC_COUNTRIES, id: key }, { hi: false });
      });
    }
  }, [tool, world, addKind, draft, canMap, editable]);

  // Escape backs out of whatever is open.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const t = ev.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      const did = liveRef.current?.escape();
      // Inside a directive pop-up, an Escape the map used must not also close the pop-up.
      if (did && stageRef.current) { ev.preventDefault(); ev.stopPropagation(); }
    };
    // Capture phase: the map is asked before the pop-up that holds it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
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
      const out: CountryLabel[] = at ? [{ ...l, center: at }] : [];
      // The original country stays labelled where it was whenever its land changed noticeably.
      const was = baseShapes.get(l.key)?.multi;
      const ratio = was && areaOf(was) > 0 ? areaOf(o) / areaOf(was) : 1;
      if (ratio < 0.85 || ratio > 1.15) out.push({ ...l, key: `b:${l.key}`, name: `${l.name} (original)`, area: 0 });
      return out;
    });
    syncLabelsRef.current?.();
  }, [world, countriesFc, overrides, baseShapes, setSource]);

  // Where to open: a link from a notification or a history row names a unit, a country or an area
  // (src/lib/crisis/mapFocus.ts). The small map on Command ignores it.
  const searchParams = useSearchParams();
  const focusKey = compact || isStage ? '' : (searchParams?.toString() ?? '');
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
    whenStyleReady(map, () => {
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
    });
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
  useEffect(() => {
    if (!world) return;
    setSource(SRC_DRAFT, draft ? draftFc(draft.points, draftColor) : emptyFc);
  }, [world, draft, draftColor, setSource]);

  // Who a new shape belongs to: the cabinet whose land it touches, when it touches exactly one. Otherwise it asks.
  const touching = useMemo<string[]>(() => {
    if (!draft || draft.phase !== 'refine' || draft.points.length < MIN_POINTS || !data) return [];
    try {
      const land = clean(toMulti({ type: 'Polygon', coordinates: [[...draft.points, draft.points[0]]] }));
      return ownersTouching(land, othersFor(null, data));
    } catch { return []; }
  }, [draft, data, othersFor]);
  useEffect(() => {
    if (!draft || draft.phase !== 'refine' || draft.ownerChosen) return;
    const auto = touching.length === 1 ? touching[0] : null;
    if (draft.owner !== auto) setDraft((d) => (d && d.sid === draft.sid && !d.ownerChosen ? { ...d, owner: auto } : d));
  }, [draft, touching]);

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
  const canDrag = stageKind === 'unit' ? canUnits : editable && canUnits && tool === 'select';
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
        const marker = new ml.Marker({ element: el, draggable: canDrag && (stageKind !== 'unit' || !stageUnitId || u.id === stageUnitId), anchor: 'center' }).setLngLat([u.lng, u.lat]).addTo(map);
        const id = u.id;
        marker.on('dragstart', () => { el.dataset.drag = '1'; });
        // The arrow follows the pointer at once, not after the drop.
        marker.on('drag', () => {
          const at = marker.getLngLat();
          liveRef.current?.onUnitDrag(id, at.lng, at.lat);
        });
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
      m.marker.setDraggable(canDrag && (stageKind !== 'unit' || !stageUnitId || u.id === stageUnitId));
      const selected = u.id === selUnit;
      const sig = `${u.kind}|${u.strength}|${color}|${selected}|${size}|${u.name}`;
      if (m.sig !== sig) {
        paintToken(m.el, { kind: u.kind, color, strength: u.strength, selected, size, name: u.name });
        m.sig = sig;
      }
    }
  }, [world, shownUnits, cabById, selUnit, canDrag, compact, stageKind, stageUnitId]);

  // ── planned moves: a dashed trajectory from where each unit is now (a reply's moves, or the team's unsent moves),
  // and a ring where it is until the move is sent ──
  const draftMoves = useMemo(() => {
    if (isStage || !draftSet) return null;
    const m: Record<string, { lng: number; lat: number }> = {};
    for (const u of draftSet.units) if (typeof u.lng === 'number' && typeof u.lat === 'number') m[u.id] = { lng: u.lng, lat: u.lat };
    return m;
  }, [draftSet, isStage]);
  const planMoves = isStage ? stageMoves : draftMoves;
  const planGhosts = useRef(new Map<string, MLMarker>());
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const moves = planMoves ?? {};
    const ghosts = planGhosts.current;
    const lines: Feature[] = [];
    for (const [id, to] of Object.entries(moves)) {
      const u = rawData?.units.find((x) => x.id === id);
      if (!u) continue;
      lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[u.lng, u.lat], [to.lng, to.lat]] } });
      const g = ghosts.get(id);
      if (g) g.setLngLat([u.lng, u.lat]);
      else ghosts.set(id, new ml.Marker({ element: makeGhost(), anchor: 'center' }).setLngLat([u.lng, u.lat]).addTo(map));
    }
    for (const [id, g] of [...ghosts]) if (!(id in moves)) { g.remove(); ghosts.delete(id); }
    setSource(SRC_PLANS, { type: 'FeatureCollection', features: lines });
  }, [world, planMoves, rawData, setSource]);
  useEffect(() => {
    const ghosts = planGhosts.current;
    return () => { for (const g of ghosts.values()) g.remove(); ghosts.clear(); };
  }, []);

  // Choosing another unit in a reply brings it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map || stageKind !== 'unit' || !stageUnitId) return;
    const u = dataRef.current?.units.find((x) => x.id === stageUnitId);
    if (u && !map.getBounds().contains([u.lng, u.lat])) map.easeTo({ center: [u.lng, u.lat], duration: 300 });
  }, [world, stageKind, stageUnitId]);

  // ── characters ──
  // The crisis team sees them all. A cabinet sees its own characters, and the other cabinets' only when the setting
  // "Delegates see other cabinets' characters" is on. Staff looking as a cabinet get the same rule. This is a
  // client rule: the database already limits what a delegate can read of other cabinets' characters.
  const placedChars = useMemo(
    () => core.characters.filter((c) => typeof c.location_lng === 'number' && typeof c.location_lat === 'number'),
    [core.characters],
  );
  const charViewer = staff ? staffViewer : cabinetId;
  const seeOtherChars = settings.delegatesSeeOtherCharacters;
  const visibleChars = useMemo(
    () => (staff && !staffViewer ? placedChars : placedChars.filter((c) => (!!charViewer && c.cabinet_id === charViewer) || seeOtherChars)),
    [placedChars, staff, staffViewer, charViewer, seeOtherChars],
  );
  const showChars = !isStage && (compact || charsOn) && (staff || !!cabinetId);
  const canMoveChars = staff && !compact && tool === 'select' && mayEditCharacters(v.role, settings);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const markers = charMarkers.current;
    const list = showChars ? visibleChars : [];
    const size = compact ? 24 : 34;
    const wanted = new Set(list.map((c) => c.id));
    for (const [id, m] of [...markers]) {
      if (!wanted.has(id)) { m.marker.remove(); markers.delete(id); }
    }
    for (const c of list) {
      const at: LngLat = charOverride.current.get(c.id) ?? [c.location_lng as number, c.location_lat as number];
      let m = markers.get(c.id);
      if (!m) {
        const el = document.createElement('div');
        const marker = new ml.Marker({ element: el, draggable: canMoveChars, anchor: 'center' }).setLngLat(at).addTo(map);
        const id = c.id;
        marker.on('dragstart', () => { el.dataset.drag = '1'; });
        marker.on('dragend', () => {
          delete el.dataset.drag;
          el.dataset.dragged = '1';
          window.setTimeout(() => { delete el.dataset.dragged; }, 80);
          const ll = marker.getLngLat();
          liveRef.current?.onCharMoved(id, ll.lng, ll.lat);
        });
        const press = (ev: Event) => { if (el.dataset.dragged) return; ev.stopPropagation(); liveRef.current?.onCharClick(id); };
        el.addEventListener('click', press);
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); press(ev); } });
        m = { marker, el, sig: '' };
        markers.set(c.id, m);
      } else if (!m.el.dataset.drag) m.marker.setLngLat(at);
      m.marker.setDraggable(canMoveChars);
      const color = c.cabinet_id ? cabById.get(c.cabinet_id)?.color ?? NOBODY : NOBODY;
      const selected = c.id === selChar;
      const sig = `${c.name}|${c.title}|${c.picture_url}|${color}|${selected}|${size}`;
      if (m.sig !== sig) {
        paintCharacter(m.el, { name: c.name, title: c.title, picture: c.picture_url, color, selected, size, showLabel: !compact });
        m.sig = sig;
      }
    }
    regroupChars();
  }, [world, visibleChars, showChars, cabById, selChar, compact, canMoveChars, regroupChars]);

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

  // ── fog: what the viewing cabinet holds, and a sight circle around each of its units ──
  // Spies are never spotted (the database says so too), so a spy is never hidden from its own side and never
  // found by anyone else's circle. The rings can be shown without the fog (staff looking as a cabinet).
  const showRings = !!viewer && (compact || rangesOn);
  const fogHoles = useMemo<FogHoles | null>(() => {
    if (!viewer || !world || (!fogActive && !showRings)) return null;
    const geometries: Geometry[] = [];
    if (fogActive) {
      for (const [key, cab] of ownerOf) {
        if (cab !== viewer) continue;
        const m = countryMulti(key);
        if (m.length) geometries.push(toGeometry(m) as unknown as Geometry);
      }
      for (const s of shownShapes) {
        if (s.kind === 'area' && s.owner_cabinet_id === viewer) geometries.push(s.geometry as unknown as Geometry);
      }
    }
    const circles = shownUnits
      .filter((u) => u.owner_cabinet_id === viewer)
      .map((u) => ({ id: u.id, lng: u.lng, lat: u.lat, km: sightKmOf(u) }));
    return { geometries, circles, rings: [], fog: fogActive, showRings };
  }, [fogActive, showRings, viewer, world, ownerOf, countryMulti, shownUnits, shownShapes]);
  useEffect(() => {
    fogHolesRef.current = fogHoles;
    fogLatest.current = fogHoles;
    redrawFog();
  }, [fogHoles, redrawFog]);

  // ── the real outline of every country whose border was changed stays under the changed shape ──
  useEffect(() => {
    if (!world) return;
    const features = overrides.size ? world.collection.features.filter((f) => overrides.has(f.properties.key)) : [];
    setSource(SRC_BASE, { type: 'FeatureCollection', features } as FeatureCollection);
  }, [world, overrides, setSource]);

  // ── cities ──
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    cityCtl.current?.setOn(citiesOn);
    whenStyleReady(map, () => setCitiesVisible(map, citiesOn));
  }, [world, citiesOn]);

  // ── the move arrow stays while a move waits for a yes, and follows the map ──
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const draw = () => {
      const p = pendingMoveRef.current;
      const u = p ? rawRef.current?.units.find((x) => x.id === p.id) ?? null : null;
      if (p && u) { showMove(u, [p.lng, p.lat], false); return; }
      // Nothing waits for a yes: clear the arrow, unless a unit is being dragged right now.
      for (const m of unitMarkers.current.values()) if (m.el.dataset.drag) return;
      showMove(null, null);
    };
    draw();
    if (!pendingMove) return;
    map.on('move', draw);
    return () => { map.off('move', draw); };
  }, [world, pendingMove, showMove]);

  // ── the selected unit's sight ring, with a handle staff drag to change how far it sees ──
  const sightUnit = !compact && editable && selUnit ? shownUnits.find((u) => u.id === selUnit) ?? null : null;
  const sightId = sightUnit?.id ?? null;
  const sightLng = sightUnit?.lng; const sightLat = sightUnit?.lat;
  const sightKm = sightUnit ? sightKmOf(sightUnit) : 0;
  const sightHandle = useRef<MLMarker | null>(null);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    sightHandle.current?.remove(); sightHandle.current = null;
    sightCtl.current = null;
    if (!world || !map || !ml) return;
    if (!sightId || sightLng === undefined || sightLat === undefined) { setSource(SRC_SIGHT, emptyFc); return; }
    const lng = sightLng; const lat = sightLat; const id = sightId;
    const ringFc = (km: number): FeatureCollection => ({
      type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [sightRing(lng, lat, km)] } }],
    });
    setSource(SRC_SIGHT, ringFc(sightKm));
    if (!canUnits) return () => { setSource(SRC_SIGHT, emptyFc); };
    const { el, tip } = makeSightHandle();
    const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(sightHandleAt(lng, lat, sightKm)).addTo(map);
    let live = sightKm;
    // A small ring would put the handle under the unit's own token: keep it at least this far from the centre.
    const clear = () => {
      const c = map.project([lng, lat]); const h = map.project(sightHandleAt(lng, lat, live));
      const r = Math.hypot(h.x - c.x, h.y - c.y);
      mk.setOffset([r < HANDLE_MIN_PX ? HANDLE_MIN_PX - r : 0, 0]);
    };
    clear();
    // The ring and the fog circle follow the pointer. The fog is drawn from a copy, so the saved state is never edited in place.
    const preview = (km: number) => {
      live = km;
      tip.textContent = kmText(km);
      setSource(SRC_SIGHT, ringFc(km));
      const h = fogLatest.current;
      if (h) { fogHolesRef.current = { ...h, circles: h.circles.map((c) => (c.id === id ? { ...c, km } : c)) }; redrawFog(); }
    };
    const finish = () => {
      delete el.dataset.drag;
      mk.setLngLat(sightHandleAt(lng, lat, live));
      clear();
      void saveSight(id, live).then(() => { fogHolesRef.current = fogLatest.current; redrawFog(); });
    };
    mk.on('dragstart', () => { el.dataset.drag = '1'; tip.textContent = kmText(live); });
    mk.on('drag', () => {
      const ll = mk.getLngLat();
      preview(kmFromPointer(lng, lat, [ll.lng, ll.lat]));
    });
    mk.on('dragend', finish);
    el.addEventListener('click', (ev) => ev.stopPropagation());
    el.addEventListener('dblclick', (ev) => ev.stopPropagation());
    // Pressing anywhere on the dashed line works too (the map hands the press to this).
    const ctl = {
      active: false,
      hit: (pt: { x: number; y: number }) => {
        const pts = sightRing(lng, lat, live, 48).map((q) => map.project([q[0], q[1]]));
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i]; const b = pts[i + 1];
          const dx = b.x - a.x; const dy = b.y - a.y;
          const len2 = dx * dx + dy * dy;
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2)) : 0;
          if (Math.hypot(a.x + dx * t - pt.x, a.y + dy * t - pt.y) <= RING_HIT_PX) return true;
        }
        return false;
      },
      begin: () => { ctl.active = true; el.dataset.drag = '1'; tip.textContent = kmText(live); },
      move: (ll: Pt) => { preview(kmFromPointer(lng, lat, ll)); mk.setLngLat(sightHandleAt(lng, lat, live)); clear(); },
      end: () => { ctl.active = false; finish(); },
    };
    sightCtl.current = ctl;
    map.on('zoom', clear);
    sightHandle.current = mk;
    return () => {
      map.off('zoom', clear);
      mk.remove(); sightHandle.current = null;
      sightCtl.current = null;
      setSource(SRC_SIGHT, emptyFc);
      fogHolesRef.current = fogLatest.current;
    };
  }, [world, sightId, sightLng, sightLat, sightKm, canUnits, setSource, redrawFog, saveSight]);

  // ── panel ──
  const selUnitRow = selUnit ? shownUnits.find((u) => u.id === selUnit) ?? null : null;
  const selCharRow = selChar && showChars ? visibleChars.find((c) => c.id === selChar) ?? null : null;

  const unitDraftOf = (u: MapUnit): UnitDraft => ({
    name: u.name, kind: u.kind, strength: u.strength, owner: u.owner_cabinet_id, note: u.note ?? '', revealed: u.revealed_to,
    sight: typeof u.sight_km === 'number' ? u.sight_km : null,
  });

  let panel: ReactNode = null;
  if (!compact && stageKind !== 'unit') {
    if (draft && editable) {
      panel = (
        <NewTerritoryPanel
          key={draft.sid} phase={draft.phase} owner={draft.ownerChosen || draft.owner !== null ? draft.owner : undefined} pointCount={draft.points.length}
          minPoints={MIN_POINTS} cabinets={cabinets} busy={busy}
          ownerHint={
            draft.owner && touching.includes(draft.owner) ? `It joins the land of ${cabById.get(draft.owner)?.name ?? 'that cabinet'} that it touches.`
              : draft.ownerChosen ? undefined
                : touching.length > 1 ? 'It touches the land of more than one cabinet. Choose who holds it.'
                  : 'It does not touch any cabinet\'s land. Choose who holds it.'
          }
          canSave={draft.ownerChosen || draft.owner !== null}
          onOwner={(id) => setDraft((d) => (d ? { ...d, owner: id, ownerChosen: true } : d))}
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
            initial={{ name: '', kind: addKind, strength: 1, owner: defaultOwner, note: '', revealed: [], sight: null }}
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
          key={`${u.id}:${u.name}:${u.kind}:${u.strength}:${u.owner_cabinet_id}:${u.revealed_to.join()}:${u.note}:${u.sight_km ?? ''}`}
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
      : tool === 'draw' && editable && canMap ? 'Press and drag to draw an outline, or click points one by one. Hold Shift and drag to move the map.'
      : sightUnit && canUnits && tool === 'select' ? 'Drag the dashed ring, or its round handle, to change how far it sees.'
        : canEditTerr && selTerr && selValid ? 'Press on the red outline and drag to move the border.'
          : tool === 'borders' && editable && canMap ? 'Click a country to select it, or click the sea to draw new territory.'
            : null;

  const pendingUnit = pendingMove ? rawData?.units.find((u) => u.id === pendingMove.id) ?? null : null;
  const compactInfo = compact && selUnitRow
    ? `${selUnitRow.name} · ${KIND_META[selUnitRow.kind].label} · ${fmtAmount(selUnitRow.strength)}`
    : null;

  const viewControl = staff && !isStage ? (
    <span className="wm-see">
      <span>See the map as</span>
      {cabinets.length <= (compact ? 3 : 4) ? (
        <Segmented value={staffViewer ?? 'all'} options={viewOptions} onChange={changeView} ariaLabel="See the map as" />
      ) : (
        <div style={{ minWidth: compact ? 160 : 200 }}>
          <GSelect size="sm" value={staffViewer ?? 'all'} options={viewOptions} onChange={changeView} aria-label="See the map as" />
        </div>
      )}
    </span>
  ) : viewerCabinet ? (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>Viewing as {viewerCabinet.name}</span>
  ) : null;

  return (
    <div
      className="wm-root" data-compact={compact ? '1' : undefined} data-stage={isStage ? '1' : undefined}
      style={stage ? ({ '--wm-stage-h': `${stage.height}px` } as CSSProperties) : undefined}
    >
      <style>{MAP_CSS}</style>

      {compact ? (
        <div className="wm-top">
          {title && <div className="wm-top-title">{title}</div>}
          {viewControl}
          {actions && <div className="wm-top-actions">{actions}</div>}
        </div>
      ) : stageKind === 'unit' ? null : (
        <>
          {!isStage && (
            <div className="wm-top">
              <div className="wm-top-title">{title}</div>
              {viewControl}
            </div>
          )}
          <div className="wm-tools" role="toolbar" aria-label="Map tools">
            <div className="wm-group">
              <span className="wm-group-label">Tools</span>
              <div className="wm-group-row">
                <button type="button" className="wm-tool" aria-pressed={tool === 'select'} onClick={() => changeTool('select')} title="Select a unit, a country or a territory">
                  <MousePointer2 size={17} strokeWidth={1.5} /><span>Select</span>
                </button>
                {editable && canMap && (
                  <button type="button" className="wm-tool" aria-pressed={tool === 'borders'} onClick={() => changeTool('borders')} title="Change who holds land and where borders run">
                    <Flag size={17} strokeWidth={1.5} /><span>Borders</span>
                  </button>
                )}
                {editable && canMap && (
                  <button type="button" className="wm-tool" aria-pressed={tool === 'draw'} onClick={() => changeTool(tool === 'draw' ? 'select' : 'draw')} title="Draw a new territory by dragging, or by clicking points">
                    <Pencil size={17} strokeWidth={1.5} /><span>Draw area</span>
                  </button>
                )}
                {editable && (canMap || canUnits) && (
                  <button
                    type="button" className="wm-tool" aria-pressed={false} disabled={!historyN || busy} onClick={goBack}
                    title={historyN ? 'Undo the last thing you did. Press again to go back further.' : 'Nothing to go back to yet'}
                  >
                    <Undo2 size={17} strokeWidth={1.5} /><span>Go back</span>
                  </button>
                )}
              </div>
            </div>
            <div className="wm-group wm-group-end">
              <span className="wm-group-label">Show on the map</span>
              <div className="wm-group-row">
                {staff && !isStage && (
                  <button
                    type="button" className="wm-tool" aria-pressed={fogOn && !!staffViewer} disabled={!staffViewer}
                    onClick={() => setFogOn((f) => !f)}
                    title={staffViewer
                      ? 'Hatched ground is what this side cannot see. It sees its own land and a circle around each of its units. Spies are never spotted.'
                      : 'Pick a side next to "See the map as" to see its fog of war'}
                  >
                    <Cloud size={17} strokeWidth={1.5} /><span>Fog of war</span>
                  </button>
                )}
                {(staff || !!viewer) && !isStage && (
                  <button
                    type="button" className="wm-tool" aria-pressed={rangesOn && !!viewer} disabled={!viewer}
                    onClick={() => setRangesOn((r) => !r)}
                    title={viewer
                      ? 'The dashed circle around each unit shows how far it sees. Select a unit to drag its circle bigger or smaller. Spies are never spotted.'
                      : 'Pick a side next to "See the map as" to see how far its units see'}
                  >
                    <Eye size={17} strokeWidth={1.5} /><span>Sight ranges</span>
                  </button>
                )}
                {(staff || !!cabinetId) && !isStage && (
                  <button
                    type="button" className="wm-tool" aria-pressed={charsOn} onClick={() => setCharsOn((c) => !c)}
                    title={visibleChars.length ? (staff ? 'Show or hide where the characters are. Crisis team can drag them to a new spot.' : 'Show or hide where the characters are') : 'No character has a place on the map yet'}
                  >
                    <UserRound size={17} strokeWidth={1.5} /><span>Characters</span>
                  </button>
                )}
                <button type="button" className="wm-tool" aria-pressed={citiesOn} onClick={() => setCitiesOn((c) => !c)} title="Show or hide capitals and big cities">
                  <Building2 size={17} strokeWidth={1.5} /><span>Cities</span>
                </button>
                <span className="wm-tool-sep" aria-hidden />
                <button type="button" className="wm-tool" aria-pressed={false} onClick={fitView} title="Zoom to fit all the units on screen">
                  <Maximize2 size={17} strokeWidth={1.5} /><span>Fit view</span>
                </button>
              </div>
            </div>
            {editable && canMap && (
              <p className="wm-toolhint">Land belongs to one cabinet: draw or drag a border outward from its land to extend it. New ground is cut out of everyone else&apos;s, so territories never overlap.</p>
            )}
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
              <Btn size="sm" tone="ghost" disabled={busy} onClick={goBack}>Go back</Btn>
            </div>
          )}
          <svg ref={arrowSvg} className="wm-arrow" aria-hidden>
            <line data-p="halo" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
            <line data-p="line" stroke={DRAFT} strokeWidth={3.2} strokeLinecap="round" />
            <polygon data-p="head" fill={DRAFT} stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
            <circle data-p="from" r={5} fill="#FFFFFF" stroke={DRAFT} strokeWidth={2.5} />
          </svg>
          <div ref={dragTip} className="wm-dragtip" aria-hidden />
          {((draftCount > 0 && staff && !isStage) || hint) && (
            <div className="wm-topleft">
              {draftCount > 0 && staff && !isStage && (
                <div className="wm-draftbar" role="status" style={{ fontFamily: CK.font }}>
                  <span><b>{draftCount} {draftCount === 1 ? 'change' : 'changes'}</b> not sent yet. Delegates still see the sent map.</span>
                  {compact ? null : confirmDiscard ? (
                    <>
                      <span>Throw away these changes?</span>
                      <div className="wm-draftbar-row">
                        <Btn size="sm" tone="red" disabled={busy} onClick={() => { void discardDraft(); }}>Yes, throw them away</Btn>
                        <Btn size="sm" tone="ghost" onClick={() => setConfirmDiscard(false)}>Keep them</Btn>
                      </div>
                    </>
                  ) : (
                    <div className="wm-draftbar-row">
                      <Btn size="sm" disabled={busy || sending} icon={<Send size={14} strokeWidth={1.5} />} onClick={() => { void sendDraft(); }}>Send to delegates</Btn>
                      <Btn size="sm" tone="ghost" disabled={busy || sending} onClick={() => setConfirmDiscard(true)}>Back to what delegates see</Btn>
                    </div>
                  )}
                </div>
              )}
              {hint && <div className="wm-hint">{hint}</div>}
            </div>
          )}
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
              <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>Move {pendingMove.name} here?</p>
              {pendingUnit && (
                <p style={{ margin: '0 0 9px', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                  {KIND_META[pendingUnit.kind].label} · {fmtAmount(pendingUnit.strength)} · {pendingUnit.owner_cabinet_id ? cabById.get(pendingUnit.owner_cabinet_id)?.name ?? 'A cabinet' : 'Nobody'}
                  {' · '}{kmText(kmBetween([pendingUnit.lng, pendingUnit.lat], [pendingMove.lng, pendingMove.lat]))}
                </p>
              )}
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
            {showRings && !compact && <span title="Spies are never spotted, even inside a sight range."><i style={{ border: `1.5px dashed ${CK.red}`, background: 'transparent' }} />Sight range (spies stay hidden)</span>}
            {compactInfo && <b style={{ color: CK.ink }}>{compactInfo}</b>}
          </div>
          {!compact && !isStage && <div>{last ? `Last change ${clock(last.at)} · ${last.text}` : staff ? 'No changes yet this visit' : 'Updates live'}</div>}
        </div>
      </div>
    </div>
  );
}
