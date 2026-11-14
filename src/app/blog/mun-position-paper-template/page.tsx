import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Position Paper Template: Format, Structure and a Copy-Ready Outline';
const DESCRIPTION =
  'A copy-ready MUN position paper template with the header block, four sections, sentence starters, a filled mini example and a checklist to run before you submit.';

const FAQ: FaqItem[] = [
  {
    question: 'How long should a MUN position paper be?',
    answer:
      'Usually one page per topic, and two at most. If the conference sets a page or word limit, follow it exactly, because chairs mark down papers that ignore the instructions. A tight page with a clear stance beats two pages of background.',
  },
  {
    question: 'What font should a MUN position paper use?',
    answer:
      'Most conferences ask for Times New Roman, 12 point, single spaced with one inch margins. That is a convention, not a rule: the conference study guide or delegate handbook decides, so check it before you format anything.',
  },
  {
    question: 'How many sources does a MUN position paper need?',
    answer:
      'There is no universal number. Three to six good sources is common for a one page paper, and primary sources such as UN votes, treaties and government statements count for more than general websites. Some conferences ask for a bibliography and some do not, so check the guidelines.',
  },
  {
    question: 'What goes in the header of a MUN position paper?',
    answer:
      'The committee, the topic, your country, your name and your school. Some conferences also ask for a delegate position or a co-delegate name. Keep the header to a few lines so it does not use space the paper needs.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-position-paper-template',
  ogDescription: 'A copy-ready MUN position paper template with sentence starters and a checklist.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: 'A copy-ready MUN position paper template with sentence starters and a checklist.',
  url: 'https://gavelling.com/blog/mun-position-paper-template',
  datePublished: '2026-11-14',
  dateModified: '2026-11-14',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-position-paper-template' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Position Paper Template', item: 'https://gavelling.com/blog/mun-position-paper-template' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-position-paper-template"
        pitch="Conferences on Gavelling can collect position papers online, and delegates upload theirs from the conference page."
      >
        <p>
          A MUN position paper has a header block and four sections: an introduction, your country&apos;s policy and past actions, your proposed solutions and a short conclusion. Below is that structure as a template you can copy, with bracketed placeholders, sentence starters for every section and a short filled example so you can see what a finished section sounds like.
        </p>
        <p>
          This page is the template and the format rules. For three complete papers with a chair&apos;s notes on each, read the <Link href="/blog/mun-position-paper-examples">position paper examples</Link>. For how to research the content that goes into the brackets, read the <Link href="/blog/mun-position-paper-guide">position paper guide</Link>.
        </p>

        <H2>The Format at a Glance</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>The usual convention</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Header block', 'Committee, topic, country, delegate name, school'],
                ['Length', 'One page per topic, two at most'],
                ['Font', 'Times New Roman, 12 point'],
                ['Spacing and margins', 'Single spaced, one inch margins'],
                ['Voice', 'Third person: "Brazil believes", never "I think"'],
                ['Sections', 'Introduction, country policy, proposed solutions, conclusion'],
                ['Sources', 'Footnotes or a short source list, as the conference asks'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td><strong>{r[0]}</strong></td>
                  <td>{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Callout>
          These are conventions, not rules. Each conference sets its own length, font and citation style, usually in the study guide or delegate handbook, and the conference&apos;s version always wins over this page.
        </Callout>

        <H2>The Copy-Ready Template</H2>
        <p>
          Copy this into a blank document, replace everything in square brackets and delete the notes. Each section is one paragraph or two, which is what fits on a page.
        </p>
        <FactCard title="Header block">
          <p>
            Committee: [full committee name]<br />
            Topic: [topic exactly as the background guide words it]<br />
            Country: [your assigned country]<br />
            Delegate: [your name]<br />
            School: [your school]
          </p>
        </FactCard>
        <FactCard title="1. Introduction">
          <p>
            [Country] comes to this committee to [one sentence stating what the country wants]. [One sentence on why this topic matters to this country in particular, with one fact or figure.]
          </p>
        </FactCard>
        <FactCard title="2. Country policy and past actions">
          <p>
            [Country] has [signed, ratified, voted for, voted against or abstained on] [named treaty or resolution, with the year]. [One sentence quoting or paraphrasing an official statement, with who said it and when.] [One sentence on a national law, programme or contribution that shows the policy in practice.] [One sentence on the position of a bloc or partner the country works with.]
          </p>
        </FactCard>
        <FactCard title="3. Proposed solutions">
          <p>
            [Country] proposes that this committee [action one: who does what, by when]. [Country] further proposes [action two: who does what, by when]. [One sentence on how the proposal would be paid for or checked.] [One sentence on what the country will not accept.]
          </p>
        </FactCard>
        <FactCard title="4. Conclusion">
          <p>
            [Country] is prepared to work with [kinds of delegations or blocs] on [the area where compromise is possible]. [One sentence on the outcome the country will push for in the final resolution.]
          </p>
        </FactCard>

        <H2>Sentence Starters for Each Section</H2>
        <H3>Introduction</H3>
        <ul>
          <li>[Country] comes to this committee seeking [outcome].</li>
          <li>For [country], [topic] is a question of [security, development, sovereignty or another real stake], because [fact].</li>
        </ul>
        <H3>Country policy and past actions</H3>
        <ul>
          <li>[Country] voted in favour of resolution [number] in [year], which [what it did].</li>
          <li>As [official and title] stated in [year], [country] holds that [paraphrase].</li>
          <li>[Country] has not ratified [treaty] because [stated reason].</li>
        </ul>
        <H3>Proposed solutions</H3>
        <ul>
          <li>[Country] proposes that the committee request the [body] to [action] by [date or session].</li>
          <li>[Country] supports the creation of a [fund, working group, reporting mechanism] under [body], financed by [source].</li>
          <li>[Country] will not support text that [what it opposes], as this conflicts with [its stated position].</li>
        </ul>
        <H3>Conclusion</H3>
        <ul>
          <li>[Country] looks forward to working with delegations that share its commitment to [specific goal].</li>
          <li>[Country] will seek to ensure that the final resolution includes [one named priority].</li>
        </ul>

        <H2>A Filled Mini Example</H2>
        <p className="gv-note">
          An illustration written for this guide, not a real statement by any government. It shows the policy and solutions sections for a fictional stance on the topic of access to clean water, and it is shorter than a real paper because it covers two sections only.
        </p>
        <FactCard title="Country policy and past actions (example)">
          <p>
            Kenya supports the human right to water and sanitation recognised by the General Assembly in 2010, and its 2010 constitution guarantees every person the right to clean and safe water in adequate quantities. More than three quarters of Kenya&apos;s land is arid or semi-arid, which makes drought a regular cause of water stress for pastoral communities. Since 2010, water services have been devolved to Kenya&apos;s counties, and Kenya works with its neighbours on shared river basins such as Lake Victoria.
          </p>
        </FactCard>
        <FactCard title="Proposed solutions (example)">
          <p>
            Kenya proposes that this committee request the Secretary-General to report to the next session on funding gaps for drought-prone regions. Kenya further proposes a voluntary technology exchange, coordinated by UN-Water, that lets states with proven low-cost borehole and water-harvesting methods share them with others. Kenya will not support text that ties water aid to unrelated political conditions.
          </p>
        </FactCard>
        <p>
          Notice what each sentence carries: a named instrument, a fact about the country, or an action with an actor attached. None of it would survive swapping in a different country, which is the quickest test of whether a paper has a position in it.
        </p>

        <H2>Checklist Before You Submit</H2>
        <ul className="gv-check">
          <li>The header block names the committee, topic, country, your name and your school.</li>
          <li>The first sentence of the paper says what your country wants.</li>
          <li>Every claim about the country&apos;s policy points to a vote, a treaty, a law or a statement.</li>
          <li>Each proposed solution names who acts and, where you can, by when.</li>
          <li>The paper is in the third person and has no personal opinion in it.</li>
          <li>It is within the page or word limit, in the font and spacing the conference asks for.</li>
          <li>Sources are cited the way the conference asks.</li>
          <li>The file name and format match the submission instructions.</li>
        </ul>

        <H2>How Formats Differ by Conference</H2>
        <p>
          The structure above fits most conferences, but the document being asked for varies. Read the instructions for three things before you format.
        </p>
        <ul>
          <li><strong>UNA-USA style papers.</strong> Many American conferences follow this model: one page per topic, a header block, and a paper that covers the topic background, the country&apos;s position and its proposals.</li>
          <li><strong>THIMUN policy statements.</strong> Conferences in the THIMUN tradition often ask for a short policy statement instead of a graded paper, because the first working day goes on lobbying and merging resolutions. Keep it brief and write it as a statement of what the country will push for.</li>
          <li><strong>One paper per topic or one paper in total.</strong> If a committee has two topics, some conferences want two separate papers and others want a single document with a section for each. Check which, because it changes how much space each topic gets.</li>
        </ul>

        <H2>Citations</H2>
        <p>
          Some conferences want footnotes, some want a short source list at the end and some do not mark citations at all. If the guidelines name a style such as MLA or Chicago, use it. If they say nothing, a short numbered source list below the conclusion is a safe choice, and it should name the document, the body that issued it and the year. A source list usually sits outside the page limit, but confirm that rather than assuming it.
        </p>

        <H2>Common Mistakes</H2>
        <ul>
          <li><strong>Burying the position.</strong> Put the stance in the first sentence, not the third paragraph.</li>
          <li><strong>Describing the topic instead of the country.</strong> The chair wrote the background guide and does not need it repeated.</li>
          <li><strong>Vague proposals.</strong> &quot;Raise awareness&quot; and &quot;promote dialogue&quot; do not name an actor or a deadline, so they cannot become clauses. Our <Link href="/blog/mun-background-guide-writing">guide to writing a background guide</Link> shows how chairs frame topics, which helps you see what they will look for.</li>
          <li><strong>Leaving brackets or template text in.</strong> Search the finished file for square brackets before you send it.</li>
          <li><strong>Proposing something your country opposes.</strong> Check the voting record first. The <Link href="/blog/mun-country-research">country research method</Link> shows where to find it.</li>
        </ul>

        <H2>After the Paper</H2>
        <p>
          Your paper doubles as the outline of your first speech. The introduction becomes your opening line, and the proposals become what you say when you ask others to merge with you. Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> turns the paper into ninety seconds.
        </p>
        <p>
          If your conference runs on Gavelling, the organisers can collect position papers online and you upload yours from the conference page, so you do not need to email it to anyone.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
