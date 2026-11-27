import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Krillion: A Krillion-Style Daily Game for Model UN';
const DESCRIPTION =
  'Looking for Krillion for MUN? MUNillion applies the one answer, rarer is better idea to UN members, committees, clause openers, conferences, flags and Security Council resolutions';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-krillion',
  ogDescription: 'A Krillion-style daily game for Model UN, made by Gavelling.',
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  imageAlt: 'MUNillion, a Krillion-style daily game for Model UN',
  imageSize: { width: 1200, height: 630 },
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-krillion',
  datePublished: '2026-11-27',
  dateModified: '2026-11-27',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-krillion' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Krillion', item: 'https://gavelling.com/blog/mun-krillion' },
  ],
};

const FAQ: FaqItem[] = [
  {
    question: 'Is there a Krillion for MUN?',
    answer:
      'MUNillion is a daily game for Model UN built on the same kind of idea: you give one answer to each question, and the rarer your correct answer is, the more it scores. It is free at gavelling.com/games.',
  },
  {
    question: 'Is MUNillion affiliated with Krillion?',
    answer:
      'No. MUNillion is made by Gavelling and is not affiliated with Krillion. It is its own game with its own questions, scoring tiers and artwork.',
  },
  {
    question: 'How is MUNillion different from a normal trivia quiz?',
    answer:
      'A normal quiz has one correct answer per question. In MUNillion many answers can be correct, and the score depends on how rare your answer is. Exactly one answer per question earns the top score of 100.',
  },
  {
    question: 'What topics does MUNillion cover?',
    answer:
      'Game one asks for a UN member state, a committee you would find at a MUN, an operative clause opener, a MUN conference, a UN member whose flag has no red, a Security Council resolution by number and a Nobel Peace Prize winner.',
  },
  {
    question: 'Do I need to pay or sign up to play?',
    answer:
      'No. It is free and you can play without an account. Signing in is optional and keeps your streak on every device.',
  },
];

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-krillion"
        pitch="Gavelling is the free home of MUN sessions, conferences and now a daily MUN game."
      >
        <p>
          If you have played Krillion and wondered whether there is a version for Model UN, there is. MUNillion is a
          free daily game from Gavelling that borrows the same style of idea and points it at the things delegates know:
          countries, committees, resolutions and conferences. You can{' '}
          <Link href="/games">try the MUN version of the idea at gavelling.com/games</Link> without signing up.
        </p>
        <Callout>
          MUNillion is made by Gavelling. It is not affiliated with Krillion.
        </Callout>

        <H2>The Krillion Idea in One Paragraph</H2>
        <p>
          Krillion is a daily game at krillion.io. The core mechanic is easy to describe: you get a prompt, you give
          one answer, and the rarer your correct answer is among players, the more it scores. That one change turns
          trivia into a different kind of game. Knowing the answer is not enough. You have to know a good answer that
          fewer people will think of.
        </p>

        <H2>Why the Idea Suits Model UN</H2>
        <p>
          Model UN is full of questions with many correct answers. Name a country. Name a committee. Name a clause
          opener. A normal quiz would score all of them the same, and it would be dull, because everyone says the
          famous one. A rarity-based game makes these questions interesting, because the whole skill is
          range: how many corners of the topic do you know?
        </p>
        <p>
          That is also the skill that makes someone a good delegate. The delegate who has read beyond the first page of
          the background guide finds the angle nobody else raised. A game that rewards the same habit feels natural for
          the community. For the habit in a real committee, see our{' '}
          <Link href="/blog/mun-delegate-tips">MUN delegate tips</Link>.
        </p>

        <H2>How MUNillion Applies It</H2>
        <p>
          MUNillion gives everyone the same seven questions each day, with 30 seconds for each, and a new game at
          06:00 UTC. You type one answer per question. A correct answer lands in a tier named after MUN recognition,
          and the tier depends on rarity:
        </p>
        <ul>
          <li>The Gavel: 100 points, and exactly one answer per question earns it</li>
          <li>Best Delegate: 85</li>
          <li>Outstanding Delegate: 60</li>
          <li>Honourable Mention: 30</li>
          <li>Participation Certificate: 10</li>
          <li>Absent: 0, for a wrong answer, a pass or running out of time</li>
        </ul>
        <p>
          The maximum is 700 points. Our full walkthrough, with tips on each tier, is in{' '}
          <Link href="/blog/munillion-daily-mun-game">MUNillion: how to play and score</Link>.
        </p>

        <H2>The Questions That Make It MUN</H2>
        <p>The first game uses prompts that only make sense in the Model UN world:</p>
        <H3>UN member states and flags</H3>
        <p>
          One question asks for any UN member state, where the common answers score low and the unusual ones score
          high. Another asks for a UN member whose flag has no red, which is a small puzzle in itself.
        </p>
        <H3>Committees and clause openers</H3>
        <p>
          You are asked for a committee you would find at a MUN, which rewards delegates who have seen beyond the
          General Assembly, and for an operative clause opener. If you want to build that vocabulary, our{' '}
          <Link href="/blog/mun-clause-phrases">list of MUN clause phrases</Link> is a good start.
        </p>
        <H3>Conferences</H3>
        <p>
          One question asks for a MUN conference. Every conference listed on Gavelling counts, and players can add a
          conference that is missing, so the list grows with the community.
        </p>
        <H3>Security Council resolutions and Nobel winners</H3>
        <p>
          A Security Council resolution asked by number tests the history side of the topic, and a Nobel Peace Prize
          winner question rewards people who read the news as well as the briefing papers.
        </p>

        <H2>How It Differs From Krillion</H2>
        <p>
          MUNillion is its own game. It has its own questions about Model UN, its own scoring tiers, a delegate whose
          hand and placard grow after each answer and a score that is revealed when the growing stops. It has an
          autocorrect that offers a &quot;Did you mean...?&quot; for near misses. At the end you see every answer on
          each list, grouped by score and searchable, and you can share your score. It is free to play in the browser,
          and a daily streak builds if you come back each day. Signing in is optional and keeps the streak on every
          device.
        </p>

        <H2>A Worked Example</H2>
        <p>
          Take the committee question. Almost every player will type the Security Council or the General Assembly,
          because those are the committees everyone has heard of. Those answers are correct, but they sit in the
          lower tiers. A delegate who has sat in a specialised body, such as a human rights council or a crisis
          committee, can give an answer that fewer people think of, and the score rises. The same pattern applies to
          clause openers: the famous opener is safe, while a precise, less used one scores more. The lesson carries
          into debate, where a precise, well chosen point is worth more than the one every delegation makes. Our
          guide to <Link href="/blog/mun-committee-types">MUN committee types</Link> is a quick way to widen your range.
        </p>

        <H2>Play It With Your Club</H2>
        <p>
          Because the questions are the same for everyone, a MUN club can play together and compare results over the
          week. It also makes a quick warm up before a meeting. For other ideas, read our roundup of{' '}
          <Link href="/blog/mun-games">MUN games for delegates and clubs</Link>, and if your club is ready to debate,{' '}
          <Link href="/sessions">start a free session on Gavelling</Link>. When you are ready, the{' '}
          <Link href="/games">daily MUN game</Link> is waiting.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
