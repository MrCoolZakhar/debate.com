'use client';

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Compass, Check, X, Mail, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import SiteNav from '@/components/SiteNav';
import { Eyebrow, OUTFIT, MONO } from '@/app/account/accountUi';
import {
  PersonalConferenceCard, ConferenceCardSkeleton, startOfToday,
  ROLE_TONE, ORGANISER_LABEL,
  type CardConference, type RoleTag,
} from '@/components/PersonalConferenceCard';
import { countryToContinent, type Continent } from '@/lib/countries';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'delegate' | 'chair' | 'advisor' | 'observer' | 'organizer';

interface TabEntry {
  conference: CardConference;
  tag: RoleTag;
}

interface LoadedData {
  delegate: TabEntry[];
  chair: TabEntry[];
  advisor: TabEntry[];
  observer: TabEntry[];
  organizer: TabEntry[];
}

const EMPTY_DATA: LoadedData = { delegate: [], chair: [], advisor: [], observer: [], organizer: [] };

interface ChairInvite {
  id: string;
  token: string;
  conferenceName: string;
  acronym: string;
  committeeName: string;
}

interface OrganizerInvite {
  id: string;
  token: string;
  conferenceName: string;
  acronym: string;
  slug: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'delegate', label: 'DELEGATE' },
  { key: 'chair', label: 'CHAIR' },
  { key: 'advisor', label: 'ADVISOR' },
  { key: 'observer', label: 'OBSERVER' },
  { key: 'organizer', label: 'ORGANIZER' },
];

const EXPLORE_CONFIG: Record<TabKey, { label: string; href: string }> = {
  delegate:  { label: 'EXPLORE CONFERENCES', href: '/conferences/explore' },
  advisor:   { label: 'EXPLORE CONFERENCES', href: '/conferences/explore' },
  observer:  { label: 'EXPLORE CONFERENCES', href: '/conferences/explore' },
  chair:     { label: 'EXPLORE CHAIRING OPPORTUNITIES', href: '/conferences/roles' },
  organizer: { label: 'LIST YOUR CONFERENCE', href: '/conferences/new' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPastConference(conf: CardConference): boolean {
  const today = startOfToday().getTime();
  const end = new Date(conf.end_date + 'T00:00:00').getTime();
  return end < today;
}

function isPublicConf(conf: CardConference): boolean {
  return !!conf.is_public && conf.status !== 'private';
}

const first = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

// ── Filter pill (segmented control) ─────────────────────────────────────────

function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl p-1" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className="focus:outline-none transition-colors"
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: MONO,
              fontWeight: 700,
              letterSpacing: '0.06em',
              border: 'none',
              backgroundColor: active ? '#1B3828' : 'transparent',
              color: active ? '#EED98A' : '#9A8A78',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Empty states ─────────────────────────────────────────────────────────────

function NoneAtAllCard({ tab }: { tab: TabKey }) {
  const cfg = EXPLORE_CONFIG[tab];
  return (
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
        Nothing here yet
      </p>
      <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Once this role appears on a conference, it&apos;ll show up right here.
      </p>
      <Link
        href={cfg.href}
        className="inline-flex items-center gap-2 rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
        style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
      >
        <Compass size={15} strokeWidth={2.2} />
        {cfg.label}
      </Link>
    </div>
  );
}

function NoMatchesCard({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="rounded-[22px] text-center px-6 py-14"
      style={{
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        border: '1.5px dashed #C8BEA8',
      }}
    >
      <p className="text-lg font-bold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        No conferences match these filters
      </p>
      <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Try a different timeframe or continent.
      </p>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-2 rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
        style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        CLEAR FILTERS
      </button>
    </div>
  );
}

// ── Chair invites (pending, awaiting the signed-in user's response) ────────

function ChairInviteCard({ invite, onRespond }: { invite: ChairInvite; onRespond: (invite: ChairInvite, accept: boolean) => void }) {
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);

  async function handle(accept: boolean) {
    setResponding(accept ? 'accept' : 'decline');
    await onRespond(invite, accept);
    setResponding(null);
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ backgroundColor: 'rgba(238,217,138,0.14)', border: '1px solid rgba(182,135,31,0.35)' }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 38, height: 38, borderRadius: '9999px', backgroundColor: 'rgba(182,135,31,0.16)', border: '1px solid rgba(182,135,31,0.35)' }}
      >
        <Mail size={16} style={{ color: '#B6871F' }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Chair {invite.committeeName}
        </p>
        <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          {invite.conferenceName} · {invite.acronym}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => handle(false)}
          disabled={responding !== null}
          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none flex items-center gap-1.5"
          style={{ border: '1px solid #DDD4C0', color: responding ? '#C8BEA8' : '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: responding ? 'not-allowed' : 'pointer' }}
        >
          <X size={12} /> {responding === 'decline' ? '...' : 'DECLINE'}
        </button>
        <button
          onClick={() => handle(true)}
          disabled={responding !== null}
          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none flex items-center gap-1.5"
          style={{ backgroundColor: responding ? '#DDD4C0' : '#1B3828', color: responding ? '#9A8A78' : '#EED98A', border: 'none', fontFamily: OUTFIT, cursor: responding ? 'not-allowed' : 'pointer' }}
        >
          <Check size={12} /> {responding === 'accept' ? '...' : 'ACCEPT'}
        </button>
      </div>
    </div>
  );
}

function ChairInvitesSection({ invites, onRespond }: { invites: ChairInvite[]; onRespond: (invite: ChairInvite, accept: boolean) => void }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Conference Invites</Eyebrow>
        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#B6871F' }}>{invites.length}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {invites.map(inv => (
          <ChairInviteCard key={inv.id} invite={inv} onRespond={onRespond} />
        ))}
      </div>
    </div>
  );
}

// ── Organizer invites (pending, awaiting the signed-in user's response) ────

function OrganizerInviteCard({ invite, onRespond }: { invite: OrganizerInvite; onRespond: (invite: OrganizerInvite, accept: boolean) => void }) {
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);

  async function handle(accept: boolean) {
    setResponding(accept ? 'accept' : 'decline');
    await onRespond(invite, accept);
    setResponding(null);
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ backgroundColor: 'rgba(238,217,138,0.14)', border: '1px solid rgba(182,135,31,0.35)' }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 38, height: 38, borderRadius: '9999px', backgroundColor: 'rgba(182,135,31,0.16)', border: '1px solid rgba(182,135,31,0.35)' }}
      >
        <Mail size={16} style={{ color: '#B6871F' }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Join the organizing team
        </p>
        <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          {invite.conferenceName} · {invite.acronym}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => handle(false)}
          disabled={responding !== null}
          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none flex items-center gap-1.5"
          style={{ border: '1px solid #DDD4C0', color: responding ? '#C8BEA8' : '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: responding ? 'not-allowed' : 'pointer' }}
        >
          <X size={12} /> {responding === 'decline' ? '...' : 'DECLINE'}
        </button>
        <button
          onClick={() => handle(true)}
          disabled={responding !== null}
          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none flex items-center gap-1.5"
          style={{ backgroundColor: responding ? '#DDD4C0' : '#1B3828', color: responding ? '#9A8A78' : '#EED98A', border: 'none', fontFamily: OUTFIT, cursor: responding ? 'not-allowed' : 'pointer' }}
        >
          <Check size={12} /> {responding === 'accept' ? '...' : 'ACCEPT'}
        </button>
      </div>
    </div>
  );
}

function OrganizerInvitesSection({ invites, onRespond }: { invites: OrganizerInvite[]; onRespond: (invite: OrganizerInvite, accept: boolean) => void }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Team Invites</Eyebrow>
        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#B6871F' }}>{invites.length}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {invites.map(inv => (
          <OrganizerInviteCard key={inv.id} invite={inv} onRespond={onRespond} />
        ))}
      </div>
    </div>
  );
}

// ── Grid ─────────────────────────────────────────────────────────────────────

function CardGrid({ entries, tab, muted }: { entries: TabEntry[]; tab: TabKey; muted: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {entries.map((e) => (
        <PersonalConferenceCard
          key={e.conference.id}
          conference={e.conference}
          roles={[e.tag]}
          href={tab === 'organizer' ? `/manage/${e.conference.slug}` : `/conferences/${e.conference.slug}`}
          muted={muted}
        />
      ))}
    </div>
  );
}

// ── Inner (needs Suspense for useSearchParams) ──────────────────────────────

function MyConferencesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, session, loading: authLoading } = useAuth();

  const [data, setData] = useState<LoadedData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'upcoming' | 'past'>('upcoming');
  const [continent, setContinent] = useState<'all' | Continent>('all');
  const [chairInvites, setChairInvites] = useState<ChairInvite[]>([]);
  const [organizerInvites, setOrganizerInvites] = useState<OrganizerInvite[]>([]);
  const [acceptedToast, setAcceptedToast] = useState(false);

  const tabParam = searchParams.get('tab');
  const activeTab: TabKey = (['delegate', 'chair', 'advisor', 'observer', 'organizer'] as const).includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : 'delegate';

  // ── Auth gate — mirrors /account's layout gate, but preserves query params
  // (?tab=...) on the return trip since this page isn't nested under /account.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const qs = searchParams.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, router, pathname, searchParams]);

  function setActiveTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // ── Success toast for a redirect from /invites/chair/[token] after accepting.
  useEffect(() => {
    if (searchParams.get('chairInvite') !== 'accepted') return;
    setAcceptedToast(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('chairInvite');
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    const t = setTimeout(() => setAcceptedToast(false), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChairInvites = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: rows } = await supabase
      .from('conference_chair_invites')
      .select('id, token, conferences (full_name, acronym), conference_committees (name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');
    const invites = ((rows ?? []) as unknown as {
      id: string; token: string;
      conferences: { full_name: string; acronym: string } | { full_name: string; acronym: string }[] | null;
      conference_committees: { name: string } | { name: string }[] | null;
    }[]).map(r => {
      const conf = first(r.conferences);
      const committee = first(r.conference_committees);
      return {
        id: r.id, token: r.token,
        conferenceName: conf?.full_name ?? 'Unknown conference',
        acronym: conf?.acronym ?? '',
        committeeName: committee?.name ?? 'Unknown committee',
      };
    });
    setChairInvites(invites);
  }, [user, session]);

  async function handleRespondInvite(invite: ChairInvite, accept: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('respond_chair_invite', { p_token: invite.token, p_accept: accept });
    const result = data as { ok: boolean } | null;
    if (!result?.ok) return;
    setChairInvites(prev => prev.filter(i => i.id !== invite.id));
    if (accept) await loadAll();
  }

  const loadOrganizerInvites = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: rows } = await supabase
      .from('conference_organizer_invites')
      .select('id, token, conferences (full_name, acronym, slug)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');
    const invites = ((rows ?? []) as unknown as {
      id: string; token: string;
      conferences: { full_name: string; acronym: string; slug: string } | { full_name: string; acronym: string; slug: string }[] | null;
    }[]).map(r => {
      const conf = first(r.conferences);
      return {
        id: r.id, token: r.token,
        conferenceName: conf?.full_name ?? 'Unknown conference',
        acronym: conf?.acronym ?? '',
        slug: conf?.slug ?? '',
      };
    });
    setOrganizerInvites(invites);
  }, [user, session]);

  async function handleRespondOrganizerInvite(invite: OrganizerInvite, accept: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('respond_organizer_invite', { p_token: invite.token, p_accept: accept });
    const result = data as { ok: boolean } | null;
    if (!result?.ok) return;
    setOrganizerInvites(prev => prev.filter(i => i.id !== invite.id));
    if (accept) await loadAll();
  }

  // ── Data loading — same overall shape as /account/calendar: parallel
  // per-role queries joined to conferences, merged into per-conference maps.
  const loadAll = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const CONF = 'id, slug, full_name, acronym, start_date, end_date, city, country, logo_url, banner_url, is_public, status';

    const [delegateRes, chairAppRes, chairCommitteeRes, advisorRes, observerRes, organizerRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`id, role, is_head_delegate, assigned_country_name, conferences (${CONF})`)
        .eq('user_id', user.id)
        .in('role', ['delegate', 'head-delegate'])
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('applications')
        .select(`id, assigned_committee_id, assigned_committee:conference_committees!assigned_committee_id (name), conferences (${CONF})`)
        .eq('user_id', user.id)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('conference_committees')
        .select(`id, name, conferences (${CONF})`)
        .contains('chair_user_ids', [user.id]),
      supabase
        .from('applications')
        .select(`id, conferences (${CONF})`)
        .eq('user_id', user.id)
        .eq('role', 'faculty-advisor')
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('applications')
        .select(`id, conferences (${CONF})`)
        .eq('user_id', user.id)
        .eq('role', 'observer')
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('conference_organizers')
        .select(`role, conferences (${CONF})`)
        .eq('user_id', user.id),
    ]);

    // Delegate — role delegate/head-delegate; head dels (by role or the
    // "apply as head delegate for my society" flag) get the Head Delegate badge.
    const delegateMap = new Map<string, TabEntry>();
    for (const row of (delegateRes.data ?? []) as {
      role: string; is_head_delegate: boolean; assigned_country_name: string | null;
      conferences: CardConference | CardConference[] | null;
    }[]) {
      const conf = first(row.conferences);
      if (!conf) continue;
      const isHeadDel = row.role === 'head-delegate' || row.is_head_delegate;
      const country = row.assigned_country_name ?? null;
      const tag: RoleTag = isHeadDel
        ? { key: 'head-delegate', label: 'Head Delegate', tone: ROLE_TONE.delegate }
        : { key: 'delegate', label: country ? `Delegate · ${country}` : 'Delegate', tone: ROLE_TONE.delegate, countryName: country ?? undefined };
      if (!delegateMap.has(conf.id)) delegateMap.set(conf.id, { conference: conf, tag });
    }

    // Chair — union of a chair-role application and direct committee
    // chair_user_ids membership (invited chairs need no application at all).
    const chairMap = new Map<string, TabEntry>();
    function upsertChair(conf: CardConference | null, committeeName: string | null) {
      if (!conf) return;
      const label = committeeName ? `Chair · ${committeeName}` : 'Chair';
      const existing = chairMap.get(conf.id);
      if (existing) {
        if (!existing.tag.label.includes('·') && committeeName) {
          existing.tag = { key: 'chair', label, tone: ROLE_TONE.chair };
        }
        if (!existing.conference.banner_url && conf.banner_url) existing.conference.banner_url = conf.banner_url;
        if (!existing.conference.logo_url && conf.logo_url) existing.conference.logo_url = conf.logo_url;
      } else {
        chairMap.set(conf.id, { conference: conf, tag: { key: 'chair', label, tone: ROLE_TONE.chair } });
      }
    }
    for (const row of (chairAppRes.data ?? []) as {
      assigned_committee_id: string | null;
      assigned_committee: { name: string } | { name: string }[] | null;
      conferences: CardConference | CardConference[] | null;
    }[]) {
      upsertChair(first(row.conferences), first(row.assigned_committee)?.name ?? null);
    }
    for (const row of (chairCommitteeRes.data ?? []) as {
      name: string | null;
      conferences: CardConference | CardConference[] | null;
    }[]) {
      upsertChair(first(row.conferences), row.name);
    }

    // Advisor / Observer — plain role membership, one badge each.
    const advisorMap = new Map<string, TabEntry>();
    for (const row of (advisorRes.data ?? []) as { conferences: CardConference | CardConference[] | null }[]) {
      const conf = first(row.conferences);
      if (conf && !advisorMap.has(conf.id)) {
        advisorMap.set(conf.id, { conference: conf, tag: { key: 'faculty-advisor', label: 'Faculty Advisor', tone: ROLE_TONE.advisor } });
      }
    }
    const observerMap = new Map<string, TabEntry>();
    for (const row of (observerRes.data ?? []) as { conferences: CardConference | CardConference[] | null }[]) {
      const conf = first(row.conferences);
      if (conf && !observerMap.has(conf.id)) {
        observerMap.set(conf.id, { conference: conf, tag: { key: 'observer', label: 'Observer', tone: ROLE_TONE.observer } });
      }
    }

    // Organizer — any organizer_organizers membership (owner/secretariat/organizer).
    const organizerMap = new Map<string, TabEntry>();
    for (const row of (organizerRes.data ?? []) as { role: string; conferences: CardConference | CardConference[] | null }[]) {
      const conf = first(row.conferences);
      if (conf && !organizerMap.has(conf.id)) {
        organizerMap.set(conf.id, {
          conference: conf,
          tag: { key: 'organiser', label: ORGANISER_LABEL[row.role] ?? 'Organiser', tone: ROLE_TONE.organiser },
        });
      }
    }

    setData({
      delegate: Array.from(delegateMap.values()),
      chair: Array.from(chairMap.values()),
      advisor: Array.from(advisorMap.values()),
      observer: Array.from(observerMap.values()),
      organizer: Array.from(organizerMap.values()),
    });
    setLoading(false);
  }, [user, session]);

  useEffect(() => {
    if (authLoading || !user) return;
    loadAll();
    loadChairInvites();
    loadOrganizerInvites();
  }, [authLoading, user, loadAll, loadChairInvites, loadOrganizerInvites]);

  // ── Filtering (timeframe → continent) within the active tab ────────────────

  const rawEntries = data[activeTab];

  const timeframeFiltered = useMemo(
    () => rawEntries.filter((e) => (timeframe === 'upcoming' ? !isPastConference(e.conference) : isPastConference(e.conference))),
    [rawEntries, timeframe]
  );

  const availableContinents = useMemo(() => {
    const set = new Set<Continent>();
    for (const e of timeframeFiltered) {
      const c = e.conference.country ? countryToContinent(e.conference.country) : null;
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [timeframeFiltered]);

  const filtered = useMemo(() => {
    if (continent === 'all') return timeframeFiltered;
    return timeframeFiltered.filter((e) => e.conference.country && countryToContinent(e.conference.country) === continent);
  }, [timeframeFiltered, continent]);

  function clearFilters() {
    setTimeframe('upcoming');
    setContinent('all');
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const noneAtAll = rawEntries.length === 0;
  const noMatches = !noneAtAll && filtered.length === 0;
  const isOrganizerTab = activeTab === 'organizer';
  const organizerPublic = isOrganizerTab ? filtered.filter((e) => isPublicConf(e.conference)) : [];
  const organizerDrafts = isOrganizerTab ? filtered.filter((e) => !isPublicConf(e.conference)) : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />
      <SiteNav hideLanguage />

      <div className="relative z-10 flex-1 px-6 py-10" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow className="mb-2">Every Role, One Place</Eyebrow>
            <h1 className="font-black text-[26px] mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}>
              My Conferences
            </h1>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Every conference you&apos;re part of, sorted by the role you hold there.
            </p>
          </div>
          <Link
            href="/conferences/new"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-[12.5px] uppercase transition-colors mt-1"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Organise a conference
          </Link>
        </div>

        {acceptedToast && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 mb-5"
            style={{ backgroundColor: 'rgba(61,122,82,0.10)', border: '1px solid rgba(61,122,82,0.35)' }}
          >
            <Check size={14} style={{ color: '#3D7A52', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: '#1B3828', fontFamily: OUTFIT, fontWeight: 600 }}>
              Invite accepted. You&apos;re now chairing this committee.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 overflow-x-auto">
          <div className="inline-flex rounded-xl p-1" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            {TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className="focus:outline-none transition-colors flex-shrink-0"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: MONO,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    border: 'none',
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#9A8A78',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <SegmentedControl
            options={[{ key: 'upcoming', label: 'UPCOMING' }, { key: 'past', label: 'PAST' }]}
            value={timeframe}
            onChange={setTimeframe}
          />
          <select
            value={continent}
            onChange={(e) => setContinent(e.target.value as 'all' | Continent)}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: OUTFIT, cursor: 'pointer' }}
          >
            <option value="all">All continents</option>
            {availableContinents.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {activeTab === 'chair' && <ChairInvitesSection invites={chairInvites} onRespond={handleRespondInvite} />}
        {activeTab === 'organizer' && <OrganizerInvitesSection invites={organizerInvites} onRespond={handleRespondOrganizerInvite} />}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConferenceCardSkeleton />
            <ConferenceCardSkeleton />
            <ConferenceCardSkeleton />
            <ConferenceCardSkeleton />
          </div>
        ) : noneAtAll ? (
          <NoneAtAllCard tab={activeTab} />
        ) : noMatches ? (
          <NoMatchesCard onClear={clearFilters} />
        ) : isOrganizerTab ? (
          <>
            <section className="mb-10">
              <div className="flex items-center gap-2.5 mb-4">
                <Eyebrow>Public</Eyebrow>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#B6871F' }}>{organizerPublic.length}</span>
              </div>
              {organizerPublic.length === 0 ? (
                <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No published conferences match these filters.</p>
              ) : (
                <CardGrid entries={organizerPublic} tab="organizer" muted={timeframe === 'past'} />
              )}
            </section>

            <section>
              <div className="flex items-center gap-2.5 mb-2">
                <Eyebrow color="#9A8A78">Drafts</Eyebrow>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#9A8A78' }}>{organizerDrafts.length}</span>
              </div>
              <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                Drafts are not listed publicly until you publish them.
              </p>
              {organizerDrafts.length === 0 ? (
                <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No drafts match these filters.</p>
              ) : (
                <CardGrid entries={organizerDrafts} tab="organizer" muted={timeframe === 'past'} />
              )}
            </section>
          </>
        ) : (
          <CardGrid entries={filtered} tab={activeTab} muted={timeframe === 'past'} />
        )}
      </div>
    </div>
  );
}

// ── Default export with Suspense ────────────────────────────────────────────

export default function MyConferencesClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <MyConferencesInner />
    </Suspense>
  );
}
