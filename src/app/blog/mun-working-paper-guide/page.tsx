import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Working Paper Guide: How to Draft, Merge, and Introduce',
  description:
    'How to write and submit a MUN working paper: format, drafting tips, merging blocs, and transitioning from working paper to draft resolution.',
  path: '/blog/mun-working-paper-guide',
  ogDescription:
    'The complete guide to MUN working papers.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Working Paper Guide: How to Draft, Merge, and Introduce',
  description: 'Complete guide to MUN working papers.',
  url: 'https://gavelling.com/blog/mun-working-paper-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-working-paper-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Working Paper Guide', item: 'https://gavelling.com/blog/mun-working-paper-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-working-paper-guide"
        pitch="Gavelling lets delegates submit working papers directly to the chair during committee, no paper required."
      >

        <p>A working paper is the informal predecessor to a draft resolution. It is where the real work of MUN happens: messy, collaborative, and often written in the chaos of an <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus</Link> on someone&apos;s laptop. Knowing how to write one quickly, structure it correctly, and merge it strategically with other blocs is one of the most valuable skills in MUN.</p>

        <H2>Working Paper vs. Draft Resolution</H2>
        <p>The terms are sometimes used interchangeably, but technically they are different stages:</p>
        <ul>
          <li><strong>Working paper:</strong> An informal document used during the drafting phase. Does not need to follow strict resolution format. Not voted on directly. Shared with the committee for feedback and coalition-building.</li>
          <li><strong>Draft resolution:</strong> A formally formatted document submitted to the dais. Must meet the conference&apos;s minimum sponsor and signatory requirements. Can be debated and voted on once introduced. Our <Link href="/blog/mun-resolution-example">MUN resolution example</Link> shows a finished one.</li>
        </ul>
        <p>Many committees skip the working paper stage and go straight to draft resolutions. Others use working papers extensively before formalising. Know which approach your conference expects.</p>

        <H2>When to Start Drafting</H2>
        <p>Start earlier than feels necessary. The bloc that has a working paper to show at the first unmoderated caucus immediately attracts other delegates. A blank Google Doc with three bullet points still outperforms nothing.</p>
        <Callout>Draft in Google Docs or a shared document. Do not draft in a Word file on one person&apos;s laptop. The moment they leave the room, your whole bloc is stalled.</Callout>

        <H2>What to Put in a Working Paper</H2>
        <p>Even an informal working paper should have:</p>
        <ul>
          <li><strong>A header:</strong> committee, topic, list of writing delegates</li>
          <li><strong>Two to four preambulatory ideas:</strong> the context and justification for your proposals</li>
          <li><strong>Four to eight <Link href="/blog/mun-clause-phrases">operative clauses</Link>:</strong> the specific actions you want the committee to take</li>
        </ul>
        <p>At the working paper stage, you do not need to worry about perfect formatting. What matters is that the ideas are clear, the clauses are specific, and the document reflects your bloc&apos;s actual positions.</p>

        <H2>Getting Sponsors and Signatories</H2>
        <p>To convert a working paper into a draft resolution, you need a minimum number of sponsors (countries that helped write it and fully support it) and signatories (countries that want the document debated, but may not support its passage). Check your conference&apos;s requirements, as these vary widely.</p>
        <ul>
          <li><strong>Sponsors</strong> generally cannot vote against their own resolution without withdrawing sponsorship first.</li>
          <li><strong>Signatories</strong> carry no obligation to vote in favour.</li>
          <li>Getting signatures from across blocs signals the resolution has broad support and can sway undecided delegates.</li>
        </ul>

        <H2>Merging Working Papers</H2>
        <p>When two blocs have competing working papers, the chair will often encourage merging rather than allowing both to be introduced. Merging is a <Link href="/blog/mun-negotiation-tactics">negotiation</Link>: each side has clauses they will not give up, and clauses they can compromise on.</p>
        <H3>Merging Strategy</H3>
        <ul>
          <li>Identify your non-negotiable clauses before entering merger talks. Know what you would withdraw sponsorship over.</li>
          <li>Offer to adopt the other bloc&apos;s strongest operative clause wholesale. This often unlocks agreement on three or four other clauses.</li>
          <li>Use &quot;calls upon&quot; instead of &quot;urges&quot; or &quot;decides&quot; on contested clauses. Softer language often breaks deadlocks.</li>
          <li>Agree on who will be listed first as primary sponsor; this is more important to some delegations than specific clauses.</li>
        </ul>

        <H2>Introducing a Draft Resolution</H2>
        <p>Once formatted and signed, the primary sponsor submits the draft resolution to the dais. The chair will schedule introduction: a brief period where the primary sponsor presents the document to the committee. Keep introductions short: two minutes maximum, covering the key operative clauses and the coalition that supports it.</p>
        <p>After introduction, the draft resolution is available for <Link href="/blog/mun-amendment-guide">amendment</Link> and formal debate. The working paper phase is over. You are now in the final push to pass your resolution.</p>
      </ArticleLayout>
    </>
  );
}
