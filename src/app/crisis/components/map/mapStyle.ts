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
/** The real outline of every country this crisis changed: it stays on the map under the changed shape. */
export const SRC_BASE = 'base-outline';
/** Moves a directive reply plans (dashed trajectories), and the sight ring of the selected unit. */
export const SRC_PLANS = 'planned-moves';
export const SRC_SIGHT = 'sight-ring';
/** Capitals and big cities (public/crisis/world-cities.json). */
export const SRC_CITIES = 'cities';

export const L_LAND = 'c-land';
export const L_SHAPE_FILL = 'shape-area-fill';
export const L_SHAPE_HIT = 'shape-hit';
export const L_BASE_FILL = 'c-base-fill';

const CLEAR = 'rgba(0,0,0,0)';

export const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'sea', type: 'background' as const, paint: { 'background-color': SEA } }],
};

/**
 * The real outline of a country whose border was changed, drawn first so it sits under everything: a faint fill
 * (it is still the country's land) and a dashed line. The changed shape is drawn over it by mapLayers().
 */
export function baseLayers(): AddLayerObject[] {
  return [
    { id: L_BASE_FILL, type: 'fill', source: SRC_BASE, paint: { 'fill-color': '#E7DFCB' } },
    {
      id: 'c-base-line', type: 'line', source: SRC_BASE, layout: { 'line-join': 'round' },
      paint: { 'line-color': '#8C7F66', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 1.6], 'line-dasharray': [3, 2] },
    },
  ];
}

export function mapLayers(): AddLayerObject[] {
  return [
    { id: L_LAND, type: 'fill', source: SRC_COUNTRIES, paint: { 'fill-color': LAND } },
    { id: 'c-own', type: 'fill', source: SRC_COUNTRIES, paint: { 'fill-color': ['coalesce', ['feature-state', 'tint'], CLEAR] } },
    {
      id: 'c-line', type: 'line', source: SRC_COUNTRIES, layout: { 'line-join': 'round' },
      paint: { 'line-color': LAND_LINE, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 6, 1.1] },
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
