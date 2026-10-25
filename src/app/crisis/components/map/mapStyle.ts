// Gavelling Crisis war map: the colours and the MapLibre layers. A blank style (a sea-coloured
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

export const L_LAND = 'c-land';
export const L_SHAPE_FILL = 'shape-area-fill';
export const L_SHAPE_HIT = 'shape-hit';

const CLEAR = 'rgba(0,0,0,0)';

export const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'sea', type: 'background' as const, paint: { 'background-color': SEA } }],
};

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
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.26 },
    },
    {
      id: 'shape-area-line', type: 'line', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'area'], layout: { 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
    },
    {
      id: 'shape-line', type: 'line', source: SRC_SHAPES, filter: ['==', ['get', 'kind'], 'line'], layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1.5] },
    },
    { id: L_SHAPE_HIT, type: 'line', source: SRC_SHAPES, paint: { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 } },
    { id: 'draft-fill', type: 'fill', source: SRC_DRAFT, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': DRAFT, 'fill-opacity': 0.16 } },
    {
      id: 'draft-line', type: 'line', source: SRC_DRAFT, layout: { 'line-join': 'round' },
      paint: { 'line-color': DRAFT, 'line-width': 2.4, 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'c-hi', type: 'line', source: SRC_COUNTRIES, layout: { 'line-join': 'round' },
      paint: { 'line-color': FOREST, 'line-width': 3, 'line-opacity': ['case', ['boolean', ['feature-state', 'hi'], false], 1, 0] },
    },
  ];
}
