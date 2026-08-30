import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import React from 'react';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Awards Guide: How Best Delegate Is Chosen',
  description:
    'How MUN awards work: Best Delegate, Outstanding Delegate, Verbal Commendation: what chairs look for, how to improve your score, and what not to do.',
  path: '/blog/mun-awards-guide',
  ogDescription:
    'Understand how MUN awards are chosen and how to improve your chances.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Awards Guide: How Best Delegate Is Chosen',
  description: 'How MUN awards work and how to improve your chances.',
  url: 'https://gavelling.com/blog/mun-awards-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-awards-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Awards Guide', item: 'https://gavelling.com/blog/mun-awards-guide' },
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
          <h1 style={s.h1}>MUN Awards Guide: How Best Delegate Is Chosen</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>
            <p style={s.p}>Every MUN delegate wants to know how awards are decided. The honest answer: it varies by conference, by chair, and by committee dynamics. But the factors that consistently produce awards are more predictable than delegates often assume. This guide explains how the award system works and how to perform at the level that earns recognition.</p>

            <h2 style={s.h2}>The Standard Award Hierarchy</h2>
            <p style={s.p}>Most MUN conferences award in the following tiers:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Best Delegate:</strong> The single highest-performing delegate in the committee. Usually one per committee.</li>
              <li style={s.li}><strong>Outstanding Delegate:</strong> Strong performance, clearly above average. One to two per committee.</li>
              <li style={s.li}><strong>Honourable Mention:</strong> Good performance with notable contributions. Two to four per committee.</li>
              <li style={s.li}><strong>Verbal Commendation:</strong> Recognised for specific contributions: a particularly good speech, strong position paper, or key amendment.</li>
              <li style={s.li}><strong>Best Position Paper:</strong> Some conferences award separately for the pre-submitted position paper.</li>
            </ul>

            <h2 style={s.h2}>What Chairs Actually Look For</h2>
            <p style={s.p}>Most experienced chairs assess delegates across five dimensions:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Knowledge:</strong> Does the delegate know their country's position? Can they speak to specific resolutions, treaties, or statistics?</li>
              <li style={s.li}><strong>Diplomacy:</strong> Can the delegate build relationships with opposing blocs? Do they treat all delegations respectfully, not just their allies?</li>
              <li style={s.li}><strong>Procedure:</strong> Does the delegate use rules of procedure correctly? Do they know when to raise a point of order and when not to?</li>
              <li style={s.li}><strong>Contribution:</strong> Did this delegate actually move the committee forward? Are their operative clauses in the final resolution? Did they lead bloc mergers?</li>
              <li style={s.li}><strong>Consistency:</strong> Strong performance across the whole conference, not just one memorable speech on the first day.</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>The most common mistake: delegates optimise for speech count rather than speech quality and substantive contribution. Ten average speeches rarely beat three exceptional ones combined with active drafting leadership.</p></div>

            <h2 style={s.h2}>The Position Paper Factor</h2>
            <p style={s.p}>Many conferences weight position papers as a significant component of the overall award. A strong position paper signals preparation and gives chairs a baseline to evaluate whether a delegate followed through on their stated positions during committee. Submit your position paper on time, make it substantive, and cite your sources.</p>

            <h2 style={s.h2}>What Disqualifies Delegates from Awards</h2>
            <p style={s.p}>Chairs also notice what delegates do wrong. Common award-killers:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Rules violations.</strong> Repeated incorrect use of procedure, especially after being corrected.</li>
              <li style={s.li}><strong>Disrespectful behaviour.</strong> Interrupting other delegates, dismissing smaller countries, or being rude during unmoderated caucuses.</li>
              <li style={s.li}><strong>Speaking without substance.</strong> Frequent speeches with no specific positions, no data, and no proposals.</li>
              <li style={s.li}><strong>Ignoring your country's actual position.</strong> Chairs notice when delegates advocate for positions directly contrary to their country's UN voting record.</li>
              <li style={s.li}><strong>No bloc engagement.</strong> Delegates who only advocate for their own position and never attempt coalition-building rarely produce committee output.</li>
            </ul>

            <h2 style={s.h2}>A Note on Fairness</h2>
            <p style={s.p}>Not every conference awards fairly. Some chair teams are inconsistent. Some conferences heavily weight country prestige. Do not interpret a missed award as a definitive judgment of your performance. Ask your faculty advisor or the dais for feedback and use it to improve. The delegates who improve most consistently between conferences are the ones who become the strongest.</p>

            <h2 style={s.h2}>Awards as a Chair</h2>
            <p style={s.p}>For chairs: track delegates throughout the conference, not just at the end. Note specific moments: a standout speech, a key amendment proposal, a bloc merger they brokered. When you sit down to make award decisions, concrete examples beat vague impressions every time. Gavelling's delegate stats panel tracks speaking time and participation metrics that can support your qualitative notes.</p>

            <RelatedGuides currentSlug="mun-awards-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Chairs: track delegate participation and speaking stats with Gavelling throughout your session.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
