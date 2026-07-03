'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V3 · "First Gavel" — Luma-style supply-side minimalism.
//
// Thesis (landing-research.md §4/V3): a directory is only as good as its supply.
// Luma's home ignores attendees and sells hosting in one sentence; Ticket Tailor
// wins on fees. Gavelling's sharpest weapon is zero platform fees — so the page
// makes exactly one claim to organisers, then proves it with live customer data
// (Vercel's narrative-proof move: "LIMUN 2027 runs on Gavelling — 1,250
// delegates expected"). One memorable move: the split hero whose right half is
// real customer data, not decoration. Numbered index list instead of icon cards.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import {
  LabConference, LabReview, RatingSummary,
  CREAM, FOREST, GOLD, HAIRLINE, INK, IVORY, MONO, PALE_GOLD, SANS, TAUPE, GRAIN,
  compactRange, isConcluded,
  Stars, LabFooter,
} from './shared';

const CAPABILITIES: { n: string; title: string; desc: string }[] = [
  { n: '01', title: 'Registration & allocations', desc: 'Applications, delegate preferences and one-click committee assignment.' },
  { n: '02', title: 'Document portal', desc: 'Study guides, position papers and chair feedback, all in one place.' },
  { n: '03', title: 'Live committee sessions', desc: 'Every committee runs on Gavelling’s debate engine — speakers list to final vote.' },
  { n: '04', title: 'Automated comms', desc: 'Acceptance emails, allocation codes and reminders, sent for you.' },
];

export default function VariantFirstGavel({
  conferences,
  ratings,
  reviews,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>;
  reviews: LabReview[];
}) {
  // Proof subject: the biggest conference with imagery (LIMUN today).
  const flagship = useMemo(() => {
    const withBanner = conferences.filter(c => c.banner_url);
    const pool = withBanner.length > 0 ? withBanner : conferences;
    return [...pool].sort((a, b) => (b.expected_delegates || 0) - (a.expected_delegates || 0))[0] ?? null;
  }, [conferences]);

  const flagRating = flagship ? ratings[flagship.id] : undefined;

  // Editorial pull-quote: the flagship's most substantial 5★ review.
  const quote = useMemo(() => {
    if (!flagship) return null;
    const mine = reviews.filter(r => r.conference_id === flagship.id);
    if (mine.length === 0) return null;
    const top = Math.max(...mine.map(r => r.rating));
    return mine.filter(r => r.rating === top).sort((a, b) => b.review_text.length - a.review_text.length)[0];
  }, [reviews, flagship]);

  const openNow = useMemo(() => conferences.filter(c => !isConcluded(c)).length, [conferences]);

  return (
    <div style={{ backgroundColor: CREAM, minHeight: '100vh' }}>
      {/* ── Split hero: claim on forest, proof on photograph ──────────────────── */}
      <section className="relative grid md:grid-cols-[1.08fr_1fr]" style={{ minHeight: 'min(94vh, 900px)' }}>
        <SiteNav overlay />

        {/* Left: the one claim */}
        <div
          className="flex flex-col justify-center px-6 md:px-14"
          style={{
            backgroundColor: FOREST,
            backgroundImage: `radial-gradient(120% 90% at 85% 10%, rgba(42,90,60,0.55) 0%, rgba(27,56,40,0) 60%), ${GRAIN}`,
            backgroundRepeat: 'no-repeat, repeat',
            backgroundSize: 'auto, 300px 300px',
            paddingTop: '120px',
            paddingBottom: '72px',
          }}
        >
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', color: PALE_GOLD, margin: 0 }}>
            FOR ORGANISERS
          </p>
          <h1
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 'clamp(40px, 5.4vw, 74px)',
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              color: IVORY,
              margin: '22px 0 0 0',
              maxWidth: '560px',
            }}
          >
            Run the conference. Keep the fees.
          </h1>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(15px, 1.5vw, 17.5px)',
              lineHeight: 1.6,
              color: 'rgba(237,231,216,0.78)',
              margin: '22px 0 0 0',
              maxWidth: '440px',
            }}
          >
            Registration, allocations, documents and live committee sessions — end-to-end on Gavelling. Zero platform fees for organisers.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4" style={{ marginTop: '36px' }}>
            <Link
              href="/conferences/new"
              className="inline-flex items-center justify-center gap-2.5"
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
                boxShadow: '0 14px 36px rgba(0,0,0,0.3)',
                transition: 'transform 180ms ease, background-color 180ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = PALE_GOLD; }}
            >
              Start your conference <ArrowRight size={17} strokeWidth={2.5} />
            </Link>
            <GhostLink href="/conferences/explore" label="Browse conferences" />
          </div>

          <Link
            href="/conferences/roles"
            className="inline-flex items-center gap-1.5"
            style={{
              marginTop: '26px',
              fontFamily: SANS,
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'rgba(237,231,216,0.6)',
              textDecoration: 'none',
              transition: 'color 160ms ease',
              alignSelf: 'flex-start',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = IVORY; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(237,231,216,0.6)'; }}
          >
            Rather chair one? See open roles <ArrowUpRight size={13} strokeWidth={2.25} />
          </Link>
        </div>

        {/* Right: proof, not decoration — a real customer's real weekend */}
        <div className="relative" style={{ minHeight: '420px' }}>
          {flagship?.banner_url ? (
            <img
              src={flagship.banner_url}
              alt={`${flagship.full_name} — main hall`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(200deg, #2A5A3C 0%, ${FOREST} 70%)` }} />
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(10,22,16,0.9) 0%, rgba(10,22,16,0.28) 42%, rgba(10,22,16,0.12) 100%)' }}
          />
          {flagship && (
            <Link
              href={`/conferences/${flagship.slug}`}
              className="absolute left-0 right-0 bottom-0 block group"
              style={{ padding: 'clamp(24px, 3vw, 40px)', textDecoration: 'none' }}
            >
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.26em', color: PALE_GOLD, margin: 0 }}>
                RUNS ON GAVELLING
              </p>
              <div className="flex items-end gap-4" style={{ marginTop: '14px' }}>
                {flagship.logo_url && (
                  <img
                    src={flagship.logo_url}
                    alt={`${flagship.acronym} logo`}
                    style={{ width: '58px', height: '58px', objectFit: 'contain', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))', flexShrink: 0 }}
                  />
                )}
                <div>
                  <p style={{ fontFamily: SANS, fontSize: 'clamp(18px, 1.8vw, 23px)', fontWeight: 800, letterSpacing: '-0.01em', color: CREAM, margin: 0 }}>
                    {flagship.full_name}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '0.08em', color: 'rgba(237,231,216,0.85)', margin: '8px 0 0 0', lineHeight: 1.7 }}>
                    {flagship.expected_delegates.toLocaleString()} delegates expected · {compactRange(flagship.start_date, flagship.end_date)} · {flagship.city}
                    {flagRating && (
                      <>
                        <br />
                        <span style={{ color: PALE_GOLD }}>★ {flagRating.avg.toFixed(1)}</span> from {flagRating.count} delegate review{flagRating.count === 1 ? '' : 's'}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* ── Editorial pull-quote — a delegate's verbatim words, typeset large ─── */}
      {quote && flagship && (
        <section className="px-6 md:px-14" style={{ paddingTop: 'clamp(56px, 8vw, 100px)', paddingBottom: 'clamp(56px, 8vw, 100px)' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <div className="flex justify-center" style={{ marginBottom: '26px' }}>
              <Stars avg={quote.rating} size={15} />
            </div>
            <blockquote
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontStyle: 'italic',
                fontSize: 'clamp(20px, 2.6vw, 30px)',
                lineHeight: 1.42,
                letterSpacing: '-0.01em',
                color: INK,
                textAlign: 'center',
                margin: 0,
              }}
            >
              “{quote.review_text}”
            </blockquote>
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', color: TAUPE, textAlign: 'center', margin: '26px 0 0 0' }}>
              {quote.display_name.toUpperCase()} · DELEGATE AT {flagship.acronym} · VERIFIED REVIEW
            </p>
          </div>
        </section>
      )}

      {/* ── Capabilities — a numbered index list, deliberately not icon cards ─── */}
      <section
        className="px-6 md:px-14"
        style={{
          backgroundColor: IVORY,
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          paddingTop: 'clamp(48px, 6vw, 80px)',
          paddingBottom: 'clamp(48px, 6vw, 80px)',
        }}
      >
        <div className="grid md:grid-cols-[280px_1fr] gap-8 md:gap-16">
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: TAUPE, margin: 0 }}>
              WHAT YOU HAND OFF
            </p>
            <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(24px, 2.6vw, 34px)', letterSpacing: '-0.015em', lineHeight: 1.12, color: INK, margin: '14px 0 0 0' }}>
              One platform, the whole weekend.
            </h2>
          </div>
          <div>
            {CAPABILITIES.map((cap, i) => (
              <CapabilityRow key={cap.n} {...cap} first={i === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Audience flip — delegates get one honest sentence, not a section ──── */}
      <section
        style={{
          backgroundColor: FOREST,
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
        }}
      >
        <div
          className="px-6 md:px-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
          style={{ paddingTop: 'clamp(40px, 5vw, 60px)', paddingBottom: 'clamp(40px, 5vw, 60px)' }}
        >
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: PALE_GOLD, margin: 0 }}>
              HERE TO DELEGATE?
            </p>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(20px, 2.2vw, 27px)', fontWeight: 800, letterSpacing: '-0.01em', color: IVORY, margin: '10px 0 0 0' }}>
              {openNow > 0
                ? `${openNow} conference${openNow === 1 ? ' is' : 's are'} open for applications now.`
                : 'The next season is loading.'}
            </p>
          </div>
          <Link
            href="/conferences/explore"
            className="inline-flex items-center gap-2.5 self-start md:self-auto"
            style={{
              fontFamily: SANS,
              fontSize: '14.5px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: IVORY,
              border: `1.5px solid rgba(237,231,216,0.55)`,
              padding: '13px 26px',
              borderRadius: '9999px',
              textDecoration: 'none',
              transition: 'background-color 180ms ease, color 180ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = IVORY; e.currentTarget.style.color = FOREST; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = IVORY; }}
          >
            Browse conferences <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      <LabFooter />
    </div>
  );
}

// ── Local pieces ─────────────────────────────────────────────────────────────

function GhostLink({ href, label }: { href: string; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center justify-center gap-2"
      style={{
        fontFamily: SANS,
        fontSize: '15px',
        fontWeight: 700,
        letterSpacing: '0.03em',
        color: hover ? FOREST : IVORY,
        backgroundColor: hover ? IVORY : 'transparent',
        border: `1.5px solid rgba(237,231,216,${hover ? 1 : 0.5})`,
        padding: '13.5px 26px',
        borderRadius: '9999px',
        textDecoration: 'none',
        transition: 'background-color 180ms ease, color 180ms ease, border-color 180ms ease',
      }}
    >
      {label}
    </Link>
  );
}

function CapabilityRow({ n, title, desc, first }: { n: string; title: string; desc: string; first: boolean }) {
  return (
    <div
      className="grid grid-cols-[44px_1fr] md:grid-cols-[44px_260px_1fr] items-baseline gap-x-4 md:gap-x-8 gap-y-1"
      style={{ padding: '22px 0', borderTop: first ? `1px solid ${INK}` : `1px solid ${HAIRLINE}` }}
    >
      <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.08em', color: GOLD }}>{n}</span>
      <span style={{ fontFamily: SANS, fontSize: '19px', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>
        {title}
      </span>
      <span className="col-start-2 md:col-start-3" style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.55, color: '#6B6052' }}>
        {desc}
      </span>
    </div>
  );
}
