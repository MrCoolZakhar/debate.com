import Link from 'next/link';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Motions Explained: Types, How to Propose, and Voting Rules',
  description:
    'A complete guide to Model UN motions: moderated caucus, unmoderated caucus, extension of speaking time, adjournment, and more. Includes voting thresholds and chair tips.',
  path: '/blog/mun-motions-explained',
  ogDescription:
    'Complete reference for every MUN motion type with voting thresholds and chair tips.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Motions Explained: Types, How to Propose, and Voting Rules',
  description: 'A complete guide to Model UN motions: every type, voting thresholds, precedence, and chair tips.',
  url: 'https://gavelling.com/blog/mun-motions-explained',
  datePublished: '2026-06-01',
  dateModified: '2026-06-01',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: { '@type': 'Organization', name: 'Gavelling', logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' } },
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-motions-explained' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Motions Explained', item: 'https://gavelling.com/blog/mun-motions-explained' },
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
  motionCard: { border: '1px solid #DDD4C0', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px', backgroundColor: '#EDE7D8' },
  motionTitle: { fontSize: '15px', fontWeight: 800, color: '#1B3828', marginBottom: '4px' },
  motionDetail: { fontSize: '14px', color: '#1C1410', margin: 0, lineHeight: 1.6 },
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '24px', fontSize: '14px' },
  th: { backgroundColor: '#1B3828', color: '#EDE7D8', padding: '10px 14px', textAlign: 'left' as const, fontWeight: 700 },
  td: { padding: '10px 14px', borderBottom: '1px solid #DDD4C0', color: '#1C1410' },
  tdAlt: { padding: '10px 14px', borderBottom: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#F6F1E9' },
  cta: { marginTop: '48px', padding: '28px 32px', backgroundColor: '#1B3828', borderRadius: '16px', textAlign: 'center' as const },
  ctaText: { fontSize: '16px', color: '#EDE7D8', marginBottom: '12px' },
  ctaLink: { display: 'inline-block', fontSize: '15px', fontWeight: 800, color: '#EED98A', textDecoration: 'none' },
};

export default function Article4() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div style={s.page}>
        <div style={s.wrap}>
          <Link href="/blog" style={s.back}>← MUN Resources</Link>
          <h1 style={s.h1}>MUN Motions Explained: Types, How to Propose, and Voting Rules</h1>
          <p style={s.meta}>By Gavelling · June 2026 · 10 min read</p>
          <article style={s.article}>

            <p style={s.p}>
              Motions are the mechanism through which delegates change what the committee is doing: shifting from formal debate to a caucus, extending speaking time, moving to a vote, or closing the session. Understanding every motion type, when to use it, and what threshold it requires is essential for both chairs and experienced delegates.
            </p>

            <h2 style={s.h2}>1. What Is a Motion in MUN?</h2>
            <p style={s.p}>
              A motion is a formal proposal by a delegate to change the committee&apos;s mode of debate or take a procedural action. Motions interrupt or redirect the current floor activity. They are debated briefly (if at all) and put to a vote before taking effect.
            </p>
            <p style={s.p}>
              Motions are distinct from working papers and draft resolutions, which are substantive documents about the committee&apos;s topic. A motion is always procedural. It affects how the committee operates, not the content of its conclusions.
            </p>

            <h2 style={s.h2}>2. How to Make a Motion</h2>
            <p style={s.p}>
              The process is the same for every motion type:
            </p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Raise placard</strong>: wait to be recognised by the chair.</li>
              <li style={s.li}><strong>State the motion</strong>: clearly and completely. For a moderated caucus, this means stating the topic, total time, and per-speaker time. Example: <em>&quot;The delegation of Brazil moves for a moderated caucus on the topic of climate financing, for a total time of 10 minutes with 90 seconds per speaker.&quot;</em></li>
              <li style={s.li}><strong>Second the motion</strong>: most motions require at least one second before going to a vote. The chair asks &quot;Is there a second?&quot;</li>
              <li style={s.li}><strong>Vote</strong>: the chair calls a vote. Motions pass by simple majority unless otherwise specified.</li>
            </ul>

            <h2 style={s.h2}>3. The Most Common MUN Motions</h2>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Open / Continue the Speakers List</p>
              <p style={s.motionDetail}>Opens or reopens the General Speakers List after a caucus. Requires: none specified (chair may open it directly). Vote threshold: typically no vote needed. The chair opens it as a matter of course.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion for a Moderated Caucus</p>
              <p style={s.motionDetail}>Suspends the GSL for a focused, structured debate on a specific sub-topic. Required parameters: <strong>topic</strong>, <strong>total time</strong> (e.g. 10 minutes), <strong>per-speaker time</strong> (e.g. 90 seconds). Vote threshold: simple majority. The chair runs a new speaker queue within the caucus. The GSL is paused, not cleared.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion for an Unmoderated Caucus</p>
              <p style={s.motionDetail}>Suspends formal procedure for informal negotiation and bloc-building. Required parameters: <strong>total time</strong> only (e.g. 15 minutes). No speaker queue: delegates move freely. Vote threshold: simple majority. Used for working paper drafting and lobbying.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Extend the Caucus</p>
              <p style={s.motionDetail}>Extends an ongoing moderated or unmoderated caucus by an additional time period. Raised near the end of the current caucus time. Vote threshold: simple majority.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Set / Extend Speaking Time</p>
              <p style={s.motionDetail}>Changes the per-delegate speaking time on the GSL. Required: new speaking time. Vote threshold: simple majority. Can be raised at any point when the floor is not occupied.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Introduce a Working Paper / Draft Resolution</p>
              <p style={s.motionDetail}>Formally introduces a document to the committee floor. The document must have the required number of signatories (set by conference rules). Vote threshold: simple majority.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Move into Voting Procedure</p>
              <p style={s.motionDetail}>Closes debate and moves the committee to vote on a draft resolution. Once passed, no further debate is permitted. Vote threshold: simple majority. This is a significant motion. Debate ends permanently once it passes.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Suspend the Meeting</p>
              <p style={s.motionDetail}>Temporarily suspends the session (e.g. for lunch). Vote threshold: simple majority. Session resumes at the agreed time.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Adjourn the Session / Meeting</p>
              <p style={s.motionDetail}>Formally closes the session. Vote threshold: simple majority. In multi-day conferences, this ends the current day&apos;s committee work.</p>
            </div>

            <div style={s.motionCard}>
              <p style={s.motionTitle}>Motion to Table the Topic</p>
              <p style={s.motionDetail}>Removes the current topic from the floor entirely, effectively ending debate without passing a resolution. Rarely used in most conferences. Vote threshold: two-thirds majority in many rules of procedure.</p>
            </div>

            <h2 style={s.h2}>4. Voting Thresholds for Motions</h2>
            <div style={{ overflowX: 'auto' as const, marginBottom: '24px' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Motion type</th>
                    <th style={s.th}>Threshold (typical)</th>
                    <th style={s.th}>Abstentions allowed?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Moderated Caucus', 'Simple majority', 'No'],
                    ['Unmoderated Caucus', 'Simple majority', 'No'],
                    ['Extend Speaking Time', 'Simple majority', 'No'],
                    ['Introduce Document', 'Simple majority', 'No'],
                    ['Move into Voting Procedure', 'Simple majority', 'No'],
                    ['Suspend / Adjourn', 'Simple majority', 'No'],
                    ['Table the Topic', 'Two-thirds majority', 'No'],
                    ['Draft Resolution (substantive)', 'Simple or two-thirds*', 'Yes (except P+V)'],
                  ].map(([motion, threshold, abstain], i) => (
                    <tr key={motion}>
                      <td style={i % 2 === 0 ? s.tdAlt : s.td}>{motion}</td>
                      <td style={i % 2 === 0 ? s.tdAlt : s.td}>{threshold}</td>
                      <td style={i % 2 === 0 ? s.tdAlt : s.td}>{abstain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={s.p}>*Draft resolution voting threshold depends on committee type and conference rules.</p>

            <h2 style={s.h2}>5. Which Motion Takes Precedence?</h2>
            <p style={s.p}>
              When multiple delegates raise motions at the same time, the chair must decide which to entertain first. The principle is <strong>most disruptive first</strong>: the motion that would most significantly change committee procedure is voted on before less disruptive ones.
            </p>
            <p style={s.p}>
              A general order of precedence (most to least disruptive):
            </p>
            <ul style={s.ul}>
              <li style={s.li}>Motion to Adjourn the Meeting</li>
              <li style={s.li}>Motion to Suspend the Meeting</li>
              <li style={s.li}>Motion for an Unmoderated Caucus</li>
              <li style={s.li}>Motion for a Moderated Caucus</li>
              <li style={s.li}>Motion to Set the Agenda / Speakers Time</li>
            </ul>
            <p style={s.p}>
              If two delegates raise the same type of motion simultaneously, the chair may entertain both and let the committee vote on each in sequence, or combine them into a single vote.
            </p>

            <h2 style={s.h2}>6. Chair Tips for Managing Motions</h2>
            <ul style={s.ul}>
              <li style={s.li}><strong>Entertain all motions quickly.</strong> Hesitating or dismissing motions without a vote erodes delegate trust in the chair&apos;s impartiality.</li>
              <li style={s.li}><strong>Stack motions before voting.</strong> When multiple motions are raised at once, list them all before calling the vote. &quot;The chair has three motions before it. We will vote in order of disruptiveness.&quot;</li>
              <li style={s.li}><strong>Use a motion queue.</strong> Gavelling maintains a live motion queue sorted by disruptiveness, so the chair always knows which motion to vote on first without mental arithmetic.</li>
              <li style={s.li}><strong>Never let motions drag.</strong> Take the second, call the vote, record the result, move on. Drawn-out motion procedure kills committee energy.</li>
            </ul>
            <p style={s.p}>
              See also: <Link href="/blog/how-to-run-mun-committee" style={{ color: '#1B3828', fontWeight: 600 }}>How to Run a MUN Committee</Link> for a complete session walkthrough.
            </p>

            <RelatedGuides currentSlug="mun-motions-explained" />
            <div style={s.cta}>
              <p style={s.ctaText}>
                Gavelling&apos;s motion queue tracks and sorts every motion automatically, so you can focus on running the vote.
              </p>
              <a href="https://gavelling.com" style={s.ctaLink}>Start your committee free at gavelling.com →</a>
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
