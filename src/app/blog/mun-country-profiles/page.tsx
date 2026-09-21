import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Country Profiles: Policy Briefs for 20 Commonly Assigned Countries',
  description:
    'A one-screen policy brief for the countries assigned most often, plus the blank template to build one for any delegation you are given',
  path: '/blog/mun-country-profiles',
  ogDescription: 'Policy briefs for the twenty countries MUN delegates are assigned most often.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Country Profiles: Policy Briefs for 20 Commonly Assigned Countries',
  description: 'One-screen policy briefs for the most commonly assigned Model UN countries, and a template for any other.',
  url: 'https://gavelling.com/blog/mun-country-profiles',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-country-profiles' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Country Profiles', item: 'https://gavelling.com/blog/mun-country-profiles' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-country-profiles"
        pitch="Test the position in a practice committee before the conference. Gavelling gives your club a full session for free, in a browser."
      >
        <p>A country brief is a starting point, not an answer. It tells you the shape of a delegation&apos;s politics so that you can read its actual voting record and its actual statements faster and know what you are looking at. Below are one-screen briefs for the twenty countries most often handed out at school and university conferences, and the template to build one for anything else.</p>

        <H2>How to use a brief</H2>
        <p>Read the brief, then go and check it against the primary sources for your topic, using our <Link href="/blog/mun-country-research">country research method</Link>. A brief is general, and every committee is specific. A country that is broadly sceptical of intervention may still have voted for a particular mandate, and that vote is what your chair will hold you to.</p>
        <ul className="gv-check">
          <li>Find your country&apos;s votes on the last few General Assembly resolutions in your topic area, in the UN Digital Library</li>
          <li>Find its last statement in the relevant committee or in the general debate, on its permanent mission website</li>
          <li>Note the bloc statements it signed, which usually matter more than its own words for a smaller delegation</li>
          <li>Write down one thing it will never agree to, one thing it wants, and one thing it will trade</li>
        </ul>
        <p className="gv-note">Positions below reflect the broad, long-running stance of each delegation as of September 2026. Governments change and so do positions. Always verify against the current record before you write your position paper.</p>

        <H2>The template, explained</H2>
        <p>Every brief here uses the same eight fields. Use it for any delegation you are given, and it will fit on one side of paper, which is the point: a brief you cannot glance at during a caucus is a document, not a tool.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Field</th><th>What goes in it</th></tr></thead>
            <tbody>
              <tr><td>Government</td><td>System, current orientation, and how much the executive controls foreign policy</td></tr>
              <tr><td>Economy</td><td>What it exports, what it depends on, and therefore what it will protect</td></tr>
              <tr><td>Blocs</td><td>Formal memberships: regional groups, G77, NAM, OIC, EU, AU, OPEC, Commonwealth</td></tr>
              <tr><td>Standing positions</td><td>Two or three things it says in almost every committee</td></tr>
              <tr><td>Red lines</td><td>What it will never accept, regardless of the topic</td></tr>
              <tr><td>Typical allies</td><td>Who it co-sponsors with</td></tr>
              <tr><td>Typical opponents</td><td>Who it votes against, and on what</td></tr>
              <tr><td>What it can trade</td><td>The thing it will concede for something it wants more</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <Callout>The two fields that win committees are the last two. Every delegate knows what their country believes. Very few arrive knowing what it is willing to give up, and that is the entire content of a negotiation.</Callout>

        <H2>The permanent five</H2>
        <H3>United States</H3>
        <p>Large economy, decisive executive role in foreign policy, the largest assessed contributor to the UN budget. Standing positions: freedom of navigation, counter-proliferation, market-led development, alliance commitments. Red lines: anything constraining the veto, anything asserting jurisdiction over its nationals, and language it reads as singling out Israel. Allies: United Kingdom, France, Japan, South Korea, Australia, Israel. Opponents: Russia, China, Iran, DPRK. Can trade: funding and technical assistance, generously, for language it can live with.</p>
        <H3>United Kingdom</H3>
        <p>P5 with a veto it uses rarely. Standing positions: rules-based international order, sanctions regimes, humanitarian access, climate finance, human rights mechanisms. Red lines: veto abolition, and sovereignty language touching its overseas territories. Allies: United States, France, EU states, Commonwealth partners. Opponents: Russia on most Council business. Can trade: development financing and drafting help, and it is one of the most effective penholders in the Council.</p>
        <H3>France</H3>
        <p>P5, EU leader, deeply engaged in francophone Africa. Standing positions: multilateralism, climate under the Paris framework, cultural and linguistic diversity, peacekeeping. Notably has promoted voluntary veto restraint in mass atrocity situations, jointly with Mexico. Red lines: anything weakening the EU&apos;s room to act, or its own strategic independence. Allies: Germany, EU states, United Kingdom, United States. Opponents: Russia. Can trade: support for regional initiatives in exchange for climate and francophone commitments.</p>
        <H3>Russia</H3>
        <p>P5, uses the veto more readily than any other member. Standing positions: sovereignty and non-intervention, opposition to country-specific human rights resolutions, scepticism of unilateral sanctions, criticism of NATO expansion. Red lines: any mandate authorising force without its consent, anything it reads as regime change, Ukraine-related language. Allies: shifting, often Belarus, Syria, and abstaining states in the global south. Opponents: NATO members. Can trade: abstention rather than veto, which is its real currency in committee.</p>
        <H3>China</H3>
        <p>P5, second largest assessed contributor, the largest troop contributor among the P5 to peacekeeping. Standing positions: non-interference, sovereignty, development before conditionality, South-South cooperation, infrastructure investment. Red lines: any reference to Taiwan, Tibet, Hong Kong or Xinjiang as international matters; any human rights mechanism framed as country-specific. Allies: Russia, Pakistan, many G77 states. Opponents: United States on trade, technology and security. Can trade: finance and infrastructure, for language that stays non-binding.</p>

        <H2>The G4 and other major powers</H2>
        <H3>Germany</H3>
        <p>Large economy, major donor, EU anchor, candidate for a permanent Council seat through the G4. Standing positions: multilateralism, climate ambition, development assistance, rule of law, disarmament. Red lines: dilution of EU positions. Allies: France, EU states, Japan, India and Brazil on Council reform. Opponents: rarely direct. Can trade: funding, and a reputation for compromise text that other blocs will accept.</p>
        <H3>Japan</H3>
        <p>Major funder of the UN system, G4 member, constitutionally restrained on the use of force. Standing positions: nuclear disarmament and non-proliferation, human security, development in Asia, disaster risk reduction, Council reform. Red lines: anything legitimising DPRK nuclear status. Allies: United States, Germany, India, Brazil, ASEAN states. Opponents: DPRK, and friction with China and Russia. Can trade: development finance and technical expertise.</p>
        <H3>India</H3>
        <p>Very large developing economy, non-alignment tradition, one of the largest contributors of peacekeeping troops historically, G4 member. Standing positions: strategic autonomy, common but differentiated responsibilities on climate, development and technology transfer, reform of the Council and the international financial institutions. Red lines: any internationalisation of Kashmir, any binding emissions cap that ignores historical responsibility. Allies: G77, Brazil, South Africa, Japan and Germany on reform. Opponents: Pakistan. Can trade: significant, since it sits between blocs by design.</p>
        <H3>Brazil</H3>
        <p>Regional leader, agricultural export power, G4 member, long tradition of mediation and of speaking first in the General Assembly general debate. Standing positions: multilateralism, climate finance and adaptation funding for developing states, sovereignty over the Amazon, reform of global governance, nuclear disarmament. Red lines: external conditionality on Amazon policy. Allies: India, South Africa, Latin American neighbours, G77. Opponents: few fixed. Can trade: a bridge role between north and south, which is its main asset in committee.</p>

        <H2>Africa</H2>
        <H3>South Africa</H3>
        <p>African Union heavyweight whose foreign policy is shaped by the anti-apartheid struggle. Standing positions: Council reform on the African Union&apos;s terms, anti-racism, Palestinian self-determination, development finance, nuclear disarmament as the only state to have given up a weapons programme voluntarily. Red lines: anything read as neo-colonial conditionality. Allies: AU states, India, Brazil, G77. Opponents: rarely permanent. Can trade: AU consensus, which is worth a great deal to anyone counting votes.</p>
        <H3>Nigeria</H3>
        <p>Africa&apos;s largest population and one of its largest economies, oil-dependent, an ECOWAS leader and a long-standing peacekeeping contributor. Standing positions: African solutions to African problems, counterterrorism and Lake Chad security, Council reform, development financing, migration framed as a development issue. Red lines: external interference in domestic security policy. Allies: ECOWAS, AU, G77. Opponents: few fixed. Can trade: regional leadership and troops.</p>
        <H3>Egypt</H3>
        <p>Sits in both the African Union and the Arab League, with a security-first foreign policy. Standing positions: sovereignty and non-interference, counterterrorism, Nile water security, Palestinian statehood, Suez and maritime security, opposition to intervention. Red lines: anything affecting Nile flows, anything constraining its control of its border with Gaza. Allies: Arab League, AU states, Gulf partners. Opponents: varies by file. Can trade: regional mediation, which it offers often.</p>
        <H3>Kenya</H3>
        <p>East African hub, one of the world&apos;s larger refugee-hosting states, active in regional peace operations. Standing positions: climate adaptation finance, refugee burden-sharing, regional stabilisation in the Horn, Council reform through the AU position, sustainable development. Red lines: unfunded obligations on refugee hosting. Allies: East African Community, AU, G77. Opponents: few. Can trade: credibility on implementation, having hosted large operations itself.</p>

        <H2>The Middle East</H2>
        <H3>Saudi Arabia</H3>
        <p>Major oil exporter, OPEC and Gulf Cooperation Council leader, influential in the Organisation of Islamic Cooperation. Standing positions: energy market stability, economic diversification, Islamic solidarity, regional security, sovereignty in human rights matters. Red lines: external comment on its domestic legal system, and language it reads as favouring Iran. Allies: GCC, OIC, Arab League. Opponents: Iran. Can trade: financing, which it deploys readily.</p>
        <H3>Iran</H3>
        <p>Operates under extensive sanctions, an NPT party with a contested nuclear programme, active across the region. Standing positions: opposition to unilateral sanctions, the right to peaceful nuclear technology, sovereignty, opposition to Israel, non-alignment. Red lines: any restriction framed as targeting Iran specifically, any recognition language on Israel. Allies: Russia to a degree, NAM and OIC states. Opponents: United States, Israel, Saudi Arabia. Can trade: participation itself, which is often what is being sought.</p>
        <H3>Turkey</H3>
        <p>NATO member, hosts one of the largest refugee populations in the world, positioned between Europe and the Middle East. Standing positions: refugee burden-sharing, humanitarian aid, criticism of the Council&apos;s structure on the grounds that the world is larger than five, mediation, regional trade. Red lines: Kurdish political questions, Cyprus. Allies: variable and issue-specific, which is deliberate. Opponents: shifting. Can trade: transit, mediation and hosting, all of which it uses as leverage.</p>

        <H2>Asia-Pacific and the Americas</H2>
        <H3>Indonesia</H3>
        <p>The world&apos;s largest Muslim-majority population, an ASEAN leader and a founder of the Non-Aligned Movement. Standing positions: non-interference and consensus decision-making, maritime security and the law of the sea, development, moderate multilateralism, peacekeeping contributions. Red lines: intervention in internal affairs, especially on regional questions. Allies: ASEAN, NAM, OIC, G77. Opponents: few fixed. Can trade: the ASEAN bloc position, which moves as one.</p>
        <H3>Australia</H3>
        <p>Middle power, close US ally, deeply engaged in the Pacific. Standing positions: rules-based order, law of the sea, Pacific island partnerships including on climate adaptation, trade liberalisation, humanitarian assistance. Red lines: nothing that undermines its alliance commitments. Allies: United States, United Kingdom, Japan, New Zealand, Pacific states. Opponents: rarely permanent. Can trade: aid and technical assistance in the Pacific.</p>
        <H3>Canada</H3>
        <p>Middle power with a strong multilateral tradition and a peacekeeping legacy, and the country behind the commission that produced the responsibility to protect. Standing positions: human rights, gender equality in international policy, refugee resettlement, rule of law, trade. Red lines: little that is absolute. Allies: United States, European states, Commonwealth and Francophonie. Opponents: rare. Can trade: drafting, funding and a willingness to chair difficult processes.</p>
        <H3>Mexico</H3>
        <p>Large middle power with a strong non-intervention tradition and an active disarmament record, including early support for a nuclear-weapon-free Latin America. Standing positions: nuclear disarmament, migration handled with shared responsibility, non-intervention, reform of the Council including veto restraint alongside France. Red lines: anything framing migration as purely an enforcement matter. Allies: Latin American states, France on veto restraint, G77. Opponents: few fixed. Can trade: regional consensus in the Americas.</p>

        <H2>Extending a brief for a specific topic</H2>
        <p>The brief gets you to the door. For your actual committee, add four lines to it.</p>
        <ul>
          <li><strong>The last vote.</strong> How did your country vote on the most recent resolution on this topic, and did it explain its vote?</li>
          <li><strong>The domestic constraint.</strong> What at home makes a position difficult: an industry, a treaty it has not ratified, an election, a border.</li>
          <li><strong>The money.</strong> Is your country a donor, a recipient or neither on this topic? It predicts almost every position on implementation clauses.</li>
          <li><strong>The named ally.</strong> One specific delegation in your committee whose position is closest to yours, and one whose opposition you must manage.</li>
        </ul>
        <p>Those four lines are also most of a good position paper. Our <Link href="/blog/mun-position-paper-guide">position paper guide</Link> shows the structure they slot into, the <Link href="/blog/mun-position-paper-examples">position paper examples</Link> show finished papers, and <Link href="/blog/mun-bloc-building">the bloc building guide</Link> covers what to do with the named ally once you have found them.</p>

        <H2>Countries with no obvious position</H2>
        <p>You will eventually be assigned a delegation with no published position on your topic at all. This is not a problem, it is an opening, and the reasoning runs in this order.</p>
        <ol>
          <li><strong>Start with the bloc.</strong> If it is in the G77, the African Group, the EU or ASEAN, the bloc statement is your position until proved otherwise.</li>
          <li><strong>Then the interest.</strong> A landlocked state cares about transit. An island state cares about sea level. An oil exporter cares about energy transition finance. Geography and economy predict most positions correctly.</li>
          <li><strong>Then the pattern.</strong> How does it vote on comparable resolutions? A state that abstains on country-specific human rights resolutions will abstain on yours.</li>
          <li><strong>Then say so.</strong> A delegate who says &quot;my delegation has not previously taken a formal position on this question, and approaches it from the following interests&quot; sounds prepared. One who invents a policy sounds like they did no research.</li>
        </ol>
        <Callout>A small state with no fixed position is the best allocation in the room for a delegate who wants to negotiate. You are the vote everyone needs and nobody has, which is far more leverage than a P5 seat whose answer everyone already knows.</Callout>

        <H2>The blank template</H2>
        <p>Copy this into a document, fill it in, and print it on one side of paper for the conference.</p>
        <FactCard title="Country brief: [delegation]">
          <ul>
            <li><strong>Government:</strong> system, orientation, who decides foreign policy</li>
            <li><strong>Economy:</strong> main exports, main dependence, main vulnerability</li>
            <li><strong>Blocs:</strong> regional group, and every other membership</li>
            <li><strong>Standing positions:</strong> three sentences it says in every committee</li>
            <li><strong>Red lines:</strong> two things it will never accept</li>
            <li><strong>Typical allies:</strong> three delegations, and one in this committee</li>
            <li><strong>Typical opponents:</strong> two delegations, and what the disagreement is</li>
            <li><strong>Can trade:</strong> the concession it will make, and what it wants back</li>
            <li><strong>Topic specifics:</strong> last vote, domestic constraint, donor or recipient, named ally</li>
          </ul>
        </FactCard>
        <p>Fill one in for your own delegation and one for the two delegations you expect to be hardest to convince. Then test it: run a practice committee with your club, argue the position out loud, and see which of your red lines survive contact with a room. Our <Link href="/blog/mun-negotiation-tactics">negotiation guide</Link> covers trading them. You can open a <Link href="/create">free practice session</Link> and run it in a browser, and if you are choosing where to use the preparation, the <Link href="/conferences/explore">conference directory</Link> lists what is open. For a Security Council allocation, read our <Link href="/blog/mun-security-council-guide">P5 and veto guide</Link> alongside the brief, since the procedure changes what a position is worth.</p>
      </ArticleLayout>
    </>
  );
}
