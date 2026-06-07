import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Online MUN Committees — How to Chair and Participate Remotely',
  description: 'Everything about running online Model UN committees: video platforms, managing procedure remotely, keeping delegates engaged, and tools that work for virtual MUN.',
  alternates: { canonical: 'https://gavelling.com/blog/mun-online-committees' },
  openGraph: {
    title: 'Online MUN Committees — How to Chair and Participate Remotely',
    description: 'The complete guide to online and hybrid MUN committees.',
    url: 'https://gavelling.com/blog/mun-online-committees',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Online MUN Committees — How to Chair and Participate Remotely',
  description: 'Complete guide to online and hybrid MUN committees.',
  url: 'https://gavelling.com/blog/mun-online-committees',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-online-committees' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Online MUN Committees', item: 'https://gavelling.com/blog/mun-online-committees' },
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
          <h1 style={s.h1}>Online MUN Committees — How to Chair and Participate Remotely</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>
            <p style={s.p}>Online MUN has moved from a pandemic emergency measure to a permanent fixture of the global MUN landscape. Conferences in 2026 range from fully in-person to fully virtual to hybrid models where some delegates attend in-room and others join remotely. Each format presents distinct challenges for chairs and delegates. This guide covers how to make online committee sessions work.</p>

            <h2 style={s.h2}>Why Online MUN Is Genuinely Harder</h2>
            <p style={s.p}>Running a committee remotely is not simply a physical committee moved to video call. The mechanics are different in ways that catch many chairs off guard:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>You cannot see the room.</strong> In person, a chair sees sixty faces and knows instantly if energy has dropped or if two delegates are negotiating. On video, you see twenty thumbnails and miss most non-verbal information.</li>
              <li style={s.li}><strong>Placard raises do not work.</strong> You need a replacement mechanism for delegates to signal they want to speak.</li>
              <li style={s.li}><strong>Unmoderated caucuses are awkward.</strong> Breaking 60 people into negotiating groups on video call requires breakout room management that most chairs are not prepared for.</li>
              <li style={s.li}><strong>Technical issues consume committee time.</strong> Audio drops, connection problems, and screen share failures collectively steal significant minutes from every session.</li>
            </ul>

            <h2 style={s.h2}>Essential Setup for Online Chairs</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>A reliable committee management platform.</strong> Gavelling works equally well for online committees — delegates join via their phone or laptop, add themselves to the speakers list digitally, and see the timer in real time. This replaces placard raises entirely.</li>
              <li style={s.li}><strong>A stable video conferencing platform.</strong> Zoom is standard at most online conferences. Microsoft Teams and Google Meet are alternatives. Have a backup plan for your backup plan — these platforms still fail.</li>
              <li style={s.li}><strong>A dedicated co-chair to manage tech.</strong> One chair runs debate; the other manages the waiting room, mutes unmuted delegates, manages breakout rooms, and handles technical support tickets. Never try to do both alone.</li>
              <li style={s.li}><strong>A clear "raise hand" protocol.</strong> Use Zoom's raise hand feature or a reaction emoji as the replacement for placard raises. Announce the protocol at the start of every session.</li>
            </ul>

            <h2 style={s.h2}>Managing the GSL Online</h2>
            <p style={s.p}>Opening the speakers list online works best through a committee management platform rather than a video chat chat box. Delegates request to speak through Gavelling, which queues them in order — the chair does not need to monitor a scrolling chat feed and can focus on the delegate currently speaking.</p>
            <div style={s.callout}><p style={s.calloutText}>Never use the video chat box as your speakers list. It scrolls, names get lost, and the chair ends up missing delegates. Use a dedicated platform.</p></div>

            <h2 style={s.h2}>Online Moderated Caucuses</h2>
            <p style={s.p}>Online moderated caucuses work almost identically to in-person — the chair unmutes the speaker, starts the timer, and calls the next delegate when time expires. The main difference: explicitly mute speakers when their time expires rather than relying on them to stop talking. Online environments make over-running more common because there is no physical gavel cue.</p>

            <h2 style={s.h2}>Online Unmoderated Caucuses</h2>
            <p style={s.p}>This is where online MUN most struggles. The natural coalition-building of an in-person unmod — walking up to someone, having a two-minute conversation — does not translate to a 60-person Zoom call. Approaches that work:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Pre-assigned breakout rooms.</strong> Create rooms labelled by bloc name or working paper number before the session. During the unmod, send delegates to their relevant room and circulate between rooms as a chair.</li>
              <li style={s.li}><strong>Use the main room for cross-bloc negotiation.</strong> Let smaller blocs use the main room while larger groups go to breakout rooms.</li>
              <li style={s.li}><strong>Shorter unmods.</strong> Thirty-minute unmods that work in person often need to be broken into two fifteen-minute periods online to maintain energy.</li>
            </ul>

            <h2 style={s.h2}>Keeping Delegates Engaged</h2>
            <p style={s.p}>Attention drops faster online than in person. Counter this with:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>More frequent caucuses.</strong> Alternate formal debate and caucus periods more often than you would in person.</li>
              <li style={s.li}><strong>Call on delegates by name, not just country.</strong> This keeps people alert — anyone might be next.</li>
              <li style={s.li}><strong>Use the chat.</strong> Drop document links, ask for real-time reactions, have co-chairs answer questions in the chat while you chair.</li>
              <li style={s.li}><strong>Shorter sessions with breaks.</strong> Four-hour online committee sessions are brutal. Two hours, break, two hours is far more productive.</li>
            </ul>

            <h2 style={s.h2}>Hybrid Committees</h2>
            <p style={s.p}>Hybrid committees — where some delegates are in-room and others are remote — are the hardest format to run well. The in-room delegates have natural advantages (easier to get the chair's attention, more energy, better audio). Compensate by actively calling on remote delegates during debate and giving them explicit priority during caucus slot allocation.</p>

            <div style={s.cta}>
              <p style={s.ctaText}>Gavelling works for in-person, online, and hybrid MUN committees — delegates join from any device.</p>
              <a href="https://gavelling.com" style={s.ctaLink}>Try Gavelling free →</a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
