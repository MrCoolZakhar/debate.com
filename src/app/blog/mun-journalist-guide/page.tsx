import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

const SLUG = 'mun-journalist-guide';
const TITLE = "The MUN Journalist's Guide: How to Cover a Model UN Committee";
const DESCRIPTION =
  'What to watch in a committee, how to interview delegates, staying neutral, meeting deadlines, reading bloc dynamics and reporting a vote correctly';
const OG = 'How a Model UN journalist covers a committee: what to watch, who to interview and how to report the vote.';

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
    { '@type': 'ListItem', position: 3, name: "The MUN Journalist's Guide", item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function MunJournalistGuide() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug={SLUG}
        pitch="On Gavelling's Press Desk a reporter sees every open room, who is speaking and next, and the papers on the floor."
      >
        <p>
          A Model UN journalist has a harder brief than any delegate. A delegate needs to understand one country&apos;s position on one topic. You need to understand every position in the room, how they are moving, and which of them will matter by the vote, and then explain it to people who were not there. This guide covers what to watch in a committee, how to interview delegates without disrupting debate, how to stay neutral, how to manage deadlines, how to read bloc dynamics, and how to report a vote so that nobody in the room can say you got it wrong.
        </p>
        <p>
          For the structure of the press committee itself, start with <Link href="/blog/mun-press-corps-guide">how a MUN press corps works</Link>. For turning what you find into copy, see <Link href="/blog/how-to-write-mun-press-release">how to write a MUN press release</Link>.
        </p>

        <H2>Before You Walk Into the Room</H2>
        <p>
          Good coverage starts the night before. Fifteen minutes of preparation per committee saves you an hour of confusion on the day.
        </p>
        <ul className="gv-check">
          <li>Read the committee&apos;s background guide, at least the summary and the questions it asks</li>
          <li>Know the five or six delegations most likely to matter: the big powers, the regional leaders, the ones with a stake in the topic</li>
          <li>Check whether it is a General Assembly committee (simple majority) or a Security Council (nine votes and no veto from the five permanent members)</li>
          <li>Learn the procedure words. A reporter who confuses a moderated caucus with an amendment loses the room&apos;s trust immediately</li>
          <li>Know your outlet&apos;s line if you have one, and what it would and would not lead on</li>
        </ul>
        <p>
          Our <Link href="/blog/mun-glossary">MUN glossary</Link> and <Link href="/blog/mun-motions-explained">motions reference</Link> are the two pages to read if procedure is new to you.
        </p>

        <H2>What to Watch in a Committee</H2>
        <p>
          The speeches are the least informative part of a committee. Delegates read prepared statements in the first hour and repeat their positions after that. The story is in the movement, and you see movement in five places.
        </p>
        <H3>The speakers list</H3>
        <p>
          Who adds themselves and who does not. A delegation that has been silent all morning and suddenly asks to speak before a vote has usually changed its position, or been asked to defend a bloc.
        </p>
        <H3>The motions</H3>
        <p>
          Who raises which caucus, and on what topic. A moderated caucus on &quot;funding mechanisms&quot; raised by a small state usually means the funding clause is where the fight is. A motion to close debate raised early means a bloc thinks it has the votes.
        </p>
        <H3>The unmoderated caucus</H3>
        <p>
          The real negotiation. Watch where people stand, not what they say. Two groups at opposite ends of the room is a divided committee. One group around a laptop with three delegations hovering at the edge is a draft resolution with three undecided votes.
        </p>
        <H3>The papers</H3>
        <p>
          Working papers and draft resolutions tell you who has formally committed to what. The sponsor list is a fact; a speech is an intention. Read the operative clauses that changed between drafts. The <Link href="/blog/mun-working-paper-guide">working paper guide</Link> explains how papers evolve.
        </p>
        <H3>The chair</H3>
        <p>
          The dais knows the time pressure better than anyone. When the chair says &quot;we will move to voting procedure after this caucus&quot;, your deadline just moved.
        </p>

        <H2>Reading Bloc Dynamics</H2>
        <p>
          Almost every committee story is a bloc story. Delegations group into coalitions, the coalitions write competing papers, and the vote decides which group won. Your job is to know where each group stands at any moment.
        </p>
        <TableWrap>
          <table>
            <thead><tr><th>What you see</th><th>What it usually means</th></tr></thead>
            <tbody>
              <tr><td>Two working papers on the same topic</td><td>Two blocs; the merger negotiation is the story</td></tr>
              <tr><td>A delegation sponsoring both papers</td><td>A broker, and the best interview in the room</td></tr>
              <tr><td>Sponsors leaving a draft</td><td>A clause went too far, or a better offer came from the other side</td></tr>
              <tr><td>A flood of friendly amendments</td><td>The main sponsors are buying votes clause by clause</td></tr>
              <tr><td>An early motion to vote</td><td>One side counts a majority and wants to stop the other organising</td></tr>
              <tr><td>A permanent member going quiet in a Security Council</td><td>A possible veto, or a deal being made outside the room</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          Keep a simple sheet for each committee: one column per bloc, the delegations in each, and an arrow when one moves. By the second session you will know the committee better than most of its delegates. For the delegate&apos;s side of this, read <Link href="/blog/mun-bloc-building">MUN bloc building</Link>.
        </p>

        <H2>Interviewing Delegates</H2>
        <p>
          The best reporters at a conference are the ones delegates are happy to talk to. That reputation is earned on the first day and lost with one misquote.
        </p>
        <H3>When</H3>
        <p>
          Never during formal debate. Unmoderated caucus is acceptable if the delegate is not in the middle of drafting; breaks and the end of session are best. Always ask the chair before entering a room, sit at the back, and leave quietly.
        </p>
        <H3>How</H3>
        <ol>
          <li>Introduce yourself and your outlet before the first question.</li>
          <li>Ask for two minutes, not an interview.</li>
          <li>Agree what is on the record. &quot;Can I quote you on this?&quot; is enough.</li>
          <li>Ask one question that gets a real answer, then one follow-up.</li>
          <li>Read back any quote you plan to use if you are not sure you have it exactly.</li>
        </ol>
        <H3>Questions that work</H3>
        <ul>
          <li>&quot;What changed between this morning and now?&quot;</li>
          <li>&quot;What would make you vote against the draft?&quot;</li>
          <li>&quot;Who are you still waiting to hear from?&quot;</li>
          <li>&quot;What did you give up in the merger?&quot;</li>
        </ul>
        <p>
          Avoid &quot;How do you feel about the debate?&quot;. It gets a speech, not an answer. The <Link href="/blog/mun-press-conference-guide">press conference guide</Link> has more on asking questions that land, and on follow-ups.
        </p>
        <Callout>
          Interview both sides of every story. A piece that quotes only the winning bloc reads as a press release for that bloc, whatever you intended.
        </Callout>

        <H2>Staying Neutral, Even With an Outlet</H2>
        <p>
          Neutrality means different things in the two press models, and you need to know which one you are in.
        </p>
        <FactCard title="Independent journalist">
          You report as a neutral outlet. Balance is the standard: both sides quoted, results stated plainly, no adjectives that carry a judgement. Comment belongs in a clearly labelled opinion piece.
        </FactCard>
        <FactCard title="Assigned outlet">
          You report as a real outlet with an editorial line. You may choose what to lead on, who to quote and what to call things. You may not change a fact, invent a quote or report a vote that did not happen.
        </FactCard>
        <p>
          In both models the line is the same: framing is yours, facts are not. A state broadcaster can lead on its own delegation&apos;s amendment and bury the loss; it cannot report that the amendment passed. The <Link href="/blog/mun-press-corps-guide">press corps guide</Link> sets out the ethics in more detail.
        </p>

        <H2>Deadlines and How to Meet Them</H2>
        <p>
          A press corps with no deadline publishes nothing. A reporter who misses one has written nothing, however good the draft. Work backwards from every deadline you are given.
        </p>
        <ul>
          <li><strong>Write while the room is in a long speakers list.</strong> Formal debate is the quiet hour for reporters. Draft your piece then, and use the caucus to check it.</li>
          <li><strong>Write the lead first.</strong> If the session ends and you only have one sentence, a good lead is still a story.</li>
          <li><strong>File early, update later.</strong> A short release on time beats a long one after the vote everyone already knows about.</li>
          <li><strong>Two committees, not five.</strong> You cannot cover more than two rooms properly in a session. Choose, and tell your press chair which.</li>
        </ul>

        <H2>How to Report a Vote</H2>
        <p>
          The vote is the one fact every reader in the room can check, which makes it the one place a reporter can lose all credibility in a sentence. Get every part of it right.
        </p>
        <ol>
          <li><strong>What was voted on.</strong> The draft&apos;s number and, in plain words, what it does. &quot;Draft Resolution 2/1, which creates a regional water-sharing commission&quot;.</li>
          <li><strong>The result and the count.</strong> For, against, abstentions. Write them down as the chair announces them.</li>
          <li><strong>The threshold.</strong> A substantive vote usually needs a simple majority, sometimes two thirds. In a Security Council, say whether a permanent member voted against.</li>
          <li><strong>Who decided it.</strong> The swing votes, the abstentions that mattered, any surprising Against.</li>
          <li><strong>What it changes.</strong> One sentence on what happens now.</li>
        </ol>
        <p className="gv-note">
          Example: &quot;The Security Council failed to adopt Draft Resolution 1/1 on the Kalden ceasefire, despite eleven votes in favour, after the Russian Federation voted against. China and Brazil abstained. The draft would have created a monitored humanitarian corridor.&quot;
        </p>
        <p>
          Notice &quot;failed to adopt despite eleven votes in favour&quot;. A veto is the story; the count explains it. If you are unsure how a veto, an abstention or a vote with rights works, read <Link href="/blog/mun-voting-procedures">MUN voting procedures</Link> before your first vote.
        </p>

        <H2>Covering a Committee on Gavelling</H2>
        <p>
          When a conference runs its committees on Gavelling and has a press committee, its press seats, press chairs and accepted press observers get the Press Desk during the conference days. It lists every open committee room with who is speaking now and who is next, and the papers each room has introduced. That changes how you plan a session: instead of walking between rooms to find out which one is about to vote, you can see which rooms have a draft introduced and go there.
        </p>
        <p>
          From the same desk you send press releases of up to 600 characters, with an optional photo, to the rooms you choose (all of them by default). A press chair may need to approve a delegate&apos;s release first, and each person can send three in any 24 hours. Releases appear in each chosen room&apos;s Everyone chat as <strong>Press · &lt;outlet&gt;</strong> and as a notification, and your desk keeps the history of what you sent. Press chairs and press delegates can also join the press committee&apos;s own debate room from the Press Desk, which is where an editorial meeting can run.
        </p>
        <Callout>
          The Press Desk tells you where to be. It does not tell you why a bloc moved. Use it to choose the room, then go and ask.
        </Callout>

        <H2>A Reporter&apos;s Day in One List</H2>
        <ul className="gv-check">
          <li>Morning: two committees chosen, background guides skimmed, bloc sheet started</li>
          <li>First session: in the room, speakers list and motions noted, first draft of a lead</li>
          <li>Break: two interviews, one from each side</li>
          <li>Second session: watch the papers, update the bloc sheet, file a short release</li>
          <li>Vote: count written down live, release filed within minutes</li>
          <li>Evening: longer piece for the newspaper or archive, tomorrow&apos;s angles agreed</li>
        </ul>
        <p>
          The reporters who do this well are the ones who win press awards; <Link href="/blog/mun-press-delegate-awards">how press delegates are judged</Link> explains what the press chair is looking for. And if you would like to watch a committee&apos;s speakers list and motions move in real time before your conference, open a free practice room at <Link href="/sessions">gavelling.com/sessions</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
