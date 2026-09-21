import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Country Allocation: An Organiser’s Guide to Seating a Conference',
  description:
    'How to turn a pile of delegate applications into a seated conference: preference forms, double delegations, committee balance and the reallocation requests you can prevent',
  path: '/blog/mun-country-allocation',
  ogDescription: 'How to turn delegate applications into a seated conference without spreadsheet chaos.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Country Allocation: An Organiser’s Guide to Seating a Conference',
  description: 'How to turn delegate applications into a seated conference without spreadsheet chaos.',
  url: 'https://gavelling.com/blog/mun-country-allocation',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-country-allocation' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Country Allocation', item: 'https://gavelling.com/blog/mun-country-allocation' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-country-allocation"
        pitch="Gavelling handles applications, fit-scored assignment and seat-by-seat allocation for the whole conference, and charges the organiser nothing."
      >
        <p>Allocation is the job that decides whether your conference feels well run. Delegates forgive a cold venue and bad coffee. They do not forgive being seated in a committee they did not ask for, on a country they cannot research, two days before they travel. This guide is the operational version: how to collect preferences you can actually use, in what order to allocate, what breaks, and what to send.</p>

        <H2>The two allocations, and the order that matters</H2>
        <p>There are two distinct jobs and almost every first-time <Link href="/blog/mun-secretariat-roles">secretariat</Link> runs them together, which is where the chaos starts.</p>
        <ul>
          <li><strong>Allocation one: delegations to committees.</strong> A school sends twelve students. Which committees do those twelve seats sit in?</li>
          <li><strong>Allocation two: delegates to seats.</strong> Given that a delegation has three seats in DISEC, which named student is which country?</li>
        </ul>
        <p>Do the first for every delegation before you do the second for anybody. If you seat individuals as the applications arrive, you will discover in week three that your flagship committee is full, four schools have no representation in it, and unpicking it means moving people who have already been told where they are sitting.</p>
        <Callout>The rule: committee balance is a whole-conference decision and seat assignment is a per-delegation decision. Finish every committee-level decision, lock it, and only then open the country lists.</Callout>

        <H2>Collecting preferences you can actually use</H2>
        <p>Most preference forms collect data nobody can act on. Three or four ranked committee choices per delegate is the usable shape. Fewer and you cannot solve the constraint; more and delegates stop thinking after the third, so the data is noise.</p>
        <p>Ask for committee preferences, not country preferences, from individual delegates. Country requests at application stage create an expectation you cannot meet: for any popular committee, half your applicants will ask for the same six countries. Collect country wishes separately, from the head delegate or faculty advisor, after committees are settled, and label them clearly as wishes.</p>
        <p>The questions that actually predict fit:</p>
        <ul>
          <li>How many conferences has this delegate attended? A number, not a category.</li>
          <li>Have they chaired, or served on a secretariat?</li>
          <li>Do they want a crisis committee? A yes or no here prevents more reallocation requests than anything else on the form.</li>
          <li>Would they accept a double delegation? Some delegates want one and most forms never ask.</li>
          <li>Is there a committee they do not want, and why? One free-text line, and it is often the most useful field on the form.</li>
        </ul>
        <p>Two fields to avoid. Do not ask delegates to self-rate their skill out of ten, because everybody says seven. Do not ask for an essay per committee unless you genuinely intend to read all of them, because delegates can tell.</p>

        <H2>What experience signals are worth</H2>
        <p>Experience data is the only lever you have for balancing rooms, and it is softer than it looks. A delegate who has attended eight conferences on one circuit may be worse in an unfamiliar ruleset than a delegate who has attended three across several. Chairing experience is the strongest single signal, because it implies both procedure and composure.</p>
        <p>Use experience to set a floor, not a ceiling. The aim is that no committee is entirely first-timers and no committee is entirely veterans. A room of forty beginners has a miserable first session because nobody will raise the first motion. A room of forty veterans is procedurally beautiful and frequently hostile to the three beginners in it.</p>
        <FactCard title="A workable balance target">
          Roughly a fifth to a quarter experienced delegates in every general committee, and a named beginner-friendly committee that you deliberately staff with your calmest chairs. Crisis and ad hoc rooms go the other way and should be mostly experienced, which is exactly why you asked the crisis question on the form.
        </FactCard>

        <H2>Double delegations, and what they break</H2>
        <p>A double delegation is two students sharing one country and one placard. It is an excellent format for nervous delegates and a common cause of allocation bugs.</p>
        <p>The failure is always the same: the conference models a double delegation as one seat. Then the committee looks full at 40 when 60 people are coming, the roll call has one row for two humans, the name badges are short, and payment has been collected once. Model the seat as having a capacity of two from the beginning, and make sure your committee fill counts, your room sizing and your fee calculation all read the same number.</p>
        <p>Practical rules. Keep both halves of a double delegation from the same school unless they have asked otherwise: two strangers sharing one country rarely works. Decide in advance whether a double delegation gets one vote or two, tell the chairs, and put it in the rules, because if you do not decide it, a chair will decide it differently in every room.</p>

        <H2>Not every open seat is the same seat</H2>
        <p>A committee that is 90 per cent full looks nearly done on a progress bar. If the remaining seats are a permanent member of the Security Council and two states central to the topic, it is not nearly done at all.</p>
        <p>Grade your seats before you allocate. In most General Assembly committees, ten to fifteen countries do most of the talking on any given topic, and the rest are legitimately supporting roles. Hold the heavy seats back for experienced delegates or for schools that consistently send strong teams, and fill outward. In the Security Council, the five permanent seats are not distributable on a first-come basis at all, and a conference that gives them to whoever applied first usually regrets it by the second session.</p>
        <p>This also affects how you read your own dashboard. A flat percentage hides a room with three unusable gaps. Track filled, open and not-yet-on-the-roster as three separate states, because the third one is a country you have not even added yet and a flat count will show it as open.</p>

        <H2>Delegation blocks: ask before you scatter</H2>
        <p>Schools want their students spread across committees, or gathered in a few. Both are legitimate and they are opposite, so ask. A faculty advisor supervising fifteen students across nine rooms cannot physically watch them, which matters for safeguarding as well as coaching. A head delegate building a competitive team may want exactly the opposite.</p>
        <p>The default that causes the fewest complaints: no more than two or three students from one school in the same committee, and no more than one committee per two students for advisors who ask for concentration. Whichever you choose, apply it consistently and publish the rule with the allocation, because a school that sees another school with four delegates in the flagship committee will ask.</p>

        <H2>Crisis and cabinet allocation is a different job</H2>
        <p>Character allocation does not fit the country model. Seats are named people with unequal power, a finance minister is not interchangeable with a press baron, and delegates cannot rank characters sensibly because they do not know the scenario.</p>
        <p>The method that works is a short application: a writing sample or one paragraph on why they want the room, read by the crisis director, who assigns characters personally. Give the strongest portfolios to delegates who have done crisis before, and be careful with portfolios that are structurally weak, because a delegate with no resources and no information has a bad weekend no matter how good they are. If a character sheet is unavoidably thin, either cut it or give it a hidden advantage the backroom knows about.</p>

        <H2>The reallocation requests, and how to prevent most of them</H2>
        <p>They will arrive within an hour of publication. Almost all of them are one of four things: wrong committee, country the delegate cannot research, two students who wanted to be together, or a school that thinks it received fewer good seats than another.</p>
        <p>Prevent them with policy published in advance, before allocations go out:</p>
        <ul>
          <li>State that allocations are final except for documented errors, and define what counts as an error: a delegate seated in a committee they marked as unwanted, a double delegation split, a name misspelled on a placard.</li>
          <li>Give one window, usually 72 hours, and one address. Requests outside the window or to a personal inbox are not processed. This single rule removes most of the load.</li>
          <li>Say that swaps between two consenting delegations within the same committee are allowed and must be requested jointly. Delegates will solve several of your problems for you.</li>
          <li>Never state a reason beyond the policy. &ldquo;The committee is full&rdquo; invites an argument about who else is in it.</li>
        </ul>
        <p>Keep one or two seats per committee unallocated until after the window closes. That reserve is what turns a genuine error into a five-minute fix instead of a chain of six moves.</p>

        <H2>Releasing allocations</H2>
        <p>Release to the delegation, not to the internet. The head delegate or faculty advisor gets the full list for their school; each delegate gets their own committee, country and any double-delegation partner.</p>
        <p>What to include in the release:</p>
        <ul>
          <li>Committee, country or character, and seat capacity if it is a double.</li>
          <li>The link to the background guide, or a date by which it will exist.</li>
          <li>Position paper deadline and submission route.</li>
          <li>The reallocation policy and the window, restated.</li>
          <li>What is still outstanding on their account, usually payment.</li>
        </ul>
        <p>What never goes in a public spreadsheet: delegate names against schools against contact details. A shared read-only sheet of the full allocation is convenient and it publishes a list of minors and their locations. Send per-delegation, keep the master private, and if you must publish something public, publish committee country lists with no names on them.</p>

        <H2>By hand or with software</H2>
        <p>Allocation by spreadsheet is entirely possible and many good conferences do it. What costs the time is not the decision-making, it is the bookkeeping around it: chasing preference forms, matching payments to people, rebuilding the sheet after a school withdraws four delegates, and sending several hundred individual emails without sending the wrong one to the wrong person.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Task</th><th>By hand</th><th>With a platform</th></tr></thead>
            <tbody>
              <tr><td>Collecting preferences</td><td>Form plus a sheet, manual paste</td><td>Application form feeds the record directly</td></tr>
              <tr><td>Deciding committee balance</td><td>Human judgement</td><td>Human judgement, with fit scores as a prompt</td></tr>
              <tr><td>Seating individuals</td><td>Manual, error-prone at scale</td><td>Seat-by-seat board with capacity built in</td></tr>
              <tr><td>Double delegations</td><td>The classic off-by-one</td><td>Seat capacity of two, counted correctly everywhere</td></tr>
              <tr><td>Telling everyone</td><td>Mail merge, one mistake away from a mess</td><td>One send per delegation from the record</td></tr>
              <tr><td>Payment against seat</td><td>Two systems that disagree</td><td>One record</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The judgement is always yours. What <Link href="/blog/best-mun-software-2026">software</Link> should remove is the retyping, the version confusion and the possibility of two people editing the same sheet at once. Gavelling does applications, fit-scored assignment, seat allocation and the emails from one record, and charges the organiser nothing for it: the participant side is where it is monetised, so a conference is never billed per delegate per day.</p>

        <H3>The sequence, in order</H3>
        <ul className="gv-check">
          <li>Close applications and freeze the list.</li>
          <li>Size every committee and grade the heavy seats.</li>
          <li>Allocate delegations to committees, balancing experience.</li>
          <li>Ask schools about concentration and double delegations.</li>
          <li>Seat individuals, holding one or two seats per room in reserve.</li>
          <li>Run crisis and cabinet allocation separately with the crisis director.</li>
          <li>Publish the reallocation policy, then release per delegation.</li>
          <li>Process the window, then release the reserve.</li>
        </ul>
        <p>Allocation sits between two other jobs that constrain it. What you can seat depends on who has paid, which is covered in our guide to <Link href="/blog/mun-conference-registration-payments">registration, payments and refunds</Link>, and the committee slate you are seating into should have been decided months earlier during <Link href="/blog/mun-conference-planning">conference planning</Link>. If you are choosing the slate now, our <Link href="/blog/mun-committee-types">committee types guide</Link> is the reference for what each room demands of its delegates. For the wider job, see <Link href="/blog/mun-director-guide">the MUN director guide</Link> and, if this is your first year, <Link href="/blog/start-a-mun-conference">how to start a MUN conference</Link>.</p>
      </ArticleLayout>
    </>
  );
}
