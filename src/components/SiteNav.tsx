'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Globe, User, FileText, CalendarDays, Trophy, Sparkles, LogOut, ArrowRight } from 'lucide-react';

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

const NAV_LINKS_CONFIG = [
  { en: 'SESSIONS',    es: 'SESIONES',     fr: 'SESSIONS',        ar: 'الجلسات',    href: '/' },
  { en: 'CONFERENCES', es: 'CONFERENCIAS', fr: 'CONFÉRENCES',     ar: 'المؤتمرات',  href: '/conferences' },
  { en: 'ABOUT US',    es: 'NOSOTROS',     fr: 'QUI SOMMES-NOUS', ar: 'من نحن',     href: '/about' },
  { en: 'CONTACT',     es: 'CONTÁCTANOS',  fr: 'CONTACT',         ar: 'تواصل معنا', href: '/contact' },
];

interface SiteNavProps {
  logoOverride?: { src: string; alt: string };
  /**
   * Overlay mode: the header floats transparently over the page's hero media
   * instead of occupying a 72px ivory strip that cuts the hero off at the top.
   * Ink-colored controls switch to light-on-dark treatment.
   */
  overlay?: boolean;
}

export default function SiteNav({ logoOverride, overlay = false }: SiteNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const accountCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Your conferences" section — fetched lazily the first time the menu opens.
  const [myConfs, setMyConfs] = useState<NavConference[] | null>(null);
  const [confsLoading, setConfsLoading] = useState(false);
  const confsFetched = useRef(false);

  const { user, profile, session, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = useT();
  const navLinks = NAV_LINKS_CONFIG.map(l => ({ label: l[language], href: l.href }));

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Clear any pending hover-close timer on unmount.
  useEffect(() => () => {
    if (accountCloseTimer.current) clearTimeout(accountCloseTimer.current);
  }, []);

  // Reset the cached conference list when the signed-in user changes.
  useEffect(() => {
    confsFetched.current = false;
    setMyConfs(null);
    setConfsLoading(false);
  }, [user?.id]);

  const cancelAccountClose = useCallback(() => {
    if (accountCloseTimer.current) {
      clearTimeout(accountCloseTimer.current);
      accountCloseTimer.current = null;
    }
  }, []);

  // Hover-open (desktop pointer only — touch keeps pure click-toggle behaviour).
  const handleAccountPointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelAccountClose();
    setAccountMenuOpen(true);
  }, [cancelAccountClose]);

  // ~200ms grace so the cursor can travel from the trigger into the panel.
  const handleAccountPointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelAccountClose();
    accountCloseTimer.current = setTimeout(() => setAccountMenuOpen(false), 200);
  }, [cancelAccountClose]);

  // Batched fetch of the user's conferences the first time the menu opens:
  // accepted/assigned/checked-in applications + organizer memberships + owned
  // conferences, merged per conference (organizer wins), soonest first.
  useEffect(() => {
    if (!accountMenuOpen || confsFetched.current) return;
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

        const list = Array.from(byId.values()).sort((a, b) => a.start_date.localeCompare(b.start_date));
        setMyConfs(list);
      } catch {
        setMyConfs([]);
      } finally {
        setConfsLoading(false);
      }
    })();
  }, [accountMenuOpen, user, session]);

  // Conferences-area pages get the "GAVELLING CONFERENCES" wordmark by default.
  // The two-tone (green + gold) artwork would be flattened to a single-colour
  // silhouette by the overlay gold filter, so it opts out of the recolour and
  // relies on a drop-shadow for legibility over dark heroes instead.
  const inConferencesArea =
    !logoOverride && (pathname?.startsWith('/conferences') || pathname?.startsWith('/manage'));
  const logoSrc = logoOverride?.src ?? (inConferencesArea ? '/Conferences.png' : '/GavellingLogo.png');
  const logoAlt = logoOverride?.alt ?? (inConferencesArea ? 'Gavelling Conferences' : 'Gavelling');
  const skipOverlayRecolor = logoSrc === '/Conferences.png';

  const avatarInitial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

  async function handleSignOut() {
    await signOut();
    setAccountMenuOpen(false);
    setMenuOpen(false);
    window.location.href = '/';
  }

  return (
    <>
      {/*
        Floating pill nav (desktop only). Fixed to the viewport so it stays visible
        while the rest of the header — logo (left), language toggle + auth (right) —
        scrolls away with the page. The 72px-tall wrapper vertically aligns the pill
        with the logo/CTA row at scroll top; pointer-events are limited to the pill
        itself so the transparent band never blocks clicks on the content behind it.
      */}
      <div className="hidden md:flex fixed top-0 left-1/2 -translate-x-1/2 z-40 h-[72px] items-center pointer-events-none">
        <div
          className="flex items-center rounded-full pointer-events-auto"
          style={{
            backgroundColor: 'rgba(250, 248, 243, 0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(221, 212, 192, 0.85)',
            boxShadow: '0 8px 32px rgba(27, 56, 40, 0.12), 0 2px 8px rgba(27, 56, 40, 0.08)',
            padding: '6px 8px',
          }}
        >
          {navLinks.map((link) => {
            const active = pathname === link.href;
            const hl = hovered === link.label;
            return (
              <Link
                key={link.label}
                href={link.href}
                onMouseEnter={() => setHovered(link.label)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  position: 'relative',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: active ? 900 : 700,
                  letterSpacing: '0.08em',
                  fontFamily: "'Outfit', sans-serif",
                  color: active ? '#EED98A' : hl ? '#1B3828' : 'rgba(28, 20, 16, 0.55)',
                  textDecoration: 'none',
                  borderRadius: '9999px',
                  transition: 'all 200ms ease',
                  backgroundColor: active ? '#1B3828' : hl ? 'rgba(27, 56, 40, 0.06)' : 'transparent',
                  transform: hl && !active ? 'translateY(-1px)' : 'translateY(0)',
                }}
              >
                {link.label}
                <span style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '16px',
                  right: '16px',
                  height: '1px',
                  backgroundColor: '#B6871F',
                  transform: hl && !active ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 200ms ease',
                  borderRadius: '2px',
                }} />
              </Link>
            );
          })}
        </div>
      </div>

      <nav
        className={`${overlay ? 'absolute top-0 left-0 right-0' : 'relative'} z-30 flex items-center justify-between px-6 md:px-14 shrink-0`}
        style={{ height: '72px' }}
      >
        {/* Logo */}
        <Link href="/" onClick={() => setMenuOpen(false)}>
          <img
            src={logoSrc}
            alt={logoAlt}
            className="h-8 md:h-10 w-auto object-contain"
            style={
              overlay
                ? skipOverlayRecolor
                  ? { filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }
                  : { filter: 'brightness(0) saturate(100%) invert(85%) sepia(30%) saturate(500%) hue-rotate(5deg) brightness(105%) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }
                : undefined
            }
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </Link>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-3">

          {/* Language toggle */}
          <div className="relative" ref={langMenuRef}>
            <div className="relative" suppressHydrationWarning>
              <span
                className="absolute right-0 z-10 pointer-events-none"
                style={{
                  top: '-8px',
                  backgroundColor: '#1B3828',
                  color: '#EED98A',
                  border: '1.5px solid rgba(238,217,138,0.55)',
                  borderRadius: '5px',
                  padding: '0px 4px',
                  fontSize: '7px',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  lineHeight: '13px',
                }}
              >✨ NEW</span>
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all focus:outline-none"
                style={{ color: overlay ? '#EDE7D8' : '#1B3828', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textShadow: overlay ? '0 1px 4px rgba(0,0,0,0.35)' : undefined }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = overlay ? 'rgba(250,248,243,0.14)' : 'rgba(27,56,40,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Globe size={14} strokeWidth={2} />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.06em' }}>{language.toUpperCase()}</span>
              </button>
            </div>
            {showLangMenu && (
              <div
                className="absolute right-0 mt-1 w-36 rounded-xl overflow-hidden"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1px solid #DDD4C0',
                  boxShadow: '0 8px 24px rgba(27,56,40,0.12)',
                  zIndex: 50,
                }}
              >
                {(['en', 'es', 'fr', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setShowLangMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                    style={{
                      color: language === lang ? '#1B3828' : '#9A8A78',
                      fontWeight: language === lang ? 800 : 600,
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: '0.04em',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {lang === 'en' ? t('settings_english') : lang === 'es' ? t('settings_spanish') : lang === 'fr' ? t('settings_french') : 'العربية'}
                    {language === lang && <span className="ml-1" style={{ color: '#B6871F' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth section */}
          {user ? (
            /* Account button + dropdown */
            <div
              className="relative"
              ref={accountMenuRef}
              onPointerEnter={handleAccountPointerEnter}
              onPointerLeave={handleAccountPointerLeave}
            >
              <button
                onClick={() => { cancelAccountClose(); setAccountMenuOpen((v) => !v); }}
                className="flex items-center gap-2 focus:outline-none"
                style={{
                  backgroundColor: '#1B3828',
                  color: '#EED98A',
                  borderRadius: '9999px',
                  padding: '7px 14px 7px 8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  fontFamily: "'Outfit', sans-serif",
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ backgroundColor: '#EED98A', color: '#1B3828' }}
                  >
                    {avatarInitial}
                  </div>
                )}
                <span>{profile?.display_name ?? user.email?.split('@')[0] ?? 'Account'}</span>
              </button>

              {/* Dropdown — kokonutui profile-dropdown anatomy in house style */}
              {accountMenuOpen && (
                <div
                  className="absolute right-0 mt-2"
                  style={{
                    width: '280px',
                    backgroundColor: '#FAF8F3',
                    border: '1px solid #DDD4C0',
                    borderRadius: '16px',
                    boxShadow: '0 20px 48px rgba(27, 56, 40, 0.16)',
                    zIndex: 50,
                    overflow: 'hidden',
                    animation: 'siteNavMenuIn 180ms ease both',
                  }}
                >
                  <style>{`@keyframes siteNavMenuIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                  {/* Header — avatar + name + email */}
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
                    {[
                      { label: 'MY PROFILE', href: '/account/profile', icon: User },
                      { label: 'MUN CV', href: '/account/cv', icon: FileText },
                      { label: 'CONFERENCE CALENDAR', href: '/account/calendar', icon: CalendarDays },
                      { label: 'GAVELLING POINTS', href: '/account/points', icon: Trophy },
                    ].map((item) => {
                      const RowIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setAccountMenuOpen(false)}
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
                          {item.label}
                        </Link>
                      );
                    })}

                    {profile?.unlimited_status === 'none' ? (
                      <Link
                        href="/unlimited"
                        onClick={() => setAccountMenuOpen(false)}
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
                      <div className="px-4 py-2">
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: '#EED98A',
                            color: '#1B3828',
                            fontFamily: "'Outfit', sans-serif",
                            letterSpacing: '0.06em',
                          }}
                        >
                          GAVELLING UNLIMITED ✦
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Your conferences — lazily fetched; omitted entirely when empty */}
                  {(confsLoading || (myConfs !== null && myConfs.length > 0)) && (
                    <>
                      <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />
                      <div className="pt-2.5 pb-1">
                        <p
                          className="px-4 pb-1.5 font-bold"
                          style={{ color: '#9A8A78', fontSize: '10px', letterSpacing: '0.08em', fontFamily: "'Outfit', sans-serif" }}
                        >
                          YOUR CONFERENCES
                        </p>

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
                                onClick={() => setAccountMenuOpen(false)}
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
                                    border: '1px solid #E7E0CF',
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
                              href="/conferences/organise"
                              onClick={() => setAccountMenuOpen(false)}
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
              )}
            </div>
          ) : (
            /* Signed-out: SIGN IN only */
            <Link
              href="/auth/signin"
              className="text-sm font-bold transition-colors focus:outline-none"
              style={{
                color: overlay ? '#EDE7D8' : '#1B3828',
                letterSpacing: '0.06em',
                fontFamily: "'Outfit', sans-serif",
                textDecoration: 'none',
                textShadow: overlay ? '0 1px 4px rgba(0,0,0,0.35)' : undefined,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
            >
              SIGN IN
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <span
            className="block w-6 h-0.5 rounded-full transition-all duration-300 origin-center"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-all duration-300 origin-center"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              transform: menuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300 relative z-20"
        style={{
          maxHeight: menuOpen ? '480px' : '0px',
          backgroundColor: '#FAF8F3',
          borderBottom: menuOpen ? '1px solid #DDD4C0' : 'none',
        }}
      >
        <div className="flex flex-col px-6 py-4 gap-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: active ? 900 : 700,
                  letterSpacing: '0.08em',
                  color: active ? '#1B3828' : 'rgba(28, 20, 16, 0.65)',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  backgroundColor: active ? 'rgba(27, 56, 40, 0.07)' : 'transparent',
                  borderLeft: active ? '3px solid #B6871F' : '3px solid transparent',
                  transition: 'all 150ms ease',
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <div style={{ height: '1px', backgroundColor: '#DDD4C0', margin: '8px 0' }} />

          {/* Mobile language toggle */}
          <div className="flex gap-2 px-2 pb-1">
            {(['en', 'es', 'fr', 'ar'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold focus:outline-none transition-all"
                style={{
                  backgroundColor: language === lang ? '#1B3828' : 'rgba(27,56,40,0.07)',
                  color: language === lang ? '#EED98A' : '#1B3828',
                  border: language === lang ? 'none' : '1px solid rgba(27,56,40,0.18)',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                {lang === 'en' ? `EN — ${t('settings_english')}` : lang === 'es' ? `ES — ${t('settings_spanish')}` : lang === 'fr' ? `FR — ${t('settings_french')}` : 'AR — العربية'}
              </button>
            ))}
          </div>

          <div style={{ height: '1px', backgroundColor: '#DDD4C0', margin: '8px 0' }} />

          {user ? (
            <>
              <div className="px-4 py-2">
                <p className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  {profile?.display_name ?? user.email?.split('@')[0]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  {profile?.email ?? user.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 16px',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#8B2020',
                  backgroundColor: 'rgba(139, 32, 32, 0.08)',
                  border: '1px solid rgba(139, 32, 32, 0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block',
                padding: '13px 16px',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#1B3828',
                backgroundColor: 'rgba(27, 56, 40, 0.07)',
                border: '1.5px solid rgba(27, 56, 40, 0.25)',
                borderRadius: '10px',
                textAlign: 'center',
                textDecoration: 'none',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              SIGN IN
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
