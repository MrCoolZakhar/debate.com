'use client';

// The organiser's delegation screens (taste boards 2B, 3A, 3B, 19 Oct 2026)
// share the leader card's look: white cards that lift like Airbnb, fine-line
// Lucide icons in bare ink, round crests, round flags and committee emblems.
// The tokens come from the leader card's kit so both sides stay one design.

import { CircleFlag } from '@/components/CircleFlag';
import { committeeDisplayName } from '@/lib/presetNames';
import { getCountryByCode } from '@/lib/countries';
import {
  FONT, INK, INK_SOFT, FOREST, committeeEmblemSrc, CommitteeDisc,
} from '@/app/conferences/[slug]/participant/delegation/leaderKit';
import { delegationInitials } from '../DelegationAvatar';

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

/** A delegation's round crest: its logo, else its initials on a soft ivory disc. */
export function Crest({ name, logoUrl, size = 48 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" aria-hidden style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
    );
  }
  return (
    <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: '#F6F2EA', color: FOREST, fontFamily: FONT, fontWeight: 700, fontSize: Math.round(size * 0.32) }}>
      {delegationInitials(name)}
    </span>
  );
}

/** "City, Country" with the country's round flag, or null when neither is known. */
export function placeOf(city: string | null | undefined, countryCode: string | null | undefined): { label: string; code: string | null } | null {
  const c = city?.trim() || '';
  const code = countryCode?.trim().toUpperCase() || '';
  const countryName = code ? (getCountryByCode(code)?.name ?? code) : '';
  const label = [c, countryName].filter(Boolean).join(', ');
  return label ? { label, code: code || null } : null;
}

export function PlaceLine({ city, countryCode, extra, size = 16 }: { city: string | null; countryCode: string | null; extra?: string | null; size?: number }) {
  const place = placeOf(city, countryCode);
  const text = [place?.label, extra].filter(Boolean).join(' · ');
  if (!text) return null;
  return (
    <span className="flex items-center gap-1.5 min-w-0" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
      {place?.code && <CircleFlag code={place.code} size={size} decorative />}
      <span className="[overflow-wrap:anywhere]">{text}</span>
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

