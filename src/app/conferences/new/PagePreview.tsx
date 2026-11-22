'use client';

// "How your page will look" on the wizard's Ready to Publish step (owner, 22 Nov 2026: the format,
// level and delegates tiles, the apply panel and the committees must look like the real page).
//
// Laid out at the public page's own size (DESIGN_W px wide, the page's own paddings and type) and
// scaled down to its column with one transform, so it IS the page in miniature: the hero with its
// banner, logo disc, eyebrow, title, flag, city and dates; the stat strip overlapping the hero with
// NeuIconDisc tiles exactly as ConferenceDetailClient draws them; the real RoleApplyCards inside
// the "Choose how you apply" rail; the Overview / You / Reviews tabs; About; and the committee cards
// (emblem over the top edge, acronym, name, seats, topics, the filled bar, View members). The
// Gavelling theme fills the --gv-* variables, as on a conference that has not picked colours yet.
// Inert: nothing in it can be clicked or focused. Writes nothing.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Monitor, GraduationCap, Users, LayoutGrid, User, Star, Globe } from 'lucide-react';
import { NEU, NEU_GRADIENTS, NeuIconDisc } from '@/components/neu';
import { CircleFlag } from '@/components/CircleFlag';
import { themeCssVars } from '@/lib/theme';
import { RoleApplyCards, type RoleTile } from '@/app/conferences/[slug]/RoleApplyCards';
import type { CommitteeDraft } from '@/components/CommitteeEditorModal';
import { BRAND } from './brandMarks';

const DESIGN_W = 1200;
const FONT = 'var(--font-brand), sans-serif';
const ROLE_TILES: RoleTile[] = [
  { role: 'head-delegate', label: 'Head Delegate', state: 'open', price: '' },
  { role: 'delegate', label: 'Delegate', state: 'open', price: '' },
  { role: 'faculty-advisor', label: 'Faculty Advisor', state: 'open', price: '' },
  { role: 'observer', label: 'Observer', state: 'open', price: '' },
  { role: 'chair', label: 'Chair', state: 'open', price: '' },
];
const SOCIAL_BG: Record<string, string> = {
  instagram: 'radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)',
  facebook: '#0866FF', tiktok: '#000000', whatsapp: '#25D366',
};

type Committee = CommitteeDraft & { key: string };

export interface PagePreviewProps {
  fullName: string;
  acronym: string;
  year: string;
  logoUrl: string;
  bannerUrl: string;
  countryCode?: string;
  country: string;
  city: string;
  when: string;
  format: string;
  studentLevel: string;
  expectedDelegates: string;
  description: string;
  links: string[];
  committees: Committee[];
  renderEmblem: (c: Committee, size: number) => ReactNode;
  /** The section to light up (hovered or being edited in the overview). */
  hot: string | null;
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export default function PagePreview(p: PagePreviewProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0.5, h: 600 });

  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => {
      const scale = o.clientWidth / DESIGN_W;
      const h = i.offsetHeight * scale;
      setBox((prev) => (Math.abs(prev.scale - scale) < 0.0005 && Math.abs(prev.h - h) < 0.5 ? prev : { scale, h }));
    });
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  const hot = (s: string): React.CSSProperties => ({
    borderRadius: 18,
    outline: `4px solid ${p.hot === s ? '#C9A227' : 'transparent'}`,
    outlineOffset: 5,
    boxShadow: p.hot === s ? '0 0 0 14px rgba(238,217,138,0.5)' : undefined,
    transition: 'outline-color 200ms ease, box-shadow 200ms ease',
  });
  const place = [p.city.trim(), p.countryCode || p.country.trim()].filter(Boolean).join(', ');
  const level = p.studentLevel === 'school' ? 'High School' : p.studentLevel === 'both' ? 'University and High School' : cap(p.studentLevel) || 'Not set';
  const stats = [
    { icon: Monitor, gradient: NEU_GRADIENTS.forest, label: 'Format', value: cap(p.format.replace('-', ' ')) || 'Not set', sec: 'where' },
    { icon: GraduationCap, gradient: NEU_GRADIENTS.amber, label: 'Level', value: level, sec: 'where' },
    ...(Number(p.expectedDelegates) > 0
      ? [{ icon: Users, gradient: NEU_GRADIENTS.green, label: 'Delegates', value: Number(p.expectedDelegates).toLocaleString('en-US'), sec: 'delegates' }]
      : []),
  ];

  return (
    <div ref={outer} className="gv-pv-desk" style={{ position: 'relative', height: box.h, overflow: 'hidden' }} aria-hidden inert>
      {/* The preview is the DESKTOP page at any window size: RoleApplyCards switches layout on
          the window's width (md:), so its desktop list is forced here. */}
      <style>{'.gv-pv-desk ul[class~="md:hidden"]{display:none!important}.gv-pv-desk ul[class~="md:flex"]{display:flex!important}'}</style>
      <div
        ref={inner}
        style={{
          ...themeCssVars(null),
          position: 'absolute', top: 0, left: 0, width: DESIGN_W,
          transform: `scale(${box.scale})`, transformOrigin: 'top left',
          background: NEU.base, fontFamily: FONT, color: NEU.ink, pointerEvents: 'none',
        }}
      >
        {/* Hero */}
        <div style={{ ...hot('conference'), borderRadius: 0, position: 'relative', height: 430, background: `#1B3828 ${p.bannerUrl ? `url("${p.bannerUrl}")` : ''} center/cover no-repeat` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,18,13,0.86) 0%, rgba(10,18,13,0.42) 48%, rgba(10,18,13,0.08) 100%)' }} />
          <div style={{ position: 'absolute', left: 56, right: 56 + 372, bottom: 70, display: 'flex', alignItems: 'flex-end', gap: 26 }}>
            <span style={{ width: 150, height: 150, flexShrink: 0, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 0 0 6px rgba(255,255,255,0.92), 0 14px 34px rgba(0,0,0,0.38)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.logoUrl && <img src={p.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </span>
            <span style={{ minWidth: 0, paddingBottom: 6 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.78)', marginBottom: 6 }}>
                {p.acronym.trim().toUpperCase()}{p.year ? ` ${p.year}` : ''}
              </span>
              <span style={{ display: 'block', fontSize: 52, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.04, color: '#FFFFFF' }}>
                {p.fullName.trim() || 'Your conference'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                {p.countryCode && <CircleFlag code={p.countryCode} country={p.country} size={18} decorative />}
                <span style={hot('where')}>{place || 'Your city'}</span>
                <span style={{ opacity: 0.6 }}>•</span>
                <span style={hot('when')}>{p.when}</span>
              </span>
            </span>
          </div>
        </div>

        {/* The apply rail, beside the hero like on the page */}
        <div style={{ position: 'absolute', top: 300, right: 56, width: 340, borderRadius: 24, padding: '22px 18px 20px', background: 'linear-gradient(165deg, var(--gv-main) 0%, var(--gv-main-mid, #24493A) 100%)', boxShadow: '0 18px 44px rgba(27,56,40,0.30)', zIndex: 3 }}>
          <p style={{ margin: '0 4px', fontSize: 17, fontWeight: 800, color: '#EED98A' }}>Choose how you apply</p>
          <div style={{ height: 12 }} />
          <RoleApplyCards tiles={ROLE_TILES} onPick={() => {}} />
        </div>

        {/* Stat strip overlapping the hero */}
        <div style={{ position: 'relative', zIndex: 2, marginTop: -44, padding: '0 56px', paddingRight: 56 + 372 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ ...hot(s.sec), display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: NEU.surface, borderRadius: 16, boxShadow: NEU.outSm, minWidth: 0 }}>
                <NeuIconDisc gradient={s.gradient} icon={s.icon} size={38} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.muted }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: NEU.ink, lineHeight: 1.2 }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main column */}
        <div style={{ padding: '22px 56px 56px', paddingRight: 56 + 372 }}>
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 14, background: 'rgba(27,56,40,0.06)', marginBottom: 18 }}>
            {[{ l: 'Overview', i: LayoutGrid, on: true }, { l: 'You', i: User }, { l: 'Reviews', i: Star }].map((t) => (
              <span key={t.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, background: t.on ? '#FFFFFF' : 'transparent', boxShadow: t.on ? '0 2px 6px rgba(27,56,40,0.10)' : undefined, color: t.on ? NEU.ink : NEU.inkSoft }}>
                <t.i size={15} strokeWidth={1.8} />{t.l}
              </span>
            ))}
          </div>

          <div style={{ ...hot('about'), background: NEU.surface, borderRadius: 22, padding: '26px 28px', boxShadow: NEU.outSm }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>About the Conference</h3>
            {p.description.trim()
              ? <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: NEU.ink, whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description.trim()}</p>
              : <p style={{ margin: 0, fontSize: 15, color: NEU.muted, fontStyle: 'italic' }}>Your description goes here</p>}
            {p.links.length > 0 && (
              <div style={{ ...hot('links'), display: 'flex', gap: 10, marginTop: 18, width: 'fit-content', borderRadius: 999 }}>
                {p.links.map((k) => {
                  const m = BRAND[k];
                  return (
                    <span key={k} style={{ width: 38, height: 38, borderRadius: 999, background: m ? (SOCIAL_BG[k] ?? m.hex) : 'var(--gv-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
                      {m ? <svg viewBox="0 0 24 24" width={20} height={20} fill="#FFFFFF"><path d={m.path} /></svg> : <Globe size={20} strokeWidth={2} />}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Committees, the page's card row */}
          <div style={{ ...hot('committees'), display: 'flex', gap: 18, marginTop: 52, paddingTop: 4 }}>
            {p.committees.slice(0, 3).map((c) => {
              const seats = c.roster?.length ?? 0;
              return (
                <div key={c.key} style={{ position: 'relative', flex: '0 0 230px', background: NEU.surface, borderRadius: 22, boxShadow: NEU.outSm, padding: '46px 18px 18px', textAlign: 'center' }}>
                  <span style={{ position: 'absolute', top: -34, left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>{p.renderEmblem(c, 68)}</span>
                  {c.abbreviation && <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', color: '#B08A2E' }}>{c.abbreviation.toUpperCase()}</p>}
                  <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>{c.name}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: NEU.inkSoft }}>{seats} {seats === 1 ? 'seat' : 'seats'}</p>
                  <div style={{ height: 1, background: 'rgba(27,56,40,0.10)', margin: '14px 0 12px' }} />
                  <ol style={{ margin: 0, paddingLeft: 18, textAlign: 'left', fontSize: 12.5, lineHeight: 1.5, color: NEU.ink, minHeight: 38 }}>
                    {(c.topics ?? []).filter((t) => t.trim()).slice(0, 2).map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: NEU.muted }}>
                    <span>0/{seats} FILLED</span><span>0%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: 'rgba(27,56,40,0.10)', marginTop: 5 }} />
                  <div style={{ marginTop: 14, padding: '9px 0', borderRadius: 12, border: '1.5px solid rgba(27,56,40,0.35)', fontSize: 13, fontWeight: 700 }}>View members</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
