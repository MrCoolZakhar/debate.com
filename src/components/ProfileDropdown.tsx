'use client';

/**
 * ProfileDropdown, the shared account menu used by SiteNav and the
 * organiser (/manage) top bar.
 *
 * Owns the whole dropdown behaviour: hover-open with a ~200ms grace timer
 * (desktop pointer only, touch stays click-toggle), click-outside close,
 * the kokonutui-style panel (header, menu rows, lazily fetched
 * "YOUR CONFERENCES" section, sign out). Callers only supply the trigger
 * visual via a render prop, so each surface keeps its own trigger styling.
 *
 * DRAFTS LIVE INSIDE "YOUR CONFERENCES", AT THE TOP
 * A half-finished application used to be one aggregate "DRAFTS TO COMPLETE"
 * menu row, sitting nowhere near the conferences it was about. It is now the
 * first entry (or entries) of the same list — because a draft is a conference
 * you are in the middle of, and the list is where you look for one.
 *
 * They must NOT read as attendance. An accepted conference row is a plain
 * ivory row ending in its ROLE; a draft row is gold-washed, carries a
 * FileClock instead of a role, and is labelled UNFINISHED. Clicking one
 * resumes the wizard rather than opening the conference page.
 */

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { compareStartDate } from '@/lib/conferenceDates';
import { User, FileText, FileClock, CalendarDays, Sparkles, Coins, LogOut, ArrowRight } from 'lucide-react';
import Portal from '@/components/Portal';
import { useDraftCount, draftResumeHref } from '@/hooks/useDraftCount';

/** One row in the dropdown's "YOUR CONFERENCES" section. */
interface NavConference {
  id: string;
  slug: string;
  acronym: string;
  logo_url: string | null;
  start_date: string;
  role: 'DELEGATE' | 'CHAIR' | 'ORGANIZER';
}

/** Supabase joins come back as object or array depending on cardinality. */
function firstRow<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface ProfileDropdownProps {
  /** Trigger visual, rendered inside the hover/click zone. */
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  /** Extra styles merged onto the panel (e.g. z-index above a fixed top bar). */
  panelStyle?: React.CSSProperties;
}

export default function ProfileDropdown({ trigger, panelStyle }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PANEL_W = 280;
  // The panel is portaled at fixed viewport coords (computed from the trigger)
  // so it renders ABOVE every page's stacking context and can never slide under
  // sticky bars or transformed cards. Right-aligned to the trigger, clamped.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const place = useCallback(() => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    let left = r.right - PANEL_W;
    if (left + PANEL_W > window.innerWidth - 8) left = window.innerWidth - 8 - PANEL_W;
    if (left < 8) left = 8;
    setPos({ top: r.bottom + 8, left });
  }, []);

  // "Your conferences" section, fetched lazily the first time the menu opens.
  const [myConfs, setMyConfs] = useState<NavConference[] | null>(null);
  const [confsLoading, setConfsLoading] = useState(false);
  const confsFetched = useRef(false);

  const { user, profile, session, signOut } = useAuth();

  // Half-finished applications. Fetched lazily on first open, exactly like the
  // conference list below; they are omitted entirely when there are none.
  const { count: draftCount, drafts } = useDraftCount(open);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return; // clicks inside the portaled panel
      setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Reposition the portaled panel while open (scroll / resize).
  useEffect(() => {
    if (!open) return;
    place();
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, place]);

  // Clear any pending hover-close timer on unmount.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Reset the cached conference list when the signed-in user changes.
  useEffect(() => {
    confsFetched.current = false;
    setMyConfs(null);
    setConfsLoading(false);
  }, [user?.id]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // Hover-open (desktop pointer only, touch keeps pure click-toggle behaviour).
  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  // ~200ms grace so the cursor can travel from the trigger into the panel.
  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, [cancelClose]);

  const toggle = useCallback(() => {
    cancelClose();
    setOpen((v) => !v);
  }, [cancelClose]);

  // Batched fetch of the user's conferences the first time the menu opens:
  // accepted/assigned/checked-in applications + organizer memberships + owned
  // conferences, merged per conference (organizer wins), soonest first.
  useEffect(() => {
    if (!open || confsFetched.current) return;
    if (!user || !session) return;
    confsFetched.current = true;
    setConfsLoading(true);

    const userId = user.id;
    const supabase = getAuthedClient(session.access_token);
    const CONF = 'id, slug, acronym, logo_url, start_date';

    (async () => {
      try {
        const [appsRes, orgRes, ownedRes] = await Promise.all([
          supabase
            .from('applications')
            .select(`role, conferences (${CONF})`)
            .eq('user_id', userId)
            .in('status', ['accepted', 'assigned', 'checked-in']),
          supabase
            .from('conference_organizers')
            .select(`conferences (${CONF})`)
            .eq('user_id', userId),
          supabase
            .from('conferences')
            .select(CONF)
            .eq('organizer_id', userId),
        ]);

        type ConfRow = { id: string; slug: string; acronym: string; logo_url: string | null; start_date: string };
        const byId = new Map<string, NavConference>();
        const add = (conf: ConfRow | null, role: NavConference['role']) => {
          if (!conf) return;
          const existing = byId.get(conf.id);
          if (existing) {
            // Organizer trumps attendee roles (row links to /manage).
            if (role === 'ORGANIZER') existing.role = 'ORGANIZER';
            return;
          }
          byId.set(conf.id, { id: conf.id, slug: conf.slug, acronym: conf.acronym, logo_url: conf.logo_url, start_date: conf.start_date, role });
        };

        for (const row of (appsRes.data ?? []) as { role: string; conferences: ConfRow | ConfRow[] | null }[]) {
          add(firstRow(row.conferences), row.role === 'chair' ? 'CHAIR' : 'DELEGATE');
        }
        for (const row of (orgRes.data ?? []) as { conferences: ConfRow | ConfRow[] | null }[]) {
          add(firstRow(row.conferences), 'ORGANIZER');
        }
        for (const conf of (ownedRes.data ?? []) as ConfRow[]) {
          add(conf, 'ORGANIZER');
        }

        const list = Array.from(byId.values()).sort((a, b) => compareStartDate(a.start_date, b.start_date));
        setMyConfs(list);
      } catch {
        setMyConfs([]);
      } finally {
        setConfsLoading(false);
      }
    })();
  }, [open, user, session]);

  const avatarInitial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    window.location.href = '/';
  }

  if (!user) return null;

  return (
    <div
      className="relative"
      ref={rootRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {trigger(open, toggle)}

      {/* Dropdown, kokonutui profile-dropdown anatomy in house style. Portaled
          at fixed coords with z-index 9999 so it always renders over sticky bars
          / transformed cards, on every page. */}
      {open && pos && (
        <Portal>
        <div
          ref={panelRef}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          style={{
            ...panelStyle,
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: PANEL_W,
            backgroundColor: '#FAF8F3',
            border: '1px solid #DDD4C0',
            borderRadius: '16px',
            boxShadow: '0 20px 48px rgba(27, 56, 40, 0.16)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'profileMenuIn 180ms ease both',
          }}
        >
          <style>{`@keyframes profileMenuIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Header, avatar + name + email */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="rounded-full object-cover shrink-0"
                style={{ width: '40px', height: '40px' }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-black shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: '#EED98A', color: '#1B3828', fontSize: '16px', fontFamily: "'Outfit', sans-serif" }}
              >
                {avatarInitial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {profile?.display_name ?? user.email?.split('@')[0]}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {profile?.email ?? user.email}
              </p>
            </div>
          </div>
          <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

          {/* Menu rows */}
          <div className="py-1">
            {([
              { label: 'MY PROFILE', href: '/account/profile', icon: User },
              { label: 'MUN CV', href: '/account/cv', icon: FileText },
              // No DRAFTS row here any more — unfinished applications are the
              // first entries of YOUR CONFERENCES below, where the conference
              // they belong to is.
              { label: 'CONFERENCE CALENDAR', href: '/account/calendar', icon: CalendarDays },
            ] as { label: string; href: string; icon: typeof User }[]).map((item) => {
              const RowIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 font-semibold transition-colors"
                  style={{
                    color: '#1C1410',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '0.05em',
                    fontSize: '12px',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <RowIcon size={15} strokeWidth={2.1} style={{ color: '#9A8A78', flexShrink: 0 }} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}

            {profile?.unlimited_status === 'none' ? (
              <Link
                href="/account/unlimited"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 font-semibold transition-colors"
                style={{
                  color: '#1B3828',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.05em',
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Sparkles size={15} strokeWidth={2.1} style={{ color: '#9A8A78', flexShrink: 0 }} />
                <span className="flex-1">UPGRADE TO UNLIMITED</span>
                <span style={{ color: '#B6871F' }}>✦</span>
              </Link>
            ) : profile ? (
              <Link
                href="/account/unlimited"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 font-semibold transition-colors"
                style={{
                  color: '#1C1410',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.05em',
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Coins size={15} strokeWidth={2.1} style={{ color: '#9A8A78', flexShrink: 0 }} />
                <span className="flex-1">CREDITS &amp; SUBSCRIPTION</span>
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#EED98A', color: '#1B3828', letterSpacing: '0.04em' }}
                >
                  ✦
                </span>
              </Link>
            ) : null}
          </div>

          {/* Your conferences, lazily fetched; omitted entirely when empty.
              Unfinished drafts head the list — see the file header. */}
          {(confsLoading || drafts.length > 0 || (myConfs !== null && myConfs.length > 0)) && (
            <>
              <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />
              <div className="pt-2.5 pb-1">
                <div className="px-4 pb-1.5 flex items-center gap-2">
                  <p
                    className="font-bold flex-1"
                    style={{ color: '#9A8A78', fontSize: '10px', letterSpacing: '0.08em', fontFamily: "'Outfit', sans-serif" }}
                  >
                    YOUR CONFERENCES
                  </p>
                  {/* The old row's count badge, kept — it just moved onto the
                      section that now holds the drafts. */}
                  {draftCount !== null && draftCount > 0 && (
                    <span
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 700,
                        fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums',
                        backgroundColor: 'rgba(182,135,31,0.16)',
                        color: '#8A6614',
                      }}
                      title={draftCount === 1 ? '1 unfinished application' : `${draftCount} unfinished applications`}
                    >
                      {draftCount}
                    </span>
                  )}
                </div>

                {/* ── Unfinished drafts, first. Gold wash + UNFINISHED tag so
                    they never read as a conference this person is going to. ── */}
                {drafts.slice(0, 3).map((d) => (
                  <Link
                    key={d.id}
                    href={draftResumeHref(d)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 transition-colors"
                    style={{ textDecoration: 'none', backgroundColor: 'rgba(182,135,31,0.08)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(182,135,31,0.17)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(182,135,31,0.08)'; }}
                    title={`Finish your ${d.acronym || d.fullName} application`}
                  >
                    <span
                      style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: '#FFFEFA', border: '0.5px solid rgba(182,135,31,0.5)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                      }}
                    >
                      {d.logoUrl ? (
                        <img
                          src={d.logoUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <FileClock size={11} strokeWidth={2.4} style={{ color: '#8A6614' }} />
                      )}
                    </span>
                    <span
                      className="flex-1 truncate font-semibold"
                      style={{ color: '#1C1410', fontSize: '12px', letterSpacing: '0.03em', fontFamily: "'Outfit', sans-serif" }}
                    >
                      {d.acronym || d.fullName}
                    </span>
                    <span
                      className="font-bold uppercase shrink-0 inline-flex items-center gap-1"
                      style={{ color: '#8A6614', fontSize: '9px', letterSpacing: '0.06em', fontFamily: "'Outfit', sans-serif" }}
                    >
                      <FileClock size={10} strokeWidth={2.6} />
                      UNFINISHED
                    </span>
                  </Link>
                ))}

                {confsLoading ? (
                  /* Skeleton rows while the batched fetch is in flight */
                  <div className="px-4 py-1 flex flex-col gap-2.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-2.5 animate-pulse">
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(27,56,40,0.08)', flexShrink: 0 }} />
                        <div style={{ height: '9px', borderRadius: '4px', backgroundColor: 'rgba(27,56,40,0.08)', width: i === 1 ? '55%' : '70%' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {(myConfs ?? []).slice(0, 5).map((conf) => (
                      <Link
                        key={conf.id}
                        href={conf.role === 'ORGANIZER' ? `/manage/${conf.slug}` : `/conferences/${conf.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 transition-colors"
                        style={{ textDecoration: 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        {/* Small round logo on a near-white disc */}
                        <span
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#FFFEFA',
                            border: '0.5px solid #E7E0CF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {conf.logo_url ? (
                            <img
                              src={conf.logo_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <span style={{ fontSize: '8px', fontWeight: 900, color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                              {conf.acronym?.[0] ?? '•'}
                            </span>
                          )}
                        </span>
                        <span
                          className="flex-1 truncate font-semibold"
                          style={{ color: '#1C1410', fontSize: '12px', letterSpacing: '0.03em', fontFamily: "'Outfit', sans-serif" }}
                        >
                          {conf.acronym} {new Date(conf.start_date + 'T00:00:00').getFullYear()}
                        </span>
                        <span
                          className="font-bold uppercase shrink-0"
                          style={{ color: '#9A8A78', fontSize: '9px', letterSpacing: '0.06em', fontFamily: "'Outfit', sans-serif" }}
                        >
                          {conf.role}
                        </span>
                      </Link>
                    ))}

                    <Link
                      href="/my-conferences"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 font-semibold transition-colors"
                      style={{ color: '#1B3828', fontSize: '11px', letterSpacing: '0.05em', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <span className="flex-1">All conferences</span>
                      <ArrowRight size={13} strokeWidth={2.2} style={{ color: '#9A8A78' }} />
                    </Link>
                  </>
                )}
              </div>
            </>
          )}

          <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 my-1 font-semibold transition-colors focus:outline-none"
            style={{
              color: '#8B2020',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.05em',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139, 32, 32, 0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <LogOut size={15} strokeWidth={2.1} style={{ color: '#8B2020', flexShrink: 0 }} />
            SIGN OUT
          </button>
        </div>
        </Portal>
      )}
    </div>
  );
}
