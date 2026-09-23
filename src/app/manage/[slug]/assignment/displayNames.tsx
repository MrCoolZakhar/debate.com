'use client';

// ============================================================
// src/app/manage/[slug]/assignment/displayNames.tsx
//
// Names that fit without an ellipsis on the allocation portal (owner, 23 Sep
// 2026: "a lot of things get cropped").
//
//   countryShortName(name, code?)  "United Kingdom" -> "UK". A curated map of
//                                  the long names people actually shorten, then
//                                  the canonical roster name when it is shorter
//                                  than what was stored ("Russian Federation" ->
//                                  "Russia"), else the stored name untouched.
//                                  Custom seats (cabinet posts, judges) are
//                                  never touched.
//   <CountryName>                  the short name, full name on hover.
//   <StackedName>                  a person's name on two lines: the first name
//                                  large, the rest of the name smaller beneath.
//                                  Wraps instead of cropping; full name on hover.
// ============================================================

import type { CSSProperties, ReactNode } from 'react';
import { getCountryByName, UN_COUNTRIES } from '@/lib/countries';

/** Canonical roster name (src/lib/countries.ts) -> what a secretariat writes. */
const SHORT_BY_CANONICAL: Record<string, string> = {
  'United Kingdom': 'UK',
  'United States': 'USA',
  'United Arab Emirates': 'UAE',
  'Central African Republic': 'CAR',
  'DR Congo': 'DR Congo',
  'Bosnia and Herzegovina': 'Bosnia',
  'Antigua and Barbuda': 'Antigua',
  'Saint Kitts and Nevis': 'St Kitts',
  'Saint Vincent and the Grenadines': 'St Vincent',
  'São Tomé and Príncipe': 'São Tomé',
  'Trinidad and Tobago': 'Trinidad',
  'Papua New Guinea': 'PNG',
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'Czech Republic': 'Czechia',
  'Marshall Islands': 'Marshall Is.',
  'Solomon Islands': 'Solomon Is.',
  'European Union': 'EU',
  'Russia': 'Russia',
  'South Korea': 'South Korea',
  'North Korea': 'North Korea',
};

/** Stored spellings that the roster aliases may not fold onto a canonical name. */
const SHORT_BY_STORED: Record<string, string> = {
  'democratic republic of the congo': 'DR Congo',
  'republic of the congo': 'Congo',
  'russian federation': 'Russia',
  'republic of korea': 'South Korea',
  "democratic people's republic of korea": 'North Korea',
  'united states of america': 'USA',
  'united kingdom of great britain and northern ireland': 'UK',
  'islamic republic of iran': 'Iran',
  'syrian arab republic': 'Syria',
  "lao people's democratic republic": 'Laos',
  'bolivarian republic of venezuela': 'Venezuela',
  'plurinational state of bolivia': 'Bolivia',
  'united republic of tanzania': 'Tanzania',
  'republic of moldova': 'Moldova',
  'state of palestine': 'Palestine',
  'people\'s republic of china': 'China',
};

function canonicalFor(name: string, code?: string | null): string | null {
  const iso = (code ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) {
    const byCode = UN_COUNTRIES.find(c => c.code === iso);
    if (byCode) return byCode.name;
  }
  return getCountryByName(name)?.name ?? null;
}

export function countryShortName(name: string | null | undefined, code?: string | null): string {
  const stored = (name ?? '').trim();
  if (!stored) return stored;
  const direct = SHORT_BY_STORED[stored.toLowerCase()];
  if (direct) return direct;
  const canonical = canonicalFor(stored, code);
  if (!canonical) return stored; // a custom seat: never rewrite it
  const short = SHORT_BY_CANONICAL[canonical];
  if (short && short.length < stored.length) return short;
  return canonical.length < stored.length ? canonical : stored;
}

/** The short country label with the full stored name as its tooltip. */
export function CountryName({ name, code, style, className, suffix }: {
  name: string; code?: string | null; style?: CSSProperties; className?: string; suffix?: ReactNode;
}) {
  const short = countryShortName(name, code);
  return (
    <span className={className} title={name} style={{ whiteSpace: 'nowrap', ...style }}>
      {short}{suffix}
    </span>
  );
}

/** "Ana María Pérez" -> { first: "Ana", rest: "María Pérez" }. An email or a
 *  single word stays on one line. */
export function splitPersonName(name: string): { first: string; rest: string } {
  const clean = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.includes('@')) return { first: clean, rest: '' };
  const i = clean.indexOf(' ');
  if (i < 0) return { first: clean, rest: '' };
  return { first: clean.slice(0, i), rest: clean.slice(i + 1) };
}

/** A person's name on two lines, first name large, the rest smaller beneath.
 *  Long single words break rather than overflow; nothing is cut with an
 *  ellipsis. `after` renders inline after the first name (an age, a check). */
export function StackedName({
  name, size = 14, color, restColor, weight = 800, after, children,
}: {
  name: string;
  /** Font size of the first name; the second line is ~76% of it. */
  size?: number;
  color: string;
  restColor?: string;
  weight?: number;
  after?: ReactNode;
  /** Optional wrapper for the text (e.g. a profile link). Receives the node. */
  children?: (node: ReactNode) => ReactNode;
}) {
  const { first, rest } = splitPersonName(name);
  const body = (
    <span className="flex flex-col min-w-0" title={name} style={{ lineHeight: 1.12 }}>
      <span style={{ fontSize: size, fontWeight: weight, color, overflowWrap: 'anywhere' }}>
        {first}{after}
      </span>
      {rest && (
        <span style={{ fontSize: Math.max(10, Math.round(size * 0.76)), fontWeight: 600, color: restColor ?? color, opacity: restColor ? 1 : 0.78, overflowWrap: 'anywhere', marginTop: 1 }}>
          {rest}
        </span>
      )}
    </span>
  );
  return <>{children ? children(body) : body}</>;
}
