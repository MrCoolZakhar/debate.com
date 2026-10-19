import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Timer: How to Time Speeches and Caucuses (Free Timer)';
const DESCRIPTION =
  'Standard speaking times for the GSL, moderated and unmoderated caucus, right of reply and yields, the caucus arithmetic chairs get wrong, and a free MUN timer that runs every clock at once';

const FAQ: FaqItem[] = [
  {
    question: 'How long is a speech in Model UN?',
    answer:
      'A General Speakers List speech is usually 60 to 90 seconds; the committee sets the time and can change it by motion. Moderated caucus speeches are shorter, usually 30 to 60 seconds, and a right of reply is usually 30 to 60 seconds.',
  },
  {
    question: 'What timer do MUN chairs use?',
    answer:
      'Many chairs still use a phone stopwatch, which works for one clock and fails when a caucus total, a speaker clock and a right of reply all run in the same hour. A committee tool keeps them apart. Gavelling has a free speaker timer, caucus timer and right of reply timer in one session, with no account needed.',
  },
  {
    question: 'How many speakers fit in a moderated caucus?',
    answer:
      'Divide the total time by the speaking time. A 10 minute caucus with 60 second speeches fits 10 speakers; with 45 second speeches it fits 13, with 15 seconds left for a short final speech.',
  },
  {
    question: 'What happens to time a delegate does not use?',
    answer:
      'On the General Speakers List the delegate yields it: to the chair, which ends the turn, to questions, or to another delegate. Only the time remaining can be yielded. In a moderated caucus there is normally no yield and unused time simply returns to the caucus.',
  },
  {
    question: 'Is the Gavelling MUN timer free?',
    answer:
      'Yes. A Gavelling session is free and needs no account. The chair creates a room at gavelling.com/create, delegates join on their phones with a six-character code, and the speaker, caucus and right of reply timers are all included.',
  },
  {
    question: 'Should the caucus clock keep running between speakers?',
    answer:
      'Conferences differ. If the total runs continuously, every pause between speakers costs the committee time. Many chairs count only speaking time against the total, which is how the Gavelling caucus timer works: the total stops when a speaker reaches zero.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-timer',
  keywords: [
    'MUN timer',
    'Model UN timer',
    'MUN speech timer',
    'moderated caucus timer',
    'GSL timer',
    'MUN speaking time',
    'free MUN timer',
  ],
  ogDescription: 'Speaking times, caucus arithmetic and a free timer for every clock in a Model UN committee.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-timer',
  datePublished: '2026-10-19',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-timer' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Timer', item: 'https://gavelling.com/blog/mun-timer' },
  ],
};

export default function MunTimer() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-timer"
        pitch="Open a free Gavelling session and every clock in this guide is already there: the speaker, the caucus, the right of reply and the gavel knock."
      >
        <p>
          A Model UN committee does not have one clock. It has a speaker clock, a caucus total, an unmoderated countdown, a right of reply, a yield that hands time from one delegate to another, and sometimes a clock for introducing a paper. A phone stopwatch handles one of those well. This guide gives the speaking times most conferences use, the arithmetic behind a moderated caucus, and how to run every clock without losing track, including on the free timer built into a <Link href="/create/sessions">Gavelling session</Link>.
        </p>

        <H2>Standard speaking times</H2>
        <p>
          Your rules of procedure decide, and the committee can change most of these by motion. Where nothing is written down, these are the ranges you will meet on most circuits.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Clock</th><th>Usual time</th><th>Who sets it</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>General Speakers List speech</strong></td><td>60 to 90 seconds</td><td>The committee, by motion; often the chair at the start</td></tr>
              <tr><td><strong>Moderated caucus total</strong></td><td>5 to 15 minutes</td><td>The delegate who moves the caucus</td></tr>
              <tr><td><strong>Moderated caucus speech</strong></td><td>30 to 60 seconds</td><td>The same motion</td></tr>
              <tr><td><strong>Unmoderated caucus</strong></td><td>5 to 20 minutes</td><td>The delegate who moves it</td></tr>
              <tr><td><strong>Right of reply</strong></td><td>30 to 60 seconds</td><td>The chair, under the rules</td></tr>
              <tr><td><strong>Tour de Table turn</strong></td><td>30 to 60 seconds each</td><td>The motion or the chair</td></tr>
              <tr><td><strong>Answer to a point of information</strong></td><td>Short; often only answering time is counted</td><td>The rules</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">
          Ranges from common practice. THIMUN-style committees set debate time per resolution, often split into time in favour and time against, instead of a standing speakers list; see <Link href="/blog/mun-procedure-styles-compared">the procedure styles compared</Link>.
        </p>

        <H2>The arithmetic of a moderated caucus</H2>
        <p>
          A moderated caucus has two clocks that must agree: the total and the speaker. Most timing arguments in a committee come from treating them as one.
        </p>
        <FactCard title="How many speakers fit">
          Total divided by speaking time. Ten minutes at 60 seconds is ten speakers. Ten minutes at 45 seconds is thirteen speakers with 15 seconds left over. Say the number when you accept the motion, so delegates know whether raising a placard is worth it.
        </FactCard>
        <FactCard title="The last speaker">
          When the total has less left than a full speech, the last speaker gets what remains, not a full slot. Announce it: &ldquo;the delegate has 25 seconds&rdquo;. Giving a full speech past the end of the caucus quietly extends it without a vote.
        </FactCard>
        <FactCard title="Dead time between speakers">
          Decide whether the total runs while you recognise the next speaker. If it does, a slow dais loses a speaker every few minutes. Counting only speaking time against the total is the fairer default, and it is how the Gavelling caucus timer works.
        </FactCard>
        <p>
          Extending a caucus is a motion, and it is normally capped at the original total. Adding time to one speaker inside a caucus should come out of the caucus total, never on top of it.
        </p>
        <ChairScript>
          &ldquo;The motion passes. We are now in a ten-minute moderated caucus on financing, forty-five seconds per speaker. That is thirteen speakers. Delegates wishing to speak, please raise your placards.&rdquo;
        </ChairScript>

        <H2>Yields, extensions and signals</H2>
        <H3>Yields</H3>
        <p>
          On the General Speakers List, a delegate who finishes early yields the remaining time: to the chair, which ends the turn; to questions, where the clock usually runs only while the speaker answers; or to another delegate, who speaks for what is left and cannot yield it again. The rule worth enforcing is simple: <strong>only the time remaining can be yielded</strong>, never more. Our <Link href="/blog/general-speakers-list-guide">General Speakers List guide</Link> covers yields in full.
        </p>
        <H3>Adding time</H3>
        <p>
          A chair may add a few seconds for a delegate who was interrupted by a point of order or a microphone failure. Do it out loud and at once, so the room sees why the clock moved.
        </p>
        <H3>Signals</H3>
        <p>
          Delegates should never have to guess how long they have, and a delegate who has <Link href="/blog/mun-opening-speech">written their speech to the clock</Link> never needs the gavel. The usual signals are a single gavel tap at a fixed mark, often 15 or 10 seconds, and two taps at zero. Some chairs hold up a card. Whatever you choose, tell the committee at the start and use it every time.
        </p>
        <Callout>
          Cut a delegate off at zero, politely, every time, from the first speech. A chair who lets the first three speakers run over by ten seconds has set a new speaking time without a vote.
        </Callout>

        <H2>Why a stopwatch is not enough</H2>
        <ul>
          <li><strong>It holds one clock.</strong> In a moderated caucus you need two, and the right of reply needs a third that does not disturb either.</li>
          <li><strong>Only the chair can see it.</strong> A projected timer settles the &ldquo;I had ten more seconds&rdquo; argument before it starts.</li>
          <li><strong>It forgets.</strong> A locked phone or a closed tab mid-speech loses the time remaining, and the room watches you guess.</li>
          <li><strong>Two chairs, two clocks.</strong> A co-chair keeping a separate stopwatch will disagree with yours within a minute.</li>
          <li><strong>It records nothing.</strong> At the end of the day you need to know who spoke and for how long, especially if you are <Link href="/blog/mun-judging-rubric">judging the committee</Link>.</li>
        </ul>

        <H2>The free MUN timer in Gavelling</H2>
        <p>
          Gavelling is a free committee tool. A chair creates a room with no account, puts the chair screen on the projector, and every clock below runs inside the same session.
        </p>
        <H3>Speaker timer</H3>
        <p>
          The chair sets the speaking time for the list (90 seconds unless you change it). The countdown itself is the start and pause button, beside Restart, Next and Add time. Next logs the speech and brings up the next delegation on the list. An optional setting starts the next speaker&rsquo;s clock automatically when you press Next.
        </p>
        <H3>Caucus timers</H3>
        <p>
          A moderated caucus shows its total and the current speaker together, with its own queue that never touches the General Speakers List. The total stops when a speaker reaches zero, the last speaker&rsquo;s clock is capped at what the caucus has left, and extra time for a speaker cannot exceed the total. Unmoderated caucus, Tour de Table and Consultation of the Whole each have their own countdown.
        </p>
        <H3>Right of reply and yields</H3>
        <p>
          Right of reply opens on its own movable panel with its own clock, so it never disturbs the speaker or the list. A yield gives the remaining time, and only that, either to the next speaker or to another delegation.
        </p>
        <H3>The gavel knock</H3>
        <p>
          Two knocks sound when a running clock reaches a mark you choose: 15 seconds by default, anywhere from 1 to 600. It plays on the moderating chair&rsquo;s laptop only. Pausing, reloading, restarting or adding time never sets it off.
        </p>
        <H3>One clock on every screen</H3>
        <p>
          Clocks are kept against the server&rsquo;s time rather than each laptop&rsquo;s, so the projector, a co-chair&rsquo;s laptop and a reload all show the same seconds. Delegates join on their phones with a six-character code and see whether they are speaking, their place in the queue and the caucus clock; the speech countdown stays on the chair&rsquo;s screen and the projector.
        </p>
        <H3>The record keeps itself</H3>
        <p>
          Every speech is logged with its delegation and length, and at the end of debate the whole record downloads as a spreadsheet: speeches, attendance, motions and scores.
        </p>

        <H2>Setting it up in two minutes</H2>
        <ul className="gv-check">
          <li><strong>Create the room</strong> at <Link href="/create/sessions">gavelling.com/create</Link>: committee name and topic. No account.</li>
          <li><strong>Put the session code on screen</strong> so delegates can join at gavelling.com/join, then take roll call.</li>
          <li><strong>Set the speaking time</strong> and begin the session. The General Speakers List opens.</li>
          <li><strong>Choose your gavel mark</strong> in Settings, and decide whether Next starts the clock by itself.</li>
          <li><strong>Accept caucus motions</strong> from the Motions tab with their total and speaking time, and the caucus clocks take over.</li>
        </ul>
        <p>
          If you are new to the dais, read <Link href="/blog/how-to-chair-first-mun">how to chair your first MUN</Link> and keep the <Link href="/blog/mun-chair-script">chair script</Link> open for the words that go with each clock. For running caucuses well rather than only timing them, see <Link href="/blog/how-to-run-moderated-caucus">how to run a moderated caucus</Link>.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
