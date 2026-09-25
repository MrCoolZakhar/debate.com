import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, Callout, ChairScript } from '@/components/blog/prose';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'Unmoderated Caucus in MUN: What It Is and How to Use It',
  description:
    'Learn what an unmoderated caucus is in Model UN, how delegates should use the time, and tips for chairs on managing unmod periods effectively.',
  path: '/blog/unmoderated-caucus-guide',
  ogDescription:
    'The complete guide to unmoderated caucuses for MUN chairs and delegates.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Unmoderated Caucus in MUN: What It Is and How to Use It',
  description: 'The complete guide to unmoderated caucuses for MUN chairs and delegates.',
  url: 'https://gavelling.com/blog/unmoderated-caucus-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/unmoderated-caucus-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Unmoderated Caucus Guide', item: 'https://gavelling.com/blog/unmoderated-caucus-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="unmoderated-caucus-guide"
        pitch="Gavelling tracks caucus timers, the GSL, and motions all in one place."
      >

        <p>If the <Link href="/blog/how-to-run-moderated-caucus">moderated caucus</Link> is structured debate, the unmoderated caucus is everything else. It is the unofficial heartbeat of Model UN: the twenty minutes where working papers get drafted, blocs form, deals are made, and delegates who have not spoken once during formal debate suddenly become the most influential people in the room.</p>
        <p>For new delegates and first-time chairs alike, the unmoderated caucus can feel chaotic. This guide explains exactly what it is, how to make the most of it, and how chairs should manage it.</p>

        <H2>What Is an Unmoderated Caucus?</H2>
        <p>An unmoderated caucus (often called an &quot;unmod&quot;) is a recess from formal debate. The committee suspends its rules of procedure for a set period (typically ten to thirty minutes) and delegates are free to leave their seats, form groups, and negotiate informally. No speakers list, no timer per delegate, no points of order. Just conversation.</p>
        <p>The purpose is always the same: to advance work that formal debate cannot accomplish quickly. This almost always means drafting working papers or merging blocs.</p>

        <PhotoFigure id="un-security-council-before-debate" caption="Diplomats talk on their feet before a Security Council meeting, the real version of an unmoderated caucus." />


        <H2>How to Propose an Unmoderated Caucus</H2>
        <p>Any delegate can raise a placard and propose: &quot;I move for an unmoderated caucus of [duration].&quot; Some conferences require a stated purpose; others do not. Our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> shows how caucus rules differ between rulesets. The motion requires a simple majority to pass. There is no speakers list, no amendment. It either passes or fails.</p>
        <Callout>Good timing matters. Proposing an unmod immediately after opening speeches, before any working papers exist, signals that you are ready to lead drafting. Proposing one late in the session when resolution text is nearly finalised signals bloc coordination.</Callout>

        <H2>What Delegates Should Do During an Unmod</H2>
        <p>The worst thing a delegate can do during an unmoderated caucus is sit at their seat and wait. Here is how experienced delegates use the time:</p>
        <ul>
          <li><strong>Find your natural bloc.</strong> Identify delegates with similar positions from their opening speeches and approach them directly.</li>
          <li><strong>Start a working paper.</strong> Even a rough outline (three <Link href="/blog/mun-clause-phrases">operative clauses</Link> on a shared doc or notepad) gives your bloc something to rally around.</li>
          <li><strong>Approach opposing blocs.</strong> Real diplomacy happens here, and our guide to <Link href="/blog/mun-negotiation-tactics">MUN negotiation tactics</Link> covers how to handle it. You will not move an opposing bloc during formal debate. One short conversation in an unmod can shift the whole dynamic.</li>
          <li><strong>Talk to the chair.</strong> Chairs are accessible during unmods. If you have a procedural question or a complaint about bloc dynamics, or you want to flag an issue, this is the moment.</li>
        </ul>

        <H2>How Long Should an Unmoderated Caucus Be?</H2>
        <p>Most delegates propose fifteen or twenty minutes. Ten minutes is too short to accomplish anything meaningful. By the time people form groups, five minutes have passed. Thirty minutes is appropriate when you are merging two large working papers. More than thirty minutes usually means the committee has lost focus, and chairs should be cautious about passing such motions.</p>

        <H2>Chair&apos;s Role During an Unmoderated Caucus</H2>
        <p>You are not on duty in the traditional sense, but you are not idle either. Good chairs use the unmod to:</p>
        <ul>
          <li><strong>Circulate the room.</strong> See which blocs are forming, how many working papers are in progress, and whether the committee is on track to produce something by the end of the session.</li>
          <li><strong>Check in with the dais team.</strong> Co-chairs should compare notes, review the pending motions queue, and plan the agenda for when formal debate resumes.</li>
          <li><strong>Keep time.</strong> Give a two-minute warning before the unmod ends. Delegates lose track of time easily.</li>
        </ul>
        <ChairScript>&quot;Delegates, the unmoderated caucus will conclude in two minutes. Please return to your seats.&quot;</ChairScript>
        <p>When time expires, bring the committee back to order with your gavel and announce: &quot;The unmoderated caucus has concluded. The committee returns to formal debate. The next speaker on the General Speakers List is the delegate of Australia.&quot;</p>

        <H2>The Difference Between Unmod, Consultation, and Tour de Table</H2>
        <p>Some conferences use &quot;consultation of the whole&quot; as a variant, essentially a named unmod. <Link href="/blog/tour-de-table-mun">Tour de Table</Link> is different: every delegation speaks in a fixed order, typically alphabetical, for a short fixed time. It is more structured than an unmod but less structured than the GSL. Not all conferences use tour de table; check your rules of procedure.</p>

        <H2>Common Mistakes</H2>
        <ul>
          <li><strong>Proposing unmods too frequently.</strong> Three unmods in a row without a working paper to show for it reflects poorly on your bloc&apos;s productivity.</li>
          <li><strong>Using unmods to avoid speaking.</strong> Shy delegates sometimes prefer the chaos of an unmod to formal debate. Push yourself to use the GSL too.</li>
          <li><strong>Chairs leaving the dais entirely.</strong> Step away briefly, but stay visible and monitor the clock.</li>
        </ul>
      </ArticleLayout>
    </>
  );
}
