import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'How to Write a MUN Resolution: Clauses, Format & Examples',
  description: 'Learn how to write a Model UN resolution from scratch: preambulatory clauses, operative clauses, correct format, sponsor rules, and amendment process.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-resolution-writing' },
  openGraph: {
    title: 'How to Write a MUN Resolution: Clauses, Format & Examples',
    description: 'The complete guide to drafting MUN resolutions that pass.',
    url: 'https://gavelling.com/blog/mun-resolution-writing',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Resolution: Clauses, Format & Examples',
  description: 'Complete guide to drafting MUN resolutions.',
  url: 'https://gavelling.com/blog/mun-resolution-writing',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-resolution-writing' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Resolution Writing', item: 'https://gavelling.com/blog/mun-resolution-writing' },
  ],
};

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#EDE7D8', padding: '48px 24px 80px' },
  wrap: { maxWidth: '720px', margin: '0 auto' },
  back: { fontSize: '13px', color: '#6A5A4A', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' },
  h1: { fontSize: '36px', fontWeight: 900, color: '#1B3828', lineHeight: 1.15, marginBottom: '12px' },
  meta: { fontSize: '13px', color: '#9A8A78', marginBottom: '40px' },
  article: { backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: '20px', padding: '40px 40px 48px' },
  h2: { fontSize: '22px', fontWeight: 800, color: '#1B3828', marginTop: '40px', marginBottom: '12px' },
  h3: { fontSize: '17px', fontWeight: 700, color: '#1B3828', marginTop: '24px', marginBottom: '8px' },
  p: { fontSize: '16px', color: '#1C1410', lineHeight: 1.75, marginBottom: '16px' },
  ul: { paddingLeft: '20px', marginBottom: '16px' },
  li: { fontSize: '16px', color: '#1C1410', lineHeight: 1.75, marginBottom: '6px' },
  callout: { backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', borderLeft: '4px solid #1B3828', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' },
  calloutText: { fontSize: '15px', color: '#1B3828', fontStyle: 'italic', margin: 0 },
  cta: { marginTop: '48px', padding: '28px 32px', backgroundColor: '#1B3828', borderRadius: '16px', textAlign: 'center' as const },
  ctaText: { fontSize: '16px', color: '#EDE7D8', marginBottom: '12px' },
  ctaLink: { display: 'inline-block', fontSize: '15px', fontWeight: 800, color: '#EED98A', textDecoration: 'none' },
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div style={s.page}>
        <div style={s.wrap}>
          <Link href="/blog" style={s.back}>← MUN Resources</Link>
          <h1 style={s.h1}>How to Write a MUN Resolution: Clauses, Format & Examples</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 12 min read</p>
          <article style={s.article}>

            <p style={s.p}>A Model UN resolution is the formal output of a committee's work. It is the document that delegates spend hours debating, amending, and eventually voting on. Writing one that is both substantive and passable requires understanding the format, choosing the right language, and building a coalition wide enough to get it across the line. This guide covers everything from your first clause to the final vote.</p>

            <h2 style={s.h2}>Working Paper vs. Draft Resolution</h2>
            <p style={s.p}>The terms are often used interchangeably but technically mean different things. A <strong>working paper</strong> is an informal document used to develop ideas; it does not need to follow strict resolution format and is not voted on directly. A <strong>draft resolution</strong> is a formally formatted document submitted to the committee for debate and a vote. Most conferences require a draft resolution to have a minimum number of sponsors before it can be introduced.</p>

            <h2 style={s.h2}>Resolution Structure</h2>
            <p style={s.p}>Every MUN resolution has the same structure: a header, preambulatory clauses, and operative clauses.</p>

            <h3 style={s.h3}>The Header</h3>
            <p style={s.p}>The header identifies the document: Committee name, Topic, Sponsors (countries that wrote it), and Signatories (countries that want it debated but may not support it). The format is:</p>
            <p style={s.p}><em>Committee: General Assembly Third Committee | Topic: Protection of Refugees | Sponsors: Germany, Canada, Kenya | Signatories: Brazil, India, Sweden...</em></p>

            <h3 style={s.h3}>Preambulatory Clauses</h3>
            <p style={s.p}>Preambulatory clauses come first and provide context and justification. They begin with a present participle (a gerund) and end with a comma. They explain why the committee is acting, citing previous resolutions, existing international law, or recognising the scale of the problem.</p>
            <p style={s.p}>Common preambulatory phrases:</p>
            <ul style={s.ul}>
              <li style={s.li}><em>Recalling:</em> past UN resolutions on this topic</li>
              <li style={s.li}><em>Recognising:</em> the severity or importance of the issue</li>
              <li style={s.li}><em>Noting with concern:</em> a troubling trend or statistic</li>
              <li style={s.li}><em>Affirming:</em> a principle or right already established in international law</li>
              <li style={s.li}><em>Deeply concerned:</em> strong urgency</li>
              <li style={s.li}><em>Welcoming:</em> positive recent developments</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>Preambulatory clauses are italicised in formal resolution format. They do not create obligations; they only set context. Keep them tight. Three to five is usually enough.</p></div>

            <h3 style={s.h3}>Operative Clauses</h3>
            <p style={s.p}>Operative clauses are the resolution's actual content. They begin with a strong verb in the third person and end with a semicolon, except the final one which ends with a period. They are numbered and are what gets debated, amended, and voted on.</p>
            <p style={s.p}>Common operative phrases:</p>
            <ul style={s.ul}>
              <li style={s.li}><em>Calls upon:</em> requests but does not require action</li>
              <li style={s.li}><em>Urges:</em> stronger than calls upon</li>
              <li style={s.li}><em>Strongly urges:</em> even stronger</li>
              <li style={s.li}><em>Decides:</em> binding, used when the body has authority to mandate</li>
              <li style={s.li}><em>Requests:</em> asks another body (e.g. Secretary-General) to take action</li>
              <li style={s.li}><em>Encourages:</em> soft language for sensitive topics</li>
              <li style={s.li}><em>Establishes:</em> creates a new mechanism or body</li>
              <li style={s.li}><em>Recommends:</em> suggests action without requiring it</li>
            </ul>

            <h2 style={s.h2}>Writing Good Operative Clauses</h2>
            <p style={s.p}>The most common mistake in resolution writing is vagueness. "Encourages member states to cooperate on climate change" is not a clause; it is a platitude. A well-written operative clause specifies who does what, how, by when, and with what resources.</p>
            <p style={s.p}>Compare:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Weak:</strong> Urges member states to address the refugee crisis;</li>
              <li style={s.li}><strong>Strong:</strong> Urges member states to increase annual refugee resettlement quotas by a minimum of 10% and to report progress to the High Commissioner for Refugees by December 2027;</li>
            </ul>

            <h2 style={s.h2}>Sub-clauses and Nested Structure</h2>
            <p style={s.p}>Operative clauses can have sub-clauses, labelled (a), (b), (c). Use them when a clause has several component parts. Sub-clauses end with a comma except the last, which ends with the semicolon that closes the parent clause.</p>

            <h2 style={s.h2}>Getting Your Resolution Passed</h2>
            <p style={s.p}>A brilliantly written resolution that cannot get a majority is useless. Draft with coalition-building in mind from the start:</p>
            <ul style={s.ul}>
              <li style={s.li}>Invite opposing bloc delegates to contribute language on operative clauses where you can find common ground.</li>
              <li style={s.li}>Use "calls upon" and "encourages" for politically sensitive clauses that might lose votes if worded more strongly.</li>
              <li style={s.li}>Be willing to accept friendly amendments that broaden support without gutting your resolution's substance.</li>
            </ul>

            <RelatedGuides currentSlug="mun-resolution-writing" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling lets delegates submit working papers and draft resolutions directly to the chair during committee.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
