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
//   2. "Opportunities beyond delegating" job board              — CREAM (no panel)
//   3. "Happening near you" regional auto-scroll rail (IP geo)  — IVORY
//   4. mymun-inspired "What is MUN / Why Gavelling" pair         — CREAM
//   5. Organiser tools — photo backdrop, 2×2 grid + gold CTA    — PHOTO
//   6. The production globe section, verbatim                   — FOREST
//   7. Ivory footer (design rule)
//
// The hero rail + the regional rail reuse the SHARED ConferenceCard
// (../ConferenceCard) — the same definition the explore directory renders;
// the hero stack uses its photo-forward `heroCompact` tier (banner photo
// fills the card) so three fit gracefully, pinned to the right screen edge.
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
  CREAM, FOREST, GOLD, IVORY, MONO, PALE_GOLD, SANS, HAIRLINE, GRAIN,
  isConcluded, pickHeadliner,
  LabFooter,
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
        @media (min-width: 1024px) { .sf-hero-rail { scroll-snap-type: none; } }
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

          <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-14 px-6 md:px-14 pb-8 md:pb-9 pt-20 md:pt-24">
            <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: '760px' }}>
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
              <aside className="w-full lg:w-[356px] flex-shrink-0 flex flex-col justify-center lg:justify-start lg:self-start lg:pt-3 lg:-mr-9 xl:-mr-10">
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
                        action="apply"
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
              {/* Three tiny "notification" previews of the freshest open roles,
                  fanned playfully above the CTA. Real data, all roads lead to /roles. */}
              {roleChips.length > 0 && (
                <div style={{ position: 'relative', height: '96px', marginTop: '24px', maxWidth: '360px' }}>
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
            <ExplainerCard photo="/landing/podium-speaker.jpg" photoAlt="A full committee room mid-debate, chair at the podium">
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

            <ExplainerCard photo="/landing/organiser-desk.jpg" photoAlt="A delegation working together on Gavelling at a laptop" photoPosition="center 42%">
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
        <section className="relative overflow-hidden" style={{ paddingTop: '56px', paddingBottom: '64px' }}>
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

          {/* Slim horizontal split: 2×2 highlight tiles LEFT, heading + copy +
              gold CTA RIGHT (vertically centered) — total height ≈ the job
              board band. On mobile the text+CTA column stacks ABOVE the grid
              (flex-col-reverse keeps the pitch before the feature detail). */}
          <div className="relative z-10 px-6 md:px-14">
            <div className="flex flex-col-reverse lg:flex-row lg:items-center gap-9 lg:gap-16">
              {/* LEFT — 2×2 square tiles */}
              <div
                className="grid grid-cols-2 gap-3 md:gap-4 w-full max-w-[440px] mx-auto lg:mx-0 lg:w-[440px] flex-shrink-0"
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
                        padding: '16px 14px',
                        justifyContent: 'center',
                        gap: '2px',
                      }}
                    >
                      <Icon size={46} color={PALE_GOLD} strokeWidth={1.6} />
                      <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: '13.5px', color: CREAM, margin: '12px 0 0 0' }}>
                        {card.title}
                      </h3>
                      <p style={{ fontFamily: SANS, fontSize: '10.5px', lineHeight: 1.45, color: IVORY_70, margin: '5px 0 0 0' }}>
                        {card.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* RIGHT — heading, copy, gold CTA — vertically centered */}
              <div className="flex-1 flex flex-col justify-center">
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
                <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: IVORY_70, margin: '12px 0 0 0', maxWidth: '520px' }}>
                  Registration, allocation, documents and live committee sessions — one platform,
                  zero fees for organisers.
                </p>
                <Link
                  href="/conferences/new"
                  className="inline-flex items-center gap-3"
                  style={{
                    marginTop: '28px',
                    alignSelf: 'flex-start',
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

/** mymun-style rounded card: large photo on top (bottom-fading into the card),
 *  editorial text below — cream. Photos are the real 1400px shots in
 *  /public/landing/, cover-cropped so they never stretch blurry. */
function ExplainerCard({
  photo, photoAlt, photoPosition = 'center 30%', children,
}: {
  photo: string; photoAlt: string; photoPosition?: string; children: React.ReactNode;
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
          className="w-full"
          style={{ display: 'block', height: 'clamp(280px, 24vw, 320px)', objectFit: 'cover', objectPosition: photoPosition }}
        />
        {/* Bottom fade into the card body */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0"
          style={{ height: '96px', background: `linear-gradient(to bottom, rgba(250,248,243,0) 0%, ${CREAM} 100%)` }}
        />
      </div>
      <div style={{ padding: '10px 28px 30px' }}>
        {children}
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
      {chip.logoUrl ? (
        <img
          src={chip.logoUrl}
          alt=""
          style={{ width: '24px', height: '24px', objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0,
            backgroundColor: FOREST, color: PALE_GOLD,
            fontFamily: MONO, fontSize: '8.5px', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {chip.acronym.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, color: INK, lineHeight: 1.2, maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chip.role}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.14em', color: tint.color, marginTop: '2px' }}>
          {chip.acronym.toUpperCase()} · {chip.category.replace(/-/g, ' ').toUpperCase()}
        </span>
      </span>
    </Link>
  );
}
