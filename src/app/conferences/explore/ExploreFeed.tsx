'use client';

// ── Explore feed (redesign, 26 Sep 2026) ─────────────────────────────────────
// Presentation only. The page (ConferencesExploreClient) does every read and
// every filter; this file draws what it hands over:
//   <SpotlightRow>   the booked Spotlights, as large featured cards
//   <MonthFeed>      the results grouped by month under sticky month headers,
//                    as a Luma-style list (date block, cover thumbnail, name,
//                    flag + city, open roles, price) or as the photo-card grid
// Names are never cut: the short form large, the full name beneath, wrapping.

import Link from 'next/link';
import { DoorOpen, CalendarDays, MapPin, Monitor, Globe, School, GraduationCap, Check, CircleSlash } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { CircleFlag } from '@/components/CircleFlag';
import VerifiedCheck from '@/components/VerifiedCheck';
import { CreditSponsoredMark, SpotlightTag, SPOTLIGHT_GLOW, SPOTLIGHT_GLOW_HOVER } from '@/components/conferences/SpotlightTag';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { formatConferenceDates } from '@/lib/conferenceDates';
import { getCountryByName } from '@/lib/countries';
import { currencySymbol, formatFeeAmountCompact } from '@/lib/utils';
import { TBD_PRICE, type DelegatePrice } from '@/lib/publicFees';
import type { FeaturedRow } from '@/lib/spotlight';
import { ROLE_OPTIONS, parseDateOnly, type ConferenceFacet } from './exploreFilters';
import { DuoIcon } from './ExploreChrome';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

/** One row of the directory, as the page reads it. */
export interface ExploreConference {
  id: string;
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
  /** Public delegate price (publicFees.displayDelegatePrice); absent = TBD. */
  delegate_price?: DelegatePrice;
  format: string;
  student_level: string;
  logo_url: string | null;
  banner_url: string | null;
  is_public: boolean;
  is_verified?: boolean;
  organizer_id: string | null;
}

/** The soft 3D white surface the owner loves, on the ivory ground. */
export const SOFT_CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: 22,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(27,56,40,0.06), 5px 7px 20px rgba(27,56,40,0.10), 0 1px 2px rgba(27,56,40,0.06)',
};

const FORMAT_WORDS: Record<string, string> = { 'in-person': 'In person', online: 'Online', hybrid: 'Hybrid' };
const FORMAT_GLYPHS: Record<string, typeof MapPin> = { 'in-person': MapPin, online: Monitor, hybrid: Globe };
const LEVEL_WORDS: Record<string, string> = { school: 'High school', university: 'University', both: 'High school and university' };
const LEVEL_GLYPHS: Record<string, typeof School> = { school: School, university: GraduationCap, both: GraduationCap };
const ROLE_WORDS = new Map<string, string>(ROLE_OPTIONS.map(r => [r.key, r.label]));

const PALE: [string, string][] = [['#E6EEE3', '#F4EFE2'], ['#EFE7D2', '#E3ECDF'], ['#F3EBD3', '#EAF0E6'], ['#E0EADC', '#F1EAD8']];
function paleFor(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALE[h % PALE.length];
}

function initialsOf(c: { acronym: string }) {
  return c.acronym.slice(0, 3).toUpperCase();
}

function placeLine(c: { city: string | null; country: string | null }) {
  const country = c.country ? (getCountryByName(c.country)?.name ?? c.country) : '';
  return [c.city?.trim(), country.trim()].filter(Boolean).join(', ');
}

function datesLine(start: string | null, end: string | null) {
  return start ? formatConferenceDates(start, end, { style: 'dmy-end-year' }) : 'Dates to be announced';
}

/** Price in bold with the role in grey. */
export function PriceLine({ price, size = 15 }: { price?: DelegatePrice; size?: number }) {
  const p = price ?? TBD_PRICE;
  return (
    <span style={{ fontSize: size, lineHeight: 1.3, color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {p.kind === 'tbd' ? (
        <span style={{ fontWeight: 600, color: '#6B5F52' }}>Price to be announced</span>
      ) : p.kind === 'free' ? (
        <span style={{ fontWeight: 800 }}>Free</span>
      ) : (
        <>
          <span style={{ fontWeight: 800 }}>{currencySymbol(p.currency)}{formatFeeAmountCompact(p.amount)}</span>
          <span style={{ fontWeight: 500, color: '#6B5F52' }}> delegate</span>
        </>
      )}
    </span>
  );
}

function ViewerState({ applied, member }: { applied: boolean; member: boolean }) {
  if (!member && !applied) return null;
  return (
    <span className="inline-flex items-center" style={{ gap: 4, fontSize: 12.5, fontWeight: 700, color: FOREST, whiteSpace: 'nowrap' }}>
      <Check size={14} strokeWidth={2.75} aria-hidden /> {member ? "You're in" : 'Applied'}
    </span>
  );
}

// ── The Spotlight row ────────────────────────────────────────────────────────

export interface SpotlightItem { conf: ExploreConference; spot: FeaturedRow }

export function SpotlightRow({
  items, sponsoredIds, appliedIds, isMember, hoveredId, onHover, onLeave, onOpen,
}: {
  items: SpotlightItem[];
  /** Records the spotlight click; the link navigates by itself. */
  onOpen: (spot: FeaturedRow) => void;
  sponsoredIds: ReadonlySet<string>;
  appliedIds: ReadonlySet<string>;
  isMember: (c: ExploreConference) => boolean;
  hoveredId: string | null;
  onHover: (id: string) => void;
  onLeave: () => void;
}) {
  const single = items.length === 1;
  return (
    <div className={single ? 'gv-spot-grid gv-spot-single' : 'gv-spot-grid'}>
      <style>{SPOT_CSS}</style>
      {items.map(({ conf, spot }) => (
        <SpotlightCard
          key={conf.id}
          conf={conf}
          spot={spot}
          wide={single}
          creditSponsored={sponsoredIds.has(conf.id)}
          applied={appliedIds.has(conf.id)}
          member={isMember(conf)}
          hovered={hoveredId === conf.id}
          onHover={() => onHover(conf.id)}
          onLeave={onLeave}
          onOpen={() => onOpen(spot)}
        />
      ))}
    </div>
  );
}

const SPOT_CSS = `
.gv-spot-grid { display: grid; gap: clamp(18px, 2vw, 28px); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 720px) { .gv-spot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .gv-spot-grid.gv-spot-single { grid-template-columns: minmax(0, 1fr); } }
@media (min-width: 1280px) { .gv-spot-grid:not(.gv-spot-single) { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); } }
.gv-spot-card { display: flex; flex-direction: column; height: 100%; }
.gv-spot-photo { aspect-ratio: 16 / 9; border-radius: 22px 22px 0 0; }
@media (min-width: 720px) {
  .gv-spot-card.gv-spot-wide { flex-direction: row; }
  .gv-spot-wide .gv-spot-photo { aspect-ratio: auto; flex: 0 0 56%; min-height: 300px; border-radius: 22px 0 0 22px; }
  .gv-spot-wide .gv-spot-logo { left: auto !important; right: -32px; bottom: 24px !important; }
  .gv-spot-wide .gv-spot-text { padding: 28px 32px 28px 52px !important; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .gv-spot-card, .gv-spot-img { transition: none !important; transform: none !important; } }
`;

function SpotlightCard({
  conf, spot, wide, creditSponsored, applied, member, hovered, onHover, onLeave, onOpen,
}: {
  onOpen: () => void;
  conf: ExploreConference;
  spot: FeaturedRow;
  wide: boolean;
  creditSponsored: boolean;
  applied: boolean;
  member: boolean;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const label = conferenceAcronymLabel(conf) || conf.full_name;
  const showFull = !!conf.full_name && conf.full_name.trim() !== label.trim();
  const [p0, p1] = paleFor(conf.acronym);
  const countryCode = getCountryByName(conf.country)?.code;
  return (
    <Link
      href={`/conferences/${conf.slug}`}
      onClick={onOpen}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      data-spot-booking={spot.booking_id ?? undefined}
      className="block h-full rounded-[22px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article
        className={`gv-spot-card${wide ? ' gv-spot-wide' : ''}`}
        style={{
          ...SOFT_CARD,
          boxShadow: hovered ? SPOTLIGHT_GLOW_HOVER : SPOTLIGHT_GLOW,
          transform: hovered ? 'translateY(-3px)' : undefined,
          transition: 'box-shadow 240ms ease, transform 260ms cubic-bezier(0.22,1,0.36,1)',
          fontFamily: FONT,
        }}
      >
        <div className="gv-spot-photo" style={{ position: 'relative', overflow: 'visible' }}>
          <div
            className="gv-spot-photo"
            style={{
              position: 'absolute', inset: 0, overflow: 'hidden', aspectRatio: 'auto',
              background: conf.banner_url ? '#EFEBE3' : `linear-gradient(135deg, ${p0} 0%, ${p1} 100%)`,
            }}
          >
            {conf.banner_url ? (
              <img
                src={conf.banner_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="gv-spot-img"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  transform: hovered ? 'scale(1.03)' : 'scale(1)', transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogoDisc src={conf.logo_url} alt={conf.acronym} size={120} fallbackText={initialsOf(conf)} style={{ border: '4px solid #FFFFFF', boxShadow: '0 8px 22px rgba(16,28,21,0.14)' }} />
              </div>
            )}
            <span style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}><SpotlightTag /></span>
          </div>
          {conf.banner_url && (
            <div className="gv-spot-logo" style={{ position: 'absolute', left: 18, bottom: -32, zIndex: 3 }}>
              <LogoDisc src={conf.logo_url} alt={conf.acronym} size={68} fallbackText={initialsOf(conf)} style={{ border: '3px solid #FFFFFF', boxShadow: '0 6px 16px rgba(16,28,21,0.22)' }} />
            </div>
          )}
        </div>
        <div className="gv-spot-text flex flex-col" style={{ flex: '1 1 auto', padding: conf.banner_url ? '44px 20px 20px' : '20px 20px 20px' }}>
          <h3 className="flex items-center" style={{ margin: 0, gap: 8, fontSize: 'clamp(22px, 2vw, 26px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.012em', color: INK }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
            <VerifiedCheck verified={!!conf.is_verified} size={20} title="Verified conference" />
          </h3>
          {showFull && (
            <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: INK_SOFT, overflowWrap: 'anywhere' }}>{conf.full_name}</p>
          )}
          {spot.description && (
            <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: INK, overflowWrap: 'anywhere' }}>{spot.description}</p>
          )}
          <p className="flex items-center flex-wrap" style={{ margin: '12px 0 0', columnGap: 14, rowGap: 6, fontSize: 14, fontWeight: 500, color: '#4A4238' }}>
            <span className="inline-flex items-center" style={{ gap: 7 }}>
              {countryCode ? <CircleFlag code={countryCode} size={18} decorative /> : <DuoIcon icon={MapPin} size={16} tone="green" />}
              <span style={{ overflowWrap: 'anywhere' }}>{placeLine(conf)}</span>
            </span>
            <span className="inline-flex items-center" style={{ gap: 6, fontVariantNumeric: 'tabular-nums' }}>
              <DuoIcon icon={CalendarDays} size={16} tone="gold" />
              {datesLine(conf.start_date, conf.end_date)}
            </span>
          </p>
          <div className="flex items-end justify-between flex-wrap" style={{ marginTop: 'auto', paddingTop: 16, columnGap: 12, rowGap: 6 }}>
            <PriceLine price={conf.delegate_price} size={16} />
            <ViewerState applied={applied} member={member} />
          </div>
          {creditSponsored && <CreditSponsoredMark size="xs" style={{ marginTop: 6 }} />}
        </div>
      </article>
    </Link>
  );
}

// ── The month-grouped feed ──────────────────────────────────────────────────

export interface MonthGroup { key: string; label: string; items: ExploreConference[] }

const MONTH_FMT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }) : null;

/** Groups an already-sorted list by the month it starts in, keeping the order.
 *  Undated conferences form one group, "Dates to be announced". */
export function groupByMonth(list: ExploreConference[]): MonthGroup[] {
  const out: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();
  for (const c of list) {
    const d = parseDateOnly(c.start_date);
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'tbd';
    let g = byKey.get(key);
    if (!g) {
      g = { key, label: d && MONTH_FMT ? MONTH_FMT.format(d) : 'Dates to be announced', items: [] };
      byKey.set(key, g);
      out.push(g);
    }
    g.items.push(c);
  }
  return out;
}

export function MonthHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      className="gv-month-head flex items-baseline flex-wrap"
      style={{ columnGap: 10, rowGap: 2, padding: '12px 2px 10px', fontFamily: FONT }}
    >
      <h2 style={{ margin: 0, fontSize: 'clamp(19px, 1.8vw, 23px)', fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>{label}</h2>
      <span style={{ fontSize: 14, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontWeight: 800, color: INK }}>{count}</span> {count === 1 ? 'conference' : 'conferences'}
      </span>
    </div>
  );
}

export const FEED_CSS = `
.gv-month-head { position: sticky; top: 0; z-index: 5; background: rgba(237,231,216,0.92); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
@media (min-width: 1024px) { .gv-month-head { top: 84px; } }
.gv-row { display: grid; grid-template-columns: 84px minmax(0, 1fr); column-gap: 14px; align-items: start; padding: 16px 14px; text-decoration: none; color: inherit; transition: background-color 160ms ease; }
.gv-row + .gv-row { border-top: 1px solid rgba(28,20,16,0.08); }
.gv-row:hover { background-color: rgba(27,56,40,0.03); }
.gv-row-thumb { width: 84px; height: 84px; }
.gv-row-date { display: none; }
.gv-row-side { display: none; }
@media (min-width: 768px) {
  .gv-row { grid-template-columns: 60px 148px minmax(0, 1fr) auto; column-gap: 22px; padding: 18px 22px; }
  .gv-row-thumb { width: 148px; height: 99px; }
  .gv-row-side { display: flex; }
  .gv-row-date { display: block; }
  .gv-row-inline { display: none !important; }
}
.gv-row:first-child { border-radius: 22px 22px 0 0; }
.gv-row:last-child { border-radius: 0 0 22px 22px; }
.gv-row:only-child { border-radius: 22px; }
@media (prefers-reduced-motion: reduce) { .gv-row, .gv-row-img { transition: none !important; } }
`;

function DateBlock({ start }: { start: string | null }) {
  const d = parseDateOnly(start);
  if (!d) {
    return (
      <div className="gv-row-date" style={{ textAlign: 'center', fontFamily: FONT, paddingTop: 4 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: INK_SOFT }}>TBD</span>
      </div>
    );
  }
  return (
    <div className="gv-row-date" style={{ textAlign: 'center', fontFamily: FONT, lineHeight: 1 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#8A6414' }}>
        {d.toLocaleDateString('en-GB', { month: 'short' })}
      </span>
      <span style={{ display: 'block', fontSize: 'clamp(24px, 2.4vw, 30px)', fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
        {d.getDate()}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: INK_SOFT, marginTop: 4 }}>
        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
      </span>
    </div>
  );
}

function RowThumb({ conf }: { conf: ExploreConference }) {
  const [p0, p1] = paleFor(conf.acronym);
  return (
    <div className="gv-row-thumb" style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden',
          background: conf.banner_url ? '#EFEBE3' : `linear-gradient(135deg, ${p0} 0%, ${p1} 100%)`,
          boxShadow: '0 0 0 1px rgba(27,56,40,0.06), 0 3px 10px rgba(27,56,40,0.10)',
        }}
      >
        {conf.banner_url ? (
          <img src={conf.banner_url} alt="" loading="lazy" decoding="async" className="gv-row-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogoDisc src={conf.logo_url} alt={conf.acronym} size={52} fallbackText={initialsOf(conf)} style={{ border: '2px solid #FFFFFF' }} />
          </div>
        )}
      </div>
      {conf.banner_url && (
        <div style={{ position: 'absolute', left: -6, bottom: -8, zIndex: 1 }}>
          <LogoDisc src={conf.logo_url} alt={conf.acronym} size={34} fallbackText={initialsOf(conf)} style={{ border: '2px solid #FFFFFF', boxShadow: '0 3px 8px rgba(16,28,21,0.20)' }} />
        </div>
      )}
    </div>
  );
}

function OpenRoles({ facet, facetsLoaded }: { facet?: ConferenceFacet; facetsLoaded: boolean }) {
  if (!facetsLoaded) return null;
  const roles = (facet?.open_roles ?? []).map(r => ROLE_WORDS.get(r)).filter((x): x is string => !!x);
  if (roles.length === 0) {
    return (
      <span className="inline-flex items-center" style={{ gap: 6, color: '#6B5F52' }}>
        <CircleSlash size={15} strokeWidth={2} aria-hidden style={{ color: '#8A7D6C', flexShrink: 0 }} />
        Applications not open
      </span>
    );
  }
  const list = roles.length === ROLE_OPTIONS.length ? 'every role' : roles.map((r, i) => (i === 0 ? r : r.toLowerCase())).join(', ');
  return (
    <span className="inline-flex items-center" style={{ gap: 6, color: FOREST, fontWeight: 600 }}>
      <DuoIcon icon={DoorOpen} size={16} tone="green" />
      <span style={{ overflowWrap: 'anywhere' }}>Open for {list}</span>
    </span>
  );
}

function FeedRow({
  conf, facet, facetsLoaded, creditSponsored, applied, member,
}: {
  conf: ExploreConference;
  facet?: ConferenceFacet;
  facetsLoaded: boolean;
  creditSponsored: boolean;
  applied: boolean;
  member: boolean;
}) {
  const label = conferenceAcronymLabel(conf) || conf.full_name;
  const showFull = !!conf.full_name && conf.full_name.trim() !== label.trim();
  const countryCode = getCountryByName(conf.country)?.code;
  const formatWord = FORMAT_WORDS[conf.format];
  const FormatIcon = FORMAT_GLYPHS[conf.format];
  const levelWord = LEVEL_WORDS[conf.student_level];
  const LevelIcon = LEVEL_GLYPHS[conf.student_level];
  return (
    <Link href={`/conferences/${conf.slug}`} className="gv-row focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1B3828]" style={{ fontFamily: FONT }}>
      <DateBlock start={conf.start_date} />
      <RowThumb conf={conf} />
      <div style={{ minWidth: 0 }}>
        <h3 className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: INK, letterSpacing: '-0.005em' }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
          <VerifiedCheck verified={!!conf.is_verified} size={17} title="Verified conference" />
        </h3>
        {showFull && (
          <p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, color: INK_SOFT, overflowWrap: 'anywhere' }}>{conf.full_name}</p>
        )}
        <p className="flex items-center flex-wrap" style={{ margin: '8px 0 0', columnGap: 14, rowGap: 5, fontSize: 13.5, fontWeight: 500, color: '#4A4238' }}>
          <span className="inline-flex items-center" style={{ gap: 7 }}>
            {countryCode ? <CircleFlag code={countryCode} size={17} decorative /> : <DuoIcon icon={MapPin} size={15} tone="green" />}
            <span style={{ overflowWrap: 'anywhere' }}>{placeLine(conf)}</span>
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: INK_SOFT }}>{datesLine(conf.start_date, conf.end_date)}</span>
        </p>
        <p className="flex items-center flex-wrap" style={{ margin: '6px 0 0', columnGap: 14, rowGap: 5, fontSize: 13, fontWeight: 500, color: INK_SOFT }}>
          {formatWord && (
            <span className="inline-flex items-center" style={{ gap: 5 }}>
              {FormatIcon && <DuoIcon icon={FormatIcon} size={15} tone="green" />}
              {formatWord}
            </span>
          )}
          {levelWord && (
            <span className="inline-flex items-center" style={{ gap: 5 }}>
              {LevelIcon && <DuoIcon icon={LevelIcon} size={15} tone="gold" />}
              {levelWord}
            </span>
          )}
          <OpenRoles facet={facet} facetsLoaded={facetsLoaded} />
        </p>
        {/* Phones: the price rides under the facts */}
        <div className="gv-row-inline flex items-center flex-wrap" style={{ marginTop: 10, columnGap: 12, rowGap: 4 }}>
          <PriceLine price={conf.delegate_price} size={15} />
          {creditSponsored && <CreditSponsoredMark size="xs" />}
          <ViewerState applied={applied} member={member} />
        </div>
      </div>
      <div className="gv-row-side flex-col items-end" style={{ gap: 6, textAlign: 'right', paddingTop: 2 }}>
        <PriceLine price={conf.delegate_price} size={16} />
        {creditSponsored && <CreditSponsoredMark size="xs" />}
        <ViewerState applied={applied} member={member} />
      </div>
    </Link>
  );
}

export function FeedRows({
  items, facets, facetsLoaded, sponsoredIds, appliedIds, isMember,
}: {
  items: ExploreConference[];
  facets: ReadonlyMap<string, ConferenceFacet>;
  facetsLoaded: boolean;
  sponsoredIds: ReadonlySet<string>;
  appliedIds: ReadonlySet<string>;
  isMember: (c: ExploreConference) => boolean;
}) {
  return (
    <div style={{ ...SOFT_CARD }}>
      {items.map(c => (
        <FeedRow
          key={c.id}
          conf={c}
          facet={facets.get(c.id)}
          facetsLoaded={facetsLoaded}
          creditSponsored={sponsoredIds.has(c.id)}
          applied={appliedIds.has(c.id)}
          member={isMember(c)}
        />
      ))}
    </div>
  );
}

/** Grey skeleton of the list: one month card of rows. */
export function FeedSkeleton({ rows = 5 }: { rows?: number }) {
  const bar = (w: string | number, h: number, mt = 0) => (
    <div className="animate-pulse" style={{ width: w, height: h, marginTop: mt, borderRadius: 8, backgroundColor: '#ECE6D9' }} />
  );
  return (
    <div aria-hidden>
      <div style={{ padding: '12px 2px 10px' }}>{bar(180, 22)}</div>
      <div style={{ ...SOFT_CARD }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="gv-row" style={{ pointerEvents: 'none' }}>
            <div className="gv-row-date"><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{bar(28, 10)}{bar(34, 26, 6)}{bar(26, 10, 6)}</div></div>
            <div className="gv-row-thumb animate-pulse" style={{ borderRadius: 14, backgroundColor: '#ECE6D9' }} />
            <div>{bar('45%', 18)}{bar('70%', 12, 8)}{bar('55%', 12, 12)}{bar('40%', 12, 8)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
