import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const SLUG = 'mun-press-conference-guide';
const TITLE = 'MUN Press Conferences: How They Work and How to Run One';
const DESCRIPTION =
  'The format of a Model UN press conference, how to ask questions and follow-ups that get answers, how delegates should answer, and how to chair one';
const OG = 'How a Model UN press conference works, for reporters, for the delegates answering and for the chair running it.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: `/blog/${SLUG}`,
  ogDescription: OG,
  type: 'article',
});

const FAQ: FaqItem[] = [
  {
    question: 'What is a press conference in MUN?',
    answer:
      'A short, chaired session where one or more delegations answer questions from the press corps, usually after a vote, at the start of a crisis or when a bloc has formed. It gives reporters on-the-record quotes and gives delegates practice defending a position under pressure.',
  },
  {
    question: 'How long is a MUN press conference?',
    answer:
      'Usually 15 to 30 minutes: a one-minute opening statement from each delegation, then questions. Longer than 30 minutes and the questions start repeating.',
  },
  {
    question: 'Who chairs a MUN press conference?',
    answer:
      'Normally the press chair or a member of the secretariat. The chair calls on reporters, keeps time, enforces one question and one follow-up each, and ends the conference on time.',
  },
  {
    question: 'Can delegates refuse to answer a question at a press conference?',
    answer:
      'Yes. Declining to comment is a legitimate answer, and reporters can report that a delegation declined. Repeatedly refusing every question usually makes a worse story than answering.',
  },
];

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
    { '@type': 'ListItem', position: 3, name: 'MUN Press Conferences', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function MunPressConferenceGuide() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug={SLUG}
        pitch="Press chairs and reporters on Gavelling can open the press committee's own debate room from the Press Desk, and send the best quotes into the rooms that need them."
      >
        <p>
          A press conference is the one moment at a Model UN conference when the press corps and the delegates meet on equal terms. The delegates get a platform; the reporters get the on-the-record quotes they could not get in a corridor. Done well, it produces the best copy of the weekend and some of the best speaking practice. Done badly, it is twenty minutes of prepared statements and a question nobody answers. This guide explains the format, how reporters should ask and follow up, how delegates should answer, and how to chair one.
        </p>
        <p>
          If you are organising the press corps that holds them, read <Link href="/blog/how-to-run-mun-press-corps">how to run a press corps at a MUN conference</Link> alongside this one.
        </p>

        <H2>When MUN Conferences Hold Press Conferences</H2>
        <p>
          Press conferences are not part of the rules of procedure. The secretariat or the press chair schedules them, usually at one of four moments.
        </p>
        <ul>
          <li><strong>After a major vote.</strong> The main sponsors of a passed or failed draft explain what happened. The most common and most useful kind.</li>
          <li><strong>At the start of a crisis.</strong> A government, an agency or the secretariat briefs the press, often with information the delegates do not have yet.</li>
          <li><strong>When a bloc forms.</strong> Two or three delegations announce a joint position, usually to put pressure on the undecided.</li>
          <li><strong>A secretariat briefing.</strong> The Secretary-General opens the conference or answers questions about it. Lower stakes, good practice for first-year reporters.</li>
        </ul>
        <p>
          Some conferences let delegations request one. That is worth allowing with a limit, because a delegation asking for the press is itself a story.
        </p>

        <H2>The Format</H2>
        <p>
          A clear format is what makes a press conference work. This one fits in 25 minutes and can be adapted.
        </p>
        <TableWrap>
          <table>
            <thead><tr><th>Part</th><th>Time</th><th>What happens</th></tr></thead>
            <tbody>
              <tr><td>Opening</td><td>1 minute</td><td>The chair names the delegations present and the rules</td></tr>
              <tr><td>Statements</td><td>1 minute each</td><td>Each delegation states its position. No more than one minute</td></tr>
              <tr><td>Questions</td><td>15 to 20 minutes</td><td>Reporters called by the chair, one question and one follow-up each</td></tr>
              <tr><td>Last round</td><td>2 minutes</td><td>One final question from any reporter not yet called</td></tr>
              <tr><td>Close</td><td>30 seconds</td><td>The chair ends on time, and the record is closed</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          Seat the delegations at a table at the front, facing the press. Reporters raise their placards or hands to be called, as delegates do in committee. If there are more than three delegations, run it as two separate press conferences: five people answering at once means nobody answers properly.
        </p>

        <H2>Asking Questions as a Reporter</H2>
        <p>
          You will get one question and one follow-up, in front of every other reporter. Make the question something only your story needs answered.
        </p>
        <H3>Prepare three, use one</H3>
        <p>
          Write three questions before you walk in. By the time you are called, someone will have asked one of them. Listen to the statements: the best question is often about what a delegation did not say.
        </p>
        <H3>Questions that get answers</H3>
        <ul className="gv-check">
          <li>Specific: &quot;Clause 4 was removed this morning. What did you get in exchange?&quot;</li>
          <li>About a fact the delegate cannot deny: &quot;You voted against the same fund in the General Assembly. What changed?&quot;</li>
          <li>About the next step: &quot;If the Council rejects this, what will you propose instead?&quot;</li>
          <li>About someone else: &quot;Did the African Group ask you to drop the sanctions clause?&quot;</li>
          <li>Short. One sentence. A question with a preamble invites a speech in reply</li>
        </ul>
        <H3>Questions that waste your turn</H3>
        <ul>
          <li>&quot;How do you feel about the result?&quot; Gets a prepared statement.</li>
          <li>Two questions in one. The delegate answers the easier one.</li>
          <li>A speech ending in &quot;do you agree?&quot;. The chair should cut you off, and you have used your turn.</li>
          <li>A question you already know the answer to and only want on tape. Sometimes useful; usually dull.</li>
        </ul>

        <H2>The Follow-Up</H2>
        <p>
          The follow-up is where press conferences produce news. Prepared statements cover the first question; the follow-up is where a delegate has to think.
        </p>
        <p>
          The simplest follow-up repeats the part of the question that was not answered: &quot;You said the fund will be audited. By whom?&quot; The second simplest quotes the delegate back: &quot;You said this morning you would never accept a voluntary fund. Is this a voluntary fund?&quot; Keep it shorter than the first question. If the delegate dodges twice, that is your story, and you can report it as such.
        </p>
        <Callout>
          Write down the exact words of every answer you might use. A press conference is on the record by definition, which also means every reporter in the room can check your quote.
        </Callout>

        <H2>Answering Questions as a Delegate</H2>
        <p>
          A press conference is public speaking with no speakers list to hide behind. The same skills apply, under more pressure. Our <Link href="/blog/mun-public-speaking-tips">public speaking tips</Link> cover the basics; these are specific to the press.
        </p>
        <ul>
          <li><strong>Prepare your one-minute statement</strong> as a full sentence you could see quoted. That is the line you want in every release.</li>
          <li><strong>Answer the question, then bridge.</strong> Give the direct answer first, then move to your message. Bridging without answering is noticed.</li>
          <li><strong>Agree who answers what</strong> with the other delegations at the table. Two delegates contradicting each other is the story nobody wanted.</li>
          <li><strong>&quot;We will not comment on that&quot;</strong> is allowed, once or twice. Every time after that is a story.</li>
          <li><strong>Stay in character.</strong> You speak for your country, not yourself. A Security Council permanent member does not apologise for a veto.</li>
          <li><strong>Never attack the reporter.</strong> Attack the premise of the question if you must.</li>
        </ul>

        <H2>Chairing a Press Conference</H2>
        <p>
          The chair is usually the press chair or a member of the secretariat. The job is to be fair to both sides and to keep time, and to look like you are doing both.
        </p>
        <ChairScript>
          <p>Good afternoon. This press conference is on the record. We have the delegations of Kenya, India and Norway, sponsors of Draft Resolution 2/1, which passed this morning.</p>
          <p>Each delegation has one minute for a statement. Reporters then have one question and one follow-up each. Please give your name and outlet before your question.</p>
          <p>The delegation of Kenya, your statement, please.</p>
        </ChairScript>
        <H3>Five rules for the chair</H3>
        <ol>
          <li><strong>Call reporters evenly.</strong> Keep a list, and do not call the same outlet twice until everyone has asked.</li>
          <li><strong>Cut preambles.</strong> &quot;Your question, please&quot; after fifteen seconds of speech.</li>
          <li><strong>Protect the follow-up.</strong> Let the reporter follow up before moving on, and do not let a delegate answer a different question.</li>
          <li><strong>Keep the delegations to their time.</strong> A one-minute statement is a minute.</li>
          <li><strong>End on time.</strong> Reporters have deadlines. A press conference that overruns costs every reporter a release.</li>
        </ol>
        <p>
          If a question is personal rather than political, rule it out at once and move on. The <Link href="/blog/mun-press-corps-guide">press corps guide</Link> sets out where that line sits.
        </p>

        <H2>Turning a Press Conference Into Copy</H2>
        <p>
          Every reporter in the room has the same quotes, so the story is in the selection. Lead with the answer that changed something: a concession, a threat, a refusal, a contradiction between two delegations. A release from a press conference should be filed within ten minutes of it ending, before the room has moved on.
        </p>
        <p className="gv-note">
          Example: &quot;Norway breaks with co-sponsors on audit. At a press conference after Draft Resolution 2/1 passed, the delegate of Norway said the new fund &apos;will be audited by the Board of Auditors or Norway will not pay into it&apos;. Kenya and India, also at the table, declined to commit to an audit.&quot;
        </p>
        <p>
          <Link href="/blog/how-to-write-mun-press-release">How to write a MUN press release</Link> covers the headline, lead and length in detail.
        </p>

        <H2>Press Conferences on Gavelling</H2>
        <p>
          Gavelling does not have a separate press conference feature, and you do not need one: a press conference happens in a room, with people. What the press side of Gavelling does is help before and after.
        </p>
        <p>
          Before, the Press Desk shows press reporters and press chairs every open committee room, who is speaking and who is next, and the papers each room has introduced, so you can see when a vote is close and schedule the press conference for straight after it. Press chairs and press delegates can join the press committee&apos;s own debate room from the Press Desk, which works well as a mock press briefing room: the press chair runs it with the usual speakers list and timers.
        </p>
        <p>
          After, a reporter sends the story as a press release of up to 600 characters, with an optional photo, to the rooms it concerns; all rooms are selected by default. If the press chair&apos;s approval setting is on, a delegate&apos;s release waits for a press chair first. It lands in each chosen room&apos;s Everyone chat as <strong>Press · &lt;outlet&gt;</strong> and as a notification, never as a card on the chair&apos;s screen, so delegates read the quote without the debate stopping.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />

        <p>
          Asking good questions in public is also a large part of how press delegates are judged; <Link href="/blog/mun-press-delegate-awards">how press delegates win awards</Link> explains the rest. For the procedure the delegates at the table were just using, see <Link href="/blog/mun-voting-procedures">MUN voting procedures</Link>, or open a free practice room at <Link href="/sessions">gavelling.com/sessions</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
