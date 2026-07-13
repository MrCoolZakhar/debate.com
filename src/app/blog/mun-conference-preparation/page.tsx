import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'How to Prepare for a MUN Conference: Complete Pre-Conference Checklist',
  description: 'Everything you need to do before a Model UN conference: research, position papers, practice speeches, rules of procedure, and what to pack.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-conference-preparation' },
  openGraph: {
    title: 'How to Prepare for a MUN Conference: Complete Pre-Conference Checklist',
    description: 'The complete MUN pre-conference preparation guide.',
    url: 'https://gavelling.com/blog/mun-conference-preparation',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Prepare for a MUN Conference: Complete Pre-Conference Checklist',
  description: 'Complete MUN pre-conference preparation guide.',
  url: 'https://gavelling.com/blog/mun-conference-preparation',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-preparation' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Preparation', item: 'https://gavelling.com/blog/mun-conference-preparation' },
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
          <h1 style={s.h1}>How to Prepare for a MUN Conference: Complete Pre-Conference Checklist</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>

            <p style={s.p}>The gap between delegates who thrive at conferences and those who struggle almost always comes down to preparation done weeks before the gavel falls. This guide gives you a week-by-week preparation timeline and a complete checklist for everything you need before, during, and after your next MUN conference.</p>

            <h2 style={s.h2}>Six Weeks Out: Know Your Assignment</h2>
            <p style={s.p}>As soon as you receive your country and committee assignment, start researching. Do not wait for the background guide. The earlier you start, the deeper your understanding will be by conference day.</p>
            <ul style={s.ul}>
              <li style={s.li}>Look up your country's general foreign policy orientation: are they typically aligned with Western blocs, the G77, BRICS, or do they tend to take independent positions?</li>
              <li style={s.li}>Find your country's UN voting record on topics related to your committee's subject matter.</li>
              <li style={s.li}>Identify who the key decision-makers are in your country's foreign ministry and what recent statements they have made.</li>
            </ul>

            <h2 style={s.h2}>Four Weeks Out: Deep Research</h2>
            <p style={s.p}>When the background guide arrives, read it fully. Then go beyond it. Background guides are starting points, not finish lines.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Read at least three recent news articles</strong> on the committee topic from different perspectives (Western press, regional press, UN sources).</li>
              <li style={s.li}><strong>Find the most recent UN resolution</strong> on this topic and note how your country voted.</li>
              <li style={s.li}><strong>Identify two to three potential allies</strong> (countries likely to share your position) and two to three likely opponents.</li>
              <li style={s.li}><strong>Draft a rough position statement:</strong> three sentences: what is the problem, what does your country believe, what should the committee do.</li>
            </ul>

            <h2 style={s.h2}>Three Weeks Out: Write Your Position Paper</h2>
            <p style={s.p}>Most conferences require position papers three to four weeks before the conference. Do not treat this as an administrative task. Treat it as a speech outline. Your position paper becomes your opening speech, your working paper framework, and your negotiating position.</p>
            <div style={s.callout}><p style={s.calloutText}>A good position paper has three sections: country background on the issue, your country's official stance with evidence, and specific proposed solutions. Two pages maximum. Every claim cited.</p></div>

            <h2 style={s.h2}>Two Weeks Out: Learn the Procedure</h2>
            <p style={s.p}>Read your conference's rules of procedure document. Every conference has one. The procedural differences between NMUN, HMUN, WIMUN, and school conferences can be significant. Know:</p>
            <ul style={s.ul}>
              <li style={s.li}>What majority is required for substantive vs procedural votes?</li>
              <li style={s.li}>How are moderated caucuses proposed? What information is required?</li>
              <li style={s.li}>What is the speaker time default? Can it be changed by motion?</li>
              <li style={s.li}>What types of yields are permitted?</li>
              <li style={s.li}>How many sponsors and signatories are required for a draft resolution?</li>
            </ul>

            <h2 style={s.h2}>One Week Out: Practise Out Loud</h2>
            <p style={s.p}>Reading your speech is not the same as delivering it. Stand up and practise your opening speech out loud until it feels natural at the target length. Time yourself with a phone. If your conference has a sixty-second default, your speech should land in fifty to sixty seconds, not forty and not seventy.</p>
            <p style={s.p}>Practise one moderated caucus speech. Practise a point of information. If possible, do a practice session with your school's MUN club.</p>

            <h2 style={s.h2}>What to Pack</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Notepad and pens</strong>: you will be writing names, motion proposals, and resolution ideas constantly</li>
              <li style={s.li}><strong>Printed position paper copy</strong>: some dais teams ask to see it in person</li>
              <li style={s.li}><strong>Laptop or tablet</strong>: for collaborative document editing during caucuses</li>
              <li style={s.li}><strong>Portable charger</strong>: three days of full committee sessions drain every battery</li>
              <li style={s.li}><strong>Business cards</strong>: optional but impressive at large conferences for bloc-building</li>
              <li style={s.li}><strong>Appropriate dress</strong>: western business formal is standard for most conferences</li>
            </ul>

            <h2 style={s.h2}>Day One: First Impressions Matter</h2>
            <p style={s.p}>Arrive early. Introduce yourself to the chairs and to delegates from your likely ally countries before the session opens. Being the person who starts conversations early sets the tone for the whole conference. The delegate who walks in with established relationships already has an advantage over the one who waits to be approached.</p>

            <h2 style={s.h2}>After the Conference: Reflect and Improve</h2>
            <p style={s.p}>Write down three things that went well and three things to improve while the experience is fresh. Review any feedback from the dais. Keep your position papers: they are useful templates for future conferences on similar topics.</p>

            <RelatedGuides currentSlug="mun-conference-preparation" />
            <div style={s.cta}>
              <p style={s.ctaText}>Chairs: prepare your committee setup in minutes with Gavelling.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
