'use client';
// Gavelling Crisis: the small map inside the directive's side panel. It reuses the war map's building
// blocks (the offline world, the layers, the unit tokens) read only and draws what the reply WILL do:
// a unit that is moved shows at its new place with a dashed arrow from where it is now, a country
// that changes hands takes its new holder's colour. Nothing here writes to the crisis; every click
// and drag is handed back to the panel, which stages it in the reply's draft.
//
// Move a unit: click the map (or drag the selected unit) to set where it goes.
// Change a border: click a country to pick it.

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MLMap, MapMouseEvent, Marker as MLMarker } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Skeleton, CK, cabinetTint } from '../../crisisKit';
import { clampLat, clampLng, loadWorldData, type LngLat, type WorldData } from '../map/mapData';
import { BLANK_STYLE, DRAFT, L_LAND, NOBODY, SRC_COUNTRIES, SRC_DRAFT, SRC_SHAPES, mapLayers } from '../map/mapStyle';
import { MAP_CSS, makeCountryLabel, makeGhost, paintToken, safeColor } from '../map/tokens';
import type { MapRegion, MapUnit } from '@/lib/crisis/types';
import type { UnitStage } from './replyDraft';

export type StageMode = 'unit' | 'border';

export interface StageMapProps {
  units: MapUnit[];
  regions: MapRegion[];
  cabinets: Array<{ id: string; color: string }>;
  stagedUnits: Record<string, UnitStage>;
  stagedRegions: Record<string, string | null>;
  mode: StageMode;
  selectedUnitId: string;
  selectedCountry: string;
  canUnits: boolean;
  canMap: boolean;
  onSelectUnit: (id: string) => void;
  onPlaceUnit: (lng: number, lat: number) => void;
  onPickCountry: (key: string) => void;
  height?: number;
}

interface Live {
  mode: StageMode; canUnits: boolean; canMap: boolean; selectedUnitId: string;
  onSelectUnit: (id: string) => void; onPlaceUnit: (lng: number, lat: number) => void; onPickCountry: (key: string) => void;
}

const SRC_MOVES = 'stage-moves';
const emptyFc: FeatureCollection = { type: 'FeatureCollection', features: [] };
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export default function StageMap(props: StageMapProps) {
  const { units, regions, cabinets, stagedUnits, stagedRegions, mode, selectedUnitId, selectedCountry, canUnits, canMap, height = 280 } = props;
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const live = useRef<Live | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unitMarkers = useRef(new Map<string, { marker: MLMarker; el: HTMLElement }>());
  const ghostMarkers = useRef(new Map<string, MLMarker>());
  const applied = useRef(new Map<string, string>());
  const highlighted = useRef<string | null>(null);
  const didFit = useRef(false);
  const lastSelected = useRef('');

  useEffect(() => {
    live.current = {
      mode, canUnits, canMap, selectedUnitId,
      onSelectUnit: props.onSelectUnit, onPlaceUnit: props.onPlaceUnit, onPickCountry: props.onPickCountry,
    };
  });

  // ── create the map (once) ──
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let ro: ResizeObserver | null = null;
    const labelMarkers = new Map<string, MLMarker>();
    const unitMap = unitMarkers.current;
    const ghostMap = ghostMarkers.current;
    const appliedMap = applied.current;
    (async () => {
      try {
        const [ml, w] = await Promise.all([import('maplibre-gl'), loadWorldData()]);
        if (cancelled || !host.current) return;
        ml.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
        mlRef.current = ml;
        map = new ml.Map({
          container: host.current, style: BLANK_STYLE, center: [-30, 28], zoom: 1, minZoom: 0.5, maxZoom: 8,
          renderWorldCopies: false, attributionControl: false, dragRotate: false, pitchWithRotate: false, maxPitch: 0,
        });
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();
        // The panel scrolls, so the wheel must scroll it: zoom has its own buttons.
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        ro = new ResizeObserver(() => { map?.resize(); });
        ro.observe(host.current);
        const m = map;
        mapRef.current = m;

        const syncLabels = () => {
          const z = m.getZoom() + 0.6;
          for (const l of w.labels) {
            const show = z >= l.minZoom;
            const has = labelMarkers.get(l.key);
            if (show && !has) labelMarkers.set(l.key, new ml.Marker({ element: makeCountryLabel(l.name, l.area), anchor: 'center' }).setLngLat(l.center).addTo(m));
            else if (!show && has) { has.remove(); labelMarkers.delete(l.key); }
          }
        };

        m.on('load', () => {
          if (cancelled) return;
          m.addSource(SRC_COUNTRIES, { type: 'geojson', data: w.collection, promoteId: 'key' });
          m.addSource(SRC_SHAPES, { type: 'geojson', data: emptyFc });
          m.addSource(SRC_DRAFT, { type: 'geojson', data: emptyFc });
          for (const layer of mapLayers()) m.addLayer(layer);
          m.addSource(SRC_MOVES, { type: 'geojson', data: emptyFc });
          m.addLayer({
            id: 'stage-moves-line', type: 'line', source: SRC_MOVES, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': DRAFT, 'line-width': 2.6, 'line-dasharray': [2, 1.4] },
          });
          m.on('click', (e: MapMouseEvent) => {
            const lv = live.current;
            if (!lv) return;
            const target = e.originalEvent.target as HTMLElement | null;
            if (target?.closest('.wm-marker')) return;
            if (lv.mode === 'unit') {
              if (lv.canUnits && lv.selectedUnitId) lv.onPlaceUnit(round5(clampLng(e.lngLat.lng)), round5(clampLat(e.lngLat.lat)));
            } else if (lv.canMap) {
              const f = m.queryRenderedFeatures(e.point, { layers: [L_LAND] })[0];
              const key = (f?.properties?.key as string | undefined) ?? null;
              if (key) lv.onPickCountry(key);
            }
          });
          m.on('zoom', syncLabels);
          syncLabels();
          setWorld(w);
          m.resize(); m.triggerRepaint();
          window.requestAnimationFrame(() => { if (!cancelled) { m.resize(); m.triggerRepaint(); } });
        });
        m.on('error', (ev) => {
          const msg = String((ev as { error?: { message?: string } }).error?.message ?? '');
          if (/webgl/i.test(msg)) setError('This browser could not start the map. Try another browser or turn on hardware acceleration.');
        });
      } catch {
        if (!cancelled) setError('The map could not start. Close this and open the directive again.');
      }
    })();
    return () => {
      cancelled = true;
      for (const mk of labelMarkers.values()) mk.remove();
      labelMarkers.clear();
      for (const u of unitMap.values()) u.marker.remove();
      unitMap.clear();
      for (const g of ghostMap.values()) g.remove();
      ghostMap.clear();
      appliedMap.clear();
      ro?.disconnect();
      if (map) map.remove();
      mapRef.current = null;
      mlRef.current = null;
    };
  }, []);

  // The cursor says what a click does.
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const active = mode === 'unit' ? canUnits && !!selectedUnitId : canMap;
    map.getCanvasContainer().style.cursor = active ? 'crosshair' : '';
  }, [world, mode, canUnits, canMap, selectedUnitId]);

  // ── countries: holder colours, with the staged changes laid over ──
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const color = new Map(cabinets.map((c) => [c.id, c.color]));
    const holder = new Map<string, string | null>();
    for (const r of regions) holder.set(r.region_key, r.owner_cabinet_id);
    for (const [k, v] of Object.entries(stagedRegions)) holder.set(k, v);
    const next = new Map<string, string>();
    for (const [key, cab] of holder) {
      const c = cab ? color.get(cab) : undefined;
      if (c && world.byKey.has(key)) next.set(key, c);
    }
    for (const [key, c] of next) {
      if (applied.current.get(key) === c) continue;
      map.setFeatureState({ source: SRC_COUNTRIES, id: key }, { tint: cabinetTint(c, 0.3), edge: cabinetTint(c, 0.95) });
      applied.current.set(key, c);
    }
    for (const key of [...applied.current.keys()]) {
      if (next.has(key)) continue;
      map.removeFeatureState({ source: SRC_COUNTRIES, id: key }, 'tint');
      map.removeFeatureState({ source: SRC_COUNTRIES, id: key }, 'edge');
      applied.current.delete(key);
    }
  }, [world, regions, stagedRegions, cabinets]);

  // The chosen country is outlined.
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map) return;
    const want = mode === 'border' && selectedCountry && world.byKey.has(selectedCountry) ? selectedCountry : null;
    if (highlighted.current && highlighted.current !== want) map.setFeatureState({ source: SRC_COUNTRIES, id: highlighted.current }, { hi: false });
    if (want) map.setFeatureState({ source: SRC_COUNTRIES, id: want }, { hi: true });
    highlighted.current = want;
  }, [world, mode, selectedCountry]);

  // ── unit tokens, ghosts of where they were, and the arrows ──
  useEffect(() => {
    const map = mapRef.current; const ml = mlRef.current;
    if (!world || !map || !ml) return;
    const markers = unitMarkers.current;
    const ghosts = ghostMarkers.current;
    const wanted = new Set(units.map((u) => u.id));
    for (const [id, m] of [...markers]) if (!wanted.has(id)) { m.marker.remove(); markers.delete(id); }
    for (const [id, g] of [...ghosts]) if (!wanted.has(id)) { g.remove(); ghosts.delete(id); }
    const colorOf = new Map(cabinets.map((c) => [c.id, c.color]));
    const arrows: Feature[] = [];
    for (const u of units) {
      const st = stagedUnits[u.id];
      const moved = !!st && st.lng !== undefined && st.lat !== undefined;
      const at: LngLat = moved ? [st.lng as number, st.lat as number] : [u.lng, u.lat];
      const color = u.owner_cabinet_id ? colorOf.get(u.owner_cabinet_id) ?? NOBODY : NOBODY;
      const selected = u.id === selectedUnitId;
      let m = markers.get(u.id);
      if (!m) {
        const el = document.createElement('div');
        const marker = new ml.Marker({ element: el, draggable: false, anchor: 'center' }).setLngLat(at).addTo(map);
        const id = u.id;
        marker.on('dragstart', () => { el.dataset.drag = '1'; });
        marker.on('dragend', () => {
          delete el.dataset.drag;
          el.dataset.dragged = '1';
          window.setTimeout(() => { delete el.dataset.dragged; }, 80);
          const ll = marker.getLngLat();
          live.current?.onPlaceUnit(round5(clampLng(ll.lng)), round5(clampLat(ll.lat)));
        });
        const press = (ev: Event) => {
          if (el.dataset.dragged) return;
          ev.stopPropagation();
          live.current?.onSelectUnit(id);
        };
        el.addEventListener('click', press);
        el.addEventListener('dblclick', (ev) => ev.stopPropagation());
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); press(ev); } });
        m = { marker, el };
        markers.set(u.id, m);
      }
      m.marker.setLngLat(at);
      m.marker.setDraggable(canUnits && mode === 'unit' && selected);
      m.el.style.zIndex = selected ? '3' : moved ? '2' : '1';
      paintToken(m.el, { kind: u.kind, color: safeColor(color), strength: st?.strength ?? u.strength, suspected: false, selected, size: 28, name: u.name });

      const ghost = ghosts.get(u.id);
      if (moved) {
        if (ghost) ghost.setLngLat([u.lng, u.lat]);
        else ghosts.set(u.id, new ml.Marker({ element: makeGhost(), anchor: 'center' }).setLngLat([u.lng, u.lat]).addTo(map));
        arrows.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[u.lng, u.lat], at] } });
      } else if (ghost) { ghost.remove(); ghosts.delete(u.id); }
    }
    (map.getSource(SRC_MOVES) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: arrows });
  }, [world, units, stagedUnits, cabinets, selectedUnitId, canUnits, mode]);

  // First view: all the units, or the world.
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map || didFit.current) return;
    didFit.current = true;
    if (!units.length) { map.fitBounds([[-168, -48], [178, 76]], { padding: 6, duration: 0 }); return; }
    let minX = 180; let minY = 90; let maxX = -180; let maxY = -90;
    for (const u of units) { minX = Math.min(minX, u.lng); maxX = Math.max(maxX, u.lng); minY = Math.min(minY, u.lat); maxY = Math.max(maxY, u.lat); }
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 46, maxZoom: 4.5, duration: 0 });
  }, [world, units]);

  // Choosing another unit brings it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!world || !map || !selectedUnitId || lastSelected.current === selectedUnitId) return;
    lastSelected.current = selectedUnitId;
    const u = units.find((x) => x.id === selectedUnitId);
    if (!u) return;
    const st = stagedUnits[u.id];
    const at: LngLat = st && st.lng !== undefined && st.lat !== undefined ? [st.lng, st.lat] : [u.lng, u.lat];
    if (!map.getBounds().contains(at)) map.easeTo({ center: at, duration: 300 });
  }, [world, selectedUnitId, units, stagedUnits]);

  const zoomBtn = {
    width: 30, height: 30, borderRadius: 9, border: 0, background: 'rgba(255,255,255,0.95)', color: CK.forest, cursor: 'pointer',
    display: 'grid', placeItems: 'center', boxShadow: CK.shadowSm,
  } as const;

  return (
    <div style={{ position: 'relative', height, borderRadius: 14, overflow: 'hidden', background: '#DCE4DA', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.1)' }}>
      <style>{MAP_CSS}</style>
      <div ref={host} aria-label="Map" style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
      {!world && !error && <div style={{ position: 'absolute', inset: 0, padding: 12 }} aria-busy="true"><Skeleton h={height - 24} r={12} /></div>}
      {error && <p style={{ position: 'absolute', inset: 0, margin: 0, padding: 16, fontSize: 13, color: CK.inkSoft, background: 'rgba(255,255,255,0.9)' }}>{error}</p>}
      {world && (
        <div className="flex flex-col" style={{ position: 'absolute', top: 8, right: 8, gap: 5, zIndex: 5 }}>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 200 })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={zoomBtn}><Plus size={16} strokeWidth={1.6} /></button>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 200 })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={zoomBtn}><Minus size={16} strokeWidth={1.6} /></button>
          <button
            type="button" aria-label="Show the whole world" title="Show the whole world"
            onClick={() => mapRef.current?.fitBounds([[-168, -48], [178, 76]], { padding: 6, duration: 300 })}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={zoomBtn}
          ><Maximize2 size={14} strokeWidth={1.6} /></button>
        </div>
      )}
    </div>
  );
}
