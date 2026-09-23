'use client';

// How a delegation looks in Applications (owner, 23 Sep 2026: "have a bigger
// icon/circle for it ... identify what needs to be important").
//
// A delegation is a school or society, so it gets the same shape a person
// does: a large round avatar carrying its initials in gold on a forest disc
// (or its own logo when `societies.logo_url` is set), the name bold beside it,
// and its facts (members, where it is based, else where most members are
// from, who leads it) quiet underneath.
// Used by the People rows, the applicant pop-up and the Delegations list, so
// all three read as one thing.

import { useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName, getCountryByCode } from '@/lib/countries';

const OUTFIT = "'Outfit', sans-serif";
const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5E5145';
const GOLD = '#EED98A';
const GOLD_DEEP = '#B6871F';

const SMALL_WORDS = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'le', 'du', 'des', 'y', 'e', 'at', 'in', '&']);

/** Two letters for a delegation: an all-caps short name keeps its first two
 *  letters (MUNBU → MU is worse than MB, so acronyms take first and last),
 *  otherwise the first letters of its first two meaningful words. */
export function delegationInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const words = clean.split(/[\s\-_/]+/).filter(w => w && !SMALL_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return clean.slice(0, 2).toUpperCase();
  if (words.length === 1) {
    const w = words[0].replace(/[^\p{L}\p{N}]/gu, '');
    if (w.length >= 3 && w === w.toUpperCase()) return (w[0] + w[w.length - 1]).toUpperCase();
    return w.slice(0, 2).toUpperCase() || '?';
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function DelegationAvatar({ name, size = 52, logoUrl }: { name: string; size?: number; logoUrl?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (logoUrl && failed !== logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        onError={() => setFailed(logoUrl)}
        className="flex-shrink-0 select-none"
        style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', background: '#FFFFFF', border: `1.5px solid ${GOLD}` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0 select-none"
      style={{
        width: size, height: size, borderRadius: 999,
        background: `radial-gradient(120% 120% at 25% 20%, #2A5A3C 0%, ${FOREST} 70%)`,
        border: `1.5px solid ${GOLD}`,
        color: GOLD, fontFamily: OUTFIT, fontWeight: 900,
        fontSize: Math.round(size * 0.36), letterSpacing: '0.02em', lineHeight: 1,
      }}
    >
      {delegationInitials(name)}
    </span>
  );
}

/** A real rectangular flag for a nationality (Applications keeps real flags,
 *  never circles, owner 23 Sep 2026), or nothing. */
export function RectFlag({ country, size = 16 }: { country: string | null | undefined; size?: number }) {
  if (!country) return null;
  const code = getCountryByName(country)?.code ?? getCountryByCode(country.toUpperCase())?.code ?? null;
  if (!code) return null;
  return (
    <span title={country} className="inline-flex items-center flex-shrink-0" style={{ lineHeight: 0 }}>
      <FlagImg code={code} size={size} />
    </span>
  );
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Where a delegation is based, as "City, Country" and the ISO code for its
 *  flag, or null when neither `city` nor `country_code` is set. */
export function delegationPlace(city: string | null | undefined, countryCode: string | null | undefined): { label: string; code: string | null } | null {
  const c = city?.trim() || '';
  const code = countryCode?.trim().toUpperCase() || '';
  const countryName = code ? (getCountryByCode(code)?.name ?? code) : '';
  const label = [c, countryName].filter(Boolean).join(', ');
  return label ? { label, code: code || null } : null;
}

/** One delegation as an identity block: avatar, bold name, facts beneath. */
export function DelegationIdentity({
  name, size = 52, members, country, lead, leadRole, nameSize, tone = 'light', logoUrl, city, countryCode,
}: {
  name: string;
  size?: number;
  /** `societies.logo_url`; the initials disc when absent. */
  logoUrl?: string | null;
  /** `societies.city` / `societies.country_code`: where the delegation is
   *  based. When either is set it replaces the members' nationality line. */
  city?: string | null;
  countryCode?: string | null;
  /** Members coming or applying (the list's "registered"). */
  members?: number | null;
  /** Most common nationality among members, labelled as such. */
  country?: string | null;
  /** The head delegate or faculty advisor who leads it. */
  lead?: string | null;
  leadRole?: string | null;
  nameSize?: number;
  tone?: 'light' | 'dark';
}) {
  const ink = tone === 'dark' ? '#FFFFFF' : INK;
  const soft = tone === 'dark' ? 'rgba(237,231,216,0.82)' : INK_SOFT;
  const facts: React.ReactNode[] = [];
  if (members != null) facts.push(<span key="m" style={{ fontVariantNumeric: 'tabular-nums' }}>{plural(members, 'member')}</span>);
  const place = delegationPlace(city, countryCode);
  if (place) {
    facts.push(
      <span key="c" className="inline-flex items-center gap-1.5 min-w-0" title={`Based in ${place.label}`}>
        {place.code && <span className="inline-flex items-center flex-shrink-0" style={{ lineHeight: 0 }}><FlagImg code={place.code} size={15} /></span>}
        <span className="truncate">{place.label}</span>
      </span>,
    );
  } else if (country) {
    facts.push(
      <span key="c" className="inline-flex items-center gap-1.5 min-w-0" title={`Most members are from ${country}`}>
        <RectFlag country={country} size={15} />
        <span className="truncate">{country}</span>
      </span>,
    );
  }
  return (
    <span className="flex items-center gap-3 min-w-0">
      <DelegationAvatar name={name} size={size} logoUrl={logoUrl} />
      <span className="min-w-0 flex-1 block">
        <span className="block truncate" title={name} style={{ fontFamily: OUTFIT, fontSize: nameSize ?? Math.max(14, Math.round(size * 0.31)), fontWeight: 800, color: ink, lineHeight: 1.2 }}>
          {name}
        </span>
        {facts.length > 0 && (
          <span className="flex items-center gap-2 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: soft, marginTop: 2 }}>
            {facts.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-2 min-w-0">
                {i > 0 && <span aria-hidden>·</span>}
                {f}
              </span>
            ))}
          </span>
        )}
        {lead !== undefined && (
          <span className="flex items-center gap-1.5 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: soft, marginTop: 2 }}>
            <Crown size={12} strokeWidth={2.4} style={{ color: lead ? GOLD_DEEP : soft, flexShrink: 0 }} aria-hidden />
            <span className="truncate">{lead ? `${leadRole ?? 'Head delegate'}: ${lead}` : 'No head delegate yet'}</span>
          </span>
        )}
      </span>
    </span>
  );
}

// ── Per-delegation summary for the People rows and the pop-up ───────────────

export interface DelegationSummary {
  name: string;
  /** Members coming or still waiting on a decision (not rejected / withdrawn). */
  members: number;
  /** Most common nationality among those members (labelled as such). */
  country: string | null;
  lead: string | null;
  leadRole: string | null;
  leadAppIds: string[];
  logoUrl: string | null;
  city: string | null;
  countryCode: string | null;
}

interface SummaryApp {
  id: string;
  role: string;
  status: string;
  is_head_delegate: boolean;
  society_id: string | null;
  societies: { name: string; city?: string | null; country_code?: string | null; logo_url?: string | null } | null;
  invited_name: string | null;
  invited_email: string | null;
  profiles: { display_name: string; nationality: string | null } | null;
}

const LIVE = new Set(['submitted', 'accepted', 'assigned', 'checked-in']);

/** One pass over the applications the page already holds; no I/O. */
export function useDelegationSummaries(apps: SummaryApp[]): Map<string, DelegationSummary> {
  return useMemo(() => {
    const groups = new Map<string, SummaryApp[]>();
    for (const a of apps) {
      if (!a.society_id || !LIVE.has(a.status)) continue;
      const g = groups.get(a.society_id);
      if (g) g.push(a); else groups.set(a.society_id, [a]);
    }
    const out = new Map<string, DelegationSummary>();
    for (const [id, g] of groups) {
      const nat = new Map<string, number>();
      for (const a of g) {
        const n = a.profiles?.nationality?.trim();
        if (n) nat.set(n, (nat.get(n) ?? 0) + 1);
      }
      let country: string | null = null;
      let best = 0;
      for (const [n, c] of nat) if (c > best) { best = c; country = n; }
      const heads = g.filter(a => a.is_head_delegate || a.role === 'head-delegate');
      const advisors = g.filter(a => a.role === 'faculty-advisor');
      const leaders = heads.length ? heads : advisors;
      const first = leaders[0];
      const nameOf = (a: SummaryApp) => a.profiles?.display_name || a.invited_name || a.invited_email || 'Unknown';
      const soc = g.find(a => a.societies?.name)?.societies ?? null;
      out.set(id, {
        name: soc?.name ?? 'Delegation',
        logoUrl: soc?.logo_url ?? null,
        city: soc?.city ?? null,
        countryCode: soc?.country_code ?? null,
        members: g.length,
        country,
        lead: first ? `${nameOf(first)}${leaders.length > 1 ? ` and ${leaders.length - 1} more` : ''}` : null,
        leadRole: first ? (heads.length ? 'Head delegate' : 'Faculty advisor') : null,
        leadAppIds: leaders.map(a => a.id),
      });
    }
    return out;
  }, [apps]);
}
