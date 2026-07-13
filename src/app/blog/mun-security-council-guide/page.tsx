import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Security Council Guide: Veto, P5, and How UNSC Works',
  description: 'Everything you need to know about simulating the UN Security Council in MUN: veto power, P5 dynamics, procedure differences, and how to chair or delegate UNSC.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-security-council-guide' },
  openGraph: {
    title: 'MUN Security Council Guide: Veto, P5, and How UNSC Works',
    description: 'Master the UN Security Council simulation in Model UN.',
    url: 'https://gavelling.com/blog/mun-security-council-guide',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Security Council Guide: Veto, P5, and How UNSC Works',
  description: 'Complete guide to the MUN Security Council simulation.',
  url: 'https://gavelling.com/blog/mun-security-council-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-security-council-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Security Council Guide', item: 'https://gavelling.com/blog/mun-security-council-guide' },
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
          <h1 style={s.h1}>MUN Security Council Guide: Veto, P5, and How UNSC Works</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 11 min read</p>
          <article style={s.article}>

            <p style={s.p}>The UN Security Council simulation is the most coveted placement at many Model UN conferences. It is small (fifteen delegates), intensely political, and operates under completely different dynamics to General Assembly committees. If you have been assigned a UNSC role, or if you are chairing one, this guide will tell you exactly what you are walking into.</p>

            <h2 style={s.h2}>UNSC Composition</h2>
            <p style={s.p}>The real Security Council has fifteen members: five permanent members (P5) and ten non-permanent members elected for two-year terms. MUN simulations replicate this structure, sometimes with a fixed list of assigned nations, sometimes allowing the conference to choose which ten non-permanent members to include.</p>
            <p style={s.p}>The P5 are: the United States, United Kingdom, France, Russia, and China. Each holds permanent veto power over substantive resolutions.</p>

            <h2 style={s.h2}>The Veto: How It Actually Works</h2>
            <p style={s.p}>A Security Council resolution passes only if it receives nine or more affirmative votes AND no P5 member votes Against. A single P5 member voting Against defeats the resolution, regardless of whether the other fourteen members vote in favour. This is the veto.</p>
            <div style={s.callout}><p style={s.calloutText}>Crucially: a P5 abstention is NOT a veto. A P5 member can abstain and the resolution still passes (if nine votes are reached). This matters enormously for Security Council diplomacy.</p></div>
            <p style={s.p}>In MUN simulations, the veto creates completely different bloc dynamics. No resolution can pass without at least tacit P5 acceptance. Non-permanent members must spend significant effort persuading P5 delegates to support or at minimum abstain.</p>

            <h2 style={s.h2}>Procedural Differences from GA Committees</h2>
            <p style={s.p}>UNSC simulations typically operate with far less formal procedure than GA committees. Expect:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>No formal speakers list in many simulations.</strong> Chairs often run debate more conversationally, recognising delegates to speak without a formal queue.</li>
              <li style={s.li}><strong>More unmoderated caucus time.</strong> With only fifteen delegates, the whole committee can effectively negotiate in the room.</li>
              <li style={s.li}><strong>Faster document cycles.</strong> Working papers emerge and merge much faster in a fifteen-person room than a hundred-person GA.</li>
              <li style={s.li}><strong>Consultations of the whole.</strong> Many UNSC simulations use "consultations of the whole": a semi-informal full-committee discussion without a strict speakers list.</li>
            </ul>

            <h2 style={s.h2}>P5 Strategy</h2>
            <p style={s.p}>If you hold a P5 seat, you are the most powerful delegate in the room. Use it wisely:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Your veto threat is leverage.</strong> You rarely need to actually veto; the threat alone shapes resolution language. Use it in negotiations to extract concessions.</li>
              <li style={s.li}><strong>P5 coordination is critical.</strong> If the other P5 members are voting in a block against you, no resolution passes that you oppose. Align with at least some P5 members early.</li>
              <li style={s.li}><strong>Abstentions are a diplomatic tool.</strong> Publicly abstaining rather than vetoing signals that you have reservations but are not actively blocking progress. This is a real-world diplomatic move worth simulating.</li>
            </ul>

            <h2 style={s.h2}>Non-Permanent Member Strategy</h2>
            <p style={s.p}>Non-permanent members cannot veto, but they are not powerless. Nine votes are needed to pass a resolution, and with only five P5 members, at least four non-permanent votes are always required. This gives swing states real leverage, especially if two or more P5 members are already committed and you can deny the ninth vote.</p>

            <h2 style={s.h2}>Chairing a Security Council Simulation</h2>
            <p style={s.p}>Chairing UNSC is more like moderating a high-stakes negotiation than running a formal debate. Your key responsibilities:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Read the room constantly.</strong> With fifteen delegates, you can see every reaction, every side conversation. Use this to gauge when to push toward a vote or open another unmod.</li>
              <li style={s.li}><strong>Manage P5 personalities carefully.</strong> P5 delegates tend to dominate. Ensure non-permanent members have genuine speaking opportunities.</li>
              <li style={s.li}><strong>Know the veto math.</strong> Before calling a vote, mentally count: do the sponsors have nine votes? Is any P5 threatening a veto? Calling a doomed vote wastes the committee's time.</li>
            </ul>

            <h2 style={s.h2}>Common Topics for UNSC Simulations</h2>
            <p style={s.p}>UNSC simulations typically address: ongoing armed conflicts (Syria, Sudan, Ukraine), nuclear non-proliferation, terrorism, sanctions regimes, and peacekeeping operations. The most interesting topics are those where the P5 have genuinely divergent interests. These create authentic diplomatic tension.</p>

            <RelatedGuides currentSlug="mun-security-council-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling supports veto mode for Security Council simulations: one P5 Against defeats the resolution automatically.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
