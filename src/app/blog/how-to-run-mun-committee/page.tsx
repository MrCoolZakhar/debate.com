import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3 } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: "How to Run a Model UN Committee: Chair's Complete Guide (2026)",
  description:
    'Everything a MUN chair needs to run a professional committee session: opening procedures, roll call, General Speakers List, motions, caucuses, and voting. Step-by-step guide.',
  path: '/blog/how-to-run-mun-committee',
  ogDescription:
    'Everything a MUN chair needs to run a professional committee session.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "How to Run a Model UN Committee: Chair's Complete Guide (2026)",
  description: 'Everything a MUN chair needs to run a professional committee session: opening procedures, roll call, General Speakers List, motions, caucuses, and voting.',
  url: 'https://gavelling.com/blog/how-to-run-mun-committee',
  datePublished: '2026-06-01',
  dateModified: '2026-06-01',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/how-to-run-mun-committee' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Run a MUN Committee', item: 'https://gavelling.com/blog/how-to-run-mun-committee' },
  ],
};

export default function Article1() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="how-to-run-mun-committee"
        pitch="Gavelling automates roll call, GSL queue, motion tracking, and voting, so you can focus on running a great debate."
      >

        <p>
          Chairing a Model UN committee is one of the most rewarding roles in the MUN experience, and one of the most demanding. You are simultaneously a facilitator, timekeeper, procedural authority, and energy manager. This guide walks you through every stage of a committee session, from your first gavel strike to adjournment. For the energy side of the job, read our guide to <Link href="/blog/mun-controlling-the-floor" style={{ color: '#1B3828', fontWeight: 600 }}>controlling the floor</Link>.
        </p>

        <H2>1. Before the Session: Preparation</H2>
        <p>
          The quality of a committee session is largely determined before it starts. Chairs who walk in prepared radiate confidence; chairs who improvise burn energy managing avoidable chaos. It also helps to know in advance <Link href="/blog/mun-difficult-delegates" style={{ color: '#1B3828', fontWeight: 600 }}>how to handle difficult delegates</Link>.
        </p>
        <H3>Know your rules of procedure</H3>
        <p>
          Different conferences use different rules of procedure: <Link href="/blog/thimun-rules-of-procedure" style={{ color: '#1B3828', fontWeight: 600 }}>THIMUN</Link>, HMUN, ILMUNC, or a conference-specific variant. Read yours cover to cover before the session. The most important things to memorise: voting thresholds for each motion type, the order of precedence for motions, and how to handle Points of Order vs Points of Information.
        </p>
        <H3>Prepare your delegate roster and committee topic</H3>
        <p>
          Know which delegations are in your committee and have your attendance sheet ready. Read the study guide, understand the key fault lines in the debate, and anticipate the motions delegates are likely to raise. The more you know the topic, the less effort you spend thinking during the session.
        </p>
        <H3>Set up your session in advance</H3>
        <p>
          Using a digital tool like <strong>Gavelling</strong> lets you pre-load your delegate roster, set speaking times, and configure voting thresholds before you walk into the room. Delegates receive a 6-character session code and join on their own devices: no downloads, no paper lists. Setting this up the evening before means your opening is seamless.
        </p>

        <H2>2. Opening the Session: Roll Call</H2>
        <p>
          Every committee session begins with roll call. Its purpose is to establish quorum: the minimum number of delegates required to conduct official business (typically a simple majority of the total delegation count).
        </p>
        <H3>Calling each delegation</H3>
        <p>
          The chair calls each delegation alphabetically. Delegates respond with one of three statuses:
        </p>
        <ul>
          <li><strong>Present</strong>: the delegate is attending and will participate in debate, but may abstain on substantive votes.</li>
          <li><strong>Present and Voting (P+V)</strong>: the delegate is present and commits to voting For or Against on all substantive matters. They cannot abstain.</li>
          <li><strong>Absent</strong>: not present at this time.</li>
        </ul>
        <H3>Calculating quorum</H3>
        <p>
          Quorum is typically 50% + 1 of total delegations. If you have 20 delegations, you need at least 11 present to proceed. If quorum is not met, the chair typically recesses the session briefly and takes attendance again after a short wait. If quorum still cannot be met, the session may be postponed.
        </p>

        <H2>3. Setting the Agenda</H2>
        <p>
          When a committee has more than one topic, the agenda must be set before debate begins. A delegate motions to set the agenda with a specific topic first. The motion requires a second, then a simple majority vote. Once passed, the committee proceeds to debate on that topic.
        </p>
        <p>
          Single-topic committees can skip this step and move directly to opening the General Speakers List.
        </p>

        <H2>4. General Speakers List (GSL)</H2>
        <p>
          The General Speakers List is the primary debate mechanism in Model UN. It is a standing queue of delegates who wish to address the committee on the topic. Once the agenda is set, the chair opens the GSL and delegates add themselves by raising their placards.
        </p>
        <H3>How delegates add themselves</H3>
        <p>
          Delegates raise their placard when the chair asks for additions to the GSL. The chair (or co-chair) notes each delegation in order. In Gavelling, delegates can request to speak directly from their device and the chair approves additions with one tap.
        </p>
        <H3>Speaking time</H3>
        <p>
          Speaking time is set by the committee via motion, typically 60–90 seconds per delegate for a standard committee session. The chair strictly enforces the time limit to ensure fairness.
        </p>
        <H3>Yielding time</H3>
        <p>
          When a delegate finishes early, they may yield remaining time in three ways:
        </p>
        <ul>
          <li><strong>Yield to the chair</strong>: time is lost; the next speaker is called.</li>
          <li><strong>Yield to another delegate</strong>: the named delegate speaks for the remaining time.</li>
          <li><strong>Yield to points/questions</strong>: the floor is opened for a brief question from another delegate.</li>
        </ul>
        <p>
          The GSL continues throughout the session, paused when a caucus motion passes, and resumed when the caucus ends. Unlike caucus queues, the GSL is never wiped. It persists until the session closes.
        </p>

        <H2>5. Moderated and Unmoderated Caucuses</H2>
        <p>
          Caucuses are temporary departures from the GSL to allow more focused discussion. There are two types.
        </p>
        <H3>Moderated Caucus</H3>
        <p>
          A delegate motions for a moderated caucus, specifying a topic, a total time (e.g. 10 minutes), and a per-speaker time (e.g. 90 seconds). The motion requires a simple majority. If passed, the chair runs a mini-speakers list within the caucus: delegates raise their placards, the chair calls them in order, and a separate timer tracks each speaker.
        </p>
        <p>
          Moderated caucuses are best for focused, substantive debate on a specific sub-topic. They create structure while allowing more speakers than an unmoderated session.
        </p>
        <H3>Unmoderated Caucus</H3>
        <p>
          An unmod specifies only a total time (e.g. 15 minutes). There is no formal speaker list. Delegates leave their seats and negotiate informally. Unmods are essential for writing working papers, building blocs, and lobbying.
        </p>
        <p>
          As chair, set a timer and call the committee back to order when time expires. If delegates are in the middle of productive work, the chair may entertain a motion to extend.
        </p>
        <p>
          See also: <Link href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</Link> for the full rules on caucus motions.
        </p>

        <H2>6. Voting Procedures</H2>
        <p>
          MUN committees vote on two categories of matter: procedural votes (motions) and substantive votes (draft resolutions).
        </p>
        <H3>Procedural votes</H3>
        <p>
          Motions (to enter a caucus, extend speaking time, set the agenda, adjourn) are procedural. They typically require a simple majority (50% + 1 of votes cast). Abstentions are not permitted on procedural votes in most rules of procedure.
        </p>
        <H3>Substantive votes</H3>
        <p>
          Draft resolutions are substantive. Depending on the committee&apos;s rules, passage may require a simple majority or a two-thirds supermajority of delegates present and voting. P+V delegates must vote For or Against. They cannot abstain.
        </p>
        <H3>Security Council vetoes</H3>
        <p>
          In the UN Security Council, any of the five permanent members (China, France, Russia, UK, USA) can veto a substantive resolution by voting Against, regardless of how other members vote. A single P5 Against vote defeats the resolution. Our <Link href="/blog/mun-security-council-guide" style={{ color: '#1B3828', fontWeight: 600 }}>Security Council guide</Link> covers this in detail.
        </p>

        <H2>7. Closing the Session</H2>
        <p>
          At the end of a session, a delegate typically motions to adjourn the meeting. The chair calls the vote and, if passed, formally closes the session with a gavel strike. A brief closing statement from the chair, thanking delegates for their participation and summarising what was accomplished, leaves the committee on a positive note.
        </p>
        <p>
          If you used Gavelling, the session data (speaker history, votes, chat, documents) is archived automatically and accessible for post-conference review or delegate feedback. If your conference gives awards, see our <Link href="/blog/mun-judging-rubric" style={{ color: '#1B3828', fontWeight: 600 }}>MUN judging rubric</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
