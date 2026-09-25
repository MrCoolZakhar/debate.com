import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'Right of Reply in MUN: When and How to Use It',
  description:
    'A complete guide to the right of reply in Model UN: what qualifies, how to request it, chair discretion, and how to use it effectively without abusing it.',
  path: '/blog/mun-right-of-reply',
  ogDescription:
    'Everything you need to know about the right of reply in MUN.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Right of Reply in MUN: When and How to Use It',
  description: 'Complete guide to right of reply in MUN.',
  url: 'https://gavelling.com/blog/mun-right-of-reply',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-right-of-reply' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Right of Reply', item: 'https://gavelling.com/blog/mun-right-of-reply' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-right-of-reply"
        pitch="Gavelling lets chairs grant a timed right of reply instantly, without touching the speakers list."
      >

        <p>The right of reply is one of the most misunderstood procedures in Model UN. Delegates invoke it too freely, chairs grant it too rarely, and neither side is quite sure of the rules. This guide clarifies exactly what the right of reply is, when it applies, and how to use it effectively.</p>

        <H2>What Is the Right of Reply?</H2>
        <p>The right of reply is a procedural mechanism that allows a delegation to briefly respond when its country has been directly attacked or misrepresented in another delegate&apos;s speech. It is a targeted rebuttal opportunity, not a second speech slot, and not a general chance to respond to arguments you disagree with.</p>
        <p>In real UN practice, the right of reply is invoked when a delegation believes its honour, name, or the integrity of its government has been impugned. MUN simulations follow the same principle, though application varies by conference. Our <Link href="/blog/una-usa-rules-of-procedure">UNA-USA rules of procedure</Link> guide and our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> show how rulesets differ.</p>

        <H2>What Qualifies for a Right of Reply?</H2>
        <p>This is where most confusion arises. A right of reply is appropriate when:</p>
        <ul>
          <li>Another delegate has made a factually false statement about your country</li>
          <li>Your country has been directly named and mischaracterised</li>
          <li>A statement constitutes a personal or national insult against your delegation</li>
        </ul>
        <p>A right of reply is <strong>not</strong> appropriate when:</p>
        <ul>
          <li>You simply disagree with another delegate&apos;s argument</li>
          <li>Another delegate criticised your country&apos;s policy (legitimate debate)</li>
          <li>You want an extra speaking slot but missed the <Link href="/blog/general-speakers-list-guide">GSL</Link></li>
        </ul>
        <Callout>Chair test: ask yourself whether a reasonable person would consider the original statement a misrepresentation or insult, or simply a policy disagreement. If it is the latter, deny the right of reply.</Callout>

        <H2>How to Request a Right of Reply</H2>
        <p>After the offending speech ends and before the next speaker begins, raise your placard and state: &quot;Point of personal privilege, the delegation of [Country] requests the right of reply.&quot; Some conferences require a written request submitted to the dais. Our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers the point of personal privilege itself. The chair will rule on whether to grant it.</p>
        <p>The right of reply is delivered after the conclusion of the current speakers list segment or at the chair&apos;s discretion, never interrupting a live speaker.</p>

        <H2>How to Use a Right of Reply Effectively</H2>
        <p>The right of reply is brief: typically thirty seconds. Use it surgically:</p>
        <ul>
          <li>Identify the specific false claim or insult</li>
          <li>State the correct fact or clarification</li>
          <li>Do not expand into general policy argument</li>
        </ul>
        <ChairScript>&quot;The delegation of Canada invokes the right of reply to correct a factual error. The previous speaker claimed Canada voted against Resolution 73/254. Canada&apos;s voting record shows we voted In Favour. The delegation requests that the record reflect this correction. Thank you.&quot;</ChairScript>

        <H2>Chair&apos;s Discretion</H2>
        <p>Chairs have significant discretion over whether to grant a right of reply and how much time to allow. In Gavelling, chairs grant a right of reply as a separate timed reply, usually shorter than a standard speech, which never touches the speakers list. This keeps the process clean without derailing the committee&apos;s rhythm.</p>
        <p>Good chairs use the right of reply sparingly. When it is granted for genuinely inappropriate statements, it carries weight. When it is granted for every policy disagreement, it becomes noise.</p>

        <H2>The Reply to the Reply</H2>
        <p>Most conferences do not allow a reply to the right of reply. The original speaker cannot respond to the rebuttal. This prevents infinite back-and-forth. The chair should state this clearly if delegates attempt to chain replies.</p>

        <H2>Right of Reply in the Real UN</H2>
        <p>In real UN sessions, rights of reply can become highly charged diplomatic moments. A real-world example: when a UN General Assembly speech makes a claim about another country&apos;s human rights record, the named country&apos;s delegation typically invokes the right of reply within minutes, delivers a sharp rebuttal, and the original delegation may or may not respond. These exchanges are part of the public diplomatic record.</p>
      </ArticleLayout>
    </>
  );
}
