'use client';

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Compass, Check, X, Mail, Plus, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import SiteNav from '@/components/SiteNav';
import { Eyebrow, OUTFIT, MONO } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, EASE, NeuIconDisc } from '@/components/neu';
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

// ── NeuSegmented, pressed-in track + gliding forest-glass thumb ──────────────
// The signature control of this page: an inset ivory well (NEU.base + NEU.inSm)
// with a soft, gently-transparent forest gradient thumb that slides under the
// active segment. The thumb is measured off the live button geometry, so the
// slider works with variable-width labels and re-settles on resize / font load.

function NeuSegmented<T extends string>({ options, value, onChange, size = 'md' }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const btn = btnRefs.current[value];
    if (!track || !btn) return;
    const t = track.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    setThumb({ left: b.left - t.left + track.scrollLeft, width: b.width });
  }, [value]);

  useEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    // Fonts can settle after first paint and shift label widths.
    if (typeof document !== 'undefined' && 'fonts' in document) {
      (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready.then(measure).catch(() => {});
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [measure, options.length]);

  const pad = 5;
  const isSm = size === 'sm';

  return (
    <div
      ref={trackRef}
      className="relative inline-flex"
      style={{
        padding: pad,
        borderRadius: 999,
        backgroundColor: NEU.base,
        boxShadow: NEU.inSm,
      }}
    >
      {/* Gliding forest-glass thumb */}
      {thumb && (
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: pad,
            bottom: pad,
            left: thumb.left,
            width: thumb.width,
            borderRadius: 999,
            // Soft glass sheen layered over a gently-transparent forest gradient,
            // so the pressed track subtly reads through the thumb.
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0) 46%), ' +
              'linear-gradient(145deg, rgba(31,63,45,0.96) 0%, rgba(42,90,60,0.93) 58%, rgba(61,122,82,0.92) 100%)',
            boxShadow:
              '0 5px 13px rgba(27,56,40,0.34), 0 1px 2px rgba(27,56,40,0.30), ' +
              'inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -2px 4px rgba(27,56,40,0.34)',
            transition: `left 420ms ${EASE}, width 420ms ${EASE}`,
          }}
        />
      )}
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            ref={(el) => { btnRefs.current[opt.key] = el; }}
            onClick={() => onChange(opt.key)}
            className="relative focus:outline-none flex-shrink-0"
            style={{
              zIndex: 1,
              padding: isSm ? '7px 15px' : '9px 18px',
              borderRadius: 999,
              fontSize: isSm ? 10.5 : 11.5,
              fontFamily: MONO,
              fontWeight: 800,
              letterSpacing: '0.08em',
              border: 'none',
              backgroundColor: 'transparent',
              color: active ? NEU.gold : NEU.muted,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: `color 300ms ${EASE}`,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = NEU.forest; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = NEU.muted; }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Shared neu controls (local) ──────────────────────────────────────────────

/** Gradient pill link — NeuButton in anchor form for CTAs that navigate. */
function NeuAnchorCta({ href, icon: Icon, children, gradient = NEU_GRADIENTS.forest, textColor = NEU.gold }: {
  href: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  children: React.ReactNode;
  gradient?: readonly [string, string];
  textColor?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center gap-2 focus:outline-none"
      style={{
        padding: '11px 22px',
        borderRadius: 999,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        color: textColor,
        fontFamily: OUTFIT,
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '0.05em',
        textDecoration: 'none',
        boxShadow: hovered ? `0 6px 16px ${gradient[0]}66, ${NEU.outSmHover}` : `0 4px 10px ${gradient[0]}4D, ${NEU.outSm}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
      }}
    >
      {Icon && <Icon size={15} strokeWidth={2.4} />}
      {children}
    </Link>
  );
}

/** Extruded ivory pill button — soft neu chip for secondary actions. */
function NeuGhostButton({ onClick, children, disabled = false, style }: {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center gap-1.5 focus:outline-none"
      style={{
        padding: '10px 20px',
        borderRadius: 999,
        border: 'none',
        backgroundColor: NEU.surface,
        color: disabled ? NEU.muted : NEU.ink,
        fontFamily: OUTFIT,
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '0.05em',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? NEU.inSm : hovered ? NEU.outSmHover : NEU.outSm,
        transform: hovered && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: `box-shadow 220ms ${EASE}, transform 220ms ${EASE}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Empty states ─────────────────────────────────────────────────────────────

/** Pressed-in ivory well framing a centred empty state. */
function EmptyWell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-center px-6 py-16"
      style={{ borderRadius: 24, backgroundColor: NEU.base, boxShadow: NEU.in }}
    >
      {children}
    </div>
  );
}

function NoneAtAllCard({ tab }: { tab: TabKey }) {
  const cfg = EXPLORE_CONFIG[tab];
  return (
    <EmptyWell>
      <div className="flex justify-center mb-5">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Compass} size={56} />
      </div>
      <p className="text-lg font-bold mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
        Nothing here yet
      </p>
      <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Once this role appears on a conference, it&apos;ll show up right here.
      </p>
      <NeuAnchorCta href={cfg.href} icon={Compass}>{cfg.label}</NeuAnchorCta>
    </EmptyWell>
  );
}

function NoMatchesCard({ onClear }: { onClear: () => void }) {
  return (
    <EmptyWell>
      <p className="text-lg font-bold mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
        No conferences match these filters
      </p>
      <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Try a different timeframe or continent.
      </p>
      <NeuGhostButton onClick={onClear}>CLEAR FILTERS</NeuGhostButton>
    </EmptyWell>
  );
}

/** Small pressed-in count chip for section headers. */
function CountChip({ n, muted = false }: { n: number; muted?: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
        backgroundColor: NEU.base, boxShadow: NEU.inSm,
        fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
        color: muted ? NEU.muted : NEU.deepGold, fontVariantNumeric: 'tabular-nums',
      }}
    >
      {n}
    </span>
  );
}

// ── Invite card shell (shared by chair + organizer invites) ────────────────

function InviteCardShell({ title, subtitle, responding, onDecline, onAccept }: {
  title: string;
  subtitle: string;
  responding: 'accept' | 'decline' | null;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const busy = responding !== null;
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5"
      style={{ borderRadius: 18, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
    >
      <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Mail} iconColor={NEU.forest} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          {title}
        </p>
        <p className="text-xs truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          {subtitle}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onDecline}
          disabled={busy}
          className="focus:outline-none inline-flex items-center gap-1.5"
          style={{
            padding: '7px 13px', borderRadius: 999, border: 'none',
            backgroundColor: NEU.surface, boxShadow: busy ? NEU.inSm : NEU.outSm,
            color: busy ? NEU.muted : NEU.ink, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800,
            letterSpacing: '0.04em', cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <X size={12} strokeWidth={2.6} /> {responding === 'decline' ? '...' : 'DECLINE'}
        </button>
        <button
          onClick={onAccept}
          disabled={busy}
          className="focus:outline-none inline-flex items-center gap-1.5"
          style={{
            padding: '7px 14px', borderRadius: 999, border: 'none',
            background: busy ? NEU.base : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
            boxShadow: busy ? NEU.inSm : `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}`,
            color: busy ? NEU.muted : NEU.gold, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800,
            letterSpacing: '0.04em', cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={12} strokeWidth={2.6} /> {responding === 'accept' ? '...' : 'ACCEPT'}
        </button>
      </div>
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
    <InviteCardShell
      title={`Chair ${invite.committeeName}`}
      subtitle={`${invite.conferenceName} · ${invite.acronym}`}
      responding={responding}
      onDecline={() => handle(false)}
      onAccept={() => handle(true)}
    />
  );
}

function ChairInvitesSection({ invites, onRespond }: { invites: ChairInvite[]; onRespond: (invite: ChairInvite, accept: boolean) => void }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Conference Invites</Eyebrow>
        <CountChip n={invites.length} />
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
    <InviteCardShell
      title="Join the organizing team"
      subtitle={`${invite.conferenceName} · ${invite.acronym}`}
      responding={responding}
      onDecline={() => handle(false)}
      onAccept={() => handle(true)}
    />
  );
}

function OrganizerInvitesSection({ invites, onRespond }: { invites: OrganizerInvite[]; onRespond: (invite: OrganizerInvite, accept: boolean) => void }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Team Invites</Eyebrow>
        <CountChip n={invites.length} />
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const noneAtAll = rawEntries.length === 0;
  const noMatches = !noneAtAll && filtered.length === 0;
  const isOrganizerTab = activeTab === 'organizer';
  const organizerPublic = isOrganizerTab ? filtered.filter((e) => isPublicConf(e.conference)) : [];
  const organizerDrafts = isOrganizerTab ? filtered.filter((e) => !isPublicConf(e.conference)) : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />
      <SiteNav hideLanguage />

      <div className="relative z-10 flex-1 px-6 py-10" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow className="mb-2">Every Role, One Place</Eyebrow>
            <h1 className="font-black text-[26px] mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT, letterSpacing: '-0.01em' }}>
              My Conferences
            </h1>
            <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              Every conference you&apos;re part of, sorted by the role you hold there.
            </p>
          </div>
          <div className="flex-shrink-0 mt-1">
            <NeuAnchorCta href="/conferences/new" icon={Plus}>Organise a conference</NeuAnchorCta>
          </div>
        </div>

        {acceptedToast && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 mb-5"
            style={{ borderRadius: 16, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
          >
            <NeuIconDisc gradient={NEU_GRADIENTS.green} icon={Check} size={30} />
            <p className="text-sm" style={{ color: NEU.forest, fontFamily: OUTFIT, fontWeight: 700 }}>
              Invite accepted. You&apos;re now chairing this committee.
            </p>
          </div>
        )}

        {/* Role slider */}
        <div className="mb-5 overflow-x-auto pb-1 -mx-6 px-6 sm:mx-0 sm:px-0">
          <NeuSegmented options={TABS} value={activeTab} onChange={setActiveTab} />
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <NeuSegmented
            options={[{ key: 'upcoming' as const, label: 'UPCOMING' }, { key: 'past' as const, label: 'PAST' }]}
            value={timeframe}
            onChange={setTimeframe}
            size="sm"
          />
          <div className="relative inline-flex items-center">
            <select
              value={continent}
              onChange={(e) => setContinent(e.target.value as 'all' | Continent)}
              className="focus:outline-none appearance-none"
              style={{
                padding: '9px 34px 9px 15px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: NEU.base,
                boxShadow: NEU.inSm,
                color: NEU.ink,
                fontFamily: OUTFIT,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: '0.01em',
                cursor: 'pointer',
              }}
            >
              <option value="all">All continents</option>
              {availableContinents.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown
              size={15}
              strokeWidth={2.4}
              className="pointer-events-none absolute"
              style={{ right: 13, color: NEU.muted }}
            />
          </div>
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
                <CountChip n={organizerPublic.length} />
              </div>
              {organizerPublic.length === 0 ? (
                <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No published conferences match these filters.</p>
              ) : (
                <CardGrid entries={organizerPublic} tab="organizer" muted={timeframe === 'past'} />
              )}
            </section>

            <section>
              <div className="flex items-center gap-2.5 mb-2">
                <Eyebrow color={NEU.muted}>Drafts</Eyebrow>
                <CountChip n={organizerDrafts.length} muted />
              </div>
              <p className="text-xs mb-4" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                Drafts are not listed publicly until you publish them.
              </p>
              {organizerDrafts.length === 0 ? (
                <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No drafts match these filters.</p>
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
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <MyConferencesInner />
    </Suspense>
  );
}
