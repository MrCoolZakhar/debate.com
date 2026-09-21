import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Start a MUN Conference From Scratch',
  description:
    'The whole job of founding a Model UN conference, from the first meeting to the closing gavel, with what it genuinely costs and what you can skip in year one',
  path: '/blog/start-a-mun-conference',
  ogDescription: 'How to found a Model UN conference: scope, approval, team, money and the eight month calendar.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Start a MUN Conference From Scratch',
  description: 'How to found a Model UN conference: scope, approval, team, money and the eight month calendar.',
  url: 'https://gavelling.com/blog/start-a-mun-conference',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/start-a-mun-conference' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Start a MUN Conference', item: 'https://gavelling.com/blog/start-a-mun-conference' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="start-a-mun-conference"
        pitch="Gavelling costs the organiser nothing: applications, allocations, payments and live committees, with you as merchant of record."
      >
        <p>
          Founding a conference is a different job from planning one. Planning assumes the conference exists and asks when each thing happens; our <Link href="/blog/mun-conference-planning">conference planning timeline</Link> covers that, and you should use it once you have decided to go ahead. This page is about the decision itself: how big to be in year one, who has to approve it, who you need on the team, what it actually costs before a single fee arrives, and what to leave out until year two.
        </p>

        <H2>The decision before every other decision</H2>
        <p>
          Two numbers determine everything else: how many delegates, and how many days. Fix them first, because venue, budget, committee count, chair recruitment and staffing all follow from them and none of them can be worked out in the other order.
        </p>
        <p>
          The honest advice is to be much smaller than you want to be. A first conference of 500 delegates over four days is a common ambition and an uncommon success. What fails is not enthusiasm, it is that a founding team learns twelve new jobs at once and any one of them going wrong at that scale is unrecoverable.
        </p>

        <FactCard title="Year one scope that works">
          Four to six committees. 120 to 200 delegates. One venue. Two days, or one full day plus one morning. No accommodation, no social programme beyond a single evening event, no crisis committee unless someone on your team has staffed one before.
        </FactCard>

        <p>
          At that size you can run the whole thing with 12 to 20 people, you can fit it into a school or a single university building, you can reach break-even on a fee that schools in your area will actually pay, and a committee that goes badly is one committee rather than a pattern. It is also small enough that you can make the mistakes cheaply, and you will make them.
        </p>

        <H3>Why bigger fails in year one</H3>
        <ul>
          <li><strong>Chair supply.</strong> A committee needs two competent chairs and a background guide. Ten committees means twenty chairs and ten guides, and in year one you have no reputation with which to recruit them.</li>
          <li><strong>Venue cost scales in steps, not smoothly.</strong> Six rooms is usually the same building. Twelve rooms is often a different, far more expensive building, or two buildings and a walking problem.</li>
          <li><strong>Registration risk.</strong> A large venue is booked and paid for on an estimate. If you budget for 400 and 230 come, the gap is real money that has already left your account.</li>
          <li><strong>Attention.</strong> The founding team has roughly the same number of hours whatever the size. Past a point, adding delegates only subtracts care.</li>
        </ul>

        <H2>The founding team</H2>
        <p>
          Five roles you cannot do without. Everything else can be one person wearing two hats in year one. Our guide to <Link href="/blog/mun-secretariat-roles">MUN secretariat roles</Link> describes the full structure.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Owns</th>
                <th>Hours per week, months out</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Secretary-General', 'The decision, the institution, the team, the final call on everything', '3 to 5, rising to 15 in the last month'],
                ['Director-General or Deputy SG', 'Operations: venue, catering, schedule, the day itself', '3 to 6, rising sharply at the end'],
                ['USG Academics', 'Committees, topics, chair recruitment, background guide deadlines', '4 to 6, front-loaded'],
                ['USG Delegate Affairs', 'Applications, allocations, school relationships, the inbox', '2 to 8, entirely back-loaded'],
                ['Treasurer or USG Finance', 'Budget, fees, invoices, reconciliation, the school finance office', '2 to 4, constant'],
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
        <p>
          What can wait until year two: a <Link href="/blog/mun-conference-marketing">marketing team</Link>, a press or media department, an IT lead, a sponsorship officer, a dedicated crisis team, a social programme committee. Every one of these is genuinely useful and none of them is the difference between a conference happening and not happening.
        </p>
        <p>
          One structural point that first-year teams get wrong: separate the person who takes the money from the person who spends it, even in a team of five. It protects both of them, and the first question any school finance office or students&apos; union will ask is who signs off on what.
        </p>

        <Callout>
          Write down who decides when two of you disagree. Founding teams are friends, which is why they avoid this conversation, and why the argument that arrives in week 30 is much worse than the one you could have had in week 2.
        </Callout>

        <H2>Institutional approval</H2>
        <p>
          You are asking an institution to lend you its building, its name and, implicitly, its liability. Find out early who actually signs that off, because it is rarely the person who says yes enthusiastically first.
        </p>

        <H3>At a school</H3>
        <p>
          Usually a head of department or head of sixth form proposes it, and a deputy head or bursar approves it. What they will ask for:
        </p>
        <ul className="gv-check">
          <li>A named staff member responsible on the day, present throughout.</li>
          <li>Safeguarding: who is supervising visiting under-18s, what the ratio is, and what your policy is if a delegate is unwell or leaves the site.</li>
          <li>Whether visiting adults need background checks, which depends on your jurisdiction and on whether they are ever alone with students.</li>
          <li>Insurance: whether the school policy covers a public event and visiting attendees, or whether you need separate cover.</li>
          <li>Site rules: access hours, catering restrictions, who can be in which building, fire procedure and the register.</li>
          <li>The financial arrangement: whether the money sits in a school account, and whether the school charges internal room hire.</li>
        </ul>

        <H3>At a university</H3>
        <p>
          The students&apos; union or the society office is normally the gatekeeper, with room bookings and catering as separate approvals that each have their own lead time. Ask specifically about three things: whether an external event requires a risk assessment, whether the union must be the contracting party for the venue, and whether society funds can carry a balance across the academic year. That last one decides whether you can hold a surplus into year two or have to spend it.
        </p>
        <p>
          In both cases, put a one page proposal in front of them rather than a conversation: what it is, when, how many people, what it costs the institution, what the institution gets, and who is responsible. Approvals move much faster against a document.
        </p>

        <H2>Money in year one</H2>
        <p>
          The trap that kills first-year conferences is not the total cost. It is the timing: a substantial portion of your costs are committed before any delegate fee arrives, and if registration underperforms there is no way to unwind them.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Cost</th>
                <th>When you commit</th>
                <th>Can you unwind it?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Venue deposit', '4 to 6 months out', 'Rarely, and usually not in full'],
                ['Catering minimum', '4 to 8 weeks out', 'Partially, if you hold the numbers date'],
                ['Printing and materials', '2 to 4 weeks out', 'Yes, this is your real flex'],
                ['Insurance', 'On booking', 'No'],
                ['Awards and certificates', '3 to 4 weeks out', 'Yes'],
                ['Payment processing fees', 'As fees arrive', 'No, and budget for them'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p>
          Three rules that follow from this. Negotiate the catering numbers deadline as hard as you negotiate the price, because it is the deadline and not the price that determines your risk. Set a <Link href="/blog/mun-conference-registration-payments">registration deadline</Link> that falls before your catering deadline, not after. And build your budget from the committed costs upward rather than from a fee downward: work out what you must spend whatever happens, then ask how many delegates at what fee covers it. The full method, with line items and worked break-even maths, is in the <Link href="/blog/mun-conference-budget">conference budget guide</Link>.
        </p>

        <Callout>
          Do not let software be a committed cost in year one. Platforms that charge the organiser per participant per day scale their bill against you exactly as your conference succeeds, and you sign that contract before you know your numbers. Gavelling charges the organiser nothing, and payments run through your own Stripe account with you as merchant of record.
        </Callout>

        <H2>Committees and topics</H2>
        <p>
          Choose a slate your chair pool can actually run, not the slate you would like to attend. In year one that usually means:
        </p>
        <ul>
          <li><strong>Two large General Assembly committees</strong> for beginners, 35 to 45 seats each. These absorb your least experienced delegates and are the easiest committees to chair.</li>
          <li><strong>One or two specialised or ECOSOC committees</strong>, 20 to 30 seats, for the middle of your delegate pool.</li>
          <li><strong>One Security Council</strong>, 15 seats, as the advanced committee. It is the one every experienced delegate ranks first and the reason experienced schools attend.</li>
          <li><strong>A regional body</strong> if you have a chair who knows one well, which is often a better differentiator than a crisis committee.</li>
        </ul>
        <p>
          On topics: pick things with a live multilateral process, so delegates have real documents to research, and avoid topics whose entire content is a single ongoing conflict unless your chairs are experienced enough to handle a room that gets heated. Our <Link href="/blog/mun-committee-types">committee types overview</Link> sets out what debate feels like in each format.
        </p>
        <p>
          Recruit chairs before you finalise topics. A chair who chooses their own topic within your slate writes a much better background guide than one handed a topic in February. The <Link href="/conferences/roles">chair and staff job board</Link> is one place to advertise, alongside your own society and the nearby universities.
        </p>

        <H2>The eight month calendar</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Months out</th>
                <th>The one thing that must happen</th>
                <th>Also</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['8', 'Institutional approval and a date', 'Founding team named, roles written down'],
                ['7', 'Venue held and deposit paid', 'Committed-cost budget signed off'],
                ['6', 'Committee slate fixed', 'Chair applications open'],
                ['5', 'Chairs appointed', 'Fee set, refund policy written, website live'],
                ['4', 'Registration opens', 'Schools contacted directly, not only by post'],
                ['3', 'Background guide first drafts due', 'Early bird closes, first fees arrive'],
                ['2', 'Registration closes, allocations released', 'Catering numbers, schedule, room plan'],
                ['1', 'Chair training and a full dry run', 'Printing, badges, payments chased'],
                ['Week of', 'Room setup and the run sheet', 'Contingency plans for the three most likely failures'],
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
        <p>
          The two deadlines that are genuinely immovable are the <Link href="/blog/mun-conference-venue-logistics">venue deposit</Link> and the catering numbers. Everything else can slip by a week without breaking. Plan the calendar backwards from those two.
        </p>

        <H3>The month that always goes wrong</H3>
        <p>
          Months three and two. Background guides are late, because chairs are students with exams, and allocations cannot be released until registration closes, which schools will ask you to extend. Two countermeasures: set the guide deadline four weeks earlier than you need it and treat the real deadline as private, and publish a registration deadline you intend to hold rather than one you intend to extend twice. A deadline you have extended once is not a deadline again.
        </p>

        <H2>What to do by hand, buy, or skip</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Thing</th>
                <th>Year one</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Website', 'Buy a domain, use a simple builder or a conference page on a platform. Do not build one.'],
                ['Applications and allocations', 'Use software. This is the single most spreadsheet-destroying job in the conference.'],
                ['Taking payment', 'Use a real payment flow with invoices. Bank transfers into a personal account is how reconciliation fails.'],
                ['Badges and placards', 'By hand. It is one evening with a laminator and it is fine.'],
                ['Committee software', 'Use something free. A projected speakers list and timer changes how a room feels.'],
                ['Photography and media', 'Skip, or one volunteer with a phone. Year two problem.'],
                ['Social programme', 'One evening event at most.'],
                ['Accommodation', 'Skip entirely. Publish a list of nearby hotels and let schools book their own.'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td><strong>{r[0]}</strong></td>
                  <td>{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p>
          On the two software lines: what takes the time in <Link href="/blog/mun-country-allocation">allocations</Link> is not the assignment itself, it is preference collection, delegation blocks, double delegations and the reallocation requests afterwards. On the committee side, free tools exist and are compared in our <Link href="/blog/free-mun-tools">free MUN tools guide</Link>. You can also open a Gavelling session at <Link href="/create">/create</Link> with no account at all and test what a projected committee looks like in your actual room before you commit to anything.
        </p>

        <H2>Getting from year one to year two</H2>
        <p>
          The most valuable hour of the whole project is the one immediately after the closing ceremony, when everything is still in your head. Do it before people go home.
        </p>
        <ul className="gv-check">
          <li><strong>Write the handover document while tired.</strong> Every supplier with a contact name, every price paid, every deadline that turned out to be real, every thing you would do differently. Six pages beats a perfect document written in October that never gets written.</li>
          <li><strong>Record the numbers.</strong> Applications received, delegates registered, delegates who actually arrived, fees collected, costs paid. The gap between registered and attended is the number you will most want next year and the one nobody records.</li>
          <li><strong>Survey delegates and advisors while they are on site.</strong> A paper form at the closing ceremony gets a response rate an email never will.</li>
          <li><strong>Name your successor before the team disperses.</strong> Conferences die in year three, when the founders graduate and nobody was brought in below them.</li>
          <li><strong>Write to every school that came, and to every school that did not.</strong> Both letters matter, and the second one is the one nobody sends.</li>
        </ul>

        <H2>Start here this week</H2>
        <p>
          Three things, in this order. Find out who at your institution actually approves an event of this size, and ask them what they would need to see. Write the one page proposal. Name four other people who will do this with you, and put the five roles above next to their names.
        </p>
        <p>
          When it is approved, switch to the <Link href="/blog/mun-conference-planning">planning timeline</Link> for the week-by-week execution, and read the <Link href="/blog/mun-conference-budget">budget guide</Link> before you set a fee. It is also worth looking at what other conferences in your region charge and offer: the <Link href="/conferences/explore">conference directory</Link> is a reasonable place to see how the field prices itself.
        </p>
      </ArticleLayout>
    </>
  );
}
