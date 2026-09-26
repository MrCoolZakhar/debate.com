'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Shared conference card, ONE definition used by both the explore directory
// (/conferences/explore) and the Stagefront landing (/conferences).
//
// The default tier is the LISTING card (CLAUDE.md §8, "The Explore page",
// item 6; 26 Sep 2026): Airbnb's search-result card in ivory, white, forest
// and gold. A white card with a soft shadow, a landscape 3:2 cover inset on
// top (the banner photo, or a pale wash with the acronym watermark), the
// conference's logo as a round disc over the photo's lower edge, then the
// text below: acronym large with the full name smaller beneath (two rows,
// never "…"), the verified check, round flag + city and country, the dates,
// format and delegates as an icon and a plain word, and the price in bold with
// the role in grey. The whole card is the link (pass `href` for a real <a>);
// there is no APPLY pill: the viewer's own state is a quiet check + word.
// A booked Spotlight keeps its gold edge, glow and tag; credit sponsored keeps
// the heart.
//
// `compact` (default false) is the same listing, a little denser.
//
// `variant="listing"` (Explore only; redesign 26 Sep 2026, owner: "use a
// similar thing with the cards"): a soft 3D white card on the ivory ground.
// The cover photo runs flush across the top of the card (4:3, the card's own
// rounded corners, the photo scales 1.03 on hover) and is the hero of the
// card; the logo disc overlaps its lower edge; the text sits below. The card
// lifts 3px on hover. A conference without a banner gets a pale fill with its
// logo centred large. Spotlight is the gold edge and glow plus the tag;
// credit sponsored keeps the heart. Every other caller keeps the inset card.
//
// `heroCompact` is the PHOTO-FORWARD hero tier, used ONLY by the Stagefront
// hero "up next" rail: the banner photo fills the entire 188px card (cover)
// under a forest-tinted scrim that darkens toward the bottom; the logo floats
// top-left over the photo (68px); the name is overlaid in bold white Outfit; the four
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
// for: the hero tier's APPLY pill becomes a solid forest APPLIED ✓ badge, the
// listing card says "Applied" with a check. Consumers own
// the lookup (one applications query per page) and pass the boolean down.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Users, CalendarDays, Gavel, MapPin, Monitor, Globe } from 'lucide-react';
import { getCountryByName } from '@/lib/countries';
import { currencySymbol, formatFeeAmountCompact } from '@/lib/utils';
import { TBD_PRICE, type DelegatePrice } from '@/lib/publicFees';
import { LogoDisc } from '@/components/LogoDisc';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { formatConferenceDates } from '@/lib/conferenceDates';
import VerifiedCheck from '@/components/VerifiedCheck';
import { CircleFlag } from '@/components/CircleFlag';
import { CreditSponsoredMark, SpotlightTag, SPOTLIGHT_GLOW, SPOTLIGHT_GLOW_HOVER } from '@/components/conferences/SpotlightTag';

// Photo-forward hero cards: kill the Ken Burns zoom + hover lift for users who
// asked the OS for less motion. Scoped to the hero tier's own class names.
// The listing card: no photo zoom for people who asked for less motion.
// Explore's listing card: a soft 3D white card on ivory (a light top edge,
// a hairline and a forest-tinted drop), lifted on hover.
const LISTING_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(27,56,40,0.06), 5px 7px 20px rgba(27,56,40,0.11), 0 1px 2px rgba(27,56,40,0.06)';
const LISTING_SHADOW_HOVER = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(27,56,40,0.07), 9px 14px 32px rgba(27,56,40,0.17), 0 2px 4px rgba(27,56,40,0.07)';

const LISTING_CSS = `
@media (prefers-reduced-motion: reduce) {
  .gv-listing-card, .gv-listing-photo { transition: none !important; }
  .gv-listing-photo, .gv-listing-card { transform: none !important; }
}`;

// Pale covers for a conference without a banner photo: ivory, pale green and
// pale gold washes (never a forest block, CLAUDE.md §8).
const PALE_COVERS: [string, string][] = [
  ['#E6EEE3', '#F4EFE2'],
  ['#EFE7D2', '#E3ECDF'],
  ['#F3EBD3', '#EAF0E6'],
  ['#E0EADC', '#F1EAD8'],
];

const FORMAT_WORDS: Record<string, string> = { 'in-person': 'In person', online: 'Online', hybrid: 'Hybrid' };
const FORMAT_GLYPHS: Record<string, typeof MapPin> = { 'in-person': MapPin, online: Monitor, hybrid: Globe };

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
  /** The public delegate price (publicFees.displayDelegatePrice). The fee_*
   *  columns above are never shown; absent means TBD. */
  delegate_price?: DelegatePrice;
  format?: string;
  logo_url: string | null;
  banner_url: string | null;
  /** Blue seal beside the name when true; nothing at all otherwise. */
  is_verified?: boolean;
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
  showFlag = true, spotlight = false, creditSponsored = false, href, variant = 'card',
}: {
  /** 'listing' = Explore's photo-forward soft 3D card: the photo flush across
   *  the top. Default 'card' (the inset white card) everywhere else. */
  variant?: 'card' | 'listing';
  conf: CardConference;
  /** Listing tier: the conference page. When set the card is a real link and
   *  `onClick` runs as a side effect only (e.g. record a spotlight click); it
   *  must not navigate itself. Without it the card navigates through
   *  `onClick` (role="link", Enter / Space). */
  href?: string;
  /** A booked Gavelling Spotlight: the small tag top right and the bright gold
   *  edge and glow (25 Sep 2026). */
  spotlight?: boolean;
  /** The conference's Store pays applicants' credit: "Credit sponsored" with a
   *  heart, right beside the fee. */
  creditSponsored?: boolean;
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
  /** Classic tier only: a round country flag before the location line (on by
   *  default; the owner wants a flag on every conference card, 25 Sep 2026). */
  showFlag?: boolean;
  /** Kept for callers; the listing card's name ALWAYS wraps (CLAUDE.md §8,
   *  never cut a name), so this no longer changes anything. */
  wrapTitle?: boolean;
}) {
  const countryObj = getCountryByName(conf.country);
  // "Oxford, GB", ISO country code instead of the full country name (or flag)
  const countryCode = countryObj ? countryObj.code.toUpperCase() : conf.country;
  const price = conf.delegate_price ?? TBD_PRICE;
  // Heading = acronym + edition year, but never doubled if the acronym/name
  // already carries that year (e.g. "Hult 2026" stays "Hult 2026").
  const headingLabel = conferenceAcronymLabel(conf);
  const initials = conf.acronym.slice(0, 3).toUpperCase();
  // Hide the date chip entirely when dates are TBD or missing (no "TBD" text).
  const showDates = !conf.dates_tbd && !!conf.start_date;
  const [g0, g1] = gradientFor(conf.acronym);
  // heroCompact reuses compact's tighter horizontal padding.
  const dense = compact || heroCompact;
  // Listing tier facts.
  const [p0, p1] = PALE_COVERS[(() => { let h = 0; for (let i = 0; i < conf.acronym.length; i++) h = (h * 31 + conf.acronym.charCodeAt(i)) >>> 0; return h % PALE_COVERS.length; })()];
  const countryName = countryObj?.name ?? conf.country;
  const showFullName = !!conf.full_name && conf.full_name.trim() !== headingLabel.trim() && conf.full_name.trim() !== conf.acronym.trim();
  const formatLabel = conf.format ? (FORMAT_WORDS[conf.format] ?? null) : null;
  const FormatIcon = conf.format ? FORMAT_GLYPHS[conf.format] : undefined;

  // Layered golden glow, soft, static, tasteful (deepens slightly on hover).
  const glowShadow = spotlight
    ? (hovered ? SPOTLIGHT_GLOW_HOVER : SPOTLIGHT_GLOW)
    : hovered
      ? '0 0 0 1px rgba(238,217,138,0.55), 0 6px 20px rgba(182,135,31,0.30), 0 18px 46px rgba(238,217,138,0.24), 0 2px 8px rgba(27,56,40,0.10)'
      : '0 0 0 1px rgba(238,217,138,0.40), 0 4px 16px rgba(182,135,31,0.22), 0 12px 34px rgba(238,217,138,0.18)';
  // A spotlight card is always glowing, whatever the caller passes.
  const glowing = goldGlow || spotlight;
  // Explore's photo-forward listing: the photo flush across the top of a
  // soft 3D white card.
  const bare = variant === 'listing' && !heroCompact;
  const hasBanner = !!conf.banner_url;
  // A bare card with no banner shows its logo large in the middle of the
  // pale fill, so the small disc over the edge would only repeat it.
  const edgeLogo = !bare || hasBanner;

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
        border: glowing ? '1px solid rgba(238,217,138,0.75)' : '1px solid rgba(221,212,192,0.9)',
        borderRadius: '20px',
        transform: glowing ? undefined : hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: glowing
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
              fontFamily: "var(--font-brand), sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '46px', lineHeight: 1,
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

      {/* Top-right cluster: the Spotlight tag (booked spotlights), then the
          date chip, glass pill (omitted when TBD/missing) */}
      {spotlight && (
        <span style={{ position: 'absolute', top: '12px', right: '14px', zIndex: 3 }}>
          <SpotlightTag size="sm" />
        </span>
      )}
      {showDates && (
        <span
          className="flex items-center gap-1"
          style={{
            position: 'absolute', top: spotlight ? '40px' : '12px', right: '14px', zIndex: 2,
            backgroundColor: 'rgba(20,36,27,0.5)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(250,248,243,0.2)',
            padding: '3px 10px', borderRadius: '9999px',
          }}
        >
          <CalendarDays size={12} style={{ color: '#EED98A', flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em', fontSize: '11.5px', color: '#FAF8F3', whiteSpace: 'nowrap' }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
        </span>
      )}

      {/* Floating logo disc, top-left over the photo. 68px (was 40, owner
          23 Sep 2026: "increase the size of the logo on the 3 highlighted
          conferences"); the name block starts about 118px down the 188px card,
          so the disc (12..80) never meets it, and the date chip is top-right. */}
      <div style={{ position: 'absolute', top: '12px', left: '14px' }}>
        <LogoDisc
          src={conf.logo_url}
          alt={conf.acronym}
          size={68}
          fallbackText={initials}
          style={{ boxShadow: '0 6px 14px rgba(6,14,10,0.45)' }}
        />
      </div>

      {/* Lower zone: BIG acronym + edition year · facts row + APPLY */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 14px 12px', containerType: 'inline-size' }}>
        <h3
          style={{
            fontFamily: "var(--font-brand), sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(20px, 8.4cqw, 26px)', lineHeight: 1.05,
            letterSpacing: '-0.012em', color: '#FAF8F3', margin: 0, textShadow: '0 1px 12px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0,
          }}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headingLabel}</span>
          <VerifiedCheck verified={!!conf.is_verified} size={21} title="Verified conference" />
        </h3>
        <div className="flex items-end justify-between gap-3" style={{ marginTop: '7px' }}>
          {/* Facts row: location+flag · fee · attendees (dates live top-right on the photo) */}
          <div className="flex items-center flex-wrap" style={{ columnGap: '12px', rowGap: '5px', minWidth: 0 }}>
            <span className="flex items-center gap-1" style={{ minWidth: 0 }}>
              <MapPin size={13} style={{ color: '#EED98A', flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "var(--font-brand), sans-serif", fontWeight: 500, fontSize: '11.5px',
                  color: 'rgba(237,231,216,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {conf.city}, {countryCode}
              </span>
            </span>
            {price.kind === 'tbd' ? (
              <span
                style={{
                  fontFamily: "var(--font-brand), sans-serif", fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.08em', color: 'rgba(237,231,216,0.85)', backgroundColor: 'rgba(237,231,216,0.10)',
                  border: '1px solid rgba(237,231,216,0.28)', padding: '2px 9px', borderRadius: '9999px',
                }}
              >
                TBD
              </span>
            ) : price.kind === 'free' ? (
              <span
                style={{
                  fontFamily: "var(--font-brand), sans-serif", fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.08em', color: '#BFEBD1', backgroundColor: 'rgba(42,90,60,0.55)',
                  border: '1px solid rgba(127,214,160,0.35)', padding: '2px 9px', borderRadius: '9999px',
                }}
              >
                FREE
              </span>
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-brand), sans-serif", fontSize: '11.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: '#EED98A', backgroundColor: 'rgba(238,217,138,0.14)',
                  border: '1px solid rgba(238,217,138,0.32)', padding: '2px 9px', borderRadius: '9999px', whiteSpace: 'nowrap',
                }}
              >
                {currencySymbol(price.currency)}{formatFeeAmountCompact(price.amount)}
              </span>
            )}
            {conf.expected_delegates > 0 && (
              <span className="flex items-center gap-1">
                <Users size={13} style={{ color: 'rgba(237,231,216,0.66)', flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11.5px', color: 'rgba(237,231,216,0.8)' }}>
                  {conf.expected_delegates.toLocaleString()}
                </span>
              </span>
            )}
          </div>
          <div className="flex-shrink-0"><ApplyButton applied={applied} member={member} /></div>
        </div>
        {/* Credit sponsored: a quiet line of its own under the facts, so it
            never meets the name, the logo or the fee */}
        {creditSponsored && <CreditSponsoredMark tone="dark" size="xs" style={{ marginTop: 5 }} />}
      </div>
    </article>
  ) : (
    // ── The listing card (Airbnb's, in ivory, white, forest and gold) ───────
    // CLAUDE.md §8, "The Explore page", item 6. A white card with a soft
    // shadow; a landscape cover (3:2, radius 16) inset on top; the logo as a
    // round disc over the photo's lower edge; then the text below: acronym
    // large with the full name beneath (two rows, never cut), the verified
    // check, round flag + city and country, the dates, format and delegates
    // as icon + plain word, and the price in bold with the role in grey. The
    // whole card is the link; there is no APPLY pill.
    <article
      onClick={href ? undefined : onClick}
      onKeyDown={href ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role={href ? undefined : 'link'}
      tabIndex={href ? undefined : 0}
      onMouseEnter={href ? undefined : onHover}
      onMouseLeave={href ? undefined : onLeave}
      className="gv-listing-card cursor-pointer focus:outline-none"
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRadius: bare ? '20px' : '22px',
        padding: bare ? 0 : dense ? '7px' : '8px',
        boxShadow: glowing
          ? glowShadow
          : bare
            ? (hovered ? LISTING_SHADOW_HOVER : LISTING_SHADOW)
            : hovered
              ? '0 1px 2px rgba(27,56,40,0.06), 0 18px 40px rgba(27,56,40,0.15)'
              : '0 1px 2px rgba(27,56,40,0.05), 0 8px 24px rgba(27,56,40,0.08)',
        transform: bare && hovered ? 'translateY(-3px)' : undefined,
        transition: 'box-shadow 240ms ease, transform 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <style>{LISTING_CSS}</style>

      {/* Cover: the banner photo, or a pale wash with the acronym watermark */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative', aspectRatio: bare ? '4 / 3' : '3 / 2',
            borderRadius: bare ? '20px 20px 0 0' : '16px', overflow: 'hidden',
            background: bare
              ? (hasBanner ? '#EFEBE3' : `linear-gradient(135deg, ${p0} 0%, ${p1} 100%)`)
              : conf.banner_url ? '#E4DCCB' : `linear-gradient(135deg, ${p0} 0%, ${p1} 100%)`,
          }}
        >
          {conf.banner_url ? (
            <img
              src={conf.banner_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="gv-listing-photo"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? (bare ? 'scale(1.03)' : 'scale(1.04)') : 'scale(1)',
                transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          ) : bare ? (
            // No banner on Explore: the logo, large, centred on a pale fill.
            <div
              className="gv-listing-photo"
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: hovered ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              <LogoDisc
                src={conf.logo_url}
                alt={conf.acronym}
                size={dense ? 96 : 112}
                fallbackText={initials}
                style={{ border: '4px solid #FFFFFF', boxShadow: '0 8px 22px rgba(16,28,21,0.14)' }}
              />
            </div>
          ) : (
            <span
              aria-hidden
              style={{
                position: 'absolute', right: '12px', bottom: '-4px',
                fontFamily: "var(--font-brand), sans-serif", fontWeight: 800, fontSize: dense ? '40px' : '48px', lineHeight: 1,
                color: 'rgba(27,56,40,0.10)', letterSpacing: '0.02em', userSelect: 'none', whiteSpace: 'nowrap',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          )}
          {/* Spotlight tag, top right on the photo */}
          {spotlight && (
            <span style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2 }}>
              <SpotlightTag size="sm" />
            </span>
          )}
        </div>
        {/* The conference's own logo, over the photo's lower edge */}
        {edgeLogo && (
          <div style={{ position: 'absolute', left: bare ? '16px' : '12px', bottom: dense ? '-22px' : '-26px', zIndex: 2 }}>
            <LogoDisc
              src={conf.logo_url}
              alt={conf.acronym}
              size={dense ? 48 : 56}
              fallbackText={initials}
              style={{ border: '3px solid #FFFFFF', boxShadow: '0 6px 14px rgba(16,28,21,0.20)' }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex', flexDirection: 'column', flex: '1 1 auto',
          padding: bare
            ? (edgeLogo ? (dense ? '30px 14px 14px' : '36px 16px 16px') : (dense ? '14px 14px 14px' : '16px 16px 16px'))
            : dense ? '30px 7px 7px' : '34px 8px 8px',
          fontFamily: "var(--font-brand), sans-serif",
        }}
      >
        {/* Acronym large, the full name smaller beneath: two rows, never "…" */}
        <h3
          style={{
            margin: 0, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0,
            color: '#1C1410', fontWeight: 800, fontSize: dense ? '18px' : '20px', lineHeight: 1.15, letterSpacing: '-0.01em',
          }}
        >
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{headingLabel}</span>
          <VerifiedCheck verified={!!conf.is_verified} size={dense ? 16 : 18} title="Verified conference" />
        </h3>
        {showFullName && (
          <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 500, lineHeight: 1.35, color: '#5C5140', overflowWrap: 'anywhere' }}>
            {conf.full_name}
          </p>
        )}

        {/* Round flag, city and country */}
        <p className="flex items-center" style={{ margin: '9px 0 0', gap: '7px', fontSize: '13.5px', fontWeight: 500, color: '#4A4238', lineHeight: 1.35 }}>
          {showFlag && <CircleFlag country={conf.country} size={17} decorative />}
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {[conf.city?.trim(), countryName?.trim()].filter(Boolean).join(', ')}
          </span>
        </p>

        {/* Dates */}
        <p style={{ margin: '3px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#5C5140', fontVariantNumeric: 'tabular-nums', lineHeight: 1.35 }}>
          {showDates ? formatDateRange(conf.start_date, conf.end_date) : 'Dates to be announced'}
        </p>

        {/* Format and delegates: an icon and a plain word, never a chip */}
        {(formatLabel || conf.expected_delegates > 0) && (
          <p className="flex items-center flex-wrap" style={{ margin: '6px 0 0', columnGap: '14px', rowGap: '4px', fontSize: '13px', fontWeight: 500, color: '#5C5140' }}>
            {formatLabel && (
              <span className="inline-flex items-center" style={{ gap: '5px' }}>
                {FormatIcon && <FormatIcon size={14} strokeWidth={2} fill="rgba(207,227,211,0.9)" style={{ color: '#2A5A3C', flexShrink: 0 }} aria-hidden />}
                {formatLabel}
              </span>
            )}
            {conf.expected_delegates > 0 && (
              <span className="inline-flex items-center" style={{ gap: '5px', fontVariantNumeric: 'tabular-nums' }} title="Expected delegates">
                <Users size={14} strokeWidth={2} fill="rgba(238,217,138,0.55)" style={{ color: '#2A5A3C', flexShrink: 0 }} aria-hidden />
                {conf.expected_delegates.toLocaleString()}
                <span className="sr-only"> delegates</span>
              </span>
            )}
          </p>
        )}

        {/* Price in bold with the role in grey; the viewer's own state beside it */}
        <div className="flex items-end justify-between flex-wrap" style={{ marginTop: 'auto', paddingTop: '10px', columnGap: '10px', rowGap: '4px' }}>
          <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.3, color: '#1C1410', fontVariantNumeric: 'tabular-nums' }}>
            {price.kind === 'tbd' ? (
              <span title="Price to be announced" style={{ fontWeight: 600, color: '#6B5F52' }}>Price to be announced</span>
            ) : price.kind === 'free' ? (
              <span style={{ fontWeight: 800 }}>Free</span>
            ) : (
              <>
                <span style={{ fontWeight: 800 }}>{currencySymbol(price.currency)}{formatFeeAmountCompact(price.amount)}</span>
                <span style={{ fontWeight: 500, color: '#6B5F52' }}> delegate</span>
              </>
            )}
          </p>
          {member ? (
            <span className="inline-flex items-center" style={{ gap: '4px', fontSize: '12.5px', fontWeight: 700, color: '#1B3828' }}>
              <Check size={14} strokeWidth={2.75} aria-hidden /> You&apos;re in
            </span>
          ) : applied ? (
            <span className="inline-flex items-center" style={{ gap: '4px', fontSize: '12.5px', fontWeight: 700, color: '#1B3828' }}>
              <Check size={14} strokeWidth={2.75} aria-hidden /> Applied
            </span>
          ) : null}
        </div>
        {creditSponsored && <CreditSponsoredMark size="xs" style={{ marginTop: '5px' }} />}
      </div>
    </article>
  );

  // The whole card is the link. With `href` it is a real <a> (crawlable,
  // middle-click, open in new tab); `onClick` then runs as a side effect
  // only (record a spotlight click) and must not navigate itself.
  const listing = !heroCompact && href ? (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`block h-full ${bare ? 'rounded-[20px]' : 'rounded-[22px]'} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {card}
    </Link>
  ) : card;

  // The Explore listing carries its spotlight as the gold edge and glow on
  // the card itself; no gavel disc on the corner.
  if (!glowing || bare) return listing;

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
      {listing}
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
          fontFamily: "var(--font-brand), sans-serif",
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
          fontFamily: "var(--font-brand), sans-serif",
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
        fontFamily: "var(--font-brand), sans-serif",
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

/** The listing card's grey skeleton: the same shape (inset 3:2 cover, logo
 *  disc over its edge, the text rows), for loading grids. */
export function ConferenceCardSkeleton({ variant = 'card' }: { variant?: 'card' | 'listing' } = {}) {
  const bare = variant === 'listing';
  const bar = (w: string, h: number, mt: number) => (
    <div className="animate-pulse" style={{ width: w, height: `${h}px`, marginTop: `${mt}px`, borderRadius: '8px', backgroundColor: '#ECE6D9' }} />
  );
  return (
    <div
      aria-hidden
      style={{
        backgroundColor: '#FFFFFF', borderRadius: bare ? '20px' : '22px', padding: bare ? 0 : '8px',
        boxShadow: bare ? LISTING_SHADOW : '0 1px 2px rgba(27,56,40,0.05), 0 8px 24px rgba(27,56,40,0.08)',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div className="animate-pulse" style={{ aspectRatio: bare ? '4 / 3' : '3 / 2', borderRadius: bare ? '20px 20px 0 0' : '16px', backgroundColor: bare ? '#EFEBE3' : '#E4DCCB' }} />
        <div style={{ position: 'absolute', left: bare ? '16px' : '12px', bottom: '-26px', width: '56px', height: '56px', borderRadius: '9999px', backgroundColor: '#DDD4C0', border: '3px solid #FFFFFF' }} />
      </div>
      <div style={{ padding: bare ? '36px 16px 16px' : '34px 8px 10px' }}>
        {bar('55%', 18, 0)}
        {bar('80%', 12, 8)}
        {bar('65%', 12, 12)}
        {bar('45%', 12, 7)}
        {bar('35%', 14, 16)}
      </div>
    </div>
  );
}
