'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, CalendarDays, Users } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { GRAIN, LabConference, LabFooter, formatDateRange, feeLabel } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 1 — "THE ATLAS DESK"
// Editorial split-screen: oversized type + numbered index of paths on the left,
// a physical "desk" of real conference dossiers (stacked, tilted cards over a
// faded map) on the right. Rootly-style floating product artefacts, but built
// from real data.
// ─────────────────────────────────────────────────────────────────────────────

function DeskCard({
  conf, index, total,
}: { conf: LabConference; index: number; total: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  const rotations = [-3.2, 2.4, -1.2, 3, -2];
  const rotation = rotations[index % rotations.length];

  return (
    <article
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer"
      style={{
        width: 'min(390px, 84%)',
        marginTop: index === 0 ? 0 : '-52px',
        marginLeft: index % 2 === 0 ? '0%' : '14%',
        position: 'relative',
        zIndex: hovered ? 30 : 10 + index,
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: hovered
          ? '0 28px 60px rgba(27,56,40,0.24), 0 4px 12px rgba(27,56,40,0.1)'
          : '0 14px 36px rgba(27,56,40,0.14), 0 2px 6px rgba(27,56,40,0.06)',
        transform: hovered
          ? 'rotate(0deg) translateY(-8px) scale(1.02)'
          : `rotate(${rotation}deg)`,
        transition: 'transform 340ms cubic-bezier(0.22,1,0.36,1), box-shadow 340ms ease',
      }}
    >
      {/* Banner strip */}
      <div style={{ height: '86px', position: 'relative', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <>
            <img
              src={conf.banner_url}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,28,21,0.5) 0%, rgba(16,28,21,0.05) 60%)' }} />
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, #16301F 0%, #2A5A3C 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.1 }} />
            <span
              aria-hidden
              style={{
                position: 'absolute', right: '12px', bottom: '-8px',
                fontFamily: "'DM Mono', monospace", fontSize: '46px', lineHeight: 1,
                color: 'rgba(238,217,138,0.14)', userSelect: 'none',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          </>
        )}
        {/* Dossier number */}
        <span
          className="absolute top-2.5 left-3"
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.16em',
            color: '#FAF8F3', backgroundColor: 'rgba(16,28,21,0.45)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(250,248,243,0.2)',
            padding: '3px 9px', borderRadius: '9999px',
          }}
        >
          N° {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </span>
      </div>

      {/* Free-floating logo, overlapping */}
      <div className="px-5" style={{ marginTop: '-30px', position: 'relative', zIndex: 2 }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: '62px', height: '62px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.35))',
            }}
          />
        ) : (
          <span
            style={{
              display: 'inline-block',
              fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 700,
              color: '#1B3828', backgroundColor: '#EDE7D8',
              border: '2px solid #FAF8F3', borderRadius: '13px', padding: '14px 12px',
              boxShadow: '0 4px 12px rgba(27,56,40,0.15)',
            }}
          >
            {conf.acronym.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>

      <div className="px-5 pt-2 pb-4">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>
        <h3 className="text-[15px] font-bold leading-snug" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: '0 0 8px 0' }}>
          {conf.full_name}
        </h3>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            {flagUrl && (
              <img
                src={flagUrl}
                alt={conf.country}
                style={{ width: '17px', height: '12px', borderRadius: '2.5px', objectFit: 'cover', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
              />
            )}
            <span className="text-xs" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
              {conf.city}
            </span>
          </span>
          <span aria-hidden style={{ color: '#B6871F', fontSize: '8px' }}>◆</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9A8A78' }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
          <span aria-hidden style={{ color: '#B6871F', fontSize: '8px' }}>◆</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: conf.fee_amount === 0 ? '#2A5A3C' : '#8A6614' }}>
            {feeLabel(conf)}
          </span>
        </div>
      </div>
    </article>
  );
}

const PATHS = [
  {
    n: '01',
    title: 'Explore the directory',
    desc: 'Every listed conference, filterable by continent, format and level.',
    href: '/conferences/explore',
  },
  {
    n: '02',
    title: 'Organise a conference',
    desc: 'Registration, allocations and comms — zero platform fees.',
    href: '/conferences/organise',
  },
  {
    n: '03',
    title: 'Find a role',
    desc: 'Chair, secretariat and staff openings across the circuit.',
    href: '/conferences/roles',
  },
];

function PathRow({ path }: { path: (typeof PATHS)[number] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={path.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex items-center gap-5 py-5"
      style={{
        textDecoration: 'none',
        borderTop: '1px solid rgba(221,212,192,0.9)',
        paddingLeft: hovered ? '10px' : '0px',
        transition: 'padding-left 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.14em',
          color: hovered ? '#B6871F' : '#9A8A78', flexShrink: 0, width: '26px',
          transition: 'color 200ms ease',
        }}
      >
        {path.n}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="font-black"
          style={{
            fontFamily: "'Outfit', sans-serif", fontSize: '19px',
            color: hovered ? '#1B3828' : '#1C1410', margin: 0, lineHeight: 1.2,
            transition: 'color 200ms ease',
          }}
        >
          {path.title}
        </p>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', color: '#9A8A78', margin: '2px 0 0 0' }}>
          {path.desc}
        </p>
      </div>
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '38px', height: '38px', borderRadius: '9999px',
          border: '1px solid',
          borderColor: hovered ? '#1B3828' : '#DDD4C0',
          backgroundColor: hovered ? '#1B3828' : 'transparent',
          transition: 'all 240ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <ArrowRight size={15} style={{ color: hovered ? '#EED98A' : '#1B3828', transition: 'color 200ms ease' }} />
      </span>
    </Link>
  );
}

export default function VariantAtlas({ conferences }: { conferences: LabConference[] }) {
  const desk = conferences.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Hero: split screen ─────────────────────────────────────── */}
        <section className="relative flex-1 px-6 md:px-14 pt-6 pb-16 lg:pb-24">
          <div className="flex flex-col lg:flex-row gap-14 lg:gap-8 items-start" style={{ maxWidth: '1320px', margin: '0 auto' }}>

            {/* Left — editorial index */}
            <div className="w-full lg:w-[52%] pt-4 lg:pt-10">
              <p
                className="mb-4"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.3em', color: '#B6871F' }}
              >
                GAVELLING CONFERENCES <span aria-hidden style={{ margin: '0 6px' }}>◆</span> 2026 SEASON
              </p>
              <h1
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(44px, 5.6vw, 84px)', lineHeight: 0.98,
                  color: '#1C1410', margin: 0, letterSpacing: '-0.015em',
                }}
              >
                Every MUN.
                <br />
                <span style={{ color: '#1B3828' }}>One atlas</span>
                <span style={{ color: '#B6871F' }}>.</span>
              </h1>
              <p
                className="mt-5 mb-10"
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', lineHeight: 1.65, color: '#8A7D6C', maxWidth: '400px' }}
              >
                Discover conferences worldwide, run your own fee-free, or land your
                next chairing role — all on one platform.
              </p>

              {/* Numbered index of the three paths */}
              <nav style={{ borderBottom: '1px solid rgba(221,212,192,0.9)', maxWidth: '520px' }}>
                {PATHS.map(p => <PathRow key={p.n} path={p} />)}
              </nav>

              {/* Mono stat line */}
              <p
                className="mt-8"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10.5px', letterSpacing: '0.18em', color: '#9A8A78' }}
              >
                {conferences.length} LISTED
                <span aria-hidden style={{ color: '#B6871F', margin: '0 10px' }}>◆</span>
                6 CONTINENTS
                <span aria-hidden style={{ color: '#B6871F', margin: '0 10px' }}>◆</span>
                0% ORGANISER FEES
              </p>
            </div>

            {/* Right — the desk */}
            <div className="w-full lg:w-[48%] relative flex flex-col items-center pt-8 lg:pt-2 pb-6">
              {/* Faded map behind the papers */}
              <img
                src="/map/world_map.png"
                alt=""
                aria-hidden
                className="pointer-events-none select-none"
                style={{
                  position: 'absolute', top: '-2%', left: '50%', transform: 'translateX(-50%) rotate(-2deg)',
                  width: '115%', maxWidth: 'none', opacity: 0.16, mixBlendMode: 'multiply',
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {/* Gold compass rule */}
              <div
                aria-hidden
                className="pointer-events-none hidden lg:block"
                style={{
                  position: 'absolute', top: '6%', right: '-2%',
                  fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.3em',
                  color: 'rgba(182,135,31,0.55)', transform: 'rotate(90deg)', transformOrigin: 'right top',
                }}
              >
                40.7128° N — 74.0060° W
              </div>

              {desk.map((conf, i) => (
                <DeskCard key={conf.id} conf={conf} index={i} total={desk.length} />
              ))}

              <Link
                href="/conferences/explore"
                className="mt-8 inline-flex items-center gap-1.5"
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '12px',
                  letterSpacing: '0.1em', color: '#1B3828', textDecoration: 'none',
                  borderBottom: '1.5px solid rgba(182,135,31,0.6)', paddingBottom: '3px',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(182,135,31,0.6)'; }}
              >
                OPEN THE FULL DIRECTORY
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Forest band: organise strip ────────────────────────────── */}
        <section className="relative px-6 md:px-14 py-12" style={{ backgroundColor: '#1B3828' }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
          />
          <div
            className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10"
            style={{ maxWidth: '1320px', margin: '0 auto' }}
          >
            <div className="flex-1">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.28em', color: 'rgba(238,217,138,0.65)', margin: '0 0 8px 0' }}>
                FOR SECRETARIATS
              </p>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 'clamp(24px, 2.8vw, 38px)', lineHeight: 1.1, margin: 0 }}>
                <span style={{ color: 'white' }}>Run your conference. </span>
                <span style={{ color: '#EED98A' }}>Fee-free.</span>
              </h2>
              <p className="mt-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13.5px', color: 'rgba(237,231,216,0.7)', maxWidth: '480px', lineHeight: 1.6 }}>
                Registration, smart allocations, document portal and automated comms —
                Gavelling takes 0% from organisers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/conferences/organise"
                className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] transition-all focus:outline-none"
                style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                START A CONFERENCE →
              </Link>
              <Link
                href="/conferences/roles"
                className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] transition-colors focus:outline-none"
                style={{
                  border: '1.5px solid rgba(238,217,138,0.4)', color: '#EED98A',
                  fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                BROWSE ROLES →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Slim proof strip ───────────────────────────────────────── */}
        <section className="px-6 md:px-14 py-10" style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0' }}>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-6"
            style={{ maxWidth: '1320px', margin: '0 auto' }}
          >
            {[
              { icon: CalendarDays, head: 'Live listings', sub: 'Real dates, fees and application windows — no stale directories.' },
              { icon: Users, head: 'One MUN profile', sub: 'Your CV and conference history travel with every application.' },
              { icon: ArrowUpRight, head: 'Session-ready', sub: 'Committees plug straight into Gavelling’s live debate tools.' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.head} className="flex items-start gap-3.5">
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: '36px', height: '36px', borderRadius: '11px', backgroundColor: 'rgba(182,135,31,0.12)' }}
                  >
                    <Icon size={16} style={{ color: '#B6871F' }} />
                  </span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{item.head}</p>
                    <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55, margin: 0 }}>{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <LabFooter />
      </div>
    </div>
  );
}
