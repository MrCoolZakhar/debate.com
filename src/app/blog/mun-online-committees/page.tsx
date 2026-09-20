import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Online MUN Committees: How to Chair and Participate Remotely',
  description:
    'Everything about running online Model UN committees: video platforms, managing procedure remotely, keeping delegates engaged, and tools that work for virtual MUN.',
  path: '/blog/mun-online-committees',
  ogDescription:
    'The complete guide to online and hybrid MUN committees.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Online MUN Committees: How to Chair and Participate Remotely',
  description: 'Complete guide to online and hybrid MUN committees.',
  url: 'https://gavelling.com/blog/mun-online-committees',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
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

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-online-committees"
        pitch="Gavelling works for in-person, online, and hybrid MUN committees: delegates join from any device."
      >
        <p>Online MUN has moved from a pandemic emergency measure to a permanent fixture of the global MUN landscape. Conferences in 2026 range from fully in-person to fully virtual to hybrid models where some delegates attend in-room and others join remotely. Each format presents distinct challenges for chairs and delegates. This guide covers how to make online committee sessions work.</p>

        <H2>Why Online MUN Is Genuinely Harder</H2>
        <p>Running a committee remotely is not simply a physical committee moved to video call. The mechanics are different in ways that catch many chairs off guard:</p>
        <ul>
          <li><strong>You cannot see the room.</strong> In person, a chair sees sixty faces and knows instantly if energy has dropped or if two delegates are negotiating. On video, you see twenty thumbnails and miss most non-verbal information.</li>
          <li><strong>Placard raises do not work.</strong> You need a replacement mechanism for delegates to signal they want to speak.</li>
          <li><strong>Unmoderated caucuses are awkward.</strong> Breaking 60 people into negotiating groups on video call requires breakout room management that most chairs are not prepared for.</li>
          <li><strong>Technical issues consume committee time.</strong> Audio drops, connection problems, and screen share failures collectively steal significant minutes from every session.</li>
        </ul>

        <H2>Essential Setup for Online Chairs</H2>
        <ul>
          <li><strong>A reliable committee management platform.</strong> Gavelling works equally well for online committees: delegates join via their phone or laptop, add themselves to the speakers list digitally, and see the timer in real time. This replaces placard raises entirely.</li>
          <li><strong>A stable video conferencing platform.</strong> Zoom is standard at most online conferences. Microsoft Teams and Google Meet are alternatives. Have a backup plan for your backup plan, because these platforms still fail.</li>
          <li><strong>A dedicated co-chair to manage tech.</strong> One chair runs debate; the other manages the waiting room, mutes unmuted delegates, manages breakout rooms, and handles technical support tickets. Never try to do both alone.</li>
          <li><strong>A clear "raise hand" protocol.</strong> Use Zoom's raise hand feature or a reaction emoji as the replacement for placard raises. Announce the protocol at the start of every session.</li>
        </ul>

        <H2>Managing the GSL Online</H2>
        <p>Opening the speakers list online works best through a committee management platform rather than a video chat chat box. Delegates request to speak through Gavelling, which queues them in order. The chair does not need to monitor a scrolling chat feed and can focus on the delegate currently speaking.</p>
        <Callout>Never use the video chat box as your speakers list. It scrolls, names get lost, and the chair ends up missing delegates. Use a dedicated platform.</Callout>

        <H2>Online Moderated Caucuses</H2>
        <p>Online moderated caucuses work almost identically to in-person: the chair unmutes the speaker, starts the timer, and calls the next delegate when time expires. The main difference: explicitly mute speakers when their time expires rather than relying on them to stop talking. Online environments make over-running more common because there is no physical gavel cue.</p>

        <H2>Online Unmoderated Caucuses</H2>
        <p>This is where online MUN most struggles. The natural coalition-building of an in-person unmod (walking up to someone, having a two-minute conversation) does not translate to a 60-person Zoom call. Approaches that work:</p>
        <ul>
          <li><strong>Pre-assigned breakout rooms.</strong> Create rooms labelled by bloc name or working paper number before the session. During the unmod, send delegates to their relevant room and circulate between rooms as a chair.</li>
          <li><strong>Use the main room for cross-bloc negotiation.</strong> Let smaller blocs use the main room while larger groups go to breakout rooms.</li>
          <li><strong>Shorter unmods.</strong> Thirty-minute unmods that work in person often need to be broken into two fifteen-minute periods online to maintain energy.</li>
        </ul>

        <H2>Keeping Delegates Engaged</H2>
        <p>Attention drops faster online than in person. Counter this with:</p>
        <ul>
          <li><strong>More frequent caucuses.</strong> Alternate formal debate and caucus periods more often than you would in person.</li>
          <li><strong>Call on delegates by name, not just country.</strong> This keeps people alert, since anyone might be next.</li>
          <li><strong>Use the chat.</strong> Drop document links, ask for real-time reactions, have co-chairs answer questions in the chat while you chair.</li>
          <li><strong>Shorter sessions with breaks.</strong> Four-hour online committee sessions are brutal. Two hours, break, two hours is far more productive.</li>
        </ul>

        <H2>Hybrid Committees</H2>
        <p>Hybrid committees, where some delegates are in-room and others are remote, are the hardest format to run well. The in-room delegates have natural advantages (easier to get the chair's attention, more energy, better audio). Compensate by actively calling on remote delegates during debate and giving them explicit priority during caucus slot allocation.</p>
      </ArticleLayout>
    </>
  );
}
