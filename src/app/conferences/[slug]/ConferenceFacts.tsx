import Link from 'next/link';

// The short server-rendered summary at the foot of a conference's Overview
// (passed into ConferenceDetailClient as `overviewFooter`, so it is in the raw
// HTML a crawler reads). One plain paragraph of the facts the page holds
// (conferenceSummary in src/lib/conferenceSeo.ts), so no conference page is
// thin when the organiser wrote little, then plain links: the hubs this
// conference belongs to (its country, online, its month and its year, those
// that exist, src/lib/countryHubs.ts) and /conferences/all. Never a list of
// conferences (CLAUDE.md §3: the crawl path for conference pages is
// /conferences/all and the hubs). Colours come from the page theme's own
// variables.

const SANS = 'var(--font-brand), sans-serif';

const linkStyle: React.CSSProperties = {
  color: 'inherit',
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

export default function ConferenceFacts({
  summary,
  links,
}: {
  summary: string;
  links: { href: string; label: string }[];
}) {
  return (
    <section
      aria-label="About this conference"
      className="mt-8"
      style={{ fontFamily: SANS, color: 'var(--gv-on-bg)', fontSize: 14, lineHeight: 1.6 }}
    >
      <p style={{ margin: 0, maxWidth: 820, textWrap: 'pretty', opacity: 0.85 }}>{summary}</p>
      <ConferenceHubLinks links={links} style={{ margin: '10px 0 0' }} />
    </section>
  );
}

/** The hub links and /conferences/all as one line of bold underlined links.
 *  Shared with the About section (ConferenceAbout.tsx), which replaces the
 *  facts paragraph on a thin page and keeps these links. */
export function ConferenceHubLinks({
  links,
  style,
}: {
  links: { href: string; label: string }[];
  style?: React.CSSProperties;
}) {
  return (
    <p style={style}>
      {links.map((l) => (
        <span key={l.href}>
          <Link href={l.href} className="focus:outline-none" style={linkStyle}>
            {l.label}
          </Link>
          <span aria-hidden="true" style={{ opacity: 0.6 }}> · </span>
        </span>
      ))}
      <Link href="/conferences/all" className="focus:outline-none" style={linkStyle}>
        All Model UN conferences
      </Link>
    </p>
  );
}
