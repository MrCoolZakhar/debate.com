import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import React from 'react';

export const metadata: Metadata = pageMetadata({
  title: 'How to Write a MUN Opening Speech: Templates and Examples',
  description:
    'Write a standout MUN opening speech with this complete guide: structure, length, what to include, what to avoid, and real examples for different countries.',
  path: '/blog/mun-opening-speech',
  ogDescription:
    'Write a MUN opening speech that leads your bloc from minute one.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Opening Speech: Templates and Examples',
  description: 'Complete guide to writing a MUN opening speech.',
  url: 'https://gavelling.com/blog/mun-opening-speech',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-opening-speech' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Opening Speech', item: 'https://gavelling.com/blog/mun-opening-speech' },
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
          <h1 style={s.h1}>How to Write a MUN Opening Speech: Templates and Examples</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>

            <p style={s.p}>Your opening speech on the General Speakers List is your first, and sometimes only, chance to define your delegation's position and attract bloc members. Most delegates waste it with a generic country summary. This guide shows you how to write one that actually moves the room.</p>

            <h2 style={s.h2}>How Long Should a MUN Opening Speech Be?</h2>
            <p style={s.p}>Match your conference's default speaker time, typically sixty to ninety seconds. If the default is sixty seconds, aim for fifty-five. Running over is disrespectful and gets you cut off mid-sentence. Running five seconds short is fine; it shows control. Do not pad.</p>
            <p style={s.p}>At sixty seconds of spoken word, you have approximately 140–160 words. That is not much. Every word must earn its place.</p>

            <h2 style={s.h2}>The Four-Part Structure</h2>

            <h3 style={s.h3}>1. Hook (one sentence)</h3>
            <p style={s.p}>Open with something that demands attention. The best hooks are specific, surprising, or directly challenge a prevailing assumption. Avoid: "The delegation of Norway is pleased to address this committee on the topic of..."</p>
            <p style={s.p}>Use instead: a statistic, a provocative claim, or a direct call to action.</p>

            <h3 style={s.h3}>2. Country Context (one to two sentences)</h3>
            <p style={s.p}>Why does this issue matter specifically to your country? Do not explain the issue to the committee; they know what it is. Explain your country's unique stake. "Norway, as a major hydrocarbon producer and simultaneously one of the world's highest per-capita investors in renewable energy, holds a particular responsibility to this debate."</p>

            <h3 style={s.h3}>3. Position (two to three sentences)</h3>
            <p style={s.p}>State what your country supports. Be specific. Reference real votes, treaties, or domestic policy if possible. This is what delegates will remember and react to.</p>

            <h3 style={s.h3}>4. Call to Action (one sentence)</h3>
            <p style={s.p}>End by inviting collaboration. "Norway looks forward to working with like-minded delegations on a framework that balances emission reductions with economic development needs." This signals that you are open to coalition-building without showing your hand on specific compromises.</p>

            <h2 style={s.h2}>Example Opening Speech: Climate Finance</h2>
            <div style={s.script}>
              <p style={s.scriptText}>
                "The delegate of Germany rises to address one of the defining failures of the last decade: the developed world's broken promise of $100 billion annually in climate finance. Germany recognises its own obligations here; we have not always delivered. But recognition without action is insufficient. Germany strongly supports a new, binding climate finance architecture with transparent reporting requirements, loss-and-damage provisions, and meaningful technology transfer to the developing world. Germany invites all delegations, particularly fellow Annex II parties, to join us in drafting a resolution that closes the accountability gap. The time for aspirational language has passed."
              </p>
            </div>
            <p style={s.meta}>Word count: 112. Approximate length at moderate pace: 55 seconds.</p>

            <h2 style={s.h2}>Example Opening Speech: Refugee Protection</h2>
            <div style={s.script}>
              <p style={s.scriptText}>
                "One hundred and seventeen million people are currently displaced from their homes, a record that shames the international community. Jordan, as the country hosting the highest number of refugees per capita in the world, does not speak about this crisis abstractly. We live it. Jordan calls upon this committee to adopt a binding burden-sharing mechanism that distributes refugee admission quotas equitably among all member states, not just the neighbours of conflict zones. We are prepared to co-sponsor a working paper on this framework and urge delegations from the European Union and the Gulf states to join us at the table."
              </p>
            </div>

            <h2 style={s.h2}>Common Mistakes</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Starting with "The delegation of X is honoured/pleased/proud to..."</strong>: every delegate uses this. It wastes your first five seconds.</li>
              <li style={s.li}><strong>Explaining the topic.</strong> Everyone in the room knows what climate change is. Skip the background.</li>
              <li style={s.li}><strong>No concrete position.</strong> "X supports international cooperation" tells the room nothing.</li>
              <li style={s.li}><strong>No call to action.</strong> If you do not invite people to work with you, they will work with someone who did.</li>
              <li style={s.li}><strong>Reading word-for-word without eye contact.</strong> Know your speech well enough to look up frequently.</li>
            </ul>

            <h2 style={s.h2}>Getting on the GSL Early</h2>
            <p style={s.p}>Raise your placard the moment the chair opens the speakers list. Early slots matter, because delegates make bloc decisions based on what they hear in the first few speeches. Speaking fifth versus speaking fortieth is a significant advantage.</p>

            <RelatedGuides currentSlug="mun-opening-speech" />
            <div style={s.cta}>
              <p style={s.ctaText}>Track your position on the GSL in real time with Gavelling as a delegate.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
