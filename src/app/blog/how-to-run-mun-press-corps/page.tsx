import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

const SLUG = 'how-to-run-mun-press-corps';
const TITLE = 'How to Run a Press Corps at a MUN Conference';
const DESCRIPTION =
  'For organisers and press chairs: roles, the editorial workflow, approval, publishing to committees, timing, crisis leaks and the ethics a press corps needs';
const OG = 'A working guide for MUN organisers and press chairs: how to set up and run a press corps that publishes.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: `/blog/${SLUG}`,
  ogDescription: OG,
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: OG,
  url: `https://gavelling.com/blog/${SLUG}`,
  datePublished: '2026-10-23',
  dateModified: '2026-10-23',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': `https://gavelling.com/blog/${SLUG}` },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Run a MUN Press Corps', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function HowToRunMunPressCorps() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug={SLUG}
        pitch="A press committee on Gavelling gets its own Press Desk: every room live, releases sent to the rooms you pick, approval on by default."
      >
        <p>
          A press corps is the committee that fails most quietly. Nobody complains on Saturday; by Sunday afternoon the reporters are writing in the corridor because nobody is reading what they file, and the closing ceremony mentions them once. It does not have to go that way. A press corps with clear roles, a real editorial workflow and a route into the committee rooms becomes one of the most visible parts of a conference. This guide is for the secretariat deciding how to set one up and for the press chairs who will run it.
        </p>
        <p>
          For the delegate&apos;s view of the same committee, send your reporters <Link href="/blog/mun-press-corps-guide">how a MUN press corps works</Link> and <Link href="/blog/mun-journalist-guide">the MUN journalist&apos;s guide</Link> before the conference.
        </p>

        <H2>Decide the Model First</H2>
        <p>
          Every other decision follows from this one, so make it before you write the press background guide.
        </p>
        <FactCard title="Independent press">
          Reporters write for one neutral conference outlet. Easier to run, easier to judge, and the best choice for a first year or a younger conference.
        </FactCard>
        <FactCard title="Assigned outlets">
          Each seat is a real outlet with its own editorial line: a wire service, a state broadcaster, a national newspaper. More interesting for experienced delegates and more work to judge, because you are marking accuracy and character at the same time.
        </FactCard>
        <p>
          Many conferences mix the two: a handful of assigned outlets plus a neutral conference newspaper that the press chair edits. Whatever you choose, say it in the background guide and in the allocation email. A reporter who finds out on the morning of day one that they were meant to be writing as a state broadcaster has lost a day.
        </p>

        <H2>Roles in a Press Corps</H2>
        <TableWrap>
          <table>
            <thead><tr><th>Role</th><th>What they do</th><th>How many</th></tr></thead>
            <tbody>
              <tr><td>Press chair or editor-in-chief</td><td>Assigns stories, edits, approves releases, judges</td><td>One, plus a deputy for more than ten reporters</td></tr>
              <tr><td>Section or desk editor</td><td>Edits one group of committees, first reader of copy</td><td>One per four to six reporters at large conferences</td></tr>
              <tr><td>Reporter</td><td>Covers assigned committees, interviews, files releases and articles</td><td>One per two committees is comfortable</td></tr>
              <tr><td>Photographer</td><td>Photos for releases and the archive, within the photo policy</td><td>Optional; often a reporter&apos;s second job</td></tr>
              <tr><td>Secretariat liaison</td><td>Clears sensitive stories, especially in crisis</td><td>Usually the Deputy Secretary-General</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          The press chair is an editor, not a moderator, and should be chosen for judgement and speed with copy rather than for chairing experience. If you are staffing the conference now, the <Link href="/blog/mun-secretariat-roles">secretariat roles guide</Link> shows where press sits in the structure.
        </p>

        <H2>The Editorial Workflow</H2>
        <p>
          The workflow is the whole management system. Keep it simple enough that it survives a stressful afternoon.
        </p>
        <ol>
          <li><strong>Editorial meeting, ten minutes, before every session block.</strong> Each reporter leaves with named committees, the form they are writing (release, article, interview) and a deadline.</li>
          <li><strong>Coverage.</strong> Reporters sit in their rooms, interview at breaks and draft as they go.</li>
          <li><strong>Filing.</strong> Short releases go to the press chair for approval as they are written. Longer articles are filed by a fixed time.</li>
          <li><strong>Edit.</strong> One pass for accuracy, one for structure. Hand it back with two specific changes, not a silent rewrite.</li>
          <li><strong>Publish.</strong> Releases go to the committee rooms; articles go to the newspaper, website or archive.</li>
          <li><strong>Debrief.</strong> Five minutes at the end of the day: what landed, what was wrong, tomorrow&apos;s angles.</li>
        </ol>
        <Callout>
          Assign, do not let reporters roam. A press corps where everyone covers what interests them produces six pieces on the Security Council and none on the committee that actually passed something.
        </Callout>

        <H2>Approval: Who Signs Off Before It Goes Out</H2>
        <p>
          Approval is the press chair&apos;s main tool for quality and safety. The question is how much of it you need.
        </p>
        <H3>Approve everything</H3>
        <p>
          The right default for a first year, a younger conference or any conference with under-18 delegates. Nothing reaches a committee room until an editor has read it. It catches the wrong vote count, the mocking line and the story the crisis team has not cleared yet.
        </p>
        <H3>Approve some reporters</H3>
        <p>
          Once a reporter has filed accurately for a day, you can trust them with direct publishing and keep reading their copy afterwards. This is how a well-run press room speeds up on day two.
        </p>
        <H3>Approve nothing</H3>
        <p>
          Only for experienced university press corps with a clear code of conduct. Even then, keep the ability to switch approval back on.
        </p>
        <p>
          Whatever you choose, tell the reporters how fast you will approve. A release about a vote that waits forty minutes for an editor is no longer news. Aim for five minutes during session.
        </p>

        <H2>Publishing Into the Committee Rooms</H2>
        <p>
          The most common reason press corps fail is that delegates never see their work. A newspaper handed out at breakfast is read by some; a website is read by almost nobody during session. The work has to reach the rooms while debate is live.
        </p>
        <ul>
          <li><strong>Read aloud by chairs.</strong> The traditional way: a runner brings a printed release, the chair reads it between speakers. It works, but it interrupts the floor and depends on the chair&apos;s goodwill.</li>
          <li><strong>A screen in each room.</strong> Effective if you have the screens and someone to update them.</li>
          <li><strong>Into the committee&apos;s own chat.</strong> The release appears where delegates already look, without stopping debate.</li>
        </ul>
        <p>
          Send each release only to the rooms it concerns. A Security Council veto belongs in the Security Council and perhaps the General Assembly committee on the same topic. It does not belong in the Historical Crisis room.
        </p>

        <H2>Timing and Workload</H2>
        <p>
          Two pieces per reporter per day is realistic; four is not, and quality collapses. Plan the press day around the committee timetable, not against it.
        </p>
        <TableWrap>
          <table>
            <thead><tr><th>When</th><th>Press output</th></tr></thead>
            <tbody>
              <tr><td>Opening ceremony</td><td>One release per reporter on the opening speeches, if they are newsworthy</td></tr>
              <tr><td>First sessions</td><td>Few releases; positions are being set out. Reporters build their bloc sheets</td></tr>
              <tr><td>Merger and drafting sessions</td><td>Releases on blocs moving and sponsors leaving</td></tr>
              <tr><td>Voting procedure</td><td>A release within minutes of every result</td></tr>
              <tr><td>End of each day</td><td>Articles, interviews and the front page for tomorrow</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          The <Link href="/blog/mun-conference-day-operations">conference day operations manual</Link> has the full run of show; put the press deadlines on it so the rest of the secretariat knows them too.
        </p>

        <H2>Press Conferences and Interviews</H2>
        <p>
          A press conference with a committee&apos;s main sponsors after a vote is one of the best things a press corps can put on, and one of the easiest to run badly. Give it a fixed time, a chair, and a limit of one question and one follow-up per reporter. <Link href="/blog/mun-press-conference-guide">How MUN press conferences work</Link> covers the format in full.
        </p>

        <H2>Crisis Committees and Leaks</H2>
        <p>
          In a crisis committee, the press is not only covering the story; it can be part of it. A crisis team may feed the press a leak, ask the press to publish a government&apos;s statement, or have delegates try to plant stories through friendly outlets. That is a great exercise and an easy way to break a crisis.
        </p>
        <ul className="gv-check">
          <li>Agree with the crisis director, before the conference, what press may publish about the crisis without clearance</li>
          <li>Route every story about the crisis through the press chair, with approval on</li>
          <li>Treat a directive a delegate shows a reporter as a leak, and check with the backroom before it runs</li>
          <li>Let the crisis team use the press deliberately: a planted release is a crisis update in disguise</li>
          <li>Never publish a real-world claim about a real person as part of the fiction</li>
        </ul>
        <p>
          The <Link href="/blog/mun-crisis-backroom-guide">crisis backroom guide</Link> explains how the backroom works, and why it needs to know what the press is about to publish.
        </p>

        <H2>Ethics and a Code of Conduct</H2>
        <p>
          Write a one-page press code and hand it to every reporter at the first editorial meeting. It needs four rules.
        </p>
        <ol>
          <li><strong>No fabrication.</strong> No invented quote, vote, source or document, in any model. It is the one offence that ends a reporter&apos;s weekend.</li>
          <li><strong>Framing is free, facts are not.</strong> An assigned outlet chooses what to lead on. It never reports what did not happen.</li>
          <li><strong>No personal attacks.</strong> Positions can be criticised and satirised. The students holding them cannot be mocked.</li>
          <li><strong>Photos follow the conference policy.</strong> Especially with under-18 delegates: consent, no flash during speeches, and nothing published outside the conference without clearance. Your <Link href="/blog/mun-safeguarding">safeguarding policy</Link> should already cover it.</li>
        </ol>

        <H2>Running a Press Corps on Gavelling</H2>
        <p>
          On Gavelling, a press corps is a committee of type press, and its seats are outlets instead of countries. You add it like any other committee and allocate reporters to outlets in the usual way. During the conference days, its seat holders, its chairs and accepted press observers get the Press Desk at <em>gavelling.com/conferences/&lt;conference&gt;/press</em>.
        </p>
        <H3>What the Press Desk shows</H3>
        <p>
          Every open committee room, who is speaking now and who is next, and the papers each room has introduced. Reporters use it to decide where to go; press chairs use it to see which rooms are close to a vote.
        </p>
        <H3>Sending releases</H3>
        <p>
          Press seats and press chairs write releases of up to 600 characters with an optional photo, and pick which committee rooms each one goes to; every room is selected by default. Each person can send at most three in any 24 hours, which keeps the rooms from being flooded and makes reporters choose their best stories.
        </p>
        <H3>Approval</H3>
        <p>
          The press chair&apos;s approval setting is on by default: a press delegate&apos;s release waits on the Press Desk until a press chair approves it. A press chair can turn it off on the Press Desk when the reporters have earned it, and back on if a crisis gets sensitive.
        </p>
        <H3>Where releases appear</H3>
        <p>
          In each chosen room&apos;s Everyone chat, labelled <strong>Press · &lt;outlet&gt;</strong>, and as a notification on the screens in that room. A release is never a card on the chair&apos;s screen, so the press never interrupts the floor. Reporters see a history of the releases they have sent, which is the portfolio a press chair judges at the end.
        </p>
        <H3>The press room&apos;s own debate</H3>
        <p>
          Press chairs and press delegates can also join the press committee&apos;s own debate room from the Press Desk. It is a good place to run the editorial meeting, take roll, or hold a mock press briefing.
        </p>
        <p>
          You can set up the committees, seats and roles for the whole conference at <Link href="/conferences/organise">gavelling.com/conferences/organise</Link>; organising on Gavelling costs the organiser nothing.
        </p>

        <H2>A First-Year Press Corps Checklist</H2>
        <ul className="gv-check">
          <li>Model chosen and written into the background guide</li>
          <li>One press chair, plus a deputy if you have more than ten reporters</li>
          <li>Six to ten reporters, each assigned two committees per session</li>
          <li>Editorial meeting before every session block, in the timetable</li>
          <li>Approval on, with a five-minute target</li>
          <li>A route into every committee room during session</li>
          <li>Press code and photo policy handed out at the first meeting</li>
          <li>Crisis clearance agreed with the crisis director</li>
          <li>Judging criteria written down before day one</li>
        </ul>
        <p>
          That last item is the one most press chairs leave until Sunday lunch. Read <Link href="/blog/mun-press-delegate-awards">how press delegates are judged</Link> and write your criteria now, so your reporters know what they are working towards.
        </p>
      </ArticleLayout>
    </>
  );
}
