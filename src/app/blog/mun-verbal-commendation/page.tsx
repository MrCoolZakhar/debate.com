import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'Verbal Commendation in MUN, and What High Commendation Means';
const DESCRIPTION =
  'What a Verbal Commendation, a High Commendation and an Honourable Mention mean in Model UN, where each sits on the award ladder in different circuits, and how to earn one';

const FAQ: FaqItem[] = [
  {
    question: 'What is a Verbal Commendation in MUN?',
    answer:
      'A Verbal Commendation is the lowest regular individual award at many Model UN conferences. It recognises one specific contribution, such as a strong speech, a well-argued amendment or brokering a merger, rather than a whole conference of performance. It is usually read out at the closing ceremony and often comes without a certificate.',
  },
  {
    question: 'What does High Commendation mean in MUN?',
    answer:
      'At conferences that use it, High Commendation is the award just below Best Delegate: second place in the committee in all but name. The name is common at school conferences in India, while many UK school conferences use Highly Commended for the same tier, above Commended.',
  },
  {
    question: 'Is a Verbal Commendation good?',
    answer:
      'Yes. Most delegates in a committee leave with no award, so a Verbal Commendation means the dais singled out something you did. It is the lowest rung of the ladder, so describe the contribution it recognised rather than presenting it as a placing.',
  },
  {
    question: 'Is Honourable Mention higher than Verbal Commendation?',
    answer:
      'At most conferences that give both, yes. The usual order is Best Delegate, Outstanding Delegate, Honourable Mention, then Verbal Commendation. A conference can order them differently, so check its awards policy or the order the awards were read out.',
  },
  {
    question: 'Do you get a certificate for a Verbal Commendation?',
    answer:
      'It depends on the conference. The name comes from the award being announced aloud, and many conferences give no certificate for it. Others print one like every other award. Ask the secretariat if you need written proof.',
  },
  {
    question: 'How do I write a Verbal Commendation on my CV?',
    answer:
      'Write the award, the committee and the conference, then one line on what it recognised, for example the amendment you wrote or the merger you brokered. A reader who was not there cannot rank the award, but they can understand the contribution.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-verbal-commendation',
  keywords: [
    'verbal commendation',
    'verbal commendation MUN',
    'high commendation MUN',
    'high commendation meaning in MUN',
    'highly commended MUN',
    'special mention MUN',
    'honourable mention MUN',
  ],
  ogDescription: 'Verbal Commendation, High Commendation and Honourable Mention in Model UN, explained.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-verbal-commendation',
  datePublished: '2026-10-19',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-verbal-commendation' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Verbal Commendation in MUN', item: 'https://gavelling.com/blog/mun-verbal-commendation' },
  ],
};

export default function MunVerbalCommendation() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-verbal-commendation"
        pitch="Gavelling logs every speech, motion and paper as the committee runs, so a dais can point to the moment that earned a commendation."
      >
        <p>
          A <strong>Verbal Commendation</strong> is a Model UN award for one specific contribution: a speech, an amendment, a merger brokered at the back of the room. It is usually the lowest regular award a committee gives, it is usually read out rather than printed, and it is worth more than it sounds. A <strong>High Commendation</strong> is a different thing entirely: at the conferences that use the name, it is the award just below Best Delegate. This page explains both, and the names that sit between them, because the same words mean different places on the ladder in different countries.
        </p>
        <p>
          For the full set of awards, from Best Delegate to delegation awards, see <Link href="/blog/mun-award-categories">MUN award categories explained</Link>. This page is about the two names people search for most because nobody explains them.
        </p>

        <H2>What a Verbal Commendation means</H2>
        <p>
          The name gives the history away: it is a commendation spoken from the dais. Some conferences call it a Diplomatic Commendation or a Special Mention. It differs from the awards above it in one way that matters: it is usually given for <em>one thing</em>, where Best Delegate, Outstanding Delegate and Honourable Mention are given for a whole conference of performance.
        </p>
        <ul>
          <li><strong>It is selective.</strong> In a forty-seat committee, perhaps eight to ten delegates leave with any award. A commendation puts you in that group.</li>
          <li><strong>It is specific.</strong> The chair remembered a particular moment. That is often more useful feedback than a higher award given for a general impression.</li>
          <li><strong>It is not always certificated.</strong> Many conferences announce it and print nothing. Others treat it like any other award.</li>
          <li><strong>Some conferences do not give it.</strong> A committee may stop at Honourable Mention.</li>
        </ul>

        <H2>What a High Commendation means</H2>
        <p>
          At many school conferences in India, the individual awards are Best Delegate, <strong>High Commendation</strong>, Special Mention and Verbal Mention. There, a High Commendation is the second award in the committee: it is close to the top, not a consolation. A delegate who wins one has usually been in the running for Best Delegate.
        </p>
        <p>
          Many UK school conferences use <strong>Highly Commended</strong> and <strong>Commended</strong> instead. Highly Commended usually sits just below the top award (called Best, Outstanding or Distinguished Delegate depending on the conference) and above Commended.
        </p>
        <Callout>
          Read a commendation by its position, not its wording. &ldquo;High Commendation&rdquo; is near the top of its ladder; &ldquo;Verbal Commendation&rdquo; is at the bottom of its ladder. The word commendation tells you nothing on its own.
        </Callout>

        <H2>Where each one sits, by circuit</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Place</th><th>Common in the US and at many international conferences</th><th>Common at school conferences in India</th><th>Common at UK school conferences</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>1st</strong></td><td>Best Delegate</td><td>Best Delegate</td><td>Best or Outstanding Delegate</td></tr>
              <tr><td><strong>2nd</strong></td><td>Outstanding Delegate</td><td>High Commendation</td><td>Highly Commended</td></tr>
              <tr><td><strong>3rd</strong></td><td>Honourable Mention</td><td>Special Mention</td><td>Commended</td></tr>
              <tr><td><strong>4th</strong></td><td>Verbal Commendation</td><td>Verbal Mention</td><td>Sometimes a special or committee award</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">
          Drawn from published award lists and school news reports from conferences in the United States, India, the United Kingdom and Singapore, reviewed October 2026. There is no governing body for MUN awards: names, order and numbers change from conference to conference.
        </p>
        <p>
          If you cannot tell where your award sits, use the order of the closing ceremony. Most conferences announce each committee&rsquo;s awards from the lowest to the highest, so the first name read out is the bottom rung. The conference&rsquo;s awards policy, if it publishes one, settles it.
        </p>

        <H2>How to earn a Verbal Commendation</H2>
        <p>
          Because it rewards one contribution, it is the award a first-time delegate can most realistically plan for. Chairs commend moments they can name in a sentence. Give them one.
        </p>
        <FactCard title="The amendment that fixed a clause">
          Find the weakest operative clause in the leading draft and write the amendment that makes it work. Bring the sponsors on board before you submit it, so it passes as a friendly amendment. Our <Link href="/blog/mun-amendment-guide">amendment guide</Link> covers how.
        </FactCard>
        <FactCard title="The merger nobody else could broker">
          Two blocs with competing working papers are the most common deadlock in a committee. The delegate who brings both sides to one table, with a list of clauses each side keeps, is remembered by the dais. Our <Link href="/blog/mun-working-paper-guide">working paper guide</Link> walks through a merger clause by clause.
        </FactCard>
        <FactCard title="The speech that changed the debate">
          Not the loudest speech: the one that named what the committee was avoiding and moved a caucus onto it. One clear ask the room can write down is what makes a speech memorable from the dais.
        </FactCard>
        <FactCard title="The question that exposed a gap">
          A sharp point of information that shows a clause has no funding or no enforcement, asked politely, is the kind of moment a chair writes down.
        </FactCard>

        <H2>From commendation to High Commendation</H2>
        <p>
          The awards above a commendation reward consistency across every session, not one good hour. The difference between a delegate commended for a moment and one in the running for second place is usually three things:
        </p>
        <ul>
          <li><strong>Presence in every session,</strong> including the slow ones after lunch, on the speakers list and in caucus.</li>
          <li><strong>Visible authorship,</strong> as a sponsor of a draft resolution whose clauses you can explain line by line.</li>
          <li><strong>Leadership without dominance:</strong> bringing quieter delegations into the text instead of speaking over them.</li>
        </ul>
        <p>
          Chairs look for those across the whole conference; our guide to <Link href="/blog/mun-awards-guide">how Best Delegate is chosen</Link> walks through what they weigh, and <Link href="/blog/mun-judging-rubric">the chair&rsquo;s scoring rubric</Link> shows how many daises score it.
        </p>

        <H2>Putting it on your CV</H2>
        <p>
          A reader outside Model UN cannot rank a Verbal Commendation against an Honourable Mention, so do not make them try. Write the award, the committee and the conference, then one line on what it recognised.
        </p>
        <ul className="gv-check">
          <li><strong>Weak:</strong> &ldquo;Verbal Commendation, Example MUN 2026.&rdquo;</li>
          <li><strong>Better:</strong> &ldquo;Verbal Commendation, Human Rights Council, Example MUN 2026, for an amendment on independent monitoring adopted in the final resolution.&rdquo;</li>
          <li><strong>For a High Commendation:</strong> say it was the second award in the committee, because a reader outside India or the UK will not know.</li>
        </ul>
        <p>
          More on this in <Link href="/blog/mun-on-your-cv">putting Model UN on your CV</Link>. If your conference publishes its awards on Gavelling, each award also appears as a verified entry on your Gavelling CV. You can find conferences to aim for on <Link href="/conferences/explore">Explore</Link>.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
