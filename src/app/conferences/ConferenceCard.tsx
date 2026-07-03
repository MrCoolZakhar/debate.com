'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Shared conference card — ONE definition used by both the explore directory
// (/conferences/explore) and the Stagefront landing (/conferences).
//
// Anatomy: banner band (104px, banner_url + top-dark gradient, or gradient +
// monogram fallback) · free-floating logo overlapping the band (marginTop -36px,
// 72px contain + drop-shadow) · acronym eyebrow · 2-line name · flag + city ·
// calendar + dates · foot row (delegates chip · fee/FREE chip · VIEW arrow).
// Hover lifts the card and deepens the shadow so it reads as a floating object.
//
// `compact` (default false — the explore directory is untouched) shrinks the
// same anatomy for narrow rails (~340–380px): 72px banner band, smaller logo
// overlap and tighter padding. One definition, two densities — never fork it.
// ─────────────────────────────────────────────────────────────────────────────

import { ArrowRight, Users, CalendarDays } from 'lucide-react';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// The minimal conference shape the card renders. Both the explore `Conference`
// type and the landing `LabConference` type are structurally compatible.
export interface CardConference {
  slug: string;
  full_name: string;
  acronym: string;
  country: string;
  city: string;
  start_date: string;
  end_date: string;
  expected_delegates: number;
  fee_amount: number;
  fee_currency: string;
  format?: string;
  logo_url: string | null;
  banner_url: string | null;
}

// Deterministic forest-tone gradient per conference (used when no banner art exists)
const CARD_GRADIENTS: [string, string][] = [
  ['#16301F', '#2A5A3C'],
  ['#1B3828', '#27573A'],
  ['#122718', '#1B3828'],
  ['#1E4029', '#356744'],
];

export function gradientFor(acronym: string): [string, string] {
  let h = 0;
  for (let i = 0; i < acronym.length; i++) h = (h * 31 + acronym.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

export function ConferenceCard({
  conf, hovered, onHover, onLeave, onClick, compact = false,
}: {
  conf: CardConference;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  /** Denser variant for narrow vertical rails. Default false — explore unchanged. */
  compact?: boolean;
}) {
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const initials = conf.acronym.slice(0, 3).toUpperCase();
  const [g0, g1] = gradientFor(conf.acronym);
  const padX = compact ? 'px-4' : 'px-5';

  return (
    <article
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="cursor-pointer overflow-hidden"
      style={{
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid rgba(27,56,40,0.55)' : '1px solid #DDD4C0',
        borderRadius: '20px',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 20px 48px rgba(27,56,40,0.16), 0 2px 8px rgba(27,56,40,0.08)'
          : '0 1px 3px rgba(27,56,40,0.05)',
        transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease, border-color 260ms ease',
      }}
    >
      {/* Banner band */}
      <div className="relative" style={{ height: compact ? '72px' : '104px', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <>
            <img
              src={conf.banner_url}
              alt=""
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,36,27,0.55) 0%, rgba(20,36,27,0.08) 55%)' }} />
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(120deg, ${g0} 0%, ${g1} 100%)` }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.1 }} />
            <span
              aria-hidden
              style={{
                position: 'absolute', right: '14px', bottom: '-6px',
                fontFamily: "'DM Mono', monospace", fontSize: compact ? '38px' : '52px', lineHeight: 1,
                color: 'rgba(238,217,138,0.13)', letterSpacing: '0.02em', userSelect: 'none',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          </>
        )}
        {/* Format chip */}
        {conf.format && (
          <span
            className="absolute top-3 right-3"
            style={{
              fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.12em',
              color: '#FAF8F3', backgroundColor: 'rgba(20,36,27,0.45)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(250,248,243,0.18)',
              padding: '3px 10px', borderRadius: '9999px',
            }}
          >
            {conf.format.toUpperCase().replace('-', ' ')}
          </span>
        )}
      </div>

      {/* Logo overlapping the band — free-floating */}
      <div className={padX} style={{ marginTop: compact ? '-24px' : '-36px', position: 'relative' }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: compact ? '52px' : '72px', height: compact ? '52px' : '72px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.35))',
            }}
          />
        ) : (
          <div
            style={{
              width: compact ? '44px' : '56px', height: compact ? '44px' : '56px', borderRadius: compact ? '12px' : '15px',
              backgroundColor: '#EDE7D8', border: '3px solid #FAF8F3',
              boxShadow: '0 4px 12px rgba(27,56,40,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: compact ? '10px' : '12px', fontFamily: "'DM Mono', monospace", color: '#1B3828', fontWeight: 700 }}>
              {initials}
            </span>
          </div>
        )}
      </div>

      <div className={`${padX} ${compact ? 'pt-2 pb-4' : 'pt-3 pb-5'}`}>
        {/* Acronym eyebrow */}
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: compact ? '9px' : '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>

        {/* Full name */}
        <h3
          className={compact ? 'text-[14px] font-bold leading-snug mb-2' : 'text-[15px] font-bold leading-snug mb-2.5'}
          style={{
            color: '#1C1410', fontFamily: "'Outfit', sans-serif",
            display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            minHeight: compact ? undefined : '2.6em',
          }}
        >
          {conf.full_name}
        </h3>

        {/* Location + dates */}
        <div className="flex items-center gap-1.5 mb-1">
          {flagUrl && (
            <img
              src={flagUrl}
              alt={conf.country}
              style={{ width: '18px', height: '13px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
            />
          )}
          <span className="text-xs" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
            {conf.city}, {conf.country}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 ${compact ? 'mb-3' : 'mb-4'}`}>
          <CalendarDays size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
        </div>

        {/* Foot row */}
        <div
          className={`flex items-center justify-between ${compact ? 'pt-2.5' : 'pt-3.5'}`}
          style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(27,56,40,0.06)', color: '#4A4238', fontFamily: "'DM Mono', monospace" }}
            >
              <Users size={10} style={{ color: '#9A8A78' }} />
              {conf.expected_delegates.toLocaleString()}
            </span>
            {conf.fee_amount === 0 ? (
              <span
                className="text-[10px] px-2 py-1 rounded-full font-bold"
                style={{ backgroundColor: 'rgba(61,122,82,0.14)', color: '#2A5A3C', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}
              >
                FREE
              </span>
            ) : (
              <span
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(182,135,31,0.1)', color: '#8A6614', fontFamily: "'DM Mono', monospace" }}
              >
                {conf.fee_currency} {conf.fee_amount.toFixed(0)}
              </span>
            )}
          </div>
          <span
            className="flex items-center gap-1 text-[11px] font-bold"
            style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
          >
            VIEW
            <ArrowRight
              size={13}
              style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1)' }}
            />
          </span>
        </div>
      </div>
    </article>
  );
}
