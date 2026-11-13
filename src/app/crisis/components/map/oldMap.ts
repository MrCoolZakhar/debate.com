// Gavelling Crisis map: the historical map underneath (the setting "Old map of France underneath"). IGN's État-major map of
// France (1820 to 1866) is drawn as a raster layer from our own tile proxy (/api/crisis-tiles), so a visitor's browser never
// contacts a third party. The layer sits just above the land, under the lakes, every country tint, border, zone, label,
// unit and character. It fades in from regional zoom, and the fills that would hide streets are thinned out at street zoom.
// Never imports the app: the callers pass the map in.

import type { Map as MLMap } from 'maplibre-gl';

export const SRC_OLDMAP = 'crisis-oldmap';
export const L_OLDMAP = 'crisis-oldmap';
/** The map may zoom this far in when the old map (or a landmark) is on; otherwise 9. */
export const MAX_ZOOM_DEEP = 16;
export const MAX_ZOOM_PLAIN = 9;
/** The old map's own last zoom; deeper than this its tiles are stretched. */
export const OLDMAP_TILE_MAX = 15;
/** The attribution shows once the old map is visible (its opacity is above zero from here). */
export const OLDMAP_ATTRIBUTION_ZOOM = 7.5;
export const OLDMAP_ATTRIBUTION = 'Old map: IGN, État-major map (1820 to 1866)';

const TILES = '/api/crisis-tiles/etatmajor/{z}/{x}/{y}';
/** France, roughly: west, south, east, north. */
const BOUNDS: [number, number, number, number] = [-5.5, 41.2, 9.8, 51.2];

/** The fills that would hide the old map, and what they are (restored when the old map goes). Shapes: tint 1 or 0.26. */
const FILLS: Array<{ id: string; layer: 'c-own' | 'c-base-fill' | 'shape-area-fill'; plain: unknown; thin: unknown }> = [
  { id: 'c-own', layer: 'c-own', plain: 1, thin: 0.55 },
  { id: 'c-base-fill', layer: 'c-base-fill', plain: 0.5, thin: 0.2 },
  {
    id: 'shape-area-fill', layer: 'shape-area-fill',
    plain: ['case', ['has', 'tint'], 1, 0.26],
    thin: ['case', ['has', 'tint'], 0.4, 0.14],
  },
];

/** Opacity by zoom: nothing out at country level, half at 8, nearly full from 10. */
const OLD_OPACITY = ['interpolate', ['linear'], ['zoom'], 6.5, 0, 8, 0.55, 10, 0.95];

/**
 * Turns the old map on or off. Throws while the style is still loading (call it through the caller's retry), and is safe to
 * call again with the same value.
 */
export function setOldMap(map: MLMap, on: boolean): void {
  if (on) {
    if (!map.getSource(SRC_OLDMAP)) {
      map.addSource(SRC_OLDMAP, { type: 'raster', tiles: [TILES], tileSize: 256, minzoom: 6, maxzoom: OLDMAP_TILE_MAX, bounds: BOUNDS });
    }
    if (!map.getLayer(L_OLDMAP)) {
      // Above the land fill, under the lakes, tints, borders, zones and everything after.
      const before = map.getLayer('water-lakes') ? 'water-lakes' : map.getLayer('c-base-fill') ? 'c-base-fill' : undefined;
      map.addLayer({
        id: L_OLDMAP, type: 'raster', source: SRC_OLDMAP, minzoom: 6.5,
        paint: { 'raster-opacity': OLD_OPACITY as never, 'raster-saturation': -0.1, 'raster-fade-duration': 200 },
      }, before);
    }
    // Territory fills thin out from about zoom 9.5 to 11.5, so streets show through a painted area.
    for (const f of FILLS) {
      if (!map.getLayer(f.layer)) continue;
      map.setPaintProperty(f.layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 9.5, f.plain, 11.5, f.thin] as never);
    }
    return;
  }
  // Nothing was added: leave the map exactly as it is (every crisis without the old map comes through here).
  if (!map.getLayer(L_OLDMAP) && !map.getSource(SRC_OLDMAP)) return;
  if (map.getLayer(L_OLDMAP)) map.removeLayer(L_OLDMAP);
  if (map.getSource(SRC_OLDMAP)) map.removeSource(SRC_OLDMAP);
  for (const f of FILLS) {
    if (map.getLayer(f.layer)) map.setPaintProperty(f.layer, 'fill-opacity', f.plain as never);
  }
}

/** The attribution line in the map's bottom-right corner while the old map shows. */
export const OLDMAP_CSS = `
.wm-attrib{position:absolute;right:12px;bottom:52px;z-index:3;max-width:calc(100% - 24px);padding:3px 8px;border-radius:8px;background:rgba(255,255,255,0.82);font:600 10.5px/1.3 var(--font-brand),Inter,system-ui,sans-serif;color:#6B6256;pointer-events:none}
.wm-root[data-compact] .wm-attrib{right:8px;bottom:8px}
.wm-root[data-stage] .wm-attrib{bottom:8px}
@media (max-width:767px){.wm-root:not([data-compact]) .wm-attrib{bottom:8px}}
`;
