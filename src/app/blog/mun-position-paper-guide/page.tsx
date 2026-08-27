import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import React from 'react';

export const metadata: Metadata = pageMetadata({
  title: 'How to Write a MUN Position Paper: Format, Tips & Examples',
  description:
    'Step-by-step guide to writing a Model UN position paper: correct format, what to include, common mistakes, and examples that impress chairs.',
  path: '/blog/mun-position-paper-guide',
  ogDescription:
    'Write position papers that impress chairs and set you up to lead debate.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Position Paper: Format, Tips & Examples',
  description: 'Step-by-step guide to writing a MUN position paper.',
  url: 'https://gavelling.com/blog/mun-position-paper-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-position-paper-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Position Paper Guide', item: 'https://gavelling.com/blog/mun-position-paper-guide' },
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
          <h1 style={s.h1}>How to Write a MUN Position Paper: Format, Tips & Examples</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>

            <p style={s.p}>A position paper is your entry ticket to serious MUN. Many conferences require one before committee even begins. Done well, it forces you to clarify your country's stance before walking in the door, and signals to chairs that you are prepared to lead. Done poorly, it reads like a Wikipedia summary with a flag at the top. This guide shows you how to write one that actually matters.</p>

            <h2 style={s.h2}>What Is a MUN Position Paper?</h2>
            <p style={s.p}>A position paper is a one-to-two page document written from your assigned country's perspective on the committee topic(s). It is submitted to the dais before the conference and may be graded as part of your overall award. Its purpose is to articulate your country's official stance, the reasoning behind it, and the solutions your delegation will advocate for.</p>

            <h2 style={s.h2}>Standard Format</h2>
            <p style={s.p}>Most conferences follow a similar structure. Always check your specific conference's guidelines; some have strict page limits, required headings, or particular citation formats.</p>

            <h3 style={s.h3}>Header Block</h3>
            <p style={s.p}>At the top of the paper include: Committee name, Topic, Country, Delegate name(s), and School/Institution. Keep this concise; it should not take up more than four lines.</p>

            <h3 style={s.h3}>Section 1: Country Background and Topic Overview</h3>
            <p style={s.p}>Briefly establish your country's relevant context. This is not a history lesson. It is a tight paragraph explaining why this issue matters to your country specifically. For example, if the topic is climate change adaptation, and you represent Bangladesh, you would note that Bangladesh is among the most climate-vulnerable nations on earth, with 17% of its territory at risk from a one-metre sea level rise.</p>

            <h3 style={s.h3}>Section 2: Country Position</h3>
            <p style={s.p}>State your country's position explicitly. Not what you personally think, but what the government of your assigned country officially supports. Reference actual UN votes, treaties your country has signed, or statements from ministers. This is where research pays off.</p>
            <div style={s.callout}><p style={s.calloutText}>Avoid writing "Country X believes..." with no evidence. Always cite something: a UN resolution vote, a treaty, a government press release. It shows you did the work.</p></div>

            <h3 style={s.h3}>Section 3: Proposed Solutions</h3>
            <p style={s.p}>This is the most important and most under-written section. What does your country actually want the committee to do? Propose specific, actionable solutions that align with your country's interests. These should translate directly into operative clauses in your eventual working paper. Vague proposals ("increase international cooperation") are forgettable. Specific ones ("establish a UN technology transfer fund capitalised at $10 billion annually") are not.</p>

            <h2 style={s.h2}>Research Sources That Actually Work</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>UN Digital Library (digitallibrary.un.org):</strong> Full text of resolutions, voting records, and official UN documents.</li>
              <li style={s.li}><strong>Ministry of Foreign Affairs websites:</strong> Official government positions, speeches, and policy documents.</li>
              <li style={s.li}><strong>CIA World Factbook:</strong> Quick country background data.</li>
              <li style={s.li}><strong>UN Treaty Collection:</strong> Which treaties has your country signed or ratified?</li>
              <li style={s.li}><strong>Reliefweb, OCHA, UNHCR:</strong> For humanitarian and refugee topics.</li>
            </ul>

            <h2 style={s.h2}>Common Mistakes to Avoid</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Writing your personal opinion.</strong> You are representing a country, not yourself. Check every sentence: does the government of this country actually hold this view?</li>
              <li style={s.li}><strong>Padding with general topic information.</strong> Chairs have read fifty position papers. They do not need a paragraph explaining what climate change is. Get to your country's stance fast.</li>
              <li style={s.li}><strong>Proposing things your country opposes.</strong> Surprising as it sounds, delegates often propose solutions that contradict their country's actual UN votes. Check the voting record.</li>
              <li style={s.li}><strong>No citations.</strong> Every factual claim should have a source. Footnotes are fine.</li>
              <li style={s.li}><strong>Exceeding the page limit.</strong> If the limit is one page, one page. Chairs penalise papers that ignore instructions.</li>
            </ul>

            <h2 style={s.h2}>Using Your Position Paper in Committee</h2>
            <p style={s.p}>Your position paper is also a speech outline. Your opening GSL speech should cover the same ground in sixty to ninety seconds. Your proposed solutions become the operative clauses of your working paper. If you have written a strong position paper, you have already done most of the intellectual work needed to lead debate.</p>

            <RelatedGuides currentSlug="mun-position-paper-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Use Gavelling to manage your committee sessions with the same preparation mindset.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
