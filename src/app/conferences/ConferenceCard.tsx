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
//
// `heroCompact` is the PHOTO-FORWARD hero tier, used ONLY by the Stagefront
// hero "up next" rail: the banner photo fills the entire 188px card (cover)
// under a forest-tinted scrim that darkens toward the bottom; the logo floats
// top-left over the photo; the name is overlaid in bold white Outfit; the four
// key facts (location+flag · dates · fee · attendees) sit in a 2×2 micro-grid
// in the photo's lower zone with the APPLY pill bottom-right. Cards without a
// banner fall back to the forest gradient + watermark acronym. This tier
// completely replaces the banner-band anatomy — the classic layout below is
// never reached when heroCompact is set, so explore/near-you/calendar are
// untouched.
// `goldGlow` adds a premium golden outer glow + an overlapping gavel disc that
// straddles the card's top-right corner — hero-only, never on explore/near-you.
// The disc renders in a positioned WRAPPER around the card (not inside the
// article) so the article's `overflow-hidden` — required for the banner band's
// rounded corners — can never clip it. The hover lift moves to the wrapper in
// this branch so disc and card travel together.
// `action` picks the foot-row affordance: 'view' (default — the plain VIEW →
// text used by explore/near-you/calendar) or 'apply' (a gold pill APPLY button,
// hero-only). Non-hero consumers stay byte-identical.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { ArrowRight, Users, CalendarDays, Gavel, MapPin } from 'lucide-react';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// Photo-forward hero cards: kill the Ken Burns zoom + hover lift for users who
// asked the OS for less motion. Scoped to the hero tier's own class names.
const PHOTO_REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .gv-photo-card, .gv-photo-card img, .gv-photo-lift { transition: none !important; }
  .gv-photo-card img, .gv-photo-lift { transform: none !important; }
}`;

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
  conf, hovered, onHover, onLeave, onClick, compact = false, heroCompact = false, goldGlow = false, action = 'view',
}: {
  conf: CardConference;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  /** Denser variant for narrow vertical rails. Default false — explore unchanged. */
  compact?: boolean;
  /** Still-denser tier for the Stagefront hero rail (implies compact spacing). Default false. */
  heroCompact?: boolean;
  /** Premium gold outer glow + overlapping gavel disc. Hero-only. Default false. */
  goldGlow?: boolean;
  /** Foot-row affordance: 'view' (plain VIEW → text, default) or 'apply' (gold pill button, hero-only). */
  action?: 'view' | 'apply';
}) {
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const initials = conf.acronym.slice(0, 3).toUpperCase();
  const [g0, g1] = gradientFor(conf.acronym);
  // heroCompact reuses compact's tighter horizontal padding.
  const dense = compact || heroCompact;
  const padX = dense ? 'px-4' : 'px-5';

  // Layered golden glow — soft, static, tasteful (deepens slightly on hover).
  const glowShadow = hovered
    ? '0 0 0 1px rgba(238,217,138,0.55), 0 6px 20px rgba(182,135,31,0.30), 0 18px 46px rgba(238,217,138,0.24), 0 2px 8px rgba(27,56,40,0.10)'
    : '0 0 0 1px rgba(238,217,138,0.40), 0 4px 16px rgba(182,135,31,0.22), 0 12px 34px rgba(238,217,138,0.18)';

  // ── Photo-forward hero tier ───────────────────────────────────────────────
  // The banner photo IS the card: full-bleed cover, forest-tinted scrim heavier
  // at the bottom, logo floating top-left, name + 2×2 fact micro-grid + APPLY
  // pill overlaid on the photo's lower zone. Fixed 188px so three stack inside
  // the one-viewport hero at 1366×768.
  const card = heroCompact ? (
    <article
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="gv-photo-card cursor-pointer overflow-hidden"
      style={{
        position: 'relative',
        height: '188px',
        backgroundColor: '#14241B',
        // Solid, defined edge over the glow — stronger card definition.
        border: goldGlow ? '1px solid rgba(238,217,138,0.75)' : '1px solid rgba(221,212,192,0.9)',
        borderRadius: '20px',
        transform: goldGlow ? undefined : hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: goldGlow
          ? glowShadow
          : hovered
            ? '0 20px 48px rgba(27,56,40,0.16), 0 2px 8px rgba(27,56,40,0.08)'
            : '0 1px 3px rgba(27,56,40,0.05)',
        transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease, border-color 260ms ease',
      }}
    >
      <style>{PHOTO_REDUCED_MOTION_CSS}</style>

      {/* Full-bleed banner photo — or forest gradient + watermark fallback */}
      {conf.banner_url ? (
        <img
          src={conf.banner_url}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            transform: hovered ? 'scale(1.045)' : 'scale(1)',
            transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${g0} 0%, ${g1} 100%)` }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.1 }} />
          <span
            aria-hidden
            style={{
              position: 'absolute', right: '16px', top: '16px',
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '46px', lineHeight: 1,
              color: 'rgba(238,217,138,0.13)', letterSpacing: '0.02em', userSelect: 'none',
            }}
          >
            {conf.acronym.slice(0, 6)}
          </span>
        </>
      )}

      {/* Warm forest-tinted scrim — heavier at the bottom for text legibility,
          a whisper at the top so the floating logo still reads on bright shots */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(10,22,16,0.93) 0%, rgba(12,26,19,0.66) 34%, rgba(18,36,27,0.18) 64%, rgba(12,26,19,0.38) 100%)',
        }}
      />

      {/* Free-floating logo — top-left over the photo */}
      <div style={{ position: 'absolute', top: '12px', left: '14px' }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: '40px', height: '40px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 6px 14px rgba(6,14,10,0.6))',
            }}
          />
        ) : (
          <div
            style={{
              width: '34px', height: '34px', borderRadius: '10px',
              backgroundColor: 'rgba(237,231,216,0.92)', border: '1px solid rgba(238,217,138,0.5)',
              boxShadow: '0 4px 12px rgba(6,14,10,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '9px', fontFamily: "'Outfit', sans-serif", color: '#1B3828', fontWeight: 700, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* Lower zone: acronym eyebrow · overlaid name · 2×2 facts + APPLY */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 14px 12px' }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '8.5px', letterSpacing: '0.14em', color: '#EED98A', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>
        <h3
          style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '15.5px', lineHeight: 1.18,
            color: '#FAF8F3', margin: 0, textShadow: '0 1px 12px rgba(0,0,0,0.5)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {conf.full_name}
        </h3>
        <div className="flex items-end justify-between gap-3" style={{ marginTop: '8px' }}>
          {/* 2×2 fact micro-grid: location+flag | dates · fee | attendees */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, auto) auto',
              columnGap: '14px', rowGap: '5px', justifyContent: 'start', alignItems: 'center', minWidth: 0,
            }}
          >
            <span className="flex items-center gap-1" style={{ minWidth: 0 }}>
              <MapPin size={11} style={{ color: '#EED98A', flexShrink: 0 }} />
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={conf.country}
                  style={{ width: '15px', height: '11px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                />
              )}
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: '10.5px',
                  color: 'rgba(237,231,216,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {conf.city}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={11} style={{ color: 'rgba(237,231,216,0.66)', flexShrink: 0 }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em', fontSize: '9.5px', color: 'rgba(237,231,216,0.8)', whiteSpace: 'nowrap' }}>
                {formatDateRange(conf.start_date, conf.end_date)}
              </span>
            </span>
            {conf.fee_amount === 0 ? (
              <span
                style={{
                  justifySelf: 'start', fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.08em', color: '#BFEBD1', backgroundColor: 'rgba(42,90,60,0.55)',
                  border: '1px solid rgba(127,214,160,0.35)', padding: '1.5px 8px', borderRadius: '9999px',
                }}
              >
                FREE
              </span>
            ) : (
              <span
                style={{
                  justifySelf: 'start', fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  color: '#EED98A', backgroundColor: 'rgba(238,217,138,0.14)',
                  border: '1px solid rgba(238,217,138,0.32)', padding: '1.5px 8px', borderRadius: '9999px', whiteSpace: 'nowrap',
                }}
              >
                {conf.fee_currency} {conf.fee_amount.toFixed(0)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={11} style={{ color: 'rgba(237,231,216,0.66)', flexShrink: 0 }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '9.5px', color: 'rgba(237,231,216,0.8)' }}>
                {conf.expected_delegates.toLocaleString()}
              </span>
            </span>
          </div>
          {action === 'apply' ? (
            <div className="flex-shrink-0"><ApplyButton /></div>
          ) : (
            <span
              className="flex items-center gap-1 text-[11px] font-bold flex-shrink-0"
              style={{ color: '#EDE7D8', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              VIEW
              <ArrowRight
                size={13}
                style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1)' }}
              />
            </span>
          )}
        </div>
      </div>
    </article>
  ) : (
    <article
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="cursor-pointer overflow-hidden"
      style={{
        position: 'relative',
        backgroundColor: '#FAF8F3',
        border: goldGlow
          ? '1px solid rgba(238,217,138,0.7)'
          : hovered ? '1px solid rgba(27,56,40,0.55)' : '1px solid #DDD4C0',
        borderRadius: '20px',
        // When goldGlow, the hover lift lives on the outer wrapper so the
        // overlapping gavel disc travels with the card.
        transform: goldGlow ? undefined : hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: goldGlow
          ? glowShadow
          : hovered
            ? '0 20px 48px rgba(27,56,40,0.16), 0 2px 8px rgba(27,56,40,0.08)'
            : '0 1px 3px rgba(27,56,40,0.05)',
        transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease, border-color 260ms ease',
      }}
    >
      {/* Banner band */}
      <div className="relative" style={{ height: heroCompact ? '42px' : compact ? '72px' : '104px', overflow: 'hidden' }}>
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
                fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: heroCompact ? '30px' : compact ? '38px' : '52px', lineHeight: 1,
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
              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.12em',
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
      <div className={padX} style={{ marginTop: heroCompact ? '-22px' : compact ? '-24px' : '-36px', position: 'relative' }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: heroCompact ? '44px' : compact ? '52px' : '72px', height: heroCompact ? '44px' : compact ? '52px' : '72px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.35))',
            }}
          />
        ) : (
          <div
            style={{
              width: heroCompact ? '40px' : compact ? '44px' : '56px', height: heroCompact ? '40px' : compact ? '44px' : '56px', borderRadius: dense ? '12px' : '15px',
              backgroundColor: '#EDE7D8', border: '3px solid #FAF8F3',
              boxShadow: '0 4px 12px rgba(27,56,40,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: dense ? '10px' : '12px', fontFamily: "'Outfit', sans-serif", color: '#1B3828', fontWeight: 700, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
              {initials}
            </span>
          </div>
        )}
      </div>

      <div className={`${padX} ${heroCompact ? 'pt-1 pb-2.5' : compact ? 'pt-2 pb-4' : 'pt-3 pb-5'}`}>
        {/* Acronym eyebrow */}
        <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: dense ? '9px' : '10px', letterSpacing: '0.14em', color: '#B6871F', margin: heroCompact ? '0 0 2px 0' : '0 0 3px 0' }}>
          {conf.acronym}
        </p>

        {/* Full name */}
        <h3
          className={heroCompact ? 'text-[13.5px] font-bold leading-snug mb-1.5' : compact ? 'text-[14px] font-bold leading-snug mb-2' : 'text-[15px] font-bold leading-snug mb-2.5'}
          style={{
            color: '#1C1410', fontFamily: "'Outfit', sans-serif",
            display: '-webkit-box', WebkitLineClamp: dense ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            minHeight: dense ? undefined : '2.6em',
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
        <div className={`flex items-center gap-1.5 ${heroCompact ? 'mb-1.5' : compact ? 'mb-3' : 'mb-4'}`}>
          <CalendarDays size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em' }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
        </div>

        {/* Foot row */}
        <div
          className={`flex items-center justify-between ${heroCompact ? 'pt-1.5' : compact ? 'pt-2.5' : 'pt-3.5'}`}
          style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(27,56,40,0.06)', color: '#4A4238', fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              <Users size={10} style={{ color: '#9A8A78' }} />
              {conf.expected_delegates.toLocaleString()}
            </span>
            {conf.fee_amount === 0 ? (
              <span
                className="text-[10px] px-2 py-1 rounded-full font-bold"
                style={{ backgroundColor: 'rgba(61,122,82,0.14)', color: '#2A5A3C', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em' }}
              >
                FREE
              </span>
            ) : (
              <span
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(182,135,31,0.1)', color: '#8A6614', fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {conf.fee_currency} {conf.fee_amount.toFixed(0)}
              </span>
            )}
          </div>
          {action === 'apply' ? (
            <ApplyButton />
          ) : (
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
          )}
        </div>
      </div>
    </article>
  );

  if (!goldGlow) return card;

  // goldGlow: positioned wrapper carries the hover lift and hosts the gavel
  // disc as a SIBLING of the article, above it in z-order — the article keeps
  // its own overflow-hidden (for the banner band's rounded corners) but can no
  // longer slice the disc.
  return (
    <div
      className={heroCompact ? 'gv-photo-lift' : undefined}
      style={{
        position: 'relative',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {card}
      {/* Gold gavel disc — straddles the top-right corner, fully visible. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-11px',
          right: '-11px',
          zIndex: 3,
          width: '34px',
          height: '34px',
          borderRadius: '9999px',
          background: 'linear-gradient(145deg, #F3E3A1 0%, #EED98A 45%, #C99A2A 100%)',
          border: '2px solid #FAF8F3',
          boxShadow: '0 4px 12px rgba(182,135,31,0.45), 0 0 0 1px rgba(182,135,31,0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Gavel size={16} strokeWidth={2.25} color="#4A3410" />
      </span>
    </div>
  );
}

/** Gold pill APPLY button for the hero cards' foot row. The whole card is the
 *  click target (routing to /conferences/[slug]); this button just bubbles. */
function ApplyButton() {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-1.5 cursor-pointer"
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 800,
        fontSize: '11px',
        letterSpacing: '0.08em',
        color: '#1B3828',
        backgroundColor: hover ? '#F3E3A1' : '#EED98A',
        border: 'none',
        padding: '6px 14px',
        borderRadius: '9999px',
        transform: hover ? 'translateY(-1.5px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 6px 14px rgba(182,135,31,0.4), 0 0 0 1px rgba(182,135,31,0.3)'
          : '0 3px 8px rgba(182,135,31,0.28), 0 0 0 1px rgba(182,135,31,0.22)',
        transition: 'background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
      }}
    >
      APPLY
      <ArrowRight size={12} strokeWidth={2.75} />
    </button>
  );
}
