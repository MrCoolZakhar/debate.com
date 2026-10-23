import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, TableWrap } from '@/components/blog/prose';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';

export const revalidate = 3600; // scheduled videos appear in the server HTML and JSON-LD within an hour of release

const SLUG = 'gavelling-motions-and-voting';
const TITLE = 'How to Handle Motions and Voting on Gavelling';
const DESCRIPTION =
  'Motions ranked for you, draft resolutions introduced in one place, and votes with rights, passes and the P5 veto';
const OG = 'Motions, draft resolutions and roll call votes, P5 veto included, run from one screen on Gavelling.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: `/blog/${SLUG}`,
  ogDescription: OG,
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: OG,
  url: `https://gavelling.com/blog/${SLUG}`,
  datePublished: '2026-10-23',
  dateModified: '2026-10-23',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': `https://gavelling.com/blog/${SLUG}` },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Motions and Voting on Gavelling', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function MotionsAndVotingOnGavelling() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['NRMjbXmLqaY', 'BCQyOGywPOg', 'YhjHfNBSEKM', 'LhT8mic1ffQ']} />
      <ArticleLayout
        slug={SLUG}
        pitch="Motions ranked for you, papers introduced beside their timer, and votes counted one delegation at a time."
      >
        <p>
          Motions are where a committee decides what to do next, and voting is where it decides what it believes. Both
          are easy to get wrong from the dais: three motions raised at once, a vote order nobody remembers, a delegation
          that passed and was never asked again, a P5 member whose Against was counted as an ordinary no.
        </p>
        <p>
          This guide shows how Gavelling handles each step: raising and ranking motions, suspending and ending debate,
          submitting and introducing working papers and draft resolutions, and running the vote itself. For the rules
          behind them, keep <Link href="/blog/mun-motions-explained">MUN motions explained</Link> and{' '}
          <Link href="/blog/mun-voting-procedures">MUN voting procedures</Link> open alongside.
        </p>

        <H2>1. Raise Motions on the Floor</H2>
        <p>
          Delegates raise motions out loud, as they always have, and the chair records them. Open{' '}
          <strong>Motions</strong> in the top bar and press <strong>Raise motion</strong>. Pick the type, type the
          proposing delegation in the proposer field (or raise it as the chair), and fill in what the motion needs: a
          topic for a moderated caucus, the total time, the speaking time, or the speaking order for a Tour de Table.
        </p>
        <p>A few rules keep the floor tidy:</p>
        <ul>
          <li>
            <strong>One motion per delegation.</strong> A delegation that already has a motion on the floor cannot raise
            a second one until the first is dealt with.
          </li>
          <li>
            <strong>Up to fifteen on the floor.</strong> At fifteen, the floor is full: vote on one or remove one before
            raising another. None of them is ever hidden; the extra ones scroll.
          </li>
          <li>
            <strong>Quorum first.</strong> Below quorum, motions cannot be raised at all.
          </li>
        </ul>
        <p>
          Every motion card shows the same things in the same places: the motion&apos;s name, its topic, who raised it,
          and its times. A wrong time or topic is fixed with <strong>Edit</strong> rather than by deleting and raising it
          again.
        </p>

        <H2>2. Vote on Motions in the Right Order</H2>
        <p>
          The floor is ranked for you, most disruptive first, and each card carries its badge: ends the session,
          suspends the session, most disruptive, very disruptive, disruptive, least disruptive. That is the order most
          rules of procedure vote in, so you can read it straight off the screen.
        </p>
        <ChairScript>
          &quot;The chair has three motions on the floor. We will vote in order of disruptiveness, starting with the
          motion for an unmoderated caucus of fifteen minutes.&quot;
        </ChairScript>
        <p>
          If your rules order things differently, press <strong>Vote on motions</strong> and drag the motions into the
          order you want. Each one shows the majority it needs and how many votes that is out of the delegations present.
          After the show of placards, press <strong>Accept</strong> or <strong>Reject</strong>.
        </p>
        <p>
          When a motion passes, the other motions on the floor fall, as they would in most committees, and a short card
          says how many fell. After a caucus is accepted that card offers <strong>Undo</strong> for a few seconds, in case
          you accepted the wrong one. Every motion, passed, rejected or fallen, goes into the committee&apos;s history, and
          raising or passing one earns points on the scoreboard.
        </p>

        <TutorialVideo id="NRMjbXmLqaY">Fifteen motions on the floor at once, ranked, edited, dragged into a new order and accepted.</TutorialVideo>

        <H3>Make the motions match your rules</H3>
        <p>
          Not every conference uses the same motions or calls them the same thing. In Settings, on the Motions tab, the
          Moderator can switch motions on and off, change their order of disruptiveness and rename them, so a
          &quot;Consultation of the Whole&quot; or a &quot;Moderated Caucus&quot; is shown under the name your rules
          use, everywhere in the room.
        </p>

        <TutorialVideo id="BCQyOGywPOg">Choose what delegates can do, set the timer sound, reorder and rename motions, and set your own points.</TutorialVideo>

        <H2>3. Suspend or End Debate</H2>
        <p>
          A motion to suspend or end debate asks one question before anything happens: <strong>Does this motion
          pass?</strong> Press Yes only when the committee has voted it through.
        </p>
        <ul>
          <li>
            <strong>Suspend</strong> pauses the room for a break. The current speech is recorded, the clocks stop and
            delegates see a waiting screen. When the committee returns, a chair presses{' '}
            <strong>Resume session</strong> and takes a quick roll call; the speakers list, chat and documents are all
            still there, and a speaker on the general speakers list who was interrupted gets the rest of their time back.
          </li>
          <li>
            <strong>End Debate</strong> closes the session. Everyone sees the end screen, the room becomes read only, and
            the chair can download the record. An end can be undone for 24 hours with{' '}
            <strong>Restart the session</strong>.
          </li>
        </ul>

        <H2>4. Submit Working Papers and Draft Resolutions</H2>
        <p>
          Open <strong>Documents</strong> in the top bar. There are two tabs, Working Papers and Draft Resolutions (your
          committee can rename both in Settings). A paper is submitted by a delegate from their phone or by a chair from
          the laptop, with:
        </p>
        <ul>
          <li>a title,</li>
          <li>an optional Google Docs link,</li>
          <li>a PDF, if there is one,</li>
          <li>and the sponsoring delegations.</li>
        </ul>
        <p>
          The paper gets its code from the session, WP 1.1 or DR 1/1 and so on, so two papers never share a number. If
          your committee wants to vet papers first, turn on approval in Settings and each paper waits for{' '}
          <strong>Approve</strong> before it can be introduced. You can also cap how many working papers and draft
          resolutions the committee accepts. Our{' '}
          <Link href="/blog/mun-working-paper-guide">working paper guide</Link> covers what should be in one.
        </p>

        <H2>5. Introduce a Paper With the Timer Beside It</H2>
        <p>
          Press <strong>Introduce</strong> on a paper. The first screen is the order of proceedings: minutes for
          Reading, Presentation and Q&amp;A, each set with one minute more or one minute less, and the floor time it adds
          up to. Press <strong>Begin the introduction</strong>, or <strong>Skip the timers</strong> if the committee
          does not time introductions.
        </p>
        <p>
          The paper then opens full screen with the stage timer floating over it. Delegates read while the reading clock
          runs, the sponsors present, the committee asks questions. You can page through the PDF, zoom, move or resize
          the timer, hide it, and add time to a stage. <strong>Finish</strong> ends the introduction: a working paper
          passes at that point, and a draft resolution stays introduced, ready for its vote.
        </p>
        <Callout>
          Co-chairs can take notes on each sponsor while a paper is presented, from the same Documents screen, so the
          dais knows who actually defended the text when it comes to awards.
        </Callout>

        <TutorialVideo id="YhjHfNBSEKM">A draft resolution submitted with its sponsors and PDF, then introduced with the document and the timer on one screen.</TutorialVideo>

        <H2>6. Run the Vote on a Draft Resolution</H2>
        <p>
          On an introduced draft resolution, the Moderator presses <strong>Vote</strong>, which opens the voting screen.
          Every new vote starts with a roll call, so the count is taken against the room as it is now, not as it was this
          morning. Observers are in the room but out of the ballot.
        </p>
        <p>
          Then choose how delegations vote: by roll call, with the chair calling each one in turn, or on their own
          devices. The choices are:
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Choice</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>For</strong></td>
                <td>In favour of the resolution</td>
              </tr>
              <tr>
                <td><strong>For with Rights</strong></td>
                <td>In favour, and the delegation explains its vote afterwards</td>
              </tr>
              <tr>
                <td><strong>Abstain</strong></td>
                <td>Not available to a delegation that declared Present and voting</td>
              </tr>
              <tr>
                <td><strong>Pass</strong></td>
                <td>Asked again at the end, and must then vote For or Against</td>
              </tr>
              <tr>
                <td><strong>Against with Rights</strong></td>
                <td>Against, with an explanation afterwards</td>
              </tr>
              <tr>
                <td><strong>Against</strong></td>
                <td>Against the resolution</td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          Rights and Pass can be switched off in Settings if your rules do not use them. In a roll call vote the screen
          moves along the line one delegation at a time, and <strong>Back</strong> steps back if someone misspoke. Once
          everyone has voted, the delegations that voted with rights speak, each with the same speaking time, in an order
          you can drag to change. Then the result goes up.
        </p>
        <p>
          With device voting, each delegation votes on its own phone. The chair sees how many have voted, never how,
          until everyone has voted or the chair presses <strong>Reveal vote</strong>.
        </p>

        <H2>7. The P5 Veto and the Result</H2>
        <p>
          The threshold, how abstentions count and the veto rule sit as bookmarks on the voting screen. With the veto
          on, the five permanent members, or a list of delegations you choose, are marked as holding a veto. When one of
          them votes Against, Gavelling stops and asks: <strong>This is a veto. Record it?</strong> Press{' '}
          <strong>Record the veto</strong> and the resolution fails, whatever the count. There is also a unanimous mode,
          where every delegation present and voting must vote For.
        </p>
        <p>
          The result card says Passed, Failed, Vetoed or Unanimous, with the count, and is ready to show the room. The
          vote is saved as it goes, so a dropped connection or a reload picks up where you left off. When you are done,
          press <strong>Session</strong> in the header and the room returns to whatever it was doing before the vote. The{' '}
          <Link href="/blog/mun-security-council-guide">Security Council guide</Link> covers how the veto shapes the
          debate before it ever reaches a vote.
        </p>

        <TutorialVideo id="LhT8mic1ffQ">What happens on the voting screen when a P5 member votes Against.</TutorialVideo>

        <p>
          New to running a room on Gavelling? Start with{' '}
          <Link href="/blog/how-to-set-up-a-committee-on-gavelling">setting up a committee</Link>, then{' '}
          <Link href="/blog/gavelling-speakers-list-and-caucuses">the speakers list and caucuses</Link>, or{' '}
          <Link href="/sessions">open a free room</Link> and try it.
        </p>
      </ArticleLayout>
    </>
  );
}
