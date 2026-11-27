import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUNillion: The Daily MUN Game (How to Play and Score)';
const DESCRIPTION =
  'MUNillion is a free daily MUN trivia game. Seven questions, 30 seconds each, and the rarer your correct answer, the more it scores. How to play, how scoring works and how to build a streak';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/munillion-daily-mun-game',
  ogDescription: 'A free daily MUN trivia game: seven questions, one answer each, and rarer answers score more.',
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  imageAlt: 'MUNillion, the daily MUN game by Gavelling',
  imageSize: { width: 1200, height: 630 },
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/munillion-daily-mun-game',
  datePublished: '2026-11-27',
  dateModified: '2026-11-27',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/munillion-daily-mun-game' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUNillion', item: 'https://gavelling.com/blog/munillion-daily-mun-game' },
  ],
};

const FAQ: FaqItem[] = [
  {
    question: 'Is MUNillion free?',
    answer:
      'Yes. MUNillion is free to play in your browser at gavelling.com/games. You do not need an account to play. Signing in is optional and keeps your streak on every device.',
  },
  {
    question: 'How many questions are there each day?',
    answer:
      'Seven questions, the same for everyone, with 30 seconds for each one. A new game starts at midnight UTC.',
  },
  {
    question: 'What is the highest score in MUNillion?',
    answer:
      'The maximum is 700 points, which means giving The Gavel answer, the one answer that scores 100, on all seven questions.',
  },
  {
    question: 'What happens if I misspell an answer?',
    answer:
      'A near miss gets a Did you mean prompt. Submit again to confirm the suggestion. Answers that are not close to anything on the list score Absent, which is zero.',
  },
  {
    question: 'Do I need an account to keep my streak?',
    answer:
      'You can play without one, but signing in keeps your daily streak on every device and saves your past games in the Games tab of your profile.',
  },
  {
    question: 'Can I add a MUN conference that is missing from the list?',
    answer:
      'Yes. Every conference listed on Gavelling counts as a valid answer on the MUN conference question, and players can add a conference that is missing.',
  },
];

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="munillion-daily-mun-game"
        pitch="Run the committee on Gavelling too: free sessions, timers and speakers lists in your browser."
      >
        <p>
          MUNillion is a daily game for Model UN people. Every day there are seven questions about the world you already
          live in as a delegate: countries, committees, clause openers, conferences and the history of the Security
          Council. You type one answer per question, and the rarer your correct answer is, the more it scores. You can{' '}
          <Link href="/games">play MUNillion for free in your browser</Link> in about four minutes.
        </p>

        <H2>What MUNillion Is</H2>
        <p>
          MUNillion is made by Gavelling, the free platform for running MUN committees and conferences. It lives at{' '}
          <Link href="/games">gavelling.com/games</Link>. There is nothing to download and you do not need an account to
          play. Everyone gets the same seven questions on the same day, and a new game opens at midnight UTC, so you can
          compare notes with your club or your whole committee afterwards.
        </p>
        <p>
          The idea behind the scoring is simple. A question like &quot;name a UN member state&quot; has well over a
          hundred correct answers. Everybody can say France. Far fewer people will think of Eswatini. MUNillion rewards
          that difference: the less common your correct answer, the more points you get. If you like the idea
          behind the format, our post on{' '}
          <Link href="/blog/mun-krillion">the Krillion-style idea applied to MUN</Link> goes into it.
        </p>

        <H2>How to Play</H2>
        <p>Each game follows the same loop:</p>
        <ul>
          <li>You see a question and a 30 second timer.</li>
          <li>You type one answer and submit it.</li>
          <li>Your delegate&apos;s hand and placard grow while the answer is judged. When they stop growing, your score for that question is revealed.</li>
          <li>The next question starts. After seven, your total is shown.</li>
        </ul>
        <p>
          You only get one answer per question, so there is no guessing a list of five and hoping. A wrong answer, a
          pass and running out of time all score the same: Absent, zero points.
        </p>
        <H3>Autocorrect for near misses</H3>
        <p>
          Typing fast under a timer produces typos. If your answer is close to a real one, MUNillion shows a &quot;Did
          you mean...?&quot; prompt. Submit again to confirm the suggestion. It saves a question that you knew the answer
          to.
        </p>

        <H2>How Scoring Works</H2>
        <p>
          Every correct answer lands in a tier that depends on how rare it is. The tiers are named after the way
          conferences hand out recognition:
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Tier</th><th>Points</th><th>What it means</th></tr>
            </thead>
            <tbody>
              <tr><td>The Gavel</td><td>100</td><td>Exactly one answer per question</td></tr>
              <tr><td>Best Delegate</td><td>85</td><td>A very rare answer</td></tr>
              <tr><td>Outstanding Delegate</td><td>60</td><td>An uncommon answer</td></tr>
              <tr><td>Honourable Mention</td><td>30</td><td>A fairly common answer</td></tr>
              <tr><td>Participation Certificate</td><td>10</td><td>The answer everyone gives</td></tr>
              <tr><td>Absent</td><td>0</td><td>Wrong, passed or out of time</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          Seven questions at 100 points each makes a maximum of 700. Nobody gets all seven Gavel answers by accident:
          each question has exactly one answer that earns it.
        </p>

        <H2>The Questions in Game One</H2>
        <p>The first game covers seven kinds of question that a delegate should be comfortable with:</p>
        <ul>
          <li>A UN member state</li>
          <li>A committee you would find at a MUN</li>
          <li>An operative clause opener, the kind you meet in our <Link href="/blog/mun-clause-phrases">guide to MUN clause phrases</Link></li>
          <li>A MUN conference: every conference listed on Gavelling counts, and players can add a missing conference</li>
          <li>A UN member whose flag has no red</li>
          <li>A Security Council resolution, asked by number</li>
          <li>A Nobel Peace Prize winner</li>
        </ul>
        <p>
          Some of these have huge answer lists and some have small ones. That mix is on purpose, because it changes how
          you play from one question to the next.
        </p>

        <H2>Tips for Finding Rare Answers</H2>
        <p>
          The scoring rewards a skill every good delegate trains: knowing the corners of a topic, not only its centre.
        </p>
        <H3>Go one step past the obvious</H3>
        <p>
          On a country question, the first name that comes to mind is the one most players will type. Look for the
          member state you only know because you were once allocated it. Delegates who have represented smaller
          delegations usually do well here, which is a good argument for taking an unfashionable allocation.
        </p>
        <H3>Use the structure of the question</H3>
        <p>
          The flag question is a filter. Run through flags you can picture, discard the ones with red, and pick from
          what remains. The clause opener question rewards delegates who write resolutions and know more than
          &quot;Calls upon&quot; and &quot;Urges&quot;. Our <Link href="/blog/mun-resolution-writing">guide to resolution writing</Link> is a
          decent revision source.
        </p>
        <H3>Do not freeze</H3>
        <p>
          A typed answer in the last five seconds beats a perfect one that never arrives. Thirty seconds is short, so
          commit to your best rare answer early and let autocorrect catch the spelling.
        </p>

        <H2>Streaks and Your Profile</H2>
        <p>
          Playing on consecutive days builds a daily streak. You can play without signing in, but if you sign in the
          streak follows you to every device, and your past games are saved in the Games tab of your profile. That
          makes it easy to see how you do on a bad day compared with a good one.
        </p>

        <H2>After the Game</H2>
        <p>
          When you finish, MUNillion shows every answer on each list, grouped by score and searchable. This is the part
          many players enjoy most: you find out which answer was the single Gavel answer, and which ones you never
          thought of. You can also share your score with your club.
        </p>

        <H2>Why It Is Good Practice for Delegates</H2>
        <p>
          A MUN game is not a replacement for research, but it trains habits that matter in committee. You recall
          facts quickly, which helps when you are drafting a speech under time pressure. You learn the vocabulary of
          resolutions. You notice how many committees and conferences exist. And you build the habit of looking for the
          answer other delegates will not give, which is also how you find a distinctive point in a crowded{' '}
          <Link href="/blog/general-speakers-list-guide">speakers list</Link>.
        </p>
        <Callout>
          Chairs and club leaders: MUNillion works well as a four minute warm up at the start of a meeting. For more
          ideas, see our roundup of <Link href="/blog/mun-games">MUN games for delegates and clubs</Link>.
        </Callout>
        <p>
          When you want to put what you have learned into practice, you can{' '}
          <Link href="/sessions">run a free MUN session on Gavelling</Link> with your own committee, and then come back
          to <Link href="/games">today&apos;s MUNillion game</Link> tomorrow for a fresh set of questions.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
