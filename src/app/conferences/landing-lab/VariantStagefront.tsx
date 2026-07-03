'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V1 · "Stagefront" — the full composition (owner-approved evolution, restructured).
//
// The LIMUN theatre banner opens the show as a hero backdrop, but it is now
// CONSTRAINED to the hero zone: everything below the featured-three sits on
// clean cream / ivory slabs so each section reads as its own distinct band.
//
// Composition, top to bottom:
//   1. Hero (poster-first, nav floats over)                     — DARK (theatre photo)
//   2. Featured three upcoming conferences (shared card)        — DARK (hero zone)
//   3. "Opportunities beyond delegating" job board              — CREAM (no panel)
//   4. "Happening near you" regional auto-scroll rail (IP geo)  — IVORY
//   5. mymun-inspired "What is MUN / Why Gavelling" pair         — CREAM
//   6. Organiser tools — photo backdrop, 2×2 grid + gold CTA    — PHOTO
//   7. The rest of the season — RA-style month-grouped ledger   — IVORY
//   8. The production globe section, verbatim                   — FOREST
//   9. Ivory footer (design rule)
//
// The three featured cards + the regional rail reuse the SHARED ConferenceCard
// (../ConferenceCard) — the same definition the explore directory renders.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CreditCard, FileText, MapPin, Users, Zap } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { supabase } from '@/lib/supabase';
import { UN_COUNTRIES } from '@/lib/countries';
import { ConferenceCard } from '../ConferenceCard';
import {
  LabConference, RatingSummary,
  CREAM, FOREST, GOLD, IVORY, MONO, PALE_GOLD, SANS, TAUPE, HAIRLINE, GRAIN,
  compactRange, feeLabel, isConcluded, monthLabel, pickHeadliner,
  Stars, LabFooter,
} from './shared';

// Light-on-dark tokens for the hero zone.
const IVORY_70 = 'rgba(237,231,216,0.7)';
const IVORY_55 = 'rgba(237,231,216,0.55)';

// Ink-on-cream tokens for the light slabs.
const INK = '#1C1410';
const INK_70 = '#4A4238';
const INK_55 = '#6B5F52';

interface JobStats {
  open: number;
  hiring: number;
  chairing: number;
}

// Resolve a Vercel ISO-3166 alpha-2 code (e.g. "GB") to a full country name
// so it can be matched against conference.country ("United Kingdom").
function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = UN_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
  return hit?.name ?? null;
}

interface GeoResult {
  country: string | null; // full name
  city: string | null;
}

export default function VariantStagefront({
  conferences,
  ratings,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>;
}) {
  const router = useRouter();
  const headliner = useMemo(() => pickHeadliner(conferences), [conferences]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // The three soonest upcoming conferences take the featured row.
  const upcomingTrio = useMemo(
    () =>
      conferences
        .filter(c => !isConcluded(c))
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 3),
    [conferences],
  );

  // Month buckets for the RA-style season listing, upcoming first.
  const season = useMemo(() => {
    const sorted = [...conferences].sort((a, b) => {
      const ac = isConcluded(a) ? 1 : 0;
      const bc = isConcluded(b) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return a.start_date.localeCompare(b.start_date);
    });
    const buckets: { label: string; items: LabConference[] }[] = [];
    for (const c of sorted) {
      const label = monthLabel(c.start_date);
      const last = buckets[buckets.length - 1];
      if (last && last.label === label) last.items.push(c);
      else buckets.push({ label, items: [c] });
    }
    return buckets;
  }, [conferences]);

  // ── Geolocation ────────────────────────────────────────────────────────────
  // Fetch /api/geo (Vercel edge headers). If it yields nothing (local dev, or a
  // visitor Vercel can't place), fall back to a keyless IP API. Never blocks render.
  const [geo, setGeo] = useState<GeoResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/geo');
        if (res.ok) {
          const data = await res.json();
          const country = countryNameFromCode(data.countryCode) ?? (data.country ?? null);
          if (!cancelled && (country || data.city)) {
            setGeo({ country, city: data.city ?? null });
            return;
          }
        }
      } catch { /* fall through to the keyless lookup */ }

      // Fallback: free, no-key IP geolocation.
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const country = data.country_name ?? countryNameFromCode(data.country_code) ?? null;
          if (!cancelled) setGeo({ country, city: data.city ?? null });
        }
      } catch { /* geolocation is best-effort — leave geo null */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Regional conferences: those in the visitor's country first (upcoming only),
  // else a graceful soonest-upcoming fallback.
  const regional = useMemo(() => {
    const upcoming = conferences.filter(c => !isConcluded(c));
    if (geo?.country) {
      const inCountry = upcoming.filter(
        c => c.country.toLowerCase() === geo.country!.toLowerCase(),
      );
      if (inCountry.length > 0) {
        return { list: inCountry.sort((a, b) => a.start_date.localeCompare(b.start_date)), matched: true };
      }
    }
    return {
      list: upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date)),
      matched: false,
    };
  }, [conferences, geo]);

  const regionHeading = geo?.country ? `MUN in ${geo.country}` : 'Happening near you';
  const regionSub = regional.matched
    ? geo?.city
      ? `Conferences around ${geo.city} and across ${geo!.country}.`
      : `Conferences on the board in ${geo!.country} right now.`
    : geo?.country
      ? `None in ${geo.country} yet — here's what's coming up across the circuit.`
      : `Finding your region… here's what's coming up across the circuit.`;

  // Live job-board stats — fetched dynamically (seed data changes under us).
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('category, conference_id')
        .eq('is_open', true);
      if (cancelled || !data) return;
      const hiring = new Set(data.map(r => r.conference_id)).size;
      const chairing = data.filter(r => String(r.category ?? '').toLowerCase().includes('chair')).length;
      setJobStats({ open: data.length, hiring, chairing });
    })();
    return () => { cancelled = true; };
  }, []);

  const goTo = (slug: string) => router.push(`/conferences/${slug}`);

  return (
    <div style={{ backgroundColor: CREAM, minHeight: '100vh', position: 'relative' }}>
      <style>{`
        @keyframes sfRailScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .sf-rail-track { animation: sfRailScroll 46s linear infinite; }
        .sf-rail:hover .sf-rail-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .sf-rail { overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
          .sf-rail-track { animation: none !important; transform: none !important; }
          .sf-rail-track > * { scroll-snap-align: start; }
          .sf-rail-dupe { display: none !important; }
        }
      `}</style>

      {/* ── Hero backdrop — constrained to the hero zone only ──────────────── */}
      <div
        className="absolute inset-x-0 top-0 z-0"
        aria-hidden="true"
        style={{ height: 'min(160vh, 1500px)', overflow: 'hidden' }}
      >
        {headliner?.banner_url ? (
          <img src={headliner.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(160deg, #12241B 0%, ${FOREST} 55%, #2A5A3C 130%)` }}
          />
        )}
        {/* Darkening + a hard fade to cream at the bottom of the hero zone */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(8,18,13,0.5) 0%, rgba(8,18,13,0.34) 26%, rgba(8,18,13,0.7) 58%, rgba(10,22,16,0.94) 82%, #FAF8F3 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 80% at 50% 28%, transparent 40%, rgba(6,14,10,0.5) 76%, rgba(6,14,10,0.72) 100%)',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative" style={{ minHeight: 'min(92vh, 860px)', display: 'flex', flexDirection: 'column' }}>
          <SiteNav overlay />

          <div className="relative flex-1 flex flex-col justify-end px-6 md:px-14 pb-12 md:pb-16 pt-40">
            <div style={{ maxWidth: '760px' }}>
              <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', color: PALE_GOLD, margin: '0 0 18px 0' }}>
                {conferences.length > 0 ? `${conferences.length} CONFERENCE${conferences.length === 1 ? '' : 'S'} ON THE BOARD` : 'THE MUN CIRCUIT'}
              </p>
              <h1
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 'clamp(44px, 7.5vw, 92px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.02em',
                  color: CREAM,
                  margin: 0,
                  textShadow: '0 2px 24px rgba(0,0,0,0.35)',
                }}
              >
                Go where<br />the debate is.
              </h1>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(15px, 1.6vw, 18px)',
                  lineHeight: 1.55,
                  color: 'rgba(237,231,216,0.82)',
                  margin: '20px 0 0 0',
                  maxWidth: '460px',
                }}
              >
                Real conferences, real committee rooms — from London to San Salvador. Pick your weekend.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8" style={{ marginTop: '32px' }}>
                <Link
                  href="/conferences/explore"
                  className="inline-flex items-center gap-2.5"
                  style={{
                    fontFamily: SANS,
                    fontSize: '15px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: '#14100B',
                    backgroundColor: PALE_GOLD,
                    padding: '15px 28px',
                    borderRadius: '9999px',
                    textDecoration: 'none',
                    boxShadow: '0 14px 36px rgba(0,0,0,0.35)',
                    transition: 'transform 180ms ease, background-color 180ms ease',
                    alignSelf: 'flex-start',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
                >
                  Find a conference <ArrowRight size={17} strokeWidth={2.5} />
                </Link>
                <div className="flex flex-col gap-1.5">
                  <HeroTextLink href="/conferences/new" label="Organising one? List it free" />
                  <HeroTextLink href="/conferences/roles" label="Chair or staff a committee" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Featured three — shared ConferenceCard, still in the hero zone ── */}
        {upcomingTrio.length > 0 && (
          <section className="px-6 md:px-14" style={{ paddingTop: '20px', paddingBottom: '64px' }}>
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: PALE_GOLD, margin: '0 0 8px 0' }}>
              TAKING THE FLOOR NEXT
            </p>
            <h2
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 'clamp(26px, 3vw, 38px)',
                letterSpacing: '-0.015em',
                color: CREAM,
                margin: '0 0 30px 0',
                textShadow: '0 2px 18px rgba(0,0,0,0.4)',
              }}
            >
              The next three gavels to fall.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {upcomingTrio.map(c => (
                <div key={c.id} style={{ filter: 'drop-shadow(0 22px 44px rgba(0,0,0,0.4))' }}>
                  <ConferenceCard
                    conf={c}
                    hovered={hoveredId === c.id}
                    onHover={() => setHoveredId(c.id)}
                    onLeave={() => setHoveredId(null)}
                    onClick={() => goTo(c.slug)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Opportunities beyond delegating — job board, cream, no panel ──── */}
        <section
          className="relative px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: '72px', paddingBottom: '80px' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-0">
            <div className="lg:w-[42%]" style={{ position: 'relative', zIndex: 2 }}>
              <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: GOLD, margin: '0 0 14px 0' }}>
                THE JOB BOARD
              </p>
              <h2
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 'clamp(30px, 3.6vw, 50px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                  color: INK,
                  margin: 0,
                }}
              >
                Opportunities beyond delegating.
              </h2>
              <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.65, color: INK_70, margin: '18px 0 0 0', maxWidth: '420px' }}>
                The best seat in the room isn&rsquo;t always behind a placard. Conferences on
                Gavelling hire chairs, secretariat and staff every season — and your MUN CV
                is the application.
              </p>
              <Link
                href="/conferences/roles"
                className="inline-flex items-center gap-2.5"
                style={{
                  marginTop: '28px',
                  fontFamily: SANS,
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: PALE_GOLD,
                  backgroundColor: FOREST,
                  padding: '14px 26px',
                  borderRadius: '9999px',
                  textDecoration: 'none',
                  boxShadow: '0 14px 30px rgba(27,56,40,0.22)',
                  transition: 'transform 180ms ease, background-color 180ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = FOREST; }}
              >
                SEE OPEN ROLES <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
            </div>

            <div className="lg:w-[58%]" style={{ position: 'relative' }}>
              {/*
                Photo: Miguel Henriques via Unsplash (license-safe, free to use)
                https://unsplash.com/photos/9OKGEVJiTKk
                /public/landing/podium-speaker.jpg (~170 KB).
              */}
              <div
                className="relative overflow-hidden rounded-3xl"
                style={{ border: '1px solid rgba(27,56,40,0.14)', boxShadow: '0 30px 60px rgba(27,56,40,0.18)' }}
              >
                <img
                  src="/landing/podium-speaker.jpg"
                  alt="A chair addressing a full auditorium of delegates"
                  className="w-full object-cover"
                  style={{ display: 'block', aspectRatio: '3 / 2' }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-3"
                  style={{
                    backgroundColor: 'rgba(10,22,16,0.72)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderTop: '1px solid rgba(238,217,138,0.25)',
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', color: PALE_GOLD }}>
                    THE DAIS, MID-SESSION
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.14em', color: IVORY_55 }}>
                    CHAIRS · SECRETARIAT · STAFF
                  </span>
                </div>
              </div>

              {/* Live stat ledger — straddles the photo's left edge */}
              <div
                className="lg:absolute lg:-left-16 lg:bottom-14 mt-5 lg:mt-0 grid grid-cols-3 lg:grid-cols-1 gap-px overflow-hidden rounded-2xl"
                style={{
                  border: '1px solid rgba(27,56,40,0.9)',
                  backgroundColor: 'rgba(27,56,40,0.9)',
                  boxShadow: '0 20px 50px rgba(27,56,40,0.28)',
                  maxWidth: '460px',
                }}
              >
                {[
                  { n: jobStats ? String(jobStats.open) : '—', label: 'OPEN ROLES', sub: 'accepting applications now' },
                  { n: jobStats ? String(jobStats.hiring) : '—', label: 'CONFERENCES HIRING', sub: 'across the circuit' },
                  { n: jobStats ? String(jobStats.chairing) : '—', label: 'CHAIR SEATS', sub: 'daises looking for a gavel' },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="px-5 py-4"
                    style={{ backgroundColor: FOREST }}
                  >
                    <p style={{ fontFamily: SANS, fontWeight: 900, fontSize: '26px', lineHeight: 1, color: PALE_GOLD, margin: 0 }}>
                      {stat.n}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', color: 'rgba(237,231,216,0.9)', margin: '7px 0 0 0' }}>
                      {stat.label}
                    </p>
                    <p style={{ fontFamily: SANS, fontSize: '11.5px', color: IVORY_55, margin: '3px 0 0 0' }}>
                      {stat.sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Happening near you — regional auto-scroll rail (IP geo) ───────── */}
        {regional.list.length > 0 && (
          <section
            className="relative"
            style={{ backgroundColor: IVORY, paddingTop: '64px', paddingBottom: '72px' }}
          >
            <div className="px-6 md:px-14">
              <p className="flex items-center gap-2" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: GOLD, margin: '0 0 8px 0' }}>
                <MapPin size={13} strokeWidth={2.25} /> NEAR YOU
              </p>
              <h2
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 'clamp(26px, 3vw, 38px)',
                  letterSpacing: '-0.015em',
                  color: INK,
                  margin: '0 0 6px 0',
                }}
              >
                {regionHeading}
              </h2>
              <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: INK_55, margin: 0, maxWidth: '540px' }}>
                {regionSub}
              </p>
            </div>

            <RegionalRail
              conferences={regional.list}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onClick={goTo}
            />
          </section>
        )}

        {/* ── mymun-inspired pair — cream backdrop, ink-on-cream cards ──────── */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: '72px', paddingBottom: '80px' }}
        >
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: GOLD, margin: '0 0 8px 0' }}>
            NEW TO THE CIRCUIT?
          </p>
          <h2
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 'clamp(26px, 3vw, 38px)',
              letterSpacing: '-0.015em',
              color: INK,
              margin: '0 0 30px 0',
            }}
          >
            Start here.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <ExplainerCard photo="/landing-right.jpg" photoAlt="Two delegates working through a draft resolution together">
              <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: GOLD, margin: 0 }}>
                THE GAME
              </p>
              <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 28px)', letterSpacing: '-0.01em', color: INK, margin: '12px 0 0 0' }}>
                What is Model UN, exactly?
              </h3>
              <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.7, color: INK_70, margin: '14px 0 0 0' }}>
                Model United Nations is diplomacy as a competitive sport. You represent a country
                you probably disagree with, in a committee debating a crisis that is very real,
                against delegates who came to win. Over a weekend you speak, caucus, draft and
                vote — and walk out better at arguing than most adults you know.{' '}
                <BodyLink href="/conferences/explore">Browse the circuit</BodyLink> to find your
                first committee room, or see how chairs{' '}
                <BodyLink href="/">run sessions live on Gavelling</BodyLink>.
              </p>
              <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.7, color: INK_70, margin: '12px 0 0 0' }}>
                No experience needed. Every great delegate started by mispronouncing
                &ldquo;moderated caucus&rdquo;.
              </p>
            </ExplainerCard>

            <ExplainerCard photo="/landing-left.jpg" photoAlt="A delegate rising to speak in committee">
              <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: GOLD, margin: 0 }}>
                WHY GAVELLING
              </p>
              <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 28px)', letterSpacing: '-0.01em', color: INK, margin: '12px 0 0 0' }}>
                Why participate through Gavelling?
              </h3>
              <ol style={{ listStyle: 'none', margin: '18px 0 0 0', padding: 0 }}>
                {[
                  ['One directory, honest facts.', 'Every listed conference with real dates, fees and cities — no chasing Instagram bios for a registration link.'],
                  ['One profile, every application.', 'Apply to any conference with the same Gavelling account. Fill your details once, ever.'],
                  ['A MUN CV that writes itself.', 'Allocations, committees and awards land on your record automatically as you attend.'],
                  ['Verified history.', 'Organisers see conferences you actually attended — your record is proof, not claims.'],
                  ['Reviews from the room.', 'Rate conferences you attended and read delegates who were really there before you commit a weekend.'],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4" style={{ marginTop: i === 0 ? 0 : '14px' }}>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: '13px',
                        fontWeight: 500,
                        color: PALE_GOLD,
                        backgroundColor: FOREST,
                        width: '26px',
                        height: '26px',
                        borderRadius: '9999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.6, color: INK_70 }}>
                      <strong style={{ color: INK, fontWeight: 700 }}>{title}</strong>{' '}
                      {body}
                    </span>
                  </li>
                ))}
              </ol>
            </ExplainerCard>
          </div>
        </section>

        {/* ── Organiser tools — photographic backdrop, 2×2 grid + gold CTA ──── */}
        <section className="relative overflow-hidden" style={{ paddingTop: '80px', paddingBottom: '88px' }}>
          {/*
            Backdrop photo: Marvin Meyer via Unsplash (license-safe, free to use)
            https://unsplash.com/photos/SYTO3xs06fU
            /public/landing/organiser-desk.jpg (~161 KB) — a team running an event at a laptop.
          */}
          <div className="absolute inset-0 z-0" aria-hidden="true">
            <img src="/landing/organiser-desk.jpg" alt="" className="w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(120deg, rgba(10,22,16,0.9) 0%, rgba(12,26,19,0.82) 45%, rgba(12,26,19,0.72) 100%)',
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.08 }}
            />
          </div>

          <div className="relative z-10 px-6 md:px-14">
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: PALE_GOLD, margin: '0 0 8px 0' }}>
              ORGANISER TOOLS
            </p>
            <h2
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 'clamp(26px, 3vw, 38px)',
                letterSpacing: '-0.015em',
                color: CREAM,
                margin: 0,
              }}
            >
              Built for the people running the show.
            </h2>
            <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: IVORY_70, margin: '14px 0 40px 0', maxWidth: '520px' }}>
              Registration, allocation, documents and live committee sessions — one platform,
              zero fees for organisers.
            </p>

            {/* 2×2 square block of highlight tiles */}
            <div
              className="grid grid-cols-2 gap-4 md:gap-5"
              style={{ maxWidth: '620px', margin: '0 auto' }}
            >
              {[
                { icon: Users, title: 'Smart Assignment', desc: 'Preferences + experience scores. One-click auto-assign.' },
                { icon: FileText, title: 'Document Portal', desc: 'Study guides, position papers, feedback — all in one place.' },
                { icon: CreditCard, title: 'Transparent Fees', desc: '5% delegate surcharge, waived with Gavelling Unlimited. You keep 100%.' },
                { icon: Zap, title: 'Automated Comms', desc: 'Acceptance emails, allocation codes, reminders — sent automatically.' },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl flex flex-col items-center text-center"
                    style={{
                      backgroundColor: 'rgba(12,26,19,0.55)',
                      backdropFilter: 'blur(14px) saturate(1.15)',
                      WebkitBackdropFilter: 'blur(14px) saturate(1.15)',
                      border: '1px solid rgba(237,231,216,0.16)',
                      aspectRatio: '1 / 1',
                      padding: '22px 18px',
                      justifyContent: 'center',
                      gap: '2px',
                    }}
                  >
                    <Icon size={40} color={PALE_GOLD} strokeWidth={1.75} />
                    <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: '15px', color: CREAM, margin: '14px 0 0 0' }}>
                      {card.title}
                    </h3>
                    <p style={{ fontFamily: SANS, fontSize: '12px', lineHeight: 1.5, color: IVORY_70, margin: '6px 0 0 0' }}>
                      {card.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Standalone gold CTA below the 2×2 block */}
            <div className="flex justify-center" style={{ marginTop: '36px' }}>
              <Link
                href="/conferences/new"
                className="inline-flex items-center gap-3"
                style={{
                  fontFamily: SANS,
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: FOREST,
                  backgroundColor: PALE_GOLD,
                  padding: '16px 32px',
                  borderRadius: '9999px',
                  textDecoration: 'none',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
                  transition: 'transform 180ms ease, background-color 180ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
              >
                List your conference <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── The rest of the season — RA-style month-grouped ledger, ivory ─── */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: IVORY, paddingTop: '64px', paddingBottom: '72px' }}
        >
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: GOLD, margin: '0 0 8px 0' }}>
            THE SEASON
          </p>
          <h2
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 'clamp(26px, 3vw, 38px)',
              letterSpacing: '-0.015em',
              color: INK,
              margin: '0 0 24px 0',
            }}
          >
            Every gavel on the calendar.
          </h2>
          {season.map(bucket => (
            <div key={bucket.label} style={{ marginTop: '24px' }}>
              <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: INK_55, margin: '0 0 2px 0' }}>
                {bucket.label.toUpperCase()}
              </p>
              {bucket.items.map(c => (
                <SeasonRow key={c.id} conference={c} rating={ratings[c.id]} />
              ))}
            </div>
          ))}
          <div style={{ marginTop: '40px' }}>
            <Link
              href="/conferences/explore"
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                letterSpacing: '0.16em',
                color: GOLD,
                textDecoration: 'none',
                borderBottom: `1px solid ${GOLD}`,
                paddingBottom: '4px',
              }}
            >
              SEE THE FULL DIRECTORY <ArrowRight size={14} strokeWidth={2.25} />
            </Link>
          </div>
        </section>

        {/* ── Section: MUN Across the Globe — copied verbatim from production ── */}
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
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
          />

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
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '30% center', display: 'block', opacity: 0.82 }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 80% 85% at 65% 50%, transparent 35%, rgba(27,56,40,0.45) 58%, rgba(27,56,40,0.82) 75%, #1B3828 95%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, #1B3828 0%, #1B3828 4%, rgba(27,56,40,0.6) 14%, transparent 28%)',
              }}
            />
          </div>

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
                alignSelf: 'flex-start',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              EXPLORE CONFERENCES WORLDWIDE →
            </Link>
          </div>
        </section>

        <LabFooter />
      </div>
    </div>
  );
}

// ── Local pieces ─────────────────────────────────────────────────────────────

function HeroTextLink({ href, label }: { href: string; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: SANS,
        fontSize: '13.5px',
        fontWeight: 600,
        color: hover ? CREAM : 'rgba(237,231,216,0.7)',
        textDecoration: 'none',
        transition: 'color 160ms ease',
        textShadow: '0 1px 6px rgba(0,0,0,0.4)',
      }}
    >
      {label}
      <ArrowUpRight size={13} strokeWidth={2.25} style={{ opacity: hover ? 1 : 0.6, transition: 'opacity 160ms ease' }} />
    </Link>
  );
}

/** Inline link inside body copy (ink-on-cream, gold underline). */
function BodyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: GOLD,
        textDecoration: 'none',
        borderBottom: `1px solid ${GOLD}`,
        transition: 'color 150ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8A6614'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = GOLD; }}
    >
      {children}
    </Link>
  );
}

/**
 * Regional auto-scrolling rail. Duplicates the card list once so the CSS
 * translateX(-50%) loop is seamless. Pauses on hover. Under prefers-reduced-
 * motion the track becomes a plain scroll-snap rail (the duplicate is hidden).
 */
function RegionalRail({
  conferences, hoveredId, onHover, onClick,
}: {
  conferences: LabConference[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onClick: (slug: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  // Only loop-duplicate when there are enough cards to fill the row; a couple of
  // cards looping looks jittery, so with <4 we render a single, static set.
  const loop = conferences.length >= 4;
  const sequence = loop ? [...conferences, ...conferences] : conferences;

  return (
    <div
      className="sf-rail"
      style={{ marginTop: '32px', overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}
    >
      <div
        ref={track}
        className={loop ? 'sf-rail-track' : undefined}
        style={{ display: 'flex', gap: '24px', width: 'max-content', paddingLeft: '24px', paddingRight: '24px', paddingTop: '4px', paddingBottom: '12px' }}
      >
        {sequence.map((c, i) => {
          const isDupe = loop && i >= conferences.length;
          return (
            <div
              key={`${c.id}-${i}`}
              className={isDupe ? 'sf-rail-dupe' : undefined}
              aria-hidden={isDupe}
              style={{ width: '320px', flexShrink: 0 }}
            >
              <ConferenceCard
                conf={c}
                hovered={!isDupe && hoveredId === c.id}
                onHover={() => onHover(c.id)}
                onLeave={() => onHover(null)}
                onClick={() => onClick(c.slug)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** mymun-style rounded card: large photo on top, editorial text below — cream. */
function ExplainerCard({
  photo, photoAlt, children,
}: {
  photo: string; photoAlt: string; children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-3xl flex flex-col"
      style={{
        backgroundColor: CREAM,
        border: `1px solid ${HAIRLINE}`,
        boxShadow: '0 20px 44px rgba(27,56,40,0.12)',
      }}
    >
      <div style={{ position: 'relative' }}>
        <img
          src={photo}
          alt={photoAlt}
          className="w-full object-cover"
          style={{ display: 'block', height: '240px', objectPosition: 'center 30%' }}
        />
      </div>
      <div style={{ padding: '26px 28px 30px' }}>
        {children}
      </div>
    </div>
  );
}

function SeasonRow({ conference: c, rating }: { conference: LabConference; rating?: RatingSummary }) {
  const [hover, setHover] = useState(false);
  const concluded = isConcluded(c);
  return (
    <Link
      href={`/conferences/${c.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-baseline md:items-center gap-4 md:gap-8 flex-wrap md:flex-nowrap"
      style={{
        padding: '20px 4px',
        borderTop: `1px solid ${HAIRLINE}`,
        textDecoration: 'none',
        backgroundColor: hover ? 'rgba(27,56,40,0.04)' : 'transparent',
        transition: 'background-color 160ms ease',
        opacity: concluded ? 0.55 : 1,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.08em', color: GOLD, width: '96px', flexShrink: 0 }}>
        {compactRange(c.start_date, c.end_date)}
      </span>
      <span style={{ flex: 1, minWidth: '200px' }}>
        <span style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 700, color: INK }}>
          {c.full_name}
        </span>
        <span style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 500, color: INK_55, marginLeft: '12px' }}>
          {c.city}, {c.country}
        </span>
      </span>
      <span className="hidden sm:inline" style={{ fontFamily: MONO, fontSize: '12px', color: rating ? GOLD : TAUPE, flexShrink: 0 }}>
        {rating ? (
          <span className="inline-flex items-center gap-1.5">
            <Stars avg={rating.avg} size={12} color={GOLD} />
            {rating.avg.toFixed(1)}
          </span>
        ) : concluded ? 'CONCLUDED' : `${c.expected_delegates.toLocaleString()} delegates`}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '12px', color: INK_70, width: '76px', textAlign: 'right', flexShrink: 0 }}>
        {feeLabel(c)}
      </span>
      <ArrowUpRight
        size={16}
        strokeWidth={2}
        className="hidden md:block"
        style={{ color: GOLD, opacity: hover ? 1 : 0.35, transition: 'opacity 160ms ease', flexShrink: 0 }}
      />
    </Link>
  );
}
