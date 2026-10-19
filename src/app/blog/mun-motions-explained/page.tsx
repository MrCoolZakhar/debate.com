import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, H3, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';
import { ReferenceSheet } from '@/components/blog/ReferenceSheet';

const TITLE = 'Motions in MUN: Every Motion and How to Raise One';
const DESCRIPTION =
  'A motion in MUN is a formal proposal to change what the committee does, like opening a caucus or moving to a vote. Every motion, its vote and how to raise it.';

const FAQ: FaqItem[] = [
  {
    question: 'What is a motion in MUN?',
    answer:
      'A motion is a formal proposal by a delegate to change what the committee is doing, such as entering a caucus, extending speaking time or moving to a vote. It is always procedural, never about the content of a resolution.',
  },
  {
    question: 'How do you raise a motion in MUN?',
    answer:
      'Raise your placard, wait to be recognised by the chair, then state the motion in full, for example: "The delegation of Brazil moves for a moderated caucus on climate financing, for a total time of 10 minutes with 90 seconds per speaker." Most motions then need a second and a simple majority.',
  },
  {
    question: 'How do you raise a motion for the GSL?',
    answer:
      'Raise your placard when the floor is open and say: "The delegation of [Country] moves to open the General Speakers List." Many chairs open the list directly once the agenda is set, so a vote is often not needed.',
  },
  {
    question: 'What is the difference between a motion and a point?',
    answer:
      'A motion proposes a change to what the committee is doing, and the committee votes on it. A point is a request to the chair, for example to correct a breach of the rules, and the chair rules on it.',
  },
  {
    question: 'Which motion is voted on first?',
    answer:
      'The most disruptive one. A motion to adjourn comes first, then to suspend the meeting, then an unmoderated caucus, then a moderated caucus, then setting the agenda or speaking time.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-motions-explained',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-motions-explained',
  datePublished: '2026-06-01',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
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

export default function Article4() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-motions-explained"
        pitch="Gavelling&apos;s motion queue tracks and sorts every motion automatically, so you can focus on running the vote."
      >

        <p>
          A motion in MUN is a formal proposal by a delegate to change what the committee is doing, such as opening a caucus, extending speaking time or moving to a vote. You raise one by raising your placard, waiting to be recognised and stating the motion in full; most motions then need a second and a simple majority.
        </p>

        <p>
          Motions are the mechanism through which delegates change what the committee is doing: shifting from formal debate to a caucus, extending speaking time, moving to a vote, or closing the session. Understanding every motion type, when to use it, and what threshold it requires is essential for both chairs and experienced delegates. The <Link href="/blog/mun-glossary">MUN glossary</Link> defines any term you have not met yet.
        </p>

        <H2>1. What Is a Motion in MUN?</H2>
        <p>
          A motion is a formal proposal by a delegate to change the committee&apos;s mode of debate or take a procedural action. Motions interrupt or redirect the current floor activity. They are debated briefly (if at all) and put to a vote before taking effect.
        </p>
        <p>
          Motions are distinct from working papers and draft resolutions, which are substantive documents about the committee&apos;s topic. A motion is always procedural. It affects how the committee operates, not the content of its conclusions. Motions are also separate from points, which our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers.
        </p>

        <PhotoFigure id="mun-bratislava-vote" caption="A committee votes on a motion by raising placards." />


        <H2>2. How to Make a Motion</H2>
        <p>
          The process is the same for every motion type:
        </p>
        <ul>
          <li><strong>Raise your placard</strong>: wait to be recognised by the chair.</li>
          <li><strong>State the motion</strong>: say it clearly and completely. For a moderated caucus, this means stating the topic, total time, and per-speaker time. Example: <em>&quot;The delegation of Brazil moves for a moderated caucus on the topic of climate financing, for a total time of 10 minutes with 90 seconds per speaker.&quot;</em></li>
          <li><strong>Second the motion</strong>: most motions require at least one second before going to a vote. The chair asks &quot;Is there a second?&quot;</li>
          <li><strong>Vote</strong>: the chair calls a vote. Motions pass by simple majority unless otherwise specified.</li>
        </ul>

        <H3>How to raise a motion for the GSL</H3>
        <p>
          Opening the General Speakers List is the motion new delegates ask about most. Raise your placard when the floor is open and say: <em>&quot;The delegation of Brazil moves to open the General Speakers List.&quot;</em> Many chairs open the list directly once the agenda is set, so a vote is often not needed. To change how long each GSL speaker has, move to set the speaking time: <em>&quot;The delegation of Brazil moves to set the speaking time at 60 seconds.&quot;</em> That one passes by simple majority. The <Link href="/blog/general-speakers-list-guide">GSL guide</Link> covers what happens once the list is open.
        </p>

        <H2>3. The Most Common MUN Motions</H2>
        <ReferenceSheet id="motions" caption="The common motions, the vote each needs and what to say." />

        <FactCard title="Motion to Open / Continue the Speakers List">Opens or reopens the General Speakers List after a caucus. Requires: none specified (chair may open it directly). Vote threshold: typically no vote needed. The chair opens it as a matter of course.</FactCard>

        <FactCard title="Motion for a Moderated Caucus">Suspends the GSL for a focused, structured debate on a specific sub-topic. Required parameters: <strong>topic</strong>, <strong>total time</strong> (e.g. 10 minutes), <strong>per-speaker time</strong> (e.g. 90 seconds). Vote threshold: simple majority. The chair runs a new speaker queue within the caucus. The GSL is paused, not cleared.</FactCard>

        <FactCard title="Motion for an Unmoderated Caucus">Suspends formal procedure for informal negotiation and bloc-building. Required parameters: <strong>total time</strong> only (e.g. 15 minutes). No speaker queue: delegates move freely. Vote threshold: simple majority. Used for working paper drafting and lobbying.</FactCard>

        <FactCard title="Motion to Extend the Caucus">Extends an ongoing moderated or unmoderated caucus by an additional time period. Raised near the end of the current caucus time. Vote threshold: simple majority.</FactCard>

        <FactCard title="Motion to Set / Extend Speaking Time">Changes the per-delegate speaking time on the GSL. Required: new speaking time. Vote threshold: simple majority. Can be raised at any point when the floor is not occupied.</FactCard>

        <FactCard title="Motion to Introduce a Working Paper / Draft Resolution">Formally introduces a document to the committee floor. The document must have the required number of signatories (set by conference rules). Vote threshold: simple majority.</FactCard>

        <FactCard title="Motion to Move into Voting Procedure">Closes debate and moves the committee to vote on a draft resolution. Once passed, no further debate is permitted. Vote threshold: simple majority. This is a significant motion: debate on the resolution cannot resume once it passes.</FactCard>

        <FactCard title="Motion to Suspend the Meeting">Temporarily suspends the session (e.g. for lunch). Vote threshold: simple majority. Session resumes at the agreed time.</FactCard>

        <FactCard title="Motion to Adjourn the Session / Meeting">Formally closes the session. Vote threshold: simple majority. In multi-day conferences, this ends the current day&apos;s committee work.</FactCard>

        <FactCard title="Motion to Table the Topic">Removes the current topic from the floor entirely, effectively ending debate without passing a resolution. Rarely used in most conferences. Vote threshold: two-thirds majority in many rules of procedure.</FactCard>

        <H2>4. Voting Thresholds for Motions</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Motion type</th>
                <th>Threshold (typical)</th>
                <th>Abstentions allowed?</th>
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
              ].map(([motion, threshold, abstain]) => (
                <tr key={motion}>
                  <td>{motion}</td>
                  <td>{threshold}</td>
                  <td>{abstain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p>*Draft resolution voting threshold depends on committee type and conference rules.</p>

        <H2>5. Which Motion Takes Precedence?</H2>
        <p>
          When multiple delegates raise motions at the same time, the chair must decide which to entertain first. The principle is <strong>most disruptive first</strong>: the motion that would most significantly change committee procedure is voted on before less disruptive ones.
        </p>
        <p>
          A general order of precedence (most to least disruptive):
        </p>
        <ul>
          <li>Motion to Adjourn the Meeting</li>
          <li>Motion to Suspend the Meeting</li>
          <li>Motion for an Unmoderated Caucus</li>
          <li>Motion for a Moderated Caucus</li>
          <li>Motion to Set the Agenda / Speaking Time</li>
        </ul>
        <p>
          If two delegates raise the same type of motion simultaneously, the chair may entertain both and let the committee vote on each in sequence, or combine them into a single vote.
        </p>
        <p>
          The exact list and order depend on the ruleset. Our <Link href="/blog/una-usa-rules-of-procedure">UNA-USA rules of procedure</Link> and <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure</Link> guides cover each one.
        </p>

        <H2>6. Chair Tips for Managing Motions</H2>
        <ul>
          <li><strong>Entertain all motions quickly.</strong> Hesitating or dismissing motions without a vote erodes delegate trust in the chair&apos;s impartiality.</li>
          <li><strong>Stack motions before voting.</strong> When multiple motions are raised at once, list them all before calling the vote. &quot;The chair has three motions before it. We will vote in order of disruptiveness.&quot;</li>
          <li><strong>Use a motion queue.</strong> Gavelling maintains a live motion queue sorted by disruptiveness, so the chair always knows which motion to vote on first without mental arithmetic.</li>
          <li><strong>Never let motions drag.</strong> Take the second, call the vote, record the result, move on. Drawn-out motion procedure kills committee energy.</li>
        </ul>
        <p>
          See also: <Link href="/blog/how-to-run-mun-committee" style={{ color: '#1B3828', fontWeight: 600 }}>How to Run a MUN Committee</Link> for a complete session walkthrough.
        </p>

        <H2>7. Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
