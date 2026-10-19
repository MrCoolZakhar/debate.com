import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'MUN Conference Budget: A Sample Budget and the Delegate Fee It Needs';
const DESCRIPTION =
  'A complete sample budget for a 180-delegate, two-day Model UN conference with every line filled in, the delegate fee worked out from it, break-even at three sizes, and what each discount really costs';

const FAQ: FaqItem[] = [
  {
    question: 'How much does it cost to host a MUN conference?',
    answer:
      'It depends mostly on the venue. In the sample budget on this page, a two-day conference for 180 delegates in a hired university venue costs about 4,500 euros in fixed costs plus about 28 euros per delegate, roughly 9,500 euros in total. The same conference in rooms a school provides for free costs about 2,500 euros less.',
  },
  {
    question: 'How much should a MUN delegate fee be?',
    answer:
      'Work it out from your costs: the direct cost per delegate, plus fixed costs divided by a cautious headcount, plus payment fees and a 15 to 20 percent contingency. In the sample budget that gives 72 euros in a hired venue and 51 euros in a free school venue. Then compare it with what similar conferences in your region charge.',
  },
  {
    question: 'What is the biggest cost of a MUN conference?',
    answer:
      'Venue hire, when you pay for it, often followed by catering. A conference in rooms its own school or university provides can run largely on catering and printing.',
  },
  {
    question: 'How much contingency should a MUN conference budget have?',
    answer:
      'Fifteen to twenty percent of total costs is the usual figure for student-run events. It covers roughly one supplier surprise, and it is the money a small financial aid scheme can come from if nothing goes wrong.',
  },
  {
    question: 'Should chairs pay a delegate fee?',
    answer:
      'No. Chairs are staff. Most conferences charge them nothing and many feed them, which belongs in the budget as a fixed cost.',
  },
  {
    question: 'How many delegates does a MUN conference need to break even?',
    answer:
      'Divide the fixed costs by what each delegate contributes after their own direct costs and payment fees. In the sample budget, 4,555 euros of fixed costs and about 42 euros of contribution per delegate gives a break-even of 109 delegates, 61 percent of the 180 target.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-conference-budget',
  keywords: [
    'MUN conference budget',
    'MUN conference budget template',
    'sample MUN budget',
    'how much does it cost to host a MUN',
    'MUN delegate fee',
    'MUN conference costs',
  ],
  ogDescription: 'A sample MUN conference budget with every line filled in, and the delegate fee it needs.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-conference-budget',
  datePublished: '2026-09-20',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-budget' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Budget', item: 'https://gavelling.com/blog/mun-conference-budget' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-budget"
        pitch="Gavelling charges the organiser nothing and settles participant payments into your own Stripe account, with the fee shown on screen."
      >
        <p>
          Most first conferences do not fail because the fee was too low. They fail because the budget was built in the wrong direction: someone picked a fee that felt reasonable, multiplied it by an optimistic headcount, and spent against the result. This guide builds it the other way round, which is the only way that survives a bad registration year, and then fills in a complete sample budget for one conference so you can see every number land. For the income that does not come from fees, see our <Link href="/blog/mun-conference-sponsorship">MUN conference sponsorship</Link> guide.
        </p>
        <p>
          All figures below are illustrative ranges in euros. Venue and catering costs vary by a factor of five between countries and between a school hall and a hired conference centre, so treat the structure and the ratios as the transferable part, not the numbers.
        </p>

        <H2>The two budgets you actually need</H2>
        <p>
          Write two, not one, and keep them separate on two sheets.
        </p>
        <ul>
          <li><strong>The committed-cost budget.</strong> Everything you owe whether 90 delegates come or 300. Venue, insurance, any minimum spend, deposits. This number is your risk, and it is the number to show whoever is approving the conference.</li>
          <li><strong>The per-delegate budget.</strong> Everything that scales with headcount: catering, printing, badges, materials, payment fees. This is what the fee has to cover, plus a share of the committed costs.</li>
        </ul>
        <p>
          The reason to separate them is that they behave differently under stress. If registration is 30 percent down, the per-delegate budget shrinks with it and the committed budget does not move at all. A single combined spreadsheet hides that, which is exactly when you need to see it.
        </p>

        <H2>Every line item</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Line</th>
                <th>Behaviour</th>
                <th>Typical range, 180 delegates, 2 days</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Venue', 'Room hire or internal charge', 'Committed', '0 to 4,000'],
                ['Venue', 'Technical: AV, projectors, microphones', 'Committed', '0 to 900'],
                ['Venue', 'Security, caretaking, out-of-hours access', 'Committed', '0 to 600'],
                ['Venue', 'Cleaning', 'Committed', '0 to 400'],
                ['Catering', 'Lunch, per delegate per day', 'Per delegate', '6 to 18 each'],
                ['Catering', 'Refreshment breaks', 'Per delegate', '2 to 5 each'],
                ['Catering', 'Staff and chair meals', 'Semi-committed', '150 to 500'],
                ['Materials', 'Badges, lanyards, placards', 'Per delegate', '1.50 to 4 each'],
                ['Materials', 'Printing: guides, forms, signage', 'Mostly per delegate', '200 to 700'],
                ['Materials', 'Stationery and committee supplies', 'Per committee', '15 to 40 per room'],
                ['Awards', 'Certificates, plaques, gavels', 'Per committee', '25 to 120 per room'],
                ['Technology', 'Committee platform', 'Varies by vendor', '0, or per participant per day'],
                ['Technology', 'Domain, email, site hosting', 'Committed', '20 to 150'],
                ['Admin', 'Insurance or event cover', 'Committed', '50 to 400'],
                ['Admin', 'Payment processing', 'Percentage of revenue', '2 to 5 percent of fees'],
                ['Admin', 'Bank charges on international transfers', 'Per transfer', '0 to 25 each'],
                ['People', 'Chair travel or accommodation support', 'Semi-committed', '0 to 1,500'],
                ['People', 'Staff shirts or identifiers', 'Per staff member', '8 to 20 each'],
                ['Programme', 'Opening keynote costs, social event', 'Committed', '0 to 1,200'],
                ['Access', 'Accessibility provision', 'Committed, on request', 'Budget a line even at zero'],
                ['Reserve', 'Contingency', 'Percentage of total', '15 to 20 percent'],
              ].map((r, i) => (
                <tr key={i}>
                  <td>{r[0]}</td>
                  <td><strong>{r[1]}</strong></td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <H3>Venue is usually the whole argument</H3>
        <p>
          At a school or university that gives you rooms for nothing, a conference can run on catering and printing alone, and a modest fee covers it comfortably. At a hired venue, room hire is typically the single largest line and can be half the budget.
        </p>
        <p>
          Before you sign anything, get four things in writing: the room hire and what it includes, whether AV is included or billed separately, whether there is a minimum catering spend, and the date by which final numbers must be confirmed. That last date is the one that determines your financial risk, and it is the one people forget to negotiate. A venue that will take final numbers ten days out is worth paying more for than one that wants them four weeks out.
        </p>
        <p>
          Size the rooms before you commit: one room per committee with room for the largest committee plus 15 percent, plus one room for the secretariat, plus one space large enough for everybody at once. Splitting the opening ceremony into two sittings is a known and survivable compromise if the large space is what is driving your cost. Our <Link href="/blog/mun-conference-venue-logistics">venue logistics guide</Link> covers choosing and booking the rooms.
        </p>

        <H2>Setting the delegate fee</H2>
        <p>
          Build it in four layers, in this order.
        </p>
        <FactCard title="Layer 1: direct cost per delegate">
          Catering, materials, printing, their share of awards. Add it up honestly. At 180 delegates over two days this is often 20 to 45 each.
        </FactCard>
        <FactCard title="Layer 2: their share of committed costs">
          Committed total divided by a CONSERVATIVE headcount, not your target. If you hope for 180, divide by 140. This one decision is the difference between a bad year being uncomfortable and being a debt.
        </FactCard>
        <FactCard title="Layer 3: payment and platform costs">
          Whatever your payment route costs, as a percentage, on top. Do not absorb this silently: it is 2 to 5 percent of everything and it is the line first-timers forget entirely.
        </FactCard>
        <FactCard title="Layer 4: contingency and next year">
          15 to 20 percent contingency, which is the figure widely used for student-run events because it covers roughly one supplier surprise. Plus, if your institution lets you carry a balance, a small surplus so that year two does not start from zero.
        </FactCard>
        <p>
          Then sense-check against the market. Look at what three comparable conferences in your region charge, with what included; <Link href="/conferences/explore">Explore</Link> lists conferences you can compare against. If your number is 40 percent above them, the problem is your venue, not your maths.
        </p>

        <H2>A sample budget, filled in</H2>
        <p>
          One conference, every line. A school society runs a two-day conference for a target of 180 delegates in nine committees, in rooms hired from a local university. It plans against a cautious 140.
        </p>
        <H3>Fixed costs</H3>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Line</th><th>How it was worked out</th><th>Euros</th></tr>
            </thead>
            <tbody>
              {[
                ['Room hire', 'Nine committee rooms, a plenary hall, a secretariat room, two days', '1,800'],
                ['AV', 'Projectors in two rooms, microphones in the plenary', '300'],
                ['Security and caretaking', 'Saturday access charge', '250'],
                ['Cleaning', 'Venue charge', '150'],
                ['Staff and chair meals', '40 people, two days, 8 each', '640'],
                ['Awards', 'Nine committees, 50 each', '450'],
                ['Committee supplies', 'Nine rooms, 25 each', '225'],
                ['Opening ceremony', 'Speaker travel, a small gift', '200'],
                ['Accessibility', 'Quiet room supplies, a reserved line for requests', '200'],
                ['Signage and fixed printing', 'Room signs, schedules', '150'],
                ['Insurance', 'Event cover beyond the school’s policy', '150'],
                ['Website and email', 'Domain for a year', '40'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td><strong>{r[0]}</strong></td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
              <tr><td><strong>Fixed total</strong></td><td>&nbsp;</td><td><strong>4,555</strong></td></tr>
            </tbody>
          </table>
        </TableWrap>
        <H3>Cost per delegate</H3>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Line</th><th>How it was worked out</th><th>Euros per delegate</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Lunch</strong></td><td>Two days at 9</td><td>18.00</td></tr>
              <tr><td><strong>Breaks</strong></td><td>Two days at 3</td><td>6.00</td></tr>
              <tr><td><strong>Badge, lanyard, placard</strong></td><td>Ordered in bulk</td><td>2.50</td></tr>
              <tr><td><strong>Printing</strong></td><td>Delegate pack</td><td>1.50</td></tr>
              <tr><td><strong>Direct cost per delegate</strong></td><td>&nbsp;</td><td><strong>28.00</strong></td></tr>
            </tbody>
          </table>
        </TableWrap>
        <H3>The fee, step by step</H3>
        <ul className="gv-check">
          <li><strong>Costs at the cautious headcount:</strong> 4,555 fixed plus 140 delegates at 28, which is 3,920. Total 8,475.</li>
          <li><strong>Contingency at 15 percent:</strong> 1,271. Total 9,746.</li>
          <li><strong>Per delegate:</strong> 9,746 divided by 140 is 69.61.</li>
          <li><strong>Payment fees of about 3 percent on top:</strong> 69.61 divided by 0.97 is 71.77.</li>
          <li><strong>Fee:</strong> 72 euros.</li>
        </ul>
        <p>
          Now test it. Each delegate contributes 72 less 3 percent in fees less 28 of direct cost, about 41.84. The fixed 4,555 is covered at <strong>109 delegates</strong>, 61 percent of the target, so a bad year is survivable. At the full 180 the conference ends with about 3,000 unspent, including the contingency, which is next year&rsquo;s deposit.
        </p>
        <FactCard title="The same conference in free rooms">
          Take out room hire, AV, security and cleaning and the fixed total falls to 2,055. Run the same five steps and the fee comes out at 51 euros. Twenty-one euros of every fee, nearly a third, was the venue. That is the number to take to the school before you go looking for a hired hall.
        </FactCard>

        <H2>Break-even, worked at three sizes</H2>
        <p className="gv-note">
          Illustrative. Committed costs assume a modestly priced external venue; a free school venue moves every one of these numbers sharply down.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Small: 120 delegates</th>
                <th>Mid: 250 delegates</th>
                <th>Large: 500 delegates</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Committed costs', '2,400', '5,800', '14,000'],
                ['Direct cost per delegate', '28', '30', '32'],
                ['Fee set at', '55', '58', '60'],
                ['Contribution per delegate (fee minus direct minus 4% fees)', '24.80', '25.68', '25.60'],
                ['Break-even headcount', '97', '226', '547'],
                ['Break-even as % of target', '81%', '90%', '109%'],
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
          Read the last row rather than the fee. The small conference breaks even at 81 percent of target, which means a disappointing year is survivable. The large one does not break even at its target at all: at a 60 euro fee it needs 547 delegates to cover 14,000 of committed cost, so either the fee rises, the venue cost falls, or sponsorship closes the gap. That is the entire argument for starting small, expressed as arithmetic.
        </p>
        <Callout>
          Calculate your break-even headcount before you set the fee, and write it on the first line of the spreadsheet. If it is above 85 percent of your realistic target, you do not have a budget: you have a bet.
        </Callout>

        <H2>The four costs first-timers forget</H2>
        <H3>1. Payment processing</H3>
        <p>
          Card processing typically costs somewhere around 1.5 to 3 percent plus a fixed amount per transaction, and international cards and currency conversion cost more. On 15,000 of fees that is a few hundred, which is real money that nobody put in the spreadsheet. Bank transfers look free and are not: international transfers carry charges, and more importantly they carry an administrative cost in your treasurer&apos;s hours.
        </p>
        <H3>2. Insurance</H3>
        <p>
          Ask your institution whether its public liability cover extends to a public event with external attendees, including under-18s. Often it does. Sometimes it explicitly does not, and finding that out four days before is not a position you want to be in.
        </p>
        <H3>3. Accessibility</H3>
        <p>
          Step-free routes between committee rooms, a quiet room, dietary provision that is actually edible, and captioning or interpretation if requested. Budget a line for it even if the number is zero, because a request arriving three weeks out with no budget line becomes a decision about money rather than a decision about access.
        </p>
        <H3>4. The gap between registered and paid</H3>
        <p>
          Some registered delegates never pay and some paid delegates never arrive. At a first conference expect a meaningful gap between the three numbers (registered, paid and attended), and find out what yours is so you can plan around it next year. Budget catering against paid, not registered, and set your <Link href="/blog/mun-conference-registration-payments">payment deadline</Link> before your catering numbers deadline so the two agree.
        </p>

        <H2>What each discount costs the budget</H2>
        <p>
          Discounts are worth offering, but each one moves the break-even, so price them before you publish them. Using the sample budget above:
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Discount</th><th>What it does</th><th>What it costs</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Early bird, 15 percent off</strong></td><td>Brings money in before the venue balance is due</td><td>If half of delegates take it, the average fee falls to about 66.60 and break-even rises from 109 to 125 delegates</td></tr>
              <tr><td><strong>Delegation rate</strong></td><td>Rewards schools that bring a large team</td><td>10 percent off for teams of 10 or more, taken by 100 delegates, is about 720 of income</td></tr>
              <tr><td><strong>Free faculty advisors</strong></td><td>Keeps the person who decides whether a school comes on side</td><td>Only their meals: about 24 each in this budget</td></tr>
              <tr><td><strong>Free chairs</strong></td><td>Chairs are staff, not customers</td><td>Already in the fixed costs as meals</td></tr>
              <tr><td><strong>Five full financial aid places</strong></td><td>Lets students come who otherwise could not</td><td>About 360 of income, plus their 140 of direct costs; fund it from the contingency and decide the number before registration opens</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          How to set these up so they apply automatically, with deadlines and refund rules, is in our guide to <Link href="/blog/mun-conference-registration-payments">registration and payments</Link>. The budget&rsquo;s only job is to know what they cost.
        </p>

        <H2>Cash flow</H2>
        <p>
          Draw the timeline of money in and money out, month by month, on one sheet. Two questions decide whether it works.
        </p>
        <ul className="gv-check">
          <li><strong>What must be paid before any fee arrives?</strong> Usually the venue deposit and the domain. If that number is larger than what your society or department can float, you need either a smaller deposit, a later venue, or a sponsor before you commit.</li>
          <li><strong>When does the venue balance fall due relative to your registration deadline?</strong> If the balance is due before registration closes, you are paying with money you do not have yet. Negotiate the balance date, or move the early bird earlier.</li>
        </ul>
        <p>
          Stage deposits where you can. A deposit on booking, a second at numbers confirmation and the balance after the event is a common and very reasonable ask for a venue that wants repeat business from a conference that intends to run annually. Say that out loud when negotiating.
        </p>

        <H2>What software costs, and the per-user trap</H2>
        <p>
          This line deserves its own section because it behaves unlike every other cost in the budget.
        </p>
        <p>
          Some conference platforms charge the organiser per participant per day. That model scales against you precisely as the conference succeeds: a good year, where registration overshoots, raises your bill at the moment you are least able to renegotiate. It is also a committed cost signed months before you know your headcount, which is the worst category for a first-year budget.
        </p>
        <p>
          Gavelling takes the other side of that. The organiser is charged nothing. Participant payments run through your own Stripe Connect account, so you are merchant of record: the money is yours. There is no platform fee: the participant pays exactly the invoice amount, recomputed server-side, and Stripe&apos;s own processing fee comes out of your Stripe account as it would with any Stripe account. Manual payment with proof review is a first-class route, not a fallback, for the many delegations that pay by bank transfer. The comparison against the paid platforms, with their actual published pricing, is in <Link href="/blog/best-mun-software-2026">best MUN software in 2026</Link> and <Link href="/blog/mymun-alternative">the mymun alternative comparison</Link>.
        </p>
        <p>
          For the committee side specifically, free tools are compared in our <Link href="/blog/free-mun-tools">free MUN tools guide</Link>, and you can open a Gavelling session with no account at <Link href="/create/sessions">/create</Link> to see what a projected speakers list looks like in your actual room before committing to anything.
        </p>

        <H2>Building the spreadsheet</H2>
        <p>
          Four tabs. It takes an hour and it is the hour that makes every later decision easy.
        </p>
        <ul className="gv-check">
          <li><strong>Assumptions.</strong> Target headcount, conservative headcount, days, committees, fee, processing rate. Everything else references this tab, so a scenario is one number changed.</li>
          <li><strong>Committed costs.</strong> One row per line, with the date it is committed and whether it can be unwound.</li>
          <li><strong>Per-delegate costs.</strong> One row per line, multiplied by headcount from the assumptions tab.</li>
          <li><strong>Break-even.</strong> Contribution per delegate, break-even headcount, and the same three numbers at 70, 85 and 100 percent of target.</li>
        </ul>
        <p>
          Then show it to your treasurer and to whoever approves the event, and ask them to attack the assumptions tab specifically. That is where every wrong budget is wrong.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />

        <H2>Next</H2>
        <p>
          If you have not yet committed to running a conference, read <Link href="/blog/start-a-mun-conference">how to start one from scratch</Link> first: scope is the decision that determines the whole budget. If you have, the <Link href="/blog/mun-conference-planning">planning timeline</Link> tells you when each of these payments falls due, and the <Link href="/blog/mun-director-guide">director guide</Link> covers running the thing once the money is sorted.
        </p>
      </ArticleLayout>
    </>
  );
}
