import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Faculty Advisor Guide: How to Prepare and Support Your Team',
  description: 'A complete guide for faculty advisors running a Model UN program: preparing students, choosing conferences, reviewing position papers, and supporting delegates at the conference.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-faculty-advisor-guide' },
  openGraph: {
    title: 'MUN Faculty Advisor Guide: How to Prepare and Support Your Team',
    description: 'Everything faculty advisors need to run a successful MUN program.',
    url: 'https://gavelling.com/blog/mun-faculty-advisor-guide',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Faculty Advisor Guide: How to Prepare and Support Your Team',
  description: 'Complete guide for MUN faculty advisors.',
  url: 'https://gavelling.com/blog/mun-faculty-advisor-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-faculty-advisor-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Faculty Advisor Guide', item: 'https://gavelling.com/blog/mun-faculty-advisor-guide' },
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
          <h1 style={s.h1}>MUN Faculty Advisor Guide: How to Prepare and Support Your Team</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 11 min read</p>
          <article style={s.article}>
            <p style={s.p}>Faculty advisors are the backbone of every successful school MUN program. You are simultaneously coach, logistics coordinator, welfare officer, and sometimes the only adult in the building who knows what a moderated caucus is. This guide covers the full advisor role: from building a program from scratch to supporting experienced delegates at competitive conferences.</p>

            <h2 style={s.h2}>Your Role at the Conference</h2>
            <p style={s.p}>The faculty advisor is an observer at the conference itself. You do not participate in committee. Your role during sessions is to be available: for pastoral support, logistical issues, liaison with conference staff, and debrief conversations between sessions. You are not a coach on the sidelines calling plays; you are a support structure that lets students take full ownership of their performance.</p>
            <div style={s.callout}><p style={s.calloutText}>The hardest part of being a good faculty advisor is resisting the urge to intervene when a student is struggling in committee. Let them work through it. The learning is in the difficulty.</p></div>

            <h2 style={s.h2}>Building the Program</h2>
            <p style={s.p}>If you are starting a new MUN club, start small and build deliberately. A first-year program with ten well-prepared students attending one local conference will build more sustainable momentum than a thirty-student program thrown at a major national conference unprepared.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Run practice sessions before the conference.</strong> Even two or three mock committee sessions dramatically improve first-timers' performance and confidence.</li>
              <li style={s.li}><strong>Assign research responsibilities.</strong> Give each student their country assignment at least four weeks before the conference and set a position paper deadline two weeks out.</li>
              <li style={s.li}><strong>Teach procedure explicitly.</strong> Most students will not learn rules of procedure from a document alone. Run mock votes, practice points of order, and simulate caucus proposals during club meetings.</li>
            </ul>

            <h2 style={s.h2}>Choosing Conferences</h2>
            <p style={s.p}>Not all conferences are appropriate for all experience levels. Evaluate conferences on:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Size:</strong> Smaller conferences (under 200 delegates) are better for first-timers. Large conferences like NMUN or NAIMUN are excellent for experienced delegates but overwhelming for beginners.</li>
              <li style={s.li}><strong>Reputation:</strong> Ask other advisors in your network. Conference quality varies significantly.</li>
              <li style={s.li}><strong>Cost:</strong> Registration fees, travel, and accommodation add up. Budget carefully and apply for any available financial aid early.</li>
              <li style={s.li}><strong>Academic quality:</strong> Read the background guides before registering. They tell you a lot about the conference's academic standards.</li>
            </ul>

            <h2 style={s.h2}>Reviewing Position Papers</h2>
            <p style={s.p}>Every student's position paper should go through at least one advisor review before submission. Look for:</p>
            <ul style={s.ul}>
              <li style={s.li}>Does the paper accurately represent the country's position (not the student's personal opinion)?</li>
              <li style={s.li}>Are claims cited? Are sources reliable?</li>
              <li style={s.li}>Are the proposed solutions specific and actionable?</li>
              <li style={s.li}>Does the paper stay within the page limit and format requirements?</li>
            </ul>

            <h2 style={s.h2}>During the Conference</h2>
            <p style={s.p}>Your schedule during the conference should include:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Morning check-ins:</strong> Brief team meeting before sessions start. How is everyone feeling? Any questions about procedure or strategy?</li>
              <li style={s.li}><strong>Lunch debrief:</strong> What happened in the morning session? What is the plan for the afternoon? Keep this constructive. It is not a critique session, it is a strategy session.</li>
              <li style={s.li}><strong>Evening wrap-up:</strong> Full debrief, pastoral check-in, and preparation for the next day.</li>
            </ul>
            <p style={s.p}>Do not attend committee sessions unless there is a serious welfare concern. Your presence changes delegate behaviour. They look to you instead of finding their own solutions.</p>

            <h2 style={s.h2}>After the Conference</h2>
            <p style={s.p}>A structured post-conference debrief is one of the most valuable parts of the program. Do it within a week while the experience is fresh. Have each student share: one thing they did well, one thing they would do differently, and one specific skill they want to develop before the next conference. This reflection loop is what separates programs that improve every year from those that plateau.</p>

            <h2 style={s.h2}>Using Technology as a Faculty Advisor</h2>
            <p style={s.p}>Some conferences now offer faculty advisor views: read-only access to committee sessions so advisors can monitor how their students are performing without being physically present in the room. Gavelling's faculty advisor mode provides exactly this: a live view of the committee, current speakers, queue positions, and session status. This allows advisors to see what is happening in real time and have better-informed debrief conversations.</p>

            <RelatedGuides currentSlug="mun-faculty-advisor-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling includes a Faculty Advisor view: observe any session live without disrupting the committee.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
