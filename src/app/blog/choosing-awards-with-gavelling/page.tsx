import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';

export const revalidate = 3600; // scheduled videos appear in the server HTML and JSON-LD within an hour of release

const SLUG = 'choosing-awards-with-gavelling';
const TITLE = "How to Choose MUN Awards with Gavelling's Scoreboard";
const DESCRIPTION =
  'Where every point comes from, how to set your own points system, and how to use the scoreboard and history to pick awards you can defend';
const OG = 'Use the Gavelling scoreboard, its history and your own notes to choose MUN awards you can explain.';

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
    { '@type': 'ListItem', position: 3, name: 'Choosing Awards with Gavelling', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

const SOURCES: [string, string, string][] = [
  ['Attendance (P/PV)', '5', 'Being in the room (Present or Present and voting) at some point in the session'],
  ['GSL speech', '10', 'Each speech on the general speakers list'],
  ['Caucus speech', '8', 'Each speech in a caucus, Tour de Table or Consultation of the Whole'],
  ['Speaking time /10s', '1', 'Every 10 seconds spoken'],
  ['Motion raised', '10', 'Each motion the delegation raises'],
  ['Motion passed', '10', 'Each of its motions that passes'],
  ['Right of reply', '5', 'Each right of reply it is granted'],
  ['Working paper', '10', 'Each working paper it sponsors'],
  ['Draft resolution', '20', 'Each draft resolution it sponsors'],
  ['DR passed', '10', 'Each sponsored draft resolution that passes'],
];

export default function ChoosingAwardsWithGavelling() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['Dxkui5yPPXQ', 'BCQyOGywPOg']} />
      <ArticleLayout
        slug={SLUG}
        pitch="Every speech, motion and paper is counted as it happens, so award deliberations start from the record, not from memory."
      >
        <p>
          Award deliberations go wrong in a familiar way. It is the last evening, the dais is tired, and the decision
          comes down to who remembers whom. The delegation that gave one brilliant speech on day two is forgotten. The
          one that spoke loudly in the last session wins.
        </p>
        <p>
          A Gavelling room keeps the record for you. Every speech, motion, right of reply and paper is logged the moment
          it happens and scored on a points system you control. This guide shows how to read the scoreboard, set the
          points to match your conference, and turn the numbers and your notes into awards you can explain to anyone
          who asks. For what each award means, see <Link href="/blog/mun-award-categories">MUN award categories</Link>.
        </p>

        <H2>1. Open the Scoreboard</H2>
        <p>
          Press <strong>Scoreboard</strong> in the chair page&apos;s top bar. It has three tabs:
        </p>
        <ul>
          <li>
            <strong>Ranking</strong> lists every delegation from first to last, with its speeches, its time spoken, its
            notes and its score. Click a column to sort by it.
          </li>
          <li>
            <strong>Matrix</strong> lays the same points out in a grid, so you can compare delegations side by side.
          </li>
          <li>
            <strong>History</strong> is the committee&apos;s whole session, newest first, grouped by part of the debate:
            the general speakers list, each caucus, each Tour de Table.
          </li>
        </ul>
        <p>
          Every chair can open the scoreboard, the Moderator and every Commenter. Delegates never see it: no score and no
          rating ever reaches a delegate&apos;s phone. Their own statistics show only what they did, such as their
          speeches and time spoken.
        </p>

        <TutorialVideo id="Dxkui5yPPXQ">The best performing delegates, where every point came from, the full history and a points adjustment by hand.</TutorialVideo>

        <H2>2. See Where Every Point Came From</H2>
        <p>
          Click a delegation to open its profile. At the top is its rank, for example Rank 3 of 24. Under it:
        </p>
        <ul>
          <li>
            <strong>Points breakdown</strong>, which splits the delegation&apos;s points by source: so much from GSL
            speeches, so much from motions, so much from the draft resolution it sponsored.
          </li>
          <li>
            <strong>Chair ratings</strong>, if your dais rates speeches.
          </li>
          <li>
            <strong>Chair comments</strong>, every note the chairs wrote on its speeches. You can edit your own comments
            here, in place; the other chairs&apos; comments are read only.
          </li>
          <li>
            <strong>Timeline</strong>, everything the delegation did, newest first.
          </li>
        </ul>
        <p>
          This is the view to have open in deliberations. When a co-chair says &quot;France was everywhere&quot;, the
          profile shows whether France was everywhere or simply loud: how many speeches, in which caucuses, which
          motions, which papers.
        </p>

        <H2>3. Know What the Points Count</H2>
        <p>Out of the box, ten sources score automatically:</p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Points</th>
                <th>For</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(([name, pts, what]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{pts}</td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Defaults as of October 2026. Your dais can change every value.</p>
        <p>
          These points are objective: they measure activity, not quality. A delegation can rack up speeches without
          saying much. That is why the scoreboard can also carry the chairs&apos; judgement, through ratings.
        </p>
        <H3>Ratings and the ranking blend</H3>
        <p>
          In Settings, on the Points tab, turn on <strong>Rate speeches</strong>. Commenters then get a slider for each
          quality factor on every speech: Diplomacy, Public Speaking, Collaboration and Content &amp; Research by
          default, out of 10. You can rename factors, add your own and change the scale.
        </p>
        <p>
          The <strong>Ranking blend</strong> slider decides how the ranking mixes the two, from all Objective to all
          Quality. It starts at Objective. Wherever you set it, the profile still shows the objective points breakdown
          on its own, so the dais can always see both the activity and the judgement.
        </p>

        <H2>4. Set Your Own Points System</H2>
        <p>
          Your conference may value things differently. Maybe sponsoring a draft resolution should count for more than
          raising motions, or attendance should not score at all. On the Points tab, under Score sources, set the points
          for each source and switch off any you do not use. A source that is off is simply left out.
        </p>
        <p>
          Agree the system before the first session, not after it. A dais that changes the points on the last evening
          to suit the result it already wanted has gone back to choosing from memory, with extra steps. Our{' '}
          <Link href="/blog/mun-judging-rubric">MUN judging rubric</Link> is a good starting point for deciding what to
          reward.
        </p>

        <TutorialVideo id="BCQyOGywPOg">Make the rules work your way, your own points system included.</TutorialVideo>

        <H2>5. Adjust Points by Hand</H2>
        <p>
          Some contributions never show up as a logged event: the delegate who brokered the merger of two papers in the
          corridor, the one who kept a fractured bloc together. For those, open the delegation&apos;s profile and use{' '}
          <strong>Adjust points</strong>. Press one point more or one point less, add a reason if you like, and apply it.
        </p>
        <p>
          The adjustment is logged with the chair who made it, and it appears in the breakdown as a chair adjustment, so
          nobody is ever unsure where a bonus came from. Any chair can adjust points while the session is running.
        </p>
        <Callout>
          Write the reason every time. &quot;+5, brokered the WP 1.1 and WP 1.2 merger&quot; is a sentence you can read
          out at deliberations. A bare +5 is an argument waiting to happen.
        </Callout>

        <H2>6. From the Scoreboard to the Awards</H2>
        <p>
          The scoreboard is evidence, not a verdict. A sound way to use it:
        </p>
        <ol>
          <li>Each chair names a shortlist from their own notes, before looking at the ranking.</li>
          <li>Open the ranking and compare. Where a delegation is high on one list and low on the other, open its profile.</li>
          <li>Read History for the moments that decided the committee: who moved the caucus that changed the debate, who sponsored the resolution that passed.</li>
          <li>Decide, and write one line per award saying why. The profile will usually have written most of it for you.</li>
        </ol>
        <p>
          Before the room is closed, press <strong>Download record</strong> on the scoreboard or the end screen. You get
          one spreadsheet with the history, scores, points per motion, speeches, attendance and documents, which is
          useful for feedback and for any question after the conference. A standalone room is deleted 24 hours after it
          ends.
        </p>
        <H3>At a conference on Gavelling</H3>
        <p>
          If your committee is part of a conference run on Gavelling and the secretariat has set awards up, the
          scoreboard shows an <strong>Awards</strong> link. It opens your committee&apos;s nomination page, where the
          dais nominates its delegates. Nominations stay secret: delegates see nothing until the secretariat publishes
          the awards. When they do, each recipient gets a verified entry on their MUN CV. Our{' '}
          <Link href="/blog/mun-awards-guide">MUN awards guide</Link> covers what delegates should know about the
          process from their side.
        </p>
        <p>
          Want the notes and ratings to be good in the first place? Read{' '}
          <Link href="/blog/how-to-co-chair-on-gavelling">how to co-chair on Gavelling</Link>, or{' '}
          <Link href="/sessions">open a free room</Link> and look at the scoreboard yourself.
        </p>
      </ArticleLayout>
    </>
  );
}
