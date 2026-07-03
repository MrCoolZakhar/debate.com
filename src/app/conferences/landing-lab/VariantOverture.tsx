'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  GRAIN, LabConference, LabFooter, LabSearch,
  COPY, ORGANISER_CARDS, ROLES_PILLS,
  formatDateRange, feeLabel, confTiming, timingColors, upcomingFirst, circuitStats,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 1 — "OVERTURE"
// Cinematic conversion hero: one full-bleed assembly-hall photograph that
// dissolves into ivory, with the search box as the single dominant CTA and a
// live social-proof line directly beneath it. Conference cards carry countdown
// chips, "applications open" pills and their own APPLY affordance. A slim
// sticky bar repeats the explore CTA once the hero scrolls away.
//
// Hero photograph: parliamentary chamber in session — Marco Oriolesi via
// Unsplash (images.unsplash.com/photo-1529107386315-e1a2ed48a620, Unsplash
// License). Stored locally at /landing/assembly-hall.jpg.
// ─────────────────────────────────────────────────────────────────────────────

function TimingChip({ conf }: { conf: LabConference }) {
  const t = confTiming(conf);
  const colors = timingColors(t.tone);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
        fontFamily: "'DM Mono', monospace",
        fontSize: '9px',
        letterSpacing: '0.14em',
        boxShadow: t.tone === 'soon' || t.tone === 'now' ? '0 4px 12px rgba(27,56,40,0.28)' : 'none',
      }}
    >
      {t.tone === 'now' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#FAF8F3' }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: '#FAF8F3' }} />
        </span>
      )}
      {t.label}
    </span>
  );
}

function CircuitCard({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const timing = confTiming(conf);

  return (
    <article
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer overflow-hidden flex flex-col"
      style={{
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid rgba(27,56,40,0.45)' : '1px solid #DDD4C0',
        borderRadius: '22px',
        transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 24px 52px rgba(27,56,40,0.16), 0 3px 10px rgba(27,56,40,0.08)'
          : '0 1px 3px rgba(27,56,40,0.05)',
        transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease, border-color 280ms ease',
      }}
    >
      {/* Banner with urgency chips */}
      <div className="relative" style={{ height: '148px', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <>
            <img
              src={conf.banner_url}
              alt=""
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.045)' : 'scale(1)',
                transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(250,248,243,0.3) 0%, transparent 35%)' }} />
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #E7DFCC 0%, #DDD4C0 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'multiply', opacity: 0.15 }} />
            <span
              aria-hidden
              style={{
                position: 'absolute', right: '14px', bottom: '-8px',
                fontFamily: "'DM Mono', monospace", fontSize: '64px', lineHeight: 1,
                color: 'rgba(27,56,40,0.1)', letterSpacing: '0.02em', userSelect: 'none',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          </>
        )}
        <div className="absolute top-3 left-3">
          <TimingChip conf={conf} />
        </div>
        {timing.tone !== 'past' && (
          <span
            className="absolute top-3 right-3 rounded-full px-2.5 py-1"
            style={{
              backgroundColor: 'rgba(250,248,243,0.92)',
              color: '#1B3828',
              fontFamily: "'DM Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.12em',
              border: '1px solid rgba(221,212,192,0.8)',
            }}
          >
            APPLICATIONS OPEN
          </span>
        )}
      </div>

      {/* Free-floating logo over the seam */}
      <div className="px-5" style={{ marginTop: '-32px', position: 'relative' }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: '64px', height: '64px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.3))',
            }}
          />
        ) : (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '52px', height: '52px', borderRadius: '14px',
              backgroundColor: '#EDE7D8', border: '3px solid #FAF8F3',
              boxShadow: '0 4px 12px rgba(27,56,40,0.12)',
              fontFamily: "'DM Mono', monospace", fontSize: '12px', fontWeight: 700, color: '#1B3828',
            }}
          >
            {conf.acronym.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>

      <div className="px-5 pt-3 pb-5 flex flex-col flex-1">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>
        <h3 className="text-[15px] font-bold leading-snug mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {conf.full_name}
        </h3>
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
            {flagUrl && (
              <img
                src={flagUrl}
                alt={conf.country}
                style={{ width: '17px', height: '12px', borderRadius: '2.5px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
              />
            )}
            <span className="text-xs" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
              {conf.city}, {conf.country}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
            <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
              {formatDateRange(conf.start_date, conf.end_date)}
            </span>
          </div>
          {conf.expected_delegates > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
              <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                {conf.expected_delegates.toLocaleString('en-US')} DELEGATES EXPECTED
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-auto pt-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
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
              backgroundColor: hovered ? '#2A5A3C' : '#1B3828',
              color: '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.1em',
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

function SkeletonCard() {
  return (
    <div
      className="animate-pulse"
      style={{ backgroundColor: 'rgba(221,212,192,0.55)', borderRadius: '22px', height: '380px' }}
    />
  );
}

export default function VariantOverture({ conferences }: { conferences: LabConference[] }) {
  const [scrolled, setScrolled] = useState(false);
  const upcoming = upcomingFirst(conferences);
  const stats = circuitStats(conferences);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      {/* Sticky repeat-CTA bar — slides in after the hero scrolls away */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 md:px-14 py-2.5"
        style={{
          backgroundColor: 'rgba(250,248,243,0.9)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid #DDD4C0',
          transform: scrolled ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1)',
          boxShadow: scrolled ? '0 10px 30px rgba(27,56,40,0.1)' : 'none',
        }}
      >
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.22em', color: '#1B3828' }}>
          FIND YOUR NEXT CONFERENCE
        </span>
        <Link
          href="/conferences/explore"
          style={{
            backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '10px', padding: '8px 18px',
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '11px', letterSpacing: '0.08em',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
        >
          EXPLORE →
        </Link>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── Hero — full-bleed photograph dissolving into ivory ─────── */}
        <section className="relative flex flex-col" style={{ minHeight: '88vh' }}>
          <img
            src="/landing/assembly-hall.jpg"
            alt=""
            aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 32%' }}
          />
          {/* Top scrim for nav legibility */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(20,14,10,0.52) 0%, rgba(20,14,10,0.22) 26%, transparent 52%)' }} />
          {/* Bottom melt into the ivory page */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 46%, rgba(237,231,216,0.45) 74%, #EDE7D8 98%)' }} />
          {/* Grain over photo */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.1, pointerEvents: 'none' }} />

          <SiteNav overlay />

          <div className="relative z-10 flex flex-col items-center text-center px-6 flex-1 justify-center" style={{ paddingTop: '96px', paddingBottom: '48px' }}>
            <p
              className="mb-5"
              style={{
                fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.34em',
                color: '#EED98A', textShadow: '0 1px 10px rgba(16,28,21,0.6)',
              }}
            >
              GAVELLING CONFERENCES
            </p>
            <h1 style={{ margin: 0 }}>
              <span
                style={{
                  display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(46px, 6.6vw, 94px)', color: '#FAF8F3', lineHeight: 1.0,
                  textShadow: '0 3px 28px rgba(16,28,21,0.55)',
                }}
              >
                {COPY.heroLine1}
              </span>
              <span
                style={{
                  display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(46px, 6.6vw, 94px)', color: '#EED98A', lineHeight: 1.0,
                  textShadow: '0 3px 28px rgba(16,28,21,0.55)',
                }}
              >
                {COPY.heroLine2}
              </span>
            </h1>

            {/* Dominant CTA cluster — glass search + explore */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-center w-full mt-10" style={{ maxWidth: '640px' }}>
              <LabSearch conferences={conferences} appearance="glass" />
              <Link
                href="/conferences/explore"
                className="text-center"
                style={{
                  backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '14px', padding: '14px 28px',
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em',
                  textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                  boxShadow: '0 12px 32px rgba(16,28,21,0.4)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
              >
                EXPLORE →
              </Link>
            </div>

            {/* Social proof line */}
            {stats.listed > 0 && (
              <p
                className="mt-6"
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.18em',
                  color: 'rgba(250,248,243,0.92)', textShadow: '0 1px 8px rgba(16,28,21,0.65)',
                }}
              >
                {stats.listed} CONFERENCE{stats.listed === 1 ? '' : 'S'} LISTED
                <span aria-hidden style={{ color: '#EED98A', margin: '0 10px' }}>◆</span>
                {stats.seats.toLocaleString('en-US')} DELEGATE SEATS
                <span aria-hidden style={{ color: '#EED98A', margin: '0 10px' }}>◆</span>
                FEE-FREE FOR ORGANISERS
              </p>
            )}
          </div>
        </section>

        {/* ── Upcoming on the circuit ────────────────────────────────── */}
        <section className="px-6 md:px-14 pb-20" style={{ marginTop: '-12px' }}>
          <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
                UPCOMING ON THE CIRCUIT
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcoming.length > 0
                ? upcoming.slice(0, 3).map(conf => <CircuitCard key={conf.id} conf={conf} />)
                : [0, 1, 2].map(i => <SkeletonCard key={i} />)}
            </div>
            <div className="flex justify-center mt-10">
              <Link
                href="/conferences/explore"
                className="inline-flex items-center gap-2"
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em',
                  color: '#1B3828', textDecoration: 'none', borderBottom: '1.5px solid rgba(27,56,40,0.35)',
                  paddingBottom: '3px',
                }}
              >
                SEE EVERY LISTED CONFERENCE <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Organiser — cream band, one dominant CTA ───────────────── */}
        <section
          className="px-6 md:px-14 py-20"
          style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0' }}
        >
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start" style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <div style={{ maxWidth: '420px' }}>
              <p className="mb-4" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.28em', color: '#B6871F' }}>
                FOR ORGANISERS
              </p>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
                <span className="block" style={{ fontSize: 'clamp(30px, 3.8vw, 50px)', color: '#1C1410' }}>{COPY.organiserTitle1}</span>
                <span className="block" style={{ fontSize: 'clamp(30px, 3.8vw, 50px)', color: '#1B3828' }}>{COPY.organiserTitle2}</span>
              </h2>
              <p className="mt-4 mb-8 text-sm leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {COPY.organiserBody}
              </p>
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

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {ORGANISER_CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl p-5"
                    style={{ backgroundColor: '#EDE7D8', border: '1px solid rgba(221,212,192,0.9)' }}
                  >
                    <span
                      className="flex items-center justify-center mb-3"
                      style={{ width: '36px', height: '36px', borderRadius: '11px', backgroundColor: 'rgba(27,56,40,0.08)' }}
                    >
                      <Icon size={17} style={{ color: '#1B3828' }} />
                    </span>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{card.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{card.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Roles — text left, role cards right ────────────────────── */}
        <section className="px-6 md:px-14 py-20">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start" style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <div style={{ maxWidth: '440px' }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
                <span className="block" style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', color: '#1C1410' }}>{COPY.rolesTitle1}</span>
                <span className="block" style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', color: '#1B3828' }}>{COPY.rolesTitle2}</span>
              </h2>
              <p className="mt-4 mb-6 text-sm leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {COPY.rolesBody}
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
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
              <Link
                href="/conferences/roles"
                className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {COPY.rolesCta}
              </Link>
            </div>

            <div className="flex-1 w-full flex flex-col gap-4">
              {[
                { role: 'Chairs', sub: 'Run committees on Gavelling’s live session tools.' },
                { role: 'Secretariat', sub: 'Shape the conference — programme, logistics, crisis.' },
                { role: 'Staff', sub: 'Pages, admin, tech and press teams behind the scenes.' },
              ].map(item => (
                <Link
                  key={item.role}
                  href="/conferences/roles"
                  className="group flex items-center gap-5 rounded-2xl p-5 transition-all"
                  style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', textDecoration: 'none' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(27,56,40,0.4)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 28px rgba(27,56,40,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div className="flex-1">
                    <p className="font-black text-[18px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {item.role}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {item.sub}
                    </p>
                  </div>
                  <ArrowUpRight size={17} style={{ color: '#1B3828', flexShrink: 0 }} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Globe — light band with world map art ──────────────────── */}
        <section
          className="px-6 md:px-14 py-20 relative overflow-hidden"
          style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0' }}
        >
          <img
            src="/map/world_map.png"
            alt=""
            aria-hidden
            className="pointer-events-none select-none hidden md:block"
            style={{
              position: 'absolute', right: '-6%', top: '50%', transform: 'translateY(-50%)',
              width: '58%', opacity: 0.28, mixBlendMode: 'multiply',
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="relative" style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <div style={{ maxWidth: '480px' }}>
              <h2 style={{ margin: 0 }}>
                <span style={{ display: 'block', color: '#1C1410', fontSize: 'clamp(34px, 4.4vw, 60px)', fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0 }}>
                  {COPY.globeTitle1}
                </span>
                <span style={{ display: 'block', color: '#1B3828', fontSize: 'clamp(34px, 4.4vw, 60px)', fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0 }}>
                  {COPY.globeTitle2}
                </span>
              </h2>
              <p className="mt-5 mb-9" style={{ fontSize: '15px', lineHeight: 1.7, color: '#8A7D6C', maxWidth: '420px', fontFamily: "'Outfit', sans-serif" }}>
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
          </div>
        </section>

        <LabFooter />
      </div>
    </div>
  );
}
