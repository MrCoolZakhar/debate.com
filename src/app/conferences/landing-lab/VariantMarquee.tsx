'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  GRAIN, LabConference, LabFooter, LabSearch,
  COPY, ORGANISER_CARDS, ROLES_PILLS,
  formatDateRange, feeLabel, confTiming, timingColors, upcomingFirst, circuitStats,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 3 — "MARQUEE"
// Poster-gallery art direction. The hero is a split: headline + search on the
// left, a snap-scrolling rail of tall conference posters on the right — each
// poster is a mini landing page with countdown, applications-open pill and
// APPLY. A slow ticker of conference names and dates runs beneath the fold.
// The organiser section pairs the copy with an editorial photograph.
//
// Organiser photograph: Lady Justice statue — Tingey Injury Law Firm via
// Unsplash (images.unsplash.com/photo-1589829545856-d10d557cf95f, Unsplash
// License). Stored locally at /landing/lady-justice.jpg.
// ─────────────────────────────────────────────────────────────────────────────

function PosterCard({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const timing = confTiming(conf);
  const colors = timingColors(timing.tone);

  return (
    <article
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer overflow-hidden flex flex-col flex-shrink-0 snap-center"
      style={{
        width: '312px',
        height: '448px',
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid rgba(27,56,40,0.45)' : '1px solid #DDD4C0',
        borderRadius: '26px',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 28px 60px rgba(27,56,40,0.18), 0 4px 12px rgba(27,56,40,0.08)'
          : '0 10px 30px rgba(27,56,40,0.09)',
        transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1), box-shadow 300ms ease, border-color 300ms ease',
      }}
    >
      {/* Poster image — top 55% */}
      <div className="relative" style={{ height: '55%', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <img
            src={conf.banner_url}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 800ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg, #E7DFCC 0%, #DDD4C0 70%, #D3C8B0 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'multiply', opacity: 0.16 }} />
            <span
              aria-hidden
              style={{
                position: 'absolute', left: '18px', bottom: '6px',
                fontFamily: "'DM Mono', monospace", fontSize: '58px', lineHeight: 1,
                color: 'rgba(27,56,40,0.1)', userSelect: 'none',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          </>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(250,248,243,0.45) 0%, transparent 30%)' }} />
        {/* Countdown chip */}
        <span
          className="absolute top-4 left-4 rounded-full px-2.5 py-1"
          style={{
            backgroundColor: colors.bg, color: colors.fg,
            fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.14em',
            boxShadow: '0 4px 12px rgba(27,56,40,0.25)',
          }}
        >
          {timing.label}
        </span>
        {timing.tone !== 'past' && (
          <span
            className="absolute top-4 right-4 rounded-full px-2.5 py-1"
            style={{
              backgroundColor: 'rgba(250,248,243,0.92)', color: '#1B3828',
              fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.12em',
              border: '1px solid rgba(221,212,192,0.8)',
            }}
          >
            APPLICATIONS OPEN
          </span>
        )}
      </div>

      {/* Free-floating logo over the seam */}
      <div className="px-5" style={{ marginTop: '-30px', position: 'relative', zIndex: 2 }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: '60px', height: '60px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.32))',
            }}
          />
        ) : (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '50px', height: '50px', borderRadius: '13px',
              backgroundColor: '#EDE7D8', border: '3px solid #FAF8F3',
              boxShadow: '0 4px 12px rgba(27,56,40,0.12)',
              fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#1B3828',
            }}
          >
            {conf.acronym.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>

      {/* Cream content zone */}
      <div className="px-5 pt-2.5 pb-5 flex flex-col flex-1 min-h-0">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>
        <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
          {conf.full_name}
        </h3>
        <div className="flex items-center gap-1.5 mt-2">
          <MapPin size={11} style={{ color: '#9A8A78', flexShrink: 0 }} />
          {flagUrl && (
            <img src={flagUrl} alt={conf.country} style={{ width: '16px', height: '11px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }} />
          )}
          <span className="text-[11.5px] truncate" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
            {conf.city}, {conf.country}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="inline-flex items-center gap-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9A8A78' }}>
            <CalendarDays size={11} style={{ color: '#9A8A78' }} />
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
          {conf.expected_delegates > 0 && (
            <span className="inline-flex items-center gap-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9A8A78' }}>
              <Users size={11} style={{ color: '#9A8A78' }} />
              {conf.expected_delegates.toLocaleString('en-US')}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
          <span
            className="text-[10px] px-2 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(27,56,40,0.06)',
              color: conf.fee_amount === 0 ? '#2A5A3C' : '#6B5F52',
              fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em',
            }}
          >
            {feeLabel(conf)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2"
            style={{
              backgroundColor: hovered ? '#2A5A3C' : '#1B3828', color: '#EED98A',
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '11px', letterSpacing: '0.1em',
              transition: 'background-color 200ms ease',
            }}
          >
            APPLY
            <ArrowRight size={13} style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 220ms ease' }} />
          </span>
        </div>
      </div>
    </article>
  );
}

export default function VariantMarquee({ conferences }: { conferences: LabConference[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const ordered = upcomingFirst(conferences);
  const stats = circuitStats(conferences);

  const scrollRail = (dir: -1 | 1) => {
    railRef.current?.scrollBy({ left: dir * 336, behavior: 'smooth' });
  };

  // Ticker sequence — real names, cities and dates, doubled for a seamless loop
  const tickerItems = ordered.flatMap(c => [
    `${c.acronym} — ${c.city.toUpperCase()} — ${formatDateRange(c.start_date, c.end_date).toUpperCase()}`,
    'APPLICATIONS OPEN',
  ]);

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      {/* Local styles: ticker animation + scrollbar-less rail */}
      <style>{`
        @keyframes lab-marquee-slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lab-marquee-track { animation: lab-marquee-slide 38s linear infinite; }
        .lab-marquee-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .lab-marquee-track { animation: none; } }
        .lab-poster-rail { scrollbar-width: none; }
        .lab-poster-rail::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Hero — headline left, poster rail right ─────────────────── */}
        <section className="px-6 md:pl-14 md:pr-0 pt-12 md:pt-16 pb-14 overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-10 items-center">
            {/* Left column */}
            <div className="w-full lg:w-[44%] flex-shrink-0" style={{ maxWidth: '560px' }}>
              <p className="mb-5" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.32em', color: '#B6871F' }}>
                GAVELLING CONFERENCES
              </p>
              <h1 style={{ margin: 0 }}>
                <span style={{ display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 'clamp(46px, 5.4vw, 82px)', color: '#1C1410', lineHeight: 1.0 }}>
                  {COPY.heroLine1}
                </span>
                <span style={{ display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 'clamp(46px, 5.4vw, 82px)', color: '#1B3828', lineHeight: 1.0 }}>
                  {COPY.heroLine2}
                </span>
              </h1>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mt-9 w-full" style={{ maxWidth: '520px' }}>
                <LabSearch conferences={conferences} appearance="field" />
                <Link
                  href="/conferences/explore"
                  className="text-center"
                  style={{
                    backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '14px', padding: '14px 28px',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em',
                    textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                    boxShadow: '0 8px 24px rgba(27,56,40,0.18)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
                >
                  EXPLORE →
                </Link>
              </div>

              {/* Social proof chips */}
              {stats.listed > 0 && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {[
                    `${stats.listed} CONFERENCE${stats.listed === 1 ? '' : 'S'} LISTED`,
                    `${stats.seats.toLocaleString('en-US')} DELEGATE SEATS`,
                    'FEE-FREE FOR ORGANISERS',
                  ].map(chip => (
                    <span
                      key={chip}
                      className="px-3 py-1.5 rounded-full"
                      style={{
                        backgroundColor: 'rgba(250,248,243,0.8)', border: '1px solid #DDD4C0',
                        color: '#6B5F52', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.12em',
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {/* Rail controls (desktop) */}
              <div className="hidden lg:flex items-center gap-3 mt-10">
                {([-1, 1] as const).map(dir => (
                  <button
                    key={dir}
                    onClick={() => scrollRail(dir)}
                    aria-label={dir === -1 ? 'Previous conferences' : 'More conferences'}
                    className="flex items-center justify-center cursor-pointer"
                    style={{
                      width: '42px', height: '42px', borderRadius: '9999px',
                      backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', color: '#1B3828',
                      transition: 'background-color 180ms ease, border-color 180ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; e.currentTarget.style.color = '#EED98A'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FAF8F3'; e.currentTarget.style.color = '#1B3828'; }}
                  >
                    {dir === -1 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                  </button>
                ))}
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#9A8A78' }}>
                  BROWSE THE CIRCUIT
                </span>
              </div>
            </div>

            {/* Right — poster rail */}
            <div className="w-full lg:flex-1 min-w-0 relative">
              <div
                ref={railRef}
                className="lab-poster-rail flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 px-1 md:pr-14"
              >
                {ordered.length > 0
                  ? ordered.map(conf => <PosterCard key={conf.id} conf={conf} />)
                  : [0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="animate-pulse flex-shrink-0"
                        style={{ width: '312px', height: '448px', backgroundColor: 'rgba(221,212,192,0.55)', borderRadius: '26px' }}
                      />
                    ))}
                {/* End cap — explore the rest */}
                {ordered.length > 0 && (
                  <Link
                    href="/conferences/explore"
                    className="flex flex-col items-center justify-center gap-3 flex-shrink-0 snap-center"
                    style={{
                      width: '220px', height: '448px', borderRadius: '26px',
                      border: '1.5px dashed rgba(27,56,40,0.3)', textDecoration: 'none',
                      color: '#1B3828', transition: 'background-color 200ms ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(250,248,243,0.7)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{ width: '48px', height: '48px', borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A' }}
                    >
                      <ArrowRight size={20} />
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textAlign: 'center' }}>
                      EXPLORE<br />ALL CONFERENCES
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Ticker — real conferences on a slow loop ─────────────────── */}
        {tickerItems.length > 0 && (
          <div
            className="relative overflow-hidden py-3"
            style={{ borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0', backgroundColor: 'rgba(250,248,243,0.6)' }}
          >
            <div className="lab-marquee-track flex items-center gap-8" style={{ width: 'max-content' }}>
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} className="flex items-center gap-8 whitespace-nowrap">
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em',
                      color: item === 'APPLICATIONS OPEN' ? '#B6871F' : '#1B3828',
                    }}
                  >
                    {item}
                  </span>
                  <span aria-hidden style={{ color: '#B6871F', fontSize: '9px' }}>◆</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Organiser — editorial photo split ───────────────────────── */}
        <section className="px-6 md:px-14 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center" style={{ maxWidth: '1160px', margin: '0 auto' }}>
            {/* Photograph — Lady Justice, Tingey Injury Law Firm / Unsplash */}
            <div className="relative hidden lg:block">
              <img
                src="/landing/lady-justice.jpg"
                alt=""
                aria-hidden
                style={{
                  width: '100%', height: '460px', objectFit: 'cover', borderRadius: '26px',
                  border: '1px solid #DDD4C0', boxShadow: '0 20px 48px rgba(27,56,40,0.14)',
                }}
              />
              <span
                className="absolute bottom-4 left-4 rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: 'rgba(250,248,243,0.9)', border: '1px solid rgba(221,212,192,0.8)',
                  fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#1B3828',
                }}
              >
                FOR ORGANISERS
              </span>
            </div>

            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
                <span className="block" style={{ fontSize: 'clamp(30px, 3.8vw, 50px)', color: '#1C1410' }}>{COPY.organiserTitle1}</span>
                <span className="block" style={{ fontSize: 'clamp(30px, 3.8vw, 50px)', color: '#1B3828' }}>{COPY.organiserTitle2}</span>
              </h2>
              <p className="mt-4 mb-8 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '520px', fontFamily: "'Outfit', sans-serif" }}>
                {COPY.organiserBody}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-9">
                {ORGANISER_CARDS.map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title} className="flex items-start gap-3">
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: '34px', height: '34px', borderRadius: '11px', backgroundColor: 'rgba(27,56,40,0.08)' }}
                      >
                        <Icon size={16} style={{ color: '#1B3828' }} />
                      </span>
                      <div>
                        <h3 className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{card.title}</h3>
                        <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{card.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link
                href="/conferences/organise"
                className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-all focus:outline-none"
                style={{
                  backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.08em', textDecoration: 'none', boxShadow: '0 8px 24px rgba(27,56,40,0.18)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                {COPY.organiserCta}
              </Link>
            </div>
          </div>
        </section>

        {/* ── Roles — centred band with three columns ─────────────────── */}
        <section
          className="px-6 md:px-14 py-20"
          style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0' }}
        >
          <div className="flex flex-col items-center text-center" style={{ maxWidth: '1160px', margin: '0 auto' }}>
            <div className="flex flex-wrap gap-2 mb-6 justify-center">
              {ROLES_PILLS.map(pill => (
                <span
                  key={pill}
                  className="px-3 py-1.5 rounded-full text-[10px]"
                  style={{
                    backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.14)',
                    color: '#1B3828', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em',
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
              <span style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', color: '#1C1410' }}>{COPY.rolesTitle1} </span>
              <span style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', color: '#1B3828' }}>{COPY.rolesTitle2}</span>
            </h2>
            <p className="mt-4 mb-10 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '520px', fontFamily: "'Outfit', sans-serif" }}>
              {COPY.rolesBody}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10">
              {[
                { role: 'Chairs', sub: 'Run committees on Gavelling’s live session tools.' },
                { role: 'Secretariat', sub: 'Shape the conference — programme, logistics, crisis.' },
                { role: 'Staff', sub: 'Pages, admin, tech and press teams behind the scenes.' },
              ].map((item, i) => (
                <div
                  key={item.role}
                  className="rounded-2xl p-6 text-left"
                  style={{ backgroundColor: '#EDE7D8', border: '1px solid rgba(221,212,192,0.9)' }}
                >
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: '#B6871F' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="font-black text-[18px] mt-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: '8px 0 0 0' }}>
                    {item.role}
                  </p>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/conferences/roles"
              className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none', boxShadow: '0 8px 24px rgba(27,56,40,0.18)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {COPY.rolesCta}
            </Link>
          </div>
        </section>

        {/* ── Globe — wide map band ────────────────────────────────────── */}
        <section className="px-6 md:px-14 pt-20 pb-8 relative overflow-hidden">
          <div className="relative flex flex-col items-center text-center" style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ margin: 0 }}>
              <span style={{ display: 'block', color: '#1C1410', fontSize: 'clamp(34px, 4.4vw, 60px)', fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0 }}>
                {COPY.globeTitle1}
              </span>
              <span style={{ display: 'block', color: '#1B3828', fontSize: 'clamp(34px, 4.4vw, 60px)', fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0 }}>
                {COPY.globeTitle2}
              </span>
            </h2>
            <p className="mt-5 mb-9" style={{ fontSize: '15px', lineHeight: 1.7, color: '#8A7D6C', maxWidth: '440px', fontFamily: "'Outfit', sans-serif" }}>
              {COPY.globeBody}
            </p>
            <Link
              href="/conferences/map"
              className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
              style={{
                border: '1.5px solid rgba(27,56,40,0.4)', color: '#1B3828', backgroundColor: 'transparent',
                fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {COPY.globeCta}
            </Link>
          </div>
          <img
            src="/map/world_map.png"
            alt=""
            aria-hidden
            className="pointer-events-none select-none mx-auto mt-8"
            style={{ width: 'min(880px, 100%)', opacity: 0.26, mixBlendMode: 'multiply', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </section>

        <LabFooter />
      </div>
    </div>
  );
}
