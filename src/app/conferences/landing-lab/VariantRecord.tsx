'use client';

// ─────────────────────────────────────────────────────────────────────────────
// V2 · "The Record", Eventbrite-style search utility × Stripe numeric precision.
//
// Thesis (landing-research.md §4/V2): the delegate's real anxiety is information
// asymmetry, cost, size, quality. mymun hides all three on its cards. Put every
// decision fact in one typeset index with a working search on top; the page
// converts on confidence. One memorable move: the ledger itself. No hero image,
// no cards, typography and tabular figures carry the whole page.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { LogoDisc } from '@/components/LogoDisc';
import { compareStartDate } from '@/lib/conferenceDates';
import {
  LabConference, LabReview, RatingSummary,
  CREAM, FOREST, GOLD, HAIRLINE, INK, IVORY, MONO, PALE_GOLD, SANS, TAUPE, GRAIN,
  compactRange, feeLabel, isConcluded, circuitStats,
  LabFooter,
} from './shared';

export default function VariantRecord({
  conferences,
  ratings,
  reviews,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>;
  reviews: LabReview[];
}) {
  const stats = useMemo(() => circuitStats(conferences), [conferences]);

  // Upcoming first, concluded sink to the bottom of the index.
  const indexRows = useMemo(() => {
    return [...conferences].sort((a, b) => {
      const ac = isConcluded(a) ? 1 : 0;
      const bc = isConcluded(b) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return compareStartDate(a.start_date, b.start_date);
    });
  }, [conferences]);

  // One verbatim review line per conference, used as a ledger footnote.
  const footnotes = useMemo(() => {
    const map: Record<string, LabReview> = {};
    for (const r of reviews) {
      const existing = map[r.conference_id];
      // Prefer the shortest quotable review, footnotes must stay one line-ish.
      if (!existing || r.review_text.length < existing.review_text.length) {
        map[r.conference_id] = r;
      }
    }
    return map;
  }, [reviews]);

  return (
    <div style={{ backgroundColor: CREAM, minHeight: '100vh' }}>
      <SiteNav />

      {/* ── Typographic hero: one claim, one working search ──────────────────── */}
      <section className="px-6 md:px-14" style={{ paddingTop: 'clamp(48px, 9vh, 110px)' }}>
        <div style={{ maxWidth: '980px' }}>
          <h1
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 'clamp(38px, 6.4vw, 78px)',
              lineHeight: 1.0,
              letterSpacing: '-0.025em',
              color: INK,
              margin: 0,
            }}
          >
            The conference circuit,{' '}
            <span style={{ color: FOREST, fontStyle: 'italic', fontWeight: 700 }}>on the record.</span>
          </h1>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(15px, 1.7vw, 18px)',
              lineHeight: 1.55,
              color: '#5C5245',
              margin: '22px 0 0 0',
              maxWidth: '560px',
            }}
          >
            Dates, fees, delegate counts and real reviews: every listed conference, before you commit a weekend.
          </p>

          <RecordSearch conferences={conferences} />

          {/* Live-computed stat strip, Stripe register: numbers, not adjectives */}
          <p
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
            style={{ fontFamily: MONO, fontSize: '11.5px', letterSpacing: '0.14em', color: TAUPE, margin: '18px 0 0 0' }}
          >
            <span style={{ color: FOREST }}>{stats.listed} CONFERENCE{stats.listed === 1 ? '' : 'S'}</span>
            <Dot />
            <span>{stats.seats.toLocaleString()} SEATS</span>
            <Dot />
            <span>{stats.countries} COUNTR{stats.countries === 1 ? 'Y' : 'IES'}</span>
          </p>
        </div>
      </section>

      {/* ── The index, a full-width typeset ledger, the page's one move ──────── */}
      <section className="px-6 md:px-14" style={{ paddingTop: '64px', paddingBottom: '20px' }}>
        {/* Column heads (desktop) */}
        <div
          className="hidden md:grid items-end"
          style={{
            gridTemplateColumns: '120px minmax(0,1fr) 110px 130px 110px 32px',
            gap: '20px',
            paddingBottom: '10px',
            borderBottom: `1px solid ${INK}`,
          }}
        >
          {['WHEN', 'CONFERENCE', 'FEE', 'DELEGATES', 'RATING', ''].map((h, i) => (
            <span
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: '9.5px',
                letterSpacing: '0.22em',
                color: TAUPE,
                textAlign: i >= 2 && i <= 4 ? 'right' : 'left',
              }}
            >
              {h}
            </span>
          ))}
        </div>
        <div className="md:hidden" style={{ borderBottom: `1px solid ${INK}`, paddingBottom: '8px' }}>
          <span style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.22em', color: TAUPE }}>THE INDEX</span>
        </div>

        {indexRows.map(c => (
          <IndexRow key={c.id} conference={c} rating={ratings[c.id]} footnote={footnotes[c.id]} />
        ))}

        {indexRows.length === 0 && (
          <p style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.1em', color: TAUPE, padding: '32px 0' }}>
            LOADING THE RECORD…
          </p>
        )}

        <div style={{ marginTop: '36px' }}>
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
            OPEN THE FULL DIRECTORY <ArrowRight size={14} strokeWidth={2.25} />
          </Link>
        </div>
      </section>

      {/* ── Organiser band, Ticket Tailor logic: fee claim + concrete proof ──── */}
      <section
        style={{
          marginTop: '56px',
          backgroundColor: FOREST,
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
        }}
      >
        <div
          className="px-6 md:px-14 grid md:grid-cols-[1.3fr_1fr] gap-10 md:gap-16 items-center"
          style={{ paddingTop: 'clamp(44px, 6vw, 72px)', paddingBottom: 'clamp(44px, 6vw, 72px)' }}
        >
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.24em', color: PALE_GOLD, margin: 0 }}>
              FOR ORGANISERS
            </p>
            <h2
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 'clamp(26px, 3.2vw, 40px)',
                letterSpacing: '-0.015em',
                lineHeight: 1.1,
                color: IVORY,
                margin: '16px 0 0 0',
              }}
            >
              Get on the record. It costs you nothing.
            </h2>
            <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: 'rgba(237,231,216,0.75)', margin: '14px 0 0 0', maxWidth: '480px' }}>
              Zero platform fees for organisers: registration, allocations, documents and live committee sessions included.
            </p>
            <Link
              href="/conferences/new"
              className="inline-flex items-center gap-2.5"
              style={{
                marginTop: '26px',
                fontFamily: SANS,
                fontSize: '14.5px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#14100B',
                backgroundColor: PALE_GOLD,
                padding: '13px 24px',
                borderRadius: '9999px',
                textDecoration: 'none',
                transition: 'transform 180ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              List your conference <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
          {/* Proof column, the largest listed conference, stated as a fact */}
          <ProofColumn conferences={conferences} ratings={ratings} />
        </div>
      </section>

      {/* ── Roles line, a single sentence, not a section ─────────────────────── */}
      <section style={{ padding: '30px 0' }}>
        <div className="px-6 md:px-14 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4" style={{ width: '100%' }}>
          <p style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: INK, margin: 0 }}>
            Looking to chair or staff a committee?
          </p>
          <Link
            href="/conferences/roles"
            className="inline-flex items-center gap-1.5"
            style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.14em', color: FOREST, textDecoration: 'none', borderBottom: `1px solid ${GOLD}`, paddingBottom: '3px' }}
          >
            SEE OPEN ROLES <ArrowUpRight size={13} strokeWidth={2.25} />
          </Link>
        </div>
      </section>

      <LabFooter />
    </div>
  );
}

// ── Local pieces ─────────────────────────────────────────────────────────────

function Dot() {
  return <span style={{ color: HAIRLINE }}>·</span>;
}

/** The hero's centre of gravity: a working search over the fetched directory. */
function RecordSearch({ conferences }: { conferences: LabConference[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const q = query.trim().toLowerCase();
  const results = q
    ? conferences.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.acronym.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  return (
    <div className="relative" style={{ marginTop: '34px', maxWidth: '620px' }}>
      <div
        className="flex items-center"
        style={{
          border: `1.5px solid ${focused ? FOREST : '#C9BFA9'}`,
          borderRadius: '9999px',
          backgroundColor: '#FFFDF8',
          boxShadow: focused ? '0 10px 30px rgba(27,56,40,0.14)' : '0 2px 10px rgba(27,56,40,0.05)',
          transition: 'border-color 180ms ease, box-shadow 180ms ease',
          padding: '6px 6px 6px 22px',
        }}
      >
        <Search size={17} strokeWidth={2} style={{ color: TAUPE, flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') router.push('/conferences/explore'); }}
          placeholder="Search name, city, or acronym…"
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: SANS,
            fontSize: '16px',
            color: INK,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            padding: '12px 14px',
          }}
        />
        <button
          onClick={() => router.push('/conferences/explore')}
          style={{
            fontFamily: SANS,
            fontSize: '14px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: CREAM,
            backgroundColor: FOREST,
            border: 'none',
            borderRadius: '9999px',
            padding: '12px 26px',
            cursor: 'pointer',
            transition: 'background-color 160ms ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = FOREST; }}
        >
          Search
        </button>
      </div>

      {q.length > 0 && (
        <div
          className="absolute left-0 right-0 z-50 overflow-hidden"
          style={{
            top: 'calc(100% + 10px)',
            backgroundColor: '#FFFDF8',
            border: `1px solid ${HAIRLINE}`,
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(27,56,40,0.16)',
          }}
        >
          {results.map(r => (
            <div
              key={r.id}
              onMouseDown={() => router.push(`/conferences/${r.slug}`)}
              className="flex items-baseline justify-between gap-4"
              style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: `1px solid rgba(221,212,192,0.5)` }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 700, color: INK }}>
                {r.full_name}
              </span>
              <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.08em', color: TAUPE, flexShrink: 0 }}>
                {r.city.toUpperCase()} · {compactRange(r.start_date, r.end_date)} · {feeLabel(r).toUpperCase()}
              </span>
            </div>
          ))}
          <div
            onMouseDown={() => router.push('/conferences/explore')}
            style={{ padding: '12px 20px', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em', color: FOREST }}>
              SEARCH THE FULL DIRECTORY →
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function IndexRow({
  conference: c,
  rating,
  footnote,
}: {
  conference: LabConference;
  rating?: RatingSummary;
  footnote?: LabReview;
}) {
  const [hover, setHover] = useState(false);
  const concluded = isConcluded(c);

  return (
    <Link
      href={`/conferences/${c.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="block"
      style={{
        textDecoration: 'none',
        borderBottom: `1px solid ${HAIRLINE}`,
        backgroundColor: hover ? 'rgba(27,56,40,0.04)' : 'transparent',
        transition: 'background-color 160ms ease',
        opacity: concluded ? 0.55 : 1,
      }}
    >
      {/* Desktop: strict ledger columns with tabular figures */}
      <div
        className="hidden md:grid items-center"
        style={{ gridTemplateColumns: '120px minmax(0,1fr) 110px 130px 110px 32px', gap: '20px', padding: '26px 0' }}
      >
        <div>
          <span style={{ fontFamily: MONO, fontSize: '12.5px', letterSpacing: '0.06em', color: FOREST, display: 'block' }}>
            {compactRange(c.start_date, c.end_date)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.14em', color: TAUPE, display: 'block', marginTop: '4px' }}>
            {new Date(c.start_date + 'T00:00:00').getFullYear()}
          </span>
        </div>
        <div className="flex items-center gap-4" style={{ minWidth: 0 }}>
          {c.logo_url && (
            <LogoDisc src={c.logo_url} size={42} fallbackText={c.acronym.slice(0, 2)} />
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: SANS, fontSize: '19px', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
              {c.full_name}
            </p>
            <p style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 500, color: TAUPE, margin: '3px 0 0 0' }}>
              {c.city}, {c.country}
            </p>
            {footnote && (
              <p style={{ fontFamily: SANS, fontStyle: 'italic', fontSize: '12.5px', color: '#7A6E5D', margin: '7px 0 0 0', maxWidth: '520px' }}>
                “{footnote.review_text.length > 110 ? footnote.review_text.slice(0, 107).trimEnd() + '…' : footnote.review_text}”, delegate review
              </p>
            )}
          </div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: '13px', color: INK, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {feeLabel(c)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '13px', color: INK, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {c.expected_delegates.toLocaleString()}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '13px', textAlign: 'right', color: rating ? GOLD : '#C0B5A0' }}>
          {rating ? `★ ${rating.avg.toFixed(1)} (${rating.count})` : '—'}
        </span>
        <ArrowUpRight size={16} strokeWidth={2} style={{ color: FOREST, opacity: hover ? 1 : 0.25, transition: 'opacity 160ms ease', justifySelf: 'end' }} />
      </div>

      {/* Mobile: two-line restack, same hairline grammar */}
      <div className="md:hidden" style={{ padding: '18px 2px' }}>
        <div className="flex items-baseline justify-between gap-3">
          <span style={{ fontFamily: SANS, fontSize: '16.5px', fontWeight: 700, color: INK }}>{c.full_name}</span>
          <span style={{ fontFamily: MONO, fontSize: '11.5px', color: rating ? GOLD : '#C0B5A0', flexShrink: 0 }}>
            {rating ? `★ ${rating.avg.toFixed(1)}` : '—'}
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em', color: TAUPE, margin: '7px 0 0 0' }}>
          {compactRange(c.start_date, c.end_date)} · {c.city.toUpperCase()} · {feeLabel(c).toUpperCase()} · {c.expected_delegates.toLocaleString()} DELEGATES
        </p>
      </div>
    </Link>
  );
}

function ProofColumn({
  conferences,
  ratings,
}: {
  conferences: LabConference[];
  ratings: Record<string, RatingSummary>;
}) {
  const flagship = useMemo(() => {
    const withRating = conferences.filter(c => ratings[c.id]);
    const pool = withRating.length > 0 ? withRating : conferences;
    return [...pool].sort((a, b) => (b.expected_delegates || 0) - (a.expected_delegates || 0))[0] ?? null;
  }, [conferences, ratings]);

  if (!flagship) return null;
  const r = ratings[flagship.id];

  return (
    <div style={{ borderLeft: `1px solid rgba(237,231,216,0.22)`, paddingLeft: 'clamp(20px, 3vw, 44px)' }}>
      <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', color: 'rgba(237,231,216,0.55)', margin: 0 }}>
        ALREADY ON THE RECORD
      </p>
      {flagship.logo_url && (
        <LogoDisc
          src={flagship.logo_url}
          alt={`${flagship.acronym} logo`}
          size={64}
          fallbackText={flagship.acronym.slice(0, 2)}
          style={{ marginTop: '18px', boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }}
        />
      )}
      <p style={{ fontFamily: SANS, fontSize: '19px', fontWeight: 700, color: IVORY, margin: '14px 0 0 0' }}>
        {flagship.full_name}
      </p>
      <p style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.06em', color: 'rgba(237,231,216,0.7)', margin: '10px 0 0 0', lineHeight: 1.8 }}>
        {flagship.expected_delegates.toLocaleString()} delegates expected
        <br />
        {compactRange(flagship.start_date, flagship.end_date)} · {flagship.city}
        {r && (
          <>
            <br />
            <span style={{ color: PALE_GOLD }}>★ {r.avg.toFixed(1)}</span> from {r.count} delegate review{r.count === 1 ? '' : 's'}
          </>
        )}
      </p>
    </div>
  );
}
