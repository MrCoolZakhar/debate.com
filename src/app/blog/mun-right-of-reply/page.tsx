import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Right of Reply in MUN — When and How to Use It',
  description: 'A complete guide to the right of reply in Model UN: what qualifies, how to request it, chair discretion, and how to use it effectively without abusing it.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-right-of-reply' },
  openGraph: {
    title: 'Right of Reply in MUN — When and How to Use It',
    description: 'Everything you need to know about the right of reply in MUN.',
    url: 'https://gavelling.com/blog/mun-right-of-reply',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Right of Reply in MUN — When and How to Use It',
  description: 'Complete guide to right of reply in MUN.',
  url: 'https://gavelling.com/blog/mun-right-of-reply',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-right-of-reply' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Right of Reply', item: 'https://gavelling.com/blog/mun-right-of-reply' },
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
          <h1 style={s.h1}>Right of Reply in MUN — When and How to Use It</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 7 min read</p>
          <article style={s.article}>

            <p style={s.p}>The right of reply is one of the most misunderstood procedures in Model UN. Delegates invoke it too freely, chairs grant it too rarely, and neither side is quite sure of the rules. This guide clarifies exactly what the right of reply is, when it applies, and how to use it effectively.</p>

            <h2 style={s.h2}>What Is the Right of Reply?</h2>
            <p style={s.p}>The right of reply is a procedural mechanism that allows a delegation to briefly respond when its country has been directly attacked or misrepresented in another delegate's speech. It is a targeted rebuttal opportunity — not a second speech slot, and not a general chance to respond to arguments you disagree with.</p>
            <p style={s.p}>In real UN practice, the right of reply is invoked when a delegation believes its honour, name, or the integrity of its government has been impugned. MUN simulations follow the same principle, though application varies by conference.</p>

            <h2 style={s.h2}>What Qualifies for a Right of Reply?</h2>
            <p style={s.p}>This is where most confusion arises. A right of reply is appropriate when:</p>
            <ul style={s.ul}>
              <li style={s.li}>Another delegate has made a factually false statement about your country</li>
              <li style={s.li}>Your country has been directly named and mischaracterised</li>
              <li style={s.li}>A statement constitutes a personal or national insult against your delegation</li>
            </ul>
            <p style={s.p}>A right of reply is <strong>not</strong> appropriate when:</p>
            <ul style={s.ul}>
              <li style={s.li}>You simply disagree with another delegate's argument</li>
              <li style={s.li}>Another delegate criticised your country's policy (legitimate debate)</li>
              <li style={s.li}>You want an extra speaking slot but missed the GSL</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>Chair test: ask yourself whether a reasonable person would consider the original statement a misrepresentation or insult, or simply a policy disagreement. If it is the latter, deny the right of reply.</p></div>

            <h2 style={s.h2}>How to Request a Right of Reply</h2>
            <p style={s.p}>After the offending speech ends and before the next speaker begins, raise your placard and state: "Point of personal privilege — the delegation of [Country] requests the right of reply." Some conferences require a written request submitted to the dais. The chair will rule on whether to grant it.</p>
            <p style={s.p}>The right of reply is delivered after the conclusion of the current speakers list segment or at the chair's discretion — never interrupting a live speaker.</p>

            <h2 style={s.h2}>How to Use a Right of Reply Effectively</h2>
            <p style={s.p}>The right of reply is brief — typically thirty seconds. Use it surgically:</p>
            <ul style={s.ul}>
              <li style={s.li}>Identify the specific false claim or insult</li>
              <li style={s.li}>State the correct fact or clarification</li>
              <li style={s.li}>Do not expand into general policy argument</li>
            </ul>
            <div style={s.script}><p style={s.scriptText}>"The delegation of Canada invokes the right of reply to correct a factual error. The previous speaker claimed Canada voted against Resolution 73/254. Canada's voting record shows we voted In Favour. The delegation requests that the record reflect this correction. Thank you."</p></div>

            <h2 style={s.h2}>Chair's Discretion</h2>
            <p style={s.p}>Chairs have significant discretion over whether to grant a right of reply and how much time to allow. In Gavelling, chairs can grant a right of reply and insert the delegate at the top of the speakers list with a custom time override — typically shorter than the standard speech time. This keeps the process clean without derailing the committee's rhythm.</p>
            <p style={s.p}>Good chairs use the right of reply sparingly. When it is granted for genuinely inappropriate statements, it carries weight. When it is granted for every policy disagreement, it becomes noise.</p>

            <h2 style={s.h2}>The Reply to the Reply</h2>
            <p style={s.p}>Most conferences do not allow a reply to the right of reply — the original speaker cannot respond to the rebuttal. This prevents infinite back-and-forth. The chair should state this clearly if delegates attempt to chain replies.</p>

            <h2 style={s.h2}>Right of Reply in the Real UN</h2>
            <p style={s.p}>In real UN sessions, rights of reply can become highly charged diplomatic moments. A real-world example: when a UN General Assembly speech makes a claim about another country's human rights record, the named country's delegation typically invokes the right of reply within minutes, delivers a sharp rebuttal, and the original delegation may or may not respond. These exchanges are part of the public diplomatic record.</p>

            <RelatedGuides currentSlug="mun-right-of-reply" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling lets chairs grant right of reply and insert delegates at the top of the list instantly.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
