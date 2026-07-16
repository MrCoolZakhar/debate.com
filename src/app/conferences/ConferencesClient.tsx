'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, FileText, CreditCard, Zap } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { FocusCard } from '@/components/ConferenceFocusCards';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

interface FeaturedConf {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
  logo_url: string | null;
  expected_delegates: number;
  banner_url: string | null;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

// ── Section 1: Featured Conferences ──────────────────────────────────────────

function FeaturedSection() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FocusCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, city, country, start_date, end_date, banner_url')
        .ilike('full_name', '%' + search.trim() + '%')
        .limit(5);
      setSearchResults((data as FocusCard[]) ?? []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <section
      style={{
        backgroundColor: '#EDE7D8',
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Grain overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.07,
          mixBlendMode: 'multiply',
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px',
        }}
      />

      {/* Ivory overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background: 'linear-gradient(to bottom, rgba(237,231,216,0.45) 0%, rgba(237,231,216,0.2) 40%, rgba(237,231,216,0.2) 60%, rgba(237,231,216,0.45) 100%)',
        }}
      />

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px 0',
          minHeight: 'calc(100vh - 72px)',
          marginTop: '72px',
        }}
      >
        {/* Title */}
        <h2 style={{ textAlign: 'center', marginBottom: '40px', margin: '0 0 40px 0' }}>
          <span
            style={{
              display: 'block',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(52px, 7vw, 96px)',
              color: '#1C1410',
              lineHeight: 1.0,
            }}
          >
            Find Your Next
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(52px, 7vw, 96px)',
              color: '#1B3828',
              lineHeight: 1.0,
            }}
          >
            Conference.
          </span>
        </h2>

        {/* Search + button row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '600px',
          }}
        >
          {/* Search container */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conferences..."
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: `1.5px solid ${searchFocused ? '#1B3828' : '#DDD4C0'}`,
                backgroundColor: 'rgba(250,248,243,0.92)',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '14px',
                color: '#1C1410',
                outline: 'none',
                boxShadow: '0 2px 12px rgba(27,56,40,0.06)',
                boxSizing: 'border-box',
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />

            {/* Search results dropdown */}
            {(searchResults.length > 0 || searchLoading) && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  backgroundColor: '#FAF8F3',
                  border: '1px solid #DDD4C0',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(27,56,40,0.12)',
                  overflow: 'hidden',
                }}
              >
                {searchLoading ? (
                  <div style={{ padding: '12px', fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: '11px', color: '#9A8A78' }}>
                    Searching...
                  </div>
                ) : (
                  searchResults.map((result, i) => (
                    <div
                      key={result.id}
                      onClick={() => {
                        router.push(`/conferences/${result.slug}`);
                        setSearch('');
                        setSearchResults([]);
                      }}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: i < searchResults.length - 1 ? '1px solid rgba(221,212,192,0.5)' : 'none',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, color: '#1C1410', margin: 0 }}>
                        {result.full_name}
                      </p>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums', fontSize: '10px', color: '#9A8A78', margin: '2px 0 0 0' }}>
                        {result.city}, {result.country} · {formatDateRange(result.start_date, result.end_date)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Explore button */}
          <Link
            href="/conferences/explore"
            style={{
              backgroundColor: '#1B3828',
              color: '#EED98A',
              borderRadius: '14px',
              padding: '14px 28px',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.08em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-block',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
          >
            EXPLORE →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Section 2: Run Your Conference Fee-Free ───────────────────────────────────

function OrganiserSection() {
  const cards = [
    { icon: Users, title: 'Smart Assignment', desc: 'Preferences + experience scores. One-click auto-assign.' },
    { icon: FileText, title: 'Document Portal', desc: 'Study guides, position papers, feedback, all in one place.' },
    { icon: CreditCard, title: 'Transparent Fees', desc: 'No Gavelling surcharge on your fee. You keep 100% — Gavelling runs on Credits.' },
    { icon: Zap, title: 'Automated Comms', desc: 'Acceptance emails, allocation codes, reminders, sent automatically.' },
  ];

  return (
    <section className="relative px-6 md:px-14 py-20" style={{ backgroundColor: '#1B3828' }}>
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }}
      />
      <div className="relative flex flex-col md:flex-row gap-12 md:gap-16 items-start">
        {/* Left */}
        <div style={{ maxWidth: '400px' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05 }}>
            <span className="block text-white" style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}>Run your conference.</span>
            <span className="block" style={{ fontSize: 'clamp(32px, 4vw, 52px)', color: '#EED98A' }}>Fee-free.</span>
          </h2>
          <p className="mt-4 mb-8 text-sm leading-relaxed" style={{ color: 'rgba(237,231,216,0.7)', maxWidth: '400px', fontFamily: "'Outfit', sans-serif" }}>
            Zero platform fees for organisers. Gavelling handles registration, allocations, document management, session integration, and automated communications.
          </p>
          <Link
            href="/my-conferences"
            className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
          >
            START A CONFERENCE →
          </Link>
        </div>

        {/* Right, 2×2 grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(238,217,138,0.12)' }}>
                <Icon size={20} color="#EED98A" style={{ marginBottom: '8px' }} />
                <h3 className="font-semibold text-sm mb-1 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{card.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(237,231,216,0.6)', fontFamily: "'Outfit', sans-serif" }}>{card.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Section 3: Chair & Staff Board ────────────────────────────────────────────

function RolesSection() {
  const stats = [
    { number: '—', label: 'Open Positions', sub: 'Across all conferences' },
    { number: '—', label: 'Conferences Hiring', sub: 'Actively recruiting' },
    { number: '—', label: 'Roles Filled', sub: 'This season' },
  ];

  return (
    <section
      className="px-6 md:px-14 py-20"
      style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0' }}
    >
      <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start">
        {/* Left */}
        <div style={{ maxWidth: '420px' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05 }}>
            <span className="block" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#1C1410' }}>Looking to chair?</span>
            <span className="block" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#1B3828' }}>Find your next role.</span>
          </h2>
          <p className="mt-4 mb-6 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '420px', fontFamily: "'Outfit', sans-serif" }}>
            Conferences post open positions for chairs, secretariat, and staff. Apply directly through your Gavelling profile. Your MUN CV travels with you.
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {['CHAIRS', 'SECRETARIAT', 'STAFF'].map(pill => (
              <span
                key={pill}
                className="px-3 py-1.5 rounded-full text-[10px]"
                style={{ backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.15)', color: '#1B3828', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}
              >
                {pill}
              </span>
            ))}
          </div>
          <Link
            href="/conferences/roles"
            className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            FIND YOUR NEXT OPPORTUNITY →
          </Link>
        </div>

        {/* Right, stat cards */}
        <div className="flex-1 flex flex-col gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
              <span className="font-black text-3xl flex-shrink-0" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{stat.number}</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{stat.label}</p>
                <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section 4: MUN Across the Globe ──────────────────────────────────────────

function GlobeSection() {
  return (
    <section
      className="relative"
      style={{
        backgroundColor: '#1B3828',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
      />

      {/* Globe video, right side, absolutely positioned */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '52%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <video
          src="/map/interactive_globe.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '30% center', display: 'block', opacity: 0.82 }}
        />
        {/* Radial vignette, dissolves all edges into forest background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 80% 85% at 65% 50%, transparent 35%, rgba(27,56,40,0.45) 58%, rgba(27,56,40,0.82) 75%, #1B3828 95%)',
          }}
        />
        {/* Left edge hard stop, prevents globe bleeding into text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, #1B3828 0%, #1B3828 4%, rgba(27,56,40,0.6) 14%, transparent 28%)',
          }}
        />
      </div>

      {/* Left content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 56,
          paddingRight: 56,
          paddingTop: 100,
          paddingBottom: 40,
          maxWidth: 600,
          flex: 1,
        }}
      >
        <h2 style={{ margin: 0 }}>
          <span
            style={{
              display: 'block',
              color: 'white',
              fontSize: 'clamp(48px, 5.5vw, 80px)',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900,
              lineHeight: 1.0,
            }}
          >
            MUN Across
          </span>
          <span
            style={{
              display: 'block',
              color: '#EED98A',
              fontSize: 'clamp(48px, 5.5vw, 80px)',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900,
              lineHeight: 1.0,
            }}
          >
            the Globe.
          </span>
        </h2>
        <p
          style={{
            marginTop: 24,
            marginBottom: 40,
            fontSize: '16px',
            lineHeight: 1.7,
            color: 'rgba(237,231,216,0.75)',
            maxWidth: 440,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          From The Hague to Singapore, Tokyo to New York. Explore conferences on every continent and find your next destination.
        </p>
        <Link
          href="/conferences/map"
          className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
          style={{
            border: '1.5px solid rgba(238,217,138,0.4)',
            color: '#EED98A',
            backgroundColor: 'transparent',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.08em',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          EXPLORE CONFERENCES WORLDWIDE →
        </Link>
      </div>

      {/* Footer */}
      <footer
        className="relative z-10 px-6 py-8"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          backgroundColor: '#1B3828',
          borderTop: '1px solid rgba(238,217,138,0.1)',
        }}
      >
        <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
          <img
            src="/GavellingLogo.png"
            alt="Gavelling"
            className="h-7 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(85%) sepia(30%) saturate(500%) hue-rotate(5deg) brightness(105%)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.instagram.com/wearegavelling/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              style={{ color: 'rgba(238,217,138,0.5)', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#EED98A'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(238,217,138,0.5)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <span aria-label="LinkedIn (coming soon)" style={{ color: 'rgba(238,217,138,0.3)', cursor: 'default' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
              </svg>
            </span>
          </div>
          <p className="text-xs font-semibold md:text-right" style={{ color: 'rgba(238,217,138,0.45)' }}>© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
        </div>
      </footer>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ConferencesClient() {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav hideLanguage />

        <FeaturedSection />
        <OrganiserSection />
        <RolesSection />
        <GlobeSection />
      </div>
    </div>
  );
}
