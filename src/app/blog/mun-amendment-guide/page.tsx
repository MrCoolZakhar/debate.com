import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Amendments Explained: Friendly vs Unfriendly, How to Submit',
  description: 'Everything about amendments in Model UN: the difference between friendly and unfriendly amendments, how to submit them, voting order, and strategic use.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-amendment-guide' },
  openGraph: {
    title: 'MUN Amendments Explained: Friendly vs Unfriendly, How to Submit',
    description: 'The complete guide to amendments in MUN committees.',
    url: 'https://gavelling.com/blog/mun-amendment-guide',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Amendments Explained: Friendly vs Unfriendly, How to Submit',
  description: 'Complete guide to MUN amendments.',
  url: 'https://gavelling.com/blog/mun-amendment-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-amendment-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Amendment Guide', item: 'https://gavelling.com/blog/mun-amendment-guide' },
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
          <h1 style={s.h1}>MUN Amendments Explained: Friendly vs Unfriendly, How to Submit</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 8 min read</p>
          <article style={s.article}>

            <p style={s.p}>Amendments are one of the most powerful procedural tools available to delegates once a draft resolution is on the floor. They allow you to strengthen your own resolution, weaken an opponent's, or force a public vote on a specific clause that puts other delegations in a difficult position. Used strategically, amendments can completely change the outcome of a vote.</p>

            <h2 style={s.h2}>What Is an Amendment?</h2>
            <p style={s.p}>An amendment is a formal proposal to change the text of a draft resolution that has already been introduced. Amendments can add new operative clauses, delete existing ones, or modify the wording of specific clauses. They are submitted in writing to the dais and voted on before the main resolution vote.</p>

            <h2 style={s.h2}>Friendly Amendments</h2>
            <p style={s.p}>A friendly amendment is one that all sponsors of the draft resolution agree to accept. Because it has unanimous sponsor approval, it does not need a separate committee vote. It is simply incorporated into the resolution text automatically.</p>
            <p style={s.p}>Friendly amendments are used to:</p>
            <ul style={s.ul}>
              <li style={s.li}>Fix errors in the resolution text</li>
              <li style={s.li}>Incorporate language from a delegate whose vote you need</li>
              <li style={s.li}>Strengthen a weak clause after the resolution has been introduced</li>
              <li style={s.li}>Add a signatory nation as a new sponsor in exchange for their support</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>Strategic use: offer to accept a friendly amendment from a swing vote delegate in exchange for their In Favour vote. You get their vote; they get their language in the resolution. Both sides win.</p></div>

            <h2 style={s.h2}>Unfriendly Amendments</h2>
            <p style={s.p}>An unfriendly amendment is one where at least one sponsor objects to the change. It must be put to a committee vote. If the amendment passes, the resolution text is updated. If it fails, the original text stands.</p>
            <p style={s.p}>Unfriendly amendments require a minimum number of sponsors to submit (check your conference's rules). They are voted on separately, in reverse order of submission, before the main resolution vote.</p>

            <h3 style={s.h3}>Offensive Use</h3>
            <p style={s.p}>Submit an unfriendly amendment to an opponent's resolution to force them to vote against something their bloc publicly supports. For example, if the resolution is on refugee protection and you amend it to include binding refugee quotas, you may force a veto from nations that oppose binding commitments, publicly exposing their position.</p>

            <h3 style={s.h3}>Defensive Use</h3>
            <p style={s.p}>If someone submits an unfriendly amendment to your resolution that you find unacceptable, you can lobby against it in debate and ensure your sponsor bloc votes it down. Alternatively, consider withdrawing the clause they are targeting and replacing it with a friendly amendment version that is slightly weaker but still acceptable to you. This takes the vote off the table entirely.</p>

            <h2 style={s.h2}>Amendment Voting Order</h2>
            <p style={s.p}>Multiple amendments to the same resolution are voted on in reverse chronological order: the most recently submitted amendment is voted on first. This allows the committee to consider the most recent proposed changes before those that came before. If you want your amendment to have priority, submit it last.</p>

            <h2 style={s.h2}>How to Submit an Amendment</h2>
            <p style={s.p}>The exact process varies by conference, but generally:</p>
            <ul style={s.ul}>
              <li style={s.li}>Write the amendment clearly: which clause is being changed, and what the new text is (or that it is being deleted)</li>
              <li style={s.li}>Collect the required number of sponsors</li>
              <li style={s.li}>Submit the written amendment to the dais before or during debate on the resolution</li>
              <li style={s.li}>The chair will announce the amendment and schedule debate or a vote</li>
            </ul>

            <h2 style={s.h2}>Chair's Role with Amendments</h2>
            <p style={s.p}>Chairs must keep track of all amendments submitted, announce them to the committee, determine whether they are friendly or unfriendly, and ensure they are voted on in the correct order before the main resolution vote. In complex committee sessions with multiple resolutions and amendments, this requires careful organisation. Software like Gavelling helps chairs track documents and their status without losing the thread.</p>

            <RelatedGuides currentSlug="mun-amendment-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Manage draft resolutions and amendments in committee with Gavelling's document tracking.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
