/**
 * Map focus: which relief map to show for a place, and where to crop it.
 *
 * Pure data and maths, no React. Used by the paid announcement audience cards
 * (`manage/[slug]/communications/AnnounceView.tsx`) to draw a small strip of
 * a relief map zoomed on the conference's country or city.
 *
 * The pictures are web copies of the relief maps in `public/map/*.png`
 * (2560 x 1429), made with sips into `public/marketing/` (continents 1600 x 893,
 * the world 1000 x 558, JPEG quality 78). They are artistic
 * relief maps, not true projections (the Europe map is drawn in perspective),
 * so each one is CALIBRATED from landmarks read off the image itself (21 Oct
 * 2026): every landmark is [longitude, latitude, x, y] with x and y in pixels
 * of a 1280 x 714 copy of the map. A place is projected with the least-squares
 * affine fit of its map's landmarks on (longitude, Mercator latitude), plus a
 * Gaussian-weighted share of the nearby landmarks' own errors, so the coast
 * next to a landmark lands where the picture draws it. Typical error after
 * that: under 10 px of 1280 near landmarks, about 20 px far from them.
 *
 * A view is `{ src, aspect, x, y, zoom }`: centre the point (x, y) of the
 * image (fractions 0..1) in the strip, with the image `zoom` times the strip's
 * width (1 = the whole map across the strip). The strip clamps the crop so it
 * never shows past the picture's edge.
 */

import { countryToContinent, getCountryByCode, getCountryByName, fold, type Continent } from '@/lib/countries';

export type MapView = { src: string; aspect: number; x: number; y: number; zoom: number };

type MapKey = Continent | 'World';
type Landmark = readonly [lng: number, lat: number, x: number, y: number];

/** Landmark pixels are read on a 1280 x 714 copy of every map. */
const CAL_W = 1280;
const CAL_H = 714;
/** Every map is 2560 x 1429, so every web copy has this aspect ratio. */
const MAP_ASPECT = 2560 / 1429;

const MAPS: Record<MapKey, { src: string; wrapLng?: boolean; landmarks: readonly Landmark[] }> = {
  World: {
    src: '/marketing/world-map.jpg',
    landmarks: [
      [-80.9, 25.1, 347, 287], [-109.9, 22.9, 250, 295], [-18.6, 64.9, 567, 118], [-43.9, 59.8, 475, 140],
      [-123.4, 48.4, 190, 182], [29.0, 41.1, 740, 225], [129.0, 35.1, 1090, 235], [156.7, 51.2, 1200, 160],
      [20.0, -34.8, 709, 525], [-67.3, -55.9, 390, 615], [-35.2, -5.8, 510, 412], [142.5, -10.7, 1144, 442],
      [147.0, -43.6, 1162, 562], [51.3, 11.8, 817, 341],
    ],
  },
  Europe: {
    src: '/marketing/europe-map.jpg',
    landmarks: [
      [-0.1, 51.5, 505, 375], [-5.7, 50.07, 427, 417], [10.6, 57.7, 645, 277], [-4.5, 48.4, 442, 445],
      [-9.8, 51.45, 362, 390], [-3.2, 58.6, 460, 268], [14.9, 55.1, 717, 322], [-5.6, 36.0, 420, 670],
      [-9.1, 38.7, 375, 632], [3.3, 42.3, 545, 552], [15.6, 38.2, 737, 637], [18.5, 40.1, 770, 597],
      [12.4, 37.8, 685, 640], [12.3, 45.4, 685, 505], [8.9, 44.4, 645, 515], [9.4, 43.0, 640, 550],
      [23.7, 37.97, 840, 640], [29.0, 41.1, 905, 582], [24.2, 65.8, 855, 125], [30.3, 59.9, 975, 220],
      [18.1, 59.3, 785, 225], [18.5, 57.5, 775, 280],
    ],
  },
  Asia: {
    src: '/marketing/asia-map.jpg',
    landmarks: [
      [29.0, 41.1, 102, 300], [33.4, 35.1, 150, 345], [32.55, 29.97, 140, 390], [56.3, 26.6, 325, 412],
      [48.6, 29.9, 265, 385], [43.3, 12.6, 227, 520], [51.5, 36.6, 290, 335], [120.85, 21.9, 817, 450],
      [129.0, 35.1, 875, 347], [121.5, 31.2, 822, 377], [139.7, 35.7, 962, 345], [141.9, 45.5, 977, 277],
      [130.7, 31.0, 887, 372], [117.7, 39.0, 795, 312], [109.7, 19.2, 732, 470], [77.5, 8.08, 490, 555],
      [80.7, 7.9, 512, 562], [103.8, 1.3, 687, 607], [104.7, 8.6, 700, 550], [100.5, 13.75, 670, 509],
      [121.0, 14.6, 815, 512], [114.2, 22.3, 780, 447],
    ],
  },
  Africa: {
    src: '/marketing/africa-map.jpg',
    landmarks: [
      [-17.5, 14.7, 361, 223], [31.0, 31.5, 788, 71], [32.55, 29.97, 800, 86], [43.3, 12.6, 895, 240],
      [51.3, 11.8, 965, 250], [56.3, 26.6, 1017, 116], [3.4, 6.45, 563, 306], [-7.7, 4.4, 471, 312],
      [33.0, -1.0, 803, 365], [18.47, -34.36, 678, 656], [20.0, -34.8, 696, 659], [31.0, -29.9, 797, 609],
      [32.6, -25.97, 815, 570], [45.1, -25.6, 910, 579], [49.3, -12.0, 952, 466], [13.2, -8.8, 625, 442],
      [34.5, -12.0, 815, 466], [29.5, -6.0, 773, 413],
    ],
  },
  'North America': {
    src: '/marketing/north-america-map.jpg',
    landmarks: [
      [-84.5, 45.0, 595, 240], [-80.0, 51.5, 652, 123], [-70.0, 41.7, 757, 250], [-63.6, 44.65, 863, 190],
      [-52.7, 47.56, 937, 186], [-124.4, 40.4, 184, 232], [-122.4, 37.8, 191, 271], [-117.1, 32.7, 227, 335],
      [-109.9, 22.9, 340, 490], [-80.9, 25.1, 649, 462], [-89.2, 29.0, 544, 409], [-86.8, 21.2, 579, 511],
      [-82.4, 23.1, 635, 493], [-69.9, 18.5, 783, 550], [-79.6, 9.0, 649, 666], [-99.9, 16.85, 459, 571],
      [-105.2, 20.6, 393, 550],
    ],
  },
  'South America': {
    src: '/marketing/south-america-map.jpg',
    landmarks: [
      [-71.7, 12.4, 208, 17], [-35.2, -5.8, 552, 188], [-34.9, -8.05, 549, 211], [-38.5, -12.97, 524, 245],
      [-81.3, -4.68, 119, 162], [-79.9, -2.2, 130, 139], [-77.0, -12.05, 157, 198], [-43.2, -22.9, 503, 316],
      [-58.4, -34.6, 332, 454], [-71.6, -33.0, 216, 444], [-67.3, -55.9, 258, 663], [-63.6, -42.5, 284, 539],
      [-57.85, -51.7, 338, 632], [-73.9, -42.6, 199, 541],
    ],
  },
  Oceania: {
    src: '/marketing/oceania-map.jpg',
    // The Pacific map runs across the date line: west longitudes are read as 180..360.
    wrapLng: true,
    landmarks: [
      [142.5, -10.7, 307, 338], [115.1, -34.4, 73, 537], [115.86, -31.95, 76, 515], [153.6, -28.6, 400, 470],
      [151.2, -33.87, 388, 523], [146.4, -39.1, 337, 578], [146.9, -43.6, 343, 625], [140.8, -17.5, 287, 394],
      [130.84, -12.46, 219, 352], [174.76, -36.85, 588, 560], [174.8, -41.3, 585, 599], [172.6, -43.5, 557, 627],
      [147.2, -9.44, 332, 312], [166.45, -22.27, 515, 431], [178.4, -18.1, 613, 394], [138.6, -34.9, 264, 543],
    ],
  },
};

const CONTINENT_ORDER: Continent[] = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];

/* ─────────────────────────── Projection ─────────────────────────── */

function mercator(lat: number): number {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + r / 2)) * 180) / Math.PI;
}

/** Least squares of value ~ a*u + b*v + c over the rows (3 x 3 normal equations, Cramer). */
function fitPlane(rows: { u: number; v: number; t: number }[]): [number, number, number] {
  let suu = 0, suv = 0, su = 0, svv = 0, sv = 0, n = 0, sut = 0, svt = 0, st = 0;
  for (const { u, v, t } of rows) {
    suu += u * u; suv += u * v; su += u; svv += v * v; sv += v; n += 1;
    sut += u * t; svt += v * t; st += t;
  }
  const det3 = (m: number[]) =>
    m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const M = [suu, suv, su, suv, svv, sv, su, sv, n];
  const d = det3(M);
  const a = det3([sut, suv, su, svt, svv, sv, st, sv, n]) / d;
  const b = det3([suu, sut, su, suv, svt, sv, su, st, n]) / d;
  const c = det3([suu, suv, sut, suv, svv, svt, su, sv, st]) / d;
  return [a, b, c];
}

type Projector = {
  /** Image fractions of a place, before clamping. */
  project: (lat: number, lng: number) => { x: number; y: number };
  /** Image widths per degree of longitude (for turning a span into a zoom). */
  perDegree: number;
};

const projectors = new Map<MapKey, Projector>();

function projector(key: MapKey): Projector {
  const hit = projectors.get(key);
  if (hit) return hit;
  const map = MAPS[key];
  const lngOf = (lng: number) => (map.wrapLng && lng < 0 ? lng + 360 : lng);
  const pts = map.landmarks.map(([lng, lat, px, py]) => ({ u: lngOf(lng), v: mercator(lat), x: px / CAL_W, y: py / CAL_H }));
  const fx = fitPlane(pts.map(p => ({ u: p.u, v: p.v, t: p.x })));
  const fy = fitPlane(pts.map(p => ({ u: p.u, v: p.v, t: p.y })));
  const affine = (u: number, v: number) => ({ x: fx[0] * u + fx[1] * v + fx[2], y: fy[0] * u + fy[1] * v + fy[2] });
  // Each landmark's own error, shared out to nearby places (sigma about 75 px of 1280).
  const errs = pts.map(p => { const a = affine(p.u, p.v); return { x: a.x, y: a.y, dx: p.x - a.x, dy: p.y - a.y }; });
  const SIGMA = 0.06;
  const DAMP = 0.15;
  const p: Projector = {
    perDegree: Math.abs(fx[0]),
    project(lat, lng) {
      const a = affine(lngOf(lng), mercator(lat));
      let wSum = 0, cx = 0, cy = 0;
      for (const e of errs) {
        const ddx = a.x - e.x;
        const ddy = (a.y - e.y) / MAP_ASPECT; // compare distances in width units
        const w = Math.exp(-(ddx * ddx + ddy * ddy) / (SIGMA * SIGMA));
        wSum += w; cx += w * e.dx; cy += w * e.dy;
      }
      return { x: a.x + cx / (wSum + DAMP), y: a.y + cy / (wSum + DAMP) };
    },
  };
  projectors.set(key, p);
  return p;
}

/* ─────────────────────────── Places ─────────────────────────── */

/**
 * Approximate centroids [lat, lng] by ISO 3166-1 alpha-2 code (every code in
 * UN_COUNTRIES, plus HK and MO). Canada is centred on its populated south so
 * it lands on the North America map.
 */
export const COUNTRY_CENTROIDS: Record<string, readonly [number, number]> = {
  AF: [33.9, 67.7], AL: [41.15, 20.17], DZ: [28.0, 2.6], AD: [42.55, 1.6], AO: [-11.2, 17.9], AG: [17.1, -61.8],
  AR: [-35.4, -65.2], AM: [40.07, 45.04], AU: [-25.3, 133.8], AT: [47.5, 14.55], AZ: [40.14, 47.58], BS: [24.25, -76.0],
  BH: [26.07, 50.56], BD: [23.68, 90.36], BB: [13.19, -59.54], BY: [53.71, 27.95], BE: [50.5, 4.47], BZ: [17.19, -88.5],
  BJ: [9.31, 2.32], BT: [27.51, 90.43], BO: [-16.29, -63.59], BA: [43.92, 17.68], BW: [-22.33, 24.68], BR: [-10.8, -52.9],
  BN: [4.54, 114.73], BG: [42.73, 25.49], BF: [12.24, -1.56], BI: [-3.37, 29.92], CV: [16.0, -24.01], KH: [12.57, 104.99],
  CM: [5.69, 12.35], CA: [51.0, -95.0], CF: [6.61, 20.94], TD: [15.45, 18.73], CL: [-35.7, -71.5], CN: [35.0, 104.2],
  CO: [4.1, -72.9], KM: [-11.88, 43.87], CG: [-0.66, 14.93], CK: [-21.24, -159.78], CR: [9.75, -83.75], CI: [7.54, -5.55],
  HR: [45.1, 15.2], CU: [21.52, -77.78], CY: [35.13, 33.43], CZ: [49.82, 15.47], CD: [-2.9, 23.66], DK: [56.26, 9.5],
  DJ: [11.83, 42.59], DM: [15.41, -61.37], DO: [18.74, -70.16], EC: [-1.83, -78.18], EG: [26.82, 30.8], SV: [13.79, -88.9],
  GQ: [1.65, 10.27], ER: [15.18, 39.78], EE: [58.6, 25.01], SZ: [-26.52, 31.47], ET: [9.15, 40.49], FJ: [-17.71, 178.07],
  FI: [61.92, 25.75], FR: [46.6, 2.2], GA: [-0.8, 11.61], GM: [13.44, -15.31], GE: [42.32, 43.36], DE: [51.17, 10.45],
  GH: [7.95, -1.02], GR: [39.07, 21.82], GD: [12.12, -61.68], GT: [15.78, -90.23], GN: [9.95, -9.7], GW: [11.8, -15.18],
  GY: [4.86, -58.93], HT: [18.97, -72.29], VA: [41.9, 12.45], HN: [15.2, -86.24], HU: [47.16, 19.5], IS: [64.96, -19.02],
  IN: [22.0, 79.0], ID: [-2.5, 117.9], IR: [32.43, 53.69], IQ: [33.22, 43.68], IE: [53.41, -8.24], IL: [31.05, 34.85],
  IT: [42.8, 12.6], JM: [18.11, -77.3], JP: [36.2, 138.25], JO: [30.59, 36.24], KZ: [48.02, 66.92], KE: [0.02, 37.91],
  KI: [1.87, -157.36], XK: [42.6, 20.9], KW: [29.31, 47.48], KG: [41.2, 74.77], LA: [19.86, 102.5], LV: [56.88, 24.6],
  LB: [33.85, 35.86], LS: [-29.61, 28.23], LR: [6.43, -9.43], LY: [26.34, 17.23], LI: [47.17, 9.56], LT: [55.17, 23.88],
  LU: [49.82, 6.13], MG: [-18.77, 46.87], MW: [-13.25, 34.3], MY: [4.21, 101.98], MV: [3.2, 73.22], ML: [17.57, -4.0],
  MT: [35.94, 14.38], MH: [7.13, 171.18], MR: [21.0, -10.94], MU: [-20.35, 57.55], MX: [23.63, -102.55], FM: [7.43, 150.55],
  MD: [47.41, 28.37], MC: [43.74, 7.42], MN: [46.86, 103.85], ME: [42.71, 19.37], MA: [31.79, -7.09], MZ: [-18.67, 35.53],
  MM: [21.91, 95.96], NA: [-22.96, 18.49], NR: [-0.52, 166.93], NP: [28.39, 84.12], NL: [52.13, 5.29], NZ: [-41.0, 174.0],
  NI: [12.87, -85.21], NE: [17.61, 8.08], NG: [9.08, 8.68], NU: [-19.05, -169.87], KP: [40.34, 127.51], MK: [41.61, 21.75],
  NO: [61.5, 8.5], OM: [21.51, 55.92], PK: [30.38, 69.35], PW: [7.51, 134.58], PS: [31.95, 35.23], PA: [8.54, -80.78],
  PG: [-6.31, 143.96], PY: [-23.44, -58.44], PE: [-9.19, -75.02], PH: [12.88, 121.77], PL: [51.92, 19.15], PT: [39.7, -8.0],
  QA: [25.35, 51.18], RO: [45.94, 24.97], RU: [61.52, 105.32], RW: [-1.94, 29.87], KN: [17.36, -62.78], LC: [13.91, -60.98],
  VC: [12.98, -61.29], WS: [-13.76, -172.1], SM: [43.94, 12.46], SA: [23.89, 45.08], SN: [14.5, -14.45], RS: [44.02, 21.01],
  SC: [-4.68, 55.49], SL: [8.46, -11.78], SG: [1.35, 103.82], SK: [48.67, 19.7], SI: [46.15, 14.99], SB: [-9.65, 160.16],
  SO: [5.15, 46.2], ZA: [-30.56, 22.94], KR: [35.91, 127.77], SS: [6.88, 31.31], ES: [40.2, -3.7], LK: [7.87, 80.77],
  SD: [12.86, 30.22], SR: [3.92, -56.03], SE: [62.0, 15.0], CH: [46.82, 8.23], SY: [34.8, 38.99], ST: [0.19, 6.61],
  TW: [23.7, 120.96], TJ: [38.86, 71.28], TZ: [-6.37, 34.89], TH: [15.87, 100.99], TL: [-8.87, 125.73], TG: [8.62, 0.82],
  TO: [-21.18, -175.2], TT: [10.69, -61.22], TN: [33.89, 9.54], TR: [38.96, 35.24], TM: [38.97, 59.56], TV: [-7.11, 177.65],
  UG: [1.37, 32.29], UA: [48.38, 31.17], AE: [23.42, 53.85], GB: [54.0, -2.5], US: [39.8, -98.6], UY: [-32.52, -55.77],
  UZ: [41.38, 64.59], VU: [-15.38, 166.96], VE: [6.42, -66.59], VN: [14.06, 108.28], YE: [15.55, 48.52], ZM: [-13.13, 27.85],
  ZW: [-19.02, 29.15], EU: [50.0, 10.0], HK: [22.35, 114.15], MO: [22.2, 113.55],
};

/** Big countries are shown wider, tiny ones closer. */
const HUGE = new Set(['RU', 'CA', 'US', 'CN', 'BR', 'AU', 'KZ', 'EU']);
const LARGE = new Set(['IN', 'AR', 'DZ', 'CD', 'SA', 'MX', 'ID', 'SD', 'LY', 'IR', 'MN', 'PE', 'TD', 'NE', 'AO', 'ML', 'ZA', 'CO', 'ET', 'BO', 'MR', 'EG', 'TZ', 'NG', 'VE', 'CL', 'PK', 'NA', 'MZ', 'TR', 'SE', 'NO']);
const TINY = new Set([
  'SG', 'HK', 'MO', 'BH', 'MT', 'LU', 'AD', 'MC', 'LI', 'SM', 'VA', 'MV', 'QA', 'BN', 'CY', 'LB', 'PS', 'TT', 'MU', 'KM', 'ST',
  'SC', 'CV', 'BB', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC', 'TO', 'WS', 'NR', 'TV', 'PW', 'MH', 'KI', 'FM', 'NU', 'CK', 'XK',
  'ME', 'KW', 'IL', 'SV', 'GM', 'DJ', 'RW', 'BI', 'SI', 'TL', 'JM', 'BS', 'BE', 'NL', 'CH', 'DK', 'EE', 'LV', 'MK', 'AL', 'AM', 'BT', 'SZ', 'LS',
]);

/**
 * Common Model UN host cities, [lat, lng, ISO code], keyed on the folded name.
 * Aliases point at the same coordinates.
 */
const CITIES: Record<string, readonly [number, number, string]> = {
  london: [51.51, -0.13, 'GB'], oxford: [51.75, -1.26, 'GB'], cambridge: [52.21, 0.12, 'GB'], manchester: [53.48, -2.24, 'GB'],
  edinburgh: [55.95, -3.19, 'GB'], birmingham: [52.49, -1.89, 'GB'], dublin: [53.35, -6.26, 'IE'],
  paris: [48.86, 2.35, 'FR'], lyon: [45.76, 4.84, 'FR'], madrid: [40.42, -3.7, 'ES'], barcelona: [41.39, 2.17, 'ES'],
  valencia: [39.47, -0.38, 'ES'], seville: [37.39, -5.98, 'ES'], lisbon: [38.72, -9.14, 'PT'], porto: [41.15, -8.61, 'PT'],
  rome: [41.9, 12.5, 'IT'], milan: [45.46, 9.19, 'IT'], florence: [43.77, 11.26, 'IT'], turin: [45.07, 7.69, 'IT'],
  berlin: [52.52, 13.4, 'DE'], munich: [48.14, 11.58, 'DE'], hamburg: [53.55, 9.99, 'DE'], frankfurt: [50.11, 8.68, 'DE'],
  'the hague': [52.08, 4.3, 'NL'], amsterdam: [52.37, 4.9, 'NL'], rotterdam: [51.92, 4.48, 'NL'], leiden: [52.16, 4.49, 'NL'],
  maastricht: [50.85, 5.69, 'NL'], brussels: [50.85, 4.35, 'BE'], luxembourg: [49.61, 6.13, 'LU'],
  geneva: [46.2, 6.14, 'CH'], zurich: [47.38, 8.54, 'CH'], vienna: [48.21, 16.37, 'AT'], prague: [50.08, 14.44, 'CZ'],
  warsaw: [52.23, 21.01, 'PL'], krakow: [50.06, 19.94, 'PL'], budapest: [47.5, 19.04, 'HU'], bratislava: [48.15, 17.11, 'SK'],
  bucharest: [44.43, 26.1, 'RO'], sofia: [42.7, 23.32, 'BG'], belgrade: [44.79, 20.45, 'RS'], zagreb: [45.81, 15.98, 'HR'],
  ljubljana: [46.06, 14.51, 'SI'], athens: [37.98, 23.73, 'GR'], thessaloniki: [40.64, 22.94, 'GR'],
  copenhagen: [55.68, 12.57, 'DK'], stockholm: [59.33, 18.07, 'SE'], oslo: [59.91, 10.75, 'NO'], helsinki: [60.17, 24.94, 'FI'],
  tallinn: [59.44, 24.75, 'EE'], riga: [56.95, 24.11, 'LV'], vilnius: [54.69, 25.28, 'LT'], kyiv: [50.45, 30.52, 'UA'],
  moscow: [55.76, 37.62, 'RU'], 'saint petersburg': [59.94, 30.31, 'RU'], istanbul: [41.01, 28.98, 'TR'], ankara: [39.93, 32.86, 'TR'],
  izmir: [38.42, 27.14, 'TR'], valletta: [35.9, 14.51, 'MT'], nicosia: [35.19, 33.38, 'CY'], tbilisi: [41.72, 44.79, 'GE'],
  baku: [40.41, 49.87, 'AZ'], yerevan: [40.18, 44.51, 'AM'],
  dubai: [25.2, 55.27, 'AE'], 'abu dhabi': [24.45, 54.38, 'AE'], doha: [25.29, 51.53, 'QA'], riyadh: [24.71, 46.68, 'SA'],
  jeddah: [21.49, 39.19, 'SA'], manama: [26.23, 50.59, 'BH'], 'kuwait city': [29.38, 47.99, 'KW'], muscat: [23.59, 58.41, 'OM'],
  amman: [31.95, 35.93, 'JO'], beirut: [33.89, 35.5, 'LB'], 'tel aviv': [32.09, 34.78, 'IL'], jerusalem: [31.77, 35.21, 'IL'],
  tehran: [35.69, 51.39, 'IR'], karachi: [24.86, 67.0, 'PK'], lahore: [31.55, 74.34, 'PK'], islamabad: [33.68, 73.05, 'PK'],
  mumbai: [19.08, 72.88, 'IN'], delhi: [28.61, 77.21, 'IN'], bangalore: [12.97, 77.59, 'IN'], chennai: [13.08, 80.27, 'IN'],
  kolkata: [22.57, 88.36, 'IN'], hyderabad: [17.39, 78.49, 'IN'], pune: [18.52, 73.86, 'IN'], ahmedabad: [23.02, 72.57, 'IN'],
  jaipur: [26.91, 75.79, 'IN'], dhaka: [23.81, 90.41, 'BD'], kathmandu: [27.72, 85.32, 'NP'], colombo: [6.93, 79.86, 'LK'],
  beijing: [39.9, 116.4, 'CN'], shanghai: [31.23, 121.47, 'CN'], shenzhen: [22.54, 114.06, 'CN'], guangzhou: [23.13, 113.26, 'CN'],
  chengdu: [30.57, 104.07, 'CN'], nanjing: [32.06, 118.8, 'CN'], hangzhou: [30.27, 120.16, 'CN'], 'hong kong': [22.32, 114.17, 'HK'],
  macau: [22.2, 113.54, 'MO'], taipei: [25.03, 121.57, 'TW'], seoul: [37.57, 126.98, 'KR'], busan: [35.18, 129.08, 'KR'],
  tokyo: [35.68, 139.69, 'JP'], osaka: [34.69, 135.5, 'JP'], kyoto: [35.01, 135.77, 'JP'], ulaanbaatar: [47.89, 106.91, 'MN'],
  singapore: [1.35, 103.82, 'SG'], 'kuala lumpur': [3.14, 101.69, 'MY'], penang: [5.41, 100.33, 'MY'], jakarta: [-6.21, 106.85, 'ID'],
  bali: [-8.65, 115.22, 'ID'], manila: [14.6, 120.98, 'PH'], bangkok: [13.76, 100.5, 'TH'], 'ho chi minh city': [10.82, 106.63, 'VN'],
  hanoi: [21.03, 105.85, 'VN'], 'phnom penh': [11.56, 104.93, 'KH'], yangon: [16.84, 96.17, 'MM'], almaty: [43.24, 76.89, 'KZ'],
  astana: [51.17, 71.45, 'KZ'], tashkent: [41.3, 69.24, 'UZ'],
  sydney: [-33.87, 151.21, 'AU'], melbourne: [-37.81, 144.96, 'AU'], brisbane: [-27.47, 153.03, 'AU'], perth: [-31.95, 115.86, 'AU'],
  adelaide: [-34.93, 138.6, 'AU'], canberra: [-35.28, 149.13, 'AU'], auckland: [-36.85, 174.76, 'NZ'], wellington: [-41.29, 174.78, 'NZ'],
  'new york': [40.71, -74.01, 'US'], 'washington': [38.91, -77.04, 'US'], boston: [42.36, -71.06, 'US'], philadelphia: [39.95, -75.17, 'US'],
  chicago: [41.88, -87.63, 'US'], 'los angeles': [34.05, -118.24, 'US'], 'san francisco': [37.77, -122.42, 'US'], seattle: [47.61, -122.33, 'US'],
  miami: [25.76, -80.19, 'US'], atlanta: [33.75, -84.39, 'US'], houston: [29.76, -95.37, 'US'], dallas: [32.78, -96.8, 'US'],
  austin: [30.27, -97.74, 'US'], 'new haven': [41.31, -72.92, 'US'], 'ann arbor': [42.28, -83.74, 'US'], berkeley: [37.87, -122.27, 'US'],
  toronto: [43.65, -79.38, 'CA'], montreal: [45.5, -73.57, 'CA'], vancouver: [49.28, -123.12, 'CA'], ottawa: [45.42, -75.7, 'CA'],
  'mexico city': [19.43, -99.13, 'MX'], monterrey: [25.69, -100.32, 'MX'], guadalajara: [20.66, -103.35, 'MX'], havana: [23.11, -82.37, 'CU'],
  'panama city': [8.98, -79.52, 'PA'], 'san jose': [9.93, -84.08, 'CR'], 'guatemala city': [14.63, -90.51, 'GT'],
  'santo domingo': [18.49, -69.93, 'DO'], 'san juan': [18.47, -66.11, 'US'], kingston: [17.97, -76.79, 'JM'],
  bogota: [4.71, -74.07, 'CO'], medellin: [6.24, -75.58, 'CO'], cali: [3.45, -76.53, 'CO'], caracas: [10.48, -66.9, 'VE'],
  quito: [-0.18, -78.47, 'EC'], guayaquil: [-2.17, -79.92, 'EC'], lima: [-12.05, -77.04, 'PE'], 'la paz': [-16.5, -68.15, 'BO'],
  santiago: [-33.45, -70.67, 'CL'], 'buenos aires': [-34.6, -58.38, 'AR'], cordoba: [-31.42, -64.18, 'AR'], montevideo: [-34.9, -56.16, 'UY'],
  asuncion: [-25.26, -57.58, 'PY'], 'sao paulo': [-23.55, -46.63, 'BR'], 'rio de janeiro': [-22.91, -43.17, 'BR'], brasilia: [-15.79, -47.88, 'BR'],
  'belo horizonte': [-19.92, -43.94, 'BR'], 'porto alegre': [-30.03, -51.23, 'BR'], curitiba: [-25.43, -49.27, 'BR'], recife: [-8.05, -34.88, 'BR'],
  lagos: [6.52, 3.38, 'NG'], abuja: [9.08, 7.4, 'NG'], accra: [5.6, -0.19, 'GH'], dakar: [14.72, -17.47, 'SN'], abidjan: [5.36, -4.01, 'CI'],
  nairobi: [-1.29, 36.82, 'KE'], kampala: [0.35, 32.58, 'UG'], kigali: [-1.95, 30.06, 'RW'], 'addis ababa': [9.03, 38.74, 'ET'],
  'dar es salaam': [-6.79, 39.21, 'TZ'], cairo: [30.04, 31.24, 'EG'], alexandria: [31.2, 29.92, 'EG'], tunis: [36.81, 10.18, 'TN'],
  casablanca: [33.57, -7.59, 'MA'], rabat: [34.02, -6.84, 'MA'], marrakech: [31.63, -8.01, 'MA'], algiers: [36.75, 3.06, 'DZ'],
  johannesburg: [-26.2, 28.05, 'ZA'], 'cape town': [-33.92, 18.42, 'ZA'], pretoria: [-25.75, 28.19, 'ZA'], durban: [-29.86, 31.02, 'ZA'],
  harare: [-17.83, 31.05, 'ZW'], lusaka: [-15.39, 28.32, 'ZM'], gaborone: [-24.63, 25.92, 'BW'], windhoek: [-22.56, 17.07, 'NA'],
  kinshasa: [-4.44, 15.27, 'CD'], luanda: [-8.84, 13.23, 'AO'], 'port louis': [-20.16, 57.5, 'MU'],
};

const CITY_ALIASES: Record<string, string> = {
  'new york city': 'new york', nyc: 'new york', manhattan: 'new york', 'washington dc': 'washington', 'washington d.c.': 'washington',
  'washington, d.c.': 'washington', dc: 'washington', 'den haag': 'the hague', 'la haye': 'the hague', hague: 'the hague',
  geneve: 'geneva', genf: 'geneva', wien: 'vienna', praha: 'prague', warszawa: 'warsaw', cracow: 'krakow', roma: 'rome',
  milano: 'milan', firenze: 'florence', torino: 'turin', munchen: 'munich', lisboa: 'lisbon', bruxelles: 'brussels', brussel: 'brussels',
  kobenhavn: 'copenhagen', athina: 'athens', kiev: 'kyiv', 'st petersburg': 'saint petersburg', 'st. petersburg': 'saint petersburg',
  constantinople: 'istanbul', bombay: 'mumbai', 'new delhi': 'delhi', bengaluru: 'bangalore', madras: 'chennai', calcutta: 'kolkata',
  peking: 'beijing', 'hong kong sar': 'hong kong', macao: 'macau', saigon: 'ho chi minh city', 'ho chi minh': 'ho chi minh city',
  'kuala lumpur city': 'kuala lumpur', kl: 'kuala lumpur', 'mexico df': 'mexico city', cdmx: 'mexico city', 'ciudad de mexico': 'mexico city',
  'santa fe de bogota': 'bogota', 'santiago de chile': 'santiago', 'rio': 'rio de janeiro', 'sp': 'sao paulo', 'la': 'los angeles',
  'sf': 'san francisco', 'al qahirah': 'cairo', joburg: 'johannesburg', 'tel aviv-yafo': 'tel aviv', 'kuwait': 'kuwait city',
  'panama': 'panama city', 'guatemala': 'guatemala city', 'mexico': 'mexico city', 'singapore city': 'singapore',
};

function cityKey(name: string): string {
  return fold(name).replace(/\s+/g, ' ').trim();
}

/** A city's coordinates, by name or a common alias; tries the part before a comma too ("London, UK"). */
export function cityCoordinates(name: string | null | undefined): { lat: number; lng: number; code: string } | null {
  if (!name?.trim()) return null;
  const tries = [cityKey(name), cityKey(name.split(',')[0] ?? ''), cityKey(name.replace(/^(city of|ciudad de)\s+/i, ''))];
  for (const t of tries) {
    if (!t) continue;
    const key = CITIES[t] ? t : CITY_ALIASES[t];
    const hit = key ? CITIES[key] : undefined;
    if (hit) return { lat: hit[0], lng: hit[1], code: hit[2] };
  }
  return null;
}

/** ISO code for a country name or code, including Hong Kong and Macau, which are not in UN_COUNTRIES. */
function countryCode(country: string | null | undefined): string | null {
  const c = country?.trim();
  if (!c) return null;
  if (/^[a-z]{2}$/i.test(c)) {
    const up = c.toUpperCase() === 'UK' ? 'GB' : c.toUpperCase();
    return getCountryByCode(up)?.code ?? (COUNTRY_CENTROIDS[up] ? up : null);
  }
  const byName = getCountryByName(c)?.code;
  if (byName) return byName;
  const city = cityCoordinates(c); // "Hong Kong", "Singapore", "Macau" typed as the country
  return city?.code ?? null;
}

function continentOfCode(code: string | null): Continent | null {
  if (!code) return null;
  if (code === 'HK' || code === 'MO') return 'Asia';
  const c = getCountryByCode(code);
  return c ? countryToContinent(c.name) : null;
}

/* ─────────────────────────── Views ─────────────────────────── */

/** Degrees of longitude across the strip. The city is about twice as close as the country. */
const COUNTRY_SPAN = 28;
const CITY_SPAN = 13;
/** The closest zoom: past this the 1600 px continent copies get soft (the world copy is 1000 px). */
const MAX_ZOOM = 8;
const MAX_WORLD_ZOOM = 3;

function wholeMap(key: MapKey, y = 0.5): MapView {
  return { src: MAPS[key].src, aspect: MAP_ASPECT, x: 0.5, y, zoom: 1 };
}

/** The whole world, a little north of the middle so the strip shows land, not Antarctica. */
export const WORLD_VIEW: MapView = wholeMap('World', 0.44);

/**
 * The view centred on a point: the country's own continent map first, then
 * whichever continent map shows the point nearest its middle, then the world.
 */
function focusView(lat: number, lng: number, span: number, first: Continent | null): MapView {
  const keys: MapKey[] = [...(first ? [first] : []), ...CONTINENT_ORDER.filter(k => k !== first), 'World'];
  const inside = (x: number, y: number, m: number) => x >= m && x <= 1 - m && y >= m && y <= 1 - m;
  let pick: { key: MapKey; x: number; y: number } | null = null;
  for (const margin of [0.08, 0]) {
    for (const key of keys) {
      const { x, y } = projector(key).project(lat, lng);
      if (inside(x, y, margin)) { pick = { key, x, y }; break; }
    }
    if (pick) break;
  }
  if (!pick) return WORLD_VIEW;
  const zoom = Math.max(1, Math.min(pick.key === 'World' ? MAX_WORLD_ZOOM : MAX_ZOOM, 1 / (span * projector(pick.key).perDegree)));
  return { src: MAPS[pick.key].src, aspect: MAP_ASPECT, x: pick.x, y: pick.y, zoom };
}

function sizeFactor(code: string): number {
  if (HUGE.has(code)) return 2.2;
  if (LARGE.has(code)) return 1.4;
  if (TINY.has(code)) return 0.55;
  return 1;
}

/** The country card: a zoom on the country, or its continent (or the world) uncropped when we cannot place it. */
export function countryMapView(country: string | null | undefined): MapView {
  const code = countryCode(country);
  const continent = continentOfCode(code);
  const centre = code ? COUNTRY_CENTROIDS[code] : undefined;
  if (code && centre) return focusView(centre[0], centre[1], COUNTRY_SPAN * sizeFactor(code), continent);
  return continent ? wholeMap(continent) : WORLD_VIEW;
}

/**
 * The city card: a closer zoom on the city; a city we do not know falls back
 * to the country's centre, closer than the country card; an unknown country
 * shows its continent (or the world) uncropped.
 */
export function cityMapView(city: string | null | undefined, country: string | null | undefined): MapView {
  const code = countryCode(country);
  const place = cityCoordinates(city);
  if (place) return focusView(place.lat, place.lng, CITY_SPAN, continentOfCode(code) ?? continentOfCode(place.code));
  const continent = continentOfCode(code);
  const centre = code ? COUNTRY_CENTROIDS[code] : undefined;
  if (code && centre) return focusView(centre[0], centre[1], (COUNTRY_SPAN * sizeFactor(code)) / 2, continent);
  return continent ? wholeMap(continent) : WORLD_VIEW;
}
