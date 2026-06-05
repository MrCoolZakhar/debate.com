'use client';

import { useState, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { supabase } from '@/lib/supabase';

type ContinentKey =
  | 'north-america'
  | 'south-america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'oceania';

interface ContinentDef {
  key: ContinentKey;
  label: string;
  mapSrc: string;
  points: string;
  countries: string[];
}

const CONTINENTS: ContinentDef[] = [
  {
    key: 'north-america',
    label: 'North America',
    mapSrc: '/map/north_america_map.png',
    points: '2%,8% 14%,3% 28%,3% 32%,8% 34%,14% 34%,22% 32%,30% 30%,38% 28%,44% 26%,48% 22%,52% 18%,58% 14%,58% 10%,54% 6%,44% 3%,32% 2%,18%',
    countries: [
      'United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'Honduras',
      'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica',
      'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago',
      'Barbados', 'Saint Lucia', 'Grenada', 'Antigua and Barbuda',
      'Saint Kitts and Nevis', 'Saint Vincent and the Grenadines', 'Dominica', 'Bahamas',
    ],
  },
  {
    key: 'south-america',
    label: 'South America',
    mapSrc: '/map/south_america_map.png',
    points: '22%,49% 28%,47% 34%,47% 37%,50% 40%,56% 41%,63% 38%,73% 33%,83% 28%,92% 24%,89% 20%,79% 18%,66% 19%,55% 21%,50%',
    countries: [
      'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela',
      'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname',
    ],
  },
  {
    key: 'europe',
    label: 'Europe',
    mapSrc: '/map/europe_map.png',
    points: '43%,5% 52%,2% 62%,3% 68%,8% 65%,18% 62%,28% 57%,34% 52%,36% 47%,34% 43%,30% 43%,18%',
    countries: [
      'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
      'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark',
      'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria',
      'Greece', 'Portugal', 'Ireland', 'Croatia', 'Slovakia', 'Slovenia',
      'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Cyprus',
      'Serbia', 'Bosnia and Herzegovina', 'North Macedonia', 'Albania',
      'Montenegro', 'Kosovo', 'Moldova', 'Ukraine', 'Belarus', 'Russia',
      'Iceland', 'Liechtenstein', 'Monaco', 'Andorra', 'San Marino',
    ],
  },
  {
    key: 'africa',
    label: 'Africa',
    mapSrc: '/map/africa_map.png',
    points: '43%,34% 50%,32% 57%,32% 59%,33% 59%,38% 60%,44% 64%,44% 65%,52% 64%,62% 60%,72% 56%,80% 50%,85% 46%,83% 42%,72% 41%,58% 41%,48% 42%,40%',
    countries: [
      'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Ethiopia', 'Tanzania',
      'Uganda', 'Rwanda', 'Senegal', 'Ivory Coast', 'Cameroon', 'Zimbabwe',
      'Zambia', 'Mozambique', 'Angola', 'Sudan', 'Egypt', 'Morocco', 'Tunisia',
      'Algeria', 'Libya', 'Mali', 'Niger', 'Chad', 'Somalia', 'Madagascar',
      'Malawi', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini', 'Eritrea',
      'Djibouti', 'Comoros', 'Cape Verde', 'Sao Tome and Principe',
      'Equatorial Guinea', 'Gabon', 'Republic of the Congo',
      'Democratic Republic of the Congo', 'Central African Republic', 'Burundi',
      'Benin', 'Togo', 'Sierra Leone', 'Liberia', 'Guinea', 'Guinea-Bissau',
      'Gambia', 'Mauritania', 'Mauritius', 'Seychelles',
    ],
  },
  {
    key: 'asia',
    label: 'Asia',
    mapSrc: '/map/asia_map.png',
    points: '57%,34% 62%,28% 65%,18% 68%,8% 82%,2% 92%,4% 96%,12% 95%,22% 92%,32% 90%,42% 88%,50% 92%,58% 88%,62% 82%,64% 74%,62% 66%,58% 62%,50% 62%,44% 61%,44% 59%,38% 59%,33%',
    countries: [
      'China', 'India', 'Japan', 'South Korea', 'Indonesia', 'Pakistan',
      'Bangladesh', 'Vietnam', 'Thailand', 'Malaysia', 'Singapore', 'Philippines',
      'Myanmar', 'Cambodia', 'Laos', 'Sri Lanka', 'Nepal', 'Bhutan', 'Mongolia',
      'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan',
      'Afghanistan', 'Iran', 'Iraq', 'Saudi Arabia', 'United Arab Emirates',
      'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Yemen', 'Jordan', 'Lebanon',
      'Syria', 'Israel', 'Palestine', 'Turkey', 'Azerbaijan', 'Armenia',
      'Georgia', 'Taiwan', 'Hong Kong', 'Macao', 'Brunei', 'East Timor', 'Maldives',
    ],
  },
  {
    key: 'oceania',
    label: 'Oceania',
    mapSrc: '/map/oceania_map.png',
    points: '80%,62% 91%,60% 93%,62% 96%,66% 97%,72% 98%,70% 99%,76% 97%,79% 94%,78% 92%,80% 87%,80% 80%,78% 76%,72% 77%,64%',
    countries: [
      'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands',
      'Vanuatu', 'Samoa', 'Kiribati', 'Tonga', 'Micronesia', 'Palau',
      'Marshall Islands', 'Nauru', 'Tuvalu', 'Cook Islands',
    ],
  },
];

function polygonCentroid(points: string): { x: number; y: number } {
  const pairs = points.trim().split(/\s+/);
  let sumX = 0, sumY = 0;
  for (const pair of pairs) {
    const [xStr, yStr] = pair.split(',');
    sumX += parseFloat(xStr);
    sumY += parseFloat(yStr);
  }
  return { x: sumX / pairs.length, y: sumY / pairs.length };
}

async function fetchActiveConferences(countries: string[]): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('conferences')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true)
    .eq('status', 'published')
    .in('country', countries)
    .lte('start_date', today)
    .gte('end_date', today);
  return count ?? 0;
}

async function fetchHighlightedConference(countries: string[]): Promise<string | null> {
  const { data: confs } = await supabase
    .from('conferences')
    .select('id, full_name')
    .eq('is_public', true)
    .eq('status', 'published')
    .in('country', countries);

  if (!confs || confs.length === 0) return null;

  const confIds = confs.map((c) => c.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: apps } = await supabase
    .from('applications')
    .select('conference_id')
    .in('conference_id', confIds)
    .gte('created_at', sevenDaysAgo);

  if (!apps || apps.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const app of apps) {
    counts[app.conference_id] = (counts[app.conference_id] ?? 0) + 1;
  }

  let topId: string | null = null;
  let topCount = 0;
  for (const [id, cnt] of Object.entries(counts)) {
    if (cnt > topCount) { topCount = cnt; topId = id; }
  }

  if (!topId) return null;
  return confs.find((c) => c.id === topId)?.full_name ?? null;
}

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

function getContinentLayout(key: ContinentKey): { cardPosition: CSSProperties; hintPosition: CSSProperties } {
  switch (key) {
    case 'europe':
    case 'africa':
      return {
        cardPosition: { bottom: 48, left: 48, right: 'auto' },
        hintPosition: { top: 100, left: 48, bottom: 'auto', right: 'auto' },
      };
    default:
      return {
        cardPosition: { bottom: 48, right: 48, left: 'auto' },
        hintPosition: { top: 100, right: 48, bottom: 'auto', left: 'auto' },
      };
  }
}

export default function ConferencesMapPage() {
  const [hovered, setHovered] = useState<ContinentKey | null>(null);
  const [selected, setSelected] = useState<ContinentKey | null>(null);
  const [phase, setPhase] = useState<'world' | 'clouds' | 'continent'>('world');
  const [activeCount, setActiveCount] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoveredRef = useRef<ContinentKey | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('mousemove', handler);
    return () => document.removeEventListener('mousemove', handler);
  }, []);

  function isPointInPolygonXY(px: number, py: number, points: string): boolean {
    const pairs = points.trim().split(/\s+/);
    const vertices = pairs.map((p) => {
      const [xStr, yStr] = p.split(',');
      return {
        x: parseFloat(xStr) / 100 * window.innerWidth,
        y: parseFloat(yStr) / 100 * window.innerHeight,
      };
    });
    let inside = false;
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function recheckHover() {
    const pos = mousePosRef.current;
    if (!pos) return;
    for (const cont of CONTINENTS) {
      if (isPointInPolygonXY(pos.x, pos.y, cont.points)) {
        setHovered(cont.key);
        return;
      }
    }
    setHovered(null);
  }

  // Forward scroll: world → clouds → continent
  useEffect(() => {
    if (phase !== 'world') return;

    const handleWheel = () => {
      const key = hoveredRef.current;
      if (!key) return;

      const continent = CONTINENTS.find((c) => c.key === key);
      if (!continent) return;

      setSelected(key);
      setPhase('clouds');

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }

      setTimeout(() => {
        setPhase('continent');
        setCardLoading(true);

        Promise.all([
          fetchActiveConferences(continent.countries),
          fetchHighlightedConference(continent.countries),
        ]).then(([cnt, hl]) => {
          setActiveCount(cnt);
          setHighlighted(hl);
          setCardLoading(false);
        });
      }, 1700);
    };

    document.addEventListener('wheel', handleWheel);
    return () => document.removeEventListener('wheel', handleWheel);
  }, [phase]);

  // Reverse scroll: continent → clouds → world
  useEffect(() => {
    if (phase !== 'continent') return;

    const handleScrollUp = (e: WheelEvent) => {
      if (e.deltaY >= 0) return;
      setPhase('clouds');
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
      setTimeout(() => {
        setPhase('world');
        setSelected(null);
        setHovered(null);
        setActiveCount(0);
        setHighlighted(null);
        recheckHover();
      }, 1700);
    };

    document.addEventListener('wheel', handleScrollUp);
    return () => document.removeEventListener('wheel', handleScrollUp);
  }, [phase]);

  // Cursor trail canvas effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    type TrailPoint = { x: number; y: number; age: number; terrain: 'ocean' | 'land' };
    const trail: TrailPoint[] = [];

    function isPointInPolygon(px: number, py: number, points: string): boolean {
      const pairs = points.trim().split(/\s+/);
      const vertices = pairs.map((p) => {
        const [xStr, yStr] = p.split(',');
        return {
          x: parseFloat(xStr) / 100 * window.innerWidth,
          y: parseFloat(yStr) / 100 * window.innerHeight,
        };
      });
      let inside = false;
      const n = vertices.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function getTerrainAt(x: number, y: number): 'ocean' | 'land' {
      for (const cont of CONTINENTS) {
        if (isPointInPolygon(x, y, cont.points)) return 'land';
      }
      return 'ocean';
    }

    let rafId = 0;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < trail.length; i++) {
        trail[i].age += 0.06;
      }
      while (trail.length > 0 && trail[0].age >= 1) {
        trail.shift();
      }

      for (let i = 1; i < trail.length; i++) {
        const pt = trail[i];
        const alpha = (1 - pt.age) * 0.55;
        const lineWidth = (1 - pt.age) * 2.5;
        if (alpha <= 0 || lineWidth <= 0) continue;

        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    }

    draw();

    const handleMouseMove = (e: MouseEvent) => {
      trail.push({ x: e.clientX, y: e.clientY, age: 0, terrain: getTerrainAt(e.clientX, e.clientY) });
      if (trail.length > 28) trail.shift();
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const selectedDef = selected ? CONTINENTS.find((c) => c.key === selected) ?? null : null;
  const hoveredDef = hovered ? CONTINENTS.find((c) => c.key === hovered) ?? null : null;
  const tooltipPos = hoveredDef ? polygonCentroid(hoveredDef.points) : null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#1B3828',
      }}
    >
      {/* LAYER 1 — Grain overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px',
          mixBlendMode: 'overlay',
          opacity: 0.07,
        }}
      />

      {/* Keyframes — unconditional */}
      <style>{`
        @keyframes pulse-skeleton {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .map-nav-wrapper a, .map-nav-wrapper button { color: #EDE7D8 !important; }
        .map-nav-wrapper a:hover { color: #EED98A !important; }
      `}</style>

      {/* LAYER 0.5 — Cursor trail canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 15,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
        }}
      />

      {/* LAYER 2 — SiteNav with semi-transparent forest background */}
      <div
        className="map-nav-wrapper"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(27,56,40,0.72)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(238,217,138,0.08)',
        }}
      >
        <SiteNav />
      </div>

      {/* LAYER 3 — World map image */}
      <img
        src="/map/world_map.png"
        alt="World Map"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 10,
          opacity: phase === 'world' ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
      />

      {/* LAYER 4 — SVG polygon hover zones */}
      {phase === 'world' && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 20,
          }}
        >
          {CONTINENTS.map((cont) => (
            <polygon
              key={cont.key}
              points={cont.points.replace(/%/g, '')}
              fill="transparent"
              stroke="transparent"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'all', cursor: 'crosshair' }}
              onMouseEnter={() => setHovered(cont.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
      )}


      {/* LAYER 6 — Cloud transition video */}
      <video
        ref={videoRef}
        muted
        playsInline
        src="/map/cloud_transition.mp4"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 40,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: phase === 'clouds' ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* LAYER 7 — Continent map image */}
      {selected && (
        <img
          src={selectedDef?.mapSrc}
          alt={selectedDef?.label}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: phase === 'continent' ? 1 : 0,
            transition: 'opacity 400ms ease',
          }}
        />
      )}

      {/* LAYER 8 — Info card + scroll-up hint (continent phase) */}
      {phase === 'continent' && selectedDef && (
        <>
          <div
            style={{
              position: 'absolute',
              zIndex: 30,
              backgroundColor: '#FAF8F3',
              borderRadius: 16,
              padding: '28px 32px',
              minWidth: 280,
              maxWidth: 340,
              boxShadow: '0 8px 40px rgba(27,56,40,0.25)',
              border: '1px solid #DDD4C0',
              overflow: 'hidden',
              ...getContinentLayout(selectedDef.key).cardPosition,
            }}
          >
            {/* Card grain overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage: GRAIN_SVG,
                backgroundRepeat: 'repeat',
                backgroundSize: '300px',
                opacity: 0.06,
                mixBlendMode: 'multiply',
                zIndex: 0,
              }}
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#B6871F',
                  letterSpacing: '0.2em',
                  margin: '0 0 8px 0',
                  textTransform: 'uppercase',
                }}
              >
                {'CONFERENCES — ' + selectedDef.label.toUpperCase()}
              </p>

              <h2
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 900,
                  fontSize: 28,
                  color: '#1B3828',
                  margin: 0,
                }}
              >
                {selectedDef.label}
              </h2>

              <div
                style={{
                  height: 1,
                  backgroundColor: '#DDD4C0',
                  margin: '12px 0',
                }}
              />

              {cardLoading ? (
                <>
                  <div
                    style={{
                      height: 20,
                      borderRadius: 6,
                      backgroundColor: '#DDD4C0',
                      marginBottom: 8,
                      animation: 'pulse-skeleton 1.5s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      height: 20,
                      borderRadius: 6,
                      backgroundColor: '#DDD4C0',
                      marginBottom: 8,
                      animation: 'pulse-skeleton 1.5s ease-in-out infinite',
                    }}
                  />
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#9A8A78',
                        margin: 0,
                      }}
                    >
                      Active Conferences
                    </p>
                    <p
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#1B3828',
                        margin: 0,
                      }}
                    >
                      {activeCount.toString()}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#9A8A78',
                        margin: 0,
                      }}
                    >
                      Highlighted Conference
                    </p>
                    <p
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1B3828',
                        margin: 0,
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {highlighted ?? '—'}
                    </p>
                  </div>
                </>
              )}

              <Link
                href={'/conferences/explore?continent=' + selectedDef.key}
                style={{
                  display: 'block',
                  marginTop: 16,
                  textAlign: 'center',
                  backgroundColor: '#1B3828',
                  color: '#EED98A',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  fontFamily: "'Outfit', sans-serif",
                  textDecoration: 'none',
                }}
              >
                {'EXPLORE ' + selectedDef.label.toUpperCase() + ' →'}
              </Link>
            </div>
          </div>

          {/* Scroll-up-to-return hint */}
          <div
            style={{
              position: 'absolute',
              zIndex: 30,
              pointerEvents: 'none',
              ...getContinentLayout(selectedDef.key).hintPosition,
            }}
          >
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                letterSpacing: '0.18em',
                color: '#EDE7D8',
                backgroundColor: '#1B3828',
                borderRadius: 24,
                padding: '9px 22px',
                border: '1px solid rgba(238,217,138,0.15)',
                whiteSpace: 'nowrap',
                margin: 0,
                boxShadow: '0 2px 12px rgba(27,56,40,0.15)',
              }}
            >
              SCROLL UP TO RETURN TO MAP
            </p>
          </div>
        </>
      )}

      {/* LAYER 10 — Hint text (world phase) */}
      {phase === 'world' && (
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.18em',
              color: '#EDE7D8',
              backgroundColor: '#1B3828',
              borderRadius: 24,
              padding: '9px 22px',
              border: '1px solid rgba(238,217,138,0.15)',
              whiteSpace: 'nowrap',
              margin: 0,
              boxShadow: '0 2px 12px rgba(27,56,40,0.15)',
            }}
          >
            HOVER A CONTINENT AND SCROLL TO EXPLORE
          </p>
        </div>
      )}

      {/* Back to conferences button (world phase) */}
      {phase === 'world' && (
        <div style={{ position: 'absolute', bottom: 32, left: 48, zIndex: 30 }}>
          <Link
            href="/conferences"
            style={{
              backgroundColor: '#1B3828',
              border: '1px solid rgba(238,217,138,0.15)',
              borderRadius: 24,
              padding: '9px 22px',
              fontSize: 11,
              fontWeight: 700,
              color: '#EDE7D8',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.18em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 12px rgba(27,56,40,0.15)',
              display: 'inline-block',
            }}
          >
            ← BACK TO CONFERENCES
          </Link>
        </div>
      )}
    </div>
  );
}
