'use client';

// Staff activity feed. Everything that happened on the platform, newest first,
// one row per event, grouped by day.
//
// THERE IS NO AUDIT TABLE. Verified against the live schema: no audit_log, no
// events, no activity table of any kind exists. So this feed is a UNION over the
// real tables, keyed on whatever timestamp each of them actually records. That
// has two consequences worth knowing before trusting a row:
//   • only events that left a timestamped row can appear at all, and
//   • a few kinds are APPROXIMATIONS — see the "how complete is this" hint in
//     the header, and APPROXIMATE_KINDS below.
//
// SECURITY: admin_activity_feed() is SECURITY DEFINER and raises 'not
// authorised' unless is_platform_admin(), exactly like admin_conference_overview.
//
// PAGINATION: keyset, not offset. The cursor is the last row's
// (occurred_at, event_id) pair — the feed grows without bound and must never be
// loaded whole.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus, CalendarPlus, Globe, Layers, FileText, RotateCcw, Gavel, LogIn,
  Wallet, MessageSquare, Star, Award, Megaphone, Mail, Info, ArrowUpRight,
} from 'lucide-react';
// The local `Avatar` that used to live here was byte-for-byte the shared one
// (same 0.34 radius, same 10%-forest disc, same 0.44 letter), so it is gone and
// this imports the real component instead. src/components/Avatar.tsx exists
// precisely to stop that copy being written a sixth time.
import Avatar from '@/components/Avatar';
import Portal from '@/components/Portal';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

const OUTFIT = "'Outfit', sans-serif";
const MONO = 'ui-monospace, monospace';
const INK = '#1C1410';
const MUTED = '#9A8A78';
const FOREST = '#1B3828';
const GOLD = '#B6871F';
const GREEN = '#3D7A52';
const RED = '#8B2020';
const PANEL = '#FAF8F3';
const LINE = '#DDD4C0';
const PAGE = '#EDE7D8';

const PAGE_SIZE = 60;

interface Event {
  event_id: string;
  occurred_at: string;
  kind: string;
  actor_id: string | null;
  actor_name: string;
  actor_avatar: string | null;
  subject: string;
  detail: string;
  link_href: string | null;
}

type LucideGlyph = React.ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>;

interface KindDef { key: string; label: string; icon: LucideGlyph; fg: string; bg: string }

// Order here is the order of the filter pills. Grouped: people, conferences,
// applications, money, inbound.
const KINDS: KindDef[] = [
  { key: 'signup', label: 'Sign-ups', icon: UserPlus, fg: FOREST, bg: 'rgba(27,56,40,0.09)' },
  { key: 'cv_entry', label: 'CV entries', icon: Award, fg: FOREST, bg: 'rgba(27,56,40,0.09)' },
  { key: 'conference_created', label: 'Conference created', icon: CalendarPlus, fg: GOLD, bg: 'rgba(182,135,31,0.14)' },
  { key: 'conference_published', label: 'Published', icon: Globe, fg: GREEN, bg: 'rgba(61,122,82,0.12)' },
  { key: 'committee_added', label: 'Committee added', icon: Layers, fg: GOLD, bg: 'rgba(182,135,31,0.14)' },
  { key: 'application_submitted', label: 'Applications', icon: FileText, fg: FOREST, bg: 'rgba(27,56,40,0.09)' },
  { key: 'application_resubmitted', label: 'Resubmitted', icon: RotateCcw, fg: GOLD, bg: 'rgba(182,135,31,0.14)' },
  { key: 'application_decision', label: 'Decisions', icon: Gavel, fg: GREEN, bg: 'rgba(61,122,82,0.12)' },
  { key: 'application_checkin', label: 'Check-ins', icon: LogIn, fg: GREEN, bg: 'rgba(61,122,82,0.12)' },
  { key: 'payment', label: 'Payments', icon: Wallet, fg: GREEN, bg: 'rgba(61,122,82,0.12)' },
  { key: 'conference_request', label: 'Participant requests', icon: MessageSquare, fg: FOREST, bg: 'rgba(27,56,40,0.09)' },
  { key: 'review', label: 'Reviews', icon: Star, fg: GOLD, bg: 'rgba(182,135,31,0.14)' },
  { key: 'enquiry', label: 'Enquiries', icon: Mail, fg: RED, bg: 'rgba(139,32,32,0.10)' },
  { key: 'ambassador', label: 'Ambassador applications', icon: Megaphone, fg: RED, bg: 'rgba(139,32,32,0.10)' },
];

const KIND_BY_KEY: Record<string, KindDef> = Object.fromEntries(KINDS.map(k => [k.key, k]));

/** Kinds whose timestamp is the best available proxy, not the moment the thing
 *  actually happened. Surfaced honestly in the UI rather than quietly fudged. */
const APPROXIMATE_KINDS = new Set(['application_decision', 'committee_added']);

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Read-only explainer, opens on HOVER (and focus) per the UI rules, portaled
 *  at fixed coordinates so nothing can clip it. */
function CoverageHint() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 330;
    const left = Math.min(Math.max(8, r.left - 8), window.innerWidth - w - 8);
    const below = window.innerHeight - r.bottom > 250;
    setPos({ top: below ? r.bottom + 8 : Math.max(8, r.top - 250), left });
  }, []);

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
        aria-label="How complete is this feed"
        className="inline-flex items-center gap-1 focus:outline-none"
        style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: MUTED, cursor: 'help' }}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      >
        <Info size={12} /> How complete is this?
      </span>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show} onMouseLeave={hide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 330,
              backgroundColor: PANEL, border: `1px solid ${LINE}`, borderRadius: 14,
              padding: '13px 15px', boxShadow: '0 10px 30px rgba(27,56,40,0.18)',
              fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.55, color: INK,
            }}
          >
            <p style={{ fontWeight: 800, marginBottom: 6 }}>There is no audit log.</p>
            <p style={{ color: MUTED }}>
              This feed is reconstructed from timestamps on the real tables, so it can only
              show events that left a dated row.
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Exact:</strong> sign-ups, applications, resubmissions, check-ins,
              payments, conferences created and published, enquiries, ambassador
              applications, participant requests, reviews, CV entries.
            </p>
            <p style={{ marginTop: 6 }}>
              <strong>Approximate:</strong> decisions (accepted / rejected / withdrawn) carry
              the row&apos;s last-updated time, not the moment of the decision, and only the
              current status is knowable — earlier decisions on the same application are
              lost. Set-up progress is represented by committees being added, conferences
              created and published; the other set-up steps are computed state, never events.
            </p>
            <p style={{ marginTop: 6, color: MUTED }}>Rows marked ~ use an approximate time.</p>
          </div>
        </Portal>
      )}
    </>
  );
}

export default function ActivityTab() {
  const { session, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());

  const load = useCallback(async (cursor: { at: string; id: string } | null) => {
    if (!session) { setError('Not signed in.'); setEvents([]); return; }
    if (cursor) setMore(true); else setLoading(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);
    const { data, error: e } = await supabase.rpc('admin_activity_feed', {
      p_kinds: active.size ? Array.from(active) : null,
      p_before: cursor?.at ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: PAGE_SIZE,
    });
    setLoading(false);
    setMore(false);
    if (e) {
      // 'not authorised' → not staff. Anything else (most likely the RPC not
      // being deployed yet) is shown verbatim rather than silently blanking.
      setError(e.message);
      if (!cursor) setEvents([]);
      return;
    }
    const page = (data ?? []) as Event[];
    setDone(page.length < PAGE_SIZE);
    setEvents(prev => (cursor && prev ? [...prev, ...page] : page));
  }, [session, active]);

  useEffect(() => {
    if (authLoading) return;
    setDone(false);
    void load(null);
  }, [authLoading, load]);

  function toggle(key: string) {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const last = events && events.length > 0 ? events[events.length - 1] : null;

  // Day buckets, computed inline so appended pages keep their grouping.
  const groups: { key: string; label: string; rows: Event[] }[] = [];
  for (const ev of events ?? []) {
    const k = dayKey(ev.occurred_at);
    const tail = groups[groups.length - 1];
    if (tail && tail.key === k) tail.rows.push(ev);
    else groups.push({ key: k, label: dayLabel(ev.occurred_at), rows: [ev] });
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <button
          onClick={() => setActive(new Set())}
          className="rounded-full px-3.5 py-2 focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', cursor: 'pointer',
            backgroundColor: active.size === 0 ? FOREST : 'transparent',
            color: active.size === 0 ? '#EED98A' : '#6B5F52',
            border: active.size === 0 ? 'none' : `1px solid ${LINE}`,
          }}
        >
          Everything
        </button>
        {KINDS.map(k => {
          const on = active.has(k.key);
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              onClick={() => toggle(k.key)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                backgroundColor: on ? k.bg : 'transparent',
                color: on ? k.fg : '#6B5F52',
                border: `1px solid ${on ? k.fg : LINE}`,
              }}
            >
              <Icon size={12} strokeWidth={2.3} style={{ color: on ? k.fg : MUTED }} />
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end mb-3">
        <CoverageHint />
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Loader /></div>}

      {!loading && error && (
        <div className="rounded-2xl px-4 py-5 text-center" style={{ backgroundColor: PANEL, border: '1px solid rgba(139,32,32,0.3)' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: RED }}>Could not load activity.</p>
          <p className="mt-1" style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{error}</p>
        </div>
      )}

      {!loading && !error && events && events.length === 0 && (
        <p className="text-sm py-12 text-center" style={{ color: MUTED, fontFamily: OUTFIT }}>
          {active.size ? 'Nothing of that kind yet.' : 'Nothing has happened yet.'}
        </p>
      )}

      {!loading && !error && groups.map(g => (
        <div key={g.key} className="mb-4">
          <div className="flex items-center gap-2.5 mb-1.5 px-1">
            <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: MUTED }}>
              {g.label.toUpperCase()}
            </p>
            <span style={{ flex: 1, height: 1, backgroundColor: LINE }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{g.rows.length}</span>
          </div>

          <div className="flex flex-col gap-1">
            {g.rows.map(ev => {
              const def = KIND_BY_KEY[ev.kind];
              const Icon = def?.icon ?? FileText;
              const approx = APPROXIMATE_KINDS.has(ev.kind);
              const row = (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                     style={{ backgroundColor: PANEL, border: `1px solid ${LINE}` }}>
                  <span style={{ width: 46, flexShrink: 0, fontFamily: MONO, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}
                        title={approx ? 'Approximate time — see "How complete is this?"' : new Date(ev.occurred_at).toLocaleString('en-GB')}>
                    {approx ? '~' : ''}{fmtTime(ev.occurred_at)}
                  </span>

                  <span className="inline-flex items-center justify-center flex-shrink-0"
                        style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: def?.bg ?? PAGE }}>
                    <Icon size={12} strokeWidth={2.4} style={{ color: def?.fg ?? MUTED }} />
                  </span>

                  <Avatar url={ev.actor_avatar} name={ev.actor_name} />

                  <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK, maxWidth: 190 }}>
                    {ev.actor_name}
                  </span>

                  <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: MUTED }}>
                    {def?.label ?? ev.kind}
                  </span>

                  <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: INK, maxWidth: 210 }}>
                    {ev.subject}
                  </span>

                  <span className="truncate flex-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: MUTED, minWidth: 0 }}>
                    {ev.detail}
                  </span>

                  {ev.link_href && <ArrowUpRight size={13} style={{ color: MUTED, flexShrink: 0 }} />}
                </div>
              );
              return ev.link_href ? (
                <Link key={ev.event_id} href={ev.link_href} style={{ textDecoration: 'none' }}>{row}</Link>
              ) : (
                <div key={ev.event_id}>{row}</div>
              );
            })}
          </div>
        </div>
      ))}

      {!loading && !error && events && events.length > 0 && (
        done ? (
          <p className="text-center py-4" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: MUTED }}>
            That is the beginning of the record.
          </p>
        ) : (
          <button
            onClick={() => last && load({ at: last.occurred_at, id: last.event_id })}
            disabled={more}
            className="w-full rounded-2xl py-3 focus:outline-none"
            style={{ backgroundColor: 'transparent', border: `1px solid ${LINE}`, color: FOREST, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, cursor: more ? 'default' : 'pointer' }}
          >
            {more ? 'LOADING…' : 'LOAD OLDER'}
          </button>
        )
      )}
    </div>
  );
}
