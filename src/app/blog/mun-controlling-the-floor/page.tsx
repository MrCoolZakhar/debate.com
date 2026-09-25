import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Keep Debate Moving When a MUN Committee Stalls',
  description:
    'Diagnose a quiet, circular or chaotic room, then eleven interventions with the exact words to say from the dais.',
  path: '/blog/mun-controlling-the-floor',
  ogDescription: 'Eleven chair interventions for a committee that has stopped working.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Keep Debate Moving When a MUN Committee Stalls',
  description: 'Eleven chair interventions for a committee that has stopped working.',
  url: 'https://gavelling.com/blog/mun-controlling-the-floor',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-controlling-the-floor' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Keeping Debate Moving', item: 'https://gavelling.com/blog/mun-controlling-the-floor' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-controlling-the-floor"
        pitch="Gavelling gives a chair the levers this guide relies on: speaking time, the queue and the motion in one place."
      >
        <p>Procedure can be working perfectly while debate is dead. The speakers list is populated, motions pass, the timer runs, and nothing is happening. This is a different problem from not knowing the rules, and it is the problem that actually defines a chair. What follows is a diagnosis first, then eleven interventions with the words to use, because the right move in a silent room is close to the opposite of the right move in a chaotic one.</p>

        <H2>Diagnose before you intervene</H2>
        <p>Four kinds of stall, and they need opposite treatment. Take ninety seconds to decide which you have before you reach for anything.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Symptom</th><th>Diagnosis</th><th>Direction of treatment</th></tr>
            </thead>
            <tbody>
              <tr><td>Empty speakers list, no motions, long silences</td><td>Quiet room</td><td>Lower the cost of speaking</td></tr>
              <tr><td>Full speakers list, speeches repeat each other, no papers</td><td>Circular room</td><td>Narrow the question and impose a deadline</td></tr>
              <tr><td>Constant motions, side conversations, papers everywhere, nothing finished</td><td>Chaotic room</td><td>Remove options and shorten everything</td></tr>
              <tr><td>Three delegates speaking, thirty listening</td><td>Captured room</td><td>Change who is eligible to speak</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Misdiagnosis is expensive. Shortening speaking time in a quiet room, which is the reflex, makes the silence worse: delegates who were already nervous now have less room to make a point. Lengthening speaking time in a circular room gives people more space to repeat themselves.</p>
        <Callout>Ask yourself one question before acting: is the room not speaking because it has nothing to say, or because it has nothing new to say? Those are different failures with different fixes.</Callout>

        <H2>The quiet room</H2>
        <p>Usually a first session, usually a committee with inexperienced delegates, occasionally a committee that has been given a topic nobody understood from the guide. Four moves, cheapest first.</p>

        <H3>1. Seed the speakers list</H3>
        <p>Do not ask for speakers and wait. Announce that the list is open, count down, and then put it in the room&rsquo;s hands rather than leaving a vacuum.</p>
        <ChairScript>&ldquo;The general speakers list is open. The chair will take placards for the next fifteen seconds. Delegates who have not yet spoken today will be added first.&rdquo;</ChairScript>
        <p>That last clause does most of the work. It gives a nervous delegate a reason to raise a placard that is not about confidence, and it tells the confident ones to wait.</p>

        <H3>2. Call on placards directly</H3>
        <p>In a silent room, ask a named delegation a specific question rather than asking the room for volunteers. Choose someone whose position paper you read and whose position you know, so the question is answerable.</p>
        <ChairScript>&ldquo;The chair recognises the delegate of Chile. Your position paper raised the financing question. Would you share with the committee how your delegation would fund the mechanism under discussion?&rdquo;</ChairScript>
        <p>Never do this to a delegate who looks frightened, and never twice in a row to the same person. Two or three of these usually break the ice, after which the list fills on its own.</p>

        <H3>3. A tour de table</H3>
        <p>Every delegation speaks in turn for a short fixed time, 45 or 60 seconds. It removes the decision to speak entirely, which is exactly what a quiet room needs, and it gives you a map of the committee. Expensive in time at a large committee, so use it in the first session or not at all. Full mechanics in our <Link href="/blog/tour-de-table-mun">tour de table guide</Link>.</p>

        <H3>4. Break the room into groups</H3>
        <p>An unmoderated caucus with an instruction attached. Not &ldquo;fifteen minutes of unmod&rdquo;, which in a quiet room produces fifteen minutes of phones.</p>
        <ChairScript>&ldquo;The committee will suspend for a ten-minute unmoderated caucus. Delegates should form groups of four to six, and each group should return with one concrete proposal and the name of a delegate who will present it.&rdquo;</ChairScript>
        <p>Small groups are much easier to speak in than a room of forty, and requiring a named presenter means somebody has to come back to the microphone. See <Link href="/blog/unmoderated-caucus-guide">the unmoderated caucus guide</Link> for how to set these up so they produce something.</p>

        <H2>The circular room</H2>
        <p>The room is talking and nothing is advancing. Every speech restates a position already stated. Nobody is writing. Three moves.</p>

        <H3>5. Narrow the moderated caucus topic</H3>
        <p>Broad topics produce broad speeches. A caucus on &ldquo;solutions to the crisis&rdquo; will get you twelve delegates saying that cooperation is important. A caucus on &ldquo;who pays for the monitoring mechanism, and over what period&rdquo; gets you a fight, which is what you want.</p>
        <p>You can do this yourself when a motion comes up with a topic that is too wide, and most rulesets permit it with the proposer&rsquo;s agreement.</p>
        <ChairScript>&ldquo;The chair will entertain that motion with the topic narrowed to the funding mechanism specifically. Does the delegate of Norway accept the amendment to their motion?&rdquo;</ChairScript>
        <p>Our <Link href="/blog/how-to-run-moderated-caucus">moderated caucus guide</Link> covers what a well-shaped topic looks like.</p>

        <H3>6. Impose a drafting deadline</H3>
        <p>The single most effective intervention available to a chair, and the most underused. A committee with no deadline discusses; a committee with a deadline writes.</p>
        <ChairScript>&ldquo;The chair will accept working papers until the start of the afternoon session. Papers submitted after that point will not be introduced. Delegates should use their time accordingly.&rdquo;</ChairScript>
        <p>Announce it early, hold it, and be visible about the time remaining. The behaviour change is immediate and it is the reason experienced chairs set a papers deadline before lunch on day one rather than at the end of day two.</p>

        <H3>7. Name the disagreement out loud</H3>
        <p>Circular debate often means the room is avoiding the real split, usually because the guide was polite about it. A chair may state what the committee is actually disagreeing about without taking a side.</p>
        <ChairScript>&ldquo;The chair observes that the committee has spent an hour on implementation and has not addressed whether participation is voluntary or mandatory. The next moderated caucus topic should resolve that question.&rdquo;</ChairScript>
        <p>Use this sparingly, perhaps twice in a conference. A chair who narrates the debate constantly becomes a participant in it.</p>

        <H2>The chaotic room</H2>
        <p>Procedural motions every two minutes, side conversations during speeches, four competing papers and no merging. The instinct is to raise your voice. The better move is to take options away.</p>

        <H3>8. Shorten speaking time</H3>
        <p>Forty-five seconds instead of ninety changes the room within two speakers. Delegates stop preambling, get to the point, and the queue moves fast enough that people stay attentive. It is also a signal that the dais is in control, which a chaotic room reads instantly.</p>

        <H3>9. Refuse motions</H3>
        <p>Chairs have discretion over which motions to entertain, and in a chaotic room that discretion is the main tool. You do not have to take every motion on the floor.</p>
        <ChairScript>&ldquo;The chair will not entertain further motions until the current speakers list is exhausted. Delegates wishing to change the mode of debate may raise motions at that point.&rdquo;</ChairScript>
        <p>Say it once, clearly, and then hold it. Our reference on <Link href="/blog/mun-motions-explained">motions</Link> sets out which ones are genuinely at the chair&rsquo;s discretion under common rulesets; this varies more than delegates assume.</p>

        <H3>10. Take unmoderated caucus away</H3>
        <p>In a committee where unmod has become social time, stop granting it. Run the session in moderated caucus, with topics you have narrowed, until papers appear. It is unpopular for twenty minutes and then the committee produces something.</p>
        <p>The reverse also works if the diagnosis is different: a room that is chaotic because four blocs are competing and nobody is merging needs a long unmod with an explicit instruction to come back with two papers rather than four.</p>

        <H2>The captured room</H2>
        <p>Three delegates are running the committee. Everyone else has stopped trying. This is the stall that does most long-term damage, because the thirty quiet delegates conclude that MUN is not for them.</p>

        <H3>11. Change who may speak</H3>
        <p>Most rulesets let the chair apply reasonable conditions to a caucus or a list. Use them.</p>
        <ChairScript>&ldquo;For this moderated caucus, the chair will recognise only delegations that have not yet spoken in this session.&rdquo;</ChairScript>
        <p>This is legitimate, it is visibly fair, and it works immediately. Pair it with the speakers-list rule from the quiet room and with a note to yourself: in the next unmoderated caucus, go and stand near the group the dominant delegates are not in. Chairs underestimate how much a quiet group speaks once somebody is listening.</p>
        <p>If the capture is a behaviour problem rather than an energy problem, that is a different guide: see <Link href="/blog/mun-awards-guide">what chairs record and reward</Link> and speak to the delegate at the break, not from the dais.</p>

        <H2>Speaking time is your main lever</H2>
        <p>Of everything above, the most continuously useful control is the clock. It is worth knowing what each setting does to a room.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Speaking time</th><th>What it produces</th><th>Use when</th></tr>
            </thead>
            <tbody>
              <tr><td>30 to 45 seconds</td><td>Claims and positions, no argument</td><td>The room is chaotic, or you need to hear from many delegations fast</td></tr>
              <tr><td>60 seconds</td><td>One point, made properly</td><td>Default for most moderated caucuses</td></tr>
              <tr><td>90 seconds</td><td>A point with evidence and a response to someone else</td><td>The substantive middle of the debate</td></tr>
              <tr><td>2 minutes and over</td><td>Structured argument, and rambling from unprepared delegates</td><td>Opening speeches and the final session only</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Change it deliberately and tell the room why, once. Changing it silently three times an hour makes a committee feel arbitrary. Keeping it at ninety seconds all weekend wastes the lever entirely. In <Link href="/create/sessions">a Gavelling session</Link> the speaking time is set per caucus and the clock is anchored to the server, so every delegate&rsquo;s phone shows the same countdown as the dais, which removes the argument about whether a speaker ran over.</p>

        <H2>When to let silence sit</H2>
        <p>Not every pause is a stall. A committee that has just heard a genuinely difficult question needs a few seconds, and a chair who fills that gap trains the room to expect rescuing.</p>
        <p>Count to five, visibly and calmly. Most silences end at three. If you intervene at one, you will be intervening for the rest of the conference, and the committee will never learn to carry itself.</p>
        <p>The silence that is a real stall has a different quality: people are looking at their phones or at each other rather than thinking. That is worth acting on immediately.</p>

        <H2>The chair&rsquo;s own speech</H2>
        <p>You are allowed to address the committee substantively. You should almost never do it. Every time a chair speaks about the topic, delegates recalibrate towards what the chair appeared to want, and the debate becomes a performance for the dais.</p>
        <p>Two legitimate uses. Correcting a factual error that the whole room has adopted and is now building resolutions on: state the correction plainly, cite the source, and stop. And clarifying the committee&rsquo;s mandate when delegates are drafting something the body cannot do.</p>
        <ChairScript>&ldquo;A point of clarification from the chair. This committee makes recommendations; it cannot authorise deployment. Delegates should frame operative clauses accordingly.&rdquo;</ChairScript>
        <p>Both are under thirty seconds and neither expresses a preference about the outcome.</p>

        <H2>Reading the room from the dais</H2>
        <p>Four things to watch, none of which is the speaker.</p>
        <ul className="gv-check">
          <li><strong>Placard rate.</strong> How fast the list fills when you open it. The most reliable single indicator of energy, and it changes before anything else does.</li>
          <li><strong>Eye lines during speeches.</strong> A room watching the speaker is engaged. A room watching its own papers is drafting, which is fine. A room watching its phones is gone.</li>
          <li><strong>Who returns from unmod together.</strong> This tells you the real bloc map, which is frequently not the one your guide predicted.</li>
          <li><strong>The back two rows.</strong> Disengagement starts there and spreads forward. If the back of the room has stopped taking notes, you have about twenty minutes.</li>
        </ul>

        <H2>The last hour</H2>
        <p>A different problem entirely. The last hour of a conference is not about energy: it is about landing the committee somewhere, and the failure mode is a room that runs out of time mid-amendment and votes on nothing.</p>
        <p>Work backwards from the end and announce the schedule.</p>
        <ChairScript>&ldquo;The committee has one hour remaining. The chair will close the speakers list at the half hour and move to voting procedure with twenty minutes remaining. Delegates should submit final amendments now.&rdquo;</ChairScript>
        <p>Then hold it, including against a popular motion to extend debate. Twenty minutes is not generous for voting on a draft resolution with amendments, especially if your conference votes clause by clause: our <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> sets out the order and what each step costs in time. A committee that passed something it argued about will forgive a chair for cutting debate short. A committee that ran out of time will not.</p>

        <H2>The one thing that prevents most stalls</H2>
        <p>Almost every stall traces back to a room that does not know what it is deciding. Before each session, write on the board or say aloud the question this session has to answer, and at the end say whether it was answered. It costs two minutes a session, it gives every motion a reference point, and it removes the commonest cause of circular debate, which is forty people arguing about four different questions at once.</p>
        <p>If the procedure itself is what is slipping rather than the debate, go back to <Link href="/blog/how-to-run-mun-committee">how to run a MUN committee</Link> and the <Link href="/blog/mun-chair-script">chair script</Link>, and get the mechanics automatic. Judgement is much easier when procedure costs you no attention.</p>
      </ArticleLayout>
    </>
  );
}
