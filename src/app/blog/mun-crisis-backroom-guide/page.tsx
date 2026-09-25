import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'The MUN Crisis Backroom: How Crisis Staff Actually Work',
  description:
    'What happens to a directive after you hand it up: triage, writing updates, playing characters, keeping a world bible, and saying no well.',
  path: '/blog/mun-crisis-backroom-guide',
  ogDescription: 'Triage, updates, characters and the world bible: inside a MUN crisis backroom.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The MUN Crisis Backroom: How Crisis Staff Actually Work',
  description: 'Triage, updates, characters and the world bible: inside a MUN crisis backroom.',
  url: 'https://gavelling.com/blog/mun-crisis-backroom-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-crisis-backroom-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Crisis Backroom', item: 'https://gavelling.com/blog/mun-crisis-backroom-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-crisis-backroom-guide"
        pitch="Gavelling keeps the front room on procedure and on the clock, so your backroom can write."
      >
        <p>You hand a directive up to the dais and it disappears. Twenty minutes later something happens in the world and you cannot tell whether it was because of you. This guide is about the room on the other side of that wall: what crisis staff do with your note, how they decide which ones get an answer, and what separates a backroom that makes a weekend from one that produces confusion and silence.</p>
        <p>It is written for people about to staff a backroom for the first time, and for crisis delegates who want to understand what they are actually writing to. If you are running the whole committee rather than working in it, start with <Link href="/blog/how-to-run-crisis-committee">how to run a crisis committee</Link>.</p>

        <H2>What the backroom is for</H2>
        <p>Three words: continuity, consistency, pace.</p>
        <p><strong>Continuity</strong> means the world remembers. If a delegate blew up a bridge in session one, the bridge is still down in session four, and the trade figures a different delegate asked about reflect it. Backrooms that lose continuity produce delegates who stop believing their actions matter, and a crisis committee where actions do not matter is just a badly run General Assembly.</p>
        <p><strong>Consistency</strong> means two similar directives from two delegates get comparable answers, whichever staffer picked them up. This is harder than it sounds with four people writing in parallel, and it is the main thing a world bible exists to protect.</p>
        <p><strong>Pace</strong> means the room always has something to react to, and never so much that reacting is pointless. The backroom controls the tempo of the entire committee, and the front-room chair can only work with what you send them.</p>
        <Callout>The backroom&rsquo;s product is not cleverness. It is a world that behaves the same way on Sunday morning as it did on Friday night, and that answers people fast enough for them to keep playing.</Callout>

        <H2>Triage: which directives get what</H2>
        <p>A committee of twenty will produce more individual directives than four staffers can answer properly. Between 40 and 120 across a weekend is normal, and they arrive in bursts. Trying to answer all of them fully means answering all of them badly and late.</p>
        <p>So triage, openly and by a rule the whole backroom shares. A three-tier system works:</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Tier</th><th>Gets</th><th>Roughly</th><th>Turnaround</th></tr>
            </thead>
            <tbody>
              <tr><td>Full response</td><td>A written reply in character, plus a consequence in the world, sometimes a public update</td><td>1 in 5</td><td>15 to 25 minutes</td></tr>
              <tr><td>Short response</td><td>Two or three lines: it worked, it partly worked, it was refused and by whom</td><td>3 in 5</td><td>5 to 10 minutes</td></tr>
              <tr><td>Acknowledged only</td><td>A note that it was received and is in progress, or a request for specifics</td><td>1 in 5</td><td>Immediately</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>What lifts a directive into the top tier, in order of weight: it is specific enough to act on, it is within the delegate&rsquo;s actual powers, it changes something other delegates will notice, and it is written in character. Nothing about who sent it. That last clause is the one to guard, because the natural drift of every backroom is to answer the delegates who write most, which rewards volume and punishes the quiet delegate who wrote one excellent directive.</p>
        <p>Fairness has a practical mechanism, not a good intention. Keep a tracker with one row per delegate and a mark each time they get a full response. Look at it at every session break. If somebody has three marks and somebody has none, the next update is written into the portfolio of the delegate with none.</p>

        <H2>Writing an update that changes the room in 90 seconds</H2>
        <p>An update is read aloud to twenty people who are mid-argument. It has about 90 seconds of their attention. Structure it accordingly.</p>
        <FactCard title="The four-part update">
          <p><strong>1. What happened,</strong> in one sentence, concrete and dated. <strong>2. Who is affected,</strong> naming portfolios in the room where possible. <strong>3. What is now impossible or newly possible.</strong> <strong>4. A deadline or a question</strong> the committee has to answer.</p>
        </FactCard>
        <p>Around 120 to 180 words. Longer than that and the middle is lost. Write it as a dispatch rather than as narration: a wire report, an intelligence summary, a message from a named official. The register does half the work.</p>
        <p>Two things that make an update land. First, name people in the room. &ldquo;The Ministry of the Interior has been unable to confirm&rdquo; is abstract until the Minister of the Interior is sitting in chair eleven. Second, always close the loop on something a delegate did, even glancingly: &ldquo;following the redeployment ordered last night&rdquo; tells four people their directives are real.</p>
        <p>Two things that kill one. Contradicting an earlier update without acknowledging it, which the room will catch. And an update that is purely bad news with no decision attached, which produces a committee that feels acted upon rather than acting.</p>

        <H2>Playing characters</H2>
        <p>Most of a staffer&rsquo;s writing is in someone else&rsquo;s voice: the general who thinks the cabinet is naive, the ambassador who is stalling, the journalist who has the story and wants a comment. Done well this is the most enjoyable part of the job and the part delegates remember.</p>
        <p>Three rules keep it usable:</p>
        <ul>
          <li><strong>One character, one voice, one staffer where possible.</strong> If two people write as the same general and one is curt and one is chatty, the delegate concludes the character is inconsistent rather than that the staffing is.</li>
          <li><strong>A character wants something.</strong> Write the want into the brief in one line. Every reply then has a direction, and delegates can negotiate with them instead of just receiving answers.</li>
          <li><strong>Characters know less than you do.</strong> The commonest tell of an inexperienced backroom is a minor official who happens to know exactly the thing the delegate needs. Let characters be wrong, partial and self-interested. It is more realistic and it is far better play.</li>
        </ul>
        <Callout>If a delegate can get anything they want by writing to the right person, the backroom has stopped being a world and become a vending machine.</Callout>

        <H2>The world bible</H2>
        <p>One shared document, open on every staffer&rsquo;s screen, updated as things happen. Without it, four people writing in parallel will contradict each other by lunch on day one.</p>
        <p>What goes in it:</p>
        <ul className="gv-check">
          <li><strong>The timeline.</strong> Every event, in order, with the session it happened in. The most important section by far.</li>
          <li><strong>Facts established.</strong> Numbers, capabilities, who controls what. Add a line the moment you invent something, because an invented number becomes canon the second a delegate hears it.</li>
          <li><strong>Characters.</strong> Name, position, what they want, who plays them, and any promise they have made.</li>
          <li><strong>Per-delegate state.</strong> What each portfolio has, has spent, has lost, and what they have been promised.</li>
          <li><strong>Open threads.</strong> Things a delegate started that have not resolved yet. Reviewed at every session break, because dropped threads are the commonest backroom failure.</li>
          <li><strong>Refusals.</strong> What has been ruled impossible, so that the same request does not succeed at the second attempt with a different staffer.</li>
        </ul>
        <p>Keep it in one place that everybody can edit at once, and give one staffer explicit ownership of keeping the timeline current. That person can be writing too, but the timeline is theirs.</p>

        <H2>Managing a delegate&rsquo;s arc</H2>
        <p>Over a weekend, a good crisis delegate builds something: an alliance, a capability, a case against a rival. The backroom&rsquo;s job is to let that be real without letting it end the committee.</p>
        <p>The shape that works is escalating cost. Early directives succeed relatively cheaply. As the delegate accumulates, each further step costs more: money they must take from something else, exposure that a rival can exploit, a favour that comes due. The delegate keeps winning and the room keeps having something to do about it.</p>
        <p>Three specific tools:</p>
        <ol>
          <li><strong>Give a rival the counter-move.</strong> Not a staff refusal: another delegate&rsquo;s opportunity. Send the note that says what the strong delegate has been doing, and let the room handle it.</li>
          <li><strong>Attach a leak.</strong> Covert action has a chance of becoming public. State that probability to yourself in advance and hold to it, so it is a rule and not a punishment.</li>
          <li><strong>Make success load-bearing.</strong> The delegate who now controls the ports is responsible when the ports fail. Power is a set of obligations, and that is both realistic and good drama.</li>
        </ol>

        <H2>Saying no well</H2>
        <p>Every backroom refuses directives, and how you refuse determines whether the delegate writes another one.</p>
        <p>A bad refusal is a staff voice saying no. &ldquo;This is not possible.&rdquo; The delegate learns nothing except that the backroom is a wall.</p>
        <p>A good refusal does three things: it comes from a character, it gives a reason inside the world, and it leaves a route open.</p>
        <FactCard title="The same refusal, twice">
          <p><strong>Weak:</strong> &ldquo;You cannot deploy the fleet. Denied.&rdquo;</p>
          <p><strong>Better:</strong> &ldquo;Admiral Sartori replies within the hour: the second squadron is in refit at Taranto and will not be seaworthy for eleven days. He asks whether you wish him to raise the matter with the Defence Committee, which would make the request public.&rdquo;</p>
        </FactCard>
        <p>The second version refuses exactly the same thing and gives the delegate three new pieces of information, a reason, and a decision to make. It takes twenty seconds longer to write.</p>
        <p>The one exception is the directive that is out of bounds on grounds of taste rather than plausibility. Refuse that one plainly, out of character, without mockery, and tell your crisis director. Do not improvise a line on your own at midnight: your conference should have given you one, and if it has not, ask for it before the conference starts.</p>

        <H2>Coordinating with the front room</H2>
        <p>The chair on the other side of the wall is running a live room and cannot be surprised. Three habits:</p>
        <ul>
          <li><strong>Warn before an update lands.</strong> Thirty seconds of notice lets the chair finish the current speaker and bring the room to attention, instead of an update landing mid-speech.</li>
          <li><strong>Tell them what it is for.</strong> One line: &ldquo;this forces a vote on the evacuation&rdquo;. The chair can then set a moderated caucus topic that goes somewhere.</li>
          <li><strong>Ask them what the room needs.</strong> They can see the committee and you cannot. &ldquo;Three people have not spoken since lunch&rdquo; is the most useful sentence a chair can give a backroom, and it should change what you write next.</li>
        </ul>
        <p>Use the session breaks properly. Five minutes with the chair and the director between sessions, reviewing open threads, the fairness tracker and the pace, is worth more than any amount of messaging during a session.</p>

        <H2>Tools and the physical setup</H2>
        <p>You need four things, and almost nothing else.</p>
        <ul>
          <li><strong>A shared live document</strong> for the world bible, editable by everyone at once.</li>
          <li><strong>A tracker</strong> of directives received, who is handling each, and its state. A simple table with delegate, received time, tier, staffer and status. Update it on receipt, not later.</li>
          <li><strong>A template file</strong> for updates and character replies, so that formatting is not a decision made 40 times a day.</li>
          <li><strong>A way of seeing the front room.</strong> Knowing who is speaking, what motion is on the floor and how long is left in the caucus tells you when an update will land well. In a <Link href="/create/sessions">Gavelling session</Link> the committee page is open on any device with the code, so a backroom in the next room can watch the speakers list, the motions and the clock without sending anybody to look.</li>
        </ul>
        <p>Paper directives work fine and many conferences prefer them, because a physical note is easy to hand up mid-session and easy to sort into piles. Whatever the medium, timestamp on arrival. Without a timestamp you will argue about who acted first, and in crisis that matters.</p>

        <H2>Response times, and what to do when you cannot keep up</H2>
        <p>Delegates judge the backroom almost entirely on whether they hear back. A reasonable target is that nobody waits more than one session for an answer of some kind, even if the answer is two lines.</p>
        <p>When the volume beats you, and it will on Saturday afternoon, do these in order:</p>
        <ol>
          <li><strong>Drop to short responses across the board.</strong> Everyone gets two lines. Two lines to everyone beats a paragraph to a third of the room.</li>
          <li><strong>Batch by theme.</strong> Six directives about the same border become one update that resolves all six. Faster, and it is better for the room because it produces a single visible consequence.</li>
          <li><strong>Say so.</strong> Have the chair announce that responses are running behind and will arrive this session. Delegates handle a stated delay well and an unexplained silence badly.</li>
          <li><strong>Slow the front room; do not speed up the backroom.</strong> Ask the chair for a longer unmoderated caucus or a longer committee-wide directive debate. Buying fifteen minutes is easier than writing twice as fast.</li>
        </ol>

        <H2>Being the staffer everyone wants</H2>
        <p>The staffers who get asked back share four habits, and none of them is about writing flair. They timestamp and log everything, so the world bible is current whether or not anyone asked. They read the last two updates before writing a new one. They tell the director early when something is going wrong, rather than at the point it has. And they give the room credit for its own ideas: when a delegate invents something better than what was planned, they fold it into the arc instead of defending the plan.</p>
        <p>If you are on the other side of the wall and want to write the directives that reach the top tier, <Link href="/blog/mun-crisis-committee-guide">the crisis committee guide</Link> covers the delegate&rsquo;s craft, and <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link> covers applying for staff roles, since crisis staff and chair applications usually open at the same time.</p>
      </ArticleLayout>
    </>
  );
}
