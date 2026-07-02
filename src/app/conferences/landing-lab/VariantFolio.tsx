'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  GRAIN, LabConference, LabFooter, LabSearch,
  COPY, ORGANISER_CARDS, ROLES_PILLS,
  formatDateRange, feeLabel,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 2 — "FOLIO"
// Asymmetric editorial catalogue. Hero: giant stacked left-aligned type with an
// underlined search rule; featured conferences as a right-hand index list
// (free-floating logos, hairline rows). The organiser / roles / globe sections
// keep their exact copy but flow as numbered editorial bands (02/03/04) with a
// label rail on the left. Typography does the work; colour stays neutral.
// ─────────────────────────────────────────────────────────────────────────────

function IndexRow({ conf, index }: { conf: LabConference; index: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  return (
    <div
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-4 py-4 cursor-pointer"
      style={{
        borderBottom: '1px solid rgba(221,212,192,0.9)',
        paddingLeft: hovered ? '8px' : '0px',
        transition: 'padding-left 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.14em',
          color: hovered ? '#B6871F' : '#9A8A78', width: '22px', flexShrink: 0,
          transition: 'color 200ms ease',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Free-floating logo */}
      {conf.logo_url ? (
        <img
          src={conf.logo_url}
          alt={conf.acronym}
          className="flex-shrink-0"
          style={{ width: '46px', height: '46px', objectFit: 'contain', filter: 'drop-shadow(0 5px 10px rgba(16,28,21,0.25))' }}
        />
      ) : (
        <span
          className="flex-shrink-0"
          style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#1B3828', width: '46px', textAlign: 'center' }}
        >
          {conf.acronym.slice(0, 4).toUpperCase()}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p
          className="truncate font-bold text-[14.5px]"
          style={{
            color: hovered ? '#1B3828' : '#1C1410', fontFamily: "'Outfit', sans-serif",
            margin: 0, transition: 'color 200ms ease',
          }}
        >
          {conf.full_name}
        </p>
        <p className="flex items-center gap-1.5 mt-0.5" style={{ margin: 0 }}>
          {flagUrl && (
            <img
              src={flagUrl}
              alt={conf.country}
              style={{ width: '15px', height: '11px', borderRadius: '2px', objectFit: 'cover', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
            />
          )}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.06em', color: '#9A8A78' }}>
            {conf.city} <span aria-hidden style={{ color: '#B6871F' }}>◆</span> {formatDateRange(conf.start_date, conf.end_date)} <span aria-hidden style={{ color: '#B6871F' }}>◆</span> {feeLabel(conf)}
          </span>
        </p>
      </div>

      <ArrowUpRight
        size={15}
        className="flex-shrink-0"
        style={{
          color: hovered ? '#1B3828' : '#9A8A78',
          transform: hovered ? 'translate(2px, -2px)' : 'none',
          transition: 'all 220ms cubic-bezier(0.22,1,0.36,1)',
        }}
      />
    </div>
  );
}

// Numbered editorial band wrapper: label rail left, content right
function Band({
  no, label, children, cream = false,
}: { no: string; label: string; children: React.ReactNode; cream?: boolean }) {
  return (
    <section
      className="px-6 md:px-14 py-16"
      style={{
        backgroundColor: cream ? '#FAF8F3' : 'transparent',
        borderTop: '1px solid rgba(221,212,192,0.9)',
      }}
    >
      <div className="flex flex-col md:flex-row gap-8 md:gap-12" style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <div className="md:w-[180px] flex-shrink-0 flex md:flex-col items-baseline md:items-start gap-3 md:gap-2">
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '26px', color: 'rgba(27,56,40,0.22)', lineHeight: 1 }}>
            {no}
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.26em', color: '#B6871F' }}>
            {label}
          </span>
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </section>
  );
}

export default function VariantFolio({ conferences }: { conferences: LabConference[] }) {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Hero — asymmetric: giant type + underlined search left, index right */}
        <section className="px-6 md:px-14 pt-10 md:pt-16 pb-16">
          <div className="flex flex-col lg:flex-row gap-14 lg:gap-16" style={{ maxWidth: '1240px', margin: '0 auto' }}>

            {/* Left */}
            <div className="flex-1 min-w-0">
              <p
                className="mb-5"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.3em', color: '#B6871F' }}
              >
                01 <span aria-hidden style={{ margin: '0 6px' }}>◆</span> GAVELLING CONFERENCES
              </p>
              <h1
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(52px, 7.6vw, 116px)', lineHeight: 0.94,
                  letterSpacing: '-0.02em', color: '#1C1410', margin: 0,
                }}
              >
                {COPY.heroLine1}
                <br />
                <span style={{ color: '#1B3828' }}>{COPY.heroLine2}</span>
              </h1>

              {/* Underlined search rule */}
              <div className="mt-10 flex items-end gap-5" style={{ maxWidth: '560px' }}>
                <LabSearch conferences={conferences} appearance="underline" />
                <Link
                  href="/conferences/explore"
                  className="flex items-center gap-1.5 flex-shrink-0 pb-3"
                  style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px',
                    letterSpacing: '0.08em', color: '#1B3828', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                >
                  EXPLORE
                  <ArrowRight size={15} />
                </Link>
              </div>

              <p
                className="mt-8"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', color: '#9A8A78' }}
              >
                {conferences.length} LISTED
                <span aria-hidden style={{ color: '#B6871F', margin: '0 10px' }}>◆</span>
                6 CONTINENTS
                <span aria-hidden style={{ color: '#B6871F', margin: '0 10px' }}>◆</span>
                FEE-FREE FOR ORGANISERS
              </p>
            </div>

            {/* Right — featured index */}
            <aside className="w-full lg:w-[400px] flex-shrink-0 lg:pt-2">
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: '#9A8A78' }}>
                  FEATURED
                </span>
                <Link
                  href="/conferences/explore"
                  style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#1B3828', textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#B6871F'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                >
                  ALL →
                </Link>
              </div>
              <div style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
                {conferences.slice(0, 4).map((conf, i) => (
                  <IndexRow key={conf.id} conf={conf} index={i} />
                ))}
              </div>
            </aside>
          </div>
        </section>

        {/* ── 02 — Organiser band ────────────────────────────────────── */}
        <Band no="02" label="FOR ORGANISERS" cream>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
            <span style={{ fontSize: 'clamp(28px, 3.4vw, 46px)', color: '#1C1410' }}>{COPY.organiserTitle1} </span>
            <span style={{ fontSize: 'clamp(28px, 3.4vw, 46px)', color: '#1B3828' }}>{COPY.organiserTitle2}</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '540px', fontFamily: "'Outfit', sans-serif" }}>
            {COPY.organiserBody}
          </p>

          {/* Features as an editorial two-column list, not cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 mt-8" style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
            {ORGANISER_CARDS.map(card => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="flex items-start gap-3.5 py-4"
                  style={{ borderBottom: '1px solid rgba(221,212,192,0.9)' }}
                >
                  <Icon size={16} style={{ color: '#1B3828', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {card.title}
                    </p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {card.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <Link
            href="/conferences/organise"
            className="inline-block mt-8 rounded-2xl py-3.5 px-7 font-bold text-[13px] tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {COPY.organiserCta}
          </Link>
        </Band>

        {/* ── 03 — Roles band ────────────────────────────────────────── */}
        <Band no="03" label="CHAIR & STAFF BOARD">
          <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-14">
            <div className="flex-1">
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
                <span className="block" style={{ fontSize: 'clamp(28px, 3.4vw, 46px)', color: '#1C1410' }}>{COPY.rolesTitle1}</span>
                <span className="block" style={{ fontSize: 'clamp(28px, 3.4vw, 46px)', color: '#1B3828' }}>{COPY.rolesTitle2}</span>
              </h2>
              <p className="mt-3 mb-7 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '480px', fontFamily: "'Outfit', sans-serif" }}>
                {COPY.rolesBody}
              </p>
              <Link
                href="/conferences/roles"
                className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] tracking-widest transition-colors focus:outline-none"
                style={{
                  border: '1.5px solid rgba(27,56,40,0.4)', color: '#1B3828', backgroundColor: 'transparent',
                  fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {COPY.rolesCta}
              </Link>
            </div>

            {/* Oversized stacked role words */}
            <div className="flex-shrink-0 md:text-right">
              {ROLES_PILLS.map((pill, i) => (
                <Link
                  key={pill}
                  href="/conferences/roles"
                  className="block group"
                  style={{ textDecoration: 'none' }}
                >
                  <span
                    className="transition-colors"
                    style={{
                      fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                      fontSize: 'clamp(30px, 3.6vw, 52px)', lineHeight: 1.12,
                      color: i === 0 ? 'rgba(27,56,40,0.9)' : 'rgba(28,20,16,0.16)',
                      letterSpacing: '-0.01em',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(27,56,40,0.9)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = i === 0 ? 'rgba(27,56,40,0.9)' : 'rgba(28,20,16,0.16)'; }}
                  >
                    {pill}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Band>

        {/* ── 04 — Globe band ────────────────────────────────────────── */}
        <Band no="04" label="WORLDWIDE" cream>
          <div className="flex flex-col md:flex-row gap-10 md:items-center">
            <div className="flex-1">
              <h2 style={{ margin: 0 }}>
                <span
                  style={{
                    display: 'block', color: '#1C1410', fontSize: 'clamp(30px, 3.8vw, 52px)',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0,
                  }}
                >
                  {COPY.globeTitle1}
                </span>
                <span
                  style={{
                    display: 'block', color: '#1B3828', fontSize: 'clamp(30px, 3.8vw, 52px)',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0,
                  }}
                >
                  {COPY.globeTitle2}
                </span>
              </h2>
              <p
                className="mt-4 mb-8"
                style={{ fontSize: '14px', lineHeight: 1.7, color: '#8A7D6C', maxWidth: '400px', fontFamily: "'Outfit', sans-serif" }}
              >
                {COPY.globeBody}
              </p>
              <Link
                href="/conferences/map"
                className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] tracking-widest transition-colors focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {COPY.globeCta}
              </Link>
            </div>

            {/* Framed globe video — contained media, page stays light */}
            <div
              className="w-full md:w-[380px] flex-shrink-0 overflow-hidden"
              style={{
                borderRadius: '22px',
                border: '1px solid #DDD4C0',
                boxShadow: '0 16px 40px rgba(27,56,40,0.12)',
                aspectRatio: '4 / 3',
                position: 'relative',
              }}
            >
              <video
                src="/map/interactive_globe.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span
                className="absolute bottom-3 left-3"
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em',
                  color: '#FAF8F3', backgroundColor: 'rgba(16,28,21,0.4)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(250,248,243,0.2)',
                  padding: '4px 11px', borderRadius: '9999px',
                }}
              >
                6 CONTINENTS
              </span>
            </div>
          </div>
        </Band>

        <LabFooter />
      </div>
    </div>
  );
}
