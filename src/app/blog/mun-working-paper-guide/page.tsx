import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import React from 'react';

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
          <h1 style={s.h1}>MUN Working Paper Guide: How to Draft, Merge, and Introduce</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>

            <p style={s.p}>A working paper is the informal predecessor to a draft resolution. It is where the real work of MUN happens: messy, collaborative, and often written in the chaos of an unmoderated caucus on someone's laptop. Knowing how to write one quickly, structure it correctly, and merge it strategically with other blocs is one of the most valuable skills in MUN.</p>

            <h2 style={s.h2}>Working Paper vs. Draft Resolution</h2>
            <p style={s.p}>The terms are sometimes used interchangeably, but technically they are different stages:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Working paper:</strong> An informal document used during the drafting phase. Does not need to follow strict resolution format. Not voted on directly. Shared with the committee for feedback and coalition-building.</li>
              <li style={s.li}><strong>Draft resolution:</strong> A formally formatted document submitted to the dais. Must meet the conference's minimum sponsor and signatory requirements. Can be debated and voted on once introduced.</li>
            </ul>
            <p style={s.p}>Many committees skip the working paper stage and go straight to draft resolutions. Others use working papers extensively before formalising. Know which approach your conference expects.</p>

            <h2 style={s.h2}>When to Start Drafting</h2>
            <p style={s.p}>Start earlier than feels necessary. The bloc that has a working paper to show at the first unmoderated caucus immediately attracts other delegates. A blank Google Doc with three bullet points still outperforms nothing.</p>
            <div style={s.callout}><p style={s.calloutText}>Draft in Google Docs or a shared document. Do not draft in a Word file on one person's laptop. The moment they leave the room, your whole bloc is stalled.</p></div>

            <h2 style={s.h2}>What to Put in a Working Paper</h2>
            <p style={s.p}>Even an informal working paper should have:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>A header:</strong> committee, topic, list of writing delegates</li>
              <li style={s.li}><strong>Two to four preambulatory ideas:</strong> the context and justification for your proposals</li>
              <li style={s.li}><strong>Four to eight operative clauses:</strong> the specific actions you want the committee to take</li>
            </ul>
            <p style={s.p}>At the working paper stage, you do not need to worry about perfect formatting. What matters is that the ideas are clear, the clauses are specific, and the document reflects your bloc's actual positions.</p>

            <h2 style={s.h2}>Getting Sponsors and Signatories</h2>
            <p style={s.p}>To convert a working paper into a draft resolution, you need a minimum number of sponsors (countries that helped write it and fully support it) and signatories (countries that want the document debated, but may not support its passage). Check your conference's requirements, as these vary widely.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Sponsors</strong> generally cannot vote against their own resolution without withdrawing sponsorship first.</li>
              <li style={s.li}><strong>Signatories</strong> carry no obligation to vote in favour.</li>
              <li style={s.li}>Getting signatures from across blocs signals the resolution has broad support and can sway undecided delegates.</li>
            </ul>

            <h2 style={s.h2}>Merging Working Papers</h2>
            <p style={s.p}>When two blocs have competing working papers, the chair will often encourage merging rather than allowing both to be introduced. Merging is a negotiation: each side has clauses they will not give up, and clauses they can compromise on.</p>
            <h3 style={s.h3}>Merging Strategy</h3>
            <ul style={s.ul}>
              <li style={s.li}>Identify your non-negotiable clauses before entering merger talks. Know what you would withdraw sponsorship over.</li>
              <li style={s.li}>Offer to adopt the other bloc's strongest operative clause wholesale. This often unlocks agreement on three or four other clauses.</li>
              <li style={s.li}>Use "calls upon" instead of "urges" or "decides" on contested clauses. Softer language often breaks deadlocks.</li>
              <li style={s.li}>Agree on who will be listed first as primary sponsor; this is more important to some delegations than specific clauses.</li>
            </ul>

            <h2 style={s.h2}>Introducing a Draft Resolution</h2>
            <p style={s.p}>Once formatted and signed, the primary sponsor submits the draft resolution to the dais. The chair will schedule introduction: a brief period where the primary sponsor presents the document to the committee. Keep introductions short: two minutes maximum, covering the key operative clauses and the coalition that supports it.</p>
            <p style={s.p}>After introduction, the draft resolution is available for amendment and formal debate. The working paper phase is over. You are now in the final push to pass your resolution.</p>

            <RelatedGuides currentSlug="mun-working-paper-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling lets delegates submit working papers directly to the chair during committee, no paper required.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
