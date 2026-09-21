import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'Points of Order in MUN: When to Use Them and When Not To',
  description:
    'A complete guide to points of order in Model UN: what qualifies, how to raise them correctly, how chairs should rule, and the difference between a point of order and a point of information.',
  path: '/blog/mun-points-of-order',
  ogDescription:
    'Master points of order in MUN, for delegates and chairs.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Points of Order in MUN: When to Use Them and When Not To',
  description: 'Complete guide to points of order in MUN.',
  url: 'https://gavelling.com/blog/mun-points-of-order',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
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

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-points-of-order"
        pitch="Gavelling keeps your committee running on procedure: timers, speakers lists, and motions all enforced automatically."
      >

        <p>The point of order is one of the most misused procedures in Model UN. Raised correctly, it demonstrates procedural mastery and earns chairs&apos; respect. Raised incorrectly, or too frequently, it signals inexperience, irritates the room, and wastes everyone&apos;s time. This guide clarifies exactly what a point of order is, when it applies, and how both delegates and chairs should handle it. For every other point, see our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link>.</p>

        <H2>What Is a Point of Order?</H2>
        <p>A point of order is raised when a delegate believes the chair has made a procedural error: specifically, that the rules of procedure are being violated. It is the only point that can interrupt a speaker mid-speech (at most conferences). Our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> shows where the rules differ. This exceptional power comes with a correspondingly high bar: it must address a genuine procedural violation, not a substantive disagreement.</p>
        <Callout>The test is simple: does the chair&apos;s action or ruling violate a specific rule in the rules of procedure document? If yes, a point of order is appropriate. If you simply disagree with the chair&apos;s judgement call, it is not.</Callout>

        <H2>Valid Reasons to Raise a Point of Order</H2>
        <ul>
          <li>The chair has called the wrong country from the speakers list (factual error)</li>
          <li>The chair has allowed a motion that is out of order under the rules (e.g., a motion that requires a second has not received one)</li>
          <li>The chair has stated a vote threshold incorrectly</li>
          <li>The chair has allowed a speaker to run significantly over time without intervention</li>
          <li>The committee is conducting business without quorum</li>
        </ul>

        <H2>Invalid Reasons to Raise a Point of Order</H2>
        <ul>
          <li>You disagree with the chair&apos;s ruling on a matter of judgement</li>
          <li>You want to make a speech but are not on the speakers list</li>
          <li>Another delegate said something factually incorrect (this is a point of information, not a point of order)</li>
          <li>The room is uncomfortable or you cannot hear (this is a point of personal privilege)</li>
          <li>You want to draw attention to your delegation</li>
        </ul>

        <H2>How to Raise a Point of Order Correctly</H2>
        <p>Raise your placard and clearly state: &quot;Point of order.&quot; The chair should acknowledge you and yield the floor. State your point concisely:</p>
        <ChairScript>&quot;The delegation of Canada rises on a point of order. The chair has allowed the delegate of France to speak for a third consecutive time on the caucus speakers list without the intervening speakers required under Rule 14 of this conference&apos;s procedure.&quot;</ChairScript>
        <p>State the specific rule being violated if you know it. A point of order that cites a specific rule is significantly more credible than a vague objection. Rule numbers come from your conference handbook, and our <Link href="/blog/una-usa-rules-of-procedure">UNA-USA</Link> and <Link href="/blog/thimun-rules-of-procedure">THIMUN</Link> guides cover the two common rulesets.</p>

        <H2>How Chairs Should Rule on Points of Order</H2>
        <p>When a point of order is raised, the chair must rule on it immediately. There is no deliberation, no putting it to a committee vote. The chair states:</p>
        <ChairScript>&quot;The chair rules this point of order well-taken. [Corrective action stated.] The committee will continue.&quot;</ChairScript>
        <p>Or:</p>
        <ChairScript>&quot;The chair rules this point of order not well-taken. [Brief reason if appropriate.] The committee will continue.&quot;</ChairScript>
        <p>New chairs often feel pressure to accept every point of order to avoid conflict. Do not. If the point does not identify a genuine procedural violation, rule it not well-taken firmly but politely. Accepting spurious points of order encourages more of them.</p>

        <H2>Appealing a Chair&apos;s Ruling</H2>
        <p>Most rules of procedure allow a delegation to appeal the chair&apos;s ruling on a point of order. The appeal is put to a committee vote: if a majority votes to overturn the chair, the ruling is reversed. This is a nuclear option used rarely in practice. Chairs who are consistently overturned on appeals have a credibility problem; delegates who appeal frivolously are burning political capital they need for resolution votes.</p>

        <H2>Point of Order vs. Other Points</H2>
        <ul>
          <li><strong>Point of Order:</strong> Procedural violation by the chair. Can interrupt a speaker. Chair must rule immediately.</li>
          <li><strong>Point of Personal Privilege:</strong> Delegate&apos;s ability to participate is impaired (cannot hear, room too cold). Cannot interrupt a speaker (usually). Chair addresses the issue.</li>
          <li><strong>Point of Information to the Chair:</strong> A question about procedure directed to the chair. Cannot interrupt a speaker. Chair answers or defers.</li>
          <li><strong>Point of Information to the Delegate:</strong> A question directed to the delegate currently speaking, subject to their acceptance. Must be brief.</li>
        </ul>

        <H2>The Credibility Cost</H2>
        <p>Every point of order you raise is a signal to the chair and to the committee. Raise one legitimate point of order and your procedural knowledge is respected. Raise three spurious ones in a single session and you become the delegate who cried wolf, and future valid points are greeted with skepticism. Use this tool deliberately, not reflexively.</p>
      </ArticleLayout>
    </>
  );
}
