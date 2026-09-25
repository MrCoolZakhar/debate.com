import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Speech Examples: Twelve Speeches, Under a Minute Each',
  description:
    'Full worked speeches for the opening, the caucus, the vote, the reply and the close, with the timing marks and why each one works',
  path: '/blog/mun-speech-examples',
  ogDescription: 'Twelve full Model UN speeches, each under a minute, with why each one works.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Speech Examples: Twelve Speeches, Under a Minute Each',
  description: 'Twelve full Model UN speeches, each under a minute, with why each one works.',
  url: 'https://gavelling.com/blog/mun-speech-examples',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-speech-examples' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Speech Examples', item: 'https://gavelling.com/blog/mun-speech-examples' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-speech-examples"
        pitch="Gavelling shows every delegate their place in the speakers list on their own phone, so you know how long you have to write the speech you are about to give."
      >
        <p>You are third on the <Link href="/blog/general-speakers-list-guide">speakers list</Link> with ninety seconds to prepare. That is the real problem this page solves. Below are twelve complete speeches across the five situations you will actually face, each written to a stated length, each followed by the reason it works. The topic throughout is a General Assembly debate on access to safe drinking water and sanitation, so you can see the same material handled five different ways. Square brackets mark where your own research goes.</p>

        <H2>The four speech shapes</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Shape</th><th>Where</th><th>Job</th><th>Usual length</th></tr></thead>
            <tbody>
              <tr><td>Position</td><td>Opening GSL speech</td><td>State who you are and what you want</td><td>60 to 90 seconds</td></tr>
              <tr><td>Contribution</td><td>Moderated caucus</td><td>Add one idea to a narrow question</td><td>30 to 60 seconds</td></tr>
              <tr><td>Persuasion</td><td>Before a vote, or late GSL</td><td>Move undecided delegations</td><td>45 to 90 seconds</td></tr>
              <tr><td>Response</td><td>After an attack, or a point of information</td><td>Answer without conceding</td><td>20 to 45 seconds</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Almost every bad speech is a shape error: a contribution delivered as a position speech, so the delegate restates their introduction for the fourth time, or a persuasion speech that never asks anyone for anything.</p>

        <H2>Opening speeches: three at three lengths</H2>
        <p>The opening speech is judged on whether the room now knows what you want. It is not judged on how much of your research you managed to fit in. Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> has the four-part structure; these are three worked examples of it.</p>

        <FactCard title="Opening, 60 seconds, Kenya">
          <p>Honourable Chair, distinguished delegates.</p>
          <p>Kenya speaks today for the households in our arid counties who walk for water that is not safe when they reach it. This is not a distant problem for my delegation. It is a daily one.</p>
          <p>Kenya holds that this committee must do three things. First, treat water infrastructure as a financing question, not a goodwill question. Second, recognise that groundwater management across borders needs coordination that does not currently exist. Third, keep the delivery of water services in public hands and accountable to the communities they serve.</p>
          <p>Kenya voted in favour of the resolutions that recognised this right, and we will support a text that funds it. We will not support a text that recommends privatisation as a condition of assistance.</p>
          <p>Kenya invites delegations working on financing mechanisms to speak with us in the first unmoderated caucus. Thank you.</p>
        </FactCard>
        <p className="gv-note">About 145 words. At a comfortable delivery pace of roughly 140 words a minute that is a little over 60 seconds, so trim one sentence if your conference is strict.</p>
        <p><strong>Why it works.</strong> A concrete image in the first ten seconds, which buys attention. Three numbered asks, so the room can write them down. A stated red line, which is the sentence that makes other delegations come and find you. And an explicit invitation with a time and a place, which is the single most underused line in Model UN.</p>

        <FactCard title="Opening, 75 seconds, Germany">
          <p>Honourable Chair.</p>
          <p>Germany begins from an uncomfortable fact: the international community has repeatedly recognised this right and has repeatedly failed to finance it. Recognition is not the gap. Delivery is.</p>
          <p>My delegation therefore proposes that this committee focus on three mechanisms rather than three declarations.</p>
          <p>One: blended finance. Public guarantees that make municipal water projects investable, structured through existing development banks rather than a new fund this Assembly cannot capitalise.</p>
          <p>Two: technical capacity. Germany has supported utility management programmes in [region], and we would support an expanded programme under the relevant agency.</p>
          <p>Three: measurement. A resolution that cannot be monitored will be reported as a success by everybody. Germany will sponsor any clause that requires disaggregated reporting on service quality, not merely on coverage.</p>
          <p>Germany is ready to work with delegations from every region on a text that is short, funded and measurable. We are not interested in a fourth declaration. Thank you.</p>
        </FactCard>
        <p><strong>Why it works.</strong> It opens with a claim rather than a greeting, so the room looks up. The three points are mechanisms, which is what a developed-country delegation is actually offering. It rejects something specific, which gives the speech an edge without attacking anyone. And the last line is quotable, which is how you get cited by other delegates.</p>

        <FactCard title="Opening, 90 seconds, Brazil">
          <p>Honourable Chair, fellow delegates.</p>
          <p>Brazil holds about 12 per cent of the world&rsquo;s fresh water and still has citizens without a safe supply. That is the paradox this committee should sit with, because it tells us the problem is not scarcity. It is investment, governance and distance.</p>
          <p>Brazil brings three positions to this debate.</p>
          <p>First, on finance. Middle-income countries are the majority of the affected population and are routinely excluded from concessional financing because our national averages look adequate. Brazil asks that any financing clause in this resolution use sub-national indicators.</p>
          <p>Second, on sanitation. This committee will spend most of its time on drinking water, because water is easier to talk about. Sanitation is where the disease burden sits and where investment is weakest. Brazil will move a caucus on it.</p>
          <p>Third, on governance. Brazil supports the principle that water services remain publicly accountable, and we recognise that many delegations here operate mixed models. We do not intend to make that a condition of cooperation.</p>
          <p>Brazil is drafting with delegations from across the Americas and welcomes co-sponsors from any region. We will be at the back of the room. Thank you.</p>
        </FactCard>
        <p><strong>Why it works.</strong> A paradox rather than a statistic, which is harder to forget. It names the thing the committee will neglect and commits to raising it, which sets up its own caucus. It concedes something, which costs nothing and makes the delegation look like a partner. And it ends with a physical location, which sounds trivial and materially increases how many people come to you.</p>
        <Callout>Three things belong in every opening speech and most delegates include none of them: one ask the room can write down, one thing you will not accept, and one instruction about how to find you.</Callout>

        <H2>Moderated caucus speeches: the same sub-topic, three angles</H2>
        <p>Caucus topic: <em>financing mechanisms for rural water infrastructure</em>. Forty-five seconds each. The rule here is one idea, stated, defended, and offered to the room.</p>

        <FactCard title="Caucus, the mechanism angle, India">
          <p>India will be concrete. A global fund is the wrong instrument for this problem, because the money is not the constraint in most of our districts. Absorption is.</p>
          <p>India has built water supply at scale through a national mission with district-level implementation and central transfers tied to verified connections, not to plans. The lesson is that financing works when it pays on delivery.</p>
          <p>India proposes that the operative clause on finance require results-based disbursement through existing national programmes, rather than establishing a new facility this committee cannot fund. Delegates drafting the financing section should speak with India, and we are happy to provide the clause language.</p>
        </FactCard>

        <FactCard title="Caucus, the equity angle, Bangladesh">
          <p>Thank you, Chair. Bangladesh accepts the previous delegate&rsquo;s point about absorption and would add a condition to it.</p>
          <p>Results-based financing rewards the districts that are easiest to serve. The last ten per cent of any population is the most expensive to reach, and a mechanism that pays per connection will systematically leave them last.</p>
          <p>Bangladesh therefore asks that any results-based clause carry a weighting for hard-to-reach populations, and that reporting be disaggregated so this committee can see whether the last ten per cent moved at all.</p>
          <p>We are not opposing the mechanism. We are asking that it be built so it does not fail the people it was written for. Thank you.</p>
        </FactCard>

        <FactCard title="Caucus, the blocking angle, Russian Federation">
          <p>Chair, the Russian Federation has listened carefully and has a concern about the direction of this caucus.</p>
          <p>Two delegations have now proposed conditions attached to disbursement. Conditionality of that kind is a matter for the institutions that lend, not for this Assembly, and this committee has no mandate to instruct them.</p>
          <p>The Russian Federation will support a text that encourages assistance, that respects the right of states to choose their own delivery model, and that does not create new reporting obligations on sovereign budgets.</p>
          <p>We say this now rather than at the vote so that the sponsors can take it into account while there is still time.</p>
        </FactCard>
        <p><strong>Why the three work together.</strong> The first brings a mechanism. The second improves it, which is how you get named as a co-sponsor. The third objects early and says why, which is more useful than objecting at the vote. None of the three restates their country&rsquo;s general position: the caucus topic is narrow and the speeches stay inside it, which is the discipline most delegates lack. Our guide on <Link href="/blog/how-to-run-moderated-caucus">how a moderated caucus runs</Link> covers the chair&rsquo;s side of the same exchange.</p>

        <H2>The speech before a vote</H2>
        <p>The job changes completely here. You are not explaining your position. You are moving a specific group of undecided delegations. Name them, give them a reason and give them a way to say yes. Our <Link href="/blog/mun-negotiation-tactics">negotiation guide</Link> covers the conversations around it.</p>
        <FactCard title="Persuasion, 60 seconds, sponsor of the draft">
          <p>Chair, delegates, this vote is narrower than it looks.</p>
          <p>Every delegation in this room agrees that safe water is a right. The question in front of us is whether we send a text that funds it or a text that restates it.</p>
          <p>To the delegations still deciding: we have heard three objections and we have answered all three. On conditionality, clause 6 was amended to remove the requirement. On new institutions, we struck the proposed fund and routed the work through existing agencies. On reporting burden, clause 9 now uses data that member states already submit.</p>
          <p>We have moved. This draft is not the one we wrote on Friday, and it is better for it.</p>
          <p>If your concern is not on that list, tell us in the next two minutes and we will address it on the floor. If it is, we would ask for your vote. Thank you.</p>
        </FactCard>
        <p><strong>Why it works.</strong> It narrows the question, which is the whole art of a pre-vote speech. It lists concessions with clause numbers, which is checkable and therefore credible. And it closes with an actual request, which many delegates forget to make.</p>

        <H2>The response speech</H2>
        <p>Someone has attacked your position, your country&rsquo;s record, or your draft. You have thirty seconds and the room is watching how you take it, not only what you say.</p>
        <FactCard title="Response to a policy attack, 30 seconds">
          <p>Chair, the previous delegate characterised our position as a refusal to fund. That is not our position and the record does not support it.</p>
          <p>We have funded. What we have declined is a mechanism that would route that funding through a new institution with no capitalisation and no mandate.</p>
          <p>We are happy to discuss the mechanism. We would ask that delegations argue with what we have said rather than with a version that is easier to oppose. Thank you.</p>
        </FactCard>
        <p><strong>Why it works.</strong> It corrects, restates the actual position and reframes, in one move. No sarcasm and no escalation. Save the <Link href="/blog/mun-right-of-reply">right of reply</Link> for a genuine misrepresentation of your country, not for a policy disagreement: chairs notice the difference.</p>

        <H2>The closing speech</H2>
        <p>Short, generous and about the committee rather than about you. Under thirty seconds is correct.</p>
        <ChairScript>&ldquo;Chair, this delegation arrived with three priorities and leaves with two of them in the text. That is what negotiation looks like. We thank the sponsors for taking our amendment on sanitation, we thank the delegations that disagreed with us for doing so plainly, and we thank the dais for their patience with this committee. Ghana is proud to have voted in favour. Thank you.&rdquo;</ChairScript>
        <p>Do not use the closing speech to relitigate the vote you lost, and do not thank people by name in a way that excludes the room. Chairs remember graciousness after a defeat more than they remember the defeat.</p>

        <H2>Answering a point of information</H2>
        <p>On circuits that use <Link href="/blog/mun-points-explained">points of information</Link>, a delegate may question you directly after your speech. The rules for answering are simple and almost nobody follows them.</p>
        <FactCard title="A question answered well">
          <p><em>Question:</em> &ldquo;Does the delegate not accept that their own country has failed to meet the target it is now asking others to adopt?&rdquo;</p>
          <p><em>Answer:</em> &ldquo;We do accept it. Our coverage is below where it should be and our last national report says so. That is precisely why we are asking this committee for a reporting standard rather than a pledge: we want to be measured too. Thank you.&rdquo;</p>
        </FactCard>
        <p><strong>Why it works.</strong> It concedes the true part immediately, which removes the attack, and then converts the concession into the argument. Answer in two sentences. Do not make a second speech, do not say &ldquo;that is a very good question&rdquo;, and never say &ldquo;I will address that later&rdquo;.</p>

        <H2>The same content at 30, 60 and 90 seconds</H2>
        <p>Length does not change what you say: it changes how much evidence you carry. Here is one argument at three lengths.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Length</th><th>What fits</th><th>Cut first</th></tr></thead>
            <tbody>
              <tr><td>30 seconds</td><td>The claim and the ask. One sentence each.</td><td>Everything else, including the greeting beyond &ldquo;Chair&rdquo;.</td></tr>
              <tr><td>60 seconds</td><td>Claim, one piece of evidence, the ask, and who you want to talk to.</td><td>The second example, the history, the adjectives.</td></tr>
              <tr><td>90 seconds</td><td>Claim, two pieces of evidence, the objection you expect and its answer, the ask, the invitation.</td><td>Background the room already has from the study guide.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <FactCard title="Thirty seconds">
          <p>Chair. Sanitation carries the disease burden and receives the smaller share of investment. Kenya asks that the financing clause set a floor for sanitation rather than folding it into a single water figure. We will move a caucus on it and we would welcome co-sponsors. Thank you.</p>
        </FactCard>
        <p>That is a complete speech. If your ninety-second speech does not contain those four sentences, it is not longer. It is padded.</p>

        <H2>Moves that work, and three that do not</H2>
        <p><strong>Work:</strong> naming a delegation you agree with, because it builds a bloc in public. Quoting a dated primary source, because almost nobody does. Conceding one point before arguing, because it makes the rest credible. Ending with an instruction: send me a note, second my motion, meet me at the back.</p>
        <p><strong>Do not work, reliably:</strong></p>
        <ul>
          <li><strong>The rhetorical opening about humanity.</strong> &ldquo;Fellow delegates, imagine a child who has no water.&rdquo; Every committee hears it four times in the first hour and stops listening by the second.</li>
          <li><strong>The unsourced statistic.</strong> A number with no year and no source invites a question you cannot answer. Either cite it properly or make the point without it.</li>
          <li><strong>Mocking another delegation.</strong> It plays well with the three people already on your side and costs you everyone else, including the dais.</li>
        </ul>

        <H2>Writing a speech in ninety seconds</H2>
        <p>You are on the list, three speakers out. Write four lines on paper, not sentences:</p>
        <ul>
          <li><strong>Line 1, the claim.</strong> One sentence, the thing you want the room to remember.</li>
          <li><strong>Line 2, the evidence.</strong> One fact, with its date, from your research sheet.</li>
          <li><strong>Line 3, the ask.</strong> What you want in the text, or what you want other delegates to do.</li>
          <li><strong>Line 4, the hook.</strong> Where to find you, or the motion you are about to raise.</li>
        </ul>
        <p>Then speak from those four lines rather than reading. A speech delivered from four prompts sounds like thinking and a speech read from a paragraph sounds like reading, and the difference is obvious from the dais. If you want to work on the delivery rather than the content, our <Link href="/blog/mun-public-speaking-tips">public speaking guide</Link> covers pace, nerves and what to do with your hands.</p>
        <p className="gv-note">Timings in this guide assume roughly 130 to 150 words a minute, which is a clear committee pace. Read your own speech aloud once with a clock before you trust the word count.</p>
      </ArticleLayout>
    </>
  );
}
