'use client';

// The delegation as it reads inside one People row on Applications (owner,
// 21 Oct 2026: "too many lines in a row ... the delegation cell should be 3,
// max 4 lines"). Two lines instead of seven:
//
//   1. the delegation name, bold (the one thing an organiser scans for)
//   2. one small line of icon + value facts: members, where it is based (short
//      country name), who leads it, the expected size it asked for
//
// Its round disc no longer takes a column of its own: <RowDelegationBadge>
// sits over the corner of the applicant's avatar, so the text gets the width.
// Every value shown before is still here, either on the line or in a title.
// Presentational only; the caller owns the click (DelegationPopupLink).

import { Crown, HandCoins, Users, Check } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByCode } from '@/lib/countries';
import { DelegationAvatar, delegationPlace, plural } from './DelegationAvatar';
import { countryShortName } from '../assignment/displayNames';

const OUTFIT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5E5145';
const GOLD_DEEP = '#B6871F';
const FOREST = '#1B3828';

/** The delegation's disc, small, over the bottom corner of the person's avatar.
 *  Decorative: the delegation line beside it is the click target. */
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

export interface RowDelegationProps {
  name: string;
  city?: string | null;
  countryCode?: string | null;
  members?: number | null;
  /** The leader's name ("Ana Pérez and 1 more"), or null when nobody leads. */
  lead?: string | null;
  leadRole?: string | null;
  /** This applicant is (one of) the delegation's leaders. */
  leads?: boolean;
  /** Expected size this applicant asked for, when they pledged a delegation. */
  pledge?: { spots: number; received: boolean } | null;
}

/** The full sentence behind the short line, for the row's hover title. */
export function rowDelegationTitle(p: RowDelegationProps): string {
  const parts: string[] = [];
  if (p.members != null) parts.push(plural(p.members, 'member'));
  const place = delegationPlace(p.city, p.countryCode);
  if (place) parts.push(`Based in ${place.label}`);
  if (p.leads) parts.push(`${p.leadRole ?? 'Head Delegate'}: this applicant`);
  else if (p.lead) parts.push(`${p.leadRole ?? 'Head Delegate'}: ${p.lead}`);
  else parts.push('No head delegate yet');
  if (p.pledge) parts.push(`Expected size ${p.pledge.spots}${p.pledge.received ? ', received' : ''}`);
  return parts.join(' · ');
}

const sep = <span aria-hidden style={{ opacity: 0.55 }}>·</span>;

export function RowDelegation(p: RowDelegationProps) {
  const facts: React.ReactNode[] = [];

  if (p.members != null) {
    facts.push(
      <span key="m" className="inline-flex items-center gap-1" title={plural(p.members, 'member')} style={{ fontVariantNumeric: 'tabular-nums' }}>
        <Users size={12} strokeWidth={1.75} aria-hidden />
        {p.members}
      </span>,
    );
  }

  const place = delegationPlace(p.city, p.countryCode);
  if (place) {
    const city = p.city?.trim() || '';
    const countryName = place.code ? (getCountryByCode(place.code)?.name ?? place.code) : '';
    // The city alone when there is one (the flag says the country), else the
    // country's short name ("UK", "USA"). The full place is the title.
    const shortLabel = city || countryShortName(countryName, place.code);
    facts.push(
      <span key="p" className="inline-flex items-center gap-1 min-w-0" title={`Based in ${place.label}`}>
        {place.code && <span className="inline-flex items-center flex-shrink-0" style={{ lineHeight: 0 }}><FlagImg code={place.code} size={13} /></span>}
        <span className="[overflow-wrap:anywhere]">{shortLabel}</span>
      </span>,
    );
  }

  const leadTitle = p.leads
    ? `${p.leadRole ?? 'Head Delegate'}: this applicant`
    : p.lead ? `${p.leadRole ?? 'Head Delegate'}: ${p.lead}` : 'No head delegate yet';
  facts.push(
    <span key="l" className="inline-flex items-center gap-1 min-w-0" title={leadTitle}>
      <Crown size={12} strokeWidth={1.75} aria-hidden style={{ color: p.leads || p.lead ? GOLD_DEEP : INK_SOFT, flexShrink: 0 }} />
      <span className="[overflow-wrap:anywhere]" style={p.leads ? { color: GOLD_DEEP, fontWeight: 700 } : undefined}>
        {p.leads ? 'Leads it' : p.lead ?? 'No head yet'}
      </span>
    </span>,
  );

  if (p.pledge) {
    const t = `Expected size ${p.pledge.spots}${p.pledge.received ? ', received' : ''}`;
    facts.push(
      <span key="e" className="inline-flex items-center gap-1" title={t} style={{ color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
        <HandCoins size={12} strokeWidth={1.75} aria-hidden />
        {p.pledge.spots} expected
        {p.pledge.received && <Check size={12} strokeWidth={2} aria-label="received" />}
      </span>,
    );
  }

  return (
    <span className="block min-w-0">
      <span className="block [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: INK, lineHeight: 1.2 }}>
        {p.name}
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: INK_SOFT, marginTop: 1, lineHeight: 1.35 }}>
        {facts.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
            {i > 0 && sep}
            {f}
          </span>
        ))}
      </span>
    </span>
  );
}
