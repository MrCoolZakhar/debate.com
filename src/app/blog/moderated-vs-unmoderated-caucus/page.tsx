import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'Moderated vs Unmoderated Caucus in MUN: What Each One Is and When to Use It';
const DESCRIPTION =
  'A moderated caucus is structured debate with a speaker queue; an unmoderated caucus is free time to talk and draft. How to motion for each, typical times and when to use them.';

const FAQ: FaqItem[] = [
  {
    question: 'What is an unmoderated caucus?',
    answer:
      'An unmoderated caucus is a block of informal time with no speakers list and no chair-led debate. Delegates leave their seats to talk, build blocs and write working papers until the time runs out.',
  },
  {
    question: 'How long is a moderated caucus?',
    answer:
      'Most moderated caucuses run 5 to 15 minutes in total, with 30 to 90 seconds per speaker. The delegate who raises the motion proposes both numbers, and the total is usually a multiple of the speaking time.',
  },
  {
    question: 'How do you motion for a moderated caucus?',
    answer:
      'Raise your placard and say: "The delegation of Brazil moves for a moderated caucus on climate financing, for a total time of 10 minutes with 60 seconds per speaker." You state the topic, the total time and the speaking time. Most rules then need a simple majority.',
  },
  {
    question: 'What is the difference between a moderated and an unmoderated caucus?',
    answer:
      'In a moderated caucus the chair runs a speaker queue and delegates give short speeches on a set topic. In an unmoderated caucus there is no queue: delegates move around the room and negotiate directly.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/moderated-vs-unmoderated-caucus',
  ogDescription: 'What a moderated and an unmoderated caucus are, how to motion for each and when to use them.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/moderated-vs-unmoderated-caucus',
  datePublished: '2026-11-14',
  dateModified: '2026-11-14',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/moderated-vs-unmoderated-caucus' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Moderated vs Unmoderated Caucus', item: 'https://gavelling.com/blog/moderated-vs-unmoderated-caucus' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="moderated-vs-unmoderated-caucus"
        pitch="Gavelling runs both caucus types: a speaker queue with two clocks for moderated, a countdown for unmoderated."
      >
        <p>
          A moderated caucus is a short stretch of structured debate in which the chair calls speakers one at a time, each for a fixed time, on a topic the committee has just agreed. An unmoderated caucus is the opposite: a block of informal time with no speakers list, in which delegates leave their seats to talk, form blocs and write working papers.
        </p>

        <p>
          Both are raised as motions and both need a vote, so the real skill is knowing which one the committee needs right now. This guide sets the two side by side, gives the exact wording for each motion, and covers what to do once the caucus is open. If you are the chair, our <Link href="/blog/how-to-run-moderated-caucus">chair guide to running a moderated caucus</Link> goes deeper on the dais side.
        </p>

        <H2>Moderated vs Unmoderated Caucus at a Glance</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Moderated caucus</th>
                <th>Unmoderated caucus</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Who speaks</td>
                <td>One delegate at a time, in the order the chair calls them</td>
                <td>Everyone, in small groups, at once</td>
              </tr>
              <tr>
                <td>How the floor works</td>
                <td>A temporary speaker queue, separate from the GSL</td>
                <td>No floor and no queue; delegates leave their seats</td>
              </tr>
              <tr>
                <td>Timing</td>
                <td>A total time and a speaking time, for example 10 minutes at 60 seconds</td>
                <td>A total time only, for example 15 minutes</td>
              </tr>
              <tr>
                <td>Motion needs</td>
                <td>Topic, total time, speaking time</td>
                <td>Total time and a purpose</td>
              </tr>
              <tr>
                <td>Good for</td>
                <td>Debating one sub-topic, putting a position on the record, testing ideas in public</td>
                <td>Bloc-building, merging papers, finding sponsors, drafting</td>
              </tr>
              <tr>
                <td>What the chair does</td>
                <td>Builds the queue, calls speakers, enforces both clocks</td>
                <td>Starts the clock, keeps time, calls the room back to order</td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          The one thing both share is that the <Link href="/blog/general-speakers-list-guide">General Speakers List</Link> is paused, not cleared. When the caucus ends, the committee goes back to the list exactly where it stopped.
        </p>

        <H2>How to Motion for a Moderated Caucus</H2>
        <p>
          Raise your placard, wait to be recognised, then give the motion with three parts: the topic, the total time and the speaking time.
        </p>
        <Callout>
          &quot;The delegation of Brazil moves for a moderated caucus on climate financing for developing states, for a total time of ten minutes with sixty seconds per speaker.&quot;
        </Callout>
        <p>
          Typical numbers are 5 to 15 minutes in total and 30 to 90 seconds per speaker. Pick a total that divides cleanly: ten minutes at sixty seconds is ten speakers, while ten minutes at ninety seconds leaves the last speaker short. Many chairs will not take a motion that does not divide evenly.
        </p>

        <H3>What a good topic looks like</H3>
        <p>
          A good topic is narrower than the agenda and wide enough that several delegations have something to say. Compare the two sets below.
        </p>
        <ul>
          <li><strong>Too broad:</strong> &quot;the topic of climate change&quot;. This is just the GSL with a shorter clock.</li>
          <li><strong>Too narrow:</strong> &quot;clause 3 of the Brazilian working paper&quot;. Only the sponsors can speak to it.</li>
          <li><strong>About right:</strong> &quot;financing mechanisms for adaptation in small island states&quot;, &quot;the role of regional organisations in enforcement&quot;, &quot;how to verify national reporting&quot;.</li>
        </ul>
        <p>
          A topic that frames a disagreement works best, because delegations on each side can answer each other. If you want your bloc&apos;s approach discussed, word the topic so it points at the question your approach answers.
        </p>

        <H2>How to Motion for an Unmoderated Caucus</H2>
        <p>
          The motion is shorter. You give the total time and the purpose, and no speaking time, because nobody is on the floor.
        </p>
        <Callout>
          &quot;The delegation of Kenya moves for an unmoderated caucus of fifteen minutes, for the purpose of merging working papers.&quot;
        </Callout>
        <p>
          Ten to twenty minutes is the usual range. Some chairs will not take an unmoderated caucus without a purpose, and a stated purpose also helps your own bloc know what to do when the clock starts. Short ones of five to eight minutes suit a single task such as collecting signatories.
        </p>

        <H2>How the Vote Works</H2>
        <p>
          Both motions are procedural, so in most rules of procedure they pass by a simple majority of members present and voting, with no abstentions. Some rulesets also ask for a second before the vote.
        </p>
        <p>
          If several motions are on the floor at once, the chair takes the most disruptive first. In most rulesets that puts an unmoderated caucus before a moderated one, and a longer motion before a shorter one of the same kind. The exact order depends on the conference, so check the rules your committee uses. Our guide to <Link href="/blog/mun-motions-explained">every MUN motion and how to raise it</Link> has the full list and the thresholds.
        </p>

        <H2>Rules Differ Between Procedures</H2>
        <p>
          Everything above is the NMUN and UNA-USA style that most American-influenced conferences follow. Under THIMUN rules there is no motion for either caucus: debate runs through open debate with points of information, and informal talking happens in set lobbying time. Some conferences also add a second per motion, cap the number of caucus motions and cap how long a caucus can be. The <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> shows where the main rulesets differ, so read your conference&apos;s rules before you rehearse a motion.
        </p>

        <H2>What to Do in a Moderated Caucus</H2>
        <p>
          Put your name on the queue as soon as the caucus opens, because the queue fills in seconds. Then use your turn for one clear point tied to the topic, not a second opening speech. Name the delegations whose ideas you are building on, and say what you want the room to do next, such as joining a bloc or signing a paper.
        </p>
        <p>
          Listen as well. A moderated caucus is the cheapest way to learn where every delegation stands, and the speeches tell you who to approach in the next unmoderated caucus.
        </p>

        <H2>What to Do in an Unmoderated Caucus</H2>
        <p>
          The time is short and the room is loud, so go in with a plan. The two jobs that matter most are finding allies and getting words on paper.
        </p>
        <ul>
          <li><strong>Build the bloc first.</strong> Talk to delegations with similar positions and agree the two or three ideas the group will push. Our <Link href="/blog/mun-bloc-building">bloc-building guide</Link> covers how to approach the room.</li>
          <li><strong>Assign one writer.</strong> One person types while the others negotiate clauses, then everyone reads the draft before the clock ends.</li>
          <li><strong>Collect sponsors and signatories.</strong> A document needs both before it can be introduced. The <Link href="/blog/mun-working-paper-guide">working paper guide</Link> shows the format.</li>
          <li><strong>Check the other papers.</strong> Merging with a bloc that is close to yours is often better than competing with it.</li>
        </ul>
        <p>
          The <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus guide</Link> has a minute-by-minute plan for the whole block.
        </p>

        <H2>Related Formats</H2>
        <p>
          A few formats sit between the two or replace one of them.
        </p>
        <ul>
          <li><strong>Consultation of the whole.</strong> A timed discussion run by the chair with no speaker queue; the chair simply points to whoever wishes to speak. It sits between a moderated and an unmoderated caucus.</li>
          <li><strong>Tour de table.</strong> Every present delegation speaks once, in a set order, for the same short time. See <Link href="/blog/tour-de-table-mun">tour de table</Link>.</li>
          <li><strong>Round robin.</strong> Another name for going around the room in order, used by some conferences instead of a speaker queue.</li>
        </ul>

        <H2>Common Mistakes</H2>
        <ul>
          <li><strong>Motioning without a topic.</strong> A moderated caucus on &quot;the agenda&quot; is just the GSL. Without a real topic nobody is any clearer after it.</li>
          <li><strong>A total time that does not divide.</strong> Two minutes of silence at the end of a caucus helps no one.</li>
          <li><strong>Wasting an unmoderated caucus.</strong> Standing in your seat talking to one friend is the commonest way to lose the session. Move, and aim to speak to at least three delegations.</li>
          <li><strong>Calling for too many caucuses in a row.</strong> Alternate with the GSL so the formal record keeps growing.</li>
          <li><strong>Forgetting the GSL is still there.</strong> Neither caucus removes anyone from it.</li>
        </ul>

        <H2>Running Both With Gavelling</H2>
        <p>
          In Gavelling the chair runs a moderated caucus with a speaker queue and two clocks, one for the total and one for each speaker, and runs an unmoderated caucus with a countdown. Delegates see the caucus clock on their phones, so nobody has to ask how long is left.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
