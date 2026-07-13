'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { Eyebrow, OUTFIT, MONO } from '../accountUi';
import {
  PersonalConferenceCard, ConferenceCardSkeleton, startOfToday,
  ROLE_TONE, ORGANISER_LABEL,
  type CardConference, type RoleTag,
} from '@/components/PersonalConferenceCard';

// ── Types ────────────────────────────────────────────────────────────────────

type ConferenceRow = CardConference;

/** A conference the user is connected to, with every role they hold there. */
interface CalendarEntry {
  conference: ConferenceRow;
  roles: RoleTag[];
  isOrganiser: boolean; // surfaces the "Manage" affordance
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
        Every conference you&apos;re part of: organising, chairing, delegating, and more.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConferenceCardSkeleton />
          <ConferenceCardSkeleton />
          <ConferenceCardSkeleton />
          <ConferenceCardSkeleton />
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
                  <PersonalConferenceCard
                    key={e.conference.id}
                    conference={e.conference}
                    roles={e.roles}
                    href={`/conferences/${e.conference.slug}`}
                    manageHref={e.isOrganiser ? `/manage/${e.conference.slug}` : undefined}
                  />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {past.map((e) => (
                  <PersonalConferenceCard
                    key={e.conference.id}
                    conference={e.conference}
                    roles={e.roles}
                    href={`/conferences/${e.conference.slug}`}
                    manageHref={e.isOrganiser ? `/manage/${e.conference.slug}` : undefined}
                    muted
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
