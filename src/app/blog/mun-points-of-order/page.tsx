import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Points of Order in MUN — When to Use Them and When Not To',
  description: 'A complete guide to points of order in Model UN: what qualifies, how to raise them correctly, how chairs should rule, and the difference between a point of order and a point of information.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-points-of-order' },
  openGraph: {
    title: 'Points of Order in MUN — When to Use Them and When Not To',
    description: 'Master points of order in MUN — for delegates and chairs.',
    url: 'https://gavelling.com/blog/mun-points-of-order',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Points of Order in MUN — When to Use Them and When Not To',
  description: 'Complete guide to points of order in MUN.',
  url: 'https://gavelling.com/blog/mun-points-of-order',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-points-of-order' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Points of Order', item: 'https://gavelling.com/blog/mun-points-of-order' },
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
  script: { backgroundColor: '#1B3828', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  scriptText: { fontSize: '14px', color: '#EDE7D8', fontStyle: 'italic', margin: 0, lineHeight: 1.7 },
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
          <h1 style={s.h1}>Points of Order in MUN — When to Use Them and When Not To</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 8 min read</p>
          <article style={s.article}>

            <p style={s.p}>The point of order is one of the most misused procedures in Model UN. Raised correctly, it demonstrates procedural mastery and earns chairs' respect. Raised incorrectly — or too frequently — it signals inexperience, irritates the room, and wastes everyone's time. This guide clarifies exactly what a point of order is, when it applies, and how both delegates and chairs should handle it.</p>

            <h2 style={s.h2}>What Is a Point of Order?</h2>
            <p style={s.p}>A point of order is raised when a delegate believes the chair has made a procedural error — specifically, that the rules of procedure are being violated. It is the only point that can interrupt a speaker mid-speech (at most conferences). This exceptional power comes with a correspondingly high bar: it must address a genuine procedural violation, not a substantive disagreement.</p>
            <div style={s.callout}><p style={s.calloutText}>The test is simple: does the chair's action or ruling violate a specific rule in the rules of procedure document? If yes, a point of order is appropriate. If you simply disagree with the chair's judgement call, it is not.</p></div>

            <h2 style={s.h2}>Valid Reasons to Raise a Point of Order</h2>
            <ul style={s.ul}>
              <li style={s.li}>The chair has called the wrong country from the speakers list (factual error)</li>
              <li style={s.li}>The chair has allowed a motion that is out of order under the rules (e.g., a motion that requires a second has not received one)</li>
              <li style={s.li}>The chair has stated a vote threshold incorrectly</li>
              <li style={s.li}>The chair has allowed a speaker to run significantly over time without intervention</li>
              <li style={s.li}>The committee is conducting business without quorum</li>
            </ul>

            <h2 style={s.h2}>Invalid Reasons to Raise a Point of Order</h2>
            <ul style={s.ul}>
              <li style={s.li}>You disagree with the chair's ruling on a matter of judgement</li>
              <li style={s.li}>You want to make a speech but are not on the speakers list</li>
              <li style={s.li}>Another delegate said something factually incorrect (this is a point of information, not a point of order)</li>
              <li style={s.li}>The room is uncomfortable or you cannot hear (this is a point of personal privilege)</li>
              <li style={s.li}>You want to draw attention to your delegation</li>
            </ul>

            <h2 style={s.h2}>How to Raise a Point of Order Correctly</h2>
            <p style={s.p}>Raise your placard and clearly state: "Point of order." The chair should acknowledge you and yield the floor. State your point concisely:</p>
            <div style={s.script}><p style={s.scriptText}>"The delegation of Canada rises on a point of order. The chair has allowed the delegate of France to speak for a third consecutive time on the caucus speakers list without the intervening speakers required under Rule 14 of this conference's procedure."</p></div>
            <p style={s.p}>State the specific rule being violated if you know it. A point of order that cites a specific rule is significantly more credible than a vague objection.</p>

            <h2 style={s.h2}>How Chairs Should Rule on Points of Order</h2>
            <p style={s.p}>When a point of order is raised, the chair must rule on it immediately — there is no deliberation, no putting it to a committee vote. The chair states:</p>
            <div style={s.script}><p style={s.scriptText}>"The chair rules this point of order well-taken. [Corrective action stated.] The committee will continue."</p></div>
            <p style={s.p}>Or:</p>
            <div style={s.script}><p style={s.scriptText}>"The chair rules this point of order not well-taken. [Brief reason if appropriate.] The committee will continue."</p></div>
            <p style={s.p}>New chairs often feel pressure to accept every point of order to avoid conflict. Do not. If the point does not identify a genuine procedural violation, rule it not well-taken firmly but politely. Accepting spurious points of order encourages more of them.</p>

            <h2 style={s.h2}>Appealing a Chair's Ruling</h2>
            <p style={s.p}>Most rules of procedure allow a delegation to appeal the chair's ruling on a point of order. The appeal is put to a committee vote — if a majority votes to overturn the chair, the ruling is reversed. This is a nuclear option used rarely in practice. Chairs who are consistently overturned on appeals have a credibility problem; delegates who appeal frivolously are burning political capital they need for resolution votes.</p>

            <h2 style={s.h2}>Point of Order vs. Other Points</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Point of Order:</strong> Procedural violation by the chair. Can interrupt a speaker. Chair must rule immediately.</li>
              <li style={s.li}><strong>Point of Personal Privilege:</strong> Delegate's ability to participate is impaired (cannot hear, room too cold). Cannot interrupt a speaker (usually). Chair addresses the issue.</li>
              <li style={s.li}><strong>Point of Information to the Chair:</strong> A question about procedure directed to the chair. Cannot interrupt a speaker. Chair answers or defers.</li>
              <li style={s.li}><strong>Point of Information to the Delegate:</strong> A question directed to the delegate currently speaking, subject to their acceptance. Must be brief.</li>
            </ul>

            <h2 style={s.h2}>The Credibility Cost</h2>
            <p style={s.p}>Every point of order you raise is a signal to the chair and to the committee. Raise one legitimate point of order and your procedural knowledge is respected. Raise three spurious ones in a single session and you become the delegate who cried wolf — future valid points are greeted with skepticism. Use this tool deliberately, not reflexively.</p>

            <RelatedGuides currentSlug="mun-points-of-order" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling keeps your committee running on procedure — timers, speakers lists, and motions all enforced automatically.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
