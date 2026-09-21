import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'UNA-USA Rules of Procedure: The Complete Guide',
  description:
    'The UNA-USA ruleset as it is actually run, from setting the agenda to rights of explanation, including the five rules most conferences quietly modify',
  path: '/blog/una-usa-rules-of-procedure',
  ogDescription: 'The UNA-USA ruleset as it is actually run, including what most conferences modify.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'UNA-USA Rules of Procedure: The Complete Guide',
  description: 'The UNA-USA ruleset as it is actually run, including what most conferences modify.',
  url: 'https://gavelling.com/blog/una-usa-rules-of-procedure',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/una-usa-rules-of-procedure' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'UNA-USA Rules of Procedure', item: 'https://gavelling.com/blog/una-usa-rules-of-procedure' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="una-usa-rules-of-procedure"
        pitch="Gavelling ranks motions by disruptiveness, runs the speakers list and takes the roll call vote, so the dais can watch the room."
      >
        <p>
          UNA-USA procedure is the most widely used ruleset on the North American circuit and, through it, the version of Model UN most people have seen. This guide covers it as the named ruleset: how each part is supposed to work, what a chair says, and which parts almost every conference modifies. It assumes you know what a motion and a point are. If you do not, read the <Link href="/blog/mun-motions-explained">motions guide</Link>, the <Link href="/blog/mun-points-of-order">points guide</Link> and the <Link href="/blog/mun-voting-procedures">voting guide</Link> first, because this page deliberately does not re-explain them. The <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> covers the common core in one place.
        </p>
        <p className="gv-note">
          The authority for your committee is your conference handbook, always. UNA-USA publishes rules of procedure through its Model UN preparation materials, and conferences adapt them freely: renumbering, changing thresholds, adding or removing motions. Where this guide says &quot;commonly&quot;, it is describing widespread practice rather than a fixed text.
        </p>

        <H2>Where UNA-USA procedure is used</H2>
        <p>
          It is the default at most high school conferences in North America and at many university conferences, and it has spread well beyond the United States. The other named ruleset you will meet is THIMUN, which is structurally different and covered in our <Link href="/blog/thimun-rules-of-procedure">THIMUN guide</Link>. Our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> sets the two side by side. Several large university conferences run heavily modified variants of UNA-USA under their own names, and those handbooks are usually recognisable adaptations rather than new systems.
        </p>
        <p>
          The defining features: a general speakers list as the standing state of the room, caucus motions that suspend it, yields, and a document pipeline from working paper to draft resolution to amended resolution to vote.
        </p>

        <H2>Roll call and quorum</H2>
        <p>
          The chair reads the roll. Delegates answer <strong>present</strong> or <strong>present and voting</strong>. Present and voting forfeits the right to abstain on substantive questions for the rest of the session, which is a commitment that cannot be withdrawn later in the day.
        </p>
        <p>
          Quorum is commonly one quarter of the members for debate to open and a simple majority of members to vote on a substantive question, though conferences set their own. The chair is supposed to check it and to note if it fails.
        </p>

        <H2>Setting the agenda</H2>
        <p>
          The first substantive act, and the one rulebooks under-explain most. Where a committee has two or more topics, a delegate moves to set the agenda to a named topic. The motion needs a second. The chair then typically takes two speakers in favour and two against, alternating, and the committee votes by simple majority.
        </p>
        <p>
          A passed motion sets the order: the named topic is debated first and the other follows if there is time. A failed motion means the committee has chosen the other order, and the chair usually does not need a second motion to say so, although many conferences take one anyway.
        </p>
        <ChairScript>
          &quot;There is a motion on the floor to set the agenda to Topic A. The chair will hear two speakers in favour and two against. We will then move directly to a vote by placard. Are there any speakers in favour?&quot;
        </ChairScript>
        <Callout>
          The agenda vote is where a prepared delegate gets a free early win. You are not arguing the topic, you are arguing sequence: dependency, urgency and what this body has a mandate to do first. Thirty seconds of that beats ninety seconds of topic summary.
        </Callout>

        <H2>The general speakers list</H2>
        <p>
          Once the agenda is set, the chair opens the general speakers list, and it stays open for the rest of the topic. It is the default state: when a caucus ends, the committee returns to it automatically at the place it stopped.
        </p>
        <p>
          Delegates are added when the chair asks, and at most conferences may be added later by note to the dais. A delegation appears once on the list at a time; after speaking you may ask to be added again at the back. Speaking time is set by motion, commonly starting at 60 or 90 seconds, and can be changed by a motion to set speaking time.
        </p>
        <p>
          If the speakers list empties and nobody moves anything, debate on the topic is considered closed at many conferences and the committee moves into voting procedure. That rule catches out committees that let the list run dry during a lull, and it is a reason experienced delegates keep their name on it. The full mechanics are in the <Link href="/blog/general-speakers-list-guide">general speakers list guide</Link>.
        </p>

        <H3>Yields</H3>
        <p>
          The distinctive UNA-USA mechanic. A delegate who has spoken on the general speakers list and has time remaining is expected to yield it, in one of three ways.
        </p>
        <FactCard title="Yield to the chair">
          The remaining time is absorbed and the chair moves on. The neutral option, and the correct one when you have said what you came to say.
        </FactCard>
        <FactCard title="Yield to another delegate">
          The named delegate continues with the remaining time. A real tactic: it gives a bloc partner a speaking slot they did not queue for. The second delegate may not yield again.
        </FactCard>
        <FactCard title="Yield to questions">
          Delegates put points of information to you, and at most conferences only your answers count against the remaining time, not the questions. Strong if you are confident, risky in a hostile room.
        </FactCard>
        <p>
          Yields normally apply only to speeches on the general speakers list, not to moderated caucus speeches. Conferences vary on whether a yield is compulsory and on whether time is exhausted by questions.
        </p>

        <H2>Motions, in precedence order</H2>
        <p>
          When several motions are on the floor, the chair takes them in order of disruptiveness, most disruptive first. The commonly used order:
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Motion</th>
                <th>Requires</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1', 'Adjournment of the meeting', 'Second', 'Simple majority'],
                ['2', 'Suspension of the meeting', 'Second', 'Simple majority'],
                ['3', 'Unmoderated caucus', 'Total time, second', 'Simple majority'],
                ['4', 'Moderated caucus', 'Topic, total time, speaking time, second', 'Simple majority'],
                ['5', 'Introduction of a draft resolution', 'Required signatories, dais approval', 'Simple majority, or automatic at many conferences'],
                ['6', 'Introduction of an amendment', 'Required signatories', 'Simple majority'],
                ['7', 'Set or change speaking time', 'New time, second', 'Simple majority'],
                ['8', 'Closure of debate', 'Second, speakers against', 'Two thirds'],
                ['9', 'Division of the question', 'Second', 'Simple majority'],
                ['10', 'Roll call vote', "Usually one delegate, at the chair's discretion", 'No vote needed at many conferences'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td><strong>{r[1]}</strong></td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p>
          Two things worth knowing about this list. Within a category, more disruptive still wins: a twenty minute unmoderated caucus is taken before a ten minute one. And closure of debate at two thirds is the one genuinely high threshold in the ruleset, because it permanently ends debate and no conference wants that done by a bare majority.
        </p>

        <H2>Caucuses</H2>
        <H3>Moderated caucus</H3>
        <p>
          A structured debate on a named sub-topic, with its own queue. The proposer must state all three parameters: the topic, the total time and the time per speaker. A motion missing one of them is out of order, and a chair who lets it through will spend the caucus improvising.
        </p>
        <p>
          The general speakers list is suspended, not cleared, and returns intact when the caucus ends. Speakers in a moderated caucus are recognised by placard; yields do not normally apply. The proposer is customarily offered the first speech, and declining it is a small but real signal that they proposed it for the room rather than for themselves. Chair-side detail is in our <Link href="/blog/how-to-run-moderated-caucus">moderated caucus guide</Link>.
        </p>
        <p>
          A <strong>motion to extend the caucus</strong> is taken near the end. Conferences commonly limit an extension to no more than the original total time, and some allow only one.
        </p>
        <H3>Unmoderated caucus</H3>
        <p>
          Formal rules suspended for a stated total time. Only one parameter is required. Delegates move freely. This is where drafting and bloc building happen, and our <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus guide</Link> covers what to do with it.
        </p>

        <H2>Points</H2>
        <ul>
          <li><strong>Point of personal privilege.</strong> About your ability to participate: audibility, temperature, needing to leave. It is the only point that may interrupt a speaker, and only for audibility. Using it to make a substantive remark is a misuse chairs notice.</li>
          <li><strong>Point of order.</strong> A claim that the rules have been broken by the chair or by a delegate. May interrupt a speaker at some conferences and not at others. It is not a debating device, and the <Link href="/blog/mun-points-of-order">points of order guide</Link> sets out what genuinely qualifies.</li>
          <li><strong>Point of parliamentary inquiry.</strong> A question to the chair about the rules or what is currently in order. May not interrupt a speaker. The honest beginner question, and chairs would rather answer it than rule you out of order twice.</li>
          <li><strong>Point of information.</strong> A question to a delegate who has yielded to questions, or to the chair. Must be a question. Our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers each one in more depth.</li>
        </ul>
        <p>
          <strong>Right of reply</strong> sits alongside these: a short rebuttal granted when a delegation has been directly attacked or misrepresented, usually requested in writing to the dais and entirely at the chair&apos;s discretion. There is no reply to a reply. See the <Link href="/blog/mun-right-of-reply">right of reply guide</Link>.
        </p>

        <H2>Documents</H2>
        <p>
          The pipeline has three stages and conferences differ on the thresholds at every one of them.
        </p>
        <ul>
          <li><strong>Working paper.</strong> An informal draft, submitted to the dais. Formatting requirements are light or absent. At many conferences the dais must approve it before it can be circulated, and at some it can be introduced by motion for discussion.</li>
          <li><strong>Draft resolution.</strong> A working paper with the required signatories, approved by the dais and formally introduced. The signatory requirement is commonly around one fifth of the committee, and is stated in your handbook. Sponsors wrote it and support it; signatories only want it debated and may vote against it.</li>
          <li><strong>Introduction.</strong> Usually a motion, often taken as automatic once the dais has approved the document. Several draft resolutions can be on the floor at once and are voted in the order introduced unless the committee decides otherwise.</li>
        </ul>
        <p>
          Details of drafting and merging are in the <Link href="/blog/mun-working-paper-guide">working paper guide</Link> and the <Link href="/blog/mun-resolution-writing">resolution writing guide</Link>.
        </p>

        <H2>Amendments</H2>
        <p>
          A <strong>friendly amendment</strong> is one that all sponsors of the draft resolution accept. It is incorporated into the text without a vote, though the dais normally has to verify that every sponsor agreed.
        </p>
        <p>
          An <strong>unfriendly amendment</strong> is any amendment the sponsors do not all accept. It requires its own signatories, is introduced, is debated with speakers for and against, and is voted by simple majority. A passed unfriendly amendment changes the resolution and debate continues.
        </p>
        <p>
          Voting order matters and catches people out. Amendments are voted before the resolution they amend, and where several amendments touch the same clause, conferences commonly take the most disruptive first or take them in the order submitted. Ask the chair which rule applies before you plan a sequence of amendments, because the answer changes the tactics completely. Preambulatory clauses are usually not amendable. The full treatment is in the <Link href="/blog/mun-amendment-guide">amendments guide</Link>.
        </p>

        <H2>Voting procedure</H2>
        <p>
          Once closure of debate passes at two thirds, the committee moves into voting procedure. From that point the room is normally sealed: no entry, no exit, and no points or motions other than those specifically permitted during voting.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Threshold</th>
                <th>Abstentions</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Procedural motions generally', 'Simple majority', 'Not permitted'],
                ['Closure of debate', 'Two thirds', 'Not permitted'],
                ['Amendments', 'Simple majority', 'Permitted at most conferences'],
                ['Draft resolutions, GA committees', 'Simple majority commonly, two thirds at some', 'Permitted, unless present and voting'],
                ['Draft resolutions, Security Council', 'Nine of fifteen, no permanent member against', 'Permitted, and an abstention is not a veto'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td><strong>{r[1]}</strong></td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p>
          Abstentions are normally excluded from the denominator, so a resolution with 12 in favour, 11 against and 14 abstaining passes on a simple majority. Confirm that with your dais rather than assuming: it is one of the most commonly modified rules and it decides close votes.
        </p>
        <H3>Roll call votes and rights</H3>
        <p>
          Any delegate may request a roll call vote on a substantive question; the chair commonly grants it without a vote. Each delegation answers in turn: in favour, against, abstain, or pass. A delegation that passes is called again at the end of the roll and must then vote in favour or against; it may not abstain and may not pass twice.
        </p>
        <p>
          A delegate may also vote <strong>in favour with rights</strong> or <strong>against with rights</strong>, which reserves a short speech after the vote to explain a position that departs from what the room expects. Rights speeches are heard after voting closes and before the result is announced at some conferences, after it at others.
        </p>
        <p>
          <strong>Division of the question</strong> is a motion to vote on parts of a resolution separately, taken after closure of debate and before the substantive vote. Delegates propose divisions, the committee votes on which division to use, and the resolution is then voted clause group by clause group. It is rare, and it is usually a sign that a bloc has fractured.
        </p>

        <H2>The five rules almost every conference modifies</H2>
        <ol>
          <li><strong>Whether abstentions count in the denominator.</strong> The single most consequential variation, and it changes which resolutions pass.</li>
          <li><strong>Signatory requirements.</strong> Anywhere from a fixed small number to a quarter of the committee, and separately for amendments.</li>
          <li><strong>Whether a point of order may interrupt a speaker.</strong> Some conferences allow it, some require it to wait, and chairs enforce inconsistently.</li>
          <li><strong>Yields.</strong> Whether they are compulsory, whether question time counts against the speaker, and whether they apply in a moderated caucus.</li>
          <li><strong>What happens when the speakers list empties.</strong> Automatic closure of debate at some conferences, a prompt from the chair at others.</li>
        </ol>
        <p>
          Read the handbook for those five specifically. They are the ones that produce arguments, and a delegate who has checked them has an advantage over one who assumed.
        </p>

        <H2>For chairs writing a rulebook</H2>
        <p>
          If you are adapting UNA-USA procedure for your own conference, write down an explicit answer to each of the five above rather than leaving them to be discovered. Then add three more: the quorum figures, the required speakers for and against on each motion type, and whether the general speakers list can be reopened after closure of debate has failed.
        </p>
        <p>
          The practical test of a rulebook is whether a first-time chair can resolve a dispute from it in ten seconds while forty delegates watch. If a rule takes a paragraph to explain, it will be enforced inconsistently across your committees, which is worse than not having it. Our <Link href="/blog/mun-chair-script">chair script</Link> has the exact wording for each ruling, and <Link href="/blog/how-to-chair-first-mun">how to chair your first committee</Link> covers what the dais actually does with it.
        </p>
        <p>
          The other thing that makes a rulebook enforceable is a dais that can see the state of the room: whose speech, how long is left, which motions are on the floor and in what order. That is what a committee platform is for, and you can try one with no account at <Link href="/create">/create</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
