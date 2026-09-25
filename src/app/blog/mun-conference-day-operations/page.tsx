import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Running Conference Day: The MUN Operations Manual',
  description:
    'An hour-by-hour run of show for both days of a Model UN conference, and the fifteen things that go wrong.',
  path: '/blog/mun-conference-day-operations',
  ogDescription: 'The hour-by-hour operations manual for running a MUN conference day.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Running Conference Day: The MUN Operations Manual',
  description: 'An hour-by-hour run of show for a Model UN conference, and the fifteen things that go wrong.',
  url: 'https://gavelling.com/blog/mun-conference-day-operations',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-day-operations' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Running Conference Day', item: 'https://gavelling.com/blog/mun-conference-day-operations' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-day-operations"
        pitch="One live wall showing every committee: phase, speaker, timer and motions, so the command centre can see twelve rooms without walking to them."
      >
        <p>Planning a Model UN conference and running one are different jobs. Planning is done in months and rewards care. Conference day is done in minutes and rewards preparation you made weeks ago, because on the day itself you will have no time to think. This is the operations manual: what happens hour by hour, who holds what, and the fifteen failures that recur at almost every conference, with the fix for each.</p>

        <H2>The week before: the things that cannot be done on the day</H2>
        <p>Everything printed, packed or assigned must be finished before the last working day. A conference that is still printing placards on the morning of day one will start late, and a late start on day one is the only scheduling error you cannot recover from.</p>
        <H3>Print and pack</H3>
        <ul className="gv-check">
          <li>Placards for every seat, including the seats nobody has claimed yet</li>
          <li>Badges, sorted by delegation and rubber-banded, not alphabetically in one pile</li>
          <li>Room signage: committee name, committee number, and an arrow on every corridor decision point</li>
          <li>Printed delegate lists per committee for the chair, in case a device fails</li>
          <li>Certificates, unsigned, with a named person holding the pen</li>
          <li>The schedule, in large print, at the entrance and outside every room</li>
        </ul>
        <H3>The committee room box</H3>
        <p>One identical box per room, packed by one person, checked by a second. This single habit removes more day-of friction than any other.</p>
        <FactCard title="Committee room box contents">
          Placards for every seat. Two printed delegate lists. Spare paper and twenty pens. A gavel. The rules of procedure, printed. A laminated card with the command centre&apos;s phone number and the on-call runner&apos;s name. A power extension lead with at least four sockets. Two phone charging cables, one USB-C and one Lightning. A roll of masking tape. Blu Tack. A box of tissues. A bottle of water for the dais.
        </FactCard>
        <H3>Assign every role in writing</H3>
        <p>Not &quot;the logistics team handles registration&quot;. Write a sheet that says who is at the registration desk at 07:30, who is on corridor duty for rooms 1 to 4, who is the runner, who is in the command centre, and who is the named <Link href="/blog/mun-safeguarding">safeguarding lead</Link>. Print it. Give everyone a copy. Ambiguity on the day resolves as nobody doing the job.</p>
        <Callout>Every member of staff should be able to answer three questions without thinking: where am I meant to be right now, who do I call if something goes wrong, and where is the nearest toilet. Delegates ask the third one more than you expect.</Callout>

        <H2>Registration desk design, and the throughput maths</H2>
        <p>This is the operational problem that most obviously fails, because it fails visibly, at the entrance, in front of every advisor.</p>
        <p>Do the arithmetic before you design the desk. If checking in one delegation takes ninety seconds, and 30 delegations arrive across a 45-minute window, a single queue needs 45 minutes of continuous perfect work with no arrival spikes. Arrivals are not smooth: coaches arrive together, so sixty per cent of your delegations turn up in a fifteen-minute band. A single queue for 400 people will not clear, and the opening ceremony will start late.</p>
        <p>Three fixes, in order of effect.</p>
        <ul>
          <li><strong>Check in delegations, not delegates.</strong> The advisor collects a single envelope containing every badge and placard for their school. One transaction for twelve people instead of twelve.</li>
          <li><strong>Split by letter, with real signs.</strong> Three desks (A to F, G to N, O to Z), each with its own pre-sorted box. Three desks with one shared box is not three desks.</li>
          <li><strong>Separate the exceptions.</strong> One person, to the side, handles unpaid fees, walk-ins, substitutions and lost bookings. These take five minutes each and they are what blocks a queue.</li>
        </ul>
        <p>Put a floating staff member in the queue itself, moving down the line answering questions and pointing people to the right desk. It costs one person and roughly halves the perceived wait.</p>

        <H2>Opening ceremony: the shortest version that works</H2>
        <p>The opening ceremony exists to do four things: welcome people, state the rules that matter, tell everyone where to go, and end. Twenty-two minutes is enough. Forty-five is common and is stolen from committee time.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Minutes</th><th>Item</th></tr></thead>
            <tbody>
              <tr><td>0 to 3</td><td>Welcome from the Secretary-General</td></tr>
              <tr><td>3 to 8</td><td>Host institution or guest speaker. One only, briefed on the time limit.</td></tr>
              <tr><td>8 to 14</td><td>Housekeeping: fire exits, first aid, the safeguarding lead by name and face, phone policy, photography and consent, lunch arrangements</td></tr>
              <tr><td>14 to 20</td><td>Committee rooms, read aloud and on screen, with the route described</td></tr>
              <tr><td>20 to 22</td><td>Gavel in. Dismiss by committee, not all at once.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Dismissing by committee is worth stating twice. Four hundred people leaving one hall simultaneously for twelve destinations produces ten minutes of corridor chaos. Calling three committees at a time, with a staff member at the door of each, produces none.</p>

        <H2>Session one, and the staff walk that catches everything</H2>
        <p>The first twenty minutes of session one are when every latent problem surfaces at once: a missing chair, a room with no power, a committee of nine where you expected twenty, a delegate in the wrong room, a projector that shows nothing.</p>
        <p>Assign two people to do nothing else for those twenty minutes but walk every room in sequence with a clipboard, and record four things per room: is the dais present, is the room at the expected count, has roll call started, and is anything broken. That walk is the single highest-value twenty minutes of staff time in the conference.</p>
        <p>Once roll call is done and the general speakers list is running, most rooms will be fine for an hour. If you want the chair&apos;s side of that first hour, <Link href="/blog/how-to-run-mun-committee">the complete chair guide to running a committee</Link> is the companion piece, and new chairs should be pointed at <Link href="/blog/how-to-chair-first-mun">the first-time chair guide</Link> the week before.</p>

        <H2>The command centre</H2>
        <p>One room, with the door shut, and the same people in it all day. Not a corridor, not the back of the plenary, not a group chat. The command centre exists so that a chair who needs help contacts one place and gets an answer, rather than telephoning three secretariat members in sequence.</p>
        <p>Who sits there: the <Link href="/blog/mun-secretariat-roles">Director-General</Link> or whoever owns operations, one person on communications who answers the phone and the chair channel, one runner on standby, and the person with the venue&apos;s contact details. The Secretary-General should be walking, not sitting.</p>
        <p>What it holds: the master schedule, the room list with chair names and phone numbers, the delegate list, the incident log, the spare equipment, the first aid kit, the medical and dietary information, and the box of spare everything.</p>
        <H3>How a chair asks for help</H3>
        <p>Publish exactly one route and make it work. A single phone number and a single group channel, with the rule that the channel is for non-urgent requests and the phone is for anything that stops a committee. Tell chairs in the briefing that they should ask early rather than coping, because a chair who copes for forty minutes produces a problem that is then forty minutes old.</p>
        <Callout>Give every chair the command centre number printed on a card in their box, not sent in a message they will have to scroll for while a room of thirty watches them.</Callout>

        <H2>Knowing what is happening in twelve rooms at once</H2>
        <p>This is the genuinely hard operational problem of the day, and the one that scales worst. With three committees you can walk the building. With twelve, walking takes twenty minutes per circuit, you see each room for ninety seconds, and you learn nothing about the room you are not standing in.</p>
        <p>The traditional answer is a runner per four rooms reporting on a schedule, which works and costs you three or four people for the whole day. The better answer, if your committees are running on software, is that the secretariat can see every room at once.</p>
        <p>This is the one job where Gavelling genuinely changes the shape of the day rather than merely tidying it. If your committees are linked to a conference on Gavelling, every room opens as a live session, and the secretariat watches all of them from one status wall: what phase each committee is in, who has the floor, what the timer says, what motions are pending. It is free for the organiser. It does not replace the walk, because a status wall cannot tell you that a room is tense or that a chair is out of their depth, but it tells you which rooms to walk to first, which is most of the value.</p>
        <p>Whatever you use, define in advance what &quot;this room needs attention&quot; looks like: a committee still in roll call forty minutes in, a committee that has been in unmoderated caucus for three consecutive motions, a committee with no motions at all for an hour. Those three signals catch most stalled rooms. Our guide to <Link href="/blog/best-mun-software-2026">MUN software in 2026</Link> compares the options if you are choosing one.</p>

        <H2>Breaks, lunch, and moving 400 people</H2>
        <p>Lunch is a logistics problem disguised as a catering problem. Four hundred people cannot be served from one point in forty minutes, and committees released simultaneously produce a single queue.</p>
        <ul>
          <li><strong>Stagger the release.</strong> Two waves twenty minutes apart, published in advance so chairs suspend at the right moment. Rotate which committees go first on day two.</li>
          <li><strong>Serve from at least two points</strong> for over 200 people, and three over 350.</li>
          <li><strong>Handle dietary requirements separately and by name.</strong> A labelled, reserved tray collected from a named person is safer and faster than a queue in which someone has to ask.</li>
          <li><strong>Feed the staff and the chairs first or last, never in the middle.</strong> Chairs who miss lunch are worse at their jobs for the whole afternoon.</li>
          <li><strong>Say where the toilets, water and quiet room are</strong> at every break. Repetition is free.</li>
        </ul>

        <H2>The fifteen things that go wrong</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Failure</th><th>The fix, on the day</th></tr></thead>
            <tbody>
              <tr><td>A chair does not turn up</td><td>Have two floating chairs briefed on every committee. If you have none, the co-chair runs it and a secretariat member sits in. Never leave a room without a dais.</td></tr>
              <tr><td>A projector or screen fails</td><td>Proceed without it. Nothing in Model UN requires a projector. Chairs should be told this in the briefing so they do not stall waiting for IT.</td></tr>
              <tr><td>Wi-Fi collapses under 400 phones</td><td>Know this in advance. Chairs keep printed lists. If devices are central to your procedure, test at full load during the <Link href="/blog/mun-conference-venue-logistics">site visit</Link> and have a mobile hotspot per floor.</td></tr>
              <tr><td>A delegate is in the wrong room</td><td>Corridor staff redirect rather than sending them to registration. Give every corridor staffer the full room list.</td></tr>
              <tr><td>A delegation arrives that did not register</td><td>The exceptions desk. Seat them in under-filled committees as observers if necessary. Decide the payment question afterwards, not at the door.</td></tr>
              <tr><td>A committee is half the expected size</td><td>Merge the smallest two committees at the first break if the gap is severe, or adjust the quorum. Decide before lunch, never after.</td></tr>
              <tr><td>A delegate falls ill</td><td>First aid, then the advisor, then the parent. Known route, named people, written in the incident log.</td></tr>
              <tr><td>A safeguarding concern is raised</td><td>Straight to the named safeguarding lead. No debate, no delay, no group chat.</td></tr>
              <tr><td>A bag or phone goes missing</td><td>One lost property point from the first minute, and say where it is in the opening ceremony.</td></tr>
              <tr><td>A fire alarm</td><td>Assembly point per committee, chairs count their own room against the printed list, report to the command centre. Brief chairs on this; most will not have thought about it.</td></tr>
              <tr><td>A room gets too hot or too loud</td><td>Swap rooms with a smaller committee at the break. Do it early, because it gets harder as papers accumulate.</td></tr>
              <tr><td>Two delegates have a serious argument</td><td>Chair suspends, both leave the room with separate staff, the advisor is told. Our guide to <Link href="/blog/mun-delegate-tips">delegate conduct</Link> helps chairs set expectations early.</td></tr>
              <tr><td>The schedule slips by twenty minutes</td><td>Cut from unmoderated caucus time, never from the closing ceremony. Tell all chairs at once, in one message, with a new end time.</td></tr>
              <tr><td>A committee finishes early</td><td>Have a second topic or a crisis update ready for every committee. Empty time is when discipline goes.</td></tr>
              <tr><td>An advisor is unhappy</td><td>The Secretary-General speaks to them personally, in a quiet room, within the hour. This is the single highest-value hour of the day for next year&apos;s registration.</td></tr>
            </tbody>
          </table>
        </TableWrap>

        <H2>Day two is a different problem</H2>
        <p>Day one is about control. Day two is about energy and output, and it fails in different ways.</p>
        <p>Attendance drops. Expect five to ten per cent fewer delegates, concentrated in the first session. Chairs should re-run roll call rather than assuming yesterday&apos;s numbers, because quorum and voting thresholds move with the room.</p>
        <p>Energy drops, especially in the first session after the social. Chairs should open day two with something structured rather than an open speakers list: a short moderated caucus with a sharp question does more for a tired room than half an hour of unmoderated time.</p>
        <p>Drafting peaks, which changes what staff do. Working papers and draft resolutions arrive in a burst, and if they arrive by email to four different addresses in four different formats, the afternoon becomes an administrative jam. Decide one submission route before the conference, tell chairs, and tell delegates in the opening ceremony. If your committees run on a platform where delegates submit directly into the room, use that and say so.</p>
        <p>Voting is the other day-two pressure point. Read <Link href="/blog/mun-voting-procedures">the guide to MUN voting procedures</Link> with your chairs beforehand, because substantive votes are where a room disputes a ruling, and a chair who is improvising the threshold in front of forty delegates loses the room.</p>

        <H2>Closing, pack-down and the same-evening debrief</H2>
        <p>Collect the resolutions as they pass, not at the end. A chair who has to reconstruct six passed resolutions at 16:00 will delay the ceremony.</p>
        <p>Run the <Link href="/blog/mun-award-ceremony-guide">closing ceremony</Link> to time. Thank the chairs before the awards, not after, because half the room leaves once the awards are read. Whatever your awards process is, it should be decided before the ceremony begins and it should be consistent across committees. <Link href="/blog/mun-awards-guide">The awards guide</Link> covers how chairs are usually asked to judge.</p>
        <p>Pack-down is a named job for named people, or it becomes the secretariat&apos;s job at 18:00 while the advisors watch. Rooms restored, signage down, lost property boxed, equipment counted against the list it went out on.</p>
        <p>Then debrief the same evening, for thirty minutes, before anyone goes home. Not next week. Three questions, written down as people speak: what went wrong today, what nearly went wrong, and what we should change. The version of this conversation you have in the building is worth far more than the version you have in a fortnight, because by then everyone remembers the story rather than the failure.</p>

        <H2>The week after</H2>
        <ul className="gv-check">
          <li>Refunds and outstanding invoices settled within five working days</li>
          <li>Thank-you emails to advisors, chairs and the venue, named and personal</li>
          <li>Certificates issued, including to delegates who did not win anything</li>
          <li>Photographs published, with the consent rules you stated actually honoured</li>
          <li>Survey out within 48 hours, while it is still fresh</li>
          <li>The written handover: what to change, filed where next year&apos;s secretariat will find it</li>
        </ul>
        <p>That last one is the difference between a conference that improves and one that relearns the same lesson every year. <Link href="/blog/mun-director-guide">The director guide</Link> covers the secretariat structure that owns it, and <Link href="/blog/mun-conference-planning">the planning guide</Link> covers the eight months that put you here.</p>
      </ArticleLayout>
    </>
  );
}
