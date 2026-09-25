import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Start a MUN Club at Your School: From Proposal to First Conference',
  description:
    'Getting the approval, finding an advisor, recruiting members, an eight-week first term, and the succession plan that stops the club dying in year three',
  path: '/blog/start-mun-club',
  ogDescription: 'From the first conversation with a teacher to your first conference, in one term.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Start a MUN Club at Your School: From Proposal to First Conference',
  description: 'From the first conversation with a teacher to your first conference, in one term.',
  url: 'https://gavelling.com/blog/start-mun-club',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/start-mun-club' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Start a MUN Club', item: 'https://gavelling.com/blog/start-mun-club' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="start-mun-club"
        pitch="Gavelling sessions are free and need no account, so a new club can run a real mock committee in its second week with nothing but a laptop and some phones."
      >
        <p>A Model UN club is one of the cheapest things a school can run and one of the easiest to kill. The usual failure is not lack of interest: it is a first meeting that is a lecture, a term with no fixed date, and a founder who graduates without training a replacement. This guide covers the founding sequence in the order it actually has to happen, from the proposal that gets a yes to the handover that gets you a year four.</p>

        <H2>The proposal that gets approved</H2>
        <p>Before anything else you need institutional permission: a member of staff responsible, a room, a slot in the timetable and a place in whatever list of clubs the school publishes. Whoever approves that is busy and is thinking about risk and staff time, not about international relations.</p>
        <p>Write one page. Not two. It should answer, in this order, the questions they are going to ask:</p>
        <ul>
          <li><strong>What it is,</strong> in two sentences, for someone who has never heard of it. &ldquo;Students represent countries in simulated UN committees, research a position, debate it under formal rules and negotiate a written resolution.&rdquo;</li>
          <li><strong>What the school gets.</strong> Public speaking, research and writing practice, and an activity that is straightforwardly good on university applications. Say it once and do not oversell.</li>
          <li><strong>Staff time required,</strong> stated honestly and specifically: one hour a week of supervision in term time, plus two or three weekends a year if the club attends conferences. Underquoting this is the most common reason a club collapses in term two.</li>
          <li><strong>Cost to the school:</strong> a room, and nothing else in year one. Say that explicitly.</li>
          <li><strong>Safeguarding and trips,</strong> which is what they are actually worried about. Note that conference attendance follows the school&rsquo;s existing trip procedure and requires staff accompaniment.</li>
          <li><strong>Who is doing it:</strong> you, named, with a second name so it is not one person.</li>
          <li><strong>The first-term plan,</strong> as eight lines. Having it already written is what makes the difference between a yes and &ldquo;come back to me&rdquo;. Our <Link href="/blog/mun-club-curriculum">MUN club curriculum</Link> has a session-by-session plan you can adapt.</li>
        </ul>
        <Callout>Ask for the smallest possible thing first: a room, a weekly slot and permission to advertise. Do not ask for money, a trip or a budget line in the same conversation. Get the club existing, run it for a term, then ask for the trip with attendance numbers in your hand.</Callout>

        <H2>Finding a faculty advisor</H2>
        <p>You need a member of staff. Who it is matters less than people assume: the best advisors are often not history or politics teachers but whoever is genuinely willing to give an hour a week and turn up on a Saturday.</p>
        <p>Be precise about what you are asking for, because a vague ask reads as unlimited. In year one, an advisor is being asked to be present for the weekly meeting, to be the named adult for approvals and communications with parents, and to accompany the club to one conference. They are not being asked to teach procedure or to write anything, and saying that out loud usually converts a maybe into a yes.</p>
        <p>Hand them something on day one: a single page listing the meeting slot, the contact address for the club, the conference dates you are considering and the names of the two students running it. An advisor who never has to invent anything stays for years. Our <Link href="/blog/mun-faculty-advisor-guide">faculty advisor guide</Link> is the page to send them once they have agreed.</p>

        <H2>Recruiting</H2>
        <p>Do not recruit only from the debating society. Debaters are useful and they are also the group most likely to treat Model UN as a worse version of the thing they already do. The people who tend to stay are elsewhere.</p>
        <ul>
          <li><strong>Students who like writing</strong> but do not like performing. There is a lot of drafting in this activity and drafters win resolutions.</li>
          <li><strong>Students who have lived abroad or speak another language at home.</strong> They are often instantly better at the perspective-taking part and are rarely asked.</li>
          <li><strong>Quiet students with strong opinions.</strong> Model UN gives structure to speaking, which is exactly what a lot of quiet people need.</li>
          <li><strong>One or two older students with social pull.</strong> An older year group attending makes the club legitimate for everyone else.</li>
        </ul>
        <p>Practical recruiting: a poster with a date and a room on it, one announcement in assembly, and a personal invitation to about fifteen named people. The personal invitation does most of the work. Expect roughly half of the people who say they will come to turn up, and about half of those to still be attending in week six. A club with twelve regulars is a functioning club.</p>

        <H2>The first meeting decides whether there is a second</H2>
        <p>The single biggest mistake is spending the first meeting explaining procedure. Nobody has ever been recruited by a diagram of motion precedence.</p>
        <p>Run it like this, in 45 minutes:</p>
        <ul>
          <li><strong>Five minutes:</strong> <Link href="/blog/what-is-model-un">what Model UN is</Link>, and one story about a real committee.</li>
          <li><strong>Twenty-five minutes:</strong> a debate. Give out six countries on slips of paper with three bullet points each, pick a topic everyone already has views about, and run a very simplified discussion: each country gets a 45-second opening, then open discussion, then a vote on one sentence. No motions, no points, no jargon beyond &ldquo;the delegate of&rdquo;.</li>
          <li><strong>Ten minutes:</strong> what the term looks like, dates on the board, and the conference you intend to attend.</li>
          <li><strong>Five minutes:</strong> sign-up with names and email addresses, on paper, before they leave the room.</li>
        </ul>
        <p>People join because they enjoyed twenty-five minutes of arguing. Everything procedural can wait a fortnight.</p>

        <H2>The first term: eight sessions</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Week</th><th>Session</th><th>Outcome</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Taster debate, as above</td><td>Members and contact details</td></tr>
              <tr><td>2</td><td>What a committee is: roles, the dais, the day&rsquo;s shape. Then a second short debate</td><td>Everyone has spoken once</td></tr>
              <tr><td>3</td><td>Speaking: the four-part opening speech, written and delivered in the session</td><td>Each member has a 60-second speech</td></tr>
              <tr><td>4</td><td>Research: pick a country and a topic, find one vote and one statement</td><td>A one-page research sheet each</td></tr>
              <tr><td>5</td><td>Procedure, taught through use: the speakers list, moderated and unmoderated caucus, one motion at a time</td><td>Members can raise a motion correctly</td></tr>
              <tr><td>6</td><td>Writing: clauses, working papers, how a resolution is built</td><td>One shared working paper drafted</td></tr>
              <tr><td>7</td><td>Position papers: write one, swap, mark each other against a short rubric</td><td>A paper each, reviewed</td></tr>
              <tr><td>8</td><td>Full mock committee, two hours if you can get them</td><td>Ready to attend a conference</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two rules that matter more than the content. Every session contains speaking: a session that is entirely explanation loses people. And the dates are fixed at the start of term and never moved, because a club that reschedules twice is a club that has stopped existing.</p>

        <H2>Running your first mock committee</H2>
        <p>Week eight is the test of everything. It is also the session where a new club usually discovers that procedure is harder to run than to explain.</p>
        <p>Make it small and structured. Ten to sixteen delegates, one topic everyone can research in twenty minutes, one or two experienced members on the dais, and a hard two-hour limit. Give every delegate a printed half-page with their country&rsquo;s position and three facts, because a first mock committee fails when half the room has nothing to say.</p>
        <p>Keep the procedure to five things: roll call, a speakers list, a moderated caucus, an unmoderated caucus and a vote. Do not teach points of order, amendments or rights of reply in the first mock. They can be added in the second.</p>
        <FactCard title="What you need to run it">
          A room, a laptop for the dais, a phone each for the delegates and something to keep time. Gavelling sessions are free and need no account: the chair opens a session at <Link href="/create/sessions">gavelling.com/create</Link>, reads out the six-character code, and delegates join on their phones to see the speakers list and request the floor. That removes the two things that usually break a first mock committee, which are timekeeping and nobody knowing whose turn it is.
        </FactCard>

        <H2>Choosing a first conference</H2>
        <p>Go local, go small and go early. A first conference should be close enough to travel to in a morning, small enough that beginners get speaking time, and early enough in the year that the club has something to aim at. Our guide to <Link href="/blog/choosing-mun-conferences">choosing MUN conferences</Link> covers the wider circuit.</p>
        <p>How many to send: six to ten. Enough that nobody is alone in a committee, few enough that your advisor can physically supervise them. Ask the conference for beginner-friendly committees and be honest about experience on the application, because an accurate answer gets your students a better allocation than an inflated one.</p>
        <p>What to check before you commit: total cost per student including travel, whether the conference offers financial aid, whether it accepts individual delegates or only delegations, the committee sizes, and whether position papers are required and when. Then read our guide on <Link href="/blog/mun-conference-preparation">preparing for a conference</Link> with the students, four weeks out, not four days.</p>

        <H2>Money</H2>
        <p>Year one should cost the school nothing and the students very little. In order of ease:</p>
        <ul>
          <li><strong>Subscriptions.</strong> A small termly sub from members covers printing and refreshments and nothing else. Keep it low enough that nobody is excluded, and have a quiet waiver.</li>
          <li><strong>The school activities fund.</strong> Most schools have one. Ask after you have a term of attendance figures, not before.</li>
          <li><strong>One fundraiser per conference.</strong> A cake sale funds one trip, which is not nothing.</li>
          <li><strong>Conference financial aid.</strong> Many conferences hold a pot for exactly this and do not advertise it loudly. Ask. The worst outcome is a no.</li>
          <li><strong>Hosting your own event.</strong> A one-day in-house conference for two or three local schools can break even on a very small fee, and in later years it is the thing that funds everything else.</li>
        </ul>
        <p>Our <Link href="/blog/mun-team-fundraising">team fundraising guide</Link> goes further on paying for trips. Keep one written record of money in and money out from the first week. A club that cannot say where its subs went does not get the activities fund next year.</p>

        <H2>Structure and succession: why year three kills clubs</H2>
        <p>The pattern is reliable. A founder runs everything for two years, is very good at it, leaves, and the club dissolves in a term because nobody else knows the conference contacts, the account passwords or how to run a session.</p>
        <p>Four things prevent it, and all of them are cheap if done from the start.</p>
        <ul>
          <li><strong>Officers from year one.</strong> Not for the titles. President, secretary who holds the records, treasurer who holds the money, and a training officer who runs sessions. Four people means the club survives one of them being ill.</li>
          <li><strong>Always train a year below you.</strong> Every session should be co-run by someone younger than the person who planned it. This is the whole succession mechanism in one sentence.</li>
          <li><strong>A club account, not a personal one.</strong> Email address, drive folder, conference logins. Owned by the club and known to the advisor, so a graduating president cannot take the institutional memory with them.</li>
          <li><strong>A handover document, written in March.</strong> Session plans, conference contacts, what the fees were, what went wrong, what to do differently. Two pages beats nothing, and nobody writes it in July.</li>
        </ul>
        <FactCard title="The handover file">
          Meeting slot and room booking process. Advisor name and what they have agreed to. Member list. The eight session plans. Conferences attended, with dates, costs and a contact name. Money: subs collected, spent, remaining. Logins. The three things to change next year.
        </FactCard>

        <H2>The tools a club can run on for nothing</H2>
        <p>You need less than you think. A room, a whiteboard, printed country sheets, phones the members already own, and one laptop for the dais.</p>
        <p>For the sessions themselves, a free committee tool removes the two recurring problems: keeping time fairly and tracking who is next to speak. Gavelling sessions are free and anonymous, with no accounts for delegates, which matters when your members are at school and cannot sign up for things. If you later run your own one-day conference, the organiser side is free too, so the cost of a first event is the room and the printing.</p>
        <p>Beyond that: a shared drive folder for background guides and session plans, one group chat that the advisor is in, and a calendar with the term&rsquo;s dates on it before week one.</p>

        <H3>The first month, in order</H3>
        <ul className="gv-check">
          <li>One-page proposal written.</li>
          <li>Advisor asked, with the hours stated honestly.</li>
          <li>Room and weekly slot booked for the whole term.</li>
          <li>Fifteen people invited personally, plus a poster and one announcement.</li>
          <li>First meeting run as a debate, not a lecture.</li>
          <li>Eight session dates published and never moved.</li>
          <li>A first conference identified, with a cost per student.</li>
          <li>Officers named, including someone a year below you.</li>
        </ul>
        <p>If the club goes well, the natural next step is hosting rather than only attending, and that is a different job with its own economics: our guide to <Link href="/blog/mun-conference-planning">planning a conference</Link> is the place to start. If you are still persuading yourself or a parent that any of this is worth the weekends, <Link href="/blog/is-mun-worth-it">the honest answer</Link> is on the blog too.</p>
      </ArticleLayout>
    </>
  );
}
