import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const TITLE = 'Muncoordinated: What MUN Coordinated Does, and a Free Alternative';
const DESCRIPTION =
  'Muncoordinated (muncoordinated.io) is a free, open-source Model UN committee app. What it does, who maintains it, where it beats Gavelling and where Gavelling goes further, reviewed October 2026.';

const FAQ: FaqItem[] = [
  {
    question: 'What is Muncoordinated?',
    answer:
      'Muncoordinated (also written MUN Coordinated, at muncoordinated.io) is a free, browser-based Model UN committee management app. Directors run the committee from an account; delegates open a shareable link and see updates in real time. It is open source under the GNU GPLv3 licence and maintained by its creator, Max Bo, with assistance from the UQ United Nations Student Association.',
  },
  {
    question: 'Is Muncoordinated free?',
    answer:
      'Yes. Its homepage says all of its features are available for free and not locked behind paywalls, and the source code is public on GitHub under the GNU GPLv3 licence.',
  },
  {
    question: 'Is Muncoordinated still maintained?',
    answer:
      'Yes, as of October 2026. The public repository (MaxwellBo/Muncoordinated-2) had commits in July 2026, including updated country names and flags and new integration tests. The current version began at the end of 2017 as a rewrite of an earlier version built in Elm.',
  },
  {
    question: 'Do you need an account to use Muncoordinated?',
    answer:
      'The director does: creating a committee starts with logging in or creating an account with an email and password. Delegates do not need one; they use the shareable link the director sends them.',
  },
  {
    question: 'What is the best alternative to Muncoordinated?',
    answer:
      'Gavelling (gavelling.com) is a free alternative that needs no account from anyone in the room: a chair creates a committee in under a minute, delegates join on their phones with a six-character code, and the session has built-in chat, a voting page and a speaking record. It also runs whole conferences (applications, allocations, payments) where the organiser pays nothing. Muncoordinated stays the better pick if you need open-source software or want delegates proposing and voting on motions from their own devices.',
  },
  {
    question: 'Can delegates propose motions in Muncoordinated?',
    answer:
      'Yes. With the right committee settings turned on, delegates using the shareable link can propose motions, vote on motions, add themselves to speakers lists, amend resolutions, upload files and vote on strawpolls. In Gavelling, delegates request a place on the speakers list and the chair enters motions.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/muncoordinated-alternative',
  keywords: [
    'Muncoordinated',
    'MUN Coordinated',
    'MUNCoordinated',
    'muncoordinated.io',
    'Muncoordinated alternative',
    'Muncoordinated vs Gavelling',
    'open source MUN software',
    'free MUN software',
  ],
  ogDescription:
    'What Muncoordinated is, who maintains it, what it does well, and how Gavelling compares. Reviewed October 2026.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/muncoordinated-alternative',
  datePublished: '2026-07-21',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/muncoordinated-alternative' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Muncoordinated vs Gavelling', item: 'https://gavelling.com/blog/muncoordinated-alternative' },
  ],
};

const ROWS: [string, string, string][] = [
  ['Price', 'Free for chairs and delegates; organisers of a conference pay nothing', 'Free, every feature'],
  ['Source code', 'Not open source', 'Open source, GNU GPLv3'],
  ['Account to run a committee', 'None: a chair password protects the room', 'Director logs in with email and password'],
  ['How delegates get in', 'Six-character code at gavelling.com/join, then pick a seat', 'A shareable link to the committee'],
  ['One person per seat', 'Yes, with optional chair approval for every join', 'Not observed'],
  ['Speakers list and caucus timers', 'Yes, with the clocks kept on the server so every screen agrees', 'Yes: speaker timer and caucus timer'],
  ['Moderated and unmoderated caucus', 'Yes, plus Tour de Table and Consultation of the Whole', 'Yes'],
  ['Delegates propose motions', 'No: delegates request to speak, the chair enters motions', 'Yes, when the committee allows it'],
  ['Delegates vote on motions from their device', 'No; substantive votes can be cast on phones', 'Yes, when the committee allows it'],
  ['Strawpolls', 'Not built in', 'Yes'],
  ['Resolutions and amendments', 'Working papers and draft resolutions with an introduction flow', 'Resolutions, amendments and working papers'],
  ['Substantive voting', 'Roll call or device ballot, thresholds, abstentions, P5 or custom veto', 'Roll-call voting; members ranked Veto, Standard, NGO or Observer'],
  ['Chat in the committee', 'Built in: to the dais, between delegations, groups, files', 'Not built in; its homepage suggests Discord for virtual MUNs'],
  ['Speaking record', 'Every speech logged; points ledger; record downloads as .xlsx', 'Delegate statistics: times spoken, speaking time, motions, amendments'],
  ['Member templates', 'UN member states suggested as you type', 'African Union, ASEAN, BRICS, EU, G20, NATO, Security Council'],
  ['How long a free room is kept', 'Deleted 24 hours after its last activity; a suspended room 36 to 72 hours; conference rooms are kept', 'Saved to the director’s account between sessions'],
  ['Interface languages', 'English, Spanish, French, Arabic', 'English; no other interface language observed'],
  ['Faculty advisor view', 'Yes, read-only board across a delegation', 'Not observed'],
  ['Conference management', 'Applications, allocation, payments, documents, awards, public listing', 'Not part of the product'],
  ['Support', 'The Gavelling team', 'GitHub issues and discussions'],
];

export default function MuncoordinatedAlternative() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="muncoordinated-alternative"
        pitch="Try Gavelling beside Muncoordinated in your next practice session: free, no account for anyone, delegates in on their phones in seconds."
      >
        <p>
          <strong>Muncoordinated</strong>, often written <strong>MUN Coordinated</strong> and found at muncoordinated.io, is one of the longest-running free tools in Model UN. If you searched for it, you probably want one of three things: what it is, whether it is still going, or how it compares with something else. This page answers all three. We build <strong>Gavelling</strong>, so we have tried to be stricter with ourselves than a reader would be: every claim about Muncoordinated below comes from its public source code and homepage, reviewed in October 2026, and anything we could not confirm says so.
        </p>

        <H2>What Muncoordinated is</H2>
        <p>
          Muncoordinated describes itself as a collaborative, browser-based Model UN committee management app. Its own comparison is &ldquo;like Google Docs, but for MUN&rdquo;: the director runs the committee, delegates open a shareable link, and everyone sees changes in real time without refreshing.
        </p>
        <ul>
          <li><strong>Who makes it.</strong> Max Bo, with assistance from the UQ United Nations Student Association at the University of Queensland. The repository names him as the maintainer.</li>
          <li><strong>How old it is.</strong> The current version began at the end of 2017, ahead of SydMUN 2017, as a rewrite of an earlier version built in Elm. The repository was created in September 2017.</li>
          <li><strong>Is it still maintained?</strong> Yes. The repository had commits in July 2026, including updated country names and flags, new tests for committee file uploads and fixes to its build pipeline.</li>
          <li><strong>The licence.</strong> GNU GPLv3. Anyone can read the code. The README asks people not to run their own customised copies and to contribute features back to the hosted version instead.</li>
          <li><strong>The technology.</strong> TypeScript, React, Semantic UI and Firebase, hosted on Netlify.</li>
          <li><strong>The price.</strong> Free. Its homepage says every feature is available for free and not locked behind a paywall.</li>
        </ul>

        <H2>What it does</H2>
        <p>
          The homepage lists moderated and unmoderated caucuses, resolutions and amendments, motions, roll-call voting, custom delegations, strawpolls, file uploads and delegate performance statistics. Reading the code adds detail the homepage leaves out:
        </p>
        <ul>
          <li><strong>Delegates can do real work from the link.</strong> With the matching committee setting on, delegates can add themselves to speakers lists, propose motions, vote on motions, add and edit amendments, upload files and vote on strawpolls.</li>
          <li><strong>A speaker timer and a caucus timer</strong>, with an option to move the next speaker up automatically when time runs out, and keyboard shortcuts for next speaker and for starting or stopping each timer.</li>
          <li><strong>Sixteen motion types in its list</strong>, from opening a moderated or unmoderated caucus to introducing a draft resolution, an amendment or a working paper, proposing a strawpoll and suspending or closing debate. The code marks some of them as only partly implemented.</li>
          <li><strong>Member templates</strong> that fill a committee in one step: African Union, ASEAN, BRICS, the European Union, G20, NATO and the Security Council. Each member has a rank (Veto, Standard, NGO or Observer) and present and voting switches.</li>
          <li><strong>Statistics per delegation:</strong> times spoken, total speaking time, motions proposed and amendments proposed.</li>
          <li><strong>Several directors on one committee</strong>, signed in to the same account, with committee data saved to the server between sessions.</li>
          <li><strong>Notes</strong> for the dais.</li>
        </ul>
        <p>
          The director creates the committee after logging in or creating an account with an email and password. Delegates need no account.
        </p>

        <H2>Where Muncoordinated is the better pick</H2>
        <p>
          These are real advantages, and if one of them decides it for you, use Muncoordinated.
        </p>
        <ul>
          <li><strong>It is open source.</strong> Some schools and universities require software they can inspect. Gavelling is not open source, and no feature list changes that.</li>
          <li><strong>Delegates propose and vote on motions from their own devices.</strong> That moves typing off the dais. In Gavelling, delegates can ask for a place on the speakers list and ask to join, but motions are entered by the chair.</li>
          <li><strong>Strawpolls.</strong> A quick non-binding poll is built in. Gavelling has nothing equivalent.</li>
          <li><strong>A committee that waits for you.</strong> Muncoordinated keeps a committee in the director&rsquo;s account between sessions. A free standalone Gavelling room is deleted 24 hours after its last activity, or 36 to 72 hours after a suspension, so a weekend club meeting does not carry over to next week. Rooms that belong to a conference on Gavelling are kept.</li>
          <li><strong>Regional templates.</strong> If you run an African Union, ASEAN, BRICS, EU, G20 or NATO committee, its member lists are one click away.</li>
          <li><strong>Eight years of track record</strong> and an open issue tracker where you can see what is being fixed.</li>
        </ul>

        <H2>Where Gavelling goes further</H2>
        <H3>Nobody needs an account</H3>
        <p>
          A chair opens a room at <Link href="/create/sessions">gavelling.com/create</Link> with no sign-up. The room gets a six-character session code for delegates and a four-digit chair password for the dais. Delegates go to gavelling.com/join on their phones, type the code and pick their seat. One person holds a seat at a time, and the chair can require approval for every join.
        </p>
        <H3>The delegate&rsquo;s phone is a real view</H3>
        <p>
          Each delegate sees whether they are speaking, their place in the queue, the caucus clock, the committee&rsquo;s documents and the chat. They can request to speak, submit a working paper or draft resolution, and cast their vote on their phone when the chair runs a device ballot.
        </p>
        <H3>Chat is part of the room</H3>
        <p>
          Delegates message the dais or each other, form group chats and send files, and the chair can switch chat off for the committee. Muncoordinated&rsquo;s homepage instead suggests pairing it with Discord for virtual conferences.
        </p>
        <H3>Procedure that survives a busy room</H3>
        <ul>
          <li>The General Speakers List and the caucus queue are kept apart, so a caucus never touches the list.</li>
          <li>Moderated caucus, unmoderated caucus, Tour de Table, Consultation of the Whole, Right of Reply on its own clock, and yields to the next speaker or to another delegation.</li>
          <li>Timers run from the server&rsquo;s clock rather than the laptop&rsquo;s, so the projector, a co-chair&rsquo;s laptop and the delegates&rsquo; phones agree, and an optional gavel knock sounds as time runs out. Our <Link href="/blog/mun-timer">MUN timer guide</Link> covers how timing works in detail.</li>
          <li>Up to fifteen motions on the floor, ranked by disruptiveness.</li>
          <li>A voting page with thresholds, abstentions in or out of the count, P5 or custom vetoes and a timed round of rights speakers.</li>
          <li>One chair holds the gavel; co-chairs can comment on each speech without being able to change the floor.</li>
          <li>Every speech is logged, and the whole record downloads as a spreadsheet when debate ends.</li>
        </ul>
        <H3>A whole conference, not only a room</H3>
        <p>
          Gavelling also runs the conference around the committees: applications, <Link href="/blog/mun-country-allocation">country allocation</Link>, <Link href="/blog/mun-conference-registration-payments">fees and payments</Link>, study guides and position papers, awards and a public listing on <Link href="/conferences/explore">Explore</Link>. A conference committee is its own live room, so there is nothing to import on the morning. Muncoordinated does not try to do any of this, which is a fair choice for a committee tool, but it means a conference using it needs something else for registration.
        </p>
        <Callout>
          How Gavelling pays for itself, so you can judge the comparison: the organiser pays nothing, and so does anyone using a session. Applicants to a conference use one credit per application, refunded if they are turned down, and there is an optional personal subscription. Gavelling takes no cut of the delegate fees a conference collects. If you are pricing a conference, our <Link href="/blog/mun-conference-budget">sample MUN conference budget</Link> shows where the software line sits.
        </Callout>

        <H2>Side by side</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>&nbsp;</th>
                <th>Gavelling</th>
                <th>Muncoordinated</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([feat, g, m]) => (
                <tr key={feat}>
                  <td><strong>{feat}</strong></td>
                  <td>{g}</td>
                  <td>{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">
          Reviewed in October 2026. Muncoordinated sources: its homepage text and source code in the public repository github.com/MaxwellBo/Muncoordinated-2 (README, licence, commit history to 18 July 2026, and the files for motions, settings, members, templates, sharing and sign-in). &ldquo;Not observed&rdquo; means we did not find it, not that it does not exist. Gavelling rows were checked against our own code. If anything here is wrong or has changed, <Link href="/contact">tell us</Link> and we will correct it.
        </p>

        <H2>Which one to choose</H2>
        <H3>Choose Muncoordinated if</H3>
        <ul>
          <li>Your institution requires open-source software.</li>
          <li>You want delegates proposing motions, voting on them and running strawpolls from their own devices.</li>
          <li>You run one committee over several weeks and want it waiting in an account between meetings.</li>
          <li>You run a regional body and want its member list in one click.</li>
        </ul>
        <H3>Choose Gavelling if</H3>
        <ul>
          <li>You want no accounts at all, for the chair or the room.</li>
          <li>You want chat, documents, a voting page and a speaking record inside the committee instead of beside it.</li>
          <li>Your committee runs in Spanish, French or Arabic as well as English.</li>
          <li>You are running a conference and want registration, allocation and payments in the same place as the committees.</li>
        </ul>
        <p>
          Both are free, so the honest advice is to run one practice committee on each with your own club and keep the one your chairs reach for. For the rest of the field, see <Link href="/blog/best-mun-software-2026">best MUN software in 2026</Link> and <Link href="/blog/free-mun-tools">free MUN tools</Link>; for the paid platforms, <Link href="/blog/mymun-alternative">mymun and MUN Command compared</Link>.
        </p>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
