'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CalendarClock, MapPin, ArrowUpRight, Compass, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { Eyebrow, Pill, PillTone, OUTFIT, MONO } from '../accountUi';

// ── Types ────────────────────────────────────────────────────────────────────

interface ConferenceRow {
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
}

/** A role the signed-in user holds at a conference — becomes a tinted tag chip. */
interface RoleTag {
  key: string;        // dedupe key so the same role isn't shown twice
  label: string;      // "Organiser", "Chair · DISEC", "Delegate · France"…
  tone: PillTone;
  countryName?: string; // renders a small rectangular flag before the label
}

/** A conference the user is connected to, with every role they hold there. */
interface CalendarEntry {
  conference: ConferenceRow;
  roles: RoleTag[];
  isOrganiser: boolean; // surfaces the "Manage" affordance
}

// Role → warm tint, per the account palette.
const ROLE_TONE = {
  organiser: 'forest' as PillTone,
  chair:     'gold'   as PillTone,
  delegate:  'sky'    as PillTone,
  advisor:   'plum'   as PillTone,
  observer:  'neutral' as PillTone,
  staff:     'forest' as PillTone,
};

const ORGANISER_LABEL: Record<string, string> = {
  owner:       'Organiser · Owner',
  secretariat: 'Organiser · Secretariat',
  organizer:   'Organiser',
};

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateRange(start: string, end: string): string {
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
function countdown(start: string, end: string): { label: string; tone: PillTone } | null {
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

function RoleTagChip({ tag }: { tag: RoleTag }) {
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

function ConferenceCard({ entry }: { entry: CalendarEntry }) {
  const { conference: conf, roles, isOrganiser } = entry;
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
          href={`/conferences/${conf.slug}`}
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
        {isOrganiser && (
          <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
            <Link
              href={`/manage/${conf.slug}`}
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

function SkeletonCard() {
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    if (!user || !session) {
      // No signed-in user — nothing to load; drop the skeleton on the next tick.
      const t = setTimeout(() => { if (!cancelled) setLoading(false); }, 0);
      return () => { cancelled = true; clearTimeout(t); };
    }
    const supabase = getAuthedClient(session.access_token);

    async function loadAll() {
      // Accumulate one entry per conference; merge every role the user holds.
      const byConf = new Map<string, CalendarEntry>();

      function upsert(conf: ConferenceRow | null | undefined, tag: RoleTag, organiser = false) {
        if (!conf?.id) return;
        const existing = byConf.get(conf.id);
        if (existing) {
          if (!existing.roles.some((r) => r.key === tag.key)) existing.roles.push(tag);
          existing.isOrganiser = existing.isOrganiser || organiser;
          // Prefer a conference row that carries a banner/logo for the card art.
          if (!existing.conference.banner_url && conf.banner_url) existing.conference.banner_url = conf.banner_url;
          if (!existing.conference.logo_url && conf.logo_url) existing.conference.logo_url = conf.logo_url;
        } else {
          byConf.set(conf.id, { conference: conf, roles: [tag], isOrganiser: organiser });
        }
      }

      const CONF = 'id, slug, full_name, acronym, start_date, end_date, city, country, logo_url, banner_url';
      const first = <T,>(v: T | T[] | null | undefined): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

      // 1) Organising — conference_organizers (owner / secretariat / organizer)
      // 2) Chairing   — conference_committees where I'm in chair_user_ids
      // 3) Roles      — applications (delegate / head-delegate / chair / faculty-advisor / observer, any status)
      // 4) Allocation — conference_allocations (committee + country), typically delegate
      const [orgRes, chairRes, appRes, allocRes] = await Promise.all([
        supabase
          .from('conference_organizers')
          .select(`role, conferences (${CONF})`)
          .eq('user_id', user!.id),
        supabase
          .from('conference_committees')
          .select(`id, name, conferences (${CONF})`)
          .contains('chair_user_ids', [user!.id]),
        supabase
          .from('applications')
          .select(`id, role, status, assigned_country_name, conferences (${CONF}), conference_committees (name)`)
          .eq('user_id', user!.id),
        supabase
          .from('conference_allocations')
          .select(`country_name, conferences (${CONF}), conference_committees (name)`)
          .eq('user_id', user!.id),
      ]);

      // 1) Organiser
      for (const row of (orgRes.data ?? []) as { role: string; conferences: ConferenceRow | ConferenceRow[] | null }[]) {
        const conf = first(row.conferences);
        upsert(conf, {
          key: 'organiser',
          label: ORGANISER_LABEL[row.role] ?? 'Organiser',
          tone: ROLE_TONE.organiser,
        }, true);
      }

      // 2) Chair (from committee membership)
      for (const row of (chairRes.data ?? []) as { name: string | null; conferences: ConferenceRow | ConferenceRow[] | null }[]) {
        const conf = first(row.conferences);
        upsert(conf, {
          key: 'chair',
          label: row.name ? `Chair · ${row.name}` : 'Chair',
          tone: ROLE_TONE.chair,
        });
      }

      // 3) Applications — map each role to a tinted tag
      for (const row of (appRes.data ?? []) as {
        role: string; status: string; assigned_country_name: string | null;
        conferences: ConferenceRow | ConferenceRow[] | null;
        conference_committees: { name: string } | { name: string }[] | null;
      }[]) {
        const conf = first(row.conferences);
        const committee = first(row.conference_committees)?.name ?? null;
        const country = row.assigned_country_name ?? null;
        let tag: RoleTag;
        switch (row.role) {
          case 'chair':
            tag = { key: 'chair', label: committee ? `Chair · ${committee}` : 'Chair', tone: ROLE_TONE.chair };
            break;
          case 'head-delegate':
            tag = { key: 'head-delegate', label: 'Head Delegate', tone: ROLE_TONE.delegate };
            break;
          case 'faculty-advisor':
            tag = { key: 'faculty-advisor', label: 'Faculty Advisor', tone: ROLE_TONE.advisor };
            break;
          case 'observer':
            tag = { key: 'observer', label: 'Observer', tone: ROLE_TONE.observer };
            break;
          case 'delegate':
          default:
            tag = {
              key: 'delegate',
              label: country ? `Delegate · ${country}` : (committee ? `Delegate · ${committee}` : 'Delegate'),
              tone: ROLE_TONE.delegate,
              countryName: country ?? undefined,
            };
        }
        upsert(conf, tag);
      }

      // 4) Allocations — enrich/confirm the delegate tag with committee + country
      for (const row of (allocRes.data ?? []) as {
        country_name: string | null;
        conferences: ConferenceRow | ConferenceRow[] | null;
        conference_committees: { name: string } | { name: string }[] | null;
      }[]) {
        const conf = first(row.conferences);
        const committee = first(row.conference_committees)?.name ?? null;
        const country = row.country_name ?? null;
        // Overwrite the delegate tag with the richer allocated form if it exists.
        if (conf?.id && byConf.has(conf.id)) {
          const entry = byConf.get(conf.id)!;
          const dIdx = entry.roles.findIndex((r) => r.key === 'delegate');
          const richer: RoleTag = {
            key: 'delegate',
            label: country ? `Delegate · ${country}` : (committee ? `Delegate · ${committee}` : 'Delegate'),
            tone: ROLE_TONE.delegate,
            countryName: country ?? undefined,
          };
          if (dIdx >= 0) entry.roles[dIdx] = richer;
          else entry.roles.push(richer);
        } else {
          upsert(conf, {
            key: 'delegate',
            label: country ? `Delegate · ${country}` : (committee ? `Delegate · ${committee}` : 'Delegate'),
            tone: ROLE_TONE.delegate,
            countryName: country ?? undefined,
          });
        }
      }

      if (cancelled) return;
      setEntries(Array.from(byConf.values()));
      setLoading(false);
    }

    loadAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

  const { upcoming, past } = useMemo(() => {
    const today = startOfToday().getTime();
    const up: CalendarEntry[] = [];
    const pa: CalendarEntry[] = [];
    for (const e of entries) {
      const end = new Date(e.conference.end_date + 'T00:00:00').getTime();
      if (end >= today) up.push(e); else pa.push(e);
    }
    up.sort((a, b) => new Date(a.conference.start_date).getTime() - new Date(b.conference.start_date).getTime());
    pa.sort((a, b) => new Date(b.conference.end_date).getTime() - new Date(a.conference.end_date).getTime());
    return { upcoming: up, past: pa };
  }, [entries]);

  return (
    <div>
      <Eyebrow className="mb-2">Where You&apos;re Headed</Eyebrow>
      <h1
        className="font-black text-[26px] mb-1"
        style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
      >
        Conference Calendar
      </h1>
      <p className="text-sm mb-8" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Every conference you&apos;re part of — organising, chairing, delegating, and more.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : entries.length === 0 ? (
        <div
          className="rounded-[22px] text-center px-6 py-14"
          style={{
            backgroundColor: 'rgba(250,248,243,0.82)',
            backdropFilter: 'blur(14px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
            border: '1.5px dashed #C8BEA8',
          }}
        >
          <span
            className="inline-flex items-center justify-center rounded-2xl mb-4"
            style={{ width: '52px', height: '52px', backgroundColor: 'rgba(27,56,40,0.08)', border: '1px solid rgba(27,56,40,0.16)' }}
          >
            <Compass size={22} strokeWidth={1.9} style={{ color: '#1B3828' }} />
          </span>
          <p className="text-lg font-bold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No conferences yet
          </p>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            When you apply, get assigned, or start organising, it&apos;ll appear right here.
          </p>
          <Link
            href="/conferences/explore"
            className="inline-flex items-center gap-2 rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
          >
            <Compass size={15} strokeWidth={2.2} />
            Explore the directory
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2.5 mb-4">
                <Eyebrow>Upcoming</Eyebrow>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#B6871F' }}>
                  {upcoming.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcoming.map((e) => (
                  <ConferenceCard key={e.conference.id} entry={e} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <Eyebrow color="#9A8A78">Past</Eyebrow>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#9A8A78' }}>
                  {past.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ opacity: 0.82 }}>
                {past.map((e) => (
                  <ConferenceCard key={e.conference.id} entry={e} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
