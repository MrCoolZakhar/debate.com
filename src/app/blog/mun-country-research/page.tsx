import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Research Your Country for MUN: A Method, Not a Reading List',
  description:
    'Find your country’s actual position in one evening using voting records, treaty reservations and mission statements, and take one page into committee',
  path: '/blog/mun-country-research',
  ogDescription: 'A research method that produces a position, not a pile of facts.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Research Your Country for MUN: A Method, Not a Reading List',
  description: 'A research method that produces a position, not a pile of facts.',
  url: 'https://gavelling.com/blog/mun-country-research',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-country-research' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Country Research', item: 'https://gavelling.com/blog/mun-country-research' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-country-research"
        pitch="Gavelling gives every delegate the topic, the speakers list and the committee’s documents on their own phone, so the one page you prepared is the only paper you carry."
      >
        <p>Most delegates research the country. The good ones research the position. Those are different jobs: the first produces a page of facts about population and GDP that will never be spoken aloud, the second produces three sentences you can defend under attack for two days. This is the method, in the order that works, with the primary sources that make a chair believe you.</p>

        <H2>The mistake: facts instead of a position</H2>
        <p>A <Link href="/blog/mun-country-profiles">country profile</Link> is background. A position is a claim of the form: <em>on this specific question, my government wants this outcome, for this reason, and will not accept that.</em> It is what your position paper argues, what your speech asserts and what you trade away in negotiation.</p>
        <p>You cannot derive a position from a fact sheet. Knowing that a country has a large agricultural sector does not tell you how it voted on an agricultural subsidies resolution, and the vote is what a chair can check. Start from the topic and work backwards to the country, not the other way round.</p>
        <Callout>Before you open a single tab, write the question your committee is actually deciding, in one sentence. Everything you read is then either evidence about that question or it is not, and the second category is most of the internet.</Callout>

        <H2>The profile that actually matters</H2>
        <p>Keep it to six things, each chosen because it predicts how a state votes rather than because it is interesting.</p>
        <ul>
          <li><strong>Government type and who decides foreign policy.</strong> A parliamentary democracy with a coalition, a one-party state and a monarchy make commitments differently and at different speed.</li>
          <li><strong>The economy in one line, focused on dependence.</strong> Not GDP. What does this country sell, to whom, and what would it lose if the committee acted?</li>
          <li><strong>Alliances and dependencies.</strong> Treaty alliances, major aid donors, major creditors, the two or three capitals this government does not like to surprise.</li>
          <li><strong>Region and neighbours.</strong> Including the neighbour it has a live dispute with, because that shapes votes on sovereignty and intervention far more than ideology does.</li>
          <li><strong>Domestic sensitivity on this topic.</strong> The reason a government cannot sign something even when it privately agrees.</li>
          <li><strong>UN standing.</strong> Security Council member, past or present. Major contributor to peacekeeping. Major funder. Recipient of a UN mission. Each changes the tone you take.</li>
        </ul>
        <p>Six lines. If you cannot say why a line affects a vote, delete it. For where this fits in the weeks before a conference, see the <Link href="/blog/mun-conference-preparation">pre-conference checklist</Link>.</p>

        <H2>Finding the stated position</H2>
        <p>Work down this list and stop as soon as you have something dated and quotable.</p>
        <ul>
          <li><strong>The permanent mission to the UN.</strong> Every member state has one in New York and most publish statements by committee. This is the single best source in Model UN and most delegates never open it. Search for the mission website, then look for statements or speeches filed under the committee you are in.</li>
          <li><strong>The general debate.</strong> Every September each member state speaks at the General Assembly general debate, and the statements are published. It is the clearest summary of what a government currently cares about, in its own words.</li>
          <li><strong>The foreign ministry.</strong> Press releases and statements, usually in the national language first. A machine translation of the original is more reliable than an English summary written by somebody else.</li>
          <li><strong>Meetings coverage.</strong> The UN publishes summaries of committee meetings that record what each delegation said. Search the summary for your country name and the topic, and you often find one sentence that is exactly the position.</li>
          <li><strong>Explanations of vote.</strong> When a state votes in an unexpected way it frequently explains why, on the record. These are gold, because they state the reasoning rather than just the outcome.</li>
        </ul>
        <p>Quote one of these in your opening speech, with a date, and you will be one of very few delegates in the room who has. Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> covers where in the structure it belongs.</p>

        <H2>Voting records</H2>
        <p>The <a href="https://digitallibrary.un.org">UN Digital Library</a> carries voting data for General Assembly and Security Council resolutions, with a record of how each member state voted. It is searchable by subject and by resolution symbol, and it is the fastest way to turn a vague sense of a country&rsquo;s attitude into a hard fact.</p>
        <p>How to use it without disappearing into it:</p>
        <ul>
          <li>Search the topic, not the country. Find the two or three resolutions that most resemble what your committee is debating.</li>
          <li>Open the voting record and find your country. Note the vote and the year.</li>
          <li>Note who else voted the same way. That is your bloc, evidenced rather than assumed, and it is more reliable than any list of regional groups.</li>
          <li>Look for a change over time. A country that voted against in 2005 and abstained in 2019 is a country moving, and saying so out loud is the kind of line that wins arguments.</li>
        </ul>
        <p>Abstention deserves attention. In UN practice abstaining is a substantive act, not an absence: it usually signals agreement with the goal and objection to a mechanism, or an unwillingness to break with a partner. If your country habitually abstains on a class of resolutions, that is your position and you should be able to say what the objection is.</p>

        <H2>Treaties, ratifications and reservations</H2>
        <p>The <a href="https://treaties.un.org">UN Treaty Collection</a> publishes the status of multilateral treaties deposited with the Secretary-General: who has signed, who has ratified, when, and crucially what reservations and declarations they entered.</p>
        <p>Three states to distinguish, because delegates routinely confuse them:</p>
        <FactCard title="Signed, ratified, reserved">
          <p><strong>Signed</strong> means the state has indicated intent and, under the law of treaties, should not defeat the treaty&rsquo;s object and purpose. It is not yet bound.</p>
          <p><strong>Ratified or acceded</strong> means the state has consented to be bound and the treaty applies to it.</p>
          <p><strong>Reservation</strong> means the state has ratified while excluding or modifying the effect of specific articles for itself. This is very often the entire position.</p>
        </FactCard>
        <p>A reservation is the most useful single artefact in country research, because it is a government saying precisely which part of an agreed text it will not accept, in formal language, on the record. If your country has entered a reservation to the treaty your committee is building on, your speech writes itself: we support the framework, we have stated our position on article X, and any operative clause that reopens it will not carry our vote.</p>
        <p>Also worth checking: whether the state has accepted the optional protocols, whether it recognises the jurisdiction of the relevant court or committee, and whether it files its periodic reports on time. A state that ratified and then never reported is telling you something.</p>

        <H2>Blocs and groupings</H2>
        <p>Group membership is a constraint on your position, not a substitute for it. Know which ones apply.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Group</th><th>Roughly</th><th>What membership implies</th></tr></thead>
            <tbody>
              <tr><td>Group of 77 and China</td><td>More than 130 members</td><td>Developing-country coordination, especially on finance, development and technology transfer. Often negotiates as one bloc and speaks with one voice in economic committees.</td></tr>
              <tr><td>Non-Aligned Movement</td><td>Around 120 members</td><td>Sovereignty, non-intervention, scepticism about unilateral coercive measures.</td></tr>
              <tr><td>European Union</td><td>27 members</td><td>Frequently a coordinated position agreed in advance. An EU member that breaks the common line should have a reason.</td></tr>
              <tr><td>African Group</td><td>54 members</td><td>Strong regional coordination, and an AU position often exists before the UN debate does.</td></tr>
              <tr><td>Organisation of Islamic Cooperation</td><td>57 members</td><td>Coordinated positions on specific files, cutting across regions.</td></tr>
              <tr><td>Small island states</td><td>Varies by list</td><td>Climate, sea level, oceans. The most cohesive voting bloc in the General Assembly on its own issues.</td></tr>
              <tr><td>Least developed countries</td><td>Varies, list maintained by the UN</td><td>Special treatment, financing, graduation criteria.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two cautions. Membership overlaps: a country can be in the G77, the NAM, the African Group and the OIC at once, and those groups do not always agree. And a group position is a floor, not a ceiling: knowing your bloc tells you what you cannot say, while research tells you what you can. Our guide to <Link href="/blog/mun-bloc-building">bloc building</Link> covers what to do with that in the room.</p>

        <H2>When there is genuinely no stated position</H2>
        <p>This happens often, especially for small states on technical topics. Do not invent a quotation. Reason openly from three things, in this order:</p>
        <ul>
          <li><strong>Precedent.</strong> How has this state voted on the nearest comparable question? That is the best available evidence and it is checkable.</li>
          <li><strong>Interest.</strong> What does it gain or lose? Trade, aid, security, migration, a border, a fishery.</li>
          <li><strong>Group.</strong> What did its regional or political group agree? Absent anything else, most states follow the group.</li>
        </ul>
        <p>Then say so honestly in committee if challenged. &ldquo;My government has not issued a statement on this specific question. Our vote on the 2019 resolution and our membership of the African Group make our position clear&rdquo; is a strong answer. Inventing a foreign ministry quote is the one research failure that a chair who knows the file will actually punish.</p>

        <H2>Representing a country you find uncomfortable</H2>
        <p>You will be assigned governments whose conduct you disagree with. The job is to represent the position accurately, which is a scholarly exercise, not an endorsement. Three rules that keep it honest:</p>
        <ul>
          <li>Argue the government&rsquo;s stated case, using the government&rsquo;s stated reasons. Do not improve it and do not invent a moral justification it has never offered.</li>
          <li>Do not use the position as licence for language that would be unacceptable from you personally. The distinction between representing a state and insulting people in the room is not a fine one.</li>
          <li>If a topic touches something that would genuinely distress you to argue, tell your faculty advisor or the conference before the weekend. Good conferences would rather reallocate than have it go wrong in session.</li>
        </ul>

        <H2>Sources, ranked by how much a chair trusts them</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Tier</th><th>Source</th><th>Use it for</th></tr></thead>
            <tbody>
              <tr><td>Primary</td><td>UN voting records, treaty status and reservations, mission statements, general debate speeches, explanations of vote</td><td>Anything you will be challenged on. Cite these.</td></tr>
              <tr><td>Primary</td><td>Government and foreign ministry publications, national legislation</td><td>Domestic constraints and stated policy.</td></tr>
              <tr><td>Strong secondary</td><td>UN agency reports, treaty body and review documentation, World Bank and IMF data</td><td>Facts about the situation, and figures you can quote.</td></tr>
              <tr><td>Useful</td><td>Serious think tanks and academic articles</td><td>Framing an argument and finding the debate&rsquo;s fault lines.</td></tr>
              <tr><td>Context only</td><td>Quality news reporting</td><td>What has happened recently. Never the basis of a claimed position.</td></tr>
              <tr><td>Starting point only</td><td>Encyclopaedias and country fact books</td><td>Orientation. Never cite them in committee.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Record the date and the document reference for anything you intend to quote. &ldquo;A 2019 resolution&rdquo; is weak. A resolution number and a vote count is not.</p>

        <H2>The one page you take into committee</H2>
        <p>Everything above compresses into a single sheet. If it does not fit on one side, you have not finished thinking.</p>
        <FactCard title="The committee sheet">
          <p><strong>Line 1.</strong> Our position in one sentence.</p>
          <p><strong>Line 2.</strong> The two things we want in the resolution.</p>
          <p><strong>Line 3.</strong> The one clause we will vote against, and why.</p>
          <p><strong>Four facts</strong>, each with a date and a source, that we can quote out loud.</p>
          <p><strong>Our vote</strong> on the nearest comparable resolution, and who voted with us.</p>
          <p><strong>Three likely allies</strong> and one likely opponent, by country.</p>
          <p><strong>Two questions</strong> we intend to ask other delegates.</p>
          <p><strong>Our fallback:</strong> what we accept if we cannot get line 2.</p>
        </FactCard>
        <p>That last line is the one experienced delegates fill in and beginners leave blank. Deciding your concession in advance, in a quiet room, is much better than deciding it at 4pm in a corridor while three people are talking at you. Our <Link href="/blog/mun-negotiation-tactics">negotiation guide</Link> covers what to do with it in the room.</p>

        <H3>The evening, in order</H3>
        <ul className="gv-check">
          <li>Write the question the committee is deciding.</li>
          <li>Six-line country profile, every line tied to a vote.</li>
          <li>Find two comparable resolutions and your country&rsquo;s vote on each.</li>
          <li>Check treaty status and any reservation on the relevant instrument.</li>
          <li>Find one mission or ministry statement, with a date.</li>
          <li>List your groups and what they constrain.</li>
          <li>Write the position sentence, the two asks, the red line and the fallback.</li>
          <li>Compress to one page.</li>
        </ul>
        <p>That sheet is also the skeleton of your position paper, which is why doing the research properly makes the writing fast rather than slow. Our <Link href="/blog/mun-position-paper-guide">position paper guide</Link> covers the format, the <Link href="/blog/mun-position-paper-examples">position paper examples</Link> show it filled in, and the <Link href="/blog/mun-common-mistakes">common mistakes guide</Link> lists the research errors chairs see every weekend, most of which this method removes.</p>
      </ArticleLayout>
    </>
  );
}
