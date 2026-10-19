import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Opening Speech: A Fill-In Template and One Speech Built Step by Step';
const DESCRIPTION =
  'A fill-in template for your first speech on the speakers list, one opening speech drafted three times from research notes to final version, the word counts for 60 and 90 seconds, and how to adapt it to your country';

const FAQ: FaqItem[] = [
  {
    question: 'How long should a MUN opening speech be?',
    answer:
      'As long as the committee speaking time, usually 60 to 90 seconds, minus five seconds. At a clear committee pace that is about 130 to 140 words for 60 seconds and about 200 words for 90 seconds. Time it aloud once before you trust the word count.',
  },
  {
    question: 'How do you start a MUN opening speech?',
    answer:
      'Address the chair in a few words, then open with a claim, a fact with its date, or the reason your country cares. Avoid opening with the delegation being honoured or pleased to speak: every delegate says it and it costs you the first five seconds.',
  },
  {
    question: 'What should a MUN opening speech include?',
    answer:
      'Five things: a short address, a hook, why your country has a stake, your position as one or two specific asks plus one thing you will not accept, and an invitation telling delegations where and when to find you.',
  },
  {
    question: 'Should I memorise my opening speech?',
    answer:
      'Memorise the first and last sentences and speak the middle from short notes. A fully memorised speech breaks when you lose a word, and a fully read speech loses the room. Looking up on the first and last lines is what the dais notices.',
  },
  {
    question: 'What if another delegate says what I planned to say?',
    answer:
      'Name them and build on it: agree in one sentence, then add the part they left out. It shows you were listening and starts a bloc in public. Never repeat their speech with your country name on it.',
  },
  {
    question: 'Is the opening speech the same as the position paper?',
    answer:
      'No. The position paper is the evidence; the speech is the headline. Take the two most important proposals from your paper and the one red line, and leave the history and statistics in the paper.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-opening-speech',
  keywords: [
    'MUN opening speech',
    'MUN opening speech template',
    'how to write a MUN opening speech',
    'opening speech Model UN',
    'first GSL speech',
    'MUN opening speech example',
  ],
  ogDescription: 'A fill-in template and one opening speech drafted three times, from notes to final.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-opening-speech',
  datePublished: '2026-06-07',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-opening-speech' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Opening Speech', item: 'https://gavelling.com/blog/mun-opening-speech' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-opening-speech"
        pitch="In a Gavelling session your phone shows your place on the speakers list, so you know exactly how long you have to finish this speech."
      >
        <p>
          Your opening speech is your first turn on the speakers list, and for many delegations it is the only time the whole room hears their position in full. This guide is the writing method: a template you can fill in tonight, one speech taken from raw research notes through three drafts to the version you would deliver, and how to change it for your country and for when you are called. If you want finished speeches to read first, our <Link href="/blog/mun-speech-examples">MUN speech examples</Link> has twelve, at three lengths.
        </p>

        <H2>What the opening speech has to do</H2>
        <p>
          One job: when you sit down, every delegation in the room should know what you want and whether they can work with you. It is not a summary of the topic, which the study guide already gave everyone, and it is not your position paper read aloud. The dais is listening for two things in it: a position specific enough to be written down, and a sign that you intend to build something with other people.
        </p>
        <p>
          Later speeches respond to the room. The opening speech is the one you can write in full before the conference, which is why it is worth writing properly.
        </p>

        <H2>How many words fit</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Speaking time</th><th>Words at a clear committee pace</th><th>Aim for</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>45 seconds</strong></td><td>100 to 110</td><td>Hook, two asks, invitation</td></tr>
              <tr><td><strong>60 seconds</strong></td><td>130 to 150</td><td>The full template, one fact</td></tr>
              <tr><td><strong>75 seconds</strong></td><td>165 to 185</td><td>The full template, two facts</td></tr>
              <tr><td><strong>90 seconds</strong></td><td>200 to 220</td><td>The full template, plus the objection you expect and your answer</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">
          Based on roughly 130 to 150 words a minute. Nerves make most first-time delegates speak faster, which is why the counts are a ceiling, not a target. Many conferences default to 60 or 90 seconds; Gavelling sessions start at 90 unless the chair changes it.
        </p>
        <p>
          Write to five seconds under the speaking time. A speech cut off by the gavel ends on its weakest note, with the room watching the chair instead of you.
        </p>

        <H2>The fill-in template</H2>
        <p>
          Five slots. Fill them in this order, not the order you speak them: the position first, because everything else exists to set it up.
        </p>
        <FactCard title="1. Address (3 to 5 words)">
          &ldquo;Honourable Chair, delegates.&rdquo; That is enough. Long greetings use time the room will not remember.
        </FactCard>
        <FactCard title="2. Hook (1 sentence)">
          &ldquo;[A claim, a dated fact or a paradox about the topic that a listener could repeat].&rdquo; Not a question to the room and not &ldquo;imagine a world&rdquo;.
        </FactCard>
        <FactCard title="3. Stake (1 to 2 sentences)">
          &ldquo;For [country], this is [why it is a domestic issue, a regional issue or a matter of record].&rdquo; Why your country, specifically, is in this debate.
        </FactCard>
        <FactCard title="4. Position (2 to 4 sentences)">
          &ldquo;[Country] asks this committee to [specific action one] and [specific action two]. [Country] will not support [the thing you will vote against].&rdquo; Asks the room can write down, and one red line.
        </FactCard>
        <FactCard title="5. Invitation (1 sentence)">
          &ldquo;[Country] invites [which delegations] to [what: draft, co-sponsor, discuss] with us [when and where: the first unmoderated caucus, the back left of the room].&rdquo;
        </FactCard>
        <Callout>
          If you only have time to fix one slot, fix the invitation. A speech that names who it wants to work with, and when, is the one that sends delegates across the room to find you in the first caucus.
        </Callout>

        <H2>One speech, drafted three times</H2>
        <p>
          The committee is the World Health Assembly. The topic is antimicrobial resistance. The delegate represents Viet Nam and has 60 seconds. Below is what they wrote at each stage and what they cut.
        </p>

        <H3>Stage 1: the research notes</H3>
        <ul>
          <li>The World Health Assembly adopted a Global Action Plan on antimicrobial resistance in 2015.</li>
          <li>The UN General Assembly held a high-level meeting on antimicrobial resistance in 2024 and adopted a political declaration.</li>
          <li>Antibiotics are widely used in livestock and aquaculture across the region, and both are large sectors for Viet Nam.</li>
          <li>Antibiotics can be bought without a prescription in many pharmacies in the region.</li>
          <li>Wants: support for laboratory and surveillance capacity; a phased approach to antibiotics in farming. Will not accept: trade restrictions on food exports as an enforcement tool.</li>
        </ul>

        <H3>Stage 2: the first draft (about 190 words, too long)</H3>
        <FactCard title="First draft">
          <p>Honourable Chair, distinguished delegates, Viet Nam is honoured to address this Assembly on the important issue of antimicrobial resistance. Antimicrobial resistance is when bacteria, viruses, fungi and parasites stop responding to medicines. In 2015 this Assembly adopted the Global Action Plan, and in 2024 the General Assembly adopted a political declaration. Viet Nam has a large agriculture sector, including livestock and aquaculture, where antibiotics are used. Antibiotics are also sold without a prescription in many places. Viet Nam believes that international cooperation is essential. Viet Nam supports the Global Action Plan and believes that all member states must do more. Viet Nam supports stronger surveillance and laboratory capacity, more funding for developing countries, better regulation of pharmacies, and responsible use of antibiotics in agriculture. Viet Nam does not believe that trade measures are an appropriate tool. Viet Nam looks forward to working with all delegations on this important issue. Thank you.</p>
        </FactCard>
        <p>
          <strong>What is wrong with it.</strong> The first two sentences are a greeting and a definition the room already has. The history is true and does nothing. There are four asks, so nobody remembers any of them. &ldquo;All delegations&rdquo; is an invitation to nobody.
        </p>

        <H3>Stage 3: the structured draft (about 150 words)</H3>
        <FactCard title="Second draft">
          <p>Honourable Chair, delegates. This Assembly adopted a plan on antimicrobial resistance in 2015, and the world has spent the decade since writing more plans. For Viet Nam, this is not an abstract threat. It is in our farms, our fish ponds and our pharmacies. Viet Nam asks this committee for two things: funding for laboratory and surveillance capacity in the countries that cannot yet measure the problem, and a phased timetable for antibiotics in farming that farmers can actually meet. Viet Nam will not support using trade restrictions on food exports to enforce any of this. We invite delegations from South-East Asia and from the donor countries to draft with us. Thank you.</p>
        </FactCard>
        <p>
          <strong>What changed.</strong> The definition and the greeting went. The two dates became one sentence with an edge. Four asks became two, and the red line got its own sentence. The invitation now names two groups. Still about 10 seconds long, so one more pass.
        </p>

        <H3>Stage 4: the speech as delivered (about 125 words)</H3>
        <FactCard title="Final, 60 seconds, Viet Nam">
          <p>Honourable Chair, delegates.</p>
          <p>This Assembly adopted a plan on antimicrobial resistance in 2015. A decade later, the world has more plans than laboratories.</p>
          <p>For Viet Nam this is not abstract. It is in our farms, our fish ponds and our pharmacies.</p>
          <p>Viet Nam asks for two things. First, funding for surveillance and laboratories in the countries that cannot yet measure the problem. Second, a phased timetable for antibiotics in farming that farmers can actually meet.</p>
          <p>Viet Nam will not support trade restrictions on food exports as a way to enforce either.</p>
          <p>We invite South-East Asian and donor delegations to draft with us in the first unmoderated caucus. Thank you.</p>
        </FactCard>
        <p className="gv-note">
          The example shows the method; check every fact you use against your own research and your country&rsquo;s actual record before you say it in committee.
        </p>
        <p>
          <strong>Why it now works.</strong> The hook is quotable (&ldquo;more plans than laboratories&rdquo;). The stake is three concrete nouns. The asks are numbered, so delegates can write them down. The red line tells the room exactly which clause will cost them Viet Nam&rsquo;s vote. And the invitation has a who and a when; what you do once they arrive is in our <Link href="/blog/mun-working-paper-guide">working paper guide</Link>.
        </p>

        <H2>Adapting the template to your country</H2>
        <H3>A permanent member or a major power</H3>
        <p>
          The room assumes you are powerful, so lead with what you will give, not what you want. A concession in the opening speech costs a large delegation little and buys trust.
        </p>
        <H3>A small state</H3>
        <p>
          Your weight is your story and your vote. Make the stake slot carry the speech, then tie yourself to a bloc in the invitation: &ldquo;together with the small island developing states&rdquo;.
        </p>
        <H3>A country with an awkward record</H3>
        <p>
          If everyone knows your country&rsquo;s record on the topic, say it before someone else does, in one sentence, and turn it into a reason for your position. Ignoring it invites the first point of information.
        </p>
        <H3>A regional leader or the host region</H3>
        <p>
          Speak for the region as well as yourself, carefully: name the regional body or the neighbours you have actually coordinated with, and do not claim a common position that does not exist.
        </p>

        <H2>Speaking first, or speaking thirtieth</H2>
        <p>
          <strong>Called in the first five,</strong> deliver the speech as written. You are setting the frame others respond to, which is why getting on the list early matters; our guide to <Link href="/blog/mun-speakers-list-types">speakers lists</Link> covers how the list is opened.
        </p>
        <p>
          <strong>Called late,</strong> the room has heard your hook from someone else. Rewrite the first two slots in pencil while you wait: replace the hook with a reference to an earlier speaker (&ldquo;the delegate of Kenya is right that&hellip;&rdquo;), keep your position and invitation exactly as written, and cut the stake if you are short of time. Responding to the room is what separates a late speech from a repeated one.
        </p>

        <H2>Delivering it</H2>
        <ul>
          <li><strong>Memorise the first and last sentences.</strong> Those are the two moments you must be looking at the room.</li>
          <li><strong>Mark two pauses</strong> on your page: before the asks and before the red line.</li>
          <li><strong>Read the country name with weight.</strong> Saying it three or four times is how a forty-seat room remembers who said what.</li>
          <li><strong>Practise against a clock,</strong> once aloud, standing up. Our <Link href="/blog/mun-timer">MUN timer guide</Link> has the timing conventions and <Link href="/blog/mun-public-speaking-tips">public speaking tips</Link> covers nerves and pace.</li>
        </ul>

        <H2>The checklist before you raise your placard</H2>
        <ul className="gv-check">
          <li>Under the speaking time by about five seconds, timed aloud.</li>
          <li>No greeting longer than five words and no definition of the topic.</li>
          <li>Two asks at most, each specific enough to become an operative clause.</li>
          <li>One red line, in its own sentence.</li>
          <li>An invitation that names delegations and a time or place.</li>
          <li>Every fact checked against your <Link href="/blog/mun-position-paper-guide">position paper</Link> and <Link href="/blog/mun-country-research">country research</Link>.</li>
        </ul>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
