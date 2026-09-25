import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Common MUN Mistakes: 25 Errors Chairs See Every Weekend',
  description:
    'The research, writing, speaking, procedure and bloc mistakes that cost delegates the room, each with the specific thing to do instead.',
  path: '/blog/mun-common-mistakes',
  ogDescription: 'The 25 mistakes chairs see every weekend, sorted by what they cost you.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Common MUN Mistakes: 25 Errors Chairs See Every Weekend',
  description: 'The 25 mistakes chairs see every weekend, sorted by what they cost you.',
  url: 'https://gavelling.com/blog/mun-common-mistakes',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-common-mistakes' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Common MUN Mistakes', item: 'https://gavelling.com/blog/mun-common-mistakes' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-common-mistakes"
        pitch="Gavelling gives chairs the speaking record and delegates their place in the list, so the mistakes on this page are visible while there is still time to fix them."
      >
        <p>This is a diagnostic page rather than a list of tips. Find the symptom you recognise, read the fix, and follow the link to the guide that covers it properly. The mistakes are grouped by where they happen, and each one carries the specific thing to do instead. Most delegates who feel stuck are making three or four of these at once, usually from different groups. If this is your first conference, read <Link href="/blog/mun-for-beginners">MUN for beginners</Link> alongside it.</p>

        <H2>How to use this page</H2>
        <p>Do not try to fix everything. Pick the group that matches where you are losing: if your speeches feel fine but nothing you say ends up in the resolution, your problem is in the bloc section rather than the speaking section. If chairs seem to like you and you still do not get anywhere, read the advanced section, which is about a different failure entirely.</p>
        <Callout>The single most useful question after a disappointing conference: at what moment did the room stop needing me? Almost every mistake below has a moment, and it is usually earlier than delegates think.</Callout>

        <H2>Research mistakes</H2>
        <p><strong>1. Representing yourself instead of your country.</strong> The definitional error. You argue what you believe rather than what your government has said, and the moment a chair checks, the position collapses. <em>Instead:</em> find one dated statement or one vote and build outwards from it. Our <Link href="/blog/mun-country-research">country research guide</Link> is the method.</p>
        <p><strong>2. Researching the country, not the position.</strong> A page of population and GDP that never appears in a single speech. <em>Instead:</em> write the question the committee is deciding first, then research only what bears on it.</p>
        <p><strong>3. Ignoring the voting record.</strong> Delegates assume a position from a country&rsquo;s reputation and are contradicted by a vote taken three years ago. <em>Instead:</em> find how your country voted on the two nearest comparable resolutions before you write anything.</p>
        <p><strong>4. One source, usually an encyclopaedia.</strong> It shows within twenty seconds of a follow-up question. <em>Instead:</em> at least one primary source: a statement from your country&rsquo;s UN mission, a treaty reservation, a general debate speech.</p>
        <p><strong>5. Unsourced numbers in a speech.</strong> A statistic with no year invites the one question you cannot answer. <em>Instead:</em> carry the date and the source with the number, or make the point without it.</p>
        <p><strong>6. Reading the background guide and nothing else.</strong> It means you know exactly what every other delegate knows. <em>Instead:</em> treat the guide as the floor and its further reading list as the actual assignment.</p>

        <H2>Writing mistakes</H2>
        <p><strong>7. The position paper that describes the topic.</strong> Two-thirds background, one paragraph of position, no proposals. Chairs read fifty of these. <em>Instead:</em> one short paragraph of context, then your position, then what you propose. Our <Link href="/blog/mun-position-paper-guide">position paper guide</Link> has the format.</p>
        <p><strong>8. Proposals nobody can fund.</strong> A new agency, a new fund and a permanent secretariat, with no source of money. <em>Instead:</em> route work through an existing body, or name the funding mechanism. A clause that says who pays is worth three that do not.</p>
        <p><strong>9. Operative verbs beyond your organ&rsquo;s mandate.</strong> A General Assembly committee that &ldquo;demands&rdquo; or &ldquo;authorises the use of force&rdquo; is out of mandate, because the Assembly recommends. <em>Instead:</em> requests, urges, encourages, establishes, calls upon. Save the strong verbs for the Security Council. The full list is in our <Link href="/blog/mun-clause-phrases">clause phrases guide</Link>.</p>
        <p><strong>10. The resolution written alone.</strong> A beautiful document with one sponsor and no votes. <em>Instead:</em> write with people from the first hour. A worse text with eleven sponsors beats a better text with one, every time.</p>
        <p><strong>11. Clauses that restate the problem.</strong> Four operative clauses that recognise, reaffirm and note with concern. Those are preambulatory moves. <em>Instead:</em> every operative clause should contain someone doing something. See our <Link href="/blog/mun-resolution-writing">resolution writing guide</Link>.</p>
        <p><strong>12. Missing the paper deadline.</strong> The commonest unforced error of Saturday afternoon. <em>Instead:</em> write the deadline down when the chair says it, and submit twenty minutes early. Our <Link href="/blog/mun-working-paper-guide">working paper guide</Link> covers the merge sequence that usually causes the delay.</p>

        <H2>Speaking mistakes</H2>
        <p><strong>13. Reading a pre-written speech.</strong> It is unconnected to the previous speaker, delivered at speed, and the room switches off. <em>Instead:</em> four prompt lines on paper, spoken. Twelve worked examples are in our <Link href="/blog/mun-speech-examples">speech examples guide</Link>.</p>
        <p><strong>14. Ninety seconds with one idea in it.</strong> Length is not content. <em>Instead:</em> claim, evidence, ask, invitation. If it fits in thirty seconds, give it in thirty and sit down. Chairs notice discipline.</p>
        <p><strong>15. No ask.</strong> A well-delivered speech that requests nothing from anybody. <em>Instead:</em> end every speech with something the room can do: a clause to support, a caucus to second, a place to meet you.</p>
        <p><strong>16. Speaking only in the General Speakers List.</strong> The formal list is the least influential part of the room. <em>Instead:</em> speak in caucuses, where the topic is narrow and the drafting is live. See our <Link href="/blog/general-speakers-list-guide">GSL guide</Link> for what the list is actually for.</p>
        <p><strong>17. The opening about an imagined child.</strong> Every committee hears the emotive opening four times before lunch. <em>Instead:</em> a concrete detail from your own country, or a claim the room has to react to. Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> covers the structure.</p>
        <p><strong>18. Mocking another delegation.</strong> It plays to the three people already with you and costs you the rest of the room and the dais.</p>

        <H2>Procedure mistakes</H2>
        <p><strong>19. Motions raised in the wrong order or at the wrong moment.</strong> Motioning for an unmoderated caucus thirty seconds after one ended, or raising a motion while a speaker holds the floor. <em>Instead:</em> learn what your conference ranks as most disruptive, and wait for the chair to open the floor. Our <Link href="/blog/mun-motions-explained">motions guide</Link> lists them in precedence order.</p>
        <p><strong>20. Points used as weapons.</strong> A point of order raised to interrupt an opponent is transparent from the dais and chairs rule against it fast. <em>Instead:</em> a point of order is for a procedural error only. <Link href="/blog/mun-points-of-order">What qualifies</Link> is narrower than most delegates think.</p>
        <p><strong>21. The right of reply used for a policy disagreement.</strong> It is for a misrepresentation of your country, not for an argument you dislike. <em>Instead:</em> answer it in your next speech, which is more persuasive anyway. See <Link href="/blog/mun-right-of-reply">right of reply</Link>.</p>
        <p><strong>22. Abstaining without meaning to.</strong> Delegates who declared present-and-voting cannot abstain on substantive votes at most conferences, and delegates who meant to signal a reservation sometimes abstain on a resolution they wanted. <em>Instead:</em> know what you declared at roll call and what it commits you to. Our <Link href="/blog/mun-voting-procedures">voting guide</Link> covers the thresholds and what an abstention does to them.</p>

        <H2>Bloc mistakes</H2>
        <p><strong>23. Joining the biggest bloc.</strong> Twelve delegates around one laptop means your clause is one of thirty and your name is one of twelve. <em>Instead:</em> join the bloc where you will hold the pen on a section, or start the second bloc. Our <Link href="/blog/mun-bloc-building">bloc building guide</Link> covers both.</p>
        <p><strong>24. Refusing to merge.</strong> Two good papers that will not combine produce one failed vote and two annoyed groups. <em>Instead:</em> decide in advance which two clauses you will not give up, and trade everything else cheerfully. A delegate who merges well is visible to the dais.</p>
        <p><strong>25. Treating a regional group as a position.</strong> Your group tells you what you cannot say, not what you should propose, and groups overlap and disagree. <em>Instead:</em> use the group as a constraint and your research as the content.</p>

        <H2>Behaviour mistakes that quietly cost you everything</H2>
        <p>These rarely produce a public correction, which is exactly why delegates keep making them. A chair will simply stop considering you.</p>
        <ul>
          <li><strong>Talking over the dais.</strong> Including during another delegate&rsquo;s speech, which is the version people think goes unnoticed. It does not.</li>
          <li><strong>Excluding delegates from drafting</strong> because they are new, or because of their accent or their English. It is the fastest route off any list a chair is keeping.</li>
          <li><strong>Lobbying the chair about awards.</strong> Asking how you are doing reads as exactly what it is.</li>
          <li><strong>Turning a disagreement personal.</strong> Once it is about the delegate rather than the delegation, the room stops listening to the argument.</li>
          <li><strong>Being late back from every break.</strong> Small, cumulative, and the dais is keeping a record of who is in the room.</li>
          <li><strong>Doing another committee&rsquo;s work on your laptop.</strong> Visible from the front of the room. Always.</li>
        </ul>
        <p>What chairs look for positively is covered in our <Link href="/blog/mun-awards-guide">awards guide</Link>, and it is a shorter list than delegates expect.</p>

        <H2>Advanced mistakes</H2>
        <p>These belong to delegates who are already good, and they are why a confident delegate can have a weekend where nothing lands.</p>
        <p><strong>Winning the room and losing the vote.</strong> You dominated debate, your arguments were better, and a quieter delegation spent Saturday collecting eleven sponsors. Rhetoric is not arithmetic. Count votes from Friday afternoon and keep counting.</p>
        <p><strong>Optimising for the dais instead of the outcome.</strong> Speaking to impress the chair rather than to move the committee produces a delegate who is very visible and entirely uninfluential. The committee can tell, and so, eventually, can the dais.</p>
        <p><strong>Spending your credibility early.</strong> Objecting to everything in session one means nobody listens when you object to the clause that actually matters.</p>
        <p><strong>Negotiating without a fallback.</strong> You know what you want and not what you will accept, so at 4pm in a corridor you either concede too much or block the paper. Decide your fallback in advance, in writing. Our <Link href="/blog/mun-negotiation-tactics">negotiation guide</Link> goes further.</p>
        <p><strong>Ignoring the delegates who are not in a bloc.</strong> In most committees a third of the room is unattached by Saturday morning. They are the cheapest votes available and almost nobody asks for them.</p>

        <H2>What each mistake costs</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Group</th><th>How often</th><th>What it costs</th><th>Fix in</th></tr></thead>
            <tbody>
              <tr><td>Research</td><td>Very common</td><td>Credibility, permanently, once you are caught</td><td>One evening</td></tr>
              <tr><td>Writing</td><td>Very common</td><td>Your clauses do not survive the merge</td><td>One session</td></tr>
              <tr><td>Speaking</td><td>Very common</td><td>The room stops listening after speech two</td><td>One conference</td></tr>
              <tr><td>Procedure</td><td>Common</td><td>Small, unless it annoys the chair repeatedly</td><td>An hour of reading</td></tr>
              <tr><td>Bloc</td><td>Common</td><td>The whole weekend: no paper, no vote, no record</td><td>Requires a change of habit</td></tr>
              <tr><td>Behaviour</td><td>Less common</td><td>Everything, silently</td><td>Immediately</td></tr>
              <tr><td>Advanced</td><td>Among strong delegates</td><td>You lose to someone visibly worse than you</td><td>A season</td></tr>
            </tbody>
          </table>
        </TableWrap>

        <FactCard title="The five-minute self-check, at lunch on day one">
          Have I said anything that only my country would say? Has anyone written my words into a paper? Do I know who is undecided in this room? Do I know what I will concede? Has a chair heard me say something specific and dated? Any two &ldquo;no&rdquo; answers tell you where to spend the afternoon.
        </FactCard>
        <p>If you are preparing rather than recovering, work forwards instead: our <Link href="/blog/mun-conference-preparation">pre-conference checklist</Link> prevents most of the research and writing mistakes, and <Link href="/blog/mun-delegate-tips">delegate tips</Link> is the positive version of this page. If you have made most of these mistakes and want to see the room from the other side, the fastest cure is chairing, and open positions are listed on the <Link href="/conferences/roles">Gavelling roles board</Link>.</p>
      </ArticleLayout>
    </>
  );
}
