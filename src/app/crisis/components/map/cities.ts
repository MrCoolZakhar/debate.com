'use client';
// Gavelling Crisis map: the world's capitals and biggest cities. The list is one small static file on our own
// origin (public/crisis/world-cities.json: [name, lng, lat, 1 for a capital], grouped by country in order of
// size). Dots are cheap MapLibre layers (a square for a capital); names are a few HTML labels, placed for the
// current view only, so nothing is drawn for a city nobody can read. No glyph server is ever contacted.

import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { SRC_CITIES } from './mapStyle';

export interface City { key: string; name: string; lng: number; lat: number; cap: boolean; tier: 0 | 1 | 2 | 3; country: string }

type CityFile = Record<string, Array<[string, number, number, number?]>>;

/** Where dots appear, by tier: capitals, the biggest city, the next two, the rest. */
export const DOT_ZOOM: [number, number, number, number] = [2, 3.2, 4.2, 5.2];
/** Names come a little later than the dots, so a name never labels a dot you cannot see yet. */
export const LABEL_ZOOM: [number, number, number, number] = [2.6, 3.8, 4.8, 5.8];

let cache: Promise<City[]> | null = null;

export function loadCities(): Promise<City[]> {
  if (!cache) {
    cache = fetch('/crisis/world-cities.json')
      .then((r) => {
        if (!r.ok) throw new Error('The city list did not load.');
        return r.json() as Promise<CityFile>;
      })
      .then((file) => {
        const out: City[] = [];
        for (const [country, list] of Object.entries(file)) {
          let n = 0;
          for (const [name, lng, lat, capFlag] of list) {
            const cap = capFlag === 1;
            const tier: 0 | 1 | 2 | 3 = cap ? 0 : n === 0 ? 1 : n < 3 ? 2 : 3;
            if (!cap) n += 1;
            out.push({ key: `${country}:${name}`, name, lng, lat, cap, tier, country });
          }
        }
        return out;
      })
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

function capitalIcon(): ImageData | null {
  const px = 24;
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#FFFFFF';
  g.fillRect(3, 3, 18, 18);
  g.fillStyle = '#1C1410';
  g.fillRect(6, 6, 12, 12);
  return g.getImageData(0, 0, px, px);
}

/** Adds the city source (empty until the list arrives) and its layers. Never throws: cities are a nicety. */
export function addCityLayers(map: MLMap): void {
  try {
    map.addSource(SRC_CITIES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    for (const tier of [3, 2, 1] as const) {
      map.addLayer({
        id: `city-dot-${tier}`, type: 'circle', source: SRC_CITIES, minzoom: DOT_ZOOM[tier], filter: ['==', ['get', 't'], tier],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.8, 8, 3.2],
          'circle-color': '#4E463C', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 0.8, 'circle-opacity': 0.9,
        },
      });
    }
    let iconOk = false;
    try {
      const img = capitalIcon();
      if (img) {
        map.addImage('wm-capital', img, { pixelRatio: 2 });
        map.addLayer({
          id: 'city-cap', type: 'symbol', source: SRC_CITIES, minzoom: DOT_ZOOM[0], filter: ['==', ['get', 't'], 0],
          layout: { 'icon-image': 'wm-capital', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 7, 0.95] },
        });
        iconOk = true;
      }
    } catch { iconOk = false; }
    if (!iconOk) {
      map.addLayer({
        id: 'city-cap', type: 'circle', source: SRC_CITIES, minzoom: DOT_ZOOM[0], filter: ['==', ['get', 't'], 0],
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 7, 5], 'circle-color': '#1C1410', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.6 },
      });
    }
  } catch { /* the map works without cities */ }
}

export function fillCities(map: MLMap, cities: City[]): void {
  try {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: cities.map((c) => ({ type: 'Feature' as const, properties: { t: c.tier }, geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] } })),
    };
    (map.getSource(SRC_CITIES) as GeoJSONSource | undefined)?.setData(fc);
  } catch { /* try again on the next call */ }
}

/** Shows or hides the dots. Throws while the style is still loading: call it through the caller's retry. */
export function setCitiesVisible(map: MLMap, on: boolean): void {
  for (const id of ['city-dot-1', 'city-dot-2', 'city-dot-3', 'city-cap']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }
}

/**
 * The names. Only cities in view and past their zoom get a label, most important first, and a label that
 * would sit on top of one already placed is skipped. At most MAX labels exist at once.
 */
export function createCityLabels(map: MLMap, ml: typeof import('maplibre-gl')) {
  const MAX = 80;
  let cities: City[] = [];
  let on = true;
  let timer: number | null = null;
  const live = new Map<string, MLMarker>();

  const clear = () => { for (const mk of live.values()) mk.remove(); live.clear(); };

  const run = () => {
    timer = null;
    if (!on || !cities.length) { clear(); return; }
    const z = map.getZoom();
    const b = map.getBounds();
    const padX = (b.getEast() - b.getWest()) * 0.05; const padY = (b.getNorth() - b.getSouth()) * 0.05;
    const w = b.getWest() - padX; const e = b.getEast() + padX; const s = b.getSouth() - padY; const n = b.getNorth() + padY;
    const placed: Array<[number, number, number, number]> = [];
    const keep = new Set<string>();
    const order = [0, 1, 2, 3] as const;
    for (const tier of order) {
      if (z < LABEL_ZOOM[tier]) continue;
      for (const c of cities) {
        if (c.tier !== tier || c.lng < w || c.lng > e || c.lat < s || c.lat > n) continue;
        if (keep.size >= MAX) break;
        const p = map.project([c.lng, c.lat]);
        const width = c.name.length * (c.cap ? 6.6 : 5.9) + 6;
        const box: [number, number, number, number] = [p.x + 5, p.y - 7, p.x + 5 + width, p.y + 7];
        if (placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue;
        placed.push(box);
        keep.add(c.key);
        if (!live.has(c.key)) {
          const el = document.createElement('div');
          el.className = c.cap ? 'wm-city wm-city-cap' : 'wm-city';
          el.textContent = c.name;
          live.set(c.key, new ml.Marker({ element: el, anchor: 'left', offset: [6, 0] }).setLngLat([c.lng, c.lat]).addTo(map));
        }
      }
    }
    for (const [key, mk] of [...live]) if (!keep.has(key)) { mk.remove(); live.delete(key); }
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = window.setTimeout(run, 90);
  };
  map.on('moveend', schedule);
  map.on('zoomend', schedule);

  return {
    setCities(list: City[]) { cities = list; schedule(); },
    setOn(v: boolean) { on = v; schedule(); },
    refresh: schedule,
    destroy() {
      map.off('moveend', schedule); map.off('zoomend', schedule);
      if (timer !== null) window.clearTimeout(timer);
      clear();
    },
  };
}
