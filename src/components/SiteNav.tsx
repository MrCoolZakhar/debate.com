'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Globe, FileClock } from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';
import { useCredits } from '@/hooks/useCredits';
import { useDraftCount, draftResumeHref } from '@/hooks/useDraftCount';

const NAV_LINKS_CONFIG = [
  { en: 'SESSIONS',    es: 'SESIONES',     fr: 'SESSIONS',        ar: 'الجلسات',    href: '/sessions' },
  { en: 'CONFERENCES', es: 'CONFERENCIAS', fr: 'CONFÉRENCES',     ar: 'المؤتمرات',  href: '/' },
  { en: 'ABOUT US',    es: 'NOSOTROS',     fr: 'QUI SOMMES-NOUS', ar: 'من نحن',     href: '/about' },
  { en: 'CONTACT',     es: 'CONTÁCTANOS',  fr: 'CONTACT',         ar: 'تواصل معنا', href: '/contact' },
];

interface SiteNavProps {
  logoOverride?: { src: string; alt: string };
  /** Which wordmark to show, stated rather than inferred. `usePathname()` is
   *  not reliable during a static prerender — the homepage is ISR-rendered and
   *  has been shipping the SESSIONS mark in its prerendered HTML despite the
   *  path being '/', which no local build reproduces. A page that knows its own
   *  brand should say so instead of leaving it to a heuristic. */
  brand?: 'conferences' | 'sessions';
  /**
   * Overlay mode: the header floats transparently over the page's hero media
   * instead of occupying a 72px ivory strip that cuts the hero off at the top.
   * Ink-colored controls switch to light-on-dark treatment.
   */
  overlay?: boolean;
  /**
   * Hide the language (globe) toggle. Used on conference-side surfaces that
   * are not translated yet, so the toggle would offer no working choices.
   */
  hideLanguage?: boolean;
}

export default function SiteNav({ logoOverride, overlay = false, hideLanguage = false, brand }: SiteNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const { user, profile, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { balance: creditBalance, loading: creditsLoading } = useCredits();
  // ProfileDropdown is `hidden md:flex`, so on a phone it never mounts and its
  // unfinished-application entries would be invisible exactly where applicants
  // abandon forms. The hamburger sheet hand-rolls its own account block, so it
  // needs them too (with its own lazy fetch, gated on the sheet being open).
  //
  // Mirrors the dropdown's treatment: one gold-washed row PER draft, tagged
  // UNFINISHED and linking straight back into that application's wizard —
  // never an aggregate row, and never something that reads like attendance.
  const { count: draftCount, drafts } = useDraftCount(menuOpen);
  const t = useT();
  const navLinks = NAV_LINKS_CONFIG.map(l => ({ label: l[language], href: l.href }));

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Brand-per-context: conferences-area pages get the "GAVELLING CONFERENCES"
  // logo lockup (/Conferences.webp, .png fallback) — the same mark the footer,
  // manage header and auth card use. Sessions pages get the "GAVELLING SESSIONS
  // APP" logo (/GavellingSessionsApp.png). This mirrors the wordmark text the
  // nav already switches per context.
  const CONFERENCES_PREFIXES = ['/conferences', '/manage', '/account', '/auth', '/my-conferences', '/invites'];
  // `!pathname` defaults to the CONFERENCES lockup on purpose. usePathname() can
  // resolve to null while a page is being statically prerendered, and when that
  // happened the homepage baked the SESSIONS logo into its static HTML — every
  // first-time visitor to gavelling.com saw the wrong brand until hydration
  // swapped it. Gavelling is conferences-first, so an unknown path must fall
  // back to conferences rather than to sessions.
  // An explicit `brand` always wins; the pathname heuristic is only the
  // fallback for pages that have not said which side of the product they are.
  const inConferencesArea =
    !logoOverride && (
      brand ? brand === 'conferences'
        : (!pathname || pathname === '/' || CONFERENCES_PREFIXES.some(p => pathname.startsWith(p)))
    );
  // Transparent WEBP: the original .png has NO alpha and carried a solid
  // #F2F2F2 plate, which showed as a pale block behind the mark on the
  // site's ivory. The .png remains as the onError fallback.
  const logoSrc = logoOverride?.src ?? '/GavellingSessionsApp.webp';
  const logoAlt = logoOverride?.alt ?? 'Gavelling Sessions';

  const avatarInitial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    window.location.href = '/';
  }

  return (
    <>
      {/*
        Floating pill nav (desktop only). Fixed to the viewport so it stays visible
        while the rest of the header, logo (left), language toggle + auth (right) —
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
                  transition: 'color 200ms cubic-bezier(0.22,1,0.36,1), background-color 200ms cubic-bezier(0.22,1,0.36,1), transform 200ms cubic-bezier(0.22,1,0.36,1)',
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
        {/* Logo + language toggle (left side) */}
        <div className="flex items-center gap-1">
          <Link href="/" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
            {inConferencesArea ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/Conferences.webp"
                alt="Gavelling Conferences"
                width={144}
                height={36}
                decoding="async"
                loading="eager"
                fetchPriority="high"
                style={{
                  height: 36,
                  width: 'auto',
                  objectFit: 'contain',
                  // Until the bitmap arrives the browser paints the ALT TEXT
                  // (and a broken-image glyph) into the reserved 144x36 box —
                  // the ugly block that flashed on every cold load. Transparent
                  // text hides that flash; `alt` is untouched, so screen readers
                  // and crawlers still get the name.
                  color: 'transparent',
                  filter: overlay ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : undefined,
                }}
                onError={(e) => {
                  // .webp can intermittently fail to decode (cache/partial); fall
                  // back to the .png once before giving up, never hide outright.
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.src.endsWith('/Conferences.png')) img.src = '/Conferences.png';
                  else img.style.display = 'none';
                }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoSrc}
                alt={logoAlt}
                width={160}
                height={40}
                decoding="async"
                loading="eager"
                fetchPriority="high"
                className="h-8 md:h-10 w-auto object-contain"
                style={{
                  // Same alt-text flash guard as the conferences lockup above.
                  color: 'transparent',
                  ...(overlay
                    ? { filter: 'brightness(0) saturate(100%) invert(85%) sepia(30%) saturate(500%) hue-rotate(5deg) brightness(105%) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }
                    : {}),
                }}
                onError={(e) => {
                  // Retry ONCE past a partial/failed cache entry. Never
                  // display:none — that was how the logo used to vanish for the
                  // rest of the session after a single transient failure.
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.dataset.retried) {
                    img.dataset.retried = '1';
                    img.src = `${logoSrc}?reload=1`;
                  }
                }}
              />
            )}
          </Link>

          {/* Language toggle (desktop only — mobile keeps its own toggle in the hamburger menu) */}
          {!hideLanguage && (
          <div className="hidden md:block relative" ref={langMenuRef}>
            <div className="relative" suppressHydrationWarning>
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors focus:outline-none"
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
                className="absolute left-0 mt-1 w-36 rounded-xl overflow-hidden"
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
          )}
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-3">

          {/* Credit chip */}
          {user && (
            <Link
              href="/account/unlimited"
              data-credits-chip
              className="relative flex items-center gap-1.5 focus:outline-none"
              style={{
                backgroundColor: '#1B3828',
                color: '#EED98A',
                borderRadius: '9999px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                fontFamily: "'Outfit', sans-serif",
                textDecoration: 'none',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gavel-mark.webp" alt="" decoding="async" style={{ height: 16, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{creditsLoading || creditBalance === null ? '—' : creditBalance}</span>
            </Link>
          )}

          {/* Auth section */}
          {user ? (
            /* Account button + shared dropdown */
            <ProfileDropdown trigger={(open, toggle) => (
              <button
                onClick={toggle}
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
            )} />
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
            className="block w-6 h-0.5 rounded-full transition-[transform,background-color] duration-300 origin-center"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-[opacity,background-color] duration-300"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-[transform,background-color] duration-300 origin-center"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              transform: menuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </nav>

      {/* Mobile dropdown menu.
          In overlay mode the <nav> is absolutely positioned (out of flow), so a
          normal-flow dropdown would collapse to the top of the hero and the
          floating logo/hamburger would sit on top of its first item (SESSIONS).
          Pin it just below the 72px nav bar so every tab is visible. */}
      <div
        className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${overlay ? 'absolute left-0 right-0 z-40' : 'relative z-20'}`}
        style={{
          top: overlay ? '72px' : undefined,
          // Headroom for the drafts block (a heading + one row per draft, up
          // to 3), or the sheet clips its own last item (SIGN OUT) at the
          // 480px cap.
          maxHeight: menuOpen
            ? `${480 + (user && drafts.length > 0 ? 26 + 44 * Math.min(drafts.length, 3) : 0)}px`
            : '0px',
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
                  transition: 'color 150ms ease, background-color 150ms ease, border-left-color 150ms ease',
                }}
              >
                {link.label}
              </Link>
            );
          })}

          {!hideLanguage && (
            <>
              <div style={{ height: '1px', backgroundColor: '#DDD4C0', margin: '8px 0' }} />

              {/* Mobile language toggle */}
              <div className="flex gap-2 px-2 pb-1">
                {(['en', 'es', 'fr', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold focus:outline-none transition-colors"
                    style={{
                      backgroundColor: language === lang ? '#1B3828' : 'rgba(27,56,40,0.07)',
                      color: language === lang ? '#EED98A' : '#1B3828',
                      border: language === lang ? 'none' : '1px solid rgba(27,56,40,0.18)',
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                    }}
                  >
                    {lang === 'en' ? `EN: ${t('settings_english')}` : lang === 'es' ? `ES: ${t('settings_spanish')}` : lang === 'fr' ? `FR: ${t('settings_french')}` : 'AR: العربية'}
                  </button>
                ))}
              </div>
            </>
          )}

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

              {drafts.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 pb-1">
                    <p
                      className="flex-1"
                      style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: '#8A6614', fontFamily: "'Outfit', sans-serif" }}
                    >
                      YOUR CONFERENCES
                    </p>
                    {draftCount !== null && draftCount > 0 && (
                      <span
                        className="flex items-center justify-center rounded-full"
                        style={{
                          minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 700,
                          fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums',
                          backgroundColor: 'rgba(182,135,31,0.22)',
                          color: '#8A6614',
                        }}
                      >
                        {draftCount}
                      </span>
                    )}
                  </div>
                  {drafts.slice(0, 3).map((d) => (
                    <Link
                      key={d.id}
                      href={draftResumeHref(d)}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 focus:outline-none"
                      style={{
                        // 44px tall — the tap-target floor, and what the
                        // maxHeight arithmetic above budgets per row.
                        minHeight: '44px',
                        padding: '10px 16px',
                        margin: '0 0 4px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(182, 135, 31, 0.12)',
                        textDecoration: 'none',
                      }}
                    >
                      <FileClock size={16} strokeWidth={2.2} style={{ color: '#8A6614', flexShrink: 0 }} />
                      <span
                        className="truncate"
                        style={{ fontSize: '13px', fontWeight: 800, color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.02em' }}
                      >
                        {d.acronym || d.fullName}
                      </span>
                      <span
                        className="shrink-0"
                        style={{
                          marginLeft: 'auto', fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em',
                          textTransform: 'uppercase', color: '#8A6614', fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        Unfinished
                      </span>
                    </Link>
                  ))}
                </>
              )}

              <Link
                href="/account/unlimited"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 focus:outline-none"
                style={{
                  padding: '10px 16px',
                  margin: '0 0 4px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(27, 56, 40, 0.07)',
                  textDecoration: 'none',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/gavel-mark.webp" alt="" decoding="async" loading="lazy" style={{ height: 16, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B3828', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  {creditsLoading || creditBalance === null ? '—' : creditBalance}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.02em' }}>
                  Credits &amp; Subscription
                </span>
              </Link>

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
