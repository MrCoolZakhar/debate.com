import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Preambulatory and Operative Clauses: The Complete Phrase List',
  description:
    'Every accepted preambulatory and operative phrase, what each one commits the committee to, and which verbs a General Assembly committee is not allowed to use',
  path: '/blog/mun-clause-phrases',
  ogDescription: 'Every preambulatory and operative phrase, with what each one commits the committee to.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Preambulatory and Operative Clauses: The Complete Phrase List',
  description: 'Every preambulatory and operative phrase, with what each one commits the committee to.',
  url: 'https://gavelling.com/blog/mun-clause-phrases',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-clause-phrases' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Clause Phrases', item: 'https://gavelling.com/blog/mun-clause-phrases' },
  ],
};

function Phrases({ title, note, items }: { title: string; note: string; items: [string, string][] }) {
  return (
    <>
      <H3>{title}</H3>
      <p>{note}</p>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th>Phrase</th>
              <th>Example opening</th>
            </tr>
          </thead>
          <tbody>
            {items.map(([p, e]) => (
              <tr key={p}>
                <td><strong>{p}</strong></td>
                <td>{e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-clause-phrases"
        pitch="Drafting during an unmod? Gavelling holds the papers, the sponsors and the clock so the dais can see who wrote what."
      >
        <p>
          This is the reference you keep open in a second tab while you draft. Every accepted preambulatory and operative phrase, grouped by what it does, with a line showing how it opens. It does not teach resolution structure: the <Link href="/blog/mun-resolution-writing">resolution writing guide</Link> does that, and a <Link href="/blog/mun-resolution-example">full annotated resolution</Link> shows the finished thing. The <Link href="/blog/mun-glossary">MUN glossary</Link> covers the wider vocabulary.
        </p>

        <H2>The two-minute rule</H2>
        <p>
          A resolution has exactly two kinds of clause and they do different jobs.
        </p>
        <ul>
          <li>
            <strong>Preambulatory clauses describe.</strong> They set out what is already true: what the body has noted, what it recalls, what alarms it. They are not numbered, they are italicised in UN practice, they end in a comma, and at most conferences they cannot be amended (our <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure</Link> guide covers that rule on its circuit). They commit nobody to anything.
          </li>
          <li>
            <strong>Operative clauses act.</strong> They say what the body now does: requests, urges, establishes, decides. They are numbered, they end in a semicolon, the last one ends in a full stop, and they are the only part that can be amended and therefore the only part worth fighting over.
          </li>
        </ul>
        <p>
          A useful test while drafting: if a clause could be deleted without changing what any state or body has to do, it belongs in the preamble.
        </p>

        <H2>Preambulatory phrases</H2>
        <p>
          Grouped by function, because that is how you choose one. Five to eight preambulatory clauses is normal for a committee resolution; fifteen is a sign the drafters did not know how to start.
        </p>

        <Phrases
          title="Pointing at what already exists"
          note="The workhorses. Use these to ground the resolution in the record: prior resolutions, treaties, reports, mandates."
          items={[
            ['Recalling', 'Recalling General Assembly resolution 70/1 of 25 September 2015,'],
            ['Recalling further', 'Recalling further the report of the Secretary-General on the same subject,'],
            ['Reaffirming', 'Reaffirming the principle of the sovereign equality of all Member States,'],
            ['Noting', 'Noting the entry into force of the instrument on 22 January 2021,'],
            ['Taking note of', 'Taking note of the recommendations of the group of governmental experts,'],
            ['Having considered', 'Having considered the report submitted under agenda item 94,'],
            ['Having examined', 'Having examined the findings of the independent review,'],
            ['Having received', 'Having received the communication transmitted by the Secretary-General,'],
            ['Referring to', 'Referring to Article 36 of Additional Protocol I,'],
            ['Guided by', 'Guided by the purposes and principles of the Charter of the United Nations,'],
            ['Bearing in mind', 'Bearing in mind the special circumstances of small island developing States,'],
          ]}
        />

        <Phrases
          title="Registering concern"
          note="Graded by force. Alarmed and deeply disturbed are strong, and using them for a routine topic reads as inflation."
          items={[
            ['Noting with concern', 'Noting with concern the continued absence of a verification mechanism,'],
            ['Noting with regret', 'Noting with regret the failure of the process to reach agreement,'],
            ['Expressing concern', 'Expressing concern at the rate at which the deployment is proceeding,'],
            ['Deeply concerned', 'Deeply concerned by reports of violations in the affected region,'],
            ['Gravely concerned', 'Gravely concerned by the deterioration of the humanitarian situation,'],
            ['Alarmed by', 'Alarmed by the scale of displacement recorded since the last reporting period,'],
            ['Deeply disturbed', 'Deeply disturbed by the continued targeting of medical facilities,'],
            ['Deploring', 'Deploring the use of force against civilian populations,'],
            ['Regretting', 'Regretting that the requested information has not been provided,'],
            ['Contemplating', 'Contemplating the long term consequences of inaction on this question,'],
          ]}
        />

        <Phrases
          title="Registering approval"
          note="The positive half. Welcoming and commending are the two you will use most; the rest are for a reason."
          items={[
            ['Welcoming', 'Welcoming the establishment of the joint monitoring mechanism,'],
            ['Commending', 'Commending the efforts of the regional organisations concerned,'],
            ['Appreciating', 'Appreciating the technical assistance provided by specialised agencies,'],
            ['Applauding', 'Applauding the successful conclusion of the negotiation,'],
            ['Approving', 'Approving the framework annexed to the present resolution,'],
            ['Acknowledging', 'Acknowledging the constructive role played by civil society,'],
            ['Taking into account', 'Taking into account the views expressed by Member States,'],
          ]}
        />

        <Phrases
          title="Setting up the argument"
          note="These carry the logic of the resolution. They are where you say why the operative clauses follow."
          items={[
            ['Recognizing', 'Recognizing that existing measures have proved insufficient,'],
            ['Emphasizing', 'Emphasizing the primary responsibility of States in this area,'],
            ['Stressing', 'Stressing the urgency of a coordinated international response,'],
            ['Underlining', 'Underlining the importance of national ownership of any programme,'],
            ['Affirming', 'Affirming that international humanitarian law applies in full,'],
            ['Declaring', 'Declaring that the present situation constitutes a matter of common concern,'],
            ['Convinced', 'Convinced that a legally binding instrument is the only durable solution,'],
            ['Believing', 'Believing that early intervention reduces the eventual cost of response,'],
            ['Aware of', 'Aware of the constraints faced by least developed countries,'],
            ['Mindful of', 'Mindful of the need to avoid duplication of existing mandates,'],
            ['Desiring', 'Desiring to establish a common basis for future cooperation,'],
            ['Seeking', 'Seeking to strengthen the capacity of national authorities,'],
            ['Fully alarmed / fully aware', 'Fully aware of the resource implications of the proposed mechanism,'],
            ['Observing', 'Observing that the reporting rate has declined for three consecutive years,'],
            ['Expecting', 'Expecting that the parties will comply with their existing obligations,'],
          ]}
        />

        <Callout>
          Preambulatory clauses are the cheapest place to buy a vote. A delegation that will not support your operative clauses will often sign a paper that reaffirms a principle it cares about. Spend one preambulatory clause on each bloc you need.
        </Callout>

        <H2>Operative phrases, ordered by force</H2>
        <p>
          This is the list that matters. Operative verbs are not interchangeable: they carry different degrees of obligation, and some of them a General Assembly committee simply cannot use. They are ordered here from softest to strongest.
        </p>

        <Phrases
          title="Soft: inviting and encouraging"
          note="Nothing is required of anyone. Use these for the parties you cannot bind and do not want to alienate."
          items={[
            ['Invites', 'Invites Member States to submit their views to the Secretary-General;'],
            ['Encourages', 'Encourages regional organisations to develop complementary frameworks;'],
            ['Recommends', 'Recommends that States review their national legislation accordingly;'],
            ['Suggests', 'Suggests that the working group consider a phased timetable;'],
            ['Trusts', 'Trusts that the parties will resume negotiations without preconditions;'],
            ['Hopes', 'Hopes that the outstanding contributions will be received before the next session;'],
          ]}
        />

        <Phrases
          title="Medium: the everyday operative verbs"
          note="Ninety percent of a good General Assembly resolution is built from these four."
          items={[
            ['Calls upon', 'Calls upon all States to refrain from any measure inconsistent with the present resolution;'],
            ['Urges', 'Urges States that have not yet done so to ratify the instrument;'],
            ['Requests', 'Requests the Secretary-General to report to the General Assembly at its next session;'],
            ['Appeals to', 'Appeals to donors to fund the response plan in full;'],
            ['Draws the attention of', 'Draws the attention of the Economic and Social Council to the present resolution;'],
            ['Transmits', 'Transmits the report of the working group to the Security Council for its consideration;'],
          ]}
        />

        <Phrases
          title="Structural: building things"
          note="The most useful clauses in a MUN resolution, because they are the ones that produce something a committee can point to."
          items={[
            ['Establishes', 'Establishes an open-ended working group to develop a common definition;'],
            ['Creates', 'Creates a voluntary fund to support national implementation;'],
            ['Designates', 'Designates the existing Office as the coordinating body for this purpose;'],
            ['Authorizes', 'Authorizes the Secretary-General to convene an expert meeting in the first quarter;'],
            ['Adopts', 'Adopts the framework of action annexed to the present resolution;'],
            ['Endorses', 'Endorses the recommendations contained in paragraphs 14 to 19 of the report;'],
            ['Confirms', 'Confirms the mandate of the mission for a further twelve months;'],
            ['Further resolves', 'Further resolves to review implementation at its next substantive session;'],
          ]}
        />

        <Phrases
          title="Hard: deciding and demanding"
          note="Binding language. Read the next section before you use any of these, because the limits are real and chairs check."
          items={[
            ['Decides', 'Decides to establish a monitoring mechanism reporting annually;'],
            ['Decides to remain seized of the matter', 'Decides to remain seized of the matter.'],
            ['Demands', 'Demands the immediate cessation of hostilities;'],
            ['Condemns', 'Condemns in the strongest terms the attacks against humanitarian personnel;'],
            ['Deplores', 'Deplores the continued failure to comply with resolution 2XXX;'],
            ['Declares', 'Declares that the measures imposed shall apply for an initial period of six months;'],
            ['Proclaims', 'Proclaims the period 2027 to 2036 the International Decade for this purpose;'],
          ]}
        />

        <H2>Which verbs your committee may actually use</H2>
        <p>
          This is the section that separates a delegate who has read the Charter from one who has read a phrase list. The General Assembly and the Security Council have different powers, and the operative verb is where that difference shows.
        </p>
        <p>
          Under Articles 10 to 14 of the UN Charter, the General Assembly may discuss and <strong>recommend</strong>. Its resolutions on substantive international questions are recommendations to Member States and are not binding. The Security Council, acting under Chapter VII, takes decisions that Member States agree to accept and carry out under Article 25. That is the whole distinction, and it produces a simple rule.
        </p>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Verb</th>
                <th>GA committee</th>
                <th>Security Council</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Calls upon, Urges, Recommends, Invites, Encourages', 'Yes', 'Yes', 'Recommendatory. Always available.'],
                ['Requests (the Secretary-General, a subsidiary body)', 'Yes', 'Yes', 'The GA may task UN organs and officials it oversees.'],
                ['Establishes, Creates, Authorizes (a UN body)', 'Yes', 'Yes', 'Article 22 lets the GA create subsidiary organs.'],
                ["Decides (on the Assembly's own procedure or organs)", 'Yes', 'Yes', 'Internal housekeeping is a real GA power.'],
                ['Decides (that States shall do something)', 'No', 'Yes', 'Only the Council binds States, under Article 25.'],
                ['Demands', 'No', 'Yes', 'Presupposes an obligation the GA cannot create.'],
                ['Authorizes the use of force', 'No', 'Yes', 'Chapter VII, and Council only.'],
                ['Imposes sanctions', 'No', 'Yes', 'Article 41. The GA may recommend measures, not impose them.'],
                ['Condemns', 'In practice yes', 'Yes', 'A political statement rather than an obligation. Common in GA practice.'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td><strong>{r[0]}</strong></td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <p>
          So &quot;Decides that all Member States shall prohibit the export of such systems&quot; in a DISEC resolution is wrong, and a chair who knows the Charter will strike it or ask you to defend it. &quot;Decides to establish an open-ended working group&quot; in the same resolution is entirely correct, because the Assembly is deciding about its own machinery. The verb is the same; what follows it is what makes the clause legal or not.
        </p>
        <p>
          The Security Council&apos;s own conventions are worth knowing too, and are covered in the <Link href="/blog/mun-security-council-guide">Security Council guide</Link>: acting under Chapter VII is stated explicitly in the preamble, and a Council resolution normally closes with &quot;Decides to remain seized of the matter&quot;.
        </p>

        <Callout>
          If in doubt, downgrade. &quot;Calls upon States to prohibit&quot; is always in order. &quot;Decides that States shall prohibit&quot; is in order in exactly one committee. Losing a word costs you nothing; losing the clause in amendment costs you the paper.
        </Callout>

        <H2>Punctuation, numbering and the three errors that get papers sent back</H2>
        <ul>
          <li><strong>Preambulatory clauses end in a comma.</strong> Every one. They are not numbered. In UN documents the opening phrase is italicised.</li>
          <li><strong>Operative clauses are numbered and end in a semicolon.</strong> The final operative clause ends in a full stop. In UN documents the opening verb is italicised and the clause is indented.</li>
          <li><strong>Sub-clauses use letters, sub-sub-clauses use roman numerals.</strong> A sub-clause ends in a comma, or a semicolon before the next numbered clause.</li>
        </ul>
        <p>The three formatting errors chairs actually send papers back for:</p>
        <ul>
          <li><strong>A full stop in the middle.</strong> A resolution is one grammatical sentence from the first preambulatory clause to the final full stop. A stray full stop after clause 4 breaks it.</li>
          <li><strong>Numbered preambulatory clauses.</strong> Usually a sign the document was assembled from two papers during a merge, and it tells the dais nobody proofread after merging.</li>
          <li><strong>A clause containing two actions.</strong> &quot;Requests the Secretary-General to report and calls upon States to fund the mechanism&quot; is two clauses. It also makes the clause impossible to amend cleanly, which is why sponsors sometimes do it on purpose and why chairs split it.</li>
        </ul>

        <H3>When a sub-clause is hiding a weak idea</H3>
        <p>
          Sub-clauses are for genuinely parallel items: a list of what a new body will do, a list of the categories a fund covers. They are not for adding detail you have not thought through. If your sub-clauses are each a full sentence with their own verb, you have written three operative clauses and indented them to look organised. Promote them, and see whether they survive the look.
        </p>

        <H2>Twelve phrases to cut</H2>
        <p>
          These appear in almost every first draft and none of them survives a serious amendment round, because none of them names an actor, an action or a date.
        </p>
        <ul>
          <li>Calls upon the international community to raise awareness</li>
          <li>Encourages further dialogue between all relevant stakeholders</li>
          <li>Urges all States to work together</li>
          <li>Recommends that more research be conducted</li>
          <li>Calls for the promotion of best practices</li>
          <li>Suggests the strengthening of existing frameworks</li>
          <li>Encourages capacity building in developing countries</li>
          <li>Calls upon States to consider taking appropriate measures</li>
          <li>Urges the Secretary-General to do everything possible</li>
          <li>Recommends the creation of a comprehensive approach</li>
          <li>Invites Member States to share information as appropriate</li>
          <li>Calls for increased cooperation at all levels</li>
        </ul>
        <p>
          The repair is always the same four moves: name who acts, name what they produce, name by when, and name the obstacle it answers. &quot;Encourages capacity building in developing countries&quot; becomes &quot;Requests the Secretary-General to establish, within existing resources, a technical assistance roster available to requesting States, and to report on its use at the next session&quot;. Longer, and amendable, and real.
        </p>

        <H2>Using this while you draft</H2>
        <p>
          Open this page beside your document during the <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus</Link>. Write the operative clauses first and the preamble last: the preamble is the packaging, and you cannot package something you have not built. When you have a draft, run down the operative verbs once and ask of each whether your committee is allowed to use it and whether a softer one would cost you anything. If you need material for your clauses, our <Link href="/blog/mun-position-paper-examples">position paper examples</Link> show how a country&apos;s position is set out.
        </p>
        <p>
          Then the paper has to survive amendment, which is a different skill: the <Link href="/blog/mun-amendment-guide">amendment guide</Link> covers friendly versus unfriendly and the order clauses are voted in. And before any of it can be debated, it has to be introduced, which is the <Link href="/blog/mun-working-paper-guide">working paper guide</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
