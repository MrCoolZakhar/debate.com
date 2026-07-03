'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V1 · "Stagefront" — Dice/RA-style poster-first browse.
//
// Thesis (landing-research.md §4/V1): delegates fall for a conference first and
// rationalise later. Lead with the most cinematic real asset we own (LIMUN's
// theatre banner) treated the way DICE treats a headline show; facts follow in
// RA-style date-grouped rows. One memorable move: photo to the viewport top,
// marquee headliner underneath. No cards, no grids.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import {
  LabConference, RatingSummary,
  CREAM, FOREST, GOLD, HAIRLINE, INK, IVORY, MONO, PALE_GOLD, SANS, TAUPE, GRAIN,
  compactRange, feeLabel, isConcluded, monthLabel, pickHeadliner, timingLabel, daysUntil,
  Stars, LabFooter,
} from './shared';

export default function VariantStagefront({
  conferences,
  ratings,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>;
}) {
  const headliner = useMemo(() => pickHeadliner(conferences), [conferences]);
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

  return (
    <div style={{ backgroundColor: CREAM, minHeight: '100vh' }}>
      {/* ── Hero — full-bleed real conference photography, nav floats over it ── */}
      <section className="relative" style={{ minHeight: 'min(92vh, 860px)', display: 'flex', flexDirection: 'column' }}>
        <div className="absolute inset-0 overflow-hidden">
          {headliner?.banner_url ? (
            <img
              src={headliner.banner_url}
              alt={`${headliner.full_name} — conference hall`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(160deg, #12241B 0%, ${FOREST} 55%, #2A5A3C 130%)` }}
            />
          )}
          {/* Scrim: legibility bottom-up, kept light in the middle so the hall reads */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(10,22,16,0.94) 0%, rgba(10,22,16,0.62) 26%, rgba(10,22,16,0.18) 58%, rgba(10,22,16,0.34) 100%)',
            }}
          />
        </div>

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

            {/* Photo credit-as-fact: anchors the hero image to a real listed event */}
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

      {/* ── On the marquee — the headliner as a full-width bill, not a card ──── */}
      {headliner && (
        <section className="px-6 md:px-14" style={{ paddingTop: '72px', paddingBottom: '28px' }}>
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: TAUPE, margin: '0 0 14px 0' }}>
            ON THE MARQUEE
          </p>
          <Link
            href={`/conferences/${headliner.slug}`}
            className="group block"
            style={{ textDecoration: 'none', borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${HAIRLINE}` }}
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
                    filter: 'drop-shadow(0 8px 18px rgba(27,56,40,0.28))',
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
                    color: INK,
                    margin: 0,
                    transition: 'color 160ms ease',
                  }}
                  className="group-hover:!text-[#1B3828]"
                >
                  {headliner.full_name}
                </h2>
                <p style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: TAUPE, margin: '10px 0 0 0' }}>
                  {headliner.city}, {headliner.country} · {compactRange(headliner.start_date, headliner.end_date)}
                </p>
                {headRating && (
                  <p className="flex items-center gap-2.5" style={{ margin: '12px 0 0 0' }}>
                    <Stars avg={headRating.avg} />
                    <span style={{ fontFamily: MONO, fontSize: '12px', color: INK }}>
                      {headRating.avg.toFixed(1)}
                    </span>
                    <span style={{ fontFamily: SANS, fontSize: '13px', color: TAUPE }}>
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
                    color: isConcluded(headliner) ? TAUPE : CREAM,
                    backgroundColor: isConcluded(headliner) ? 'rgba(154,138,120,0.16)' : FOREST,
                    padding: '6px 12px',
                    borderRadius: '9999px',
                  }}
                >
                  {timingLabel(headliner).toUpperCase()}
                </span>
                <span style={{ fontSize: '13px', color: INK }}>{feeLabel(headliner)}</span>
                <span style={{ fontSize: '13px', color: TAUPE }}>
                  {headliner.expected_delegates.toLocaleString()} delegates expected
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── The rest of the season — RA-style month-grouped rows ─────────────── */}
      {season.length > 0 && (
        <section className="px-6 md:px-14" style={{ paddingBottom: '48px' }}>
          {season.map(bucket => (
            <div key={bucket.label} style={{ marginTop: '40px' }}>
              <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: TAUPE, margin: '0 0 6px 0' }}>
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
                color: FOREST,
                textDecoration: 'none',
                borderBottom: `1px solid ${GOLD}`,
                paddingBottom: '4px',
              }}
            >
              SEE THE FULL DIRECTORY <ArrowRight size={14} strokeWidth={2.25} />
            </Link>
          </div>
        </section>
      )}

      {/* ── Split closing band — the two other audiences, one hairline apart ─── */}
      <section
        style={{
          backgroundColor: FOREST,
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
        }}
      >
        <div className="grid md:grid-cols-2">
          <BandHalf
            kicker="ORGANISERS"
            title="Run it on Gavelling, fee-free."
            body="Registration, allocations, documents and live committee sessions — with zero platform fees for organisers."
            cta="List your conference"
            href="/conferences/new"
            divider
          />
          <BandHalf
            kicker="CHAIRS & STAFF"
            title="The circuit is hiring."
            body="Conferences post open chair, secretariat and staff positions. Apply with a profile that travels with you."
            cta="See open roles"
            href="/conferences/roles"
          />
        </div>
      </section>

      <LabFooter />
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
        backgroundColor: hover ? 'rgba(27,56,40,0.045)' : 'transparent',
        transition: 'background-color 160ms ease',
        opacity: concluded ? 0.55 : 1,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.08em', color: FOREST, width: '96px', flexShrink: 0 }}>
        {compactRange(c.start_date, c.end_date)}
      </span>
      <span style={{ flex: 1, minWidth: '200px' }}>
        <span style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 700, color: INK }}>
          {c.full_name}
        </span>
        <span style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 500, color: TAUPE, marginLeft: '12px' }}>
          {c.city}, {c.country}
        </span>
      </span>
      <span className="hidden sm:inline" style={{ fontFamily: MONO, fontSize: '12px', color: rating ? GOLD : TAUPE, flexShrink: 0 }}>
        {rating ? `★ ${rating.avg.toFixed(1)}` : concluded ? 'CONCLUDED' : `${c.expected_delegates.toLocaleString()} delegates`}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '12px', color: INK, width: '76px', textAlign: 'right', flexShrink: 0 }}>
        {feeLabel(c)}
      </span>
      <ArrowUpRight
        size={16}
        strokeWidth={2}
        className="hidden md:block"
        style={{ color: FOREST, opacity: hover ? 1 : 0.25, transition: 'opacity 160ms ease', flexShrink: 0 }}
      />
    </Link>
  );
}

function BandHalf({
  kicker, title, body, cta, href, divider,
}: {
  kicker: string; title: string; body: string; cta: string; href: string; divider?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={divider ? 'md:border-r' : ''}
      style={{
        padding: 'clamp(40px, 6vw, 72px) clamp(24px, 5vw, 64px)',
        borderColor: 'rgba(237,231,216,0.16)',
        borderBottom: divider ? '1px solid rgba(237,231,216,0.16)' : 'none',
      }}
    >
      <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: PALE_GOLD, margin: 0 }}>
        {kicker}
      </p>
      <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(22px, 2.6vw, 30px)', letterSpacing: '-0.01em', color: IVORY, margin: '14px 0 0 0' }}>
        {title}
      </h3>
      <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.6, color: 'rgba(237,231,216,0.72)', margin: '12px 0 0 0', maxWidth: '380px' }}>
        {body}
      </p>
      <Link
        href={href}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="inline-flex items-center gap-2"
        style={{
          marginTop: '22px',
          fontFamily: MONO,
          fontSize: '12px',
          letterSpacing: '0.14em',
          color: hover ? PALE_GOLD : IVORY,
          textDecoration: 'none',
          borderBottom: `1px solid ${hover ? PALE_GOLD : 'rgba(237,231,216,0.4)'}`,
          paddingBottom: '4px',
          transition: 'color 160ms ease, border-color 160ms ease',
        }}
      >
        {cta.toUpperCase()} <ArrowRight size={13} strokeWidth={2.25} />
      </Link>
    </div>
  );
}
