import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Choosing MUN Conferences: A Circuit Guide for Teams',
  description:
    'How to build a season that develops your team instead of exhausting it, and how to read a conference before you commit.',
  path: '/blog/choosing-mun-conferences',
  ogDescription: 'How to choose MUN conferences and build a season that develops your team.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Choosing MUN Conferences: A Circuit Guide for Teams',
  description: 'How to choose Model UN conferences and build a season around your team.',
  url: 'https://gavelling.com/blog/choosing-mun-conferences',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/choosing-mun-conferences' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Choosing MUN Conferences', item: 'https://gavelling.com/blog/choosing-mun-conferences' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="choosing-mun-conferences"
        pitch="Browse conferences by date, city and committee on a directory and a map, then see the real conference page rather than a listing."
      >
        <p>Most teams choose conferences the same way every year: the one they went to last year, plus whichever one somebody&apos;s friend mentioned. That produces a season that is either too easy to develop anyone or too hard to be enjoyable, and often both at once for different students. This guide is about choosing deliberately: the four things that actually differ between conferences, how to read one before you commit money, and how to build a season of three that leaves your team better than it found it.</p>

        <H2>The four axes</H2>
        <p>Every conference you are considering differs on four axes, and confusing them is how teams end up disappointed.</p>
        <p><strong>Size.</strong> Under 100 delegates, 100 to 400, or over 400. Size determines how much floor time each delegate gets, which is the single biggest driver of whether a first-year delegate has a good weekend. In a committee of 15 a nervous delegate speaks four times. In a committee of 60 they may not speak at all.</p>
        <p><strong>Circuit.</strong> Which rules and which culture. A THIMUN-style conference and a North American one produce <Link href="/blog/mun-procedure-styles-compared">genuinely different experiences</Link>, and a delegate trained for one will be visibly out of step in the other for the first half day.</p>
        <p><strong>Competitiveness.</strong> Some conferences are collaborative, with awards almost incidental. Others are intensely competitive, with delegates who have done thirty conferences, a crisis arms race and a clear circuit reputation. Neither is better. Putting a first-year delegate in the second is unkind.</p>
        <p><strong>Cost.</strong> Fee, travel, accommodation and staff cover. Cost decides how many conferences you run, which means it also decides your development plan, which is why the season budget matters more than any single conference budget. Our guide to <Link href="/blog/mun-team-fundraising">MUN team fundraising</Link> covers that arithmetic.</p>
        <Callout>Write down which axis matters most for this particular group of students before you look at a single conference. Teams that skip that step choose on reputation, and reputation is a fifth axis that correlates with none of the first four.</Callout>

        <H2>Matching conference to experience</H2>
        <p>A useful progression, adjusted for your own students rather than followed literally.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Stage</th><th>What they need</th><th>What to look for</th></tr></thead>
            <tbody>
              <tr><td>First year, first conference</td><td>To speak at all, and to enjoy it</td><td>Small or local, beginner committees, large GA committees avoided, one day if possible, short travel</td></tr>
              <tr><td>First year, second conference</td><td>Procedure confidence</td><td>Medium size, mixed experience, a committee with a topic they already know</td></tr>
              <tr><td>Second year</td><td>To be pushed</td><td>Larger regional conference, a <Link href="/blog/mun-committee-types">specialised agency or a smaller crisis committee</Link>, competitive but not elite</td></tr>
              <tr><td>Third year</td><td>A real test, and something for the application</td><td>A recognised conference with a strong circuit, Security Council or crisis, genuine competition</td></tr>
              <tr><td>Every year, for everyone</td><td>Volume and variety</td><td>At least one cheap or online conference so the squad is larger than the travelling team</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The common failure is taking the whole team to one expensive flagship, which means the strongest delegates are stretched, the newest are overwhelmed, and nobody gets a second conference to apply what they learned. Two cheaper conferences develop a team more than one prestigious one, almost every time.</p>

        <H2>Reading a conference before you commit</H2>
        <p>You can learn most of what matters in half an hour on the internet, before you email anyone.</p>
        <H3>Read one background guide, end to end</H3>
        <p>It is the best single predictor of academic quality available to you. A good guide is 10 to 20 pages, has real sources, describes bloc positions rather than restating a Wikipedia summary, and asks guiding questions a delegate can research. A guide that is four pages, has no sources, or is visibly last year&apos;s with the date changed tells you what the committee will be like.</p>
        <H3>Read the rules of procedure</H3>
        <p>Not for pleasure, but to check that they exist, that they are specific about voting thresholds and motions, and that you recognise the system. If there are no published rules, the rules will be invented in the room by an 18-year-old chair, which your delegates will find out at 09:30 on day one. Our <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> is a good comparison point for what a complete set contains.</p>
        <H3>Test the secretariat</H3>
        <p>Send one genuine question, such as whether a delegation of nine can be split across three committees, or what the fee includes. The speed and quality of the reply is the best available proxy for how the conference will be run. A conference that takes eleven days to answer an advisor in October will not be reachable in March.</p>
        <H3>Look at last year</H3>
        <p>Photographs of full rooms, a published list of attending schools, an award list, a social account with posts from the actual conference rather than only from the run-up. All of these are evidence that the event happened at the size it claimed.</p>

        <H2>Red flags</H2>
        <ul className="gv-check">
          <li>No published rules of procedure</li>
          <li>No refund or cancellation policy anywhere on the site</li>
          <li>The fee is not published, or only appears after you register interest</li>
          <li>No named secretariat, only a logo and an info@ address</li>
          <li>No evidence the conference ran last year, and no statement that it is the first year</li>
          <li>A fee that is well above the regional norm with no explanation of what it covers</li>
          <li>Payment requested to a personal account rather than to an institution or a payment provider</li>
          <li>Committee topics published two weeks before the conference</li>
          <li>The site still shows last year&apos;s dates</li>
        </ul>
        <p>A first-year conference triggers several of these honestly and can still be excellent. The distinction is whether they tell you. &quot;This is our first year, we expect 90 delegates, here is our refund policy&quot; is a conference worth supporting. Silence on the same facts is not.</p>
        <Callout>Payment is the one to be firm about. Fees should go to a school, a university society or a payment provider, never to an individual&apos;s account, and there should be an invoice with the conference&apos;s name on it. Your school&apos;s finance office will insist on this anyway.</Callout>

        <H2>Circuits, and what your students learn from each</H2>
        <p>The circuit shapes the experience more than the venue does.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Circuit</th><th>Character</th><th>Good for</th></tr></thead>
            <tbody>
              <tr><td><Link href="/blog/thimun-rules-of-procedure">THIMUN style</Link></td><td>Resolution-centred, lobbying and merging before formal debate, often no individual awards, frequently international</td><td>Drafting skill, collaboration, students who dislike an award race</td></tr>
              <tr><td>North American style</td><td>Speakers list and caucus driven, individual awards, fast, strong crisis tradition</td><td>Speaking under pressure, competitive delegates, crisis</td></tr>
              <tr><td>Local and school-run</td><td>Small, cheap, variable, close to home</td><td>First conferences, building squad depth, low risk</td></tr>
              <tr><td><Link href="/blog/university-mun-guide">University-hosted</Link></td><td>Large, well-organised, strong chairs, competitive</td><td>Third-year delegates, and students looking at that university</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>If you only ever attend one circuit, your delegates become excellent at one format and lost in the other. A season that includes both is worth the disruption, as long as you brief them: an experienced North American delegate arriving at a THIMUN conference and treating lobbying time as unmoderated caucus will have an uncomfortable morning. <Link href="/blog/unmoderated-caucus-guide">Our guide to unmoderated caucus</Link> is a useful primer for the differences in how that time is used.</p>

        <H2>Travel, visas and the lead time nobody plans for</H2>
        <p>International conferences are chosen in September and prepared in June. The constraint is almost never the conference; it is the paperwork.</p>
        <ul>
          <li><strong>Passports.</strong> Check every student&apos;s expiry now, not in February. Many countries require six months of validity beyond the travel date.</li>
          <li><strong>Visas.</strong> Lead times of six to twelve weeks are normal and can be longer. You will need an <Link href="/blog/mun-visa-invitation-letters">invitation letter</Link> from the conference, so ask for it as soon as you register and ask what it can and cannot say.</li>
          <li><strong>Consent and insurance.</strong> Your school&apos;s process, which is longer than you think for an overseas trip.</li>
          <li><strong>The school calendar.</strong> Check exam dates, mock exams and other trips before you commit a deposit.</li>
        </ul>
        <p>Assume the trip needs six months from decision to departure, and treat any conference requiring a visa as a decision you make a full year ahead.</p>

        <H2>Online conferences: what they are and are not for</H2>
        <p>Online conferences are excellent for three things: they cost almost nothing, they let you field a much larger squad than you can transport, and they are a low-risk first experience for a nervous delegate who can sit in their own room. They are poor at two: the informal diplomacy that happens in a corridor, and the sustained focus required over two days on a screen.</p>
        <p>Use them as development rather than as the season&apos;s highlight. Two online conferences in the autumn to give eighteen students committee experience, followed by a travelling team of ten in the spring, is a stronger year than taking ten students to three in-person events. <Link href="/blog/mun-online-committees">Our guide to online committees</Link> covers how they actually run.</p>

        <H2>Budget the season, not the conference</H2>
        <p>The question is not &quot;can we afford this conference&quot;. It is &quot;what does this conference cost us in conferences we then cannot attend&quot;. A flagship that costs three times a regional event is a decision to attend one event instead of three, which for most teams is the wrong trade.</p>
        <p>Build a single sheet at the start of the year with every candidate conference, its date, its total cost for your likely delegation size, and its purpose in your plan. Then choose against the total, and watch the early-bird deadlines: a 15 to 20 per cent saving for registering in October rather than January is usually the largest single discount available to you and it costs you nothing but a decision made on time.</p>

        <H2>Building a season of three</H2>
        <p>A structure that works for most school teams and scales up or down.</p>
        <ol>
          <li><strong>One local, early.</strong> Cheap, small, low stakes, ideally in the autumn. Everyone goes, including students who joined three weeks ago. Its job is to turn club members into delegates.</li>
          <li><strong>One development conference, mid-season.</strong> Medium size, a step up in competitiveness, a different circuit if you can. Its job is to expose your second-years to a harder room while there is still a season left to improve in.</li>
          <li><strong>One target conference, late.</strong> The one you have been building towards, with a selected delegation, real preparation and a serious commitment. Its job is to reward and to test.</li>
        </ol>
        <p>Between them, run your own internal mock committees. This is where most of the actual improvement happens and it costs nothing: a free session at <Link href="/create/sessions">/create</Link> takes seconds to set up, students join on their phones with a six-character code, and you can run a real speakers list, motions and a vote in a classroom hour. If you are building that training into a term plan, our <Link href="/blog/mun-conference-preparation">conference preparation guide</Link> maps the weeks before an event.</p>

        <H2>A conference evaluation scorecard</H2>
        <p>Score each candidate out of 3 on each line. Anything under about 18 needs a conversation before you commit money.</p>
        <FactCard title="Score each out of three">
          Date fits our calendar. Total cost per delegate is affordable within our season budget. Size matches the delegates we would send. Circuit and rules are published and we understand them. Background guides are good. Committees suit our students&apos; experience. The secretariat replied promptly and helpfully. Refund and cancellation terms are published. Evidence it ran last year at the claimed size. Travel and accommodation are workable. Accessibility needs of our students can be met. There is a financial aid route if we need one.
        </FactCard>
        <p>The last two lines are the ones teams skip and then discover in March. Ask about step-free access, dietary requirements and quiet space before you pay a deposit, not after, and ask about financial aid even if you think you do not need it, because most conferences have some and much of it goes unclaimed.</p>

        <H2>Where to find conferences</H2>
        <p>Directories and maps are how most advisors find events outside their immediate circle, because they let you search by geography and date rather than by name. Gavelling runs a free directory at <Link href="/conferences/explore">/conferences/explore</Link>, where each conference has its own page rather than a row in a table, which is the difference between a listing you can evaluate and one you have to email about.</p>
        <p>Beyond that: regional MUN associations, the conference lists your circuit&apos;s larger events publish, the advisors you meet at conferences, and the schools your students already compete against. The best source is still another advisor who went last year, which is a good reason to introduce yourself in the lobby.</p>
        <p>We deliberately do not publish a &quot;best conferences&quot; ranking. The right conference for a team of six first-year students and the right one for a delegation of twelve third-years are not the same event, and a ranking would pretend otherwise.</p>

        <H2>Booking, and what you are committing to</H2>
        <p>When you register you are usually committing to a delegation size, and reducing it later is at best awkward and at worst non-refundable. Three habits protect you.</p>
        <ul>
          <li><strong>Register slightly under</strong> your expected number and add delegates later. Most conferences will take two more. Very few will refund two fewer.</li>
          <li><strong>Read the refund policy before paying</strong>, specifically the dates. &quot;Refundable until 30 days before&quot; is normal. &quot;Non-refundable&quot; from the moment of payment is a risk you should price.</li>
          <li><strong>Collect parental commitment before you commit school money.</strong> A signed form and a deposit from families, held before the conference deadline, is what stops your budget absorbing two dropouts.</li>
        </ul>
        <p>Then, once the season is chosen, the job changes from selection to preparation. <Link href="/blog/mun-faculty-advisor-guide">The faculty advisor guide</Link> covers the programme side of the year that follows.</p>
      </ArticleLayout>
    </>
  );
}
