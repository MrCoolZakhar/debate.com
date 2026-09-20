import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3 } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'General Speakers List (GSL) in MUN: Complete Guide for Chairs and Delegates',
  description:
    'What is the General Speakers List in Model UN? How does it work, how do delegates add themselves, how do chairs manage it, and what are the rules? Full guide with tips.',
  path: '/blog/general-speakers-list-guide',
  ogDescription:
    'Everything you need to know about the GSL: how it works, yielding, points, and chair tips.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'General Speakers List (GSL) in MUN: Complete Guide for Chairs and Delegates',
  description: 'What is the General Speakers List in Model UN? How does it work, how do chairs manage it?',
  url: 'https://gavelling.com/blog/general-speakers-list-guide',
  datePublished: '2026-06-01',
  dateModified: '2026-06-01',
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
      <ArticleLayout
        slug="general-speakers-list-guide"
        pitch="Gavelling manages the GSL automatically (queue, timer, and speaker advancement) so you can focus on the debate."
      >

        <p>
          The General Speakers List is the backbone of Model UN debate. Whether you are a first-time delegate trying to understand why the chair keeps adding names to a list, or a chair looking to manage it more effectively, this guide covers everything you need to know.
        </p>

        <div className="gv-callout gv-callout-plain">
          <p>GSL stands for General Speakers List: the primary, ongoing queue of delegates who wish to address the committee. It is distinct from caucus speaker lists, which are temporary.</p>
        </div>

        <H2>1. What Is the General Speakers List?</H2>
        <p>
          The GSL is MUN&apos;s primary debate mechanism, the &quot;floor&quot; of the committee. Once the agenda is set, the chair opens the GSL and delegates who wish to speak on the topic add their names. The list is maintained in order, and delegates speak one at a time when their turn arrives, subject to a per-speaker time limit set by the committee.
        </p>
        <p>
          The critical property of the GSL is its permanence: unlike caucus speaker queues, which are wiped when a caucus ends, the GSL survives throughout the entire session. A delegate who signed up at the beginning of day one might still be on the list at the end of day two. This continuity gives the GSL its role as the committee&apos;s primary formal debate channel.
        </p>

        <H2>2. How the GSL Works, Step by Step</H2>
        <H3>Opening the list</H3>
        <p>
          After the agenda is set, the chair declares the GSL open and asks delegates who wish to speak to raise their placards. The chair (or co-chair) notes each delegation in the order their placard was raised and adds them to the list. In practice, this happens quickly. Most delegates raise immediately, so the chair moves through the room efficiently.
        </p>
        <H3>Adding to the list</H3>
        <p>
          The list stays open throughout the session. At any point between speakers, delegates may raise their placard to be added. In most rules of procedure, a delegate can only appear on the GSL once at a time; they cannot queue twice.
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
          When the delegate finishes, they yield their remaining time (see below) and the chair calls the next speaker. The current speaker is removed from the list and cannot re-add themselves until it is their turn again, though most rules of procedure allow re-adding after speaking.
        </p>

        <H2>3. Yielding Remaining Time</H2>
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
            <strong>Yield to points/questions</strong>: the floor is briefly opened for points of information from other delegates. The original speaker must answer within the remaining time. Not all rules of procedure allow this.
          </li>
        </ul>
        <p>
          Chairs should ask &quot;To whom do you yield your remaining time?&quot; as soon as the delegate sits. A fast yield transition is the mark of an experienced committee.
        </p>

        <H2>4. Points During the GSL</H2>
        <p>
          While the GSL is running, delegates may raise procedural Points that interrupt normal order:
        </p>
        <H3>Point of Information</H3>
        <p>
          A question directed at the current speaker. Only raised during the speaker&apos;s time (usually via a yield to questions). The chair decides whether to entertain the point.
        </p>
        <H3>Point of Order</H3>
        <p>
          A challenge to the chair&apos;s procedural ruling or a note that procedure is not being followed correctly. Not a question, but a formal challenge. The chair must address it immediately. Point of Order always takes precedence over the floor.
        </p>
        <H3>Right of Reply</H3>
        <p>
          When a delegate&apos;s nation has been directly and personally attacked in a speech, they may request a Right of Reply. If granted by the chair, they are inserted at the top of the GSL with a shorter time limit (usually 30 seconds) specifically to respond to the attack. Right of Reply cannot be used for general disagreement, only for personal or national insults.
        </p>

        <H2>5. How Chairs Should Manage the GSL</H2>
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

        <H2>6. GSL vs Caucuses: When to Use Each</H2>
        <p>
          The GSL provides formal, structured debate where every delegate gets equal floor time. Caucuses (moderated or unmoderated) are tools for shifting the committee into a different mode:
        </p>
        <ul>
          <li><strong>GSL</strong>: best for formal position statements, broad debate, or when you want to hear from a wide range of delegations.</li>
          <li><strong>Moderated Caucus</strong>: best for focused debate on a specific sub-topic with a controlled number of speakers and a clear time limit.</li>
          <li><strong>Unmoderated Caucus</strong>: best for informal negotiation, bloc-building, and working paper drafting.</li>
        </ul>
        <p>
          A healthy committee session alternates between GSL debate and caucuses. Too much GSL without caucuses can feel rigid; too many caucuses without GSL debate loses the formal record.
        </p>
        <p>
          See also: <Link href="/blog/mun-motions-explained" style={{ color: '#1B3828', fontWeight: 600 }}>MUN Motions Explained</Link> for how caucus motions are proposed and voted on.
        </p>

        <H2>7. Common Chair Mistakes with the GSL</H2>
        <ul>
          <li><strong>Forgetting to re-open the list after a caucus.</strong> The GSL pauses during caucuses. Remember to explicitly announce it is open again when the caucus ends.</li>
          <li><strong>Allowing re-adds during a speaker&apos;s turn.</strong> Only add delegates to the list between speakers to avoid confusion.</li>
          <li><strong>Wiping the GSL when entering a caucus.</strong> The GSL survives all caucuses. Never clear it when accepting a caucus motion.</li>
          <li><strong>Forgetting to call the next speaker promptly.</strong> Every second of dead air drains committee energy.</li>
        </ul>
      </ArticleLayout>
    </>
  );
}
