'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';
import { BrandConferences } from '@/components/Brand';

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
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const { user, profile, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
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

  // Conferences-area pages get the "GAVELLING CONFERENCES" brand (gavel mark +
  // live text via <BrandConferences />) instead of the baked "SESSIONS APP"
  // logo PNG. Sessions pages keep the existing PNG exactly.
  const CONFERENCES_PREFIXES = ['/conferences', '/manage', '/account', '/auth', '/my-conferences', '/invites'];
  const inConferencesArea =
    !logoOverride && CONFERENCES_PREFIXES.some(p => pathname?.startsWith(p));
  const logoSrc = logoOverride?.src ?? '/GavellingLogo.png';
  const logoAlt = logoOverride?.alt ?? 'Gavelling';

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
        <Link href="/" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
          {inConferencesArea ? (
            <BrandConferences tone={overlay ? 'dark' : 'light'} size={36} shadow={overlay} />
          ) : (
            <img
              src={logoSrc}
              alt={logoAlt}
              className="h-8 md:h-10 w-auto object-contain"
              style={
                overlay
                  ? { filter: 'brightness(0) saturate(100%) invert(85%) sepia(30%) saturate(500%) hue-rotate(5deg) brightness(105%) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }
                  : undefined
              }
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
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
