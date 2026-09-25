import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Recruiting and Running a MUN Secretariat: Roles, Team Size and Handover',
  description:
    'Every secretariat role, what it actually does week by week, how big a team you need at your size, and the handover that decides whether the conference survives.',
  path: '/blog/mun-secretariat-roles',
  ogDescription: 'Every MUN secretariat role, team size by conference size, and handover.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Recruiting and Running a MUN Secretariat: Roles, Team Size and Handover',
  description: 'Every MUN secretariat role, team size by conference size, and handover.',
  url: 'https://gavelling.com/blog/mun-secretariat-roles',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-secretariat-roles' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Secretariat Roles', item: 'https://gavelling.com/blog/mun-secretariat-roles' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-secretariat-roles"
        pitch="Gavelling is free for organisers: applications, allocations, payments, documents and every committee room in one place."
      >
        <p>A Model UN conference is run by students who will graduate. That single fact shapes everything about how a secretariat should be built: not around the strongest people you have this year, but around roles that can be handed to somebody who has never done them. This guide covers what each role actually does across the year, how big a team a conference of your size needs, how to recruit into it, and the handover problem that quietly kills more student conferences than money ever does.</p>

        <H2>The core five</H2>
        <p>Below about 250 delegates you can run a conference with five people and a good chair team. These are the five, and no conference of any size works without their functions covered by somebody.</p>

        <FactCard title="Secretary-General">
          Owns the vision and the final decision. Sets the committee slate and the conference&rsquo;s character, chairs the secretariat meetings, signs off the budget and the award policy, and is the external face to schools and to the host institution. Should be doing less operational work than anybody else on the team by month three, and almost always is not.
        </FactCard>
        <FactCard title="Director-General">
          Owns delivery. If the Secretary-General decides what the conference is, the Director-General makes it happen: timelines, who is behind, what gets cut. On conference weekend they run the operation while the Secretary-General is on stage and in meetings. The most underrated role and the one most worth filling with your most organised person rather than your most senior.
        </FactCard>
        <FactCard title="USG Academics">
          Owns the academic product: topics, committee design, chair recruitment and selection, background guide deadlines and review, position paper policy, award policy. The heaviest workload between month two and month five, concentrated in guide review.
        </FactCard>
        <FactCard title="USG Delegate Affairs">
          Owns the delegate experience end to end: registration, country allocation, delegation communication, the inbox. The role with the highest message volume by a wide margin, and the one where a slow reply costs you a school.
        </FactCard>
        <FactCard title="USG Finance">
          Owns the budget, the fee structure, invoicing, chasing payment, reimbursements and the final accounts. Also the one role that should never be merged with another, for reasons covered under access control below.
        </FactCard>

        <H2>The next five</H2>
        <p>Above roughly 250 delegates, or wherever your core five start dropping things, these separate out.</p>
        <ul>
          <li><strong>USG Logistics and Operations.</strong> Rooms, signage, catering, transport, equipment, the schedule that says which committee is where. Quiet for months and then the busiest person alive for three days.</li>
          <li><strong>USG Marketing and Outreach.</strong> The conference page, the social accounts, the school mailing list, the photography. Their real job is filling committees, and it starts earlier than anyone expects. See <Link href="/blog/mun-conference-planning">how to plan a MUN conference</Link> for where it sits on the timeline.</li>
          <li><strong>USG Technology.</strong> Website, registration platform, committee software, the weekend&rsquo;s wifi and displays. At a small conference this is a job somebody does on top of another one; above 400 delegates it is a role.</li>
          <li><strong>USG Press.</strong> Runs the press corps as a committee, and doubles as the conference&rsquo;s own record: photographs, newsletter, social output during the weekend.</li>
          <li><strong>USG Hospitality and Delegate Experience.</strong> Socials, accommodation liaison, the parts of the weekend that are not committee. At an international conference this becomes large fast.</li>
        </ul>

        <H2>Academics, crisis and the chair team</H2>
        <p>Underneath the USG for Academics sits the largest group of people at the conference, and it needs its own internal structure once it is bigger than about ten.</p>
        <p>The usual shape is a Deputy or Assistant USG per committee cluster (General Assembly, ECOSOC and specialised, regional bodies, crisis), each responsible for five or six committees: reviewing those background guides, answering those chairs, checking those award slates. This matters more than it sounds. One person reviewing thirty guides in a fortnight reviews none of them properly, and guide quality is the thing delegates judge your conference on months before they arrive.</p>
        <p>Crisis sits under academics but works differently. A crisis director owns their committee&rsquo;s arc and recruits their own backroom staff, usually two to four per committee. Recruit crisis staff separately from chairs, because the skill is different and the people are different. <Link href="/blog/how-to-run-crisis-committee">How to run a crisis committee</Link> covers what you are recruiting for.</p>

        <H2>Team size against conference size</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Delegates</th><th>Secretariat</th><th>Structure</th></tr>
            </thead>
            <tbody>
              <tr><td>Up to 150</td><td>4 to 6</td><td>Core five, with Logistics merged into the Director-General and Marketing shared</td></tr>
              <tr><td>150 to 400</td><td>7 to 10</td><td>Core five plus Logistics, Marketing and usually Technology</td></tr>
              <tr><td>400 to 800</td><td>12 to 18</td><td>All ten, plus deputies under Academics and Delegate Affairs</td></tr>
              <tr><td>800 plus</td><td>20 to 35</td><td>All ten with full departments, committee-cluster deputies, and a standing operations team for the weekend</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Excludes chairs and crisis staff, who scale with the number of committees rather than with the secretariat.</p>
        <p>Safe merges at small scale: Logistics into Director-General, Technology into Marketing, Press into Marketing, Hospitality into Delegate Affairs. Merges to avoid at any scale: Finance into anything, and Academics into the Secretary-General, which produces a Secretary-General who spends the whole year reviewing background guides and never does their actual job.</p>
        <Callout>Count backwards from the weekend, not forwards from ambition. If nobody on your list can name who unlocks the building on Saturday morning, you have an org chart rather than a team.</Callout>

        <H2>Recruiting</H2>
        <p>Open secretariat applications immediately after your conference ends, while people still remember whether they enjoyed it. Waiting until the new academic year costs you the graduating year&rsquo;s recommendations and the enthusiasm of everyone who just had a good weekend.</p>
        <p>Where to recruit from, in order of how well it usually works:</p>
        <ol>
          <li><strong>Your own chairs and staff.</strong> They have seen the conference from inside, you have watched them work for two days, and you know whether they answer emails. The single best source.</li>
          <li><strong>Your own delegates.</strong> Particularly for Delegate Affairs and Marketing, where having recently been a delegate is an advantage.</li>
          <li><strong>Your society or school more broadly.</strong> Finance, Logistics and Technology do not require MUN experience and are often better filled by someone who has run something else.</li>
          <li><strong>Cross-conference role boards,</strong> which is where you find people for the hard-to-fill roles and where experienced staff look between conferences. Gavelling&rsquo;s <Link href="/conferences/roles">roles board</Link> carries chair and staff openings across conferences.</li>
        </ol>
        <p>What to ask on the application. Keep it short (four questions) and make them predictive:</p>
        <ul>
          <li>Which role, and why that one rather than the others. Tests whether they read the descriptions.</li>
          <li>Describe something you organised and what went wrong with it. Tests whether they notice failure, which is the whole job.</li>
          <li>Your availability by month, including exam periods. Tests honesty and gives you a scheduling input you will need.</li>
          <li>One thing you would change about last year&rsquo;s conference. Tests whether they have opinions and whether they can express one tactfully.</li>
        </ul>
        <p>Interview for two things above everything else: reliability and the ability to say they are behind. A brilliant USG who goes quiet for three weeks is worse than an average one who sends a message on Tuesday saying the guides are late.</p>

        <H2>The handover problem</H2>
        <p>This is the defining structural weakness of student-run conferences. Every year the most experienced people leave, and unless something was written down, the new team rebuilds knowledge that already existed. Conferences do not usually die from a bad year. They die from three consecutive years of a team learning the same lessons from scratch.</p>
        <p>What to write down, per role, and where to keep it so it survives a graduating cohort:</p>
        <ul className="gv-check">
          <li><strong>The calendar.</strong> What happened in which week this year, with the dates, including what was late and by how much.</li>
          <li><strong>The contacts.</strong> Venue, caterer, printer, host institution, the school contacts who actually reply, with names and the history of the relationship.</li>
          <li><strong>The money.</strong> Last year&rsquo;s budget as planned and as spent, the fee structure, and what each line actually cost. See <Link href="/blog/mun-director-guide">the director&rsquo;s guide</Link> for how that connects to the rest.</li>
          <li><strong>The decisions and the reasons.</strong> The most valuable document and the one nobody writes. Why the committee slate is what it is, why the fee is what it is, why you dropped the Saturday social. Without reasons, next year&rsquo;s team re-runs your failed experiments.</li>
          <li><strong>The accounts.</strong> Every login, in a shared password manager owned by the conference and not by a person. An email account nobody can get into is an annual event at student conferences.</li>
          <li><strong>The post-mortem.</strong> Written in the week after the conference, by everybody, while it still stings.</li>
        </ul>
        <p>Keep all of it in one place that belongs to the conference: an organisation drive, a wiki, a shared folder with a named owner. Not in a personal account, and not in a chat history, which is where handover documents go to die.</p>
        <Callout>Run a real overlap. The outgoing team stays contactable for one month after the new one starts, with two scheduled calls. A handover document nobody can ask questions about is half a handover.</Callout>

        <H2>Delegating authority</H2>
        <p>Write down, before the year starts, who is allowed to do the four things that cannot be undone.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Action</th><th>Who</th><th>Second signature</th></tr>
            </thead>
            <tbody>
              <tr><td>Commit money</td><td>USG Finance</td><td>Secretary-General above an agreed threshold</td></tr>
              <tr><td>Email the whole delegate list</td><td>USG Delegate Affairs</td><td>Director-General reads it first</td></tr>
              <tr><td>Change or cancel a committee</td><td>USG Academics</td><td>Secretary-General, always</td></tr>
              <tr><td>Publish the conference page</td><td>USG Marketing</td><td>Secretary-General</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Set the money threshold low enough to be real. At a 300-delegate conference, anything above a few hundred in your currency needing two people is not bureaucracy. It is the thing that makes the accounts explicable to your host institution afterwards.</p>
        <p>The whole-list email rule exists because a badly worded message to 600 delegates cannot be recalled, and the commonest cause is a well-meaning USG sending it at eleven at night. One reader, always.</p>

        <H2>Access control, and who should see the finances</H2>
        <p>Not everyone on a secretariat should see everything, for reasons that are mostly about privacy rather than trust. Delegate applications contain dates of birth, dietary and medical notes, and sometimes financial aid requests. Payment records show which schools are struggling to pay. None of that needs to be visible to the fifteen people running the conference; it needs to be visible to the two or three whose job it is.</p>
        <p>A workable default:</p>
        <ul>
          <li><strong>Finances:</strong> USG Finance, Secretary-General, and the staff member or treasurer of the host institution. Nobody else by default.</li>
          <li><strong>Financial aid applications:</strong> the smallest possible group, and never the chairs of the committees those delegates will sit in.</li>
          <li><strong>Delegate personal data:</strong> Delegate Affairs and whoever handles medical and dietary information on the weekend.</li>
          <li><strong>Everything else:</strong> open to the team, because friction on ordinary work is how information gets copied into private spreadsheets, which is worse.</li>
        </ul>
        <p>Check what your tools actually enforce. In many conference platforms, including <Link href="/conferences/explore">this one</Link>, a permission that hides a section in the interface is not the same as a permission enforced in the database: some are genuinely enforced and some only tidy the navigation. Ask which is which before you rely on it, and treat anything you would be embarrassed to leak as visible to every account on the team until you have confirmed otherwise.</p>

        <H2>Meeting rhythm</H2>
        <p>Most secretariats meet too often early and not often enough late. A rhythm that works:</p>
        <ul>
          <li><strong>Months 1 to 3:</strong> fortnightly, one hour, everyone. Agenda published beforehand and minutes after, both in the shared drive.</li>
          <li><strong>Months 4 to 5:</strong> weekly, thirty minutes, standing format: what landed, what is late, what you need from someone else.</li>
          <li><strong>Final month:</strong> weekly full meeting plus short daily check-ins in the last week. The Director-General runs these, not the Secretary-General.</li>
          <li><strong>Weekend:</strong> a fifteen-minute stand-up each morning before delegates arrive, and a ten-minute debrief each evening.</li>
        </ul>
        <p>Cancel a meeting with nothing on the agenda rather than filling it. A team that has learned meetings are optional theatre stops reading the agenda, and then stops coming.</p>

        <H2>Burnout, and the two roles that always overrun</H2>
        <p>USG Academics and USG Delegate Affairs. Every time. Academics because background guide review lands in one fortnight, always collides with an exam period, and cannot be deferred without delegates receiving their guides late. Delegate Affairs because the inbox is unbounded: every school, every delegate, every question, all arriving in the last three weeks.</p>
        <p>Three things that actually help. Give both roles a deputy from the start, not when they are already drowning. Stagger the background guide deadline by committee cluster so review is three smaller weeks rather than one impossible one. And put a shared inbox in front of Delegate Affairs, with two people answering, so that a reply does not depend on one person&rsquo;s week.</p>
        <p>The last piece is the Secretary-General&rsquo;s job and it is not organisational. Ask people how they are, individually, once a month, and mean it. Students running a conference for free will work themselves into the ground out of loyalty to a team, and the only person positioned to notice is the one who is meant to be doing less operational work than everybody else.</p>
        <p>For the year as a whole, including the parts that are not people, read <Link href="/blog/mun-conference-planning">how to plan a MUN conference</Link>.</p>
      </ArticleLayout>
    </>
  );
}
