import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Games: Fun Games for Model UN Delegates and Clubs (2027)';
const DESCRIPTION =
  'A roundup of MUN games for delegates and clubs: icebreakers, mock debates, country trivia, speed lobbying, crisis improv, clause relays, flag quizzes and the daily online game MUNillion';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-games',
  ogDescription: 'Games for Model UN delegates and clubs, from icebreakers to the daily online game MUNillion.',
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
  url: 'https://gavelling.com/blog/mun-games',
  datePublished: '2026-11-27',
  dateModified: '2026-11-27',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-games' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Games', item: 'https://gavelling.com/blog/mun-games' },
  ],
};

const FAQ: FaqItem[] = [
  {
    question: 'What are the best MUN games for a school club?',
    answer:
      'Short games that need no preparation work best: a country trivia round, a clause relay, a flag quiz and a speed lobbying drill. For a daily online game that needs no setup, MUNillion is free at gavelling.com/games.',
  },
  {
    question: 'Are there online MUN games?',
    answer:
      'Yes. MUNillion is a free daily MUN trivia game in the browser, with seven questions a day. You can also run quiz tools such as Kahoot with your own MUN questions, and practise procedure in a free online session on Gavelling.',
  },
  {
    question: 'Can MUN games help new delegates?',
    answer:
      'They help with vocabulary, country knowledge and confidence speaking in front of others. They do not replace research or practising real procedure, so use them alongside both.',
  },
  {
    question: 'How long should a MUN club game take?',
    answer:
      'Most of the games in this guide fit in 5 to 20 minutes, which makes them a good opener or closer for a meeting. MUNillion takes about four minutes, because it has seven questions of 30 seconds each.',
  },
  {
    question: 'What is MUNillion?',
    answer:
      'MUNillion is a free daily MUN game by Gavelling. You answer seven questions, one answer each, and rarer correct answers score more, up to a maximum of 700 points.',
  },
];

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-games"
        pitch="Turn the game night into a real debate: run a free MUN session on Gavelling."
      >
        <p>
          Model UN meetings go better when people laugh in the first ten minutes. A good game warms up a room, teaches
          vocabulary without a lecture and gives quiet members a low pressure way to speak. This guide collects the MUN
          games that clubs and delegates actually play, from icebreakers to crisis improv, and one you can play alone
          every day: <Link href="/games">MUNillion, the free daily MUN game</Link>.
        </p>

        <H2>MUNillion: The Daily Online MUN Game</H2>
        <p>
          If you only try one game from this list, make it this one. MUNillion is a free browser game from Gavelling
          with seven new MUN questions every day. You get 30 seconds per question and type one answer. The rarer your
          correct answer is, the more points it scores, from 100 for The Gavel down to 10 for a Participation
          Certificate, and 0 for Absent. The maximum is 700.
        </p>
        <p>
          The questions cover UN member states, committees, clause openers, MUN conferences, flags and Security
          Council resolutions. It needs no account, and a streak builds if you play daily. Read the full guide to{' '}
          <Link href="/blog/munillion-daily-mun-game">how MUNillion works and scores</Link>, or see the{' '}
          <Link href="/blog/mun-krillion">Krillion-style idea behind it</Link>. It also works as a club activity: everyone plays
          the same game on the same day, so scores are easy to compare.
        </p>

        <H2>Icebreakers for the First Meeting</H2>
        <H3>Two truths and a position</H3>
        <p>
          Each member shares two true facts about themselves and one invented fact. The group guesses the false one.
          Variation: each fact must be about the country they represent in the next simulation. It teaches research
          habits and names at the same time.
        </p>
        <H3>Placard name game</H3>
        <p>
          Everyone writes the name of a country on a folded card and places it in front of them. Go around the room and
          each person says their country, then one thing they would raise in a speech. It is a gentle first taste of
          a <Link href="/blog/mun-opening-speech">MUN opening speech</Link>.
        </p>

        <H2>Knowledge Games</H2>
        <H3>Country trivia</H3>
        <p>
          Split the club into teams. A host reads a clue about a country (its region, its major exports, a recent
          treaty it signed) and teams race to name it. Clubs that train this often find that delegates handle
          allocations with more confidence, because they are no longer lost when assigned an unfamiliar state. Our{' '}
          <Link href="/blog/mun-country-research">country research guide</Link> makes a good source of clues.
        </p>
        <H3>Flag quiz</H3>
        <p>
          Show a flag for five seconds and ask for the country. Make it harder by asking only for flags without red,
          or flags with a star. It is quick, loud and needs nothing but a projector or printouts.
        </p>
        <H3>Kahoot-style quizzes</H3>
        <p>
          Quiz platforms let you write your own questions and run them live on phones. Good MUN quiz topics are
          the <Link href="/blog/mun-glossary">MUN glossary</Link>, UN bodies, famous resolutions and rules of
          procedure. Keep rounds to ten questions, or the energy drops.
        </p>

        <H2>Procedure Games</H2>
        <H3>Resolution clause relay</H3>
        <p>
          Teams stand in lines. The first person writes a preambulatory clause on a whiteboard, the second adds an
          operative clause that follows from it, and so on down the line. Judges award points for correct clause
          openers and clear wording. Pair it with our list of{' '}
          <Link href="/blog/mun-clause-phrases">MUN clause phrases</Link>.
        </p>
        <H3>Motion bingo</H3>
        <p>
          Give each member a card of motions and points: moderated caucus, point of order, right of reply, and so
          on. A chair calls out short scenarios, and members mark the correct motion. It is an easy way to learn
          the <Link href="/blog/mun-motions-explained">motions explained in our guide</Link> without a lecture.
        </p>
        <H3>Mock debate on a silly topic</H3>
        <p>
          Run a short committee on a topic nobody takes seriously: whether pineapple belongs on pizza, or whether
          cats should have a seat in the General Assembly. Use full procedure, with a speakers list and caucus motions.
          Because the topic is ridiculous, new delegates stop worrying about being wrong and learn the rules by
          doing. If you want to run it online, you can{' '}
          <Link href="/sessions">start a free MUN session on Gavelling</Link> with a six character code.
        </p>

        <H2>Negotiation and Crisis Games</H2>
        <H3>Speed lobbying</H3>
        <p>
          Give each member a country and a short position. They have three minutes to find allies by talking to as many
          people as possible, then the group reports who ended up in which bloc. It trains the skill behind real{' '}
          <Link href="/blog/mun-bloc-building">bloc building</Link>.
        </p>
        <H3>Crisis improv</H3>
        <p>
          The chair announces an unexpected development: a border incident, a leaked document, a sudden storm. Members
          have two minutes to write a short directive responding to it. It teaches speed and creativity, and prepares
          members for a <Link href="/blog/mun-crisis-committee-guide">crisis committee</Link>.
        </p>

        <H2>Tips for Running Games in a Club</H2>
        <ul>
          <li>Keep games short, between five and twenty minutes, and finish while people still want more.</li>
          <li>Mix newcomers and experienced members on teams.</li>
          <li>Tie each game to one skill, such as research, speaking, procedure or negotiation, and say so.</li>
          <li>Give a small prize. A gavel sticker works. The point is fun, not rankings.</li>
        </ul>
        <Callout>
          A simple weekly pattern: open the meeting with the day&apos;s MUNillion, spend the middle on a procedure game,
          and close with a short mock debate.
        </Callout>
        <p>
          If you are starting a club from scratch, see our guide to{' '}
          <Link href="/blog/start-mun-club">starting a MUN club</Link>, and when you want to play today&apos;s round,{' '}
          <Link href="/games">open the MUN game</Link> and see how you score.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
