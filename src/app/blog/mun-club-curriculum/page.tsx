import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'The MUN Club Curriculum: Ten Sessions to a First Conference',
  description:
    'Ten ready-to-run hour-long sessions that take a group with no experience to a real Model UN conference.',
  path: '/blog/mun-club-curriculum',
  ogDescription: 'Ten hour-long sessions from no experience to a first MUN conference.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The MUN Club Curriculum: Ten Sessions to a First Conference',
  description: 'A ten-session training plan for a school Model UN club.',
  url: 'https://gavelling.com/blog/mun-club-curriculum',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-club-curriculum' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'The MUN Club Curriculum', item: 'https://gavelling.com/blog/mun-club-curriculum' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-club-curriculum"
        pitch="Session six onwards runs on real software: create a free session, students join on their phones, nothing to install."
      >
        <p>You have a room, an hour a week and a group of students who have never done this. Ten sessions later they should be able to walk into a committee, speak, raise a motion, work a bloc and not be frightened. This is that plan: ten one-hour sessions, each with a clear objective, an activity that takes most of the time, and a way to tell whether it worked. Adapt the timings to your own hour, but keep the order, because each session assumes the one before it.</p>

        <H2>How to use this</H2>
        <p>Three practical notes before session one.</p>
        <p><strong>Group size.</strong> Ten to thirty works. Under eight and the mock committee in session nine does not feel like a committee, so invite another class or run it with a feeder school. Over thirty and you need a second adult and a second room for the speaking sessions.</p>
        <p><strong>Mixed experience.</strong> After the first year you will always have returning delegates in the room. Give them a job rather than making them sit through session two again: they chair the practice debates, they judge the speeches, they run the research race. This is how you grow chairs, and it is more useful to them than repeating content.</p>
        <p><strong>Talk less.</strong> The most common failure of a MUN club is a term of explanation followed by a conference. Procedure is learned by doing it badly and being corrected, not by being told. In every session below, the teaching block is fifteen minutes at most and the rest is activity.</p>
        <Callout>Schedule session nine, the full mock committee, in the calendar before you run session one. It needs two hours and a room, and if you leave it until it is due you will discover that the hall is booked and the term is over.</Callout>

        <H2>Session 1: What this is, and a silly debate</H2>
        <p><strong>Objective:</strong> they leave wanting to come back.</p>
        <p>Ten minutes on what Model UN is: you represent a country, not yourself, you debate a real problem, and you write something the committee votes on. Do not explain procedure. Do not hand out a glossary.</p>
        <p>Then forty minutes of a mock debate on something deliberately trivial, with three or four rules only: you speak when called, you speak for thirty seconds, you speak as your assigned position and not as yourself. Assign silly positions rather than countries for this one: the school canteen debate, the case for and against school uniform, whether the summer holiday should be moved. The point is to make thirty seconds of public speaking normal before anyone has anything at stake.</p>
        <p>Finish with five minutes on what a real committee is and when the conference is. <Link href="/blog/mun-glossary">The glossary</Link> can be shared afterwards for anyone curious, not handed out now.</p>
        <p className="gv-note">Worked if: everyone spoke once and at least a third laughed.</p>

        <H2>Session 2: Your country is not you</H2>
        <p><strong>Objective:</strong> they understand representation, which is the concept everything else rests on.</p>
        <p>Fifteen minutes on the idea: you argue your country&apos;s position whether or not you agree with it, you never say &quot;I think&quot;, and your job is to find what your country can accept rather than what is right.</p>
        <p>Then the activity that makes it land. Give each student a country and one statement, for example &quot;all states should accept a binding quota of refugees&quot;. Ten minutes to find out what their country would say and why. Then go round the room: each student gives fifteen seconds as their country. The moment a student says something they personally disagree with and the room realises that is the job, the concept has landed.</p>
        <p>Assign the countries for the whole term now, and keep them. Students who keep a country for ten weeks develop something that looks like expertise.</p>
        <p className="gv-note">Worked if: someone argues a position they told you afterwards they hate.</p>

        <H2>Session 3: The research race</H2>
        <p><strong>Objective:</strong> they can find a country&apos;s position in twenty minutes.</p>
        <p>Ten minutes on where to look, following <Link href="/blog/mun-country-research">our country research method</Link>: the country&apos;s own foreign ministry and UN mission pages, its statements in the UN Digital Library, the voting record on relevant resolutions, its regional bloc, and reputable news. Emphasise that the mission&apos;s statements page is the single most useful source and almost nobody uses it.</p>
        <p>Then run it as a race. Give the whole room the same topic and twenty minutes. Each student must return with four things written down: their country&apos;s stated position in one sentence, one quotation from an official source with a link, how they voted on a relevant resolution, and one country that agrees with them. Five minutes to share, fastest and best first.</p>
        <p>Set the expectation now that a source means a link, because the habit is easier to build than to repair.</p>
        <p className="gv-note">Worked if: most students have a real quotation from an official source, not a news summary.</p>

        <H2>Session 4: Writing the position paper in the room</H2>
        <p><strong>Objective:</strong> a finished draft on paper by the end of the hour.</p>
        <p>Ten minutes on the structure, which is short: the problem as your country sees it, what your country has already done, and what your country proposes. Show one good example and one bad one, and let them tell you the difference.</p>
        <p>Then forty minutes of silent writing with you circulating. This is the session that most clubs replace with homework, and homework produces four papers out of twenty. Written in the room, you get twenty. Give a strict word limit, around 400 words, because a limit is what forces the position to become clear.</p>
        <p>Last ten minutes: swap papers, each student marks one against three questions. Does it say what the country wants? Is there evidence? Is there a proposal a committee could vote on?</p>
        <p>Send them to <Link href="/blog/mun-position-paper-guide">the position paper guide</Link> for the version they will need at the conference itself, and to <Link href="/blog/mun-position-paper-examples">the annotated position paper examples</Link> for finished papers to compare against.</p>
        <p className="gv-note">Worked if: every student leaves holding a draft with their own name on it.</p>

        <H2>Session 5: Sixty seconds, on your feet</H2>
        <p><strong>Objective:</strong> everyone speaks for a minute, standing, twice.</p>
        <p>Ten minutes on structure: open with who you are and why the topic matters, make one point with evidence, propose one thing, and end on a line rather than trailing off. Model it yourself, badly first and then well, which teaches more than one good example.</p>
        <p>Then speeches. Everyone stands, sixty seconds, timed visibly. After each one, two pieces of feedback from the room, one specific thing that worked and one thing to change, and then straight to the next speaker. No discussion. Get through the whole room, then go round again with the correction applied. The second round is where the improvement happens, so protect the time for it.</p>
        <p>For nervous students, a sixty-second speech read from a card is a success. Reading is not a failure mode at session five.</p>
        <p><Link href="/blog/mun-opening-speech">The opening speech guide</Link> and <Link href="/blog/mun-public-speaking-tips">the public speaking guide</Link> are the follow-up reading, and <Link href="/blog/mun-speech-examples">the speech examples</Link> give them models to copy.</p>
        <p className="gv-note">Worked if: everyone stood up. Nobody exempt, including you.</p>

        <H2>Session 6: Procedure, part one, taught by doing</H2>
        <p><strong>Objective:</strong> they can be recognised, get on the speakers list, and raise a motion.</p>
        <p>This is where the club stops being a discussion group. Ten minutes on four things only: the speakers list, how to get on it, what a motion is, and how you vote on one. Nothing else. Not points of information, not yields, not amendments.</p>
        <p>Then run a real forty-minute committee on a topic they already researched, with you chairing, running an actual speakers list and actually taking motions. Correct procedure in the moment, out loud, and move on.</p>
        <p>Run it on real software rather than a list on the whiteboard, because the software is what they will meet at the conference and it removes the administrative burden from you. A free anonymous session takes under a minute to create at <Link href="/create/sessions">/create</Link>: you get a six-character code, the students join on their own phones, and the speakers list, the timer and the motions are all live in front of them. There is nothing to install, no accounts, and it costs nothing. From here to session ten, run every practice this way.</p>
        <p><Link href="/blog/general-speakers-list-guide">The GSL guide</Link> is the reference for the mechanics you are teaching.</p>
        <p className="gv-note">Worked if: a student raises a correctly worded motion without prompting.</p>

        <H2>Session 7: Procedure, part two, caucusing and voting</H2>
        <p><strong>Objective:</strong> they can move between formal debate and caucus without losing the thread.</p>
        <p>Ten minutes on moderated caucus, unmoderated caucus, the difference, and how voting on a motion works, including what a simple majority actually means in a room of the size they are in. Show them <Link href="/blog/mun-motions-explained">the motions reference</Link> afterwards rather than reading it out.</p>
        <p>Then forty minutes of committee with a deliberate structure: fifteen minutes of speakers list, a moderated caucus on a sub-topic, an unmoderated caucus, and then back. Your job as chair is to make them propose the caucuses rather than proposing them yourself, even when it is slow. A room that sits in silence for two minutes and then produces a motion has learned something that a room you rescued has not.</p>
        <p>Use the unmoderated caucus to introduce the real point of it, which is that this is where the work happens. <Link href="/blog/unmoderated-caucus-guide">Our unmoderated caucus guide</Link> covers what good use of that time looks like.</p>
        <p className="gv-note">Worked if: the motions came from the floor and the room used the unmod rather than checking their phones.</p>

        <H2>Session 8: Clauses and a resolution</H2>
        <p><strong>Objective:</strong> the club writes one resolution together.</p>
        <p>Fifteen minutes on the anatomy: preambulatory clauses state the situation and are not voted on individually, operative clauses are what the committee actually does, they are numbered, and their opening word determines how strong they are. Show a real UN resolution rather than a template, because seeing the actual document is what makes the format stop feeling arbitrary.</p>
        <p>Then split into three groups, each writing four operative clauses on the term&apos;s topic, on paper, in twenty minutes. Bring them together, read each clause aloud, and have the room challenge them: who pays, who enforces, would your country vote for this? Most clauses will not survive, which is the lesson.</p>
        <p>Merge the survivors into one document projected on the screen and read it back as a whole. <Link href="/blog/mun-resolution-writing">The resolution writing guide</Link> is the reference, and <Link href="/blog/mun-working-paper-guide">the working paper guide</Link> covers how this becomes a real document at a conference.</p>
        <p className="gv-note">Worked if: the room rejects at least one of its own clauses for a good reason.</p>

        <H2>Session 9: The full mock committee</H2>
        <p><strong>Objective:</strong> two hours that feel like the real thing.</p>
        <p>This is the hardest session to run and the one that determines how your delegates cope at the conference, so it deserves the most preparation.</p>
        <FactCard title="Running the mock committee well">
          <p><strong>Two hours, not one.</strong> A single hour cannot contain roll call, debate, caucusing and a vote, and a mock committee that never reaches a vote teaches the wrong lesson.</p>
          <p><strong>A returning student chairs, not you.</strong> You sit at the back and take notes. If you chair, they perform for you.</p>
          <p><strong>Real roll call, real placards, real timer.</strong> The ceremony is part of what they are learning.</p>
          <p><strong>One topic they have researched.</strong> Do not introduce new content today.</p>
          <p><strong>Do not rescue the room.</strong> Silence, a stalled bloc and a failed motion are the most valuable twenty minutes of the term. Note them, do not fix them.</p>
          <p><strong>Finish with a vote</strong>, whatever state the document is in.</p>
        </FactCard>
        <p>Then twenty minutes of debrief, which is where the session actually pays off. Three questions: what worked, what was confusing, and what would you do differently. Write the answers down and use them to structure session ten.</p>
        <p>If your club is large enough to run two committees at once, do it. Two rooms of fifteen is far better practice than one room of thirty, and the second chair is another student developing.</p>
        <p className="gv-note">Worked if: they reached a vote, and the debrief produced specific complaints rather than &quot;it was fine&quot;.</p>

        <H2>Session 10: The conference itself</H2>
        <p><strong>Objective:</strong> they arrive knowing what the weekend looks like.</p>
        <p>This is the practical session and it is mostly reassurance. Cover the schedule, what to wear, what to bring, how long sessions run, what happens at lunch, who the chair is, what awards are and how much they matter (less than they think). Then the honest part: the first hour is intimidating, almost everyone feels out of their depth, and the delegates who look confident are mostly not.</p>
        <p>Go through the practical list: placard, printed position paper, notebook, pen, water, charger, a jacket because committee rooms are cold. Then set two personal goals per student, written down, that are within their control. &quot;Speak three times&quot; is a goal. &quot;Win Best Delegate&quot; is not.</p>
        <p>Give them <Link href="/blog/mun-conference-preparation">the conference preparation checklist</Link> and <Link href="/blog/mun-delegate-tips">the delegate tips guide</Link> for the week before.</p>
        <p className="gv-note">Worked if: the questions in this session are logistical rather than existential.</p>

        <H2>The ten in one table</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Session</th><th>Objective</th><th>Main activity</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>They come back</td><td>Silly debate, thirty seconds each</td></tr>
              <tr><td>2</td><td>Representation</td><td>Country statements on one proposition</td></tr>
              <tr><td>3</td><td>Research</td><td>Twenty-minute research race</td></tr>
              <tr><td>4</td><td>Position paper</td><td>Written in the room, peer-marked</td></tr>
              <tr><td>5</td><td>Speaking</td><td>Sixty-second speeches, twice round</td></tr>
              <tr><td>6</td><td>Speakers list and motions</td><td>Live committee on software</td></tr>
              <tr><td>7</td><td>Caucuses and voting</td><td>Structured committee with real motions</td></tr>
              <tr><td>8</td><td>Clauses</td><td>Group drafting, then challenge</td></tr>
              <tr><td>9</td><td>The whole thing</td><td>Two-hour mock committee, student-chaired</td></tr>
              <tr><td>10</td><td>Conference readiness</td><td>Logistics, expectations, personal goals</td></tr>
            </tbody>
          </table>
        </TableWrap>

        <H2>What a club does between conferences</H2>
        <p>The ten sessions get you to the first conference. The weeks afterwards are where clubs lose people, because there is no longer a deadline.</p>
        <ul>
          <li><strong>Debrief the conference in the first session back</strong>, while it is fresh, with each delegate saying one thing they will do differently.</li>
          <li><strong>Run a committee every three or four weeks</strong>, on a current news topic, with rotating student chairs. A free session takes a minute to set up, so the barrier is the room, not the tools.</li>
          <li><strong>Train chairs deliberately.</strong> Your second and third years should be chairing your own mocks, and <Link href="/blog/how-to-chair-first-mun">the first-time chair guide</Link> is the right thing to hand them.</li>
          <li><strong>Run a news round.</strong> Ten minutes at the start of each session, two students presenting one international story each. It builds the general knowledge that separates good delegates from prepared ones.</li>
          <li><strong>Give roles.</strong> A treasurer, a <Link href="/blog/mun-head-delegate-guide">head delegate</Link>, someone running social media, someone organising the internal mock. Clubs that survive their founder are clubs with roles.</li>
        </ul>

        <H2>Assessing progress without making it feel like school</H2>
        <p>Do not mark anything. Instead track three things across the term and share them with the student individually, never publicly: how many times they spoke in practice committees, whether they have raised a motion unprompted, and whether they have written a position paper start to finish.</p>
        <p>Those three are a complete picture at this stage, and they are all within a student&apos;s control, which is why they motivate. A student who has spoken eleven times and raised two motions is ready for a conference whether or not their speeches were any good, and one who has spoken twice is not, however well they write.</p>
        <p>If you are <Link href="/blog/start-mun-club">building the club itself</Link> rather than training an existing one, <Link href="/blog/mun-faculty-advisor-guide">the faculty advisor guide</Link> covers the programme around these sessions, and <Link href="/blog/choosing-mun-conferences">the conference selection guide</Link> covers picking the event this curriculum is pointing at.</p>
      </ArticleLayout>
    </>
  );
}
