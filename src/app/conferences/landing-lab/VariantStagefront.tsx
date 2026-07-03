'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V1 · "Stagefront" — the full composition (owner-approved evolution).
//
// The LIMUN theatre banner is no longer just a hero: it is the house the whole
// show happens in. A fixed, darkened, vignetted backdrop runs behind every
// section; content sits on translucent glass panels over it. Composition:
//   1. Hero (poster-first, nav floats over)
//   2. Three upcoming-conference cards — golden shimmering borders + gavel badge
//   3. The marquee headliner + RA-style season rows (glass ledger)
//   4. mymun-inspired pair: "What is MUN?" / "Why Gavelling?" (photo-top cards)
//   5. Organiser tools grid ending in a gold "List your conference →" CTA card
//   6. "Opportunities beyond delegating" — editorial job-board section w/ live stats
//   7. The production globe section, verbatim
//   8. Ivory footer (design rule)
//
// Golden shimmer: a 1.5px gradient "border" layer (padding trick) whose
// background-position is animated slowly across a 250%-wide gold gradient —
// pure CSS, disabled under prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CreditCard, FileText, Gavel, Users, Zap } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { supabase } from '@/lib/supabase';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import {
  LabConference, RatingSummary,
  CREAM, FOREST, GOLD, MONO, PALE_GOLD, SANS, GRAIN,
  compactRange, feeLabel, isConcluded, monthLabel, pickHeadliner, timingLabel, daysUntil,
  Stars, LabFooter,
} from './shared';

// Light-on-dark tokens for text sitting on the darkened backdrop.
const IVORY_90 = 'rgba(237,231,216,0.9)';
const IVORY_70 = 'rgba(237,231,216,0.7)';
const IVORY_55 = 'rgba(237,231,216,0.55)';
const GLASS_BG = 'rgba(12,26,19,0.62)';
const GLASS_BORDER = '1px solid rgba(237,231,216,0.14)';
const GLASS_BLUR = 'blur(14px) saturate(1.15)';

interface JobStats {
  open: number;
  hiring: number;
  chairing: number;
}

export default function VariantStagefront({
  conferences,
  ratings,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>;
}) {
  const headliner = useMemo(() => pickHeadliner(conferences), [conferences]);

  // The three soonest upcoming conferences take the golden-border marquee row.
  const upcomingTrio = useMemo(
    () =>
      conferences
        .filter(c => !isConcluded(c))
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 3),
    [conferences],
  );

  const rest = useMemo(
    () => conferences.filter(c => c.id !== headliner?.id),
    [conferences, headliner],
  );

  // Month buckets for the RA-style season listing, upcoming first.
  const season = useMemo(() => {
    const sorted = [...rest].sort((a, b) => {
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
  }, [rest]);

  const headRating = headliner ? ratings[headliner.id] : undefined;

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

  return (
    <div style={{ backgroundColor: '#0A1610', minHeight: '100vh', position: 'relative' }}>
      {/* Golden shimmer keyframes + reduced-motion opt-out (CSS only) */}
      <style>{`
        @keyframes sfGoldShimmer {
          from { background-position: 0% 50%; }
          to { background-position: 250% 50%; }
        }
        .sf-shimmer { animation: sfGoldShimmer 7s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sf-shimmer { animation: none !important; }
        }
      `}</style>

      {/* ── Full-page backdrop — the theatre house behind the whole show ────── */}
      <div className="fixed inset-0 z-0" aria-hidden="true">
        {headliner?.banner_url ? (
          <img
            src={headliner.banner_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(160deg, #12241B 0%, ${FOREST} 55%, #2A5A3C 130%)` }}
          />
        )}
        {/* Darkening pass — keeps every section legible without hiding the hall */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(8,18,13,0.5) 0%, rgba(8,18,13,0.32) 30%, rgba(8,18,13,0.66) 70%, rgba(8,18,13,0.82) 100%)',
          }}
        />
        {/* Vignette — pulls the eye centre-stage */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 90% at 50% 32%, transparent 42%, rgba(6,14,10,0.55) 78%, rgba(6,14,10,0.8) 100%)',
          }}
        />
      </div>

      {/* ── Everything below floats over the backdrop ───────────────────────── */}
      <div className="relative z-10">
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative" style={{ minHeight: 'min(92vh, 860px)', display: 'flex', flexDirection: 'column' }}>
          <SiteNav overlay />

          <div className="relative flex-1 flex flex-col justify-end px-6 md:px-14 pb-12 md:pb-16 pt-40">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
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

              {/* Photo credit-as-fact: anchors the backdrop image to a real listed event */}
              {headliner?.banner_url && (
                <div className="hidden md:block text-right" style={{ paddingBottom: '6px' }}>
                  <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(237,231,216,0.55)', margin: 0 }}>
                    PICTURED
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(237,231,216,0.85)', margin: '6px 0 0 0' }}>
                    {headliner.acronym} · {headliner.city.toUpperCase()} · {compactRange(headliner.start_date, headliner.end_date)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Taking the floor next — 3 golden shimmering cards ─────────────── */}
        {upcomingTrio.length > 0 && (
          <section className="px-6 md:px-14" style={{ paddingTop: '48px', paddingBottom: '20px' }}>
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
              }}
            >
              The next three gavels to fall.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {upcomingTrio.map(c => (
                <GoldenCard key={c.id} conference={c} rating={ratings[c.id]} />
              ))}
            </div>
          </section>
        )}

        {/* ── On the marquee + season ledger — one glass panel ──────────────── */}
        <section className="px-6 md:px-14" style={{ paddingTop: '52px', paddingBottom: '24px' }}>
          <div
            className="rounded-3xl px-6 md:px-10"
            style={{
              backgroundColor: GLASS_BG,
              backdropFilter: GLASS_BLUR,
              WebkitBackdropFilter: GLASS_BLUR,
              border: GLASS_BORDER,
              paddingTop: '40px',
              paddingBottom: '44px',
            }}
          >
            {headliner && (
              <>
                <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: IVORY_55, margin: '0 0 14px 0' }}>
                  ON THE MARQUEE
                </p>
                <Link
                  href={`/conferences/${headliner.slug}`}
                  className="group block"
                  style={{ textDecoration: 'none', borderTop: '1px solid rgba(237,231,216,0.45)', borderBottom: '1px solid rgba(237,231,216,0.14)' }}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10" style={{ padding: '34px 0' }}>
                    {headliner.logo_url && (
                      /* Free-floating logo — objectFit contain + drop-shadow, never chipped */
                      <img
                        src={headliner.logo_url}
                        alt={`${headliner.acronym} logo`}
                        style={{
                          width: '104px',
                          height: '104px',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.45))',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2
                        style={{
                          fontFamily: SANS,
                          fontWeight: 800,
                          fontSize: 'clamp(26px, 3.4vw, 44px)',
                          lineHeight: 1.05,
                          letterSpacing: '-0.015em',
                          color: CREAM,
                          margin: 0,
                          transition: 'color 160ms ease',
                        }}
                        className="group-hover:!text-[#EED98A]"
                      >
                        {headliner.full_name}
                      </h2>
                      <p style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: IVORY_70, margin: '10px 0 0 0' }}>
                        {headliner.city}, {headliner.country} · {compactRange(headliner.start_date, headliner.end_date)}
                      </p>
                      {headRating && (
                        <p className="flex items-center gap-2.5" style={{ margin: '12px 0 0 0' }}>
                          <Stars avg={headRating.avg} color={PALE_GOLD} />
                          <span style={{ fontFamily: MONO, fontSize: '12px', color: CREAM }}>
                            {headRating.avg.toFixed(1)}
                          </span>
                          <span style={{ fontFamily: SANS, fontSize: '13px', color: IVORY_55 }}>
                            from {headRating.count} delegate review{headRating.count === 1 ? '' : 's'}
                          </span>
                        </p>
                      )}
                    </div>
                    {/* Fact column — DICE-register urgency, numbers not adjectives */}
                    <div
                      className="flex md:flex-col items-center md:items-end gap-5 md:gap-2 flex-wrap"
                      style={{ fontFamily: MONO, flexShrink: 0 }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          letterSpacing: '0.14em',
                          color: isConcluded(headliner) ? IVORY_55 : '#14100B',
                          backgroundColor: isConcluded(headliner) ? 'rgba(237,231,216,0.14)' : PALE_GOLD,
                          padding: '6px 12px',
                          borderRadius: '9999px',
                        }}
                      >
                        {timingLabel(headliner).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '13px', color: CREAM }}>{feeLabel(headliner)}</span>
                      <span style={{ fontSize: '13px', color: IVORY_55 }}>
                        {headliner.expected_delegates.toLocaleString()} delegates expected
                      </span>
                    </div>
                  </div>
                </Link>
              </>
            )}

            {/* The rest of the season — RA-style month-grouped rows */}
            {season.map(bucket => (
              <div key={bucket.label} style={{ marginTop: '40px' }}>
                <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: IVORY_55, margin: '0 0 6px 0' }}>
                  {bucket.label.toUpperCase()}
                </p>
                {bucket.items.map(c => (
                  <SeasonRow key={c.id} conference={c} rating={ratings[c.id]} />
                ))}
              </div>
            ))}
            <div style={{ marginTop: '44px' }}>
              <Link
                href="/conferences/explore"
                className="inline-flex items-center gap-2"
                style={{
                  fontFamily: MONO,
                  fontSize: '12px',
                  letterSpacing: '0.16em',
                  color: PALE_GOLD,
                  textDecoration: 'none',
                  borderBottom: `1px solid ${GOLD}`,
                  paddingBottom: '4px',
                }}
              >
                SEE THE FULL DIRECTORY <ArrowRight size={14} strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── mymun-inspired pair — reinterpreted in Gavelling's language ───── */}
        <section className="px-6 md:px-14" style={{ paddingTop: '64px', paddingBottom: '24px' }}>
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: PALE_GOLD, margin: '0 0 8px 0' }}>
            NEW TO THE CIRCUIT?
          </p>
          <h2
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 'clamp(26px, 3vw, 38px)',
              letterSpacing: '-0.015em',
              color: CREAM,
              margin: '0 0 30px 0',
            }}
          >
            Start here.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Card A — the plain-language MUN explainer */}
            <ExplainerCard photo="/landing-right.jpg" photoAlt="Two delegates working through a draft resolution together">
              <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: PALE_GOLD, margin: 0 }}>
                THE GAME
              </p>
              <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 28px)', letterSpacing: '-0.01em', color: CREAM, margin: '12px 0 0 0' }}>
                What is Model UN, exactly?
              </h3>
              <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.7, color: IVORY_70, margin: '14px 0 0 0' }}>
                Model United Nations is diplomacy as a competitive sport. You represent a country
                you probably disagree with, in a committee debating a crisis that is very real,
                against delegates who came to win. Over a weekend you speak, caucus, draft and
                vote — and walk out better at arguing than most adults you know.{' '}
                <BodyLink href="/conferences/explore">Browse the circuit</BodyLink> to find your
                first committee room, or see how chairs{' '}
                <BodyLink href="/">run sessions live on Gavelling</BodyLink>.
              </p>
              <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.7, color: IVORY_70, margin: '12px 0 0 0' }}>
                No experience needed. Every great delegate started by mispronouncing
                &ldquo;moderated caucus&rdquo;.
              </p>
            </ExplainerCard>

            {/* Card B — why participate through Gavelling (gold-numbered 1–5) */}
            <ExplainerCard photo="/landing-left.jpg" photoAlt="A delegate rising to speak in committee">
              <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: PALE_GOLD, margin: 0 }}>
                WHY GAVELLING
              </p>
              <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 28px)', letterSpacing: '-0.01em', color: CREAM, margin: '12px 0 0 0' }}>
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
                        color: '#14100B',
                        backgroundColor: PALE_GOLD,
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
                    <span style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.6, color: IVORY_70 }}>
                      <strong style={{ color: CREAM, fontWeight: 700 }}>{title}</strong>{' '}
                      {body}
                    </span>
                  </li>
                ))}
              </ol>
            </ExplainerCard>
          </div>
        </section>

        {/* ── Organiser tools — grid ending in a gold CTA card ──────────────── */}
        <section className="px-6 md:px-14" style={{ paddingTop: '64px', paddingBottom: '24px' }}>
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
          <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: IVORY_70, margin: '14px 0 34px 0', maxWidth: '520px' }}>
            Registration, allocation, documents and live committee sessions — one platform,
            zero fees for organisers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                  className="rounded-2xl p-6"
                  style={{
                    backgroundColor: GLASS_BG,
                    backdropFilter: GLASS_BLUR,
                    WebkitBackdropFilter: GLASS_BLUR,
                    border: GLASS_BORDER,
                  }}
                >
                  <Icon size={22} color={PALE_GOLD} strokeWidth={2} />
                  <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: '16px', color: CREAM, margin: '14px 0 0 0' }}>
                    {card.title}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.6, color: IVORY_70, margin: '6px 0 0 0' }}>
                    {card.desc}
                  </p>
                </div>
              );
            })}

            {/* The bright CTA card that closes the grid (mymun pattern, our gold) */}
            <Link
              href="/conferences/new"
              className="rounded-2xl p-6 flex flex-col justify-between sm:col-span-2 lg:col-span-2 group"
              style={{
                backgroundColor: PALE_GOLD,
                textDecoration: 'none',
                minHeight: '180px',
                boxShadow: '0 18px 44px rgba(0,0,0,0.4)',
                transition: 'transform 180ms ease, background-color 180ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
            >
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: GOLD, margin: 0 }}>
                  FREE FOR ORGANISERS
                </p>
                <h3
                  style={{
                    fontFamily: SANS,
                    fontWeight: 900,
                    fontSize: 'clamp(24px, 2.6vw, 34px)',
                    letterSpacing: '-0.015em',
                    lineHeight: 1.05,
                    color: FOREST,
                    margin: '10px 0 0 0',
                  }}
                >
                  List your conference
                </h3>
              </div>
              <div className="flex items-end justify-between" style={{ marginTop: '18px' }}>
                <span style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 600, color: 'rgba(27,56,40,0.75)', maxWidth: '340px' }}>
                  On the board in minutes. Applications open the moment you publish.
                </span>
                <ArrowRight
                  size={44}
                  strokeWidth={2.25}
                  color={FOREST}
                  className="transition-transform duration-200 group-hover:translate-x-2"
                  style={{ flexShrink: 0 }}
                />
              </div>
            </Link>
          </div>
        </section>

        {/* ── Opportunities beyond delegating — the job board, editorial ────── */}
        <section className="px-6 md:px-14" style={{ paddingTop: '72px', paddingBottom: '84px' }}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-0">
            {/* Text column — deliberately narrower than the photo (asymmetric) */}
            <div className="lg:w-[42%]" style={{ position: 'relative', zIndex: 2 }}>
              <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: PALE_GOLD, margin: '0 0 14px 0' }}>
                THE JOB BOARD
              </p>
              <h2
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 'clamp(30px, 3.6vw, 50px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                  color: CREAM,
                  margin: 0,
                }}
              >
                Opportunities beyond delegating.
              </h2>
              <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.65, color: IVORY_70, margin: '18px 0 0 0', maxWidth: '420px' }}>
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
                  color: '#14100B',
                  backgroundColor: PALE_GOLD,
                  padding: '14px 26px',
                  borderRadius: '9999px',
                  textDecoration: 'none',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.35)',
                  transition: 'transform 180ms ease, background-color 180ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
              >
                SEE OPEN ROLES <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
            </div>

            {/* Photo column — bleeds slightly under the stat ledger */}
            <div className="lg:w-[58%]" style={{ position: 'relative' }}>
              {/*
                Photo: Miguel Henriques via Unsplash (license-safe, free to use)
                https://unsplash.com/photos/man-standing-in-front-of-people-sitting-beside-table-with-laptop-computers-9OKGEVJiTKk
                Downloaded to /public/landing/podium-speaker.jpg (~170 KB).
              */}
              <div
                className="relative overflow-hidden rounded-3xl"
                style={{ border: '1px solid rgba(237,231,216,0.18)', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }}
              >
                <img
                  src="/landing/podium-speaker.jpg"
                  alt="A chair addressing a full auditorium of delegates"
                  className="w-full object-cover"
                  style={{ display: 'block', aspectRatio: '3 / 2' }}
                />
                {/* Mono caption strip — the one memorable move */}
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
                  border: '1px solid rgba(238,217,138,0.35)',
                  backgroundColor: 'rgba(238,217,138,0.35)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
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
                    style={{
                      backgroundColor: 'rgba(12,26,19,0.9)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                    }}
                  >
                    <p style={{ fontFamily: SANS, fontWeight: 900, fontSize: '26px', lineHeight: 1, color: PALE_GOLD, margin: 0 }}>
                      {stat.n}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', color: IVORY_90, margin: '7px 0 0 0' }}>
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
          {/* Grain overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
          />

          {/* Globe video — right side, absolutely positioned */}
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
            {/* Radial vignette — dissolves all edges into forest background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 80% 85% at 65% 50%, transparent 35%, rgba(27,56,40,0.45) 58%, rgba(27,56,40,0.82) 75%, #1B3828 95%)',
              }}
            />
            {/* Left edge hard stop — prevents globe bleeding into text */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, #1B3828 0%, #1B3828 4%, rgba(27,56,40,0.6) 14%, transparent 28%)',
              }}
            />
          </div>

          {/* Left content */}
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

/** Inline link inside body copy (mymun explainer register, our gold). */
function BodyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: PALE_GOLD,
        textDecoration: 'none',
        borderBottom: `1px solid ${GOLD}`,
        transition: 'color 150ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#F3E3A1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = PALE_GOLD; }}
    >
      {children}
    </Link>
  );
}

/**
 * Golden shimmer card — one of the three soonest upcoming conferences.
 * Border shine: an animated gold gradient layer 1.5px larger than the card
 * (padding trick); a gavel-in-gold-disc badge straddles the top-right corner.
 */
function GoldenCard({ conference: c, rating }: { conference: LabConference; rating?: RatingSummary }) {
  const [hover, setHover] = useState(false);
  const countryObj = getCountryByName(c.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const days = daysUntil(c.start_date);

  return (
    <div style={{ position: 'relative', paddingTop: '16px' }}>
      {/* Gavel badge — a small gold disc overlapping the border, top-right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: '22px',
          width: '38px',
          height: '38px',
          borderRadius: '9999px',
          background: 'radial-gradient(circle at 32% 28%, #FBF0C6, #EED98A 45%, #B6871F 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 18px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.55)',
          zIndex: 3,
        }}
      >
        <Gavel size={18} color={FOREST} strokeWidth={2.25} />
      </div>

      {/* Shimmering border layer */}
      <div
        className="sf-shimmer"
        style={{
          borderRadius: '22px',
          padding: '1.5px',
          background:
            'linear-gradient(110deg, #8A6415 0%, #B6871F 18%, #EED98A 36%, #FFF3C4 48%, #EED98A 60%, #B6871F 80%, #8A6415 100%)',
          backgroundSize: '250% 250%',
          boxShadow: hover ? '0 22px 54px rgba(0,0,0,0.5)' : '0 16px 40px rgba(0,0,0,0.4)',
          transition: 'box-shadow 200ms ease',
        }}
      >
        <Link
          href={`/conferences/${c.slug}`}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="flex flex-col h-full"
          style={{
            borderRadius: '20.5px',
            backgroundColor: 'rgba(12,26,19,0.82)',
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
            padding: '26px 24px 22px',
            textDecoration: 'none',
            transform: hover ? 'translateY(-3px)' : 'translateY(0)',
            transition: 'transform 200ms ease',
          }}
        >
          {/* Free-floating logo — never chipped into a tile */}
          <div style={{ height: '64px', display: 'flex', alignItems: 'center' }}>
            {c.logo_url ? (
              <img
                src={c.logo_url}
                alt={`${c.acronym} logo`}
                style={{
                  maxHeight: '64px',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
                }}
              />
            ) : (
              <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: '26px', color: PALE_GOLD, letterSpacing: '0.02em' }}>
                {c.acronym}
              </span>
            )}
          </div>

          <h3
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: '20px',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: CREAM,
              margin: '16px 0 0 0',
            }}
          >
            {c.full_name}
          </h3>

          <p className="flex items-center gap-2" style={{ margin: '10px 0 0 0' }}>
            {flagUrl && (
              <img
                src={flagUrl}
                alt={`${c.country} flag`}
                style={{ width: '18px', height: '13px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
              />
            )}
            <span style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 600, color: IVORY_70 }}>
              {c.city}, {c.country}
            </span>
          </p>

          <p style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.1em', color: PALE_GOLD, margin: '8px 0 0 0' }}>
            {compactRange(c.start_date, c.end_date)}
          </p>

          <div className="flex items-center gap-3 flex-wrap" style={{ margin: '14px 0 0 0' }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '10.5px',
                letterSpacing: '0.12em',
                color: '#14100B',
                backgroundColor: PALE_GOLD,
                padding: '5px 11px',
                borderRadius: '9999px',
              }}
            >
              {days <= 0 ? 'HAPPENING NOW' : days === 1 ? 'STARTS TOMORROW' : `IN ${days} DAYS`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '12.5px', color: IVORY_90 }}>{feeLabel(c)}</span>
            {rating && (
              <span style={{ fontFamily: MONO, fontSize: '12px', color: PALE_GOLD }}>
                ★ {rating.avg.toFixed(1)}
              </span>
            )}
          </div>

          {/* APPLY affordance */}
          <div
            className="flex items-center justify-between"
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(237,231,216,0.14)',
            }}
          >
            <span
              style={{
                fontFamily: SANS,
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: hover ? '#F3E3A1' : PALE_GOLD,
                transition: 'color 160ms ease',
              }}
            >
              APPLY
            </span>
            <ArrowRight
              size={17}
              strokeWidth={2.5}
              color={hover ? '#F3E3A1' : PALE_GOLD}
              style={{ transform: hover ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 180ms ease, color 160ms ease' }}
            />
          </div>
        </Link>
      </div>
    </div>
  );
}

/** mymun-style rounded card: large photo on top, editorial text below — glass. */
function ExplainerCard({
  photo, photoAlt, children,
}: {
  photo: string; photoAlt: string; children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-3xl flex flex-col"
      style={{
        backgroundColor: GLASS_BG,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
        border: GLASS_BORDER,
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ position: 'relative' }}>
        <img
          src={photo}
          alt={photoAlt}
          className="w-full object-cover"
          style={{ display: 'block', height: '240px', objectPosition: 'center 30%' }}
        />
        {/* Bottom fade so the photo melts into the glass body */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, transparent 55%, rgba(12,26,19,0.72) 100%)',
          }}
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
        borderTop: '1px solid rgba(237,231,216,0.14)',
        textDecoration: 'none',
        backgroundColor: hover ? 'rgba(237,231,216,0.06)' : 'transparent',
        transition: 'background-color 160ms ease',
        opacity: concluded ? 0.55 : 1,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.08em', color: PALE_GOLD, width: '96px', flexShrink: 0 }}>
        {compactRange(c.start_date, c.end_date)}
      </span>
      <span style={{ flex: 1, minWidth: '200px' }}>
        <span style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 700, color: CREAM }}>
          {c.full_name}
        </span>
        <span style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 500, color: IVORY_55, marginLeft: '12px' }}>
          {c.city}, {c.country}
        </span>
      </span>
      <span className="hidden sm:inline" style={{ fontFamily: MONO, fontSize: '12px', color: rating ? PALE_GOLD : IVORY_55, flexShrink: 0 }}>
        {rating ? `★ ${rating.avg.toFixed(1)}` : concluded ? 'CONCLUDED' : `${c.expected_delegates.toLocaleString()} delegates`}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '12px', color: IVORY_90, width: '76px', textAlign: 'right', flexShrink: 0 }}>
        {feeLabel(c)}
      </span>
      <ArrowUpRight
        size={16}
        strokeWidth={2}
        className="hidden md:block"
        style={{ color: PALE_GOLD, opacity: hover ? 1 : 0.35, transition: 'opacity 160ms ease', flexShrink: 0 }}
      />
    </Link>
  );
}
