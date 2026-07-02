'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  GRAIN, LabConference, LabFooter, LabSearch,
  COPY, ORGANISER_CARDS, ROLES_PILLS,
  formatDateRange, feeLabel,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 1 — "CENTREFOLD"
// The production page's exact section language, recomposed as a centred
// editorial column: big centred hero with search, a featured-conferences card
// row directly beneath, then centred light bands (organiser / roles / globe)
// separated by hairlines. All ivory and cream; forest only on buttons/accents.
// ─────────────────────────────────────────────────────────────────────────────

function FeaturedCard({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  return (
    <article
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer overflow-hidden"
      style={{
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid rgba(27,56,40,0.45)' : '1px solid #DDD4C0',
        borderRadius: '20px',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 20px 48px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.07)'
          : '0 1px 3px rgba(27,56,40,0.05)',
        transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease, border-color 260ms ease',
      }}
    >
      {/* Banner band */}
      <div className="relative" style={{ height: '112px', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <>
            <img
              src={conf.banner_url}
              alt=""
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(250,248,243,0.35) 0%, transparent 40%)' }} />
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#EDE7D8' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'multiply', opacity: 0.14 }} />
            <span
              aria-hidden
              style={{
                position: 'absolute', right: '14px', bottom: '-6px',
                fontFamily: "'DM Mono', monospace", fontSize: '54px', lineHeight: 1,
                color: 'rgba(27,56,40,0.09)', letterSpacing: '0.02em', userSelect: 'none',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          </>
        )}
      </div>

      {/* Free-floating logo overlapping the band */}
      <div className="px-5" style={{ marginTop: '-34px', position: 'relative' }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: '68px', height: '68px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.3))',
            }}
          />
        ) : (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '54px', height: '54px', borderRadius: '14px',
              backgroundColor: '#EDE7D8', border: '3px solid #FAF8F3',
              boxShadow: '0 4px 12px rgba(27,56,40,0.12)',
              fontFamily: "'DM Mono', monospace", fontSize: '12px', fontWeight: 700, color: '#1B3828',
            }}
          >
            {conf.acronym.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>

      <div className="px-5 pt-3 pb-5">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>
        <h3
          className="text-[15px] font-bold leading-snug mb-2.5"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", minHeight: '2.6em' }}
        >
          {conf.full_name}
        </h3>
        <div className="flex items-center gap-1.5 mb-1">
          {flagUrl && (
            <img
              src={flagUrl}
              alt={conf.country}
              style={{ width: '18px', height: '13px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
            />
          )}
          <span className="text-xs" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
            {conf.city}, {conf.country}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-4">
          <CalendarDays size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
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
          <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}>
            VIEW
            <ArrowRight size={13} style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 220ms ease' }} />
          </span>
        </div>
      </div>
    </article>
  );
}

function HairlineHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />
    </div>
  );
}

export default function VariantCentrefold({ conferences }: { conferences: LabConference[] }) {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Hero — centred, search-first ───────────────────────────── */}
        <section className="px-6 pt-16 md:pt-24 pb-14 flex flex-col items-center text-center">
          <p
            className="mb-5"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.32em', color: '#B6871F' }}
          >
            GAVELLING CONFERENCES
          </p>
          <h1 style={{ margin: 0 }}>
            <span
              style={{
                display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: 'clamp(48px, 6.6vw, 92px)', color: '#1C1410', lineHeight: 1.0,
              }}
            >
              {COPY.heroLine1}
            </span>
            <span
              style={{
                display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: 'clamp(48px, 6.6vw, 92px)', color: '#1B3828', lineHeight: 1.0,
              }}
            >
              {COPY.heroLine2}
            </span>
          </h1>

          <div className="flex gap-3 items-center justify-center w-full mt-10" style={{ maxWidth: '600px' }}>
            <LabSearch conferences={conferences} appearance="field" />
            <Link
              href="/conferences/explore"
              style={{
                backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '14px', padding: '14px 28px',
                fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em',
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-block',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
            >
              EXPLORE →
            </Link>
          </div>
        </section>

        {/* ── Featured conferences row ───────────────────────────────── */}
        <section className="px-6 md:px-14 pb-20">
          <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <HairlineHeading>
              UPCOMING ON THE CIRCUIT <span aria-hidden style={{ color: '#B6871F', margin: '0 8px' }}>◆</span> {conferences.length} LISTED
            </HairlineHeading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {conferences.slice(0, 3).map(conf => <FeaturedCard key={conf.id} conf={conf} />)}
            </div>
          </div>
        </section>

        {/* ── Organiser — cream band, centred ────────────────────────── */}
        <section
          className="px-6 md:px-14 py-20"
          style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0' }}
        >
          <div className="flex flex-col items-center text-center" style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
              <span style={{ fontSize: 'clamp(30px, 3.8vw, 50px)', color: '#1C1410' }}>{COPY.organiserTitle1} </span>
              <span style={{ fontSize: 'clamp(30px, 3.8vw, 50px)', color: '#1B3828' }}>{COPY.organiserTitle2}</span>
            </h2>
            <p
              className="mt-4 mb-12 text-sm leading-relaxed"
              style={{ color: '#9A8A78', maxWidth: '560px', fontFamily: "'Outfit', sans-serif" }}
            >
              {COPY.organiserBody}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-12">
              {ORGANISER_CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl p-5 text-left"
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
        </section>

        {/* ── Roles — two-column, light ──────────────────────────────── */}
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

            {/* Right — role types as an editorial list */}
            <div className="flex-1 w-full" style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
              {[
                { role: 'Chairs', sub: 'Run committees on Gavelling’s live session tools.' },
                { role: 'Secretariat', sub: 'Shape the conference — programme, logistics, crisis.' },
                { role: 'Staff', sub: 'Pages, admin, tech and press teams behind the scenes.' },
              ].map((item, i) => (
                <Link
                  key={item.role}
                  href="/conferences/roles"
                  className="flex items-center gap-5 py-5 group"
                  style={{ textDecoration: 'none', borderBottom: '1px solid rgba(221,212,192,0.9)' }}
                >
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: '#B6871F', width: '26px', flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <p className="font-black text-[18px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {item.role}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {item.sub}
                    </p>
                  </div>
                  <ArrowRight size={15} style={{ color: '#1B3828', flexShrink: 0 }} className="transition-transform group-hover:translate-x-1" />
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
                <span
                  style={{
                    display: 'block', color: '#1C1410', fontSize: 'clamp(34px, 4.4vw, 60px)',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0,
                  }}
                >
                  {COPY.globeTitle1}
                </span>
                <span
                  style={{
                    display: 'block', color: '#1B3828', fontSize: 'clamp(34px, 4.4vw, 60px)',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900, lineHeight: 1.0,
                  }}
                >
                  {COPY.globeTitle2}
                </span>
              </h2>
              <p
                className="mt-5 mb-9"
                style={{ fontSize: '15px', lineHeight: 1.7, color: '#8A7D6C', maxWidth: '420px', fontFamily: "'Outfit', sans-serif" }}
              >
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
