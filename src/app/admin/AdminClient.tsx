'use client';

// Gavelling staff console — four tabs over the whole platform.
//
// SECURITY: this component holds no access logic worth trusting. The gate is
// admin_conference_overview(), a SECURITY DEFINER function that raises
// 'not authorised' unless is_platform_admin(). A non-staff visitor who loads
// this page gets an error from the database and sees the same "nothing here"
// screen as a logged-out one — the route being reachable leaks nothing. The tab
// shell renders only AFTER that RPC has succeeded, so an outsider never even
// sees the tabs; each sibling tab still owns (and must keep) its own DB-side
// gate, because a UI that never renders is not a permission.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Building2, Radio, ShieldCheck, Users } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, OUTFIT, EASE, NEU_GRADIENTS, NeuIconDisc } from '@/components/neu';
import ConferencesTab, { type AdminConferenceRow } from './ConferencesTab';

// ── Sibling tabs. Each is self-contained: no required props, fetches its own
// data, owns its own loading/empty/denied states. Built concurrently by other
// agents; if any of these three modules is missing the build fails on the
// import alone, which is expected until they land.
import UsersTab from './UsersTab';
import ActivityTab from './ActivityTab';
import LiveCommitteesTab from './LiveCommitteesTab';

// Shared branded spinner (Gavelling green), built by a sibling agent.
import Loader from '@/components/Loader';

const MONO = 'ui-monospace, monospace';

type TabKey = 'conferences' | 'users' | 'activity' | 'live';

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: 'conferences', label: 'Conferences', icon: Building2 },
  { key: 'users',       label: 'Users',       icon: Users },
  { key: 'activity',    label: 'Activity',    icon: Activity },
  { key: 'live',        label: 'Live',        icon: Radio },
];

export default function AdminClient() {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AdminConferenceRow[] | null>(null);
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<TabKey>('conferences');

  const load = useCallback(async () => {
    if (!session) { setDenied(true); return; }
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('admin_conference_overview');
    if (error) { setDenied(true); return; }
    setRows((data ?? []) as AdminConferenceRow[]);

    // Logos and organiser avatars are not part of admin_conference_overview()'s
    // return type, so they come from two follow-up reads. NEITHER widens the
    // staff gate:
    //   • `conferences` already has a public SELECT policy ("Anyone can read
    //     conferences by link") — the anon key could fetch this already.
    //   • `profiles` is read under the EXISTING "Organizers read co-organizer
    //     profiles" policy, which passes here only because
    //     is_conference_organizer() short-circuits on is_platform_admin(). A
    //     non-staff caller gets zero rows from RLS, and never reaches this code
    //     at all because the RPC above already failed.
    // Either read failing is harmless: rows fall back to monogram / initials.
    const { data: confRows } = await supabase.from('conferences').select('id, logo_url, organizer_id');
    if (!confRows) return;

    const logoMap: Record<string, string | null> = {};
    const organizerOf: Record<string, string | null> = {};
    for (const c of confRows as { id: string; logo_url: string | null; organizer_id: string | null }[]) {
      logoMap[c.id] = c.logo_url;
      organizerOf[c.id] = c.organizer_id;
    }
    setLogos(logoMap);

    const organizerIds = Array.from(new Set(Object.values(organizerOf).filter((x): x is string => !!x)));
    if (organizerIds.length === 0) return;
    const { data: profileRows } = await supabase.from('profiles').select('id, avatar_url').in('id', organizerIds);
    if (!profileRows) return;

    const avatarOfUser = new Map((profileRows as { id: string; avatar_url: string | null }[]).map(p => [p.id, p.avatar_url]));
    const byConference: Record<string, string | null> = {};
    for (const [confId, userId] of Object.entries(organizerOf)) {
      byConference[confId] = userId ? avatarOfUser.get(userId) ?? null : null;
    }
    setAvatars(byConference);
  }, [session]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  const counts = useMemo(() => ({ conferences: rows?.length ?? 0 }), [rows]);

  if (authLoading || (!rows && !denied)) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: NEU.base }}>
        <SiteNav />
        <div className="flex justify-center" style={{ padding: '96px 0' }}>
          <Loader size={40} />
        </div>
      </div>
    );
  }

  // Deliberately bland and identical for "logged out", "not staff" and "RPC
  // failed" — it should not confirm that a staff view exists here.
  if (denied || !rows) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: NEU.base }}>
        <SiteNav />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '60vh' }}>
          <h1 className="font-black text-xl" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Nothing here</h1>
          <p className="mt-2 text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            This page isn&apos;t available for your account.
          </p>
          <Link href="/" className="mt-6 text-sm font-bold" style={{ color: NEU.forest, fontFamily: OUTFIT }}>
            Back to Gavelling →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: NEU.base }}>
      <SiteNav />
      <main className="mx-auto w-full max-w-7xl px-5 md:px-8 py-9">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={ShieldCheck} emoji="Shield" size={46} />
          <div>
            <p className="flex items-center gap-1.5 mb-0.5" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em', color: NEU.deepGold, fontWeight: 700 }}>
              GAVELLING STAFF
            </p>
            <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 27, color: NEU.ink, letterSpacing: '-0.02em' }}>
              Platform console
            </h1>
          </div>
        </div>

        {/* Tab bar — a pressed-in track holding four extruded pills. Arrow keys
            move between tabs (roving tabindex), matching the ARIA tabs pattern. */}
        <div
          role="tablist"
          aria-label="Staff console sections"
          className="inline-flex items-center gap-1 mb-6 flex-wrap"
          style={{ padding: 5, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
        >
          {TABS.map((t, i) => {
            const on = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                role="tab"
                id={`admin-tab-${t.key}`}
                aria-selected={on}
                aria-controls={`admin-panel-${t.key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                  e.preventDefault();
                  const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                  setTab(next.key);
                  document.getElementById(`admin-tab-${next.key}`)?.focus();
                }}
                className="inline-flex items-center gap-2 focus:outline-none"
                style={{
                  padding: '9px 17px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: on ? NEU.gold : NEU.ink,
                  background: on ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : 'transparent',
                  boxShadow: on ? `0 4px 12px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}` : 'none',
                  transition: `box-shadow 240ms ${EASE}, color 240ms ${EASE}, background 240ms ${EASE}`,
                }}
              >
                <Icon size={14} strokeWidth={2.5} style={{ color: on ? NEU.gold : NEU.deepGold }} />
                {t.label}
                {t.key === 'conferences' && (
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
                      fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                      color: on ? NEU.forest : '#FFFFFF',
                      backgroundColor: on ? NEU.gold : NEU.forest,
                    }}
                  >
                    {counts.conferences}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Panels. Only the selected tab mounts, so a sibling tab never fetches
            until a staff member actually opens it. */}
        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
          {tab === 'conferences' && <ConferencesTab rows={rows} logos={logos} avatars={avatars} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'activity' && <ActivityTab />}
          {tab === 'live' && <LiveCommitteesTab />}
        </div>
      </main>
    </div>
  );
}
