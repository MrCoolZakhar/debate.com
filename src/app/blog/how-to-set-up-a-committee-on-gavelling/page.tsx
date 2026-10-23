import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript } from '@/components/blog/prose';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';

export const revalidate = 3600; // scheduled videos appear in the server HTML and JSON-LD within an hour of release

const SLUG = 'how-to-set-up-a-committee-on-gavelling';
const TITLE = 'How to Set Up a MUN Committee on Gavelling';
const DESCRIPTION =
  'Create a free committee, add the countries, observers and your co-chair, and get delegates in on their phones with one code';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: `/blog/${SLUG}`,
  ogDescription: 'Set up a free MUN committee room on Gavelling and get every delegate in on their phone.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: 'Set up a free MUN committee room on Gavelling and get every delegate in on their phone.',
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
    { '@type': 'ListItem', position: 3, name: 'Set Up a Committee on Gavelling', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function SetUpCommitteeOnGavelling() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['vcL53n4CRJM', 'Itr-yHCyDto', 'H3KBZVen978', 'jaYmgylFMVs']} />
      <ArticleLayout
        slug={SLUG}
        pitch="Set up your committee room in a minute, free and with no account, then run roll call, speakers and motions from one laptop."
      >
        <p>
          Gavelling Sessions is a free room for one Model UN committee. You run it from a laptop at the dais. Delegates follow
          it on their phones. Nobody needs an account: the room is a six-character session code for delegates and a
          four-digit chair password for the dais.
        </p>
        <p>
          This guide walks through the whole set-up, in the order you will meet it. You name the committee, add the
          delegations, start the room, get delegates and your co-chair in, and take the first roll call. Give yourself ten
          minutes the first time. After that it takes about one.
        </p>

        <H2>1. Open the Builder and Name Your Committee</H2>
        <p>
          Go to <Link href="/create">gavelling.com/create</Link> and press <strong>Start a committee</strong>. You land on
          the builder, titled &quot;Set up your committee&quot;. The left side holds the controls. The right side shows the
          room taking shape as you type.
        </p>
        <p>The first panel, Committee, asks three things:</p>
        <ul>
          <li>
            <strong>Committee name.</strong> Start typing and Gavelling suggests known committees: UNSC, WHO, UNHRC, DISEC,
            the ICJ, a crisis committee, the House of Commons and many more. Picking one fills in its name and emblem, and
            for committees with a fixed membership (the Security Council, the G20, NATO and others) it adds the member
            states too. You can also type any name of your own.
          </li>
          <li>
            <strong>Topic.</strong> The agenda item delegates will see at the top of their screen, for example &quot;The
            right to education&quot;.
          </li>
          <li>
            <strong>Chairs</strong> (optional). Type your name and press Enter, then add your co-chairs the same way, up to
            five. The first name is you. Leave it empty and you join as &quot;Chair&quot;.
          </li>
        </ul>
        <p>
          Name and topic are required. Until both are filled, the button at the bottom says <strong>Add a name and a
          topic</strong> instead of starting anything.
        </p>
        <Callout>
          A chair&apos;s name can never be the same as a seat in the room. If you call yourself &quot;France&quot; in a
          committee that seats France, the builder stops you and asks for another name.
        </Callout>

        <TutorialVideo id="vcL53n4CRJM">Here is the whole set-up in under a minute: the committee, the countries, the observers and the co-chair.</TutorialVideo>

        <H2>2. Add the Delegations and Observers</H2>
        <p>
          The second panel, Delegations, fills the roster on the right. There are three ways in, and you can mix them.
        </p>
        <H3>Type a country</H3>
        <p>
          The field says &quot;Type a country, or any custom name&quot;. It understands short forms and old names, so
          &quot;UK&quot; finds the United Kingdom and &quot;Turkey&quot; finds Türkiye. Press Enter or the plus button to add
          the top match. If you type something that is not a country, such as a character in a crisis committee or a judge
          at the ICJ, press <strong>Add custom</strong> and it becomes a seat with that name.
        </p>
        <H3>Use a quick bundle</H3>
        <p>
          Under the field sits a row of bundles: P5, G7, BRICS+, G20, EU, NATO, ASEAN, UNSC 2026, AU, OPEC and the Arab
          League. Each one adds every member in a single press, and the number on the chip tells you how many seats it will
          add. Bundles stack, so P5 plus G7 gives you the union without duplicates.
        </p>
        <H3>Paste a list</H3>
        <p>
          Got the allocation in a spreadsheet? Paste it into the large box, one country per line or separated by commas,
          and press Auto-match &amp; add. Gavelling shows you what it matched before anything goes in, so you can fix a
          spelling or drop a row first.
        </p>
        <p>
          Every row on the roster has three small controls. The megaphone marks the seat as an observer. The pencil renames
          a custom seat. The cross removes it. Observers count towards quorum during debate but not in the final vote on a
          resolution.
        </p>
        <p>
          You do not need the full list now. The button says &quot;You can add delegations later&quot;, and it means it:
          the roll call screen has an <strong>Add a seat</strong> field for the delegation that turns up late. When you are
          ready, press <strong>Start session</strong>.
        </p>

        <H2>3. Find Your Session Code and Chair Password</H2>
        <p>
          The moment the room is created you are on the chair page, inside the first roll call. Two codes now exist:
        </p>
        <ul>
          <li>
            <strong>The session code</strong>, six characters. Delegates join with it. Put it on the screen, write it on the
            board, read it out.
          </li>
          <li>
            <strong>The chair password</strong>, four digits. Chairs need it to join and to change anything. Keep it on the
            dais.
          </li>
        </ul>
        <p>
          Both live in <strong>Settings</strong>, on the Access tab, under Join codes, each with a Copy button. You can also
          send a co-chair the two together as one code, the session code, a hyphen and the four digits (ABC123-4821). Typed
          on the join page, that switches straight to Chair and fills the password in.
        </p>

        <H2>4. Get Delegates In on Their Phones</H2>
        <p>
          The first roll call asks one question: <strong>Will delegates join on their phones?</strong> Press Yes and the
          screen shows the session code, the address gavelling.com/join and a QR code. Press <strong>Present on
          screen</strong> to show it full size on the projector. Gavelling remembers your answer for this room on this
          laptop. Press No if delegates will only follow the room screen, and you can change it later.
        </p>
        <p>
          Once debate is running, the session code button in the top bar of the chair page does the same job. One click
          opens the code full screen with its QR code and the join address, sized so it never runs off the screen. Click
          anywhere or press Escape to close it.
        </p>
        <ChairScript>
          &quot;Delegates, take out your phones. Scan the code on the screen, or go to gavelling.com/join and type the
          code. Choose your own delegation, and nobody else&apos;s.&quot;
        </ChairScript>
        <p>
          On their side it is four taps: open <Link href="/join">gavelling.com/join</Link>, type the code, choose Delegate,
          pick their seat. No account, no app to install. Each seat takes one phone, so two delegates cannot both drive
          France. Our guide to <Link href="/blog/gavelling-for-delegates">Gavelling for delegates</Link> covers everything
          they see once they are in.
        </p>

        <TutorialVideo id="Itr-yHCyDto">Everything on the chair&apos;s side that delegates never see, starting with the session code as a QR code.</TutorialVideo>

        <H2>5. Bring In Your Co-Chair</H2>
        <p>
          A co-chair joins from their own laptop at <Link href="/join">gavelling.com/join</Link>. They type the session code,
          choose <strong>Chair</strong>, and the first question is &quot;How will you chair?&quot;. There are two answers:
        </p>
        <ul>
          <li>
            <strong>Moderator</strong> runs the floor: holds the gavel, calls speakers, runs the timers and the motions. One
            Moderator at a time.
          </li>
          <li>
            <strong>Commenter</strong> follows along and writes notes on each speech. Any number of Commenters.
          </li>
        </ul>
        <p>
          Then they pick their name. If you listed them in the builder, their name is already there to tap. If not, they
          press <strong>+ New name</strong> and type it. Last comes the four-digit chair password, and{' '}
          <strong>Open chair panel</strong>.
        </p>
        <p>
          The roles are not fixed. A Commenter can press <strong>Take the gavel</strong> at any time, and the Moderator can
          press <strong>Hand over</strong>. Switching is instant and does not interrupt the session. If someone tries to
          join as Moderator while another chair is moderating live, Gavelling asks first: &quot;Take control of the
          room?&quot;.
        </p>
        <Callout>
          Split the work before the session: one chair moderates, the other writes notes and watches the room. Swap at the
          break. Your notes stay with each speech, so the chair who comes back to moderating loses nothing.
        </Callout>

        <H2>6. Run the First Roll Call</H2>
        <p>
          The roll call fills the screen. Every seat has a three-part picker: <strong>A</strong> for Absent,{' '}
          <strong>P</strong> for Present, <strong>PV</strong> for Present and voting. One press sets the status. Observers
          get A and P only, since they cannot vote.
        </p>
        <p>
          Three buttons save time in a big room. <strong>All Present</strong> marks every seat P. <strong>All
          P+V</strong> marks every seat PV. <strong>Clear All</strong> sets everyone back to absent. The fastest roll call
          is usually All Present, then a few single presses for the delegations that are missing or declare Present and
          voting.
        </p>
        <ChairScript>
          &quot;The chair will now call the roll. Delegates, please state Present or Present and voting when your
          delegation is called.&quot;
        </ChairScript>
        <p>
          Next to the committee name sit the quorum tabs: <strong>Present</strong>, <strong>2/3</strong> and{' '}
          <strong>1/2+1</strong>. They count as you mark, so you always know how many votes a two-thirds or a simple
          majority needs. Observers are counted here; they stop counting at the final vote.
        </p>
        <p>
          When the roll is done, press <strong>Begin Session</strong>. It needs at least one delegation present. Absent
          delegations are taken off the speakers list at that moment, and the room opens on the general speakers list. The
          first time you begin, a short tour points out where everything is. If the rules of your committee are new to
          you, our <Link href="/blog/general-speakers-list-guide">guide to the general speakers list</Link> is the place to
          start.
        </p>

        <TutorialVideo id="H3KBZVen978">This is the fastest way to take roll call: everyone at once or one by one, check quorum, begin.</TutorialVideo>

        <H2>7. Decide Who Can Join, Chat and Change Status</H2>
        <p>
          Open <strong>Settings</strong> and the Access tab. Under &quot;What delegates can do&quot; are three switches,
          each drawn as the control it changes on the delegate&apos;s phone:
        </p>
        <ul>
          <li>
            <strong>Chat.</strong> Delegates can message each other and the dais. Blocking it hides chat for chairs too.
          </li>
          <li>
            <strong>Change own status.</strong> Delegates can switch themselves between Present and Present and voting.
            Turn it off if you want to mark every status yourself.
          </li>
          <li>
            <strong>Join without approval.</strong> On by default: an absent delegate marks themselves present and walks
            in. Turn it off and every phone that joins waits in the Waiting Room until a chair approves it.
          </li>
        </ul>
        <p>
          With approval on, each request reaches the dais with <strong>Approve</strong> and <strong>Deny</strong>. Marking
          that delegation Present in the roll call answers the request too. Approval is per phone and per join, so a
          delegate who leaves and comes back asks again. Use it when the code has spread beyond the room, or at an online
          committee where you cannot see who is holding the phone.
        </p>
        <p>
          The People tab, next to Access, lists every phone holding a seat. If the wrong person took a seat, the Moderator
          can remove them there. That phone cannot take the seat back for ten minutes.
        </p>

        <H2>8. How Long Your Room Is Kept</H2>
        <p>
          A committee room you create on Gavelling is free and it does not need an account, so it is not kept forever.
          Here is how long each state lasts:
        </p>
        <ul>
          <li>
            <strong>A live room</strong> is deleted after 24 hours with no activity at all.
          </li>
          <li>
            <strong>A suspended room</strong> (after a motion to suspend debate) is kept 72 hours if it held any debate, or
            36 hours if it did not. The chair page tells you the exact time.
          </li>
          <li>
            <strong>An ended room</strong> (after End Debate) is kept for 24 hours, and the screen counts down the hours
            left. Inside that window any chair can press <strong>Restart the session</strong> if it was ended by mistake. It
            reopens in roll call, with the speakers list and history kept.
          </li>
        </ul>
        <p>
          Before you close the laptop on the last session, press <strong>Download the record</strong> on the end screen.
          You get one spreadsheet with the history, the scores, every speech, attendance and the documents: everything you
          need to write feedback or choose awards later. Rooms run as part of a conference on Gavelling are never deleted
          automatically.
        </p>
        <p>
          That is the set-up done. From here the session is yours: the speakers list, caucuses, motions, documents and
          voting all run from the same page. If this is your first time on the dais, read{' '}
          <Link href="/blog/how-to-chair-first-mun">how to chair your first MUN</Link> before the day.
        </p>

        <TutorialVideo id="jaYmgylFMVs">The full chair guide, from roll call to the final vote, in one sitting.</TutorialVideo>
      </ArticleLayout>
    </>
  );
}
