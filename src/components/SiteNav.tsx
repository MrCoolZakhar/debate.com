'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import PreRegisterModal from '@/components/PreRegisterModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

const NAV_LINKS_CONFIG = [
  { en: 'SESSIONS',     es: 'SESIONES',     href: '/' },
  { en: 'CONFERENCES',  es: 'CONFERENCIAS', href: '/conferences' },
  { en: 'ABOUT US',     es: 'NOSOTROS',     href: '/about' },
  { en: 'CONTACT',      es: 'CONTACTO',     href: '/contact' },
];

interface SiteNavProps {
  logoOverride?: { src: string; alt: string };
}

export default function SiteNav({ logoOverride }: SiteNavProps = {}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const navLinks = NAV_LINKS_CONFIG.map(l => ({ label: l[language], href: l.href }));

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

        {/* Language toggle */}
        <div className="relative hidden md:block mr-3">
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
          {showLangMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', minWidth: '140px' }}>
                <button
                  onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors focus:outline-none"
                  style={{ color: language === 'en' ? '#1B3828' : '#6A5A4A', fontWeight: language === 'en' ? 800 : 600, fontSize: '13px', backgroundColor: language === 'en' ? 'rgba(27,56,40,0.07)' : 'transparent' }}
                  onMouseEnter={(e) => { if (language !== 'en') (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { if (language !== 'en') (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>EN</span>
                  <span>English</span>
                  {language === 'en' && <span className="ml-auto" style={{ color: '#B6871F' }}>✓</span>}
                </button>
                <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />
                <button
                  onClick={() => { setLanguage('es'); setShowLangMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors focus:outline-none"
                  style={{ color: language === 'es' ? '#1B3828' : '#6A5A4A', fontWeight: language === 'es' ? 800 : 600, fontSize: '13px', backgroundColor: language === 'es' ? 'rgba(27,56,40,0.07)' : 'transparent' }}
                  onMouseEnter={(e) => { if (language !== 'es') (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { if (language !== 'es') (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>ES</span>
                  <span>Español</span>
                  {language === 'es' && <span className="ml-auto" style={{ color: '#B6871F' }}>✓</span>}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Desktop PRE-REGISTER button */}
        <button
          className="hidden md:inline-flex"
          onClick={() => setShowModal(true)}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.backgroundColor = '#1B3828';
            el.style.color = '#EED98A';
            el.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.backgroundColor = 'transparent';
            el.style.color = '#1B3828';
            el.style.transform = 'translateY(0)';
          }}
          style={{
            alignItems: 'center',
            padding: '10px 22px',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#1B3828',
            border: '1.5px solid rgba(27, 56, 40, 0.5)',
            borderRadius: '9999px',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            backgroundColor: 'transparent',
          }}
        >
          PRE-REGISTER
        </button>

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
          maxHeight: menuOpen ? '360px' : '0px',
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

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => { setLanguage('en'); setMenuOpen(false); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all focus:outline-none"
              style={{ backgroundColor: language === 'en' ? '#1B3828' : '#EDE7D8', color: language === 'en' ? '#EED98A' : '#1B3828', border: '1px solid #DDD4C0' }}
            >
              EN — English
            </button>
            <button
              onClick={() => { setLanguage('es'); setMenuOpen(false); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all focus:outline-none"
              style={{ backgroundColor: language === 'es' ? '#1B3828' : '#EDE7D8', color: language === 'es' ? '#EED98A' : '#1B3828', border: '1px solid #DDD4C0' }}
            >
              ES — Español
            </button>
          </div>

          <button
            onClick={() => { setMenuOpen(false); setShowModal(true); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 16px',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#EDE7D8',
              backgroundColor: '#1B3828',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {language === 'es' ? 'PRE-REGISTRARSE' : 'PRE-REGISTER'}
          </button>
        </div>
      </div>

      <PreRegisterModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
