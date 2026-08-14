'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Shared conference card, ONE definition used by both the explore directory
// (/conferences/explore) and the Stagefront landing (/conferences).
//
// Anatomy: banner band (104px, banner_url + top-dark gradient, or gradient +
// monogram fallback) with a glass date chip top-left · free-floating logo
// overlapping the band (marginTop -36px, 72px contain + drop-shadow) · fee
// bubble (currency symbol + amount) straddling the banner/body seam on the
// right · BIG "ACRONYM YYYY" heading · "City, CC" location line · foot row
// (delegates chip · APPLY pill, or APPLIED state when the viewer already has
// an application).
// Hover lifts the card and deepens the shadow so it reads as a floating object.
//
// `compact` (default false, the explore directory is untouched) shrinks the
// same anatomy for narrow rails (~340–380px): 72px banner band, smaller logo
// overlap and tighter padding. One definition, two densities, never fork it.
//
// `heroCompact` is the PHOTO-FORWARD hero tier, used ONLY by the Stagefront
// hero "up next" rail: the banner photo fills the entire 188px card (cover)
// under a forest-tinted scrim that darkens toward the bottom; the logo floats
// top-left over the photo; the name is overlaid in bold white Outfit; the four
// key facts (location+flag · dates · fee · attendees) sit in a 2×2 micro-grid
// in the photo's lower zone with the APPLY pill bottom-right. Cards without a
// banner fall back to the forest gradient + watermark acronym. This tier
// completely replaces the banner-band anatomy, the classic layout below is
// never reached when heroCompact is set, so explore/near-you/calendar are
// untouched.
// `goldGlow` adds a premium golden outer glow + an overlapping gavel disc that
// straddles the card's top-right corner, hero-only, never on explore/near-you.
// The disc renders in a positioned WRAPPER around the card (not inside the
// article) so the article's `overflow-hidden`, required for the banner band's
// rounded corners, can never clip it. The hover lift moves to the wrapper in
// this branch so disc and card travel together.
// `applied` marks conferences the signed-in viewer already has an application
// for: the APPLY pill becomes a solid forest APPLIED ✓ badge. Consumers own
// the lookup (one applications query per page) and pass the boolean down.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { ArrowRight, Check, Users, CalendarDays, Gavel, MapPin } from 'lucide-react';
import { getCountryByName } from '@/lib/countries';
import { currencySymbol, formatFeeAmountCompact } from '@/lib/utils';
import { LogoDisc } from '@/components/LogoDisc';
import { appendEditionYear } from '@/lib/presetNames';
import { formatConferenceDates } from '@/lib/conferenceDates';

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
  start_date: string | null;
  end_date: string | null;
  /** When the dates are "to be decided", the date chip is omitted entirely. */
  dates_tbd?: boolean;
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

function formatDateRange(start: string | null, end: string | null): string {
  return formatConferenceDates(start, end, { style: 'dmy-end-year' });
}

export function ConferenceCard({
  conf, hovered, onHover, onLeave, onClick, compact = false, heroCompact = false, goldGlow = false, applied = false, member = false,
}: {
  conf: CardConference;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  /** Denser variant for narrow vertical rails. Default false, explore unchanged. */
  compact?: boolean;
  /** Still-denser tier for the Stagefront hero rail (implies compact spacing). Default false. */
  heroCompact?: boolean;
  /** Premium gold outer glow + overlapping gavel disc. Hero-only. Default false. */
  goldGlow?: boolean;
  /** The signed-in viewer already has an application for this conference. */
  applied?: boolean;
  /** The signed-in viewer is already PART of this conference (organiser, chair
   *  or accepted/assigned delegate), the CTA becomes VIEW →. Wins over applied. */
  member?: boolean;
}) {
  const countryObj = getCountryByName(conf.country);
  // "Oxford, GB", ISO country code instead of the full country name (or flag)
  const countryCode = countryObj ? countryObj.code.toUpperCase() : conf.country;
  const editionYear = conf.start_date ? conf.start_date.slice(0, 4) : null;
  // Heading = acronym + edition year, but never doubled if the acronym/name
  // already carries that year (e.g. "Hult 2026" stays "Hult 2026").
  const headingLabel = appendEditionYear(conf.acronym, editionYear);
  const initials = conf.acronym.slice(0, 3).toUpperCase();
  // Hide the date chip entirely when dates are TBD or missing (no "TBD" text).
  const showDates = !conf.dates_tbd && !!conf.start_date;
  const [g0, g1] = gradientFor(conf.acronym);
  // heroCompact reuses compact's tighter horizontal padding.
  const dense = compact || heroCompact;
  const padX = dense ? 'px-4' : 'px-5';

  // Layered golden glow, soft, static, tasteful (deepens slightly on hover).
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
        // Solid, defined edge over the glow, stronger card definition.
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

      {/* Full-bleed banner photo, or forest gradient + watermark fallback */}
      {conf.banner_url ? (
        <img
          src={conf.banner_url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            transform: hovered ? 'scale(1.045)' : 'scale(1)',
            transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${g0} 0%, ${g1} 100%)` }} />
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

      {/* Warm forest-tinted scrim, heavier at the bottom for text legibility,
          a whisper at the top so the floating logo still reads on bright shots */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(10,22,16,0.93) 0%, rgba(12,26,19,0.66) 34%, rgba(18,36,27,0.18) 64%, rgba(12,26,19,0.38) 100%)',
        }}
      />

      {/* Date chip, glass pill, top-right over the photo (omitted when TBD/missing) */}
      {showDates && (
        <span
          className="flex items-center gap-1"
          style={{
            position: 'absolute', top: '12px', right: '14px', zIndex: 2,
            backgroundColor: 'rgba(20,36,27,0.5)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(250,248,243,0.2)',
            padding: '3px 10px', borderRadius: '9999px',
          }}
        >
          <CalendarDays size={12} style={{ color: '#EED98A', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em', fontSize: '11.5px', color: '#FAF8F3', whiteSpace: 'nowrap' }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
        </span>
      )}

      {/* Floating logo disc, top-left over the photo */}
      <div style={{ position: 'absolute', top: '12px', left: '14px' }}>
        <LogoDisc
          src={conf.logo_url}
          alt={conf.acronym}
          size={40}
          fallbackText={initials}
          style={{ boxShadow: '0 6px 14px rgba(6,14,10,0.45)' }}
        />
      </div>

      {/* Lower zone: BIG acronym + edition year · facts row + APPLY */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 14px 12px' }}>
        <h3
          style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '27px', lineHeight: 1.05,
            letterSpacing: '0.01em', color: '#FAF8F3', margin: 0, textShadow: '0 1px 12px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {headingLabel}
        </h3>
        <div className="flex items-end justify-between gap-3" style={{ marginTop: '7px' }}>
          {/* Facts row: location+flag · fee · attendees (dates live top-right on the photo) */}
          <div className="flex items-center flex-wrap" style={{ columnGap: '12px', rowGap: '5px', minWidth: 0 }}>
            <span className="flex items-center gap-1" style={{ minWidth: 0 }}>
              <MapPin size={13} style={{ color: '#EED98A', flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: '11.5px',
                  color: 'rgba(237,231,216,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {conf.city}, {countryCode}
              </span>
            </span>
            {conf.fee_amount === 0 ? (
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.08em', color: '#BFEBD1', backgroundColor: 'rgba(42,90,60,0.55)',
                  border: '1px solid rgba(127,214,160,0.35)', padding: '2px 9px', borderRadius: '9999px',
                }}
              >
                FREE
              </span>
            ) : (
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: '#EED98A', backgroundColor: 'rgba(238,217,138,0.14)',
                  border: '1px solid rgba(238,217,138,0.32)', padding: '2px 9px', borderRadius: '9999px', whiteSpace: 'nowrap',
                }}
              >
                {currencySymbol(conf.fee_currency)}{formatFeeAmountCompact(conf.fee_amount)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={13} style={{ color: 'rgba(237,231,216,0.66)', flexShrink: 0 }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11.5px', color: 'rgba(237,231,216,0.8)' }}>
                {conf.expected_delegates.toLocaleString()}
              </span>
            </span>
          </div>
          <div className="flex-shrink-0"><ApplyButton applied={applied} member={member} /></div>
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
              loading="lazy"
              decoding="async"
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
        {/* Date chip, glass pill, top-left, so the dates read first (omitted when TBD/missing) */}
        {showDates && (
          <span
            className="absolute top-3 left-3 flex items-center gap-1"
            style={{
              backgroundColor: 'rgba(20,36,27,0.5)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(250,248,243,0.2)',
              padding: '3px 10px', borderRadius: '9999px',
            }}
          >
            <CalendarDays size={12} style={{ color: '#EED98A', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em', fontSize: '11.5px', color: '#FAF8F3', whiteSpace: 'nowrap' }}>
              {formatDateRange(conf.start_date, conf.end_date)}
            </span>
          </span>
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

      {/* Fee bubble, straddles the seam between the banner photo and the
          card body, right-hand side, with the real currency symbol */}
      <div
        style={{
          position: 'absolute', zIndex: 2,
          right: dense ? '14px' : '18px',
          top: `${(compact ? 72 : 104) - 17}px`,
          display: 'inline-flex', alignItems: 'baseline', gap: '2px',
          backgroundColor: '#FAF8F3',
          border: conf.fee_amount === 0 ? '2px solid rgba(61,122,82,0.5)' : '2px solid rgba(182,135,31,0.45)',
          borderRadius: '9999px', padding: '5px 13px',
          boxShadow: '0 6px 16px rgba(27,56,40,0.18)',
        }}
      >
        {conf.fee_amount === 0 ? (
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '14px', letterSpacing: '0.08em', color: '#2A5A3C' }}>
            FREE
          </span>
        ) : (
          <>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '14.5px', color: '#B6871F' }}>
              {currencySymbol(conf.fee_currency)}
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '16.5px', color: '#1C1410' }}>
              {formatFeeAmountCompact(conf.fee_amount)}
            </span>
          </>
        )}
      </div>

      {/* Logo disc overlapping the band */}
      <div className={padX} style={{ marginTop: heroCompact ? '-22px' : compact ? '-24px' : '-36px', position: 'relative' }}>
        <LogoDisc
          src={conf.logo_url}
          alt={conf.acronym}
          size={heroCompact ? 44 : compact ? 52 : 72}
          fallbackText={initials}
          style={{ boxShadow: '0 8px 16px rgba(16,28,21,0.28)' }}
        />
      </div>

      <div className={`${padX} ${heroCompact ? 'pt-1 pb-2.5' : compact ? 'pt-2 pb-4' : 'pt-3 pb-5'}`}>
        {/* Acronym + edition year, the card's main heading */}
        <h3
          className={heroCompact ? 'mb-1.5' : compact ? 'mb-2' : 'mb-2.5'}
          style={{
            color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            fontSize: dense ? '24px' : '30px', lineHeight: 1.05, letterSpacing: '0.01em',
            marginTop: dense ? '2px' : '4px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {headingLabel}
        </h3>

        {/* Location */}
        <div className={`flex items-center gap-1.5 ${heroCompact ? 'mb-1.5' : compact ? 'mb-3' : 'mb-4'}`}>
          <span className="text-[13px]" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
            {conf.city}, {countryCode}
          </span>
        </div>

        {/* Foot row */}
        <div
          className={`flex items-center justify-between ${heroCompact ? 'pt-1.5' : compact ? 'pt-2.5' : 'pt-3.5'}`}
          style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}
        >
          <span
            className="flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(27,56,40,0.06)', color: '#4A4238', fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            <Users size={13} style={{ color: '#9A8A78' }} />
            {conf.expected_delegates.toLocaleString()}
          </span>
          <ApplyButton applied={applied} member={member} />
        </div>
      </div>
    </article>
  );

  if (!goldGlow) return card;

  // goldGlow: positioned wrapper carries the hover lift and hosts the gavel
  // disc as a SIBLING of the article, above it in z-order, the article keeps
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
      {/* Gold gavel disc, straddles the top-right corner, fully visible. */}
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

/** Gold pill APPLY button for the card foot row, a solid forest APPLIED ✓
 *  badge when the viewer already has an application, or a solid forest VIEW →
 *  pill when the viewer is already part of the conference (member wins over
 *  applied). The whole card is the click target (routing to
 *  /conferences/[slug]); the button just bubbles. */
function ApplyButton({ applied = false, member = false }: { applied?: boolean; member?: boolean }) {
  const [hover, setHover] = useState(false);
  if (member) {
    return (
      <button
        type="button"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="inline-flex items-center gap-1.5 cursor-pointer"
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: '10.5px',
          letterSpacing: '0.08em',
          color: '#EAF5EE',
          backgroundColor: hover ? '#356744' : '#2A5A3C',
          border: '1px solid rgba(127,214,160,0.45)',
          padding: '6px 13px',
          borderRadius: '9999px',
          transform: hover ? 'translateY(-1.5px)' : 'translateY(0)',
          boxShadow: hover
            ? '0 6px 14px rgba(27,56,40,0.35)'
            : '0 3px 8px rgba(27,56,40,0.25)',
          transition: 'background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
        }}
      >
        VIEW
        <ArrowRight size={12} strokeWidth={2.75} />
      </button>
    );
  }
  if (applied) {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: '10.5px',
          letterSpacing: '0.08em',
          color: '#EAF5EE',
          backgroundColor: '#2A5A3C',
          border: '1px solid rgba(127,214,160,0.45)',
          padding: '6px 13px',
          borderRadius: '9999px',
          boxShadow: '0 3px 8px rgba(27,56,40,0.25)',
        }}
      >
        APPLIED
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
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
