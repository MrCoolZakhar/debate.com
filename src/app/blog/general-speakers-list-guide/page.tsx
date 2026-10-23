import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, H3 } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

// Tutorial videos appear on release (src/lib/tutorialVideos.ts); the hourly
// revalidation brings the server HTML and the VideoObject JSON-LD up to date.
export const revalidate = 3600;

const TITLE = 'GSL in MUN: What the General Speakers List Means';
const DESCRIPTION =
  'GSL stands for General Speakers List: the main queue of delegates who speak on the topic in Model UN. How it works, speech length, yields and chair tips.';

const FAQ: FaqItem[] = [
  {
    question: 'What does GSL stand for in MUN?',
    answer:
      'GSL stands for General Speakers List. It is the main queue of delegates waiting to speak on the committee\'s topic, and it stays open for the whole session.',
  },
  {
    question: 'What is a GSL speech?',
    answer:
      'A GSL speech is a delegate\'s turn on the General Speakers List: a formal speech on the topic as a whole, usually 60 to 90 seconds, ending with a yield of any time left.',
  },
  {
    question: 'How long is a GSL speech?',
    answer:
      'The committee sets the speaking time, usually 60 to 90 seconds per delegate. A motion to set or extend speaking time changes it, and the chair enforces it strictly.',
  },
  {
    question: 'Can a delegate be on the GSL twice?',
    answer:
      'In most rules of procedure a delegate can appear on the GSL only once at a time. Once they have spoken, they can usually add their name again.',
  },
  {
    question: 'What happens to the GSL during a caucus?',
    answer:
      'It pauses. A caucus never wipes the GSL: when the caucus ends, the chair reopens the list and the committee carries on from where it stopped.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/general-speakers-list-guide',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/general-speakers-list-guide',
  datePublished: '2026-06-01',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/general-speakers-list-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'General Speakers List Guide', item: 'https://gavelling.com/blog/general-speakers-list-guide' },
  ],
};

export default function Article3() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['uHzB4DfkfrA']} />
      <ArticleLayout
        slug="general-speakers-list-guide"
        pitch="Gavelling manages the GSL automatically (queue, timer, and speaker advancement) so you can focus on the debate."
      >

        <p>
          GSL stands for General Speakers List: the main, ongoing queue of delegates who have asked to speak on the committee&apos;s topic in Model UN. Each delegate speaks in turn for a set time, usually 60 to 90 seconds.
        </p>

        <p>
          The General Speakers List is the backbone of Model UN debate. Whether you are a first-time delegate trying to understand why the chair keeps adding names to a list, or a chair looking to manage it more effectively, this guide covers everything you need to know.
        </p>

        <div className="gv-callout gv-callout-plain">
          <p>The GSL is distinct from caucus speaker lists, which are temporary. The GSL survives every caucus and runs for the whole session.</p>
        </div>

        <H2>1. What Is the General Speakers List?</H2>
        <p>
          The GSL is MUN&apos;s primary debate mechanism, the &quot;floor&quot; of the committee. Once the agenda is set, the chair opens the GSL and delegates who wish to speak on the topic add their names. The list is maintained in order, and delegates speak one at a time when their turn arrives, subject to a per-speaker time limit set by the committee.
        </p>
        <p>
          The critical property of the GSL is its permanence: unlike caucus speaker queues, which are wiped when a caucus ends, the GSL survives throughout the entire session. A delegate who signed up at the beginning of day one might still be on the list at the end of day two. This continuity gives the GSL its role as the committee&apos;s primary formal debate channel.
        </p>

        <PhotoFigure id="youth-parliament-speaker" caption="A delegate takes the floor from his seat." />

        <H2>2. What Is a GSL Speech?</H2>
        <p>
          A GSL speech is a delegate&apos;s turn on the General Speakers List: a short formal speech on the committee&apos;s topic as a whole, usually 60 to 90 seconds. The first one is normally the opening speech, where a delegation states its position. Later GSL speeches answer the debate so far, build support for a working paper or ask for co-sponsors. When the speech ends, the speaker yields any time left (see below).
        </p>
        <p>
          Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> gives the structure for the first one, and the <Link href="/blog/mun-speech-examples">MUN speech examples</Link> show full speeches at 60, 75 and 90 seconds.
        </p>


        <H2>3. How the GSL Works, Step by Step</H2>
        <H3>Opening the list</H3>
        <p>
          After the agenda is set, the chair declares the GSL open and asks delegates who wish to speak to raise their placards. The chair (or co-chair) notes each delegation in the order their placard was raised and adds them to the list. In practice, this happens quickly. Most delegates raise their placards immediately, so the chair moves through the room efficiently.
        </p>
        <H3>Adding to the list</H3>
        <p>
          The list stays open throughout the session. At any point between speakers, delegates may raise their placard to be added. In most rules of procedure, a delegate can appear on the GSL only once at a time; they cannot queue twice.
        </p>
        <p>
          In Gavelling, delegates can request to speak directly from their device. The chair sees the request and approves with one tap, eliminating the placard-watching overhead for the chair and making it easier for delegates in large rooms to register.
        </p>
        <H3>Speaking</H3>
        <p>
          When a delegate&apos;s name reaches the top of the list, the chair recognises them: <em>&quot;The chair recognises the delegation of France.&quot;</em> The speaker&apos;s timer begins. They have the full speaking time (typically 60–90 seconds) to address the committee. The chair enforces the time limit strictly and gives a warning (usually a knock) when a few seconds remain.
        </p>
        <H3>After speaking</H3>
        <p>
          When the delegate finishes, they yield their remaining time (see below) and the chair calls the next speaker. The speaker is removed from the list. Most rules of procedure let them add their name again once they have spoken.
        </p>

        <H2>4. Yielding Remaining Time</H2>
        <p>
          When a delegate finishes speaking before their time expires, they must yield the remaining time. There are three options:
        </p>
        <ul>
          <li>
            <strong>Yield to the chair</strong>: the simplest and most common option. The remaining time is lost; the chair immediately calls the next speaker.
          </li>
          <li>
            <strong>Yield to another delegate</strong>: the named delegation speaks for whatever time remains. This is a useful tactical tool: yielding to an ally gives them floor time without them needing to wait for their position in the queue.
          </li>
          <li>
            <strong>Yield to points/questions</strong>: the floor is briefly opened for points of information from other delegates. The original speaker must answer within the remaining time. Not all rules of procedure allow this, as our <Link href="/blog/mun-procedure-styles-compared">comparison of MUN procedure styles</Link> shows.
          </li>
        </ul>
        <p>
          Chairs should ask &quot;To whom do you yield your remaining time?&quot; as soon as the delegate sits. A fast yield transition is the mark of an experienced committee.
        </p>

        <H2>5. Points During the GSL</H2>
        <p>
          While the GSL is running, delegates may raise procedural Points that interrupt normal order (our guide to <Link href="/blog/mun-points-explained">MUN points explained</Link> covers them all):
        </p>
        <H3>Point of Information</H3>
        <p>
          A question directed at the current speaker. Only raised during the speaker&apos;s time (usually via a yield to questions). The chair decides whether to entertain the point.
        </p>
        <H3>Point of Order</H3>
        <p>
          A challenge to the chair&apos;s procedural ruling or a note that procedure is not being followed correctly. Not a question, but a formal challenge. The chair must address it immediately. Point of Order always takes precedence over the floor. See our <Link href="/blog/mun-points-of-order">points of order guide</Link> for what qualifies.
        </p>
        <H3>Right of Reply</H3>
        <p>
          When a delegate&apos;s nation has been directly and personally attacked in a speech, they may request a Right of Reply. If granted by the chair, they are inserted at the top of the GSL with a shorter time limit (usually 30 seconds) specifically to respond to the attack. Right of Reply cannot be used for general disagreement, only for personal or national insults. Our <Link href="/blog/mun-right-of-reply">right of reply guide</Link> covers it in detail.
        </p>

        <H2>6. How Chairs Should Manage the GSL</H2>
        <p>
          The quality of GSL management directly affects the energy and flow of a committee session. Dead time, the pause between one speaker finishing and the next being called, is the enemy. Here is how experienced chairs minimise it:
        </p>
        <ul>
          <li><strong>Keep the list visible.</strong> Delegates who cannot see their position ask constantly. Display the queue on a screen or use a tool like Gavelling that shows delegates their queue position on their own device.</li>
          <li><strong>Pre-call the next speaker.</strong> While the current speaker is finishing, quietly note who is next and be ready to call them the instant the timer ends.</li>
          <li><strong>Enforce time strictly.</strong> Inconsistent enforcement erodes your authority. Use the gavel at time, every time.</li>
          <li><strong>Add to the list continuously.</strong> During speakers, glance around the room for raised placards and note them without interrupting the speaker.</li>
        </ul>
        <p>
          <strong>Gavelling</strong> automates the hardest parts of GSL management: the timer runs automatically, the queue is visible to all delegates in real time, and speaker advancement is a single button tap. Chairs who use it report significantly shorter inter-speaker gaps and fewer procedural interruptions.
        </p>

        <TutorialVideo id="uHzB4DfkfrA">
          Adding a delegation, starting the clock and moving to the next speaker are each one tap.
        </TutorialVideo>

        <H2>7. GSL vs Caucuses: When to Use Each</H2>
        <p>
          The GSL provides formal, structured debate where every delegate gets equal floor time. Caucuses (moderated or unmoderated) are tools for shifting the committee into a different mode:
        </p>
        <ul>
          <li><strong>GSL</strong>: best for formal position statements, broad debate, or when you want to hear from a wide range of delegations.</li>
          <li><strong><Link href="/blog/how-to-run-moderated-caucus">Moderated Caucus</Link></strong>: best for focused debate on a specific sub-topic with a controlled number of speakers and a clear time limit.</li>
          <li><strong>Unmoderated Caucus</strong>: best for informal negotiation, bloc-building, and working paper drafting.</li>
        </ul>
        <p>
          A healthy committee session alternates between GSL debate and caucuses. Too much GSL without caucuses can feel rigid; too many caucuses without GSL debate lose the formal record.
        </p>
        <p>
          See also: <Link href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</Link> for how caucus motions are proposed and voted on.
        </p>

        <H2>8. Common Chair Mistakes with the GSL</H2>
        <ul>
          <li><strong>Forgetting to re-open the list after a caucus.</strong> The GSL pauses during caucuses. Remember to explicitly announce it is open again when the caucus ends.</li>
          <li><strong>Allowing re-adds during a speaker&apos;s turn.</strong> Only add delegates to the list between speakers to avoid confusion.</li>
          <li><strong>Wiping the GSL when entering a caucus.</strong> The GSL survives all caucuses. Never clear it when accepting a caucus motion.</li>
          <li><strong>Forgetting to call the next speaker promptly.</strong> Every second of dead air drains committee energy.</li>
        </ul>

        <H2>9. Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
