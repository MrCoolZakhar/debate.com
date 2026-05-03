'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_LINKS = [
  { label: 'HOME', href: '/' },
  { label: 'CONFERENCES', href: '/conferences' },
  { label: 'ABOUT US', href: '/about' },
  { label: 'CONTACT', href: '/contact' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav
      className="relative z-20 flex items-center justify-between px-8 shrink-0"
      style={{
        height: '72px',
        borderBottom: '1px solid rgba(46, 30, 15, 0.8)',
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(13, 9, 6, 0.92)',
      }}
    >
      <Link href="/">
        <img
          src="/GavellingLogo.png"
          alt="Gavelling"
          className="h-10 w-auto object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </Link>

      <div className="flex items-center">
        {NAV_LINKS.map((link, i) => {
          const active = pathname === link.href;
          const hl = hovered === link.label;
          return (
            <div key={link.label} className="flex items-center">
              {i > 0 && (
                <div style={{
                  width: '1px',
                  height: '28px',
                  backgroundColor: 'rgba(196, 168, 130, 0.2)',
                  margin: '0 2px',
                  flexShrink: 0,
                }} />
              )}
              <Link
                href={link.href}
                onMouseEnter={() => setHovered(link.label)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  position: 'relative',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: active ? 900 : 700,
                  letterSpacing: '0.08em',
                  color: active || hl ? '#C4A882' : 'rgba(196, 168, 130, 0.5)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  transition: 'all 180ms ease',
                  backgroundColor: active ? 'rgba(196, 168, 130, 0.09)' : hl ? 'rgba(196, 168, 130, 0.05)' : 'transparent',
                  transform: hl && !active ? 'translateY(-1px)' : 'translateY(0)',
                }}
              >
                {link.label}
                <span style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '20px',
                  right: '20px',
                  height: active ? '2px' : '1px',
                  backgroundColor: '#B8844A',
                  transform: active || hl ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 180ms ease',
                  borderRadius: '2px',
                }} />
              </Link>
            </div>
          );
        })}
      </div>

      <Link
        href="/pre-register"
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.backgroundColor = '#B8844A';
          el.style.color = '#0D0906';
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = '0 4px 20px rgba(184, 132, 74, 0.4)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.backgroundColor = 'transparent';
          el.style.color = '#C4A882';
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '10px 22px',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#C4A882',
          border: '1.5px solid rgba(196, 168, 130, 0.4)',
          borderRadius: '9999px',
          textDecoration: 'none',
          transition: 'all 180ms ease',
          backgroundColor: 'transparent',
        }}
      >
        PRE-REGISTER
      </Link>
    </nav>
  );
}
