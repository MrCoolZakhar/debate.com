import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';
import Faq, { type FaqItem } from '@/components/blog/Faq';

const SLUG = 'how-to-write-mun-press-release';
const TITLE = 'How to Write a MUN Press Release: Structure, Examples and Mistakes';
const DESCRIPTION =
  'The headline, the lead, the quote and the length of a Model UN press release, with worked examples and the mistakes that cost press delegates marks';
const OG = 'How to write a Model UN press release that a committee actually reads, with examples.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: `/blog/${SLUG}`,
  ogDescription: OG,
  type: 'article',
});

const FAQ: FaqItem[] = [
  {
    question: 'How long should a MUN press release be?',
    answer:
      'As short as the news allows. A release sent into committee rooms during session should be read in under thirty seconds, which means one to four sentences, roughly 60 to 100 words. A full article for the conference newspaper can run 300 to 500 words, but that is a different form.',
  },
  {
    question: 'What is the difference between a press release and a news article in MUN?',
    answer:
      'A news article is written for readers who chose to read it, later, in full. A press release lands in the middle of a working committee and competes with debate for attention. It carries one piece of news, leads with it, and stops.',
  },
  {
    question: 'Can a MUN press release be biased?',
    answer:
      'If your conference assigns you a real outlet with an editorial line, your selection and framing can follow that line. The facts cannot. A vote count, a quote or a result must be exactly what happened, whatever outlet you write for.',
  },
  {
    question: 'Should a MUN press release include a quote?',
    answer:
      'One short quote, when it adds something the reporter could not say, is the strongest thing a release can carry. A release built from three quotes and no news is a transcript, not a release.',
  },
];

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
    { '@type': 'ListItem', position: 3, name: 'How to Write a MUN Press Release', item: `https://gavelling.com/blog/${SLUG}` },
  ],
};

export default function HowToWriteMunPressRelease() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug={SLUG}
        pitch="On Gavelling, a press release goes straight into the committee rooms you pick, in 600 characters with an optional photo."
      >
        <p>
          A press release at a Model UN conference has one job: tell a room full of busy people something they did not know, fast enough that they keep working afterwards. Most press delegates write their first one like a school essay, with a title, an introduction and a conclusion, and watch it get ignored. This guide covers the structure that works, how to write the headline and the lead, when to use a quote, how long a release should be, and the mistakes that cost press delegates marks.
        </p>
        <p>
          If you are new to the press corps itself, read <Link href="/blog/mun-press-corps-guide">how a MUN press committee works</Link> first. This guide assumes you know which committees you are covering and are sitting down to write.
        </p>

        <H2>What a MUN Press Release Is For</H2>
        <p>
          Conferences use the word for two different things, and the first step is knowing which one yours means.
        </p>
        <FactCard title="The bulletin">
          A short release sent into committee rooms while they are in session: a vote result, a walkout, a bloc forming, a crisis update. It is read on a screen or read aloud by a chair in a few seconds, and it is meant to change what the room does next.
        </FactCard>
        <FactCard title="The article">
          A longer piece for the conference newspaper, website or end-of-day roundup. It is read later, by people who chose to read it, and it can carry background, several quotes and analysis.
        </FactCard>
        <p>
          This guide is mostly about the bulletin, because it is the harder form and the one that reaches delegates while the debate is still live. The article follows the same rules with more room. The <Link href="/blog/mun-journalist-guide">MUN journalist&apos;s guide</Link> covers the reporting that feeds both.
        </p>

        <H2>The Structure: One Story, Top First</H2>
        <p>
          Every good release follows the inverted pyramid. The most important fact goes first, the context second, the colour last. A reader who stops after one sentence should still know the news.
        </p>
        <ol>
          <li><strong>Headline.</strong> The news in under ten words, with a verb.</li>
          <li><strong>Lead.</strong> One sentence: who did what, in which committee, and why it matters.</li>
          <li><strong>Detail.</strong> The number, the vote, the clause, the name. One or two sentences.</li>
          <li><strong>Quote.</strong> Optional. One line from a delegate that the reporter could not have written.</li>
          <li><strong>What next.</strong> Optional. When the vote is, what happens after the break.</li>
        </ol>
        <p>
          If you cannot say what your one story is, you are not ready to write. &quot;What happened in the Human Rights Council this morning&quot; is not a story. &quot;The African Group withdrew its sponsorship of the draft&quot; is.
        </p>

        <H2>Writing the Headline</H2>
        <p>
          Headlines in a committee room are read in a glance, often over someone&apos;s shoulder. Write them like a wire service, not a magazine.
        </p>
        <ul className="gv-check">
          <li>Use an active verb: &quot;Security Council rejects ceasefire draft&quot;, not &quot;Ceasefire draft rejection&quot;</li>
          <li>Name the committee or the delegation, so the reader knows if it concerns them</li>
          <li>Put the number in if there is one: &quot;passes 31 to 9&quot; is news, &quot;passes&quot; is half of it</li>
          <li>Keep it under ten words. If it needs a comma, it is probably two headlines</li>
          <li>No questions and no puns. A pun in a crisis committee will be read as mockery</li>
        </ul>
        <TableWrap>
          <table>
            <thead><tr><th>Weak headline</th><th>Better headline</th></tr></thead>
            <tbody>
              <tr><td>Update from DISEC</td><td>DISEC drops nuclear clause after two-hour caucus</td></tr>
              <tr><td>Drama in the Security Council!</td><td>Russia vetoes humanitarian corridor draft</td></tr>
              <tr><td>Is the WHO deal falling apart?</td><td>Five sponsors leave WHO outbreak draft</td></tr>
              <tr><td>An interview with France</td><td>France: &quot;We will not vote for a fund nobody audits&quot;</td></tr>
            </tbody>
          </table>
        </TableWrap>

        <H2>Writing the Lead</H2>
        <p>
          The lead is the first sentence after the headline, and in a short release it may be the only sentence anyone reads. It answers who, what, where and why it matters, in that order of importance.
        </p>
        <p className="gv-note">
          Example lead: &quot;The Economic and Social Council voted 28 to 14 this afternoon to remove binding emissions targets from its draft resolution, after a bloc of oil-producing states threatened to vote against the whole text.&quot;
        </p>
        <p>
          Notice what that sentence does. It names the committee, gives the result with the count, says what changed in the text, and explains why, all without an adjective. Compare a typical first attempt: &quot;Today in ECOSOC, delegates engaged in heated and passionate debate about the important issue of climate change.&quot; Every word of that is true of every committee on every day of every conference, which is why nobody reads it.
        </p>
        <Callout>
          Test your lead by deleting everything after it. If the release still tells a delegate in another room something useful, the lead works.
        </Callout>

        <H2>Using Quotes Well</H2>
        <p>
          A quote is the one thing a release can carry that the reporter could not have written alone, so use it for that and nothing else.
        </p>
        <H3>What makes a quote worth using</H3>
        <ul>
          <li><strong>It says something the vote does not.</strong> A reason, a threat, a concession, an accusation.</li>
          <li><strong>It is short.</strong> One sentence, ideally under twenty words. Cut the rest.</li>
          <li><strong>It is exact.</strong> Word for word what was said. If you only have the gist, paraphrase without quotation marks.</li>
          <li><strong>It is attributed to the delegation.</strong> &quot;the delegate of Brazil said&quot;, not the student&apos;s real name, unless your conference tells you otherwise.</li>
        </ul>
        <H3>What to leave out</H3>
        <p>
          &quot;We are very happy with the outcome&quot; is not a quote, it is a noise. So is anything you prompted word for word (&quot;Would you say this was a betrayal?&quot; &quot;Yes&quot;). And never quote a delegate from a private conversation they did not know was on the record. Our <Link href="/blog/mun-journalist-guide">journalist&apos;s guide</Link> covers how to agree what is on the record before you start.
        </p>

        <H2>How Long a MUN Press Release Should Be</H2>
        <p>
          Shorter than you think. A bulletin that arrives during session is competing with a speaker at the podium. If it takes more than thirty seconds to read, it will be read later or not at all.
        </p>
        <TableWrap>
          <table>
            <thead><tr><th>Form</th><th>Length</th><th>When</th></tr></thead>
            <tbody>
              <tr><td>Flash</td><td>One sentence</td><td>A result or event the room needs now</td></tr>
              <tr><td>Bulletin</td><td>Two to four sentences, 60 to 100 words</td><td>During session, into committee rooms</td></tr>
              <tr><td>News article</td><td>300 to 500 words</td><td>Newspaper, website, end of day</td></tr>
              <tr><td>Feature or interview</td><td>500 to 800 words</td><td>Overnight edition or final archive</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>
          Some platforms set the limit for you. On Gavelling, a press release is at most 600 characters, which is about 90 to 100 words, and can carry one photo. That limit is deliberate: it is the length of a bulletin, and it forces the one-story discipline this guide is about. If your story does not fit in 600 characters, you have two stories, or one story and a lot of padding.
        </p>

        <H2>Three Worked Examples</H2>
        <H3>A vote result</H3>
        <p className="gv-note">
          &quot;GA1 passes disarmament verification draft, 52 to 31. The First Committee adopted Draft Resolution 1/2 after sponsors accepted a Chinese amendment removing on-site inspections. &apos;Verification without inspection is a press release, not a treaty,&apos; the delegate of Norway said after voting against. The committee moves to its second topic after lunch.&quot;
        </p>
        <p>Headline with the count, lead with the reason it passed, one quote with a real point of view, what next. About 60 words.</p>
        <H3>A bloc moving</H3>
        <p className="gv-note">
          &quot;Gulf states leave ECOSOC energy bloc. Saudi Arabia, the UAE and Qatar withdrew as sponsors of the Western energy draft during the morning caucus, citing the new export clause. The draft now has six sponsors, two short of the eight needed to introduce it.&quot;
        </p>
        <p>No quote needed: the numbers carry it, and the last sentence tells every reader why it matters.</p>
        <H3>A crisis update</H3>
        <p className="gv-note">
          &quot;Port of Kalden closed after cabinet split. The Defence Minister ordered the port shut at 11:40 without the Prime Minister&apos;s signature, according to a directive seen by this outlet. Shipping firms have suspended sailings until further notice.&quot;
        </p>
        <p>
          In a crisis committee, a release can become part of the story. Agree with the crisis team what you are allowed to publish before you publish it. The <Link href="/blog/mun-crisis-committee-guide">crisis committee guide</Link> explains how press fits into the backroom.
        </p>

        <H2>The Mistakes That Cost Press Delegates Marks</H2>
        <ul>
          <li><strong>A wrong number.</strong> A vote count off by one is the most common and most costly error. Write the count down the moment the chair announces it, and check it against the chair if you were not in the room.</li>
          <li><strong>Burying the news.</strong> If the result is in the third sentence, the release failed. Move it to the top.</li>
          <li><strong>Covering everything.</strong> Eight committees in one release is a list, not news. One room, one story.</li>
          <li><strong>Opinion dressed as fact.</strong> &quot;The disastrous amendment&quot; is a judgement. If your outlet has a line, put it in the selection and the framing, never in the facts.</li>
          <li><strong>Mocking a delegate.</strong> Satire of a position is fair. Mocking the student holding it is not, and any press chair should refuse to publish it.</li>
          <li><strong>Sending too many.</strong> A room that gets ten releases an hour stops reading them. Send fewer and make each one count.</li>
          <li><strong>Wrong procedure words.</strong> &quot;The motion to vote failed&quot; means nothing. Learn the difference between a motion, an amendment and a resolution in <Link href="/blog/mun-motions-explained">MUN motions explained</Link>.</li>
        </ul>

        <H2>How Press Releases Work on Gavelling</H2>
        <p>
          At a conference that runs its committees on Gavelling, the press is its own committee: a committee of type press whose seats are outlets rather than countries. During the conference days, the press seat holders, the press chairs and accepted press observers get the Press Desk at <em>gavelling.com/conferences/&lt;conference&gt;/press</em>. It shows every open committee room, who is speaking and who is next, and the papers each room has introduced, so you can find the story without walking every corridor.
        </p>
        <p>
          From the Press Desk, a press seat or a press chair writes a release of up to 600 characters, adds a photo if it helps, and picks which committee rooms it goes to. Every room is selected by default; leave out the ones the story does not concern. Each person can send at most three releases in any 24 hours, which is a useful editorial limit in itself: spend them on the stories that matter.
        </p>
        <p>
          If the press chair&apos;s approval setting is on, which it is by default, a press delegate&apos;s release waits for a press chair to approve it before it goes out. A press chair can turn approval off on the Press Desk. Once sent, the release appears in each chosen room&apos;s Everyone chat labelled <strong>Press · &lt;outlet&gt;</strong> and as a notification on the screens in that room. It is never a card on the chair&apos;s screen, so it does not interrupt the floor. Your Press Desk keeps a history of the releases you have sent, which is the start of your portfolio.
        </p>
        <Callout>
          Write the release before you open the composer. Count it against 600 characters in your head: if it is longer than a text message you would send a friend, cut it.
        </Callout>

        <H2>A Checklist Before You Send</H2>
        <ul className="gv-check">
          <li>One story, and you can say it in one sentence</li>
          <li>The headline has a verb and names the committee</li>
          <li>The news is in the first sentence after the headline</li>
          <li>Every number and name checked</li>
          <li>The quote is exact, short and adds something</li>
          <li>No adjective you would struggle to defend to the delegation</li>
          <li>Sent only to the rooms the story concerns</li>
        </ul>

        <H2>Frequently Asked Questions</H2>
        <Faq items={FAQ} />

        <p>
          When you have a few releases behind you, read <Link href="/blog/mun-press-delegate-awards">how press delegates are judged</Link> to see how they add up to an award, and <Link href="/blog/mun-press-conference-guide">how MUN press conferences work</Link> for the other place your quotes come from. If you want to see what a committee looks like from the inside first, open a free room at <Link href="/sessions">gavelling.com/sessions</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
