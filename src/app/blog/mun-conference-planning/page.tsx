import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import React from 'react';

export const metadata: Metadata = pageMetadata({
  title: 'How to Plan a MUN Conference: Step-by-Step for Schools and Clubs',
  description:
    'A complete step-by-step guide to planning a Model UN conference from scratch: timeline, committees, registration, background guides, technology, and logistics.',
  path: '/blog/mun-conference-planning',
  ogDescription:
    'Plan your first MUN conference with this complete organiser guide.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Plan a MUN Conference: Step-by-Step for Schools and Clubs',
  description: 'Step-by-step MUN conference planning guide.',
  url: 'https://gavelling.com/blog/mun-conference-planning',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-planning' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Planning', item: 'https://gavelling.com/blog/mun-conference-planning' },
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
          <h1 style={s.h1}>How to Plan a MUN Conference: Step-by-Step for Schools and Clubs</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 13 min read</p>
          <article style={s.article}>
            <p style={s.p}>Planning a Model UN conference from scratch is genuinely hard. You are simultaneously managing academic content, event logistics, people management, and technology, often with a team of students who have never done it before. This guide gives you a realistic, chronological plan for pulling it off well.</p>

            <h2 style={s.h2}>Decide Your Scope First</h2>
            <p style={s.p}>Before anything else, answer three questions: How many delegates? How many committees? How many days? These decisions cascade into every other planning choice. A first-time conference organiser is better served by a small, excellent conference (50–80 delegates, three committees, one day) than an ambitious one that collapses under its own complexity.</p>
            <div style={s.callout}><p style={s.calloutText}>Start smaller than feels ambitious. A tight, well-run 60-delegate conference is a better reputation-builder than a chaotic 200-delegate one. You can always grow next year.</p></div>

            <h2 style={s.h2}>Eight Months Out: Foundation</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Book your venue.</strong> School cafeterias, library halls, university rooms, whatever you can secure. You need one room per committee plus a space for opening and closing ceremonies.</li>
              <li style={s.li}><strong>Set your date.</strong> Avoid exam periods, major holidays, and dates that clash with other regional conferences that would compete for delegates.</li>
              <li style={s.li}><strong>Form your secretariat.</strong> At minimum: a Secretary-General (overall lead), a Director-General (operations), committee directors for each committee, and a communications/registration lead.</li>
              <li style={s.li}><strong>Choose your conference name and branding.</strong> Register a domain, set up a simple website or Google Form for interest registration.</li>
            </ul>

            <h2 style={s.h2}>Six Months Out: Academic Planning</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Finalise your committee list and topics.</strong> For each committee, choose one topic that is timely, debatable, and appropriate for your expected delegate experience level.</li>
              <li style={s.li}><strong>Write your rules of procedure document.</strong> You can adapt from NMUN's publicly available rules or write your own simplified version. The important thing is that it exists and is consistent across committees.</li>
              <li style={s.li}><strong>Recruit and brief your dais team.</strong> Each committee needs a chair and at least one co-chair. Find experienced MUN delegates from your school or network.</li>
              <li style={s.li}><strong>Open delegate registration.</strong> Set a registration fee if needed to cover venue and catering costs.</li>
            </ul>

            <h2 style={s.h2}>Four Months Out: Background Guides</h2>
            <p style={s.p}>Each committee's chair team should produce a background guide of ten to fifteen pages. This is the most time-consuming academic deliverable. Give chairs a template and a hard deadline (eight weeks before the conference), and review drafts before publication.</p>
            <h3 style={s.h3}>Background Guide Structure</h3>
            <ul style={s.ul}>
              <li style={s.li}>Committee introduction and mandate</li>
              <li style={s.li}>Topic background (history, current situation, key statistics)</li>
              <li style={s.li}>Bloc positions (how different country groups view the issue)</li>
              <li style={s.li}>Previous UN action (resolutions, treaties, programmes)</li>
              <li style={s.li}>Questions to consider</li>
              <li style={s.li}>References and further reading</li>
            </ul>

            <h2 style={s.h2}>Two Months Out: Registration and Assignments</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Close registration</strong> and finalise your delegate count.</li>
              <li style={s.li}><strong>Assign countries.</strong> Each registered school or team gets a list of countries across committees. Try to give schools country assignments that match their team's experience level.</li>
              <li style={s.li}><strong>Send confirmation packages</strong>: committee assignments, country assignments, background guides, rules of procedure, schedule.</li>
              <li style={s.li}><strong>Set up your committee management platform.</strong> Create all committee sessions in Gavelling, configure delegate lists, and share chair access codes with your dais team so they can familiarise themselves before conference day.</li>
            </ul>

            <h2 style={s.h2}>Conference Week: Final Checks</h2>
            <ul style={s.ul}>
              <li style={s.li}>Confirm venue access and room setup</li>
              <li style={s.li}>Test all technology (projectors, WiFi, committee management software)</li>
              <li style={s.li}>Brief your full secretariat team: everyone should know their role and their fallback if something goes wrong</li>
              <li style={s.li}>Prepare printed name placards if using physical ones</li>
              <li style={s.li}>Prepare awards certificates and materials</li>
            </ul>

            <h2 style={s.h2}>Conference Day</h2>
            <p style={s.p}>Run a tight opening ceremony, under thirty minutes. Get delegates into committee sessions as fast as possible. The energy peaks early; capitalise on it. Have secretariat members assigned to roam between committees and report issues back to the Secretary-General in real time.</p>

            <h2 style={s.h2}>After the Conference</h2>
            <p style={s.p}>Send a survey within 48 hours. Debrief your secretariat. Document what worked and what did not. Write it down before memory fades. Share your notes with next year's planning team. This institutional knowledge is more valuable than any single conference outcome.</p>

            <RelatedGuides currentSlug="mun-conference-planning" />
            <div style={s.cta}>
              <p style={s.ctaText}>Set up all your conference committees in Gavelling for free: no software installation, no IT team required.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
