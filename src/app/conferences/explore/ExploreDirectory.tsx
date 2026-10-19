import Link from 'next/link';
import { formatConferenceDates, hasNoDates } from '@/lib/conferenceDates';
import type { ListedConference } from '@/lib/listedConferences';
import type { CountryHub } from '@/lib/countryHubs';
import { conferenceTitle } from '../in/ConferenceLinkList';
import { isGavellingListing } from '@/lib/listings';
import { NOT_ON_GAVELLING } from '@/components/conferences/NotOnGavellingMark';

// The bottom of /conferences/explore: every upcoming conference as a plain,
// server-rendered <a href> (name, city and country, dates), then the country
// hubs, the A to Z directory and the guides. It is VISIBLE, styled like the
// rest of the page (one white soft card on the ivory), never hidden text: the
// grid above renders client-side, so this is what a crawler (and a no-JS
// visitor) reads as the page's list. Rendered by page.tsx on the server,
// outside the Suspense boundary, so it is in the raw HTML (CLAUDE.md §4).

const SANS = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const LINK: React.CSSProperties = {
  color: FOREST, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3,
};

/** One plain link: short name big, full name beneath, place and (when known) dates. */
function DirectoryItem({ c, withDates }: { c: ListedConference; withDates: boolean }) {
  const dates = withDates ? formatConferenceDates(c.start_date, c.end_date, { style: 'dmy-end-year' }) : '';
  const place = c.format === 'online' ? 'Online' : [c.city, c.country].filter(Boolean).join(', ');
  const title = conferenceTitle(c);
  return (
    <li style={{ breakInside: 'avoid', padding: '7px 8px' }}>
      <Link href={`/conferences/${c.slug}`} className="gv-explore-dir-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={{ textDecoration: 'none', display: 'block' }}>
        <span className="block [overflow-wrap:anywhere]" style={{ fontWeight: 800, fontSize: 15, color: INK, lineHeight: 1.3 }}>
          {title}
        </span>
        {c.full_name && c.full_name !== title && (
          <span className="block [overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.35 }}>{c.full_name}</span>
        )}
        {(place || dates || isGavellingListing(c)) && (
          <span className="block" style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.4, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {/* A Gavelling listing (src/lib/listings.ts) says so in plain text. */}
            {[place, dates, isGavellingListing(c) ? NOT_ON_GAVELLING : ''].filter(Boolean).join(' · ')}
          </span>
        )}
      </Link>
    </li>
  );
}

const LIST_CARD: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 'clamp(14px, 1.6vw, 22px)', borderRadius: 22, backgroundColor: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 10px 26px rgba(27,56,40,0.08)',
};

export default function ExploreDirectory({ conferences, hubs }: { conferences: ListedConference[]; hubs: CountryHub[] }) {
  // Dated conferences soonest first; public conferences whose dates are to be
  // decided in their own short block after them, never with a made-up date.
  const dated = conferences.filter(c => !hasNoDates(c));
  const undated = conferences.filter(hasNoDates);
  return (
    <section
      aria-labelledby="gv-explore-directory"
      className="gv-explore-wrap"
      style={{ paddingTop: 'clamp(24px, 3vw, 40px)', paddingBottom: 'clamp(40px, 4vw, 64px)', fontFamily: SANS }}
    >
      <h2 id="gv-explore-directory" style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(22px, 2.2vw, 30px)', letterSpacing: '-0.012em', color: INK }}>
        All Upcoming Conferences
      </h2>
      <p style={{ margin: '6px 0 16px', fontSize: 14.5, lineHeight: 1.55, color: INK_SOFT, maxWidth: 640 }}>
        {/* Listings are here but not on Gavelling yet: with any of them, the line no longer says "apply on Gavelling". */}
        {conferences.some(c => isGavellingListing(c))
          ? (dated.length > 0 ? `${dated.length} upcoming Model UN conferences, soonest first.` : 'Upcoming Model UN conferences.')
          : dated.length > 0
            ? `${dated.length} Model UN conferences you can apply to on Gavelling, soonest first.`
            : 'Model UN conferences you can apply to on Gavelling.'}
      </p>
      {dated.length > 0 && (
        <ul className="gv-explore-dir" style={LIST_CARD}>
          {dated.map(c => <DirectoryItem key={c.id} c={c} withDates />)}
        </ul>
      )}
      {undated.length > 0 && (
        <>
          <h3 style={{ margin: '22px 0 10px', fontWeight: 800, fontSize: 'clamp(18px, 1.7vw, 22px)', letterSpacing: '-0.01em', color: INK }}>
            Dates to Be Decided
          </h3>
          <ul className="gv-explore-dir" style={LIST_CARD}>
            {undated.map(c => <DirectoryItem key={c.id} c={c} withDates={false} />)}
          </ul>
        </>
      )}
      <p style={{ margin: '18px 0 0', fontSize: 14.5, lineHeight: 1.9, color: INK_SOFT }}>
        {hubs.length > 0 && (
          <>
            By country:{' '}
            {hubs.map((h, i) => (
              <span key={h.slug}>
                <Link href={`/conferences/in/${h.slug}`} style={LINK}>Model UN in {h.name}</Link>
                {i < hubs.length - 1 ? ', ' : '. '}
              </span>
            ))}
          </>
        )}
        <Link href="/conferences/all" style={LINK}>See every conference, A to Z</Link>
        {' · '}
        <Link href="/guides" style={LINK}>MUN guides</Link>
      </p>
      <style>{`
        .gv-explore-dir { columns: 1; column-gap: 20px; }
        @media (min-width: 640px) { .gv-explore-dir { columns: 2; } }
        @media (min-width: 1024px) { .gv-explore-dir { columns: 3; } }
        @media (min-width: 1440px) { .gv-explore-dir { columns: 4; } }
        .gv-explore-dir-link:hover span:first-child { text-decoration: underline; text-underline-offset: 3px; }
      `}</style>
    </section>
  );
}
