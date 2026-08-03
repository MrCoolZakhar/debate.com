'use client';

// Gavelling staff overview — every conference, published or draft, with how far
// through set-up it is.
//
// SECURITY: this component holds no access logic worth trusting. The gate is
// admin_conference_overview(), a SECURITY DEFINER function that raises
// 'not authorised' unless is_platform_admin(). A non-staff visitor who loads
// this page gets an error from the database and sees the same "nothing here"
// screen as a logged-out one — the route being reachable leaks nothing.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, ShieldCheck } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

const OUTFIT = "'Outfit', sans-serif";
const MONO = 'ui-monospace, monospace';
const INK = '#1C1410';
const MUTED = '#9A8A78';
const FOREST = '#1B3828';
const GOLD = '#B6871F';
const PANEL = '#FAF8F3';
const LINE = '#DDD4C0';

interface Row {
  id: string; slug: string; acronym: string | null; full_name: string;
  is_public: boolean; status: string; dates_tbd: boolean;
  start_date: string | null; end_date: string | null; city: string | null; country: string | null;
  expected_delegates: number; seat_capacity: number;
  setup_done: number; setup_total: number; setup_complete: boolean;
  pending_keys: string[];
  committees: number; chairs_missing: number; applications: number; paid_applications: number;
  organizer_name: string | null; organizer_email: string | null;
  created_at: string; updated_at: string; last_nudge_at: string | null;
}

const KEY_LABEL: Record<string, string> = {
  page: 'page', committees: 'committees', chairs: 'chairs', email: 'email',
  secretariat: 'secretariat', financials: 'financials', delegate: 'first delegate', publish: 'publish',
};

type Tab = 'drafts' | 'ready' | 'published' | 'all';

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function AdminClient() {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>('drafts');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!session) { setDenied(true); return; }
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('admin_conference_overview');
    if (error) { setDenied(true); return; }
    setRows((data ?? []) as Row[]);
  }, [session]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  const stats = useMemo(() => {
    const r = rows ?? [];
    return {
      total: r.length,
      drafts: r.filter(x => !x.is_public).length,
      ready: r.filter(x => !x.is_public && x.setup_complete).length,
      published: r.filter(x => x.is_public).length,
      stalled: r.filter(x => !x.is_public && (daysSince(x.updated_at) ?? 0) > 14).length,
      underCapacity: r.filter(x => x.expected_delegates > 0 && x.seat_capacity < x.expected_delegates).length,
    };
  }, [rows]);

  const shown = useMemo(() => {
    let r = rows ?? [];
    if (tab === 'drafts') r = r.filter(x => !x.is_public);
    else if (tab === 'ready') r = r.filter(x => !x.is_public && x.setup_complete);
    else if (tab === 'published') r = r.filter(x => x.is_public);
    const s = q.trim().toLowerCase();
    if (s) {
      r = r.filter(x =>
        (x.acronym ?? '').toLowerCase().includes(s) ||
        x.full_name.toLowerCase().includes(s) ||
        (x.organizer_name ?? '').toLowerCase().includes(s) ||
        (x.organizer_email ?? '').toLowerCase().includes(s) ||
        (x.city ?? '').toLowerCase().includes(s) ||
        (x.country ?? '').toLowerCase().includes(s));
    }
    return r;
  }, [rows, tab, q]);

  if (authLoading || (!rows && !denied)) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }}>
        <SiteNav />
        <p className="text-center py-24 text-sm" style={{ color: MUTED, fontFamily: OUTFIT }}>Loading…</p>
      </div>
    );
  }

  // Deliberately bland and identical for "logged out", "not staff" and "RPC
  // failed" — it should not confirm that a staff view exists here.
  if (denied) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }}>
        <SiteNav />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '60vh' }}>
          <h1 className="font-black text-xl" style={{ color: INK, fontFamily: OUTFIT }}>Nothing here</h1>
          <p className="mt-2 text-sm" style={{ color: MUTED, fontFamily: OUTFIT }}>
            This page isn&apos;t available for your account.
          </p>
          <Link href="/" className="mt-6 text-sm font-bold" style={{ color: FOREST, fontFamily: OUTFIT }}>
            Back to Gavelling →
          </Link>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; n: number }[] = [
    { key: 'drafts', label: 'Drafts', n: stats.drafts },
    { key: 'ready', label: 'Ready, unpublished', n: stats.ready },
    { key: 'published', label: 'Published', n: stats.published },
    { key: 'all', label: 'All', n: stats.total },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }}>
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} style={{ color: GOLD }} />
          <p style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em', color: GOLD, fontWeight: 700 }}>
            GAVELLING STAFF
          </p>
        </div>
        <h1 className="font-black mb-6" style={{ color: INK, fontFamily: OUTFIT, fontSize: 27, letterSpacing: '-0.02em' }}>
          Every conference
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 mb-7">
          {[
            { label: 'Total', v: stats.total },
            { label: 'Drafts', v: stats.drafts },
            { label: 'Ready, unpublished', v: stats.ready, accent: stats.ready > 0 },
            { label: 'Published', v: stats.published },
            { label: 'Stalled 14d+', v: stats.stalled, warn: stats.stalled > 0 },
            { label: 'Under capacity', v: stats.underCapacity, warn: stats.underCapacity > 0 },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-4 py-3" style={{ backgroundColor: PANEL, border: `1px solid ${LINE}` }}>
              <p style={{ fontFamily: OUTFIT, fontSize: 22, fontWeight: 900, color: s.warn ? '#8B2020' : s.accent ? FOREST : INK, fontVariantNumeric: 'tabular-nums' }}>
                {s.v}
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: MUTED, letterSpacing: '0.02em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="rounded-full px-3.5 py-2 focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', cursor: 'pointer',
                backgroundColor: tab === t.key ? FOREST : 'transparent',
                color: tab === t.key ? '#EED98A' : '#6B5F52',
                border: tab === t.key ? 'none' : `1px solid ${LINE}`,
              }}
            >
              {t.label} · {t.n}
            </button>
          ))}
          <span className="flex items-center gap-2 rounded-full px-3 py-2 ml-auto"
                style={{ backgroundColor: PANEL, border: `1px solid ${LINE}` }}>
            <Search size={13} style={{ color: MUTED }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Conference, organiser, city…"
              className="focus:outline-none"
              style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: INK, width: 210 }}
            />
          </span>
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">
          {shown.length === 0 && (
            <p className="text-sm py-10 text-center" style={{ color: MUTED, fontFamily: OUTFIT }}>Nothing matches.</p>
          )}
          {shown.map(r => {
            const idle = daysSince(r.updated_at);
            const short = r.expected_delegates > 0 && r.seat_capacity < r.expected_delegates;
            const pct = Math.round((r.setup_done / Math.max(r.setup_total, 1)) * 100);
            return (
              <div key={r.id} className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: PANEL, border: `1px solid ${LINE}` }}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0" style={{ minWidth: 220 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black" style={{ color: INK, fontFamily: OUTFIT, fontSize: 15 }}>
                        {r.acronym || r.full_name}
                      </span>
                      {r.is_public
                        ? <Chip text="PUBLISHED" bg="rgba(61,122,82,0.12)" fg="#3D7A52" />
                        : r.setup_complete
                          ? <Chip text="READY — NOT LIVE" bg="rgba(182,135,31,0.14)" fg={GOLD} />
                          : <Chip text="DRAFT" bg="rgba(154,138,120,0.14)" fg={MUTED} />}
                      {r.dates_tbd && <Chip text="DATES TBD" bg="rgba(27,56,40,0.08)" fg={FOREST} />}
                      {short && <Chip text={`${r.seat_capacity}/${r.expected_delegates} SEATS`} bg="rgba(139,32,32,0.10)" fg="#8B2020" />}
                    </div>
                    <p className="mt-1 truncate" style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 12 }}>
                      {r.full_name}
                      {(r.city || r.country) && ` · ${[r.city, r.country].filter(Boolean).join(', ')}`}
                    </p>
                    <p className="mt-0.5 truncate" style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 11.5 }}>
                      {r.organizer_name || 'Unknown organiser'}
                      {r.organizer_email && ` · ${r.organizer_email}`}
                      {idle !== null && ` · touched ${idle}d ago`}
                      {r.last_nudge_at && ` · nudged ${daysSince(r.last_nudge_at)}d ago`}
                    </p>
                  </div>

                  {/* Progress */}
                  <div style={{ width: 168 }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>SET-UP</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: r.setup_complete ? '#3D7A52' : INK, fontVariantNumeric: 'tabular-nums' }}>
                        {r.setup_done}/{r.setup_total}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.10)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: r.setup_complete ? '#3D7A52' : GOLD }} />
                    </div>
                    <p className="mt-1.5 leading-snug" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: MUTED }}>
                      {r.pending_keys.length === 0
                        ? 'Everything done.'
                        : `Left: ${r.pending_keys.map(k => KEY_LABEL[k] ?? k).join(', ')}`}
                    </p>
                  </div>

                  {/* Counts + links */}
                  <div className="flex flex-col items-end gap-1.5" style={{ minWidth: 132 }}>
                    <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                      {r.committees} cttee · {r.applications} apps · {r.paid_applications} paid
                    </p>
                    <div className="flex items-center gap-2">
                      <Link href={`/manage/${r.slug}`} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5"
                            style={{ backgroundColor: FOREST, color: '#EED98A', fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, textDecoration: 'none' }}>
                        Dashboard
                      </Link>
                      <Link href={`/conferences/${r.slug}`} className="inline-flex items-center gap-1"
                            style={{ color: FOREST, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, textDecoration: 'none' }}>
                        Page <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
      color: fg, backgroundColor: bg, padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}
