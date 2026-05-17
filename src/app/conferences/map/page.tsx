'use client';

import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

export default function ConferencesMapPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1B3828' }}>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'overlay',
          opacity: 0.07,
        }}
      />
      <SiteNav />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs tracking-[0.2em] mb-4" style={{ color: 'rgba(238,217,138,0.5)', fontFamily: "'DM Mono', monospace" }}>GLOBAL MAP</p>
        <h1 className="font-black text-white mb-4" style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontFamily: "'Outfit', sans-serif" }}>
          MUN Across the Globe
        </h1>
        <p className="text-base leading-relaxed mb-8 max-w-md" style={{ color: 'rgba(237,231,216,0.65)', fontFamily: "'Outfit', sans-serif" }}>
          An interactive globe showing every MUN conference worldwide is coming soon.
        </p>
        <Link
          href="/conferences/explore"
          className="rounded-2xl py-3 px-8 font-bold text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
        >
          EXPLORE CONFERENCES →
        </Link>
      </div>
    </div>
  );
}
