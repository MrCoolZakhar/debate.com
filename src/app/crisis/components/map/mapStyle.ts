// Gavelling Crisis map: the colours and the MapLibre layers. A blank style (a sea-coloured
// background and nothing else), so no tile, sprite or glyph server is ever contacted. Country
// labels and unit tokens are HTML markers, never symbol layers (those need glyphs).
// This file has no imports from the app so a script can check the layers against the style spec.

import type { AddLayerObject } from 'maplibre-gl';

export const SEA = '#DCE4DA';
export const LAND = '#F5F0E4';
export const LAND_LINE = '#CBBE9F';
export const FOREST = '#1B3828';
export const DRAFT = '#8E2424';
export const NOBODY = '#6B6256';

export const SRC_COUNTRIES = 'countries';
export const SRC_SHAPES = 'shapes';
export const SRC_DRAFT = 'draft';
/** The selected territory's outline, the outline being dragged, and the point under the pointer. */
export const SRC_SEL = 'sel';
export const SRC_EDIT = 'edit';
export const SRC_HOVER = 'hover-pt';
/** The real outline of every country this crisis changed: it stays visible over the changed shape. */
export const SRC_BASE = 'base-outline';
/** Moves a directive reply plans (dashed trajectories), and the sight ring of the selected unit. */
export const SRC_PLANS = 'planned-moves';
export const SRC_SIGHT = 'sight-ring';
/** Capitals and big cities (public/crisis/world-cities.json). */
export const SRC_CITIES = 'cities';
/** Offline water and regions (public/crisis/world-water.json, world-regions.json): lakes, rivers (coarse and fine), first-level borders. */
export const SRC_LAKES = 'lakes';
export const SRC_RIVERS = 'rivers-coarse';
export const SRC_RIVERS_FINE = 'rivers-fine';
export const SRC_REGIONS = 'regions';

export const L_LAND = 'c-land';
export const L_SHAPE_FILL = 'shape-area-fill';
export const L_SHAPE_HIT = 'shape-hit';
export const L_BASE_FILL = 'c-base-fill';
export const L_ZONE_FILL = 'zone-fill';
/** Layers the Water toggle shows and hides, and the one the Regions toggle shows and hides. */
export const WATER_LAYERS = ['water-lakes', 'water-lakes-line', 'river-coarse', 'river-fine'];
export const REGION_LAYERS = ['region-line'];

export const WATER = '#DCE4DA';
export const WATER_LINE = '#B9CBC8';
export const RIVER = '#A9C4C7';

const CLEAR = 'rgba(0,0,0,0)';

export const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'sea', type: 'background' as const, paint: { 'background-color': SEA } }],
};

/**
 * Kept for the callers that add it before mapLayers(): the real outline of a country whose border was changed
 * is part of mapLayers() now, because it has to sit ABOVE the land and the drawn territory (a fill that hides
 * under the changed shape hides the country it came from).
 */
export function baseLayers(): AddLayerObject[] {
  return [];
}

export function mapLayers(): AddLayerObject[] {
  return [
    { id: L_LAND, type: 'fill', source: SRC_COUNTRIES, paint: { 'fill-color': LAND } },
    // Lakes sit on the land, under every tint, so a cabinet's colour still shows through them.
    { id: 'water-lakes', type: 'fill', source: SRC_LAKES, paint: { 'fill-color': WATER } },
    { id: 'water-lakes-line', type: 'line', source: SRC_LAKES, layout: { 'line-join': 'round' }, paint: { 'line-color': WATER_LINE, 'line-width': 0.7 } },
    // The original country of every changed border: its full outline gets a light fill over the land (and over the
    // sea where its land was taken), under the cabinet tints and the drawn territory, so it never disappears.
    { id: L_BASE_FILL, type: 'fill', source: SRC_BASE, paint: { 'fill-color': '#CFC19F', 'fill-opacity': 0.5 } },
    { id: 'c-own', type: 'fill', source: SRC_COUNTRIES, paint: { 'fill-color': ['coalesce', ['feature-state', 'tint'], CLEAR] } },
    {
      id: 'c-line', type: 'line', source: SRC_COUNTRIES, layout: { 'line-join': 'round' },
      paint: { 'line-color': LAND_LINE, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 6, 1.1] },
    },
    // First-level borders (states and provinces), fainter than a country's.
    {
      id: 'region-line', type: 'line', source: SRC_REGIONS, minzoom: 3, layout: { 'line-join': 'round' },
      paint: { 'line-color': '#B7AA88', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 7, 1], 'line-dasharray': [3, 2], 'line-opacity': 0.85 },
    },
    // Rivers: the biggest ones from far out, the full set once zoomed in.
    {
      id: 'river-coarse', type: 'line', source: SRC_RIVERS, minzoom: 2, maxzoom: 4.2, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RIVER, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 4.2, 1.3] },
    },
    {
      id: 'river-fine', type: 'line', source: SRC_RIVERS_FINE, minzoom: 4.2, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RIVER, 'line-width': ['interpolate', ['linear'], ['zoom'], 4.2, 0.9, 9, 2.2] },
    },
    {
      id: 'c-own-line', type: 'line', source: SRC_COUNTRIES, layout: { 'line-join': 'round' },
      paint: { 'line-color': ['coalesce', ['feature-state', 'edge'], CLEAR], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 2.4] },
    },
    {
      id: L_SHAPE_FILL, type: 'fill', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'area'],
      paint: { 'fill-color': ['coalesce', ['get', 'tint'], ['get', 'color']], 'fill-opacity': ['case', ['has', 'tint'], 1, 0.26] },
    },
    {
      id: 'shape-area-line', type: 'line', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'area'], layout: { 'line-join': 'round' },
      paint: { 'line-color': ['coalesce', ['get', 'edge'], ['get', 'color']], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 2.4] },
    },
    {
      id: 'shape-line', type: 'line', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'line'], layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1.5] },
    },
    // Zones: overlays that are not territory. They sit over the territory and never cut it.
    { id: L_ZONE_FILL, type: 'fill', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'zone'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } },
    {
      id: 'zone-line', type: 'line', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'zone'], layout: { 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.4, 6, 2.6], 'line-dasharray': [3, 1.6] },
    },
    // The original outline again, dashed, over everything drawn, so it can be followed under any territory.
    {
      id: 'c-base-line', type: 'line', source: SRC_BASE, layout: { 'line-join': 'round' },
      paint: { 'line-color': '#5E5340', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 6, 1.8], 'line-dasharray': [3, 2], 'line-opacity': 0.9 },
    },
    { id: L_SHAPE_HIT, type: 'line', source: SRC_SHAPES, paint: { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 } },
    { id: 'draft-fill', type: 'fill', source: SRC_DRAFT, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['coalesce', ['get', 'tint'], DRAFT], 'fill-opacity': ['case', ['has', 'tint'], 1, 0.16] } },
    {
      id: 'draft-line', type: 'line', source: SRC_DRAFT, layout: { 'line-join': 'round' },
      paint: { 'line-color': ['coalesce', ['get', 'edge'], DRAFT], 'line-width': 2.4, 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'c-hi', type: 'line', source: SRC_COUNTRIES, layout: { 'line-join': 'round' },
      paint: { 'line-color': FOREST, 'line-width': 3, 'line-opacity': ['case', ['boolean', ['feature-state', 'hi'], false], 1, 0] },
    },
  ];
}

/** Layers for selecting and reshaping a territory (the main map only; they need SRC_SEL, SRC_EDIT and SRC_HOVER). */
export function editLayers(): AddLayerObject[] {
  return [
    { id: 'sel-fill', type: 'fill', source: SRC_SEL, paint: { 'fill-color': DRAFT, 'fill-opacity': 0.07 } },
    { id: 'sel-halo', type: 'line', source: SRC_SEL, layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.85 } },
    { id: 'sel-line', type: 'line', source: SRC_SEL, layout: { 'line-join': 'round' }, paint: { 'line-color': DRAFT, 'line-width': 2.2 } },
    {
      id: 'edit-fill', type: 'fill', source: SRC_EDIT, filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': ['coalesce', ['get', 'tint'], DRAFT], 'fill-opacity': ['case', ['has', 'tint'], 1, 0.2] },
    },
    { id: 'edit-line', type: 'line', source: SRC_EDIT, layout: { 'line-join': 'round' }, paint: { 'line-color': DRAFT, 'line-width': 2.4, 'line-dasharray': [2, 1.5] } },
    // The sight ring of the selected unit (staff can drag its handle).
    { id: 'sight-fill', type: 'fill', source: SRC_SIGHT, paint: { 'fill-color': DRAFT, 'fill-opacity': 0.05 } },
    { id: 'sight-line', type: 'line', source: SRC_SIGHT, layout: { 'line-join': 'round' }, paint: { 'line-color': DRAFT, 'line-width': 1.8, 'line-dasharray': [3, 2] } },
    // Where a reply plans to move units: a dashed trajectory from where each one is now.
    { id: 'plan-halo', type: 'line', source: SRC_PLANS, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.85 } },
    { id: 'plan-line', type: 'line', source: SRC_PLANS, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': DRAFT, 'line-width': 2.6, 'line-dasharray': [2, 1.4] } },
    {
      id: 'hover-pt', type: 'circle', source: SRC_HOVER,
      paint: { 'circle-radius': 6, 'circle-color': '#FFFFFF', 'circle-stroke-color': DRAFT, 'circle-stroke-width': 2.5 },
    },
  ];
}
