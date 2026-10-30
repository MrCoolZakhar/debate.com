'use client';
// Gavelling Crisis map: offline geographic detail, the kind of thing a map shows beyond borders. Everything comes
// from two small static files on our own origin (Natural Earth, public domain, through the sane-topojson package),
// loaded only when asked for, so no tile, sprite or glyph server is ever contacted:
//   public/crisis/world-water.json    lakes, rivers (coarse for far out, fine for close up) and the names of seas,
//                                     oceans, straits, lakes and rivers          (about 350 KB, loaded with Water)
//   public/crisis/world-regions.json  first-level borders and names for the United States, Canada, Brazil and
//                                     Australia, the only countries Natural Earth carries at this scale
//                                     (about 50 KB, loaded when Regions is first turned on)
// Lines and fills are cheap MapLibre layers (see mapStyle.ts); names are a few HTML labels placed for the current view
// only, most important first, skipping any that would sit on top of one already placed.

import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import type { FeatureCollection, Feature } from 'geojson';
import { REGION_LAYERS, SRC_LAKES, SRC_REGIONS, SRC_RIVERS, SRC_RIVERS_FINE, WATER_LAYERS } from './mapStyle';

type Line = Array<[number, number]>;
/** [name, lng, lat, minZoom, kind] for seas, oceans and straits. */
type SeaLabel = [string, number, number, number, 'ocean' | 'sea' | 'strait'];
/** [name, lng, lat, minZoom] for lakes. */
type LakeLabel = [string, number, number, number];
/** [name, lng, lat, minZoom, angle in degrees]. */
type RiverLabel = [string, number, number, number, number];

export interface WaterFile {
  rivers110: Line[];
  rivers50: Line[];
  lakes: Array<Array<Array<[number, number]>>>;
  labels: { seas: SeaLabel[]; lakes: LakeLabel[]; rivers: RiverLabel[] };
}
export interface RegionsFile {
  lines: Record<string, Line[]>;
  /** [name, lng, lat, minZoom, country] */
  labels: Array<[string, number, number, number, string]>;
}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

let waterCache: Promise<WaterFile> | null = null;
let regionsCache: Promise<RegionsFile> | null = null;

function fetchJson<T>(url: string, what: string): Promise<T> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`The ${what} did not load.`);
    return r.json() as Promise<T>;
  });
}

export function loadWater(): Promise<WaterFile> {
  if (!waterCache) waterCache = fetchJson<WaterFile>('/crisis/world-water.json', 'water map').catch((e) => { waterCache = null; throw e; });
  return waterCache;
}

export function loadRegions(): Promise<RegionsFile> {
  if (!regionsCache) regionsCache = fetchJson<RegionsFile>('/crisis/world-regions.json', 'regions map').catch((e) => { regionsCache = null; throw e; });
  return regionsCache;
}

/** Adds the four empty sources the water and region layers read from. Call before adding mapLayers(). */
export function addPhysicalSources(map: MLMap): void {
  for (const id of [SRC_LAKES, SRC_RIVERS, SRC_RIVERS_FINE, SRC_REGIONS]) map.addSource(id, { type: 'geojson', data: empty });
}

const linesFc = (lines: Line[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: lines.map((coordinates): Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
});

function setData(map: MLMap, id: string, fc: FeatureCollection): void {
  try { (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc); } catch { /* the style is still loading: the next call sets it */ }
}

export function fillWater(map: MLMap, f: WaterFile): void {
  setData(map, SRC_LAKES, {
    type: 'FeatureCollection',
    features: f.lakes.map((coordinates): Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } })),
  });
  setData(map, SRC_RIVERS, linesFc(f.rivers110));
  setData(map, SRC_RIVERS_FINE, linesFc(f.rivers50));
}

export function fillRegions(map: MLMap, f: RegionsFile): void {
  setData(map, SRC_REGIONS, linesFc(Object.values(f.lines).flat()));
}

function setVisible(map: MLMap, ids: string[], on: boolean): void {
  for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}
/** Throw while the style is still loading: call through the caller's retry. */
export function setWaterVisible(map: MLMap, on: boolean): void { setVisible(map, WATER_LAYERS, on); }
export function setRegionsVisible(map: MLMap, on: boolean): void { setVisible(map, REGION_LAYERS, on); }

// ── names ──

type Kind = 'ocean' | 'sea' | 'strait' | 'lake' | 'river' | 'region';
interface Name { key: string; text: string; lng: number; lat: number; min: number; max: number; kind: Kind; angle: number }

const ORDER: Kind[] = ['ocean', 'sea', 'lake', 'strait', 'river', 'region'];
const MAX_LABELS = 90;

function widthOf(n: Name): number {
  const per = n.kind === 'ocean' ? 13 : n.kind === 'region' ? 8 : n.kind === 'strait' ? 5.4 : 6.1;
  return n.text.length * per + 8;
}

function makeNameEl(n: Name): HTMLElement {
  const el = document.createElement('div');
  const inner = document.createElement('div');
  inner.className = `wm-wlabel wm-wlabel-${n.kind}`;
  inner.textContent = n.text;
  if (n.angle) inner.style.transform = `rotate(${n.angle}deg)`;
  el.appendChild(inner);
  return el;
}

/** The names of water (seas, oceans, straits, lakes, rivers) and of regions. Each set is switched on and off apart. */
export function createNameLabels(map: MLMap, ml: typeof import('maplibre-gl')) {
  let water: Name[] = [];
  let regions: Name[] = [];
  let waterOn = true;
  let regionsOn = false;
  let timer: number | null = null;
  const live = new Map<string, MLMarker>();

  const clear = () => { for (const mk of live.values()) mk.remove(); live.clear(); };

  const run = () => {
    timer = null;
    const list = [...(waterOn ? water : []), ...(regionsOn ? regions : [])];
    if (!list.length) { clear(); return; }
    const z = map.getZoom();
    const b = map.getBounds();
    const padX = (b.getEast() - b.getWest()) * 0.04; const padY = (b.getNorth() - b.getSouth()) * 0.04;
    const w = b.getWest() - padX; const e = b.getEast() + padX; const s = b.getSouth() - padY; const n = b.getNorth() + padY;
    const placed: Array<[number, number, number, number]> = [];
    const keep = new Set<string>();
    for (const kind of ORDER) {
      for (const l of list) {
        if (l.kind !== kind || z < l.min || z > l.max || l.lng < w || l.lng > e || l.lat < s || l.lat > n) continue;
        if (keep.size >= MAX_LABELS) break;
        const p = map.project([l.lng, l.lat]);
        const width = widthOf(l);
        const half = Math.abs(l.angle) > 25 ? Math.min(width, 90) / 2 : width / 2;
        const box: [number, number, number, number] = [p.x - half, p.y - 8, p.x + half, p.y + 8];
        if (placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue;
        placed.push(box);
        keep.add(l.key);
        if (!live.has(l.key)) {
          live.set(l.key, new ml.Marker({ element: makeNameEl(l), anchor: 'center' }).setLngLat([l.lng, l.lat]).addTo(map));
        }
      }
    }
    for (const [key, mk] of [...live]) if (!keep.has(key)) { mk.remove(); live.delete(key); }
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = window.setTimeout(run, 100);
  };
  map.on('moveend', schedule);
  map.on('zoomend', schedule);

  return {
    setWater(f: WaterFile | null) {
      water = f ? [
        ...f.labels.seas.map(([text, lng, lat, min, kind]): Name => ({ key: `s:${text}`, text, lng, lat, min, max: kind === 'ocean' ? 5.4 : 99, kind, angle: 0 })),
        ...f.labels.lakes.map(([text, lng, lat, min]): Name => ({ key: `l:${text}`, text, lng, lat, min, max: 99, kind: 'lake', angle: 0 })),
        ...f.labels.rivers.map(([text, lng, lat, min, angle]): Name => ({ key: `r:${text}`, text, lng, lat, min, max: 99, kind: 'river', angle })),
      ] : [];
      schedule();
    },
    setRegions(f: RegionsFile | null) {
      regions = f ? f.labels.map(([text, lng, lat, min, cc]): Name => ({ key: `g:${cc}:${text}`, text, lng, lat, min, max: 99, kind: 'region', angle: 0 })) : [];
      schedule();
    },
    setWaterOn(v: boolean) { waterOn = v; schedule(); },
    setRegionsOn(v: boolean) { regionsOn = v; schedule(); },
    destroy() {
      map.off('moveend', schedule); map.off('zoomend', schedule);
      if (timer !== null) window.clearTimeout(timer);
      clear();
    },
  };
}
