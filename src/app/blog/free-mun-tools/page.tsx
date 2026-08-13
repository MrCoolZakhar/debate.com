import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import React from 'react';

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
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
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
          <h1 style={s.h1}>Free MUN Tools in 2026: Best Software for Chairs and Delegates</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>

            <p style={s.p}>Running a Model UN committee used to mean paper lists, a phone timer, and hoping your co-chair was tracking the same numbers. In 2026, there are several software options designed specifically for MUN, and several general-purpose tools that chairs have jury-rigged into committee management systems. Here is an honest breakdown of what works and what does not.</p>

            <h2 style={s.h2}>What a Good MUN Tool Needs to Do</h2>
            <p style={s.p}>Before comparing tools, it helps to list what a chair actually needs during committee:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Speakers list management</strong>: adding, removing, reordering delegates on the GSL</li>
              <li style={s.li}><strong>Speaker timer</strong>: per-speech countdown with automatic advance to the next speaker</li>
              <li style={s.li}><strong>Roll call</strong>: tracking which delegates are present, present and voting, or absent</li>
              <li style={s.li}><strong>Caucus management</strong>: separate caucus queue, caucus timer, total time tracking</li>
              <li style={s.li}><strong>Motions tracking</strong>: logging pending motions and their disruptiveness order</li>
              <li style={s.li}><strong>Delegate-facing display</strong>: letting delegates see their queue position and the current speaker</li>
              <li style={s.li}><strong>Voting</strong>: recording roll call votes with In Favour / Against / Abstain</li>
            </ul>

            <h2 style={s.h2}>Gavelling (Free)</h2>
            <p style={s.p}>Gavelling is the most complete free MUN committee platform available in 2026. It was built specifically for Model UN chairs and handles the full committee lifecycle: roll call, GSL, moderated and unmoderated caucuses, motions, documents, voting, and delegate-facing views, all in real time via any web browser with no installation required.</p>
            <p style={s.p}>Delegates join via a six-character code and can see their queue position, request to speak, and receive documents from the chair. Multiple co-chairs can manage the same session simultaneously. The chair view runs on any device: tablet, laptop, or phone.</p>
            <div style={s.callout}><p style={s.calloutText}>Gavelling is completely free to use. Start a session in under a minute at gavelling.com. No account required.</p></div>

            <h2 style={s.h2}>Google Sheets (Free, Manual)</h2>
            <p style={s.p}>Many chairs build custom Google Sheets for committee management. The advantage: total flexibility. You can design exactly the layout you want. The disadvantages are significant in practice: no built-in timer, no delegate-facing view, manual data entry during high-stakes moments, and no real-time sync if you have co-chairs on different devices without careful coordination.</p>
            <p style={s.p}>Google Sheets works for prepared chairs with reliable co-chairs. It falls apart in large committees with fast motion turnover or when co-chair coordination breaks down.</p>

            <h2 style={s.h2}>Phone Timers and Stopwatches</h2>
            <p style={s.p}>Every chair has a phone timer. Most use it as a backup, not a primary tool, because it only tracks one thing at a time. A phone timer cannot simultaneously track speaker time, caucus total time, and per-caucus-speaker time. For simple committees with slow debate, it is sufficient. For anything above twenty delegates or with active caucus cycles, it is a liability.</p>

            <h2 style={s.h2}>PowerPoint / Keynote Displays</h2>
            <p style={s.p}>Some large conferences use custom PowerPoint presentations displayed on a projector to show the current speaker, queue, and timer. These require someone dedicated to updating slides in real time, effectively a third dais member whose sole job is clicking through slides. Functional at scale, impractical for smaller committees.</p>

            <h2 style={s.h2}>openMUN and Other Open-Source Tools</h2>
            <p style={s.p}>Several open-source MUN tools exist but most are unmaintained or require technical setup (running a local server, installing dependencies). For a school MUN club or an advisor without technical resources, these are not practical options.</p>

            <h2 style={s.h2}>What We Recommend</h2>
            <p style={s.p}>For the vast majority of conferences (school MUN, regional conferences, even large university conferences), Gavelling covers everything needed without cost, setup, or technical expertise. The only scenario where a custom solution makes sense is a very large conference (300+ delegates) with extremely specific technical requirements and a dedicated IT team.</p>
            <p style={s.p}>For chairs who want to run a tight, professional committee session without spending hours on logistics: start at gavelling.com, create a committee, and share the join code. You will be running roll call in under three minutes.</p>

            <RelatedGuides currentSlug="free-mun-tools" />
            <div style={s.cta}>
              <p style={s.ctaText}>Free, browser-based, no setup. Start your MUN committee in minutes.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
