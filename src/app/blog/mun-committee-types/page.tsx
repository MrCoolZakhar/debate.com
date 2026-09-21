import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Model UN Committee Types Explained: Which One Should You Pick?',
  description:
    'Every kind of committee on a conference list, what debate actually feels like in each, and who it suits',
  path: '/blog/mun-committee-types',
  ogDescription: 'Every Model UN committee type, what debate feels like inside it, and who it suits.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Model UN Committee Types Explained: Which One Should You Pick?',
  description: 'Every Model UN committee type, what debate feels like inside it, and who it suits.',
  url: 'https://gavelling.com/blog/mun-committee-types',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-committee-types' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Committee Types', item: 'https://gavelling.com/blog/mun-committee-types' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-committee-types"
        pitch="Gavelling runs every committee type from one dais screen, including custom chambers where seats are party members rather than countries."
      >
        <p>A conference sends you a committee list and asks you to rank it. The names mean very little until you have sat in one. A General Assembly committee and a crisis cabinet are both called committees, but almost nothing about the two experiences is the same: the size, the pace, the paperwork and the skill being tested all differ. This guide walks the whole list, says what an hour inside each one actually feels like, and tells you who each suits. If you are drawn to reporting rather than debating, our <Link href="/blog/mun-press-corps-guide">press corps guide</Link> covers that room in full.</p>

        <H2>The one thing that decides everything: size and formality</H2>
        <p>Every committee type sits somewhere on two axes. The first is size, which controls how often you get to speak. The second is formality, which controls whether your influence comes from speeches or from conversations. A 120-delegate General Assembly is large and formal, so your speaking slots are rare and the drafting happens in corridors. A 12-person cabinet is small and informal, so you speak constantly and the paperwork is short.</p>
        <p>Almost every complaint you will hear about a committee reduces to a mismatch on one of those axes. A delegate who wanted to talk ranked a 150-seat committee first. A delegate who wanted structure ranked a crisis room first. Rank against the axes, not against the topic.</p>
        <Callout>If you only have time to research one thing before ranking, research the committee size. The conference publishes it. A room of 40 gives a good delegate roughly four to six General Speakers List slots in two days. A room of 150 gives you one or two.</Callout>

        <H2>General Assembly committees</H2>
        <p>The six main committees of the General Assembly are the default shape of <Link href="/blog/what-is-model-un">Model UN</Link>. Each one includes all 193 UN member states, so at a conference they are the biggest rooms on the list, typically 40 to 150 seats.</p>
        <ul>
          <li><strong>First Committee (DISEC)</strong>: disarmament and international security. Arms control, nuclear non-proliferation, autonomous weapons.</li>
          <li><strong>Second Committee (ECOFIN)</strong>: economic and financial. Development finance, debt, trade, food security.</li>
          <li><strong>Third Committee (SOCHUM)</strong>: social, humanitarian and cultural. Human rights, refugees, discrimination.</li>
          <li><strong>Fourth Committee (SPECPOL)</strong>: special political and decolonisation. Peacekeeping, outer space, the remaining non-self-governing territories.</li>
          <li><strong>Fifth Committee</strong>: administrative and budgetary. Rare at conferences because the subject matter is technical and the fun is not obvious.</li>
          <li><strong>Sixth Committee</strong>: legal. Treaty law, jurisdiction, the rule of law.</li>
        </ul>
        <p>What debate feels like: slow at first, then a scramble. The General Speakers List runs for a long time, most of the first session is speeches, and the real work starts in the first long unmoderated caucus when 12 people crowd around one laptop. Your resolution will be long, it will have a dozen sponsors, and it will be one of three or four papers competing. Our <Link href="/blog/mun-glossary">MUN glossary</Link> explains any term here you have not met yet.</p>
        <p>Worth knowing: General Assembly resolutions are recommendations. Under Articles 10 to 14 of the UN Charter the Assembly may discuss and recommend, but it cannot compel a member state. A good GA operative clause requests, urges, encourages or establishes a body. A GA clause that demands or authorises force is out of mandate and a sharp chair will say so.</p>
        <p><strong>Best for:</strong> delegates who write well and negotiate patiently. Also the right first committee for a beginner, because the size gives you room to watch before you commit.</p>

        <H2>ECOSOC and the specialised agencies</H2>
        <p>The Economic and Social Council has 54 members, elected by the General Assembly. Beneath it sit the functional commissions and the specialised agencies, and conferences use them to build medium-sized rooms with a sharper technical focus: the Commission on the Status of Women, the Commission on Narcotic Drugs, the World Health Organization, UNESCO, the International Labour Organization, UNEP, the IAEA Board of Governors, UNHCR.</p>
        <p>These rooms are usually 20 to 50 seats. The debate is more expert and less rhetorical. A speech that would pass in a GA committee, general and values-driven, lands flat here. A speech that names a mechanism, a funding route or a reporting requirement does well.</p>
        <p>Two quirks worth knowing. The ILO seats governments, employers and workers rather than governments alone, so a conference simulating it may allocate you a trade union rather than a state. The IAEA Board of Governors is a 35-member body with its own designation rules, so a conference using it will publish a fixed seat list that is not a normal country slate.</p>
        <p><strong>Best for:</strong> delegates who like research and want their preparation to visibly pay off. Genuinely underrated: the ratio of speaking time to delegates is much better than a GA and the awards competition is often thinner.</p>

        <H2>The Security Council</H2>
        <p>Fifteen seats: five permanent members with the veto, ten elected members serving two-year terms. On substantive matters a decision needs nine affirmative votes and no negative vote from a permanent member, under Article 27(3) of the Charter. Procedural matters need nine votes and are not subject to the veto. Decisions taken under Chapter VII bind member states, which is why the Council is the only Model UN room where the resolution you write would, in the real world, have teeth.</p>
        <p>What debate feels like: fast, conversational and personal. There is no long General Speakers List culture. Many conferences run the Council on modified procedure with near-continuous moderated caucus. You will speak many times an hour and you will be answerable for every sentence, because with fifteen people everyone remembers what you said.</p>
        <p>The veto changes the maths of the room completely. A brilliant resolution that one permanent member will not accept is worth nothing, so the whole game is finding the language that a P5 delegate can live with. Delegates who arrive planning to win a vote usually lose. Delegates who arrive planning to build a text that survives five specific objections usually do well. Our <Link href="/blog/mun-security-council-guide">Security Council guide</Link> covers veto strategy and the procedural differences in detail.</p>
        <p><strong>Best for:</strong> confident speakers who can negotiate in real time and tolerate being contradicted. A hard first committee, and a very good second one.</p>

        <H2>Regional bodies</H2>
        <p>The European Union, the African Union, ASEAN, the Organization of American States, the Arab League, NATO, CARICOM. Conferences use these for 15 to 40 seat rooms with a shared regional frame.</p>
        <p>They are not small General Assemblies, and treating them as one is the classic error. Each has its own decision rule, and the decision rule is the whole character of the room:</p>
        <ul>
          <li><strong>EU</strong>: much Council business runs on qualified majority voting, which requires both a majority of member states and a share of the Union population. A conference simulating it may weight your vote by population. Sensitive areas still run on unanimity.</li>
          <li><strong>ASEAN</strong>: consensus and non-interference, often called the ASEAN Way. One state can stop a text, and the norm against commenting on another member&rsquo;s internal affairs is real. Debate is quieter and the drafting is more careful.</li>
          <li><strong>African Union</strong>: the Peace and Security Council is a 15-member body with a regional rotation, and the AU has a doctrine of non-indifference that permits intervention in defined circumstances, which is a genuine contrast with ASEAN.</li>
          <li><strong>NATO</strong>: consensus among all allies. There is no vote to win, only an objection to remove.</li>
        </ul>
        <p>Read the conference&rsquo;s rules of procedure before you write a single clause for one of these. If the room runs on consensus, the delegate who converts the last holdout is the best delegate, and the delegate who assembles a majority has misunderstood the game.</p>

        <H2>Crisis committees and cabinets</H2>
        <p>A crisis committee is small, usually 10 to 25 seats, and you are almost never a country. You are a named person with a job: a defence minister, a general, a newspaper owner, a party leader. Debate runs in short bursts and is interrupted by crisis updates from a backroom staff who are simulating the rest of the world.</p>
        <p>The output is not a resolution. It is a stream of directives: short instructions from the committee, or private instructions from you alone using whatever powers your character actually has. Delegates who do well are the ones who send early, specific, modest directives and build on what worked. Delegates who do badly send one grand plan in hour four.</p>
        <p>If you have been assigned a crisis committee, read our <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link> for the room mechanics and then the <Link href="/blog/mun-crisis-directive-guide">directive writing guide</Link> for the paperwork itself.</p>
        <p><strong>Best for:</strong> fast improvisers who enjoy writing. Badly suited to delegates who want a fair fight, because crisis is not symmetrical: some portfolios simply have more power than others.</p>

        <H3>Joint crisis committees</H3>
        <p>Two or more crisis rooms running at once, with the actions of one changing the world of the other. A JCC on a conflict might seat two cabinets who never meet but constantly affect each other. They are the most exciting committees at most conferences and the hardest to chair, because a staff error in one room is visible in three.</p>

        <H3>Historical committees</H3>
        <p>A committee frozen at a date. Everything after that date does not exist yet, and a delegate who cites it is out of character. The best historical committees pick a moment where the real outcome was not inevitable, because a room that can only re-enact the textbook is not a debate.</p>

        <H2>Press corps</H2>
        <p>An International Press Corps or press committee does not debate. Delegates are journalists assigned to cover other committees: they sit in, interview delegates during unmoderated caucus, write articles and publish a conference paper or broadcast. Some conferences give the press real power, letting an article change what a crisis room believes.</p>
        <p>It is a genuinely different skill: writing to a deadline, getting a quote, and being fair while being sharp. If you are a strong writer who dislikes procedure, this is the committee nobody told you about.</p>

        <H2>Ad hoc, novelty and parliamentary chambers</H2>
        <p>Two categories share the bottom of most committee lists.</p>
        <p><strong>Ad hoc committees</strong> hide their topic and sometimes their character list until the conference starts. Delegates apply with a writing sample and are chosen. It is usually the hardest room at the conference and is aimed at experienced crisis delegates.</p>
        <p><strong>Parliamentary and custom chambers</strong> seat party members rather than states: a national parliament, a party conference, a constitutional convention, a corporate board. The unit is the group, not the country, so blocs are already drawn on the day you arrive and the interesting work is either holding your own bench together or splitting the other one. A conference running this shape needs software that can seat groups and crests rather than flags, which is why Gavelling supports custom committees where a seat belongs to a political group instead of a nation.</p>

        <H2>The comparison table</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Committee</th>
                <th>Typical size</th>
                <th>Procedure</th>
                <th>Output</th>
                <th>Best for</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>General Assembly</td><td>40 to 150</td><td>Standard, GSL heavy</td><td>Draft resolutions</td><td>First conference, patient writers</td></tr>
              <tr><td>ECOSOC and agencies</td><td>20 to 50</td><td>Standard, more caucus</td><td>Draft resolutions</td><td>Researchers, technical topics</td></tr>
              <tr><td>Security Council</td><td>15</td><td>Modified, near-continuous caucus</td><td>Binding resolutions</td><td>Confident negotiators</td></tr>
              <tr><td>Regional body</td><td>15 to 40</td><td>Varies: consensus or weighted vote</td><td>Communiqués, resolutions</td><td>Delegates who read the rules first</td></tr>
              <tr><td>Crisis cabinet</td><td>10 to 25</td><td>Crisis, short debate blocks</td><td>Directives</td><td>Fast improvisers, writers</td></tr>
              <tr><td>Joint crisis</td><td>2 rooms of 10 to 20</td><td>Crisis, linked</td><td>Directives</td><td>Experienced crisis delegates</td></tr>
              <tr><td>Historical</td><td>15 to 40</td><td>Either, frozen date</td><td>Depends on the body</td><td>History readers</td></tr>
              <tr><td>Press corps</td><td>8 to 20</td><td>None</td><td>Articles, broadcasts</td><td>Writers, interviewers</td></tr>
              <tr><td>Parliamentary chamber</td><td>20 to 60</td><td>Standard or bespoke</td><td>Bills, motions</td><td>Delegates who like party politics</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Sizes are the usual range at conferences, not a rule. Every conference publishes its own seat counts.</p>

        <H2>How to rank your preferences</H2>
        <FactCard title="A ranking method that works">
          Rank by room shape first, topic second, prestige never. Put the committee whose size and pace match how you like to work at the top, then break ties with the topic you would enjoy reading about for six weeks. The flagship committee is the one everyone ranks first, so ranking it first is the least likely way to get it.
        </FactCard>
        <p>Three practical points. Conferences allocate against experience as well as preference, so an honest experience answer gets you a better fit than an inflated one. A double delegation, where two people share one country, is a different experience again: you get half the speaking slots and a partner to draft with, which suits a nervous first-timer well. And if a committee is listed with a character sheet rather than a country slate, assume crisis procedure whatever the name says.</p>
        <p>Once you know the room, the preparation diverges sharply. A GA committee rewards a deep read of your country&rsquo;s <Link href="/blog/mun-country-research">voting record and stated position</Link>, a crisis cabinet rewards knowing exactly what your character can order without asking anyone. Both reward <Link href="/blog/mun-conference-preparation">arriving prepared</Link> in the specific way the room uses.</p>
        <p>If you are still choosing a conference rather than a committee, the <Link href="/conferences/explore">conference directory</Link> lists what each one is running, and the committee list tells you more about a conference than the promotional page does.</p>
      </ArticleLayout>
    </>
  );
}
