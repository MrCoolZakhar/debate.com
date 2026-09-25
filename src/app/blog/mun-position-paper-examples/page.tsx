import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Position Paper Examples: Three Full Papers, Annotated',
  description:
    'Three complete Model UN position papers at three quality levels, with the chair notes on each and the exact reason the weak one scores low.',
  path: '/blog/mun-position-paper-examples',
  ogDescription: 'Three complete position papers, annotated with what a chair marks against.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Position Paper Examples: Three Full Papers, Annotated',
  description: 'Three complete position papers, annotated with what a chair marks against.',
  url: 'https://gavelling.com/blog/mun-position-paper-examples',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-position-paper-examples' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Position Paper Examples', item: 'https://gavelling.com/blog/mun-position-paper-examples' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-position-paper-examples"
        pitch="Chairs read papers before the gavel and judge the room during it. Gavelling keeps the record of both in one place."
      >
        <p>
          A format guide tells you a position paper has three parts. It does not tell you what a good one sounds like, which is the thing you actually need at eleven at night with a deadline tomorrow. Below are three complete papers, written for this guide, with the notes a chair would write in the margin of each. If you want the rules of format, mistakes and structure first, read the <Link href="/blog/mun-position-paper-guide">position paper guide</Link> and come back. This page is the artefact; that page is the method.
        </p>

        <H2>What a chair is actually marking</H2>
        <p>
          Most conferences that grade papers use some version of the same four questions. Everything in the annotations below maps back to one of them.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>What a strong paper does</th>
                <th>What a weak paper does</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Is this a position?', 'States what the country wants, in the first paragraph', 'Describes the topic for two paragraphs'],
                ["Is it this country's position?", 'Cites what the government has said, signed or voted', 'Could be swapped to any country with a find and replace'],
                ['Is it actionable?', 'Proposes specific mechanisms with a body and a timeline', 'Calls for awareness, cooperation and dialogue'],
                ['Is it accurate?', 'Names instruments and dates correctly', 'Names a treaty the country never joined'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td><strong>{r[0]}</strong></td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Callout>
          The find-and-replace test is the one chairs apply first and fastest. If your paper still reads correctly after swapping your country for a random other one, it has no position in it.
        </Callout>

        <H2>Paper 1: a General Assembly topic, strong</H2>
        <p className="gv-note">
          Committee: Disarmament and International Security Committee. Topic: lethal autonomous weapons systems. Delegation: the Republic of Austria. Written for this guide. Roughly 400 words, which is normal for a one-page limit.
        </p>

        <H3>The paper</H3>
        <p>
          <strong>Topic: Regulating Lethal Autonomous Weapons Systems</strong><br />
          <strong>Committee: Disarmament and International Security Committee</strong><br />
          <strong>Delegation: The Republic of Austria</strong>
        </p>
        <p>
          Austria comes to this committee with one objective: the negotiation of a legally binding instrument on autonomous weapons systems, containing prohibitions on systems that select and engage targets without meaningful human control, and regulation of all others. Austria does not regard a further round of voluntary principles as progress.
        </p>
        <p>
          The Group of Governmental Experts convened under the Convention on Certain Conventional Weapons has met on this question since 2017 and affirmed eleven guiding principles in 2019. Those principles restate existing international humanitarian law. They create no obligation, no verification and no threshold. Austria has argued consistently that a consensus-bound forum in which a small number of developing states can block a mandate is structurally incapable of producing an instrument, which is why Austria brought the question to this General Assembly and why the Assembly has now requested the Secretary-General to seek the views of Member States.
        </p>
        <p>
          Austria&apos;s position rests on a legal argument, not a technological one. The obligations of distinction, proportionality and precaution in attack attach to a human being who can be held responsible. A system that selects a target without meaningful human control does not remove the obligation; it removes the person who carries it, and with them the possibility of accountability. Austria therefore rejects the argument that autonomy is a matter of degree to be managed nationally.
        </p>
        <p>
          Austria proposes that this committee recommend: first, the opening of negotiations on a legally binding instrument with a defined timeline, sitting under the General Assembly rather than requiring consensus in the Convention framework; second, a two-tier structure prohibiting systems that cannot be used in compliance with international humanitarian law and systems that target persons directly, and regulating the remainder through positive obligations on human control; third, a national review requirement under Article 36 of Additional Protocol I, with reporting to a standing body; fourth, a definition built on the function of target selection and engagement, not on a list of technologies, which any national procurement cycle would outpace.
        </p>
        <p>
          Austria is prepared to work with any delegation on the timeline and the verification mechanism. Austria is not prepared to support language that substitutes national policy statements for treaty obligation.
        </p>

        <H3>Chair notes</H3>
        <ul>
          <li><strong>First sentence is the position.</strong> The chair knows what this delegation wants before the end of line one. Most papers bury it in paragraph three.</li>
          <li><strong>It says what the country is against, by name.</strong> &quot;A further round of voluntary principles&quot; is a real negotiating line, and it tells the chair this delegate will have something to say when someone proposes exactly that.</li>
          <li><strong>The forum argument is the giveaway that research happened.</strong> Knowing that the Convention process works by consensus, and that this is the actual obstacle, is the difference between reading about a topic and understanding it.</li>
          <li><strong>The legal argument is one paragraph and it is load-bearing.</strong> It gives the delegate something to say in every moderated caucus, because it applies to any proposal anyone makes.</li>
          <li><strong>Four numbered proposals, each of which could be an operative clause.</strong> The chair can already see this delegate sponsoring a paper.</li>
          <li><strong>The last line is a red line.</strong> It tells other delegations where merging stops. That is diplomacy, and it is rare in a first paper.</li>
        </ul>

        <H2>Paper 2: a Security Council topic, strong and differently shaped</H2>
        <p className="gv-note">
          Committee: Security Council. Topic: protection of civilians in armed conflict. Delegation: the Federative Republic of Brazil. Written for this guide. Shorter, harder on precedent, and written for a room of fifteen.
        </p>

        <H3>The paper</H3>
        <p>
          <strong>Topic: The Protection of Civilians in Armed Conflict</strong><br />
          <strong>Committee: United Nations Security Council</strong><br />
          <strong>Delegation: The Federative Republic of Brazil</strong>
        </p>
        <p>
          Brazil supports the protection of civilians as a Council responsibility and opposes its use as a route to regime change. These two positions are not in tension, and Brazil has set out how they are reconciled: the concept of responsibility while protecting, which Brazil introduced to the United Nations in 2011 after the Council&apos;s authorisation of force in Libya.
        </p>
        <p>
          That proposal asks the Council for three things. A strict sequencing of the means of protection, with force genuinely last. A proportionality test applied to the intervention itself, not only to the harm it answers. And a monitoring and review mechanism through which the Council follows what is done under its own authorisation, rather than issuing a mandate and losing sight of it. Brazil continues to regard the absence of the third as the central failure of the Council&apos;s practice in this area.
        </p>
        <p>
          Brazil therefore approaches this topic with a preference for the tools the Council under-uses. Mandates that are specific about what protection means operationally. Political missions and mediation funded properly and early. Accountability for violations pursued through existing mechanisms rather than announced and abandoned. Brazil is a substantial troop contributor to United Nations peacekeeping and speaks from that experience: a protection mandate without the corresponding force generation, rules of engagement and logistics is a promise made to civilians by a Council that has not resourced it.
        </p>
        <p>
          On the question of the veto and mass atrocity, Brazil is supportive of restraint in principle and realistic about the arithmetic. Brazil will engage with proposals on voluntary restraint and will not support text that purports to amend the Charter by resolution.
        </p>
        <p>
          Brazil is willing to sponsor a product that strengthens mandate drafting and Council follow-up. Brazil will vote against any text authorising the use of force without the sequencing and review described above.
        </p>

        <H3>Chair notes</H3>
        <ul>
          <li><strong>It opens on the apparent contradiction and resolves it.</strong> A Security Council paper has to explain the tension in its own position, because fourteen other delegates will attack it.</li>
          <li><strong>It cites the country&apos;s own initiative.</strong> Responsibility while protecting is a genuine Brazilian contribution to UN debate. Finding your country&apos;s own concept, not just its votes, is the highest-value research move available.</li>
          <li><strong>The shape is different from paper 1 and that is correct.</strong> Fifteen seats, a veto and a binding output mean a UNSC paper is about what you will and will not vote for. Paper 1 is about what should be built.</li>
          <li><strong>It states a voting condition explicitly.</strong> That is the single most useful sentence a UNSC delegate can write, and it is what the P5 will read first.</li>
          <li><strong>It declines to overreach on the veto.</strong> &quot;Realistic about the arithmetic&quot; is a chair-pleasing line because it shows the delegate knows what a resolution cannot do.</li>
        </ul>

        <Callout>
          Check every factual claim in your own paper against a primary source before you submit. Permanent mission websites, foreign ministry statements and the UN Digital Library carry the votes and the speeches. A confidently wrong citation costs more than a missing one.
        </Callout>

        <H2>Paper 3: the paper that scores low</H2>
        <p className="gv-note">
          Same committee and topic as paper 1. Delegation: Canada. Written for this guide as a deliberately weak example. The weakness is in the writing, not in the country: the paper attributes almost nothing specific to Canada, which is precisely the problem.
        </p>

        <H3>The paper</H3>
        <p>
          <strong>Topic: Lethal Autonomous Weapons Systems</strong><br />
          <strong>Committee: DISEC</strong><br />
          <strong>Delegation: Canada</strong>
        </p>
        <p>
          Lethal autonomous weapons systems, often referred to as killer robots, are one of the most pressing issues facing the international community today. With the rapid advancement of artificial intelligence, these weapons have the potential to change warfare forever. Many experts have raised concerns about the ethical implications of allowing machines to make life and death decisions.
        </p>
        <p>
          The United Nations has discussed this issue for many years. Various meetings have been held and many countries have expressed their views. However, no agreement has yet been reached, and the international community remains divided on how best to proceed.
        </p>
        <p>
          Canada believes that this is a very important issue that requires urgent attention. Canada is a strong supporter of the United Nations and of international law, and believes that all countries should work together to address this challenge. Canada is committed to human rights and to the peaceful resolution of disputes.
        </p>
        <p>
          Canada therefore calls upon the international community to raise awareness of the dangers of autonomous weapons, to promote dialogue between Member States, and to encourage further research into the issue. Canada also believes that developing countries should be supported in building their capacity in this area.
        </p>
        <p>
          In conclusion, Canada looks forward to working with all delegations to find a solution to this important problem and hopes that this committee can reach a consensus.
        </p>

        <H3>Chair notes</H3>
        <ul>
          <li><strong>Paragraphs one and two are the background guide.</strong> The chair wrote the background guide. Roughly forty per cent of this paper tells the chair something the chair already knows.</li>
          <li><strong>Find and replace test: fails completely.</strong> Swap Canada for Norway, Kenya or Chile and nothing reads oddly. There is no position here, only a tone.</li>
          <li><strong>&quot;Killer robots&quot; in the first sentence.</strong> Campaign language, not diplomatic language. It signals one advocacy website as the source.</li>
          <li><strong>No instrument, no date, no vote, no treaty, no body.</strong> The only near-specific is &quot;various meetings&quot;.</li>
          <li><strong>The proposals cannot become clauses.</strong> Raise awareness, promote dialogue, encourage research and build capacity are the four phrases that get an <Link href="/blog/mun-clause-phrases">operative clause</Link> struck in drafting, because none of them names who does what by when.</li>
          <li><strong>&quot;Committed to human rights and peaceful resolution&quot; applies to 193 Member States.</strong> A sentence true of everybody distinguishes nobody.</li>
          <li><strong>Where it actually lands:</strong> not a fail, at most conferences. It is submitted, formatted and on topic. It simply produces no reason to remember this delegation, which is what a mediocre score means.</li>
        </ul>

        <H2>The same paragraph, badly and well</H2>
        <p>
          The gap between paper 1 and paper 3 is not talent. It is four rewriting habits, and you can watch all four operate on one sentence.
        </p>

        <FactCard title="Weak">
          Canada calls upon the international community to raise awareness of the dangers of autonomous weapons and to promote dialogue between Member States.
        </FactCard>

        <FactCard title="Stronger: name the actor">
          Canada calls upon this committee to request that the Secretary-General convene a group of governmental experts on autonomous weapons.
        </FactCard>

        <FactCard title="Stronger: name the output and the deadline">
          Canada calls upon this committee to request that the Secretary-General convene a group of governmental experts to produce a draft definition of meaningful human control for consideration at the next session.
        </FactCard>

        <FactCard title="Stronger: name the obstacle it answers">
          Because the existing expert process operates by consensus and has produced no definition in eight years, Canada calls upon this committee to request that the Secretary-General convene a group of governmental experts, reporting to the General Assembly and deciding by two-thirds majority, to produce a draft definition of meaningful human control for consideration at the next session.
        </FactCard>

        <p>
          Four moves, in order: name who acts, name what they produce, name when, name the problem it solves. Apply them to every sentence beginning &quot;calls upon the international community&quot; and your paper improves more than another hour of reading would improve it.
        </p>

        <H2>Format variations by circuit</H2>
        <p>
          There is no single position paper standard. Before you write, find the conference handbook and check four things.
        </p>
        <ul className="gv-check">
          <li><strong>Length.</strong> One page per topic is the most common limit. Some conferences allow two. Some count words, some count pages, and the two rules produce very different papers.</li>
          <li><strong>Number.</strong> One paper per topic, or one paper covering all topics. This changes your structure completely.</li>
          <li><strong>Citations.</strong> Some conferences require a bibliography and will not mark a paper without one. Ask which style.</li>
          <li><strong>Whether it is graded at all.</strong> Many THIMUN-affiliated conferences ask for a policy statement rather than a graded paper, because the first working day is spent lobbying and merging resolutions instead. Our <Link href="/blog/thimun-rules-of-procedure">THIMUN procedure guide</Link> explains why the document expectations differ.</li>
        </ul>
        <p>
          Almost universally: header block with committee, topic and delegation, no first person, no bullet points in the body, and the delegation referred to in the third person.
        </p>

        <H2>What to do with this before your deadline</H2>
        <p>
          Take your own draft and do three passes. Pass one: delete every sentence that describes the topic rather than your country&apos;s response to it. Pass two: run the find-and-replace test, and rewrite any paragraph that survives it unchanged. Pass three: turn every proposal into the four-move sentence above.
        </p>
        <p>
          If you are short on the raw material for pass two, the problem is research, not writing. The voting record, the treaty reservations and the permanent mission statements are where a real position comes from, and they take an evening. Our <Link href="/blog/mun-country-research">country research method</Link> walks through them, and the <Link href="/blog/mun-country-profiles">country profiles</Link> give you a place to start.
        </p>
        <p>
          Then go and use it. The paper is a plan for what you will say, and the first place you will say it is your opening speech: our <Link href="/blog/mun-opening-speech">opening speech guide</Link> turns a paper into ninety seconds. If the paper turns into a draft, the <Link href="/blog/mun-resolution-writing">resolution writing guide</Link> is the next step.
        </p>
      </ArticleLayout>
    </>
  );
}
