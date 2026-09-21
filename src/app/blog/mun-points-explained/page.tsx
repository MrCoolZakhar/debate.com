import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Points in MUN: Order, Inquiry, Information and Personal Privilege',
  description:
    'All four points, what each is for, whether it can interrupt a speaker, the exact wording, and how the circuits differ.',
  path: '/blog/mun-points-explained',
  ogDescription: 'The four points in Model UN, with wording and interrupt rules.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Points in MUN: Order, Inquiry, Information and Personal Privilege',
  description: 'The four points in Model UN, with wording and interrupt rules.',
  url: 'https://gavelling.com/blog/mun-points-explained',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-points-explained' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Points in MUN', item: 'https://gavelling.com/blog/mun-points-explained' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-points-explained"
        pitch="Gavelling shows the floor, the clock and the motion on every delegate’s phone, so points get raised about the right things."
      >
        <p>A point is a request. A motion is a proposal. That single distinction clears up most of the confusion, because a point never changes what the committee is doing: it asks the chair to fix something, to explain something, or to let you ask a question. There are four of them in common use, and this guide gives you each one, whether it can interrupt a speaker, the words to say, and where the circuits disagree.</p>
        <p>One caution before the table. Every rule below varies by conference. The rules of procedure your conference publishes always wins over anything here, and reading them once before you arrive takes fifteen minutes and saves you from the single most common cause of a chair ruling against you.</p>

        <H2>The four points at a glance</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Point</th><th>Asks the chair to</th><th>Directed at</th><th>May interrupt a speaker</th></tr>
            </thead>
            <tbody>
              <tr><td>Point of Order</td><td>Correct a breach of the rules</td><td>The chair</td><td>Yes, in most rulesets</td></tr>
              <tr><td>Point of Parliamentary Inquiry</td><td>Explain a rule or procedure</td><td>The chair</td><td>No</td></tr>
              <tr><td>Point of Personal Privilege</td><td>Fix something impairing your participation</td><td>The chair</td><td>Only for audibility, in most rulesets</td></tr>
              <tr><td>Point of Information</td><td>Let you put a question to the speaker</td><td>The speaker</td><td>No</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Interrupt rules follow the common formulations in UNA-USA style and THIMUN style rulesets. Check your own conference&rsquo;s document.</p>

        <H2>Point of Order</H2>
        <FactCard title="Point of Order">
          Raised when the rules of procedure are being broken, almost always by the dais. It is not a way to disagree with a decision the chair was entitled to make. The chair rules on it immediately and there is no debate.
        </FactCard>
        <p>Legitimate uses are narrow and specific: the chair called the wrong delegation from the speakers list, entertained a motion that is out of order, stated the wrong voting threshold, let a speaker run substantially over time, or conducted business without quorum.</p>
        <ChairScript>&ldquo;Point of order. The chair stated that the motion requires a simple majority. Under Rule 22 a motion to close debate requires a two-thirds majority.&rdquo;</ChairScript>
        <p>The most common misuse by a distance is using it to object to something another delegate said. That is not a procedural breach, and chairs hear it several times a conference. If a delegate misstates a fact, your remedy is a point of information, a speech, or a right of reply if it was an attack on your country. Our <Link href="/blog/mun-points-of-order">full guide to points of order</Link> covers appeals and how chairs should rule in detail.</p>
        <Callout>Before raising a point of order, name the rule in your head. If you cannot, you almost certainly want a different point or a speech.</Callout>

        <H2>Point of Parliamentary Inquiry</H2>
        <FactCard title="Point of Parliamentary Inquiry">
          A question to the chair about procedure. Not about the topic, not about the substance of a resolution. It cannot interrupt a speaker, so it waits for a gap in debate.
        </FactCard>
        <p>Use it when you genuinely do not know how something works and the answer changes what you do next.</p>
        <ChairScript>&ldquo;Point of parliamentary inquiry. Would a motion to introduce a draft resolution be in order at this time, or must the speakers list be exhausted first?&rdquo;</ChairScript>
        <p>Good inquiries: whether a motion is in order now, how many signatories a working paper needs, what the voting order for amendments will be, whether abstentions count toward the threshold. Our <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> answers most of the last category in advance, which is the better route.</p>
        <p>Bad inquiries: anything about the topic (&ldquo;could the chair clarify the current situation in the region&rdquo;), and anything you are asking in order to make a point rather than to learn something. Chairs recognise the second instantly.</p>
        <p>Some North American rulesets call this a Point of Information to the Chair, which collides confusingly with the THIMUN sense of point of information below. If your conference uses that name, it still means this: a procedural question, addressed to the dais.</p>

        <H2>Point of Personal Privilege</H2>
        <FactCard title="Point of Personal Privilege">
          Raised when something is impairing your ability to participate: you cannot hear, the room is too hot or too cold, there is noise outside, you need to leave the room. In most rulesets it is the one point besides a point of order that may interrupt a speaker, and only when the problem is that you cannot hear them.
        </FactCard>
        <p>That carve-out exists for an obvious reason. If you cannot hear the speech, waiting politely until it finishes defeats the purpose. Everything else waits.</p>
        <ChairScript>&ldquo;Point of personal privilege. The delegate is inaudible from the back of the room.&rdquo;</ChairScript>
        <p>Two conventions worth knowing. At many conferences a point of personal privilege is not debated or explained at all: you raise it, the chair addresses it, the committee moves on, and you are not expected to give details. And at most conferences you do not need one to leave the room briefly, though some ask you to raise it so the dais knows your delegation is temporarily absent for quorum purposes.</p>
        <p>Misuse to avoid: using it to complain about what a speaker said. Discomfort at an argument is not a privilege issue, and a chair who is generous about this once will be firm about it the second time.</p>

        <H2>Point of Information</H2>
        <FactCard title="Point of Information">
          A question put to the delegate who has just spoken, or who is speaking, subject to their willingness to take it. It is the engine of THIMUN-style debate and optional or absent on parts of the North American circuit.
        </FactCard>
        <p>On the THIMUN circuit the sequence is standard: a delegate finishes their speech, the chair asks whether they are open to points of information, and if so the chair takes placards and recognises questioners in turn. The speaker answers each in turn. Follow-up questions are usually allowed only at the chair&rsquo;s discretion.</p>
        <ChairScript>&ldquo;Is the delegate open to any points of information? The chair recognises the delegate of Ghana.&rdquo;</ChairScript>
        <p>A point of information must be a question. The habit chairs most often have to correct is the delegate who uses it to deliver a thirty-second argument ending in &ldquo;does the delegate not agree?&rdquo;. Rulesets that permit it usually permit one sentence.</p>
        <p>On the North American circuit the general speakers list more often runs on yields: a delegate may yield their remaining time to questions, to another delegate, or to the chair. Where that is the model, points of information exist only inside the yield and the term is often reserved for the procedural question to the chair. See <Link href="/blog/general-speakers-list-guide">the general speakers list guide</Link> for how yields work in practice.</p>

        <H2>Answering a hostile point of information</H2>
        <p>Being asked a question designed to expose a weakness in your position is a normal part of committee and a genuine opportunity, because the room is now paying attention to you rather than to the questioner.</p>
        <p>Four things that work:</p>
        <ul>
          <li><strong>Answer the question that was asked,</strong> in one sentence, before anything else. Delegates who bridge immediately to a talking point look evasive, and chairs notice.</li>
          <li><strong>Concede what is true.</strong> &ldquo;The delegate is correct that our implementation record is incomplete&rdquo; costs you nothing and buys the rest of your answer credibility.</li>
          <li><strong>Reframe rather than deny</strong> when the premise is wrong: &ldquo;the question assumes the mechanism is mandatory; under our proposal it is not, and that is the difference&rdquo;.</li>
          <li><strong>Stop talking.</strong> A short answer reads as confidence. Continuing past the answer is how a question becomes a problem.</li>
        </ul>
        <p>You are usually entitled to decline points of information altogether. Doing so occasionally is fine; doing so every time tells the room you cannot defend your position.</p>

        <H2>Rights of reply, which are not a point</H2>
        <p>A right of reply is a separate procedure, not a fifth point, and it is worth knowing where the boundary sits. It is granted by the chair to a delegation whose national integrity, sovereignty or dignity has been impugned by another delegate, and it gives them a short slot to respond. It is not for disagreeing with an argument, however strongly.</p>
        <p>In most rulesets it is requested in writing to the dais rather than shouted from the floor, it is entirely at the chair&rsquo;s discretion, and the chair&rsquo;s decision is not appealable. The full procedure, including what actually qualifies, is in our <Link href="/blog/mun-right-of-reply">right of reply guide</Link>.</p>

        <H2>How a chair should respond to each</H2>
        <p>From the dais, the pattern is the same for all four: acknowledge, resolve, return the floor, in that order and quickly. A point handled in eight seconds costs the committee nothing. A point that becomes a conversation costs it two minutes and invites four more.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Point</th><th>Chair&rsquo;s response</th></tr>
            </thead>
            <tbody>
              <tr><td>Order</td><td>Rule it well taken or not well taken, immediately, with a one-line reason if useful</td></tr>
              <tr><td>Parliamentary inquiry</td><td>Answer it, briefly. If you are not sure, say so and check rather than guessing</td></tr>
              <tr><td>Personal privilege</td><td>Fix it if you can, acknowledge it if you cannot, do not ask for details</td></tr>
              <tr><td>Information</td><td>Ask the speaker whether they accept, then recognise questioners in turn</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>&ldquo;Well taken&rdquo; means the point identified a genuine breach and the chair is correcting it. &ldquo;Not well taken&rdquo; means it did not, and the committee continues unchanged. Neither phrase is a judgement of the delegate, and it is worth saying so once in your opening remarks so that a first-time delegate does not hear a ruling as a rebuke.</p>
        <p>New chairs accept spurious points to avoid conflict. Do not. Every spurious point you accept produces three more, and the committee learns that procedure is negotiable. The exact wording is in our <Link href="/blog/mun-chair-script">chair script</Link>.</p>

        <H2>Circuit differences</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th></th><th>THIMUN style</th><th>UNA-USA style</th></tr>
            </thead>
            <tbody>
              <tr><td>Points of information to a speaker</td><td>Central, used constantly</td><td>Usually through yields, or absent</td></tr>
              <tr><td>Procedural question to the chair</td><td>Point of parliamentary inquiry</td><td>Point of inquiry or point of information to the chair</td></tr>
              <tr><td>Follow-up questions</td><td>Often permitted at chair&rsquo;s discretion</td><td>Rare</td></tr>
              <tr><td>Right of reply</td><td>Common, usually in writing</td><td>Common, usually in writing</td></tr>
              <tr><td>Yields</td><td>Uncommon</td><td>Standard: to questions, to a delegate, or to the chair</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>If you move between circuits, the two things that will catch you out are points of information and yields, because each circuit uses one where the other uses the other. Our <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> sets out the wider differences.</p>

        <H2>Three points delegates invent</H2>
        <p>These come up at every conference and, in most rulesets, none of them exists.</p>
        <ul>
          <li><strong>Point of clarification.</strong> Used to ask a speaker what they meant. Some conferences do recognise it, so check, but where it is not in the rules the chair will treat it as a point of information and often as an out-of-order one. If you want a speaker to explain something, wait for points of information.</li>
          <li><strong>Point of relevance.</strong> Used to object that a speech has wandered off topic. Keeping speeches relevant is the chair&rsquo;s job, not yours, and raising this is read as an attempt to interrupt a speaker you disagree with.</li>
          <li><strong>Point of fact, or point of contradiction.</strong> Used to say another delegate is wrong. There is no procedural remedy for someone being wrong: answer it in your own speech, which is more persuasive anyway.</li>
        </ul>
        <p>There is a fourth worth adding: the point raised purely to be seen raising one. Chairs can tell, and what it signals is the opposite of procedural mastery. Two well-judged points across a conference do more for your standing than a dozen, and how that record is actually assessed is covered in <Link href="/blog/mun-judging-rubric">the chair&rsquo;s scoring rubric</Link>.</p>
      </ArticleLayout>
    </>
  );
}
