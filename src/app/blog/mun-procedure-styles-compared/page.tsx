import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'THIMUN vs UNA-USA vs Harvard Style: MUN Procedures Compared',
  description:
    'The three main families of Model UN procedure side by side, what transfers between them, what actively misleads you, and which to run at your own conference.',
  path: '/blog/mun-procedure-styles-compared',
  ogDescription: 'The three main MUN procedure families side by side, and which one to run.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'THIMUN vs UNA-USA vs Harvard Style: MUN Procedures Compared',
  description: 'The three main families of Model UN procedure compared, and how to choose one for your conference.',
  url: 'https://gavelling.com/blog/mun-procedure-styles-compared',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-procedure-styles-compared' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Procedures Compared', item: 'https://gavelling.com/blog/mun-procedure-styles-compared' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-procedure-styles-compared"
        pitch="Whichever rules you run, Gavelling handles the mechanics: speakers list, caucus timers, motions ranked by disruptiveness, and voting. Free, no account needed."
      >
        <p>A delegate who is excellent at one style of Model UN can look lost at another, and it is almost never because they are worse at debating. It is because the room rewards a different thing. The three main families of procedure produce genuinely different committees: different pace, different places where the real negotiation happens, and different definitions of a good delegate. This guide puts them side by side.</p>

        <H2>The three families, and where each is used</H2>
        <p>They are best understood by where they grew up rather than by their rulebooks, because the rulebook is downstream of the room.</p>
        <FactCard title="THIMUN style">
          Grew out of The Hague International Model United Nations and spread through the international school circuit: Europe, the Middle East, much of Asia, and international schools everywhere. Formal, podium-based, built around a long lobbying and merging phase that produces one resolution per topic. Debate is conducted in the third person and the atmosphere is deliberately diplomatic rather than competitive. Our <Link href="/blog/thimun-rules-of-procedure">THIMUN rules of procedure guide</Link> covers it in detail.
        </FactCard>
        <FactCard title="UNA-USA style">
          The default in most North American high school conferences and widely used elsewhere. Built around a General Speakers List punctuated by moderated and unmoderated caucuses, with working papers that become several competing draft resolutions. It is the style most online guides describe when they say &quot;MUN procedure&quot; without qualification. Our <Link href="/blog/una-usa-rules-of-procedure">UNA-USA rules of procedure guide</Link> walks through it.
        </FactCard>
        <FactCard title="Harvard or college-circuit style">
          Not a single published rulebook but the dialect of the North American university circuit, including HNMUN and the conferences modelled on it. Closest to UNA-USA in mechanics, but faster, longer, heavier on unmoderated caucus and crisis, and with rules that each conference publishes for itself and expects you to have read.
        </FactCard>
        <p>The one rule that beats everything below: your conference&apos;s own rulebook wins. Every family has dozens of local variants, and the differences between two THIMUN-affiliated conferences can be larger than the differences between the families on any single point.</p>

        <H2>The comparison table</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>&nbsp;</th><th>THIMUN</th><th>UNA-USA</th><th>Harvard / college circuit</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Main debate structure</strong></td><td>Lobbying and merging, then formal debate on submitted resolutions, clause by clause</td><td>General Speakers List on the topic, interrupted by caucuses</td><td>General Speakers List, but most of the session is spent in caucus</td></tr>
              <tr><td><strong>Moderated caucus</strong></td><td>Rare or absent. Debate time is allocated for and against a resolution</td><td>Central. Motions specify a topic, total time and speaking time</td><td>Central and frequent, often with very short speaking times</td></tr>
              <tr><td><strong>Unmoderated caucus</strong></td><td>Replaced by the formal lobbying phase, which is scheduled rather than motioned</td><td>Used for drafting and bloc work, motioned by delegates</td><td>Heavily used and often the place the committee is actually decided</td></tr>
              <tr><td><strong>Papers</strong></td><td>Resolutions drafted collaboratively during lobbying, with a main submitter and co-submitters</td><td>Working papers, then draft resolutions with sponsors and signatories</td><td>Working papers, then draft resolutions, often several competing</td></tr>
              <tr><td><strong>How many pass</strong></td><td>Usually one resolution per topic reaches the floor</td><td>Several draft resolutions may be introduced, commonly one passes</td><td>Several introduced, and more than one may pass where rules allow</td></tr>
              <tr><td><strong>Amendments</strong></td><td>Formally debated on the floor, often with time for and against</td><td>Friendly amendments accepted by sponsors, unfriendly ones voted on</td><td>Similar to UNA-USA, with tighter deadlines for submission</td></tr>
              <tr><td><strong>Points</strong></td><td>Points of information to the speaker are the heart of debate</td><td>Order, inquiry, personal privilege. Questions to a speaker only by yield</td><td>Same set, used more sparingly, with chairs less tolerant of misuse</td></tr>
              <tr><td><strong>Yields</strong></td><td>Speakers open themselves to points of information instead</td><td>Yield to questions, to another delegate, or to the chair</td><td>Yields common but sometimes restricted by the conference rules</td></tr>
              <tr><td><strong>Address</strong></td><td>Strictly third person, formal, no direct address between delegates</td><td>Third person, enforced with varying strictness</td><td>Third person in formal debate, informal in caucus</td></tr>
              <tr><td><strong>Voting</strong></td><td>Clause-by-clause on amendments, then the resolution as a whole</td><td>Procedural motions by simple majority, closure usually two-thirds, substantive usually simple majority</td><td>As UNA-USA, with per-conference thresholds published in the rulebook</td></tr>
              <tr><td><strong>Awards</strong></td><td>Often de-emphasised or absent, especially at THIMUN itself</td><td>Standard ladder from Verbal Commendation to Best Delegate</td><td>Awards central and competitive, with a visible circuit ranking culture</td></tr>
              <tr><td><strong>Formality</strong></td><td>Highest. Podium speeches, suits, diplomatic register</td><td>Medium. Formal debate, informal caucus</td><td>Medium formality, high intensity</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Every cell describes the common case. Individual conferences vary on all of it, and several of the differences above are conventions of practice rather than written rules.</p>

        <H2>Where the energy of the debate actually sits</H2>
        <p>This is the real difference, and it is not in any rulebook.</p>
        <p>In <strong>THIMUN</strong>, the committee is largely decided during lobbying. Two or three hours of scheduled, structured negotiation produce one resolution per topic, and by the time formal debate begins, the text exists and the coalition around it exists. Formal debate is where the resolution is defended, attacked through points of information, and amended. A delegate who is good at THIMUN is good at drafting with others and good at standing at a lectern taking hostile questions in the third person.</p>
        <p>In <strong>UNA-USA</strong>, the energy is split. The General Speakers List sets the tone and gives every delegation a guaranteed moment, moderated caucus is where the substantive argument happens in public, and unmoderated caucus is where blocs and papers are built. The committee swings between the three all day.</p>
        <p>In the <strong>college circuit</strong>, the energy is in unmoderated caucus, and the formal record is mostly a scoreboard of it. Sessions are long, drafting groups form and collapse, and a delegate who is winning caucus but never speaking formally is usually still winning the committee.</p>
        <Callout>If you are crossing circuits, the question to ask is not &quot;what are the motions called here&quot;. It is &quot;where in this format does the deal actually get made&quot;. Then spend your preparation on that part.</Callout>

        <H2>What transfers, and what actively misleads you</H2>
        <H3>Transfers cleanly</H3>
        <ul>
          <li>Country research and policy knowledge, which is format-independent</li>
          <li>Speech structure: position, evidence, proposal, ask</li>
          <li>Clause writing, since preambulatory and operative grammar is shared everywhere</li>
          <li>Reading a room, finding the undecided bloc, and knowing who has to be in your coalition</li>
          <li>Being someone others want to draft with, which is the whole game in every format</li>
        </ul>
        <H3>Misleads you</H3>
        <ul>
          <li><strong>Assuming caucus exists.</strong> A UNA-USA delegate at a THIMUN conference who motions for an unmoderated caucus has told the room they have not read the rules.</li>
          <li><strong>Assuming your paper can be yours.</strong> In THIMUN the target is one merged resolution, so refusing to merge is not strategy but a failure to participate.</li>
          <li><strong>Assuming several resolutions can pass.</strong> In many UNA-USA committees one does, and the fight is over which.</li>
          <li><strong>Points of information.</strong> In THIMUN they are the main event. In UNA-USA rooms a question reaches a speaker only through a yield, and shouting one is a procedural mistake.</li>
          <li><strong>Speaking volume as a proxy for performance.</strong> The college circuit rewards visible dominance far more than THIMUN, which frequently penalises it.</li>
          <li><strong>Directness.</strong> &quot;You are wrong&quot; is normal in some rooms and a chair&apos;s correction in others. The safe default anywhere is the third person.</li>
        </ul>
        <p>If you are moving between circuits, read the full rulebook of the conference you are attending rather than a general guide, then map it onto what you already know. Our <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> covers the shared machinery, and <Link href="/blog/mun-motions-explained">the motions guide</Link> covers what each motion does and what it needs to pass.</p>

        <H2>Crisis as a fourth family</H2>
        <p>Crisis procedure is not a variant of the three above. It is its own thing with its own logic, and it sits alongside them rather than inside them.</p>
        <p>A crisis committee is small, usually between fifteen and thirty positions, and delegates represent individuals with personal powers rather than states. The public floor runs on a stripped-down version of UNA-USA procedure, usually just a speakers list and frequent moderated caucus. The substance is elsewhere: in directives written and passed by the room, and in private notes sent to a backroom that responds by changing the world. Formal debate is often the least important part of the day.</p>
        <p>What this means procedurally: shorter speeches, faster motions, directives instead of resolutions, and a chair who is managing a story as much as a queue. If your conference is adding a crisis committee, do not simply lend it the GA rulebook. Our <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link> covers how the two rooms work together.</p>

        <H2>Hybrids, which is what most conferences run</H2>
        <p>Almost nobody runs a family purely. The common hybrids are worth naming because they are what you will actually meet.</p>
        <ul>
          <li><strong>THIMUN mechanics with awards.</strong> Very common at THIMUN-affiliated conferences outside the Netherlands, and it changes delegate behaviour more than organisers expect.</li>
          <li><strong>UNA-USA mechanics with a scheduled lobbying block.</strong> A long unmoderated caucus given a name and a place in the timetable. This is often the single best addition to a school conference, because it removes the &quot;we never had time to draft&quot; complaint.</li>
          <li><strong>A single merged resolution required, with caucuses allowed.</strong> Produces collaboration without losing the pace.</li>
          <li><strong>House rules on top of anything.</strong> Local quorum, local thresholds, a local ban on a motion the conference dislikes.</li>
        </ul>
        <p>A hybrid is legitimate. An undocumented hybrid is not: if your rules differ from the family you claim, write the differences down.</p>

        <H2>Choosing a procedure for your own conference</H2>
        <TableWrap>
          <table>
            <thead><tr><th>If this is true</th><th>Lean towards</th></tr></thead>
            <tbody>
              <tr><td>Most delegates are first-timers</td><td>UNA-USA, simplified. The GSL gives everybody a guaranteed turn</td></tr>
              <tr><td>Committees are large, over 40 delegations</td><td>THIMUN-style lobbying, or long scheduled drafting blocks</td></tr>
              <tr><td>Your chairs are inexperienced</td><td>Fewer motion types, published thresholds, a written script</td></tr>
              <tr><td>Your region already runs one style</td><td>That style. Delegates arrive prepared and advisors trust you</td></tr>
              <tr><td>You want collaboration over competition</td><td>THIMUN style, one merged resolution, awards de-emphasised</td></tr>
              <tr><td>You want a competitive, fast weekend</td><td>UNA-USA or college circuit, with crisis committees</td></tr>
              <tr><td>Sessions are short, under three hours</td><td>Cut unmoderated caucus length and cap the motion list</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The honest constraint is staff experience. A rulebook your chairs cannot run confidently produces worse committees than a simpler one they can. If in doubt, take the style your region uses and write down your three house differences.</p>

        <H2>Writing your own rulebook</H2>
        <p>If you write your own, these are the sections that cause disputes when they are missing. Decide each one explicitly, in writing, before your first conference.</p>
        <ul className="gv-check">
          <li>Quorum: what it is, when it is checked, and what happens when it fails</li>
          <li>Which motions exist at all, and their order of disruptiveness for voting</li>
          <li>The threshold for each: simple majority, two-thirds, or chair&apos;s discretion</li>
          <li>Whether abstentions count in the denominator on substantive votes</li>
          <li>Who may sponsor, how many sponsors and signatories a paper needs, and the submission deadline</li>
          <li>Whether amendments to amendments are permitted. The answer should usually be no</li>
          <li>Right of reply: who grants it, how long, and whether it can be replied to</li>
          <li>Veto, if you are running a Security Council, and exactly who holds it</li>
          <li>The chair&apos;s discretion clause, which is the one that saves every committee at least once</li>
        </ul>
        <p>Keep it to a length a delegate will actually read. Ten well-organised pages beat forty, and a one-page summary sheet in every committee room beats both on the day.</p>

        <H2>Explaining it to delegates before they arrive</H2>
        <p>Publish the rulebook with the background guides, not a week before. Then do three things that cost almost nothing: a one-page cheat sheet of the motions and their thresholds, a short video or briefing session for first-timers, and a chair who opens session one by saying which style this is and what the two most common mistakes will be.</p>
        <p>The most effective preparation is a practice committee. Run one with your club in the format your next conference uses, chaired by someone who has read the rulebook, and let people make the procedural mistakes somewhere cheap. You can open a <Link href="/create/sessions">free practice session</Link> in a minute and run it from a laptop, with the speakers list, caucus timers and motions on everyone&apos;s phone, whichever family of rules you are rehearsing. If you are still choosing where to compete, our guide to <Link href="/blog/choosing-mun-conferences">choosing MUN conferences</Link> helps, and our <Link href="/conferences/explore">conference directory</Link> usually tells you which style a conference runs before you commit a delegation to it.</p>
      </ArticleLayout>
    </>
  );
}
