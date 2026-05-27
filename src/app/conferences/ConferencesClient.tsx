'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, FileText, CreditCard, Zap } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { createAuthClient } from '@/lib/supabase-auth';

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
  const [conferences, setConferences] = useState<FeaturedConf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const supabase = createAuthClient();
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, city, country, start_date, end_date, fee_amount, fee_currency, logo_url, expected_delegates')
        .eq('is_public', true)
        .order('start_date', { ascending: true })
        .limit(3);
      setConferences((data as FeaturedConf[]) ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <section style={{ backgroundColor: '#EDE7D8' }} className="px-6 md:px-14 py-20">
      <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start">
        {/* Left column */}
        <div style={{ maxWidth: '540px' }}>
          <p
            className="text-[10px] tracking-widest mb-3"
            style={{ color: 'rgba(28,20,16,0.4)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.2em' }}
          >
            CONFERENCES
          </p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05 }}>
            <span className="block" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)', color: '#1C1410' }}>Find Your Next</span>
            <span className="block" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)', color: '#1B3828' }}>Conference.</span>
          </h2>
          <p className="mt-4 mb-8 text-base leading-relaxed" style={{ color: '#9A8A78', maxWidth: '440px', fontFamily: "'Outfit', sans-serif" }}>
            Browse hundreds of MUN conferences worldwide. Apply as a delegate, find your committee, and manage everything through Gavelling.
          </p>
          <Link
            href="/conferences/explore"
            className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            EXPLORE CONFERENCES AS A DELEGATE →
          </Link>
        </div>

        {/* Right column — conference preview cards */}
        <div className="flex-1 w-full flex flex-col gap-3" style={{ maxWidth: '480px' }}>
          {loading ? (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} className="animate-pulse rounded-2xl" style={{ height: '80px', backgroundColor: '#DDD4C0' }} />
              ))}
            </>
          ) : conferences.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-10 px-6 text-center"
              style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                No conferences listed yet — be the first!
              </p>
              <Link
                href="/conferences/organise"
                className="text-xs font-bold mt-2 transition-colors"
                style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", textDecoration: 'underline' }}
              >
                Organise yours →
              </Link>
            </div>
          ) : (
            conferences.map(conf => (
              <Link
                key={conf.id}
                href={`/conferences/${conf.slug}`}
                className="block rounded-2xl px-5 py-4 transition-all focus:outline-none"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1px solid #DDD4C0',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1B3828';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(27,56,40,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Row 1: logo + name + arrow */}
                <div className="flex items-center gap-3 mb-1">
                  {conf.logo_url ? (
                    <img src={conf.logo_url} alt={conf.acronym} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EDE7D8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#1C1410', fontWeight: 700 }}>
                        {conf.acronym.slice(0, 3).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <p className="flex-1 text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    {conf.full_name}
                  </p>
                  <span style={{ color: '#9A8A78', flexShrink: 0 }}>→</span>
                </div>
                {/* Row 2: location + date + fee */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    {conf.city}, {conf.country}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                      {formatDateRange(conf.start_date, conf.end_date)}
                    </span>
                    {conf.fee_amount === 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(61,122,82,0.1)', color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>FREE</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(27,56,40,0.06)', color: '#1C1410', fontFamily: "'DM Mono', monospace" }}>
                        {conf.fee_currency} {conf.fee_amount.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

// ── Section 2: Run Your Conference Fee-Free ───────────────────────────────────

function OrganiserSection() {
  const cards = [
    { icon: Users, title: 'Smart Assignment', desc: 'Preferences + experience scores. One-click auto-assign.' },
    { icon: FileText, title: 'Document Portal', desc: 'Study guides, position papers, feedback — all in one place.' },
    { icon: CreditCard, title: 'Transparent Fees', desc: '5% delegate surcharge, waived with Gavelling Unlimited. You keep 100%.' },
    { icon: Zap, title: 'Automated Comms', desc: 'Acceptance emails, allocation codes, reminders — sent automatically.' },
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
          <p className="text-[10px] tracking-widest mb-3" style={{ color: 'rgba(238,217,138,0.6)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.2em' }}>
            FOR ORGANISERS
          </p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05 }}>
            <span className="block text-white" style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}>Run your conference.</span>
            <span className="block" style={{ fontSize: 'clamp(32px, 4vw, 52px)', color: '#EED98A' }}>Fee-free.</span>
          </h2>
          <p className="mt-4 mb-8 text-sm leading-relaxed" style={{ color: 'rgba(237,231,216,0.7)', maxWidth: '400px', fontFamily: "'Outfit', sans-serif" }}>
            Zero platform fees for organisers. Gavelling handles registration, allocations, document management, session integration, and automated communications.
          </p>
          <Link
            href="/conferences/organise"
            className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
          >
            START A CONFERENCE →
          </Link>
        </div>

        {/* Right — 2×2 grid */}
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
          <p className="text-[10px] tracking-widest mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.2em' }}>
            CHAIR &amp; STAFF BOARD
          </p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05 }}>
            <span className="block" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#1C1410' }}>Looking to chair?</span>
            <span className="block" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#1B3828' }}>Find your next role.</span>
          </h2>
          <p className="mt-4 mb-6 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '420px', fontFamily: "'Outfit', sans-serif" }}>
            Conferences post open positions for chairs, secretariat, and staff. Apply directly through your Gavelling profile — your MUN CV travels with you.
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {['CHAIRS', 'SECRETARIAT', 'STAFF'].map(pill => (
              <span
                key={pill}
                className="px-3 py-1.5 rounded-full text-[10px]"
                style={{ backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.15)', color: '#1B3828', fontFamily: "'DM Mono', monospace" }}
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

        {/* Right — stat cards */}
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

      {/* Globe video — right side, absolutely positioned */}
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
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '30% center', display: 'block' }}
        />
        {/* Top/bottom fade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(27,56,40,0.4) 0%, transparent 15%, transparent 85%, rgba(27,56,40,0.6) 100%)',
          }}
        />
        {/* Right edge fade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to left, #1B3828 0%, rgba(27,56,40,0.5) 8%, transparent 22%)',
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
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(238,217,138,0.6)',
            letterSpacing: '0.2em',
            margin: '0 0 16px 0',
          }}
        >
          GLOBAL MUN
        </p>
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
            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.instagram.com/wearegavelling/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              style={{ color: 'rgba(237,231,216,0.35)', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#EED98A'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(237,231,216,0.35)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <span aria-label="LinkedIn (coming soon)" style={{ color: 'rgba(237,231,216,0.2)', cursor: 'default' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
              </svg>
            </span>
          </div>
          <p className="text-xs font-semibold md:text-right" style={{ color: 'rgba(237,231,216,0.45)' }}>© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
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
        <SiteNav />

        <FeaturedSection />
        <OrganiserSection />
        <RolesSection />
        <GlobeSection />
      </div>
    </div>
  );
}
