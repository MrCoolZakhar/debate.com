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

export default function SiteNav({ onPreRegister }: { onPreRegister?: () => void }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav className="relative z-20 flex items-center justify-between px-8 md:px-14 shrink-0" style={{ height: '72px' }}>
      <Link href="/">
        <img src="/GavellingLogo.png" alt="Gavelling" className="h-10 w-auto object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </Link>

      <div className="flex items-center">
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

      <button
        onClick={onPreRegister}
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
          display: 'inline-flex',
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
    </nav>
  );
}
