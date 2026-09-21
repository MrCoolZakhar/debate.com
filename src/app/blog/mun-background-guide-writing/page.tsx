import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Write a MUN Background Guide (Study Guide): Structure, Template and Schedule',
  description:
    'A structure that produces a guide delegates actually read, a page budget for each section, and a six-week schedule that gets it done on time.',
  path: '/blog/mun-background-guide-writing',
  ogDescription: 'The structure, page budget and schedule for a MUN background guide.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Write a MUN Background Guide (Study Guide): Structure, Template and Schedule',
  description: 'The structure, page budget and schedule for a MUN background guide.',
  url: 'https://gavelling.com/blog/mun-background-guide-writing',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-background-guide-writing' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Background Guide Writing', item: 'https://gavelling.com/blog/mun-background-guide-writing' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-background-guide-writing"
        pitch="Gavelling gives every committee a page delegates can reach the guide from, and a room to debate it in."
      >
        <p>A background guide has one job: to raise the floor of the debate. It is not a literature review, it is not proof that you read the sources, and it is not a place to demonstrate that you know more than your delegates. It is the document that makes the least prepared person in the room capable of a useful first speech. This guide gives you the structure, a page budget for each part, and a schedule that gets it written alongside everything else you are doing.</p>

        <H2>What the guide is for</H2>
        <p>Picture the delegate who reads it. They are fifteen or nineteen, they have been allocated a country they had to look up, and they have one evening. They will read your guide once, skim it once more on the train, and arrive with three facts and an instinct.</p>
        <p>Everything about how you write follows from that. The guide succeeds if it produces a room where nobody has to spend the first hour establishing what the committee is arguing about, and where the arguments made are the real ones rather than the obvious ones. It fails if it is accurate, thorough, well cited and 46 pages, because then nobody has read it and the first session is a seminar you have to teach from the dais.</p>
        <Callout>Write for the delegate who will read it once. Every sentence that only makes sense to someone who has read the whole guide twice is a sentence to cut.</Callout>

        <H2>The standard structure and what each part is worth</H2>
        <p>Circuits vary, but almost every guide that works contains these parts in this order. The page budget below is for a single-topic committee at a two or three day conference. A two-topic committee repeats the topic block and keeps everything else the same length.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Section</th><th>Pages</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr><td>Letter from the dais</td><td>0.5 to 1</td><td>Says who you are and how the committee will be run</td></tr>
              <tr><td>Committee mandate and powers</td><td>1 to 1.5</td><td>Says what this body can and cannot do</td></tr>
              <tr><td>Topic introduction</td><td>1</td><td>States the problem in plain language</td></tr>
              <tr><td>Background and history</td><td>2 to 3</td><td>Only the history that explains the present deadlock</td></tr>
              <tr><td>Current situation</td><td>2 to 3</td><td>Where things stand now, with dates and numbers</td></tr>
              <tr><td>International action so far</td><td>1.5 to 2</td><td>Resolutions, treaties, agencies, and what each failed to fix</td></tr>
              <tr><td>Bloc positions</td><td>1.5 to 2</td><td>Who wants what, and why they cannot all have it</td></tr>
              <tr><td>Questions a resolution must answer</td><td>0.5 to 1</td><td>The most used page in the document</td></tr>
              <tr><td>Further reading</td><td>0.5</td><td>Five to ten sources, annotated</td></tr>
              <tr><td>Bibliography</td><td>1 to 2</td><td>Everything you cited</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Total: 12 to 17 pages for one topic, 18 to 25 for two. Conferences that set a limit usually set it near these numbers.</p>

        <H2>The chair&rsquo;s letter</H2>
        <p>Half a page. It has exactly two jobs, and most letters do neither.</p>
        <p>The first is to be human. Name, what you study or where you go to school, how you came to MUN, and one sentence on why this topic. Delegates arrive nervous and the letter is the first evidence about whether the dais will be pleasant. Two hundred words of warmth does more for your committee than a paragraph listing your awards, which reads as a warning.</p>
        <p>The second is to set expectations you will actually hold. Say what you value: research over volume, engagement across blocs, papers that make concessions. Say what the rules will be about the things chairs usually leave implicit, for example whether you will take points of information, whether notes are passed, and when position papers are due. A delegate who reads &ldquo;I would rather hear three well sourced speeches from you than ten&rdquo; behaves differently for two days.</p>
        <p>End with your email and a genuine invitation to use it. Then answer it.</p>

        <H2>Committee mandate: one page you cannot skip</H2>
        <p>This is the section most guides do worst, and the one that causes the most damage in the room. If delegates do not know the committee&rsquo;s powers, they write resolutions that mandate things the body cannot mandate, and you spend the conference explaining why the General Assembly cannot authorise a deployment.</p>
        <p>Cover four things, briefly:</p>
        <ul>
          <li><strong>Founding instrument.</strong> Which Charter article or which resolution created the body, by number.</li>
          <li><strong>What its output is.</strong> Binding decisions, recommendations, reports, budget lines. Name it precisely. A General Assembly resolution recommends; a Security Council resolution under Chapter VII can decide.</li>
          <li><strong>Membership and voting.</strong> How many seats, what majority passes a substantive question, whether any delegation holds a veto. For the Security Council, our <Link href="/blog/mun-security-council-guide">guide to the UNSC</Link> covers the procedural differences in detail.</li>
          <li><strong>What is out of scope.</strong> One sentence. &ldquo;This committee cannot amend the Charter and cannot authorise the use of force&rdquo; saves five rulings.</li>
        </ul>

        <H2>The topic section, in five moves</H2>
        <p>The strongest topic sections follow the same internal order, whatever the subject. Think of it as setting, actors, conflict, state of play, deadlock.</p>

        <H3>Setting</H3>
        <p>One page. What the problem is, stated so a reader with no background understands it, with the scale attached. Quantities matter here: a figure with a source and a date is worth a paragraph of adjectives. If the figure is contested, say who contests it, because that disagreement is often the debate.</p>

        <H3>Actors</H3>
        <p>Who has power over this problem. States, yes, but also agencies, funds, regional organisations, companies, and where relevant armed groups or courts. Delegates consistently underestimate non-state actors, because guides consistently omit them.</p>

        <H3>Conflict</H3>
        <p>Not &ldquo;this is a difficult issue&rdquo;. Name the trade-off. Somebody wants a thing that costs somebody else something specific: sovereignty, money, access, precedent. If you cannot write the trade-off in one sentence, you have not finished researching.</p>

        <H3>State of play</H3>
        <p>What has been tried, with citations. This is where you list the resolutions and instruments by name and number, and, crucially, say what each one failed to do. &ldquo;Resolution 2321 (2016) imposed X; implementation reporting has been inconsistent because Y&rdquo; is a sentence that produces good operative clauses. A bare list of resolution numbers produces delegates who cite them without knowing what is in them.</p>

        <H3>Deadlock</H3>
        <p>Why it is still unsolved. If the honest answer is that two permanent members disagree, write that. Guides that pretend a problem is unsolved for technical reasons produce committees that solve the technical problem and never touch the politics.</p>

        <H2>Bloc positions without telling delegates what to think</H2>
        <p>This is the section with the sharpest craft problem. Delegates need to know roughly where the fault lines run, or the first day is wasted discovering them. But a guide that says &ldquo;the European bloc will push for X&rdquo; scripts the committee, and scripted committees are dull and easy to award badly.</p>
        <p>Three rules that hold the balance:</p>
        <ul>
          <li><strong>Describe interests, not proposals.</strong> &ldquo;Major exporters have an interest in keeping verification voluntary&rdquo; leaves the delegate to invent the clause. &ldquo;Major exporters will propose voluntary verification&rdquo; writes it for them.</li>
          <li><strong>Group by interest, not geography.</strong> Real coalitions in these debates cut across regions. Grouping by continent teaches delegates a false map of the room.</li>
          <li><strong>Name the delegations who do not fit.</strong> Every topic has two or three states whose position is counter-intuitive. Flagging them is the single most useful thing you can do for the quality of the negotiation, and it rewards the delegates who read carefully. Our guide to <Link href="/blog/mun-bloc-building">bloc building</Link> is what those delegates will do with it.</li>
        </ul>
        <Callout>If you can predict the final resolution from your own bloc section, it is too prescriptive. Rewrite it as interests and let the room do the arithmetic.</Callout>

        <H2>Questions a resolution must answer</H2>
        <p>Six to ten questions, half a page, and by some distance the most used part of the guide. Delegates write position papers against it, blocs use it as a drafting checklist, and you will use it from the dais when the committee wanders.</p>
        <p>Good questions are specific enough to be answerable in an operative clause and open enough to have more than one answer:</p>
        <ul>
          <li>&ldquo;Which body should verify compliance, and who funds it?&rdquo;</li>
          <li>&ldquo;Should assistance be conditional, and on what?&rdquo;</li>
          <li>&ldquo;What happens to existing obligations under the 2015 framework?&rdquo;</li>
          <li>&ldquo;What is the reporting cycle, and what is the consequence of not reporting?&rdquo;</li>
        </ul>
        <p>Bad questions are essay prompts: &ldquo;How can the international community work together to address this challenge?&rdquo; has no answer that is not a preamble.</p>

        <H2>Sources, citation and the further reading page</H2>
        <p>Pick one citation standard and hold it for the whole document. Chicago notes, APA and MLA are all acceptable; what is not acceptable is three styles in one guide. If your conference specifies a standard, use theirs.</p>
        <p>Where to source from, in descending order of reliability for MUN purposes:</p>
        <ul>
          <li><strong>Primary UN documents.</strong> The UN Digital Library holds resolutions, meeting records and voting data. A resolution number with a year is checkable; a news summary of it is not.</li>
          <li><strong>Treaty text.</strong> The UN Treaty Collection gives you the actual articles and, usefully, the reservations states entered. Reservations are where the real positions are.</li>
          <li><strong>Agency and specialised body reports.</strong> WHO, IAEA, UNHCR, IPCC, World Bank. Cite the report and the year, and be careful with figures that are revised annually.</li>
          <li><strong>Reputable journalism and academic work</strong> for interpretation and for the politics that documents omit.</li>
        </ul>
        <p>The further reading page is separate from the bibliography and should be short: five to ten items, each with one line saying what it gives the reader and roughly how long it takes. &ldquo;Twelve pages, the clearest summary of the verification dispute&rdquo; gets read. A list of 30 unannotated links does not.</p>

        <H2>Readability, and why 40 pages is a failure</H2>
        <p>Length is the most common failure mode in background guides, and it is almost always caused by a chair writing to prove effort rather than to be used. Some hard rules:</p>
        <ul className="gv-check">
          <li>No paragraph longer than six lines. Break it.</li>
          <li>A subheading every page and a half. Delegates navigate by scanning.</li>
          <li>Bold the term the first time it is defined, and define every acronym once.</li>
          <li>Two or three images at most: a map, a timeline, one chart. They earn their place only if they carry information the text does not.</li>
          <li>Page numbers and a contents page with them. Delegates quote your guide back to you by page number.</li>
          <li>Export to PDF. Not a link to a live document, which will be edited after they read it.</li>
        </ul>
        <p>If you are over budget, cut history first. The background section is where excess accumulates, and almost none of it changes what a delegate says in committee.</p>

        <H2>A six-week writing schedule</H2>
        <p>Written alongside a degree or A-levels, six weeks is enough if the weeks are shaped. This is the schedule that fails least often.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Week</th><th>Work</th><th>Output</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Read widely, take notes with citations attached from the first line</td><td>A one-page outline and the ten questions the topic really turns on</td></tr>
              <tr><td>2</td><td>Primary documents: resolutions, treaty text, agency reports</td><td>A source list and a timeline of what has been tried</td></tr>
              <tr><td>3</td><td>Draft mandate, topic introduction, background</td><td>Roughly half the guide, rough</td></tr>
              <tr><td>4</td><td>Draft current situation, international action, blocs</td><td>A complete ugly draft</td></tr>
              <tr><td>5</td><td>Write the questions, the letter, further reading. Cut to budget</td><td>A finished draft, in budget</td></tr>
              <tr><td>6</td><td>Secretariat review, edits, proofread, typeset, export</td><td>The published PDF</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two notes on this. Divide by section with your co-chair, never by &ldquo;you write and I edit&rdquo;, which produces one person doing the work and one person feeling guilty. And build the bibliography as you go: reconstructing citations in week six costs an entire evening and is the commonest reason a guide ships late.</p>

        <H2>Review, and the AI question</H2>
        <p>Expect the academic team to send edits, and expect some of them to be about tone rather than content. Take them. The one thing worth pushing back on is a cut that removes the deadlock, because a guide without the deadlock produces a committee without a debate.</p>
        <p>Many conferences are now writing down a policy on AI assistance for background guides, and more will by next season. The sensible version, and the one most secretariats are converging on, distinguishes drafting help from sourcing: using a model to restructure a paragraph you wrote is unremarkable, and using one to generate facts, citations or resolution numbers is not, because it fabricates them confidently and delegates then cite the fabrication in committee. If your conference has a policy, follow it and say in the bibliography what you used. If it does not, verify every number and every document reference against the primary source yourself before it ships. That is the standard your delegates will be held to in their position papers, and it is the one that protects you when a delegate quotes your guide back at you from the floor.</p>

        <H2>After it is published</H2>
        <p>The guide is not finished when it ships, it is finished when the conference ends. Keep a short list of every question delegates email you, because those are the gaps, and the same gaps will appear next year. Reread your own questions-a-resolution-must-answer page the night before the conference: it is the fastest way back into a topic you wrote six weeks ago, and it is what you will steer the committee with when debate drifts. If you want the rest of the preparation in order, <Link href="/blog/how-to-chair-first-mun">how to chair your first MUN committee</Link> picks up where this leaves off, and <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link> covers the application that got you here.</p>
      </ArticleLayout>
    </>
  );
}
