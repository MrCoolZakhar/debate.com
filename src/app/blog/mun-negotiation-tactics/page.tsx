import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Negotiation and Diplomacy in MUN: How to Get Your Clause Into Someone Else’s Resolution',
  description:
    'Interests over positions, mapping the room, what you actually have to trade, and how to merge papers without losing the clause you came for.',
  path: '/blog/mun-negotiation-tactics',
  ogDescription: 'How to persuade one delegate at a time and keep your clause in the final text.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Negotiation and Diplomacy in MUN: How to Get Your Clause Into Someone Else’s Resolution',
  description: 'How to persuade one delegate at a time and keep your clause in the final text.',
  url: 'https://gavelling.com/blog/mun-negotiation-tactics',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-negotiation-tactics' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Negotiation Tactics', item: 'https://gavelling.com/blog/mun-negotiation-tactics' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-negotiation-tactics"
        pitch="Gavelling runs the room your negotiating happens in: the queue, the clock and the papers, free for any committee."
      >
        <p>Most delegates can write a resolution. Far fewer can get a clause they care about into a resolution somebody else is leading, which is what actually happens in a committee of forty where two papers will merge into one. This guide is about the one-to-one layer: reading the room, working out what you have to trade, moving a delegation that disagrees with you, and surviving the merge with your language intact. Forming and leading a coalition is a different skill and it has its own guide, <Link href="/blog/mun-bloc-building">MUN bloc building</Link>.</p>

        <H2>Interests, not positions</H2>
        <p>The one idea from real negotiation theory that changes a committee comes from Roger Fisher and William Ury&rsquo;s <em>Getting to Yes</em> (1981), and it is this: a position is what someone says they want, an interest is why they want it, and positions conflict far more often than interests do.</p>
        <p>In committee, the difference is concrete. A delegation says it opposes a monitoring mechanism. That is a position, and against it you have nothing to offer except pressure. Ask why, and you may find three different interests hiding behind the same sentence: they are worried about cost, or about a precedent that could be turned on them later, or about a domestic audience that will read inspection as humiliation. Each of those has a different answer, and two of them are answers you can write into a clause.</p>
        <ul>
          <li><strong>Cost</strong> is solved by a funding clause, a phase-in period, or assistance for states below a threshold.</li>
          <li><strong>Precedent</strong> is solved by scope language: &ldquo;in the context of this framework&rdquo;, a sunset clause, an explicit statement that nothing prejudices existing obligations.</li>
          <li><strong>Domestic audience</strong> is solved by framing: voluntary participation with strong incentives reads differently at home from mandatory inspection, while achieving much of the same thing.</li>
        </ul>
        <p>So the first question in any negotiation is never &ldquo;will you support this&rdquo;. It is &ldquo;what would you need this to say&rdquo;. The second question is &ldquo;why that&rdquo;. You will get further in two questions than in ten minutes of advocacy.</p>
        <Callout>If you cannot state the other delegation&rsquo;s interest in a sentence that they would agree with, you are not negotiating with them yet. You are arguing near them.</Callout>

        <H2>Mapping the room in the first hour</H2>
        <p>Before you can trade you need to know who is who, and the opening speeches give you almost everything if you listen for the right thing. Do not take notes on what delegations propose. Take notes on what they are protecting.</p>
        <p>Sort the room into four groups as you go:</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Group</th><th>How you recognise them</th><th>What they are worth</th></tr>
            </thead>
            <tbody>
              <tr><td>Aligned</td><td>Same interest, similar proposal</td><td>Votes and drafting hands. Do not over-invest here</td></tr>
              <tr><td>Movable</td><td>Different position, compatible interest, vague speech</td><td>Where almost all your gains are</td></tr>
              <tr><td>Blockers</td><td>Clear opposed interest, specific language, will not shift</td><td>Either route around or buy</td></tr>
              <tr><td>Unengaged</td><td>Generic opening speech, no proposal, quiet</td><td>Cheap votes, and often excellent collaborators if asked</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two practical notes. The movable group is much bigger than delegates assume at the start of a conference, typically half the room, because most opening speeches are written before anybody knows what will actually be debated. And the unengaged group is the most under-exploited resource in Model UN: a delegate who has not been spoken to by anyone in the first hour will usually join the first person who asks them a real question.</p>
        <p>Do this mapping by the end of the first unmoderated caucus. Write it down. Revisit it after each session, because it changes.</p>

        <H2>What you actually have to trade</H2>
        <p>New delegates negotiate as though the only currency is persuasion. It is not. You arrive with five things that other delegations want, and being explicit about them makes you a far better negotiating partner.</p>
        <FactCard title="Your vote">
          The most obvious and the least valuable early, because everyone has one and the vote is days away. It becomes valuable in the final session, which is why holding it is a late-game move rather than an opening one.
        </FactCard>
        <FactCard title="Your sponsorship or signature">
          Worth real effort to a delegation trying to get a paper to the threshold for introduction. Cheap for you to give and genuinely useful to them, which makes it the best opening trade in most committees.
        </FactCard>
        <FactCard title="Your speaking slots">
          You can speak in support of someone else&rsquo;s proposal in the general speakers list, or take a caucus slot to argue for their clause. Visible, valuable, and almost never offered.
        </FactCard>
        <FactCard title="Your drafting labour">
          Somebody has to write the text, merge two documents, reformat clauses and fix the preamble at eleven at night. Offering to do it is generous, it is appreciated, and it puts you at the keyboard, which is where decisions about wording are made.
        </FactCard>
        <FactCard title="Your relationships">
          If you can bring two delegations to a table, that is worth more than either vote. Brokers accumulate influence faster than advocates, and chairs notice brokering.
        </FactCard>
        <p>The asymmetry worth understanding: your drafting labour and your speaking slots cost you almost nothing and are worth a lot to somebody else. Spend them early and generously. Your vote costs you nothing to promise and is worth little until the end. Do not promise it early in exchange for something real.</p>

        <H2>Working with a delegation opposed to you</H2>
        <p>The most useful negotiating skill in MUN and the one most delegates never develop, because the instinct is to spend two days with people who already agree.</p>
        <p>A sequence that works:</p>
        <ol>
          <li><strong>Open with their interest, not yours.</strong> &ldquo;Your delegation is worried about the compliance costs falling on producers. Is that right?&rdquo; You have now demonstrated that you listened, which distinguishes you from everyone else who has approached them.</li>
          <li><strong>Find the narrowest thing you agree on.</strong> There is always something: data sharing, a review conference, technical assistance, a definitions clause. Start there.</li>
          <li><strong>Write that thing down together.</strong> A jointly drafted clause, however small, changes the relationship more than an hour of conversation. You are now co-authors.</li>
          <li><strong>Widen slowly.</strong> Each subsequent ask should be adjacent to what you already agreed.</li>
          <li><strong>Accept a real limit.</strong> Some delegations genuinely cannot move on something, because their country genuinely cannot. Pushing past that point costs you the relationship and gains you nothing, and a chair watching will read it as bullying.</li>
        </ol>
        <p>The pay-off is usually not their vote. It is that your clause survives, because a delegation that co-wrote the definitions section has a reason not to attack the whole paper.</p>

        <H2>The blocker: route around or buy</H2>
        <p>A blocker is a delegation whose interest is genuinely opposed and who will not move. Decide early which of two things you are doing, and do not do both.</p>
        <p><strong>Route around</strong> when you do not need them. Count the votes: if your threshold is a simple majority and you have it without them, the cost of buying them is a weakened clause you did not need to weaken. Be polite, keep the channel open, and spend your time on the movable group.</p>
        <p><strong>Buy</strong> when you do need them, and in Model UN you need them in three situations: they hold a veto, your conference requires a supermajority for substantive questions, or they can credibly take five other delegations with them. The <Link href="/blog/mun-security-council-guide">Security Council guide</Link> covers the first case, where routing around is simply not available and the entire negotiation is about what a permanent member can live with.</p>
        <p>Buying means finding the specific thing that changes their answer. Usually it is scope, not substance: a narrower definition, a longer timeline, an opt-out for a class of states, a review clause that lets them revisit it. Ask them to draft the language themselves. A blocker who has written the sentence that makes the paper acceptable to them has become a stakeholder in it.</p>
        <Callout>Never buy with a promise you cannot keep. &ldquo;We will support your amendment later&rdquo; is a debt, and in a committee where everyone is watching, defaulting on it once ends your credibility for the rest of the conference.</Callout>

        <H2>Merging papers without losing your clause</H2>
        <p>This is where most delegates lose, and it happens the same way every time. Two blocs merge, one delegate volunteers to do the merge, they produce a combined document, and your operative clause has become half a sentence inside somebody else&rsquo;s clause five.</p>
        <p>Five defences, in order of effectiveness:</p>
        <ul className="gv-check">
          <li><strong>Be in the room where the merge happens,</strong> ideally at the keyboard. Everything else on this list is a substitute for this.</li>
          <li><strong>Know which of your clauses you will not give up,</strong> and which are trading stock. If you defend all eight equally you will lose all eight.</li>
          <li><strong>Trade structure for substance.</strong> Give up clause order, numbering, your preamble and your framing language freely. They feel like losses and are not. Hold the operative verb and the mechanism.</li>
          <li><strong>Watch the verb.</strong> The difference between &ldquo;requests&rdquo;, &ldquo;urges&rdquo;, &ldquo;calls upon&rdquo; and &ldquo;decides&rdquo; is the difference between a clause that does something and a clause that does not. A merge that keeps your text but downgrades the verb has removed your clause while appearing to keep it. Our <Link href="/blog/mun-resolution-writing">resolution writing guide</Link> sets out the ladder.</li>
          <li><strong>Read the merged draft before it is submitted,</strong> line by line, against your own. Ten minutes, and it is the ten minutes that decides whether your weekend produced anything.</li>
        </ul>

        <H2>Reading a draft for what has been quietly removed</H2>
        <p>Deletions are invisible and additions are obvious, which is why experienced delegates read drafts backwards from their own text rather than forwards from the top.</p>
        <p>Four things to check every time:</p>
        <ul>
          <li><strong>Has the actor changed?</strong> &ldquo;Requests the Secretary-General to establish&rdquo; and &ldquo;encourages Member States to consider establishing&rdquo; look similar and are not the same clause.</li>
          <li><strong>Has the deadline gone?</strong> Dates and reporting cycles are the first casualties of a merge, and a mechanism with no reporting date is a mechanism nobody has to build.</li>
          <li><strong>Has the funding gone?</strong> Check whether the sub-clause naming a source survived, or whether it now says &ldquo;within existing resources&rdquo;, which usually means no.</li>
          <li><strong>Has a qualifier appeared?</strong> &ldquo;Where appropriate&rdquo;, &ldquo;on a voluntary basis&rdquo;, &ldquo;subject to national legislation&rdquo;. Each of these is a whole negotiation compressed into three words, and they are inserted during merges without discussion.</li>
        </ul>
        <p>If you find one, raise it as a question rather than an accusation: &ldquo;I think the reporting date dropped out in the merge, can we put it back?&rdquo; It is almost always genuine carelessness, and treating it as such gets it fixed.</p>

        <H2>Concession sequencing</H2>
        <p>What you give first sets the price of everything after it. Two rules that hold in most committees.</p>
        <p><strong>Give cheap things early and visibly.</strong> Sponsorship, a speaking slot, an agreement to drop a preambulatory clause. Early generosity buys you a reputation as someone to work with, which is worth more over two days than the thing you gave away.</p>
        <p><strong>Give expensive things late and in exchange.</strong> Never concede your core mechanism in the first session because somebody asked firmly. Concessions made under time pressure in the final hour are worth the most, which is why holding one real concession for the last session is good practice rather than cynicism.</p>
        <p>And always concede with a name attached: &ldquo;we can accept voluntary participation if the review conference is in three years rather than five&rdquo;. A concession given without an ask is not a concession, it is a donation, and it teaches the room that asking you firmly enough works.</p>

        <H2>The small states bloc</H2>
        <p>The coalition that outperforms expectations in almost every committee is the one made of delegations nobody courted: the unengaged group from your map, plus the small states who are not on anyone&rsquo;s list.</p>
        <p>Why it works is arithmetic. Large-power blocs are usually three to six delegations each and they spend the conference fighting each other. Twelve small states who agree on one clause are larger than either, and because they have not been fought over, they are available. In a committee that votes by simple majority, a bloc assembled from the room&rsquo;s periphery can pass a paper while the flagship delegations are still arguing about scope.</p>
        <p>The approach is straightforward and almost nobody does it: in the first unmoderated caucus, go to the delegations nobody is talking to, ask them what they need from this resolution, and offer to write it. You will get honest answers, because you are the first person to ask.</p>

        <H2>Staying in character while being genuinely persuasive</H2>
        <p>The tension every delegate feels: your country&rsquo;s real position is obstructive, and you want to be useful in the room.</p>
        <p>Resolve it by separating what your country wants from what you are willing to build. A delegation can hold an unhelpful position on the substance and still be the most constructive person in committee: chairing the drafting process, proposing procedural compromises, brokering between two blocs it belongs to neither of, and writing the definitions everyone can accept. That is exactly what obstructive states do in the real institution, and it is rewarded.</p>
        <p>What is not available is abandoning the position because it is inconvenient. A chair reading your position paper and then hearing you advocate the opposite has learned something about you, and it is not good. Our <Link href="/blog/mun-position-paper-guide">position paper guide</Link> covers doing the research that makes this line easy to walk.</p>

        <H2>What a chair reads as diplomacy, and what they read as bullying</H2>
        <p>Chairs watch unmoderated caucus closely and most of what they see is behaviour rather than content. The distinction they draw is consistent across circuits.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Reads as diplomacy</th><th>Reads as bullying</th></tr>
            </thead>
            <tbody>
              <tr><td>Bringing a quiet delegation into a group</td><td>Talking over a delegation twice</td></tr>
              <tr><td>Asking what someone needs before proposing</td><td>Handing someone a finished paper to sign</td></tr>
              <tr><td>Conceding something visible</td><td>Conceding nothing across two days</td></tr>
              <tr><td>Crediting another delegation&rsquo;s clause from the floor</td><td>Presenting a merged paper as your own</td></tr>
              <tr><td>Disagreeing with the argument</td><td>Disagreeing with the person</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>None of the right-hand column is against the rules, and all of it will cost you. What chairs are actually judging is in <Link href="/blog/mun-judging-rubric">the chair&rsquo;s scoring rubric</Link>, where diplomacy and negotiation is typically a fifth of the score and the part that is judged almost entirely on what happens away from the microphone.</p>

        <H2>Practise the one question</H2>
        <p>If you take one habit from this guide, take this: in every conversation in the first session, ask the other delegate what they need this resolution to say, and then ask why. Two questions, twenty seconds, and they do three things at once. They give you the map. They make you the delegate people want to work with. And they put you in the drafting group, which is the only place a clause can actually be won.</p>
      </ArticleLayout>
    </>
  );
}
