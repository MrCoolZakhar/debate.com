'use client';
// Gavelling Crisis: "Pick on the map" for a character's location. A small clickable world drawn from
// the same offline file as the war map (no tiles, no third party). One click on a country picks it.

import { useEffect, useMemo, useState } from 'react';
import type { Geometry } from 'geojson';
import { MapPin } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { loadWorldData, type WorldData } from '../map/mapData';
import { CK, Skeleton } from '../../crisisKit';

const TOP = 84; // degrees of latitude at the top of the picture; the bottom is -58 (no Antarctica)
const HEIGHT = 142;

function ringPath(ring: number[][]): string {
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const x = Math.round((ring[i][0] + 180) * 10) / 10;
    const y = Math.round((TOP - ring[i][1]) * 10) / 10;
    d += `${i === 0 ? 'M' : 'L'}${x} ${y}`;
  }
  return `${d}Z`;
}

function geometryPath(g: Geometry): string {
  if (g.type === 'Polygon') return g.coordinates.map(ringPath).join('');
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.map(ringPath).join('')).join('');
  return '';
}

export default function CharacterMapPicker({ current, onPick }: { current: string; onPick: (place: string) => void }) {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadWorldData().then((w) => { if (alive) setWorld(w); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const paths = useMemo(
    () => (world ? world.collection.features.map((f) => ({ key: f.properties.key, name: f.properties.name, d: geometryPath(f.geometry) })) : []),
    [world],
  );
  const options = useMemo(
    () => [...new Set(paths.map((p) => p.name))].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
    [paths],
  );

  if (failed) return <p style={{ margin: 0, fontSize: 14, color: CK.danger }}>The map did not load. Type the place instead.</p>;
  if (!world) return <Skeleton h={300} r={16} />;

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>
        <MapPin size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        Click a country to set the location.
        {current && <span>Now: <b style={{ color: CK.ink }}>{current}</b></span>}
      </p>
      <div style={{ background: '#FDFCF9', borderRadius: 18, boxShadow: `inset 0 0 0 1px ${CK.hair}`, padding: 6 }}>
        <svg viewBox={`0 0 360 ${HEIGHT}`} role="group" aria-label="World map" style={{ display: 'block', width: '100%', height: 'auto' }}>
          {paths.map((p) => {
            const on = p.name === current;
            const hot = p.name === hover;
            return (
              <path
                key={p.key}
                d={p.d}
                role="button"
                tabIndex={-1}
                aria-label={p.name}
                onMouseEnter={() => setHover(p.name)}
                onMouseLeave={() => setHover((h) => (h === p.name ? null : h))}
                onClick={() => onPick(p.name)}
                fill={on ? CK.red : hot ? 'rgba(142,36,36,0.45)' : '#E4D6C8'}
                stroke="#FDFCF9"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </svg>
      </div>
      <p aria-live="polite" style={{ margin: 0, minHeight: 20, fontSize: 14, fontWeight: 700, color: CK.ink }}>{hover ?? ''}</p>
      <div style={{ maxWidth: 360 }}>
        <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Or choose a country from the list</p>
        <GSelect value={options.some((o) => o.value === current) ? current : ''} onChange={onPick} options={options} placeholder="Choose a country" aria-label="Country" />
      </div>
    </div>
  );
}
