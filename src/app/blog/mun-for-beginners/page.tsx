import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Model UN for Beginners: Your First Conference, Hour by Hour',
  description:
    'A walkthrough of your first Model UN conference from the registration desk to the closing ceremony, with the one thing to do in each hour',
  path: '/blog/mun-for-beginners',
  ogDescription: 'Your first Model UN conference, hour by hour, from registration to the closing gavel.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Model UN for Beginners: Your First Conference, Hour by Hour',
  description: 'Your first Model UN conference, hour by hour, from registration to the closing gavel.',
  url: 'https://gavelling.com/blog/mun-for-beginners',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-for-beginners' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Model UN for Beginners', item: 'https://gavelling.com/blog/mun-for-beginners' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-for-beginners"
        pitch="Nervous about the procedure? Run a practice committee with your club this week: free, no accounts, a six character code."
      >
        <p>
          This is what will actually happen to you, in order, at your first conference. Not the rules, which you can look up, but the shape of the two days and the one thing worth doing in each part of them. If the activity itself is new to you, start with <Link href="/blog/what-is-model-un">what Model UN is</Link>. If you have not yet done the preparation, the <Link href="/blog/mun-conference-preparation">pre-conference checklist</Link> is the week-by-week plan; this page picks up the moment you arrive.
        </p>

        <H2>The night before</H2>
        <p>
          Three things, and only three. Everything else can wait.
        </p>
        <ul className="gv-check">
          <li><strong>Write your opening speech and time it out loud.</strong> Sixty to ninety seconds, which is 150 to 220 words. Reading it silently tells you nothing: people speak faster when frightened, and a speech that runs 40 seconds is worse than one that runs 80.</li>
          <li><strong>Write down three positions and three numbers.</strong> Three things your country wants, and three specific facts, instruments or figures you can cite. You will use these all weekend. Our <Link href="/blog/mun-country-research">country research method</Link> shows where to find them.</li>
          <li><strong>Print one page.</strong> Your position paper, or your research sheet. Phones die and venue wifi fails. One printed page has saved more first conferences than any app.</li>
        </ul>
        <p>
          Then sleep. Reading the background guide for a fourth time at midnight has never helped anyone.
        </p>

        <H2>Registration and the first ten minutes</H2>
        <p>
          You arrive, collect a badge and a placard, and find your committee room. Often there is an opening ceremony first: a speech from the Secretary-General, sometimes a keynote, usually longer than it needs to be. It is the only time every delegate is in one room. Unsure what to wear for it? See the <Link href="/blog/mun-dress-code">MUN dress code</Link>.
        </p>
        <p>
          In the committee room, sit where you can see the dais and be seen by it. The back corner is comfortable and invisible, and chairs recognise the delegates they can see. Then do the single highest-value thing available to a beginner: introduce yourself to the four people nearest you before the gavel. Names, countries, whether they have done this before. Those four people are your first bloc, and you will have a much easier weekend having spoken to them before the room formalises.
        </p>

        <Callout>
          Everyone in that room is more nervous than they look, including the ones in suits who seem to know everybody. At most conferences well over half the committee is at one of their first two conferences.
        </Callout>

        <H2>Roll call</H2>
        <p>
          The chair reads the country list in alphabetical order. When your country is called, raise your placard and say one word.
        </p>
        <ChairScript>
          &quot;The chair will now take roll. Delegates, please respond with present, or present and voting. Afghanistan. Albania. Algeria.&quot;
        </ChairScript>
        <p>
          <strong>Present</strong> means you are here and may abstain on substantive votes. <strong>Present and voting</strong> means you are here and give up the right to abstain: you must vote yes or no on every draft resolution.
        </p>
        <p>
          Say <strong>present</strong>. Present and voting is a commitment used by delegations that want to signal they will take a side on everything, and there is no advantage in it for a first conference. Some delegates believe it impresses the dais. It does not.
        </p>

        <H2>Setting the agenda</H2>
        <p>
          If your committee has two topics, the first vote of the weekend decides which is debated first. A delegate moves to set the agenda to topic A, someone else moves for topic B, the chair takes speakers for and against, and the committee votes.
        </p>
        <p>
          This looks like a formality and it is not. If you prepared one topic thoroughly and the room chooses the other, your weekend just became much harder. So speak. The speech is fifteen to thirty seconds and is the easiest one you will give all conference, because it is about ordering, not substance.
        </p>
        <FactCard title="Agenda speech, roughly thirty seconds">
          Honourable chair, fellow delegates. Kenya moves to begin with topic A. Two reasons. First, topic B depends on the framework that topic A would create, so debating B first means writing a solution we cannot implement. Second, this body has the most recent mandate on A, and the Assembly expects a product from us on it this session. Kenya urges the committee to vote in favour. Thank you.
        </FactCard>
        <p>
          That also gets your voice into the room in the first twenty minutes, which is worth more than the vote.
        </p>

        <H2>Your first speech</H2>
        <p>
          The chair opens the general speakers list. Raise your placard when asked who wishes to be added, and get on it early: the queue at a 40 person committee can take an hour and a half to come round, and the speeches given in the first hour shape what everyone else talks about.
        </p>
        <p>
          Then you will be called, and you will stand or sit and speak for 60 to 90 seconds. Use your prepared speech. The structure that works is simple: what the problem is in one sentence, what your country thinks in two, what your country proposes in two, and an invitation to work with you.
        </p>
        <p>
          Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> has the full structure and worked examples, and our <Link href="/blog/mun-speech-examples">speech examples</Link> give you more models. What matters more is what to do if you have nothing prepared, because that happens.
        </p>

        <H3>If you have nothing prepared</H3>
        <p>
          Do not skip your slot. Use this, which takes thirty seconds to assemble in your head:
        </p>
        <ul>
          <li>One sentence naming the part of the problem you care about most.</li>
          <li>One sentence on what your country&apos;s situation is with respect to it.</li>
          <li>One question to the room: what you need other delegations to answer before a resolution is possible.</li>
          <li>One offer: that you are looking for partners on that question.</li>
        </ul>
        <p>
          Thirty five seconds, and ending on a question makes you a person other delegates approach in the next unmoderated caucus. That is the actual purpose of an opening speech.
        </p>

        <Callout>
          Nobody remembers a mediocre speech. Everybody remembers the delegate who never spoke. The floor is lower than you think.
        </Callout>

        <H2>The first unmoderated caucus</H2>
        <p>
          Someone will move for an unmoderated caucus, usually after an hour of speeches. It passes. The chair gavels, and the room stands up and dissolves into five loud clusters.
        </p>
        <p>
          This is the moment first-timers waste, because it is the only unstructured part of the day and it is genuinely intimidating. Here is what to do when you know nobody.
        </p>
        <ul>
          <li><strong>Stand up immediately.</strong> Sitting still for the first two minutes is how you end up outside every group. Everything is decided in the first five.</li>
          <li><strong>Go to the smallest cluster, not the biggest.</strong> The biggest one has eight people talking over each other and already has a leader. A group of three has room for a fourth.</li>
          <li><strong>Open with a question, not a pitch.</strong> &quot;What are you three working on?&quot; puts you inside the conversation. A speech about your own position puts you outside it.</li>
          <li><strong>Offer something concrete.</strong> One of your three positions or three numbers. &quot;I can write the clause on recognition of qualifications, I looked that up last night&quot; makes you useful, and useful is how you get on a paper.</li>
          <li><strong>Take names and countries.</strong> Write them down. You will not remember eleven new people.</li>
        </ul>
        <p>
          Our <Link href="/blog/unmoderated-caucus-guide">unmoderated caucus guide</Link> goes deeper, and <Link href="/blog/mun-bloc-building">bloc building</Link> covers what to do once you are in a group.
        </p>

        <H2>Lunch</H2>
        <p>
          Lunch is not a break. It is an unmoderated caucus with food, and experienced delegates treat it that way. Sit with people from your committee, ideally people who are not already in your bloc. Two things worth doing: find out what the other blocs are writing, and find the one delegation whose support your paper needs and talk to them about something other than the paper for ten minutes.
        </p>
        <p>
          Do eat. Committees run four hours at a stretch and low blood sugar is visible from the dais.
        </p>

        <H2>Day two: drafting</H2>
        <p>
          By the second day the room has sorted itself into two to four blocs, each writing a working paper. This is where the conference is actually decided, and where a first-timer can gain the most ground, because the number of people in any bloc who will actually write is always smaller than the number who want to be on the paper.
        </p>

        <H3>How to get your name on a paper</H3>
        <ul className="gv-check">
          <li><strong>Write something.</strong> Volunteer for two or three specific operative clauses and produce them. Whoever holds the document decides the sponsor list, and they put the people who wrote on it.</li>
          <li><strong>Offer to hold the document.</strong> The person typing has more influence over the final text than the person talking loudest, and nobody ever volunteers.</li>
          <li><strong>Be the one who reads it for errors.</strong> Unnumbered clauses, a stray full stop, two actions in one clause. The dais will send the paper back for these, and catching them makes you the person the bloc asks next time.</li>
          <li><strong>Ask directly.</strong> &quot;I wrote clauses 4 and 7, can I sponsor?&quot; is a normal question and the answer is usually yes. Waiting to be invited is how people write half a paper and end up a signatory.</li>
        </ul>
        <p>
          The <Link href="/blog/mun-clause-phrases">phrase list</Link> is the thing to have open while you write: it is the difference between &quot;encourages further cooperation&quot; and a clause that survives amendment.
        </p>

        <H2>Amendments and voting</H2>
        <p>
          Papers become draft resolutions once the dais accepts them, they are introduced, and then the committee amends them. Friendly amendments, agreed by all sponsors, go straight in. Unfriendly ones are voted on. Then the committee votes on each draft resolution itself.
        </p>
        <p>
          Two things you need to know for the vote. Procedural votes have no abstentions: everyone present votes. Substantive votes, on resolutions and amendments, do allow abstention unless you answered present and voting at roll call. A roll call vote means each country is called in turn and answers aloud, and you may say &quot;pass&quot; to defer once, in which case you are asked again at the end and must then vote yes or no.
        </p>
        <p>
          Vote the way your country would, not the way your friends do. Delegates who spend two days representing a country and then vote with the room in the final ten minutes are noticed, and not favourably. The <Link href="/blog/mun-voting-procedures">voting procedures guide</Link> has the thresholds and edge cases.
        </p>

        <H2>The closing</H2>
        <p>
          After the vote the chair usually says a few words, then everyone goes to a closing ceremony where awards are announced. Bring your placard: some conferences make you collect an award in person.
        </p>
        <p>
          If you do not win anything, which is the statistically normal outcome at a first conference, ask your chair for feedback. Most chairs will give it and very few delegates ask. Two minutes of &quot;what would have moved me up&quot; is worth more than the award.
        </p>

        <H2>The five things nobody tells first-timers</H2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>What you assume</th>
                <th>What is true</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Speaking a lot is what wins', 'Speaking often with nothing new said is a known negative. Chairs score contribution, not airtime.'],
                ['You need to know every rule', 'Six motions cover ninety percent of a weekend. The chair will help you with the rest if you ask politely.'],
                ['The loudest delegate is the best one', 'The person quietly typing the resolution usually beats them.'],
                ['Getting ruled out of order is embarrassing', 'It happens to everyone, constantly, and is forgotten in ten seconds.'],
                ['Your country is boring', 'A small state with a clear interest is easier to play well than a P5 seat with a complicated one.'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td>{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <H2>Before your next one</H2>
        <p>
          The single best preparation for a second conference is an hour of practice with actual procedure. If your club does not run mock committees, start one: you can open a free session at <Link href="/create/sessions">/create</Link>, put six people on their phones with a six character code, and run a roll call, a speakers list, a moderated caucus and a vote inside an hour. The things that felt impossible at conference stop feeling impossible after you have raised a motion badly twice in a room of friends.
        </p>
        <p>
          Then read the <Link href="/blog/mun-glossary">glossary</Link> for the words you heard and did not ask about, the <Link href="/blog/mun-motions-explained">motions guide</Link> for the six that matter, and the <Link href="/blog/mun-common-mistakes">common mistakes</Link> chairs see every weekend. That is the whole gap between a first conference and a confident second one.
        </p>
      </ArticleLayout>
    </>
  );
}
