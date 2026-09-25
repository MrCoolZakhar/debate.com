import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, H3, Callout } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'How to Write a MUN Resolution: Clauses, Format & Examples',
  description:
    'Learn how to write a Model UN resolution from scratch: preambulatory clauses, operative clauses, correct format, sponsor rules and the amendment process.',
  path: '/blog/mun-resolution-writing',
  ogDescription:
    'The complete guide to drafting MUN resolutions that pass.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Resolution: Clauses, Format & Examples',
  description: 'Complete guide to drafting MUN resolutions.',
  url: 'https://gavelling.com/blog/mun-resolution-writing',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-resolution-writing' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Resolution Writing', item: 'https://gavelling.com/blog/mun-resolution-writing' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-resolution-writing"
        pitch="Gavelling lets delegates submit working papers and draft resolutions directly to the chair during committee."
      >

        <p>A Model UN resolution is the formal output of a committee&apos;s work. It is the document that delegates spend hours debating, amending, and eventually voting on. Writing one that is both substantive and passable requires understanding the format, choosing the right language, and building a coalition wide enough to get it across the line. This guide covers everything from your first clause to the final vote. Keep our full list of <Link href="/blog/mun-clause-phrases">MUN clause phrases</Link> open while you draft, and read a complete <Link href="/blog/mun-resolution-example">MUN resolution example</Link> to see the finished format.</p>

        <H2>Working Paper vs. Draft Resolution</H2>
        <p>The terms are often used interchangeably but technically mean different things. A <strong><Link href="/blog/mun-working-paper-guide">working paper</Link></strong> is an informal document used to develop ideas; it does not need to follow strict resolution format and is not voted on directly. A <strong>draft resolution</strong> is a formally formatted document submitted to the committee for debate and a vote. Most conferences require a draft resolution to have a minimum number of sponsors before it can be introduced.</p>

        <PhotoFigure id="un-general-assembly-floor" caption="The UN General Assembly Hall, where the real resolutions are adopted." />


        <H2>Resolution Structure</H2>
        <p>Every MUN resolution has the same structure: a header, preambulatory clauses, and operative clauses.</p>

        <H3>The Header</H3>
        <p>The header identifies the document: Committee name, Topic, Sponsors (countries that wrote it), and Signatories (countries that want it debated but may not support it). The format is:</p>
        <p><em>Committee: General Assembly Third Committee | Topic: Protection of Refugees | Sponsors: Germany, Canada, Kenya | Signatories: Brazil, India, Sweden...</em></p>

        <H3>Preambulatory Clauses</H3>
        <p>Preambulatory clauses come first and provide context and justification. They begin with a participle, usually a present participle, and end with a comma. They explain why the committee is acting, citing previous resolutions, existing international law, or recognising the scale of the problem.</p>
        <p>Common preambulatory phrases:</p>
        <ul>
          <li><em>Recalling:</em> past UN resolutions on this topic</li>
          <li><em>Recognising:</em> the severity or importance of the issue</li>
          <li><em>Noting with concern:</em> a troubling trend or statistic</li>
          <li><em>Affirming:</em> a principle or right already established in international law</li>
          <li><em>Deeply concerned:</em> strong urgency</li>
          <li><em>Welcoming:</em> positive recent developments</li>
        </ul>
        <Callout>Preambulatory clauses are italicised in formal resolution format. They do not create obligations; they only set context. Keep them tight. Three to five is usually enough.</Callout>

        <H3>Operative Clauses</H3>
        <p>Operative clauses are the resolution&apos;s actual content. They begin with a strong verb in the third person and end with a semicolon, except the final one, which ends with a full stop. They are numbered and are what gets debated, amended, and voted on.</p>
        <p>Common operative phrases:</p>
        <ul>
          <li><em>Calls upon:</em> requests but does not require action</li>
          <li><em>Urges:</em> stronger than calls upon</li>
          <li><em>Strongly urges:</em> even stronger</li>
          <li><em>Decides:</em> binding, used when the body has authority to mandate</li>
          <li><em>Requests:</em> asks another body (e.g. the Secretary-General) to take action</li>
          <li><em>Encourages:</em> soft language for sensitive topics</li>
          <li><em>Establishes:</em> creates a new mechanism or body</li>
          <li><em>Recommends:</em> suggests action without requiring it</li>
        </ul>

        <H2>Writing Good Operative Clauses</H2>
        <p>The most common mistake in resolution writing is vagueness. &quot;Encourages member states to cooperate on climate change&quot; is not a clause; it is a platitude. A well-written operative clause specifies who does what, how, by when, and with what resources.</p>
        <p>Compare:</p>
        <ul>
          <li><strong>Weak:</strong> Urges member states to address the refugee crisis;</li>
          <li><strong>Strong:</strong> Urges member states to increase annual refugee resettlement quotas by a minimum of 10% and to report progress to the High Commissioner for Refugees by December 2027;</li>
        </ul>

        <H2>Sub-clauses and Nested Structure</H2>
        <p>Operative clauses can have sub-clauses, labelled (a), (b), (c). Use them when a clause has several component parts. Sub-clauses end with a comma except the last, which ends with the semicolon that closes the parent clause.</p>

        <H2>Getting Your Resolution Passed</H2>
        <p>A brilliantly written resolution that cannot get a majority is useless. Draft with <Link href="/blog/mun-bloc-building">coalition-building</Link> in mind from the start:</p>
        <ul>
          <li>Invite opposing bloc delegates to contribute language on operative clauses where you can find common ground.</li>
          <li>Use &quot;calls upon&quot; and &quot;encourages&quot; for politically sensitive clauses that might lose votes if worded more strongly.</li>
          <li>Be willing to accept <Link href="/blog/mun-amendment-guide">friendly amendments</Link> that broaden support without gutting your resolution&apos;s substance.</li>
        </ul>
      </ArticleLayout>
    </>
  );
}
