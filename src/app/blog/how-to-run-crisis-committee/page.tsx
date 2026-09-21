import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Run a Crisis Committee: Arc, Backroom and Pacing',
  description:
    'Designing a crisis arc before the conference, staffing a backroom, pacing updates, and the three moves that recover a committee whose story has died.',
  path: '/blog/how-to-run-crisis-committee',
  ogDescription: 'Design the arc, staff the backroom, and keep a crisis committee moving.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Run a Crisis Committee: Arc, Backroom and Pacing',
  description: 'Design the arc, staff the backroom, and keep a crisis committee moving.',
  url: 'https://gavelling.com/blog/how-to-run-crisis-committee',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/how-to-run-crisis-committee' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Run a Crisis Committee', item: 'https://gavelling.com/blog/how-to-run-crisis-committee' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="how-to-run-crisis-committee"
        pitch="Gavelling runs the front room while your backroom writes: timers, speakers, motions and directives in one place, free."
      >
        <p>Someone has handed you a crisis committee. This guide is for the staff side of the wall: designing an arc before the conference, dividing the three jobs, pacing updates so the room neither stalls nor drowns, and recovering when the story dies on Saturday afternoon. If you want the delegate&rsquo;s view of the same room, read <Link href="/blog/mun-crisis-committee-guide">how crisis committees work</Link> first.</p>

        <H2>The three jobs, and who decides what</H2>
        <p>A crisis committee is run by three functions. Conferences name them differently, but the division is always the same, and confusion about it is the commonest cause of a committee that feels arbitrary.</p>
        <FactCard title="Front room chair">
          Runs procedure in the room: the speakers list, motions, votes on committee-wide directives, and order. Decides nothing about the world. Their job is to keep a structured debate happening between updates.
        </FactCard>
        <FactCard title="Crisis director">
          Owns the world and the arc. Decides what is true, what happens next, and how a delegate&rsquo;s directive turns out. Sets the pace of updates, briefs the staff, and settles every disputed ruling about reality.
        </FactCard>
        <FactCard title="Backroom staff">
          Reads every individual directive, writes the responses and the updates, and plays the characters delegates write to. Two to four per committee. Their work is covered in detail in <Link href="/blog/mun-crisis-backroom-guide">the crisis backroom guide</Link>.
        </FactCard>
        <p>The rule that prevents most arguments: the chair owns procedure, the director owns the world, and neither overrules the other in front of delegates. If a delegate claims the front room voted to make something true that the backroom says is not, the answer is that the committee can decide what it does and the world decides what results. Agree that sentence with your chair before the conference and use it verbatim.</p>

        <H2>Designing the arc before the conference</H2>
        <p>An arc is not a plot. It is a set of pressures and a small number of prepared turns, designed so that the room always has something to argue about and delegates always have something to act on.</p>
        <p>Write five things in the month before the conference:</p>

        <H3>The opening scenario</H3>
        <p>One page, read out or distributed at the start of the first session. It must do three things: state a situation that is already going wrong, give the committee a reason it must act within hours rather than months, and leave at least two credible responses open. A scenario with one obvious answer produces forty minutes of debate and then silence.</p>

        <H3>Three planned escalations</H3>
        <p>Written in advance, held in a folder, released when the pace requires them rather than on a clock. Each escalation should raise the cost of doing nothing and invalidate part of what the committee has already decided. The classic shape: the first escalation widens the problem geographically, the second turns a technical problem into a political one, the third threatens a delegate&rsquo;s own position rather than the committee&rsquo;s.</p>

        <H3>Two branch points</H3>
        <p>Moments where you decide in advance what happens if the committee does X versus Y. Prepared branches are what let you respond to real decisions quickly. Without them you improvise, and improvised consequences drift toward whatever the loudest delegate proposed.</p>

        <H3>The ending you will probably not use</H3>
        <p>Write it anyway. It tells you what the arc is about, which is what you need when everything goes sideways on day two. Expect the real ending to be something your committee invented, and be pleased when it is.</p>

        <H3>The character list</H3>
        <p>Every person and body outside the room that delegates might write to: the head of state, the military command, a rival cabinet, a journalist, an international organisation. One line each on what they want and how they speak. This becomes the backroom&rsquo;s world bible.</p>
        <Callout>Design the arc so that nothing important depends on the committee doing a specific thing. The moment your escalation only makes sense if they passed a directive they did not pass, you are steering a committee that can feel it.</Callout>

        <H2>Pacing</H2>
        <p>Pace is the hardest thing to get right and the thing delegates most reliably notice. Two failure modes, opposite in cause and both fatal.</p>
        <p><strong>Too slow.</strong> Nothing happens for fifty minutes, the room exhausts the current problem, and debate becomes procedural. You will see it in the motions: when a committee starts moving for unmoderated caucus repeatedly, it has nothing left to say.</p>
        <p><strong>Too fast.</strong> Updates land every eight minutes, each one invalidating the last, and the committee stops writing directives because nothing survives. You will see it when delegates stop reacting to an update at all.</p>
        <p>A workable rhythm for a two-day conference with four sessions:</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Session</th><th>Updates</th><th>What the session is for</th></tr>
            </thead>
            <tbody>
              <tr><td>1 (opening)</td><td>1 to 2</td><td>Establish the world, let the room organise, take the first directives</td></tr>
              <tr><td>2</td><td>3 to 4</td><td>First escalation, consequences of session 1 directives start landing</td></tr>
              <tr><td>3</td><td>3 to 5</td><td>Second escalation, branch point, the committee splits</td></tr>
              <tr><td>4 (final)</td><td>2 to 3</td><td>Third escalation early, then room to resolve. Stop updating in the last 30 minutes</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Roughly one update every 20 to 25 minutes in the middle sessions. Adjust to the room rather than the table.</p>
        <p>The rule that saves more committees than any other: stop updating before the end. A crisis room needs the last half hour to arrive somewhere, and an update at minute 200 of 210 simply denies them an ending.</p>

        <H2>Crisis procedure: what survives and what is dropped</H2>
        <p>Crisis rooms are smaller, faster and more informal than a General Assembly committee, and the procedure follows. What is kept:</p>
        <ul>
          <li><strong>The speakers list,</strong> though usually shorter and often suspended for long stretches.</li>
          <li><strong>Moderated caucus,</strong> which becomes the default mode. Short topics, short speeches, frequent motions. See <Link href="/blog/how-to-run-moderated-caucus">how to run a moderated caucus</Link>.</li>
          <li><strong>Voting on committee-wide directives,</strong> usually simple majority, usually by placard, usually fast.</li>
          <li><strong>Points of order and personal privilege,</strong> unchanged.</li>
        </ul>
        <p>What is dropped or reshaped:</p>
        <ul>
          <li><strong>Formal resolutions,</strong> replaced by directives. Shorter, imperative, no preambulatory clauses.</li>
          <li><strong>Long unmoderated caucus,</strong> which in crisis becomes the time delegates write individual directives rather than negotiate.</li>
          <li><strong>Amendments as a formal process,</strong> usually replaced by the chair taking changes from the floor before the vote.</li>
          <li><strong>Strict yields,</strong> which slow a room that needs to move.</li>
        </ul>
        <p>Whatever you choose, write it in the background guide and say it aloud in the first session, because crisis delegates arrive from different circuits with different assumptions.</p>
        <ChairScript>&ldquo;This committee will run primarily in moderated caucus. Committee-wide directives pass by simple majority and take effect when the chair announces them. Individual directives go to the backroom at any time and are not debated here.&rdquo;</ChairScript>

        <H2>Ruling on directives consistently</H2>
        <p>The single biggest determinant of whether a crisis committee feels fair is whether two similar directives get similar answers. Consistency is a process, not an instinct.</p>
        <p>Give your backroom a decision table and hold to it:</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>The directive is</th><th>Response</th><th>Turnaround</th></tr>
            </thead>
            <tbody>
              <tr><td>Within the delegate&rsquo;s real powers, specific, plausible</td><td>Works, roughly as asked, with a complication</td><td>One round</td></tr>
              <tr><td>Within their powers but vague</td><td>Partial result, with a note asking for specifics</td><td>One round</td></tr>
              <tr><td>Beyond their powers</td><td>Refused in character by the person who would refuse it</td><td>Short reply, fast</td></tr>
              <tr><td>Clever, in-character, and would reshape the arc</td><td>Works, and becomes a public update</td><td>Director decides personally</td></tr>
              <tr><td>An attempt to acquire unlimited resources</td><td>Costs something the delegate did not offer</td><td>Short reply, fast</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two principles behind that table. First, say yes more often than feels right, but attach a cost: a directive that works and creates a new problem is better drama than one that simply fails, and it keeps the delegate playing. Second, a refusal should come from a character, not from the staff. &ldquo;The Chief of General Staff declines, citing the standing order you signed last month&rdquo; is a scene. &ldquo;Denied&rdquo; is a wall.</p>
        <Callout>Decide in advance what a delegate&rsquo;s personal resources actually are, and write it into their character brief. Most disputes about whether a directive works are really disputes about what the delegate was given at the start.</Callout>

        <H2>Rewarding good play without letting one delegate run the room</H2>
        <p>Crisis rewards initiative, which means it naturally produces one delegate who writes twelve directives while four write none. Left alone, that delegate ends the weekend controlling the world and the rest of the committee has watched a show.</p>
        <p>Four counterweights that work:</p>
        <ul>
          <li><strong>Consequence, not refusal.</strong> The delegate who accumulates power attracts attention: a rival moves against them, their own faction gets nervous, a journalist starts asking questions. This is better drama and it is self-correcting.</li>
          <li><strong>Seed the quiet delegates.</strong> Send an unprompted note into the room: an aide asking for instructions, an opportunity that belongs specifically to their character. A delegate who receives a note writes one back.</li>
          <li><strong>Update toward the middle of the room.</strong> If three delegates dominate, write the next escalation into the portfolios of the ones who have not moved.</li>
          <li><strong>Talk to the front room chair at the break.</strong> They can put a quiet delegate on the speakers list, or set a moderated caucus topic that only a few people can speak to.</li>
        </ul>
        <p>For the room-management side of this, our guide to <Link href="/blog/mun-controlling-the-floor">keeping debate moving</Link> applies to crisis with almost no change.</p>

        <H2>Keeping the front room busy while the backroom writes</H2>
        <p>The structural problem of crisis is that updates take fifteen minutes to write and the room needs something to do in between. The front room chair&rsquo;s job during that gap is real work, not filler.</p>
        <p>Things that genuinely occupy a crisis room:</p>
        <ul className="gv-check">
          <li>A moderated caucus on the narrowest live question, 60-second speeches.</li>
          <li>A committee-wide directive being read, debated and voted, which takes ten minutes and produces a decision.</li>
          <li>A character brought into the room for questioning: a staff member plays the general, the committee interrogates them. Ten to fifteen minutes and delegates love it.</li>
          <li>A short unmoderated caucus, explicitly for drafting a joint directive, with a deadline stated when it starts.</li>
        </ul>
        <p>What does not work: a long speakers list, or a caucus on a topic the committee has already settled. Both read as marking time, and crisis delegates notice immediately.</p>

        <H2>Joint crisis committees</H2>
        <p>Two rooms, one world. The coordination cost is much higher than most conferences expect, and the failure mode is specific: the two rooms end up in inconsistent worlds, delegates compare notes at lunch, and the whole simulation loses credibility.</p>
        <p>What makes it work:</p>
        <ul>
          <li><strong>One director over both rooms,</strong> or two directors who sit in the same physical space for the whole conference. Not two directors in two buildings coordinating by message.</li>
          <li><strong>A shared world document</strong> updated in real time, which both backrooms read before writing anything.</li>
          <li><strong>A synchronised update schedule.</strong> If room A learns something at 14:10, room B learns it, or learns a deliberately partial version, at 14:10 too.</li>
          <li><strong>An explicit rule on cross-room communication:</strong> who may write to whom, whether messages are delivered verbatim, and how long they take.</li>
          <li><strong>A joint session</strong> if the arc allows it, which is the payoff delegates remember. Plan it into the schedule, do not decide it on the day.</li>
        </ul>

        <H2>Historical committees and hindsight</H2>
        <p>A historical crisis set in a specific year needs one rule decided and stated: whether delegates may use knowledge of what actually happened after the start date. Most conferences say no, and enforce it lightly in the room and firmly in the backroom.</p>
        <p>The practical version: a delegate may act on anything their character could plausibly have known or guessed, and may not act on the outcome. Predicting an invasion because their intelligence services warned of a build-up is fair play. Knowing the exact date because it is in the history books is not, and the backroom simply declines to let it work.</p>
        <p>The second decision is whether history is on rails. It should not be. If the committee makes better decisions than the historical actors, let the world diverge. A historical committee that cannot change history is a quiz.</p>

        <H2>When the arc dies</H2>
        <p>It will, at least once, usually mid-afternoon on the second day. The symptoms: directives stop arriving, the room debates procedure, and the updates you had planned no longer connect to anything the committee cares about. Three recovery moves, in order of how much they cost.</p>
        <ol>
          <li><strong>Bring the crisis into the room.</strong> A character arrives and demands an answer within ten minutes. This is cheap, fast, and forces a decision. Use it first.</li>
          <li><strong>Threaten a delegate personally.</strong> Not the committee: a specific portfolio. Their ministry is implicated, their rival has evidence, their own faction is moving against them. Individual stakes restart individual directives, and individual directives restart the backroom.</li>
          <li><strong>Break the premise.</strong> Reveal that something the committee has believed since session one is false. Expensive, because you can only do it once and it invalidates work delegates did. Reserve it for a genuinely dead room.</li>
        </ol>
        <p>What never works: another escalation of the same kind. A room that has stopped caring about the war does not start caring because the war got bigger.</p>

        <H2>Safety and taste</H2>
        <p>Crisis committees invite escalation, and escalation invites content that should not be in a room of students. Decide the line before the conference, with your secretariat, and brief your staff on it explicitly.</p>
        <p>Practical positions that most conferences hold and that are worth holding:</p>
        <ul>
          <li>Sexual violence is never a crisis update, a directive outcome, or a plot device. No exceptions, including in historical committees where it occurred.</li>
          <li>Real, living, named individuals are not targets of violence in updates, and neither are delegates as people.</li>
          <li>Atrocity against a real ethnic or religious group is described, if at all, in the register of a news report and never as a consequence a delegate is invited to enjoy.</li>
          <li>Ongoing conflicts involving delegates in the room deserve particular care. Somebody in your committee may be from there.</li>
          <li>Staff may refuse a directive on grounds of taste alone, and should say so plainly and without ridicule: the directive is out of bounds for this committee, please write another.</li>
        </ul>
        <p>Tell your delegates the line exists in the first session, in one sentence, so that nobody discovers it by crossing it. And give your staff a named person to escalate to, usually the USG for Crisis or the Director-General, so a nineteen-year-old staffer at midnight is not making a judgement call alone. The wider conference framework this sits inside belongs to the secretariat: see <Link href="/blog/mun-secretariat-roles">recruiting and running a secretariat</Link>.</p>

        <H2>After the conference</H2>
        <p>Write the post-mortem the same week, while you still remember the moment the room turned. Three questions: which prepared escalation did you never use and why, which delegate invention should have become part of the arc, and where did the pace break. Keep the arc document, the character briefs and the update archive. They are the most reusable asset in Model UN, and next year&rsquo;s director will otherwise start from nothing.</p>
      </ArticleLayout>
    </>
  );
}
