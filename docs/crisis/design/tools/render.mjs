import fs from 'fs';
import { geoMercator, geoPath, geoCircle, geoBounds } from 'd3-geo';
import { feature } from 'topojson-client';
const topo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const all = feature(topo, topo.objects.countries).features;
const W = 1000, H = 620;
const box = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-94, 11], [-94, 33], [-58, 33], [-58, 11], [-94, 11]]] } };
const proj = geoMercator().fitExtent([[0, 0], [W, H]], box);
proj.clipExtent([[-10, -10], [W + 10, H + 10]]); const path = geoPath(proj).digits(1);
const keep = all;
const out = { W, H, countries: keep.map(f => ({ id: f.id, name: f.properties.name, d: path(f), c: path.centroid(f).map(Math.round) })).filter(c => c.d) };
const pt = (lon, lat) => proj([lon, lat]).map(v => Math.round(v));
out.points = {
  havana: pt(-82.38, 23.13), sanCristobal: pt(-83.05, 22.72), guantanamo: pt(-75.15, 19.9), keyWest: pt(-81.78, 24.55),
  miami: pt(-80.19, 25.76), washingtonDir: pt(-80.0, 32.5), santiago: pt(-75.82, 20.02), sagua: pt(-80.07, 22.81), remedios: pt(-79.54, 22.49),
  nassau: pt(-77.35, 25.06), sanJuan: pt(-66.1, 18.46), atlanticSub: pt(-68.5, 27.0), soviet1: pt(-63.5, 24.5), soviet2: pt(-66.0, 22.5),
};
const ring = geoCircle().center([-80, 22]).radius(800 / 111.2).precision(2)();
out.quarantine = path(ring);
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(out.countries.length, out.countries.map(c => c.name).join(', '));
console.log(JSON.stringify(out.points));
