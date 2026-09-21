import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Model UN Resolution Example: A Full Resolution, Line by Line',
  description:
    'One complete draft resolution, annotated clause by clause with the politics behind each line, plus the amended version that passed and the vote that carried it',
  path: '/blog/mun-resolution-example',
  ogDescription: 'A complete draft resolution, annotated clause by clause, and the amendments that passed it.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Model UN Resolution Example: A Full Resolution, Line by Line',
  description: 'A complete draft resolution, annotated clause by clause, and the amendments that passed it.',
  url: 'https://gavelling.com/blog/mun-resolution-example',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-resolution-example' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Resolution Example', item: 'https://gavelling.com/blog/mun-resolution-example' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-resolution-example"
        pitch="Draft resolutions, sponsors, amendments and the vote: Gavelling runs the document side of a committee as well as the clock."
      >
        <p>
          Below is one complete draft resolution, written for this guide, on a real General Assembly topic. First the document as it was introduced. Then an annotation of every clause explaining what it does, what it costs and who would vote against it. Then the three amendments the committee made to it, and the vote it passed on. If you want the process rather than the artefact, the <Link href="/blog/mun-resolution-writing">resolution writing guide</Link> is the method and the <Link href="/blog/mun-clause-phrases">phrase list</Link> is the reference. The <Link href="/blog/mun-glossary">MUN glossary</Link> defines any term below you have not met.
        </p>

        <H2>The header block, and what each line commits you to</H2>
        <p className="gv-note">
          Committee: Social, Humanitarian and Cultural Committee (Third Committee). Topic: continuity of education for children displaced by conflict and disaster. Written for this guide.
        </p>
        <p>
          <strong>Draft Resolution 1.1</strong><br />
          <strong>Committee:</strong> Social, Humanitarian and Cultural Committee<br />
          <strong>Topic:</strong> Ensuring continuity of education for displaced children<br />
          <strong>Sponsors:</strong> Kenya, Germany, Colombia, Bangladesh<br />
          <strong>Signatories:</strong> Jordan, Uganda, Canada, Philippines, Peru, Sweden, Ethiopia, Nepal, Ireland, Türkiye
        </p>
        <ul>
          <li><strong>The number.</strong> Assigned by the dais, not by you. 1.1 means first topic, first paper. Conferences that use slashes write DR 1/1. Do not number your own paper before the dais accepts it.</li>
          <li><strong>Committee and topic.</strong> Copied exactly from the background guide. A topic line that paraphrases the official topic is the first thing a careful dais notices.</li>
          <li><strong>Sponsors.</strong> The delegations that wrote it and stand behind it. At most conferences sponsors may not vote against their own paper, and a friendly amendment requires all of them to agree. Four sponsors is a good number: enough to signal breadth, few enough to get a friendly amendment agreed in ninety seconds.</li>
          <li><strong>Signatories.</strong> Delegations that want it debated. Signing is not endorsement and costs nothing, which is why you ask delegations who intend to vote against. Conferences usually require a fixed count or a fraction of the committee, often around one fifth. Our <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure</Link> guide covers how that circuit handles submitters instead.</li>
        </ul>
        <Callout>
          The sponsor list is a political document. Kenya and Bangladesh are host states of large displaced populations, Germany is a donor, Colombia bridges a third region. That combination tells the room this paper was negotiated before it was submitted, which is half of why papers pass.
        </Callout>

        <H2>The resolution as introduced</H2>
        <p><em>The Social, Humanitarian and Cultural Committee,</em></p>
        <p><em>Recalling</em> the Convention on the Rights of the Child, and in particular article 28 on the right of the child to education,</p>
        <p><em>Recalling further</em> Sustainable Development Goal 4 and the commitment to inclusive and equitable quality education for all,</p>
        <p><em>Noting</em> that the education of children displaced by conflict and disaster is interrupted for periods measured in years rather than months,</p>
        <p><em>Deeply concerned</em> that displaced children face barriers to enrolment arising from documentation requirements, language of instruction and the non-recognition of prior learning,</p>
        <p><em>Recognizing</em> the substantial and sustained burden borne by host communities, which in most cases are themselves in low and middle income countries,</p>
        <p><em>Bearing in mind</em> that education in emergencies has historically received a small share of humanitarian funding relative to its share of need,</p>
        <ol>
          <li><em>Calls upon</em> Member States to admit displaced children to national education systems irrespective of the documentation the child is able to produce, and to accept alternative evidence of prior schooling where records are unavailable;</li>
          <li><em>Requests</em> the Secretary-General to develop, in consultation with the relevant agencies, a common framework for the recognition of prior learning that may be applied by receiving States, and to report on its development at the next session;</li>
          <li><em>Urges</em> Member States to include displaced children in national education sector plans and in the data collected on them, rather than addressing their education through parallel and temporary arrangements;</li>
          <li><em>Encourages</em> Member States to provide transitional language instruction sufficient to allow entry into mainstream classes within one academic year;</li>
          <li><em>Calls upon</em> donor States to increase the proportion of humanitarian funding allocated to education in emergencies, and to make such funding available on a multi-year basis;</li>
          <li><em>Establishes</em> an open-ended working group, meeting within existing resources, to identify obstacles to the recognition of qualifications across borders and to report its findings to the Committee;</li>
          <li><em>Requests</em> the Secretary-General to compile and disseminate good practice on the accreditation of teachers who are themselves displaced, so that qualified refugee teachers may be employed in host systems;</li>
          <li><em>Invites</em> regional organisations to conclude arrangements for the mutual recognition of school certificates issued to displaced children;</li>
          <li><em>Decides</em> to remain seized of the matter.</li>
        </ol>
        <p className="gv-note">Nine operative clauses, six preambulatory. That is a realistic size for a paper that has to survive amendment: a twenty clause resolution is mostly a list of things nobody will defend.</p>

        <H2>The preamble, annotated</H2>
        <p>
          Preambulatory clauses do no work, so every one of them should be buying something.
        </p>
        <ul>
          <li><strong>Recalling the Convention on the Rights of the Child, article 28.</strong> The legal anchor. It is the most widely ratified human rights treaty, which makes it the cheapest possible ground to stand on. Naming the specific article rather than the treaty is what tells the dais you opened the document.</li>
          <li><strong>Recalling further SDG 4.</strong> Buys the development bloc. A delegation that will resist every operative clause will still reaffirm a goal it signed up to.</li>
          <li><strong>Noting that interruption is measured in years.</strong> This is the clause that makes operative clause 3 possible. If the interruption is temporary, parallel arrangements are defensible. If it lasts years, they are not. The preamble is where you win that argument before anyone reaches the operative clause.</li>
          <li><strong>Deeply concerned about documentation, language and recognition.</strong> Names the three barriers that operative clauses 1, 2 and 4 answer. The preamble mirrors the operative structure, which makes the paper feel designed rather than assembled.</li>
          <li><strong>Recognizing the burden on host communities.</strong> Buys Kenya, Bangladesh, Jordan, Uganda, Türkiye and everyone in their position. Without this clause those delegations read the whole paper as a list of duties handed to them.</li>
          <li><strong>Bearing in mind the funding share.</strong> Sets up operative clause 5 without accusing donors of anything. Note the passive construction: a clause that named the shortfall as a donor failure would have cost the paper Germany, Sweden, Canada and Ireland.</li>
        </ul>

        <H2>The operative clauses, annotated</H2>

        <FactCard title="1. Admission irrespective of documentation">
          <p><strong>What it costs:</strong> administratively little, politically a great deal. It touches national control of who enters a public system, which is why it is written as &quot;calls upon&quot; rather than &quot;decides&quot;.</p>
          <p><strong>Who votes against:</strong> States that treat documentation as a migration control, not an administrative step. Expect an unfriendly amendment inserting &quot;in accordance with national legislation&quot;.</p>
        </FactCard>

        <FactCard title="2. A framework for recognising prior learning">
          <p><strong>What it costs:</strong> almost nothing, which is why it is the strongest clause in the paper. It tasks the Secretary-General, which a General Assembly committee may genuinely do, and it produces a document rather than an obligation.</p>
          <p><strong>Who votes against:</strong> nobody, realistically. Clauses like this are the backbone of a passing resolution.</p>
        </FactCard>

        <FactCard title="3. Inclusion in national plans and national data">
          <p><strong>What it costs:</strong> this is the real ask of the paper. Parallel systems are cheaper for the host state and easier to unwind politically. Mainstreaming is the opposite.</p>
          <p><strong>Who votes against:</strong> host states without financing attached. This clause is the reason clause 5 exists: the paper pairs the duty with the money.</p>
        </FactCard>

        <FactCard title="4. Transitional language instruction within one academic year">
          <p><strong>What it costs:</strong> teacher time and money. Note &quot;encourages&quot;, the softest verb in the paper, and a specific benchmark. Specificity is what stops this being one of the twelve empty phrases.</p>
          <p><strong>Who votes against:</strong> few openly. Expect an amendment striking &quot;within one academic year&quot;, which is a perfectly rational attack on the only measurable thing in the clause.</p>
        </FactCard>

        <FactCard title="5. Donors increase the share, on a multi-year basis">
          <p><strong>What it costs:</strong> real budget, and it names the payer. Multi-year is the substantive ask: annual humanitarian appeals cannot fund a school that has to open in September and still exist in three years.</p>
          <p><strong>Who votes against:</strong> donors who dislike any proportional target. The absence of a number here is deliberate and is what keeps Germany and Sweden as sponsors.</p>
        </FactCard>

        <FactCard title="6. An open-ended working group on cross-border qualifications">
          <p><strong>What it costs:</strong> meeting time. &quot;Within existing resources&quot; is the phrase that keeps a budget-conscious delegation from opposing it, and you should write it into every body you create.</p>
          <p><strong>Who votes against:</strong> delegations that think the Committee creates too many working groups. A real objection, and the answer is to point at the mandate being narrow and time-bound.</p>
        </FactCard>

        <FactCard title="7. Accreditation of displaced teachers">
          <p><strong>What it costs:</strong> touches professional licensing, which is usually a sub-national competence. Written as compile and disseminate good practice for exactly that reason.</p>
          <p><strong>Who votes against:</strong> nobody. It is also the clause most likely to be cited as the paper&apos;s original contribution, because most competing drafts will not have thought of it.</p>
        </FactCard>

        <FactCard title="8. Regional mutual recognition arrangements">
          <p><strong>What it costs:</strong> nothing immediately. It pushes the hardest technical problem to the level where it can actually be solved, which is a legitimate move rather than an evasion.</p>
          <p><strong>Who votes against:</strong> nobody, though a delegation may propose adding named regional bodies, which is a friendly amendment worth accepting.</p>
        </FactCard>

        <FactCard title="9. Decides to remain seized of the matter">
          <p><strong>What it costs:</strong> nothing. It is the conventional closing clause, keeping the item on the agenda. Write it and move on.</p>
        </FactCard>

        <Callout>
          Read your own draft and mark each clause as cheap, medium or expensive. A resolution that is all cheap clauses passes and changes nothing. A resolution that is all expensive clauses fails. Passing papers are roughly two thirds cheap, and the cheap clauses are what carry the expensive ones.
        </Callout>

        <H2>The three amendments</H2>
        <p>
          The paper went to the floor with an obvious weakness: clause 1 asks states to give up a control, and clause 3 asks host states to absorb a cost. Both attracted amendments, and the sponsors handled them differently.
        </p>

        <H3>Amendment 1, unfriendly, to clause 1</H3>
        <p>
          <strong>Proposed by:</strong> a bloc of four delegations.<br />
          <strong>Text:</strong> insert &quot;, in accordance with their national legislation,&quot; after &quot;Member States&quot; in operative clause 1.
        </p>
        <p>
          The classic sovereignty amendment, and it drains the clause: a state whose legislation requires documentation now complies by doing nothing. The sponsors opposed it and it <strong>failed</strong>, 21 against to 15 for. It failed because the sponsors made a specific argument rather than a general one: the clause already says &quot;calls upon&quot;, which is a recommendation and creates no legal obligation to override, so the amendment adds nothing except the signal that the committee expects it to be ignored.
        </p>

        <H3>Amendment 2, friendly, to clause 5</H3>
        <p>
          <strong>Proposed by:</strong> a donor delegation, negotiated with the sponsors during an unmoderated caucus.<br />
          <strong>Text:</strong> add at the end of operative clause 5: &quot;and encourages the use of pooled and multi-donor funding instruments for this purpose&quot;.
        </p>
        <p>
          Accepted as friendly and incorporated without a vote, because all four sponsors agreed. It costs the paper nothing, it gives the donor bloc something to point at, and it converted two abstentions into votes in favour. Most friendly amendments are this: a delegation buying a line it can take home.
        </p>

        <H3>Amendment 3, unfriendly, to clause 3</H3>
        <p>
          <strong>Proposed by:</strong> a host state not on the sponsor list.<br />
          <strong>Text:</strong> add at the end of operative clause 3: &quot;, and calls upon donors and international financial institutions to provide predictable financing commensurate with the additional cost of such inclusion&quot;.
        </p>
        <p>
          The sponsors could not accept this as friendly, because Germany would not agree to language binding financing to inclusion in one clause. It went to a vote and <strong>passed</strong>, 24 for to 9 against. The sponsors then voted for their own amended paper, which is the ordinary outcome: an unfriendly amendment that passes is usually one the sponsors can live with and merely could not be seen to accept.
        </p>
        <p>
          That is the practical lesson about friendly and unfriendly, and the <Link href="/blog/mun-amendment-guide">amendment guide</Link> covers the mechanics. Unfriendly does not mean hostile. It means the sponsors did not all say yes, which is often a matter of who is watching rather than what the text says.
        </p>

        <H2>The vote</H2>
        <p className="gv-note">Committee of 38, quorum met, 36 voting. Written for this guide as an illustration of how a vote decomposes, not as a record of a real committee.</p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Votes</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Host states of displaced populations', '11 in favour', 'Amendment 3 attached financing to the duty in clause 3'],
                ['Major donor states', '8 in favour', 'No proportional target in clause 5, and amendment 2 named their instruments'],
                ['Development and G77 aligned states', '9 in favour', 'SDG 4 preamble and the working group in clause 6'],
                ['Sovereignty-first states', '5 against', 'Clause 1 survived amendment 1 intact'],
                ['Uncommitted', '3 abstaining', 'Supported the substance, objected to creating a new working group'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td><strong>{r[1]}</strong></td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p>
          Passed 28 in favour, 5 against, 3 abstaining. Under a simple majority threshold, abstentions are normally excluded from the calculation, so the paper needed 17 of the 33 delegations actually voting. Check your own committee&apos;s threshold before you count: the <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> sets out how each one is calculated.
        </p>
        <p>
          The instructive part is not the total. It is that the paper passed because of one amendment it opposed and one it accepted. A draft that arrives perfect and leaves unchanged is usually a draft nobody engaged with.
        </p>

        <H2>What a chair checks before accepting a draft</H2>
        <ul className="gv-check">
          <li>Required number of signatories, and none of them duplicated or absent.</li>
          <li>One grammatical sentence: no full stop until the final clause.</li>
          <li>Preambulatory clauses unnumbered and ending in commas; operative clauses numbered and ending in semicolons.</li>
          <li>No operative verb the committee is not entitled to use. A GA committee that &quot;decides that States shall&quot; gets sent back.</li>
          <li>No clause containing two separate actions, because it cannot be amended cleanly.</li>
          <li>Nothing that duplicates a clause in another draft already on the floor, which is usually a sign two blocs should merge.</li>
          <li>Plagiarism: clauses lifted verbatim from a real UN resolution or from another conference are the most common reason a paper is rejected outright.</li>
        </ul>

        <H2>Using this on your own draft</H2>
        <p>
          Take the draft you have and do the annotation exercise on it. For every operative clause, write one line on what it costs and one line naming the delegation most likely to vote against it. Any clause where you cannot name an opponent is probably too weak to be worth its line. Any clause where you cannot name the cost is probably one of the empty phrases.
        </p>
        <p>
          Then find the two delegations you have not bought and work out what preambulatory clause or what sub-clause would buy them. That conversation is <Link href="/blog/mun-bloc-building">bloc building</Link>, and it is what an unmoderated caucus is for. Before any of it, the paper has to exist: the <Link href="/blog/mun-working-paper-guide">working paper guide</Link> covers getting from a blank document to something with signatories on it. If your country&apos;s position is not written down yet, our <Link href="/blog/mun-position-paper-examples">position paper examples</Link> show what that looks like.
        </p>
      </ArticleLayout>
    </>
  );
}
