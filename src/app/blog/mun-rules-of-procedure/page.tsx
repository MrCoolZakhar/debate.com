import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import React from 'react';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Rules of Procedure: Complete Reference Guide',
  description:
    'A comprehensive reference for Model UN rules of procedure: points, motions, yields, quorum, voting thresholds, and how rules differ across major conferences.',
  path: '/blog/mun-rules-of-procedure',
  ogDescription:
    'Everything you need to know about MUN rules of procedure.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Rules of Procedure: Complete Reference Guide',
  description: 'Comprehensive reference for MUN rules of procedure.',
  url: 'https://gavelling.com/blog/mun-rules-of-procedure',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-rules-of-procedure' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Rules of Procedure', item: 'https://gavelling.com/blog/mun-rules-of-procedure' },
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
          <h1 style={s.h1}>MUN Rules of Procedure: Complete Reference Guide</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 13 min read</p>
          <article style={s.article}>

            <p style={s.p}>Rules of procedure (RoP) are the backbone of every Model UN committee. They determine who can speak, in what order, for how long, and what decisions require a majority. Mastering them gives you procedural power: the ability to shape the pace and direction of debate in ways that raw argumentation cannot. This is a complete reference you can return to throughout your MUN career.</p>

            <h2 style={s.h2}>Quorum</h2>
            <p style={s.p}>Quorum is the minimum number of delegates that must be present for a committee to conduct formal business. Most conferences set quorum at a simple majority of enrolled delegations (50% + 1). If quorum is not met, the chair cannot open debate or hold votes. Chairs verify quorum during roll call at the start of each session.</p>

            <h2 style={s.h2}>The Speakers List (GSL)</h2>
            <p style={s.p}>The General Speakers List (GSL) is the primary mechanism for formal debate. Delegates add themselves by raising their placard when the chair opens the list. The default speaker time is set by the chair at the beginning of the session and can be changed by motion. The GSL persists through the entire conference unless formally suspended or closed by vote.</p>

            <h2 style={s.h2}>Points</h2>
            <p style={s.p}>Points are interruptions made by delegates to address procedural issues or seek information. They take priority over motions and can be raised at any time except while another delegate has the floor (with one exception).</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Point of Order:</strong> Raised when a delegate believes the chair has made a procedural error. The chair must rule on it immediately. This is the only point that can interrupt a speaker.</li>
              <li style={s.li}><strong>Point of Personal Privilege:</strong> Raised when a delegate's ability to participate is impaired: they cannot hear, the room is too hot, etc. Cannot interrupt a speaker at most conferences.</li>
              <li style={s.li}><strong>Point of Information to the Chair:</strong> A question directed to the chair about procedure.</li>
              <li style={s.li}><strong>Point of Information to the Delegate:</strong> A question posed to the delegate currently speaking (subject to the speaker's acceptance).</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>Point of Order is the most powerful and most abused point. Use it only when you genuinely believe a procedural rule is being violated. Frivolous points of order irritate chairs and weaken your credibility.</p></div>

            <h2 style={s.h2}>Motions</h2>
            <p style={s.p}>Motions are formal proposals to change the committee's course of action. They are made from the floor and voted on by the committee.</p>

            <h3 style={s.h3}>Procedural Motions (simple majority)</h3>
            <ul style={s.ul}>
              <li style={s.li}><strong>Motion to Open/Extend the Speakers List:</strong> Adds more time for delegates to sign up.</li>
              <li style={s.li}><strong>Motion to Set/Change Speaker Time:</strong> Changes the default time per GSL speech.</li>
              <li style={s.li}><strong>Motion for a Moderated Caucus:</strong> Structured debate period with a fixed topic, total time, and per-speaker time.</li>
              <li style={s.li}><strong>Motion for an Unmoderated Caucus:</strong> Informal recess from debate.</li>
              <li style={s.li}><strong>Motion to Suspend the Meeting:</strong> Ends the current session; resumes later.</li>
              <li style={s.li}><strong>Motion to Adjourn the Meeting:</strong> Ends all debate permanently on the current topic.</li>
            </ul>

            <h3 style={s.h3}>Substantive Motions</h3>
            <ul style={s.ul}>
              <li style={s.li}><strong>Motion to Introduce a Draft Resolution:</strong> Brings a formally submitted resolution to the floor for debate.</li>
              <li style={s.li}><strong>Motion to Table a Resolution:</strong> Postpones consideration of a draft resolution indefinitely (suspends it).</li>
              <li style={s.li}><strong>Motion to Divide the Question:</strong> Requests that operative clauses be voted on individually rather than as a block.</li>
            </ul>

            <h2 style={s.h2}>Yields</h2>
            <p style={s.p}>When a delegate finishes their GSL speech before time expires, they may yield remaining time:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Yield to another delegate:</strong> The remaining time passes to a named delegate. That delegate may not yield further.</li>
              <li style={s.li}><strong>Yield to questions:</strong> Other delegates may ask points of information; the speaker responds within the remaining time.</li>
              <li style={s.li}><strong>Yield to the chair:</strong> The time is forfeited; no further speech or questions.</li>
            </ul>

            <h2 style={s.h2}>Voting Thresholds</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Simple majority:</strong> More than half of present-and-voting delegates vote In Favour. Used for procedural motions and most GA resolutions.</li>
              <li style={s.li}><strong>Two-thirds supermajority:</strong> Used for "important questions" in the GA (budget, membership, peace and security). Required by many conferences for all substantive votes.</li>
              <li style={s.li}><strong>Consensus:</strong> No delegation votes Against. Used in some specialised agencies and certain UN bodies.</li>
            </ul>

            <h2 style={s.h2}>How Rules Differ Across Conferences</h2>
            <p style={s.p}>NMUN uses a parliamentary procedure adapted from actual UN practice, the most faithful simulation available. NAIMUN and HMUN have their own variations. School conferences often adapt rules further for accessibility. Always read the rules of procedure document for your specific conference before committee begins. When in doubt, ask the chair.</p>

            <RelatedGuides currentSlug="mun-rules-of-procedure" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling enforces rules of procedure automatically: motions, timers, speakers lists, and voting all in one place.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
