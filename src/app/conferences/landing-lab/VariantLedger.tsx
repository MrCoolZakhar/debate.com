'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, Users } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import {
  GRAIN, LabConference, LabFooter, LabSearch,
  COPY, ORGANISER_CARDS, ROLES_PILLS,
  shortDate, feeLabel, confTiming, timingColors, upcomingFirst, circuitStats,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 2 — "LEDGER"
// A typographic departures board. F-pattern: left-anchored hero with an
// underline search and hard social-proof stats; the soonest conference sits
// beside it as a boarding-pass card with APPLY NOW as the dominant CTA.
// Below, every conference is a scannable ledger row — date block, name, city,
// delegates, fee, countdown — reading like an airport departures screen.
// No photography: the data itself is the art direction.
// ─────────────────────────────────────────────────────────────────────────────

function monthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function dayRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()}`;
  return `${s.getDate()}`;
}

function TimingChip({ conf }: { conf: LabConference }) {
  const t = confTiming(conf);
  const colors = timingColors(t.tone);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1"
      style={{
        backgroundColor: colors.bg, color: colors.fg,
        fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.14em',
        whiteSpace: 'nowrap',
      }}
    >
      {t.label}
    </span>
  );
}

// ── Boarding-pass card for the soonest conference ────────────────────────────

function NextUpCard({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full overflow-hidden"
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        borderRadius: '24px',
        boxShadow: hovered
          ? '0 26px 56px rgba(27,56,40,0.16), 0 3px 10px rgba(27,56,40,0.07)'
          : '0 14px 40px rgba(27,56,40,0.1)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease',
      }}
    >
      {/* Banner strip */}
      <div className="relative" style={{ height: '110px', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <>
            <img src={conf.banner_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(250,248,243,0.4) 0%, transparent 45%)' }} />
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, #E7DFCC 0%, #DDD4C0 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'multiply', opacity: 0.15 }} />
          </>
        )}
        <span
          className="absolute top-3 left-4 rounded-full px-2.5 py-1"
          style={{
            backgroundColor: '#B6871F', color: '#FAF8F3',
            fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.18em',
            boxShadow: '0 4px 12px rgba(27,56,40,0.25)',
          }}
        >
          NEXT ON THE CIRCUIT
        </span>
        {conf.logo_url && (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              position: 'absolute', right: '16px', bottom: '-26px',
              width: '64px', height: '64px', objectFit: 'contain',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.3))',
            }}
          />
        )}
      </div>

      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start gap-5">
          {/* Date block */}
          <div className="flex-shrink-0 text-center" style={{ minWidth: '76px' }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '34px', lineHeight: 1, color: '#1B3828', margin: 0 }}>
              {dayRange(conf.start_date, conf.end_date)}
            </p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '4px 0 0 0' }}>
              {monthYear(conf.start_date)}
            </p>
          </div>
          <div className="w-px self-stretch" style={{ backgroundColor: 'rgba(221,212,192,0.8)' }} />
          <div className="min-w-0">
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
              {conf.acronym}
            </p>
            <h3 className="font-bold text-[16px] leading-snug" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
              {conf.full_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-2">
              {flagUrl && (
                <img src={flagUrl} alt={conf.country} style={{ width: '17px', height: '12px', borderRadius: '2.5px', objectFit: 'cover', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }} />
              )}
              <span className="text-xs" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
                {conf.city}, {conf.country}
              </span>
            </div>
          </div>
        </div>

        {/* Perforation */}
        <div className="my-4" style={{ borderTop: '1.5px dashed rgba(154,138,120,0.45)' }} />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {conf.expected_delegates > 0 && (
              <span className="inline-flex items-center gap-1.5" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', color: '#6B5F52' }}>
                <Users size={12} style={{ color: '#9A8A78' }} />
                {conf.expected_delegates.toLocaleString('en-US')} DELEGATES
              </span>
            )}
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
          </div>
          <TimingChip conf={conf} />
        </div>

        <button
          onClick={() => router.push(`/conferences/${conf.slug}`)}
          className="w-full mt-4 rounded-2xl py-4 font-bold text-sm tracking-widest cursor-pointer"
          style={{
            backgroundColor: hovered ? '#2A5A3C' : '#1B3828', color: '#EED98A', border: 'none',
            fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em',
            transition: 'background-color 220ms ease',
            boxShadow: '0 10px 26px rgba(27,56,40,0.22)',
          }}
        >
          APPLY NOW →
        </button>
      </div>
    </div>
  );
}

// ── Ledger row ────────────────────────────────────────────────────────────────

function LedgerRow({ conf }: { conf: LabConference }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  return (
    <div
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="grid grid-cols-2 gap-y-2 md:grid-cols-[110px_minmax(0,1fr)_190px_130px_90px_150px] md:gap-4 items-center py-5 px-3 md:px-4 cursor-pointer"
      style={{
        borderTop: '1px solid rgba(221,212,192,0.9)',
        backgroundColor: hovered ? 'rgba(250,248,243,0.95)' : 'transparent',
        borderRadius: hovered ? '14px' : '0',
        boxShadow: hovered ? '0 10px 28px rgba(27,56,40,0.08)' : 'none',
        transition: 'background-color 200ms ease, box-shadow 200ms ease',
      }}
    >
      {/* Dates */}
      <div className="order-2 md:order-none">
        <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '17px', color: '#1B3828', margin: 0, lineHeight: 1.1 }}>
          {shortDate(conf.start_date)}
        </p>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.1em', color: '#9A8A78', margin: '2px 0 0 0' }}>
          {new Date(conf.start_date + 'T00:00:00').getFullYear()}
        </p>
      </div>

      {/* Conference */}
      <div className="col-span-2 md:col-span-1 order-1 md:order-none flex items-center gap-3 min-w-0">
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{ width: '42px', height: '42px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 4px 8px rgba(16,28,21,0.22))' }}
          />
        ) : (
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(221,212,192,0.6)',
              fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 700, color: '#1B3828',
            }}
          >
            {conf.acronym.slice(0, 3).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 2px 0' }}>
            {conf.acronym}
          </p>
          <p className="truncate font-bold text-[14.5px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
            {conf.full_name}
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="order-3 md:order-none flex items-center gap-1.5">
        {flagUrl && (
          <img src={flagUrl} alt={conf.country} style={{ width: '17px', height: '12px', borderRadius: '2.5px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }} />
        )}
        <span className="text-xs truncate" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
          {conf.city}, {conf.country}
        </span>
      </div>

      {/* Delegates */}
      <div className="order-4 md:order-none hidden sm:flex items-center gap-1.5">
        <Users size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#6B5F52' }}>
          {conf.expected_delegates > 0 ? conf.expected_delegates.toLocaleString('en-US') : '—'}
        </span>
      </div>

      {/* Fee */}
      <div className="order-5 md:order-none">
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
      </div>

      {/* Countdown + arrow */}
      <div className="col-span-2 md:col-span-1 order-6 md:order-none flex items-center justify-between md:justify-end gap-3">
        <TimingChip conf={conf} />
        <ArrowRight
          size={16}
          style={{ color: '#1B3828', flexShrink: 0, transform: hovered ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 220ms ease' }}
        />
      </div>
    </div>
  );
}

export default function VariantLedger({ conferences }: { conferences: LabConference[] }) {
  const ordered = upcomingFirst(conferences);
  const nextUp = ordered[0];
  const stats = circuitStats(conferences);

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Hero — F-pattern: headline + search left, next-up card right ── */}
        <section className="px-6 md:px-14 pt-14 md:pt-20 pb-16">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start" style={{ maxWidth: '1180px', margin: '0 auto' }}>
            <div className="flex-1 w-full" style={{ maxWidth: '600px' }}>
              <p className="mb-5" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.32em', color: '#B6871F' }}>
                GAVELLING CONFERENCES
              </p>
              <h1 style={{ margin: 0 }}>
                <span style={{ display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 'clamp(46px, 5.8vw, 86px)', color: '#1C1410', lineHeight: 1.0 }}>
                  {COPY.heroLine1}
                </span>
                <span style={{ display: 'block', fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 'clamp(46px, 5.8vw, 86px)', color: '#1B3828', lineHeight: 1.0 }}>
                  {COPY.heroLine2}
                </span>
              </h1>

              {/* Underline search — impossible to miss */}
              <div className="flex items-center gap-3 mt-10">
                <Search size={19} style={{ color: '#1B3828', flexShrink: 0 }} />
                <LabSearch conferences={conferences} appearance="underline" />
              </div>

              <div className="mt-7">
                <Link
                  href="/conferences/explore"
                  style={{
                    backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '14px', padding: '14px 28px',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em',
                    textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block',
                    boxShadow: '0 8px 24px rgba(27,56,40,0.18)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B3828'; }}
                >
                  EXPLORE →
                </Link>
              </div>

              {/* Social proof stats */}
              {stats.listed > 0 && (
                <div className="flex flex-wrap gap-8 mt-12">
                  {[
                    { n: String(stats.listed), label: 'CONFERENCES LISTED' },
                    { n: stats.seats.toLocaleString('en-US'), label: 'DELEGATE SEATS' },
                    { n: String(stats.countries), label: stats.countries === 1 ? 'COUNTRY' : 'COUNTRIES' },
                  ].map(stat => (
                    <div key={stat.label} className="pl-4" style={{ borderLeft: '2px solid #B6871F' }}>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '26px', color: '#1B3828', margin: 0, lineHeight: 1.1 }}>
                        {stat.n}
                      </p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.16em', color: '#9A8A78', margin: '3px 0 0 0' }}>
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next-up boarding pass */}
            <div className="w-full lg:w-[420px] flex-shrink-0">
              {nextUp ? (
                <NextUpCard conf={nextUp} />
              ) : (
                <div className="animate-pulse" style={{ backgroundColor: 'rgba(221,212,192,0.55)', borderRadius: '24px', height: '360px' }} />
              )}
            </div>
          </div>
        </section>

        {/* ── The departures board ───────────────────────────────────── */}
        <section className="px-6 md:px-14 pb-20">
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
            <div className="flex items-center gap-4 mb-5">
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
                THE DEPARTURES BOARD
              </span>
              <span aria-hidden style={{ color: '#B6871F', fontSize: '10px' }}>◆</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
                {conferences.length} LISTED
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />
            </div>

            {/* Column headings (desktop) */}
            <div
              className="hidden md:grid md:grid-cols-[110px_minmax(0,1fr)_190px_130px_90px_150px] md:gap-4 px-4 pb-3"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#9A8A78' }}
            >
              <span>DATES</span>
              <span>CONFERENCE</span>
              <span>LOCATION</span>
              <span>DELEGATES</span>
              <span>FEE</span>
              <span className="text-right">STATUS</span>
            </div>

            {ordered.length > 0 ? (
              <div style={{ borderBottom: '1px solid rgba(221,212,192,0.9)' }}>
                {ordered.map(conf => <LedgerRow key={conf.id} conf={conf} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="animate-pulse" style={{ backgroundColor: 'rgba(221,212,192,0.55)', borderRadius: '14px', height: '76px' }} />
                ))}
              </div>
            )}

            <div className="flex justify-center mt-10">
              <Link
                href="/conferences/explore"
                className="inline-block rounded-2xl py-4 px-10 font-bold text-sm tracking-widest transition-colors focus:outline-none text-center"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none', boxShadow: '0 8px 24px rgba(27,56,40,0.18)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                EXPLORE →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Organiser — ledger-style numbered feature list ──────────── */}
        <section
          className="px-6 md:px-14 py-20"
          style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0', borderBottom: '1px solid #DDD4C0' }}
        >
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start" style={{ maxWidth: '1180px', margin: '0 auto' }}>
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

            <div className="flex-1 w-full" style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
              {ORGANISER_CARDS.map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="flex items-center gap-5 py-5"
                    style={{ borderBottom: '1px solid rgba(221,212,192,0.9)' }}
                  >
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: '#B6871F', width: '26px', flexShrink: 0 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: '38px', height: '38px', borderRadius: '12px', backgroundColor: 'rgba(27,56,40,0.07)' }}
                    >
                      <Icon size={17} style={{ color: '#1B3828' }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[16px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                        {card.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                        {card.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Roles — numbered editorial list ─────────────────────────── */}
        <section className="px-6 md:px-14 py-20">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start" style={{ maxWidth: '1180px', margin: '0 auto' }}>
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

        {/* ── Globe — centred over faded world map ────────────────────── */}
        <section
          className="px-6 md:px-14 py-24 relative overflow-hidden"
          style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0' }}
        >
          <img
            src="/map/world_map.png"
            alt=""
            aria-hidden
            className="pointer-events-none select-none"
            style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              width: 'min(920px, 96%)', opacity: 0.2, mixBlendMode: 'multiply',
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
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
                border: '1.5px solid rgba(27,56,40,0.4)', color: '#1B3828', backgroundColor: 'rgba(250,248,243,0.7)',
                fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', textDecoration: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(250,248,243,0.7)'; }}
            >
              {COPY.globeCta}
            </Link>
          </div>
        </section>

        <LabFooter />
      </div>
    </div>
  );
}
