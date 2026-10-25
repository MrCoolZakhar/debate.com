'use client';
// Gavelling Crisis: the war map.
// A real-world map drawn offline (Natural Earth 50m through world-atlas) with MapLibre GL and a blank
// style: no tile server, no glyph server, no third-party request. Borders work by country (a country
// is held by a cabinet), plus drawn areas and lines for finer land. Units are round tokens, fog of
// war is a hatched canvas over everything the viewing cabinet cannot see. Staff change the map;
// delegates only look. Every change is saved through src/lib/crisis/api.ts and logged by the database.

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MLMap, MapMouseEvent, Marker as MLMarker } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { Cloud, Flag, MousePointer2, Pentagon, Route, Ship, Maximize2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import {
  crisisError, deleteShape, deleteUnit, loadMap, saveShape, saveUnit, setRegionOwner,
} from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { MapRegion, MapShape, MapUnit } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CK, Segmented, cabinetTint } from '../../crisisKit';
import { drawFog, type FogHoles } from './fog';
import {
  KIND_META, centroidOf, clampLat, clampLng, geometryFor, loadWorldData, shapePoints, type LngLat, type WorldData,
} from './mapData';
import {
  BLANK_STYLE, DRAFT, L_LAND, L_SHAPE_FILL, L_SHAPE_HIT, NOBODY, SRC_COUNTRIES, SRC_DRAFT, SRC_SHAPES, mapLayers,
} from './mapStyle';
import {
  BorderPanel, ShapeEditor, UnitEditor, UnitViewer, type PanelCabinet, type ShapeDraft, type UnitDraft,
} from './MapPanels';
import {
  MAP_CSS, makeCountryLabel, makeGhost, makeMidpoint, makeShapeLabel, makeVertex, paintToken, safeColor,
} from './tokens';

type Tool = 'select' | 'borders' | 'unit' | 'area' | 'line';
type MapData = { regions: MapRegion[]; units: MapUnit[]; shapes: MapShape[] };

interface Draft {
  sid: number;
  kind: 'area' | 'line';
  shapeId: string | null;
  phase: 'draw' | 'refine';
  points: LngLat[];
  init: ShapeDraft;
}

interface Live {
  tool: Tool;
  draft: Draft | null;
  canMap: boolean;
  canUnits: boolean;
  editable: boolean;
  borderKey: string | null;
  onMapClick: (e: MapMouseEvent) => void;
  onMapDblClick: (e: MapMouseEvent) => void;
  onUnitClick: (id: string) => void;
  onUnitMoved: (id: string, lng: number, lat: number) => void;
  redrawFog: () => void;
  escape: () => void;
}

const MIN_POINTS = { area: 3, line: 2 } as const;
const emptyFc: FeatureCollection = { type: 'FeatureCollection', features: [] };

function round5(n: number): number { return Math.round(n * 1e5) / 1e5; }

function draftFc(kind: 'area' | 'line', pts: LngLat[]): FeatureCollection {
  if (pts.length < 2) return emptyFc;
  const f: Feature = kind === 'area' && pts.length >= 3
    ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } }
    : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } };
  return { type: 'FeatureCollection', features: [f] };
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WarMap({ compact = false }: { compact?: boolean }) {
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
      else if (p.t === 'crisis_shapes') text = 'An area or line changed';
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

  // ── view ──
  const [viewAs, setViewAs] = useState<string>('all');
  const [fogOn, setFogOn] = useState(true);
  const staffViewer = viewAs !== 'all' && cabById.has(viewAs) ? viewAs : null;
  const viewer: string | null = staff ? staffViewer : cabinetId;
  const fogActive = !!viewer && (staff ? fogOn : true);

  const shownUnits = useMemo(() => {
    const out: Array<{ u: MapUnit; suspected: boolean }> = [];
    for (const u of data?.units ?? []) {
      if (!viewer) { out.push({ u, suspected: false }); continue; }
      if (u.owner_cabinet_id === viewer || u.revealed_to.includes(viewer)) out.push({ u, suspected: false });
      else if (u.suspected_by.includes(viewer)) out.push({ u, suspected: true });
    }
    return out;
  }, [data, viewer]);

  const shownShapes = useMemo(
    () => (data?.shapes ?? []).filter((s) => !viewer || s.public || s.owner_cabinet_id === viewer || s.revealed_to.includes(viewer)),
    [data, viewer],
  );

  // ── tools and selection ──
  const [tool, setTool] = useState<Tool>('select');
  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [selShape, setSelShape] = useState<string | null>(null);
  const [border, setBorder] = useState<{ key: string; name: string } | null>(null);
  const [newUnit, setNewUnit] = useState<{ lng: number; lat: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const defaultOwner = viewer ?? cabinets[0]?.id ?? null;
  const freshDraft = useCallback((kind: 'area' | 'line'): Draft => ({
    sid: new Date().getTime(), kind, shapeId: null, phase: 'draw', points: [],
    init: { label: '', owner: defaultOwner, isPublic: false, revealed: [] },
  }), [defaultOwner]);

  const changeTool = useCallback((t: Tool) => {
    setTool(t);
    setSelUnit(null); setSelShape(null); setBorder(null); setNewUnit(null);
    setDraft(t === 'area' || t === 'line' ? freshDraft(t) : null);
  }, [freshDraft]);

  const editable = staff && !viewer && !compact;

  // ── map plumbing ──
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const resizeObs = useRef<ResizeObserver | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const fogCanvas = useRef<HTMLCanvasElement | null>(null);
  const fogHolesRef = useRef<FogHoles | null>(null);
  const fogFrame = useRef<number | null>(null);
  const liveRef = useRef<Live | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
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

  const pickOwner = useCallback(async (key: string, name: string, owner: string | null) => {
    const before = dataRef.current;
    if (!before) return;
    const has = before.regions.some((r) => r.region_key === key);
    const regions = has
      ? before.regions.map((r) => (r.region_key === key ? { ...r, owner_cabinet_id: owner } : r))
      : [...before.regions, { crisis_id: ref.id, region_key: key, owner_cabinet_id: owner }];
    setData({ ...before, regions });
    await run(async () => {
      try {
        await setRegionOwner(ref, key, owner);
        const who = owner ? cabById.get(owner)?.name ?? 'a cabinet' : 'nobody';
        setLast({ at: new Date().getTime(), text: `You gave ${name} to ${who}` });
      } catch (e) {
        setData(before);
        notifyErr(crisisError(e, 'Could not change the border.'), 'crisis-map');
      }
    });
  }, [ref, run, cabById]);

  const submitUnit = useCallback(async (d: UnitDraft, existing: MapUnit | null) => {
    const before = dataRef.current;
    const patch = {
      name: d.name.trim(), kind: d.kind, strength: d.strength, owner_cabinet_id: d.owner,
      note: d.note.trim() ? d.note.trim() : null, revealed_to: d.revealed, suspected_by: d.suspected,
    };
    if (existing && before) setData({ ...before, units: before.units.map((u) => (u.id === existing.id ? { ...u, ...patch } : u)) });
    await run(async () => {
      try {
        if (existing) await saveUnit(ref, { id: existing.id, ...patch });
        else if (newUnit) await saveUnit(ref, { ...patch, lng: round5(clampLng(newUnit.lng)), lat: round5(clampLat(newUnit.lat)) });
        setLast({ at: new Date().getTime(), text: existing ? `You updated ${patch.name}` : `You added ${patch.name}` });
        notifyOk(existing ? 'Unit saved' : 'Unit added', 'crisis-map');
        if (!existing) setNewUnit(null);
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not save the unit.'), 'crisis-map');
      }
    });
  }, [ref, run, newUnit]);

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

  const submitShape = useCallback(async (d: ShapeDraft, kind: 'area' | 'line', shapeId: string | null, points: LngLat[] | null) => {
    const before = dataRef.current;
    const fields = {
      owner_cabinet_id: d.owner, label: d.label.trim() ? d.label.trim() : null, public: d.isPublic,
      revealed_to: d.isPublic ? [] : d.revealed,
    };
    const geometry = points ? geometryFor(kind, points) : null;
    if (shapeId && before) {
      setData({
        ...before,
        shapes: before.shapes.map((s) => (s.id === shapeId ? { ...s, ...fields, geometry: (geometry as MapShape['geometry'] | null) ?? s.geometry } : s)),
      });
    }
    await run(async () => {
      try {
        if (shapeId) await saveShape(ref, { id: shapeId, ...fields, ...(geometry ? { geometry: geometry as MapShape['geometry'] } : {}) });
        else if (geometry) await saveShape(ref, { kind, ...fields, geometry: geometry as MapShape['geometry'] });
        setLast({ at: new Date().getTime(), text: kind === 'area' ? 'You saved an area' : 'You saved a line' });
        notifyOk(kind === 'area' ? 'Area saved' : 'Line saved', 'crisis-map');
        setDraft(null); setSelShape(null);
        if (!shapeId) changeTool('select');
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not save the shape.'), 'crisis-map');
      }
    });
  }, [ref, run, changeTool]);

  const removeShape = useCallback(async (s: MapShape) => {
    const before = dataRef.current;
    if (before) setData({ ...before, shapes: before.shapes.filter((x) => x.id !== s.id) });
    setSelShape(null);
    await run(async () => {
      try {
        await deleteShape(ref, s.id);
        setLast({ at: new Date().getTime(), text: s.kind === 'area' ? 'You removed an area' : 'You removed a line' });
      } catch (e) {
        if (before) setData(before);
        notifyErr(crisisError(e, 'Could not remove the shape.'), 'crisis-map');
      }
    });
  }, [ref, run]);

  const fitView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = shownUnits.map((s) => [s.u.lng, s.u.lat] as LngLat);
    if (!pts.length) { map.fitBounds([[-168, -48], [178, 76]], { padding: 24, duration: 0 }); return; }
    let minX = 180; let minY = 90; let maxX = -180; let maxY = -90;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: compact ? 50 : 110, maxZoom: 5.5, duration: 0 });
  }, [shownUnits, compact]);

  // ── map events read the latest state through this ──
  useEffect(() => {
    liveRef.current = {
      tool, draft, canMap, canUnits, editable, borderKey: border?.key ?? null,
      onMapClick: (e) => {
        const map = mapRef.current;
        if (!map) return;
        const target = e.originalEvent.target as HTMLElement | null;
        if (target?.closest('.wm-marker')) return;
        if (tool === 'unit' && editable && canUnits) {
          setSelUnit(null);
          setNewUnit({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        } else if ((tool === 'area' || tool === 'line') && editable && canMap && draft && draft.phase === 'draw') {
          const lastPt = draft.points[draft.points.length - 1];
          if (lastPt) {
            const lp = map.project(lastPt);
            if (Math.hypot(lp.x - e.point.x, lp.y - e.point.y) < 6) return;
          }
          const pt: LngLat = [round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat))];
          setDraft({ ...draft, points: [...draft.points, pt] });
        } else if (tool === 'borders' && editable && canMap) {
          const f = map.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0];
          const key = f?.properties?.key as string | undefined;
          if (key) setBorder({ key, name: String(f.properties?.name ?? 'This country') });
        } else if (tool === 'select') {
          setSelUnit(null);
          if (editable && canMap) {
            const box: [[number, number], [number, number]] = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
            const hit = map.queryRenderedFeatures(box, { layers: [L_SHAPE_FILL, L_SHAPE_HIT] })[0];
            const id = hit?.properties?.id as string | undefined;
            setSelShape(id ?? null);
          } else setSelShape(null);
        }
      },
      onMapDblClick: (e) => {
        if (draft && draft.phase === 'draw' && draft.points.length >= MIN_POINTS[draft.kind]) {
          e.preventDefault();
          setDraft({ ...draft, phase: 'refine' });
        }
      },
      onUnitClick: (id) => {
        if (tool !== 'select' && tool !== 'unit') return;
        setNewUnit(null); setSelShape(null); setBorder(null);
        setSelUnit(id);
      },
      onUnitMoved: (id, lng, lat) => { void moveUnit(id, lng, lat); },
      redrawFog,
      escape: () => {
        if (draft || newUnit || border || selUnit || selShape) {
          if (tool === 'area' || tool === 'line') changeTool('select');
          else { setSelUnit(null); setSelShape(null); setNewUnit(null); setBorder(null); setDraft(null); }
        }
      },
    };
  });

  // ── create the map (once) ──
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    const labelMarkers = new Map<string, MLMarker>();
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
        // The host can change size without a window resize (rail, drawer, phone layout).
        const ro = new ResizeObserver(() => { map?.resize(); });
        ro.observe(hostRef.current);
        resizeObs.current = ro;
        map.touchPitch.disable();
        const m = map;
        mapRef.current = m;

        const syncLabels = () => {
          const z = m.getZoom();
          for (const l of w.labels) {
            const show = z >= l.minZoom;
            const has = labelMarkers.get(l.key);
            if (show && !has) {
              const mk = new ml.Marker({ element: makeCountryLabel(l.name, l.area), anchor: 'center' }).setLngLat(l.center).addTo(m);
              labelMarkers.set(l.key, mk);
            } else if (!show && has) { has.remove(); labelMarkers.delete(l.key); }
          }
        };

        m.on('load', () => {
          if (cancelled) return;
          m.addSource(SRC_COUNTRIES, { type: 'geojson', data: w.collection, promoteId: 'key' });
          m.addSource(SRC_SHAPES, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_DRAFT, { type: 'geojson', data: emptyFc });
          for (const layer of mapLayers()) m.addLayer(layer);

          const cvs = document.createElement('canvas');
          cvs.className = 'wm-fog';
          m.getCanvasContainer().insertBefore(cvs, m.getCanvas().nextSibling);
          fogCanvas.current = cvs;

          m.on('click', (e) => liveRef.current?.onMapClick(e));
          m.on('dblclick', (e) => liveRef.current?.onMapDblClick(e));
          let hover: string | null = null;
          m.on('mousemove', (e) => {
            const lv = liveRef.current;
            if (!lv) return;
            if (lv.tool !== 'borders') {
              if (hover && hover !== lv.borderKey) m.setFeatureState({ source: SRC_COUNTRIES, id: hover }, { hi: false });
              hover = null;
              return;
            }
            const f = m.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0];
            const key = (f?.properties?.key as string | undefined) ?? null;
            if (key === hover) return;
            if (hover && hover !== lv.borderKey) m.setFeatureState({ source: SRC_COUNTRIES, id: hover }, { hi: false });
            hover = key;
            if (key) m.setFeatureState({ source: SRC_COUNTRIES, id: key }, { hi: true });
          });
          m.on('move', () => liveRef.current?.redrawFog());
          m.on('resize', () => liveRef.current?.redrawFog());
          m.on('zoom', syncLabels);
          syncLabels();
          setWorld(w);
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
      for (const mk of labelMarkers.values()) mk.remove();
      labelMarkers.clear();
      if (fogFrame.current !== null) { window.cancelAnimationFrame(fogFrame.current); fogFrame.current = null; }
      fogCanvas.current = null;
      resizeObs.current?.disconnect(); resizeObs.current = null;
      if (map) map.remove();
      mapRef.current = null;
      mlRef.current = null;
    };
  }, []);

  // Keep the cursor honest for the active tool, and let a double-click finish a drawing.
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const drawing = tool === 'area' || tool === 'line';
    map.getCanvasContainer().style.cursor = tool === 'select' ? '' : drawing || tool === 'unit' ? 'crosshair' : 'pointer';
    if (drawing) map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
  }, [tool, world]);

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

  // First fit once there is data.
  useEffect(() => {
    if (!world || !data || didFit.current) return;
    didFit.current = true;
    fitView();
  }, [world, data, fitView]);

  // ── countries: owner colours ──
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

  // The country picked with the Borders tool stays outlined.
  const outlined = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const key = tool === 'borders' ? border?.key ?? null : null;
    if (outlined.current && outlined.current !== key) map.setFeatureState({ source: SRC_COUNTRIES, id: outlined.current }, { hi: false });
    if (key) map.setFeatureState({ source: SRC_COUNTRIES, id: key }, { hi: true });
    outlined.current = key;
  }, [world, tool, border]);

  // ── shapes ──
  const shapeLabels = useRef(new Map<string, MLMarker>());
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const editingId = draft?.shapeId ?? null;
    const list = shownShapes.filter((s) => s.id !== editingId);
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: list.map((s) => ({
        type: 'Feature',
        properties: { id: s.id, kind: s.kind, color: safeColor(s.color ?? cabById.get(s.owner_cabinet_id ?? '')?.color ?? DRAFT) },
        geometry: s.geometry as unknown as Feature['geometry'],
      })),
    };
    (map.getSource(SRC_SHAPES) as GeoJSONSource | undefined)?.setData(fc);
    const wanted = new Set<string>();
    for (const s of list) {
      if (!s.label) continue;
      wanted.add(s.id);
      const color = s.color ?? cabById.get(s.owner_cabinet_id ?? '')?.color ?? DRAFT;
      const at = centroidOf(shapePoints(s.geometry));
      const old = shapeLabels.current.get(s.id);
      if (old) old.remove();
      shapeLabels.current.set(s.id, new ml.Marker({ element: makeShapeLabel(s.label, color), anchor: 'center' }).setLngLat(at).addTo(map));
    }
    for (const [id, mk] of [...shapeLabels.current]) {
      if (!wanted.has(id)) { mk.remove(); shapeLabels.current.delete(id); }
    }
  }, [world, shownShapes, draft?.shapeId, cabById]);

  // Draft preview (the line or area being drawn).
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    (map.getSource(SRC_DRAFT) as GeoJSONSource | undefined)?.setData(draft ? draftFc(draft.kind, draft.points) : emptyFc);
  }, [world, draft]);

  // Corner handles of the draft.
  const handles = useRef<MLMarker[]>([]);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    for (const h of handles.current) h.remove();
    handles.current = [];
    if (!draft) return;
    const kind = draft.kind;
    const pts = draft.points;
    const min = MIN_POINTS[kind];
    const live: LngLat[] = pts.map((p) => [p[0], p[1]]);
    pts.forEach((p, i) => {
      const el = makeVertex();
      const mk = new ml.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(p).addTo(map);
      mk.on('drag', () => {
        const ll = mk.getLngLat();
        live[i] = [ll.lng, ll.lat];
        (map.getSource(SRC_DRAFT) as GeoJSONSource | undefined)?.setData(draftFc(kind, live));
      });
      mk.on('dragend', () => {
        const ll = mk.getLngLat();
        live[i] = [round5(clampLng(ll.lng)), round5(clampLat(ll.lat))];
        setDraft((d) => (d && d.sid === draft.sid ? { ...d, points: live.map((q) => [q[0], q[1]] as LngLat) } : d));
      });
      el.addEventListener('click', (ev) => ev.stopPropagation());
      el.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        if (pts.length <= min) return;
        setDraft((d) => (d && d.sid === draft.sid ? { ...d, points: d.points.filter((_, j) => j !== i) } : d));
      });
      handles.current.push(mk);
    });
    if (draft.phase === 'refine') {
      const edges = kind === 'area' ? pts.length : pts.length - 1;
      for (let i = 0; i < edges; i++) {
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
  }, [world, draft]);

  // The spot where a new unit will go.
  const ghost = useRef<MLMarker | null>(null);
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    ghost.current?.remove(); ghost.current = null;
    if (newUnit) ghost.current = new ml.Marker({ element: makeGhost(), anchor: 'center' }).setLngLat([newUnit.lng, newUnit.lat]).addTo(map);
    return () => { ghost.current?.remove(); ghost.current = null; };
  }, [world, newUnit]);

  // ── unit tokens ──
  const unitMarkers = useRef(new Map<string, { marker: MLMarker; el: HTMLElement; sig: string }>());
  const canDrag = editable && canUnits && tool === 'select';
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const markers = unitMarkers.current;
    const size = compact ? 26 : 32;
    const wanted = new Set(shownUnits.map((s) => s.u.id));
    for (const [id, m] of [...markers]) {
      if (!wanted.has(id)) { m.marker.remove(); markers.delete(id); }
    }
    for (const { u, suspected } of shownUnits) {
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
      } else if (!m.el.dataset.drag) {
        m.marker.setLngLat([u.lng, u.lat]);
      }
      m.marker.setDraggable(canDrag);
      const selected = u.id === selUnit;
      const sig = `${u.kind}|${u.strength}|${color}|${suspected}|${selected}|${size}|${u.name}`;
      if (m.sig !== sig) {
        paintToken(m.el, { kind: u.kind, color, strength: u.strength, suspected, selected, size, name: u.name });
        m.sig = sig;
      }
    }
  }, [world, shownUnits, cabById, selUnit, canDrag, compact]);

  useEffect(() => {
    const markers = unitMarkers.current;
    const labels = shapeLabels.current;
    const owners = applied.current;
    return () => {
      for (const m of markers.values()) m.marker.remove();
      markers.clear();
      for (const m of labels.values()) m.remove();
      labels.clear();
      owners.clear();
      outlined.current = null;
    };
  }, []);

  // ── fog ──
  const fogHoles = useMemo<FogHoles | null>(() => {
    if (!fogActive || !viewer || !world) return null;
    const geometries = [];
    for (const [key, cab] of ownerOf) {
      if (cab !== viewer) continue;
      const g = world.byKey.get(key)?.geometry;
      if (g) geometries.push(g);
    }
    const circles = shownUnits
      .filter((s) => !s.suspected && s.u.owner_cabinet_id === viewer)
      .map((s) => ({ lng: s.u.lng, lat: s.u.lat, km: KIND_META[s.u.kind].sight }));
    const rings = shownShapes.filter((s) => s.kind === 'area' && s.owner_cabinet_id === viewer).map((s) => shapePoints(s.geometry));
    return { geometries, circles, rings };
  }, [fogActive, viewer, world, ownerOf, shownUnits, shownShapes]);
  useEffect(() => {
    fogHolesRef.current = fogHoles;
    redrawFog();
  }, [fogHoles, redrawFog]);

  // ── panel ──
  const selUnitRow = selUnit ? shownUnits.find((s) => s.u.id === selUnit) ?? null : null;
  const selShapeRow = selShape ? (data?.shapes.find((s) => s.id === selShape) ?? null) : null;

  const unitDraftOf = (u: MapUnit): UnitDraft => ({
    name: u.name, kind: u.kind, strength: u.strength, owner: u.owner_cabinet_id, note: u.note ?? '',
    revealed: u.revealed_to, suspected: u.suspected_by,
  });

  let panel: React.ReactNode = null;
  if (!compact) {
    if (draft && editable) {
      panel = (
        <ShapeEditor
          key={draft.sid} kind={draft.kind} phase={draft.phase} isNew={!draft.shapeId} initial={draft.init} pointCount={draft.points.length}
          minPoints={MIN_POINTS[draft.kind]} cabinets={cabinets} busy={busy}
          onUndo={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })}
          onFinish={() => setDraft({ ...draft, phase: 'refine' })}
          onSave={(d) => { void submitShape(d, draft.kind, draft.shapeId, draft.points); }}
          onClose={() => { if (draft.shapeId) setDraft(null); else changeTool('select'); }}
        />
      );
    } else if (newUnit && editable && canUnits) {
      panel = (
        <UnitEditor
          key={`new-${newUnit.lng}-${newUnit.lat}`} isNew busy={busy} cabinets={cabinets}
          initial={{ name: '', kind: 'army', strength: 1, owner: defaultOwner, note: '', revealed: [], suspected: [] }}
          onSubmit={(d) => { void submitUnit(d, null); }} onClose={() => setNewUnit(null)}
        />
      );
    } else if (selUnitRow) {
      const u = selUnitRow.u;
      panel = editable && canUnits && !selUnitRow.suspected ? (
        <UnitEditor
          key={`${u.id}:${u.name}:${u.kind}:${u.strength}:${u.owner_cabinet_id}:${u.revealed_to.join()}:${u.suspected_by.join()}:${u.note}`}
          isNew={false} busy={busy} cabinets={cabinets} initial={unitDraftOf(u)}
          onSubmit={(d) => { void submitUnit(d, u); }} onDelete={() => { void removeUnit(u); }} onClose={() => setSelUnit(null)}
        />
      ) : (
        <UnitViewer key={u.id} unit={u} suspected={selUnitRow.suspected} cabinets={cabinets} onClose={() => setSelUnit(null)} />
      );
    } else if (selShapeRow && editable && canMap) {
      const s = selShapeRow;
      panel = (
        <ShapeEditor
          key={`${s.id}:${s.label}:${s.owner_cabinet_id}:${s.public}:${s.revealed_to.join()}`}
          kind={s.kind} phase="saved" isNew={false} pointCount={0} minPoints={0} cabinets={cabinets} busy={busy}
          initial={{ label: s.label ?? '', owner: s.owner_cabinet_id, isPublic: s.public, revealed: s.revealed_to }}
          onUndo={() => undefined} onFinish={() => undefined}
          onSave={(d) => { void submitShape(d, s.kind, s.id, null); }}
          onEditCorners={() => {
            setDraft({
              sid: new Date().getTime(), kind: s.kind, shapeId: s.id, phase: 'refine', points: shapePoints(s.geometry),
              init: { label: s.label ?? '', owner: s.owner_cabinet_id, isPublic: s.public, revealed: s.revealed_to },
            });
            setSelShape(null);
          }}
          onDelete={() => { void removeShape(s); }} onClose={() => setSelShape(null)}
        />
      );
    } else if (tool === 'borders' && editable && canMap) {
      panel = (
        <BorderPanel
          name={border?.name ?? null} ownerId={border ? ownerOf.get(border.key) ?? null : null} cabinets={cabinets} busy={busy}
          onPick={(id) => { if (border) void pickOwner(border.key, border.name, id); }} onClose={() => changeTool('select')}
        />
      );
    }
  }

  // ── controls ──
  const viewOptions = [{ value: 'all', label: 'Crisis team' }, ...cabinets.map((c) => ({ value: c.id, label: c.short }))];
  const viewerCabinet = viewer ? cabById.get(viewer) : null;
  const toolButtons: Array<{ id: Tool; label: string; icon: React.ReactNode; show: boolean }> = [
    { id: 'select', label: 'Select', icon: <MousePointer2 size={17} strokeWidth={1.5} />, show: true },
    { id: 'borders', label: 'Borders', icon: <Flag size={17} strokeWidth={1.5} />, show: editable && canMap },
    { id: 'unit', label: 'Add unit', icon: <Ship size={17} strokeWidth={1.5} />, show: editable && canUnits },
    { id: 'area', label: 'Draw area', icon: <Pentagon size={17} strokeWidth={1.5} />, show: editable && canMap },
    { id: 'line', label: 'Draw line', icon: <Route size={17} strokeWidth={1.5} />, show: editable && canMap },
  ];
  const showTools = !compact;

  const hint =
    tool === 'unit' && !newUnit ? 'Click the map where the unit should go.'
      : tool === 'borders' && !border ? 'Click a country to change who holds it.'
        : null;

  const compactInfo = compact && selUnitRow
    ? selUnitRow.suspected
      ? 'Suspected site'
      : `${selUnitRow.u.name} · ${KIND_META[selUnitRow.u.kind].label} · ${selUnitRow.u.strength.toLocaleString('en-GB')}`
    : null;

  return (
    <div className="wm-root" data-compact={compact ? '1' : undefined}>
      <style>{MAP_CSS}</style>

      <div className="wm-top">
        {!compact ? (
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: CK.ink }}>War Map</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: CK.inkSoft }}>
              {staff ? 'You see everything. Delegates see only what their side knows.' : viewerCabinet ? `What ${viewerCabinet.name} can see.` : 'What your side can see.'}
            </p>
          </div>
        ) : <span />}
        {staff ? (
          cabinets.length <= 4 ? (
            <Segmented value={staffViewer ?? 'all'} options={viewOptions} onChange={(val) => { setViewAs(val); }} ariaLabel="See the map as" />
          ) : (
            <div style={{ minWidth: 200 }}>
              <GSelect size="sm" value={staffViewer ?? 'all'} options={viewOptions} onChange={setViewAs} aria-label="See the map as" />
            </div>
          )
        ) : viewerCabinet ? (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>Viewing as {viewerCabinet.name}</span>
        ) : null}
      </div>

      <div className="wm-tools" role="toolbar" aria-label="Map tools">
        {showTools && toolButtons.filter((b) => b.show).map((b) => (
          <button key={b.id} type="button" className="wm-tool" aria-pressed={tool === b.id} onClick={() => changeTool(b.id)} title={b.label}>
            {b.icon}<span>{b.label}</span>
          </button>
        ))}
        {showTools && toolButtons.some((b) => b.show && b.id !== 'select') && <span className="wm-tool-sep" aria-hidden />}
        {staff && (
          <button
            type="button" className="wm-tool" aria-pressed={fogOn && !!staffViewer} disabled={!staffViewer}
            onClick={() => setFogOn((f) => !f)}
            title={staffViewer ? 'Hide or show what this side cannot see' : 'Pick a side above to see its fog of war'}
          >
            <Cloud size={17} strokeWidth={1.5} /><span>Fog of war</span>
          </button>
        )}
        <button type="button" className="wm-tool" aria-pressed={false} onClick={fitView} title="Fit the units in view">
          <Maximize2 size={17} strokeWidth={1.5} /><span>Fit view</span>
        </button>
      </div>

      <div className="wm-body">
        <div className="wm-stage">
          <div ref={hostRef} className="wm-map" role="application" aria-label="War map. Drag to move, pinch or scroll to zoom." />
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
          {hint && <div className="wm-hint">{hint}</div>}
        </div>

        {panel && <div className="wm-drawer">{panel}</div>}

        <div className="wm-legend">
          <div>
            {cabinets.map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}</span>)}
            <span><i style={{ border: `1.5px dashed ${CK.inkSoft}`, background: 'transparent' }} />Suspected</span>
            {compactInfo && <b style={{ color: CK.ink }}>{compactInfo}</b>}
          </div>
          <div>{last ? `Last change ${clock(last.at)} · ${last.text}` : staff ? 'No changes yet this visit' : 'Updates live'}</div>
        </div>
      </div>
    </div>
  );
}
