import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';

const SLUG = 'gavelling-for-delegates';
const TITLE = 'Gavelling for Delegates: How to Join a Committee from Your Phone';
const DESCRIPTION =
  'Join with the session code, take your seat, ask to speak, chat and submit documents, all from your phone with no account';
const OG = 'Everything a delegate does on Gavelling: join with the code, take your seat, ask to speak, chat and submit papers.';

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
    { '@type': 'ListItem', position: 3, name: 'Gavelling for Delegates', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function GavellingForDelegates() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug={SLUG}
        pitch="Your seat, the speakers list, your papers and the chat, on your phone, with nothing to install."
      >
        <p>
          Your chair has written a six-character code on the board and told the room to take out their phones. This
          guide is everything that happens next: how to join, how to take your seat, what the screen tells you, how to
          get on the speakers list, and how to chat, submit a paper and vote.
        </p>
        <p>
          You do not need an account, an app or a download. Gavelling runs in the phone&apos;s browser, and the only
          thing you need is the code.
        </p>

        <H2>1. Join With the Session Code</H2>
        <ol>
          <li>
            Open <Link href="/join">gavelling.com/join</Link>, or scan the QR code your chair puts on the screen.
          </li>
          <li>Type the six-character session code.</li>
          <li>Choose <strong>Delegate</strong>.</li>
          <li>Pick your delegation from the list of seats.</li>
        </ol>
        <p>
          Open seats are listed first. A seat someone else already holds is marked, with a plain line saying why you
          cannot take it. Choose your own delegation and nobody else&apos;s: every seat takes one phone at a time, so if
          you take France by mistake, the real French delegate is locked out until you leave.
        </p>
        <H3>At a conference</H3>
        <p>
          If your committee is part of a conference on Gavelling and you were given a country, your seat is reserved for
          you. You will be asked to sign in with the account the conference invited, so nobody else can sit in it. Once
          you are signed in, the join page takes you straight to your seat.
        </p>
        <H3>If the chair approves every join</H3>
        <p>
          Some chairs check every phone before it comes in. If yours does, you will see a waiting room: ask to join, and
          the screen says your request is waiting for the chair. When a chair approves it you are in. If you leave and
          join again, you ask again.
        </p>

        <H2>2. Mark Yourself Present</H2>
        <p>
          If you are absent when you join, the top of the screen says so, with two buttons: <strong>Present
          (P)</strong> and <strong>Present &amp; Voting (P+V)</strong>. Present and voting means you will vote For or
          Against on the resolution and cannot abstain. If you are not sure which to choose, our{' '}
          <Link href="/blog/mun-for-beginners">beginner&apos;s guide to MUN</Link> explains the difference.
        </p>
        <p>
          You can change your own status three times in three hours, and the screen shows how many changes you have
          left. Some chairs prefer to manage roll call themselves; then the screen says your chairs manage roll call for
          this committee, and you answer out loud when your delegation is called.
        </p>

        <H2>3. Read the Board</H2>
        <p>
          Once you are in, your phone shows one scrolling board. At the top is your delegation&apos;s flag and name, and
          right under it the line that matters most: where you are on the floor.
        </p>
        <ul>
          <li><strong>You have the floor</strong>: you are speaking now.</li>
          <li><strong>You&apos;re on deck</strong> or <strong>You&apos;re up next</strong>: get ready.</li>
          <li>How many speakers are ahead of you, and about how long until you speak.</li>
          <li><strong>Not on the speakers list</strong>: you are not queued yet.</li>
        </ul>
        <p>
          Below that is the speakers list itself, with the current speaker at the top (press <strong>View all</strong>{' '}
          for the whole list), and a strip with your time spoken, speeches given and messages sent. When the committee
          goes into a caucus, the board shows the caucus name, its topic and its clock, so you always know how long is
          left.
        </p>
        <Callout>
          Put the phone face up on the desk while you listen. Glancing at &quot;2 speakers ahead of you&quot; is quieter
          than leaning over to ask your neighbour whether you have been called.
        </Callout>

        <H2>4. Ask to Speak</H2>
        <p>
          Press <strong>Request to speak</strong> at the bottom of the screen. The chair sees your request on their
          laptop and adds you to the general speakers list with one press. While it waits, the button says it is
          awaiting approval.
        </p>
        <p>
          If the chair has not acted after a minute, you can ask again. If the chair turns the request down, you can ask
          again after fifteen minutes, and the button shows how long is left. While a caucus is running, the speakers
          list is paused and the button waits until the committee is back on it. Placards still matter: in a caucus, and
          whenever the chair asks the room, raise yours as usual.
        </p>
        <p>
          Motions are raised out loud, the traditional way. The chair records yours and it appears on the floor with
          your delegation&apos;s name on it. Our guide to{' '}
          <Link href="/blog/mun-motions-explained">MUN motions</Link> covers which one to raise and when.
        </p>

        <H2>5. Chat With the Dais and Other Delegations</H2>
        <p>
          If your chair has chat switched on, the <strong>Chat</strong> button opens your conversations: Everyone, the
          whole room; Chairs, the dais as one conversation; and every other delegation. You can also make a group, for
          example with the delegations in your bloc. Messages from the conference secretariat appear in Everyone.
        </p>
        <p>
          Chat is for passing notes, not for privacy. A group shows only in its members&apos; chats, but it is not
          encrypted or sealed, so write what you would be comfortable having read aloud. If chat is switched off, the
          button is not there, and notes go on paper.
        </p>

        <H2>6. Submit a Working Paper or Draft Resolution</H2>
        <p>
          When your bloc has a text, press <strong>Submit document</strong>. Choose a working paper or a draft
          resolution, then add:
        </p>
        <ul>
          <li>the title,</li>
          <li>a Google Docs link, if you drafted it there,</li>
          <li>the PDF, if you have one,</li>
          <li>and the sponsoring delegations.</li>
        </ul>
        <p>
          The paper goes to the chair for review and gets its code (WP 1.1, DR 1/1 and so on) automatically. Under{' '}
          <strong>View documents</strong> you can see every paper in the committee and where it stands: on the floor, now
          presenting, pending its vote, passed or failed. Some committees limit how many papers can be submitted; the
          screen tells you when the limit is reached. Our{' '}
          <Link href="/blog/mun-working-paper-guide">working paper guide</Link> covers how to write one the chair will
          accept.
        </p>

        <H2>7. Vote, and Stay Signed In</H2>
        <p>
          In most committees the chair calls the roll for a vote and you answer out loud. If your chair uses device
          voting, a ballot covers your screen when the vote opens. Choose your vote and send it. Nobody sees how anyone
          voted until the chair reveals the result, and each delegation votes once.
        </p>
        <p>
          If your phone sits untouched for an hour, Gavelling asks <strong>Still there?</strong> and gives you two
          minutes to press <strong>I&apos;m here</strong> before it signs you out of the seat. It never does this while
          you have the floor or are waiting in a queue. If you are signed out, join again with the same code.
        </p>
        <p>
          A few things you will never see: your score, your ratings and the chairs&apos; notes. Those stay with the
          dais. What you do see is your own speaking history, with tips for what to try next.
        </p>
        <p>
          That is the whole of it. For the debate itself, read our{' '}
          <Link href="/blog/mun-delegate-tips">MUN delegate tips</Link>. And if you are the one running the room next
          time, <Link href="/blog/how-to-set-up-a-committee-on-gavelling">set up a committee on Gavelling</Link> in a
          minute, free, from <Link href="/sessions">gavelling.com/sessions</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
