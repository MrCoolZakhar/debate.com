import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Public Speaking Tips: How to Speak Confidently in Committee',
  description: 'Practical public speaking tips for Model UN delegates: how to structure speeches, manage nerves, use your voice effectively, and make every speech count.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-public-speaking-tips' },
  openGraph: {
    title: 'MUN Public Speaking Tips: How to Speak Confidently in Committee',
    description: 'Master public speaking for MUN with these practical techniques.',
    url: 'https://gavelling.com/blog/mun-public-speaking-tips',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Public Speaking Tips: How to Speak Confidently in Committee',
  description: 'Public speaking tips for MUN delegates.',
  url: 'https://gavelling.com/blog/mun-public-speaking-tips',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-public-speaking-tips' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Public Speaking Tips', item: 'https://gavelling.com/blog/mun-public-speaking-tips' },
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
          <h1 style={s.h1}>MUN Public Speaking Tips: How to Speak Confidently in Committee</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 9 min read</p>
          <article style={s.article}>

            <p style={s.p}>Standing up to address a committee of seventy delegates is nerve-wracking for almost everyone the first time. The good news: effective MUN speaking is a learnable skill, not a personality trait. These techniques work for introverts and extroverts alike, and they improve quickly with practice.</p>

            <h2 style={s.h2}>The Structure Every MUN Speech Needs</h2>
            <p style={s.p}>Rambling speeches lose the room. Every MUN speech (regardless of length) should have three components: a hook, a body, and a close.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Hook (5 seconds):</strong> Grab attention immediately. A striking statistic, a direct statement of position, or a challenge to the previous speaker. "Over 100 million people are currently displaced, more than at any point since World War II."</li>
              <li style={s.li}><strong>Body (45 seconds):</strong> Your argument. One or two points maximum in a sixty-second speech. Do not try to say everything.</li>
              <li style={s.li}><strong>Close (10 seconds):</strong> A call to action or a clear statement of what your delegation supports. "France urges this committee to adopt a legally binding framework, and invites like-minded delegations to co-sponsor our working paper."</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>The most common mistake: trying to say too much. One clear argument, delivered well, is more persuasive than five arguments delivered nervously. Cut until it hurts.</p></div>

            <h2 style={s.h2}>Managing Nerves</h2>
            <p style={s.p}>Nerves are not the enemy. Unmanaged nerves are. A small amount of adrenaline actually improves performance. Here is how to keep it manageable:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Breathe before you stand.</strong> Take two slow breaths before getting up. This lowers your heart rate noticeably and gives your voice time to settle.</li>
              <li style={s.li}><strong>Plant your feet.</strong> Stand with feet shoulder-width apart. Do not sway or shift weight. It signals nervousness to the audience even when your voice sounds fine.</li>
              <li style={s.li}><strong>Speak slower than feels natural.</strong> When nervous, people speed up. Consciously slow down by about 20%. It feels odd from the inside but sounds authoritative from the outside.</li>
              <li style={s.li}><strong>Know your first sentence cold.</strong> Most nervousness peaks in the first ten seconds. If you know your opener word-for-word, the rest becomes easier once you are into it.</li>
            </ul>

            <h2 style={s.h2}>Using Your Voice</h2>
            <p style={s.p}>In a large conference room, volume and clarity matter more than eloquence. Chairs are assessing whether you sound confident, not whether you sound like a broadcast journalist.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Project to the back wall.</strong> Imagine the last row of the room and speak to them. This automatically raises your volume without shouting.</li>
              <li style={s.li}><strong>Pause deliberately.</strong> A one-second pause before a key point makes it land harder. It also gives you a moment to remember what comes next without fumbling.</li>
              <li style={s.li}><strong>Vary your pace.</strong> Say important facts slowly. Use normal speed for transitions. The variation holds attention.</li>
              <li style={s.li}><strong>Do not apologise.</strong> Avoid openers like "I just wanted to say..." or "Sorry, I think..." Start with your point.</li>
            </ul>

            <h2 style={s.h2}>Responding in the Moment</h2>
            <p style={s.p}>Planned speeches are one thing. Spontaneous responses to what another delegate just said are another, and they are what separates good delegates from great ones. When you have thirty seconds to formulate a rebuttal:</p>
            <ul style={s.ul}>
              <li style={s.li}>Identify the one thing you disagree with most strongly. Do not try to rebut everything.</li>
              <li style={s.li}>Name the specific claim: "The delegate of Russia asserted that sanctions have been ineffective. The evidence contradicts this."</li>
              <li style={s.li}>Offer one piece of counter-evidence or reasoning.</li>
              <li style={s.li}>State your alternative position.</li>
            </ul>

            <h2 style={s.h2}>Eye Contact and Body Language</h2>
            <p style={s.p}>Look at the committee, not your notes. This is the single most powerful change most delegates can make. You may need notes for statistics and specific facts, so glance at them briefly, then look back up. Sustained eye contact with different sections of the room signals confidence and keeps people engaged.</p>
            <p style={s.p}>Avoid crossing your arms, looking at the floor, or gripping the podium. Open posture (shoulders back, arms at your sides or resting lightly) communicates that you belong at the podium.</p>

            <h2 style={s.h2}>Practise by Watching Others</h2>
            <p style={s.p}>Search for recordings of real UN speeches and MUN award-winning speeches. Watch what effective speakers do differently. Pay attention to pace, structure, and how they handle transitions. Then practise with a timer in front of a mirror or a trusted classmate who will give honest feedback.</p>

            <RelatedGuides currentSlug="mun-public-speaking-tips" />
            <div style={s.cta}>
              <p style={s.ctaText}>Track your speaking time and queue position with Gavelling during your next committee session.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
