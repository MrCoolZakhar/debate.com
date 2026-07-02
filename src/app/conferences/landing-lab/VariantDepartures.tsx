'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Compass, Gavel, Megaphone } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { GRAIN, LabConference, LabFooter, shortDate, feeLabel } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 3 — "INTERNATIONAL DEPARTURES"
// Dark forest, map-led discovery. The globe video anchors the hero; the
// centrepiece is a departures-board table of real upcoming conferences
// (DM Mono rows: date / conference / city / delegates / fee / status).
// Three boarding-pass CTA cards route to explore / organise / roles.
// ─────────────────────────────────────────────────────────────────────────────

function BoardRow({ conf, index }: { conf: LabConference; index: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;

  return (
    <div
      onClick={() => router.push(`/conferences/${conf.slug}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="grid items-center gap-3 px-4 md:px-6 py-4 cursor-pointer"
      style={{
        gridTemplateColumns: 'minmax(64px, 88px) minmax(0, 2.4fr) minmax(0, 1.4fr) minmax(72px, 110px) minmax(64px, 96px) minmax(64px, 84px)',
        borderTop: index > 0 ? '1px solid rgba(238,217,138,0.1)' : 'none',
        backgroundColor: hovered ? 'rgba(238,217,138,0.06)' : 'transparent',
        transition: 'background-color 200ms ease',
      }}
    >
      {/* Departure date */}
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', letterSpacing: '0.08em', color: '#EED98A' }}>
        {shortDate(conf.start_date)}
      </span>

      {/* Conference: floating logo + name */}
      <div className="flex items-center gap-3 min-w-0">
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            className="flex-shrink-0"
            style={{ width: '38px', height: '38px', objectFit: 'contain', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.45))' }}
          />
        ) : (
          <span
            className="flex-shrink-0"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700, color: 'rgba(238,217,138,0.7)' }}
          >
            {conf.acronym.slice(0, 4).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p
            className="truncate"
            style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '14px',
              color: hovered ? '#EED98A' : 'white', margin: 0, transition: 'color 200ms ease',
            }}
          >
            {conf.full_name}
          </p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.16em', color: 'rgba(237,231,216,0.45)', margin: '1px 0 0 0' }}>
            {conf.acronym}
          </p>
        </div>
      </div>

      {/* Destination */}
      <div className="flex items-center gap-2 min-w-0">
        {flagUrl && (
          <img
            src={flagUrl}
            alt={conf.country}
            style={{ width: '18px', height: '13px', borderRadius: '2.5px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
          />
        )}
        <span className="truncate" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 500, color: 'rgba(237,231,216,0.85)' }}>
          {conf.city}
        </span>
      </div>

      {/* Delegates */}
      <span className="hidden sm:block" style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(237,231,216,0.6)' }}>
        {conf.expected_delegates.toLocaleString()} DEL
      </span>

      {/* Fee */}
      <span
        className="hidden sm:block"
        style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: conf.fee_amount === 0 ? '#7FC29B' : 'rgba(238,217,138,0.85)' }}
      >
        {feeLabel(conf)}
      </span>

      {/* Status */}
      <span className="flex items-center gap-1.5 justify-self-end sm:justify-self-start">
        <span
          className="flex-shrink-0 rounded-full"
          style={{
            width: '6px', height: '6px', backgroundColor: '#7FC29B',
            boxShadow: hovered ? '0 0 8px rgba(127,194,155,0.9)' : '0 0 5px rgba(127,194,155,0.6)',
          }}
        />
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#7FC29B' }}>
          OPEN
        </span>
      </span>
    </div>
  );
}

const PASSES = [
  {
    gate: 'GATE 01',
    icon: Compass,
    title: 'Explore the directory',
    desc: 'Filter every listed conference by continent, format and level.',
    cta: 'BROWSE ALL',
    href: '/conferences/explore',
  },
  {
    gate: 'GATE 02',
    icon: Megaphone,
    title: 'Organise fee-free',
    desc: 'Registration, allocations and comms. Organisers keep 100%.',
    cta: 'START A CONFERENCE',
    href: '/conferences/organise',
  },
  {
    gate: 'GATE 03',
    icon: Gavel,
    title: 'Get hired to chair',
    desc: 'Chair, secretariat and staff openings across the circuit.',
    cta: 'FIND A ROLE',
    href: '/conferences/roles',
  },
];

function BoardingPass({ pass }: { pass: (typeof PASSES)[number] }) {
  const [hovered, setHovered] = useState(false);
  const Icon = pass.icon;
  return (
    <Link
      href={pass.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col overflow-hidden"
      style={{
        borderRadius: '18px',
        backgroundColor: 'rgba(250,248,243,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(221,212,192,0.95)',
        textDecoration: 'none',
        boxShadow: hovered ? '0 24px 52px rgba(0,0,0,0.4)' : '0 10px 32px rgba(0,0,0,0.28)',
        transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'all 280ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Stub header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1.5px dashed rgba(154,138,120,0.5)' }}
      >
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.24em', color: '#B6871F' }}>
          {pass.gate}
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.18em', color: '#9A8A78' }}>
          GVL <span aria-hidden style={{ color: '#B6871F' }}>◆</span> MUN
        </span>
      </div>
      {/* Perforation notches */}
      <span aria-hidden className="absolute rounded-full" style={{ width: '16px', height: '16px', backgroundColor: '#16301F', left: '-8px', top: '34px' }} />
      <span aria-hidden className="absolute rounded-full" style={{ width: '16px', height: '16px', backgroundColor: '#16301F', right: '-8px', top: '34px' }} />

      <div className="flex-1 px-5 pt-4 pb-5">
        <span
          className="flex items-center justify-center mb-3"
          style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(27,56,40,0.08)' }}
        >
          <Icon size={18} style={{ color: '#1B3828' }} />
        </span>
        <p className="font-black text-[17px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: '0 0 4px 0', lineHeight: 1.2 }}>
          {pass.title}
        </p>
        <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55, margin: '0 0 14px 0' }}>
          {pass.desc}
        </p>
        <span
          className="inline-flex items-center gap-1.5 font-bold text-[11.5px]"
          style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em' }}
        >
          {pass.cta}
          <ArrowRight size={13} style={{ transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 220ms ease' }} />
        </span>
      </div>
    </Link>
  );
}

export default function VariantDepartures({ conferences }: { conferences: LabConference[] }) {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#16301F' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }}
      />

      {/* Globe video — upper right ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-0 hidden md:block"
        style={{ right: 0, top: 0, width: '48%', height: '92vh', overflow: 'hidden' }}
      >
        <video
          src="/map/interactive_globe.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '35% center', opacity: 0.5 }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 75% 80% at 68% 42%, transparent 30%, rgba(22,48,31,0.55) 58%, rgba(22,48,31,0.9) 78%, #16301F 96%)',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, #16301F 0%, rgba(22,48,31,0.65) 16%, transparent 40%)',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(22,48,31,0.55) 0%, transparent 22%, transparent 60%, #16301F 96%)',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Glass band so SiteNav's ink text stays legible on forest */}
        <div
          style={{
            backgroundColor: 'rgba(250,248,243,0.9)',
            backdropFilter: 'blur(16px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
            borderBottom: '1px solid rgba(221,212,192,0.7)',
          }}
        >
          <SiteNav />
        </div>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <header className="px-6 md:px-14 pt-14 pb-10">
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <p
              className="mb-4 flex items-center gap-3"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.32em', color: 'rgba(238,217,138,0.7)' }}
            >
              <span
                className="rounded-full"
                style={{ width: '7px', height: '7px', backgroundColor: '#7FC29B', boxShadow: '0 0 8px rgba(127,194,155,0.8)', display: 'inline-block' }}
              />
              INTERNATIONAL DEPARTURES <span aria-hidden style={{ color: '#B6871F' }}>◆</span> LIVE
            </p>
            <h1
              style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: 'clamp(46px, 6.4vw, 96px)', lineHeight: 0.96,
                letterSpacing: '-0.02em', color: 'white', margin: 0,
              }}
            >
              Where will you
              <br />
              <span style={{ color: '#EED98A' }}>debate next?</span>
            </h1>
            <p
              className="mt-5"
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', lineHeight: 1.65, color: 'rgba(237,231,216,0.7)', maxWidth: '440px' }}
            >
              A live board of the world’s Model UN conferences — with the tools to
              attend one, staff one, or run your own.
            </p>
          </div>
        </header>

        {/* ── Departures board ───────────────────────────────────────── */}
        <section className="px-4 md:px-14 pb-12">
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <div
              className="overflow-hidden"
              style={{
                backgroundColor: 'rgba(16,28,21,0.72)',
                backdropFilter: 'blur(18px) saturate(1.2)',
                WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
                border: '1px solid rgba(238,217,138,0.18)',
                borderRadius: '22px',
                boxShadow: '0 28px 72px rgba(0,0,0,0.42)',
              }}
            >
              {/* Board header */}
              <div
                className="flex items-center justify-between px-4 md:px-6 py-3.5"
                style={{ borderBottom: '1px solid rgba(238,217,138,0.16)', backgroundColor: 'rgba(238,217,138,0.05)' }}
              >
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: '#EED98A' }}>
                  UPCOMING CONFERENCES
                </span>
                <span className="hidden sm:block" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: 'rgba(237,231,216,0.45)' }}>
                  {conferences.length} SCHEDULED <span aria-hidden style={{ color: '#B6871F' }}>◆</span> ALL TIMES LOCAL
                </span>
              </div>

              {/* Column captions */}
              <div
                className="grid gap-3 px-4 md:px-6 py-2.5"
                style={{
                  gridTemplateColumns: 'minmax(64px, 88px) minmax(0, 2.4fr) minmax(0, 1.4fr) minmax(72px, 110px) minmax(64px, 96px) minmax(64px, 84px)',
                  borderBottom: '1px solid rgba(238,217,138,0.12)',
                }}
              >
                {['DATE', 'CONFERENCE', 'CITY', 'DELEGATES', 'FEE', 'STATUS'].map((h, i) => (
                  <span
                    key={h}
                    className={i === 3 || i === 4 ? 'hidden sm:block' : i === 5 ? 'justify-self-end sm:justify-self-start' : ''}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(237,231,216,0.4)' }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {conferences.length === 0 ? (
                <p className="px-6 py-10 text-center" style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(237,231,216,0.5)' }}>
                  NO DEPARTURES SCHEDULED — CHECK BACK SOON
                </p>
              ) : (
                conferences.map((conf, i) => <BoardRow key={conf.id} conf={conf} index={i} />)
              )}

              {/* Board footer → explore */}
              <Link
                href="/conferences/explore"
                className="flex items-center justify-center gap-2 py-3.5"
                style={{
                  borderTop: '1px solid rgba(238,217,138,0.14)',
                  fontFamily: "'DM Mono', monospace", fontSize: '10.5px', letterSpacing: '0.24em',
                  color: '#EED98A', textDecoration: 'none', backgroundColor: 'rgba(238,217,138,0.04)',
                  transition: 'background-color 200ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.04)'; }}
              >
                VIEW THE FULL DIRECTORY
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Boarding passes ────────────────────────────────────────── */}
        <section className="px-6 md:px-14 pb-20 flex-1">
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <div className="flex items-center gap-4 mb-6">
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.26em', color: 'rgba(237,231,216,0.45)', whiteSpace: 'nowrap' }}>
                CHOOSE YOUR GATE
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(238,217,138,0.14)' }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PASSES.map(p => <BoardingPass key={p.gate} pass={p} />)}
            </div>
          </div>
        </section>

        <LabFooter />
      </div>
    </div>
  );
}
