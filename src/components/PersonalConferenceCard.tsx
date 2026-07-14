'use client';

// Shared "a conference I'm personally connected to" card: acronym-forward name,
// floating logo, countdown chip, date + location, role badge(s). Used by
// /account/calendar (which merges every role a user holds into one card),
// /my-conferences and /account/conferences (one card per tab, one role each).
//
// Redesigned to match the organiser-side neumorphism (see components/neu.tsx):
// a soft extruded ivory NeuCard surface, denser padding so more cards fit per
// view, the acronym as the primary label with the full name as a small line
// above it.

import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, MapPin, ArrowUpRight, Sparkles, Users } from 'lucide-react';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { Pill, type PillTone, OUTFIT } from '@/app/account/accountUi';
import { NEU, EASE } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CardConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  start_date: string;
  end_date: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_public?: boolean;
  status?: string;
}

/** A role the signed-in user holds at a conference, becomes a tinted tag chip. */
export interface RoleTag {
  key: string;        // dedupe key so the same role isn't shown twice
  label: string;      // "Organiser", "Chair · DISEC", "Delegate · France"…
  tone: PillTone;
  countryName?: string; // renders a small rectangular flag before the label
}

// Role → warm tint, per the account palette.
export const ROLE_TONE: Record<string, PillTone> = {
  organiser: 'forest',
  chair:     'gold',
  delegate:  'sky',
  advisor:   'plum',
  observer:  'neutral',
  staff:     'forest',
};

export const ORGANISER_LABEL: Record<string, string> = {
  owner:       'Organiser · Owner',
  secretariat: 'Organiser · Secretariat',
  organizer:   'Organiser',
};

// ── Date helpers ─────────────────────────────────────────────────────────────

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} ${s.getFullYear()} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

/** Human countdown chip text for upcoming conferences. Returns null when past. */
export function countdown(start: string, end: string): { label: string; tone: PillTone } | null {
  const today = startOfToday().getTime();
  const s = new Date(start + 'T00:00:00').getTime();
  const e = new Date(end + 'T00:00:00').getTime();
  if (e < today) return null;               // fully past, handled elsewhere
  if (s <= today && today <= e) return { label: 'Happening now', tone: 'gold' };
  const days = Math.round((s - today) / 86_400_000);
  if (days === 0) return { label: 'Starts today', tone: 'gold' };
  if (days === 1) return { label: 'Tomorrow', tone: 'amber' };
  if (days <= 7) return { label: 'This week', tone: 'amber' };
  if (days <= 30) return { label: `In ${days} days`, tone: 'sky' };
  const months = Math.round(days / 30);
  return { label: months <= 1 ? 'In ~1 month' : `In ~${months} months`, tone: 'neutral' };
}

// ── Acronym-forward name ─────────────────────────────────────────────────────
// Primary label = the acronym; if the acronym does not already carry the
// 4-digit year, the trailing year parsed from the full name is appended
// (so "Harvard World Model United Nations 2027" / "WorldMUN" → "WorldMUN 2027").
// Secondary = the full spelled-out name, shown small above the primary. With no
// acronym, the full name is the sole (primary) label.

export function acronymForward(
  fullName: string,
  acronym: string | null | undefined,
): { primary: string; secondary: string | null } {
  const acr = (acronym ?? '').trim();
  if (!acr) return { primary: fullName, secondary: null };
  let primary = acr;
  if (!/\b(?:19|20)\d{2}\b/.test(acr)) {
    const years = fullName.match(/\b(?:19|20)\d{2}\b/g);
    const year = years?.[years.length - 1];
    if (year) primary = `${acr} ${year}`;
  }
  return { primary, secondary: fullName };
}

// ── Role tag chip ────────────────────────────────────────────────────────────

export function RoleTagChip({ tag }: { tag: RoleTag }) {
  const country = tag.countryName ? getCountryByName(tag.countryName) : null;
  const flag = country ? getFlagUrl(country.code) : null;
  return (
    <Pill
      tone={tag.tone}
      size="sm"
      icon={
        flag ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={flag}
            alt=""
            style={{ width: '15px', height: '10px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 2px rgba(27,56,40,0.25)' }}
          />
        ) : undefined
      }
    >
      {tag.label}
    </Pill>
  );
}

// ── Countdown chip (pressed-in neu well) ─────────────────────────────────────

const CD_TEXT: Record<string, string> = {
  gold: '#7A5A20', amber: '#8A5A2C', sky: '#365A72', neutral: '#6E5F4E',
};

function CountdownChip({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        backgroundColor: NEU.base,
        boxShadow: NEU.inSm,
        color: CD_TEXT[tone] ?? CD_TEXT.neutral,
        fontFamily: OUTFIT,
        fontSize: '10.5px',
        fontWeight: 800,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <CalendarClock size={11} strokeWidth={2.4} />
      {label}
    </span>
  );
}

// ── Conference card ──────────────────────────────────────────────────────────

export function PersonalConferenceCard({
  conference, roles, href, manageHref, manageDelegationHref, muted = false,
}: {
  conference: CardConference;
  roles: RoleTag[];
  /** Where the title / card body links. */
  href: string;
  /** Optional extra "Manage conference" affordance at the bottom of the card. */
  manageHref?: string;
  /** Optional "Manage delegation" affordance for delegation leaders (head
   *  delegate / faculty advisor) — links to the delegation seat portal. */
  manageDelegationHref?: string;
  /** Past conferences render slightly muted. */
  muted?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const conf = conference;
  const country = conf.country ? getCountryByName(conf.country) : null;
  const flag = country ? getFlagUrl(country.code) : null;
  const cd = countdown(conf.start_date, conf.end_date);
  const place = [conf.city, conf.country].filter(Boolean).join(', ');
  const { primary, secondary } = acronymForward(conf.full_name, conf.acronym);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 20,
        padding: '15px 16px 16px',
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        opacity: muted ? 0.82 : 1,
      }}
    >
      {/* Header: floating logo + acronym-forward name + countdown */}
      <div className="flex items-start gap-3">
        <LogoDisc
          src={conf.logo_url}
          alt={conf.acronym || conf.full_name}
          size={46}
          fallbackText={(conf.acronym || conf.full_name)?.slice(0, 3)}
        />

        <div className="min-w-0 flex-1">
          {secondary && (
            <p
              className="truncate"
              style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.01em', margin: 0, lineHeight: 1.35 }}
            >
              {secondary}
            </p>
          )}
          <Link
            href={href}
            className="inline-flex items-start gap-1 focus:outline-none"
            style={{ textDecoration: 'none', maxWidth: '100%' }}
          >
            <span
              className="font-black leading-tight transition-colors"
              style={{ color: hovered ? NEU.forest : NEU.ink, fontFamily: OUTFIT, fontSize: '17px', letterSpacing: '-0.01em' }}
            >
              {primary}
              <ArrowUpRight
                size={14}
                strokeWidth={2.6}
                className="inline ml-0.5 mb-0.5 transition-opacity"
                style={{ color: NEU.deepGold, opacity: hovered ? 1 : 0 }}
              />
            </span>
          </Link>
        </div>

        {cd && <CountdownChip label={cd.label} tone={cd.tone} />}
      </div>

      {/* Meta: date range + location */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-3">
        <span className="inline-flex items-center gap-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: '11.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          <CalendarClock size={12} strokeWidth={2.2} style={{ color: NEU.deepGold }} />
          {formatDateRange(conf.start_date, conf.end_date)}
        </span>
        {place && (
          <span className="inline-flex items-center gap-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: '11.5px', fontWeight: 600 }}>
            {flag ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={flag} alt="" style={{ width: '16px', height: '11px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }} />
            ) : (
              <MapPin size={12} strokeWidth={2.2} style={{ color: NEU.muted }} />
            )}
            {place}
          </span>
        )}
      </div>

      {/* Role tags, every role the user holds here */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {roles.map((tag) => (
          <RoleTagChip key={tag.key} tag={tag} />
        ))}
      </div>

      {/* Organiser affordance */}
      {manageHref && (
        <div className="mt-3.5 pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
          <Link
            href={manageHref}
            className="inline-flex items-center gap-1.5 focus:outline-none transition-colors"
            style={{
              padding: '6px 13px',
              borderRadius: 999,
              backgroundColor: NEU.surface,
              boxShadow: NEU.outSm,
              color: NEU.forest,
              fontFamily: OUTFIT,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.03em',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
          >
            <Sparkles size={13} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
            Manage conference
            <ArrowUpRight size={13} strokeWidth={2.6} />
          </Link>
        </div>
      )}

      {/* Delegation-leader affordance (head delegate / faculty advisor) */}
      {manageDelegationHref && (
        <div className="mt-3.5 pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
          <Link
            href={manageDelegationHref}
            className="inline-flex items-center gap-1.5 focus:outline-none transition-colors"
            style={{
              padding: '6px 13px',
              borderRadius: 999,
              background: `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`,
              boxShadow: `0 3px 8px ${NEU.deepGold}44, ${NEU.outSm}`,
              color: NEU.forest,
              fontFamily: OUTFIT,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.03em',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 5px 12px ${NEU.deepGold}66, ${NEU.outSmHover}`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 3px 8px ${NEU.deepGold}44, ${NEU.outSm}`; }}
          >
            <Users size={13} strokeWidth={2.6} style={{ color: NEU.forest }} />
            Manage delegation
            <ArrowUpRight size={13} strokeWidth={2.6} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

export function ConferenceCardSkeleton() {
  return (
    <div
      style={{ backgroundColor: NEU.surface, borderRadius: 20, padding: '15px 16px 16px', boxShadow: NEU.out }}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full shimmer flex-shrink-0" style={{ width: '46px', height: '46px' }} />
        <div className="flex-1 min-w-0">
          <div className="rounded-md shimmer" style={{ height: '10px', width: '60%' }} />
          <div className="rounded-md shimmer mt-2" style={{ height: '16px', width: '45%' }} />
        </div>
      </div>
      <div className="rounded-md shimmer mt-4" style={{ height: '11px', width: '70%' }} />
      <div className="flex gap-2 mt-3.5">
        <div className="rounded-md shimmer" style={{ height: '20px', width: '78px' }} />
        <div className="rounded-md shimmer" style={{ height: '20px', width: '96px' }} />
      </div>
      <style jsx>{`
        .shimmer {
          background: linear-gradient(90deg, rgba(221,212,192,0.35) 25%, rgba(221,212,192,0.6) 50%, rgba(221,212,192,0.35) 75%);
          background-size: 200% 100%;
          animation: cal-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes cal-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
