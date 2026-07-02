'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  GRAIN, LabConference, LabFooter, LabSearch,
  COPY, ORGANISER_CARDS, ROLES_PILLS,
  formatDateRange, feeLabel,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 3 — "PANORAMA"
// Immersive photo hero: a real conference banner (WorldMUN) runs to the top of
// the viewport under <SiteNav overlay />, dissolving into ivory below. The
// featured conferences sit in a glass strip that overlaps the hero edge —
// the same trick as the conference detail page's stat strip. Everything after
// the fold is light and airy: organiser panel, roles band, globe panorama.
// ─────────────────────────────────────────────────────────────────────────────

function GlassFeaturedCard({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  return (
    <div
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-4 px-5 py-4 cursor-pointer"
      style={{
        backgroundColor: hovered ? 'rgba(250,248,243,1)' : 'rgba(250,248,243,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: hovered ? '1px solid rgba(27,56,40,0.4)' : '1px solid rgba(221,212,192,0.95)',
        borderRadius: '18px',
        boxShadow: hovered ? '0 20px 48px rgba(16,28,21,0.2)' : '0 16px 40px rgba(16,28,21,0.14)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 260ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Free-floating logo */}
      {conf.logo_url ? (
        <img
          src={conf.logo_url}
          alt={conf.acronym}
          className="flex-shrink-0"
          style={{ width: '54px', height: '54px', objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(16,28,21,0.3))' }}
        />
      ) : (
        <span
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: '48px', height: '48px', borderRadius: '13px', backgroundColor: '#EDE7D8',
            fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#1B3828',
          }}
        >
          {conf.acronym.slice(0, 3).toUpperCase()}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.18em', color: '#B6871F', margin: '0 0 2px 0' }}>
          {conf.acronym}
        </p>
        <p className="truncate font-bold text-[14px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0, lineHeight: 1.25 }}>
          {conf.full_name}
        </p>
        <p className="flex items-center gap-1.5 mt-1" style={{ margin: 0 }}>
          {flagUrl && (
            <img
              src={flagUrl}
              alt={conf.country}
              style={{ width: '15px', height: '11px', borderRadius: '2px', objectFit: 'cover', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
            />
          )}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9A8A78' }}>
            {conf.city} <span aria-hidden style={{ color: '#B6871F' }}>◆</span> {formatDateRange(conf.start_date, conf.end_date)} <span aria-hidden style={{ color: '#B6871F' }}>◆</span> {feeLabel(conf)}
          </span>
        </p>
      </div>

      <ArrowRight
        size={15}
        className="flex-shrink-0"
        style={{ color: '#1B3828', transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 220ms ease' }}
      />
    </div>
  );
}

export default function VariantPanorama({ conferences }: { conferences: LabConference[] }) {
  const heroConf = conferences.find(c => c.banner_url) ?? null;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* ── Photo hero — media to the top, overlay nav ─────────────── */}
        <section className="relative" style={{ minHeight: 'min(88vh, 760px)', display: 'flex', flexDirection: 'column' }}>
          {/* Hero media */}
          <div className="absolute inset-0 overflow-hidden">
            {heroConf?.banner_url ? (
              <img
                src={heroConf.banner_url}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #B4A48C 0%, #9A8A78 55%, #8A7D6C 100%)' }} />
            )}
            {/* Warm scrim for legibility + ivory dissolve at the base */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(28,20,16,0.42) 0%, rgba(28,20,16,0.18) 34%, rgba(28,20,16,0.3) 62%, rgba(237,231,216,0.65) 88%, #EDE7D8 100%)',
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
            />
          </div>

          <SiteNav overlay />

          {/* Hero copy + search */}
          <div className="relative flex-1 flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: '72px', paddingBottom: '140px' }}>
            {heroConf && (
              <p
                className="mb-5"
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.3em',
                  color: 'rgba(237,231,216,0.85)', textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                }}
              >
                {heroConf.acronym} <span aria-hidden style={{ color: '#EED98A', margin: '0 6px' }}>◆</span> {heroConf.city.toUpperCase()}
              </p>
            )}
            <h1 style={{ margin: 0 }}>
              <span
                style={{
                  display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(46px, 6.4vw, 88px)', color: '#FAF8F3', lineHeight: 1.0,
                  textShadow: '0 2px 28px rgba(0,0,0,0.4)',
                }}
              >
                {COPY.heroLine1}
              </span>
              <span
                style={{
                  display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(46px, 6.4vw, 88px)', color: '#EED98A', lineHeight: 1.0,
                  textShadow: '0 2px 28px rgba(0,0,0,0.4)',
                }}
              >
                {COPY.heroLine2}
              </span>
            </h1>

            <div className="flex gap-3 items-center justify-center w-full mt-9" style={{ maxWidth: '580px' }}>
              <LabSearch conferences={conferences} appearance="glass" />
              <Link
                href="/conferences/explore"
                style={{
                  backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '14px', padding: '14px 26px',
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em',
                  textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-block',
                  boxShadow: '0 10px 32px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
              >
                EXPLORE →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Glass featured strip — overlaps the hero edge ──────────── */}
        <div className="relative z-20 px-6 md:px-14" style={{ marginTop: '-104px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="flex items-center gap-3 mb-3 px-1">
              <span
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em',
                  color: '#6B5F52', textShadow: '0 1px 6px rgba(237,231,216,0.8)',
                }}
              >
                FEATURED CONFERENCES
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(154,138,120,0.4)' }} />
              <Link
                href="/conferences/explore"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#1B3828', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#B6871F'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              >
                VIEW ALL →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {conferences.slice(0, 3).map(conf => <GlassFeaturedCard key={conf.id} conf={conf} />)}
            </div>
          </div>
        </div>

        {/* ── Organiser — floating cream panel ───────────────────────── */}
        <section className="px-6 md:px-14 pt-20 pb-10">
          <div
            className="relative overflow-hidden"
            style={{
              maxWidth: '1200px', margin: '0 auto',
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
              borderRadius: '28px', boxShadow: '0 2px 12px rgba(27,56,40,0.05)',
            }}
          >
            <div className="flex flex-col md:flex-row gap-10 md:gap-14 items-start p-8 md:p-12">
              <div style={{ maxWidth: '400px' }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.28em', color: '#B6871F', margin: '0 0 10px 0' }}>
                  FOR ORGANISERS
                </p>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
                  <span className="block" style={{ fontSize: 'clamp(28px, 3.4vw, 44px)', color: '#1C1410' }}>{COPY.organiserTitle1}</span>
                  <span className="block" style={{ fontSize: 'clamp(28px, 3.4vw, 44px)', color: '#1B3828' }}>{COPY.organiserTitle2}</span>
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
                      className="rounded-xl p-5"
                      style={{ backgroundColor: '#EDE7D8', border: '1px solid rgba(221,212,192,0.9)' }}
                    >
                      <Icon size={19} style={{ color: '#1B3828', marginBottom: '8px' }} />
                      <h3 className="font-semibold text-sm mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{card.title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{card.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Roles — airy centred band ──────────────────────────────── */}
        <section className="px-6 md:px-14 py-16">
          <div className="flex flex-col items-center text-center" style={{ maxWidth: '760px', margin: '0 auto' }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.28em', color: '#B6871F', margin: '0 0 10px 0' }}>
              CHAIR & STAFF BOARD
            </p>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
              <span className="block" style={{ fontSize: 'clamp(28px, 3.6vw, 48px)', color: '#1C1410' }}>{COPY.rolesTitle1}</span>
              <span className="block" style={{ fontSize: 'clamp(28px, 3.6vw, 48px)', color: '#1B3828' }}>{COPY.rolesTitle2}</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: '#9A8A78', maxWidth: '520px', fontFamily: "'Outfit', sans-serif" }}>
              {COPY.rolesBody}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6 mb-8">
              {ROLES_PILLS.map(pill => (
                <span
                  key={pill}
                  className="px-4 py-2 rounded-full text-[10px]"
                  style={{
                    backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
                    color: '#1B3828', fontFamily: "'DM Mono', monospace", letterSpacing: '0.12em',
                    boxShadow: '0 1px 3px rgba(27,56,40,0.05)',
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
            <Link
              href="/conferences/roles"
              className="inline-block rounded-2xl py-4 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
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
        </section>

        {/* ── Globe — framed panorama strip ──────────────────────────── */}
        <section className="px-6 md:px-14 pb-20">
          <div
            className="relative overflow-hidden flex items-center"
            style={{
              maxWidth: '1200px', margin: '0 auto', minHeight: '340px',
              borderRadius: '28px', border: '1px solid #DDD4C0',
              boxShadow: '0 20px 52px rgba(27,56,40,0.14)',
            }}
          >
            <video
              src="/map/interactive_globe.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% center' }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(16,28,21,0.72) 0%, rgba(16,28,21,0.42) 48%, rgba(16,28,21,0.1) 100%)',
              }}
            />
            <div className="relative p-8 md:p-12" style={{ maxWidth: '540px' }}>
              <h2 style={{ margin: 0 }}>
                <span
                  style={{
                    display: 'block', color: '#FAF8F3', fontSize: 'clamp(30px, 3.8vw, 52px)',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0,
                    textShadow: '0 2px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  {COPY.globeTitle1}
                </span>
                <span
                  style={{
                    display: 'block', color: '#EED98A', fontSize: 'clamp(30px, 3.8vw, 52px)',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0,
                    textShadow: '0 2px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  {COPY.globeTitle2}
                </span>
              </h2>
              <p
                className="mt-4 mb-8"
                style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(237,231,216,0.85)', maxWidth: '380px', fontFamily: "'Outfit', sans-serif" }}
              >
                {COPY.globeBody}
              </p>
              <Link
                href="/conferences/map"
                className="inline-block rounded-2xl py-3.5 px-7 font-bold text-[13px] tracking-widest transition-colors focus:outline-none"
                style={{
                  backgroundColor: 'rgba(250,248,243,0.92)', color: '#1B3828',
                  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                  fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FAF8F3'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(250,248,243,0.92)'; }}
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
