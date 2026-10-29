'use client';
// Gavelling Crisis: a tiny map snippet of where a character stands (their exact spot on the offline world).
// A flat picture, no map engine: the land around the spot with a red pin on it. Drawn from the same world
// file as the war map; the outlines are built once per page visit and shared.

import { useEffect, useState } from 'react';
import type { Geometry } from 'geojson';
import { CK } from '../../crisisKit';
import { loadWorldData } from '../map/mapData';

const TOP = 84;            // degrees of latitude at the top of the picture
const WIDTH = 360;
const HEIGHT = 142;        // the bottom is -58: no Antarctica
const VIEW_W = 80;         // degrees of longitude the snippet shows
const VIEW_H = 40;

function ringPath(ring: number[][]): string {
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    d += `${i === 0 ? 'M' : 'L'}${Math.round((ring[i][0] + 180) * 10) / 10} ${Math.round((TOP - ring[i][1]) * 10) / 10}`;
  }
  return `${d}Z`;
}

function geometryPath(g: Geometry): string {
  if (g.type === 'Polygon') return g.coordinates.map(ringPath).join('');
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.map(ringPath).join('')).join('');
  return '';
}

let landCache: Promise<string> | null = null;
function landPath(): Promise<string> {
  if (!landCache) {
    landCache = loadWorldData()
      .then((w) => w.collection.features.map((f) => geometryPath(f.geometry)).join(''))
      .catch((e) => { landCache = null; throw e; });
  }
  return landCache;
}

export default function CharacterSpotSnippet({ lng, lat, width = 168, picture }: { lng: number; lat: number; width?: number; picture?: string | null }) {
  const [land, setLand] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    landPath().then((d) => { if (alive) setLand(d); }).catch(() => { /* the pin and the label still tell the story */ });
    return () => { alive = false; };
  }, []);

  const x = lng + 180;
  const y = TOP - lat;
  const vx = Math.max(0, Math.min(WIDTH - VIEW_W, x - VIEW_W / 2));
  const vy = Math.max(0, Math.min(HEIGHT - VIEW_H, y - VIEW_H / 2));
  const height = Math.round((width * VIEW_H) / VIEW_W);
  const px = ((x - vx) / VIEW_W) * width;
  const py = ((y - vy) / VIEW_H) * height;

  return (
    <span role="img" aria-label="Where they are on the map" style={{ display: 'block', width, height, position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#DCE4DA', boxShadow: `inset 0 0 0 1px ${CK.hair}` }}>
      <svg viewBox={`${vx} ${vy} ${VIEW_W} ${VIEW_H}`} width={width} height={height} style={{ display: 'block' }} aria-hidden>
        {land && <path d={land} fill="#F5F0E4" stroke="#CBBE9F" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      {picture && /^(https?:\/\/|\/[^/])/.test(picture) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" draggable={false} style={{ position: 'absolute', left: px - 13, top: py - 13, width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxSizing: 'border-box', boxShadow: '0 2px 5px rgba(58,14,15,0.4)' }} />
      ) : (
        <svg width="20" height="26" viewBox="0 0 30 38" aria-hidden style={{ position: 'absolute', left: px - 10, top: py - 26, filter: 'drop-shadow(0 2px 2px rgba(58,14,15,0.35))' }}>
          <path d="M15 37C15 37 2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 37 15 37Z" fill="#8E2424" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="15" cy="14.5" r="5" fill="#FFF4E6" />
        </svg>
      )}
    </span>
  );
}
