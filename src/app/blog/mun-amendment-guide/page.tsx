import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Amendments Explained: Friendly vs Unfriendly, How to Submit',
  description:
    'Everything about amendments in Model UN: the difference between friendly and unfriendly amendments, how to submit them, voting order, and strategic use.',
  path: '/blog/mun-amendment-guide',
  ogDescription:
    'The complete guide to amendments in MUN committees.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Amendments Explained: Friendly vs Unfriendly, How to Submit',
  description: 'Complete guide to MUN amendments.',
  url: 'https://gavelling.com/blog/mun-amendment-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
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

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-amendment-guide"
        pitch="Manage draft resolutions and amendments in committee with Gavelling's document tracking."
      >

        <p>Amendments are one of the most powerful procedural tools available to delegates once a draft resolution is on the floor. They allow you to strengthen your own resolution, weaken an opponent&apos;s, or force a public vote on a specific clause that puts other delegations in a difficult position. Used strategically, amendments can completely change the outcome of a vote. Our annotated <Link href="/blog/mun-resolution-example">MUN resolution example</Link> walks through three real-style amendments to one draft.</p>

        <H2>What Is an Amendment?</H2>
        <p>An amendment is a formal proposal to change the text of a draft resolution that has already been introduced. Amendments can add new operative clauses, delete existing ones, or modify the wording of specific clauses (our list of <Link href="/blog/mun-clause-phrases">MUN clause phrases</Link> helps here). They are submitted in writing to the dais and voted on before the main resolution vote.</p>

        <H2>Friendly Amendments</H2>
        <p>A friendly amendment is one that all sponsors of the draft resolution agree to accept. Because it has unanimous sponsor approval, it does not need a separate committee vote. It is simply incorporated into the resolution text automatically.</p>
        <p>Friendly amendments are used to:</p>
        <ul>
          <li>Fix errors in the resolution text</li>
          <li>Incorporate language from a delegate whose vote you need</li>
          <li>Strengthen a weak clause after the resolution has been introduced</li>
          <li>Add a signatory nation as a new sponsor in exchange for their support</li>
        </ul>
        <Callout>Strategic use: offer to accept a friendly amendment from a swing-vote delegate in exchange for their In Favour vote. You get their vote; they get their language in the resolution. Both sides win.</Callout>

        <H2>Unfriendly Amendments</H2>
        <p>An unfriendly amendment is one where at least one sponsor objects to the change. It must be put to a committee vote. If the amendment passes, the resolution text is updated. If it fails, the original text stands.</p>
        <p>Unfriendly amendments require a minimum number of sponsors to submit (check your conference&apos;s rules). They are voted on separately, in reverse order of submission, before the main resolution vote.</p>

        <H3>Offensive Use</H3>
        <p>Submit an unfriendly amendment to an opponent&apos;s resolution to force them to vote against something their bloc publicly supports. For example, if the resolution is on refugee protection and you amend it to include binding refugee quotas, you may force nations that oppose binding commitments to vote against it (or, in the Security Council, a permanent member to veto it), publicly exposing their position.</p>

        <H3>Defensive Use</H3>
        <p>If someone submits an unfriendly amendment to your resolution that you find unacceptable, you can lobby against it in debate and ensure your sponsor bloc votes it down. Alternatively, consider withdrawing the clause they are targeting and replacing it with a friendly amendment version that is slightly weaker but still acceptable to you. This takes the vote off the table entirely.</p>

        <H2>Amendment Voting Order</H2>
        <p>Multiple amendments to the same resolution are voted on in reverse chronological order: the most recently submitted amendment is voted on first. This lets the committee consider the latest proposed changes before earlier ones. If you want your amendment to have priority, submit it last.</p>

        <H2>How to Submit an Amendment</H2>
        <p>The exact process varies by conference (our <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure</Link> guide covers one very different approach), but generally:</p>
        <ul>
          <li>Write the amendment clearly: which clause is being changed, and what the new text is (or that it is being deleted)</li>
          <li>Collect the required number of sponsors</li>
          <li>Submit the written amendment to the dais before or during debate on the resolution</li>
          <li>The chair will announce the amendment and schedule debate or a vote</li>
        </ul>

        <H2>Chair&apos;s Role with Amendments</H2>
        <p>Chairs must keep track of all amendments submitted, announce them to the committee, determine whether they are friendly or unfriendly, and ensure they are voted on in the correct order before the main resolution vote, as our guide to <Link href="/blog/mun-voting-procedures">MUN voting procedures</Link> explains. In complex committee sessions with multiple resolutions and amendments, this requires careful organisation. Software like Gavelling helps chairs track documents and their status without losing the thread.</p>
      </ArticleLayout>
    </>
  );
}
