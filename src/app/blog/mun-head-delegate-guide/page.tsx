import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Head Delegate Guide: Leading a School Delegation',
  description:
    'The job nobody writes down: selecting a delegation, distributing assignments, running preparation, holding the team together at a conference, and handing it over.',
  path: '/blog/mun-head-delegate-guide',
  ogDescription: 'Selecting, preparing and holding together a Model UN delegation.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Head Delegate Guide: Leading a School Delegation',
  description: 'How to select, prepare and lead a Model UN delegation as head delegate.',
  url: 'https://gavelling.com/blog/mun-head-delegate-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-head-delegate-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Head Delegate Guide', item: 'https://gavelling.com/blog/mun-head-delegate-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-head-delegate-guide"
        pitch="Run mock committees in Gavelling: real speakers list, real timers, real motions, free, so the first proper session is not the first one anybody has seen."
      >
        <p>Head delegate is the only senior role in school Model UN with no handbook. Chairs get training, faculty advisors get a job description, and the head delegate gets a title and a group chat of twenty people who need answers. The job is a real one: you decide who goes, who gets which country, what preparation looks like, and whether the delegation behaves like a team or like twenty individuals in the same blazers.</p>

        <H2>What the role actually is</H2>
        <p>Strip away the variations and the head delegate does four things: selects and assigns, runs preparation, holds the team together at the conference, and hands the whole system to a successor. Everything else is negotiable with your faculty advisor, and it should be negotiated explicitly rather than discovered in week six.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Decision</th><th>Usually the faculty advisor</th><th>Usually the head delegate</th></tr></thead>
            <tbody>
              <tr><td><Link href="/blog/choosing-mun-conferences">Which conferences to attend</Link></td><td>Final say, budget and safeguarding</td><td>Recommends, researches, makes the case</td></tr>
              <tr><td>Who is selected</td><td>Signs off, and handles any appeal</td><td>Runs the process and proposes the list</td></tr>
              <tr><td>Country and committee assignments</td><td>Informed</td><td>Decides</td></tr>
              <tr><td>Preparation schedule and content</td><td>Supports, provides the room</td><td>Owns entirely</td></tr>
              <tr><td>Money, consent forms, travel, conduct</td><td>Owns entirely</td><td>Reminds people, never handles</td></tr>
              <tr><td>Discipline and welfare</td><td>Owns entirely</td><td>Reports immediately</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Agree that table in your first meeting of the year and write it down. The two rows that matter most are the last two: anything involving money, safeguarding or a student&apos;s wellbeing goes to the adult, immediately, every time, without you trying to solve it first. Our <Link href="/blog/mun-faculty-advisor-guide">faculty advisor guide</Link> is worth reading even though it is not written for you, because it tells you what your advisor is carrying.</p>

        <H2>Selecting the delegation</H2>
        <p>Selection is where head delegates lose friends, and almost always because the criteria arrived after the decision. Publish them first.</p>
        <FactCard title="A selection grid that survives scrutiny">
          Four criteria, each scored 1 to 5 by two assessors independently: preparation and research quality, speaking in a practice committee, collaboration with others in caucus, and reliability over the term. Publish the criteria and the weighting two weeks before trials. Keep the scores.
        </FactCard>
        <p>Three rules make the process defensible. Assess more than one thing: a delegation built only on speaking confidence is a delegation of people who cannot draft. Use two assessors, because one person&apos;s impression of a nervous first-timer is noise. And assess in a committee rather than an interview, since the job is to perform in a committee.</p>
        <p>Then decide in advance how you are balancing two things that genuinely conflict: sending the strongest possible team, and developing people who will be the strongest team next year. Most delegations solve this by reserving a fixed number of places for delegates below a certain year group or with fewer than a set number of conferences, and saying so upfront. That converts an argument about fairness into a published rule.</p>
        <H3>Telling people no</H3>
        <p>Do it individually, in person, before the list is published, and with one specific thing to work on. Never by seeing their name missing from a group message. Say what the gap was, say what would close it, and name the next opportunity to try. A delegate told &quot;your research was the strongest in the room but you did not speak in the second session, so work on getting on the speakers list early&quot; usually comes back. A delegate told nothing usually leaves the club.</p>
        <Callout>Whatever you do, do not select your friends and then construct criteria that happen to fit them. Everybody sees it, it is the most common reason MUN clubs fracture, and it follows you into the next year&apos;s handover.</Callout>

        <H2>Distributing countries and committees</H2>
        <p>You will receive an <Link href="/blog/mun-country-allocation">allocation</Link> from the conference: a country or a set of countries, and a number of seats in named committees. Distributing them inside the team is your highest-leverage decision of the year.</p>
        <ul>
          <li><strong>Put experience where the room is hardest.</strong> Security Council, crisis and specialised agencies punish inexperience. General Assembly committees with large rooms are the right place for a first conference.</li>
          <li><strong>Match interest where you can.</strong> A delegate who wanted the health committee prepares more.</li>
          <li><strong>Pair deliberately.</strong> In double delegations, pair an experienced delegate with a newer one rather than two of either.</li>
          <li><strong>Spread the delegation across committees</strong> unless the conference requires otherwise, so the team has eyes everywhere and nobody sits in a room alone all weekend by accident.</li>
          <li><strong>Watch the hard countries.</strong> A delegate given a country with an unpopular position needs more support, not less, and should know that going in.</li>
        </ul>
        <p>Publish assignments with a one-line reason each. It takes twenty minutes and removes the entire &quot;why did they get UNSC&quot; conversation.</p>

        <H2>Running preparation</H2>
        <p>Preparation fails in the same way every year: everybody intends to start six weeks out and actually starts four days out. The fix is deadlines with a person attached, not a schedule on a wall.</p>
        <TableWrap>
          <table>
            <thead><tr><th>When</th><th>What is due</th><th>Who checks</th></tr></thead>
            <tbody>
              <tr><td>6 weeks out</td><td>Background guide read, one page of notes per topic</td><td>Committee partner, then you</td></tr>
              <tr><td>5 weeks out</td><td>Country profile: policy, bloc, red lines, voting record</td><td>You</td></tr>
              <tr><td>4 weeks out</td><td>Position paper first draft</td><td>Faculty advisor or a senior delegate</td></tr>
              <tr><td>3 weeks out</td><td>Position paper final, submitted to the conference</td><td>You, against the conference format</td></tr>
              <tr><td>2 weeks out</td><td>Opening speech written and timed</td><td>Mock session</td></tr>
              <tr><td>2 weeks out</td><td>Full mock committee, real procedure</td><td>You chair, or a chair from the club</td></tr>
              <tr><td>1 week out</td><td>Draft clauses ready, <Link href="/blog/mun-negotiation-tactics">allies identified</Link></td><td>You</td></tr>
              <tr><td>3 days out</td><td>Logistics: travel, dress, documents, packing</td><td>Faculty advisor</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The mock committee is the part most delegations skip and the part that changes results most. Run it with real procedure, a real speakers list and real timers, chair it strictly, and stop it twice to explain what just happened. Delegates do not learn procedure from a document; they learn it by losing a vote to a motion they did not understand. You can run one from a laptop with a <Link href="/create/sessions">free practice session</Link>, with the speakers list, motions and timers live on every phone in the room, which takes the administration out of it and lets you concentrate on chairing.</p>
        <p>Do not personally review twenty position papers. Pair delegates to review each other against a checklist, then read the ones flagged as weak. Our <Link href="/blog/mun-position-paper-guide">position paper guide</Link> works well as that checklist, and it keeps the standard consistent when three different people are marking.</p>

        <H2>The head delegate at the conference</H2>
        <p>You have two jobs at once: your own committee and everybody else&apos;s. Accept upfront that the second one costs you something in the first, and decide in advance how much.</p>
        <ul>
          <li><strong>Be the first point of contact for problems that are not welfare or money.</strong> A lost badge, a confusing rule, a delegate who cannot find their room.</li>
          <li><strong>Know where everyone is.</strong> A single sheet: name, committee, room number, country, phone number.</li>
          <li><strong>Be visible between sessions.</strong> Most of the value you add is in three-minute conversations in corridors.</li>
          <li><strong>Do not walk into other committees to check on people.</strong> It undermines them with their chair and their room.</li>
          <li><strong>Never negotiate with a chair on a delegate&apos;s behalf.</strong> If something is genuinely wrong, it goes to the faculty advisor, who goes to the secretariat.</li>
        </ul>
        <H3>The daily rhythm</H3>
        <p>Three fixed points, short, every day, are more effective than one long meeting.</p>
        <ul className="gv-check">
          <li><strong>Morning brief, ten minutes.</strong> What today looks like, what each person is trying to achieve today, one reminder. Not a speech.</li>
          <li><strong>Lunch check-in, informal.</strong> Sit with different people each day. Ask what is stuck rather than how it is going.</li>
          <li><strong>Evening debrief, twenty minutes.</strong> Each delegate says one thing that worked, one thing that did not, and what they will do tomorrow. You say almost nothing.</li>
        </ul>
        <p>The evening debrief is the highest-value twenty minutes of the weekend. It surfaces the delegate who has not spoken all day, it spreads tactics between committees, and it turns twenty separate conferences into one delegation.</p>

        <H2>Supporting a delegate who is struggling</H2>
        <p>There is always one, usually by the second session, and the temptation is to do it for them. Do not write their clauses, do not brief their bloc, and do not tell them what to say.</p>
        <p>Instead, diagnose. Struggling almost always means one of four things, and the response is different for each.</p>
        <ul>
          <li><strong>They cannot get on the speakers list.</strong> Mechanical, and the easiest to fix. Tell them to put their placard up the moment the list opens, and to send the dais a note rather than waiting to be noticed.</li>
          <li><strong>They are speaking but nobody is listening.</strong> Usually no specific proposal. Give them one sentence to end every speech with: &quot;my delegation proposes X, and we are drafting it now. Come and find us&quot;.</li>
          <li><strong>They are not in a bloc.</strong> The hardest to fix from outside. Tell them to find the person writing the most and offer to write a section, which is how <Link href="/blog/mun-bloc-building">blocs actually form</Link>.</li>
          <li><strong>They are overwhelmed.</strong> Not a tactics problem. Shrink the goal to one thing for the next session and tell them the rest of the weekend is off the table.</li>
        </ul>
        <Callout>A delegate who has a bad conference and is handled well stays in MUN. A delegate who has a bad conference and is ignored, or rescued, usually does not. Handling it well means asking what happened, agreeing one change, and following up on Monday.</Callout>

        <H2>The delegation&apos;s reputation</H2>
        <p>Chairs talk to each other, and secretariats remember schools. A delegation is remembered for two things: whether it is easy to deal with, and whether its delegates are decent to the smaller delegations in the room.</p>
        <p>Set three standards and enforce them yourself. Arrive on time to every session, including the one after lunch. Be courteous to chairs even when a ruling goes against you, and take disagreements to the advisor rather than the dais. And treat first-time delegates from other schools as people to bring into your bloc rather than as an obstacle, which is both decent and, since chairs are watching, effective.</p>

        <H2>Delegation awards, which are won by consistency</H2>
        <p>Most conferences tally delegation awards from <Link href="/blog/mun-award-categories">individual honours</Link>, so the arithmetic rewards spread rather than peaks. One Best Delegate and eleven delegates with nothing loses to zero Best Delegates and six Honourable Mentions at almost every conference that publishes a formula.</p>
        <p>What follows from that is unglamorous and true: the way to win a delegation award is to raise the bottom of your team, not the top. Your weakest four delegates are worth more of your preparation time than your strongest two, who will be fine. Check the conference&apos;s published formula, and if it divides by delegation size, send a smaller and better-prepared team.</p>

        <H2>Conflict inside the team</H2>
        <p>This is the part that ends friendships, and it is nearly always one of three situations.</p>
        <ul>
          <li><strong>Two delegates in one committee competing rather than cooperating.</strong> Usually a double delegation or two seats in the same room. Assign roles explicitly before the conference: one leads on drafting, one leads on the floor, and they share credit.</li>
          <li><strong>A delegate who thinks they should have had a better assignment.</strong> Answer once, with the published reason, and then do not reopen it.</li>
          <li><strong>Someone not doing the preparation everyone else did.</strong> The only one with a real deadline: address it privately at the four-week mark, and if nothing changes, tell your advisor before travel is booked rather than after.</li>
        </ul>
        <p>What makes all three worse is handling them in the group chat. Have the conversation in person, alone, and confirm what you agreed in a message afterwards so there is a record.</p>

        <H2>Handover, and the document that makes it survivable</H2>
        <p>Most school delegations rebuild themselves from nothing every year because everything lived in one person&apos;s head. Spend one afternoon in your final term writing it down.</p>
        <ul className="gv-check">
          <li>The conference list: which ones you attend, when applications open, what they cost, who to email</li>
          <li>Selection criteria and the trial format, with the scoring grid</li>
          <li>The preparation timeline, as a calendar with deadlines</li>
          <li>Templates: position paper, country profile, opening speech, <Link href="/blog/mun-club-curriculum">mock committee plan</Link></li>
          <li>The last three years of assignments and results, so patterns are visible</li>
          <li>What went wrong, honestly, and what you would do differently</li>
          <li>Logins, shared drives and the group chat, transferred properly</li>
        </ul>
        <p>Then name your successor early and give them real work before they take over: let them run one preparation session, one selection trial and one conference brief while you are still there to catch the mistakes. Deciding the succession in the last week produces a head delegate who learns everything you learned, in the same order, at the same cost.</p>

        <H2>Your own performance, honestly</H2>
        <p>It will suffer, and you should decide by how much before the conference rather than resenting it afterwards. Two approaches work. Either accept a quieter conference, take a General Assembly committee rather than a crisis seat, and treat the delegation as your event. Or protect your own committee, delegate the daily rhythm to a deputy, and be explicit with the team that the deputy is the first point of contact.</p>
        <p>What does not work is pretending you can do both at full intensity. That is the head delegate who misses their own committee&apos;s drafting window at eleven on Saturday morning because somebody could not find the lunch hall, and who is then irritable with a team that has no idea why. Pick one, say which, and let people plan around it. If you are still choosing which conferences your delegation should aim at this year, the <Link href="/conferences/explore">conference directory</Link> is a reasonable place to start comparing dates, sizes and fees before you take a shortlist to your advisor.</p>
      </ArticleLayout>
    </>
  );
}
