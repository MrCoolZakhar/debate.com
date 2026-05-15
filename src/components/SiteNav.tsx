'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import PreRegisterModal from '@/components/PreRegisterModal';

const NAV_LINKS = [
  { label: 'SESSIONS', href: '/' },
  { label: 'CONFERENCES', href: '/conferences' },
  { label: 'ABOUT US', href: '/about' },
  { label: 'CONTACT', href: '/contact' },
];

interface SiteNavProps {
  logoOverride?: { src: string; alt: string };
}

export default function SiteNav({ logoOverride }: SiteNavProps = {}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          {NAV_LINKS.map((link, i) => {
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
          {NAV_LINKS.map((link) => {
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
            PRE-REGISTER
          </button>
        </div>
      </div>

      <PreRegisterModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
