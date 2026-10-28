import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

// Tutorial videos appear on release (src/lib/tutorialVideos.ts); the hourly
// revalidation brings the server HTML and the VideoObject JSON-LD up to date.
export const revalidate = 3600;

const TITLE = 'MUN Working Paper: Format, a Full Example, and How to Merge Two Papers';
const DESCRIPTION =
  'What a Model UN working paper is, the format chairs accept, a complete example working paper, a worked merger of two competing papers clause by clause, and the steps from working paper to draft resolution';

const FAQ: FaqItem[] = [
  {
    question: 'What is a working paper in MUN?',
    answer:
      'A working paper is an informal document in which a group of delegations sets out the ideas they want in a resolution. It is shared with the committee for discussion and to attract support, it is not voted on, and once it has enough sponsors and signatories and is formatted properly it can be submitted as a draft resolution.',
  },
  {
    question: 'What is the difference between a working paper and a draft resolution?',
    answer:
      'A working paper is informal: loose format, any number of authors, not voted on. A draft resolution follows full resolution format, meets the conference minimum of sponsors and signatories, is approved by the dais, and is debated, amended and voted on.',
  },
  {
    question: 'How long should a working paper be?',
    answer:
      'Usually one page: a header, two to four lines of context and five to eight proposals. Length does not win support. Specific proposals that other delegations can see their own ideas in do.',
  },
  {
    question: 'Does a working paper need preambulatory clauses?',
    answer:
      'Not at most conferences. A few lines of context are enough at the working paper stage, and full preambulatory clauses are added when it becomes a draft resolution. Check whether your conference requires resolution format for working papers.',
  },
  {
    question: 'How many sponsors does a working paper need?',
    answer:
      'Usually none to share it, though some conferences ask for a few authors. Sponsor and signatory minimums apply when it is submitted as a draft resolution, often around a fifth of the committee in total. The rules of procedure give the number.',
  },
  {
    question: 'What happens when two working papers are merged?',
    answer:
      'The two groups agree one text: clauses both papers share are combined, compatible clauses from each are kept, and the clauses that contradict are negotiated or dropped. The merged paper usually lists both groups as authors and goes forward as one draft resolution.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-working-paper-guide',
  keywords: [
    'MUN working paper',
    'working paper MUN example',
    'working paper format MUN',
    'how to write a working paper MUN',
    'merge working papers',
    'working paper vs draft resolution',
  ],
  ogDescription: 'The working paper format, a full example, and a clause-by-clause merger of two papers.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-working-paper-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-working-paper-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Working Paper Guide', item: 'https://gavelling.com/blog/mun-working-paper-guide' },
  ],
};

const MERGE: [string, string, string, string][] = [
  ['Extended producer responsibility', 'A3: producers fund collection', 'B5: mentions producers in passing', 'Keep A3, take B5’s wording on small producers'],
  ['Waste collection capacity', 'A4: general support', 'B1: a capacity fund for coastal municipalities', 'Keep B1, it is the stronger clause'],
  ['Single-use plastic bans', 'A6: a global ban by a fixed date', 'B3: national targets, each state sets its own', 'Negotiated: national targets with a review date'],
  ['Monitoring', 'Not covered', 'B4: annual national reporting', 'Keep B4, shortened'],
  ['A new fund', 'A5: a new global fund', 'B1 already funds capacity', 'Drop A5, fold its donor clause into B1'],
  ['Fishing gear', 'A7: marking and recovery of lost gear', 'Not covered', 'Keep A7 unchanged'],
];

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['YhjHfNBSEKM']} />
      <ArticleLayout
        slug="mun-working-paper-guide"
        pitch="In a Gavelling session delegates submit working papers from their phones, the dais gets the code assigned automatically, and introduction is timed on screen."
      >
        <p>
          A <strong>working paper</strong> is the first written form of a bloc&rsquo;s ideas: informal, collaborative, usually drafted in the first <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus</Link>, and never voted on. It exists to collect support. Once it has enough of it, and the right format, it becomes a draft resolution. This guide covers the format chairs accept, a complete example working paper you can copy the shape of, a clause-by-clause merger of two competing papers, and the steps from paper to draft.
        </p>
        <p>
          For writing the final document in full resolution format, see <Link href="/blog/mun-resolution-writing">how to write a MUN resolution</Link>; for a finished resolution annotated line by line, see our <Link href="/blog/mun-resolution-example">resolution example</Link>.
        </p>

        <H2>Working paper or draft resolution</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>&nbsp;</th><th>Working paper</th><th>Draft resolution</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Purpose</strong></td><td>Collect ideas and support</td><td>Be debated, amended and voted on</td></tr>
              <tr><td><strong>Format</strong></td><td>Loose: headings and bullet proposals are fine at most conferences</td><td>Full resolution format: preamble, numbered operative clauses</td></tr>
              <tr><td><strong>Who signs</strong></td><td>Authors, often any number</td><td>A minimum of sponsors and signatories, set by the rules</td></tr>
              <tr><td><strong>Dais approval</strong></td><td>Usually just accepted and shared</td><td>Checked and approved before introduction</td></tr>
              <tr><td><strong>Voted on</strong></td><td>No</td><td>Yes</td></tr>
              <tr><td><strong>How many</strong></td><td>Several per topic is normal</td><td>The chair usually wants two or three at most</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">
          Conferences vary. Some skip working papers entirely, some require resolution format for them, and THIMUN-style conferences write resolutions in lobbying before debate begins. Read your rules of procedure.
        </p>

        <H2>The format chairs accept</H2>
        <p>
          A working paper needs only enough structure for a reader to see who wrote it and what it proposes.
        </p>
        <ul>
          <li><strong>A header:</strong> committee, topic, and the delegations writing it.</li>
          <li><strong>Context, two to four lines:</strong> the problem and the documents you build on. Full preambulatory clauses can wait.</li>
          <li><strong>Proposals, five to eight:</strong> each one action, each specific enough to become an operative clause. Write them as clauses from the start (&ldquo;Calls upon&hellip;&rdquo;, &ldquo;Requests&hellip;&rdquo;) and you save an hour later; our <Link href="/blog/mun-clause-phrases">clause phrase list</Link> has the verbs.</li>
          <li><strong>One page.</strong> A working paper is read by delegates deciding in two minutes whether to join you.</li>
        </ul>
        <Callout>
          Write every proposal so another delegation can add its name to it. &ldquo;Calls upon developed states to fund&hellip;&rdquo; recruits donors; &ldquo;Condemns states that have failed to fund&hellip;&rdquo; recruits nobody.
        </Callout>

        <H2>A complete example working paper</H2>
        <p>
          United Nations Environment Assembly, topic: plastic pollution in the oceans. This is Working Paper A, written by a bloc of coastal and small island states.
        </p>
        <FactCard title="Working Paper A">
          <p><strong>Committee:</strong> United Nations Environment Assembly. <strong>Topic:</strong> Plastic pollution in the oceans. <strong>Authors:</strong> Fiji, Indonesia, Senegal, Chile, Norway, Philippines.</p>
          <p><strong>Context.</strong> Plastic waste reaches the sea mostly from land, through rivers and from coasts without collection. States that produce little of it often carry the cost of cleaning it up. This paper builds on the Assembly&rsquo;s earlier resolutions on marine litter.</p>
          <p><strong>Proposals.</strong></p>
          <p>1. Calls upon member states to set national targets for reducing plastic leakage into rivers and coastal waters.</p>
          <p>2. Encourages states to share collection and recycling technology with coastal states that lack it.</p>
          <p>3. Recommends extended producer responsibility schemes in which producers fund the collection of the packaging they sell.</p>
          <p>4. Supports technical assistance for waste collection in coastal communities.</p>
          <p>5. Proposes a new global fund for clean-up in small island states, financed by voluntary donor contributions.</p>
          <p>6. Calls for a global ban on specified single-use plastic items by an agreed date.</p>
          <p>7. Requests that fishing gear be marked so that lost gear can be traced and recovered.</p>
        </FactCard>
        <p>
          <strong>Why it works as a working paper.</strong> It fits on one page. The header says who is already in. Proposals 1 to 4 and 7 are easy to join; 5 and 6 are the ambitious ones a merger will test. Every proposal is already a clause verb plus an action.
        </p>

        <H2>Drafting it as a group</H2>
        <H3>Give each person one job</H3>
        <ul>
          <li><strong>One writer</strong> holds the document. Everyone else suggests; only the writer types.</li>
          <li><strong>One recruiter</strong> walks the room with the current version and comes back with names and objections.</li>
          <li><strong>One reader</strong> checks every proposal against the study guide and the bloc&rsquo;s positions.</li>
        </ul>
        <H3>Keep one copy</H3>
        <p>
          Draft in one shared document that the whole bloc can open, never in a file on one laptop. Put a version number in the title and change it every time you share a copy, so nobody signs v2 while you are submitting v4. If your conference bans laptops in committee, the same rules apply to paper: one master copy, one writer.
        </p>
        <H3>Start in the first unmoderated caucus</H3>
        <p>
          The group with something written in the first caucus is the group others join, and the invitation at the end of your <Link href="/blog/mun-opening-speech">opening speech</Link> is what brings them to you. Three proposals on a page beat a perfect paper that arrives after another bloc has collected the room.
        </p>

        <H2>Merging two papers, clause by clause</H2>
        <p>
          A second bloc, led by large producer and consumer economies, has written Working Paper B: a capacity fund for coastal municipalities (B1), national plastic reduction targets set by each state (B3), annual national reporting (B4) and a passing mention of producers (B5). The chair asks the two groups to merge. Here is how the negotiation went, topic by topic.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Topic</th><th>Paper A</th><th>Paper B</th><th>Merged text</th></tr>
            </thead>
            <tbody>
              {MERGE.map(([topic, a, b, m]) => (
                <tr key={topic}>
                  <td><strong>{topic}</strong></td>
                  <td>{a}</td>
                  <td>{b}</td>
                  <td>{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <H3>How the hard clause was settled</H3>
        <p>
          The real conflict was A6, a global ban by a fixed date, against B3, targets each state sets for itself. Neither side could sign the other&rsquo;s clause. The merged clause kept B3&rsquo;s national targets and took A6&rsquo;s date as a <em>review date</em>, at which the Assembly would consider whether a global measure is needed. Paper A got a date in the text; Paper B kept national choice. That trade is the shape of most successful mergers: each side keeps the thing it cannot go home without, and gives up the wording around it.
        </p>
        <H3>The rules of a good merger</H3>
        <ul>
          <li><strong>Agree the list of topics first,</strong> before anyone argues wording. The table above is the agenda for the meeting.</li>
          <li><strong>Take the stronger clause wholesale</strong> where both papers cover the same thing, whoever wrote it. Paper A gave up its own fund because Paper B&rsquo;s was better.</li>
          <li><strong>Name your red line before you start,</strong> privately, inside your own bloc: the clause you would withdraw your name over.</li>
          <li><strong>Soften verbs, not actions.</strong> &ldquo;Encourages&rdquo; for &ldquo;Requires&rdquo; often settles a dispute that a deleted clause would not.</li>
          <li><strong>Settle the sponsor order early.</strong> Who is listed first matters more to some delegations than any clause.</li>
        </ul>
        <p>
          The negotiation itself, and how to bring a reluctant delegation round, is in our <Link href="/blog/mun-negotiation-tactics">negotiation guide</Link> and our guide to <Link href="/blog/mun-bloc-building">building a bloc</Link>.
        </p>

        <H2>From working paper to draft resolution</H2>
        <ul className="gv-check">
          <li><strong>Rewrite in full format:</strong> preambulatory clauses in italics or underlined as your conference asks, operative clauses numbered, each ending in a semicolon and the last in a full stop.</li>
          <li><strong>Collect sponsors and signatories</strong> to the conference minimum. Sponsors wrote it and support it; signatories only want it debated.</li>
          <li><strong>Check it against the rules:</strong> no clause outside the committee&rsquo;s mandate, nothing the committee cannot do, such as ordering sanctions outside the Security Council.</li>
          <li><strong>Submit it to the dais</strong> and wait for approval and a number before you call it a draft resolution.</li>
          <li><strong>Prepare the introduction:</strong> one sponsor reads or summarises the operative clauses, then takes questions. Keep it under two minutes.</li>
        </ul>
        <p>
          After introduction it can be <Link href="/blog/mun-amendment-guide">amended</Link> and debated, and then it goes to a <Link href="/blog/mun-voting-procedures">vote</Link>.
        </p>

        <H2>Submitting in a Gavelling session</H2>
        <p>
          In a committee run on <Link href="/create/sessions">Gavelling</Link>, a delegate submits a working paper or draft resolution from their phone, with the sponsoring delegations. The paper gets its code (WP 1.1, DR 1/1 and so on) from the session automatically, so two papers never share a number. The chair can require approval before a paper is introduced and can cap how many papers each committee accepts. Introduction runs as timed stages on the chair&rsquo;s screen: reading, presentation, then questions. Committees that call them something else can rename both document types in Settings.
        </p>

        <TutorialVideo id="YhjHfNBSEKM">
          The introduction runs with the paper and the stage timer on one screen, so the chair never needs a second tab.
        </TutorialVideo>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
