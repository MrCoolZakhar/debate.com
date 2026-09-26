// The ambassadors and where they sit on the /about map.
//
// ADDING AN AMBASSADOR: add a row to AMBASSADORS with a `country` that is a
// key of COUNTRY_POINTS below (add the country there first if it is new: the
// capital's latitude and longitude, or the centroid for a country whose capital
// sits on an edge). A country missing from COUNTRY_POINTS is left off the map
// (and logged in development) but still listed.
//
// Every portrait is a pre-framed 480x480 webp: head (chin to top of hair) about
// 45% of the height, eyes on the line 40% from the top, face centred. Frame a
// new photo the same way before adding it; the pin applies no per-photo
// position or zoom. `photo: null` means we have the person but not a picture:
// the pin shows their initials. Adding a photo is swapping the null for a path.

export type Ambassador = {
  name: string;
  country: string;
  initials: string;
  photo: string | null;
};

export const AMBASSADORS: Ambassador[] = [
  { name: 'Santiago Rosas Peña',        country: 'Venezuela',      initials: 'SR', photo: '/ambassador-photos/santiago_ambassador.webp' },
  { name: 'Kyle Wilkinson',             country: 'United Kingdom', initials: 'KW', photo: '/ambassador-photos/kyle_ambassador.webp' },
  { name: 'Celine Nasser',              country: 'United Kingdom', initials: 'CN', photo: '/ambassador-photos/celine_ambassador.webp' },
  { name: 'Daniel O’Neil Ferrero',      country: 'Scotland',       initials: 'DF', photo: '/ambassador-photos/Daniel_ambassador.webp' },
  { name: 'Noelia Alvarez Iglesias',    country: 'Spain',          initials: 'NA', photo: '/ambassador-photos/noelia_ambassador.webp' },
  { name: 'Félix Losada Ottino',        country: 'Spain',          initials: 'FL', photo: '/ambassador-photos/felix_ambassador.webp' },
  { name: 'Luca Formichella',           country: 'Italy',          initials: 'LF', photo: '/ambassador-photos/luca_ambassador.webp' },
  { name: 'Amna Sikandar',              country: 'France',         initials: 'AS', photo: '/ambassador-photos/Amna_ambassador.webp' },
  { name: 'Vlad Gheorghe',              country: 'Romania',        initials: 'VG', photo: '/ambassador-photos/Vlad_ambassador.webp' },
  { name: 'Spencer Lindsay',            country: 'Canada',         initials: 'SL', photo: '/ambassador-photos/spencer_ambassador.webp' },
  { name: 'Armande Loretz',             country: 'France',         initials: 'AL', photo: '/ambassador-photos/armande_ambassador.webp' },
  { name: 'Manuela Trujillo',           country: 'Peru',           initials: 'MT', photo: '/ambassador-photos/manuela_ambassador.webp' },
  { name: 'Valentina Cruz',             country: 'Peru',           initials: 'VC', photo: '/ambassador-photos/valentina_ambassador.webp' },
  { name: 'Paolo Marinuzzi',            country: 'Venezuela',      initials: 'PM', photo: '/ambassador-photos/paolo_ambassador.webp' },
  { name: 'Anna Cocconi',               country: 'Venezuela',      initials: 'AC', photo: '/ambassador-photos/anna_ambassador.webp' },
  { name: 'Farah Lahiani',              country: 'UAE',            initials: 'FH', photo: '/ambassador-photos/farah_ambassador.webp' },
  { name: 'Abdul Rehman',               country: 'Pakistan',       initials: 'AR', photo: '/ambassador-photos/abdulrehman_ambassador.webp' },
  { name: 'Saayoojya Variyath',         country: 'India',          initials: 'SV', photo: '/ambassador-photos/saayoojya_ambassador.webp' },
  { name: 'Sri Harsha Vardhan Pachava', country: 'India',          initials: 'SH', photo: '/ambassador-photos/sriharsha_ambassador.webp' },
  { name: 'Tyler Serano',               country: 'Philippines',    initials: 'TS', photo: '/ambassador-photos/tyler_ambassador.webp' },
  { name: 'Andrew Mailoa',              country: 'Indonesia',      initials: 'AM', photo: '/ambassador-photos/andrew_ambassador.webp' },
  { name: 'Charlito Gunawan',           country: 'Indonesia',      initials: 'CG', photo: '/ambassador-photos/charlito_ambassador.webp' },
  { name: 'Victor Mikusek',             country: 'Hong Kong',      initials: 'VM', photo: '/ambassador-photos/victor_ambassador.webp' },
  { name: 'Alman Ahmad',                country: 'UAE',            initials: 'AA', photo: '/ambassador-photos/alman_ambassador.webp' },
  { name: 'Farhan Arbab',               country: 'Bangladesh',     initials: 'FA', photo: '/ambassador-photos/farhan_ambassador.webp' },
  { name: 'Anushka Arora',              country: 'India',          initials: 'AA', photo: '/ambassador-photos/anushka_ambassador.webp' },
  { name: 'Ridhi Sareen',               country: 'India',          initials: 'RS', photo: '/ambassador-photos/ridhi_ambassador.webp' },
  { name: 'Myesha Soni',                country: 'Thailand',       initials: 'MS', photo: '/ambassador-photos/myesha_ambassador.webp' },
  { name: 'Reem Ghazal',                country: 'France',         initials: 'RG', photo: '/ambassador-photos/reem_ambassador.webp' },
  { name: 'Lealem Tayework',            country: 'Ethiopia',       initials: 'LT', photo: '/ambassador-photos/lealem_ambassador.webp' },
  { name: 'Diego Aldana',               country: 'Honduras',       initials: 'DA', photo: '/ambassador-photos/diego_ambassador.webp' },
  { name: 'Isabella Romero',            country: 'Honduras',       initials: 'IR', photo: '/ambassador-photos/isabella_ambassador.webp' },
  { name: 'El Fatiarrazzy Sena',        country: 'Indonesia',      initials: 'ES', photo: '/ambassador-photos/el_ambassador.webp' },
  { name: 'Hasan Ali Hilaly',           country: 'Pakistan',       initials: 'HH', photo: '/ambassador-photos/hasan_ambassador.webp' },
  { name: 'Eva Dubost',                 country: 'France',         initials: 'ED', photo: '/ambassador-photos/eva_ambassador.webp' },
  { name: 'Sophia Baah',                country: 'United Kingdom', initials: 'SB', photo: '/ambassador-photos/sophia_ambassador.webp' },
  { name: 'Yağmur Akman',               country: 'Türkiye',        initials: 'YA', photo: '/ambassador-photos/yagmur_ambassador.webp' },
  { name: 'Petru-Serban Radulescu',     country: 'Romania',        initials: 'PR', photo: '/ambassador-photos/petru_ambassador.webp' },
  { name: 'Adam Epstein',               country: 'Canada',         initials: 'AE', photo: '/ambassador-photos/adam_ambassador.webp' },
  { name: 'Marsia Qurku',               country: 'Albania',        initials: 'MQ', photo: '/ambassador-photos/marsia_ambassador.webp' },
  { name: 'Ahmet Mert Çıragöz',         country: 'Türkiye',        initials: 'AÇ', photo: '/ambassador-photos/ahmet_ambassador.webp' },
  { name: 'Jan Beblavy',                country: 'Slovakia',       initials: 'JB', photo: '/ambassador-photos/jan_ambassador.webp' },
  { name: 'Sarth Agrawal',              country: 'Jordan',         initials: 'SA', photo: '/ambassador-photos/sarth_ambassador.webp' },
  { name: 'Nadia Seranity',             country: 'Sri Lanka',      initials: 'NS', photo: '/ambassador-photos/nadia_ambassador.webp' },
  { name: 'Qais Soub',                  country: 'Jordan',         initials: 'QS', photo: null },
  { name: 'Arun Kaloo',                 country: 'Malaysia',       initials: 'AK', photo: '/ambassador-photos/arun_ambassador.webp' },
  { name: 'Nolan Taarea',               country: 'United States',  initials: 'NT', photo: '/ambassador-photos/nolan_ambassador.webp' },
  { name: 'Alejandro Ospina Gil',       country: 'Colombia',       initials: 'AO', photo: '/ambassador-photos/alejandro_ambassador.webp' },
];

/** [latitude, longitude] of the point a country's pins gather around (the capital). */
export const COUNTRY_POINTS: Record<string, [number, number]> = {
  'Albania':        [41.33, 19.82],
  'Bangladesh':     [23.81, 90.41],
  'Canada':         [45.42, -75.70],
  'Colombia':       [4.71, -74.07],
  'Ethiopia':       [9.03, 38.74],
  'France':         [48.86, 2.35],
  'Honduras':       [14.07, -87.19],
  'Hong Kong':      [22.32, 114.17],
  'India':          [28.61, 77.21],
  'Indonesia':      [-6.20, 106.85],
  'Italy':          [41.90, 12.50],
  'Jordan':         [31.95, 35.93],
  'Malaysia':       [3.14, 101.69],
  'Pakistan':       [33.68, 73.05],
  'Peru':           [-12.05, -77.04],
  'Philippines':    [14.60, 120.98],
  'Romania':        [44.43, 26.10],
  'Scotland':       [55.95, -3.19],
  'Slovakia':       [48.15, 17.11],
  'Spain':          [40.42, -3.70],
  'Sri Lanka':      [6.93, 79.86],
  'Thailand':       [13.76, 100.50],
  'Türkiye':        [39.93, 32.86],
  'UAE':            [24.45, 54.38],
  'United Kingdom': [51.51, -0.13],
  'United States':  [38.90, -77.04],
  'Venezuela':      [10.49, -66.90],
};

// ── Projection of public/about/world-dots.svg ────────────────────────────────
// The dot map was generated once from public/map/world_map.png (2560 x 1429, a
// rendered relief map that is equirectangular but not 2:1) by a Python script:
// land = pixels whose red or green channel beats blue by 8, sampled on a 14 px
// grid (a dot where more than 35% of the cell is land), cropped to 83N..57S.
//
// Calibration: land-mask extremes of known landmarks were located in the PNG
// and fitted by least squares (residuals about 1 degree):
//   Cape Verde (-17.5E) x 1146, Cape Agulhas (20.0E, 34.8S) x 1410 y 1053,
//   Ras Asir (51.3E, 11.8N) x 1632 y 690, Cape Horn (67.3W, 56.0S) x 775 y 1229,
//   Ponta do Seixas (34.8W, 7.15S) x 1022 y 832, Kanyakumari (77.5E, 8.1N)
//   x 1839 y 728, Steep Point (113.2E) x 2086, Cape Byron (153.6E) x 2372.
//   => lon = 0.13848 * x - 175.601    lat = -0.126977 * y + 99.482
// The SVG covers source x 0..2548 and y 130..1222 (182 x 78 cells of 14 px).
// Checked by plotting 20 cities over the dots (London, Lima, Sydney, Tokyo...).
const LON_A = 0.13848, LON_B = -175.601;
const LAT_C = -0.126977, LAT_D = 99.482;
const SRC_W = 2548, SRC_Y0 = 130, SRC_H = 1092;
export const MAP_ASPECT = 182 / 78;

/** A latitude / longitude as a fraction (0..1) of the dot map's width and height. */
export function projectToMap(lat: number, lon: number): { x: number; y: number } {
  const sx = (lon - LON_B) / LON_A;
  const sy = (lat - LAT_D) / LAT_C;
  return { x: sx / SRC_W, y: (sy - SRC_Y0) / SRC_H };
}
