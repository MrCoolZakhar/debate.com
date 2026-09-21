import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Handle Difficult Delegates: Eight Problems and the Exact Intervention',
  description:
    'The eight delegates who derail a committee, the smallest fix for each, the words to say from the dais, and the point at which it stops being yours to handle',
  path: '/blog/mun-difficult-delegates',
  ogDescription: 'The eight delegates who derail a committee, and the exact intervention for each.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Handle Difficult Delegates: Eight Problems and the Exact Intervention',
  description: 'The eight delegates who derail a committee, and the exact intervention for each.',
  url: 'https://gavelling.com/blog/mun-difficult-delegates',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-difficult-delegates' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Handling Difficult Delegates', item: 'https://gavelling.com/blog/mun-difficult-delegates' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-difficult-delegates"
        pitch="Gavelling gives the dais the speakers list, the timer and the room’s speaking record on one screen, so an intervention takes a tap rather than a scramble."
      >
        <p>Every chair gets one. Sometimes two, on the same dais, at the same time. The delegate who has spoken eleven times, the one who raises a point of order to score a point, the one who has said nothing since Friday. None of it is unusual and almost all of it is fixable with a small, early action. This guide names eight problems and gives the exact intervention and the words for each.</p>

        <H2>The principle: the smallest intervention that protects the room</H2>
        <p>Your job is the quality of the committee&rsquo;s debate, not the correction of an individual&rsquo;s character. That sounds obvious and it changes every decision you make, because it tells you how hard to hit.</p>
        <p>Choose the least forceful action that fixes the room, and choose it early. A procedural adjustment in the first hour costs nothing and nobody notices. The same behaviour left alone until Saturday afternoon requires a public ruling, which embarrasses the delegate, makes the room tense and takes ten minutes of debate time.</p>
        <p>Four levels, in order: change the procedure so the problem cannot recur, speak to the delegate privately at the next break, rule publicly from the dais, escalate off the dais. Start at the top of that list. Our guide to <Link href="/blog/mun-controlling-the-floor">controlling the floor</Link> covers the procedural side in more depth.</p>
        <Callout>The question to ask before every intervention: is this a debate problem, a behaviour problem, or a welfare problem? Debate problems are solved with procedure. Behaviour problems are solved with a private word. Welfare problems are not yours to solve at all, and are covered at the end of this guide.</Callout>

        <H2>The delegate who takes every speaking slot</H2>
        <p>Usually a strong delegate who has correctly worked out that speaking often is rewarded. The room is not being sabotaged, it is being crowded out, which is a debate problem and therefore a procedural fix.</p>
        <p><strong>The fix.</strong> Use the structure you already have. When you open a moderated caucus, say that the dais will prioritise delegations that have not yet spoken on this sub-topic. That is entirely normal chair discretion in recognising speakers and nobody can object to it. Cap speaking time at the lower end. If the General Speakers List is being filled by the same four placards, take a fresh list.</p>
        <ChairScript>&ldquo;For this caucus the dais will give preference to delegations that have not yet addressed this sub-topic. Delegates who have already spoken will be recognised once the list has turned over.&rdquo;</ChairScript>
        <p>Then say the useful thing privately at the break. A dominant delegate almost always believes volume is the metric. Telling them that the dais values the quality of their contribution and their ability to bring others in is not a rebuke, it is a tip, and most of them adjust immediately because they want to do well.</p>

        <H2>The rules lawyer</H2>
        <p>Points of order used as a weapon, points of parliamentary inquiry that are really speeches, motions raised to interrupt an opponent&rsquo;s momentum. The room slows to a crawl and quieter delegates stop trying.</p>
        <p><strong>The fix.</strong> Rule quickly, briefly and without argument. Do not explain your reasoning at length: a long justification invites the next point. A chair who rules in four words three times running removes the entire incentive.</p>
        <ChairScript>&ldquo;The point is not well taken. The delegate will be seated. The speakers list continues.&rdquo;</ChairScript>
        <p>If the same delegation raises a third spurious point, name the pattern once, publicly and without heat, then move on immediately. &ldquo;The dais notes that this is the third point of order from this delegation that does not concern procedure. Further points of this kind will not be entertained.&rdquo; Our guide on <Link href="/blog/mun-points-of-order">points of order</Link> covers what genuinely qualifies, which is worth knowing precisely so your rulings are correct as well as fast.</p>

        <H2>The delegate who has not spoken in four hours</H2>
        <p>The most common problem in the room and the one chairs most often ignore, because silence is not disruptive. It is still a failure: that delegate paid the same fee.</p>
        <p><strong>The fix, in escalating order.</strong> First, a structure that lowers the cost of speaking: a round the table where every delegation speaks for thirty seconds removes the decision to volunteer entirely. Second, a private word at the break, which is where the real work happens. Ask what committee they have done before and what they are finding hard, then give them a specific, small job: &ldquo;in the next caucus, raise the funding question, sixty seconds, nothing else.&rdquo; A defined task is far easier than an open invitation.</p>
        <p>Third, seat them. Walk over during unmoderated caucus and introduce them to a bloc by name, then leave. Many silent delegates are not unprepared, they simply cannot find a way into a group that formed in the first twenty minutes.</p>
        <FactCard title="What not to do">
          Do not call on a silent delegate without warning to make a point about participation. It is the single most reliable way to ensure they never speak again. If you want to call on them, tell them at the break that you are going to, and tell them what the question will be.
        </FactCard>

        <H2>The bloc that has locked everyone out</H2>
        <p>Eight delegations around one laptop with the door metaphorically closed, and half the committee with nowhere to go. Left alone it produces one resolution, a resentful vote and fifteen delegates who did nothing all weekend.</p>
        <p><strong>The fix.</strong> This is a debate problem, so solve it with procedure and information rather than instruction. Announce how many working papers the dais expects to see, and that papers with sponsors from more than one regional group will be looked on favourably in debate scheduling. Set a submission deadline early enough that a second paper has to start now. During unmoderated caucus, walk the room and ask the excluded delegates what their clause would say, out loud, which frequently produces a second bloc on its own.</p>
        <p>Do not instruct a bloc to admit people. Exclusion is a legitimate negotiating tactic and forcing entry teaches nothing. Make the closed strategy less rewarding instead, and it dissolves without a confrontation.</p>

        <H2>Breaking character, or being offensive in character</H2>
        <p>Two very different problems that look similar from the dais.</p>
        <p><strong>Breaking character</strong> is a minor procedural matter: a delegate arguing their own view rather than their country&rsquo;s, or referring to themselves in the first person. Correct it lightly and move on. &ldquo;The delegate will speak for their government.&rdquo;</p>
        <p><strong>Offensive in character</strong> is not a procedural matter and must not be treated as one. A delegate representing a state with a repressive record may accurately state that state&rsquo;s position. A delegate may not use the assignment as cover for abuse of people in the room, slurs, or content directed at the identity of another delegate. The distinction is whether the statement is about a government&rsquo;s policy or about people.</p>
        <p>When it crosses, act immediately and without discussion.</p>
        <ChairScript>&ldquo;The delegate will stop. That language is not acceptable in this committee, in character or otherwise. The delegate is out of order and the dais will speak with them outside. The committee will suspend for five minutes.&rdquo;</ChairScript>
        <p>Then involve the secretariat. Do not handle a serious incident alone, do not negotiate it at the front of the room, and write down what was said and when while you still remember the words.</p>

        <H2>The delegate who is drowning</H2>
        <p>Visibly out of their depth: no position paper, no idea what a motion is, and a growing certainty that everyone else knows something they do not. They are not a problem to be managed, they are the reason the activity exists.</p>
        <p><strong>The fix.</strong> Be direct and kind at the first break. Tell them the thing nobody says out loud: almost nobody understands procedure on their first day, and the dais will help. Give them three concrete items, no more: the sentence to say when raising a placard, the name of one delegate they should work with, and the single question they should ask in the next caucus.</p>
        <p>Then follow up. If you told a delegate to raise the funding question and they did, say so afterwards. A first-timer who gets one thing right on Friday is a different delegate on Saturday. This matters more than almost anything else you do that weekend, and it is also the part of chairing that <Link href="/blog/how-to-chair-first-mun">new chairs</Link> most often forget they are allowed to do.</p>

        <H2>The pre-written speech read at speed</H2>
        <p>A delegate reads 300 words in sixty seconds from a sheet, makes no eye contact, and the content is unconnected to what the previous speaker said. The room stops listening, and the habit spreads.</p>
        <p><strong>The fix.</strong> Change what the format rewards. Shorten speaking time: 45 seconds makes reading a prepared paragraph impossible. Set caucus topics that are narrow and responsive, so a pre-written speech does not fit. Ask a follow-up question after the speech, which cannot be answered from the sheet.</p>
        <ChairScript>&ldquo;Thank you. Before the delegate yields, the dais has a question. The previous speaker proposed funding this through voluntary contributions. Does the delegate&rsquo;s government support that mechanism?&rdquo;</ChairScript>
        <p>Two or three of those and the room quietly puts its papers down.</p>

        <H2>Two delegates having a personal argument</H2>
        <p>The exchange has stopped being about the topic. Names are being used, the tone has sharpened, and the rest of the committee has become an audience.</p>
        <p><strong>The fix.</strong> Break the format immediately. Do not adjudicate the argument and do not grant the <Link href="/blog/mun-right-of-reply">right of reply</Link> that one of them is about to request, because that continues the exchange with the dais&rsquo;s approval. Move to an unmoderated caucus, or take the speakers list in a different direction.</p>
        <ChairScript>&ldquo;The committee will move into an unmoderated caucus of ten minutes. The dais would like to see the delegates of [country] and [country] at the front before it begins.&rdquo;</ChairScript>
        <p>At the front, say one sentence to both of them together, not to each separately: the exchange is finished, the committee needs both of you on the resolution, and the dais will not recognise it again. Separating them into different blocs for the next session usually finishes the job.</p>

        <H2>The escalation ladder</H2>
        <ul>
          <li><strong>1. Procedural adjustment.</strong> Nobody notices. Use it first, always.</li>
          <li><strong>2. Private word at the break.</strong> Solves the large majority of behaviour problems, and it preserves the delegate&rsquo;s standing in the room.</li>
          <li><strong>3. A written note from the dais.</strong> Quiet, dated, on the record, and it does not interrupt debate. Underused.</li>
          <li><strong>4. A public ruling.</strong> Costs the delegate something in front of their peers, so use it when the room needs to see the line drawn.</li>
          <li><strong>5. The secretariat.</strong> For anything involving conduct rather than debate, anything repeated, or anything you are not sure about.</li>
          <li><strong>6. The faculty advisor.</strong> Through the secretariat, not directly. It is their student and their duty of care.</li>
        </ul>
        <p>Jump straight to 5 for any of: abuse or harassment, anything touching a protected characteristic, physical conduct, anything involving a delegate&rsquo;s safety, or any allegation made to you about something outside your committee. Do not investigate, do not promise confidentiality, and write down what you were told.</p>

        <H2>What never works</H2>
        <ul>
          <li><strong>Sarcasm from the dais.</strong> It is the most tempting tool available and it costs you the room&rsquo;s trust permanently. A chair who mocks a delegate has taught every quiet delegate not to risk it.</li>
          <li><strong>Public humiliation.</strong> Including the long public explanation of why someone is wrong. Rule and move on.</li>
          <li><strong>Ignoring it and hoping.</strong> Behaviour that is unaddressed at 11am is precedent by 3pm.</li>
          <li><strong>Arguing with a delegate about procedure.</strong> You rule, they may appeal under your conference&rsquo;s rules, and there is nothing to debate.</li>
          <li><strong>Threatening awards.</strong> Never mention them as leverage. It turns every subsequent decision the delegate makes into a calculation about you. Judge them on the <Link href="/blog/mun-judging-rubric">rubric</Link> instead.</li>
        </ul>

        <H2>Where it stops being yours</H2>
        <p>Chairs are usually students, often only a year or two older than the delegates, and are not trained welfare professionals. There is a line, and knowing exactly where it is protects you as well as them.</p>
        <p>It stops being a committee matter the moment the issue is about a person&rsquo;s wellbeing rather than the debate: a delegate in visible distress, a disclosure about something that happened to them, anything relating to bullying outside the room, a medical problem, or a delegate who tells you something you do not feel equipped to hear. In all of those cases your entire job is to pass it to the named person the conference has designated, promptly and accurately. Our <Link href="/blog/mun-safeguarding">MUN safeguarding guide</Link> covers this in detail.</p>
        <p>Three rules. Do not promise to keep it secret, because you may not be able to. Do not investigate, because you will contaminate the account. Do write down the time, the words and who else was present, immediately afterwards.</p>

        <H3>Before your committee opens</H3>
        <ul className="gv-check">
          <li>Know who your safeguarding contact is, by name, and how to reach them in ten seconds.</li>
          <li>Agree with your co-chair who rules and who takes the private conversations.</li>
          <li>Read your conference&rsquo;s code of conduct so you can quote it rather than paraphrase it.</li>
          <li>Decide your default speaking time and the point at which you would shorten it.</li>
          <li>Learn the names of the delegates who look nervous in the first ten minutes. You will need them at the first break.</li>
        </ul>
        <p>Most of this is easier with the room&rsquo;s record in front of you rather than in your memory: who has spoken, how often, and for how long. Our <Link href="/blog/mun-chair-script">chair script</Link> has the exact wording for every routine moment, and <Link href="/blog/how-to-run-mun-committee">the full chairing guide</Link> covers the session end to end.</p>
      </ArticleLayout>
    </>
  );
}
