'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Gavel, Megaphone } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { GRAIN, LabConference, LabFooter, formatDateRange, feeLabel } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 2 — "THE BROADSHEET"
// Oversized typographic hero (front-page masthead energy), a DM Mono marquee
// ticker of the live circuit, then a bento mosaic: one full-bleed featured
// conference photo tile + supporting conference tiles + organise/roles tiles
// + a globe-video strip. Asymmetric, editorial, dense but scannable.
// ─────────────────────────────────────────────────────────────────────────────

function Flag({ country, size = 17 }: { country: string; size?: number }) {
  const c = getCountryByName(country);
  if (!c) return null;
  return (
    <img
      src={getFlagUrl(c.code)}
      alt={country}
      style={{
        width: `${size}px`, height: `${Math.round(size * 0.72)}px`,
        borderRadius: '2.5px', objectFit: 'cover', flexShrink: 0,
        boxShadow: '0 1px 2px rgba(27,56,40,0.25)',
      }}
    />
  );
}

// Featured tile — full-bleed banner photo
function FeaturedTile({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return (
    <article
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer overflow-hidden flex flex-col justify-end lg:col-span-7 lg:row-span-2"
      style={{
        minHeight: '440px',
        borderRadius: '24px',
        border: '1px solid rgba(27,56,40,0.25)',
        boxShadow: hovered ? '0 24px 56px rgba(27,56,40,0.22)' : '0 6px 20px rgba(27,56,40,0.1)',
        transition: 'box-shadow 300ms ease',
      }}
    >
      {conf.banner_url ? (
        <img
          src={conf.banner_url}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 900ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,28,21,0.9) 0%, rgba(16,28,21,0.32) 48%, rgba(16,28,21,0.12) 100%)' }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
      />

      {/* Featured ribbon */}
      <span
        className="absolute top-4 left-4"
        style={{
          fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.22em',
          color: '#1B3828', backgroundColor: '#EED98A',
          padding: '5px 12px', borderRadius: '9999px', fontWeight: 700,
        }}
      >
        FEATURED
      </span>

      <div className="relative p-6 md:p-8 flex items-end gap-5">
        {conf.logo_url && (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            className="hidden sm:block flex-shrink-0"
            style={{
              width: '108px', height: '108px', objectFit: 'contain',
              filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.5))',
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.24em', color: '#EED98A', margin: '0 0 5px 0' }}>
            {conf.acronym}
          </p>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 'clamp(22px, 2.6vw, 34px)', lineHeight: 1.05, color: 'white', margin: '0 0 8px 0', textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}>
            {conf.full_name}
          </h3>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Flag country={conf.country} size={18} />
              <span style={{ fontSize: '13px', color: 'rgba(237,231,216,0.92)', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
                {conf.city}, {conf.country}
              </span>
            </span>
            <span aria-hidden style={{ color: 'rgba(238,217,138,0.6)', fontSize: '9px' }}>◆</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(237,231,216,0.8)' }}>
              {formatDateRange(conf.start_date, conf.end_date)}
            </span>
            <span aria-hidden style={{ color: 'rgba(238,217,138,0.6)', fontSize: '9px' }}>◆</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(237,231,216,0.8)' }}>
              {conf.expected_delegates.toLocaleString()} DELEGATES
            </span>
          </div>
        </div>
        <span
          className="hidden md:flex items-center justify-center flex-shrink-0"
          style={{
            width: '46px', height: '46px', borderRadius: '9999px',
            backgroundColor: hovered ? '#EED98A' : 'rgba(250,248,243,0.14)',
            border: '1px solid rgba(250,248,243,0.3)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            transition: 'background-color 260ms ease',
          }}
        >
          <ArrowUpRight size={18} style={{ color: hovered ? '#1B3828' : '#FAF8F3', transition: 'color 260ms ease' }} />
        </span>
      </div>
    </article>
  );
}

// Cream tile for the other real conferences
function ConfTile({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return (
    <article
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer overflow-hidden flex flex-col justify-between p-5"
      style={{
        borderRadius: '20px',
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid rgba(27,56,40,0.5)' : '1px solid #DDD4C0',
        boxShadow: hovered ? '0 16px 40px rgba(27,56,40,0.16)' : '0 1px 3px rgba(27,56,40,0.05)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 260ms cubic-bezier(0.22,1,0.36,1)',
        minHeight: '208px',
      }}
    >
      {/* Ghost acronym */}
      <span
        aria-hidden
        style={{
          position: 'absolute', right: '10px', top: '-14px',
          fontFamily: "'DM Mono', monospace", fontSize: '72px', lineHeight: 1,
          color: 'rgba(27,56,40,0.05)', userSelect: 'none', letterSpacing: '-0.02em',
        }}
      >
        {conf.acronym.slice(0, 5)}
      </span>

      <div className="flex items-start justify-between gap-3">
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{ width: '58px', height: '58px', objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(16,28,21,0.28))' }}
          />
        ) : (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 700, color: '#1B3828' }}>
            {conf.acronym.slice(0, 4).toUpperCase()}
          </span>
        )}
        <span
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.1em',
            color: conf.fee_amount === 0 ? '#2A5A3C' : '#8A6614',
            backgroundColor: conf.fee_amount === 0 ? 'rgba(61,122,82,0.12)' : 'rgba(182,135,31,0.1)',
            padding: '4px 10px', borderRadius: '9999px',
          }}
        >
          {feeLabel(conf)}
        </span>
      </div>

      <div className="relative mt-4">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>
        <h3 className="text-[15px] font-bold leading-snug" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: '0 0 7px 0' }}>
          {conf.full_name}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <Flag country={conf.country} />
            <span className="text-xs truncate" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
              {conf.city}
            </span>
            <span aria-hidden style={{ color: '#B6871F', fontSize: '7px' }}>◆</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9A8A78', whiteSpace: 'nowrap' }}>
              {formatDateRange(conf.start_date, conf.end_date)}
            </span>
          </span>
          <ArrowRight
            size={14}
            style={{ color: '#1B3828', flexShrink: 0, transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 220ms ease' }}
          />
        </div>
      </div>
    </article>
  );
}

// Marquee row
function Marquee({ conferences }: { conferences: LabConference[] }) {
  const items = conferences.length
    ? conferences.map(c => `${c.acronym} — ${c.city.toUpperCase()} — ${formatDateRange(c.start_date, c.end_date).toUpperCase()}`)
    : ['THE GLOBAL MUN CIRCUIT'];
  const line = [...items, 'APPLICATIONS OPEN', '6 CONTINENTS', 'FEE-FREE FOR ORGANISERS'];
  // Duplicate for a seamless loop
  const doubled = [...line, ...line, ...line];

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0', backgroundColor: 'rgba(250,248,243,0.5)' }}
    >
      <div
        className="flex items-center whitespace-nowrap"
        style={{ animation: 'lab-marquee 42s linear infinite', width: 'max-content', padding: '12px 0' }}
      >
        {doubled.map((text, i) => (
          <span key={i} className="flex items-center">
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.18em', color: '#6B5F52' }}>
              {text}
            </span>
            <span aria-hidden className="mx-6" style={{ color: '#B6871F', fontSize: '9px' }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function VariantBroadsheet({ conferences }: { conferences: LabConference[] }) {
  const withBanner = conferences.find(c => c.banner_url) ?? conferences[0];
  const rest = conferences.filter(c => c.id !== withBanner?.id).slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      <style>{`
        @keyframes lab-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>

      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Masthead hero ──────────────────────────────────────────── */}
        <header className="px-6 md:px-14 pt-10 pb-10 md:pt-16 md:pb-14">
          <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.3em', color: '#B6871F', margin: 0 }}>
                THE CONFERENCE PAGES
              </p>
              <p className="hidden md:block" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: '#9A8A78', margin: 0 }}>
                VOL. I <span aria-hidden style={{ color: '#B6871F' }}>◆</span> {new Date().getFullYear()} SEASON
              </p>
            </div>
            <h1
              style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: 'clamp(56px, 9.6vw, 148px)', lineHeight: 0.92,
                letterSpacing: '-0.025em', color: '#1C1410', margin: 0,
              }}
            >
              MODEL UN,
              <br />
              <span style={{ color: '#1B3828' }}>WORLDWIDE</span>
              <span style={{ color: '#B6871F' }}>.</span>
            </h1>

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mt-7">
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', lineHeight: 1.65, color: '#8A7D6C', maxWidth: '430px', margin: 0 }}>
                The circuit’s conferences, roles and secretariat tools — collected on
                one page. Delegates find. Organisers run. Chairs get hired.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/conferences/explore"
                  className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] transition-all focus:outline-none"
                  style={{
                    backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '0.08em', textDecoration: 'none', boxShadow: '0 8px 24px rgba(27,56,40,0.22)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  EXPLORE CONFERENCES →
                </Link>
                <Link
                  href="/conferences/organise"
                  className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] transition-colors focus:outline-none"
                  style={{
                    border: '1.5px solid rgba(27,56,40,0.35)', color: '#1B3828',
                    fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  ORGANISE ONE →
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ── Marquee ticker ─────────────────────────────────────────── */}
        <Marquee conferences={conferences} />

        {/* ── Bento mosaic ───────────────────────────────────────────── */}
        <main className="px-6 md:px-14 py-12 flex-1">
          <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
            <div className="flex items-center gap-4 mb-6">
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.24em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
                ON THE CIRCUIT
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />
              <Link
                href="/conferences/explore"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#1B3828', textDecoration: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#B6871F'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              >
                VIEW ALL →
              </Link>
            </div>

            <div
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
              style={{ gridAutoRows: 'minmax(208px, auto)' }}
            >
              {/* Featured photo tile — spans 7 cols, 2 rows */}
              {withBanner && <FeaturedTile conf={withBanner} />}

              {/* Right column: other conferences */}
              <div className="flex flex-col gap-5 lg:col-span-5 lg:row-span-2">
                {rest.map(conf => <ConfTile key={conf.id} conf={conf} />)}
                {/* Roles mini-tile fills leftover space */}
                <RolesTile />
              </div>

              {/* Organise tile — forest */}
              <OrganiseTile />

              {/* Globe strip → explore */}
              <GlobeTile />
            </div>
          </div>
        </main>

        <LabFooter />
      </div>
    </div>
  );
}

function RolesTile() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href="/conferences/roles"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex-1 flex items-center gap-4 p-5 overflow-hidden"
      style={{
        borderRadius: '20px',
        backgroundColor: 'rgba(238,217,138,0.28)',
        border: hovered ? '1px solid rgba(182,135,31,0.6)' : '1px solid rgba(182,135,31,0.3)',
        textDecoration: 'none', minHeight: '116px',
        boxShadow: hovered ? '0 12px 32px rgba(27,56,40,0.14)' : 'none',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: 'rgba(182,135,31,0.18)' }}
      >
        <Gavel size={20} style={{ color: '#B6871F' }} />
      </span>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#8A6614', margin: '0 0 3px 0' }}>
          CHAIR & STAFF BOARD
        </p>
        <p className="font-black text-[16px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0, lineHeight: 1.2 }}>
          Find your next role
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#8A7D6C', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
          Chairs, secretariat & staff openings.
        </p>
      </div>
      <ArrowRight size={16} style={{ color: '#1B3828', flexShrink: 0, transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 220ms ease' }} />
    </Link>
  );
}

function OrganiseTile() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href="/conferences/organise"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col justify-between p-6 overflow-hidden lg:col-span-5"
      style={{
        borderRadius: '20px', backgroundColor: '#1B3828', textDecoration: 'none',
        border: '1px solid rgba(238,217,138,0.18)', minHeight: '208px',
        boxShadow: hovered ? '0 20px 48px rgba(27,56,40,0.35)' : '0 4px 16px rgba(27,56,40,0.18)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', right: '-8px', bottom: '-22px',
          fontFamily: "'DM Mono', monospace", fontSize: '110px', lineHeight: 1,
          color: 'rgba(238,217,138,0.06)', userSelect: 'none',
        }}
      >
        0%
      </span>
      <div className="relative flex items-center justify-between">
        <span
          className="flex items-center justify-center"
          style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: 'rgba(238,217,138,0.14)' }}
        >
          <Megaphone size={20} style={{ color: '#EED98A' }} />
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(238,217,138,0.6)' }}>
          FOR SECRETARIATS
        </span>
      </div>
      <div className="relative">
        <p className="font-black" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', lineHeight: 1.1, margin: '0 0 4px 0' }}>
          <span style={{ color: 'white' }}>Run yours, </span>
          <span style={{ color: '#EED98A' }}>fee-free.</span>
        </p>
        <p className="text-xs" style={{ color: 'rgba(237,231,216,0.65)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55, margin: '0 0 12px 0', maxWidth: '320px' }}>
          Registration, allocations, documents and comms — organisers keep 100%.
        </p>
        <span
          className="inline-flex items-center gap-1.5 font-bold text-[12px]"
          style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
        >
          START A CONFERENCE
          <ArrowRight size={14} style={{ transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 220ms ease' }} />
        </span>
      </div>
    </Link>
  );
}

function GlobeTile() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href="/conferences/explore"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center overflow-hidden p-6 lg:col-span-7"
      style={{
        borderRadius: '20px', backgroundColor: '#122418', textDecoration: 'none',
        border: '1px solid rgba(238,217,138,0.14)', minHeight: '208px',
        boxShadow: hovered ? '0 20px 48px rgba(27,56,40,0.3)' : '0 4px 16px rgba(27,56,40,0.16)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <video
        src="/map/interactive_globe.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute', right: '-6%', top: '50%', transform: 'translateY(-50%)',
          width: '58%', height: '160%', objectFit: 'cover', objectPosition: 'center',
          opacity: 0.75, pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #122418 32%, rgba(18,36,24,0.55) 62%, rgba(18,36,24,0.15) 100%)' }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
      />
      <div className="relative" style={{ maxWidth: '55%' }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(238,217,138,0.6)', margin: '0 0 6px 0' }}>
          SIX CONTINENTS
        </p>
        <p className="font-black" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', lineHeight: 1.1, color: 'white', margin: '0 0 12px 0' }}>
          MUN across <span style={{ color: '#EED98A' }}>the globe.</span>
        </p>
        <span
          className="inline-flex items-center gap-1.5 font-bold text-[12px]"
          style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
        >
          BROWSE BY CONTINENT
          <ArrowRight size={14} style={{ transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 220ms ease' }} />
        </span>
      </div>
    </Link>
  );
}
