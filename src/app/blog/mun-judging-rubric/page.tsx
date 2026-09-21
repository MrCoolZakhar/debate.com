import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Judge a MUN Committee: The Chair’s Scoring Rubric',
  description:
    'Five criteria, a weighting you can defend, how to take evidence during a session, and the biases that quietly decide most award slates.',
  path: '/blog/mun-judging-rubric',
  ogDescription: 'A MUN scoring rubric you can defend when a faculty advisor asks why.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Judge a MUN Committee: The Chair’s Scoring Rubric',
  description: 'A MUN scoring rubric you can defend when a faculty advisor asks why.',
  url: 'https://gavelling.com/blog/mun-judging-rubric',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-judging-rubric' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Judging Rubric', item: 'https://gavelling.com/blog/mun-judging-rubric' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-judging-rubric"
        pitch="Gavelling records the session as it happens: speeches, speaking time, motions, papers and your own notes against each delegation."
      >
        <p>This guide is written for the dais. If you are a delegate wanting to know what chairs look for, read <Link href="/blog/mun-awards-guide">how Best Delegate is chosen</Link> instead, which is the same subject from the other side of the room. What follows is about deciding, recording and defending a result, because the conversation that tests a chair is not the award ceremony. It is the faculty advisor who finds you afterwards and asks, politely, why their student did not win.</p>

        <H2>Why a written rubric beats an impression</H2>
        <p>Every chair has a rubric. The question is only whether it is written down before the conference or assembled in the twenty minutes before the slate is due.</p>
        <p>An unwritten rubric fails in three predictable ways. It drifts across the weekend, so the criteria that decided Friday are not the criteria that decide Sunday. It over-weights whatever happened most recently, because that is what you can still remember. And it cannot be explained, which means that when it is challenged you are reduced to asserting that you know what you saw. Faculty advisors have heard that answer before and it does not satisfy them, nor should it.</p>
        <p>A written rubric costs one evening before the conference and does three things in return: it forces you to decide what this committee is for, it makes your co-chair and you judge the same thing, and it gives you sentences to use afterwards that are about the delegate&rsquo;s performance rather than about your authority.</p>
        <Callout>The test of a rubric is not fairness in the abstract. It is whether you could read your reasons aloud to the delegate who came fourth and have them recognise the conference they were at.</Callout>

        <H2>The five criteria</H2>
        <p>Most working rubrics reduce to these five. Use different names if your conference does, but cover all five, because each one catches a kind of contribution the others miss.</p>

        <FactCard title="1. Research and accuracy">
          Does the delegate know the file? Can they name the instrument, the number, the agency, the date? Do they represent their country&rsquo;s actual position, including the parts that are inconvenient for the coalition they joined? The test is not volume of facts, it is whether their facts survive contact with a hostile question.
        </FactCard>
        <FactCard title="2. Speaking">
          Structure, clarity, use of the time given, and whether the speech advanced the debate or restated it. A delegate who speaks four times and moves the room each time scores above one who speaks twelve times and repeats the opening speech.
        </FactCard>
        <FactCard title="3. Diplomacy and negotiation">
          What happens in unmoderated caucus, where you can see but not hear. Do they bring people in or talk over them? Do they engage delegations outside their bloc? Did anything change because they were in the conversation?
        </FactCard>
        <FactCard title="4. Contribution to documents">
          Working papers, draft resolutions, amendments. Not sponsorship counted as a number: whose language is actually in the final text, and who did the merging work that nobody enjoys.
        </FactCard>
        <FactCard title="5. Procedural competence">
          Motions raised correctly and at the right moment, points used properly, and the ability to use procedure as a tool rather than as decoration. A delegate who moves for a moderated caucus on exactly the sub-question the room is stuck on has done something real. Our <Link href="/blog/mun-motions-explained">guide to motions</Link> and <Link href="/blog/mun-points-explained">guide to the four points</Link> set the standard you are judging against.
        </FactCard>

        <H2>Weighting, and what weighting does to your room</H2>
        <p>Weights are a policy choice, not a technicality, because delegates optimise for whatever they believe you reward. Decide deliberately and, if your conference allows it, say so in your chair&rsquo;s letter.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Criterion</th><th>Balanced GA committee</th><th>Small specialised body</th><th>Crisis committee</th></tr>
            </thead>
            <tbody>
              <tr><td>Research and accuracy</td><td>25%</td><td>30%</td><td>20%</td></tr>
              <tr><td>Speaking</td><td>25%</td><td>20%</td><td>15%</td></tr>
              <tr><td>Diplomacy and negotiation</td><td>20%</td><td>25%</td><td>25%</td></tr>
              <tr><td>Contribution to documents</td><td>20%</td><td>20%</td><td>30%</td></tr>
              <tr><td>Procedural competence</td><td>10%</td><td>5%</td><td>10%</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Illustrative weightings, not a standard. Adjust to your committee and write down what you chose before day one.</p>
        <p>Read the columns as consequences. Weight speaking at 40% and you will get a committee that queues for the speakers list and negotiates badly. Weight documents heavily and the unmoderated caucuses fill up and the general speakers list empties, which is fine if that is what you wanted and a problem if it is not. In a crisis committee, directive quality belongs inside &ldquo;contribution to documents&rdquo; and it is the dominant criterion, which is why the weights move.</p>

        <H2>Quantitative evidence, and where it lies to you</H2>
        <p>Four things can be counted honestly during a session: number of speeches, total speaking time, papers sponsored or signed, motions raised and passed. They are genuinely useful, and they are not the score.</p>
        <p>What counting is good for:</p>
        <ul>
          <li><strong>Catching the delegate you missed.</strong> Every chair has a blind spot, usually a quiet delegate on the far side of the room. A count that says they spoke seven times is a prompt to go and look at your notes about them.</li>
          <li><strong>Settling ties.</strong> When two delegates are genuinely level on judgement, evidence of sustained contribution is a defensible tie-break.</li>
          <li><strong>Answering the advisor.</strong> &ldquo;Your student spoke three times across two days and did not sponsor a paper&rdquo; is a fact. It ends a conversation that an opinion would extend.</li>
        </ul>
        <p>Where it lies:</p>
        <ul>
          <li><strong>Speaking time rewards the general speakers list</strong> and undercounts the delegate who did the decisive work in unmoderated caucus, where no clock runs.</li>
          <li><strong>Sponsor counts reward name placement</strong>, which is a social act, not an authorship claim. Ask whose clauses are actually in the text. Our <Link href="/blog/mun-working-paper-guide">working paper guide</Link> explains why sponsorship lists drift from reality.</li>
          <li><strong>Motion counts reward noise.</strong> A delegate who raises nine motions is often a delegate who is not listening.</li>
        </ul>
        <Callout>Use numbers as a prompt to look again, never as the answer. The moment a delegate believes speech count is the score, your committee becomes a queue.</Callout>

        <H2>Qualitative judgement, written down at the time</H2>
        <p>The best delegate in the room is frequently not the loudest. They are often the one who made a merger possible, or who conceded a clause at the moment it unlocked twelve votes, or who asked the question that exposed a proposal that would not have worked. None of that appears in a count, and almost none of it survives until Sunday evening unless you write it down within a minute of it happening.</p>
        <p>The technique that works is a one-line note, on the delegation, with the moment attached. Not &ldquo;good speech&rdquo;. Something like: &ldquo;Kenya, GSL 2: named the financing gap the rest of the room was avoiding, cited the 2023 review by number.&rdquo; Ten words, and in three days it is still evidence.</p>
        <p>Write between three and eight of these per delegation across a conference. Fewer and you cannot distinguish the middle of the field, which is where awards are actually decided. More and you were taking notes instead of chairing.</p>

        <H2>Taking notes without losing the room</H2>
        <p>The practical difficulty is that judging and chairing use the same attention. Four habits make it survivable.</p>
        <ul className="gv-check">
          <li><strong>Split the dais.</strong> If two of you sit, one runs procedure and one observes and writes, and you swap at the session break. This is the single biggest improvement available, and it is why a vice chair is worth having.</li>
          <li><strong>Write during unmoderated caucus,</strong> not during speeches. Unmod is the only time the room does not need you, and it is also when the behaviour you most need to record is happening in front of you.</li>
          <li><strong>Note at the moment, not at the session end.</strong> A note written an hour later is a note about your impression, not about the delegate.</li>
          <li><strong>Keep one record, not three.</strong> Two chairs with two notebooks and a shared spreadsheet is how evidence gets lost between sessions.</li>
        </ul>
        <p>This is where software earns its place. In a <Link href="/create">Gavelling session</Link>, the record builds itself while you chair: every speech logged with its delegation, its length and the part of the debate it happened in, alongside motions raised and papers submitted. The chair who is not currently holding the gavel gets a notes dock and can write a line against the delegation on the floor while the other runs procedure, and those notes appear against that speech afterwards in the committee&rsquo;s history, editable by their author. Delegates never see any of it: their own view shows speech counts and speaking time, and no score and no rating at all.</p>

        <H2>Blending the two into a score</H2>
        <p>The defensible shape is a score that is mostly judgement, evidenced by the record. In practice:</p>
        <ol>
          <li>Score each delegation on the five criteria, on a small scale. Five points, or ten, not a hundred. Fine-grained scales create false precision and take longer.</li>
          <li>Apply your weights. You now have a ranked list that reflects your judgement.</li>
          <li>Open the record and check it against the ranking. You are looking for contradictions: a delegate you ranked highly with almost no evidence behind them, or a delegate with heavy evidence you ranked low.</li>
          <li>Investigate every contradiction before you resolve it. Sometimes the evidence is right and you were charmed. Sometimes your judgement is right and the delegate did their work in unmod. Both happen, and the check is the point.</li>
          <li>Write one sentence of reasoning per award before you submit the slate, while you still remember why.</li>
        </ol>

        <H2>Bias, and concrete countermeasures</H2>
        <p>These are the five that distort MUN slates most reliably. None of them is solved by intending to be fair.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Bias</th><th>How it shows up</th><th>Countermeasure</th></tr>
            </thead>
            <tbody>
              <tr><td>Recency</td><td>The final session decides the slate</td><td>Score each session before the next one starts, and keep the early scores</td></tr>
              <tr><td>Volume</td><td>The delegate who spoke most feels like the best</td><td>Rank on contribution first, then check counts, never the reverse</td></tr>
              <tr><td>Accent and first language</td><td>Fluency read as competence</td><td>Judge the content of the argument separately from its delivery, and say so in your criteria</td></tr>
              <tr><td>Gender and interruption</td><td>Delegates who are talked over read as less dominant</td><td>Track who is interrupted in unmod; rule on it from the dais when it happens</td></tr>
              <tr><td>Country prestige</td><td>The P5 seat looks more important than the small state</td><td>Ask what the delegate did with the seat they were given, not what the seat could do</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two structural helps. First, rank independently of your co-chair and then compare, rather than discussing as you go: two people who talk through a slate converge on whoever spoke first. Second, before you finalise, read the list of delegations and ask which names you have no notes about. That set is where your bias lives.</p>

        <H2>Disqualifiers, and saying so at the time</H2>
        <p>Some behaviour takes a delegate out of contention: plagiarism in a position paper, sustained rudeness, pre-written resolutions brought from home where the conference forbids it, or representing a position so far from their country&rsquo;s that the simulation breaks. Our guide to <Link href="/blog/mun-controlling-the-floor">keeping debate moving</Link> covers the room management side.</p>
        <p>The rule that matters is when you say it. Tell the delegate at the time, quietly, in the break: &ldquo;I need you to stop interrupting in caucus. It is affecting how the committee runs.&rdquo; A delegate told on Saturday can change on Sunday. A delegate told nothing and then passed over has been judged in secret, and their advisor will be right to object.</p>

        <H2>Handing the slate to the secretariat</H2>
        <p>Most conferences ask the dais to submit a slate for ratification rather than announcing awards themselves. Send it with a short note, two or three sentences per award, naming specific moments. This does three jobs: it lets the secretariat spot a committee where the standard has drifted, it gives whoever runs the ceremony something true to say, and it is the document that exists if the result is questioned weeks later.</p>
        <p>Keep your notes until the conference is over and the results are published. If your record lives in a session tool, keep the room open until then rather than closing it the moment the gavel falls.</p>

        <H2>What to do with the rubric next year</H2>
        <p>After the conference, spend fifteen minutes on two questions. Which criterion did you never actually use, and which behaviour did your weights accidentally encourage? The second is the more useful. If your committee spent two days queueing for the speakers list and barely negotiated, your weights told them to. Change them, publish the change in your chair&rsquo;s letter, and watch the room behave differently.</p>
        <p>For the vocabulary of the awards themselves, and how many of each a committee usually gives, see <Link href="/blog/mun-award-categories">MUN award categories explained</Link>.</p>
      </ArticleLayout>
    </>
  );
}
