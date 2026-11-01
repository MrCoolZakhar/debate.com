// Gavelling Crisis: ready sets of resource types ("templates") the Crisis Director can add to a cabinet, or to every cabinet, with
// sensible units and starting amounts. Staff see every line first, untick what they do not want and change the amounts before
// anything is made. Plain data: the screen is resources/ResourceTemplates.tsx, the writes are resources/resourceApi.ts.

export type TemplateScope = 'cabinet' | 'character';

export interface TemplateLine {
  /** The resource type's name. A type that already exists by this name (any capitals) is reused, never made twice. */
  name: string;
  /** What it is counted in (at most 20 characters). */
  unit: string;
  /** The starting amount for each cabinet (or, for a per-character line, for each character). */
  amount: number;
  scope: TemplateScope;
}

export interface ResourceTemplate {
  id: string;
  name: string;
  blurb: string;
  lines: TemplateLine[];
}

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    id: 'military',
    name: 'Military',
    blurb: 'What a cabinet can fight with.',
    lines: [
      { name: 'Troops', unit: 'thousand troops', amount: 200, scope: 'cabinet' },
      { name: 'Aircraft', unit: 'aircraft', amount: 150, scope: 'cabinet' },
      { name: 'Warships', unit: 'ships', amount: 25, scope: 'cabinet' },
      { name: 'Nuclear warheads', unit: 'warheads', amount: 10, scope: 'cabinet' },
    ],
  },
  {
    id: 'economy',
    name: 'Economy',
    blurb: 'Money in the bank and money coming in.',
    lines: [
      { name: 'Budget', unit: '$m', amount: 5000, scope: 'cabinet' },
      { name: 'Oil reserves', unit: 'million barrels', amount: 120, scope: 'cabinet' },
      { name: 'Trade income', unit: '$m per month', amount: 400, scope: 'cabinet' },
    ],
  },
  {
    id: 'politics',
    name: 'Politics',
    blurb: 'Standing at home and friends abroad.',
    lines: [
      { name: 'Public approval', unit: '%', amount: 60, scope: 'cabinet' },
      { name: 'Political capital', unit: 'points', amount: 10, scope: 'character' },
      { name: 'Allies', unit: 'allies', amount: 3, scope: 'cabinet' },
    ],
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    blurb: 'Eyes and ears.',
    lines: [
      { name: 'Agents', unit: 'agents', amount: 30, scope: 'cabinet' },
      { name: 'Informants', unit: 'informants', amount: 5, scope: 'character' },
      { name: 'Surveillance', unit: '% coverage', amount: 40, scope: 'cabinet' },
    ],
  },
  {
    id: 'cold-war-1962',
    name: 'Cold War 1962',
    blurb: 'A mix that fits the Cuban missile crisis.',
    lines: [
      { name: 'Nuclear missiles', unit: 'missiles', amount: 30, scope: 'cabinet' },
      { name: 'Conventional troops', unit: 'thousand troops', amount: 400, scope: 'cabinet' },
      { name: 'Warships', unit: 'ships', amount: 20, scope: 'cabinet' },
      { name: 'Aircraft', unit: 'aircraft', amount: 200, scope: 'cabinet' },
      { name: 'Public approval', unit: '%', amount: 60, scope: 'cabinet' },
      { name: 'Allied support', unit: '%', amount: 50, scope: 'cabinet' },
      { name: 'Intelligence agents', unit: 'agents', amount: 40, scope: 'cabinet' },
      { name: 'Budget', unit: '$bn', amount: 30, scope: 'cabinet' },
      { name: 'Oil reserves', unit: 'million barrels', amount: 100, scope: 'cabinet' },
    ],
  },
];
