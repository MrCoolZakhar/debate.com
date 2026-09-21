import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Voting Procedures Explained: In Favour, Against, Abstain',
  description:
    'A complete guide to Model UN voting procedures: simple majority, supermajority, roll call votes, placard votes, abstentions, and voting on resolutions.',
  path: '/blog/mun-voting-procedures',
  ogDescription:
    'Everything you need to know about voting in Model UN committees.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Voting Procedures Explained: In Favour, Against, Abstain',
  description: 'Complete guide to MUN voting procedures.',
  url: 'https://gavelling.com/blog/mun-voting-procedures',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-voting-procedures' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Voting Procedures', item: 'https://gavelling.com/blog/mun-voting-procedures' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-voting-procedures"
        pitch="Run roll call votes and track results with Gavelling's built-in voting screen."
      >

        <p>Voting is the moment everything in a Model UN committee builds toward. Hours of debate, bloc-building, and resolution drafting all come down to a few minutes at the voting rostrum. Understanding exactly how MUN voting works, what counts, what does not, and what your options are, is essential for both delegates and chairs. The <Link href="/blog/mun-glossary">MUN glossary</Link> defines the terms used here.</p>

        <H2>Types of Votes in MUN</H2>
        <p>Most MUN committees use two main voting mechanisms: placard votes (show of placards) for procedural motions, and roll call votes for substantive matters like resolutions. Some conferences use electronic voting systems or a standing vote for certain matters. Regardless of format, the principle is the same: each present-and-voting delegation casts one vote.</p>

        <H3>Placard Vote</H3>
        <p>The simplest form. The chair asks delegates to raise their placards in favour, against, and those abstaining. The chair (or a counter) tallies the results. Used primarily for procedural motions: caucus proposals, adjournment of the speakers list, suspension of debate.</p>

        <H3>Roll Call Vote</H3>
        <p>Used for resolutions and other substantive matters. Each delegation is called in alphabetical order and votes aloud: &quot;In Favour,&quot; &quot;Against,&quot; or &quot;Abstain.&quot; Delegates may also pass (defer) and vote at the end. Roll call votes create a permanent record of each country&apos;s position, which is why they matter diplomatically and for awards consideration.</p>

        <H2>Understanding the Threshold</H2>
        <p>Whether a resolution passes depends on the voting threshold set by your <Link href="/blog/mun-rules-of-procedure">rules of procedure</Link>:</p>
        <ul>
          <li><strong>Simple majority (50% + 1):</strong> The most common threshold for General Assembly-style committees. More In Favour votes than Against votes, among those present and voting (abstentions do not count).</li>
          <li><strong>Supermajority (two-thirds):</strong> Required for important questions in the GA, and often used for Security Council simulations. Two-thirds of present-and-voting delegations must vote In Favour.</li>
          <li><strong>Consensus:</strong> No delegation votes Against. Abstentions are permitted. Common in specialised agencies and some advanced conferences.</li>
        </ul>
        <Callout>Key rule: abstentions are not counted as votes for or against when calculating majority. A resolution with 10 In Favour, 8 Against, and 15 Abstain passes under simple majority rules.</Callout>

        <H2>Present vs. Present and Voting</H2>
        <p>During roll call at the start of a session, delegates can mark themselves as &quot;Present&quot; or &quot;Present and Voting.&quot; The distinction matters for voting:</p>
        <ul>
          <li><strong>Present:</strong> The delegate may abstain on substantive votes.</li>
          <li><strong>Present and Voting:</strong> The delegate must vote In Favour or Against on substantive matters; they cannot abstain. This is a stronger diplomatic signal used by states that want to show they are fully engaged.</li>
        </ul>

        <H2>Rights of Explanation</H2>
        <p>Before voting begins on a resolution, delegates may request the right to explain their vote. This is a brief statement (typically thirty to sixty seconds) delivered before the delegate casts their vote. It is used to signal nuance: &quot;Brazil votes In Favour but wishes to note its reservations regarding operative clause 4.&quot;</p>
        <p>Rights of explanation come after all general debate has closed. The chair calls for them before opening the voting procedure.</p>

        <H2>Voting on Amendments</H2>
        <p>If amendments have been submitted to a draft resolution, they are voted on first, in reverse order of submission (most recently submitted first). If an amendment passes, the resolution text is updated before the final vote. If the amendment fails, the original text stands.</p>
        <p><Link href="/blog/mun-amendment-guide">Friendly amendments</Link> (agreed to by the main sponsor) do not require a separate vote. They are incorporated into the draft before voting begins.</p>
        <p>Amendment handling varies by style. Our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> and our <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure</Link> guide cover the differences.</p>

        <H2>Security Council Veto</H2>
        <p>Security Council simulations follow different rules. The P5 (US, UK, France, Russia, China) hold veto power: any single P5 member voting Against defeats a resolution, regardless of the total vote count. Abstentions by P5 members do not constitute a veto. This creates fundamentally different bloc dynamics compared to GA committees.</p>

        <H2>Chair&apos;s Role During Voting</H2>
        <p>The chair must announce the voting procedure clearly before it begins, manage any rights of explanation, call the roll in order, announce the final tally, and declare the result. The declaration is formal:</p>
        <p>&quot;With X votes in favour, Y against, and Z abstentions, Resolution [number] is adopted / fails to pass.&quot;</p>
        <p>Software like Gavelling handles roll call voting with an interactive per-delegate voting interface, tallies the result automatically, and supports custom thresholds, including veto mode for Security Council simulations.</p>
      </ArticleLayout>
    </>
  );
}
