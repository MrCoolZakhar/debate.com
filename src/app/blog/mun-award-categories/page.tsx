import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Award Categories Explained: Every Award and What It Means',
  description:
    'Best Delegate, Outstanding, Honourable Mention, Verbal Commendation, best paper and delegation awards: what each one signals and how many a committee gives.',
  path: '/blog/mun-award-categories',
  ogDescription: 'Every MUN award category, its usual quota, and what it signals.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Award Categories Explained: Every Award and What It Means',
  description: 'Every MUN award category, its usual quota, and what it signals.',
  url: 'https://gavelling.com/blog/mun-award-categories',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-award-categories' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Award Categories', item: 'https://gavelling.com/blog/mun-award-categories' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-award-categories"
        pitch="Gavelling keeps the record of what each delegation actually did, so a dais decides from evidence rather than memory."
      >
        <p>Every conference gives out awards and almost none of them explain what the awards mean. A delegate comes home with an Honourable Mention and has no idea whether that is a near miss or a participation prize. This guide covers every category a Model UN conference gives, roughly how many of each you should expect, how delegation awards are tallied, and what each one is worth to somebody who was not in the room.</p>
        <p>One thing to hold on to throughout: none of this is standardised. There is no governing body for Model UN awards. The names below are the common ones, the quotas are the common ranges, and any individual conference is free to do something else entirely, and many do.</p>

        <H2>The individual awards, in order</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Award</th><th>Typical number in a 40-seat committee</th><th>What it signals</th></tr>
            </thead>
            <tbody>
              <tr><td>Best Delegate</td><td>1</td><td>The strongest delegate in the room across the whole conference</td></tr>
              <tr><td>Outstanding Delegate</td><td>1 to 2</td><td>Clearly above the field, close to the top</td></tr>
              <tr><td>Honourable Mention</td><td>2 to 4</td><td>Genuinely strong contribution, in the top quarter</td></tr>
              <tr><td>Verbal Commendation</td><td>0 to 4</td><td>One specific thing done well</td></tr>
              <tr><td>Best Position Paper</td><td>1</td><td>Best pre-conference written work, decided before debate</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Ranges from common practice across circuits. Smaller committees give fewer; some conferences award nothing below Honourable Mention.</p>

        <H3>Best Delegate</H3>
        <p>One per committee, and the singularity is the point. A committee with two Best Delegates has told everybody that the dais could not decide, which devalues both. It goes to the delegate who was strongest across the whole conference rather than strongest in one session, and at a well-run conference it is decided on contribution rather than volume. The chair&rsquo;s side of that decision is set out in <Link href="/blog/mun-judging-rubric">how to judge a MUN committee</Link>.</p>

        <H3>Outstanding Delegate</H3>
        <p>Usually one, sometimes two in a large committee. In practice this is second place, and everyone in the room knows it. A useful way to read it: Outstanding means the dais would have been comfortable giving you Best Delegate in a slightly different committee. It is a serious result, and most delegates who eventually win Best Delegate collect one or two of these first.</p>

        <H3>Honourable Mention</H3>
        <p>The widest band and therefore the most misread. Two to four in a forty-seat room means roughly the top ten per cent after the two awards above it, which is a real achievement, but the same words also appear at conferences that give six of them in a committee of twenty. Read it in context: ask how large the committee was and how many were given. It means you were visibly among the strongest people in the room and did not quite make the top two.</p>

        <H3>Verbal Commendation</H3>
        <p>Sometimes called a Diplomatic Commendation or a Special Mention. It recognises one specific thing rather than a whole conference: a particularly good speech, a well argued amendment, the delegate who brokered a merger nobody else could. Conferences use it for two different purposes, and it is worth knowing which. Some use it as a genuine fifth tier of merit. Others use it to acknowledge a delegate who was excellent for one session, or who was new, or who showed obvious improvement.</p>
        <Callout>Verbal commendations are usually announced aloud and not certificated, which is exactly why they do not belong on a CV line that a reader will take as a placing. Describe what you did instead.</Callout>

        <H3>Best Position Paper</H3>
        <p>A separate track, decided before debate begins, and the only award in MUN that is judged purely on written work. Conferences that take position papers seriously award it per committee; some award it only at conference level. Because it is decided from a pile of documents rather than from a room, it is the least biased award a conference gives, and it is the one most accessible to a delegate who is nervous about speaking. Our <Link href="/blog/mun-position-paper-guide">position paper guide</Link> is the practical route to it.</p>

        <H2>Diplomacy and peace awards</H2>
        <p>Some conferences add an award that deliberately measures something other than dominance. The names vary: Best Diplomat, Diplomacy Award, Spirit of the UN, Peace Prize. The common thread is that it rewards the delegate who made the committee work, which is frequently not the delegate who led the winning bloc.</p>
        <p>Where these exist they are usually decided differently, sometimes with input from the delegates themselves through a peer vote. That makes them unlike every other award on this page, and it is worth knowing before you read too much into one. A peer-voted diplomacy award tells you the room liked and trusted the delegate. A dais-decided one tells you the chair judged their conduct exemplary. Both are real; they are not the same claim.</p>
        <p>A conference that adds one of these is usually saying something about what it wants its committees to be. If you are choosing between conferences, the award list is a reasonable signal of the culture.</p>

        <H2>Delegation awards, and how the tally works</H2>
        <p>Delegation awards go to the school or society rather than to a person. The usual set:</p>
        <FactCard title="Best Large Delegation">
          The strongest school delegation above a size threshold, commonly ten or more delegates. One per conference.
        </FactCard>
        <FactCard title="Best Small Delegation">
          The same for delegations below the threshold. It exists because otherwise a school sending five people can never compete with a school sending forty, and the award would only measure size.
        </FactCard>
        <FactCard title="Outstanding Delegation">
          Second place in either or both categories, depending on the conference.
        </FactCard>
        <FactCard title="Honourable Mention Delegation">
          Occasionally awarded at large conferences with many schools attending.
        </FactCard>
        <p>Almost every conference tallies these from the individual committee honours, using a point value per award. A common scheme, and a fair one:</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Award</th><th>Points</th></tr>
            </thead>
            <tbody>
              <tr><td>Best Delegate</td><td>5</td></tr>
              <tr><td>Outstanding Delegate</td><td>3</td></tr>
              <tr><td>Honourable Mention</td><td>2</td></tr>
              <tr><td>Verbal Commendation</td><td>1</td></tr>
              <tr><td>Best Position Paper</td><td>1</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Worked example. Two schools attend. Northfield sends 18 delegates and wins one Best Delegate, two Outstanding, three Honourable Mentions and two commendations: 5 + 6 + 6 + 2, which is 19 points across 18 delegates, or 1.06 per delegate. Ashgrove sends 6 delegates and wins one Best Delegate, one Outstanding and two Honourable Mentions: 5 + 3 + 4, which is 12 points across 6 delegates, or 2.0 per delegate.</p>
        <p>On raw points Northfield wins. Per delegate, Ashgrove wins comfortably. This is precisely why the large and small categories are separated, and why a conference that awards on raw totals alone is effectively awarding on delegation size. If you are a head delegate deciding how many people to send, ask the conference which method it uses before you decide, because the answer changes the strategy.</p>
        <Callout>If a conference does not publish its delegation tally method, assume raw totals. It is the commonest, it is the easiest to compute at midnight before the ceremony, and it favours large delegations.</Callout>

        <H2>Crisis committee awards</H2>
        <p>Crisis committees usually use the same four tiers, but the evidence behind them is different, and a delegate moving from a General Assembly committee to crisis should know it. Front-room performance is only part of the file: the backroom staff who read the directives have a view, and at most conferences that view carries real weight in the slate. A delegate who spoke well and wrote thin directives will not win.</p>
        <p>Some crisis conferences add their own categories, for example a best crisis arc or best individual directive. Where they exist they are usually decided by the crisis director rather than the front-room chair. If you want the mechanics of the other side of that wall, see <Link href="/blog/mun-crisis-backroom-guide">the crisis backroom</Link>, and for the whole committee, <Link href="/blog/mun-crisis-committee-guide">how crisis committees work</Link>.</p>

        <H2>Why quotas exist</H2>
        <p>Quotas are set by the secretariat before the conference and given to every dais, and they exist for a reason worth understanding. Without a quota, award standards drift between committees: one chair gives four Outstanding Delegates because the room was strong, another gives none because the room was weak, and the conference has now issued awards that do not mean the same thing. Since delegation awards are tallied across committees, that drift is not only unfair, it directly changes which school wins.</p>
        <p>The typical rule is proportional. Something in the region of one award for every six to eight delegates is common, so a committee of 20 gives about three and a committee of 45 gives about six. Chairs usually cannot exceed the quota and usually can give fewer, which is the right way round: it lets a dais decline to award a delegate who was not worth it, without letting a generous dais inflate the whole conference.</p>

        <H2>Conferences that give no awards</H2>
        <p>A growing minority of conferences, particularly on the THIMUN circuit and among school-run conferences with an explicitly collaborative ethos, award nothing at all. The reasoning is that awards change delegate behaviour, and mostly for the worse: they reward dominance in a simulation that is supposed to teach negotiation, and they make unmoderated caucus a competition for visibility rather than a drafting session.</p>
        <p>It is a serious position and the committees often are noticeably more collaborative. What it costs is a motivational structure that many delegates, especially newer ones, genuinely respond to, and a comparable result to put on a university application. If you are choosing conferences, this is a real axis of difference. You can see how individual conferences describe themselves on <Link href="/conferences/explore">the conference directory</Link>.</p>

        <H2>What each award is worth to somebody who was not there</H2>
        <p>This is the question that actually matters when you write a CV line or a personal statement, and the honest answer is that the reader has no way of calibrating any of it. An admissions officer does not know whether your conference had 30 delegates or 3,000, whether the committee was the flagship or a first-timers&rsquo; room, or whether Honourable Mention meant the top five per cent or the top third.</p>
        <p>So give them the context that makes it legible: the award, the conference, the committee, and the size of the field. &ldquo;Outstanding Delegate, UNEP (48 delegates), at a 700-delegate conference&rdquo; tells a reader something real. &ldquo;Award winner, Model UN&rdquo; tells them nothing and invites the assumption that you are padding.</p>
        <p>And a proportion to keep in mind: what a reader can evaluate is what you describe yourself doing. A sentence about brokering a merger between two blocs on a specific issue is worth more than any certificate, because it is checkable, specific, and about a skill rather than a ranking. Awards are evidence that somebody agreed with you. The work is the point.</p>
        <p>For how to improve your odds in the room itself, see <Link href="/blog/mun-awards-guide">how Best Delegate is chosen</Link> and <Link href="/blog/mun-negotiation-tactics">negotiation and diplomacy in MUN</Link>.</p>
      </ArticleLayout>
    </>
  );
}
