import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, Callout } from '@/components/blog/prose';

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

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-awards-guide"
        pitch="Chairs: track delegate participation and speaking stats with Gavelling throughout your session."
      >
        <p>Every MUN delegate wants to know how awards are decided. The honest answer: it varies by conference, by chair, and by committee dynamics. But the factors that consistently produce awards are more predictable than delegates often assume. This guide explains how the award system works and how to perform at the level that earns recognition.</p>

        <H2>The Standard Award Hierarchy</H2>
        <p>Most MUN conferences award in the following tiers. Our guide to <Link href="/blog/mun-award-categories">MUN award categories</Link> covers each one in more depth.</p>
        <ul>
          <li><strong>Best Delegate:</strong> The single highest-performing delegate in the committee. Usually one per committee.</li>
          <li><strong>Outstanding Delegate:</strong> Strong performance, clearly above average. One to two per committee.</li>
          <li><strong>Honourable Mention:</strong> Good performance with notable contributions. Two to four per committee.</li>
          <li><strong>Verbal Commendation:</strong> Recognised for specific contributions: a particularly good speech, strong position paper, or key amendment.</li>
          <li><strong>Best Position Paper:</strong> Some conferences award separately for the pre-submitted position paper.</li>
        </ul>

        <PhotoFigure id="mun-award-plaques" caption="Award certificates and a gavel plaque after a conference." />


        <H2>What Chairs Actually Look For</H2>
        <p>Most experienced chairs assess delegates across five dimensions. Our <Link href="/blog/mun-judging-rubric">MUN judging rubric</Link> sets them out as a full scoring sheet.</p>
        <ul>
          <li><strong>Knowledge:</strong> Does the delegate know their country&apos;s position? Can they speak to specific resolutions, treaties, or statistics?</li>
          <li><strong>Diplomacy:</strong> Can the delegate <Link href="/blog/mun-negotiation-tactics">build relationships with opposing blocs</Link>? Do they treat all delegations respectfully, not just their allies?</li>
          <li><strong>Procedure:</strong> Does the delegate use rules of procedure correctly? Do they know when to raise a point of order and when not to?</li>
          <li><strong>Contribution:</strong> Did this delegate actually move the committee forward? Are their operative clauses in the final resolution? Did they lead bloc mergers?</li>
          <li><strong>Consistency:</strong> Strong performance across the whole conference, not just one memorable speech on the first day.</li>
        </ul>
        <Callout>The most common mistake: delegates optimise for speech count rather than speech quality and substantive contribution. Ten average speeches rarely beat three exceptional ones combined with active drafting leadership.</Callout>

        <H2>The Position Paper Factor</H2>
        <p>Many conferences weight position papers as a significant component of the overall award. A strong position paper signals preparation and gives chairs a baseline to evaluate whether a delegate followed through on their stated positions during committee. Submit your position paper on time, make it substantive, and cite your sources.</p>

        <H2>What Disqualifies Delegates from Awards</H2>
        <p>Chairs also notice what delegates do wrong. Our list of <Link href="/blog/mun-common-mistakes">common MUN mistakes</Link> goes further. Common award-killers:</p>
        <ul>
          <li><strong>Rules violations.</strong> Repeated incorrect use of procedure, especially after being corrected.</li>
          <li><strong>Disrespectful behaviour.</strong> Interrupting other delegates, dismissing smaller countries, or being rude during unmoderated caucuses.</li>
          <li><strong>Speaking without substance.</strong> Frequent speeches with no specific positions, no data, and no proposals.</li>
          <li><strong>Ignoring your country&apos;s actual position.</strong> Chairs notice when delegates advocate for positions directly contrary to their country&apos;s UN voting record.</li>
          <li><strong>No bloc engagement.</strong> Delegates who only advocate for their own position and never attempt coalition-building rarely produce committee output.</li>
        </ul>

        <H2>A Note on Fairness</H2>
        <p>Not every conference awards fairly. Some chair teams are inconsistent. Some conferences heavily weight country prestige. Do not interpret a missed award as a definitive judgment of your performance. Ask your faculty advisor or the dais for feedback and use it to improve. The delegates who improve most consistently between conferences are the ones who become the strongest. When you do win one, here is how to list <Link href="/blog/mun-on-your-cv">MUN on your CV</Link>.</p>

        <H2>Awards as a Chair</H2>
        <p>For chairs: track delegates throughout the conference, not just at the end. Note specific moments: a standout speech, a key amendment proposal, a bloc merger they brokered. When you sit down to make award decisions, concrete examples beat vague impressions every time. Gavelling&apos;s delegate stats panel tracks speaking time and participation metrics that can support your qualitative notes.</p>
      </ArticleLayout>
    </>
  );
}
