'use client';

// The organiser's delegation screens (taste boards 2B, 3A, 3B, 19 Oct 2026)
// share the leader card's look: white cards that lift like Airbnb, fine-line
// Lucide icons in bare ink, round crests, round flags and committee emblems.
// The tokens come from the leader card's kit so both sides stay one design.

import { CircleFlag } from '@/components/CircleFlag';
import { committeeDisplayName } from '@/lib/presetNames';
import { getCountryByCode } from '@/lib/countries';
import { countryShortName } from '@/app/manage/[slug]/assignment/displayNames';
import { splitDelegationName } from '@/lib/delegationName';
import {
  FONT, INK, INK_SOFT, FOREST, committeeEmblemSrc, CommitteeDisc,
} from '@/app/conferences/[slug]/participant/delegation/leaderKit';

export {
  FONT, INK, INK_SOFT, FOREST, OK_GREEN, OWE, DANGER, STROKE, LIFT_SHADOW, cardStyle, primaryBtn, secondaryBtn,
  BTN_CLASS, linkStyle, committeeEmblemSrc, CommitteeDisc, RoundAvatar,
} from '@/app/conferences/[slug]/participant/delegation/leaderKit';

export const HAIRLINE = '#EFEAE0';
export const ROW_LINE = '#F3EFE6';
export const STRUCK = '#A39A90';

export const smallPrimaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 34, padding: '0 14px',
  borderRadius: 10, border: 'none', color: '#FFFFFF', background: 'linear-gradient(180deg, #26503D, #1B3828)',
  fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
export const smallSecondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, padding: '0 14px',
  borderRadius: 10, border: '1px solid rgba(27,56,40,0.18)', color: FOREST, background: '#FFFFFF',
  fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

/** "City, Country" with the country's round flag, or null when neither is known.
 *  `short` uses the everyday short name for long countries ("London, UK"),
 *  the full name staying in `full` for the hover title. */
export function placeOf(city: string | null | undefined, countryCode: string | null | undefined, short = false): { label: string; full: string; code: string | null } | null {
  const c = city?.trim() || '';
  const code = countryCode?.trim().toUpperCase() || '';
  const countryName = code ? (getCountryByCode(code)?.name ?? code) : '';
  const shown = short && countryName ? countryShortName(countryName, code) : countryName;
  const label = [c, shown].filter(Boolean).join(', ');
  const full = [c, countryName].filter(Boolean).join(', ');
  return label ? { label, full, code: code || null } : null;
}

export function PlaceLine({ city, countryCode, extra, size = 16, fontSize = 13, short = false, oneLine = false }: {
  city: string | null; countryCode: string | null; extra?: string | null; size?: number; fontSize?: number;
  /** Short names for long countries (UK, USA, UAE). */
  short?: boolean;
  /** Kept on one line (with `short` the place fits a card; nothing is cut). */
  oneLine?: boolean;
}) {
  const place = placeOf(city, countryCode, short);
  const text = [place?.label, extra].filter(Boolean).join(' · ');
  if (!text) return null;
  return (
    <span className="flex items-center gap-1.5 min-w-0" title={place && place.full !== place.label ? place.full : undefined} style={{ fontFamily: FONT, fontSize, color: INK_SOFT }}>
      {place?.code && <CircleFlag code={place.code} size={size} decorative />}
      {/* oneLine: one line whenever it fits (short country names); a city too
          long for the card wraps instead of running past its edge. */}
      <span className="[overflow-wrap:anywhere]" style={oneLine ? { minWidth: 0 } : undefined}>{text}</span>
    </span>
  );
}

/** A delegation's name on two rows (src/lib/delegationName.ts): the main words
 *  big, the trailing words ("MUN Society") small beneath, wrapping, never cut.
 *  A long main line draws one step smaller. The font family is inherited. */
export function DelegationNameLines({ name, size, restSize, weight = 700, color = INK, restColor = INK_SOFT, gap = 1 }: {
  name: string; size: number; restSize?: number; weight?: number; color?: string; restColor?: string; gap?: number;
}) {
  const { main, rest, long } = splitDelegationName(name);
  const mainSize = long ? Math.round(size * 0.86 * 2) / 2 : size;
  return (
    <span className="flex flex-col min-w-0" style={{ gap }}>
      <span className="[overflow-wrap:anywhere]" style={{ fontSize: mainSize, fontWeight: weight, color, lineHeight: 1.18, letterSpacing: mainSize >= 20 ? '-0.015em' : undefined }}>{main}</span>
      {rest && (
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: restSize ?? Math.max(11.5, Math.round(size * 0.62 * 2) / 2), fontWeight: 500, color: restColor, lineHeight: 1.25 }}>{rest}</span>
      )}
    </span>
  );
}

/** A committee's short label: its acronym, else its display name. */
export function committeeShort(name: string, abbreviation: string | null): string {
  return (abbreviation ?? '').trim() || committeeDisplayName(name, abbreviation);
}

/** A committee as its emblem and acronym, the full name on hover. */
export function CommitteeTag({ name, abbreviation, logoUrl, size = 20, struck = false, fontSize = 14 }: {
  name: string; abbreviation: string | null; logoUrl: string | null; size?: number; struck?: boolean; fontSize?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" title={name}
      style={{ fontFamily: FONT, fontSize, color: struck ? STRUCK : INK, textDecoration: struck ? 'line-through' : 'none' }}>
      <span style={{ opacity: struck ? 0.35 : 1, display: 'inline-flex' }}>
        <CommitteeDisc src={committeeEmblemSrc(logoUrl, name, abbreviation)} size={size} />
      </span>
      <span className="[overflow-wrap:anywhere]">{committeeShort(name, abbreviation)}</span>
    </span>
  );
}

/** Seats given against paid spots: the light part is given, the dark part has a person on it. */
export function SeatMeter({ given, filled, paid, height = 8 }: { given: number; filled: number; paid: number; height?: number }) {
  const base = Math.max(paid, given, 1);
  const pct = (n: number) => `${Math.min(100, Math.round((n / base) * 100))}%`;
  return (
    <div aria-hidden style={{ height, borderRadius: 99, background: HAIRLINE, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(given), background: '#9DB8A6' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(filled), background: FOREST }} />
    </div>
  );
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Grey skeleton bars while a read is in flight (CLAUDE.md §8). */
export function SkeletonRows({ rows = 5, height = 44 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ height, borderRadius: 12, background: '#F1ECE1' }} />
      ))}
    </div>
  );
}


/** The delegation pop-up's body colour behind its section cards. */
export const POPUP_BODY_BG = '#F7F3EA';

/** One section of the delegation pop-up (owner, 21 Oct 2026: "sections run
 *  together"): a white card with a soft shadow, a plain title on its own line
 *  with an optional count or action beside it, then the content. */
export function PopupSection({ title, aside, children, padded = true, className, style }: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  /** false: the content runs to the card's edges (tables with their own row padding). */
  padded?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`flex flex-col ${className ?? ''}`}
      style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 6px 18px rgba(27,56,40,0.06)', ...style }}>
      {(title || aside) && (
        <div className="flex items-center justify-between flex-wrap" style={{ gap: '8px 16px', padding: '16px 20px 4px' }}>
          {title && <h3 style={{ margin: 0, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>{title}</h3>}
          {aside}
        </div>
      )}
      <div className="flex flex-col min-w-0" style={padded ? { padding: '12px 20px 18px' } : { paddingBottom: 8 }}>
        {children}
      </div>
    </section>
  );
}
