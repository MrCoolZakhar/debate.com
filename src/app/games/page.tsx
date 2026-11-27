import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import MunillionGame from './munillion/MunillionGame';
import { MUNILLION_CSS } from './munillion/styles';

const DESCRIPTION =
  'MUNillion is a free daily MUN game: seven Model UN trivia questions, 30 seconds each. Name a UN member, a committee, a clause, a resolution or a MUN conference, and the rarer your answer, the more points you score.';

export const metadata = pageMetadata({
  title: { absolute: 'MUNillion: The Free Daily MUN Game and Model UN Trivia | Gavelling' },
  description: DESCRIPTION,
  path: '/games',
  keywords: ['MUNillion', 'MUN games', 'MUN game', 'Model UN game', 'MUN trivia', 'Model UN trivia', 'daily MUN quiz', 'MUN Krillion', 'Krillion for MUN', 'Gavelling games'],
  // Its own share card (owner, 27 Nov 2026: WhatsApp showed no preview). Drawn from the pixel hall;
  // 1200x630 JPG under 300 KB so WhatsApp, iMessage and LinkedIn all show it.
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  imageAlt: 'MUNillion: a pixel UN General Assembly hall and a delegate raising a placard that reads The Gavel, +100 points',
  imageSize: { width: 1200, height: 630 },
});

// The answers below are shown on the page too (an FAQ in the JSON-LD must match visible text).
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is MUNillion?',
    a: 'MUNillion is a free daily Model UN game by Gavelling. Every day there are seven MUN questions, the same for everyone, and you type one answer to each. Correct answers that few people would think of score the most.',
  },
  {
    q: 'How does scoring work?',
    a: 'Every correct answer has a preset score. The Gavel is worth 100 and goes to exactly one answer per question, Best Delegate is 85, Outstanding Delegate 60, Honourable Mention 30 and Participation Certificate 10. A wrong answer, a pass or running out of time is Absent, worth 0. The best possible day is 700 points.',
  },
  {
    q: 'Do I need an account to play?',
    a: 'No. You can play straight away in your browser. Signing in to Gavelling keeps your streak on every device and saves your past games in your profile.',
  },
  {
    q: 'When is there a new game?',
    a: 'A new set of seven questions goes live every day at midnight UTC. Play every day to build your streak.',
  },
  {
    q: 'Is MUNillion related to Krillion?',
    a: 'MUNillion takes the idea of a daily game where rarer answers score more, which Krillion made popular, and applies it to Model UN. It is made by Gavelling and is not affiliated with Krillion.',
  },
];

const gameSchema = {
  '@context': 'https://schema.org',
  '@type': ['VideoGame', 'WebApplication'],
  name: 'MUNillion',
  url: 'https://gavelling.com/games',
  description: DESCRIPTION,
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  genre: ['Trivia', 'Educational'],
  gamePlatform: 'Web browser',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  inLanguage: 'en',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  audience: { '@type': 'EducationalAudience', educationalRole: 'student', audienceType: 'Model UN delegates' },
  publisher: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

// The game fills exactly one screen (owner, 26 Nov 2026); the top bar floats over the hall.
// Below it, out of the way of play, a short guide so search engines and new players know what this is.
export default function GamesPage() {
  return (
    <div className="mn-page">
      <style dangerouslySetInnerHTML={{ __html: MUNILLION_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="mn-shell">
        <div className="mn-nav"><SiteNav overlay /></div>
        <MunillionGame
          header={
            <header className="mn-title-row">
              <h1 className="mn-title mn-px">MUNillion</h1>
              <p className="mn-tagline mn-tx">
                <span className="mn-tag-long">Seven MUN questions a day. The rarer your answer, the bigger your placard grows</span>
                <span className="mn-tag-short">7 MUN questions a day. Rarer answers grow your placard</span>
              </p>
            </header>
          }
        />
      </div>

      <section className="mn-about" aria-labelledby="mn-about-title">
        <div className="mn-about-inner">
          <h2 id="mn-about-title" className="mn-px">How to Play MUNillion</h2>
          <p className="mn-tx">
            MUNillion is a free daily MUN game. Each day brings seven Model UN questions, the same for every player, with 30
            seconds to answer each one. Name a UN member state, a committee you would find at a conference, an operative clause
            opener, a MUN conference, a Security Council resolution or a Nobel Peace Prize winner. Any correct answer counts, but
            the rarer it is, the more points you score and the bigger your placard grows.
          </p>
          <ul className="mn-about-tiers mn-tx">
            <li><b className="mn-px">100</b> The Gavel, exactly one answer on each list</li>
            <li><b className="mn-px">85</b> Best Delegate, a very niche pick</li>
            <li><b className="mn-px">60</b> Outstanding Delegate, a strong pick most people miss</li>
            <li><b className="mn-px">30</b> Honourable Mention, a solid answer plenty of people give</li>
            <li><b className="mn-px">10</b> Participation Certificate, the answer everyone gives</li>
            <li><b className="mn-px">0</b> Absent, a wrong answer, a pass or out of time</li>
          </ul>
          <p className="mn-tx">
            Spell it slightly wrong and MUNillion asks if you meant the right answer. On the MUN conference question every
            conference listed on Gavelling counts, and if yours is missing you can add it. After the seventh question you see every
            answer on each list and can share your score.
          </p>

          <h2 className="mn-px">Questions About MUNillion</h2>
          <dl className="mn-about-faq mn-tx">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mn-px">More on MUN Games</h2>
          <ul className="mn-about-links mn-tx">
            <li><Link href="/blog/munillion-daily-mun-game">MUNillion: how to play and score</Link></li>
            <li><Link href="/blog/mun-games">MUN games for delegates and clubs</Link></li>
            <li><Link href="/blog/mun-krillion">MUN Krillion: a Krillion-style game for Model UN</Link></li>
            <li><Link href="/sessions">Run your own committee with Gavelling Sessions</Link></li>
          </ul>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
