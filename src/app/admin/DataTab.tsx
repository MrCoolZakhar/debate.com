'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Data. The morning page.
//
// Peter and Christian read this before they read anything else, so it is built
// as a decision surface rather than a report dump: eight tiles for the last 24
// hours, then a short list of things that need a person TODAY, then everything
// else in quiet scannable panels underneath.
//
// SECURITY: this component holds no access logic worth trusting. The gate is
// admin_platform_metrics() / admin_data_lists(), both SECURITY DEFINER, both
// raising 'not authorised' unless is_platform_admin(). The tab shell already
// gates on admin_conference_overview(), but a UI that never renders is not a
// permission — these two own their own gate in the database.
//
// TWO CALLS ON PURPOSE:
//   • admin_platform_metrics(days) is all aggregate, carries no personal data,
//     and is what the Refresh button re-fetches.
//   • admin_data_lists(limit) carries names, emails and crash URLs, and is
//     fetched once on mount. Re-polling people is not a thing this page needs.
//
// EVERY DEFINITION IS INHERITED, NEVER RESTATED. The RPC shares
// compose_daily_platform_report()'s windows and filters (active conferences,
// rolling 24 hours, money never summed across currencies) and delegates "live
// right now" to admin_live_committees() and auth dead ends to
// admin_auth_flow_failures(). If a number here disagrees with the 13:00 email,
// the page is wrong, not the email. The stated-intent mix goes one better than
// inheriting a definition: both this page and compose_daily_platform_report()
// read the single function platform_intent_mix(), so there is no second copy of
// the aggregate that could drift out of step with the first.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UserPlus, FileText, CalendarPlus, Gavel, Radio, Mail, MailWarning, Award,
  RefreshCw, Info, AlertTriangle, CircleCheck, Wallet, Inbox, Globe2,
  Building2, ShieldAlert, GraduationCap, Bug, KeyRound, Clock, TrendingUp,
} from 'lucide-react';
import Portal from '@/components/Portal';
import Loader from '@/components/Loader';
import Avatar from '@/components/Avatar';
import { FlagImg } from '@/components/FlagImg';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName, countryToContinent, type Continent } from '@/lib/countries';
import { INTENT_OPTIONS } from '@/lib/conferenceIntent';
import {
  NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset, NeuStatTile, NeuIconDisc, NeuRing,
} from '@/components/neu';
import GrowthChart, { type GrowthPoint } from './GrowthChart';

const MONO = 'ui-monospace, monospace';
const RED = '#8B2020';

// Same validated ramp the participants funnel uses: one hue light→dark, so the
// nesting is visible and the order survives every kind of colour blindness.
const FUNNEL_RAMP = ['#5E9B78', '#3D7A52', '#275C3D', '#123324'] as const;

// ── Shapes, mirroring the two RPCs exactly ─────────────────────────────────

interface CurrencyRow { currency: string; invoices?: number; payments?: number; cents: number }
interface NamedCount { name: string; n: number }

interface Metrics {
  generated_at: string;
  window_days: number;
  window_from: string;
  today: {
    signups: number; applications: number; conferences_created: number;
    sessions_started: number; sessions_started_raw: number; live_now: number;
    emails_sent: number; emails_failed: number; cv_entries: number;
  };
  series: GrowthPoint[];
  users: { total: number; d1: number; d7: number; d30: number; education: { level: string; n: number }[] };
  geography: { known: number; total: number; countries: NamedCount[] };
  conferences: {
    total: number; active: number; public: number; private: number; verified: number;
    created_24h: number; setup_complete: number; setup_stalled: number;
    countries: NamedCount[];
    cities: { city: string; country: string | null; n: number }[];
    funnel: { submitted: number; accepted: number; assigned: number; checked_in: number; rejected: number; withdrawn: number };
    awaiting: number; awaiting_30d: number;
    /** What organisers said they came here to do, from platform_intent_mix().
     *  `intents` is one row per option key that at least one conference chose,
     *  already sorted by count. The four denominators beside it are not
     *  decoration: intent_unasked is every conference created before the
     *  question existed, and without it the bars would imply a sample the
     *  platform does not have. */
    intents: NamedCount[];
    intent_total: number; intent_answered: number;
    intent_skipped: number; intent_unasked: number; intent_other: number;
  };
  money: {
    open: CurrencyRow[]; settled_24h: CurrencyRow[];
    proofs: { pending: number; over_7d: number; oldest_days: number };
    credits_purchased: { lots: number; credits: number; lots_24h: number };
    credits_granted: number;
    credits_consumed: { total: number; refunded: number; d24: number };
    subscriptions_active: number;
  };
  health: {
    crashes_24h: number; crashes_7d: number; crashes_noise_24h: number;
    by_severity_24h: { severity: string; alerts: number; occurrences: number }[];
    by_severity_7d: { severity: string; alerts: number; occurrences: number }[];
    auth: { total_24h: number; dead_ends_24h: number; had_session_24h: number };
    email: {
      outbox_pending: number; sent_24h: number; failed_24h: number; failed_total: number;
      failures: { reason: string; n: number }[];
    };
    unconfirmed: { raw: number; signed_up_again: number; stuck: number; new_24h: number; oldest_days: number };
    inbound: {
      contact: number; contact_7d: number; ambassador: number; ambassador_7d: number;
      requests_open: number; requests_unseen: number;
    };
  };
}

interface Lists {
  recent_signups: {
    id: string; name: string | null; email: string | null; nationality: string | null;
    education_level: string | null; avatar_url: string | null; created_at: string; confirmed: boolean;
  }[];
  recent_errors: { id: string; recipient: string | null; subject: string | null; error: string | null; at: string }[];
  recent_enquiries: { kind: string; name: string | null; email: string | null; subject: string | null; at: string }[];
  top_crashes: {
    fingerprint: string; message: string | null; url: string | null; severity: string | null;
    reason: string | null; occurrences: number; first_seen: string; last_seen: string;
  }[];
}

// ── Formatting ─────────────────────────────────────────────────────────────

const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

const int = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-GB');

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
  }
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const EDUCATION_LABELS: Record<string, string> = {
  high_school: 'High school',
  university: 'University',
  unknown: 'Not stated',
};

const SEVERITY_TONE: Record<string, { fg: string; label: string }> = {
  blocked: { fg: RED, label: 'Blocked' },
  degraded: { fg: '#8A5A2E', label: 'Degraded' },
  noise: { fg: NEU.inkSoft, label: 'Noise' },
  unknown: { fg: NEU.inkSoft, label: 'Unclassified' },
};

// ── Small shared pieces ────────────────────────────────────────────────────

/** Read-only explainer. Opens on HOVER and focus per the UI rules, portaled at
 *  fixed coordinates so no ancestor's overflow can clip it, and flipped when
 *  it would run off an edge. */
function Hint({ title, children, width = 320 }: { title: string; children: React.ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left - 8), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom > 230;
    setPos({ top: below ? r.bottom + 8 : Math.max(8, r.top - 230), left });
  }, [width]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 160); };

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-label={title}
        className="inline-flex items-center gap-1 focus:outline-none"
        style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.inkSoft, cursor: 'help' }}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      >
        <Info size={12} /> {title}
      </span>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show} onMouseLeave={hide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width,
              backgroundColor: NEU.surface, border: `1px solid ${'#DDD4C0'}`, borderRadius: 14,
              padding: '13px 15px', boxShadow: '0 12px 32px rgba(27,56,40,0.20)',
              fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.55, color: NEU.ink,
            }}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

function Section({
  icon, gradient, title, kicker, hint, right, children,
}: {
  icon: typeof Info;
  gradient: [string, string];
  title: string;
  kicker?: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <NeuCard style={{ padding: '18px 20px 20px' }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <NeuIconDisc gradient={gradient} icon={icon} size={36} />
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>
            {title}
          </h2>
          {kicker && (
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 1 }}>{kicker}</p>
          )}
        </div>
        {hint}
        {right}
      </div>
      {children}
    </NeuCard>
  );
}

/** Pressed-in row of small numbers. Tabular, so columns line up down the page. */
function StatStrip({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <NeuInset small style={{ display: 'flex', flexWrap: 'wrap', gap: 0, padding: '10px 4px' }}>
      {items.map((it, i) => (
        <div
          key={it.label}
          className="flex-1"
          style={{ minWidth: 78, padding: '2px 12px', borderInlineStart: i === 0 ? 'none' : `1px solid rgba(27,56,40,0.09)` }}
        >
          <p style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 900, color: it.tone ?? NEU.ink, lineHeight: 1.1, ...NUM }}>
            {it.value}
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, color: NEU.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>
            {it.label}
          </p>
        </div>
      ))}
    </NeuInset>
  );
}

/** Ranked horizontal bars. The bar is a magnitude cue; the number beside it is
 *  the data, so nothing depends on judging bar length by eye. */
function RankedBars({
  rows, max, flags = false, emptyLabel = 'Nothing yet.',
}: {
  rows: { key: string; label: string; sub?: string; n: number }[];
  max?: number;
  flags?: boolean;
  emptyLabel?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map(r => r.n));
  if (rows.length === 0) {
    return <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, padding: '8px 2px' }}>{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col" style={{ gap: 7 }}>
      {rows.map(r => {
        const code = flags ? getCountryByName(r.label)?.code : undefined;
        return (
          <div key={r.key} className="flex items-center gap-2.5">
            {flags && (
              <span className="flex-shrink-0 inline-flex items-center" style={{ width: 20, lineHeight: 0 }}>
                {code ? <FlagImg code={code} size={18} /> : <Globe2 size={15} style={{ color: NEU.muted }} />}
              </span>
            )}
            <span
              className="truncate"
              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, width: 132, flexShrink: 0 }}
              title={r.sub ? `${r.label} · ${r.sub}` : r.label}
            >
              {r.label}
              {r.sub && <span style={{ fontWeight: 500, color: NEU.inkSoft }}> · {r.sub}</span>}
            </span>
            <span className="flex-1" style={{ minWidth: 40, height: 9, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
              <span
                style={{
                  display: 'block', height: '100%', borderRadius: 999,
                  width: `max(${((r.n / top) * 100).toFixed(1)}%, 9px)`,
                  background: `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                  transition: `width 600ms ${EASE}`,
                }}
              />
            </span>
            <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, width: 44, textAlign: 'end', flexShrink: 0, ...NUM }}>
              {int(r.n)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One "this needs a person" row. Attention is a gold/red marker PLUS the word,
 *  never hue on its own — the same rule ApplicantsDial follows. */
function AttentionRow({
  level, label, value, detail,
}: { level: 'act' | 'watch' | 'clear'; label: string; value: string; detail: string }) {
  const tone = level === 'act' ? RED : level === 'watch' ? NEU.deepGold : NEU.green;
  const Icon = level === 'clear' ? CircleCheck : AlertTriangle;
  const word = level === 'act' ? 'Act' : level === 'watch' ? 'Watch' : 'Clear';
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '9px 13px', borderRadius: 14,
        backgroundColor: level === 'clear' ? NEU.base : NEU.surface,
        boxShadow: level === 'clear' ? NEU.inSm : NEU.outSm,
      }}
    >
      <Icon size={15} strokeWidth={2.5} style={{ color: tone, flexShrink: 0 }} />
      <span
        className="flex-shrink-0"
        style={{
          fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
          color: tone, width: 40,
        }}
      >
        {word.toUpperCase()}
      </span>
      <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, flex: 1, minWidth: 0 }}>
        {label}
      </span>
      <span className="truncate hidden md:inline" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, maxWidth: 260 }}>
        {detail}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: level === 'clear' ? NEU.inkSoft : tone, flexShrink: 0, ...NUM }}>
        {value}
      </span>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline gap-3" style={{ padding: '5px 0', borderBottom: '1px solid rgba(27,56,40,0.07)' }}>
      <span className="flex-1 min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>{label}</span>
      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: tone ?? NEU.ink, ...NUM }}>{value}</span>
    </div>
  );
}

// ── The tab ────────────────────────────────────────────────────────────────

export default function DataTab() {
  const { session, loading: authLoading } = useAuth();
  const [m, setM] = useState<Metrics | null>(null);
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Refresh button only. Re-reads the aggregate, never the people. */
  const refresh = useCallback(async () => {
    if (!session) { setError('Not signed in.'); return; }
    setRefreshing(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error: e } = await supabase.rpc('admin_platform_metrics', { p_days: 30 });
    setRefreshing(false);
    if (e) { setError(e.message); return; }
    setError(null);
    setM(data as Metrics);
  }, [session]);

  // First load fetches both halves together. The PII-bearing half is fetched
  // exactly once; Refresh re-polls only the aggregate, which is the half that
  // actually moves during a morning read. Both calls live inside the async
  // closure so no state is set synchronously from the effect body, and `alive`
  // stops a slow response landing on an unmounted tab (only the selected tab
  // mounts, so switching away mid-fetch is the normal case, not an edge one).
  useEffect(() => {
    if (authLoading || !session) return;
    let alive = true;
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const [agg, lst] = await Promise.all([
        supabase.rpc('admin_platform_metrics', { p_days: 30 }),
        supabase.rpc('admin_data_lists', { p_limit: 20 }),
      ]);
      if (!alive) return;
      if (agg.error) {
        setError(agg.error.message);
      } else {
        setError(null);
        setM(agg.data as Metrics);
      }
      if (lst.data) setLists(lst.data as Lists);
    })();
    return () => { alive = false; };
  }, [authLoading, session]);

  // Sparklines for the headline tiles: the last 14 days of the same series the
  // chart draws, so a tile and the chart can never tell different stories.
  const spark = useCallback((pick: (p: GrowthPoint) => number): number[] | undefined => {
    if (!m || m.series.length < 3) return undefined;
    return m.series.slice(-14).map(pick);
  }, [m]);

  const continents = useMemo(() => {
    if (!m) return { rows: [] as { key: string; label: string; n: number }[], unmapped: 0 };
    const by = new Map<Continent, number>();
    let unmapped = 0;
    for (const c of m.geography.countries) {
      const cont = countryToContinent(c.name);
      if (cont) by.set(cont, (by.get(cont) ?? 0) + c.n);
      else unmapped += c.n;
    }
    return {
      rows: [...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: k, n })),
      unmapped,
    };
  }, [m]);

  if (authLoading || (!m && !error)) {
    return <div className="flex items-center justify-center py-20"><Loader /></div>;
  }

  if (error || !m) {
    return (
      <div className="rounded-2xl px-4 py-6 text-center" style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: RED }}>Could not load the numbers.</p>
        <p className="mt-1" style={{ fontFamily: MONO, fontSize: 11, color: NEU.inkSoft }}>{error}</p>
      </div>
    );
  }

  const t = m.today;
  const f = m.conferences.funnel;
  const natPct = m.geography.total > 0 ? Math.round((m.geography.known / m.geography.total) * 100) : 0;

  // Stated intent. Rows are built from INTENT_OPTIONS so an option nobody has
  // picked still shows as a zero: the reader needs to see the whole menu they
  // were offered, otherwise "nobody wants emails" and "emails was never an
  // option" look identical. A key the aggregate returns that is no longer in
  // INTENT_OPTIONS is a retired option and gets counted out loud rather than
  // silently dropped.
  const intentAnsweredN = m.conferences.intent_answered;
  const intentByKey = new Map(m.conferences.intents.map(i => [i.name, i.n]));
  const intentRows = INTENT_OPTIONS
    .map(o => ({ key: o.key, label: o.short.charAt(0) + o.short.slice(1).toLowerCase(), n: intentByKey.get(o.key) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const intentRetired = m.conferences.intents.filter(i => !INTENT_OPTIONS.some(o => o.key === i.name));
  const eduTotal = m.users.education.reduce((a, e) => a + e.n, 0) || 1;
  const inboundTotal = m.health.inbound.contact_7d + m.health.inbound.ambassador_7d + m.health.inbound.requests_open;

  // The morning triage. Ordered by "who is waiting on us", longest first.
  const attention: { key: string; level: 'act' | 'watch' | 'clear'; label: string; value: string; detail: string }[] = [
    {
      key: 'proofs',
      level: m.money.proofs.over_7d > 0 ? 'act' : m.money.proofs.pending > 0 ? 'watch' : 'clear',
      label: 'Payment proofs waiting on an organiser',
      value: int(m.money.proofs.pending),
      detail: m.money.proofs.pending
        ? `${int(m.money.proofs.over_7d)} over 7 days, oldest ${m.money.proofs.oldest_days} days`
        : 'Nothing pending',
    },
    {
      key: 'apps',
      level: m.conferences.awaiting_30d > 0 ? 'act' : m.conferences.awaiting > 0 ? 'watch' : 'clear',
      label: 'Applications awaiting a decision',
      value: int(m.conferences.awaiting),
      detail: `${int(m.conferences.awaiting_30d)} have waited over 30 days`,
    },
    {
      key: 'inbound',
      level: inboundTotal > 0 ? 'watch' : 'clear',
      label: 'Inbound needing a human',
      value: int(inboundTotal),
      detail: `${int(m.health.inbound.contact_7d)} enquiries and ${int(m.health.inbound.ambassador_7d)} ambassador in 7d, ${int(m.health.inbound.requests_open)} open requests`,
    },
    {
      key: 'crash',
      level: m.health.crashes_24h > 0 ? 'act' : m.health.crashes_7d > 0 ? 'watch' : 'clear',
      label: 'Real crashes in 24 hours',
      value: int(m.health.crashes_24h),
      detail: `${int(m.health.crashes_7d)} in 7 days. ${int(m.health.crashes_noise_24h)} noise alerts excluded`,
    },
    {
      key: 'mail',
      level: t.emails_failed > 0 ? 'act' : m.health.email.outbox_pending > 0 ? 'watch' : 'clear',
      label: 'Emails that did not arrive in 24 hours',
      value: int(t.emails_failed),
      detail: `${int(m.health.email.outbox_pending)} still queued, ${int(m.health.email.failed_total)} failed all time`,
    },
    {
      key: 'auth',
      level: m.health.auth.dead_ends_24h > 0 ? 'act' : 'clear',
      label: 'Auth dead ends in 24 hours',
      value: int(m.health.auth.dead_ends_24h),
      detail: `${int(m.health.auth.had_session_24h)} had a session anyway, ${int(m.health.auth.total_24h)} logged in total`,
    },
    {
      key: 'unconf',
      level: m.health.unconfirmed.new_24h > 0 ? 'act' : m.health.unconfirmed.stuck > 0 ? 'watch' : 'clear',
      label: 'Accounts genuinely locked out',
      value: int(m.health.unconfirmed.stuck),
      detail: `${int(m.health.unconfirmed.new_24h)} new today, oldest ${m.health.unconfirmed.oldest_days} days, ${int(m.health.unconfirmed.signed_up_again)} of ${int(m.health.unconfirmed.raw)} just signed up again`,
    },
  ];
  const actCount = attention.filter(a => a.level === 'act').length;

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>

      {/* ── Header strip ────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.02em' }}>
            Today at a glance
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 2 }}>
            Rolling last 24 hours, the same window and the same filters as the 13:00 email.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: NEU.inkSoft, ...NUM }}>
            read {ago(m.generated_at)}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 focus:outline-none"
            style={{
              border: 'none', cursor: refreshing ? 'default' : 'pointer', borderRadius: 999,
              padding: '8px 15px', backgroundColor: NEU.surface, boxShadow: NEU.outSm,
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
              color: NEU.forest, opacity: refreshing ? 0.6 : 1,
              transition: `box-shadow 200ms ${EASE}`,
            }}
          >
            <RefreshCw size={13} strokeWidth={2.6} style={{ color: NEU.deepGold }} />
            {refreshing ? 'REFRESHING' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* ── Eight tiles. Fixed 4-up so it reads as two clean rows at 1440 and
             at 1024; auto-fit left seven on one line and orphaned the eighth. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <NeuStatTile compact gradient={NEU_GRADIENTS.forest} icon={UserPlus} value={int(t.signups)} label="Sign-ups" spark={spark(p => p.signups)} />
        <NeuStatTile compact gradient={NEU_GRADIENTS.forest} icon={FileText} value={int(t.applications)} label="Applications" spark={spark(p => p.applications)} />
        <NeuStatTile compact gradient={NEU_GRADIENTS.gold} icon={CalendarPlus} value={int(t.conferences_created)} label="Conferences created" spark={spark(p => p.conferences_created)} />
        <NeuStatTile compact gradient={NEU_GRADIENTS.sage} icon={Gavel} value={int(t.sessions_started)} label="Sessions started" spark={spark(p => p.sessions_conference + p.sessions_standalone)} />
        <NeuStatTile compact gradient={NEU_GRADIENTS.green} icon={Radio} value={int(t.live_now)} label="Live right now" />
        <NeuStatTile compact gradient={NEU_GRADIENTS.sage} icon={Mail} value={int(t.emails_sent)} label="Emails sent" />
        <NeuStatTile compact gradient={t.emails_failed > 0 ? NEU_GRADIENTS.amber : NEU_GRADIENTS.sage} icon={MailWarning} value={int(t.emails_failed)} label="Emails failed" />
        <NeuStatTile compact gradient={NEU_GRADIENTS.gold} icon={Award} value={int(t.cv_entries)} label="CV entries" spark={spark(p => p.cv_entries)} />
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft }}>
        <Hint title="What these eight count">
          <p style={{ fontWeight: 800, marginBottom: 6 }}>All eight are a rolling 24 hours.</p>
          <p><strong>Sign-ups</strong> exclude demo profiles, so they can sit one below the 13:00 email, which does not.</p>
          <p style={{ marginTop: 6 }}><strong>Applications</strong> count active conferences only (is_active_conference), exactly as the email does.</p>
          <p style={{ marginTop: 6 }}>
            <strong>Sessions started</strong> applies the Live tab&apos;s 30-minute lifespan rule.
            {' '}{int(t.sessions_started_raw)} committee rows were created in the window; {int(t.sessions_started)} lived
            long enough to be a real session. Without that rule the number is noise.
          </p>
          <p style={{ marginTop: 6 }}><strong>Live right now</strong> comes straight from admin_live_committees: not suspended, idle under 15 minutes.</p>
          <p style={{ marginTop: 6, color: NEU.inkSoft }}>Sparklines are the last 14 days of the same series the chart below draws.</p>
        </Hint>
        <span style={NUM}>
          {int(t.sessions_started_raw)} committees created, {int(t.sessions_started)} lived past 30 minutes
        </span>
      </p>

      {/* ── Needs a person today ────────────────────────────────────────── */}
      <Section
        icon={ShieldAlert}
        gradient={actCount > 0 ? NEU_GRADIENTS.amber : NEU_GRADIENTS.green}
        title="Needs a person today"
        kicker={actCount > 0
          ? `${actCount} of ${attention.length} want action, the rest are steady.`
          : 'Nothing is waiting on us right now.'}
        hint={
          <Hint title="Why these seven">
            <p style={{ fontWeight: 800, marginBottom: 6 }}>These are the queues where someone outside is waiting.</p>
            <p>
              Act means a person is blocked or the age threshold has passed. Watch means a queue exists but is
              young. Clear means empty. The word is printed beside the marker on purpose, so the state never
              depends on reading a colour.
            </p>
            <p style={{ marginTop: 6, color: NEU.inkSoft }}>Crash counts exclude severity &lsquo;noise&rsquo;, which is most of the table.</p>
          </Hint>
        }
      >
        <div className="flex flex-col" style={{ gap: 6 }}>
          {attention.map(a => (
            <AttentionRow key={a.key} level={a.level} label={a.label} value={a.value} detail={a.detail} />
          ))}
        </div>
      </Section>

      {/* ── Growth ──────────────────────────────────────────────────────── */}
      <Section
        icon={TrendingUp}
        gradient={NEU_GRADIENTS.forest}
        title="Growth"
        kicker={`Per day since ${new Date(`${m.window_from}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}, ${m.window_days} days.`}
        hint={
          <Hint title="Reading this chart">
            <p style={{ fontWeight: 800, marginBottom: 6 }}>One metric at a time, on its own axis.</p>
            <p>
              Sign-ups run tens per day and sessions run a handful; on a shared axis the small series would be a
              flat line on the floor. The dashed gold curve is a trailing 7-day mean, never a daily count.
            </p>
            <p style={{ marginTop: 6 }}>
              Standalone sessions only start appearing on 4 September, when the standalone flow began recording
              session_origin. Earlier days are genuinely zero, not missing.
            </p>
            <p style={{ marginTop: 6, color: NEU.inkSoft }}>Show table gives the same numbers as text.</p>
          </Hint>
        }
      >
        <GrowthChart points={m.series} />
      </Section>

      {/* ── Users and geography · Conferences. Side by side from 1280 up,
             stacked below it: at 1024 two of these columns would each be ~470px
             and the ranked bars would start truncating country names. ─────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <Section
          icon={GraduationCap}
          gradient={NEU_GRADIENTS.forest}
          title="Users"
          kicker="Demo accounts excluded from every number here."
        >
          <StatStrip items={[
            { label: 'Profiles', value: int(m.users.total) },
            { label: '+24h', value: `+${int(m.users.d1)}` },
            { label: '+7d', value: `+${int(m.users.d7)}` },
            { label: '+30d', value: `+${int(m.users.d30)}` },
          ]} />

          {/* Education mix — one bar, labelled in place. */}
          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '18px 0 7px' }}>
            Education level
          </p>
          <div className="flex" style={{ height: 13, borderRadius: 999, overflow: 'hidden', boxShadow: NEU.inSm, backgroundColor: NEU.base }}>
            {m.users.education.map((e, i) => (
              <span
                key={e.level}
                title={`${EDUCATION_LABELS[e.level] ?? e.level}: ${int(e.n)}`}
                style={{
                  width: `${(e.n / eduTotal) * 100}%`,
                  background: e.level === 'unknown' ? 'rgba(27,56,40,0.13)' : FUNNEL_RAMP[Math.min(i, 2)],
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ marginTop: 7 }}>
            {m.users.education.map((e, i) => (
              <span key={e.level} className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: e.level === 'unknown' ? 'rgba(27,56,40,0.22)' : FUNNEL_RAMP[Math.min(i, 2)] }} />
                {EDUCATION_LABELS[e.level] ?? e.level}{' '}
                <strong style={{ color: NEU.ink, ...NUM }}>{int(e.n)}</strong>
                <span style={NUM}>({Math.round((e.n / eduTotal) * 100)}%)</span>
              </span>
            ))}
          </div>

          {/* Nationality — the honesty label is the headline, not a footnote. */}
          <div className="flex items-center justify-between gap-2 flex-wrap" style={{ margin: '20px 0 4px' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft }}>
              Where accounts say they are from
            </p>
            <Hint title="Only a fifth of accounts">
              <p style={{ fontWeight: 800, marginBottom: 6 }}>This ranks {int(m.geography.known)} accounts, not {int(m.geography.total)}.</p>
              <p>
                Nationality is an optional profile field, so {natPct}% of accounts have one. Everything below is a
                ranking of that {natPct}%, and it is not safe to project onto the whole user base: the field is more
                likely to be filled in by people who finished a full profile.
              </p>
              <p style={{ marginTop: 6, color: NEU.inkSoft }}>
                Conference geography, in the panel beside this one, comes from conferences.country, which is
                100% populated and is the real geography source.
              </p>
            </Hint>
          </div>
          <NeuInset small style={{ padding: '7px 11px', marginBottom: 11 }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.ink, ...NUM }}>
              <strong>{natPct}% coverage</strong>
              <span style={{ color: NEU.inkSoft }}> · {int(m.geography.known)} of {int(m.geography.total)} accounts stated a nationality</span>
            </p>
          </NeuInset>
          <RankedBars flags rows={m.geography.countries.slice(0, 8).map(c => ({ key: c.name, label: c.name, n: c.n }))} />

          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '18px 0 7px' }}>
            By continent
          </p>
          <RankedBars rows={continents.rows.map(c => ({ key: c.key, label: c.label, n: c.n }))} />
          {continents.unmapped > 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 7 }}>
              {int(continents.unmapped)} could not be mapped to a continent (free-text or misspelled entries).
            </p>
          )}

          {/* Recent signups */}
          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '20px 0 7px' }}>
            Newest accounts
          </p>
          {!lists ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>Loading…</p>
          ) : (
            <div className="flex flex-col" style={{ gap: 3 }}>
              {lists.recent_signups.slice(0, 8).map(s => {
                const code = s.nationality ? getCountryByName(s.nationality)?.code : undefined;
                return (
                  <div key={s.id} className="flex items-center gap-2.5" style={{ padding: '4px 2px' }}>
                    <Avatar url={s.avatar_url} name={s.name ?? '?'} size={22} />
                    <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, maxWidth: 150 }}>
                      {s.name || 'No name yet'}
                    </span>
                    {code && <FlagImg code={code} size={14} />}
                    <span className="truncate flex-1 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft }}>
                      {s.email}
                    </span>
                    {!s.confirmed && (
                      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: RED, flexShrink: 0 }}>
                        UNCONFIRMED
                      </span>
                    )}
                    <span style={{ fontFamily: MONO, fontSize: 10, color: NEU.muted, flexShrink: 0, ...NUM }}>{ago(s.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          icon={Building2}
          gradient={NEU_GRADIENTS.gold}
          title="Conferences"
          kicker={`${int(m.conferences.active)} of ${int(m.conferences.total)} are active. Everything below the counts is active-only.`}
        >
          <StatStrip items={[
            { label: 'Total', value: int(m.conferences.total) },
            { label: 'Active', value: int(m.conferences.active) },
            { label: 'Public', value: int(m.conferences.public) },
            { label: 'Private', value: int(m.conferences.private) },
            { label: 'Verified', value: int(m.conferences.verified) },
          ]} />

          {/* Set-up complete vs stalled */}
          <div className="flex items-center gap-4" style={{ marginTop: 16 }}>
            <NeuRing
              value={m.conferences.setup_complete}
              max={Math.max(1, m.conferences.setup_complete + m.conferences.setup_stalled)}
              size={72} strokeWidth={8} gradient={NEU_GRADIENTS.gold}
            >
              <span style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 900, color: NEU.ink, ...NUM }}>
                {m.conferences.setup_complete}
              </span>
            </NeuRing>
            <div className="min-w-0">
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                {int(m.conferences.setup_complete)} finished set-up, {int(m.conferences.setup_stalled)} stalled
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 2 }}>
                Read from conference_setup_status(), the same seven steps the organiser dashboard shows them.
                This is the single biggest activation gap on the platform.
              </p>
            </div>
          </div>

          {/* Application funnel — nested, so ordered light to dark, never stacked. */}
          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '20px 0 8px' }}>
            Application funnel
          </p>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {([
              ['Submitted', f.submitted, FUNNEL_RAMP[0]],
              ['Accepted', f.accepted, FUNNEL_RAMP[1]],
              ['Assigned', f.assigned, FUNNEL_RAMP[2]],
              ['Checked in', f.checked_in, FUNNEL_RAMP[3]],
            ] as [string, number, string][]).map(([label, n, color], i) => (
              <div key={label} className="flex items-center gap-2.5">
                <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, width: 86, flexShrink: 0 }}>{label}</span>
                <span className="flex-1" style={{ minWidth: 40, height: 15, borderRadius: 6, backgroundColor: NEU.base, boxShadow: NEU.inSm, position: 'relative' }}>
                  <span style={{
                    display: 'block', height: '100%', borderRadius: 6,
                    width: `max(${f.submitted ? (n / f.submitted) * 100 : 0}%, 6px)`,
                    background: color, transition: `width 600ms ${EASE}`,
                  }} />
                </span>
                <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink, width: 46, textAlign: 'end', flexShrink: 0, ...NUM }}>{int(n)}</span>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, width: 40, textAlign: 'end', flexShrink: 0, ...NUM }}>
                  {i === 0 ? '' : `${f.submitted ? Math.round((n / f.submitted) * 100) : 0}%`}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 8 }}>
            Nested stages, so each one is a subset of the one above and the percentages are of everything
            submitted. {int(f.rejected)} rejected and {int(f.withdrawn)} withdrawn sit inside Submitted and
            reach no further. {int(m.conferences.awaiting)} are still awaiting a decision.
          </p>

          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '20px 0 7px' }}>
            Where conferences are
          </p>
          <RankedBars flags rows={m.conferences.countries.slice(0, 8).map(c => ({ key: c.name, label: c.name, n: c.n }))} />

          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '18px 0 7px' }}>
            Top cities
          </p>
          <RankedBars
            flags
            rows={m.conferences.cities.slice(0, 8).map(c => ({
              key: `${c.city}-${c.country}`, label: c.country ?? c.city, sub: c.city, n: c.n,
            }))}
          />
          <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 8 }}>
            City is free text, so near-duplicates such as Bangalore and Bengaluru are counted separately.
            The flag is the country, which is the reliable field.
          </p>

          {/* What organisers say they want. The denominator is the headline, the
              same way the nationality block leads with its coverage, because for
              a long time almost every conference here predates the question. */}
          <div className="flex items-center justify-between gap-2 flex-wrap" style={{ margin: '20px 0 4px' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft }}>
              What organisers say they want
            </p>
            <Hint title={`Answered by ${int(intentAnsweredN)}`}>
              <p style={{ fontWeight: 800, marginBottom: 6 }}>
                This ranks {int(intentAnsweredN)} conferences, not {int(m.conferences.intent_total)}.
              </p>
              <p>
                The question is asked once, at the end of the creation wizard, so every conference created
                before it shipped has never been asked. {int(m.conferences.intent_unasked)} are in that state
                and {int(m.conferences.intent_skipped)} were asked and skipped. Neither is a signal about what
                organisers want, and neither is counted below.
              </p>
              <p style={{ marginTop: 6 }}>
                Organisers can pick more than one, so the bars do not add up to the answered count. Each bar is
                that option as a share of the {int(intentAnsweredN)} who answered.
              </p>
              <p style={{ marginTop: 6, color: NEU.inkSoft }}>
                Same aggregate function as the 13:00 email, platform_intent_mix(), so the two cannot disagree.
              </p>
            </Hint>
          </div>
          <NeuInset small style={{ padding: '7px 11px', marginBottom: 11 }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.ink, ...NUM }}>
              <strong>
                {int(intentAnsweredN)} of {int(m.conferences.intent_total)} answered
              </strong>
              <span style={{ color: NEU.inkSoft }}>
                {' '}· {int(m.conferences.intent_skipped)} skipped the question
                · {int(m.conferences.intent_unasked)} were never asked
              </span>
            </p>
          </NeuInset>
          {intentAnsweredN === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>
              Nobody has answered yet. The six options are ready and waiting; there is nothing to rank until
              conferences start coming through the new wizard.
            </p>
          ) : (
            <RankedBars rows={intentRows} max={Math.max(1, intentAnsweredN)} />
          )}
          {m.conferences.intent_other > 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 8 }}>
              {int(m.conferences.intent_other)} wrote their own answer in as well. Free text is not aggregated
              here; it is on the conference row in the Conferences tab.
            </p>
          )}
          {intentRetired.length > 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, marginTop: 8 }}>
              {int(intentRetired.reduce((a, i) => a + i.n, 0))} answers name an option that is no longer offered
              ({intentRetired.map(i => i.name).join(', ')}), so they are counted in the total but have no bar.
            </p>
          )}
        </Section>
      </div>

      {/* ── Money ───────────────────────────────────────────────────────── */}
      <Section
        icon={Wallet}
        gradient={NEU_GRADIENTS.green}
        title="Money"
        kicker="Active conferences only. Never summed across currencies."
        hint={
          <Hint title="Why there is no total">
            <p style={{ fontWeight: 800, marginBottom: 6 }}>One total across currencies would be a made-up number.</p>
            <p>
              There is no exchange rate stored anywhere in this system, so IDR, INR, TRY and USD are listed
              side by side and never added. The 13:00 email does the same.
            </p>
            <p style={{ marginTop: 6 }}>
              Outstanding is amount_cents minus amount_paid_cents on open and partial invoices, so a part-paid
              invoice contributes only what is still owed.
            </p>
            <p style={{ marginTop: 6, color: NEU.inkSoft }}>
              Credits purchased counts credit_lots with source = purchase only. The {int(m.money.credits_granted)} grant
              lots are one free credit per signup and are not a business event.
            </p>
          </Hint>
        }
      >
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>
              Outstanding on open invoices
            </p>
            {m.money.open.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nothing open.</p>
            ) : m.money.open.map(r => (
              <Row
                key={r.currency}
                label={`${r.currency} · ${int(r.invoices ?? 0)} invoice${(r.invoices ?? 0) === 1 ? '' : 's'}`}
                value={money(r.cents, r.currency)}
              />
            ))}
          </div>

          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>
              Settled in the last 24 hours
            </p>
            {m.money.settled_24h.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nothing settled today.</p>
            ) : m.money.settled_24h.map(r => (
              <Row
                key={r.currency}
                label={`${r.currency} · ${int(r.payments ?? 0)} payment${(r.payments ?? 0) === 1 ? '' : 's'}`}
                value={money(r.cents, r.currency)}
                tone={NEU.green}
              />
            ))}
          </div>

          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>
              Everything else
            </p>
            <Row label="Payment proofs waiting" value={int(m.money.proofs.pending)} tone={m.money.proofs.pending ? NEU.deepGold : undefined} />
            <Row label="Of those, over 7 days" value={int(m.money.proofs.over_7d)} tone={m.money.proofs.over_7d ? RED : undefined} />
            <Row label="Oldest proof, in days" value={int(m.money.proofs.oldest_days)} />
            <Row label="Credits purchased (lots)" value={`${int(m.money.credits_purchased.lots)} · ${int(m.money.credits_purchased.credits)} credits`} />
            <Row label="Credits consumed" value={int(m.money.credits_consumed.total)} />
            <Row label="Consumed in 24h" value={int(m.money.credits_consumed.d24)} />
            <Row label="Active subscriptions" value={int(m.money.subscriptions_active)} />
          </div>
        </div>
      </Section>

      {/* ── Health ──────────────────────────────────────────────────────── */}
      <Section
        icon={Bug}
        gradient={m.health.crashes_24h > 0 ? NEU_GRADIENTS.amber : NEU_GRADIENTS.sage}
        title="Health"
        kicker={`${int(m.health.crashes_24h)} real crashes in 24 hours, ${int(m.health.crashes_noise_24h)} noise alerts set aside.`}
        hint={
          <Hint title="What counts as a crash">
            <p style={{ fontWeight: 800, marginBottom: 6 }}>Severity &lsquo;noise&rsquo; is excluded from the headline.</p>
            <p>
              Most rows in crash_alerts are third-party DOM warnings and browser extension errors that no user
              ever saw. They are still listed below, marked, but they never drive the number at the top.
            </p>
            <p style={{ marginTop: 6, color: NEU.inkSoft }}>
              Auth dead ends come from admin_auth_flow_failures(24) and exclude the &lsquo;recovered&rsquo; reason,
              which is a failure the user got past.
            </p>
          </Hint>
        }
      >
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>

          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>
              Crashes by severity, 7 days
            </p>
            {m.health.by_severity_7d.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nothing in the last 7 days.</p>
            ) : m.health.by_severity_7d.map(s => {
              const tone = SEVERITY_TONE[s.severity] ?? SEVERITY_TONE.unknown;
              return (
                <Row
                  key={s.severity}
                  label={`${tone.label} · ${int(s.occurrences)} occurrence${s.occurrences === 1 ? '' : 's'}`}
                  value={`${int(s.alerts)} issue${s.alerts === 1 ? '' : 's'}`}
                  tone={tone.fg}
                />
              );
            })}

            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '16px 0 7px' }}>
              Top crash fingerprints, 7 days
            </p>
            {!lists ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>Loading…</p>
            ) : lists.top_crashes.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nothing in the last 7 days.</p>
            ) : (
              <div className="flex flex-col" style={{ gap: 5 }}>
                {lists.top_crashes.slice(0, 6).map(c => {
                  const tone = SEVERITY_TONE[c.severity ?? 'unknown'] ?? SEVERITY_TONE.unknown;
                  return (
                    <div key={c.fingerprint} style={{ padding: '7px 11px', borderRadius: 12, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: tone.fg, flexShrink: 0 }}>
                          {tone.label.toUpperCase()}
                        </span>
                        <span className="truncate flex-1 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.ink }} title={c.message ?? c.fingerprint}>
                          {c.message || c.fingerprint}
                        </span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, flexShrink: 0, ...NUM }}>{int(c.occurrences)}</span>
                      </div>
                      <p className="truncate" style={{ fontFamily: MONO, fontSize: 10, color: NEU.inkSoft, marginTop: 2 }} title={c.url ?? ''}>
                        {c.url || 'no url'} · last {ago(c.last_seen)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>
              Auth and email
            </p>
            <Row label="Auth dead ends, 24h" value={int(m.health.auth.dead_ends_24h)} tone={m.health.auth.dead_ends_24h ? RED : undefined} />
            <Row label="Had a session anyway, 24h" value={int(m.health.auth.had_session_24h)} />
            <Row label="Accounts genuinely locked out" value={int(m.health.unconfirmed.stuck)} tone={m.health.unconfirmed.stuck ? NEU.deepGold : undefined} />
            <Row label="Signed up again and got in" value={`${int(m.health.unconfirmed.signed_up_again)} of ${int(m.health.unconfirmed.raw)}`} />
            <Row label="Outbox backlog" value={int(m.health.email.outbox_pending)} tone={m.health.email.outbox_pending ? NEU.deepGold : undefined} />
            <Row label="Sent / failed in 24h" value={`${int(m.health.email.sent_24h)} / ${int(m.health.email.failed_24h)}`} />

            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '16px 0 7px' }}>
              Email failures, all time, by reason
            </p>
            {m.health.email.failures.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No failures on record.</p>
            ) : (
              <div className="flex flex-col" style={{ gap: 4 }}>
                {m.health.email.failures.map(fr => (
                  <div key={fr.reason} className="flex items-baseline gap-2.5">
                    <span className="truncate flex-1 min-w-0" style={{ fontFamily: MONO, fontSize: 10.5, color: NEU.inkSoft }} title={fr.reason}>
                      {fr.reason}
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, ...NUM }}>{int(fr.n)}</span>
                  </div>
                ))}
                <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, marginTop: 2 }}>
                  Grouped on the first 60 characters of the provider error, so long messages collapse together.
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, marginBottom: 7 }}>
              <Inbox size={12} strokeWidth={2.6} /> Inbound needing a human
            </p>
            <Row label="Contact enquiries, 7d / all time" value={`${int(m.health.inbound.contact_7d)} / ${int(m.health.inbound.contact)}`} />
            <Row label="Ambassador applications, 7d / all" value={`${int(m.health.inbound.ambassador_7d)} / ${int(m.health.inbound.ambassador)}`} />
            <Row label="Open conference requests" value={int(m.health.inbound.requests_open)} />
            <Row label="Of those, unseen by the organiser" value={int(m.health.inbound.requests_unseen)} tone={m.health.inbound.requests_unseen ? NEU.deepGold : undefined} />

            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '16px 0 7px' }}>
              Latest in
            </p>
            {!lists ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>Loading…</p>
            ) : (
              <div className="flex flex-col" style={{ gap: 4 }}>
                {lists.recent_enquiries.slice(0, 6).map((e, i) => (
                  <div key={`${e.kind}-${e.at}-${i}`} className="flex items-baseline gap-2">
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: NEU.deepGold, width: 74, flexShrink: 0 }}>
                      {(e.kind === 'conference_request' ? 'request' : e.kind).toUpperCase()}
                    </span>
                    <span className="truncate flex-1 min-w-0" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.ink }} title={e.subject ?? ''}>
                      {e.subject || 'No subject'}
                    </span>
                    <span className="truncate hidden lg:inline" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, maxWidth: 110 }}>
                      {e.name}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: NEU.muted, flexShrink: 0, ...NUM }}>{ago(e.at)}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEU.inkSoft, margin: '16px 0 7px' }}>
              <MailWarning size={12} strokeWidth={2.6} /> Mail that did not arrive
            </p>
            {!lists ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>Loading…</p>
            ) : lists.recent_errors.length === 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nothing failed.</p>
            ) : (
              <div className="flex flex-col" style={{ gap: 4 }}>
                {lists.recent_errors.slice(0, 5).map(er => (
                  <div key={er.id} className="flex items-baseline gap-2">
                    <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.ink, maxWidth: 130, flexShrink: 0 }} title={er.recipient ?? ''}>
                      {er.recipient || 'no recipient'}
                    </span>
                    <span className="truncate flex-1 min-w-0" style={{ fontFamily: MONO, fontSize: 10, color: NEU.inkSoft }} title={er.error ?? ''}>
                      {er.error || er.subject || '—'}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: NEU.muted, flexShrink: 0, ...NUM }}>{ago(er.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Footnote. Everything on this page is one read of two functions. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, paddingBottom: 8 }}>
        <Clock size={12} />
        <span>
          One read of admin_platform_metrics({m.window_days}) at{' '}
          <span style={NUM}>{new Date(m.generated_at).toLocaleString('en-GB')}</span>, plus one read of
          admin_data_lists(20) on load. Refresh re-polls the aggregate only.
        </span>
        <KeyRound size={12} />
        <span>Both are gated on is_platform_admin() in the database, not in this component.</span>
      </p>
    </div>
  );
}
