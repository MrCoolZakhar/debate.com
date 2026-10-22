'use client';

// The delegation as it reads inside one People row on Applications.
//
// Owner, 22 Oct 2026: the delegation in a person's row was too small. It is now
// ONE longer pill under the person, slightly indented: the delegation's round
// crest, its name bold (never cut, it wraps), where it is based (round flag +
// the city, else the country's short name: UK, USA, UAE) and
// "N members · M expected". Who leads it and this applicant's own expected
// size stay in the hover title (rowDelegationTitle).
//
// Presentational only; the caller owns the click (DelegationPopupLink) and
// draws the pill's shape with ROW_DELEGATION_PILL so the hover tint of the
// button is the pill itself.

import DelegationCrest from '@/components/DelegationCrest';
import { CircleFlag } from '@/components/CircleFlag';
import { getCountryByCode } from '@/lib/countries';
import { DelegationAvatar, delegationPlace, plural } from './DelegationAvatar';
import { countryShortName } from '../assignment/displayNames';

const OUTFIT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5E5145';

/** The delegation's disc, small, over the bottom corner of the person's avatar.
 *  Kept for other callers; the People row now carries the crest in its pill. */
export function RowDelegationBadge({ name, logoUrl, size = 26 }: { name: string; logoUrl?: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      className="absolute"
      style={{ right: -Math.round(size * 0.3), bottom: -Math.round(size * 0.2), lineHeight: 0, pointerEvents: 'none', borderRadius: 999, boxShadow: '0 0 0 2px #FFFFFF' }}
    >
      <DelegationAvatar name={name} size={size} logoUrl={logoUrl} />
    </span>
  );
}

/** The pill's shape, drawn by whoever wraps <RowDelegation> (the button or a div). */
export const ROW_DELEGATION_PILL: React.CSSProperties = {
  display: 'inline-flex',
  maxWidth: '100%',
  margin: '10px 0 8px 6px',
  padding: '6px 16px 6px 6px',
  borderRadius: 22,
  background: '#FFFFFF',
  border: '1px solid rgba(182,135,31,0.30)',
  boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 6px 16px -8px rgba(27,56,40,0.22)',
  textAlign: 'left',
};

export interface RowDelegationProps {
  name: string;
  logoUrl?: string | null;
  city?: string | null;
  countryCode?: string | null;
  members?: number | null;
  /** The delegation's expected size (src/lib/delegationExpected.ts), or null when unknown. */
  expected?: number | null;
  /** The leader's name ("Ana Pérez and 1 more"), or null when nobody leads. */
  lead?: string | null;
  leadRole?: string | null;
  /** This applicant is (one of) the delegation's leaders. */
  leads?: boolean;
  /** Expected size this applicant asked for, when they pledged a delegation. */
  pledge?: { spots: number; received: boolean } | null;
}

/** The full sentence behind the pill, for the row's hover title. */
export function rowDelegationTitle(p: RowDelegationProps): string {
  const parts: string[] = [];
  if (p.members != null) parts.push(plural(p.members, 'member'));
  if (p.expected != null) parts.push(`${p.expected} expected`);
  const place = delegationPlace(p.city, p.countryCode);
  if (place) parts.push(`Based in ${place.label}`);
  if (p.leads) parts.push(`${p.leadRole ?? 'Head Delegate'}: this applicant`);
  else if (p.lead) parts.push(`${p.leadRole ?? 'Head Delegate'}: ${p.lead}`);
  else parts.push('No head delegate yet');
  if (p.pledge) parts.push(`Asked for an expected size of ${p.pledge.spots}${p.pledge.received ? ', received' : ''}`);
  return parts.join(' · ');
}

export function RowDelegation(p: RowDelegationProps) {
  const place = delegationPlace(p.city, p.countryCode);
  const city = p.city?.trim() || '';
  const countryName = place?.code ? (getCountryByCode(place.code)?.name ?? place.code) : '';
  // "City, Country" with the country's short name (London, UK); the country alone when there is no city.
  const shortCountry = place?.code ? countryShortName(countryName, place.code) : '';
  const placeLabel = place ? [city, shortCountry].filter(Boolean).join(', ') : '';

  const counts: string[] = [];
  if (p.members != null) counts.push(plural(p.members, 'member'));
  if (p.expected != null && p.expected > 0) counts.push(`${p.expected} expected`);

  return (
    <span className="flex items-center min-w-0" style={{ gap: 10, fontFamily: OUTFIT }}>
      <span className="flex-shrink-0" style={{ lineHeight: 0 }}>
        <DelegationCrest name={p.name} logoUrl={p.logoUrl ?? null} size={30} />
      </span>
      <span className="flex flex-wrap items-center min-w-0" style={{ gap: '2px 12px' }}>
        <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontSize: 14.5, fontWeight: 700, color: INK, lineHeight: 1.25 }}>
          {p.name}
        </span>
        {(placeLabel || counts.length > 0) && (
          <span className="inline-flex flex-wrap items-center min-w-0" style={{ gap: '2px 6px', fontSize: 12.5, fontWeight: 500, color: INK_SOFT, lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }}>
            {placeLabel && (
              <span className="inline-flex items-center gap-1.5 min-w-0" title={place && place.label !== placeLabel ? place.label : undefined}>
                {place?.code && <CircleFlag code={place.code} size={15} decorative />}
                <span className="[overflow-wrap:anywhere]">{placeLabel}</span>
              </span>
            )}
            {counts.length > 0 && (
              <span className="whitespace-nowrap">
                {placeLabel && <span aria-hidden style={{ opacity: 0.55, marginRight: 6 }}>·</span>}
                {counts.join(' · ')}
              </span>
            )}
          </span>
        )}
      </span>
    </span>
  );
}
