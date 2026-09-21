import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Free MUN Tools in 2026: Best Software for Chairs and Delegates',
  description:
    'A detailed comparison of free MUN tools and software in 2026: Gavelling, spreadsheets, timer apps, and what actually works for running a real committee session.',
  path: '/blog/free-mun-tools',
  ogDescription:
    'Find the best free MUN tools for running your committee.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Free MUN Tools in 2026: Best Software for Chairs and Delegates',
  description: 'Comparison of free MUN tools in 2026.',
  url: 'https://gavelling.com/blog/free-mun-tools',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/free-mun-tools' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Free MUN Tools', item: 'https://gavelling.com/blog/free-mun-tools' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="free-mun-tools"
        pitch="Free, browser-based, no setup. Start your MUN committee in minutes."
      >

        <p>Running a Model UN committee used to mean paper lists, a phone timer, and hoping your co-chair was tracking the same numbers. In 2026, there are several software options designed specifically for MUN, and several general-purpose tools that chairs have jury-rigged into committee management systems. Here is an honest breakdown of what works and what does not.</p>

        <H2>What a Good MUN Tool Needs to Do</H2>
        <p>Before comparing tools, it helps to list what a chair actually needs during committee:</p>
        <ul>
          <li><strong>Speakers list management</strong>: adding, removing, reordering delegates on the <Link href="/blog/general-speakers-list-guide">GSL</Link></li>
          <li><strong>Speaker timer</strong>: per-speech countdown with automatic advance to the next speaker</li>
          <li><strong>Roll call</strong>: tracking which delegates are present, present and voting, or absent</li>
          <li><strong>Caucus management</strong>: separate caucus queue, caucus timer, total time tracking</li>
          <li><strong>Motions tracking</strong>: logging pending motions and their disruptiveness order</li>
          <li><strong>Delegate-facing display</strong>: letting delegates see their queue position and the current speaker</li>
          <li><strong>Voting</strong>: recording <Link href="/blog/mun-voting-procedures">roll call votes</Link> with In Favour / Against / Abstain</li>
        </ul>

        <H2>Gavelling (Free)</H2>
        <p>Gavelling is the most complete free MUN committee platform available in 2026. It was built specifically for Model UN chairs and handles the full committee lifecycle: roll call, GSL, moderated and unmoderated caucuses, motions, documents, voting, and delegate-facing views, all in real time via any web browser with no installation required.</p>
        <p>Delegates join via a six-character code and can see their queue position, request to speak, and receive documents from the chair. Multiple co-chairs can manage the same session simultaneously. The chair view runs on any device: tablet, laptop, or phone.</p>
        <Callout>Gavelling is completely free to use. Start a session in under a minute at gavelling.com. No account required.</Callout>

        <H2>Google Sheets (Free, Manual)</H2>
        <p>Many chairs build custom Google Sheets for committee management. The advantage: total flexibility. You can design exactly the layout you want. The disadvantages are significant in practice: no built-in timer, no delegate-facing view, manual data entry during high-stakes moments, and no real-time sync if you have co-chairs on different devices without careful coordination.</p>
        <p>Google Sheets works for prepared chairs with reliable co-chairs. It falls apart in large committees with fast motion turnover or when co-chair coordination breaks down.</p>

        <H2>Phone Timers and Stopwatches</H2>
        <p>Every chair has a phone timer. Most use it as a backup, not a primary tool, because it only tracks one thing at a time. A phone timer cannot simultaneously track speaker time, caucus total time, and per-caucus-speaker time. For simple committees with slow debate, it is sufficient. For anything above twenty delegates or with active caucus cycles, it is a liability.</p>

        <H2>PowerPoint / Keynote Displays</H2>
        <p>Some large conferences use custom PowerPoint presentations displayed on a projector to show the current speaker, queue, and timer. These require someone dedicated to updating slides in real time, effectively a third dais member whose sole job is clicking through slides. Functional at scale, impractical for smaller committees.</p>

        <H2>openMUN and Other Open-Source Tools</H2>
        <p>Several open-source MUN tools exist but most are unmaintained or require technical setup (running a local server, installing dependencies). For a <Link href="/blog/start-mun-club">school MUN club</Link> or an advisor without technical resources, these are not practical options.</p>

        <H2>What We Recommend</H2>
        <p>For the vast majority of conferences (school MUN, regional conferences, even large university conferences), Gavelling covers everything needed without cost, setup, or technical expertise. The only scenario where a custom solution makes sense is a very large conference (300+ delegates) with extremely specific technical requirements and a dedicated IT team.</p>
        <p>For chairs who want to run a tight, professional committee session without spending hours on logistics: start at gavelling.com, create a committee, and share the join code. You will be running roll call in under three minutes.</p>
      </ArticleLayout>
    </>
  );
}
