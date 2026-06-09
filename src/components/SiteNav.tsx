'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

const NAV_LINKS_CONFIG = [
  { en: 'SESSIONS',    es: 'SESIONES',     href: '/' },
  { en: 'CONFERENCES', es: 'CONFERENCIAS', href: '/conferences' },
  { en: 'ABOUT US',    es: 'NOSOTROS',     href: '/about' },
  { en: 'CONTACT',     es: 'CONTÁCTANOS',  href: '/contact' },
];

interface SiteNavProps {
  logoOverride?: { src: string; alt: string };
}

export default function SiteNav({ logoOverride }: SiteNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const { user, profile, signOut } = useAuth();
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
      <nav
        className="relative z-20 flex items-center justify-between px-6 md:px-14 shrink-0"
        style={{ height: '72px' }}
      >
        {/* Logo */}
        <Link href="/" onClick={() => setMenuOpen(false)}>
          <img
            src={logoOverride?.src ?? '/GavellingLogo.png'}
            alt={logoOverride?.alt ?? 'Gavelling'}
            className="h-8 md:h-10 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center">
          {navLinks.map((link, i) => {
            const active = pathname === link.href;
            const hl = hovered === link.label;
            return (
              <div key={link.label} className="flex items-center">
                {i > 0 && (
                  <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28, 20, 16, 0.2)', margin: '0 2px' }} />
                )}
                <Link
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
                    color: active || hl ? '#1B3828' : 'rgba(28, 20, 16, 0.55)',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    transition: 'all 200ms ease',
                    backgroundColor: active ? 'rgba(27, 56, 40, 0.07)' : hl ? 'rgba(27, 56, 40, 0.04)' : 'transparent',
                    transform: hl && !active ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  {link.label}
                  <span style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '16px',
                    right: '16px',
                    height: active ? '2px' : '1px',
                    backgroundColor: '#B6871F',
                    transform: active || hl ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left',
                    transition: 'transform 200ms ease',
                    borderRadius: '2px',
                  }} />
                </Link>
              </div>
            );
          })}
        </div>

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
                style={{ color: '#1B3828', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Globe size={14} strokeWidth={2} />
                <span style={{ fontFamily: "'DM Mono', monospace" }}>{language.toUpperCase()}</span>
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
                {(['en', 'es'] as const).map((lang) => (
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
                    {lang === 'en' ? t('settings_english') : t('settings_spanish')}
                    {language === lang && <span className="ml-1" style={{ color: '#B6871F' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth section */}
          {user ? (
            /* Account button + dropdown */
            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setAccountMenuOpen((v) => !v)}
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

              {/* Dropdown */}
              {accountMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56"
                  style={{
                    backgroundColor: '#FAF8F3',
                    border: '1px solid #DDD4C0',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(28, 20, 16, 0.12), 0 2px 8px rgba(28, 20, 16, 0.06)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  <div className="px-4 py-3">
                    <p className="text-sm font-bold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {profile?.display_name ?? user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      {profile?.email ?? user.email}
                    </p>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

                  {[
                    { label: 'MY PROFILE', href: '/account/profile' },
                    { label: 'MUN CV', href: '/account/cv' },
                    { label: 'CONFERENCE CALENDAR', href: '/account/calendar' },
                    { label: 'GAVELLING POINTS', href: '/account/points' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-semibold transition-colors"
                      style={{
                        color: '#1C1410',
                        fontFamily: "'Outfit', sans-serif",
                        letterSpacing: '0.05em',
                        fontSize: '12px',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.06)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      {item.label}
                    </Link>
                  ))}

                  <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

                  {profile?.unlimited_status === 'none' ? (
                    <Link
                      href="/unlimited"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-semibold transition-colors"
                      style={{
                        color: '#1B3828',
                        fontFamily: "'Outfit', sans-serif",
                        letterSpacing: '0.05em',
                        fontSize: '12px',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.06)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      UPGRADE TO UNLIMITED{' '}
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

                  <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm font-semibold transition-colors focus:outline-none"
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
                color: '#1B3828',
                letterSpacing: '0.06em',
                fontFamily: "'Outfit', sans-serif",
                textDecoration: 'none',
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
              backgroundColor: '#1B3828',
              transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: '#1B3828',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-all duration-300 origin-center"
            style={{
              backgroundColor: '#1B3828',
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
            {(['en', 'es'] as const).map((lang) => (
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
                {lang === 'en' ? `EN — ${t('settings_english')}` : `ES — ${t('settings_spanish')}`}
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
