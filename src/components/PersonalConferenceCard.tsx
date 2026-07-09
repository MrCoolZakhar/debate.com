'use client';

// Shared "a conference I'm personally connected to" card — banner/logo strip,
// countdown chip, date + location, role badge(s). Used by /account/calendar
// (which merges every role a user holds into one card) and /my-conferences
// (one card per tab, one role badge each).

import Link from 'next/link';
import { CalendarClock, MapPin, ArrowUpRight, Sparkles } from 'lucide-react';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { Pill, type PillTone, OUTFIT, MONO } from '@/app/account/accountUi';

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

/** A role the signed-in user holds at a conference — becomes a tinted tag chip. */
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
  if (e < today) return null;               // fully past — handled elsewhere
  if (s <= today && today <= e) return { label: 'Happening now', tone: 'gold' };
  const days = Math.round((s - today) / 86_400_000);
  if (days === 0) return { label: 'Starts today', tone: 'gold' };
  if (days === 1) return { label: 'Tomorrow', tone: 'amber' };
  if (days <= 7) return { label: 'This week', tone: 'amber' };
  if (days <= 30) return { label: `In ${days} days`, tone: 'sky' };
  const months = Math.round(days / 30);
  return { label: months <= 1 ? 'In ~1 month' : `In ~${months} months`, tone: 'neutral' };
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

// ── Conference card ──────────────────────────────────────────────────────────

export function PersonalConferenceCard({
  conference, roles, href, manageHref, muted = false,
}: {
  conference: CardConference;
  roles: RoleTag[];
  /** Where the title / card body links. */
  href: string;
  /** Optional extra "Manage conference" affordance at the bottom of the card. */
  manageHref?: string;
  /** Past conferences render slightly muted. */
  muted?: boolean;
}) {
  const conf = conference;
  const country = conf.country ? getCountryByName(conf.country) : null;
  const flag = country ? getFlagUrl(country.code) : null;
  const cd = countdown(conf.start_date, conf.end_date);
  const place = [conf.city, conf.country].filter(Boolean).join(', ');

  return (
    <div
      className="group relative rounded-[22px] overflow-hidden transition-all"
      style={{
        backgroundColor: 'rgba(250,248,243,0.86)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        border: '1.5px solid #D8CDB6',
        boxShadow: '0 1px 3px rgba(27,56,40,0.07), 0 12px 32px rgba(27,56,40,0.08)',
        opacity: muted ? 0.82 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(27,56,40,0.34)';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(27,56,40,0.08), 0 20px 48px rgba(27,56,40,0.11)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#D8CDB6';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(27,56,40,0.07), 0 12px 32px rgba(27,56,40,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Soft header strip — banner if present, otherwise a warm forest wash */}
      <div
        className="relative"
        style={{
          height: '76px',
          background: conf.banner_url
            ? undefined
            : 'linear-gradient(135deg, #1B3828 0%, #24492F 60%, #2A5A3C 100%)',
        }}
      >
        {conf.banner_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={conf.banner_url}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        )}
        {/* gentle fade into the card body so the free-floating logo reads cleanly */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: '46px', background: 'linear-gradient(to bottom, transparent, rgba(250,248,243,0.86))' }}
        />
        {/* Countdown chip floats top-right on the strip */}
        {cd && (
          <div className="absolute" style={{ top: '12px', right: '14px' }}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full"
              style={{
                padding: '4px 10px',
                backgroundColor: 'rgba(250,248,243,0.92)',
                border: '1px solid rgba(221,212,192,0.9)',
                boxShadow: '0 2px 8px rgba(27,56,40,0.14)',
                color: cd.tone === 'gold' ? '#7A5A20' : cd.tone === 'amber' ? '#8A5A2C' : cd.tone === 'sky' ? '#365A72' : '#6E5F4E',
                fontFamily: OUTFIT,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <CalendarClock size={12} strokeWidth={2.2} />
              {cd.label}
            </span>
          </div>
        )}
      </div>

      {/* Free-floating logo overlapping the strip */}
      <div className="px-5" style={{ marginTop: '-30px' }}>
        <div className="flex items-end gap-3.5">
          <div className="relative flex-shrink-0">
            {conf.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={conf.logo_url}
                alt={conf.acronym}
                style={{
                  width: '58px',
                  height: '58px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 10px 20px rgba(27,56,40,0.30))',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center font-black rounded-2xl"
                style={{
                  width: '58px',
                  height: '58px',
                  backgroundColor: '#FAF8F3',
                  border: '1px solid rgba(221,212,192,0.95)',
                  color: '#1B3828',
                  fontFamily: OUTFIT,
                  fontSize: '18px',
                  boxShadow: '0 8px 18px rgba(27,56,40,0.16)',
                }}
              >
                {conf.acronym?.slice(0, 3).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-xs" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', margin: 0 }}>
              {conf.acronym}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-3 pb-5">
        <Link
          href={href}
          className="inline-flex items-start gap-1.5 focus:outline-none"
          style={{ textDecoration: 'none' }}
        >
          <span
            className="font-bold text-[15px] leading-snug transition-colors"
            style={{ color: '#1C1410', fontFamily: OUTFIT }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#1B3828'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1C1410'; }}
          >
            {conf.full_name}
            <ArrowUpRight size={14} strokeWidth={2.4} className="inline ml-0.5 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#B6871F' }} />
          </span>
        </Link>

        {/* Meta row: date range + location */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
          <span className="inline-flex items-center gap-1.5" style={{ color: '#9A8A78', fontFamily: MONO, fontSize: '11px' }}>
            <CalendarClock size={12} strokeWidth={2} style={{ color: '#B6871F' }} />
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
          {place && (
            <span className="inline-flex items-center gap-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontSize: '12px' }}>
              {flag ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={flag} alt="" style={{ width: '16px', height: '11px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }} />
              ) : (
                <MapPin size={12} strokeWidth={2} style={{ color: '#9A8A78' }} />
              )}
              {place}
            </span>
          )}
        </div>

        {/* Role tags — every role the user holds here */}
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {roles.map((tag) => (
            <RoleTagChip key={tag.key} tag={tag} />
          ))}
        </div>

        {/* Organiser affordance */}
        {manageHref && (
          <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
            <Link
              href={manageHref}
              className="inline-flex items-center gap-1.5 rounded-lg focus:outline-none transition-colors"
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(27,56,40,0.08)',
                border: '1px solid rgba(27,56,40,0.2)',
                color: '#1B3828',
                fontFamily: OUTFIT,
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.08)'; }}
            >
              <Sparkles size={13} strokeWidth={2.2} />
              Manage conference
              <ArrowUpRight size={13} strokeWidth={2.4} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

export function ConferenceCardSkeleton() {
  return (
    <div
      className="rounded-[22px] overflow-hidden"
      style={{ backgroundColor: 'rgba(250,248,243,0.7)', border: '1.5px solid rgba(216,205,182,0.8)' }}
    >
      <div style={{ height: '76px', background: 'linear-gradient(135deg, rgba(27,56,40,0.14), rgba(42,90,60,0.1))' }} />
      <div className="px-5 pb-5" style={{ marginTop: '-30px' }}>
        <div className="rounded-2xl shimmer" style={{ width: '58px', height: '58px' }} />
        <div className="rounded-md shimmer mt-4" style={{ height: '15px', width: '70%' }} />
        <div className="rounded-md shimmer mt-2.5" style={{ height: '11px', width: '45%' }} />
        <div className="flex gap-2 mt-4">
          <div className="rounded-md shimmer" style={{ height: '22px', width: '78px' }} />
          <div className="rounded-md shimmer" style={{ height: '22px', width: '96px' }} />
        </div>
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
