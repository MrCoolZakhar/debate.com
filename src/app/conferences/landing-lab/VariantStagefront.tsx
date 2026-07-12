'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V1 · "Stagefront" — the full composition (owner-approved evolution, restructured).
//
// The LIMUN theatre banner opens the show as a hero backdrop, constrained to
// the hero zone: everything below sits on clean cream / ivory slabs so each
// section reads as its own distinct band.
//
// Composition, top to bottom:
//   1. Hero — headline left, "up next" card rail right          — DARK (theatre photo)
//   2. "Find your seat" role carousel + circuit-in-numbers strip — CREAM
//   3. "Opportunities beyond delegating" job board              — CREAM (no panel)
//   4. "Happening near you" regional auto-scroll rail (IP geo)  — IVORY
//   5. The production globe section, verbatim                   — FOREST
//   6. Ivory footer (design rule)
//
// The hero rail + the regional rail reuse the SHARED ConferenceCard
// (../ConferenceCard) — the same definition the explore directory renders;
// the hero stack uses its photo-forward `heroCompact` tier (banner photo
// fills the card) so three fit gracefully, pinned to the right screen edge.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, MapPin,
  Users, Gavel, ClipboardList, CalendarPlus, GraduationCap, Eye,
  type LucideIcon,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { UN_COUNTRIES } from '@/lib/countries';
import { NeuCard, NeuIconDisc, NEU, NEU_GRADIENTS, EASE, type NeuGradient } from '@/components/neu';
import { ConferenceCard } from '../ConferenceCard';
import { LogoDisc } from '@/components/LogoDisc';
import {
  LabConference, RatingSummary,
  CREAM, FOREST, GOLD, IVORY, PALE_GOLD, SANS, GRAIN,
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

// The three most recent open postings, rendered as tiny "notification" chips
// fanned above the SEE OPEN ROLES CTA.
interface RoleChip {
  id: string;
  role: string;
  acronym: string;
  logoUrl: string | null;
  category: string; // normalised: 'chairs' | 'secretariat' | 'staff' | …
}

// Category tints — same palette logic as /conferences/roles
// (chairs = gold, secretariat = slate-blue, staff = forest-green).
const CHIP_TINTS: Record<string, { color: string; border: string }> = {
  chairs: { color: '#8A6614', border: 'rgba(182,135,31,0.38)' },
  secretariat: { color: '#46617A', border: 'rgba(70,97,122,0.30)' },
  staff: { color: '#2A5A3C', border: 'rgba(42,90,60,0.30)' },
};

// Fan layout for the three chips: playful offsets + slight rotations.
const CHIP_FAN = [
  { left: '0px', bottom: '2px', rot: '-5deg', delay: '80ms', z: 3 },
  { left: '96px', bottom: '46px', rot: '3.5deg', delay: '260ms', z: 2 },
  { left: '176px', bottom: '0px', rot: '-2deg', delay: '440ms', z: 1 },
] as const;

// "Find your seat" — one neumorphic card per way to be on the circuit.
// The ROLE is the hero: big Outfit-900 ink wordmark, muted supporting line,
// the same primary/secondary links the old carousel slides carried.
interface RoleCardDef {
  role: string; // rendered uppercase, Outfit 900 — the biggest words in the card
  blurb: string;
  icon: LucideIcon;
  gradient: NeuGradient;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

const ROLE_CARDS: RoleCardDef[] = [
  {
    role: 'Delegates',
    blurb: 'Browse the circuit, apply once with your Gavelling profile, and build a MUN CV that writes itself.',
    icon: Users,
    gradient: NEU_GRADIENTS.forest,
    primary: { label: 'Explore conferences', href: '/conferences/explore' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=delegate' },
  },
  {
    role: 'Chairs',
    blurb: 'Gavel in hand — scoring, motions and the speakers list, run live from one dashboard.',
    icon: Gavel,
    gradient: NEU_GRADIENTS.gold,
    primary: { label: 'Explore chairing opportunities', href: '/conferences/roles' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=chair' },
  },
  {
    role: 'Secretariat',
    blurb: 'The machine behind the weekend — applications, allocations and communications in one place.',
    icon: ClipboardList,
    gradient: NEU_GRADIENTS.amber,
    primary: { label: 'See open roles', href: '/conferences/roles' },
  },
  {
    role: 'Organizers',
    blurb: 'Registration, allocation, delegations, live committees — the whole show, zero fees.',
    icon: CalendarPlus,
    gradient: NEU_GRADIENTS.green,
    primary: { label: 'List your conference', href: '/conferences/new' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=organizer' },
  },
  {
    role: 'Advisors',
    blurb: 'Pledge spots, manage payments and keep your delegation organised — all in one place.',
    icon: GraduationCap,
    gradient: NEU_GRADIENTS.sage,
    primary: { label: 'Explore conferences', href: '/conferences/explore' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=advisor' },
  },
  {
    role: 'Observers',
    blurb: 'Follow committees live and see how the room moves — no placard required.',
    icon: Eye,
    gradient: NEU_GRADIENTS.forest,
    primary: { label: 'Explore conferences', href: '/conferences/explore' },
    secondary: { label: 'View your conferences', href: '/my-conferences?tab=observer' },
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

export default function VariantStagefront({
  conferences,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>; // accepted for caller compatibility (season ledger removed)
}) {
  const router = useRouter();
  const headliner = useMemo(() => pickHeadliner(conferences), [conferences]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Conference ids the signed-in viewer already applied to — cards show
  // APPLIED instead of the APPLY pill. RLS returns only the viewer's own rows.
  // memberIds: conferences the viewer is already PART of (organiser via
  // conferences.organizer_id or a conference_organizers row, or an application
  // that reached accepted/assigned/checked-in) — those cards show VIEW →
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

  // The three soonest upcoming conferences take the hero's "up next" rail.
  const upcomingTrio = useMemo(
    () =>
      conferences
        .filter(c => !isConcluded(c))
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 3),
    [conferences],
  );

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

  // Live job-board stats + the three most recent open roles (for the CTA
  // pop-up chips) — one query, fetched dynamically (seed data changes under us).
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [roleChips, setRoleChips] = useState<RoleChip[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('id, category, role_name, conference_id, created_at, conferences (acronym, logo_url)')
        .eq('is_open', true)
        .order('created_at', { ascending: false });
      if (cancelled || !data) return;
      const hiring = new Set(data.map(r => r.conference_id)).size;
      const chairing = data.filter(r => String(r.category ?? '').toLowerCase().includes('chair')).length;
      setJobStats({ open: data.length, hiring, chairing });
      setRoleChips(
        data.slice(0, 3).map(r => {
          // Supabase types to-one joins loosely — normalise object-or-array.
          const conf = Array.isArray(r.conferences) ? r.conferences[0] : r.conferences;
          return {
            id: String(r.id),
            role: String(r.role_name ?? 'Open role'),
            acronym: String(conf?.acronym ?? 'MUN'),
            logoUrl: (conf?.logo_url as string | null) ?? null,
            category: String(r.category ?? 'staff').trim().toLowerCase().replace(/[\s_]+/g, '-'),
          };
        }),
      );
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
        @keyframes sfChipIn {
          from { opacity: 0; transform: translateY(14px) scale(0.9) rotate(var(--sf-rot, 0deg)); }
          to { opacity: 1; transform: translateY(0) scale(1) rotate(var(--sf-rot, 0deg)); }
        }
        .sf-chip { animation: sfChipIn 640ms cubic-bezier(0.22,1,0.36,1) both; }
        /* Hero "up next" rail: horizontal snap on narrow screens, vertical stack ≥lg. */
        .sf-hero-rail { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .sf-hero-rail::-webkit-scrollbar { display: none; }
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
        /* Roles grid: 1 → 2 → 3 fluid columns; cards grow with the container. */
        .sf-roles-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(16px, 1.6vw, 28px);
          max-width: 1560px;
          margin: 0 auto;
        }
        @media (min-width: 640px) { .sf-roles-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1024px) { .sf-roles-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .sf-role-link svg { transition: transform 260ms cubic-bezier(0.22,1,0.36,1); }
        .sf-role-link:hover { color: #2A5A3C !important; }
        .sf-role-link:hover svg { transform: translateX(3px); }
        .sf-role-sub:hover { color: #1B3828 !important; }
        /* Job-board chip fan: the desktop offsets (up to 176px) push the ~230px
           chips past a 375px viewport. Below 560px restack them as a gentle
           cascade pinned to the left edge so nothing overflows. */
        @media (max-width: 560px) {
          .sf-chip-fan { height: 158px !important; }
          .sf-chip:nth-of-type(1) { left: 0 !important; bottom: 0 !important; }
          .sf-chip:nth-of-type(2) { left: 14px !important; bottom: 54px !important; }
          .sf-chip:nth-of-type(3) { left: 28px !important; bottom: 108px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sf-rail { overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
          .sf-rail-track { animation: none !important; transform: none !important; }
          .sf-rail-track > * { scroll-snap-align: start; }
          .sf-rail-dupe { display: none !important; }
          .sf-chip { animation: none !important; }
        }
      `}</style>

      <div className="relative z-10">
        {/* ── Hero — headline left, "up next" rail right ─────────────────────
            Sized to EXACTLY one viewport. 100svh keeps the whole hero inside the
            small (chrome-visible) viewport on mobile so nothing is clipped; the
            backdrop covers the full screen and the fade-to-cream lands on the
            hero's bottom edge, where the cream job board begins. Everything —
            headline, subcopy, CTAs and the three cards — fits with no scroll. */}
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
          {/* Backdrop — sized to the hero zone exactly */}
          <div className="absolute inset-0 z-0" aria-hidden="true" style={{ overflow: 'hidden' }}>
            {headliner?.banner_url ? (
              <img src={headliner.banner_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{ background: `linear-gradient(160deg, #12241B 0%, ${FOREST} 55%, #2A5A3C 130%)` }}
              />
            )}
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

          <SiteNav overlay />

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
                Go where<br />the debate is.
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
                Real conferences, real committee rooms — from London to San Salvador. Pick your weekend.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8" style={{ marginTop: '32px' }}>
                <Link
                  href="/conferences/explore"
                  className="inline-flex items-center gap-2.5"
                  style={{
                    fontFamily: SANS,
                    fontSize: 'clamp(15px, 1.05vw, 18px)',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: '#14100B',
                    backgroundColor: PALE_GOLD,
                    padding: 'clamp(15px, 1.1vw, 19px) clamp(28px, 2.1vw, 38px)',
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
                <HeroTextLink href="/conferences/new" label="Organising one? List it free" />
              </div>
            </div>

            {/* Curated "up next" rail — three photo-forward shared cards
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
                <div className="sf-hero-rail flex flex-row lg:flex-col gap-3 lg:gap-2.5 overflow-x-auto lg:overflow-visible -mx-6 px-6 lg:mx-0 lg:px-0 pb-2 lg:pb-0">
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

        {/* ── Find your seat — neumorphic role grid, ivory ────────────────────
            Soft extruded NeuCards on the ivory base; each card leads with the
            ROLE as an Outfit-900 ink wordmark over a vibrant gradient icon
            disc, with a muted line describing what that role gets. */}
        <section
          className="px-6 md:px-14 xl:px-20"
          style={{ backgroundColor: NEU.base, paddingTop: 'clamp(64px, 6vw, 108px)', paddingBottom: 'clamp(56px, 5vw, 96px)' }}
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
          <div className="sf-roles-grid">
            {ROLE_CARDS.map(rc => <RoleNeuCard key={rc.role} def={rc} />)}
          </div>
        </section>

        {/* ── The circuit in numbers — slim worlddiplomats-style impact strip:
            three plain figures, no cards, no chrome. Real data from the board. */}
        <section
          className="px-6 md:px-14"
          style={{ backgroundColor: CREAM, paddingTop: '56px', paddingBottom: '64px' }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-0">
            {[
              { n: conferences.length, label: 'Conferences on the board' },
              { n: conferences.reduce((s, c) => s + (c.expected_delegates || 0), 0), label: 'Delegates expected' },
              { n: new Set(conferences.map(c => c.country)).size, label: 'Countries' },
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
                  {stat.n.toLocaleString()}
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

        {/* ── Opportunities beyond delegating — job board, cream, no panel ──── */}
        <section
          className="relative px-6 md:px-14 xl:px-20"
          style={{ backgroundColor: CREAM, paddingTop: 'clamp(64px, 5.5vw, 100px)', paddingBottom: 'clamp(72px, 6vw, 110px)' }}
        >
          <div className="mx-auto flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-0" style={{ maxWidth: '1720px' }}>
            <div className="lg:w-[42%]" style={{ position: 'relative', zIndex: 2 }}>
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
                Gavelling hire chairs, secretariat and staff every season — and your MUN CV
                is the application.
              </p>
              {/* Three tiny "notification" previews of the freshest open roles,
                  fanned playfully above the CTA. Real data, all roads lead to /roles. */}
              {roleChips.length > 0 && (
                <div className="sf-chip-fan" style={{ position: 'relative', height: '96px', marginTop: '24px', maxWidth: '360px' }}>
                  {roleChips.map((chip, i) => {
                    const fan = CHIP_FAN[i] ?? CHIP_FAN[0];
                    return <RolePopChip key={chip.id} chip={chip} fan={fan} />;
                  })}
                </div>
              )}
              <Link
                href="/conferences/roles"
                className="inline-flex items-center gap-2.5"
                style={{
                  marginTop: roleChips.length > 0 ? '10px' : '28px',
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
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: '10px', letterSpacing: '0.15em', color: PALE_GOLD }}>
                    THE DAIS, MID-SESSION
                  </span>
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', color: IVORY_55 }}>
                    CHAIRS · SECRETARIAT · STAFF
                  </span>
                </div>
              </div>

              {/* Live stat ledger — the approved forest ledger straddling the
                  photo's left edge: one dark rounded block, three stacked cells
                  (a row of three on mobile), big pale-gold numerals. */}
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

        {/* ── Happening near you — regional auto-scroll rail (IP geo) ───────── */}
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

/**
 * One neumorphic role card: vibrant gradient icon disc + the ROLE as the
 * hero wordmark (Outfit 900, ink, uppercase), a muted supporting line, and
 * the same primary/secondary links the old carousel slides carried.
 */
function RoleNeuCard({ def }: { def: RoleCardDef }) {
  return (
    <NeuCard
      hover
      style={{
        padding: 'clamp(22px, 1.9vw, 34px)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div className="flex items-center" style={{ gap: 'clamp(14px, 1.1vw, 20px)' }}>
        <NeuIconDisc gradient={def.gradient} icon={def.icon} size={48} />
        <h3
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 'clamp(26px, 1.9vw, 36px)',
            lineHeight: 1,
            letterSpacing: '0.015em',
            textTransform: 'uppercase',
            color: NEU.ink,
            margin: 0,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {def.role}
        </h3>
      </div>
      <p
        style={{
          fontFamily: SANS,
          fontSize: 'clamp(13.5px, 0.95vw, 16px)',
          lineHeight: 1.6,
          color: INK_70,
          margin: 'clamp(14px, 1.2vw, 20px) 0 clamp(18px, 1.5vw, 26px) 0',
        }}
      >
        {def.blurb}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2" style={{ marginTop: 'auto' }}>
        <Link
          href={def.primary.href}
          className="sf-role-link inline-flex items-center gap-1.5"
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 'clamp(12.5px, 0.85vw, 14px)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: FOREST,
            textDecoration: 'none',
            transition: `color 200ms ${EASE}`,
          }}
        >
          {def.primary.label} <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
        {def.secondary && (
          <Link
            href={def.secondary.href}
            className="sf-role-sub"
            style={{
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: 'clamp(11.5px, 0.8vw, 13px)',
              color: NEU.muted,
              textDecoration: 'none',
              transition: `color 200ms ${EASE}`,
            }}
          >
            {def.secondary.label}
          </Link>
        )}
      </div>
    </NeuCard>
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

/**
 * A tiny "notification pop-up" preview of one open role: conference logo (or
 * monogram), role name, category-tinted meta line. Fanned above the job-board
 * CTA; clicking goes to /conferences/roles like the button itself.
 */
function RolePopChip({
  chip, fan,
}: {
  chip: RoleChip;
  fan: { left: string; bottom: string; rot: string; delay: string; z: number };
}) {
  const tint = CHIP_TINTS[chip.category] ?? CHIP_TINTS.staff;
  return (
    <Link
      href="/conferences/roles"
      className="sf-chip inline-flex items-center gap-2"
      aria-label={`Open role: ${chip.role} at ${chip.acronym}`}
      style={{
        position: 'absolute',
        left: fan.left,
        bottom: fan.bottom,
        zIndex: fan.z,
        ['--sf-rot' as string]: fan.rot,
        transform: `rotate(${fan.rot})`,
        animationDelay: fan.delay,
        backgroundColor: CREAM,
        border: `1px solid ${tint.border}`,
        borderLeft: `3px solid ${tint.color}`,
        borderRadius: '12px',
        padding: '7px 13px 7px 9px',
        boxShadow: '0 10px 26px rgba(27,56,40,0.18), 0 2px 6px rgba(27,56,40,0.08)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <LogoDisc src={chip.logoUrl} size={24} fallbackText={chip.acronym.slice(0, 2)} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, color: INK, lineHeight: 1.2, maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chip.role}
        </span>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: '8.5px', letterSpacing: '0.14em', color: tint.color, marginTop: '2px' }}>
          {chip.acronym.toUpperCase()} · {chip.category.replace(/-/g, ' ').toUpperCase()}
        </span>
      </span>
    </Link>
  );
}
