import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import React from 'react';

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
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
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
  script: { backgroundColor: '#1B3828', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  scriptText: { fontSize: '14px', color: '#EDE7D8', fontStyle: 'italic', margin: 0, lineHeight: 1.7 },
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
          <h1 style={s.h1}>Unmoderated Caucus in MUN: What It Is and How to Use It</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 8 min read</p>
          <article style={s.article}>

            <p style={s.p}>If the moderated caucus is structured debate, the unmoderated caucus is everything else. It is the unofficial heartbeat of Model UN: the twenty minutes where working papers get drafted, blocs form, deals are made, and delegates who have not spoken once during formal debate suddenly become the most influential people in the room.</p>
            <p style={s.p}>For new delegates and first-time chairs alike, the unmoderated caucus can feel chaotic. This guide explains exactly what it is, how to make the most of it, and how chairs should manage it.</p>

            <h2 style={s.h2}>What Is an Unmoderated Caucus?</h2>
            <p style={s.p}>An unmoderated caucus (often called an "unmod") is a recess from formal debate. The committee suspends its rules of procedure for a set period (typically ten to thirty minutes) and delegates are free to leave their seats, form groups, and negotiate informally. No speakers list, no timer per delegate, no points of order. Just conversation.</p>
            <p style={s.p}>The purpose is always the same: to advance work that formal debate cannot accomplish quickly. This almost always means drafting working papers or merging blocs.</p>

            <h2 style={s.h2}>How to Propose an Unmoderated Caucus</h2>
            <p style={s.p}>Any delegate can raise a placard and propose: "I move for an unmoderated caucus of [duration]." Some conferences require a stated purpose; others do not. The motion requires a simple majority to pass. There is no speakers list, no amendment. It either passes or fails.</p>
            <div style={s.callout}><p style={s.calloutText}>Good timing matters. Proposing an unmod immediately after opening speeches, before any working papers exist, signals that you are ready to lead drafting. Proposing one late in the session when resolution text is nearly finalised signals bloc coordination.</p></div>

            <h2 style={s.h2}>What Delegates Should Do During an Unmod</h2>
            <p style={s.p}>The worst thing a delegate can do during an unmoderated caucus is sit at their seat and wait. Here is how experienced delegates use the time:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Find your natural bloc.</strong> Identify delegates with similar positions from their opening speeches and approach them directly.</li>
              <li style={s.li}><strong>Start a working paper.</strong> Even a rough outline (three operative clauses on a shared doc or notepad) gives your bloc something to rally around.</li>
              <li style={s.li}><strong>Approach opposing blocs.</strong> Real diplomacy happens here. You will not move an opposing bloc during formal debate. One short conversation in an unmod can shift the whole dynamic.</li>
              <li style={s.li}><strong>Talk to the chair.</strong> Chairs are accessible during unmods. If you have a procedural question, a complaint about bloc dynamics, or want to flag an issue, this is the moment.</li>
            </ul>

            <h2 style={s.h2}>How Long Should an Unmoderated Caucus Be?</h2>
            <p style={s.p}>Most delegates propose fifteen or twenty minutes. Ten minutes is too short to accomplish anything meaningful. By the time people form groups, five minutes have passed. Thirty minutes is appropriate when you are merging two large working papers. More than thirty minutes usually means the committee has lost focus, and chairs should be cautious about passing such motions.</p>

            <h2 style={s.h2}>Chair's Role During an Unmoderated Caucus</h2>
            <p style={s.p}>You are not on duty in the traditional sense, but you are not idle either. Good chairs use the unmod to:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Circulate the room.</strong> See which blocs are forming, how many working papers are in progress, and whether the committee is on track to produce something by the end of the session.</li>
              <li style={s.li}><strong>Check in with the dais team.</strong> Co-chairs should compare notes, review the pending motions queue, and plan the agenda for when formal debate resumes.</li>
              <li style={s.li}><strong>Keep time.</strong> Give a two-minute warning before the unmod ends. Delegates lose track of time easily.</li>
            </ul>
            <div style={s.script}><p style={s.scriptText}>"Delegates, the unmoderated caucus will conclude in two minutes. Please return to your seats."</p></div>
            <p style={s.p}>When time expires, bring the committee back to order with your gavel and announce: "The unmoderated caucus has concluded. The committee returns to formal debate. The next speaker on the General Speakers List is the delegate of Australia."</p>

            <h2 style={s.h2}>The Difference Between Unmod, Consultation, and Tour de Table</h2>
            <p style={s.p}>Some conferences use "consultation of the whole" as a variant, essentially a named unmod. Tour de Table is different: every delegation speaks in a fixed order, typically alphabetical, for a short fixed time. It is more structured than an unmod but less structured than the GSL. Not all conferences use tour de table; check your rules of procedure.</p>

            <h2 style={s.h2}>Common Mistakes</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Proposing unmods too frequently.</strong> Three unmods in a row without a working paper to show for it reflects poorly on your bloc's productivity.</li>
              <li style={s.li}><strong>Using unmods to avoid speaking.</strong> Shy delegates sometimes prefer the chaos of an unmod to formal debate. Push yourself to use the GSL too.</li>
              <li style={s.li}><strong>Chairs leaving the dais entirely.</strong> Step away briefly, but stay visible and monitor the clock.</li>
            </ul>

            <RelatedGuides currentSlug="unmoderated-caucus-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling tracks caucus timers, the GSL, and motions all in one place.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
