import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Director Guide: How to Run a Model UN Conference',
  description:
    'A complete guide for MUN secretariat directors: planning the conference, assigning committees, briefing chairs, managing logistics, and running a smooth event.',
  path: '/blog/mun-director-guide',
  ogDescription:
    'The complete secretariat guide to directing a Model UN conference.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Director Guide: How to Run a Model UN Conference',
  description: 'Complete guide for MUN conference directors.',
  url: 'https://gavelling.com/blog/mun-director-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
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

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-director-guide"
        pitch="Set up all your conference committees in Gavelling before conference day: sessions, delegates, and settings ready to go."
      >

        <p>Directing a Model UN conference is one of the most complex leadership experiences available to students. You are responsible for every committee running simultaneously, dozens of chair relationships, hundreds of delegates, venue logistics, and the overall quality of the academic and social programme. This guide covers the full arc, from initial planning to post-conference wrap-up.</p>

        <H2>What Does a MUN Director Do?</H2>
        <p>The director (sometimes called Secretary-General, Director-General, or simply the conference head depending on your secretariat structure) is responsible for the overall conference programme. Specific responsibilities typically include:</p>
        <ul>
          <li>Selecting committee topics and assigning country allocations</li>
          <li>Recruiting and managing the dais staff (chairs, co-chairs, crisis directors)</li>
          <li>Overseeing background guide production</li>
          <li>Managing delegate registration and school liaison</li>
          <li>Running the awards process and ensuring consistency across committees</li>
          <li>Coordinating venue logistics, scheduling, and technology</li>
        </ul>

        <H2>Six Months Out: Setting the Foundation</H2>
        <H3>Choose Your Committees</H3>
        <p>Select a committee roster that balances accessibility (GA committees most delegates can prepare for) with prestige (specialised agencies, Security Council, crisis committees). A typical medium-sized conference might have three to five GA committees, one UNSC, one specialised agency, and one crisis committee.</p>
        <H3>Choose Your Topics</H3>
        <p>Good MUN topics are: timely (connected to real current events), debatable (genuine disagreement between country blocs), and actionable (the committee can actually do something about it). Avoid topics that are too resolved (unanimous agreement on causes and solutions) or too intractable (no possible middle ground).</p>
        <Callout>Test a topic by trying to outline three clearly different bloc positions. If you cannot, the topic is either too consensus-heavy or too niche. Strong topics produce natural bloc diversity.</Callout>

        <H2>Four Months Out: Building Your Team</H2>
        <p>Recruit chairs early. Your best chairs are experienced delegates who understand procedure cold, can manage a room, and are genuinely interested in the topic. Brief chairs on:</p>
        <ul>
          <li>Your conference&apos;s rules of procedure (distribute the document, do not assume they know)</li>
          <li>The expected committee output (one resolution? multiple? working papers?)</li>
          <li>Awards criteria (what should they look for?)</li>
          <li>Technology they will use to run their committee (software, projector, timer setup)</li>
        </ul>

        <H2>Three Months Out: Background Guides</H2>
        <p>Background guides should be published at least six to eight weeks before the conference to give delegates adequate preparation time. Each guide should cover: committee mandate and history, topic background, key country positions, and guiding questions. Aim for ten to fifteen pages per topic: long enough to be substantive, short enough to be read.</p>
        <p>Review every background guide before publication. Factual errors in background guides undermine chair credibility and frustrate well-prepared delegates.</p>

        <H2>One Month Out: Registration and Logistics</H2>
        <ul>
          <li><strong>Confirm delegate registrations</strong> and assign countries. Try to match country allocations to school or team size, since larger delegations should get more committee slots.</li>
          <li><strong>Confirm venue layouts</strong>: committee room sizes, projector availability, power access, WiFi.</li>
          <li><strong>Set up committee management software.</strong> Gavelling allows directors to create committee sessions in advance, with co-chair access codes, delegate lists, and settings pre-configured before conference day.</li>
          <li><strong>Brief your dais team in full.</strong> Run a mock committee session with your chairs if possible.</li>
        </ul>

        <H2>Conference Day: Director Operations</H2>
        <p>On conference day, your primary job is problem-solving. Committees will have issues: a chair goes absent, a room has no projector, two committees request the same delegate for a joint crisis session. Keep a live list of all open issues and assign team members to resolve them.</p>
        <p>Visit every committee room at least once per session. A brief appearance from the director signals to delegates that the secretariat cares about quality. It also lets you catch problems (a committee that is too quiet, a chair who is struggling, a bloc that has completely stalled) before they become crises.</p>

        <H2>Awards</H2>
        <p>Brief chairs on awards criteria well in advance. Decide: will you give Best Delegate, Outstanding Delegate, Honourable Mention, and Verbal Commendation in every committee? Will crisis committees use a different system? Will you give a Best Position Paper award? Consistency matters. Delegates and advisors notice when award criteria appear arbitrary.</p>
        <p>Collect chair recommendations privately, cross-check for conflicts of interest, and ensure award distribution is reasonably spread across schools rather than concentrated.</p>

        <H2>Post-Conference</H2>
        <p>Send a post-conference survey to delegates, chairs, and faculty advisors within one week. The feedback you receive in the days immediately after a conference is far more useful than what you remember months later. Use it to improve your next event.</p>
      </ArticleLayout>
    </>
  );
}
