import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const SLUG = 'mun-press-delegate-awards';
const TITLE = 'How Press Delegates Are Judged and Win Awards at MUN';
const DESCRIPTION =
  'The criteria press chairs use, how to build a portfolio over a conference, the award categories for press, and what actually separates the winner';
const OG = 'What Model UN press chairs look for when they give press awards, and how to build a winning portfolio.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: `/blog/${SLUG}`,
  ogDescription: OG,
  type: 'article',
});

const FAQ: FaqItem[] = [
  {
    question: 'Can press delegates win Best Delegate at MUN?',
    answer:
      'Most conferences give the press corps its own awards, often called Best Journalist or Best Reporter, with the same standing as Best Delegate in other committees. Some also give awards for photography or for the best single piece.',
  },
  {
    question: 'What do press chairs look for in MUN?',
    answer:
      'Accuracy first, then volume and timeliness of output, quality of reporting (interviews, sourcing, presence in committee rooms), quality of writing, and in the assigned outlet model, consistency with the outlet. Speaking matters very little.',
  },
  {
    question: 'How many articles should a MUN press delegate write?',
    answer:
      'Two good pieces a day plus short releases at the key moments is a strong output at most conferences. More is only better if the quality holds; one wrong vote count costs more than one extra article gains.',
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
    { '@type': 'ListItem', position: 3, name: 'MUN Press Delegate Awards', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function MunPressDelegateAwards() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug={SLUG}
        pitch="On Gavelling every reporter keeps a history of the releases they sent from the Press Desk: the portfolio a press chair reads at the end."
      >
        <p>
          Press awards look arbitrary from outside. A delegate who never spoke wins Best Journalist; the confident reporter who was in every corridor gets nothing. Once you know what press chairs are actually marking, the result usually makes sense. This guide covers the criteria, how to build a portfolio across a conference, the categories press awards come in, and the habits that separate the winner from the runner-up.
        </p>
        <p>
          It assumes you know how a press committee works; if not, start with <Link href="/blog/mun-press-corps-guide">the MUN press corps guide</Link>. For how ordinary committees are judged, compare the <Link href="/blog/mun-judging-rubric">MUN judging rubric</Link>.
        </p>

        <H2>Why Press Is Judged Differently</H2>
        <p>
          In an ordinary committee, chairs judge what they see: speeches, caucus leadership, papers. In a press corps, the press chair judges what they read. Almost all the evidence is the work you filed, and the chair reads all of it, often twice. That has three consequences.
        </p>
        <ul>
          <li><strong>Speaking barely counts.</strong> A reporter who never says a word in public but files accurate, sharp pieces on time will beat a charismatic one who files late.</li>
          <li><strong>Mistakes are permanent.</strong> A delegate who misspeaks can correct it in the next speech. A wrong vote count in a published release stays there.</li>
          <li><strong>Everything is comparable.</strong> Every reporter covered the same conference, so the chair can put your report of the Security Council veto next to three others and see which is best.</li>
        </ul>

        <H2>The Criteria Press Chairs Use</H2>
        <p>
          Conferences word them differently, but almost every press rubric comes down to these five, roughly in this order of weight.
        </p>
        <TableWrap>
          <table>
            <thead><tr><th>Criterion</th><th>What scores well</th><th>What loses marks</th></tr></thead>
            <tbody>
              <tr><td>Accuracy</td><td>Every vote, name, number and quote right</td><td>One wrong count, a misattributed quote, a procedure word misused</td></tr>
              <tr><td>Output</td><td>Filed every deadline, to length, in the form assigned</td><td>Missed deadlines, one long piece instead of the three asked for</td></tr>
              <tr><td>Reporting</td><td>In committee rooms, interviews on both sides, stories nobody else had</td><td>Writing from the press room, quoting only friends</td></tr>
              <tr><td>Writing</td><td>Leads that carry the news, tight structure, no padding</td><td>Essays, adjectives, the result in the third paragraph</td></tr>
              <tr><td>Character or editorial judgement</td><td>In the assigned outlet model, the outlet&apos;s voice without bending facts; in the independent model, balance</td><td>An outlet that sounds like every other, or bias that changes facts</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          Some conferences add professionalism (how you behaved in committee rooms, whether chairs complained) and initiative (a press conference you organised, a series you proposed). Ask your press chair for the rubric on day one. If there is not one, ask what they will be looking for; the question alone tells them you are serious.
        </p>

        <H2>Accuracy: The Criterion That Decides Most Awards</H2>
        <p>
          When two reporters are close, accuracy decides it. Press chairs check, and delegates complain when they are misreported, which means the chair hears about every mistake.
        </p>
        <ul className="gv-check">
          <li>Write every vote count down the moment the chair announces it</li>
          <li>Check the draft number and what it does against the paper itself</li>
          <li>Quote word for word or paraphrase without quotation marks; never in between</li>
          <li>Spell delegations and committees correctly, including acronyms</li>
          <li>Use procedure words correctly: amendment, motion, draft resolution, veto</li>
          <li>When you get something wrong, correct it in your next release. Press chairs notice that too</li>
        </ul>
        <p>
          If procedure is your weak point, read <Link href="/blog/mun-voting-procedures">MUN voting procedures</Link> and <Link href="/blog/mun-motions-explained">MUN motions explained</Link> before the conference. Most press errors are procedure errors.
        </p>

        <H2>Building a Portfolio Over the Conference</H2>
        <p>
          Your portfolio is everything you published, read together. Press chairs judge it as a body of work, so plan it like one.
        </p>
        <H3>Range</H3>
        <p>
          A winning portfolio usually shows several forms: short releases at the key moments, at least one full news article, an interview or profile, and, if your conference allows it, an opinion piece. Range shows you can do the whole job, not one trick.
        </p>
        <H3>An arc</H3>
        <p>
          Follow your committees across the weekend. A release when the bloc forms, another when it splits, a full piece on the vote, a profile of the delegate who brokered it. Read in order, that is a story, and it shows a press chair you understood the committee rather than reporting events one at a time.
        </p>
        <H3>One piece only you could have written</H3>
        <p>
          The award usually goes to the reporter with a scoop: the interview nobody else got, the sponsor who explained why they left, the clause you spotted had been changed. Ask the question others did not, of the delegate others ignored.
        </p>
        <Callout>
          Read your own portfolio on the last morning, as the press chair will. If the best piece is from day one, you have stopped trying. If a release has a mistake, the last-day correction still counts.
        </Callout>

        <H2>Press Award Categories</H2>
        <p>
          Press corps usually have their own awards, ranked alongside the other committees. Common ones:
        </p>
        <FactCard title="Best Journalist or Best Reporter">
          The top press award. Goes to the strongest portfolio overall, usually the most accurate reporter with the most stories of their own.
        </FactCard>
        <FactCard title="Outstanding Journalist">
          The second award. Often the reporter whose writing is strongest but whose output was smaller, or the reverse.
        </FactCard>
        <FactCard title="Honourable Mention">
          Strong work with one weakness: a missed deadline, a mistake, a narrow range.
        </FactCard>
        <FactCard title="Best Photography or Best Piece">
          At larger conferences, awards for a single standout photograph, article or interview.
        </FactCard>
        <p>
          The <Link href="/blog/mun-award-categories">MUN award categories guide</Link> covers how these sit beside the committee awards, and the <Link href="/blog/mun-awards-guide">MUN awards guide</Link> covers what delegates in other committees are judged on.
        </p>

        <H2>What Press Chairs Say Separates the Winner</H2>
        <p>
          The gap between the award and the honourable mention is usually small, and it is usually one of these.
        </p>
        <ol>
          <li><strong>They were in the room.</strong> The winner sat in committees and talked to people. The runner-up wrote well from the press room.</li>
          <li><strong>They filed first.</strong> The first accurate release after a vote is worth more than the best one an hour later.</li>
          <li><strong>They took edits.</strong> A reporter whose second-day copy has fixed what the editor marked on day one shows exactly the growth a chair wants to reward.</li>
          <li><strong>They made the press corps better.</strong> Shared a tip, covered a colleague&apos;s committee when needed, proposed the press conference.</li>
          <li><strong>They did not chase drama.</strong> Satire and edge are fine. Mocking a delegate or publishing something unchecked is the fastest way to lose an award you were winning.</li>
        </ol>

        <H2>How This Works on Gavelling</H2>
        <p>
          At a conference that runs on Gavelling, the press corps is a committee of type press whose seats are outlets. During the conference days, reporters, press chairs and accepted press observers use the Press Desk, which shows every open room, who is speaking and next, and introduced papers. That makes the &quot;be in the right room&quot; part of the job easier: you can see which committee has a draft on the floor.
        </p>
        <p>
          Reporters send press releases of up to 600 characters, with an optional photo, to the committee rooms they choose (every room by default), at most three per person in any 24 hours. The cap rewards exactly what press chairs reward: choosing the stories that matter. When the press chair&apos;s approval setting is on, which is the default, a delegate&apos;s release waits for a press chair to approve it, so the press chair reads every release before the room does. Releases appear in each chosen room&apos;s Everyone chat as <strong>Press · &lt;outlet&gt;</strong> and as a notification, never as a card on the chair&apos;s screen.
        </p>
        <p>
          Every reporter can see the history of the releases they sent, so the portfolio is already collected when the press chair sits down to judge. Where a conference sets up awards for its committees on Gavelling, chairs nominate, the secretariat approves and publishes, and each recipient gets a verified entry on their MUN CV. The <Link href="/blog/choosing-awards-with-gavelling">guide to choosing awards on Gavelling</Link> covers that side, and <Link href="/blog/mun-on-your-cv">putting MUN on your CV</Link> covers what to do with the award afterwards.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />

        <p>
          The skills behind every criterion here are covered in more depth in <Link href="/blog/how-to-write-mun-press-release">how to write a MUN press release</Link>, <Link href="/blog/mun-journalist-guide">the MUN journalist&apos;s guide</Link> and <Link href="/blog/mun-press-conference-guide">how MUN press conferences work</Link>. If you are looking for a conference with a press corps to try it at, browse the <Link href="/conferences/explore">conference directory</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
