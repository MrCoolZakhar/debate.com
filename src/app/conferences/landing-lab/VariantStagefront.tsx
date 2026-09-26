'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V1 · "Stagefront", the full composition (owner-approved evolution, restructured).
//
// The LIMUN theatre banner opens the show as a hero backdrop, constrained to
// the hero zone: everything below sits on clean cream / ivory slabs so each
// section reads as its own distinct band.
//
// Composition, top to bottom (25 Sep 2026):
//   1. Hero, headline left, "up next" card rail right         , DARK (theatre photo)
//   2. Sessions: laptop | "Run the room" + code field | phone  , CREAM (HomeSections.tsx)
//   3. "Learn MUN": six guides from the blog                   , FOREST (HomeSections.tsx)
//   4. "Find your seat" role carousel + circuit-in-numbers strip, CREAM
//   5. "Conferences near you", three cards chosen by IP country , IVORY
//   6. The production globe section, verbatim                  , FOREST
//   7. "What is Model UN?" card beside "What is Gavelling?"    , CREAM (HomeSections.tsx)
//   8. The one site footer (src/components/SiteFooter.tsx)
// The job board is hidden until it launches (see the comment where it was).
//
// The hero rail + the near-you row reuse the SHARED ConferenceCard
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
import { UN_COUNTRIES } from '@/lib/countries';
import { recommendNearby } from '@/lib/nearbyConferences';
import { ConferenceCard } from '../ConferenceCard';
import { LogoDisc } from '@/components/LogoDisc';
import SiteFooter from '@/components/SiteFooter';
import { GoldWord } from '@/components/BrandHeading';
import {
  LabConference, RatingSummary,
  CREAM, FOREST, GOLD, IVORY, PALE_GOLD, SANS,
  isConcluded, pickHeadliner,
} from './shared';
import { recordSpotlightClick, recordSpotlightView, type FeaturedRow } from '@/lib/spotlight';
import { SessionsSection, AboutCards, LearnMunSection, type HomeGuide } from './HomeSections';

// Ink-on-cream tokens for the light slabs.
const INK = '#1C1410';
const INK_55 = '#6B5F52';

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
    blurb: 'The machine behind the weekend: run applications, allocations, delegations and communications from one place. The whole show, zero fees.',
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
    primary: { label: 'Explore chairing roles', href: '/conferences/roles' },
    secondary: { label: 'Your conferences', href: '/account/conferences?tab=chair' },
  },
  {
    role: 'Delegates',
    blurb: 'Browse the circuit, apply once with your Gavelling profile, and build a MUN CV that writes itself.',
    image: '/roles/delegate.jpg',
    imageAlt: 'A delegate speaking from their seat in committee',
    primary: { label: 'Explore conferences', href: '/conferences/explore' },
    secondary: { label: 'Your conferences', href: '/account/conferences?tab=delegate' },
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
  code: string | null;    // ISO alpha-2
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
  guides = [],
  featured = [],
}: {
  conferences: LabConference[];
  /** featured_conferences('homepage'): the hero's "up next" rail. */
  featured?: FeaturedRow[];
  ratings: Record<string, RatingSummary>; // accepted for caller compatibility (season ledger removed)
  /** Platform-wide totals (all conferences, not just the published ones the
   *  cards are drawn from). Null until the RPC lands. */
  stats?: { total_conferences: number; published_conferences: number; countries: number } | null;
  /** The "Learn MUN" guides, picked from the blog manifest on the server. */
  guides?: HomeGuide[];
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

  // The hero's "up next" rail comes from featured_conferences('homepage')
  // (src/lib/spotlight.ts): today's booked Gavelling Spotlights first, then the
  // empty slots filled with the upcoming conferences with the most accepted
  // delegates. Read on the server (src/app/page.tsx), so the first paint does
  // not jump. Each row is matched to the listed conference by id for its
  // delegate price and delegate count; a row not in the list (a private one
  // with a booking, say) is drawn from the row's own fields.
  const upcomingTrio = useMemo(() => {
    const byId = new Map(conferences.map(c => [c.id, c]));
    return featured.slice(0, 3).map(f => {
      const listed = byId.get(f.conference_id);
      const conf: LabConference = listed ?? {
        id: f.conference_id, slug: f.slug, full_name: f.full_name ?? '', acronym: f.acronym ?? '',
        city: f.city ?? '', country: f.country ?? '', start_date: f.start_date ?? '', end_date: f.end_date ?? '',
        fee_amount: 0, fee_currency: 'USD', expected_delegates: 0, logo_url: f.logo_url, banner_url: f.banner_url,
      };
      return { conf, spotlight: !!f.is_spotlight, bookingId: f.booking_id };
    });
  }, [conferences, featured]);

  // One 'view' per browser session per spotlight booking shown here.
  useEffect(() => {
    for (const t of upcomingTrio) if (t.spotlight) recordSpotlightView(t.bookingId);
  }, [upcomingTrio]);

  // ── Geolocation ────────────────────────────────────────────────────────────
  // /api/geo only: Vercel's IP-country header, first party. There is NO
  // third-party fallback (a keyless IP API used to be called here, which the
  // privacy policy does not allow): when Vercel cannot place the visitor (local
  // dev, a VPN), the row simply keeps the soonest-first answer the server drew.
  const [geo, setGeo] = useState<GeoResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/geo');
        if (!res.ok) return;
        const data = await res.json();
        const code = typeof data.countryCode === 'string' && /^[A-Za-z]{2}$/.test(data.countryCode) ? data.countryCode.toUpperCase() : null;
        const country = countryNameFromCode(code);
        if (!cancelled && code) setGeo({ code, country, city: data.city ?? null });
      } catch { /* geolocation is best-effort, leave geo null */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // "Conferences near you": always three, chosen by src/lib/nearbyConferences.ts
  // (own country, then its neighbours, sub-region, continent, then anywhere;
  // conferences taking applications first). Before geo answers, and for a
  // crawler, this is the no-country answer, which the server rendered too, so
  // hydration never disagrees.
  const nearby = useMemo(() => {
    const upcoming = conferences.filter(c => !isConcluded(c));
    return recommendNearby(upcoming, geo?.code ?? null, 3);
  }, [conferences, geo]);

  const nearbySub = !geo?.country
    ? 'Taking applications now, soonest first'
    : nearby.tier === 0
      ? `Coming up in ${geo.country}`
      : `Nothing open in ${geo.country} right now. These are the nearest`;

  const goTo = (slug: string) => router.push(`/conferences/${slug}`);

  return (
    <div style={{ backgroundColor: CREAM, minHeight: '100vh', position: 'relative' }}>
      <style>{`
        /* Hero "up next" rail: horizontal snap on narrow screens, vertical stack ≥lg. */
        .sf-hero-rail { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .sf-hero-rail::-webkit-scrollbar { display: none; }
        /* Hero search field: translucent light-on-dark, muted cream placeholder. */
        .sf-hero-search-input::placeholder { color: rgba(237,231,216,0.6); opacity: 1; }
        .sf-hero-search-input::-webkit-input-placeholder { color: rgba(237,231,216,0.6); }
        /* iOS Safari zooms the whole page in when a focused input is under
           16px, and the hero clamp bottoms out at 15px on a phone — so the
           first tap on the homepage threw the layout sideways. 16px only
           below the desktop breakpoint; the clamp still governs desktop. */
        @media (max-width: 767px) {
          .sf-hero-search-input { font-size: 16px !important; }
        }
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
      `}</style>

      <div className="relative z-10">
        {/* ── Hero, headline left, "up next" rail right ─────────────────────
            Sized to EXACTLY one viewport. 100svh keeps the whole hero inside the
            small (chrome-visible) viewport on mobile so nothing is clipped; the
            backdrop covers the full screen and the fade-to-cream lands on the
            hero's bottom edge, where the cream Sessions section begins. Everything —
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
          {/* The backdrop DISSOLVES into the cream section below through a mask
              (owner, 25 Sep 2026: "the white shadow gradient is still weird ...
              completely blend it"): the photo and its darkening fade to
              transparent over the cream page, so no pale film is painted over
              the photo on the way down. */}
          <div
            className="absolute inset-0 z-0"
            aria-hidden="true"
            style={{
              overflow: 'hidden',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 76.0%, rgba(0,0,0,0.985) 78.7%, rgba(0,0,0,0.94) 81.3%, rgba(0,0,0,0.86) 84.0%, rgba(0,0,0,0.75) 86.7%, rgba(0,0,0,0.61) 89.3%, rgba(0,0,0,0.45) 92.0%, rgba(0,0,0,0.31) 94.1%, rgba(0,0,0,0.17) 96.3%, rgba(0,0,0,0.07) 97.9%, rgba(0,0,0,0.02) 98.9%, rgba(0,0,0,0) 100.0%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 76.0%, rgba(0,0,0,0.985) 78.7%, rgba(0,0,0,0.94) 81.3%, rgba(0,0,0,0.86) 84.0%, rgba(0,0,0,0.75) 86.7%, rgba(0,0,0,0.61) 89.3%, rgba(0,0,0,0.45) 92.0%, rgba(0,0,0,0.31) 94.1%, rgba(0,0,0,0.17) 96.3%, rgba(0,0,0,0.07) 97.9%, rgba(0,0,0,0.02) 98.9%, rgba(0,0,0,0) 100.0%)',
            }}
          >
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
                  'linear-gradient(to bottom, rgba(8,18,13,0.52) 0%, rgba(8,18,13,0.4) 30%, rgba(8,18,13,0.6) 55%, rgba(8,18,13,0.55) 100%)',
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
                Go where<br />the <GoldWord tone="dark">debate</GoldWord> is
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
                Real conferences, real committee rooms, from London to San Salvador. Pick your weekend
              </p>

              <div className="flex flex-col gap-3" style={{ marginTop: '32px', maxWidth: 'clamp(460px, 40vw, 640px)' }}>
                <HeroSearchBar conferences={conferences} />
                <div className="flex justify-end">
                  {/* Straight into creating (owner, 25 Sep 2026: the /organisers page in between "adds nothing"). */}
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
                  {upcomingTrio.map(({ conf: c, spotlight, bookingId }) => (
                    <div
                      key={c.id}
                      className="w-[280px] lg:w-auto flex-shrink-0 lg:flex-shrink"
                      style={{ filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.40))', scrollSnapAlign: 'start' }}
                    >
                      {/* A booked Spotlight wears the tag and the bright gold
                          edge; a filled slot is today's plain card. */}
                      <ConferenceCard
                        conf={c}
                        heroCompact
                        goldGlow={spotlight}
                        spotlight={spotlight}
                        applied={appliedIds.has(c.id)}
                        member={memberIds.has(c.id)}
                        hovered={hoveredId === c.id}
                        onHover={() => setHoveredId(c.id)}
                        onLeave={() => setHoveredId(null)}
                        onClick={() => { if (spotlight) recordSpotlightClick(bookingId); goTo(c.slug); }}
                      />
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>

        {/* ── Running a committee: laptop | Run the room + code field | phone.
            Second on the page by the owner's instruction (24 Sep 2026). ──── */}
        <SessionsSection />

        {/* ── The circuit in numbers, a slim bar right under Run the room (owner, 25 Sep 2026):
            three plain figures, no cards, no chrome. Real data from the board. */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: '8px', paddingBottom: '36px' }}
        >
          <div className="mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0" style={{ maxWidth: '960px', borderTop: '1px solid #E6DECB', paddingTop: '22px' }}>
            {[
              // Conferences and countries are now real platform totals from
              // public_conference_stats — every conference on Gavelling, not
              // only the published ones these cards are drawn from. The
              // delegates figure keeps its display-only launch offset.
              { n: stats?.total_conferences ?? (conferences.length || null), label: 'conferences' },
              { n: conferences.reduce((s, c) => s + (c.expected_delegates || 0), 0) + 20000, label: 'delegates' },
              { n: stats?.countries ?? (new Set(conferences.map(c => c.country)).size || null), label: 'countries' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`flex items-baseline justify-center gap-2 sm:px-8 md:px-12 ${i > 0 ? 'sm:border-l sm:border-[#DDD4C0]' : ''}`}
              >
                <span
                  style={{
                    fontFamily: SANS, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                    fontSize: 'clamp(26px, 2.4vw, 38px)', lineHeight: 1, color: FOREST, letterSpacing: '-0.02em',
                  }}
                >
                  {/* Null while both the RPC and the card fetch are still in
                      flight; a dash holds the space instead of a false zero. */}
                  {stat.n === null ? '–' : stat.n.toLocaleString()}
                </span>
                {/* The word beside the number (owner's taste board: "big number,
                    word beside", 25 Sep 2026), not an uppercase gold label under it. */}
                <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 'clamp(14px, 1vw, 16px)', color: INK }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>


        {/* ── Learn MUN, the guides from the blog, on forest. Third on the
            page by the owner's instruction (25 Sep 2026). ─────────────────── */}
        <LearnMunSection guides={guides} />

        {/* ── Find your seat, role carousel, cream ──────────────────────────
            The photo carousel is back (recovered from the pre-neumorphic
            build): center-focus slides, dimmed side-peek neighbors, circular
            arrows, keyboard + drag support. Each slide leads with the ROLE
            as a huge Outfit-900 uppercase wordmark over the photo, with the
            short supporting line and the same links beneath. */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: 'clamp(40px, 4vw, 64px)', paddingBottom: 'clamp(32px, 3vw, 48px)' }}
        >
          <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(12px, 0.8vw, 14px)', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 8px 0', textAlign: 'center' }}>
            Find your seat
          </p>
          <h2
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 'clamp(24px, 2.4vw, 38px)',
              letterSpacing: '-0.015em',
              color: INK,
              margin: '0 0 clamp(20px, 2vw, 30px) 0',
              textAlign: 'center',
            }}
          >
            One platform, every <GoldWord>role</GoldWord>
          </h2>
          <RoleCarousel slides={ROLE_SLIDES} />
        </section>

        {/* The job board ("Opportunities beyond delegating") was here. Removed
            24 Sep 2026 until the job board launches (owner: "we might readd
            later"). To bring it back: restore this section from git history
            (commit before 24 Sep 2026) and read fetchJobStats() in
            src/lib/listedConferences.ts again in src/app/page.tsx. The
            "Conferences on Gavelling" logo row that sat above it was removed
            for good the same day. */}

        {/* ── Conferences near you: always three cards (src/lib/nearbyConferences.ts) ── */}
        {nearby.picks.length > 0 && (
          <section
            className="relative px-6 md:px-14"
            aria-labelledby="sf-near-heading"
            style={{ backgroundColor: IVORY, paddingTop: 'clamp(40px, 4vw, 56px)', paddingBottom: 'clamp(40px, 4vw, 56px)' }}
          >
            <div className="mx-auto" style={{ maxWidth: '1320px' }}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2" style={{ fontFamily: SANS, fontWeight: 700, fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 8px 0' }}>
                    <MapPin size={13} strokeWidth={2.25} aria-hidden="true" /> Near you
                  </p>
                  <h2
                    id="sf-near-heading"
                    style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(24px, 2.4vw, 38px)', letterSpacing: '-0.015em', color: INK, margin: '0 0 4px 0', textWrap: 'balance' }}
                  >
                    Conferences near <GoldWord>you</GoldWord>
                  </h2>
                  <p aria-live="polite" style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_55, margin: 0 }}>
                    {nearbySub}
                  </p>
                </div>
                <Link
                  href="/conferences/explore"
                  className="inline-flex min-h-11 items-center gap-1.5 self-start sm:self-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 800, color: FOREST, textDecoration: 'underline', textUnderlineOffset: '4px', textDecorationThickness: '1.5px', whiteSpace: 'nowrap' }}
                >
                  See every conference
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6" style={{ marginTop: '22px' }}>
                {nearby.picks.map(c => (
                  <ConferenceCard
                    key={c.id}
                    conf={c}
                    applied={appliedIds.has(c.id)}
                    member={memberIds.has(c.id)}
                    hovered={hoveredId === c.id}
                    onHover={() => setHoveredId(c.id)}
                    onLeave={() => setHoveredId(null)}
                    onClick={() => goTo(c.slug)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── "What is Model UN?" (the SEO explainer, text unchanged) beside
            "What is Gavelling?", the last thing before the footer (owner,
            25 Sep 2026) ────────────────────────────────────────────────── */}
        <AboutCards />

        <SiteFooter />
      </div>
    </div>
  );
}

// ── Local pieces ─────────────────────────────────────────────────────────────


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
          title={q ? 'Search conferences' : 'Discover all conferences'}
          className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2"
          style={{
            width: 'clamp(44px, 3.2vw, 50px)',
            height: 'clamp(44px, 3.2vw, 50px)',
            color: '#14100B',
            backgroundColor: PALE_GOLD,
            border: 'none',
            cursor: 'pointer',
            borderRadius: '9999px',
            padding: 0,
            transition: 'transform 160ms ease, background-color 160ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
        >
          <Search size={20} strokeWidth={2.75} aria-hidden="true" />
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
              <LogoDisc
                src={c.logo_url}
                size={34}
                fallbackText={(c.acronym || c.full_name).slice(0, 3)}
                style={{ boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)' }}
              />
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
              No conferences match &ldquo;{q}&rdquo;. <span style={{ color: FOREST, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: '3px' }}>browse all &rarr;</span>
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
      className="inline-flex min-h-11 items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
      style={{
        fontFamily: SANS,
        fontSize: '13.5px',
        fontWeight: 800,
        color: hover ? CREAM : 'rgba(237,231,216,0.82)',
        textDecoration: 'underline',
        textUnderlineOffset: '4px',
        textDecorationThickness: '1.5px',
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
        style={{ height: 'clamp(340px, 34vw, 420px)', overflowX: 'clip' }}
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
                width: 'min(540px, 82vw)',
                marginLeft: 'calc(min(540px, 82vw) / -2)',
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
                sizes="(min-width: 768px) 540px, 82vw"
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
                    fontSize: 'clamp(30px, 5vw, 56px)',
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
                      fontFamily: SANS, fontWeight: 700, fontSize: '15px',
                      color: '#14100B', backgroundColor: PALE_GOLD, padding: '13px 22px', borderRadius: '12px',
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
                        fontFamily: SANS, fontWeight: 700, fontSize: '15px',
                        color: CREAM, backgroundColor: 'transparent', padding: '12px 21px', borderRadius: '12px',
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

      <div className="flex items-center justify-center gap-4 mt-4">
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
