import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard } from '@/components/blog/prose';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';

export const revalidate = 3600; // scheduled videos appear in the server HTML and JSON-LD within an hour of release

const TITLE = 'How to Co-Chair a MUN Committee on Gavelling';
const DESCRIPTION =
  'One chair holds the gavel, the other takes private notes and ratings on every speech, and the gavel changes hands in one press';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/how-to-co-chair-on-gavelling',
  ogDescription: 'Moderator and Commenter: how two or more chairs share one Model UN committee on Gavelling.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: 'Moderator and Commenter: how two or more chairs share one Model UN committee on Gavelling.',
  url: 'https://gavelling.com/blog/how-to-co-chair-on-gavelling',
  datePublished: '2026-10-23',
  dateModified: '2026-10-23',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/how-to-co-chair-on-gavelling' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Co-Chair on Gavelling', item: 'https://gavelling.com/blog/how-to-co-chair-on-gavelling' },
  ],
};

export default function CoChairOnGavelling() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['aFiXg0WtvH8', 'Itr-yHCyDto']} />
      <ArticleLayout
        slug="how-to-co-chair-on-gavelling"
        pitch="Two chairs, one room: one runs the floor, the other writes a note on every speech, and the gavel moves in one press."
      >
        <p>
          Most Model UN committees have more than one chair. One person calls speakers and runs the clocks, and the other watches the room, writes notes and keeps an eye on who deserves an award. On paper that split is easy. In practice it falls apart when both chairs reach for the same laptop. Gavelling gives each chair their own screen and their own job: one chair is the <strong>Moderator</strong>, every other chair is a <strong>Commenter</strong>, and the gavel can change hands at any moment without stopping the session.
        </p>
        <p>
          This guide walks through joining a room as a second chair, what each role sees, how the comment dock works, and how to hand the gavel over cleanly. If you are new to the dais itself, start with <Link href="/blog/how-to-chair-first-mun">how to chair your first MUN</Link> and come back.
        </p>

        <H2>Moderator and Commenter: Two Roles, One Room</H2>
        <p>
          Every chair joins the same committee with the same two codes: the 6-character session code and the 4-digit chair password. Once inside, each chair holds one of two roles.
        </p>
        <FactCard title="Moderator">
          Runs the floor. Holds the gavel, calls speakers, runs the timers, accepts motions and introduces documents. There is exactly one Moderator at a time.
        </FactCard>
        <FactCard title="Commenter">
          Follows along and writes a note on each speech, with ratings if your committee switches them on. There can be any number of Commenters.
        </FactCard>
        <p>
          A role is a way of dividing the work, not a lock. Every chair who has the chair password is trusted with the room, which is why you keep that password on the dais and share only the session code with delegates. The split keeps two chairs from pressing Next at the same time. It is not there to keep anyone out.
        </p>

        <H2>1. Join the Room as a Second Chair</H2>
        <p>
          The chair who created the committee at <Link href="/create">gavelling.com/create</Link> already has both codes. The chair password is also in the room&apos;s Settings, under Access, if you need to read it out to your co-chair.
        </p>
        <ol>
          <li>Open <Link href="/join">gavelling.com/join</Link> on your own laptop or tablet and enter the session code.</li>
          <li>Choose <strong>Chair</strong>.</li>
          <li>Answer the first question, <strong>How will you chair?</strong>, by picking <strong>Moderator</strong> or <strong>Commenter</strong>. If nobody is moderating yet, you start with the gavel either way.</li>
          <li>Pick your name from the list, or add a new one, and type the chair password. You can also type the code as <em>ABC123-4821</em> and the chair password fills itself in.</li>
          <li>Press <strong>Open chair panel</strong>.</li>
        </ol>
        <p>
          If you pick Moderator while another chair is moderating with the room open, Gavelling asks first: <strong>Take control of the room?</strong> Press <strong>Take control</strong> only if you have agreed it with them. Otherwise press <strong>Cancel</strong> and join as a Commenter.
        </p>
        <Callout>
          Use a name the room will recognise, such as your first name. A chair&apos;s name can never be the same as a delegation&apos;s name, so &quot;France&quot; is refused even if you are chairing for the French delegation&apos;s school.
        </Callout>
        <p>
          At a conference, chairs assigned to the committee from their account join without the chair password, and the same Moderator or Commenter question is asked first.
        </p>

        <H2>2. What the Moderator Does</H2>
        <p>
          The Moderator&apos;s screen is the full chair console: roll call, the speakers list, caucuses, motions, documents and voting. Every press is shared with the room at once, so delegates see the new speaker on their phones as soon as the Moderator presses Next. Only the Moderator&apos;s device plays the gavel knock when a speaker&apos;s time is nearly up.
        </p>
        <p>
          The Moderator does not get a comment dock. The idea is simple: the person running the floor should be looking at the room, not writing. If you chair alone and still want notes on every speech, you can open a second device as a Commenter under a different name and keep it beside you.
        </p>

        <H2>3. What the Commenter Sees</H2>
        <p>
          A Commenter&apos;s screen has the same top bar and the same live committee, with two changes. The floor sits in one row at the top: the delegation speaking now, big on one side, and the queue beside it as a row of flags in speaking order. Under it, filling most of the screen, is the comment dock.
        </p>
        <TutorialVideo id="aFiXg0WtvH8">A co-chair joining as a Commenter, writing notes on each speech and taking the gavel when it is their turn.</TutorialVideo>
        <H3>A note on every speech</H3>
        <p>
          Each speech gets its own card in the dock, grouped by the part of the debate it belongs to: the General Speakers&apos; List, a moderated caucus, a Tour de Table. The card follows the speaker: when a delegation takes the floor, its card opens and a <strong>Private note</strong> field is ready. Type while they speak. When they finish, the note is filed on that speech with its length and topic.
        </p>
        <p>
          The dock never moves you off a note you are still writing. If the next speaker starts while you are mid-sentence, it waits until you stop typing before it moves on. If your connection drops, your note is kept on your device and sent when you are back online.
        </p>
        <H3>Notes on deck</H3>
        <p>
          When nobody holds the floor yet, the dock opens a card for the delegation that is next. You can start writing before they stand up, which is handy for &quot;expect them to push the funding clause again&quot;. The note moves onto their speech when they give it.
        </p>
        <H3>Ratings, if you switch them on</H3>
        <p>
          In <strong>Settings</strong>, under <strong>Points</strong>, the Moderator can turn on <strong>Rate speeches</strong>. Each card in the dock then shows a slider for every quality factor: Diplomacy, Public Speaking, Collaboration and Content &amp; Research by default, out of 10 unless your committee changes the scale. Ratings feed the scoreboard. If ratings are off, Commenters write notes only. The <Link href="/blog/mun-judging-rubric">MUN judging rubric</Link> is a good starting point for agreeing what each factor means before day one.
        </p>
        <H3>Right of reply notes</H3>
        <p>
          A right of reply gets its own card, separate from the speech that caused it, so you can note whether the reply was justified and how it was handled. See the <Link href="/blog/mun-right-of-reply">right of reply guide</Link> for when one should be granted at all.
        </p>
        <p>
          Every Commenter sees the other chairs&apos; notes on the same speech, read only. You edit only your own. Delegates never see any of it: notes and ratings stay with the chairs.
        </p>

        <H2>4. Notes on Papers and Points by Hand</H2>
        <H3>Sponsor notes</H3>
        <p>
          When a working paper or draft resolution is introduced, a Commenter can open it in Documents and press <strong>Take notes</strong>. The paper opens with one note field per sponsor, under <strong>Notes on the Sponsors</strong>, so you can record who actually presented, who answered questions and who sat silent. As in the dock, you edit only your own notes, and the other chairs see them.
        </p>
        <H3>Adjusting points</H3>
        <p>
          Any chair, Moderator or Commenter, can open the <strong>Scoreboard</strong>, click a delegation and use <strong>Adjust points</strong> at the foot of its profile. Press plus or minus, add a reason if you want one, and press <strong>Apply</strong>. The change is logged with your name, so the dais always knows who gave the bonus and why. This works until the session ends.
        </p>
        <H3>&quot;Only the Moderator can do this&quot;</H3>
        <p>
          Everything that runs the floor belongs to the Moderator: starting a speaker, accepting a motion, changing Settings. If a Commenter presses one of those controls, a small card says that only the Moderator can do this, names who holds the gavel and tells you how to take it. Reading the room never triggers it. Scrolling the queue or tapping a flag is fine.
        </p>

        <H2>5. Take and Hand Over the Gavel</H2>
        <p>
          The gavel sits in the top bar. Click it to open <strong>Who&apos;s moderating</strong>: every chair in the room, with the current Moderator marked and a dot showing who is online.
        </p>
        <ul>
          <li><strong>Take the gavel.</strong> A Commenter presses <strong>Take the gavel</strong> next to their own name and becomes the Moderator at once. The previous Moderator becomes a Commenter.</li>
          <li><strong>Hand over.</strong> The Moderator presses <strong>Hand over</strong> next to another chair&apos;s name. That chair becomes the Moderator.</li>
        </ul>
        <p>
          Switching is instant and does not interrupt the session: the speaker keeps speaking, the caucus keeps running and the speakers list stays exactly as it was. Anyone can switch back. Every chair&apos;s screen shows a short card when the gavel changes hands, such as <em>Aida has the gavel</em>, so nobody is surprised.
        </p>
        <Callout>
          Agree out loud before you switch. A handover at the end of a speech, between Next presses, is the cleanest. A handover in the middle of a vote works, but the voting screen moves with it and the new Moderator has to open it.
        </Callout>
        <H3>One device holds the gavel</H3>
        <p>
          The gavel belongs to one device, not just one name. If you open the room on a second laptop under the same name, the newest device takes the gavel and the older one becomes a Commenter, with a banner saying <em>The gavel is open on another device</em>. Press <strong>Use this device</strong> on whichever one you want to run the floor from. Gavelling never takes the gavel back on its own, so a laptop waking from sleep will not steal it from the one you are using.
        </p>
        <p>
          If you are signed in, your account chairs from one device at a time. Opening the room elsewhere shows the older device a screen with <strong>Use this device instead</strong> or <strong>Leave</strong>.
        </p>

        <H2>6. Talk to Each Other Without the Room Hearing</H2>
        <p>
          Co-chairs need to talk: &quot;cut the caucus short&quot;, &quot;Brazil has spoken four times&quot;, &quot;should we entertain that point?&quot;. Leaning over to whisper works until the committee notices. Open <strong>Chat</strong> from the top bar instead.
        </p>
        <p>
          Chairs see every other chair as their own conversation, and every delegation too. Delegates see the dais only as a single conversation called <strong>Chairs</strong>, so they can never message one chair behind the other&apos;s back. You can also start a group with the <strong>New group</strong> button, for example the dais plus a rapporteur. Groups show only in their members&apos; chats, but they are not encrypted, so keep anything sensitive off them.
        </p>
        <TutorialVideo id="Itr-yHCyDto">The parts of the chair screen delegates never see, from the session code as a QR to messages and group chats.</TutorialVideo>
        <p>
          If the Moderator turns chat off for delegates in Settings, the chair chat goes with it in a standalone room, so agree a back-channel before you switch it off.
        </p>

        <H2>7. Settings, People and Who Is in the Room</H2>
        <p>
          Settings are shared. The Moderator changes them, and every other chair sees the change at once with a short <em>Settings updated by another chair</em> note. Commenters can open Settings and read every tab, marked view only, which is useful for checking the voting rules without asking.
        </p>
        <p>
          The <strong>People</strong> tab shows <strong>People in the room</strong>: the dais, with who is moderating and which chairs are active now, and every delegation with whether a device holds its seat. If a phone is in the wrong seat, the Moderator presses <strong>Remove</strong> next to that delegation and confirms with <strong>Remove from seat</strong>. That device leaves the room and cannot take the seat again for 10 minutes. Its roll call status does not change.
        </p>
        <p className="gv-note">
          Removing a seat is a courtesy tool, not a lock: anyone with the session code can still join an open seat. Use it to fix honest mix-ups, and handle anything worse in the room.
        </p>

        <H2>A Simple Split for Your First Committee</H2>
        <p>
          Before the first session, agree three things with your co-chair. Who opens as Moderator. When you swap, for example every session or every topic. And what each rating factor means, so two Commenters rating the same speech mean the same thing by a 7.
        </p>
        <ul className="gv-check">
          <li>Both chairs have the session code and the chair password</li>
          <li>Each chair has their own device and their own name</li>
          <li>Rate speeches is on or off, decided before roll call</li>
          <li>The handover moment is agreed, and said out loud when it happens</li>
          <li>Chair chat is the back-channel, not whispering</li>
        </ul>
        <p>
          Your notes and ratings end up on the scoreboard and in the session record, which is where awards get decided. The <Link href="/blog/choosing-awards-with-gavelling">guide to choosing awards with the scoreboard</Link> picks up from there. And if you are still working towards your first chair position, read <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
