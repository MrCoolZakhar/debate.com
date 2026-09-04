'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V1 · "Stagefront", the full composition (owner-approved evolution, restructured).
//
// The LIMUN theatre banner opens the show as a hero backdrop, constrained to
// the hero zone: everything below sits on clean cream / ivory slabs so each
// section reads as its own distinct band.
//
// Composition, top to bottom:
//   1. Hero, headline left, "up next" card rail right         , DARK (theatre photo)
//   2. "Find your seat" role carousel + circuit-in-numbers strip, CREAM
//   3. "Opportunities beyond delegating" job board             , CREAM (no panel)
//   4. "Happening near you" regional auto-scroll rail (IP geo) , IVORY
//   5. The production globe section, verbatim                  , FOREST
//   6. Ivory footer (design rule)
//
// The hero rail + the regional rail reuse the SHARED ConferenceCard
// (../ConferenceCard), the same definition the explore directory renders;
// the hero stack uses its photo-forward `heroCompact` tier (banner photo
// fills the card) so three fit gracefully, pinned to the right screen edge.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, type PanInfo } from 'framer-motion';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { UN_COUNTRIES } from '@/lib/countries';
import { compareStartDate } from '@/lib/conferenceDates';
import { ConferenceCard } from '../ConferenceCard';
import {
  LabConference, RatingSummary,
  CREAM, FOREST, GOLD, IVORY, PALE_GOLD, SANS,
  isConcluded, pickHeadliner,
  LabFooter,
} from './shared';

// Light-on-dark tokens for the hero zone.
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

// "Find your seat" role carousel, one slide per way to be on the circuit.
// Recovered from the pre-neumorphic build (photo card, forest scrim, gold
// primary pill), with one evolution: each slide LEADS with the ROLE as a
// huge Outfit-900 uppercase wordmark, the dominant element on the slide —
// and the short supporting line sits beneath it.
interface RoleSlide {
  role: string; // rendered uppercase, Outfit 900, the biggest words on the slide
  blurb: string;
  image: string;
  imageAlt: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

// Exactly three roles, arranged so the carousel opens on the SECRETARIAT /
// organise path as the primary (centre) slide, with DELEGATES peeking on the
// left and CHAIRS peeking on the right. The array order encodes that layout:
// index 0 is the centre slide; index 1 (Chairs) resolves to the +1 right peek
// and index 2 (Delegates) wraps to the -1 left peek. It loops among these three.
const ROLE_SLIDES: RoleSlide[] = [
  {
    role: 'Secretariat',
    blurb: 'The machine behind the weekend: run applications, allocations, delegations and communications from one place — the whole show, zero fees.',
    image: '/roles/secretariat.webp',
    imageAlt: 'Secretariat staff coordinating a conference',
    primary: { label: 'See open roles', href: '/conferences/roles' },
    secondary: { label: 'List your conference', href: '/conferences/new' },
  },
  {
    role: 'Chairs',
    blurb: 'Gavel in hand: scoring, motions and the speakers list, run live from one dashboard.',
    image: '/roles/chair-card.webp',
    imageAlt: 'A chair presiding over committee from the dais',
    primary: { label: 'Explore chairing opportunities', href: '/conferences/roles' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=chair' },
  },
  {
    role: 'Delegates',
    blurb: 'Browse the circuit, apply once with your Gavelling profile, and build a MUN CV that writes itself.',
    image: '/roles/delegate.jpg',
    imageAlt: 'A delegate speaking from their seat in committee',
    primary: { label: 'Explore conferences', href: '/conferences/explore' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=delegate' },
  },
];

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

// Landing-card conference title rule:
//   • show the `acronym` when set, else the `full_name`
//   • NEVER force/append "MUN"
//   • append the edition year ONLY when the acronym/name does not already
//     contain that same 4-digit year (so "Hult 2026" never becomes
//     "Hult 2026 2026").
function landingConfTitle(c: Pick<LabConference, 'acronym' | 'full_name' | 'start_date'>): string {
  const base = ((c.acronym ?? '').trim() || (c.full_name ?? '').trim());
  const year = c.start_date ? c.start_date.slice(0, 4) : '';
  if (year && /^\d{4}$/.test(year) && !base.includes(year)) return `${base} ${year}`;
  return base;
}

export default function VariantStagefront({
  conferences,
  stats,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>; // accepted for caller compatibility (season ledger removed)
  /** Platform-wide totals (all conferences, not just the published ones the
   *  cards are drawn from). Null until the RPC lands. */
  stats?: { total_conferences: number; published_conferences: number; countries: number } | null;
}) {
  const router = useRouter();
  const headliner = useMemo(() => pickHeadliner(conferences), [conferences]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Conference ids the signed-in viewer already applied to, cards show
  // APPLIED instead of the APPLY pill. RLS returns only the viewer's own rows.
  // memberIds: conferences the viewer is already PART of (organiser via
  // conferences.organizer_id or a conference_organizers row, or an application
  // that reached accepted/assigned/checked-in), those cards show VIEW →
  // instead. Three batched queries total, no per-card work; anonymous viewers
  // skip all of it.
  const { user, session, loading: authLoading } = useAuth();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) { setAppliedIds(new Set()); setMemberIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const authed = getAuthedClient(session.access_token);
      const [appsRes, orgRes, ownedRes] = await Promise.all([
        authed.from('applications').select('conference_id, status').eq('user_id', user.id),
        authed.from('conference_organizers').select('conference_id').eq('user_id', user.id),
        authed.from('conferences').select('id').eq('organizer_id', user.id),
      ]);
      if (cancelled) return;
      const apps = (appsRes.data as { conference_id: string; status: string | null }[]) ?? [];
      setAppliedIds(new Set(apps.map(a => a.conference_id)));
      const MEMBER_STATUSES = new Set(['accepted', 'assigned', 'checked-in']);
      const member = new Set<string>();
      for (const a of apps) if (a.status && MEMBER_STATUSES.has(a.status)) member.add(a.conference_id);
      for (const o of ((orgRes.data as { conference_id: string }[]) ?? [])) member.add(o.conference_id);
      for (const c of ((ownedRes.data as { id: string }[]) ?? [])) member.add(c.id);
      setMemberIds(member);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, session]);

  // The hero's "up next" rail shows the three BIGGEST upcoming conferences
  // (by expected delegate count), with Harvard WorldMUN always pinned to the
  // top slot when it is live.
  const upcomingTrio = useMemo(() => {
    const active = conferences.filter(c => !isConcluded(c));
    const isWorldMun = (c: LabConference) =>
      (c.acronym ?? '').toUpperCase() === 'WORLDMUN' || /worldmun/i.test(c.full_name);
    const worldMun = active.find(isWorldMun);
    const rest = active
      .filter(c => !(worldMun && c.id === worldMun.id))
      .sort((a, b) => (b.expected_delegates || 0) - (a.expected_delegates || 0));
    const ordered = worldMun ? [worldMun, ...rest] : rest;
    return ordered.slice(0, 3);
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
      } catch { /* geolocation is best-effort, leave geo null */ }
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
        return { list: inCountry.sort((a, b) => compareStartDate(a.start_date, b.start_date)), matched: true };
      }
    }
    return {
      list: upcoming.sort((a, b) => compareStartDate(a.start_date, b.start_date)),
      matched: false,
    };
  }, [conferences, geo]);

  const regionHeading = geo?.country ? `MUN in ${geo.country}` : 'Happening near you';
  const regionSub = regional.matched
    ? geo?.city
      ? `Conferences around ${geo.city} and across ${geo!.country}.`
      : `Conferences on the board in ${geo!.country} right now.`
    : geo?.country
      ? `None in ${geo.country} yet. Here's what's coming up across the circuit.`
      : `Finding your region… here's what's coming up across the circuit.`;

  // Live job-board stats, one query, fetched dynamically (seed data changes
  // under us). Feeds the forest stat ledger beside the job-board photo.
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('id, category, conference_id')
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
        .sf-rail-track { animation: sfRailScroll 46s linear infinite; will-change: transform; }
        .sf-rail:hover .sf-rail-track { animation-play-state: paused; }
        /* Hero "up next" rail: horizontal snap on narrow screens, vertical stack ≥lg. */
        .sf-hero-rail { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .sf-hero-rail::-webkit-scrollbar { display: none; }
        /* Hero search field: translucent light-on-dark, muted cream placeholder. */
        .sf-hero-search-input::placeholder { color: rgba(237,231,216,0.6); opacity: 1; }
        .sf-hero-search-input::-webkit-input-placeholder { color: rgba(237,231,216,0.6); }
        /* Fluid hero aside: the trio grows with the viewport (356px was fixed —
           at 1440/1920 the cards read undersized with dead space around them).
           Width tracks ~23.5vw and the photo-card height tracks ~12.5vw so the
           card keeps its ~1.9:1 stage-poster proportion at every size. */
        .sf-hero-aside { width: 100%; }
        @media (min-width: 1024px) {
          .sf-hero-rail { scroll-snap-type: none; }
          .sf-hero-aside { width: clamp(340px, 23.5vw, 476px); }
          .sf-hero-rail .gv-photo-card { height: clamp(180px, 12.5vw, 252px) !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sf-rail { overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
          .sf-rail-track { animation: none !important; transform: none !important; }
          .sf-rail-track > * { scroll-snap-align: start; }
          .sf-rail-dupe { display: none !important; }
        }
      `}</style>

      <div className="relative z-10">
        {/* ── Hero, headline left, "up next" rail right ─────────────────────
            Sized to EXACTLY one viewport. 100svh keeps the whole hero inside the
            small (chrome-visible) viewport on mobile so nothing is clipped; the
            backdrop covers the full screen and the fade-to-cream lands on the
            hero's bottom edge, where the cream job board begins. Everything —
            headline, subcopy, CTAs and the three cards, fits with no scroll. */}
        <section
          className="relative"
          style={{
            height: '100svh',
            minHeight: '620px',
            maxHeight: '1080px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Backdrop, sized to the hero zone exactly. A fixed podium-speaker
              image (not a live conference banner, which used to pull whichever
              conference happened to sort first and looked random). */}
          <div className="absolute inset-0 z-0" aria-hidden="true" style={{ overflow: 'hidden' }}>
            <Image
              src="/landing/podium-speaker.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover', objectPosition: 'center 32%' }}
            />
            {/* Darkening + a short fade to cream at the very bottom of the hero */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(8,18,13,0.52) 0%, rgba(8,18,13,0.4) 30%, rgba(8,18,13,0.62) 62%, rgba(10,22,16,0.9) 92%, #FAF8F3 100%)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 120% 80% at 50% 28%, transparent 40%, rgba(6,14,10,0.5) 76%, rgba(6,14,10,0.72) 100%)',
              }}
            />
          </div>

          <SiteNav overlay brand="conferences" />

          <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-14 px-6 md:px-14 pb-8 md:pb-9 pt-20 md:pt-24">
            <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 'clamp(760px, 54vw, 940px)' }}>
              <h1
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 'clamp(44px, 7.2vw, 122px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.02em',
                  color: CREAM,
                  margin: 0,
                  textShadow: '0 2px 24px rgba(0,0,0,0.35)',
                }}
              >
                Go where<br />the{' '}
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: PALE_GOLD,
                  }}
                >
                  debate
                </span>{' '}
                is.
              </h1>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(15px, 1.4vw, 22px)',
                  lineHeight: 1.55,
                  color: 'rgba(237,231,216,0.82)',
                  margin: '20px 0 0 0',
                  maxWidth: 'clamp(460px, 36vw, 620px)',
                }}
              >
                Real conferences, real committee rooms, from London to San Salvador. Pick your weekend.
              </p>

              <div className="flex flex-col gap-3" style={{ marginTop: '32px', maxWidth: 'clamp(460px, 40vw, 640px)' }}>
                <HeroSearchBar conferences={conferences} />
                <div className="flex justify-end">
                  <HeroTextLink href="/conferences/new" label="Organising one? List it free" />
                </div>
              </div>
            </div>

            {/* Curated "up next" rail, three photo-forward shared cards
                (heroCompact tier: the banner photo fills the card, name + four
                facts overlaid on a forest scrim), each with the gold glow +
                gavel-disc treatment and the gold APPLY pill. On lg the trio
                aligns to the TOP of the hero body (self-start pulls it up
                toward the nav band) and is pinned to the VERY RIGHT of the
                screen: negative right margins eat most of the section's
                md:px-14 padding, leaving ~20px (lg) / ~16px (xl) of breathing
                room from the viewport edge. On narrow screens it becomes a
                single-row snap rail so all three fit inside one viewport
                height. */}
            {upcomingTrio.length > 0 && (
              <aside className="sf-hero-aside flex-shrink-0 flex flex-col justify-center lg:justify-start lg:self-start lg:pt-3 lg:mr-[calc(5vw-56px)]">
                {/* pt-3/-mt-3 is not spacing, it is clearance. Below lg this rail
                    is a horizontal scroller, and `overflow-x: auto` clips the
                    cross axis too — which sliced the top off the gold gavel disc
                    that deliberately straddles each card's corner at -11px. The
                    negative margin cancels the visual offset, so only the disc
                    gains room. Above lg the rail is overflow-visible and needs
                    neither. */}
                <div className="sf-hero-rail flex flex-row lg:flex-col gap-3 lg:gap-2.5 overflow-x-auto lg:overflow-visible -mx-6 px-6 lg:mx-0 lg:px-0 pt-3 -mt-3 pb-2 lg:pt-0 lg:mt-0 lg:pb-0">
                  {upcomingTrio.map(c => (
                    <div
                      key={c.id}
                      className="w-[280px] lg:w-auto flex-shrink-0 lg:flex-shrink"
                      style={{ filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.40))', scrollSnapAlign: 'start' }}
                    >
                      <ConferenceCard
                        conf={c}
                        heroCompact
                        goldGlow
                        applied={appliedIds.has(c.id)}
                        member={memberIds.has(c.id)}
                        hovered={hoveredId === c.id}
                        onHover={() => setHoveredId(c.id)}
                        onLeave={() => setHoveredId(null)}
                        onClick={() => goTo(c.slug)}
                      />
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>

        {/* ── Find your seat, role carousel, cream ──────────────────────────
            The photo carousel is back (recovered from the pre-neumorphic
            build): center-focus slides, dimmed side-peek neighbors, circular
            arrows, keyboard + drag support. Each slide leads with the ROLE
            as a huge Outfit-900 uppercase wordmark over the photo, with the
            short supporting line and the same links beneath. */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: 'clamp(64px, 6vw, 108px)', paddingBottom: 'clamp(8px, 1vw, 16px)' }}
        >
          <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(12px, 0.8vw, 14px)', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 8px 0', textAlign: 'center' }}>
            Find your seat
          </p>
          <h2
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 'clamp(26px, 3vw, 48px)',
              letterSpacing: '-0.015em',
              color: INK,
              margin: '0 0 clamp(34px, 3vw, 52px) 0',
              textAlign: 'center',
            }}
          >
            One platform, every role.
          </h2>
          <RoleCarousel slides={ROLE_SLIDES} />
        </section>

        {/* ── The circuit in numbers, slim worlddiplomats-style impact strip:
            three plain figures, no cards, no chrome. Real data from the board. */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: '56px', paddingBottom: '64px' }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-0">
            {[
              // Conferences and countries are now real platform totals from
              // public_conference_stats — every conference on Gavelling, not
              // only the published ones these cards are drawn from. The
              // delegates figure keeps its display-only launch offset.
              { n: stats?.total_conferences ?? (conferences.length || null), label: 'Conferences on the board' },
              { n: conferences.reduce((s, c) => s + (c.expected_delegates || 0), 0) + 20000, label: 'Delegates expected' },
              { n: stats?.countries ?? (new Set(conferences.map(c => c.country)).size || null), label: 'Countries' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center text-center sm:px-14 md:px-20 ${i > 0 ? 'sm:border-l sm:border-[#DDD4C0]' : ''}`}
              >
                <span
                  style={{
                    fontFamily: SANS, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                    fontSize: 'clamp(38px, 4.5vw, 74px)', lineHeight: 1, color: FOREST, letterSpacing: '-0.01em',
                  }}
                >
                  {/* Null while both the RPC and the card fetch are still in
                      flight. The old +100/+30 offsets made a zero impossible;
                      without them, a real "0 conferences" would flash on every
                      first paint. An em dash holds the space instead. */}
                  {stat.n === null ? '—' : stat.n.toLocaleString()}
                </span>
                <span
                  style={{
                    fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(11.5px, 0.75vw, 13.5px)', letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: GOLD, marginTop: '10px',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Opportunities beyond delegating, job board, cream, no panel ──── */}
        <section
          className="relative px-6 md:px-14 xl:px-20"
          style={{ backgroundColor: CREAM, paddingTop: 'clamp(64px, 5.5vw, 100px)', paddingBottom: 'clamp(72px, 6vw, 110px)' }}
        >
          <div className="mx-auto flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16" style={{ maxWidth: '1720px' }}>
            <div className="lg:w-[40%] lg:flex-shrink-0" style={{ position: 'relative', zIndex: 2 }}>
              <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 14px 0' }}>
                The job board
              </p>
              <h2
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 'clamp(30px, 3.6vw, 62px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                  color: INK,
                  margin: 0,
                }}
              >
                Opportunities beyond delegating.
              </h2>
              <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.65, color: INK_70, margin: '18px 0 0 0', maxWidth: 'clamp(420px, 30vw, 520px)' }}>
                The best seat in the room isn&rsquo;t always behind a placard. Conferences on
                Gavelling hire chairs, secretariat and staff every season, and your MUN CV
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

            <div className="lg:flex-1 lg:min-w-0" style={{ position: 'relative' }}>
              {/*
                Job-board photo: the secretariat/staff image (/public/roles/
                secretariat.webp) — deliberately DIFFERENT from the hero
                backdrop (/landing/podium-speaker.jpg) so the section reads as
                the people running the conference, not the delegate on the floor.
              */}
              <div
                className="relative overflow-hidden rounded-3xl"
                style={{ border: '1px solid rgba(27,56,40,0.14)', boxShadow: '0 30px 60px rgba(27,56,40,0.18)', aspectRatio: '3 / 2' }}
              >
                <Image
                  src="/roles/secretariat.webp"
                  alt="Secretariat and staff coordinating a conference behind the scenes"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>

              {/* Live stat ledger, the approved forest ledger straddling the
                  photo's left edge: one dark rounded block, three stacked cells
                  (a row of three on mobile), big pale-gold numerals. */}
              <div
                className="lg:absolute lg:-left-12 lg:bottom-14 mt-5 lg:mt-0 grid grid-cols-3 lg:grid-cols-1 gap-px overflow-hidden rounded-2xl"
                style={{
                  border: '1px solid rgba(27,56,40,0.9)',
                  backgroundColor: 'rgba(27,56,40,0.9)',
                  boxShadow: '0 20px 50px rgba(27,56,40,0.28)',
                  maxWidth: '460px',
                }}
              >
                {[
                  { n: jobStats ? String(jobStats.open) : '—', label: 'Open roles', sub: 'accepting applications now' },
                  { n: jobStats ? String(jobStats.hiring) : '—', label: 'Conferences hiring', sub: 'across the circuit' },
                  { n: jobStats ? String(jobStats.chairing) : '—', label: 'Chair seats', sub: 'daises looking for a gavel' },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="px-5 py-4"
                    style={{ backgroundColor: FOREST }}
                  >
                    <p style={{ fontFamily: SANS, fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(26px, 1.8vw, 34px)', lineHeight: 1, color: PALE_GOLD, margin: 0 }}>
                      {stat.n}
                    </p>
                    <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: '9.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(237,231,216,0.9)', margin: '7px 0 0 0' }}>
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

        {/* ── Happening near you, regional auto-scroll rail (IP geo) ───────── */}
        {regional.list.length > 0 && (
          <section
            className="relative"
            style={{ backgroundColor: IVORY, paddingTop: '64px', paddingBottom: '72px' }}
          >
            <div className="px-6 md:px-14">
              <p className="flex items-center gap-2" style={{ fontFamily: SANS, fontWeight: 700, fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 8px 0' }}>
                <MapPin size={13} strokeWidth={2.25} /> Near you
              </p>
              <h2
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 'clamp(26px, 3vw, 48px)',
                  letterSpacing: '-0.015em',
                  color: INK,
                  margin: '0 0 6px 0',
                }}
              >
                {regionHeading}
              </h2>
              <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_55, margin: 0, maxWidth: 'clamp(540px, 40vw, 680px)' }}>
                {regionSub}
              </p>
            </div>

            <RegionalRail
              conferences={regional.list}
              appliedIds={appliedIds}
              memberIds={memberIds}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onClick={goTo}
            />
          </section>
        )}

        {/* ── "What is Model UN?" — beginner-friendly SEO explainer, cream ──── */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: 'clamp(64px, 6vw, 104px)', paddingBottom: 'clamp(64px, 6vw, 104px)' }}
        >
          <div className="mx-auto" style={{ maxWidth: '980px' }}>
            <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(12px, 0.8vw, 14px)', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 10px 0' }}>
              New to the circuit?
            </p>
            <h2
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 'clamp(28px, 3.4vw, 54px)',
                lineHeight: 1.03,
                letterSpacing: '-0.02em',
                color: INK,
                margin: 0,
              }}
            >
              What is Model United Nations?
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(16px, 1.15vw, 20px)', lineHeight: 1.7, color: INK_70, margin: '20px 0 0 0', maxWidth: '760px' }}>
              Model United Nations, or <strong style={{ color: INK }}>MUN</strong>, is an academic
              simulation of the real United Nations. Students step into the shoes of diplomats,
              each representing a country, and debate the world&rsquo;s biggest challenges — from
              climate change to global security — in committees modelled on the UN&rsquo;s own.
              It&rsquo;s part debate, part public speaking, part teamwork, and one of the best ways
              to sharpen the skills that carry into university and beyond.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(16px, 1.15vw, 20px)', lineHeight: 1.7, color: INK_70, margin: '18px 0 0 0', maxWidth: '760px' }}>
              At a conference, delegates research their country&rsquo;s position, deliver speeches,
              negotiate with allies and rivals, and work together to draft <strong style={{ color: INK }}>resolutions</strong> —
              the written proposals a committee votes on. A chairperson keeps the debate flowing,
              and awards recognise the delegates who lead the room. No experience is needed to
              start: everyone gives their first speech eventually.
            </p>

            <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(19px, 1.5vw, 26px)', letterSpacing: '-0.01em', color: FOREST, margin: 'clamp(32px, 3vw, 48px) 0 16px 0' }}>
              How a Model UN conference works
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '14px', maxWidth: '760px' }}>
              {[
                ['Pick a committee', 'Conferences run committees — the Security Council, historical crises, specialised agencies and more — each with its own topic and pace.'],
                ['Represent a country', 'You’re assigned a country (or a character) and speak, vote and negotiate on its behalf throughout the weekend.'],
                ['Debate and negotiate', 'Delegates make speeches, form blocs, and hammer out compromises through moderated and unmoderated caucuses.'],
                ['Draft resolutions', 'Working together, committees write and amend resolutions, then vote — the heart of every MUN session.'],
              ].map(([term, desc]) => (
                <li key={term} className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0"
                    style={{ width: 10, height: 10, marginTop: 9, borderRadius: 9999, backgroundColor: GOLD, boxShadow: '0 0 0 4px rgba(184,148,58,0.16)' }}
                  />
                  <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_70, margin: 0 }}>
                    <strong style={{ color: INK }}>{term}.</strong>{' '}{desc}
                  </p>
                </li>
              ))}
            </ul>

            <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.7, color: INK_55, margin: 'clamp(28px, 2.5vw, 40px) 0 0 0', maxWidth: '760px' }}>
              Whether you&rsquo;re a total beginner looking for your first conference or a seasoned
              delegate chasing the next gavel, Gavelling helps you find the right room. Browse
              conferences above and apply in minutes.
            </p>
          </div>
        </section>

        {/* ── Section: MUN Across the Globe, copied verbatim from production ── */}
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
            <DeferredGlobeVideo />
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
              maxWidth: 'clamp(600px, 44vw, 820px)',
              flex: 1,
            }}
          >
            <h2 style={{ margin: 0 }}>
              <span
                style={{
                  display: 'block',
                  color: 'white',
                  fontSize: 'clamp(48px, 5.5vw, 104px)',
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
                  fontSize: 'clamp(48px, 5.5vw, 104px)',
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
                fontSize: 'clamp(16px, 1.1vw, 19px)',
                lineHeight: 1.7,
                color: 'rgba(237,231,216,0.75)',
                maxWidth: 'clamp(440px, 32vw, 560px)',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {stats
                ? `${stats.total_conferences} conferences across every continent. From The Hague to Singapore, Tokyo to New York — find your next destination.`
                : 'From The Hague to Singapore, Tokyo to New York. Explore conferences on every continent and find your next destination.'}
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

/**
 * The globe section's looping video is ~14 MB. Loaded eagerly it started
 * downloading on page load and saturated the connection, starving the hero
 * image, the Supabase fetches and next/link route prefetches — the whole page
 * (and navigating away from it) felt blocked. Defer it: render the <video>
 * with no src and preload="none", and only attach the src once the section
 * scrolls near the viewport (600px lookahead so it's usually already playing
 * by the time it's visible). Visual output is identical.
 */
function DeferredGlobeVideo() {
  const holder = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setLoad(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={holder} style={{ width: '100%', height: '100%' }}>
      <video
        src={load ? '/map/interactive_globe.mp4' : undefined}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '30% center', display: 'block', opacity: 0.82 }}
      />
    </div>
  );
}

// Prominent hero search field. Finds conferences by NAME or LOCATION the same
// way the Explore directory does — on submit it navigates to /conferences/explore
// with the query as `?search=`, which the Explore client reads to pre-fill and
// filter (name · acronym · city · country). Empty query just opens Explore.
function HeroSearchBar({ conferences }: { conferences: LabConference[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const q = query.trim();
  // Live typeahead: match conference name, acronym, city or country.
  const matches = useMemo(() => {
    if (!q) return [];
    const n = q.toLowerCase();
    return conferences
      .filter(c =>
        c.full_name.toLowerCase().includes(n) ||
        (c.acronym ?? '').toLowerCase().includes(n) ||
        (c.city ?? '').toLowerCase().includes(n) ||
        (c.country ?? '').toLowerCase().includes(n),
      )
      .slice(0, 6);
  }, [q, conferences]);

  const open = focused && q.length > 0;

  // Empty → "Discover all" (browse everything); typed → search that query.
  const submit = () => {
    router.push(q ? `/conferences/explore?search=${encodeURIComponent(q)}` : '/conferences/explore');
  };

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2"
        style={{
          backgroundColor: focused ? 'rgba(237,231,216,0.20)' : 'rgba(237,231,216,0.13)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${focused ? 'rgba(238,217,138,0.60)' : 'rgba(237,231,216,0.30)'}`,
          borderRadius: '9999px',
          padding: '7px 8px 7px clamp(16px, 1.4vw, 22px)',
          boxShadow: focused
            ? '0 18px 44px rgba(0,0,0,0.42), 0 0 0 3px rgba(238,217,138,0.16)'
            : '0 14px 36px rgba(0,0,0,0.34)',
          transition: 'border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
        }}
      >
        <Search size={20} strokeWidth={2.25} style={{ color: 'rgba(237,231,216,0.72)', flexShrink: 0 }} aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          onFocus={() => { setFocused(true); router.prefetch('/conferences/explore'); }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search by conference name or city…"
          aria-label="Search conferences by name or city"
          className="sf-hero-search-input"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: SANS,
            fontSize: 'clamp(15px, 1.05vw, 17px)',
            fontWeight: 500,
            color: CREAM,
          }}
        />
        <button
          type="button"
          onClick={submit}
          aria-label={q ? 'Search conferences' : 'Discover all conferences'}
          className="inline-flex items-center justify-center gap-2 flex-shrink-0"
          style={{
            fontFamily: SANS,
            fontSize: 'clamp(14px, 1vw, 16px)',
            fontWeight: 800,
            letterSpacing: '0.03em',
            color: '#14100B',
            backgroundColor: PALE_GOLD,
            border: 'none',
            cursor: 'pointer',
            borderRadius: '9999px',
            padding: 'clamp(11px, 0.9vw, 14px) clamp(18px, 1.5vw, 26px)',
            whiteSpace: 'nowrap',
            transition: 'transform 160ms ease, background-color 160ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
        >
          <Search size={16} strokeWidth={2.75} className="sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{q ? 'Search' : 'Discover all'}</span>
        </button>
      </div>

      {/* Typeahead dropdown — light card floating below the field */}
      {open && (
        <div
          className="absolute left-0 right-0 z-50 overflow-hidden"
          style={{
            top: 'calc(100% + 8px)',
            backgroundColor: 'rgba(250,248,243,0.98)',
            border: '1px solid rgba(221,212,192,0.9)',
            borderRadius: 18,
            boxShadow: '0 22px 54px rgba(0,0,0,0.42)',
          }}
        >
          {matches.length > 0 ? matches.map((c) => (
            <Link
              key={c.id}
              href={`/conferences/${c.slug}`}
              prefetch
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; router.prefetch(`/conferences/${c.slug}`); }}
              onFocus={() => router.prefetch(`/conferences/${c.slug}`)}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ width: 34, height: 34, borderRadius: 9999, backgroundColor: c.logo_url ? '#FFFFFF' : FOREST, border: '1px solid rgba(0,0,0,0.08)' }}
              >
                {c.logo_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                  : <span style={{ color: GOLD, fontFamily: SANS, fontWeight: 800, fontSize: 11 }}>{(c.acronym || c.full_name).slice(0, 3).toUpperCase()}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14.5, color: INK }}>
                  {landingConfTitle(c)}
                </span>
                <span className="block truncate" style={{ fontFamily: SANS, fontWeight: 500, fontSize: 12.5, color: INK_55 }}>
                  {[c.city, c.country].filter(Boolean).join(', ')}
                </span>
              </span>
              <ArrowRight size={15} strokeWidth={2.2} style={{ color: INK_55, flexShrink: 0 }} aria-hidden="true" />
            </Link>
          )) : (
            <Link
              href={`/conferences/explore?search=${encodeURIComponent(q)}`}
              onMouseDown={(e) => e.preventDefault()}
              className="block px-4 py-3.5"
              style={{ fontFamily: SANS, fontSize: 13.5, color: INK_55, textDecoration: 'none' }}
            >
              No conferences match &ldquo;{q}&rdquo; — <span style={{ color: FOREST, fontWeight: 700 }}>browse all &rarr;</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

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

/**
 * "Find your seat" carousel, Aceternity-style center-focus carousel,
 * recovered from the pre-neumorphic build: large center slide, dimmed/scaled
 * side-peek neighbors, circular prev/next arrows below, keyboard + touch/drag
 * support, loops in both directions. Evolved so each slide leads with the
 * ROLE as a huge Outfit-900 uppercase wordmark over the photo.
 */
const DRAG_THRESHOLD = 60;
const VELOCITY_THRESHOLD = 400;

function RoleCarousel({ slides }: { slides: RoleSlide[] }) {
  const [active, setActive] = useState(0);
  const total = slides.length;

  const goToSlide = useCallback((i: number) => setActive(((i % total) + total) % total), [total]);
  const next = useCallback(() => goToSlide(active + 1), [active, goToSlide]);
  const prev = useCallback(() => goToSlide(active - 1), [active, goToSlide]);

  // Signed distance from the active slide, wrapped to the shortest direction.
  const getOffset = (i: number) => {
    let diff = i - active;
    if (diff > total / 2) diff -= total;
    else if (diff < -total / 2) diff += total;
    return diff;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -DRAG_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) next();
    else if (info.offset.x > DRAG_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) prev();
  };

  if (total === 0) return null;

  return (
    <div>
      <div
        role="region"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative w-full outline-none"
        style={{ height: 'clamp(440px, 50vw, 560px)', overflowX: 'clip' }}
      >
        {slides.map((slide, i) => {
          const offset = getOffset(i);
          if (Math.abs(offset) > 2) return null;
          const isActive = offset === 0;

          return (
            <motion.div
              key={slide.role}
              className="absolute inset-y-0 left-1/2 rounded-[30px] overflow-hidden select-none"
              style={{
                width: 'min(640px, 82vw)',
                marginLeft: 'calc(min(640px, 82vw) / -2)',
                boxShadow: isActive
                  ? '0 32px 70px rgba(15,26,19,0.38), 0 0 0 1px rgba(250,248,243,0.14)'
                  : '0 18px 40px rgba(15,26,19,0.22), 0 0 0 1px rgba(250,248,243,0.10)',
                cursor: isActive ? 'grab' : 'pointer',
              }}
              animate={{
                x: `${offset * 78}%`,
                scale: isActive ? 1 : 0.82,
                opacity: Math.abs(offset) > 1 ? 0 : isActive ? 1 : 0.5,
                zIndex: 10 - Math.abs(offset),
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              drag={isActive ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={isActive ? handleDragEnd : undefined}
              onClick={() => { if (!isActive) goToSlide(i); }}
              aria-hidden={!isActive}
            >
              {/* loading="eager": mounted slides sit off-viewport (translated
                  ±78/156%), so the default lazy loading never fetched them —
                  every arrow click then waited on a fresh image download+decode.
                  Eagerly loading the (small, webp) slide images makes switching
                  instant. */}
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                fill
                loading="eager"
                sizes="(min-width: 768px) 640px, 82vw"
                style={{ objectFit: 'cover' }}
                draggable={false}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(11,20,15,0.10) 0%, rgba(11,20,15,0.18) 34%, rgba(9,17,13,0.74) 70%, rgba(8,15,11,0.94) 100%)',
                }}
              />

              <div className="relative z-10 flex flex-col justify-end h-full p-7 sm:p-9">
                {/* The ROLE, the dominant element on the slide. */}
                <h3
                  style={{
                    fontFamily: SANS,
                    fontWeight: 900,
                    fontSize: 'clamp(32px, 6.5vw, 72px)',
                    lineHeight: 0.98,
                    letterSpacing: '0.01em',
                    textTransform: 'uppercase',
                    color: CREAM,
                    margin: 0,
                  }}
                >
                  {slide.role}
                </h3>
                <p
                  style={{
                    fontFamily: SANS, fontSize: 'clamp(13.5px, 1vw, 16px)', lineHeight: 1.6,
                    color: 'rgba(250,248,243,0.86)', margin: '12px 0 0 0', maxWidth: '480px',
                  }}
                >
                  {slide.blurb}
                </p>

                <div className="flex flex-wrap items-center gap-3" style={{ marginTop: '22px' }}>
                  <Link
                    href={slide.primary.href}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={isActive ? 0 : -1}
                    style={{
                      fontFamily: SANS, fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em',
                      color: '#14100B', backgroundColor: PALE_GOLD, padding: '13px 22px', borderRadius: '9999px',
                      textDecoration: 'none', boxShadow: '0 10px 26px rgba(0,0,0,0.3)',
                      transition: 'transform 160ms ease, background-color 160ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
                  >
                    {slide.primary.label}
                  </Link>
                  {slide.secondary && (
                    <Link
                      href={slide.secondary.href}
                      onClick={(e) => e.stopPropagation()}
                      tabIndex={isActive ? 0 : -1}
                      style={{
                        fontFamily: SANS, fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em',
                        color: CREAM, backgroundColor: 'transparent', padding: '12px 21px', borderRadius: '9999px',
                        textDecoration: 'none', border: '1.5px solid rgba(250,248,243,0.55)',
                        transition: 'background-color 160ms ease, border-color 160ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(250,248,243,0.12)'; e.currentTarget.style.borderColor = 'rgba(250,248,243,0.85)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(250,248,243,0.55)'; }}
                    >
                      {slide.secondary.label}
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-8">
        <CarouselArrow direction="left" onClick={prev} label="Previous slide" />
        <CarouselArrow direction="right" onClick={next} label="Next slide" />
      </div>
    </div>
  );
}

function CarouselArrow({
  direction, onClick, label,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: '48px', height: '48px', backgroundColor: CREAM,
        border: '1.5px solid rgba(27,56,40,0.18)', color: FOREST,
        boxShadow: '0 8px 22px rgba(27,56,40,0.14)',
        transition: 'background-color 160ms ease, transform 160ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = FOREST; e.currentTarget.style.color = PALE_GOLD; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = CREAM; e.currentTarget.style.color = FOREST; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <Icon size={20} strokeWidth={2.25} />
    </button>
  );
}

/**
 * Regional auto-scrolling rail. Duplicates the card list once so the CSS
 * translateX(-50%) loop is seamless. Pauses on hover. Under prefers-reduced-
 * motion the track becomes a plain scroll-snap rail (the duplicate is hidden).
 */
function RegionalRail({
  conferences, appliedIds, memberIds, hoveredId, onHover, onClick,
}: {
  conferences: LabConference[];
  appliedIds: Set<string>;
  memberIds: Set<string>;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onClick: (slug: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  // Only loop-duplicate when there are enough cards to fill the row; a couple of
  // cards looping looks jittery, so with <4 we render a single, static set.
  const loop = conferences.length >= 4;
  const sequence = loop ? [...conferences, ...conferences] : conferences;

  // The marquee keeps animating (and repainting) even while scrolled off-screen
  // unless we pause it ourselves. Only relevant when the track actually loops.
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    if (!loop) return;
    const el = rail.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loop]);

  return (
    <div
      ref={rail}
      className="sf-rail"
      style={{ marginTop: '32px', overflowX: 'clip', maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}
    >
      <div
        ref={track}
        className={loop ? 'sf-rail-track' : undefined}
        style={{
          display: 'flex', gap: '24px', width: 'max-content', paddingLeft: '24px', paddingRight: '24px', paddingTop: '4px', paddingBottom: '12px',
          animationPlayState: loop && !isVisible ? 'paused' : undefined,
        }}
      >
        {sequence.map((c, i) => {
          const isDupe = loop && i >= conferences.length;
          return (
            <div
              key={`${c.id}-${i}`}
              className={isDupe ? 'sf-rail-dupe' : undefined}
              aria-hidden={isDupe}
              style={{ width: 'clamp(300px, 20vw, 400px)', flexShrink: 0 }}
            >
              <ConferenceCard
                conf={c}
                applied={appliedIds.has(c.id)}
                member={memberIds.has(c.id)}
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

