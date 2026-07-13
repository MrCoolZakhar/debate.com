import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Crisis Committee Guide: How Crisis Committees Work',
  description: 'A complete guide to MUN crisis committees: how crisis arcs work, directive writing, the crisis staff, backroom vs frontroom, and how to perform well as a delegate.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-crisis-committee-guide' },
  openGraph: {
    title: 'MUN Crisis Committee Guide: How Crisis Committees Work',
    description: 'Master crisis committees in Model UN with this complete guide.',
    url: 'https://gavelling.com/blog/mun-crisis-committee-guide',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Crisis Committee Guide: How Crisis Committees Work',
  description: 'Complete guide to MUN crisis committees.',
  url: 'https://gavelling.com/blog/mun-crisis-committee-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-crisis-committee-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Crisis Committee Guide', item: 'https://gavelling.com/blog/mun-crisis-committee-guide' },
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
          <h1 style={s.h1}>MUN Crisis Committee Guide: How Crisis Committees Work</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 12 min read</p>
          <article style={s.article}>

            <p style={s.p}>Crisis committees are the most dynamic format in Model UN. Where General Assembly committees debate policy over hours or days, crisis committees react to rapidly evolving fictional scenarios in real time. They demand faster thinking, stronger individual character play, and a completely different set of skills from standard MUN. Here is everything you need to know.</p>

            <h2 style={s.h2}>What Is a Crisis Committee?</h2>
            <p style={s.p}>A crisis committee is a small MUN committee, typically ten to twenty delegates, in which a fictional or historically-based scenario unfolds in real time throughout the conference. The committee might be a cabinet, a corporate board, a historical council of war, or an intelligence agency. Crisis updates (called "crisis updates" or "news flashes") arrive from the crisis staff, and the committee must respond through formal directives and resolutions.</p>
            <p style={s.p}>Unlike GA committees where you represent a country, in crisis you often represent a named individual with a specific role, agenda, and portfolio of assets.</p>

            <h2 style={s.h2}>Frontroom vs. Backroom</h2>
            <p style={s.p}>Crisis committees operate on two tracks simultaneously:</p>
            <h3 style={s.h3}>Frontroom (Committee)</h3>
            <p style={s.p}>The formal committee session where delegates debate, pass directives, and respond to crisis updates collectively. It looks similar to a standard MUN committee (speakers lists, motions, caucuses) but moves faster and the content reacts to live updates.</p>
            <h3 style={s.h3}>Backroom (Personal Portfolio)</h3>
            <p style={s.p}>Each delegate also has a personal portfolio: the resources, relationships, and powers specific to their character. During unmoderated caucuses, delegates submit personal directives to the crisis staff: secret orders to assets, private communications, covert operations. The crisis staff evaluates these directives and may grant, deny, or modify the outcomes, feeding the results back into the scenario.</p>
            <div style={s.callout}><p style={s.calloutText}>The best crisis delegates play both games simultaneously: leading frontroom debate while running a strategic backroom operation that advances their character's personal agenda.</p></div>

            <h2 style={s.h2}>What Is a Directive?</h2>
            <p style={s.p}>A directive is a written order submitted to the crisis staff, either as a collective committee directive (voted on like a resolution) or as a personal backroom directive. Directives typically instruct specific assets or officials to take actions: "Deploy the 3rd Infantry Division to the northern border," or "Transfer $2M from the discretionary fund to the offshore account."</p>
            <p style={s.p}>The crisis staff responds to directives by updating the scenario. A well-written directive is specific, realistic within the scenario's rules, and accounts for potential failure. Vague directives ("deal with the situation in the north") get vague results.</p>

            <h2 style={s.h2}>How Crisis Arcs Work</h2>
            <p style={s.p}>The crisis staff pre-plans a broad narrative arc: an escalating series of events designed to challenge the committee. But skilled crisis directors adapt the arc in real time based on how delegates respond. If the committee makes an unexpectedly brilliant move, the arc adjusts. If delegates miss a key signal, the crisis escalates. The best crisis scenarios feel genuinely unpredictable because they partially are.</p>

            <h2 style={s.h2}>Performing Well in Crisis</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Know your character cold.</strong> Read the background guide and character sheet thoroughly. What does your character want? What resources do they control? Who are their allies and enemies?</li>
              <li style={s.li}><strong>Be specific in directives.</strong> "Activate Agent CARDINAL to surveil the finance minister's communications via SIGINT intercepts" is actionable. "Find out what the finance minister is doing" is not.</li>
              <li style={s.li}><strong>Build coalitions early.</strong> Even in crisis, you need allies. Find delegates whose characters have compatible interests and coordinate both frontroom positions and backroom operations.</li>
              <li style={s.li}><strong>Take risks.</strong> Crisis rewards bold action. A clever backroom move that partially fails is more impressive than safe, conservative play.</li>
              <li style={s.li}><strong>Respond to the crisis, not just to debate.</strong> When a crisis update arrives, read it carefully and react to the specific developments. Do not just continue making your pre-planned arguments.</li>
            </ul>

            <h2 style={s.h2}>Common Crisis Formats</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Cabinet crisis:</strong> The committee is a national cabinet managing a domestic or international emergency.</li>
              <li style={s.li}><strong>Historical crisis:</strong> A council set in a historical moment (the Cuban Missile Crisis, WWII-era cabinet, Cold War intelligence committee).</li>
              <li style={s.li}><strong>Corporate crisis:</strong> A board of directors navigating a scandal, merger, or market collapse.</li>
              <li style={s.li}><strong>Continuous crisis (JCC):</strong> Two linked committees, Joint Crisis Committees, that interact with each other through the crisis staff, often representing opposing sides of a conflict.</li>
            </ul>

            <RelatedGuides currentSlug="mun-crisis-committee-guide" />
            <div style={s.cta}>
              <p style={s.ctaText}>Run your MUN sessions, crisis or GA, with Gavelling's real-time committee management platform.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
