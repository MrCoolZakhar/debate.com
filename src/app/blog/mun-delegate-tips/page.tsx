import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MUN Delegate Tips — How to Stand Out in Any Committee',
  description: 'Practical MUN delegate tips for beginners and experienced delegates: how to research, speak, build blocs, draft resolutions, and win best delegate.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-delegate-tips' },
  openGraph: {
    title: 'MUN Delegate Tips — How to Stand Out in Any Committee',
    description: 'The practical delegate playbook for Model UN success.',
    url: 'https://gavelling.com/blog/mun-delegate-tips',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Delegate Tips — How to Stand Out in Any Committee',
  description: 'Practical tips for MUN delegates at all levels.',
  url: 'https://gavelling.com/blog/mun-delegate-tips',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-delegate-tips' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Delegate Tips', item: 'https://gavelling.com/blog/mun-delegate-tips' },
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
          <a href="/blog" style={s.back}>← MUN Resources</a>
          <h1 style={s.h1}>MUN Delegate Tips — How to Stand Out in Any Committee</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 11 min read</p>
          <article style={s.article}>

            <p style={s.p}>Every delegate walks into committee wanting to make an impact. Few do. The gap between a forgettable delegate and one who earns Best Delegate is rarely about intelligence or knowledge — it is almost always about preparation, strategy, and presence. These tips apply whether you are attending your first conference or your fifteenth.</p>

            <h2 style={s.h2}>Before the Conference: Research Like a Diplomat</h2>
            <p style={s.p}>The single biggest differentiator in MUN is preparation. Delegates who know their country's position cold can spend committee time on strategy instead of scrambling to figure out what they believe.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Read your country's UN voting record.</strong> The UN Digital Library and Dag Hammarskjöld Library both have full voting records. How has your country voted on similar resolutions in the last five years?</li>
              <li style={s.li}><strong>Find your country's official statements.</strong> Ministry of Foreign Affairs websites often publish speeches given at UN sessions. These are gold — they tell you exactly how your country phrases its positions.</li>
              <li style={s.li}><strong>Know the topic cold, not just your position.</strong> The best delegates can explain every major bloc's perspective, not just their own. This makes you a more effective negotiator.</li>
              <li style={s.li}><strong>Read the background guide.</strong> It exists for a reason. Chairs write questions to guide. Read it and answer every question from your country's perspective.</li>
            </ul>

            <h2 style={s.h2}>Your Opening Speech: Make It Count</h2>
            <p style={s.p}>The opening speech (GSL speech) is your first impression. Most delegates use it to summarise their country's general position. Good delegates use it to signal leadership and attract bloc members.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>State your position clearly in the first thirty seconds.</strong> Do not make delegates guess where you stand.</li>
              <li style={s.li}><strong>Propose something.</strong> Even a vague framework ("Denmark proposes a three-pillar approach to climate adaptation financing") gives other delegates something to react to and rally around.</li>
              <li style={s.li}><strong>End with a call to action.</strong> "Denmark invites like-minded delegations to collaborate on a working paper addressing these priorities" signals that you are ready to lead.</li>
            </ul>
            <div style={s.callout}><p style={s.calloutText}>Sixty seconds is enough time for a strong opening speech. Do not pad it. Say what your country believes, what you propose, and who you want to work with. Sit down.</p></div>

            <h2 style={s.h2}>Building a Bloc: The Real Game</h2>
            <p style={s.p}>Most awards go to delegates who drive resolution drafting. That requires a bloc. Here is how to build one:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Approach delegates during unmoderated caucuses, not formal debate.</strong> Walk up, introduce yourself by country, and ask their position on the key issue. Keep it short.</li>
              <li style={s.li}><strong>Find common ground first.</strong> Even opposing blocs usually agree on the problem. Start there and work outward to solutions.</li>
              <li style={s.li}><strong>Be the one who starts the draft.</strong> Any working paper, even a rough one, draws people to you. Blank Google Docs have no gravity.</li>
              <li style={s.li}><strong>Be inclusive deliberately.</strong> Invite one or two delegates from opposing blocs into your working paper. This strengthens your resolution and earns the chair's respect.</li>
            </ul>

            <h2 style={s.h2}>Speaking in Debate: Quality Over Quantity</h2>
            <p style={s.p}>A common mistake is raising your placard for every speaking slot regardless of what you have to say. Chairs and fellow delegates notice when speeches are filler. Say something substantive, or yield your time.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Respond to what was just said.</strong> The most impactful speeches directly engage with the previous speaker's argument. This shows you are listening, not just waiting to speak.</li>
              <li style={s.li}><strong>Use specific data.</strong> Numbers anchor arguments. "Over 800 million people lack access to safe drinking water" lands harder than "many people face water scarcity."</li>
              <li style={s.li}><strong>Propose concrete operative clauses.</strong> Do not just describe the problem — propose a solution. This advances the committee's work and marks you as a constructive delegate.</li>
            </ul>

            <h2 style={s.h2}>Points and Motions: Use Them Strategically</h2>
            <p style={s.p}>Points of information, points of order, and motions are procedural tools. Used well, they show command of the room. Used poorly, they signal desperation or inexperience.</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Points of information:</strong> Ask a genuine clarifying question, not a disguised speech. Chairs respect brevity.</li>
              <li style={s.li}><strong>Motions for a moderated caucus:</strong> Propose one when formal debate has stalled and your bloc needs to make a specific argument in a focused setting.</li>
              <li style={s.li}><strong>Motion to extend the speakers list:</strong> Use this when you have not yet spoken and want to make sure you get a slot.</li>
            </ul>

            <h2 style={s.h2}>What Chairs Notice When Awarding Best Delegate</h2>
            <p style={s.p}>Awards vary by conference, but most chairs are looking for the same things: substantive contribution to debate, leadership in bloc-building, quality of resolution language, adherence to rules of procedure, and consistent, respectful engagement with all delegates — not just your allies.</p>
            <p style={s.p}>Being the loudest is not the same as being the best. The delegate who quietly drafts an amendment that bridges two opposing blocs often impresses more than the one who gives six speeches.</p>

            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling gives delegates real-time visibility into their queue position and speaking time.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
