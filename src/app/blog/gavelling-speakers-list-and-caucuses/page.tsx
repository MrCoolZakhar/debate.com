import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard } from '@/components/blog/prose';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';

export const revalidate = 3600; // scheduled videos appear in the server HTML and JSON-LD within an hour of release

const SLUG = 'gavelling-speakers-list-and-caucuses';
const TITLE = 'How to Run the Speakers List and Caucuses on Gavelling';
const DESCRIPTION =
  'The speakers list in one tap, yields and right of reply, moderated and unmoderated caucuses, Consultation of the Whole and Tour de Table';
const OG = 'Run the speakers list, yields, right of reply and every kind of caucus from one screen on Gavelling.';

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
    { '@type': 'ListItem', position: 3, name: 'Speakers List and Caucuses on Gavelling', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function SpeakersListAndCaucusesOnGavelling() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['uHzB4DfkfrA', '-_DeJkfr43I', 'Sw4KzPPyYxE', '9hvQhvp5rzA']} />
      <ArticleLayout
        slug={SLUG}
        pitch="The speakers list, every caucus and every clock on one screen, with the queue on every delegate's phone."
      >
        <p>
          Most of a Model UN session is people speaking in turn. The chair keeps a list, times each speech, takes the
          floor back at the end and calls the next name, and every so often the committee votes to switch into a caucus
          and the whole routine changes shape. On paper that is three lists, two stopwatches and a lot of crossing out.
        </p>
        <p>
          On Gavelling it is one screen. This guide walks through the general speakers list, yields, right of reply and
          extra time, then each kind of caucus: moderated, unmoderated, Consultation of the Whole and Tour de Table. It
          assumes your room is already set up; if not, start with{' '}
          <Link href="/blog/how-to-set-up-a-committee-on-gavelling">how to set up a committee on Gavelling</Link>.
        </p>

        <H2>1. Build the General Speakers List</H2>
        <p>
          When you press Begin Session after roll call, the room opens on the general speakers list (GSL). The list
          sits in the sidebar on the left of the chair page, and the floor, with its clock, fills the middle. There are
          three ways to put a delegation on the list:
        </p>
        <ul>
          <li>
            <strong>Type it.</strong> The field under the floor says &quot;Add to speakers list...&quot;. Type the first
            letters of a delegation and press Enter.
          </li>
          <li>
            <strong>Click it.</strong> Every present delegation in the sidebar is one click away from the list.
          </li>
          <li>
            <strong>Approve a request.</strong> Delegates press <strong>Request to speak</strong> on their phones. The
            request reaches the dais as a card, and one press adds them.
          </li>
        </ul>
        <p>
          An absent delegation is never added: Gavelling refuses and shows a short card instead, because attendance is
          changed only through roll call. To reorder the list, drag a row by its grip. The order you leave is the order
          every delegate sees on their phone, along with how many speakers are ahead of them and roughly how long until
          they speak.
        </p>
        <p>
          The speaking time sits beside the clock. Pick one of the presets or type your own number of seconds. Our{' '}
          <Link href="/blog/general-speakers-list-guide">guide to the general speakers list</Link> covers what a sensible
          speaking time is and why the GSL matters.
        </p>

        <H2>2. Run Each Speech in One Tap</H2>
        <p>
          With a list in place, the first delegation is shown on the floor as ready to speak, at the full speaking time.
          Nothing has started yet. Recognise them, then press <strong>Start</strong>.
        </p>
        <ChairScript>&quot;The chair recognises the delegation of Brazil. You have ninety seconds.&quot;</ChairScript>
        <p>Under the floor sit the four speaker buttons. They are always in the same place:</p>
        <ul>
          <li>
            <strong>Start</strong> and <strong>Pause</strong>. The countdown itself is a button too, so a tap on the
            clock pauses and resumes it.
          </li>
          <li>
            <strong>Next</strong> records the speech and calls the next delegation on the list. When nobody else is
            waiting, it becomes <strong>Finish</strong>, which records the speech and leaves the floor empty.
          </li>
          <li>
            <strong>Restart</strong> puts the clock back to the full speaking time, for a false start.
          </li>
          <li>
            <strong>Add time</strong> gives the speaker extra seconds without stopping the clock.
          </li>
        </ul>
        <p>
          Every speech is logged with its length the moment you press Next, so the scoreboard and the session record
          fill themselves in. A few seconds before time runs out, the chair&apos;s laptop plays a double knock of the
          gavel. It is on by default at 15 seconds left, and you can change the moment or switch it off in Settings.
        </p>
        <p>
          If you would rather the clock started by itself, turn on auto start in Settings. Next then calls the next
          speaker with the clock already running, which suits a long list of short speeches.
        </p>

        <TutorialVideo id="uHzB4DfkfrA">Adding delegations, starting the clock and calling the next speaker, one tap at a time.</TutorialVideo>

        <H2>3. Yields, Right of Reply and Extra Time</H2>
        <H3>Yields</H3>
        <p>
          When a speaker finishes early and wants to give their time away, press <strong>Yield</strong>. The panel
          shows how much time is left to yield and offers two choices:
        </p>
        <ul>
          <li>
            <strong>Next speaker.</strong> The next delegation on the list gets their own time plus whatever is left.
          </li>
          <li>
            <strong>Another delegation.</strong> Pick any delegation in the room and they speak for the time left, timed
            in the same panel.
          </li>
        </ul>
        <p>
          A yield can only give away the time the speaker still has, never more. A yield to the chair needs no button at
          all: press Next and the remaining time is simply gone.
        </p>
        <H3>Right of reply</H3>
        <p>
          A <strong>Right to Reply</strong> opens as its own small timer over the floor, with its own clock. It never
          touches the speakers list and never moves the current speaker, so when the reply is over the debate carries on
          exactly where it was. Gavelling records that the reply happened, and nothing else. Our{' '}
          <Link href="/blog/mun-right-of-reply">right of reply guide</Link> explains when a chair should grant one at all.
        </p>
        <H3>Extra time</H3>
        <p>
          <strong>Add time</strong> adds seconds to the speaker on the floor. In a moderated caucus the extra time is
          capped by what is left of the caucus, so a generous chair can never run the caucus over.
        </p>

        <TutorialVideo id="-_DeJkfr43I">Right of reply, yields and extra time, each in a press or two.</TutorialVideo>

        <H2>4. Run a Moderated Caucus</H2>
        <p>
          A caucus starts as a motion. Open <strong>Motions</strong> in the top bar, raise a moderated caucus for the
          proposing delegation, and fill in the topic, the total time and the speaking time per delegate. As you type
          the times, the form tells you how many delegates can speak, and how long the last one gets if the numbers do
          not divide evenly. When the committee votes it through, press <strong>Accept</strong>.
        </p>
        <FactCard title="What fits">
          A 10 minute caucus at 60 seconds a speaker fits 10 delegates. At 45 seconds it fits 14, with the last speaker
          on 15 seconds. Gavelling does that sum for you, so you can tell the room before the first placard goes up.
        </FactCard>
        <p>
          The caucus has its own queue, separate from the GSL. Add speakers with the field under the floor, to the end
          of the queue or straight to the front. When the caucus has no time left for another speaker, the field stops
          accepting names and a card says the queue is full. Speakers run with the same buttons as the GSL.
        </p>
        <p>
          Two clocks run: the speaker&apos;s and the caucus total. The total counts speaking time, so when a speaker&apos;s
          clock reaches zero the total stops with it, and the time between speakers is not lost. The last speaker is
          never given more time than the caucus has left. Press <strong>Extend</strong> if the committee agrees to more
          time, or <strong>End caucus</strong> to close it early.
        </p>
        <Callout>
          The general speakers list is never touched by a caucus. When the caucus ends, the GSL comes back exactly as it
          was. If a GSL speaker was interrupted with time left, they go back to the front of the list and finish the same
          speech with the time they had.
        </Callout>
        <p>
          For the procedure itself, what to say and when, see{' '}
          <Link href="/blog/how-to-run-moderated-caucus">how to run a moderated caucus</Link>.
        </p>

        <TutorialVideo id="Sw4KzPPyYxE">Set the topic and the times, and the speaker count is worked out before the caucus begins.</TutorialVideo>

        <H2>5. Run an Unmoderated Caucus</H2>
        <p>
          An unmoderated caucus is a countdown and nothing else: no queue and no floor. Raise it in Motions with its
          total time and accept it. The clock runs on the chair&apos;s screen and on every delegate&apos;s phone, so
          nobody has to ask how long is left while they are drafting at the back of the room.
        </p>
        <p>
          When the room needs more time, press <strong>Extend</strong> and choose how much. When it is over, the room
          returns to the general speakers list. The{' '}
          <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus guide</Link> covers what delegates should be
          doing in that time and what the chair should be watching.
        </p>

        <H2>6. Consultation of the Whole and Tour de Table</H2>
        <H3>Consultation of the Whole</H3>
        <p>
          A Consultation of the Whole runs like an unmoderated caucus on one countdown, with one difference: the chair
          taps whichever delegation holds the floor. Each delegation is credited with the time it actually held the
          floor, measured on the caucus clock, so the scoreboard still knows who spoke in a debate with no list.
        </p>
        <H3>Tour de Table</H3>
        <p>
          In a Tour de Table every present delegation speaks once, for the same time. When you raise one, choose the
          speaking order:
        </p>
        <ul>
          <li>
            <strong>A to Z</strong>, with the proposer speaking first.
          </li>
          <li>
            <strong>Z to A</strong>.
          </li>
          <li>
            <strong>Room Order</strong>, where the chair calls each speaker by where they sit. The queue holds numbered
            turns instead of names, and every delegation present is credited with one speech when the tour ends.
          </li>
        </ul>
        <p>
          The form shows how many delegations will speak and the approximate total before you accept. After that the
          queue is filled for you, and Next walks round the room. Read our{' '}
          <Link href="/blog/tour-de-table-mun">Tour de Table guide</Link> for when the format earns its time.
        </p>

        <TutorialVideo id="9hvQhvp5rzA">Consultation of the Whole and Tour de Table, with the timer and the speaking order handled for you.</TutorialVideo>

        <H2>7. What Delegates See on Their Phones</H2>
        <p>
          Delegates follow everything above without the chair saying a word about it. Their phone shows who has the
          floor, the queue in order and their own place in it: up next, on deck, or how many speakers are ahead. During
          a caucus it shows the caucus name, its topic and its clock. They can ask to join the speakers list from the
          phone; while a caucus runs, that button waits until the room is back on the GSL.
        </p>
        <p>
          The <Link href="/blog/gavelling-for-delegates">guide for delegates</Link> walks through their side in full,
          and when you are ready for motions, documents and votes, carry on with{' '}
          <Link href="/blog/gavelling-motions-and-voting">how to handle motions and voting on Gavelling</Link>. If you
          have not opened a room yet, you can <Link href="/sessions">start one free</Link> in about a minute.
        </p>
      </ArticleLayout>
    </>
  );
}
