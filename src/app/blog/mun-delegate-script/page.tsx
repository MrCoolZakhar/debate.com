import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Delegate Script: What to Say at Every Stage of Committee';
const DESCRIPTION =
  'A word-for-word MUN delegate script: what to say at roll call, on the GSL, when yielding, raising motions and points, lobbying, amending and voting.';

const FAQ: FaqItem[] = [
  {
    question: 'What do you say to raise a motion in MUN?',
    answer:
      'Raise your placard, wait for the chair to recognise you, then state the motion in full. For example: "The delegation of Brazil moves for a moderated caucus on climate financing, for a total time of ten minutes with ninety seconds per speaker." Most motions then need a second and a simple majority.',
  },
  {
    question: 'How do you yield time in MUN?',
    answer:
      'At the end of your speech, say what happens to your remaining time. You can yield to the chair, to another delegate by name, or to questions. Say "The delegate yields her time to the chair" or "The delegate yields to points of information". Some rules of procedure do not allow yields, so check yours first.',
  },
  {
    question: 'What do you say for a point of personal privilege?',
    answer:
      'Raise your placard and say "Point of personal privilege", then give a short reason such as "The speaker is inaudible from the back of the room". It is meant for your own comfort or ability to take part, and in most rules it is the only point that may interrupt a speaker, and only for audibility.',
  },
  {
    question: 'What do you say in a MUN opening speech?',
    answer:
      'Open by naming your country and the committee, state your position on the topic in one clear sentence, give two or three points of evidence or policy, and close with a call to action or an invitation to work with you. Then say how your remaining time is yielded.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-delegate-script',
  ogDescription: 'The complete MUN delegate script with exact phrases for every committee moment.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-delegate-script',
  datePublished: '2026-11-14',
  dateModified: '2026-11-14',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-delegate-script' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Delegate Script', item: 'https://gavelling.com/blog/mun-delegate-script' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-delegate-script"
        pitch="Join a Gavelling session on your phone with a six-character code and rehearse these lines in a real queue."
      >
        <p>Most new delegates know what they want to do in committee and freeze when it is time to say it. The words are small and repetitive, and once you have them memorised the room stops feeling like a performance. This guide gives you word-for-word lines for every stage of a session, from roll call to the final vote. It is the delegate side of our <Link href="/blog/mun-chair-script">MUN chair script</Link>, so you can hear how the chair will answer you.</p>
        <p>Square brackets mark the parts you fill in. Phrases differ a little between conferences, so treat these as a safe default and check your own rules of procedure in the background guide.</p>

        <H2>Roll call</H2>
        <p>The chair reads each country in turn. You answer when yours is called. The two usual answers are:</p>
        <ChairScript>&quot;Present.&quot;</ChairScript>
        <ChairScript>&quot;Present and voting.&quot;</ChairScript>
        <p>If you say &quot;present&quot;, you may abstain on substantive votes. If you say &quot;present and voting&quot;, you must vote for or against, and you cannot abstain. A delegation that is unsure whether it will stay for the vote usually picks plain &quot;present&quot;. Listen to the chair&apos;s instructions first, because some conferences word the options differently.</p>
        <p>If you arrive late, wait for a gap and send a note to the dais or say, when recognised: &quot;The delegation of [Country] wishes to be marked present.&quot;</p>

        <H2>Getting on the General Speakers List</H2>
        <p>The chair opens the list and asks who wishes to speak. Raise your placard and wait to be called. You will usually be asked to say your country aloud, or the chair will add you from the raised placard. In some committees you send a note to the dais instead. The <Link href="/blog/general-speakers-list-guide">general speakers list guide</Link> explains how the list is ordered and how it runs.</p>
        <ChairScript>&quot;The delegation of [Country] would like to be added to the speakers list.&quot;</ChairScript>
        <p>If the committee has not opened a list yet, the first delegate to speak can ask for it:</p>
        <ChairScript>&quot;The delegation of [Country] moves to open the General Speakers List.&quot;</ChairScript>

        <H2>The opening speech</H2>
        <p>An opening speech sets out your country&apos;s position in about a minute. Start by naming who you are, state the position in one sentence, back it with a little evidence, and end by saying what you want. Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> goes deeper on structure. The skeleton looks like this.</p>
        <p>The opener:</p>
        <ChairScript>&quot;Thank you, honourable chair. Distinguished delegates, the delegation of [Country] believes that [your position on the topic in one sentence].&quot;</ChairScript>
        <p>The body gives two or three reasons, each with a fact, a treaty or a figure your country has actually signed up to or reported. Keep each reason to a few sentences so the clock does not run out before you reach your ask.</p>
        <p>The closer:</p>
        <ChairScript>&quot;[Country] urges all delegations to join us in [specific action]. We look forward to working with every bloc in this room. Thank you, honourable chair.&quot;</ChairScript>

        <H2>Yielding your time</H2>
        <p>If you finish early, you decide what happens to the time you have left. Say it clearly right after your last sentence, before the chair has to ask. Check that your conference allows yields at all, because the THIMUN style usually does not use them and has a separate system for questions.</p>
        <p>Yield to the chair, which just gives the time back:</p>
        <ChairScript>&quot;The delegate yields the remainder of her time to the chair.&quot;</ChairScript>
        <p>Yield to another delegate, usually an ally who has agreed to take it:</p>
        <ChairScript>&quot;The delegate yields her time to the delegate of [Other Country].&quot;</ChairScript>
        <p>Yield to questions, which invites points of information from the room:</p>
        <ChairScript>&quot;The delegate yields her time to points of information.&quot;</ChairScript>
        <p>Many chairs forbid a delegate who has just received a yield from passing it on again. If you are given time, use it or hand it back to the chair.</p>

        <H2>Raising a motion</H2>
        <p>A motion is a proposal to change what the committee is doing. Every motion follows the same shape: raise your placard, wait to be recognised, say &quot;the delegation of [Country] moves to&quot;, then give the details. The chair will usually ask if there is a second. Our <Link href="/blog/mun-motions-explained">motions guide</Link> lists which motions take precedence and how each is voted on.</p>
        <p>When the chair asks whether there are any motions on the floor, raise your placard and wait to be called.</p>

        <p><strong>Moderated caucus.</strong> You must give a total time, a speaking time and a topic. The total divided by the speaking time should come out as a whole number of speakers.</p>
        <ChairScript>&quot;The delegation of [Country] moves for a moderated caucus on [topic], for a total time of [ten minutes], with a speaking time of [sixty seconds].&quot;</ChairScript>

        <p><strong>Unmoderated caucus.</strong> Only a total time.</p>
        <ChairScript>&quot;The delegation of [Country] moves for an unmoderated caucus of [fifteen minutes].&quot;</ChairScript>

        <p><strong>Extending a caucus.</strong> Raise it near the end of the current one, and ask for no more than the original length.</p>
        <ChairScript>&quot;The delegation of [Country] moves to extend the [moderated / unmoderated] caucus by [five minutes].&quot;</ChairScript>

        <p><strong>Suspending the meeting.</strong> Used for lunch and breaks.</p>
        <ChairScript>&quot;The delegation of [Country] moves to suspend the meeting until [time].&quot;</ChairScript>

        <p><strong>Adjourning the meeting.</strong> Closes the session for the day.</p>
        <ChairScript>&quot;The delegation of [Country] moves to adjourn the meeting.&quot;</ChairScript>

        <p><strong>Introducing a working paper or draft resolution.</strong> The paper must already be approved by the dais and carry the required number of signatories.</p>
        <ChairScript>&quot;The delegation of [Country] moves to introduce Working Paper [number] / Draft Resolution [number].&quot;</ChairScript>

        <p><strong>Closing debate and moving into voting procedure.</strong> Serious, because once it passes there is no more debate. Chairs often hear one or two speakers for and against before they vote on it.</p>
        <ChairScript>&quot;The delegation of [Country] moves to close debate and move into voting procedure.&quot;</ChairScript>

        <Callout>A motion that is vague gets sent back. Say all the parameters in one go, with the numbers, so the chair can read it out once and call the vote.</Callout>

        <H2>Points: personal privilege, order, inquiry and information</H2>
        <p>A point is a request, not a proposal, so the committee does not vote on it. The four you will use are covered in <Link href="/blog/mun-points-explained">MUN points explained</Link>. Here are the lines.</p>
        <p>Point of personal privilege, for something that stops you taking part. It is the only point that may interrupt a speaker, and in most rules only for audibility.</p>
        <ChairScript>&quot;Point of personal privilege. The speaker is inaudible from the back of the room.&quot;</ChairScript>
        <p>Point of order, when the rules of procedure are not being followed:</p>
        <ChairScript>&quot;Point of order. The delegate has exceeded the time allocated by the chair.&quot;</ChairScript>
        <p>Point of parliamentary inquiry, a procedural question to the chair:</p>
        <ChairScript>&quot;Point of parliamentary inquiry. Would it be in order to move for a moderated caucus at this stage?&quot;</ChairScript>
        <p>Point of information, a question to the speaker, usually after a yield to questions. It must be a question and should be one sentence.</p>
        <ChairScript>&quot;Would the delegate agree that [short question]?&quot;</ChairScript>
        <p>If you are the one answering, you can accept or decline. A quiet &quot;I will take that question&quot; keeps you in control of the clock.</p>

        <H2>Right of reply</H2>
        <p>A right of reply is not a point and is not for disagreeing with an argument. It is for when another delegate has insulted your country&apos;s integrity, sovereignty or dignity. It is normally sent to the dais in writing and granted at the chair&apos;s discretion. See the <Link href="/blog/mun-right-of-reply">right of reply guide</Link> for what qualifies. If you are recognised, you can open with:</p>
        <ChairScript>&quot;Thank you, honourable chair. The delegation of [Country] wishes to correct the record on the remarks made by the delegate of [Other Country] regarding [specific matter].&quot;</ChairScript>
        <p>Then correct the specific remark, calmly and briefly, and return the floor. A reply that grows into a second opening speech is the quickest way to lose the chair&apos;s goodwill.</p>

        <H2>Speeches in a moderated caucus</H2>
        <p>A moderated caucus speech is shorter and more specific than a GSL speech. Pick one idea, answer something a previous speaker said, and finish with a proposal. A good pattern is to refer to someone by country, add your own point, and offer a clause.</p>
        <ChairScript>&quot;Thank you, honourable chair. The delegation of [Country] agrees with the delegate of [Other Country] that [shared point], and would add that [your idea]. We would like to see this reflected in the operative clauses of the resolution. We invite all delegations interested in this approach to speak with us in the next unmoderated caucus.&quot;</ChairScript>
        <p>That last sentence does the work of recruiting allies. Say it in nearly every moderated caucus speech.</p>

        <H2>Lobbying in an unmoderated caucus</H2>
        <p>An unmoderated caucus is where resolutions get written, and it is the part no script can fully cover. These lines open conversations and are polite enough to use with a delegate you have never met.</p>
        <p>Finding a bloc:</p>
        <ChairScript>&quot;Hello, I am the delegate of [Country]. We are working on [short idea]. Which direction is your delegation leaning?&quot;</ChairScript>
        <p>Pitching a clause:</p>
        <ChairScript>&quot;Our delegation would like to add a clause on [topic]. Would you be willing to co-sponsor?&quot;</ChairScript>
        <p>Handling a clash with another group:</p>
        <ChairScript>&quot;It looks like we agree on the aim and differ on the method. Can we merge our drafts and keep both mechanisms?&quot;</ChairScript>
        <p>Spend the first few minutes talking to many delegations and the rest writing with a few.</p>

        <H2>Sponsoring, signing and introducing a draft resolution</H2>
        <p>Sponsors wrote the paper and support it fully. Signatories only want it discussed, so they may vote against it later. When asked, be exact about which you are.</p>
        <ChairScript>&quot;The delegation of [Country] would like to be a sponsor of this draft resolution.&quot;</ChairScript>
        <ChairScript>&quot;The delegation of [Country] would like to sign this paper as a signatory.&quot;</ChairScript>
        <p>Once the paper is on the floor, a sponsor reads out the operative clauses, or the chair does. The sponsor then usually takes questions. A short introduction looks like this:</p>
        <ChairScript>&quot;Honourable chair, distinguished delegates. Draft Resolution [number] was written by [Sponsor countries]. It does three things: it [first aim], it [second aim] and it [third aim]. We believe it is a realistic compromise and we ask the committee for its support. The sponsors are ready to answer questions.&quot;</ChairScript>

        <H2>Amendments, friendly and unfriendly</H2>
        <p>An amendment changes a clause in a draft resolution that is already on the floor. A friendly amendment is one that every sponsor agrees to, and it is added without a vote. An unfriendly amendment is opposed by at least one sponsor and is voted on by the committee.</p>
        <p>Raising an amendment:</p>
        <ChairScript>&quot;The delegation of [Country] would like to propose an amendment to operative clause [number], replacing [old wording] with [new wording].&quot;</ChairScript>
        <p>A sponsor accepting it as friendly:</p>
        <ChairScript>&quot;The sponsors consider this a friendly amendment.&quot;</ChairScript>
        <p>A sponsor refusing it:</p>
        <ChairScript>&quot;The sponsors consider this an unfriendly amendment.&quot;</ChairScript>
        <p>Some conferences call these &quot;amendments&quot; and &quot;friendly amendments&quot;, and others use different thresholds for introducing them. Read your rules for the signatory count and the vote needed.</p>

        <H2>Voting</H2>
        <p>On a substantive vote, the chair asks for those in favour, those against and abstentions. The delegates raise their placards. Our <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> explains the roll call, division of the question and when a vote is recorded.</p>
        <p>In a roll-call vote, you answer when your country is called:</p>
        <ChairScript>&quot;In favour.&quot;</ChairScript>
        <ChairScript>&quot;Against.&quot;</ChairScript>
        <ChairScript>&quot;Abstain.&quot;</ChairScript>
        <p>If the chair allows it, you can pass the first time you are called and vote at the end. A delegation that passes is then asked again and must vote for or against.</p>
        <ChairScript>&quot;Pass.&quot;</ChairScript>
        <p>Voting with rights lets you explain your vote after the result. Whether it is allowed, and how many delegations may use it, depends on the rules, so check before you rely on it.</p>
        <ChairScript>&quot;In favour, with rights.&quot;</ChairScript>
        <ChairScript>&quot;Against, with rights.&quot;</ChairScript>
        <p>If you are recognised for your right, keep the explanation to a sentence or two. The point is to say why, not to restart debate.</p>

        <H2>Rules differ: UNA-USA and THIMUN</H2>
        <p>The lines above work across most conferences, but procedure is not universal. UNA-USA style committees lean on yields, motions and moderated caucuses. THIMUN style conferences use a formal system of points of information, amendments in a set order and different forms of address. A &quot;point of information&quot; to a speaker is a normal part of THIMUN debate, while in some UNA-USA committees it only exists after a yield to questions. Our guide to <Link href="/blog/mun-procedure-styles-compared">MUN procedure styles compared</Link> shows what changes. When in doubt, read your conference&apos;s rules the night before.</p>

        <H2>Common mistakes</H2>
        <ul>
          <li><strong>Speaking before being recognised.</strong> Raise your placard and wait for the chair to call your country.</li>
          <li><strong>Raising an incomplete motion.</strong> A moderated caucus with no total time or topic will be sent back, and you lose your place.</li>
          <li><strong>Using a point to argue.</strong> A point of order is for a breach of the rules. It is not for disagreeing with what another delegate said.</li>
          <li><strong>Mixing up point and motion.</strong> A motion changes what the committee is doing and needs a vote. A point is only a request.</li>
          <li><strong>Forgetting to yield.</strong> If you stop and say nothing, the chair will assume you yield to the chair and you lose the chance to hand time to an ally.</li>
          <li><strong>Voting present and voting, then abstaining.</strong> If you said &quot;present and voting&quot;, you cannot abstain on substantive votes.</li>
          <li><strong>Speaking for exactly your whole time every time.</strong> Short, sharp speeches are remembered more than long ones.</li>
        </ul>

        <Callout>You do not need to memorise every line. Learn the motion shapes and the four points, and read the rest from a card on the desk. Chairs would much rather hear a delegate read a motion correctly than invent one badly.</Callout>

        <H2>Practise the words before the conference</H2>
        <p>Saying these lines out loud once or twice does more than reading them ten times. If you want to practise with other people, you can join a Gavelling session on your phone with its six-character code, ask to speak and watch your place in the queue move. It will not write your speech, but it is a low-pressure place to hear yourself say &quot;the delegation of [Country] moves to&quot; for the first time.</p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
