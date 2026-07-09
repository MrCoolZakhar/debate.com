import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Director Guide — How to Run a Model UN Conference',
  description: 'A complete guide for MUN secretariat directors: planning the conference, assigning committees, briefing chairs, managing logistics, and running a smooth event.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-director-guide' },
  openGraph: {
    title: 'MUN Director Guide — How to Run a Model UN Conference',
    description: 'The complete secretariat guide to directing a Model UN conference.',
    url: 'https://gavelling.com/blog/mun-director-guide',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Director Guide — How to Run a Model UN Conference',
  description: 'Complete guide for MUN conference directors.',
  url: 'https://gavelling.com/blog/mun-director-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-director-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Director Guide', item: 'https://gavelling.com/blog/mun-director-guide' },
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
          <h1 style={s.h1}>MUN Director Guide — How to Run a Model UN Conference</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 12 min read</p>
          <article style={s.article}>

            <p style={s.p}>Directing a Model UN conference is one of the most complex leadership experiences available to students. You are responsible for every committee running simultaneously, dozens of chair relationships, hundreds of delegates, venue logistics, and the overall quality of the academic and social programme. This guide covers the full arc — from initial planning to post-conference wrap-up.</p>

            <h2 style={s.h2}>What Does a MUN Director Do?</h2>
            <p style={s.p}>The director (sometimes called Secretary-General, Director-General, or simply the conference head depending on your secretariat structure) is responsible for the overall conference programme. Specific responsibilities typically include:</p>
            <ul style={s.ul}>
              <li style={s.li}>Selecting committee topics and assigning country allocations</li>
              <li style={s.li}>Recruiting and managing the dais staff (chairs, co-chairs, crisis directors)</li>
              <li style={s.li}>Overseeing background guide production</li>
              <li style={s.li}>Managing delegate registration and school liaison</li>
              <li style={s.li}>Running the awards process and ensuring consistency across committees</li>
              <li style={s.li}>Coordinating venue logistics, scheduling, and technology</li>
            </ul>

            <h2 style={s.h2}>Six Months Out: Setting the Foundation</h2>
            <h3 style={s.h3}>Choose Your Committees</h3>
            <p style={s.p}>Select a committee roster that balances accessibility (GA committees most delegates can prepare for) with prestige (specialised agencies, Security Council, crisis committees). A typical medium-sized conference might have three to five GA committees, one UNSC, one specialised agency, and one crisis committee.</p>
            <h3 style={s.h3}>Choose Your Topics</h3>
            <p style={s.p}>Good MUN topics are: timely (connected to real current events), debatable (genuine disagreement between country blocs), and actionable (the committee can actually do something about it). Avoid topics that are too resolved (unanimous agreement on causes and solutions) or too intractable (no possible middle ground).</p>
            <div style={s.callout}><p style={s.calloutText}>Test a topic by trying to outline three clearly different bloc positions. If you cannot, the topic is either too consensus-heavy or too niche. Strong topics produce natural bloc diversity.</p></div>

            <h2 style={s.h2}>Four Months Out: Building Your Team</h2>
            <p style={s.p}>Recruit chairs early. Your best chairs are experienced delegates who understand procedure cold, can manage a room, and are genuinely interested in the topic. Brief chairs on:</p>
            <ul style={s.ul}>
              <li style={s.li}>Your conference&apos;s rules of procedure (distribute the document, do not assume they know)</li>
              <li style={s.li}>The expected committee output (one resolution? multiple? working papers?)</li>
              <li style={s.li}>Awards criteria (what should they look for?)</li>
              <li style={s.li}>Technology they will use to run their committee (software, projector, timer setup)</li>
            </ul>

            <h2 style={s.h2}>Three Months Out: Background Guides</h2>
            <p style={s.p}>Background guides should be published at least six to eight weeks before the conference to give delegates adequate preparation time. Each guide should cover: committee mandate and history, topic background, key country positions, and guiding questions. Aim for ten to fifteen pages per topic — long enough to be substantive, short enough to be read.</p>
            <p style={s.p}>Review every background guide before publication. Factual errors in background guides undermine chair credibility and frustrate well-prepared delegates.</p>

            <h2 style={s.h2}>One Month Out: Registration and Logistics</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Confirm delegate registrations</strong> and assign countries. Try to match country allocations to school or team size — larger delegations should get more committee slots.</li>
              <li style={s.li}><strong>Confirm venue layouts</strong> — committee room sizes, projector availability, power access, WiFi.</li>
              <li style={s.li}><strong>Set up committee management software.</strong> Gavelling allows directors to create committee sessions in advance, with co-chair access codes, delegate lists, and settings pre-configured before conference day.</li>
              <li style={s.li}><strong>Brief your dais team in full.</strong> Run a mock committee session with your chairs if possible.</li>
            </ul>

            <h2 style={s.h2}>Conference Day: Director Operations</h2>
            <p style={s.p}>On conference day, your primary job is problem-solving. Committees will have issues — a chair goes absent, a room has no projector, two committees request the same delegate for a joint crisis session. Keep a live list of all open issues and assign team members to resolve them.</p>
            <p style={s.p}>Visit every committee room at least once per session. A brief appearance from the director signals to delegates that the secretariat cares about quality. It also lets you catch problems — a committee that is too quiet, a chair who is struggling, a bloc that has completely stalled — before they become crises.</p>

            <h2 style={s.h2}>Awards</h2>
            <p style={s.p}>Brief chairs on awards criteria well in advance. Decide: will you give Best Delegate, Outstanding Delegate, Honourable Mention, and Verbal Commendation in every committee? Will crisis committees use a different system? Will you give a Best Position Paper award? Consistency matters — delegates and advisors notice when award criteria appear arbitrary.</p>
            <p style={s.p}>Collect chair recommendations privately, cross-check for conflicts of interest, and ensure award distribution is reasonably spread across schools rather than concentrated.</p>

            <h2 style={s.h2}>Post-Conference</h2>
            <p style={s.p}>Send a post-conference survey to delegates, chairs, and faculty advisors within one week. The feedback you receive in the days immediately after a conference is far more useful than what you remember months later. Use it to improve your next event.</p>

            <RelatedGuides currentSlug="mun-director-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Set up all your conference committees in Gavelling before conference day — sessions, delegates, and settings ready to go.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
