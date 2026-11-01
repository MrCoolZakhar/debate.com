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
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { GeoJSONSource, Map as MLMap, MapMouseEvent, Marker as MLMarker } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Building2, Cloud, Droplets, Eye, Layers, Send, SquareDashed, UserRound, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { readMapFocus, type MapFocus } from '@/lib/crisis/mapFocus';
import {
  clearMapDraftVersioned, crisisError, loadMap, loadMapDraftVersioned, saveCharacter, saveMapDraftVersioned, saveUnit, uploadCrisisImage,
} from '@/lib/crisis/api';
import { customTypeOf, unitPictureOf } from '@/lib/crisis/unitTypes';
import { UserFacingError } from '@/lib/friendlyError';
import { deleteUnitChecked } from '@/lib/crisis/mapApi';
import {
  AREA_EPS, HANDLE_LIMIT, applyTent, areaOf, bboxOf, clean, differenceM, kmBetween, labelPoint, nearestEdge, ownersTouching, pickClaimTarget,
  planClaim, pointIn, tentRegion, toGeometry, toMulti, vertexCount, withCornerAdded, withCornerMoved, withCornerRemoved,
  type Bbox, type ClaimPlan, type ClaimTerr, type EdgeHit, type Multi, type Pt, type ScreenPt,
} from '@/lib/crisis/geo';
import { useCrisisLive } from '@/lib/crisis/live';
import {
  applyLocal, diffData, emptySet, isEmptySet, parseSet, saveSet, sendSet, setSize, tidySet,
  type CharMove, type EditSet, type MapData, type ShapeInfo, type StageOptions, type UnitChange,
} from './mapEdits';
import type { MapShape, MapUnit, UnitKind } from '@/lib/crisis/types';
import { ZONE_NO_TYPE_COLOR, type ZoneType } from '@/lib/crisis/zones';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, CK, Segmented, cabinetTint } from '../../crisisKit';
import { mayEditCharacters } from '../character/characterStatus';
import { distToRingPx, drawFog, sightRingPx, type FogHoles } from './fog';
import { createMapAnimator, diffMapData, mixHex, prefersReducedMotion, pulseToken, type GrowItem, type PendingAnim } from './mapAnimate';
import { createCharGlider, useCharGlide } from './charGlide';
import { charAsMover, type MoveLook } from './charMoveArrow';
import { mergeDrafts } from './draftMerge';
import { FLY_MS, type FocusRequest } from './mapFocusFly';
import { freehandCorners, type FreePt } from './freehand';
import { TIDY_KM, absorbIntoCountry, areaClaimOthers, snapToNeighbours, cleanTolFor, tidyAreaClaim } from './geomClean';
import { useShapeMover } from './shapeMove';
import { SIGHT_MAX_KM, kmFromPointer, kmText, sightHandleAt, sightKmOf, sightRing } from './sight';
import {
  addCityLayers, createCityLabels, fillCities, loadCities, setCitiesVisible, type City,
} from './cities';
import {
  KIND_META, centroidOf, clampLat, clampLng, loadWorldData, shapePoints, type CountryLabel, type LngLat, type WorldData,
} from './mapData';
import {
  BLANK_STYLE, DRAFT, L_BASE_FILL, L_LAND, LAND, L_SHAPE_FILL, L_ZONE_FILL, NOBODY, SRC_BASE, SRC_BRUSH, SRC_COUNTRIES, SRC_DRAFT, SRC_EDIT, SRC_HOVER, SRC_PLANS,
  SRC_SEL, SRC_SHAPES, SRC_SIGHT, editLayers, mapLayers,
} from './mapStyle';
import { BRUSH_DEFAULT_KM, brushKmForPixels, planErase, planPaint } from './brush';
import { useBrush, type BrushMode } from './brushTool';
import MapToolbar, { TOOLBAR_CSS, type Tool } from './MapToolbar';
import { loadProvinces, provinceAt, type Province } from './provinces';
import {
  CharacterCard, KindPicker, NewTerritoryPanel, PlaceUnitPanel, TerritoryCard, UnitEditor, UnitViewer, ZoneEditor, ZoneInfoCard, ZonesPanel,
  panelEditState, redoPanelEdit, subscribePanelEdits, undoPanelEdit, zoneColorOf, zoneFormOf, zoneVisibility, type PanelCabinet, type TerritoryInfo, type UnitDraft, type ZoneForm,
} from './MapPanels';
import {
  addPhysicalSources, createNameLabels, fillRegions, fillWater, loadRegions, loadWater, setRegionsVisible, setWaterVisible,
} from './physical';
import {
  MAP_CSS, PEN_CURSOR, makeCorner, makeCountryLabel, makeGhost, makeMidpoint, makeShapeLabel, makeSightHandle, makeVertex,
  paintCharacter, paintToken, safeColor,
} from './tokens';

type TerrRef = { kind: 'country'; key: string } | { kind: 'area'; id: string };

/** A new territory being drawn with the Borders tool. */
interface Draft {
  sid: number;
  /** 'area' is new territory (Borders and Draw area); 'zone' is a zone being drawn, or an existing one (editId) being reshaped. */
  kind: 'area' | 'zone';
  editId?: string;
  phase: 'draw' | 'refine';
  /** A zone whose shape has several pieces or holes: its details can be edited but not its outline (the Move handle and corners are off). */
  infoOnly?: boolean;
  points: LngLat[];
  /** The point lists before each change made in the refine step, newest last (what Undo steps back through). */
  trail: LngLat[][];
  /** Point lists Undo took back in this step of the drawing, newest last (what Redo puts back). */
  fwd?: LngLat[][];
  owner: string | null;
  /** True once someone picked the holder (Nobody included); until then it follows the land the shape touches. */
  ownerChosen: boolean;
}

interface PendingMove { id: string; name: string; lng: number; lat: number }

/** An outline changed on the map, kept a moment after the corner is let go (the card's Undo or the map's Undo steps it back). */
interface TerrEdit { key: string; multi: Multi; trail: Multi[] }

/** The draft with its points replaced, remembering the old ones for Undo. */
const withPoints = (d: Draft, points: LngLat[]): Draft => ({ ...d, points, trail: [...d.trail.slice(-49), d.points], fwd: [] });

/** The outline is closed: the refine step starts with nothing to step back through. */
const toRefine = (d: Draft): Draft => ({ ...d, phase: 'refine', trail: [], fwd: [] });

const terrKey = (t: TerrRef): string => (t.kind === 'country' ? `c:${t.key}` : `a:${t.id}`);

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

/** One step Undo can take back, and (when it can) Redo can do again. */
interface HistoryStep { text: string; undo: () => void | Promise<void>; redo?: () => void | Promise<void> }

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
  onCharDrag: (id: string, lng: number, lat: number) => void;
  redrawFog: () => void;
  regroupChars: () => void;
  /** A brush stroke is being dragged. */
  brushDown: () => boolean;
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
function draftFc(pts: LngLat[], color: string | null, open = false): FeatureCollection {
  if (pts.length < 2) return emptyFc;
  const props = color ? { tint: cabinetTint(color, 0.27), edge: cabinetTint(color, 0.95) } : {};
  // While the outline is being drawn it is an open line (it is not joined back to the start); letting go closes it.
  const f: Feature = pts.length >= 3 && !open
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
 * A fresh read of the map that keeps the old arrays when nothing in them changed, so a poll that finds nothing new
 * re-renders nothing (and never re-sets the whole world's source for a quiet read).
 */
function shareData(prev: MapData | null, next: MapData): MapData {
  if (!prev) return next;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const regions = same(prev.regions, next.regions) ? prev.regions : next.regions;
  const units = same(prev.units, next.units) ? prev.units : next.units;
  const shapes = same(prev.shapes, next.shapes) ? prev.shapes : next.shapes;
  return regions === prev.regions && units === prev.units && shapes === prev.shapes ? prev : { regions, units, shapes };
}

/** The draft's character moves with a new move laid over them; a character put back where it is saved needs no entry. */
function mergeChars(prev: CharMove[] | undefined, incoming: CharMove[] | undefined, sentAt: (id: string) => LngLat | null): CharMove[] {
  const m = new Map((prev ?? []).map((c) => [c.id, c]));
  for (const c of incoming ?? []) m.set(c.id, c);
  return [...m.values()].filter((c) => {
    const at = sentAt(c.id);
    return !at || Math.abs(at[0] - c.lng) > 1e-6 || Math.abs(at[1] - c.lat) > 1e-6;
  });
}

/** Swaps the local ids of units and areas added in a draft for the real ones the database gave them. */
function renameLocalIds(d: MapData, shapeIds: Map<string, string>, unitIds: Map<string, string>): MapData {
  if (!shapeIds.size && !unitIds.size) return d;
  return {
    ...d,
    shapes: d.shapes.map((x) => (shapeIds.has(x.id) ? { ...x, id: shapeIds.get(x.id) as string } : x)),
    units: d.units.map((x) => (unitIds.has(x.id) ? { ...x, id: unitIds.get(x.id) as string } : x)),
  };
}

/** The saved row of a unit, as the database takes it (for putting an edit back). */
const unitRow = (u: MapUnit) => ({
  name: u.name, kind: u.kind, strength: u.strength, owner_cabinet_id: u.owner_cabinet_id, note: u.note, revealed_to: u.revealed_to,
  sight_km: u.sight_km ?? null, custom_type: u.custom_type ?? null, picture_url: u.picture_url ?? null, details: u.details ?? null,
});

/** A unit as a set adds it (for putting a removed one back, or adding a new one). */
const unitAddOf = (u: MapUnit) => ({ id: u.id, ...unitRow(u), lng: u.lng, lat: u.lat });

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The changes to an existing zone's details (name, type, colour, description, who sees it, who controls it), added to an edit set and its way back. */
function zoneInfoEdits(was: MapShape, f: ZoneForm, types: ZoneType[], set: EditSet, back: EditSet): void {
  const name = f.name.trim();
  const type = types.find((t) => t.id === f.type) ?? null;
  const color = type?.color ?? f.color;
  const vis = zoneVisibility(f);
  const description = f.description.trim() || null;
  const i: ShapeInfo = { id: was.id }; const b: ShapeInfo = { id: was.id };
  if (name !== (was.label ?? '')) { i.label = name; b.label = was.label ?? null; }
  if (color !== (was.color ?? null)) { i.color = color; b.color = was.color ?? null; }
  if (description !== (was.description ?? null)) { i.description = description; b.description = was.description ?? null; }
  if ((type?.id ?? null) !== (was.zone_type ?? null)) { i.zone_type = type?.id ?? null; b.zone_type = was.zone_type ?? null; }
  if (vis.public !== was.public) { i.public = vis.public; b.public = was.public; }
  if ([...vis.revealed_to].sort().join() !== [...(was.revealed_to ?? [])].sort().join()) { i.revealed_to = vis.revealed_to; b.revealed_to = was.revealed_to ?? []; }
  if (Object.keys(i).length > 1) { set.shapeInfo?.push(i); back.shapeInfo?.push(b); }
  if ((f.owner ?? null) !== (was.owner_cabinet_id ?? null)) { set.owners.push({ id: was.id, owner_cabinet_id: f.owner ?? null }); back.owners.push({ id: was.id, owner_cabinet_id: was.owner_cabinet_id ?? null }); }
}

/** A local id for a unit added in the unsent changes. */
const localUnitId = () => `new-u-${new Date().getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * The war map. With `stage` it is the same map used inside a directive's reply: nothing is saved or read from the
 * database, every change is handed back to the reply (stage.onData / stage.onUnitMove) and is only written when
 * the reply is sent.
 */
export default function WarMap({ compact = false, title, actions, stage, focusReq }: { compact?: boolean; title?: ReactNode; actions?: ReactNode; stage?: StageOptions; focusReq?: FocusRequest | null }) {
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
  // The shared draft is versioned: the version this screen last saw, the draft as the database held it then (the base
  // that this screen's own edits are measured against), and who changed it last when that was somebody else.
  const draftVersion = useRef(0);
  const draftBase = useRef<EditSet | null>(null);
  const [draftBy, setDraftBy] = useState<string | null>(null);
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
  const canChars = staff && !isStage && mayEditCharacters(v.role, settings);
  const draftMode = staff && !isStage && settings.mapChangesWait && (canMap || canUnits || canChars);
  const draftModeRef = useRef(false);
  useEffect(() => { draftModeRef.current = draftMode; draftRef.current = draftSet; });
  const [loadError, setLoadError] = useState<string | null>(null);
  const writes = useRef(0);
  const seq = useRef(0);
  /** When the last write of this page finished: a re-read that began before it may predate it and is never shown. */
  const lastWriteEnd = useRef(0);
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [last, setLast] = useState<{ at: number; text: string } | null>(null);

  useEffect(() => { dataRef.current = data; rawRef.current = rawData; }, [data, rawData]);

  // Changes that arrive from the server (a send, a reply's map effects, a live change) are animated; the team's own
  // optimistic edits and the first load are not. The diff waits here for the marker and layer effects to run.
  const pendingAnim = useRef<PendingAnim | null>(null);
  const queueAnim = useCallback((prev: MapData | null, next: MapData, opts: { fromSent?: boolean } = {}) => {
    if (!prev || isStage || prefersReducedMotion() || (typeof document !== 'undefined' && document.hidden)) return;
    const diff = diffMapData(prev, next);
    if (diff) pendingAnim.current = { diff, ghosts: [], drawn: new Map(), fromSent: opts.fromSent };
  }, [isStage]);

  /** A name for whoever saved the shared draft last; null when that was this person (or nobody). */
  const members = core.members;
  const myMemberId = v.memberId;
  const whoSaved = useCallback((by: string | null): string | null => {
    if (!by) return null;
    const m = members.find((x) => x.id === by || x.user_id === by);
    if (m) return m.id === myMemberId ? null : m.display_name;
    return 'A team member';
  }, [members, myMemberId]);

  const adoptDraftRef = useRef<(l: { payload: unknown; version: number; updated_by: string | null }) => void>(() => undefined);
  const reload = useCallback(async () => {
    if (isStage) return;   // a reply's map is only what the reply stages
    const mine = ++seq.current;
    const startedAt = performance.now();
    try {
      const [d, dr] = await Promise.all([
        loadMap(ref),
        staff ? loadMapDraftVersioned(ref).catch(() => undefined) : Promise.resolve(null),
      ]);
      // Never show a read that is older than what is on screen: a newer read is on its way, we are writing, or the
      // read began before our last write finished (it may not include it).
      if (mine !== seq.current || writes.current > 0 || startedAt < lastWriteEnd.current) return;
      // Our screen showed the unsent changes; they are gone and the sent map moved: someone sent them. Play it from the sent positions.
      const hadDraft = !!draftRef.current && !isEmptySet(draftRef.current);
      queueAnim(rawRef.current, d, { fromSent: !!dr && hadDraft && !parseSet(dr.payload) });
      setData((prev) => shareData(prev, d));
      if (dr) adoptDraftRef.current(dr);
      setLoadError(null);
    } catch (e) {
      if (mine === seq.current) setLoadError(crisisError(e, 'Could not load the map.'));
    }
  }, [ref, isStage, staff, queueAnim]);

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
      lastWriteEnd.current = performance.now();
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
  const [waterOn, setWaterOn] = useState(true);
  const [regionsOn, setRegionsOn] = useState(false);
  const [zonesOn, setZonesOn] = useState(true);
  const staffViewer = viewAs !== 'all' && cabById.has(viewAs) ? viewAs : null;
  const viewer: string | null = staff ? staffViewer : cabinetId;
  const fogActive = !!viewer && (staff && !compact ? fogOn : true);

  // What the viewer sees. A delegate gets only what the database lets their cabinet see (its own units, units
  // shown to it, and any unit inside one of its sight circles). Staff looking as a cabinet get the same rule here.
  // A spy is never spotted: only its own cabinet and the cabinets it was shown to (revealed_to) see it, even on
  // their land or inside their sight range (the database enforces the same in crisis_units RLS).
  // The same rule is applied here for a delegate too: the database already filters, and this keeps the screen right even
  // for the moment between a sight range changing and the next read (never a unit the viewer's own units no longer see).
  const shownUnits = useMemo(() => {
    const all = data?.units ?? [];
    if (!viewer) return all;
    const own = all.filter((u) => u.owner_cabinet_id === viewer);
    return all.filter((u) => u.owner_cabinet_id === viewer || u.revealed_to.includes(viewer)
      || (u.kind !== 'spy' && own.some((o) => kmBetween([o.lng, o.lat], [u.lng, u.lat]) <= sightKmOf(o))));
  }, [data, viewer]);

  const shownShapes = useMemo(
    () => (data?.shapes ?? []).filter((s) => !viewer || s.public || s.owner_cabinet_id === viewer || s.revealed_to.includes(viewer)),
    [data, viewer],
  );

  const zoneTypes = settings.zoneTypes;
  const customTypes = settings.customUnitTypes;
  const zoneTypeById = useMemo(() => new Map(zoneTypes.map((t) => [t.id, t])), [zoneTypes]);
  const zones = useMemo(() => shownShapes.filter((s) => s.kind === 'zone'), [shownShapes]);

  // ── tools and selection ──
  const [tool, setTool] = useState<Tool>('select');
  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [selTerr, setSelTerr] = useState<TerrRef | null>(null);
  const [selChar, setSelChar] = useState<string | null>(null);
  const [selZone, setSelZone] = useState<string | null>(null);
  const selZoneRow = selZone ? zones.find((z) => z.id === selZone) ?? null : null;
  const stageUnitId = stage?.unitId ?? null;
  useEffect(() => { if (stageKind === 'unit') setSelUnit(stageUnitId); }, [stageKind, stageUnitId]);
  const [addKind, setAddKind] = useState<UnitKind | null>(null);
  /** The custom troop type being placed (a key into the crisis settings); only read while addKind is 'custom'. */
  const [addCustomKey, setAddCustomKey] = useState<string | null>(null);
  const addCustom = addKind === 'custom' && addCustomKey ? customTypes.find((t) => t.key === addCustomKey) ?? null : null;
  const [newUnit, setNewUnit] = useState<{ lng: number; lat: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** The colour a zone being drawn takes (its type's, or the swatch picked). */
  const [zoneColor, setZoneColor] = useState<string>(ZONE_NO_TYPE_COLOR);
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
  const draftColor = draft?.kind === 'zone' ? zoneColor : draft && draft.owner ? cabById.get(draft.owner)?.color ?? null : null;

  // The owner chip: the one cabinet Give land, Paint, Draw area and zone control work for (null is Nobody). Until someone
  // picks, it is the cabinet being viewed, else the first cabinet.
  const [chipPick, setChipOwner] = useState<string | null | undefined>(undefined);
  const chipOwner: string | null = chipPick === undefined ? defaultOwner : chipPick === null || cabById.has(chipPick) ? chipPick : defaultOwner;
  const chipColor = chipOwner ? cabById.get(chipOwner)?.color ?? null : null;
  // The brush: its size in km. The first time a brush is picked the size suits how far the map is zoomed.
  const [brushKm, setBrushKm] = useState(BRUSH_DEFAULT_KM);
  const brushTouched = useRef(false);
  // The states and provinces for Give land, fetched the first time that tool is picked. The Regions layer is switched on
  // for the tool and back off when it ends, unless the person switched it themselves meanwhile.
  const provincesRef = useRef<Province[] | null>(null);
  const [provincesReady, setProvincesReady] = useState(false);
  const regionsAuto = useRef(false);
  const regionsOnRef = useRef(false);

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

  const clearSelection = useCallback(() => { setSelUnit(null); setSelTerr(null); setSelChar(null); setSelZone(null); setTerrEdit(null); }, []);

  const changeTool = useCallback((t: Tool) => {
    cancelMove();
    setTool(t);
    clearSelection();
    setNewUnit(null); setAddKind(null); setDraft(null);
    if (t === 'zones') setZonesOn(true);
    if (t === 'give' && !regionsOnRef.current) { regionsAuto.current = true; setRegionsOn(true); }
    else if (t !== 'give' && regionsAuto.current) { regionsAuto.current = false; setRegionsOn(false); }
    const map = mapRef.current;
    if ((t === 'paint' || t === 'erase') && !brushTouched.current && map) {
      const c = map.getCenter();
      setBrushKm(brushKmForPixels(Math.abs(map.project(c).y - map.project([c.lng, Math.min(84, c.lat + 1)]).y)));
    }
  }, [cancelMove, clearSelection]);

  useEffect(() => { regionsOnRef.current = regionsOn; });
  useEffect(() => {
    if (tool !== 'give' || provincesRef.current) return;
    let dead = false;
    loadProvinces().then((list) => {
      if (dead) return;
      provincesRef.current = list;
      setProvincesReady(true);
    }).catch(() => { if (!dead) notifyErr('The states and provinces could not be loaded. Give land still works for countries and territories.', 'crisis-map'); });
    return () => { dead = true; };
  }, [tool]);

  // Looking through another cabinet's eyes starts again from Select.
  const changeView = useCallback((val: string) => { setViewAs(val); changeTool('select'); }, [changeTool]);

  // Staff can still add units and change borders while looking through a cabinet's eyes.
  const editable = stage ? stage.kind === 'border' : staff && !compact;
  const canEditTerr = editable && canMap && tool === 'select' && !draft;
  // Zones: drawn and reshaped on the main map by staff with map power (never inside a directive's reply).
  const canZones = editable && canMap && !isStage && !compact;
  // Units can be edited, added and removed on the main map; a directive reply only plans moves (nothing is saved before it is sent).
  const unitEditing = editable && canUnits && !isStage;
  // The selected unit's sight ring is drawn by its own layer (and can be dragged); the fog does not draw a second one.
  const sightUnit = !compact && editable && selUnit ? shownUnits.find((u) => u.id === selUnit) ?? null : null;

  // The selected territory as it stands (a territory that no longer exists is no longer selected).
  const selShape = selTerr?.kind === 'area' ? shownShapes.find((s) => s.id === selTerr.id && s.kind === 'area') ?? null : null;
  const selValid = !!selTerr && (selTerr.kind === 'country' ? !!world?.byKey.has(selTerr.key) : !!selShape);
  const selSaved = useMemo<Multi>(() => {
    if (!selTerr || !selValid) return [];
    if (selTerr.kind === 'country') return countryMulti(selTerr.key);
    return selShape ? toMulti(selShape.geometry) : [];
  }, [selTerr, selValid, selShape, countryMulti]);
  // An outline being reshaped is shown (and handled) as it stands in the editor until Save or Cancel.
  const [terrEdit, setTerrEdit] = useState<TerrEdit | null>(null);
  const terrEditRef = useRef<TerrEdit | null>(null);
  useEffect(() => { terrEditRef.current = terrEdit; }, [terrEdit]);
  const selKey = selTerr && selValid ? terrKey(selTerr) : null;
  const workMulti: Multi | null = terrEdit && terrEdit.key === selKey ? terrEdit.multi : null;
  const selMulti: Multi = workMulti ?? selSaved;
  useEffect(() => { if (terrEdit && terrEdit.key !== selKey) setTerrEdit(null); }, [terrEdit, selKey]);
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
  const nameCtl = useRef<ReturnType<typeof createNameLabels> | null>(null);
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

  /** What the edit layer shows when nothing is being dragged: the outline being reshaped, or nothing. */
  const editBase = useRef<FeatureCollection>(emptyFc);
  const resetEdit = useCallback(() => setSource(SRC_EDIT, editBase.current), [setSource]);

  // ── names ──
  const nameOf = useCallback((t: TerrRef, d: MapData | null): string => {
    if (t.kind === 'country') return world?.byKey.get(t.key)?.name ?? 'This country';
    return d?.shapes.find((s) => s.id === t.id)?.label || 'A drawn territory';
  }, [world]);

  // Where each character is saved, and where the unsent changes have put it.
  const charsRef = useRef(core.characters);
  useEffect(() => { charsRef.current = core.characters; }, [core.characters]);
  const sentCharAt = useCallback((id: string): LngLat | null => {
    const c = charsRef.current.find((x) => x.id === id);
    return c && typeof c.location_lng === 'number' && typeof c.location_lat === 'number' ? [c.location_lng, c.location_lat] : null;
  }, []);
  const draftCharAt = useMemo(() => new Map<string, LngLat>((isStage ? [] : draftSet?.chars ?? []).map((c) => [c.id, [c.lng, c.lat] as LngLat])), [draftSet, isStage]);
  const draftCharRef = useRef(draftCharAt);
  useEffect(() => { draftCharRef.current = draftCharAt; }, [draftCharAt]);

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
  const showMove = useCallback((u: MapUnit | null, to: LngLat | null, withTip = true, look?: MoveLook) => {
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
      // A character's arrow is in its cabinet's colour; a unit's keeps the draft colour.
      const tint = look?.color ?? DRAFT;
      part('line')?.setAttribute('stroke', tint); head?.setAttribute('fill', tint); origin?.setAttribute('stroke', tint);
    }
    if (tip) {
      if (!withTip) { tip.style.display = 'none'; return; }
      const owner = u.owner_cabinet_id ? cabById.get(u.owner_cabinet_id)?.name ?? 'A cabinet' : 'Nobody';
      const name = document.createElement('b'); name.textContent = u.name;
      const what = document.createElement('div'); what.textContent = look ? look.what : `${KIND_META[u.kind].label} · ${fmtAmount(u.strength)} · ${owner}`;
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
  // Steps taken back that Redo can do again, newest last. A new action empties it, and so does taking back a step that
  // cannot be done again (the steps after it would no longer fit).
  const redoRef = useRef<HistoryStep[]>([]);
  const [redoN, setRedoN] = useState(0);
  const pushHistory = useCallback((step: HistoryStep, keepRedo = false) => {
    historyRef.current = [...historyRef.current, step].slice(-HISTORY_MAX);
    setHistoryN(historyRef.current.length);
    if (!keepRedo && redoRef.current.length) { redoRef.current = []; setRedoN(0); }
  }, []);
  const clearHistory = useCallback(() => { historyRef.current = []; setHistoryN(0); redoRef.current = []; setRedoN(0); setUndo(null); }, []);

  /** Undo: takes back the last thing done (several steps). */
  const goBack = useCallback(() => {
    const step = historyRef.current[historyRef.current.length - 1];
    if (!step) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryN(historyRef.current.length);
    redoRef.current = step.redo ? [...redoRef.current, step].slice(-HISTORY_MAX) : [];
    setRedoN(redoRef.current.length);
    setUndo(null);
    void step.undo();
  }, []);

  /** Redo: does again what Undo just took back. */
  const goForward = useCallback(() => {
    const step = redoRef.current[redoRef.current.length - 1];
    if (!step?.redo) return;
    redoRef.current = redoRef.current.slice(0, -1);
    setRedoN(redoRef.current.length);
    setUndo(null);
    void step.redo();
  }, []);

  /** The shared draft is written one request at a time, in order, so the last change is the one that stays. */
  const draftChain = useRef<Promise<void>>(Promise.resolve());
  /**
   * Saves this screen's draft on the version it last saw. When the database answers that someone saved in between, their
   * draft is merged with ours (what we changed since our base wins, everything else comes from theirs) and saved again.
   */
  const flushDraft = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const cur = draftRef.current;
      const mine = cur && !isEmptySet(cur) ? cur : null;
      const res = await saveMapDraftVersioned(ref, (mine ?? emptySet()) as unknown as Record<string, unknown>, draftVersion.current);
      if (res.ok) { draftVersion.current = res.version; draftBase.current = mine; setDraftBy(null); return; }
      const theirs = parseSet(res.payload);
      const merged = mergeDrafts(draftBase.current, mine, theirs);
      draftBase.current = theirs; draftVersion.current = res.version;
      draftRef.current = merged; setDraftSet(merged);
      const by = whoSaved(res.updated_by);
      if (by) { setDraftBy(by); setLast({ at: new Date().getTime(), text: `${by} changed the unsent map` }); }
    }
    throw new UserFacingError('The team is changing the unsent map right now. Try that again.');
  }, [ref, whoSaved]);
  const persistDraft = useCallback((): Promise<void> => {
    const job = draftChain.current.then(flushDraft);
    draftChain.current = job.catch(() => undefined);
    return job;
  }, [flushDraft]);

  const persistDraftRef = useRef<() => Promise<void>>(() => Promise.resolve());
  /** A newer draft from the database (a live ping, a re-read): shown at once, with this screen's unsaved edits kept on top. */
  const adoptDraft = useCallback((l: { payload: unknown; version: number; updated_by: string | null }) => {
    const theirs = parseSet(l.payload);
    const cur = draftRef.current;
    const mine = cur && !isEmptySet(cur) ? cur : null;
    const dirty = !sameJson(draftBase.current, mine);
    if (!dirty && l.version === draftVersion.current && sameJson(draftBase.current, theirs)) return;
    const next = dirty ? mergeDrafts(draftBase.current, mine, theirs) : theirs;
    draftBase.current = theirs; draftVersion.current = l.version;
    draftRef.current = next;
    setDraftSet((prev) => (sameJson(prev, next) ? prev : next));
    const by = whoSaved(l.updated_by);
    if (!theirs) setDraftBy(null);
    else if (by) { setDraftBy(by); setLast({ at: new Date().getTime(), text: `${by} changed the unsent map` }); }
    // Our own unsaved edits are not in the database yet: share them.
    if (dirty && !sameJson(next, theirs)) void persistDraftRef.current().catch(() => undefined);
  }, [whoSaved]);
  useEffect(() => { adoptDraftRef.current = adoptDraft; persistDraftRef.current = persistDraft; });

  /**
   * Shows a set of map changes at once, then keeps them: in the shared draft (when changes wait until sent), in the
   * database (live), or only in the reply (a directive's map). `undoOf` builds the set that puts them back.
   */
  const applyEdits = useCallback(async (
    set: EditSet, text: string, undoOf: ((ids: string[]) => EditSet) | null, note: string | null = null,
    opts: { noHistory?: boolean; fail?: string; redoing?: boolean } = {},
  ) => {
    const before = dataRef.current;
    if (!before || isEmptySet(set)) return;
    const fail = opts.fail ?? 'Could not change the border.';
    const record = (ids: string[]) => {
      setLast({ at: new Date().getTime(), text });
      if (undoOf && !opts.noHistory) {
        const back = undoOf(ids);
        pushHistory({
          text,
          undo: () => applyEdits(back, 'You went back', null, null, { noHistory: true, fail }),
          // Live saves give a removed shape a new id when Undo puts it back, so that step cannot be done again.
          redo: draftModeRef.current || isStage || !back.addShapes.length ? () => applyEdits(set, text, undoOf, note, { fail, redoing: true }) : undefined,
        }, !!opts.redoing);
        setUndo({ sid: new Date().getTime(), text, note });
      } else setUndo(null);
    };
    if (draftModeRef.current) {
      // Built from the sent map and the draft as they are right now, so two quick edits never lose the first.
      const sent = rawRef.current ?? before;
      const current = draftRef.current ? applyLocal(sent, draftRef.current, ref.id) : sent;
      const shown = applyLocal(current, set, ref.id);
      const next = diffData(sent, shown);
      next.chars = mergeChars(draftRef.current?.chars, set.chars, sentCharAt);
      const prev = draftRef.current;
      draftRef.current = isEmptySet(next) ? null : next;
      setDraftSet(draftRef.current);
      await run(async () => {
        try {
          await persistDraft();
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
  }, [ref, run, isStage, persistDraft, pushHistory, sentCharAt]);

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
  const commitOutline = useCallback((t: TerrRef, next: Multi, reset = false, knownGrowth?: Multi, extra?: (set: EditSet, back: EditSet) => void): boolean => {
    const d = dataRef.current;
    if (!d) return false;
    if (!reset && areaOf(next) <= AREA_EPS) { notifyErr('That would leave no land at all. Try a smaller move.', 'crisis-map'); return false; }
    const prev = t.kind === 'country' ? storedOutline(d, t.key) ?? baseRef.current.get(t.key)?.multi ?? [] : toMulti(d.shapes.find((s) => s.id === t.id)?.geometry);
    const set = emptySet(); const back = emptySet();
    const name = nameOf(t, d);
    let gone: string[] = [];
    try {
      const row = t.kind === 'country' ? d.regions.find((r) => r.region_key === t.key) : undefined;
      const shape = t.kind === 'area' ? d.shapes.find((s) => s.id === t.id) : undefined;
      if (t.kind === 'area' && !shape) return false;
      const owner = t.kind === 'country' ? row?.owner_cabinet_id ?? null : shape?.owner_cabinet_id ?? null;
      const growth = knownGrowth ?? differenceM(next, prev);
      // A drawn area only ever cuts other areas: a country it lies on keeps its own outline and colour.
      const allOthers = othersFor(t, d);
      const others = t.kind === 'area' ? areaClaimOthers(allOthers, owner) : allOthers;
      let plan = planClaim(growth, owner, { id: t.kind === 'country' ? `c:${t.key}` : `a:${t.id}`, multi: next }, others, !reset && !!owner && areaOf(growth) > AREA_EPS);
      if (t.kind === 'area') plan = tidyAreaClaim(plan, owner, others, null);
      gone = writePlan(plan, d, set, back);
      if (t.kind === 'country') {
        set.regions.push({ key: t.key, owner_cabinet_id: owner, geometry: reset ? null : toGeometry(plan.land) });
        back.regions.push({ key: t.key, owner_cabinet_id: owner, geometry: row?.geometry ?? null });
      } else if (shape && !plan.land.length) {
        // The area now lies wholly inside a country its cabinet holds: nothing of it is left to draw.
        set.removeShapes.push(t.id);
        back.addShapes.push(shape);
      } else if (shape) {
        set.shapes.push({ id: t.id, geometry: areaGeometry(plan.land) });
        back.shapes.push({ id: t.id, geometry: shape.geometry });
      }
    } catch {
      notifyErr('That border could not be worked out. Try a smaller move.', 'crisis-map');
      return false;
    }
    extra?.(set, back);
    void applyEdits(set, reset ? `You put back the real border of ${name}` : `You moved the border of ${name}`, () => back, goneNote(gone));
    return true;
  }, [writePlan, othersFor, applyEdits, nameOf]);

  /** An outline changed on the map waits a moment in the editor, then is kept (see the effect after saveTerritory). */
  const stageOutline = useCallback((t: TerrRef, next: Multi) => {
    const key = terrKey(t);
    setTerrEdit((prev) => (prev && prev.key === key ? { key, multi: next, trail: [...prev.trail.slice(-49), prev.multi] } : { key, multi: next, trail: [] }));
  }, []);
  const undoOutline = useCallback(() => {
    setTerrEdit((prev) => {
      if (!prev || !prev.trail.length) return null;
      return { key: prev.key, multi: prev.trail[prev.trail.length - 1], trail: prev.trail.slice(0, -1) };
    });
  }, []);

  /** Save on a territory's card: the changed outline (cut out of everyone else's land as ever) and the name and description, in one step. */
  const saveTerritory = useCallback((t: TerrRef, info: TerritoryInfo | null) => {
    const d = dataRef.current;
    if (!d) return;
    const shape = t.kind === 'area' ? d.shapes.find((s) => s.id === t.id) : undefined;
    const work = terrEditRef.current && terrEditRef.current.key === terrKey(t) ? terrEditRef.current.multi : null;
    let extra: ((set: EditSet, back: EditSet) => void) | undefined;
    if (shape && info && (info.label !== (shape.label ?? '') || info.description !== (shape.description ?? ''))) {
      extra = (set, back) => {
        const i: ShapeInfo = { id: shape.id }; const b: ShapeInfo = { id: shape.id };
        if (info.label !== (shape.label ?? '')) { i.label = info.label || null; b.label = shape.label ?? null; }
        if (info.description !== (shape.description ?? '')) { i.description = info.description || null; b.description = shape.description ?? null; }
        set.shapeInfo?.push(i); back.shapeInfo?.push(b);
      };
    }
    if (work) {
      if (commitOutline(t, work, false, undefined, extra)) setTerrEdit(null);
      return;
    }
    if (extra) {
      const set = emptySet(); const back = emptySet();
      extra(set, back);
      void applyEdits(set, `You updated ${nameOf(t, d)}`, () => back, null, { fail: 'Could not save the territory.' });
    }
  }, [commitOutline, applyEdits, nameOf]);

  // A changed outline is kept a moment after the corner is let go (Undo on the card, or the map's Undo, steps it back).
  const keptEdit = useRef<TerrEdit | null>(null);
  useEffect(() => {
    if (!terrEdit || !selTerr || terrEdit.key !== terrKey(selTerr) || keptEdit.current === terrEdit) return;
    const t = window.setTimeout(() => { keptEdit.current = terrEdit; saveTerritory(selTerr, null); }, 350);
    return () => window.clearTimeout(t);
  }, [terrEdit, selTerr, saveTerritory]);

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
      // Handing a whole country to a cabinet takes in that cabinet's own drawn areas inside it, so the country shows one
      // colour with no overlap. Another cabinet's areas stay (that is occupation).
      const outline = storedOutline(d, t.key) ?? baseRef.current.get(t.key)?.multi ?? [];
      if (owner && outline.length) {
        try {
          const areas = d.shapes.filter((x) => x.kind === 'area').map((x) => ({ id: x.id, owner: x.owner_cabinet_id, multi: toMulti(x.geometry) }));
          const cuts = absorbIntoCountry(areas, owner, outline, TIDY_KM);
          if (cuts.length) writePlan({ land: [], absorbed: [], cuts, gained: [] }, d, set, back);
        } catch { /* the country is still handed over; the areas stay as they were */ }
      }
    } else {
      const shape = d.shapes.find((s) => s.id === t.id);
      if (!shape || shape.owner_cabinet_id === owner) return;
      set.owners.push({ id: t.id, owner_cabinet_id: owner });
      back.owners.push({ id: t.id, owner_cabinet_id: shape.owner_cabinet_id });
    }
    void applyEdits(set, `You gave ${name} to ${who}`, () => back);
  }, [cabById, nameOf, applyEdits, writePlan]);

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
      let multi = clean(toMulti({ type: 'Polygon', coordinates: [[...dr.points, dr.points[0]]] }));
      if (areaOf(multi) <= AREA_EPS) { notifyErr('That shape has no area. Draw at least three points apart.', 'crisis-map'); return; }
      const allOthers = othersFor(null, d);
      // A corner a hair away from the cabinet's own land is snapped onto it, so no gap is left between them.
      if (dr.owner) multi = snapToNeighbours(multi, allOthers.filter((o) => o.owner === dr.owner).map((o) => o.multi), cleanTolFor(TIDY_KM));
      const target = pickClaimTarget(multi, dr.owner, allOthers);
      // An area never cuts a country: it lies on top of it. Only extending the cabinet's own country moves a country's border.
      const others = target?.kind === 'country' ? allOthers : areaClaimOthers(allOthers, dr.owner);
      const growth = target ? differenceM(multi, target.multi) : multi;
      const holder = dr.owner ? cabById.get(dr.owner)?.name ?? 'that cabinet' : 'nobody';
      if (target && areaOf(growth) <= AREA_EPS) { notifyErr(`That land already belongs to ${holder}.`, 'crisis-map'); return; }
      let plan = planClaim(growth, dr.owner, target ? { id: target.id, multi: target.multi } : null, others, !!dr.owner);
      if (target?.kind !== 'country') plan = tidyAreaClaim(plan, dr.owner, others, null);
      if (!plan.land.length && !target) { notifyErr(`That land already belongs to ${holder}.`, 'crisis-map'); return; }
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
    changeTool('select');
    notifyOk(isStage ? 'Territory added to the reply' : draftModeRef.current ? 'Territory added to the unsent changes' : 'Territory saved', 'crisis-map');
    void applyEdits(set, text, grown ? () => back : (ids) => ({ ...back, removeShapes: [...back.removeShapes, ...ids] }), goneNote(gone));
  }, [ref.id, othersFor, writePlan, applyEdits, isStage, cabById, world, changeTool]);

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

  // ── zones ──
  /** The zone under a point of the screen (the smallest one when zones overlap). */
  const zoneAt = useCallback((map: MLMap, pt: { x: number; y: number }): string | null => {
    let best: string | null = null; let bestA = Infinity;
    const seen = new Set<string>();
    for (const f of map.queryRenderedFeatures([pt.x, pt.y] as [number, number], { layers: [L_ZONE_FILL] })) {
      const id = f.properties?.id as string | undefined;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const z = dataRef.current?.shapes.find((x) => x.id === id && x.kind === 'zone');
      if (!z) continue;
      const a = areaOf(toMulti(z.geometry));
      if (a < bestA) { bestA = a; best = id; }
    }
    return best;
  }, []);

  const beginZone = useCallback(() => {
    setSelZone(null);
    setZoneColor(ZONE_NO_TYPE_COLOR);
    setDraft({ sid: new Date().getTime(), kind: 'zone', phase: 'draw', points: [], owner: null, ownerChosen: true, trail: [] });
  }, []);

  /** Opens a zone for reshaping: its corners appear, its card takes the name, type, description and who sees it. */
  const editZone = useCallback((id: string) => {
    const z = dataRef.current?.shapes.find((x) => x.id === id && x.kind === 'zone');
    if (!z) return;
    // A zone of one plain ring has corners to drag. One with several pieces or holes (a freehand loop can make one) opens
    // with everything else editable (name, type, who controls it, who sees it) and its outline left as it is.
    const rings = z.geometry.type === 'Polygon' ? (z.geometry.coordinates as unknown[]).length : 0;
    const pts = shapePoints(z.geometry);
    if (pts.length < MIN_POINTS) { notifyErr('This zone has no outline to edit. Delete it and draw it again.', 'crisis-map'); return; }
    setSelZone(null);
    setZoneColor(zoneColorOf(z, zoneTypes));
    setDraft({ sid: new Date().getTime(), kind: 'zone', editId: id, phase: 'refine', points: pts, owner: null, ownerChosen: true, trail: [], ...(rings === 1 ? {} : { infoOnly: true }) });
  }, [zoneTypes]);

  const submitZone = useCallback((dr: Draft, f: ZoneForm) => {
    const d = dataRef.current;
    if (!d || dr.points.length < MIN_POINTS) return;
    const name = f.name.trim();
    if (!name) { notifyErr('Give the zone a name first.', 'crisis-map'); return; }
    let geometry: MapShape['geometry'];
    try {
      const multi = clean(toMulti({ type: 'Polygon', coordinates: [[...dr.points, dr.points[0]]] }));
      if (areaOf(multi) <= AREA_EPS) { notifyErr('That shape has no area. Draw at least three points apart.', 'crisis-map'); return; }
      // A zone whose outline cannot be edited here keeps the outline it has.
      geometry = dr.infoOnly && dr.editId ? d.shapes.find((x) => x.id === dr.editId)?.geometry ?? areaGeometry(multi) : areaGeometry(multi);
    } catch {
      notifyErr('That shape could not be worked out. Try drawing it again.', 'crisis-map');
      return;
    }
    const type = zoneTypes.find((t) => t.id === f.type) ?? null;
    const color = type?.color ?? f.color;
    const vis = zoneVisibility(f);
    const description = f.description.trim() || null;
    const set = emptySet(); const back = emptySet();
    let text: string;
    if (!dr.editId) {
      set.addShapes.push({
        id: `new-${dr.sid}`, crisis_id: ref.id, kind: 'zone', owner_cabinet_id: f.owner, label: name, color, geometry,
        public: vis.public, revealed_to: vis.revealed_to, description, zone_type: type?.id ?? null,
      });
      text = `You drew the zone ${name}`;
    } else {
      const was = d.shapes.find((x) => x.id === dr.editId);
      if (!was) { setDraft(null); return; }
      if (!sameJson(was.geometry, geometry)) { set.shapes.push({ id: was.id, geometry }); back.shapes.push({ id: was.id, geometry: was.geometry }); }
      zoneInfoEdits(was, f, zoneTypes, set, back);
      if (isEmptySet(set)) { setDraft(null); return; }
      text = `You changed the zone ${name}`;
    }
    setDraft(null);
    notifyOk(isStage ? 'Zone added to the reply' : draftModeRef.current ? 'Zone saved to the unsent changes' : 'Zone saved', 'crisis-map');
    void applyEdits(set, text, dr.editId ? () => back : (ids) => ({ ...back, removeShapes: [...back.removeShapes, ...ids] }), null, { fail: 'Could not save the zone.' });
  }, [ref.id, zoneTypes, applyEdits, isStage]);

  const removeZone = useCallback((id: string) => {
    const shape = dataRef.current?.shapes.find((s) => s.id === id && s.kind === 'zone');
    if (!shape) return;
    setDraft(null); setSelZone(null);
    const set = emptySet(); const back = emptySet();
    set.removeShapes.push(id);
    back.addShapes.push(shape);
    void applyEdits(set, `You removed the zone ${shape.label || ''}`.trim(), () => back, null, { fail: 'Could not remove the zone.' });
  }, [applyEdits]);

  /** A zone carried somewhere else with its Move handle: one change, one undo step. */
  const moveZone = useCallback((id: string, moved: Multi) => {
    const z = dataRef.current?.shapes.find((x) => x.id === id && x.kind === 'zone');
    if (!z || !moved.length) return;
    const set = emptySet(); const back = emptySet();
    set.shapes.push({ id, geometry: areaGeometry(moved) });
    back.shapes.push({ id, geometry: z.geometry });
    void applyEdits(set, `You moved the zone ${z.label?.trim() || ''}`.trim(), () => back, null, { fail: 'Could not move the zone.' });
  }, [applyEdits]);

  /** An existing zone's details were changed in its card: kept at once (the outline is kept as it is reshaped, below). */
  const saveZoneInfo = useCallback(async (dr: Draft, f: ZoneForm) => {
    const d = dataRef.current;
    const was = dr.editId ? d?.shapes.find((x) => x.id === dr.editId && x.kind === 'zone') : undefined;
    if (!d || !was || !f.name.trim()) return;
    const set = emptySet(); const back = emptySet();
    zoneInfoEdits(was, f, zoneTypes, set, back);
    if (isEmptySet(set)) return;
    await applyEdits(set, `You changed the zone ${f.name.trim()}`, () => back, null, { fail: 'Could not save the zone.' });
  }, [zoneTypes, applyEdits]);

  // A zone being reshaped keeps each new outline once the corner is let go (the outline it opened with is not written again).
  const zoneKeptPts = useRef<{ sid: number; json: string } | null>(null);
  useEffect(() => {
    if (!draft || draft.kind !== 'zone' || !draft.editId || draft.infoOnly || draft.phase !== 'refine' || draft.points.length < MIN_POINTS) return;
    const json = JSON.stringify(draft.points);
    if (!zoneKeptPts.current || zoneKeptPts.current.sid !== draft.sid) { zoneKeptPts.current = { sid: draft.sid, json }; return; }
    if (zoneKeptPts.current.json === json) return;
    const { sid, editId: id, points: pts } = draft;
    const t = window.setTimeout(() => {
      const was = dataRef.current?.shapes.find((x) => x.id === id && x.kind === 'zone');
      if (!was) return;
      try {
        const multi = clean(toMulti({ type: 'Polygon', coordinates: [[...pts, pts[0]]] }));
        if (areaOf(multi) <= AREA_EPS) { notifyErr('That shape has no area. Draw at least three points apart.', 'crisis-map'); return; }
        zoneKeptPts.current = { sid, json };
        const geometry = areaGeometry(multi);
        if (sameJson(was.geometry, geometry)) return;
        const set = emptySet(); const back = emptySet();
        set.shapes.push({ id: was.id, geometry }); back.shapes.push({ id: was.id, geometry: was.geometry });
        void applyEdits(set, `You reshaped the zone ${was.label?.trim() || ''}`.trim(), () => back, null, { fail: 'Could not save the zone.' });
      } catch {
        notifyErr('That shape could not be worked out. Try drawing it again.', 'crisis-map');
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [draft, applyEdits]);

  // ── Give land, Paint and Erase ──
  // Drawn areas (and the countries one cabinet holds) as the clipper takes them. A brush or a province never changes a
  // country's outline: land of another cabinet's country is only covered by an area on top, and a country the painter
  // already holds adds nothing.
  const areaTerrs = useCallback((d: MapData): ClaimTerr[] => d.shapes.filter((s) => s.kind === 'area').map((s) => {
    const m = toMulti(s.geometry);
    return { id: `a:${s.id}`, kind: 'area' as const, owner: s.owner_cabinet_id, multi: m, bbox: bboxOf(m) };
  }), []);
  const countryTerrsOf = useCallback((d: MapData, owner: string): ClaimTerr[] => {
    const list: ClaimTerr[] = [];
    for (const r of d.regions) {
      if (r.owner_cabinet_id !== owner) continue;
      const o = storedOutline(d, r.region_key);
      const b = baseRef.current.get(r.region_key);
      list.push({ id: `c:${r.region_key}`, kind: 'country', owner, multi: o ?? b?.multi ?? [], bbox: o ? bboxOf(o) : b?.bbox ?? null });
    }
    return list;
  }, []);

  /** Adds land to a cabinet: it joins the cabinet's own area it touches (else becomes a new one) and is cut out of other areas. */
  const paintLand = useCallback((stroke: Multi, owner: string, label: string | null, text: string, km = BRUSH_DEFAULT_KM) => {
    const d = dataRef.current;
    if (!d) return;
    const holder = cabById.get(owner)?.name ?? 'that cabinet';
    const set = emptySet(); const back = emptySet();
    let gone: string[] = [];
    let grown = false;
    try {
      const res = planPaint(stroke, owner, areaTerrs(d), countryTerrsOf(d, owner), km);
      if (res.nothing) { notifyErr(`That land already belongs to ${holder}.`, 'crisis-map'); return; }
      gone = writePlan(res.plan, d, set, back);
      if (res.target) {
        const id = res.target.id.slice(2);
        const shape = d.shapes.find((x) => x.id === id);
        if (!shape) return;
        grown = true;
        if (res.targetEmptied) {
          set.removeShapes.push(id);
          back.addShapes.push(shape);
        } else {
          set.shapes.push({ id, geometry: areaGeometry(res.plan.land) });
          back.shapes.push({ id, geometry: shape.geometry });
        }
      } else {
        set.addShapes.push({
          id: `new-b${new Date().getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, crisis_id: ref.id, kind: 'area',
          owner_cabinet_id: owner, label, color: null, geometry: areaGeometry(res.plan.land), public: true, revealed_to: [],
        });
      }
    } catch {
      notifyErr('That land could not be worked out. Try a smaller stroke.', 'crisis-map');
      return;
    }
    void applyEdits(set, text, grown ? () => back : (ids) => ({ ...back, removeShapes: [...back.removeShapes, ...ids] }), goneNote(gone));
  }, [ref.id, cabById, areaTerrs, countryTerrsOf, writePlan, applyEdits]);

  /** Takes land out of drawn areas (every one under it, or only `only`'s); an area left with nothing is removed. */
  const eraseLand = useCallback((stroke: Multi, text: string, only: string | null, none: string, km = BRUSH_DEFAULT_KM) => {
    const d = dataRef.current;
    if (!d) return;
    const set = emptySet(); const back = emptySet();
    let gone: string[] = [];
    try {
      const areas = areaTerrs(d).filter((a) => !only || a.owner === only);
      const plan = planErase(stroke, areas, km);
      if (!plan.cuts.length) { notifyErr(none, 'crisis-map'); return; }
      gone = writePlan(plan, d, set, back);
    } catch {
      notifyErr('That land could not be worked out. Try a smaller stroke.', 'crisis-map');
      return;
    }
    void applyEdits(set, text, () => back, goneNote(gone));
  }, [areaTerrs, writePlan, applyEdits]);

  /** A brush stroke is finished (one undo step). */
  const strokeDone = useCallback((mode: BrushMode, stroke: Multi) => {
    if (!(editable && canMap)) return;
    if (mode === 'erase') {
      eraseLand(stroke, 'You erased land', null, 'There is no drawn land under the brush. Erase takes away painted and drawn land, not whole countries.', brushKm);
      return;
    }
    if (!chipOwner) { notifyErr('Pick a cabinet to paint with, or use Erase to take land away.', 'crisis-map'); return; }
    paintLand(stroke, chipOwner, null, `You painted land for ${cabById.get(chipOwner)?.name ?? 'a cabinet'}`, brushKm);
  }, [editable, canMap, chipOwner, cabById, eraseLand, paintLand, brushKm]);

  /** Who controls a zone (null: nobody). */
  const setZoneController = useCallback((id: string, owner: string | null) => {
    const z = dataRef.current?.shapes.find((x) => x.id === id && x.kind === 'zone');
    if (!z || (z.owner_cabinet_id ?? null) === owner) return;
    const set = emptySet(); const back = emptySet();
    set.owners.push({ id, owner_cabinet_id: owner });
    back.owners.push({ id, owner_cabinet_id: z.owner_cabinet_id ?? null });
    const name = z.label?.trim() || 'the zone';
    const was = z.owner_cabinet_id ? cabById.get(z.owner_cabinet_id)?.name ?? 'a cabinet' : 'nobody';
    const text = owner ? `You gave control of ${name} to ${cabById.get(owner)?.name ?? 'a cabinet'}` : `You took control of ${name} away from ${was}`;
    void applyEdits(set, text, () => back, null, { fail: 'Could not change who controls the zone.' });
  }, [cabById, applyEdits]);

  /** A click with Give land: a zone, a province, a drawn area or a country goes to the cabinet in the chip (again: back to nobody). */
  const giveClick = useCallback((map: MLMap, e: MapMouseEvent) => {
    const d = dataRef.current;
    if (!d) return;
    const owner = chipOwner;
    const toggle = (cur: string | null): string | null => (owner === null || cur === owner ? null : owner);
    const who = owner ? cabById.get(owner)?.name ?? 'a cabinet' : 'nobody';
    // A zone sits over the land: a click on one gives its control. Alt goes through zones and provinces to the area or country under them.
    const through = (e.originalEvent as MouseEvent).altKey;
    if (zonesOn && !through) {
      const zid = zoneAt(map, e.point);
      const z = zid ? d.shapes.find((x) => x.id === zid && x.kind === 'zone') : null;
      if (z) { setZoneController(z.id, toggle(z.owner_cabinet_id ?? null)); return; }
    }
    const here: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const f = map.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0] ?? map.queryRenderedFeatures(e.point, { layers: [L_BASE_FILL] })[0];
    const countryKey = f?.properties?.key as string | undefined;
    const areas = areaTerrs(d);
    const areaHere = areas.find((a) => a.multi.length > 0 && pointIn(here, a.multi)) ?? null;
    // A state or province (when that layer is on and loaded): its exact polygon joins the cabinet's land.
    const provinces = provincesRef.current;
    const pv = !through && regionsOn && provinces ? provinceAt(provinces, here[0], here[1]) : null;
    if (pv) {
      const holder = areaHere ? areaHere.owner : countryKey ? d.regions.find((r) => r.region_key === countryKey)?.owner_cabinet_id ?? null : null;
      if (owner === null || holder === owner) {
        eraseLand(
          pv.multi, owner ? `You gave ${pv.name} back to nobody` : `You took ${pv.name} away from whoever held it`, owner,
          owner ? `${who} holds ${pv.name} as part of a whole country. Turn the Regions layer off and click the country to give it back.`
            : `${pv.name} is not drawn land. To take a whole country away, turn the Regions layer off and click the country.`,
          TIDY_KM,
        );
      } else {
        paintLand(pv.multi, owner, pv.name, `You gave ${pv.name} to ${who}`, TIDY_KM);
      }
      return;
    }
    const sid = map.queryRenderedFeatures(e.point, { layers: [L_SHAPE_FILL] })[0]?.properties?.id as string | undefined;
    const area = sid ? d.shapes.find((x) => x.id === sid && x.kind === 'area') : null;
    if (area) { pickOwner({ kind: 'area', id: area.id }, toggle(area.owner_cabinet_id)); return; }
    if (countryKey && world?.byKey.has(countryKey)) {
      const cur = d.regions.find((r) => r.region_key === countryKey)?.owner_cabinet_id ?? null;
      pickOwner({ kind: 'country', key: countryKey }, toggle(cur));
    }
  }, [chipOwner, cabById, zonesOn, regionsOn, world, zoneAt, areaTerrs, eraseLand, paintLand, setZoneController, pickOwner]);

  /** Undo in the editor: one step back through the corners just changed (or, while drawing, the last point). */
  const undoDraft = useCallback(() => {
    setDraft((d) => {
      if (!d) return d;
      if (d.trail.length) return { ...d, points: d.trail[d.trail.length - 1], trail: d.trail.slice(0, -1), fwd: [...(d.fwd ?? []), d.points] };
      // Drawing with no point left to take back: the drawing is dropped. A closed outline goes back to drawing.
      if (d.phase === 'draw') return null;
      return d.infoOnly ? d : { ...d, phase: 'draw', trail: [], fwd: [] };
    });
  }, []);

  /** Redo in the editor: puts back the point or corner Undo just took away. */
  const redoDraft = useCallback(() => {
    setDraft((d) => {
      if (!d || !d.fwd?.length) return d;
      return { ...d, points: d.fwd[d.fwd.length - 1], fwd: d.fwd.slice(0, -1), trail: [...d.trail.slice(-49), d.points] };
    });
  }, []);

  /** Puts a unit's earlier details back (Go back after an edit, when changes are saved at once). */
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

  /** Removes a unit by id (Go back after adding one, when changes are saved at once). */
  const dropUnit = useCallback(async (id: string) => {
    const before = rawRef.current;
    if (before) setData({ ...before, units: before.units.filter((x) => x.id !== id) });
    setSelUnit((cur) => (cur === id ? null : cur));
    await run(async () => {
      try {
        await deleteUnitChecked(ref, id);
        setLast({ at: new Date().getTime(), text: 'You removed a unit' });
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not remove the unit.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  /** Adds a removed unit back (Go back after deleting one, when changes are saved at once); it comes back under a new id. */
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

  /** `quiet`: a card that keeps its changes as they are made does not announce each one. */
  const submitUnit = useCallback(async (dd: UnitDraft, existing: MapUnit | null, quiet = false) => {
    const before = rawRef.current;
    const patch = {
      name: dd.name.trim(), kind: dd.kind, strength: dd.strength, owner_cabinet_id: dd.owner,
      note: dd.note.trim() ? dd.note.trim() : null, revealed_to: dd.revealed,
      ...(existing || dd.sight !== null ? { sight_km: dd.sight } : {}),
      custom_type: dd.kind === 'custom' ? dd.customType : null, picture_url: dd.picture, details: dd.details.trim() ? dd.details.trim() : null,
    };
    // While changes wait to be sent, adding and editing a unit wait with the moves.
    if (!isStage && draftModeRef.current) {
      if (existing) {
        const set = emptySet(); const back = emptySet();
        const c: UnitChange = { id: existing.id }; const b: UnitChange = { id: existing.id };
        if (patch.name !== existing.name) { c.name = patch.name; b.name = existing.name; }
        if (patch.kind !== existing.kind) { c.kind = patch.kind; b.kind = existing.kind; }
        if (patch.strength !== existing.strength) { c.strength = patch.strength; b.strength = existing.strength; }
        if (patch.owner_cabinet_id !== existing.owner_cabinet_id) { c.owner_cabinet_id = patch.owner_cabinet_id; b.owner_cabinet_id = existing.owner_cabinet_id; }
        if ((patch.note ?? null) !== (existing.note ?? null)) { c.note = patch.note; b.note = existing.note ?? null; }
        if ([...patch.revealed_to].sort().join() !== [...existing.revealed_to].sort().join()) { c.revealed_to = patch.revealed_to; b.revealed_to = existing.revealed_to; }
        if ('sight_km' in patch && (patch.sight_km ?? null) !== (existing.sight_km ?? null)) { c.sight_km = patch.sight_km ?? null; b.sight_km = existing.sight_km ?? null; }
        for (const k of ['custom_type', 'picture_url', 'details'] as const) if ((patch[k] ?? null) !== (existing[k] ?? null)) { c[k] = patch[k] ?? null; b[k] = existing[k] ?? null; }
        if (Object.keys(c).length > 1) {
          set.units.push(c); back.units.push(b);
          await applyEdits(set, `You updated ${patch.name}`, () => back, null, { fail: 'Could not save the unit.' });
          if (!quiet) notifyOk('Unit saved to the unsent changes', 'crisis-map');
        }
        return;
      }
      if (newUnit) {
        const lng = round5(clampLng(newUnit.lng)); const lat = round5(clampLat(newUnit.lat));
        const id = localUnitId();
        const set = emptySet(); const back = emptySet();
        set.unitAdds?.push({ id, ...patch, sight_km: patch.sight_km ?? null, lng, lat });
        back.unitRemoves?.push(id);
        changeTool('select');
        await applyEdits(set, `You added ${patch.name}`, () => back, null, { fail: 'Could not add the unit.' });
        notifyOk('Unit added to the unsent changes', 'crisis-map');
      }
      return;
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
        if (!quiet) notifyOk(existing ? 'Unit saved' : 'Unit added', 'crisis-map');
        if (!existing) changeTool('select');
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not save the unit.'), 'crisis-map');
      }
    });
  }, [ref, run, newUnit, changeTool, applyEdits, isStage, pushHistory, revertUnit, dropUnit]);

  const removeUnit = useCallback(async (u: MapUnit) => {
    setSelUnit(null);
    // Waits with the other unsent changes, and takes the unit's own unsent edits with it.
    if (!isStage && draftModeRef.current) {
      const set = emptySet(); const back = emptySet();
      set.unitRemoves?.push(u.id);
      back.unitAdds?.push(unitAddOf(u));
      await applyEdits(set, `You removed ${u.name}`, () => back, null, { fail: 'Could not remove the unit.' });
      notifyOk('Unit removed in the unsent changes', 'crisis-map');
      return;
    }
    const before = rawRef.current;
    if (before) setData({ ...before, units: before.units.filter((x) => x.id !== u.id) });
    await run(async () => {
      try {
        await deleteUnitChecked(ref, u.id);
        pushHistory({ text: `You removed ${u.name}`, undo: () => restoreUnit(u) });
        setLast({ at: new Date().getTime(), text: `You removed ${u.name}` });
        notifyOk('Unit removed', 'crisis-map');
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not remove the unit.'), 'crisis-map');
      }
    });
  }, [ref, run, pushHistory, restoreUnit, applyEdits, isStage]);

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
  /** Characters just sent keep their new spot on screen until the saved positions are read back. */
  const charOverride = useRef(new Map<string, LngLat>());
  /** Plays a character's glide when its saved spot changes (charGlide.ts). */
  const charGlider = useMemo(() => createCharGlider(), []);
  const sendDraft = useCallback(async () => {
    const local = draftRef.current;
    if (!local || isEmptySet(local) || sending) return;
    const hasMap = !!(local.regions.length || local.shapes.length || local.owners.length || local.removeShapes.length || local.addShapes.length || local.shapeInfo?.length);
    const hasUnits = !!(local.units.length || local.unitAdds?.length || local.unitRemoves?.length);
    const hasChars = !!local.chars?.length;
    const missing = [hasMap && !canMap && 'map', hasUnits && !canUnits && 'unit', hasChars && !canChars && 'character'].filter((x): x is string => !!x);
    if (missing.length) {
      notifyErr(`Sending these changes needs ${missing.join(' and ')} power. Ask the director to send them.`, 'crisis-map');
      return;
    }
    setSending(true);
    await run(async () => {
      try {
        // Send what the team shares now (another member may have added to it), once.
        const loaded = await loadMapDraftVersioned(ref);
        const fresh = parseSet(loaded.payload);
        draftBase.current = fresh; draftVersion.current = loaded.version;
        if (!fresh) {
          draftRef.current = null; setDraftSet(null); setDraftBy(null); clearHistory();
          notifyOk('Those changes were already sent', 'crisis-map');
          return;
        }
        const res = await sendSet(ref, fresh);
        if (res.error) {
          // Part may have gone through: what is left stays as the unsent changes, so nothing is sent twice.
          const left = res.remaining && !isEmptySet(res.remaining) ? res.remaining : null;
          const partial = !!left && !sameJson(left, tidySet(fresh));
          if (partial) {
            draftRef.current = left; setDraftSet(left);
            try { await persistDraft(); } catch { /* the next read shows what the team holds */ }
          }
          notifyErr(`${crisisError(res.error, 'Could not send the changes.')}${partial ? ' Some changes went through; the rest are still unsent.' : ''}`, 'crisis-map');
          return;
        }
        // Show the sent map before the unsent copy goes, so nothing jumps back to how it was and then forward.
        const sentRaw = rawRef.current;
        const shapeIds = new Map<string, string>();
        fresh.addShapes.forEach((a, i) => { if (res.added[i]) shapeIds.set(a.id, res.added[i]); });
        const unitIds = new Map<string, string>();
        (fresh.unitAdds ?? []).forEach((a, i) => { if (res.addedUnits[i]) unitIds.set(a.id, res.addedUnits[i]); });
        // What a draft still adds once `fresh` is sent: it is measured against the map as sent, so a copy of the same
        // changes (the team's newer draft, or edits made while this was sending) shrinks to what is really new.
        let residualOf: (s: EditSet | null) => EditSet | null = (s) => s;
        if (sentRaw) {
          const next = renameLocalIds(applyLocal(sentRaw, fresh, ref.id), shapeIds, unitIds);
          // The unsent copy was already on screen: the units go back to where the sent map had them, then glide.
          queueAnim(sentRaw, next, { fromSent: true });
          rawRef.current = next;
          setData(next);
          residualOf = (s) => {
            if (!s) return null;
            const r = diffData(next, renameLocalIds(applyLocal(sentRaw, s, ref.id), shapeIds, unitIds));
            r.chars = (s.chars ?? []).filter((c) => !(fresh.chars ?? []).some((f) => f.id === c.id && Math.abs(f.lng - c.lng) < 1e-6 && Math.abs(f.lat - c.lat) < 1e-6));
            return isEmptySet(r) ? null : r;
          };
        }
        setSelUnit((cur) => (cur && unitIds.get(cur)) || cur);
        setSelTerr((cur) => (cur && cur.kind === 'area' && shapeIds.has(cur.id) ? { kind: 'area', id: shapeIds.get(cur.id) as string } : cur));
        for (const c of fresh.chars ?? []) {
          charOverride.current.set(c.id, [c.lng, c.lat]);
          // The marker goes back to the sent spot and glides to the new one, the way the units do.
          const was = sentCharAt(c.id);
          if (was) {
            charGlider.targets.set(c.id, [c.lng, c.lat]);
            charGlider.expect(c.id, [c.lng, c.lat], 'ran');
            charGlider.start([{ id: c.id, from: was, to: [c.lng, c.lat] }]);
          }
        }
        // Edits made on this screen while the send ran stay as the unsent changes.
        const mineLeft = residualOf(draftRef.current);
        draftRef.current = mineLeft; setDraftSet(mineLeft); clearHistory(); setDraftBy(null);
        setLast({ at: new Date().getTime(), text: 'You sent the map changes to delegates' });
        try {
          const cleared = await clearMapDraftVersioned(ref, loaded.version);
          const now = await loadMapDraftVersioned(ref);
          if (cleared.kept) {
            // The team changed the draft while it was sending: keep that, minus what has just gone out.
            const merged = mergeDrafts(null, mineLeft, residualOf(parseSet(now.payload)));
            draftBase.current = parseSet(now.payload); draftVersion.current = now.version;
            draftRef.current = merged; setDraftSet(merged);
            const by = whoSaved(now.updated_by);
            if (by) setDraftBy(by);
            if (!sameJson(merged, draftBase.current)) await persistDraft();
          } else {
            draftBase.current = null; draftVersion.current = 0;
            adoptDraftRef.current(now);
          }
        } catch { notifyErr('Sent, but the unsent copy could not be cleared. Press Back to what delegates see.', 'crisis-map'); return; }
        if (fresh.chars?.length) {
          try { await v.reloadCore(); } finally { for (const c of fresh.chars) charOverride.current.delete(c.id); }
        }
        notifyOk('Sent to delegates', 'crisis-map');
      } catch (e) {
        notifyErr(crisisError(e, 'Could not send the changes.'), 'crisis-map');
      }
    });
    setSending(false);
  }, [ref, run, sending, canMap, canUnits, canChars, clearHistory, persistDraft, v, queueAnim, whoSaved, sentCharAt, charGlider]);

  /** Throws the unsent changes away. Go back brings them back (with the steps Go back had before). */
  const discardDraft = useCallback(async () => {
    const prev = draftRef.current;
    const prevSteps = historyRef.current;
    setConfirmDiscard(false);
    draftRef.current = null; setDraftSet(null);
    historyRef.current = []; setHistoryN(0); setUndo(null);
    redoRef.current = []; setRedoN(0);
    setSelUnit(null); setSelTerr(null);
    await run(async () => {
      try {
        await persistDraft();
        const teamLeft = draftRef.current && !isEmptySet(draftRef.current);
        notifyOk(teamLeft ? 'Your changes are thrown away. Changes the team added meanwhile are still unsent' : 'Back to what delegates see', 'crisis-map');
        if (!prev || isEmptySet(prev)) return;
        const n = setSize(prev);
        pushHistory({
          text: 'Brought back your unsent changes',
          undo: async () => {
            // Anything started since is kept on top of what comes back.
            const sent = rawRef.current;
            const cur = draftRef.current;
            let target: EditSet | null = prev;
            if (sent && cur && !isEmptySet(cur)) {
              target = diffData(sent, applyLocal(applyLocal(sent, prev, ref.id), cur, ref.id));
              target.chars = mergeChars(prev.chars, cur.chars, sentCharAt);
            }
            draftRef.current = target; setDraftSet(target);
            historyRef.current = prevSteps; setHistoryN(prevSteps.length);
            await run(async () => {
              try {
                await persistDraft();
                setLast({ at: new Date().getTime(), text: 'You brought back the unsent changes' });
                notifyOk('Your unsent changes are back', 'crisis-map');
              } catch (e) {
                draftRef.current = cur; setDraftSet(cur);
                notifyErr(crisisError(e, 'Could not bring the unsent changes back.'), 'crisis-map');
              }
            });
          },
        });
        setUndo({ sid: new Date().getTime(), text: `Threw away ${n} unsent ${n === 1 ? 'change' : 'changes'}`, note: null });
      } catch (e) {
        draftRef.current = prev; setDraftSet(prev);
        historyRef.current = prevSteps; setHistoryN(prevSteps.length);
        notifyErr(crisisError(e, 'Could not throw away the unsent changes.'), 'crisis-map');
      }
    });
  }, [run, persistDraft, pushHistory, sentCharAt, ref.id]);

  /** Staff dragged a character to a new spot: the marker is already there. It waits with the unsent changes, else it is saved. */
  const moveChar = useCallback(async (id: string, lng: number, lat: number) => {
    const c = core.characters.find((x) => x.id === id);
    if (!c) return;
    const prev: LngLat | null = draftCharRef.current.get(id) ?? sentCharAt(id);
    const nl = round5(clampLng(lng)); const nt = round5(clampLat(lat));
    if (draftModeRef.current && !isStage) {
      if (!prev) return;
      const set = emptySet(); const back = emptySet();
      set.chars?.push({ id, lng: nl, lat: nt });
      back.chars?.push({ id, lng: prev[0], lat: prev[1] });
      await applyEdits(set, `You moved ${c.name}`, () => back, null, { fail: 'Could not move the character.' });
      return;
    }
    charOverride.current.set(id, [nl, nt]);
    // This screen shows the move already; when the saved spot catches up only the trail is drawn.
    charGlider.expect(id, [nl, nt], 'still');
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
  }, [core.characters, ref, v, isStage, applyEdits, sentCharAt, charGlider]);

  /** The unit was dragged: ask in place before saving. */
  const askMove = useCallback((id: string, lng: number, lat: number) => {
    const map = mapRef.current;
    const u = dataRef.current?.units.find((x) => x.id === id);
    const base = rawRef.current?.units.find((x) => x.id === id) ?? u;
    if (!map || !u) return;
    const was = pendingMoveRef.current;
    if (was && was.id !== id) cancelMove();
    const a = map.project([u.lng, u.lat]); const b = map.project([lng, lat]);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 4) { cancelMove(); showMove(null, null); return; }
    // Unsent changes need no yes: the move joins them, shows its line, and Go back takes it away.
    if (draftModeRef.current) { showMove(null, null); void moveUnit(id, lng, lat); return; }
    setPending({ id, name: u.name, lng, lat });
    showMove(base ?? null, [lng, lat], false);
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

  /** A press on the ring of a unit that was not selected: it is selected and, if the button is still down, the resize begins. */
  const ringBegin = useRef<string | null>(null);
  /** The unit whose dashed sight ring is under a point of the screen (rings the fog draws for the viewer's own units). */
  const ringAt = useCallback((map: MLMap, pt: { x: number; y: number }): string | null => {
    const h = fogLatest.current;
    if (!h || h.showRings === false) return null;
    let best: string | null = null; let bestD = RING_HIT_PX;
    for (const c of h.circles) {
      if (!c.id) continue;
      const d = distToRingPx(sightRingPx(map, c), pt);
      if (d <= bestD) { bestD = d; best = c.id; }
    }
    return best;
  }, []);

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

  // The Paint and Erase brushes (the pen under the pointer and the stroke being dragged).
  const brush = useBrush({
    ready: !!world, mapRef, setSource,
    mode: editable && canMap && (tool === 'paint' || tool === 'erase') ? tool : null,
    km: brushKm, color: chipColor, onStroke: strokeDone,
  });

  // Moving a whole shape: the Move handle on a selected area or zone (and the body of the selected shape in Select), or on
  // a shape being drawn or reshaped. A zone and an area are kept at once; a shape in hand moves its corners.
  const moveDraftPts = draft && draft.kind === 'zone' && editable && canMap && draft.phase === 'refine' && !draft.infoOnly && draft.points.length >= MIN_POINTS ? draft.points : null;
  // A multi-piece or holed zone open for editing keeps its outline but can still be carried whole.
  const infoZoneRow = draft && draft.kind === 'zone' && draft.infoOnly && draft.editId && draft.phase === 'refine' && editable && canMap
    ? zones.find((z) => z.id === draft.editId) ?? null : null;
  const moveZoneRow = (!draft && canZones && tool === 'select' ? selZoneRow : null) ?? infoZoneRow;
  const moveShape = useMemo<Multi | null>(() => {
    if (compact || stageKind === 'unit') return null;
    if (moveDraftPts) return [[[...moveDraftPts, moveDraftPts[0]]]];
    if (moveZoneRow) return toMulti(moveZoneRow.geometry);
    return null;
  }, [compact, stageKind, moveDraftPts, moveZoneRow]);
  const mover = useShapeMover({
    ready: !!world, mapRef, mlRef, shape: moveShape, body: true,
    hideId: moveZoneRow ? moveZoneRow.id : null,
    preview: (moved) => {
      if (moveDraftPts) { setSource(SRC_DRAFT, draftFc(moved ? (moved[0][0].slice(0, -1) as LngLat[]) : moveDraftPts, draftColor)); return; }
      if (!moved) { resetEdit(); return; }
      setSource(SRC_EDIT, multiFc(moved, null));
    },
    onMove: (moved) => {
      if (moveDraftPts) {
        const sid = draft?.sid; const pts = moved[0][0].slice(0, -1) as LngLat[];
        setDraft((d) => (d && d.sid === sid ? withPoints(d, pts) : d));
        return;
      }
      if (moveZoneRow) { moveZone(moveZoneRow.id, moved); return; }
    },
  });

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
        if (tool === 'paint' || tool === 'erase') return;   // a stroke is made on release
        if (tool === 'give') {
          if (editable && canMap) giveClick(map, e);
          return;
        }
        if ((tool === 'draw' || tool === 'zones') && draft) {
          if (draft.phase !== 'draw') return;
          const pts = draft.points;
          const lastPt = pts[pts.length - 1];
          if (lastPt) {
            const lp = map.project(lastPt);
            if (Math.hypot(lp.x - e.point.x, lp.y - e.point.y) < 6) return;
          }
          if (pts.length >= MIN_POINTS) {
            const fp = map.project(pts[0]);
            if (Math.hypot(fp.x - e.point.x, fp.y - e.point.y) < 12) { setDraft(toRefine(draft)); return; }
          }
          setDraft(withPoints(draft, [...pts, [round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))]]));
          return;
        }
        // Draw: a click starts a new outline, whatever is under it (land it covers is taken from its holder).
        if (tool === 'draw') {
          if (editable && canMap) {
            setSelTerr(null); setSelUnit(null); setSelChar(null);
            setDraft({ sid: new Date().getTime(), kind: 'area', phase: 'draw', points: [[round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))]], owner: chipOwner, ownerChosen: true, trail: [] });
          }
          return;
        }
        // Zones: a click picks a zone (to reshape it, for staff); the sea and the land under it are left alone.
        if (tool === 'zones') {
          const zid = zoneAt(map, e.point);
          if (zid && canZones) editZone(zid);
          else if (!zid) setSelZone(null);
          return;
        }
        // Select: a zone sits over the territory, so a click on one shows its card.
        if (tool === 'select' && zonesOn) {
          const zid = zoneAt(map, e.point);
          if (zid) { setSelUnit(null); setSelChar(null); setSelTerr(null); setSelZone(zid); return; }
        }
        // Select: a click picks a territory (a drawn area sits on top of a country).
        const area = map.queryRenderedFeatures(e.point, { layers: [L_SHAPE_FILL] })[0];
        const sid = area?.properties?.id as string | undefined;
        if (sid && dataRef.current?.shapes.some((s) => s.id === sid && s.kind === 'area')) {
          setSelUnit(null); setSelChar(null); setSelZone(null); setSelTerr({ kind: 'area', id: sid });
          return;
        }
        // The real outline under a changed border counts as the country too (so a country that lost all its land
        // can still be picked and put back).
        const f = map.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0] ?? map.queryRenderedFeatures(e.point, { layers: [L_BASE_FILL] })[0];
        const key = f?.properties?.key as string | undefined;
        if (key) {
          setSelUnit(null); setSelChar(null); setSelZone(null); setSelTerr({ kind: 'country', key });
          return;
        }
        // Open sea: let go of what is selected.
        if (selTerr || selUnit || selChar || selZone) clearSelection();
      },
      onMapDblClick: (e) => {
        if (draft && draft.phase === 'draw' && draft.points.length >= MIN_POINTS) {
          e.preventDefault();
          setDraft(toRefine(draft));
        }
      },
      onPress: (e) => {
        const map = mapRef.current;
        // Paint and Erase: press and drag makes a stroke (hold Shift to move the map instead).
        if (map && editable && canMap && !dragRef.current && !freeRef.current && brush.press(e)) return;
        // A shape in hand, or the selected area or zone: pressing inside it carries it (the Move handle does the same).
        if (map && editable && canMap && !dragRef.current && !freeRef.current && mover.press(e)) return;
        // Draw: press and drag draws an outline freehand (hold Shift to move the map instead).
        if (map && editable && canMap && !dragRef.current && !freeRef.current
          && (tool === 'draw' || (tool === 'zones' && draft?.phase === 'draw')) && (!draft || draft.phase === 'draw')) {
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
        // Any other unit's dashed ring: the press selects that unit and, held, drags its ring.
        if (map && canUnits && editable && !compact && tool === 'select' && !dragRef.current && !freeRef.current) {
          const tg = e.originalEvent.target as HTMLElement | null;
          const hitId = tg?.closest('.wm-marker') ? null : ringAt(map, e.point);
          if (hitId && hitId !== selUnit) {
            e.preventDefault();
            ringBegin.current = hitId;
            setNewUnit(null); setSelTerr(null); setSelChar(null); setSelUnit(hitId);
            return;
          }
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
        if (brush.move(e)) return;
        if (mover.move(e)) return;
        const fh = freeRef.current;
        if (fh) {
          const last = fh.pts[fh.pts.length - 1];
          if (Math.hypot(e.point.x - last.x, e.point.y - last.y) >= 3) {
            fh.pts.push({ x: e.point.x, y: e.point.y, ll: [round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))] });
            if (freeFrame.current === null) {
              freeFrame.current = window.requestAnimationFrame(() => {
                freeFrame.current = null;
                const cur = freeRef.current;
                if (cur) setSource(SRC_DRAFT, draftFc(cur.pts.map((p) => p.ll), draftColor, true));
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
        const drawing = tool === 'zones' && !!draft;
        const onRing = !near && canUnits && editable && !compact && tool === 'select'
          && ((!!sightCtl.current && sightCtl.current.hit(e.point)) || !!ringAt(map, e.point));
        map.getCanvasContainer().style.cursor = near ? 'grab'
          : onRing ? 'ew-resize'
          : drawing || tool === 'draw' ? PEN_CURSOR
          : tool === 'paint' || tool === 'erase' || (tool === 'unit' && addKind) ? 'crosshair'
            : tool === 'give' ? 'pointer' : '';
      },
      onRelease: () => {
        if (sightCtl.current?.active) { suppressClickUntil.current = performance.now() + 400; sightCtl.current.end(); return; }
        if (ringBegin.current) { ringBegin.current = null; suppressClickUntil.current = performance.now() + 400; return; }
        if (brush.release()) { suppressClickUntil.current = performance.now() + 400; return; }
        if (mover.release()) { suppressClickUntil.current = performance.now() + 400; return; }
        const fh = freeRef.current;
        if (fh) {
          freeRef.current = null;
          if (freeFrame.current !== null) { window.cancelAnimationFrame(freeFrame.current); freeFrame.current = null; }
          const corners = freehandCorners(fh.pts);
          setSource(SRC_DRAFT, draft ? draftFc(draft.points, draftColor, draft.phase === 'draw') : emptyFc);
          if (fh.pts.length > 2) suppressClickUntil.current = performance.now() + 400;
          if (!corners) {
            if (fh.pts.length > 2) notifyErr('Draw a bigger shape, or click points one by one.', 'crisis-map');
            return;
          }
          const from: Draft = draft ?? { sid: new Date().getTime(), kind: 'area', phase: 'draw', points: [], owner: chipOwner, ownerChosen: true, trail: [] };
          setDraft(toRefine({ ...from, points: from.points.length >= 2 ? [...from.points, ...corners] : corners }));
          return;
        }
        const dr = dragRef.current;
        if (!dr) return;
        dragRef.current = null;
        if (previewFrame.current !== null) { window.cancelAnimationFrame(previewFrame.current); previewFrame.current = null; }
        resetEdit();
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
        void growth;
        stageOutline(dr.terr, next);
      },
      onUnitClick: (id) => {
        if (stageKind === 'unit') { stageRef.current?.onSelectUnit?.(id); return; }
        if (tool !== 'select') return;
        setNewUnit(null); setSelTerr(null); setSelChar(null); setSelZone(null);
        setSelUnit(id);
      },
      onCharClick: (id) => {
        if (tool !== 'select' || compact) return;
        setSelUnit(null); setSelTerr(null); setSelZone(null);
        setSelChar(id);
      },
      onUnitMoved: (id, lng, lat) => { askMove(id, lng, lat); },
      onUnitDrag: (id, lng, lat) => {
        const u = rawRef.current?.units.find((x) => x.id === id) ?? dataRef.current?.units.find((x) => x.id === id);
        if (u) showMove(u, [lng, lat]);
      },
      onCharDrag: (id, lng, lat) => {
        // The line follows the pointer from where the character is saved, like a dragged unit's.
        const c = charsRef.current.find((x) => x.id === id);
        const from = sentCharAt(id);
        if (!c || !from) return;
        const { unit, look } = charAsMover(c, from, c.cabinet_id ? cabById.get(c.cabinet_id) : undefined);
        showMove(unit, [lng, lat], true, look);
      },
      onCharMoved: (id, lng, lat) => { showMove(null, null); void moveChar(id, lng, lat); },
      redrawFog,
      regroupChars,
      brushDown: () => brush.isDown(),
      escape: () => {
        if (brush.cancel()) return true;
        if (mover.cancel()) return true;
        if (freeRef.current) {
          freeRef.current = null;
          setSource(SRC_DRAFT, draft ? draftFc(draft.points, draftColor, draft.phase === 'draw') : emptyFc);
          return true;
        }
        if (dragRef.current) {
          dragRef.current = null;
          resetEdit();
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
        const had = !!(selTerr || selUnit || selChar || selZone) && stageKind !== 'unit';
        if (stageKind !== 'unit') clearSelection();
        // Nothing left to back out of: a tool other than Select goes back to Select.
        if (!had && tool !== 'select' && stageKind !== 'unit') { changeTool('select'); return true; }
        return had;
      },
    };
  });

  // ── Undo and Redo act on the innermost thing in progress first ──
  // 1 a drag being made, 2 a card field waiting to be kept, 3 the drawing (points, then corners, then back to drawing),
  // 4 an outline change not yet kept, 5 only then the last change that was kept.
  const panelState = useSyncExternalStore(subscribePanelEdits, panelEditState, () => '00');
  const panelCanUndo = panelState[0] === '1';
  const panelCanRedo = panelState[1] === '1';
  const draftOn = !!draft && editable;
  const draftCanUndo = draftOn && !!draft && (draft.trail.length > 0 || draft.phase === 'draw' || !draft.infoOnly);
  const draftCanRedo = draftOn && !!draft?.fwd?.length;
  const lastStep = historyRef.current[historyRef.current.length - 1];
  const mapUndo = useCallback((): void => {
    if (brush.cancel() || mover.cancel()) return;
    if (freeRef.current || dragRef.current) { liveRef.current?.escape(); return; }
    if (undoPanelEdit()) return;
    if (draftOn && draftCanUndo) { undoDraft(); return; }
    if (terrEditRef.current) { undoOutline(); return; }
    goBack();
  }, [brush, mover, draftOn, draftCanUndo, undoDraft, undoOutline, goBack]);
  const mapRedo = useCallback((): void => {
    if (redoPanelEdit()) return;
    if (draftOn) { if (draftCanRedo) redoDraft(); return; }
    goForward();
  }, [draftOn, draftCanRedo, redoDraft, goForward]);
  const undoLabel = panelCanUndo ? 'Undo the last change in the card'
    : draftOn && draftCanUndo && draft
      ? (draft.phase === 'draw' ? (draft.trail.length || draft.points.length > 1 ? 'Undo last point' : 'Cancel the drawing') : draft.trail.length ? 'Undo corner' : 'Undo: back to drawing the outline')
      : terrEdit ? 'Undo corner'
        : lastStep ? `Undo: ${lastStep.text.replace(/^You /, '')}` : null;
  const redoLabel = panelCanRedo ? 'Redo the change in the card' : draftOn && draftCanRedo ? (draft?.phase === 'draw' ? 'Redo point' : 'Redo corner') : null;

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
          m.addSource(SRC_BRUSH, { type: 'geojson', data: emptyFc });
          addPhysicalSources(m);
          for (const layer of mapLayers()) m.addLayer(layer);
          addCityLayers(m);
          for (const layer of editLayers()) m.addLayer(layer);
          nameCtl.current = createNameLabels(m, ml);
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
          m.on('touchmove', (e) => { if ((dragRef.current || freeRef.current || sightCtl.current?.active || liveRef.current?.brushDown()) && e.points.length === 1) liveRef.current?.onPointerMove(e); });
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
              // The country under the pointer lights up while Give land waits for a click.
              const el = m.getCanvasContainer();
              const want = el.dataset.tool === 'give' && !el.dataset.busy && !dragRef.current;
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
      nameCtl.current?.destroy(); nameCtl.current = null;
      if (fogFrame.current !== null) { window.cancelAnimationFrame(fogFrame.current); fogFrame.current = null; }
      fogCanvas.current = null;
      resizeObs.current?.disconnect(); resizeObs.current = null;
      if (map) map.remove();
      mapRef.current = null;
      mlRef.current = null;
    };
  }, []);

  // The Give land hover reads the tool from the map element (the handler is made once).
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const el = map.getCanvasContainer();
    el.dataset.tool = canMap && editable ? tool : '';
    if (draft) el.dataset.busy = '1'; else delete el.dataset.busy;
    el.style.cursor = tool === 'draw' || (tool === 'zones' && !!draft) ? PEN_CURSOR : tool === 'paint' || tool === 'erase' || (tool === 'unit' && addKind) ? 'crosshair' : tool === 'give' ? 'pointer' : '';
    if (draft || tool === 'draw' || tool === 'paint' || tool === 'erase') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
    if (tool !== 'give' || draft) {
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
  const editingZoneId = draft?.kind === 'zone' && !draft.infoOnly ? draft.editId ?? null : null;
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    // Zones follow the Zones switch; a zone being reshaped is drawn by the editor instead.
    const drawn = shownShapes.filter((s) => s.kind !== 'zone' || (zonesOn && s.id !== editingZoneId));
    const colorOf = (s: MapShape) => (s.kind === 'zone' ? safeColor(zoneColorOf(s, zoneTypes)) : shapeColor(s, cabById));
    // A zone keeps its type's fill and dashes; the cabinet that controls it outlines it in its own colour.
    const controllerOf = (s: MapShape) => (s.kind === 'zone' && s.owner_cabinet_id ? cabById.get(s.owner_cabinet_id) ?? null : null);
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: drawn.map((s) => {
        const color = colorOf(s);
        // Territory is filled and outlined exactly like the cabinet's countries.
        // The fill is opaque (the tint worked out over the land colour), so no border or line underneath shows through a drawn area.
        const props = s.kind === 'area' ? { tint: mixHex(LAND, color, 0.27), edge: cabinetTint(color, 0.95) } : {};
        const ctl = controllerOf(s);
        return {
          type: 'Feature' as const,
          properties: { id: s.id, kind: s.kind, color, ...props, ...(ctl ? { ctl: safeColor(ctl.color) } : {}) },
          geometry: s.geometry as unknown as Feature['geometry'],
        };
      }),
    };
    setSource(SRC_SHAPES, fc);
    const wanted = new Set<string>();
    for (const s of drawn) {
      if (!s.label) continue;
      wanted.add(s.id);
      const color = colorOf(s);
      const at = centroidOf(shapePoints(s.geometry));
      const old = shapeLabels.current.get(s.id);
      if (old) old.remove();
      const ctl = controllerOf(s);
      shapeLabels.current.set(s.id, new ml.Marker({ element: makeShapeLabel(s.label, color, ctl ? { text: ctl.short, color: ctl.color } : undefined), anchor: 'center' }).setLngLat(at).addTo(map));
    }
    for (const [id, mk] of [...shapeLabels.current]) {
      if (!wanted.has(id)) { mk.remove(); shapeLabels.current.delete(id); }
    }
  }, [world, shownShapes, cabById, setSource, zonesOn, zoneTypes, editingZoneId]);

  // The selected territory's outline (or the selected zone's).
  const selZoneMulti = useMemo<Multi>(() => (selZoneRow ? toMulti(selZoneRow.geometry) : []), [selZoneRow]);
  useEffect(() => {
    if (!world) return;
    setSource(SRC_SEL, multiFc(compact ? [] : selZoneMulti.length ? selZoneMulti : selMulti));
    if (!selMulti.length || !canEditTerr) setSource(SRC_HOVER, emptyFc);
  }, [world, selMulti, selZoneMulti, compact, canEditTerr, setSource]);

  // An outline changed on the map and not saved yet stays drawn in its holder's colour until Save or Cancel.
  useEffect(() => {
    if (!world) return;
    const fc = workMulti && !compact ? multiFc(workMulti, selOwnerColor ? cabinetTint(selOwnerColor, 0.3) : null) : emptyFc;
    editBase.current = fc;
    setSource(SRC_EDIT, fc);
  }, [world, workMulti, selOwnerColor, compact, setSource]);

  // Handles on a simple selected outline (a drawn area, a small country): a white corner on every corner, to drag or
  // double-click away, and a small dot in the middle of every side to drag out into a new corner. Detailed outlines
  // have none: they bend from wherever the outline is pressed.
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
          resetEdit();
          const ll = mk.getLngLat();
          const a = map.project(start); const b = map.project([ll.lng, ll.lat]);
          if (Math.hypot(a.x - b.x, a.y - b.y) < 2) return;
          try {
            stageOutline(terr, clean(withCornerMoved(base, pi, ri, vi, [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))])));
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
          try { stageOutline(terr, clean(next)); } catch { notifyErr('That border could not be worked out.', 'crisis-map'); }
        });
        corners.current.push(mk);
      }
      for (let si = 0; si < ring.length - 1; si++) {
        const a = ring[si]; const b = ring[si + 1];
        const at: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const el = makeMidpoint();
        const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(at).addTo(map);
        let moved = false;
        mk.on('dragstart', () => { moved = true; });
        mk.on('drag', () => {
          const ll = mk.getLngLat();
          setSource(SRC_EDIT, multiFc(withCornerAdded(base, pi, ri, si, [ll.lng, ll.lat]), tint));
        });
        mk.on('dragend', () => {
          resetEdit();
          const ll = mk.getLngLat();
          const p0 = map.project(at); const p1 = map.project([ll.lng, ll.lat]);
          window.setTimeout(() => { moved = false; }, 80);
          if (Math.hypot(p0.x - p1.x, p0.y - p1.y) < 3) { mk.setLngLat(at); return; }
          try {
            stageOutline(terr, clean(withCornerAdded(base, pi, ri, si, [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))])));
          } catch {
            mk.setLngLat(at);
            notifyErr('That border could not be worked out. Try a smaller move.', 'crisis-map');
          }
        });
        // A plain click adds the corner right where the dot is.
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (moved) return;
          try { stageOutline(terr, clean(withCornerAdded(base, pi, ri, si, [round5(at[0]), round5(at[1])]))); } catch { notifyErr('That border could not be worked out.', 'crisis-map'); }
        });
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        corners.current.push(mk);
      }
    }));
    return () => { for (const h of corners.current) h.remove(); corners.current = []; };
  }, [world, canEditTerr, selTerr, selMulti, selDetailed, selOwnerColor, stageOutline, resetEdit, setSource]);

  // New territory preview, in its owner's colours.
  useEffect(() => {
    if (!world) return;
    setSource(SRC_DRAFT, draft && !draft.infoOnly ? draftFc(draft.points, draftColor, draft.phase === 'draw') : emptyFc);
  }, [world, draft, draftColor, setSource]);

  // Who a new shape belongs to: the cabinet whose land it touches, when it touches exactly one. Otherwise it asks.
  const touching = useMemo<string[]>(() => {
    if (!draft || draft.kind !== 'area' || draft.phase !== 'refine' || draft.points.length < MIN_POINTS || !data) return [];
    try {
      const land = clean(toMulti({ type: 'Polygon', coordinates: [[...draft.points, draft.points[0]]] }));
      return ownersTouching(land, othersFor(null, data));
    } catch { return []; }
  }, [draft, data, othersFor]);
  useEffect(() => {
    if (!draft || draft.kind !== 'area' || draft.phase !== 'refine' || draft.ownerChosen) return;
    const auto = touching.length === 1 ? touching[0] : null;
    if (draft.owner !== auto) setDraft((d) => (d && d.sid === draft.sid && !d.ownerChosen ? { ...d, owner: auto } : d));
  }, [draft, touching]);

  // Handles of a new territory or a zone: a white corner on every point (drag to move, double-click to remove) and, once
  // the shape is closed, a small dot in the middle of every side that is dragged out into a new corner.
  const handles = useRef<MLMarker[]>([]);
  const dSid = draft?.sid ?? null;
  const dPhase = draft?.phase ?? null;
  const dPoints = draft && !draft.infoOnly ? draft.points : null;
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    for (const h of handles.current) h.remove();
    handles.current = [];
    if (dSid === null || !dPoints || !dPhase) return;
    const sid = dSid; const phase = dPhase; const pts = dPoints;
    const live: LngLat[] = pts.map((p) => [p[0], p[1]]);
    pts.forEach((p, i) => {
      const el = makeVertex();
      if (i === 0 && phase === 'draw' && pts.length >= MIN_POINTS) el.title = 'Click to close the shape';
      const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(p).addTo(map);
      mk.on('drag', () => {
        const ll = mk.getLngLat();
        live[i] = [ll.lng, ll.lat];
        setSource(SRC_DRAFT, draftFc(live, draftColor, phase === 'draw'));
      });
      mk.on('dragend', () => {
        const ll = mk.getLngLat();
        live[i] = [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))];
        setDraft((d) => (d && d.sid === sid ? withPoints(d, live.map((q) => [q[0], q[1]] as LngLat)) : d));
      });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (i === 0) setDraft((d) => (d && d.sid === sid && d.phase === 'draw' && d.points.length >= MIN_POINTS ? toRefine(d) : d));
      });
      el.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        if (phase !== 'refine' || pts.length <= MIN_POINTS) return;
        setDraft((d) => (d && d.sid === sid ? withPoints(d, d.points.filter((_, j) => j !== i)) : d));
      });
      handles.current.push(mk);
    });
    if (phase === 'refine') {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]; const b = pts[(i + 1) % pts.length];
        const at: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const el = makeMidpoint();
        const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(at).addTo(map);
        let moved = false;
        mk.on('dragstart', () => { moved = true; });
        mk.on('drag', () => {
          const ll = mk.getLngLat();
          const next = [...pts]; next.splice(i + 1, 0, [ll.lng, ll.lat]);
          setSource(SRC_DRAFT, draftFc(next, draftColor));
        });
        mk.on('dragend', () => {
          const ll = mk.getLngLat();
          window.setTimeout(() => { moved = false; }, 80);
          const p0 = map.project(at); const p1 = map.project([ll.lng, ll.lat]);
          if (Math.hypot(p0.x - p1.x, p0.y - p1.y) < 3) { mk.setLngLat(at); setSource(SRC_DRAFT, draftFc(pts, draftColor)); return; }
          const dropped: LngLat = [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))];
          setDraft((d) => {
            if (!d || d.sid !== sid) return d;
            const next = [...d.points]; next.splice(i + 1, 0, dropped);
            return withPoints(d, next);
          });
        });
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (moved) return;
          const here: LngLat = [round5(at[0]), round5(at[1])];
          setDraft((d) => {
            if (!d || d.sid !== sid) return d;
            const next = [...d.points]; next.splice(i + 1, 0, here);
            return withPoints(d, next);
          });
        });
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        handles.current.push(mk);
      }
    }
    return () => { for (const h of handles.current) h.remove(); handles.current = []; };
  }, [world, dSid, dPhase, dPoints, draftColor, setSource]);

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
      if (!wanted.has(id)) {
        const pa = pendingAnim.current;
        if (pa && pa.diff.removed.includes(id) && !m.el.dataset.drag) {
          const at = m.marker.getLngLat();
          pa.ghosts.push({ el: m.el.cloneNode(true) as HTMLElement, at: [at.lng, at.lat] });
        }
        m.marker.remove(); markers.delete(id);
      }
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
        const pa = pendingAnim.current;
        if (pa && !pa.drawn.has(u.id)) { const cur = m.marker.getLngLat(); pa.drawn.set(u.id, [cur.lng, cur.lat]); }
        m.marker.setLngLat([u.lng, u.lat]);
      }
      m.marker.setDraggable(canDrag && (stageKind !== 'unit' || !stageUnitId || u.id === stageUnitId));
      const selected = u.id === selUnit;
      const picture = unitPictureOf(u, customTypes);
      // Seen only because it was revealed to the viewer: marked, so a unit inside their fog never looks like a leak.
      const revealed = viewer && u.owner_cabinet_id !== viewer && u.revealed_to.includes(viewer)
        ? (staff ? `Revealed to ${cabById.get(viewer)?.short ?? 'this side'}` : 'Revealed to you') : null;
      const sig = `${u.kind}|${u.strength}|${color}|${selected}|${size}|${u.name}|${picture ?? ''}|${revealed ?? ''}`;
      if (m.sig !== sig) {
        paintToken(m.el, { kind: u.kind, color, strength: u.strength, selected, size, name: u.name, picture, revealed });
        m.sig = sig;
      }
    }
  }, [world, shownUnits, cabById, selUnit, canDrag, compact, stageKind, stageUnitId, customTypes, viewer, staff]);

  // ── animation of map changes that arrived from the server (see queueAnim) ──
  const animator = useMemo(() => createMapAnimator(() => mapRef.current), []);
  useEffect(() => () => animator.cancelAll(), [animator]);
  useEffect(() => {
    const pa = pendingAnim.current;
    if (!pa) return;
    pendingAnim.current = null;
    const map = mapRef.current;
    if (!world || !map || !data || prefersReducedMotion()) return;
    const { diff } = pa;
    animator.cancelAll(false);   // a character still gliding keeps going
    const unitNow = (id: string) => dataRef.current?.units.find((x) => x.id === id);
    // Decide per unit from what THIS screen was drawing: already at the new spot (the sender, or anyone looking at the
    // same draft) keeps its place and only plays the trail; a screen still showing the old spot glides.
    const moves = diff.moved.map((m) => {
      // The sender's and the team's screens showed the unsent changes already: they snap back to the sent spot and glide too.
      if (pa.fromSent) return { ...m, still: false };
      const d = pa.drawn.get(m.id);
      const still = !!d && Math.abs(d[0] - m.to[0]) < 1e-6 && Math.abs(d[1] - m.to[1]) < 1e-6;
      return { ...m, from: still || !d ? m.from : d, still };
    });
    animator.moveUnits(
      moves,
      (id) => unitMarkers.current.get(id),
      (id) => { const u = unitNow(id); return u ? [u.lng, u.lat] : undefined; },
      (id) => { const o = unitNow(id)?.owner_cabinet_id; return safeColor(o ? cabById.get(o)?.color ?? NOBODY : NOBODY); },
    );
    animator.popUnits(diff.added.map((id) => unitMarkers.current.get(id)?.el), pa.ghosts);
    animator.pulseUnits(diff.changed.map((id) => unitMarkers.current.get(id)?.el));

    const grow: GrowItem[] = [];
    // Countries that changed hands: the tint grows in (or fades out when the land was lost).
    const tinted = diff.regions.filter((r) => r.ownerFrom !== r.ownerTo && world.byKey.has(r.key));
    const colorOfCab = (id: string | null) => (id ? cabById.get(id)?.color : undefined);
    if (tinted.length) {
      const setState = (key: string, color: string | undefined, k: number) => {
        try {
          if (color && k > 0) map.setFeatureState({ source: SRC_COUNTRIES, id: key }, { tint: cabinetTint(color, 0.27 * k), edge: cabinetTint(color, 0.95 * k) });
          else { map.removeFeatureState({ source: SRC_COUNTRIES, id: key }, 'tint'); map.removeFeatureState({ source: SRC_COUNTRIES, id: key }, 'edge'); }
        } catch { /* the style is still loading */ }
      };
      animator.tween(1500, (e) => {
        for (const r of tinted) {
          const to = colorOfCab(r.ownerTo); const from = colorOfCab(r.ownerFrom);
          // Hands changing from one holder to another cross-fade their colours; land taken or given blends in or out.
          if (to && from) setState(r.key, mixHex(safeColor(from), safeColor(to), e), 1);
          else if (to) setState(r.key, to, e);
          else setState(r.key, from, 1 - e);
        }
      }, () => {
        // Always end on the real colours (the owner effect keeps them in `applied`).
        for (const r of tinted) setState(r.key, applied.current.get(r.key), 1);
      });
    }
    for (const r of diff.regions) {
      if (!world.byKey.has(r.key)) continue;
      const base = baseShapes.get(r.key)?.multi ?? [];
      const from = r.geomFrom ? toMulti(r.geomFrom as { type: string; coordinates: unknown }) : base;
      const toM = r.geomTo ? toMulti(r.geomTo as { type: string; coordinates: unknown }) : base;
      const color = colorOfCab(r.ownerTo) ?? colorOfCab(r.ownerFrom) ?? DRAFT;
      grow.push({ from: r.geomChanged ? from : toM, to: toM.length ? (r.geomChanged ? toM : toM) : null, color: safeColor(color) });
      if (!toM.length) grow[grow.length - 1].from = from;
    }
    for (const s of diff.shapes) {
      if (s.kind === 'zone' && !zonesOn) continue;
      const gone = !s.geomTo;
      if (gone && viewer) continue;
      if (!gone && viewer && !shownShapes.some((x) => x.id === s.id)) continue;
      const owner = colorOfCab(s.ownerTo) ?? colorOfCab(s.ownerFrom);
      const color = s.kind === 'zone' ? s.colorTo ?? s.colorFrom ?? DRAFT : owner ?? s.colorTo ?? s.colorFrom ?? DRAFT;
      const from = s.geomFrom ? toMulti(s.geomFrom as { type: string; coordinates: unknown }) : null;
      const toM = s.geomTo ? toMulti(s.geomTo as { type: string; coordinates: unknown }) : null;
      grow.push({ from, to: toM, color: safeColor(color) });
    }
    animator.growAreas(grow.slice(0, 60));
  }, [data, world, animator, cabById, baseShapes, viewer, shownShapes, zonesOn]);

  // ── a row of the "N changes to the map" pop-up: fly the real map to that item and pulse it ──
  const lastFocusN = useRef(0);
  const focusTimer = useRef<number | null>(null);
  useEffect(() => () => { if (focusTimer.current !== null) window.clearTimeout(focusTimer.current); }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!focusReq || !world || !map || !data || focusReq.n === lastFocusN.current) return;
    lastFocusN.current = focusReq.n;
    const dur = prefersReducedMotion() ? 0 : FLY_MS;
    const later = (fn: () => void) => {
      if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
      focusTimer.current = window.setTimeout(fn, Math.round(dur * 0.85));
    };
    const fitTo = (b: Bbox) => {
      if (b[0] === b[2] && b[1] === b[3]) map.flyTo({ center: [b[0], b[1]], zoom: 6, duration: dur });
      else map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 110, maxZoom: 6, duration: dur });
    };
    const unit = focusReq.unit ? shownUnits.find((u) => u.id === focusReq.unit) : undefined;
    if (unit) {
      map.flyTo({ center: [unit.lng, unit.lat], zoom: Math.max(map.getZoom(), 6), duration: dur });
      setSelUnit(unit.id);
      later(() => pulseToken(unitMarkers.current.get(unit.id)?.el));
      return;
    }
    // A character (a row of "N changes to the map"): fly to where it stands and pulse it.
    const charMk = focusReq.char ? charMarkers.current.get(focusReq.char) : undefined;
    if (charMk) {
      const at = charMk.marker.getLngLat();
      map.flyTo({ center: [at.lng, at.lat], zoom: Math.max(map.getZoom(), 6), duration: dur });
      if (!compact) { setSelUnit(null); setSelTerr(null); setSelZone(null); setSelChar(focusReq.char as string); }
      later(() => pulseToken(charMarkers.current.get(focusReq.char as string)?.el));
      return;
    }
    if (focusReq.region) {
      const multi = countryMulti(focusReq.region);
      const b = bboxOf(multi);
      if (b) fitTo(b);
      const owner = ownerOf.get(focusReq.region);
      later(() => animator.growAreas([{ from: multi, to: multi, color: safeColor(owner ? cabById.get(owner)?.color ?? DRAFT : DRAFT) }]));
      return;
    }
    const shape = focusReq.shape ? shownShapes.find((x) => x.id === focusReq.shape) : undefined;
    if (shape) {
      const multi = shape.kind === 'line' ? null : toMulti(shape.geometry as { type: string; coordinates: unknown });
      const b = multi ? bboxOf(multi) : (focusReq.bbox ?? null);
      if (b) fitTo(b);
      if (multi) later(() => animator.growAreas([{ from: multi, to: multi, color: safeColor(shape.kind === 'zone' ? shape.color ?? DRAFT : (shape.owner_cabinet_id && cabById.get(shape.owner_cabinet_id)?.color) || shape.color || DRAFT) }]));
      return;
    }
    if (focusReq.bbox) fitTo(focusReq.bbox);
  }, [focusReq, world, data, shownUnits, shownShapes, countryMulti, ownerOf, cabById, animator, compact]);

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
  // Where each planned move starts and ends: units (a reply's moves, or the team's unsent moves) and the characters
  // the team has moved but not sent.
  const plans = useMemo(() => {
    const out: Array<{ key: string; from: LngLat; to: LngLat; color?: string }> = [];
    for (const [id, to] of Object.entries(planMoves ?? {})) {
      const u = rawData?.units.find((x) => x.id === id);
      if (u) out.push({ key: id, from: [u.lng, u.lat], to: [to.lng, to.lat] });
    }
    if (!isStage) {
      for (const [id, to] of draftCharAt) {
        const c = core.characters.find((x) => x.id === id);
        if (c && typeof c.location_lng === 'number' && typeof c.location_lat === 'number') {
          out.push({ key: `char:${id}`, from: [c.location_lng, c.location_lat], to, color: safeColor(c.cabinet_id ? cabById.get(c.cabinet_id)?.color ?? NOBODY : NOBODY) });
        }
      }
    }
    return out;
  }, [planMoves, rawData, isStage, draftCharAt, core.characters, cabById]);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const ghosts = planGhosts.current;
    const lines: Feature[] = [];
    const keep = new Set<string>();
    for (const p of plans) {
      keep.add(p.key);
      lines.push({ type: 'Feature', properties: p.color ? { color: p.color } : {}, geometry: { type: 'LineString', coordinates: [p.from, p.to] } });
      const g = ghosts.get(p.key);
      if (g) g.setLngLat(p.from);
      else ghosts.set(p.key, new ml.Marker({ element: makeGhost(), anchor: 'center' }).setLngLat(p.from).addTo(map));
    }
    for (const [key, g] of [...ghosts]) if (!keep.has(key)) { g.remove(); ghosts.delete(key); }
    setSource(SRC_PLANS, { type: 'FeatureCollection', features: lines });
  }, [world, plans, setSource]);
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
  // "Delegates see where their own cabinet stands" off: a delegate sees only their own character of their cabinet.
  const hideOwnCabinet = !staff && settings.hideCabinetLocations;
  const myCharId = v.characterId;
  const visibleChars = useMemo(
    () => (staff && !staffViewer ? placedChars : placedChars.filter((c) => (
      !!charViewer && c.cabinet_id === charViewer ? (!hideOwnCabinet || c.id === myCharId) : seeOtherChars
    ))),
    [placedChars, staff, staffViewer, charViewer, seeOtherChars, hideOwnCabinet, myCharId],
  );
  const showChars = !isStage && (compact || charsOn) && (staff || !!cabinetId);
  const canMoveChars = staff && !compact && tool === 'select' && mayEditCharacters(v.role, settings);
  // A character whose saved spot changes (sent, saved live, brought back) glides from the old spot to the new one.
  useCharGlide({
    glider: charGlider, characters: core.characters, animator, markers: charMarkers,
    colorOf: (c) => safeColor(c?.cabinet_id ? cabById.get(c.cabinet_id)?.color ?? NOBODY : NOBODY),
    draftAt: (id) => draftCharRef.current.get(id),
    onDone: regroupChars,
  });
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const markers = charMarkers.current;
    const list = showChars ? visibleChars : [];
    const size = compact ? 24 : 34;
    const wanted = new Set(list.map((c) => c.id));
    for (const [id, m] of [...markers]) {
      if (!wanted.has(id)) { m.marker.remove(); markers.delete(id); charGlider.targets.delete(id); }
    }
    for (const c of list) {
      const at: LngLat = charOverride.current.get(c.id) ?? draftCharAt.get(c.id) ?? [c.location_lng as number, c.location_lat as number];
      let m = markers.get(c.id);
      if (!m) {
        const el = document.createElement('div');
        const marker = new ml.Marker({ element: el, draggable: canMoveChars, anchor: 'center' }).setLngLat(at).addTo(map);
        const id = c.id;
        marker.on('dragstart', () => { el.dataset.drag = '1'; });
        // The line follows the character at once, like a unit's arrow.
        marker.on('drag', () => {
          const at = marker.getLngLat();
          liveRef.current?.onCharDrag(id, at.lng, at.lat);
        });
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
      } else if (!m.el.dataset.drag && !charGlider.isActive(c.id)) m.marker.setLngLat(at);
      charGlider.targets.set(c.id, at);
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
  }, [world, visibleChars, showChars, cabById, selChar, compact, canMoveChars, regroupChars, draftCharAt, charGlider]);

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
  const ringOffId = sightUnit?.id ?? null;
  const fogHoles = useMemo<FogHoles | null>(() => {
    if (!viewer || !world || (!fogActive && !showRings)) return null;
    const geometries: Geometry[] = [];
    const owners: NonNullable<FogHoles['owners']> = [];
    if (fogActive) {
      for (const [key, cab] of ownerOf) {
        const m = countryMulti(key);
        if (!m.length) continue;
        if (cab === viewer) { geometries.push(toGeometry(m) as unknown as Geometry); continue; }
        // Land held by someone else stays tinted in its holder's colour under the hatch: who holds it is never hidden.
        const col = cabById.get(cab)?.color;
        if (col) owners.push({ geometry: toGeometry(m) as unknown as Geometry, fill: cabinetTint(col, 0.34), edge: cabinetTint(col, 0.9) });
      }
      for (const s of shownShapes) {
        if (s.kind !== 'area') continue;
        if (s.owner_cabinet_id === viewer) geometries.push(s.geometry as unknown as Geometry);
        else if (s.owner_cabinet_id) {
          const col = cabById.get(s.owner_cabinet_id)?.color;
          if (col) owners.push({ geometry: s.geometry as unknown as Geometry, fill: cabinetTint(col, 0.34), edge: cabinetTint(col, 0.9) });
        }
      }
    }
    const circles = shownUnits
      .filter((u) => u.owner_cabinet_id === viewer)
      .map((u) => ({ id: u.id, lng: u.lng, lat: u.lat, km: sightKmOf(u), ring: u.id !== ringOffId }));
    return { geometries, circles, rings: [], owners, fog: fogActive, showRings };
  }, [fogActive, showRings, viewer, world, ownerOf, countryMulti, shownUnits, shownShapes, cabById, ringOffId]);
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

  // ── water (lakes, rivers, seas, oceans) and regions (states and provinces): offline files, fetched when first wanted ──
  const wantWater = waterOn && !compact;
  const wantRegions = regionsOn && !compact;
  const waterLoaded = useRef(false);
  const regionsLoaded = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    nameCtl.current?.setWaterOn(wantWater);
    whenStyleReady(map, () => setWaterVisible(map, wantWater));
    if (!wantWater || waterLoaded.current) return;
    const t = window.setTimeout(() => {
      waterLoaded.current = true;
      loadWater().then((f) => {
        const m = mapRef.current;
        if (!m) return;
        fillWater(m, f);
        nameCtl.current?.setWater(f);
      }).catch(() => { waterLoaded.current = false; /* the map still works without water */ });
    }, 350);
    return () => { window.clearTimeout(t); };
  }, [world, wantWater]);
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    nameCtl.current?.setRegionsOn(wantRegions);
    whenStyleReady(map, () => setRegionsVisible(map, wantRegions));
    if (!wantRegions || regionsLoaded.current) return;
    regionsLoaded.current = true;
    loadRegions().then((f) => {
      const m = mapRef.current;
      if (!m) return;
      fillRegions(m, f);
      nameCtl.current?.setRegions(f);
    }).catch(() => { regionsLoaded.current = false; notifyErr('The states and provinces could not be loaded.', 'crisis-map'); });
  }, [world, wantRegions]);

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
      for (const m of charMarkers.current.values()) if (m.el.dataset.drag) return;
      showMove(null, null);
    };
    draw();
    if (!pendingMove) return;
    map.on('move', draw);
    return () => { map.off('move', draw); };
  }, [world, pendingMove, showMove]);

  // ── the selected unit's sight ring, with a handle staff drag to change how far it sees ──
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
    if (ringBegin.current === id) { ringBegin.current = null; ctl.begin(); }
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
    customType: u.custom_type ?? null, picture: u.picture_url ?? null, details: u.details ?? '',
  });

  let panel: ReactNode = null;
  if (!compact && stageKind !== 'unit') {
    if (draft && editable && draft.kind === 'zone') {
      const was = draft.editId ? data?.shapes.find((x) => x.id === draft.editId) ?? null : null;
      panel = (
        <ZoneEditor
          key={draft.sid} isNew={!draft.editId} phase={draft.phase} types={zoneTypes} cabinets={cabinets}
          initial={was ? zoneFormOf(was, zoneTypes) : { name: '', type: zoneTypes[0]?.id ?? null, color: ZONE_NO_TYPE_COLOR, description: '', vis: 'public', revealed: [], owner: null }}
          pointCount={draft.points.length} minPoints={MIN_POINTS} canUndo={draftCanUndo} busy={busy}
          infoOnly={draft.infoOnly}
          onRedraw={() => setDraft({ ...draft, phase: 'draw', points: [], trail: [...draft.trail.slice(-49), draft.points] })}
          onColor={setZoneColor} onUndo={undoDraft} onFinish={() => setDraft(toRefine(draft))}
          onSave={(f) => submitZone(draft, f)} onInfo={(f) => saveZoneInfo(draft, f)} onCancel={() => setDraft(null)}
          onDelete={draft.editId ? () => removeZone(draft.editId as string) : undefined}
        />
      );
    } else if (draft && editable) {
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
          onOwner={(id) => { setChipOwner(id); setDraft((d) => (d ? { ...d, owner: id, ownerChosen: true } : d)); }}
          canUndo={draftCanUndo}
          onUndo={undoDraft}
          onFinish={() => setDraft(toRefine(draft))}
          onSave={() => submitNewArea(draft)}
          onClose={() => setDraft(null)}
        />
      );
    } else if (tool === 'zones' && canZones) {
      panel = (
        <ZonesPanel
          zones={zones} types={zoneTypes} cabinets={cabinets} onDraw={beginZone} onClose={() => changeTool('select')}
          onPick={(id) => {
            editZone(id);
            const z = zones.find((x) => x.id === id);
            const b = z ? bboxOf(toMulti(z.geometry)) : null;
            const map = mapRef.current;
            if (b && map && !map.getBounds().contains([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 110, maxZoom: 6, duration: 300 });
          }}
        />
      );
    } else if (selZoneRow) {
      panel = (
        <ZoneInfoCard
          key={selZoneRow.id} zone={selZoneRow} type={selZoneRow.zone_type ? zoneTypeById.get(selZoneRow.zone_type) ?? null : null} cabinets={cabinets}
          staff={staff && !staffViewer} canEdit={canZones} canControl={canZones}
          onControl={(id) => setZoneController(selZoneRow.id, id)}
          onEdit={() => { changeTool('zones'); editZone(selZoneRow.id); }} onClose={() => setSelZone(null)}
        />
      );
    } else if (tool === 'unit' && unitEditing) {
      if (addKind && newUnit) {
        panel = (
          <UnitEditor
            key="new-unit" isNew busy={busy} cabinets={cabinets}
            customTypes={customTypes} onUploadPicture={(f) => uploadCrisisImage(ref, f)}
            initial={{
              name: addCustom?.name ?? '', kind: addKind, strength: 1, owner: defaultOwner, note: '', revealed: [],
              sight: typeof addCustom?.sight_km === 'number' ? addCustom.sight_km : null,
              customType: addCustom?.key ?? null, picture: null, details: '',
            }}
            onSubmit={(d) => { void submitUnit(d, null); }} onClose={() => changeTool('select')}
          />
        );
      } else if (addKind) {
        panel = <PlaceUnitPanel kind={addKind} custom={addCustom} onBack={() => setAddKind(null)} onClose={() => changeTool('select')} />;
      } else {
        panel = <KindPicker customTypes={customTypes} onPick={(k, t) => { setNewUnit(null); setAddCustomKey(t?.key ?? null); setAddKind(k); }} onClose={() => changeTool('select')} />;
      }
    } else if (selUnitRow) {
      const u = selUnitRow;
      panel = unitEditing ? (
        <UnitEditor
          key={u.id}
          isNew={false} busy={busy} cabinets={cabinets} initial={unitDraftOf(u)} customTypes={customTypes} onUploadPicture={(f) => uploadCrisisImage(ref, f)}
          onSubmit={(d) => submitUnit(d, u, true)} onDelete={() => { void removeUnit(u); }} onClose={() => setSelUnit(null)}
        />
      ) : (
        <UnitViewer
          key={u.id} unit={u} cabinets={cabinets} customTypes={customTypes} onClose={() => setSelUnit(null)}
          revealed={viewer && u.owner_cabinet_id !== viewer && u.revealed_to.includes(viewer) ? (staff ? `Revealed to ${cabById.get(viewer)?.short ?? 'this side'}` : 'Revealed to you') : null}
        />
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
          info={!isCountry && selShape && !isStage ? { label: selShape.label ?? '', description: selShape.description ?? '' } : null}
          canUndo={!!workMulti || historyN > 0}
          onOwner={(id) => pickOwner(t, id)}
          onUndo={workMulti ? undoOutline : goBack} onSave={(info) => saveTerritory(t, info)}
          onReset={isCountry ? () => { const b = baseShapes.get(t.key)?.multi; if (b && commitOutline(t, b, true)) setTerrEdit(null); } : undefined}
          onDelete={!isCountry ? () => removeArea(t.id) : undefined}
          onClose={() => setSelTerr(null)}
        />
      );
    }
  }

  // ── controls ──
  const viewOptions = [{ value: 'all', label: 'Crisis team' }, ...cabinets.map((c) => ({ value: c.id, label: c.short }))];
  const viewerCabinet = viewer ? cabById.get(viewer) : null;

  // The zone types that have a zone on the map right now (while Zones is on).
  const legendZoneTypes = useMemo(() => {
    if (!zonesOn) return [];
    const present = new Set(zones.map((z) => z.zone_type));
    return zoneTypes.filter((t) => present.has(t.id));
  }, [zonesOn, zones, zoneTypes]);

  const hint = compact ? null
    : tool === 'unit' && addKind && !newUnit ? `Click the map to place the ${(addCustom ? addCustom.name : KIND_META[addKind].label).toLowerCase()}.`
      : draft ? null
      : sightUnit && canUnits && tool === 'select' ? 'Press anywhere on the dashed ring and drag, or drag its round handle, to change how far it sees.'
        : canEditTerr && selTerr && selValid ? (selDetailed ? 'Press on the red outline and drag to bend the border, then save.' : 'Drag a corner or a small dot on a side to reshape it, then save.') + (selTerr.kind === 'area' ? ' Drag the Move handle, or the territory itself, to carry all of it.' : '')
          : null;

  const pendingUnit = pendingMove ? rawData?.units.find((u) => u.id === pendingMove.id) ?? null : null;
  const compactInfo = compact && selUnitRow
    ? `${selUnitRow.name} · ${customTypeOf(selUnitRow, customTypes)?.name ?? KIND_META[selUnitRow.kind].label} · ${fmtAmount(selUnitRow.strength)}`
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

  // The map's show-and-hide switches: tucked behind "Show on the map" in the toolbar.
  const viewTools = (
    <>

        {staff && !isStage && (
          <button
            type="button" className="wm-tool" aria-pressed={fogOn && !!staffViewer} disabled={!staffViewer}
            onClick={() => setFogOn((f) => !f)}
            title={staffViewer
              ? 'Hatched ground is what this side cannot see. It sees its own land and a circle around each of its units, and still sees who holds every country. Spies are never spotted.'
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
        {!compact && (
          <button type="button" className="wm-tool" aria-pressed={zonesOn} onClick={() => setZonesOn((z) => !z)} title="Show or hide zones: blockade lines, no-fly zones and other areas that are not territory">
            <Layers size={17} strokeWidth={1.5} /><span>Zones</span>
          </button>
        )}
        <button type="button" className="wm-tool" aria-pressed={waterOn} onClick={() => setWaterOn((w) => !w)} title="Show or hide rivers, lakes and the names of seas and oceans">
          <Droplets size={17} strokeWidth={1.5} /><span>Water</span>
        </button>
        <button type="button" className="wm-tool" aria-pressed={regionsOn} onClick={() => { regionsAuto.current = false; setRegionsOn((r) => !r); }} title="Show or hide states and provinces (United States, Canada, Brazil and Australia)">
          <SquareDashed size={17} strokeWidth={1.5} /><span>Regions</span>
        </button>
    </>
  );

  // The unsent changes: in the header, outside the map, so they never cover it.
  const draftBar = draftCount > 0 && staff && !isStage ? (
    <div className="wm-draftbar" role="status" style={{ fontFamily: CK.font }}>
      <span><b key={draftCount}>{draftCount} {draftCount === 1 ? 'change' : 'changes'}</b> not sent yet</span>
      {draftBy && <span key={draftBy} className="wm-draftby"><Users size={14} strokeWidth={1.5} aria-hidden />{draftBy} changed the unsent map</span>}
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
  ) : null;

  return (
    <div
      className="wm-root" data-compact={compact ? '1' : undefined} data-stage={isStage ? '1' : undefined}
      style={stage ? ({ '--wm-stage-h': `${stage.height}px` } as CSSProperties) : undefined}
    >
      <style>{MAP_CSS + TOOLBAR_CSS}</style>

      {compact ? (
        <div className="wm-top">
          {title && <div className="wm-top-title">{title}</div>}
          {viewControl}
          {draftBar}
          {actions && <div className="wm-top-actions">{actions}</div>}
        </div>
      ) : stageKind === 'unit' ? null : (
        <>
          {!isStage && (
            <div className="wm-top">
              <div className="wm-top-title">{title}</div>
              <div className="wm-top-right">
                {draftBar}
                {viewControl}
              </div>
            </div>
          )}
          <MapToolbar
            tool={tool} onTool={changeTool}
            allowed={{ give: editable && canMap, paint: editable && canMap, erase: editable && canMap, draw: editable && canMap, zones: canZones, unit: unitEditing }}
            cabinets={cabinets} owner={chipOwner} onOwner={setChipOwner}
            brushKm={brushKm} onBrushKm={(km) => { brushTouched.current = true; setBrushKm(km); }}
            history={editable && (canMap || canUnits || canChars)} canUndo={panelCanUndo || (draftOn && draftCanUndo) || !!terrEdit || historyN > 0} canRedo={panelCanRedo || (draftOn ? draftCanRedo : redoN > 0)} busy={busy}
            undoLabel={undoLabel} redoLabel={redoLabel} undoInFields={draftOn && !!draft && draft.phase === 'draw' && draft.points.length > 0}
            onUndo={mapUndo} onRedo={mapRedo} onFit={fitView}
            viewTools={viewTools} editable={editable && (canMap || canUnits)} provincesReady={provincesReady}
          />
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
              <Btn size="sm" tone="ghost" disabled={busy} onClick={goBack}>Undo</Btn>
            </div>
          )}
          <svg ref={arrowSvg} className="wm-arrow" aria-hidden>
            <line data-p="halo" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
            <line data-p="line" stroke={DRAFT} strokeWidth={3.2} strokeLinecap="round" />
            <polygon data-p="head" fill={DRAFT} stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
            <circle data-p="from" r={5} fill="#FFFFFF" stroke={DRAFT} strokeWidth={2.5} />
          </svg>
          <div ref={dragTip} className="wm-dragtip" aria-hidden />
          {hint && (
            <div className="wm-topleft">
              <div className="wm-hint">{hint}</div>
            </div>
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

        {panel && <div className="wm-drawer">{panel}</div>}

        <div className="wm-legend">
          <div>
            {cabinets.map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}</span>)}
            {legendZoneTypes.map((t) => <span key={t.id} title={t.description || undefined}><i className="wm-zsw" style={{ background: `${t.color}33`, borderColor: t.color }} />{t.name}</span>)}
            {showRings && !compact && <span title="Spies are never spotted, even inside a sight range."><i style={{ border: `1.5px dashed ${CK.red}`, background: 'transparent' }} />Sight range (spies stay hidden)</span>}
            {viewer && !compact && shownUnits.some((u) => u.owner_cabinet_id !== viewer && u.revealed_to.includes(viewer)) && (
              <span title="These units were shown to this side by the crisis team. They are not in its sight range."><i style={{ background: '#EED98A', border: `1.5px solid ${CK.forest}` }} />Revealed to {staff ? viewerCabinet?.short ?? 'this side' : 'you'}</span>
            )}
            {compactInfo && <b style={{ color: CK.ink }}>{compactInfo}</b>}
          </div>
          {!compact && !isStage && <div>{last ? `Last change ${clock(last.at)} · ${last.text}` : staff ? 'No changes yet this visit' : 'Updates live'}</div>}
        </div>
      </div>
    </div>
  );
}
