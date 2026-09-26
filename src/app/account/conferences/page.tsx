'use client';

// My conferences (26 Sep 2026). What used to be the Conference calendar,
// renamed and moved here at the owner's request ("Remove the 'Your
// conferences' page completely, archive it. Keep what the calendar page has
// and rename it to My conferences. Do not have a calendar at all."). The old
// role-tab page is in src/app/_archive/account-your-conferences/; the actions
// only it had (invitations, imported invitations, drafts, the accepted-invite
// notice) live in ./conferenceActions.tsx and sit at the top of this page,
// with payments due (PaymentsDueSection). /account/calendar redirects here.

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Compass, CalendarDays, Gavel, Briefcase, User, Plus, Landmark } from 'lucide-react';
import { PaymentsDueSection } from '@/app/conferences/[slug]/participant/PayNowCard';
import Loader from '@/components/Loader';
import {
  useConferenceActions, AcceptedNotice, ChairInvitesSection, OrganizerInvitesSection,
  PendingImportInvitesSection, DraftsToCompleteSection,
} from './conferenceActions';
import { CircleFlag } from '@/components/CircleFlag';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { OUTFIT, T } from '../accountUi';
import { AccountHero, HeroOverlap, RaisedCard, StatBlock, SectionHeading, EmojiDisc, RAISED, FOREST, INK, INK_SOFT, DEEP_GOLD } from '../accountShell';
import { GoldWord } from '@/components/BrandHeading';
import { LogoDisc } from '@/components/LogoDisc';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
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
  /** Holds a role other than organiser: the card opens the participant page. */
  participant?: boolean;
  /** A delegation leader (accepted head delegate / faculty advisor with a
   *  society): the delegation seat portal. Carried over from the old page. */
  manageDelegationHref?: string;
  /** A rejected application whose role allows resubmission. Carried over. */
  resubmitHref?: string;
}

/** Submitted shows "Applied", rejected "Not accepted", withdrawn "Withdrawn",
 *  instead of the role's eventual label (carried over from the old page). */
function statusTag(status: string, tag: RoleTag): RoleTag {
  if (status === 'submitted') return { key: tag.key, label: 'Applied', tone: 'amber' };
  if (status === 'rejected') return { key: tag.key, label: 'Not accepted', tone: 'rose' };
  if (status === 'withdrawn') return { key: tag.key, label: 'Withdrawn', tone: 'neutral' };
  return tag;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MyConferencesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader size={64} label="Loading your conferences" />
        </div>
      }
    >
      <MyConferencesInner />
    </Suspense>
  );
}

function MyConferencesInner() {
  const { user, session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped after an invitation is accepted, so the new conference appears.
  const [reloadKey, setReloadKey] = useState(0);
  const actions = useConferenceActions(() => setReloadKey((k) => k + 1));

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

      const CONF = 'id, slug, full_name, acronym, start_date, end_date, city, country, logo_url, banner_url, is_verified';
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
          .select(`id, role, status, is_head_delegate, society_id, assigned_country_name, conferences (${CONF}), conference_committees (name)`)
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

      // Resubmission eligibility for rejected applications (carried over from
      // the old page): application_role_configs for just those conferences.
      type AppRow = {
        role: string; status: string; is_head_delegate: boolean | null; society_id: string | null;
        assigned_country_name: string | null;
        conferences: ConferenceRow | ConferenceRow[] | null;
        conference_committees: { name: string } | { name: string }[] | null;
      };
      const appRows = (appRes.data ?? []) as AppRow[];
      const rejectedConfIds = Array.from(new Set(appRows.filter((r) => r.status === 'rejected').map((r) => first(r.conferences)?.id).filter((x): x is string => !!x)));
      const allowResubmit = new Map<string, boolean>();
      if (rejectedConfIds.length > 0) {
        const { data: rcRows } = await supabase
          .from('application_role_configs')
          .select('conference_id, role, allow_resubmission')
          .in('conference_id', rejectedConfIds);
        for (const rc of (rcRows ?? []) as { conference_id: string; role: string; allow_resubmission: boolean }[]) {
          allowResubmit.set(`${rc.conference_id}:${rc.role}`, rc.allow_resubmission);
        }
      }

      for (const e of byConf.values()) if (e.roles.some((r) => r.key === 'chair')) e.participant = true;

      // 3) Applications — map each role to a tinted tag
      for (const row of appRows) {
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
        if (row.role === 'delegate' && row.is_head_delegate) {
          tag = { key: 'head-delegate', label: 'Head Delegate', tone: ROLE_TONE.delegate };
        }
        upsert(conf, statusTag(row.status, tag));
        const e = conf?.id ? byConf.get(conf.id) : undefined;
        if (e) {
          e.participant = true;
          const leads = row.role === 'head-delegate' || row.role === 'faculty-advisor' || !!row.is_head_delegate;
          const confirmed = !['submitted', 'rejected', 'withdrawn'].includes(row.status);
          if (leads && confirmed && row.society_id && !e.manageDelegationHref) e.manageDelegationHref = `/delegation/${row.society_id}`;
          if (row.status === 'rejected' && allowResubmit.get(`${conf!.id}:${row.role}`) && !e.resubmitHref) {
            e.resubmitHref = `/conferences/${conf!.slug}/apply?role=${row.role}&edit=1`;
          }
        }
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

      for (const e of byConf.values()) if (e.roles.some((r) => r.key !== 'organiser')) e.participant = true;
      if (cancelled) return;
      setEntries(Array.from(byConf.values()));
      setLoading(false);
    }

    loadAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token, reloadKey]);

  const { upcoming, past } = useMemo(() => {
    const today = startOfToday().getTime();
    const up: CalendarEntry[] = [];
    const pa: CalendarEntry[] = [];
    for (const e of entries) {
      const end = e.conference.end_date ? new Date(e.conference.end_date + 'T00:00:00').getTime() : Infinity;
      if (end >= today) up.push(e); else pa.push(e);
    }
    up.sort((a, b) => (a.conference.start_date ? new Date(a.conference.start_date).getTime() : Infinity) - (b.conference.start_date ? new Date(b.conference.start_date).getTime() : Infinity));
    pa.sort((a, b) => (b.conference.end_date ? new Date(b.conference.end_date).getTime() : 0) - (a.conference.end_date ? new Date(a.conference.end_date).getTime() : 0));
    return { upcoming: up, past: pa };
  }, [entries]);

  const organising = entries.filter((e) => e.isOrganiser).length;
  const next = upcoming[0] ?? null;

  return (
    <div>
      <AccountHero
        label="Every role, one place"
        title={<>My <GoldWord>Conferences</GoldWord></>}
        line="Every conference you are part of: organising, chairing, delegating and more"
        emoji="Classical building"
        fallback={Landmark}
        aside={
          <Link href="/conferences/new" className="gv-acct-btn">
            <Plus size={18} strokeWidth={2.6} aria-hidden />
            Organise a conference
          </Link>
        }
      />

      <HeroOverlap>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
          <div className="lg:col-span-7">
            {next ? (
              <NextUpCard entry={next} />
            ) : (
              <RaisedCard className="h-full flex flex-col items-start justify-center">
                <EmojiDisc emoji="Compass" fallback={Compass} size={48} />
                <p style={{ margin: '14px 0 16px', fontFamily: OUTFIT, fontSize: T.body + 2, fontWeight: 700, color: INK }}>
                  {loading ? 'Reading your conferences' : 'Nothing coming up yet'}
                </p>
                {!loading && (
                  <Link href="/conferences/explore" className="gv-acct-btn">
                    <Compass size={16} strokeWidth={2.2} aria-hidden />
                    Explore conferences
                  </Link>
                )}
              </RaisedCard>
            )}
          </div>
          <div className="lg:col-span-5 grid grid-cols-3 lg:grid-cols-1 gap-3 md:gap-4">
            <StatBlock value={loading ? '…' : upcoming.length} word="upcoming" className="!p-4" />
            <StatBlock value={loading ? '…' : past.length} word="past" className="!p-4" />
            <StatBlock value={loading ? '…' : organising} word="organising" className="!p-4" />
          </div>
        </div>
      </HeroOverlap>

      <div className="mt-8 px-2 sm:px-4 md:px-6">
        {/* Things to act on first: payments, invitations, drafts */}
        {actions.acceptedToast && <AcceptedNotice />}
        {user && <PaymentsDueSection userId={user.id} />}
        <PendingImportInvitesSection invites={actions.importInvites} />
        <DraftsToCompleteSection drafts={actions.drafts} onDelete={actions.deleteDraft} />
        <ChairInvitesSection invites={actions.chairInvites} onRespond={actions.respondChair} />
        <OrganizerInvitesSection invites={actions.organizerInvites} onRespond={actions.respondOrganizer} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConferenceCardSkeleton />
            <ConferenceCardSkeleton />
            <ConferenceCardSkeleton />
            <ConferenceCardSkeleton />
          </div>
        ) : entries.length === 0 ? null : (
          <>
            {upcoming.length > 0 && (
              <section className="mb-10">
                <SectionHeading title="Upcoming" count={upcoming.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {upcoming.map((e) => (
                    <PersonalConferenceCard
                      key={e.conference.id}
                      conference={e.conference}
                      roles={e.roles}
                      href={e.participant ? `/conferences/${e.conference.slug}/role` : `/conferences/${e.conference.slug}`}
                      manageHref={e.isOrganiser ? `/manage/${e.conference.slug}` : undefined}
                      manageDelegationHref={e.manageDelegationHref}
                      resubmitHref={e.resubmitHref}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <SectionHeading title="Past" count={past.length} muted />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {past.map((e) => (
                    <PersonalConferenceCard
                      key={e.conference.id}
                      conference={e.conference}
                      roles={e.roles}
                      href={e.participant ? `/conferences/${e.conference.slug}/role` : `/conferences/${e.conference.slug}`}
                      manageHref={e.isOrganiser ? `/manage/${e.conference.slug}` : undefined}
                      manageDelegationHref={e.manageDelegationHref}
                      resubmitHref={e.resubmitHref}
                      muted
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        {actions.confirmModal}
      </div>
    </div>
  );
}

// ── Next up ──────────────────────────────────────────────────────────────────
// The nearest upcoming conference, large: its logo, the acronym big with the
// full name smaller beneath (two rows, never cut), the dates and place, what
// the person is there as, and how many days are left as a big number.

function NextUpCard({ entry }: { entry: CalendarEntry }) {
  const c = entry.conference;
  const acronym = conferenceAcronymLabel(c) || c.acronym || c.full_name;
  const showFull = !!c.full_name && c.full_name !== acronym;
  const today = startOfToday().getTime();
  const start = c.start_date ? new Date(c.start_date + 'T00:00:00').getTime() : null;
  const end = c.end_date ? new Date(c.end_date + 'T00:00:00').getTime() : null;
  const days = start !== null ? Math.round((start - today) / 86400000) : null;
  const running = start !== null && start <= today && (end === null || end >= today);
  const fmt = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const dates = c.start_date ? (c.end_date && c.end_date !== c.start_date ? `${fmt(c.start_date)} to ${fmt(c.end_date)}` : fmt(c.start_date)) : 'Dates to be announced';
  const place = [c.city, c.country].filter(Boolean).join(', ');

  return (
    <Link
      href={entry.participant ? `/conferences/${c.slug}/role` : entry.isOrganiser ? `/manage/${c.slug}` : `/conferences/${c.slug}`}
      className="gv-acct-card-link block h-full rounded-[22px] p-5 md:p-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
      style={{ textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', boxShadow: RAISED }}
    >
      <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.caption, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DEEP_GOLD }}>
        {running ? 'Happening now' : 'Next up'}
      </p>
      <div className="mt-3 flex items-start gap-4">
        <LogoDisc src={c.logo_url} alt={c.full_name} size={68} fallbackText={(c.acronym || c.full_name).slice(0, 3)} />
        <div className="min-w-0 flex-1">
          <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(22px, 4.5vw, 30px)', lineHeight: 1.1, letterSpacing: '-0.02em', color: INK }}>
            {acronym}
          </p>
          {showFull && (
            <p className="[overflow-wrap:anywhere]" style={{ margin: '3px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT, lineHeight: 1.35 }}>
              {c.full_name}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-2" style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: T.body, fontWeight: 600, color: INK }}>
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} strokeWidth={2} style={{ color: DEEP_GOLD }} aria-hidden />{dates}</span>
            {place && <span style={{ color: INK_SOFT, fontWeight: 500 }}>{place}</span>}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entry.roles.map((r) => (
            <span key={r.key + r.label} className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: 700, color: FOREST }}>
              {r.countryName
                ? <CircleFlag country={r.countryName} size={18} decorative />
                : r.key === 'organiser'
                  ? <Briefcase size={15} strokeWidth={2} aria-hidden />
                  : r.key === 'chair'
                    ? <Gavel size={15} strokeWidth={2} aria-hidden />
                    : <User size={15} strokeWidth={2} aria-hidden />}
              {r.label}
            </span>
          ))}
        </div>
        {days !== null && !running && days >= 0 && (
          <p className="flex items-baseline gap-2" style={{ margin: 0 }}>
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(34px, 6vw, 48px)', lineHeight: 1, letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
              {days}
            </span>
            <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: T.body + 1, color: INK }}>{days === 1 ? 'day to go' : 'days to go'}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
