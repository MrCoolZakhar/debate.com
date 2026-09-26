'use client';

// The ambassadors on a world map: a dot map in forest on white
// (public/about/world-dots.svg, see ambassadors.ts for how it was made and
// calibrated) with one teardrop pin per person, the pin's head their round
// face. Hover, keyboard focus or a tap grows a pin to twice its size from its
// tip and names the person. Several people in one country are fanned out by a
// small relaxation so every face stays visible; a thin line runs back to the
// country's point when a pin had to move.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { AMBASSADORS, COUNTRY_POINTS, MAP_ASPECT, projectToMap, type Ambassador } from './ambassadors';

const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';

type Placed = { amb: Ambassador; idx: number; ax: number; ay: number; x: number; y: number };

function pinSize(w: number): number {
  if (w >= 1024) return Math.max(26, Math.min(36, w * 0.028));
  if (w >= 640) return 24;
  return 16;
}

/** Pin tip positions in px for a map `w` wide. Deterministic, so server and client agree. */
function layout(w: number): { placed: Placed[]; d: number } {
  const h = w / MAP_ASPECT;
  const d = pinSize(w);
  const tipH = d * 0.42;
  const byCountry = new Map<string, number>();
  const placed: Placed[] = [];
  AMBASSADORS.forEach((amb, idx) => {
    const pt = COUNTRY_POINTS[amb.country];
    if (!pt) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[about map] no point for ${amb.country}`);
      return;
    }
    const p = projectToMap(pt[0], pt[1]);
    const ax = p.x * w, ay = p.y * h;
    const k = byCountry.get(amb.country) ?? 0;
    byCountry.set(amb.country, k + 1);
    // Start each extra person of a country a little around the point, on a
    // golden-angle spiral, so the relaxation has a direction to push.
    const ang = k * 2.39996;
    const r = k === 0 ? 0 : d * 0.35 * Math.sqrt(k);
    placed.push({ amb, idx, ax, ay, x: ax + Math.cos(ang) * r, y: ay + Math.sin(ang) * r });
  });

  const min = d * 1.0;
  for (let it = 0; it < 220; it++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= min) continue;
        if (dist < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); dist = 1; }
        const push = (min - dist) / 2;
        const ux = dx / dist, uy = dy / dist;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
    for (const p of placed) {
      p.x += (p.ax - p.x) * 0.02;
      p.y += (p.ay - p.y) * 0.02;
      p.x = Math.max(d / 2, Math.min(w - d / 2, p.x));
      p.y = Math.max(d + tipH, Math.min(h, p.y));
    }
  }
  return { placed, d };
}

const MAP_CSS = `
.gv-pin{position:absolute;padding:0;border:none;background:none;cursor:pointer;transform-origin:50% 100%;
  transition:transform 220ms cubic-bezier(0.22,1,0.36,1);will-change:transform;-webkit-tap-highlight-color:transparent}
.gv-pin:focus{outline:none}
.gv-pin[data-active="true"]{transform:scale(2)}
.gv-pin:focus-visible .gv-pin-shape{filter:drop-shadow(0 0 0 #1B3828) drop-shadow(0 0 2px #1B3828)}
.gv-pin-label{position:absolute;pointer-events:none;transform:translateX(-50%);white-space:nowrap;z-index:80;
  background:#FFFFFF;border-radius:10px;padding:6px 10px;
  box-shadow:0 1px 2px rgba(27,56,40,0.12),0 8px 22px -8px rgba(27,56,40,0.35)}
@media (prefers-reduced-motion:reduce){.gv-pin{transition:none}.gv-pin[data-active="true"]{transform:none}}
`;

function PinBody({ amb, d }: { amb: Ambassador; d: number }) {
  const tipH = d * 0.42;
  const rim = Math.max(2, d * 0.08);
  return (
    <span className="gv-pin-shape" style={{ position: 'relative', display: 'block', width: d, height: d + tipH, filter: 'drop-shadow(0 2px 3px rgba(27,56,40,0.35))' }}>
      {/* The teardrop: a gold head that narrows to the tip. */}
      <svg width={d} height={d + tipH} viewBox="0 0 40 56.8" aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path d="M20 56.8 C15 47 0 36 0 20 A20 20 0 1 1 40 20 C40 36 25 47 20 56.8 Z" fill="url(#gvPinGold)" />
      </svg>
      <span style={{ position: 'absolute', left: rim, top: rim, width: d - rim * 2, height: d - rim * 2, borderRadius: '50%', overflow: 'hidden', background: '#F0EBDD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {amb.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={amb.photo} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{ color: FOREST, fontWeight: 800, fontSize: Math.max(7, d * 0.3), lineHeight: 1 }}>{amb.initials}</span>
        )}
      </span>
    </span>
  );
}

export default function AmbassadorMap() {
  const { language } = useLanguage();
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1100);
  const [active, setActive] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const pointerType = useRef<string>('mouse');

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // A tap outside any pin closes an open one.
  useEffect(() => {
    if (active === null) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('.gv-pin')) setActive(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [active]);

  const { placed, d } = useMemo(() => layout(w), [w]);
  const h = w / MAP_ASPECT;
  const tipH = d * 0.42;
  const pinH = d + tipH;
  const countryName = (c: string) => getCountryDisplayName(c, language) || c;

  const anchors = useMemo(() => {
    const seen = new Map<string, { x: number; y: number }>();
    for (const p of placed) if (!seen.has(p.amb.country)) seen.set(p.amb.country, { x: p.ax, y: p.ay });
    return [...seen.values()];
  }, [placed]);

  const activePin = active === null ? null : placed.find((p) => p.idx === active) ?? null;
  const scale = reduced ? 1 : 2;
  let label: { left: number; top: number } | null = null;
  if (activePin) {
    const above = activePin.y - pinH * scale - 8;
    const left = Math.max(80, Math.min(w - 80, activePin.x));
    label = above > 40 ? { left, top: above - 44 } : { left, top: activePin.y + 8 };
  }

  // The phone list: countries with the most ambassadors first.
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of AMBASSADORS) m.set(a.country, [...(m.get(a.country) ?? []), a.name]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, []);

  return (
    <div>
      <style>{MAP_CSS}</style>
      <div
        ref={boxRef}
        className="relative w-full select-none"
        style={{ aspectRatio: `${MAP_ASPECT}` }}
        onPointerLeave={() => { if (pointerType.current === 'mouse') setActive(null); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/about/world-dots.svg" alt="" aria-hidden draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* One gradient for every pin's gold teardrop. */}
        <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id="gvPinGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F4E4A6" />
              <stop offset="0.45" stopColor="#E3C56A" />
              <stop offset="1" stopColor="#B6871F" />
            </linearGradient>
          </defs>
        </svg>
        <svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
          {placed.map((p) => (Math.hypot(p.x - p.ax, p.y - p.ay) > 3 ? (
            <line key={`l${p.idx}`} x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke={FOREST} strokeOpacity={0.35} strokeWidth={1} />
          ) : null))}
          {anchors.map((a, i) => (
            <circle key={`a${i}`} cx={a.x} cy={a.y} r={Math.max(2, d * 0.09)} fill={FOREST} stroke="#FFFFFF" strokeWidth={1.2} />
          ))}
        </svg>

        {placed.map((p) => {
          const isActive = active === p.idx;
          return (
            <button
              key={p.idx}
              type="button"
              className="gv-pin"
              data-active={isActive}
              aria-label={`${p.amb.name}, ${countryName(p.amb.country)}`}
              aria-pressed={isActive}
              onPointerDown={(e) => { pointerType.current = e.pointerType; }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActive(p.idx); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive((cur) => (cur === p.idx ? null : cur)); }}
              onFocus={() => setActive(p.idx)}
              onBlur={() => setActive((cur) => (cur === p.idx ? null : cur))}
              onClick={() => {
                if (pointerType.current !== 'mouse') setActive((cur) => (cur === p.idx ? null : p.idx));
              }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setActive(null); (e.currentTarget as HTMLButtonElement).blur(); } }}
              style={{
                left: `${((p.x - d / 2) / w) * 100}%`,
                top: `${((p.y - pinH) / h) * 100}%`,
                width: d,
                height: pinH,
                zIndex: isActive ? 60 : 10 + Math.round((p.y / h) * 40),
              }}
            >
              <PinBody amb={p.amb} d={d} />
            </button>
          );
        })}

        {activePin && label && (
          <div className="gv-pin-label" aria-hidden style={{ left: `${(label.left / w) * 100}%`, top: label.top }}>
            <p style={{ margin: 0, color: INK, fontWeight: 800, fontSize: 13, lineHeight: 1.25 }}>{activePin.amb.name}</p>
            <p style={{ margin: 0, color: INK_SOFT, fontSize: 12, lineHeight: 1.3 }}>{countryName(activePin.amb.country)}</p>
          </div>
        )}
      </div>

      {/* Phones: the pins are small, so the names are also listed by country. */}
      <ul className="md:hidden mt-6 grid gap-3" style={{ listStyle: 'none', padding: 0 }}>
        {groups.map(([country, names]) => (
          <li key={country} style={{ background: '#FFFFFF', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 6px 18px -10px rgba(27,56,40,0.3)' }}>
            <p style={{ margin: 0, color: FOREST, fontWeight: 800, fontSize: 14 }}>{countryName(country)}</p>
            <p style={{ margin: '2px 0 0', color: INK_SOFT, fontSize: 13.5, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{names.join(', ')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
