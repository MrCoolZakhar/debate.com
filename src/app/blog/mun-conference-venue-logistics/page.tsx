import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Conference Venue and Logistics: How to Choose and What to Ask',
  description:
    'How many rooms a Model UN conference needs, what each one must have, and everything to ask before you sign.',
  path: '/blog/mun-conference-venue-logistics',
  ogDescription: 'How to size, visit and contract a venue for a Model UN conference.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Conference Venue and Logistics: How to Choose and What to Ask',
  description: 'Room sizing, site visits, contracts, catering and accessibility for a Model UN conference.',
  url: 'https://gavelling.com/blog/mun-conference-venue-logistics',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-venue-logistics' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Venue and Logistics', item: 'https://gavelling.com/blog/mun-conference-venue-logistics' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-venue-logistics"
        pitch="Committees that open as live sessions on delegates' own phones, so a room with weak projection is not a broken committee."
      >
        <p>The venue is usually the first irreversible decision a conference makes. It fixes the date, it caps the delegate count, it determines a large share of the <Link href="/blog/mun-conference-budget">budget</Link>, and it is signed long before you know how many delegations will register. Get the sizing wrong and you will either be turning schools away in January or running six committees in a building booked for twelve. This guide is the arithmetic, the site visit, the contract questions and the things that fail on the day.</p>

        <H2>Sizing: how many rooms you actually need</H2>
        <p>The number organisers get wrong is not the committee rooms, which are obvious. It is everything else.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Space</th><th>How many</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>Committee rooms</td><td>One per committee</td><td>Crisis committees need two: the main room plus a backroom nearby.</td></tr>
              <tr><td>Plenary or hall</td><td>One, seating everyone</td><td>Used twice for perhaps 50 minutes in total, priced for the whole day.</td></tr>
              <tr><td>Registration area</td><td>One, near the entrance</td><td>Needs queueing space, not just tables. See the throughput note below.</td></tr>
              <tr><td>Command centre</td><td>One small room, lockable</td><td>Non-negotiable. It holds your records, medical information and spares.</td></tr>
              <tr><td>Staff and chair room</td><td>One</td><td>The room everyone forgets. Chairs need somewhere to eat and decompress.</td></tr>
              <tr><td>Quiet room</td><td>One</td><td>For delegates who need to step out. Must be findable and staffed or checked.</td></tr>
              <tr><td>Advisors&apos; room</td><td>One, if you have visiting schools</td><td>Coffee and chairs. Cheap, and it is where advisors decide to come back.</td></tr>
              <tr><td>Lunch space</td><td>Seats for at least half at once</td><td>Or a plan for eating in committee rooms, agreed with the venue.</td></tr>
              <tr><td>Bag and coat storage</td><td>One supervised room</td><td>Delegations arrive with luggage. Unsupervised piles in a corridor are a problem.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>So a conference with eight committees, one of them crisis, needs roughly eight committee rooms plus a backroom, a hall, and five or six ancillary spaces. Sixteen rooms, not eight. That is the calculation that determines whether a school building is big enough.</p>
        <H3>Delegate count per room</H3>
        <p>Plan on committee sizes of 20 to 45 for General Assembly committees, 15 to 20 for specialised agencies, and 15 for a Security Council. Then size the room at roughly one and a half times the committee&apos;s seated footprint, because delegates need to move during unmoderated caucus and a room packed to capacity makes that impossible. A classroom that seats 30 in exam rows is not a room for 30 delegates.</p>
        <Callout>Book one more committee room than you think you need. It becomes the overflow, the second crisis room, the interview room or the place you move a committee whose air conditioning has failed. It is the cheapest insurance in the whole budget.</Callout>

        <H2>What each committee room must have</H2>
        <ul className="gv-check">
          <li><strong>Seats for every delegate plus the dais</strong>, with a table each. Delegates write.</li>
          <li><strong>A layout that allows a horseshoe or blocks</strong>, not fixed lecture seating. Fixed tiered seating kills caucusing.</li>
          <li><strong>A door that closes</strong>, and walls that do not transmit the next committee&apos;s vote.</li>
          <li><strong>Power.</strong> At least two working sockets reachable from the dais. Laptops and a timer run all day.</li>
          <li><strong>A projector or screen</strong>, useful but never essential. Plan for the committee to work without it.</li>
          <li><strong>Wi-Fi that survives 40 phones</strong>, which is the one that actually fails. More on this below.</li>
          <li><strong>Natural light and controllable heat</strong>, or a window that opens. Forty people in a sealed room for three hours is genuinely unpleasant by the afternoon.</li>
          <li><strong>A wall or door for the committee sign</strong> that the venue will allow you to attach something to.</li>
        </ul>
        <H3>The Wi-Fi problem, stated properly</H3>
        <p>A venue that says it has Wi-Fi is telling you about bandwidth. Your problem is not bandwidth: it is the number of simultaneous client connections and the access point density. Four hundred phones plus laptops in a building designed for a hundred staff will saturate the access points regardless of the internet connection behind them, and the failure looks like everything working in the foyer and nothing working in room 6.</p>
        <p>Ask three specific questions on the site visit: how many access points serve the committee rooms, what the per-access-point client limit is, and whether the network has been used for an event of this size before. Then test, standing in the furthest committee room, with several devices.</p>
        <p>Design so that a Wi-Fi failure is an inconvenience rather than a collapse. If your committees run on software, make sure it works on delegates&apos; own phones over mobile data rather than requiring a shared connection. Gavelling sessions are joined with a six-character code on any phone, with no app to install, which means a room with weak venue Wi-Fi falls back to mobile data rather than falling back to paper. Whatever you use, chairs should still carry printed delegate lists, and that rule should be in the chair briefing.</p>

        <H2>The plenary, which is the expensive room</H2>
        <p>You need it for the opening ceremony and the closing ceremony, which is perhaps fifty minutes of use, and you will usually pay for it for the whole day or the whole conference. Three ways to reduce that.</p>
        <ul>
          <li><strong>Use it as the lunch space</strong> or as the registration overflow between ceremonies, if the venue permits.</li>
          <li><strong>Hold the opening in the largest committee room</strong> and stream or repeat it, if your conference is small enough that it fits.</li>
          <li><strong>Book it for two windows rather than the day</strong>, if the venue prices by session. Many do, and nobody asks.</li>
        </ul>
        <p>What it must have: seating for everyone at once, a microphone that works with a person who has never used one, a way to display the committee room list, and enough exits to clear 400 people without a crush. Check the last one physically rather than on a floor plan.</p>

        <H2>School, university or hired venue</H2>
        <TableWrap>
          <table>
            <thead><tr><th></th><th>Your own school or university</th><th>Another institution</th><th>Commercial venue</th></tr></thead>
            <tbody>
              <tr><td>Cost</td><td>Usually free or internal recharge</td><td>Low to moderate</td><td>High, and the largest budget line</td></tr>
              <tr><td>Liability and insurance</td><td>Held by your institution, which is the simplest position</td><td>Negotiated. Get it in writing.</td><td>Yours, and you will need event insurance</td></tr>
              <tr><td>Access and set-up time</td><td>Flexible</td><td>Restricted</td><td>Contractual, often charged by the hour</td></tr>
              <tr><td>Room suitability</td><td>Classrooms, often with fixed furniture</td><td>Varies</td><td>Designed for events, usually best</td></tr>
              <tr><td>Weekend access</td><td>Needs a caretaker, and that cost is real</td><td>Same</td><td>Included</td></tr>
              <tr><td>Catering</td><td>Your own kitchen or external</td><td>Theirs, usually mandatory</td><td>Theirs, usually mandatory and expensive</td></tr>
              <tr><td>Best for</td><td>First- and second-year conferences</td><td>Growing conferences, and a partnership worth having</td><td>Established conferences with a budget and a reputation to match</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>For a <Link href="/blog/start-a-mun-conference">first conference</Link>, use your own institution. The cost, the liability and the flexibility all point the same way, and the trade you are making, which is worse rooms, matters far less than you think. Delegates remember the committees, not the carpet.</p>
        <p>A university that is not yours is often the best second step, particularly if a member of your team studies there or if their outreach office is a potential sponsor. That conversation is covered in <Link href="/blog/mun-conference-sponsorship">our sponsorship guide</Link>, because a venue waiver is usually the largest in-kind sponsorship available to a MUN conference.</p>

        <H2>The site visit</H2>
        <p>Go in person, on a weekday, with two people and a tape measure, and ideally at the time of day your conference will run. A floor plan will not tell you that room 6 is next to the boiler.</p>
        <FactCard title="Site visit checklist">
          <p><strong>Rooms.</strong> Count seats in each. Photograph the layout. Check whether furniture can be moved and who moves it. Check sockets and where they are. Check whether the door locks and who holds keys.</p>
          <p><strong>Routes.</strong> Walk from the entrance to the furthest committee room and time it. Walk from the hall to the lunch space. Note every point where someone would have to guess which way to go.</p>
          <p><strong>Accessibility.</strong> Step-free route from the street to every committee room, the hall and the lunch space. Lift capacity and whether it is available at weekends. Accessible toilets on each floor in use. Door widths.</p>
          <p><strong>Toilets.</strong> Count them, per floor, against 400 people at a fifteen-minute break.</p>
          <p><strong>Technology.</strong> Test Wi-Fi in the furthest room with several devices. Turn on a projector yourself. Find out who fixes it at the weekend.</p>
          <p><strong>Acoustics.</strong> Stand at the back of a committee room while someone speaks from the dais without amplification.</p>
          <p><strong>Practicalities.</strong> Where deliveries arrive. Where bins are. Where a first aid room is. Where you would put a lost property table. Where staff can eat.</p>
          <p><strong>People.</strong> Meet the caretaker or facilities manager. They will matter more on the day than the person who signs the contract.</p>
        </FactCard>

        <H2>The contract, and what to ask before you sign</H2>
        <p>Even an internal booking at your own school should be confirmed in writing with these points answered. With a commercial venue they are the contract.</p>
        <ul>
          <li><strong>Dates and hours, including set-up and pack-down.</strong> If you need the building from 07:00 and it opens at 08:30, your conference starts at 10:00.</li>
          <li><strong>Exactly which rooms</strong>, by name or number, not &quot;eight classrooms&quot;.</li>
          <li><strong>Cancellation terms</strong>, with the dates and the percentages. What happens if the conference is cancelled at eight weeks, and at two.</li>
          <li><strong>What is included</strong>: furniture set-up, cleaning, staffing, heating on a weekend, Wi-Fi, AV, parking.</li>
          <li><strong>What is charged extra</strong>, and at what rate. Overtime after a stated hour is the usual surprise.</li>
          <li><strong>Damage and deposits.</strong> Who inspects, when, and against what record. Photograph every room before you use it.</li>
          <li><strong>Insurance</strong>: what they require you to hold, and what their own policy covers.</li>
          <li><strong>Attachment rules.</strong> Whether you can put signs on walls and with what. Many venues forbid tape.</li>
          <li><strong>Catering exclusivity</strong>, and whether outside food is permitted at all.</li>
          <li><strong>The named contact on the day</strong>, with a mobile number that is answered on a Saturday.</li>
        </ul>
        <Callout>The two clauses that cost conferences money are access time and overtime. Establish the earliest hour you may enter and the latest you may stay, in writing, before you build the schedule. Working backwards from a contract is much cheaper than discovering it at 17:45 on day two.</Callout>

        <H2>Catering and the logistics of 400 lunches</H2>
        <p>Lunch is a throughput problem before it is a food problem. Four hundred people cannot be served from one point in forty minutes.</p>
        <p>The options, in ascending order of cost: delegates bring their own, which is free and produces litter and a fairness problem; a packed lunch collected at registration, which is the best value and the fastest to distribute; a buffet, which needs staggered release and at least two serving points; and a seated meal, which is a two-hour commitment you almost certainly cannot afford in the schedule.</p>
        <p>Whatever you choose, four rules. Stagger the release of committees by at least twenty minutes. Serve from two points over 200 people and three over 350. Handle dietary requirements by name, with a reserved labelled portion collected from a named person, rather than by asking a queue. And feed the chairs and staff either first or last, never in the middle, because a chair who misses lunch is worse at the job all afternoon.</p>
        <p>Collect dietary requirements at registration and treat allergy and preference as different fields. Your <Link href="/blog/mun-safeguarding">safeguarding and data obligations</Link> apply to this information too: it is health data about minors, and it should go to the caterer and the command centre and nowhere else.</p>

        <H2>Accessibility, decided before you sign</H2>
        <p>This determines who can attend your conference, which makes it a venue decision rather than a logistics one. A building with committee rooms on a second floor and a lift that is not available at weekends has excluded some delegates, and you will find out about it in February when a school asks.</p>
        <ul>
          <li><strong>Step-free route</strong> from the street to registration, the hall, every committee room, the lunch space and at least one accessible toilet.</li>
          <li><strong>Lift availability at weekends</strong>, confirmed in writing, including who holds the key if it is locked.</li>
          <li><strong>Accessible toilets</strong> that are actually unlocked and not used as storage.</li>
          <li><strong>Hearing support.</strong> A hearing loop in the plenary if one exists, and a rule that dais microphones are used rather than declined.</li>
          <li><strong>A quiet room</strong>, on the ground floor, signed, with the location announced in the opening ceremony.</li>
          <li><strong>Seating and sightlines</strong> for a delegate who lip-reads, arranged with the chair in advance rather than on the day.</li>
        </ul>
        <p>Then publish what you have and what you do not. An honest access statement on the conference page (&quot;committee rooms 1 to 6 are step-free, rooms 7 and 8 are on the first floor served by a lift&quot;) lets an advisor make a decision. Silence forces them to email, and many will simply go elsewhere. Our guide to <Link href="/blog/mun-accessibility">accessibility at MUN</Link> covers the rest of the conference.</p>

        <H2>Signage, which is cheap and always under-done</H2>
        <p>The test is simple: could a delegate who has never been in this building, with no phone, get from the front door to committee room 7? If the answer requires them to ask someone, put up more signs.</p>
        <p>What to print: a large sign on every committee room door with the committee name and number. An arrow at every corridor junction and every staircase. A list of committees and rooms at the entrance, at the foot of each staircase and outside the hall. Toilets, lunch, quiet room and registration, each signed from the entrance. And a schedule, in large print, in at least three places.</p>
        <p>Print them a week ahead in the venue&apos;s permitted format, and check with the caretaker what you may attach them with. Also put a human at the two junctions where people will still get it wrong, because they will.</p>

        <H2>Technology to bring, hire or assume will fail</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Item</th><th>Decision</th></tr></thead>
            <tbody>
              <tr><td>Committee timers and speakers lists</td><td>Run on the dais laptop or phone. Free session software removes the need for a projector or a hired display.</td></tr>
              <tr><td>Projectors</td><td>Use what the venue has. Never make a committee depend on one.</td></tr>
              <tr><td>Microphones</td><td>Hall only. Test with the actual speakers, not with a staff member who is used to it.</td></tr>
              <tr><td>Extension leads</td><td>Bring one per room. The most under-packed item at every conference.</td></tr>
              <tr><td>Printing</td><td>Everything printed before the day. Assume no working printer on site.</td></tr>
              <tr><td>Spare laptop</td><td>One, charged, in the command centre.</td></tr>
              <tr><td>Phone chargers</td><td>Two cables per room. Chairs run their committee from a device for eight hours.</td></tr>
              <tr><td>Mobile hotspot</td><td>One per floor as the Wi-Fi fallback for the dais.</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Our comparison of <Link href="/blog/best-mun-software-2026">MUN software in 2026</Link> covers the choice itself. The logistics point is narrower: whatever you choose should run on a device a chair already owns, because hired hardware is the line most likely to be cut and the thing most likely to fail.</p>

        <H2>The room nobody books</H2>
        <p>Staff space. Your chairs and the rest of your <Link href="/blog/mun-secretariat-roles">secretariat</Link> need one. Your chairs will be in a room with forty delegates for eight hours across two days, making rulings in public. They need somewhere with a door, coffee, a table and no delegates, and if you do not provide it they will decompress in a corridor where delegates can hear them, which is a different problem.</p>
        <p>Book it, stock it, and put the chair briefing in it on the morning of day one. Then use it for the same-evening debrief. It is the smallest room in the building and it does more for the quality of your chairs than any amount of briefing documents.</p>
        <p>Once the venue is fixed, the rest of the operational day builds on it: <Link href="/blog/mun-conference-day-operations">the conference day operations guide</Link> covers the run of show, and <Link href="/blog/mun-conference-planning">the planning guide</Link> covers the months around this decision.</p>
      </ArticleLayout>
    </>
  );
}
