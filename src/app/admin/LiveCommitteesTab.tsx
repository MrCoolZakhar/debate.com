'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Live committees.
//
// Every committee on the platform that is actually being used right now,
// whether it belongs to a conference or is a standalone session someone
// started from the landing page.
//
// SECURITY: this component holds no access logic worth trusting. The gate is
// admin_live_committees(), a SECURITY DEFINER function that raises
// 'not authorised' unless is_platform_admin() — the identical shape to
// admin_conference_overview(). A non-staff visitor gets an error from the
// database and sees an inert panel; the route being reachable leaks nothing.
//
// DEFINITION OF "LIVE" (Peter's, adopted verbatim — see admin_live_committees):
//   updated_at >= now() - 24h          … used in the last day
//   updated_at - created_at > 30 min   … lived long enough to be a real session
//   ended_at is null                   … not gavelled out
// The lifespan filter is the important one: hundreds of committees get created
// and abandoned within a minute or two, and without it the board is noise.
//
// STATUS vs PHASE — deliberately two separate things:
//   status answers "is anyone actually in there right now"  (Live / Idle / Suspended)
//   phase  answers "what are they doing"                    (GSL, caucus, voting…)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw, Search, Copy, Check, Gavel, Users, Mic, Info, Radio,
  PauseCircle, Globe2, Building2, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { FlagImg } from '@/components/FlagImg';
import { LogoDisc } from '@/components/LogoDisc';
import Portal from '@/components/Portal';
import { getCountryByCode, getCountryByName } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import Loader from '@/components/Loader';
import { NEU, NEU_GRADIENTS, NeuCard, NeuInset, NeuIconDisc, OUTFIT, EASE } from '@/components/neu';

const MONO = 'ui-monospace, monospace';
const RED = '#8B2020';

// ── Row shape, mirrors admin_live_committees() exactly ──────────────────────

interface CaucusJson {
  active?: boolean;
  type?: 'moderated' | 'unmoderated';
  motionLabel?: string;
  purpose?: string;
  remainingTime?: number;
}

interface LiveRow {
  id: string;
  code: string;
  name: string;
  topic: string | null;
  phase: string;
  chair_names: string[] | null;
  caucus: CaucusJson | null;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  expires_at: string | null;
  session_origin: string | null;
  active_minutes: number;
  idle_minutes: number;
  suspended: boolean;
  speaker_country: string | null;
  speaker_started_at: string | null;
  speaker_time_remaining: number;
  delegates_total: number;
  delegates_present: number;
  gsl_queue: number;
  caucus_queue: number;
  pending_motions: number;
  documents_total: number;
  /** ISO 3166-1 alpha-2 captured at creation. NULL for every session created
   *  before the column existed — rendered as "Unknown", never guessed.
   *  Country only, never city: the whole committees row is anon-readable, so
   *  the coarsest useful granularity is the only responsible one to store. */
  creator_country: string | null;
  conference_id: string | null;
  conference_slug: string | null;
  conference_acronym: string | null;
  conference_name: string | null;
  conference_city: string | null;
  conference_country: string | null;
  committee_abbreviation: string | null;
  committee_logo_url: string | null;
}

type Status = 'live' | 'idle' | 'suspended';
type Filter = 'all' | 'live' | 'idle' | 'suspended' | 'conference' | 'standalone';

/** Peter's three-state model: suspended wins, then a 15-minute idle cut. */
function statusOf(r: LiveRow): Status {
  if (r.suspended) return 'suspended';
  return r.idle_minutes <= 15 ? 'live' : 'idle';
}

const STATUS_META: Record<Status, { label: string; color: string; tint: string }> = {
  live: { label: 'Live now', color: NEU.green, tint: 'rgba(61,122,82,0.13)' },
  idle: { label: 'Idle', color: '#8A5A2E', tint: 'rgba(184,132,74,0.16)' },
  suspended: { label: 'Suspended', color: RED, tint: 'rgba(139,32,32,0.11)' },
};

const PHASE_LABELS: Record<string, string> = {
  'pre-session': 'Pre-session',
  'roll-call': 'Roll call',
  'speakers-list': "Speakers' list",
  'moderated-caucus': 'Moderated caucus',
  'unmoderated-caucus': 'Unmoderated caucus',
  voting: 'Voting',
  adjourned: 'Adjourned',
};

/** What the committee is doing, preferring the live caucus over the raw phase. */
function phaseLabel(r: LiveRow): string {
  const c = r.caucus;
  if (c && (c.active ?? true) && (r.phase === 'moderated-caucus' || r.phase === 'unmoderated-caucus')) {
    return c.motionLabel?.trim() || (c.type === 'unmoderated' ? 'Unmoderated caucus' : 'Moderated caucus');
  }
  // 'adjourned' with no ended_at is a SUSPENDED session, not a finished one —
  // the RPC never returns ended sessions, so this is always the paused case.
  if (r.phase === 'adjourned') return 'Suspended';
  return PHASE_LABELS[r.phase] ?? r.phase;
}

function fmtActive(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return h % 24 === 0 ? `${d}d` : `${d}d ${h % 24}h`;
}

function fmtIdle(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── HoverHint — portaled, flips at the viewport edges, opens on HOVER ────────
// UI RULES: informational affordances reveal on hover (and focus), never on
// click, and a floating layer is never allowed to be clipped by an ancestor's
// overflow, so it renders through Portal at fixed viewport coordinates.

function HoverHint({ children, width = 300 }: { children: React.ReactNode; width?: number }) {
  const btnRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 10;
    // Clamp horizontally so it never runs off the right edge.
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
    // Flip above when there is not enough room below.
    const below = window.innerHeight - r.bottom;
    const top = below < 150 ? Math.max(margin, r.top - 8 - 140) : r.bottom + 8;
    setPos({ left, top });
  }, [width]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Small delay so the pointer can travel from the badge into the panel.
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <>
      <span
        ref={btnRef}
        tabIndex={0}
        role="button"
        aria-label="More information"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex items-center justify-center rounded-full align-middle focus:outline-none"
        style={{
          width: 17, height: 17, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
          color: NEU.muted, cursor: 'help', flexShrink: 0,
        }}
      >
        <Info size={10} strokeWidth={2.6} />
      </span>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 9000,
              backgroundColor: NEU.surface, borderRadius: 14, padding: '11px 13px',
              boxShadow: NEU.out, fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5,
              color: NEU.ink,
            }}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="font-bold uppercase"
      style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 9.5, letterSpacing: '0.13em', ...style }}
    >
      {children}
    </p>
  );
}

function CopyCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-1.5 rounded-lg focus:outline-none"
      style={{
        border: 'none', padding: '4px 8px', backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outSmHover : NEU.outSm, cursor: 'pointer',
        fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.09em',
        color: copied ? NEU.green : NEU.ink, transition: `box-shadow 200ms ${EASE}`,
      }}
      title="Copy session code"
    >
      {value}
      {copied ? <Check size={11} /> : <Copy size={11} style={{ opacity: 0.55 }} />}
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={status === 'live' ? 'rounded-full animate-pulse' : 'rounded-full'}
        style={{
          width: 8, height: 8, backgroundColor: m.color, flexShrink: 0,
          boxShadow: status === 'live' ? `0 0 0 3px ${m.color}22` : undefined,
        }}
      />
      <span
        className="rounded-full whitespace-nowrap"
        style={{
          backgroundColor: m.tint, color: m.color, padding: '3px 9px',
          fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        {m.label}
      </span>
    </span>
  );
}

function PhaseChip({ label }: { label: string }) {
  return (
    <span
      className="inline-block rounded-full whitespace-nowrap"
      style={{
        backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.forest,
        padding: '4px 10px', fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

/** Field label + value, the repeating unit of a row's metric strip. */
function Cell({ label, children, width }: { label: string; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ minWidth: width, flexShrink: 0 }}>
      <Eyebrow style={{ fontSize: 9 }}>{label}</Eyebrow>
      <div style={{ marginTop: 3 }}>{children}</div>
    </div>
  );
}

// ── Origin cell ─────────────────────────────────────────────────────────────
// Gavelling has never recorded where a session was started. Until
// committees.creator_country is populated at creation this reads "Unknown" for
// every row — and it says so, rather than borrowing the conference's country
// and passing it off as the creator's.

function OriginCell({ r }: { r: LiveRow }) {
  const code = r.creator_country?.trim().toUpperCase() || null;
  if (!code) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>Unknown</span>
        <HoverHint width={310}>
          <strong style={{ fontWeight: 800 }}>Not recorded.</strong> Gavelling does not store where a
          session was created — <code style={{ fontFamily: MONO }}>committees</code> has no geo column,
          and <code style={{ fontFamily: MONO }}>/api/geo</code> is only read live in the browser for
          pricing and conference discovery; nothing persists it.
          {r.conference_country && (
            <>
              {' '}This committee&apos;s conference is based in{' '}
              <strong style={{ fontWeight: 800 }}>{r.conference_country}</strong>, which is where the{' '}
              <em>event</em> is held — not necessarily where the chair opened the session.
            </>
          )}
        </HoverHint>
      </span>
    );
  }
  const country = getCountryByCode(code);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Session created from ${country?.name ?? code}`}>
      <FlagImg code={code} size={15} />
      <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, fontWeight: 600 }}>
        {country?.name ?? code}
      </span>
    </span>
  );
}

// ── Row ─────────────────────────────────────────────────────────────────────

function CommitteeRow({ r }: { r: LiveRow }) {
  const status = statusOf(r);
  const acr = r.committee_abbreviation?.trim() || null;
  const short = committeeDisplayName(r.name, acr);
  const title = short || r.name;
  const subtitle = title !== r.name ? r.name : null;
  const mono = (acr ?? r.name).slice(0, 3).toUpperCase();
  const chairs = (r.chair_names ?? []).filter(Boolean);
  const speakerCode = r.speaker_country ? getCountryByName(r.speaker_country)?.code ?? '' : '';

  return (
    <NeuCard
      style={{
        padding: '14px 16px',
        // The status rail is what makes a suspended committee unmistakable at a
        // glance — colour is never the only signal, but it is the fastest one.
        borderLeft: `4px solid ${STATUS_META[status].color}`,
        borderTopLeftRadius: 22, borderBottomLeftRadius: 22,
        opacity: status === 'idle' ? 0.9 : 1,
      }}
    >
      <div className="flex items-start gap-x-6 gap-y-4 flex-wrap">
        {/* Identity — acronym primary, full name beneath (UI RULE) */}
        <div className="flex items-start gap-3 min-w-0" style={{ flex: '1 1 260px' }}>
          <LogoDisc src={r.committee_logo_url} size={38} fallbackText={mono} alt={title} />
          <div className="min-w-0">
            <p className="font-extrabold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 15.5, lineHeight: 1.15 }}>
              {title}
            </p>
            {subtitle && (
              <p className="truncate" style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 11 }}>{subtitle}</p>
            )}
            {r.topic && (
              <p className="truncate" style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 11, marginTop: 1, opacity: 0.85 }}>
                {r.topic}
              </p>
            )}
            {/* Conference attachment, or an explicit standalone marker */}
            <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
              {r.conference_id && r.conference_slug ? (
                <Link
                  href={`/manage/${r.conference_slug}/live`}
                  className="inline-flex items-center gap-1.5 rounded-full min-w-0"
                  style={{
                    backgroundColor: 'rgba(27,56,40,0.07)', color: NEU.forest, padding: '3px 9px',
                    fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, textDecoration: 'none',
                    letterSpacing: '0.02em',
                  }}
                  title={[r.conference_name, [r.conference_city, r.conference_country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                >
                  <Building2 size={10} style={{ flexShrink: 0 }} />
                  <span className="truncate">{r.conference_acronym || r.conference_name}</span>
                  <ExternalLink size={9} style={{ flexShrink: 0, opacity: 0.7 }} />
                </Link>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full"
                  style={{
                    backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.muted, padding: '3px 9px',
                    fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.02em',
                  }}
                >
                  <Globe2 size={10} style={{ flexShrink: 0 }} />
                  Standalone
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric strip */}
        <Cell label="Phase"><PhaseChip label={phaseLabel(r)} /></Cell>
        <Cell label="Status"><StatusBadge status={status} /></Cell>
        <Cell label="Active for" width={64}>
          <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
            {fmtActive(r.active_minutes)}
          </span>
        </Cell>
        <Cell label="Last activity" width={78}>
          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: status === 'live' ? NEU.green : NEU.muted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmtIdle(r.idle_minutes)}
          </span>
        </Cell>
        <Cell label="Floor" width={104}>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1" title={`${r.delegates_present} of ${r.delegates_total} present`}>
              <Users size={11} style={{ color: NEU.muted }} />
              <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {r.delegates_present}/{r.delegates_total}
              </span>
            </span>
            {r.speaker_country && (
              <span className="inline-flex items-center gap-1 min-w-0" title={`On the floor: ${r.speaker_country}`}>
                {speakerCode ? <FlagImg code={speakerCode} size={13} /> : <Mic size={11} style={{ color: NEU.muted }} />}
                <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: r.speaker_started_at ? NEU.green : NEU.muted, fontWeight: 600, maxWidth: 74 }}>
                  {r.speaker_country}
                </span>
              </span>
            )}
          </span>
        </Cell>
        <Cell label="Chairs" width={130}>
          <span className="inline-flex items-center gap-1.5 min-w-0" title={chairs.join(', ')}>
            <Gavel size={11} style={{ color: NEU.muted, flexShrink: 0 }} />
            <span className="truncate block" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: chairs.length ? NEU.ink : NEU.muted, maxWidth: 112 }}>
              {chairs.length ? chairs.join(', ') : '—'}
            </span>
          </span>
        </Cell>
        <Cell label="Created from" width={126}><OriginCell r={r} /></Cell>
        <Cell label="Code"><CopyCode value={r.code} /></Cell>
      </div>
    </NeuCard>
  );
}

// ── Tab ─────────────────────────────────────────────────────────────────────

export default function LiveCommitteesTab() {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LiveRow[] | null>(null);
  const [error, setError] = useState<'denied' | 'missing-rpc' | 'failed' | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshHover, setRefreshHover] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!session) { setError('denied'); setRows([]); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const supabase = getAuthedClient(session.access_token);
      const { data, error: err } = await supabase.rpc('admin_live_committees');
      if (err) {
        const msg = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
        // The RPC ships unapplied — until it is created every caller gets a
        // "function does not exist" from PostgREST. Say that plainly instead
        // of pretending the floor is empty.
        if (err.code === '42883' || msg.includes('could not find the function') || msg.includes('does not exist')) {
          setError('missing-rpc');
        } else if (msg.includes('not authorised') || msg.includes('not authorized')) {
          setError('denied');
        } else {
          setError('failed');
        }
        setRows([]);
        return;
      }
      setError(null);
      setRows((data ?? []) as LiveRow[]);
      setLastRefreshed(Date.now());
    } catch {
      setError('failed');
      setRows([]);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [session]);

  // Poll every 30s. The RPC scans every committee on the platform and runs six
  // correlated counts per surviving row, so this is deliberately slower than
  // the 10s per-conference board — and it stops entirely while the tab is
  // hidden, then refreshes immediately on return.
  useEffect(() => {
    if (authLoading) return;
    void load();
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void load();
    }, 30_000);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authLoading, load]);

  // 1s tick so "Refreshed Xs ago" and the relative times stay honest.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => rows ?? [], [rows]);

  const stats = useMemo(() => ({
    total: all.length,
    live: all.filter((r) => statusOf(r) === 'live').length,
    suspended: all.filter((r) => statusOf(r) === 'suspended').length,
  }), [all]);

  const shown = useMemo(() => {
    let r = all;
    if (filter === 'conference') r = r.filter((x) => !!x.conference_id);
    else if (filter === 'standalone') r = r.filter((x) => !x.conference_id);
    else if (filter !== 'all') r = r.filter((x) => statusOf(x) === filter);
    const s = q.trim().toLowerCase();
    if (s) {
      r = r.filter((x) =>
        x.name.toLowerCase().includes(s) ||
        x.code.toLowerCase().includes(s) ||
        (x.topic ?? '').toLowerCase().includes(s) ||
        (x.conference_name ?? '').toLowerCase().includes(s) ||
        (x.conference_acronym ?? '').toLowerCase().includes(s) ||
        (x.chair_names ?? []).some((c) => c.toLowerCase().includes(s)));
    }
    return r;
  }, [all, filter, q]);

  const secondsAgo = lastRefreshed ? Math.max(0, Math.floor((Date.now() - lastRefreshed) / 1000)) : null;

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: all.length },
    { key: 'live', label: 'Live now', n: stats.live },
    { key: 'idle', label: 'Idle', n: all.filter((r) => statusOf(r) === 'idle').length },
    { key: 'suspended', label: 'Suspended', n: stats.suspended },
    { key: 'conference', label: 'Conference', n: all.filter((r) => !!r.conference_id).length },
    { key: 'standalone', label: 'Standalone', n: all.filter((r) => !r.conference_id).length },
  ];

  return (
    <div style={{ fontFamily: OUTFIT }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <Eyebrow>Live status · platform-wide</Eyebrow>
          <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 25, lineHeight: 1.1, marginTop: 3 }}>
            Committees in use
          </h2>
          <p className="flex items-center gap-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 11.5, marginTop: 4 }}>
            Lived over 30 min · touched in the last 24 h · not ended
            <HoverHint width={330}>
              <strong style={{ fontWeight: 800 }}>What counts as live.</strong> A committee appears here when
              it has not been gavelled out, was written to in the last 24 hours, and existed for more than
              30 minutes between creation and its last write. That last filter is the important one —
              hundreds of committees get created and abandoned within a minute, and without it this board is
              unreadable.
              <br /><br />
              <strong style={{ fontWeight: 800 }}>Status is not phase.</strong> Status says whether anyone is
              in there right now (Live ≤ 15 min idle, Idle beyond that, Suspended when the session is paused);
              phase says what they are doing.
            </HoverHint>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {secondsAgo !== null && (
            <span style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              Refreshed {secondsAgo}s ago · auto every 30s
            </span>
          )}
          <button
            onClick={() => void load()}
            disabled={refreshing}
            onMouseEnter={() => setRefreshHover(true)}
            onMouseLeave={() => setRefreshHover(false)}
            className="inline-flex items-center gap-2 rounded-full py-2 px-3.5 focus:outline-none"
            style={{
              border: 'none', color: NEU.forest, backgroundColor: NEU.surface,
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
              textTransform: 'uppercase',
              boxShadow: refreshHover && !refreshing ? NEU.outSmHover : NEU.outSm,
              opacity: refreshing ? 0.6 : 1, cursor: refreshing ? 'default' : 'pointer',
              transition: `box-shadow 200ms ${EASE}`,
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2.5 mb-5" style={{ maxWidth: 520 }}>
        {[
          { label: 'Matching', v: stats.total, color: NEU.ink, emoji: 'Bar chart', icon: Radio, grad: NEU_GRADIENTS.forest },
          { label: 'Live now', v: stats.live, color: stats.live > 0 ? NEU.green : NEU.muted, emoji: 'Satellite antenna', icon: Radio, grad: NEU_GRADIENTS.green },
          { label: 'Suspended', v: stats.suspended, color: stats.suspended > 0 ? RED : NEU.muted, emoji: 'Pause button', icon: PauseCircle, grad: NEU_GRADIENTS.amber },
        ].map((s) => (
          <NeuCard key={s.label} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <NeuIconDisc gradient={s.grad} emoji={s.emoji} icon={s.icon} size={34} />
            <div className="min-w-0">
              <p style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, lineHeight: 1, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                {rows === null ? '—' : s.v}
              </p>
              <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: NEU.muted, marginTop: 4 }}>
                {s.label}
              </p>
            </div>
          </NeuCard>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="rounded-full px-3 py-1.5 focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em',
                cursor: 'pointer', border: 'none',
                backgroundColor: active ? NEU.forest : NEU.surface,
                color: active ? NEU.gold : NEU.ink,
                boxShadow: active ? `0 3px 8px rgba(27,56,40,0.34), ${NEU.outSm}` : NEU.outSm,
                transition: `box-shadow 200ms ${EASE}`,
              }}
            >
              {f.label} · {f.n}
            </button>
          );
        })}
        <span className="flex items-center gap-2 rounded-full px-3 py-2 ml-auto" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
          <Search size={13} style={{ color: NEU.muted }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Committee, code, chair, conference…"
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: NEU.ink, width: 220 }}
          />
        </span>
      </div>

      {/* Body */}
      {rows === null ? (
        <NeuCard style={{ padding: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader size={26} />
          <p style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5 }}>Reading the floor…</p>
        </NeuCard>
      ) : error === 'missing-rpc' ? (
        <NeuInset style={{ padding: 30, textAlign: 'center' }}>
          <p className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 15 }}>
            Not wired up yet
          </p>
          <p style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5, marginTop: 6, lineHeight: 1.55 }}>
            The <code style={{ fontFamily: MONO }}>admin_live_committees()</code> function has not been applied
            to the database. Apply the migration and this board fills itself in.
          </p>
        </NeuInset>
      ) : error ? (
        <NeuInset style={{ padding: 30, textAlign: 'center' }}>
          <p className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 15 }}>
            {error === 'denied' ? 'Nothing here' : 'Could not load the floor'}
          </p>
          <p style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5, marginTop: 6 }}>
            {error === 'denied'
              ? "This view isn't available for your account."
              : 'The request failed. Try refreshing in a moment.'}
          </p>
        </NeuInset>
      ) : shown.length === 0 ? (
        <NeuInset style={{ padding: 34, textAlign: 'center' }}>
          <p className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 15 }}>
            {all.length === 0 ? 'All quiet on the floor' : 'Nothing matches'}
          </p>
          <p style={{ color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5, marginTop: 6 }}>
            {all.length === 0
              ? 'No committee has been used in the last 24 hours.'
              : 'Try a different filter or search.'}
          </p>
        </NeuInset>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((r) => <CommitteeRow key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
