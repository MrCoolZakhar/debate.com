import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "How to Run a Model UN Committee: Chair's Complete Guide (2026)",
  description:
    'Everything a MUN chair needs to run a professional committee session: opening procedures, roll call, General Speakers List, motions, caucuses, and voting. Step-by-step guide.',
  alternates: { canonical: 'https://gavelling.com/blog/how-to-run-mun-committee' },
  openGraph: {
    title: "How to Run a Model UN Committee: Chair's Complete Guide (2026)",
    description: 'Everything a MUN chair needs to run a professional committee session.',
    url: 'https://gavelling.com/blog/how-to-run-mun-committee',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "How to Run a Model UN Committee: Chair's Complete Guide (2026)",
  description: 'Everything a MUN chair needs to run a professional committee session: opening procedures, roll call, General Speakers List, motions, caucuses, and voting.',
  url: 'https://gavelling.com/blog/how-to-run-mun-committee',
  datePublished: '2026-06-01',
  dateModified: '2026-06-01',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
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
  cta: { marginTop: '48px', padding: '28px 32px', backgroundColor: '#1B3828', borderRadius: '16px', textAlign: 'center' as const },
  ctaText: { fontSize: '16px', color: '#EDE7D8', marginBottom: '12px' },
  ctaLink: { display: 'inline-block', fontSize: '15px', fontWeight: 800, color: '#EED98A', textDecoration: 'none' },
};

export default function Article1() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div style={s.page}>
        <div style={s.wrap}>
          <Link href="/blog" style={s.back}>← MUN Resources</Link>
          <h1 style={s.h1}>How to Run a Model UN Committee: Chair&apos;s Complete Guide (2026)</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>

            <p style={s.p}>
              Chairing a Model UN committee is one of the most rewarding roles in the MUN experience, and one of the most demanding. You are simultaneously a facilitator, timekeeper, procedural authority, and energy manager. This guide walks you through every stage of a committee session, from your first gavel strike to adjournment.
            </p>

            <h2 style={s.h2}>1. Before the Session: Preparation</h2>
            <p style={s.p}>
              The quality of a committee session is largely determined before it starts. Chairs who walk in prepared radiate confidence; chairs who improvise burn energy managing avoidable chaos.
            </p>
            <h3 style={s.h3}>Know your rules of procedure</h3>
            <p style={s.p}>
              Different conferences use different rules of procedure: THIMUN, HMUN, ILMUNC, or a conference-specific variant. Read yours cover to cover before the session. The most important things to memorise: voting thresholds for each motion type, the order of precedence for motions, and how to handle Points of Order vs Points of Information.
            </p>
            <h3 style={s.h3}>Prepare your delegate roster and committee topic</h3>
            <p style={s.p}>
              Know which delegations are in your committee and have your attendance sheet ready. Read the study guide, understand the key fault lines in the debate, and anticipate the motions delegates are likely to raise. The more you know the topic, the less effort you spend thinking during the session.
            </p>
            <h3 style={s.h3}>Set up your session in advance</h3>
            <p style={s.p}>
              Using a digital tool like <strong>Gavelling</strong> lets you pre-load your delegate roster, set speaking times, and configure voting thresholds before you walk into the room. Delegates receive a 6-character session code and join on their own devices: no downloads, no paper lists. Setting this up the evening before means your opening is seamless.
            </p>

            <h2 style={s.h2}>2. Opening the Session: Roll Call</h2>
            <p style={s.p}>
              Every committee session begins with roll call. Its purpose is to establish quorum: the minimum number of delegates required to conduct official business (typically a simple majority of the total delegation count).
            </p>
            <h3 style={s.h3}>Calling each delegation</h3>
            <p style={s.p}>
              The chair calls each delegation alphabetically. Delegates respond with one of three statuses:
            </p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Present</strong>: the delegate is attending and will participate in debate, but may abstain on substantive votes.</li>
              <li style={s.li}><strong>Present and Voting (P+V)</strong>: the delegate is present and commits to voting For or Against on all substantive matters. They cannot abstain.</li>
              <li style={s.li}><strong>Absent</strong>: not present at this time.</li>
            </ul>
            <h3 style={s.h3}>Calculating quorum</h3>
            <p style={s.p}>
              Quorum is typically 50% + 1 of total delegations. If you have 20 delegations, you need at least 11 present to proceed. If quorum is not met, the chair typically recesses the session briefly and takes attendance again after a short wait. If quorum still cannot be met, the session may be postponed.
            </p>

            <h2 style={s.h2}>3. Setting the Agenda</h2>
            <p style={s.p}>
              When a committee has more than one topic, the agenda must be set before debate begins. A delegate motions to set the agenda with a specific topic first. The motion requires a second, then a simple majority vote. Once passed, the committee proceeds to debate on that topic.
            </p>
            <p style={s.p}>
              Single-topic committees can skip this step and move directly to opening the General Speakers List.
            </p>

            <h2 style={s.h2}>4. General Speakers List (GSL)</h2>
            <p style={s.p}>
              The General Speakers List is the primary debate mechanism in Model UN. It is a standing queue of delegates who wish to address the committee on the topic. Once the agenda is set, the chair opens the GSL and delegates add themselves by raising their placards.
            </p>
            <h3 style={s.h3}>How delegates add themselves</h3>
            <p style={s.p}>
              Delegates raise their placard when the chair asks for additions to the GSL. The chair (or co-chair) notes each delegation in order. In Gavelling, delegates can request to speak directly from their device and the chair approves additions with one tap.
            </p>
            <h3 style={s.h3}>Speaking time</h3>
            <p style={s.p}>
              Speaking time is set by the committee via motion, typically 60–90 seconds per delegate for a standard committee session. The chair strictly enforces the time limit to ensure fairness.
            </p>
            <h3 style={s.h3}>Yielding time</h3>
            <p style={s.p}>
              When a delegate finishes early, they may yield remaining time in three ways:
            </p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Yield to the chair</strong>: time is lost; the next speaker is called.</li>
              <li style={s.li}><strong>Yield to another delegate</strong>: the named delegate speaks for the remaining time.</li>
              <li style={s.li}><strong>Yield to points/questions</strong>: the floor is opened for a brief question from another delegate.</li>
            </ul>
            <p style={s.p}>
              The GSL continues throughout the session, paused when a caucus motion passes, and resumed when the caucus ends. Unlike caucus queues, the GSL is never wiped. It persists until the session closes.
            </p>

            <h2 style={s.h2}>5. Moderated and Unmoderated Caucuses</h2>
            <p style={s.p}>
              Caucuses are temporary departures from the GSL to allow more focused discussion. There are two types.
            </p>
            <h3 style={s.h3}>Moderated Caucus</h3>
            <p style={s.p}>
              A delegate motions for a moderated caucus, specifying a topic, a total time (e.g. 10 minutes), and a per-speaker time (e.g. 90 seconds). The motion requires a simple majority. If passed, the chair runs a mini-speakers list within the caucus: delegates raise their placards, the chair calls them in order, and a separate timer tracks each speaker.
            </p>
            <p style={s.p}>
              Moderated caucuses are best for focused, substantive debate on a specific sub-topic. They create structure while allowing more speakers than an unmoderated session.
            </p>
            <h3 style={s.h3}>Unmoderated Caucus</h3>
            <p style={s.p}>
              An unmod specifies only a total time (e.g. 15 minutes). There is no formal speaker list. Delegates leave their seats and negotiate informally. Unmods are essential for writing working papers, building blocs, and lobbying.
            </p>
            <p style={s.p}>
              As chair, set a timer and call the committee back to order when time expires. If delegates are in the middle of productive work, the chair may entertain a motion to extend.
            </p>
            <p style={s.p}>
              See also: <Link href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</Link> for the full rules on caucus motions.
            </p>

            <h2 style={s.h2}>6. Voting Procedures</h2>
            <p style={s.p}>
              MUN committees vote on two categories of matter: procedural votes (motions) and substantive votes (draft resolutions).
            </p>
            <h3 style={s.h3}>Procedural votes</h3>
            <p style={s.p}>
              Motions (to enter a caucus, extend speaking time, set the agenda, adjourn) are procedural. They typically require a simple majority (50% + 1 of votes cast). Abstentions are not permitted on procedural votes in most rules of procedure.
            </p>
            <h3 style={s.h3}>Substantive votes</h3>
            <p style={s.p}>
              Draft resolutions are substantive. Depending on the committee&apos;s rules, passage may require a simple majority or a two-thirds supermajority of delegates present and voting. P+V delegates must vote For or Against. They cannot abstain.
            </p>
            <h3 style={s.h3}>Security Council vetoes</h3>
            <p style={s.p}>
              In the UN Security Council, any of the five permanent members (China, France, Russia, UK, USA) can veto a substantive resolution by voting Against, regardless of how other members vote. A single P5 Against vote defeats the resolution.
            </p>

            <h2 style={s.h2}>7. Closing the Session</h2>
            <p style={s.p}>
              At the end of a session, a delegate typically motions to adjourn the meeting. The chair calls the vote and, if passed, formally closes the session with a gavel strike. A brief closing statement from the chair, thanking delegates for their participation and summarising what was accomplished, leaves the committee on a positive note.
            </p>
            <p style={s.p}>
              If you used Gavelling, the session data (speaker history, votes, chat, documents) is archived automatically and accessible for post-conference review or delegate feedback.
            </p>

            <RelatedGuides currentSlug="how-to-run-mun-committee" />
            <div style={s.cta}>
              <p style={s.ctaText}>
                Gavelling automates roll call, GSL queue, motion tracking, and voting, so you can focus on running a great debate.
              </p>
              <a href="https://gavelling.com" style={s.ctaLink}>Start your committee free at gavelling.com →</a>
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
