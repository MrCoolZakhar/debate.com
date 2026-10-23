import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import TutorialVideo, { TutorialVideoJsonLd } from '@/components/blog/TutorialVideo';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

// Tutorial videos appear on release (src/lib/tutorialVideos.ts); the hourly
// revalidation brings the server HTML and the VideoObject JSON-LD up to date.
export const revalidate = 3600;

const TITLE = 'SSL in MUN: Secondary and Special Speakers Lists Explained';
const DESCRIPTION =
  'What SSL means in Model UN, how a primary, secondary or special speakers list differs from the GSL, the motions that open, close and reopen a list, and the exact words to use';

const FAQ: FaqItem[] = [
  {
    question: 'What does SSL stand for in MUN?',
    answer:
      'SSL usually stands for Secondary Speakers List: the list for substantive debate on one topic, opened after the committee has used a primary speakers list to set its agenda. Some conferences use SSL for a Special or Specific Speakers List on one sub-topic or one draft resolution. The committee rules of procedure say which.',
  },
  {
    question: 'What is the difference between the GSL and the SSL?',
    answer:
      'At conferences with a two-list system, the primary speakers list debates which topic to take first and the secondary speakers list debates the topic itself. At conferences with one list, the General Speakers List does both jobs and there is no SSL.',
  },
  {
    question: 'How do you open a speakers list in MUN?',
    answer:
      'Raise your placard when the chair asks for motions and say: the delegation of your country moves to open the speakers list with a speaking time of 60 seconds. It needs a second and a simple majority at most conferences, and many chairs open the list without a vote.',
  },
  {
    question: 'What happens when the speakers list runs out?',
    answer:
      'At many conferences an exhausted speakers list closes debate and the committee moves to voting on whatever documents are on the floor. Delegates who are not ready to vote keep adding their names to stop that happening.',
  },
  {
    question: 'Can you close a speakers list?',
    answer:
      'Yes. A motion to close the speakers list stops new names being added; the delegates already on it still speak. It often needs a two-thirds majority, and a motion to reopen it usually needs a simple majority.',
  },
];

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/blog/mun-speakers-list-types',
  keywords: [
    'SSL in MUN',
    'secondary speakers list',
    'special speakers list MUN',
    'primary speakers list',
    'motion to open the speakers list',
    'close the speakers list',
    'speakers list MUN',
  ],
  ogDescription: 'SSL, primary and secondary speakers lists, and the motions that open and close them.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  url: 'https://gavelling.com/blog/mun-speakers-list-types',
  datePublished: '2026-10-19',
  dateModified: '2026-10-19',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-speakers-list-types' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'SSL in MUN', item: 'https://gavelling.com/blog/mun-speakers-list-types' },
  ],
};

export default function MunSpeakersListTypes() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TutorialVideoJsonLd ids={['uHzB4DfkfrA']} />
      <ArticleLayout
        slug="mun-speakers-list-types"
        pitch="Gavelling keeps the speakers list and the caucus queue as two separate lists, so a caucus never costs a delegate their place."
      >
        <p>
          <strong>SSL in MUN</strong> usually means the <strong>Secondary Speakers List</strong>: the list a committee debates its topic on, after a <strong>primary speakers list</strong> has been used to set the agenda. At some conferences SSL means a <strong>Special</strong> or <strong>Specific Speakers List</strong>, opened for one sub-topic or one draft resolution. And at most conferences there is no SSL at all, because a single General Speakers List does every job. This page sorts out which list is which, and the motions that open, close and reopen each one.
        </p>
        <p>
          If your committee uses one list, our <Link href="/blog/general-speakers-list-guide">General Speakers List guide</Link> covers how it runs, speech by speech. This page is about the family of lists around it.
        </p>

        <H2>The lists, side by side</H2>
        <TableWrap>
          <table>
            <thead>
              <tr><th>List</th><th>What it is for</th><th>How it ends</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>General Speakers List (GSL)</strong></td><td>All debate on the topic, at conferences with one list. Caucuses interrupt it; it carries on after them.</td><td>When it runs out of speakers, or by a motion to close debate</td></tr>
              <tr><td><strong>Primary speakers list</strong></td><td>Debating the order of topics only. No yields and no caucuses at many conferences.</td><td>When the agenda is set</td></tr>
              <tr><td><strong>Secondary speakers list (SSL)</strong></td><td>Substantive debate on the topic chosen, with yields and caucuses</td><td>When it runs out, or by a two-thirds motion to close it, and the committee moves to voting</td></tr>
              <tr><td><strong>Special or specific speakers list</strong></td><td>Debate on one sub-topic, document or amendment, at conferences that allow it</td><td>When that item is voted on or the list runs out</td></tr>
              <tr><td><strong>Caucus queue</strong></td><td>Speakers in a moderated caucus. Temporary, and separate from every list above.</td><td>When the caucus ends</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">
          Two-list procedure as described in All-American Model UN&rsquo;s published guides to opening debate and to the secondary speakers list; separate lists per topic and per amendment appear in other published rules, such as Vancouver Model United Nations&rsquo; 2013 rules of procedure. Reviewed October 2026. Your conference&rsquo;s rules decide.
        </p>

        <H2>Primary and secondary: the two-list system</H2>
        <p>
          A committee with two or more topics has to decide which to debate first. In the two-list system it does that on its own list.
        </p>
        <H3>The primary speakers list</H3>
        <p>
          Delegates speak only about the order of the agenda: why Topic A should come before Topic B. Leftover time usually goes back to the chair, with no yields to other delegates, and caucuses are usually out of order. The list ends when a motion to set the agenda passes.
        </p>
        <ChairScript>
          &ldquo;The delegate of Japan moves to set the agenda to Topic A, followed by Topic B.&rdquo;
        </ChairScript>
        <p>
          With two topics, that vote settles the agenda either way: if A first fails, B goes first. A chair should take the motion once the room has heard enough, because accepting it ends the primary list.
        </p>
        <H3>The secondary speakers list</H3>
        <p>
          Once the agenda is set, the committee opens the secondary list and debates the first topic for real. This is the list that behaves like a General Speakers List elsewhere: speaking times, yields, moderated and unmoderated caucuses, <Link href="/blog/mun-working-paper-guide">working papers</Link> and draft resolutions. When it runs out, or a motion to close it passes, the committee votes on the documents on the floor. It then goes back to choose the next topic.
        </p>
        <Callout>
          If your committee has only one topic, or the agenda was set in advance, skip the primary list entirely and move to open the secondary list. Debating the order of one topic is the most common wasted ten minutes in Model UN.
        </Callout>

        <H2>Special and specific speakers lists</H2>
        <p>
          Some conferences let a committee open a speakers list for one narrower thing: a sub-topic that deserves formal speeches rather than a caucus, or one draft resolution or amendment once it has been introduced. It works like a short secondary list with its own speaking time. Its advantage over a moderated caucus is that delegates sign up in advance rather than being picked by placard, which suits a room where the same ten delegates catch the chair&rsquo;s eye every time.
        </p>
        <ChairScript>
          &ldquo;The delegate of Ghana moves to open a special speakers list on draft resolution 1.1, with a speaking time of 45 seconds.&rdquo;
        </ChairScript>
        <p>
          If your rules do not mention a special list, the chair will not entertain the motion; use a moderated caucus on the same subject instead. Our guide to <Link href="/blog/mun-motions-explained">MUN motions</Link> lists the motions most rules do allow.
        </p>

        <H2>The motions that change a speakers list</H2>
        <FactCard title="Open the speakers list">
          &ldquo;The delegation of Brazil moves to open the speakers list with a speaking time of 60 seconds.&rdquo; Usually a simple majority, and many chairs open it without a vote. Name the speaking time in the motion, or the chair will pick one.
        </FactCard>
        <FactCard title="Set or change the speaking time">
          &ldquo;&hellip;moves to set the speaking time to 90 seconds.&rdquo; Simple majority at most conferences. Lengthen it for opening speeches, shorten it once positions are known.
        </FactCard>
        <FactCard title="Change the default yield">
          At conferences with a default yield, a simple majority can change what happens to unused time, for example to comments or to the chair.
        </FactCard>
        <FactCard title="Close the speakers list">
          Stops new names being added; delegates already on it still speak. Often two-thirds. Use it when you want debate to end and a vote to follow, not to cut off one delegate.
        </FactCard>
        <FactCard title="Reopen the speakers list">
          Lets names be added again. Usually a simple majority.
        </FactCard>
        <p>
          The rule that catches committees out: at many conferences, a speakers list that <strong>runs out</strong> closes debate on its own, and the committee moves straight to voting. If your bloc&rsquo;s paper is not ready, keep names on the list.
        </p>

        <H2>Getting a good place on the list</H2>
        <ul>
          <li><strong>Be ready when it opens.</strong> The chair usually takes placards in the order they see them. The first speakers set the frame that later ones respond to.</li>
          <li><strong>Re-add yourself after you speak.</strong> Most rules let a delegation appear on a list once at a time, so a delegate who rejoins at once is never far from the floor.</li>
          <li><strong>Send a note if your conference allows it.</strong> Some chairs add delegates by written request during debate.</li>
          <li><strong>Know what each list is for.</strong> A speech on the agenda order delivered on the secondary list, or a substantive speech on the primary list, is the quickest way to be ruled out of order.</li>
        </ul>
        <p>
          The speech itself is covered in <Link href="/blog/mun-opening-speech">how to write a MUN opening speech</Link>, and what to do with unused time in the GSL guide&rsquo;s section on yields.
        </p>

        <H2>Running the lists as a chair</H2>
        <p>
          Keep the lists physically apart. A caucus queue written on the same sheet as the speakers list is how a delegate loses their place when the caucus ends. In a <Link href="/create/sessions">Gavelling session</Link> the General Speakers List and the moderated caucus queue are two separate lists: accepting a caucus never touches the speakers list, delegates request a place from their phones, and the chair approves it. A delegation marked absent is never added to either. Our <Link href="/blog/mun-timer">MUN timer guide</Link> covers the clocks that go with each list.
        </p>

        <TutorialVideo id="uHzB4DfkfrA">
          Running the General Speakers List on Gavelling takes one tap per speaker.
        </TutorialVideo>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />
      </ArticleLayout>
    </>
  );
}
