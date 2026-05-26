'use client';

import { useState, useRef, useEffect } from 'react';
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
  zone: { x: number; y: number; w: number; h: number };
  countries: string[];
}

const CONTINENTS: ContinentDef[] = [
  {
    key: 'north-america',
    label: 'North America',
    mapSrc: '/map/north_america_map.png',
    zone: { x: 2, y: 5, w: 28, h: 55 },
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
    zone: { x: 18, y: 45, w: 20, h: 48 },
    countries: [
      'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela',
      'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname',
    ],
  },
  {
    key: 'europe',
    label: 'Europe',
    mapSrc: '/map/europe_map.png',
    zone: { x: 43, y: 3, w: 18, h: 38 },
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
    zone: { x: 43, y: 35, w: 20, h: 48 },
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
    zone: { x: 57, y: 5, w: 38, h: 60 },
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
    zone: { x: 72, y: 52, w: 25, h: 40 },
    countries: [
      'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands',
      'Vanuatu', 'Samoa', 'Kiribati', 'Tonga', 'Micronesia', 'Palau',
      'Marshall Islands', 'Nauru', 'Tuvalu', 'Cook Islands',
    ],
  },
];

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

export default function ConferencesMapPage() {
  const [hovered, setHovered] = useState<ContinentKey | null>(null);
  const [selected, setSelected] = useState<ContinentKey | null>(null);
  const [phase, setPhase] = useState<'world' | 'clouds' | 'continent'>('world');
  const [activeCount, setActiveCount] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoveredRef = useRef<ContinentKey | null>(null);

  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

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
        videoRef.current.currentTime = 2.3;
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

  const handleBack = () => {
    setPhase('world');
    setSelected(null);
    setHovered(null);
    setActiveCount(0);
    setHighlighted(null);
  };

  const selectedDef = selected ? CONTINENTS.find((c) => c.key === selected) ?? null : null;
  const hoveredDef = hovered ? CONTINENTS.find((c) => c.key === hovered) ?? null : null;

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

      {/* LAYER 2 — SiteNav */}
      <div style={{ position: 'relative', zIndex: 50 }}>
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

      {/* LAYER 4 — SVG hover zones */}
      {phase === 'world' && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 20,
          }}
        >
          {CONTINENTS.map((cont) => (
            <rect
              key={cont.key}
              x={cont.zone.x + '%'}
              y={cont.zone.y + '%'}
              width={cont.zone.w + '%'}
              height={cont.zone.h + '%'}
              fill={hovered === cont.key ? 'rgba(238,217,138,0.15)' : 'transparent'}
              stroke={hovered === cont.key ? 'rgba(238,217,138,0.4)' : 'transparent'}
              strokeWidth={1.5}
              rx={4}
              style={{ pointerEvents: 'all', cursor: 'crosshair' }}
              onMouseEnter={() => setHovered(cont.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
      )}

      {/* LAYER 5 — Continent tooltip */}
      {phase === 'world' && hoveredDef && (
        <div
          style={{
            position: 'absolute',
            zIndex: 30,
            top: (hoveredDef.zone.y + hoveredDef.zone.h / 2) + '%',
            left: (hoveredDef.zone.x + hoveredDef.zone.w / 2) + '%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: '#1B3828',
              border: '1px solid rgba(238,217,138,0.5)',
              borderRadius: 8,
              padding: '6px 16px',
            }}
          >
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: '#EED98A',
                letterSpacing: '0.2em',
                whiteSpace: 'nowrap',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {hoveredDef.label}
            </p>
          </div>
        </div>
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

      {/* LAYER 8 — Info card */}
      {phase === 'continent' && selectedDef && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 48,
            zIndex: 30,
            backgroundColor: '#FAF8F3',
            borderRadius: 16,
            padding: '28px 32px',
            minWidth: 280,
            maxWidth: 340,
            boxShadow: '0 8px 40px rgba(27,56,40,0.25)',
            border: '1px solid #DDD4C0',
            overflow: 'hidden',
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
                marginBottom: 8,
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
      )}

      {/* LAYER 9 — Back button */}
      {phase === 'continent' && (
        <button
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: 32,
            left: 32,
            zIndex: 30,
            backgroundColor: 'rgba(250,248,243,0.92)',
            border: '1px solid #DDD4C0',
            borderRadius: 10,
            padding: '8px 18px',
            fontSize: 12,
            fontWeight: 800,
            color: '#1B3828',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.06em',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          ← BACK TO MAP
        </button>
      )}

      {/* LAYER 10 — Hint text */}
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
              fontSize: 9,
              letterSpacing: '0.2em',
              color: 'rgba(238,217,138,0.5)',
              whiteSpace: 'nowrap',
              margin: 0,
              animation: 'pulse-hint 2s ease-in-out infinite alternate',
            }}
          >
            HOVER A CONTINENT AND SCROLL TO EXPLORE
          </p>
          <style>{`
            @keyframes pulse-hint {
              from { opacity: 0.4; }
              to { opacity: 1; }
            }
            @keyframes pulse-skeleton {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
