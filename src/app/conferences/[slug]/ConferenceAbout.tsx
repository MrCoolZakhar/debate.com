import Link from 'next/link';
import type { ConferenceAboutContent, FaqEntry } from '@/lib/conferenceAbout';
import { ConferenceHubLinks } from './ConferenceFacts';

// The server-rendered "About {short name}" section and the FAQ card of a
// public conference page. Words come from src/lib/conferenceAbout.ts (facts
// only, nothing invented). Passed into ConferenceDetailClient as props, so it
// is in the raw HTML a crawler reads and identical for every visitor (the
// page is cached, ISR). The FAQ's questions and answers are also the page's
// FAQPage JSON-LD (page.tsx), so both are drawn from the same strings.
//
// Look: the Overview's own white card (the description card's surface,
// border and radius), plain sans headings in ink, body text in the
// description's colour, every inline link bold and underlined, no pills, no
// truncation (names wrap).

const SANS = 'var(--font-brand), sans-serif';
const BODY = '#3B342C';
const SOFT = '#6B5F52';

const cardClass = 'rounded-[20px] p-6 md:p-7 mb-6';
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--gv-surface)',
  border: '1px solid var(--gv-border)',
  boxShadow: '0 1px 3px color-mix(in srgb, var(--gv-main) 4%, transparent)',
  fontFamily: SANS,
  color: BODY,
};
const h2Style: React.CSSProperties = {
  margin: 0,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 'clamp(20px, 2vw, 24px)',
  lineHeight: 1.25,
  color: 'var(--gv-on-surface)',
  overflowWrap: 'anywhere',
};
const h3Style: React.CSSProperties = {
  margin: '24px 0 10px',
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 16,
  lineHeight: 1.35,
  color: 'var(--gv-on-surface)',
};
const textStyle: React.CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.75, textWrap: 'pretty' };
const linkStyle: React.CSSProperties = {
  color: 'var(--gv-main)',
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

/** The full About section, for a conference whose own description is thin. */
export default function ConferenceAbout({
  about,
  hubLinks,
}: {
  about: ConferenceAboutContent;
  hubLinks: { href: string; label: string }[];
}) {
  return (
    <section aria-labelledby="conference-about-heading" className={cardClass} style={cardStyle}>
      <h2 id="conference-about-heading" style={h2Style}>{about.heading}</h2>
      {about.intro.map((p) => (
        <p key={p} style={{ ...textStyle, marginTop: 12 }}>{p}</p>
      ))}

      {about.committees.length > 0 && (
        <>
          <h3 style={h3Style}>Committees</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {about.committees.map((c) => (
              <li key={c.key} className="min-w-0">
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.35, color: 'var(--gv-on-surface)', overflowWrap: 'anywhere' }}>
                  {c.title}
                </p>
                {(c.fullName || c.type) && (
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.45, color: SOFT, overflowWrap: 'anywhere' }}>
                    {[c.fullName, c.type].filter(Boolean).join(' · ')}
                  </p>
                )}
                {c.topics.map((t) => (
                  <p key={t} style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{t}</p>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      {!about.concluded && (
        <>
          <h3 style={h3Style}>Roles, Fees and Deadlines</h3>
          {about.roles.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {about.roles.map((r) => (
                <li key={r.label} style={{ fontSize: 14.5, lineHeight: 1.6, padding: '3px 0', fontVariantNumeric: 'tabular-nums' }}>
                  <strong style={{ fontWeight: 700, color: 'var(--gv-on-surface)' }}>{r.label}</strong>
                  {': '}
                  {r.price}
                  {r.window ? `. ${r.window}.` : '.'}
                </li>
              ))}
            </ul>
          ) : (
            about.rolesNote && <p style={textStyle}>{about.rolesNote}</p>
          )}

          <h3 style={h3Style}>How to Apply on Gavelling</h3>
          <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal' }}>
            {about.steps.map((s) => (
              <li key={s} style={{ fontSize: 15, lineHeight: 1.7, paddingLeft: 2 }}>{s}</li>
            ))}
          </ol>
          <p style={{ ...textStyle, marginTop: 12 }}>{about.gavellingLine}</p>
          <p style={{ ...textStyle, marginTop: 12 }}>
            <Link href={about.applyHref} className="focus:outline-none" style={linkStyle}>
              {about.applyLabel}
            </Link>
          </p>
        </>
      )}

      <ConferenceHubLinks
        links={hubLinks}
        style={{ margin: '24px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--gv-on-surface)' }}
      />
    </section>
  );
}

/** The visible FAQ. Its strings are the FAQPage JSON-LD word for word. */
export function ConferenceFaq({ items }: { items: readonly FaqEntry[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="conference-faq-heading" className={cardClass} style={cardStyle}>
      <h2 id="conference-faq-heading" style={h2Style}>Frequently Asked Questions</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
      {items.map((it) => (
        <div key={it.question} className="min-w-0">
          <h3 style={{ ...h3Style, margin: '20px 0 6px', fontSize: 15.5 }}>{it.question}</h3>
          <p style={textStyle}>{it.answer}</p>
        </div>
      ))}
      </div>
    </section>
  );
}
