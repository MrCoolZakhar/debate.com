import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, H3, Callout } from '@/components/blog/prose';
import Link from 'next/link';

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
  publisher: JSONLD_PUBLISHER,
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

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-rules-of-procedure"
        pitch="Gavelling enforces rules of procedure automatically: motions, timers, speakers lists, and voting all in one place."
      >

        <p>Rules of procedure (RoP) are the backbone of every Model UN committee. They determine who can speak, in what order, for how long, and what decisions require a majority. Mastering them gives you procedural power: the ability to shape the pace and direction of debate in ways that raw argumentation cannot. This is a complete reference you can return to throughout your MUN career. The details vary by style: our guides to <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure</Link> and <Link href="/blog/una-usa-rules-of-procedure">UNA-USA rules of procedure</Link> cover two common styles, and the <Link href="/blog/mun-glossary">MUN glossary</Link> defines the terms used here.</p>

        <H2>Quorum</H2>
        <p>Quorum is the minimum number of delegates that must be present for a committee to conduct formal business. Most conferences set quorum at a simple majority of enrolled delegations (50% + 1). If quorum is not met, the chair cannot open debate or hold votes. Chairs verify quorum during roll call at the start of each session.</p>

        <PhotoFigure id="mun-model-security-council" caption="A model Security Council in session." />


        <H2>The Speakers List (GSL)</H2>
        <p>The General Speakers List (GSL) is the primary mechanism for formal debate. Delegates add themselves by raising their placard when the chair opens the list. The default speaker time is set by the chair at the beginning of the session and can be changed by motion. The GSL persists through the entire conference unless formally suspended or closed by vote.</p>

        <H2>Points</H2>
        <p>Points are interruptions made by delegates to address procedural issues or seek information. They take priority over motions and can be raised at any time except while another delegate has the floor (with one exception). Our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers each one in more depth.</p>
        <ul>
          <li><strong>Point of Order:</strong> Raised when a delegate believes the chair has made a procedural error. The chair must rule on it immediately. This is the only point that can interrupt a speaker.</li>
          <li><strong>Point of Personal Privilege:</strong> Raised when a delegate&apos;s ability to participate is impaired: they cannot hear, the room is too hot, etc. Cannot interrupt a speaker at most conferences.</li>
          <li><strong>Point of Information to the Chair:</strong> A question directed to the chair about procedure.</li>
          <li><strong>Point of Information to the Delegate:</strong> A question posed to the delegate currently speaking (subject to the speaker&apos;s acceptance).</li>
        </ul>
        <Callout>Point of Order is the most powerful and most abused point. Use it only when you genuinely believe a procedural rule is being violated. Frivolous points of order irritate chairs and weaken your credibility.</Callout>

        <H2>Motions</H2>
        <p>Motions are formal proposals to change the committee&apos;s course of action. They are made from the floor and voted on by the committee.</p>

        <H3>Procedural Motions (simple majority)</H3>
        <ul>
          <li><strong>Motion to Open/Extend the Speakers List:</strong> Adds more time for delegates to sign up.</li>
          <li><strong>Motion to Set/Change Speaker Time:</strong> Changes the default time per GSL speech.</li>
          <li><strong>Motion for a Moderated Caucus:</strong> Structured debate period with a fixed topic, total time, and per-speaker time.</li>
          <li><strong>Motion for an Unmoderated Caucus:</strong> Informal recess from debate.</li>
          <li><strong>Motion to Suspend the Meeting:</strong> Ends the current session; resumes later.</li>
          <li><strong>Motion to Adjourn the Meeting:</strong> Ends all debate permanently on the current topic.</li>
        </ul>

        <H3>Substantive Motions</H3>
        <ul>
          <li><strong>Motion to Introduce a Draft Resolution:</strong> Brings a formally submitted resolution to the floor for debate.</li>
          <li><strong>Motion to Table a Resolution:</strong> Postpones consideration of a draft resolution indefinitely (suspends it).</li>
          <li><strong>Motion to Divide the Question:</strong> Requests that operative clauses be voted on individually rather than as a block.</li>
        </ul>

        <H2>Yields</H2>
        <p>When a delegate finishes their GSL speech before time expires, they may yield remaining time:</p>
        <ul>
          <li><strong>Yield to another delegate:</strong> The remaining time passes to a named delegate. That delegate may not yield further.</li>
          <li><strong>Yield to questions:</strong> Other delegates may ask points of information; the speaker responds within the remaining time.</li>
          <li><strong>Yield to the chair:</strong> The time is forfeited; no further speech or questions.</li>
        </ul>

        <H2>Voting Thresholds</H2>
        <ul>
          <li><strong>Simple majority:</strong> More than half of present-and-voting delegates vote In Favour. Used for procedural motions and most GA resolutions.</li>
          <li><strong>Two-thirds supermajority:</strong> Used for &quot;important questions&quot; in the GA (budget, membership, peace and security). Required by many conferences for all substantive votes.</li>
          <li><strong>Consensus:</strong> No delegation votes Against. Used in some specialised agencies and certain UN bodies.</li>
        </ul>

        <H2>How Rules Differ Across Conferences</H2>
        <p>NMUN uses a parliamentary procedure adapted from actual UN practice, the most faithful simulation available. NAIMUN and HMUN have their own variations. School conferences often adapt rules further for accessibility. Our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> sets the main variations side by side. Always read the rules of procedure document for your specific conference before committee begins. When in doubt, ask the chair.</p>
      </ArticleLayout>
    </>
  );
}
