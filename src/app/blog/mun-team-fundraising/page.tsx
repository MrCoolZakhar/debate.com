import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Team Fundraising: How to Pay for Conferences',
  description:
    'Nine ways school Model UN teams actually raise the money, ranked by what they return per hour of work.',
  path: '/blog/mun-team-fundraising',
  ogDescription: 'Nine ways MUN teams raise conference money, ranked by return per hour.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Team Fundraising: How to Pay for Conferences',
  description: 'Nine ways school MUN teams raise the money for conference fees and travel.',
  url: 'https://gavelling.com/blog/mun-team-fundraising',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-team-fundraising' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Team Fundraising', item: 'https://gavelling.com/blog/mun-team-fundraising' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-team-fundraising"
        pitch="Practise on real software for nothing: a free session takes seconds to create, so training costs your budget zero."
      >
        <p>This guide is about raising money to <strong>attend</strong> conferences: fees, coaches, hotels, the things that stop a delegate going. It is not about funding a conference you are hosting, which is a different problem with different funders and is covered in our guide to <Link href="/blog/mun-conference-sponsorship">conference sponsorship</Link>. If you are a faculty advisor or a club treasurer looking at a season that costs more than you have, start here.</p>

        <H2>Build the number before you raise a penny</H2>
        <p>Almost every MUN fundraising effort that fails, fails because nobody wrote down the target. &quot;We need money for MUN&quot; raises nothing. &quot;We need 2,400 to take twelve delegates to two conferences, and we have 900&quot; raises money, because it is a question a person can answer.</p>
        <p>Build it per conference, per delegate, then add the things people forget.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Line</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>Conference fee per delegate</td><td>Check whether it includes meals. Many do not.</td></tr>
              <tr><td>Faculty advisor fee</td><td>Some conferences charge one, some waive it. Ask.</td></tr>
              <tr><td>Travel</td><td>Coach hire is usually cheaper than rail for 10 or more, and is one invoice.</td></tr>
              <tr><td>Accommodation</td><td>Per room, not per student. Rooms of three or four change the total dramatically.</td></tr>
              <tr><td>Meals not covered</td><td>Breakfast and one evening meal per night is the usual gap.</td></tr>
              <tr><td>Staff costs</td><td>Cover for the advisor, <Link href="/blog/mun-chaperone-guide">second adult travel</Link>, sometimes overnight pay. Your school will tell you.</td></tr>
              <tr><td>Materials</td><td>Printing, placards, folders. Small, real.</td></tr>
              <tr><td>Contingency</td><td>10 per cent. Something will move.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Do this for the whole season, not one trip. Seasonal budgeting is what lets you take a cheap local conference in November so that you can afford the expensive one in March, and it is the single biggest structural saving available to a school team.</p>
        <Callout>Write the number on one page with the per-delegate cost at the bottom. Every conversation below, with your head teacher, a Rotary club or a parent, goes better when you can hand over that page.</Callout>

        <H2>The nine sources, ranked by return per hour</H2>
        <p>Effort here means volunteer hours, including the ones you did not plan for. The typical returns are the bands school teams generally see and vary enormously by country, school and community, so treat them as shape rather than promise.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Source</th><th>Effort</th><th>Typical return</th><th>Lead time</th></tr></thead>
            <tbody>
              <tr><td>School or department budget</td><td>Low</td><td>Large</td><td>Whole academic year</td></tr>
              <tr><td>Alumni</td><td>Low</td><td>Medium to large</td><td>4 to 8 weeks</td></tr>
              <tr><td>Grants and civic clubs</td><td>Medium</td><td>Medium to large</td><td>2 to 6 months</td></tr>
              <tr><td>Local business sponsorship</td><td>Medium</td><td>Medium</td><td>6 to 10 weeks</td></tr>
              <tr><td>Student subscriptions</td><td>Low</td><td>Medium, predictable</td><td>Immediate</td></tr>
              <tr><td>Conference financial aid</td><td>Very low</td><td>Medium</td><td>Before the fee deadline</td></tr>
              <tr><td>Parent association</td><td>Low</td><td>Small to medium</td><td>One meeting cycle</td></tr>
              <tr><td>Crowdfunding</td><td>Medium</td><td>Small to medium</td><td>3 to 6 weeks</td></tr>
              <tr><td>Events (bake sale, quiz, auction)</td><td>High</td><td>Small</td><td>4 to 8 weeks</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Read that table honestly. Events sit at the bottom, and events are what most clubs do first. A bake sale is a community-building exercise that happens to raise a little money. If you need 2,000, you will not bake your way there, and the forty volunteer hours it costs are hours you could have spent on the two things at the top of the table.</p>

        <H2>The school budget, and the case that wins one</H2>
        <p>The largest single source for most teams is the school itself, and it is won in one conversation with one person, usually a head of department, a deputy head or a bursar. What loses it is asking for &quot;funding for MUN&quot;. What wins it is a one-page case that speaks the school&apos;s language.</p>
        <ul>
          <li><strong>Participation.</strong> How many students, from which year groups, and how many are new to the activity.</li>
          <li><strong>Outcomes the school already cares about</strong>: public speaking, writing, research, leadership positions held by students, and where those appear in university applications.</li>
          <li><strong>The exact number</strong>, with what the students are contributing themselves. A team that has already raised a third is asking for a top-up rather than a handout.</li>
          <li><strong>Equity.</strong> The amount needed specifically so that students who cannot pay can attend. Schools have money for this that they do not have for general activities.</li>
          <li><strong>Visibility.</strong> An assembly, a piece for the newsletter, a photograph with the award. Small, but it is what the person approving it will be asked about.</li>
        </ul>
        <p>Ask in the term before you need it. Budgets are allocated once, and a request that arrives after the allocation has to displace something else.</p>

        <H2>Student subscriptions, priced so they do not exclude</H2>
        <p>A termly or annual club subscription is the most predictable money you will have, and it is also the fastest way to quietly make your club a club for wealthier students. Three rules keep it fair.</p>
        <ul>
          <li>Set it low enough to be trivial for most families, and state what it covers.</li>
          <li>Publish a waiver in the same sentence as the price, with a named person to ask, not a form. &quot;If this is difficult, email me and it is waived, no questions&quot; works and is used.</li>
          <li>Never let the waiver be visible. Whoever collects the money should not know who paid nothing.</li>
        </ul>
        <p>Subscriptions work best for small recurring costs (printing, socials, a local conference fee) rather than for a flight. Do not try to make them carry the whole season.</p>

        <H2>Grants, Rotary and civic clubs</H2>
        <p>This is the most under-used source in school Model UN, because it feels like something adults with fundraising departments do. It is not. Local foundations, Rotary and Lions clubs, town or parish councils, UN associations, and the alumni or education funds attached to many businesses all give small grants, often in the 200 to 2,000 band, and they receive far fewer applications than you would guess.</p>
        <H3>What they are actually funding</H3>
        <p>Not Model UN. They are funding young people from their area getting an opportunity, international understanding, or educational access. Write the application in those terms and mention Model UN as the mechanism.</p>
        <FactCard title="Grant application checklist">
          A named contact and a real address. What the money is for, as a number with line items. How many young people benefit and from where. What happens without the money, stated plainly. How you will report back, with a date. Whether the school can receive funds and issue a receipt, which most funders require. A named adult who signs.
        </FactCard>
        <p>Rotary and similar clubs often want something in return that is not money: two students to come and speak at a lunch meeting for ten minutes. That is an excellent trade and your delegates will be good at it.</p>
        <p>Lead times are long, usually two to six months, so grants fund next year&apos;s season and not this one. Apply in the autumn for the spring.</p>

        <H2>Local business sponsorship</H2>
        <p>A local business is buying visibility and goodwill among families in its catchment. Be concrete about what it gets: a logo on the team&apos;s materials and social posts, a mention in the school newsletter, a photograph with the students, and a thank you at an assembly. Small amounts, 100 to 500, are normal, and three of those funds a coach.</p>
        <p>Approach in person where you can, with two students and the one-page case. Ask for a named person rather than the shop. And agree with your school first which categories are acceptable, because that conversation is much worse when it happens after a gambling company has offered you 800.</p>

        <H2>Alumni: the source almost nobody asks</H2>
        <p>Former delegates are the warmest audience you will ever have. They remember the activity fondly, many are now in their twenties and thirties with some income, and a specific ask from a teacher they remember converts at a rate no cold approach matches.</p>
        <p>The mechanics matter. Ask for a specific thing (&quot;80 covers one delegate&apos;s conference fee&quot;) rather than a general contribution. Send it once a year, in the same month each year, so it becomes a habit rather than an interruption. Include a photograph of the current team. And go through the school&apos;s alumni office if there is one, because data protection rules on contacting former students are real and your school will have a process.</p>
        <p>Alumni also give things other than money: a venue, a coach hire discount, a night of interview practice, a parent who runs a printing business. Ask what they can offer, not only what they can give.</p>

        <H2>Events that work, and events that lose money once you count the hours</H2>
        <p>Events are worth running for reasons other than the money: they build a club, they involve students who are not yet delegates, and they make MUN visible in the school. Just be clear-eyed about the return.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Event</th><th>Verdict</th></tr></thead>
            <tbody>
              <tr><td>Quiz night with parents</td><td>Works. One evening, low cost, and parents bid on things. The best single event for most school teams.</td></tr>
              <tr><td>Silent auction of donated items</td><td>Works if you have alumni or parents with something to donate. The donations are the work, not the night.</td></tr>
              <tr><td>Sponsored run or walk</td><td>Works when students actually collect sponsorship, which is a per-student ask, not an event.</td></tr>
              <tr><td>Charging entry to a school mock MUN</td><td>Works, and doubles as training. See below.</td></tr>
              <tr><td>Bake sale</td><td>Community, not income. Run it for the club, not for the budget.</td></tr>
              <tr><td>Non-uniform day</td><td>Reliable and small. Needs school permission and usually shares the proceeds.</td></tr>
              <tr><td>Selling merchandise</td><td>Usually loses money once you have paid for unsold stock. Take pre-orders only.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <H3>The mock conference that pays for itself</H3>
        <p>Running a small <Link href="/blog/start-a-mun-conference">one-day mock conference</Link> for your own school, or for feeder schools, raises money at a modest <Link href="/blog/mun-conference-budget">per-delegate fee</Link>, trains your delegates, and recruits next year&apos;s club. The barrier used to be that you needed software, printed everything and a lot of staff. You do not: a free anonymous session can be created at <Link href="/create">/create</Link> in under a minute, delegates join on their phones with a six character code, and there is nothing to install and no account to make. That removes the main fixed cost from the idea, which is why it is worth mentioning here rather than in a product page. Pair it with <Link href="/blog/mun-conference-planning">the conference planning guide</Link> if it grows beyond one room.</p>

        <H2>Crowdfunding, and its social cost</H2>
        <p>Crowdfunding works for a clear, bounded, emotionally legible goal: one team, one trip, a photograph, a deadline. It works badly as a general fund, and it has a cost that people underestimate, which is that it asks your students&apos; families and friends for money in public. For some students that is fine. For others it is the reason they will quietly drop out.</p>
        <p>If you run one: set a modest target you will actually hit, name the specific trip, run it for three weeks and not three months, and make individual contribution amounts invisible. Never publish which students were funded.</p>

        <H2>The money almost nobody claims: conference financial aid</H2>
        <p>Most conferences of any size have a financial aid route, a fee waiver, or a scholarship for delegates who cannot pay, and a large share of them go unclaimed every year because nobody asks. This is the highest return per hour on the entire list: one email, sent before the fee deadline.</p>
        <p>What to write: who you are, how many delegates, what you can pay, what you need, and whether there is anything you can offer in exchange. Many conferences will trade a reduced fee for your school providing a chair or a volunteer, which is a good deal on both sides.</p>
        <p>Gavelling&apos;s conference tools include a financial aid section for organisers, so on conferences that use it there is a defined route rather than an inbox. Either way, the rule is the same: ask before the deadline, ask a named person, and ask early, because aid budgets are allocated first-come.</p>
        <Callout>Ask every conference, every year, even the ones you assume are too expensive to bother. The worst outcome is a polite no, and the going rate for an email is the cost of an email.</Callout>

        <H2>Spending less, which counts as raising more</H2>
        <ul>
          <li><strong>Pick one expensive conference per season, not three.</strong> A local conference and a regional one costs a fraction of two international ones and develops delegates just as well. Our guide to <Link href="/blog/choosing-mun-conferences">choosing MUN conferences</Link> helps you plan the season.</li>
          <li><strong>Share transport with another school.</strong> Two delegations on one coach halves the largest variable line for both.</li>
          <li><strong>Book accommodation in fours.</strong> The difference between twins and quads over three nights is often larger than any single fundraiser you will run.</li>
          <li><strong>Register in the early-bird window.</strong> A 15 to 20 per cent saving for filling in a form in October rather than January is the easiest money in this guide.</li>
          <li><strong>Use online conferences for development.</strong> They have no travel cost, they suit first-year delegates, and they let you run a larger squad. <Link href="/blog/mun-online-committees">Our guide to online committees</Link> covers what they are and are not good for.</li>
          <li><strong>Do not buy software.</strong> Free tools cover everything a school team needs for training. <Link href="/blog/free-mun-tools">The free MUN tools comparison</Link> is the honest version of that claim.</li>
        </ul>

        <H2>Equity, stated plainly</H2>
        <p>Fundraising quietly selects for wealth unless you design against it. The mechanisms that do this are not dramatic: a subscription with no waiver, a trip cost announced late so only families with slack can say yes, a crowdfunding page that reveals who needed help, a selection process that favours students who have already been to conferences.</p>
        <p>Four habits fix most of it. Announce costs at the start of the year, so families can plan. Publish a waiver every time you publish a price. Hold back a named share of whatever you raise for exactly this purpose, and decide it before you know who will ask. And keep the knowledge of who received support with one adult, not with the club.</p>

        <H2>Handling the money</H2>
        <p>Whatever your school&apos;s rules are, follow them exactly, and find out what they are before you collect a penny. In most schools that means: money goes through the school account, not a student&apos;s, not a teacher&apos;s personal one. Two people see every transaction. Everything is receipted, including cash from a bake sale. Grants and sponsorship are declared. And anything left at the end of the year belongs to the club&apos;s account, with a written note of what it is for.</p>
        <p>Keep a single shared sheet with three columns: what came in, from where, and what it is committed to. It takes five minutes a week and it is what lets you answer the head teacher&apos;s question instantly, which is the question that decides next year&apos;s budget.</p>
        <p>If you are <Link href="/blog/start-mun-club">building a team from nothing</Link> rather than funding an existing one, <Link href="/blog/mun-faculty-advisor-guide">the faculty advisor guide</Link> covers the programme side of the same job.</p>
      </ArticleLayout>
    </>
  );
}
