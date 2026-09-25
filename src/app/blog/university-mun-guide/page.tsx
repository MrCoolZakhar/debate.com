import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'University Model UN: How It Differs From High School MUN',
  description:
    'What changes at university level: preparation depth, committee types, travel team selection, funding, staffing, and what MUN is actually worth afterwards',
  path: '/blog/university-mun-guide',
  ogDescription: 'What changes when you move from school Model UN to the university circuit.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'University Model UN: How It Differs From High School MUN',
  description: 'What changes at university level Model UN, and how to arrive ready instead of surprised.',
  url: 'https://gavelling.com/blog/university-mun-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/university-mun-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'University Model UN', item: 'https://gavelling.com/blog/university-mun-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="university-mun-guide"
        pitch="Most university societies run their own conference. Gavelling runs the committee side of it free: sessions, delegates, documents and voting, with no per-delegate charge."
      >
        <p>Plenty of people arrive at university having been the best delegate in their school and have a genuinely difficult first conference. Nothing about them got worse. The room changed: everyone has done this before, the sessions are twice as long, and nobody is going to explain what a motion is. Here is what actually differs, and what to do about it.</p>

        <H2>The step up, in one table</H2>
        <TableWrap>
          <table>
            <thead><tr><th>&nbsp;</th><th>School MUN</th><th>University MUN</th></tr></thead>
            <tbody>
              <tr><td>Session length</td><td>Two to three hours</td><td>Three to four hours, four or five sessions across a weekend</td></tr>
              <tr><td>Preparation expected</td><td>Background guide plus a position paper</td><td>Background guide, primary sources, a working knowledge of the actual institution</td></tr>
              <tr><td>Procedure</td><td>Taught in the first session</td><td>Assumed. A rules error is a cost, not a teaching moment</td></tr>
              <tr><td>Committee size</td><td>Often 30 to 50</td><td>Often 15 to 30, and smaller in crisis</td></tr>
              <tr><td>Committee types</td><td>Mostly General Assembly</td><td>Specialised agencies, crisis, historical, joint cabinets, legal bodies</td></tr>
              <tr><td>Speaking standard</td><td>Prepared speeches read well</td><td>Unscripted responses under pressure</td></tr>
              <tr><td>Who is on the dais</td><td>Older students or teachers</td><td>Experienced delegates who have won at this level</td></tr>
              <tr><td>Social programme</td><td>Usually one evening</td><td>Substantial, and part of why people go</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The single biggest change is the last row of the preparation column. At school, knowing your country&apos;s position is enough to be strong. At university it is the entry requirement, and what distinguishes delegates is knowing the institution: what this body can actually do, what it has done, what its funding mechanism is, and which of the proposals in the room are outside its mandate. A delegate who can say &quot;this committee has no authority to do that, but it can recommend it to the General Assembly, and here is the precedent&quot; wins arguments that better speakers lose.</p>

        <H2>Committee types you will meet more of</H2>
        <p>General Assembly committees still exist and are still where most first-year delegates should start. But the university circuit is weighted differently.</p>
        <ul>
          <li><strong>Specialised agencies and bodies.</strong> WHO, IAEA, UNHCR, ECOSOC commissions, regional bodies, ICJ and other legal committees. Smaller, more technical, and they reward reading the actual mandate.</li>
          <li><strong>Crisis committees.</strong> Far more common than at school, often running in parallel with a backroom staff of several people. Speeches matter less, directives and private notes matter more.</li>
          <li><strong>Historical committees.</strong> Set at a date in the past, with the information available then. The discipline is not using hindsight, and chairs notice immediately when you do.</li>
          <li><strong>Joint crisis committees.</strong> Two or more rooms acting against each other in a shared world, with a backroom mediating. The most demanding format on the circuit.</li>
          <li><strong>Cabinets and non-state bodies.</strong> You represent a person with personal powers rather than a state, which changes everything about how you negotiate.</li>
        </ul>
        <p>If you are new to crisis, read our <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link> before you rank it as a preference. Crisis is the format where school experience transfers least, and where a first-year delegate can either do extremely well or spend a weekend confused, depending largely on whether they understood the note-writing game before arriving.</p>

        <H2>How a university society actually works</H2>
        <p>Most societies do three separate things, and confusing them is why new members think the society is not for them.</p>
        <FactCard title="The three halves of a society">
          <ul>
            <li><strong>Training and internal debates.</strong> Weekly, open to everyone, no selection. This is the front door.</li>
            <li><strong>The travel team.</strong> A selected squad that attends external conferences, often with subsidised costs.</li>
            <li><strong>The society&apos;s own conference.</strong> A large organising operation running most of the year, open to anyone willing to work.</li>
          </ul>
        </FactCard>
        <p>If you do not make the travel team in your first term, the conference is the fastest route in. Organising committees are always short of people, the work is visible to the committee that picks travel teams, and running a committee teaches you more about procedure than attending one.</p>

        <H2>Selection for a travel team</H2>
        <p>Selection is competitive and often opaque, which is a polite way of saying that it frequently rewards people who are already known to the committee. You cannot fix that, but you can make the case properly.</p>
        <ul className="gv-check">
          <li><strong>Turn up to training from week one</strong> and speak in internal debates even when you are bad at them. Attendance records are usually the first filter.</li>
          <li><strong>Ask what the criteria are, in writing.</strong> A society that cannot answer has told you something useful.</li>
          <li><strong>Volunteer for the society&apos;s conference.</strong> It is the single strongest signal you can send.</li>
          <li><strong>Prepare properly for trials.</strong> Most trials are a mock committee. Research the topic as if it were real, and go for the visible roles: first speaker, drafting a paper, leading a bloc.</li>
          <li><strong>Ask for feedback after a rejection</strong> and act on the specific thing you are told.</li>
          <li><strong>Self-fund one conference if you can afford it.</strong> A delegate who has already attended at this level is a safer pick, and some societies count external results.</li>
        </ul>
        <Callout>Do not spend a year waiting to be picked. Attend an open conference independently, chair at a school conference locally, or help staff someone else&apos;s event. All three are available to anyone, and all three shorten the wait.</Callout>

        <H2>Funding, honestly</H2>
        <p>University MUN is more expensive than school MUN because the conferences are larger, further away and longer. The money usually comes from four places, and the mix varies enormously by institution.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Source</th><th>What it usually covers</th><th>What it needs</th></tr></thead>
            <tbody>
              <tr><td>Society budget</td><td>Part of delegate fees, sometimes travel</td><td>Membership income and a budget submitted on time</td></tr>
              <tr><td>Students&apos; union grants</td><td>Travel, equipment, sometimes accommodation</td><td>An application, usually with deadlines months ahead</td></tr>
              <tr><td>Department or faculty</td><td>Occasional support for academically linked trips</td><td>A case connecting the conference to the curriculum</td></tr>
              <tr><td>Your own pocket</td><td>The rest, which is often most of it</td><td>Nothing, which is precisely the access problem</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two practical points. First, the society&apos;s own conference is usually its largest income source, which is why organising it matters so much and why the finance role on an organising committee is real work. Second, ask about hardship funding before you decide you cannot afford a conference. Many societies have a quiet subsidy that is never advertised, and many students&apos; unions have an access fund that applies to society activities.</p>

        <H2>Chairing and staffing arrives sooner than you expect</H2>
        <p>At school, chairing is for the final year. At university, second-year students chair regularly and first-years staff crisis backrooms, run logistics or serve on a secretariat. This happens because conferences need dozens of staff and there are only three or four year groups to draw on.</p>
        <p>Take it earlier rather than later. Chairing is the fastest way to understand procedure properly, it is what makes your <Link href="/blog/mun-on-your-cv">CV entry</Link> a leadership entry rather than a participation one, and it is the qualification that gets you invited to chair at other conferences, which is how people travel on the circuit without paying delegate fees. Our guide on <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link> covers applying. Our <Link href="/blog/how-to-chair-first-mun">first-time chair guide</Link> and <Link href="/blog/mun-chair-script">chair script</Link> are the two things worth reading before your first committee, and you can rehearse the mechanics free in a <Link href="/create/sessions">practice session</Link> before you stand in front of thirty people.</p>

        <H2>Running your society&apos;s own conference</H2>
        <p>For most societies this is the biggest thing they do: several hundred delegates, a venue, a budget in the thousands, sponsors, accommodation, and a secretariat of twenty working for most of the year. It is also, in career terms, the most valuable thing available to you in the society, because it is genuine operational management with real money and real deadlines.</p>
        <p>The roles break down predictably: a secretary-general, an academics lead over background guides and chairs, delegate relations handling registration and schools, logistics over venue and catering, finance over the budget and sponsorship, and marketing. Start in one of the smaller roles in your first year and take a senior one later. Our <Link href="/blog/mun-conference-planning">conference planning guide</Link> covers the timeline, and the <Link href="/blog/mun-director-guide">director guide</Link> covers the secretariat side.</p>

        <H2>Academic overlap, and the time cost</H2>
        <p>MUN genuinely overlaps with some degrees and barely with others. It helps most in international relations, politics, law, history, economics and development studies, where the research and the institutional knowledge are directly reusable. It is still worth doing in any other degree, but as a skills activity rather than an academic one, and you should be honest with yourself about which it is for you.</p>
        <p>The time cost is real and larger than at school. A single external conference is a four-day commitment plus preparation. A senior role on an organising committee can be ten hours a week for months, spiking hard in the final fortnight. Two rules keep it sustainable: do not take a senior organising role in the same term as your heaviest assessment, and do not take one in your final year unless you have already worked out what it will cost you.</p>
        <Callout>Societies rarely tell new members that the senior roles are a real workload, because they are recruiting. Ask a current post-holder how many hours it takes in the busy month, and believe the answer.</Callout>

        <H2>What it is actually worth afterwards</H2>
        <p>Be precise about this, because both the overselling and the dismissal are common. See also our honest answer to <Link href="/blog/is-mun-worth-it">whether MUN is worth it</Link>.</p>
        <ul>
          <li><strong>Diplomacy and international organisations.</strong> MUN is not a qualification and does not substitute for language skills, a relevant degree or an entrance examination. It is a credible signal of interest and it gives you something concrete to talk about. Treat it as evidence, not as a route.</li>
          <li><strong>Law.</strong> The transferable parts are real: reading instruments closely, arguing from text, structuring an argument under time pressure. Mooting is the closer analogue, and doing both is better than doing either.</li>
          <li><strong>Policy, think tanks and the civil service.</strong> The most direct transfer: drafting, negotiating text between parties who disagree, and writing briefly for someone who will not read past the first paragraph.</li>
          <li><strong>Consulting, graduate schemes and assessment centres.</strong> The single most reusable experience on the list. Group exercises at assessment centres are, in substance, an unmoderated caucus with a marker watching.</li>
          <li><strong>Anything at all.</strong> Running a conference is project management with a budget, a team and a fixed date. That is what you should write on a CV, in those words, with the numbers attached.</li>
        </ul>
        <p>What to put on the application is the role and the scale, not the hobby: &quot;Director of Logistics for a 400-delegate international conference, managing a budget of X and a team of nine&quot; says more than three years of committee attendance. Individual awards are worth a line, not a paragraph.</p>

        <H2>If your university has no society</H2>
        <p>Start one. It is less work than it sounds and the barrier is almost entirely administrative: your students&apos; union will have a process requiring a constitution, a committee of two or three named officers, and a minimum number of founding members.</p>
        <ol>
          <li>Find four people and register the society before the deadline for the next academic year</li>
          <li>Run weekly training in a free room, using one topic and a simple ruleset, and just debate</li>
          <li>Take a small team to one <Link href="/blog/choosing-mun-conferences">external conference</Link> in your first year and nothing more ambitious</li>
          <li>Build a relationship with a nearby school conference and supply chairs, which gets your members experience at no cost</li>
          <li>Run your own one-day conference in year two, for schools rather than universities, which is far easier to fill</li>
        </ol>
        <p>The commonest failure is trying to host a large university conference immediately. Build the membership, then the reputation, then the event. When you get there, see <Link href="/blog/start-a-mun-conference">how to start a MUN conference</Link>. Free committee software helps here more than anywhere, because a new society has no budget: you can run internal training sessions and your first school conference from a laptop at <Link href="/create/sessions">gavelling.com/create</Link> without paying anything per delegate, and browse <Link href="/conferences/explore">open conferences</Link> to find the ones worth taking your first team to.</p>
      </ArticleLayout>
    </>
  );
}
