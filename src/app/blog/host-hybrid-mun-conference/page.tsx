import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { authorJsonLd } from '@/components/blog/authors';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Host an Online or Hybrid MUN Conference: The Organiser Guide',
  description:
    'Time zones, session length, the software stack, running caucus remotely, the hybrid trap, chair workload, fees, and the test week you cannot skip',
  path: '/blog/host-hybrid-mun-conference',
  ogDescription: 'What changes when your MUN conference is online or split across rooms.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Host an Online or Hybrid MUN Conference: The Organiser Guide',
  description: 'What actually changes when a Model UN conference is online or hybrid, and the setup that survives eight hours.',
  url: 'https://gavelling.com/blog/host-hybrid-mun-conference',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: authorJsonLd('peter'),
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/host-hybrid-mun-conference' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Hosting an Online or Hybrid MUN Conference', item: 'https://gavelling.com/blog/host-hybrid-mun-conference' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="host-hybrid-mun-conference"
        pitch="Gavelling runs the committee itself in the browser: speakers list, timers, motions, documents and voting, shared live between the dais and every delegate, wherever they are. Free."
      >
        <p>Online conferences did not go away when in-person events came back. They stayed because they removed the two things that keep most schools out of Model UN: travel cost and travel time. A school that cannot send eight students across a country for a weekend can send them to a laptop for two mornings. If you are <Link href="/blog/start-a-mun-conference">hosting one</Link>, almost nothing about the academic content changes and almost everything about the logistics does.</p>

        <H2>Three different events, not one</H2>
        <p>Decide which of these you are running before you decide anything else, because they have different failure modes.</p>
        <FactCard title="Fully online">
          Everyone is remote, including the dais. Simplest to run, cheapest, and the only one of the three where everybody is equal. Constraints are time zones and attention span.
        </FactCard>
        <FactCard title="Hybrid: rooms plus remote delegations">
          Committees meet in person and some delegations join from elsewhere. The hardest of the three by a wide margin, because a remote delegate in a physical room is invisible unless you design against it.
        </FactCard>
        <FactCard title="Distributed: in-person hubs, online committees">
          Delegates gather at their own schools, but committees run online across hubs. Often the best compromise: social experience is local, academic experience is global, and nobody is the only remote person in a room.
        </FactCard>
        <p>The distributed model is under-used and worth serious consideration for a regional conference. Each participating school hosts its own delegates in a room with supervision and lunch, and committees meet online. You get a real conference day for students without a venue bill or a travel budget.</p>

        <H2>Time zones decide your schedule and your delegate pool</H2>
        <p>Pick your pool first and the schedule falls out of it. Trying to serve every time zone produces a schedule that serves none.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Pool</th><th>Workable window</th><th>What it costs</th></tr></thead>
            <tbody>
              <tr><td>One region, up to 3 hours apart</td><td>A normal school day, 09:00 to 15:00 in the middle zone</td><td>Nothing. Do this if you can</td></tr>
              <tr><td>Two regions, 5 to 8 hours apart</td><td>A 4-hour overlap window, typically early afternoon in Europe and morning in the Americas</td><td>Short days, so more of them</td></tr>
              <tr><td>Global</td><td>No honest common window</td><td>Either accept unsociable hours for someone, or run each committee within one region</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>If you go global, the workable answer is to allocate delegations to committees by time zone rather than by country, so each committee sits inside one window. It means abandoning the idea that every committee has a global delegate mix, which is a real loss, but it is better than a delegate joining at 03:00 and being penalised for saying nothing.</p>
        <p>Publish every time with a zone and a converter link. Every single one: sessions, deadlines, the ceremony. The most common failure of an online conference is not technical, it is a delegation arriving an hour late because a schedule said &quot;10:00&quot; and meant it somewhere else.</p>

        <H2>An eight-hour in-person day is a four-hour online day</H2>
        <p>Attention on a screen does not last the way it does in a room, and nobody gets the corridor conversations that make a long day tolerable. Plan for roughly half the hours and make them denser.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Time</th><th>Session</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>0:00 to 0:15</td><td>Committee opens, roll call, chair brief</td><td>Cameras on, names set correctly</td></tr>
              <tr><td>0:15 to 1:15</td><td>Session one: speakers list and moderated caucus</td><td>Shorter speaking times than in person</td></tr>
              <tr><td>1:15 to 1:30</td><td>Break, cameras off, genuinely away from the screen</td><td>Chairs take the break too</td></tr>
              <tr><td>1:30 to 2:15</td><td>Unmoderated caucus in breakout groups</td><td>Chairs visit every group</td></tr>
              <tr><td>2:15 to 2:25</td><td>Break</td><td></td></tr>
              <tr><td>2:25 to 3:25</td><td>Session two: papers introduced, debated, amended</td><td>The substantive hour</td></tr>
              <tr><td>3:25 to 3:45</td><td>Voting procedure and close</td><td>Finish on time. Always</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Two or three of those days beats one long one. A break every 45 to 60 minutes is not generosity, it is what keeps the last hour usable. And finish when you said you would, because a delegate at home has a family expecting them, not a hotel.</p>

        <H2>The stack: what each piece has to do</H2>
        <p>Four jobs, and the mistake is to make one tool do all four badly. Our roundup of the <Link href="/blog/best-mun-software-2026">best MUN software in 2026</Link> compares the options.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Job</th><th>What it must do</th><th>What goes wrong</th></tr></thead>
            <tbody>
              <tr><td>Video and audio</td><td>Breakout rooms, screen share, a stable 40 plus participant call, host controls</td><td>Free tiers with time limits, or no breakouts</td></tr>
              <tr><td>Committee management</td><td>Speakers list, timers, motions, roll call, voting, visible to everyone at once</td><td>A chair maintaining a list in a private document nobody can see</td></tr>
              <tr><td>Documents</td><td>Live collaborative drafting, sharing to the whole committee, version that survives</td><td>Papers passed as screenshots in chat</td></tr>
              <tr><td>Communication</td><td>Delegate to dais, delegate to delegate, moderated and logged</td><td>Private chats the dais cannot see, which is a conduct problem</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Video is the one you should pay for. Committee management is the one where a dedicated tool changes the day most, because procedure that is only spoken is procedure that half the room misses. Gavelling covers that second job in the browser: the chair runs the session from a laptop, and every delegate sees the speakers list, the current speaker, the running timer, the motions on the floor and the documents on their own screen, live, by joining with a six-character code and no account. It is free, and because it is a web page rather than an app, it works the same for a delegate on a phone in a physical room and a delegate on a laptop at home. Our <Link href="/blog/mun-technology-guide">technology guide</Link> covers the wider toolset.</p>
        <Callout>Whatever you choose, choose it for every committee. Two committees on different stacks doubles your support load, halves the usefulness of your training, and guarantees that the one chair who improvised is the one with a problem at 10:40 on Saturday.</Callout>

        <H2>Procedure online</H2>
        <p>Most of procedure transfers unchanged. Three things need a decision in advance, and they should be written in your rules so that every committee does the same.</p>
        <ul>
          <li><strong>Raising a placard.</strong> Pick one mechanism and enforce it: the platform&apos;s raise-hand, a request button in your committee tool, or a message to the dais. Video-call reactions scroll away and hands go unnoticed, so a queue a delegate can see themselves in is far better than a hand a chair may miss.</li>
          <li><strong>Voting.</strong> Roll call by name is slow but unambiguous and works everywhere. A tool that collects votes from each delegate is faster and produces a record. Avoid chat-based voting, which is unreadable and easily miscounted. Our <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> covers the thresholds themselves, which do not change online.</li>
          <li><strong>Points and motions.</strong> Ask delegates to type the motion in the committee chat as well as saying it, so the chair has the wording in front of them and nobody is misquoted.</li>
        </ul>
        <p>One rule solves half the remaining problems: everyone is muted by default and unmutes to speak when recognised, including in caucus. It sounds heavy-handed and it is the reason online committees are audible at all.</p>

        <H2>Unmoderated caucus is the hard part</H2>
        <p>In a room, twenty minutes of unmoderated caucus self-organises. Online, delegates sit in silence waiting for somebody else to speak first. Three approaches work, and you should tell chairs to use them deliberately.</p>
        <ul>
          <li><strong>Assigned breakouts.</strong> The chair sends delegates into named breakout rooms by bloc or by theme. Fastest to start, and the right choice for a first session or an inexperienced committee. The cost is that the chair has chosen the blocs.</li>
          <li><strong>Open breakouts.</strong> Delegates move between rooms themselves, which most video platforms now allow. Closest to the real thing. Needs a room list published in chat and a chair who announces which rooms exist.</li>
          <li><strong>One room, structured.</strong> Everybody stays, and the chair runs it as an informal round: each bloc leader says what they are drafting and who they need. Slower but nobody is stranded, and it works when breakouts are unavailable.</li>
        </ul>
        <p>Whichever you use, three things are mandatory. Announce what should exist at the end of the caucus. Put the shared drafting documents in chat before the caucus starts, not during. And have the chair visit every breakout room, because a room with nobody senior in it goes quiet in four minutes. The in-committee craft is covered in our <Link href="/blog/mun-online-committees">guide to chairing online</Link>.</p>

        <H2>The hybrid trap</H2>
        <p>If you run committees in physical rooms with some delegations remote, the remote delegates will be second-class unless you build against it. They will miss the side conversation, the paper passed along the table, the nod that forms a bloc. They will speak less and they will be scored lower for it.</p>
        <p>Concrete measures, in order of how much they help.</p>
        <ul className="gv-check">
          <li><strong>A remote delegate&apos;s partner in the room.</strong> Pair each remote delegation with an in-room delegate who is responsible for pulling them into the drafting group. Assign it by name, do not hope.</li>
          <li><strong>All drafting online.</strong> No paper. If a bloc is writing on a shared document, the remote delegate is genuinely in the bloc.</li>
          <li><strong>A second camera and a room microphone.</strong> A laptop at the front shows the speaker. A separate omnidirectional microphone on the table is what makes the room audible, and it is the cheapest piece of equipment with the biggest effect.</li>
          <li><strong>The speakers list on everyone&apos;s screen.</strong> A remote delegate who can see they are third on the list is in the committee. One who has to ask is not.</li>
          <li><strong>The chair calls remote delegates by name.</strong> Explicitly, often, and first on any new list.</li>
          <li><strong>Unmoderated caucus with a remote bloc.</strong> Either a physical group joins the call from a laptop in the corner, or the remote delegates have a named breakout with an in-room delegate in it.</li>
        </ul>
        <Callout>Be honest with yourself about whether you can do all six. If you cannot, run the committee fully online or fully in person. A half-hybrid committee is worse for the remote delegates than not inviting them, and they paid the same fee.</Callout>

        <H2>Chair workload, and the second chair that fixes it</H2>
        <p>Chairing online is harder than chairing in a room. The chair is running procedure, watching a participant list, managing breakouts, reading two chats, sharing a screen and watching for raised hands, without any of the peripheral awareness a room gives them.</p>
        <p>Staff every online committee with two people and split the roles explicitly. One runs the floor: recognising speakers, timing, motions, rulings. The other runs the platform: admitting late arrivals, breakouts, chat moderation, technical help, and watching for the delegate who has been trying to speak for ten minutes. Swap them between sessions so neither spends the whole day on admissions.</p>
        <p>Then train them on the actual stack, not on the idea of it. A one-hour training session a week before, where every chair runs a mock committee end to end with the tools they will use, removes almost every support call on the day.</p>

        <H2>Conduct, moderation and the rules you write down</H2>
        <p className="gv-note">The paragraphs below are practical organisational advice, not legal advice. Safeguarding duties for events involving under-18s differ by country and institution. Follow your own school or university policy, your national rules, and the guidance of your designated safeguarding lead, who should sign off your online conduct policy before you publish it.</p>
        <p>Write a short conduct policy and publish it with registration. The decisions it must contain are specific to online events: whether sessions are recorded and who can see the recording, whether private messages between delegates are permitted and whether the dais can read them, how a delegate reports a problem and to whom (our <Link href="/blog/mun-safeguarding">MUN safeguarding guide</Link> covers this), what happens to someone removed from a call, and whether cameras are required.</p>
        <p>The practical defaults most conferences settle on: do not record committee sessions, because a recording of minors is a liability you do not need and it changes how delegates speak. Keep delegate to delegate messaging inside a tool the dais can see rather than on personal social media. Give every delegate a named adult to contact who is not their chair. And require an adult from each school to be reachable during sessions.</p>

        <H2>Fees, and what an online conference can honestly charge</H2>
        <p>Your costs are genuinely lower: no venue, no catering, no printing, no security. Delegates know that, and an online conference priced like an in-person one will be compared unfavourably in every faculty advisor staff room in your region.</p>
        <p>What you are actually paying for is a video licence, your committee software if it is paid, background guide production, certificates, and your own time. Price against that plus a modest surplus, and publish what the fee covers. Two things justify a higher fee honestly: genuinely good background guides and chairs, and a reliable, well-run day. Neither is free to produce.</p>
        <p>Consider a per-delegation rate rather than a per-delegate one for online events. It is simpler to administer, it encourages schools to bring more students, and since your marginal cost per delegate is close to zero, the only reason to charge per head is that the in-person model did. If you want to see how other conferences are pricing and structuring their events, the <Link href="/conferences/explore">conference directory</Link> is a quick way to compare.</p>

        <H2>Test the whole thing a week before, with real people</H2>
        <p>Not a technical check. A rehearsal, with the actual chairs, on the actual stack, for at least an hour. It plays the same role as the run-through in <Link href="/blog/mun-conference-day-operations">conference day operations</Link> for an in-person event.</p>
        <ul className="gv-check">
          <li>Every chair joins from the device they will use on the day</li>
          <li>Run a full cycle: roll call, speakers list, a moderated caucus, a motion, a breakout caucus, a vote</li>
          <li>Deliberately break something: have someone leave and rejoin, share a broken link, mute the wrong person</li>
          <li>Test the join route a delegate will take, from the email you actually sent, on a phone</li>
          <li>Check the screen share is readable at phone size, since some delegates will be on one</li>
          <li>Time a session. If the rehearsal overran, the real one will overrun by more</li>
          <li>Write down who to call for each kind of problem and put it in every chair&apos;s hand</li>
        </ul>
        <p>Then publish a one-page delegate briefing: how to join, what to install, how to raise a placard, what to do if you lose connection, and who to message. Send it twice, a week out and the morning of. The single biggest difference between an online conference that feels professional and one that feels improvised is whether the first fifteen minutes of session one were spent debating or explaining. You can set the committee side of that up in advance and let chairs practise with it free at <Link href="/create/sessions">gavelling.com/create</Link>, which is also a reasonable way to run the rehearsal itself. For the wider planning arc, our <Link href="/blog/mun-conference-planning">conference planning guide</Link> covers the parts that are the same whether you meet in a hall or a browser.</p>
      </ArticleLayout>
    </>
  );
}
