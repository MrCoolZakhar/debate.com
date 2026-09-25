import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, H3, Callout, ChairScript, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: "What Is Model UN? A Complete Beginner's Explanation",
  description:
    'What actually happens in a Model UN committee, from roll call to the final vote, explained in ten minutes for someone who has never been in the room',
  path: '/blog/what-is-model-un',
  ogDescription: 'What actually happens in a Model UN committee, from roll call to the final vote.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "What Is Model UN? A Complete Beginner's Explanation",
  description: 'What actually happens in a Model UN committee, from roll call to the final vote.',
  url: 'https://gavelling.com/blog/what-is-model-un',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/what-is-model-un' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'What Is Model UN', item: 'https://gavelling.com/blog/what-is-model-un' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="what-is-model-un"
        pitch="Want to see a committee work? Open a free session, send the code to five friends and run a roll call in two minutes."
      >
        <p>
          Model United Nations is a structured simulation in which students are each assigned a country, sit in a committee modelled on a real UN body, and spend one to four days negotiating a written resolution on a set topic. You do not argue your own opinion. You argue the position of the government you were given, under formal rules of debate, and the committee votes at the end on the document it produced. If a word below is new, the <Link href="/blog/mun-glossary">MUN glossary</Link> explains it.
        </p>

        <H2>What a committee room actually looks like</H2>
        <p>
          Picture a school hall or a university seminar room. Tables are arranged in a horseshoe or in rows. In front of every delegate is a card with a country name on it, called a placard, which you raise to be recognised. At the front is a raised table or a lectern called the dais, where two or three chairs sit. Behind them, usually, a projected screen showing the speakers list and a countdown clock.
        </p>
        <p>
          Committees range from about 15 delegates in a Security Council to 150 or more in a large General Assembly simulation. Most of what you will attend sits between 25 and 50. Our guide to <Link href="/blog/mun-committee-types">MUN committee types</Link> covers the options. Everyone is in business dress. It is quieter than you expect during formal debate and much louder than you expect the moment the chair suspends it.
        </p>
        <p>
          The two sounds that organise the day are the gavel and the clock. The gavel opens the session, closes debate and ends votes. The clock decides how long you speak, which is normally 60 to 90 seconds on a general speakers list. That constraint shapes everything about how people write and talk.
        </p>

        <PhotoFigure id="mun-vienna-committee" caption="Students debating at a Model UN conference in Vienna." />


        <H2>The day, in order</H2>
        <p>
          Nearly every committee, on nearly every circuit, runs the same skeleton. The names differ, the order rarely does.
        </p>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>What happens</th>
                <th>What you do</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Roll call', 'The chair reads every country and records who is in the room', 'Answer "present" or "present and voting"'],
                ['Setting the agenda', 'If the committee has two topics, delegates vote which is debated first', 'Speak for the topic you are ready on'],
                ['General speakers list', 'A long queue of speeches on the topic as a whole', 'Add your name early and speak'],
                ['Moderated caucus', 'Short structured debate on one narrow sub-topic', 'Raise a motion, then speak on it'],
                ['Unmoderated caucus', 'Formal rules suspended, delegates move and talk freely', 'Find allies and start writing'],
                ['Drafting', 'Working papers become draft resolutions', 'Get your name on a paper as a sponsor'],
                ['Amendments', 'The committee edits the document clause by clause', 'Defend your clauses, trade the ones you can lose'],
                ['Voting', 'A roll call vote on each draft resolution', 'Vote the way your country would'],
              ].map(([phase, what, you]) => (
                <tr key={phase}>
                  <td><strong>{phase}</strong></td>
                  <td>{what}</td>
                  <td>{you}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <H3>Roll call</H3>
        <p>
          The chair reads the country list aloud. You raise your placard and say one of two words. <strong>Present</strong> means you are here and you may abstain on substantive votes. <strong>Present and voting</strong> means you are here and you give up the right to abstain: you must vote for or against every draft resolution. Say &quot;present&quot; unless you have a reason not to. Present and voting is a commitment, not a formality.
        </p>

        <H3>The general speakers list</H3>
        <p>
          This is the default state of the room. The chair keeps a queue, calls each delegation in turn, and gives each one the same amount of time. It runs continuously underneath everything else: when a caucus ends, the committee falls back to the speakers list where it left off. It is where your opening speech goes, and it is the single easiest place to get on the record early. Our <Link href="/blog/general-speakers-list-guide">guide to the general speakers list</Link> covers yields, points and queue management in full.
        </p>

        <H3>Caucuses</H3>
        <p>
          A <strong>moderated caucus</strong> is a mini speakers list on one narrow question, proposed by a delegate: a topic, a total time and a per-speaker time. It is the fastest way to steer a room that has drifted. An <strong>unmoderated caucus</strong> suspends the rules entirely for a set period, usually 10 to 20 minutes. People stand up, cluster, and write. Read <Link href="/blog/unmoderated-caucus-guide">what to actually do in an unmoderated caucus</Link> before your first one, because this is where the conference is decided and it is the part beginners waste.
        </p>

        <H3>Drafting and voting</H3>
        <p>
          Groups produce a working paper, which is an unofficial draft. Once it has enough signatures and the chair accepts it, it becomes a draft resolution and can be introduced, amended and voted on. In a General Assembly simulation a substantive vote normally passes by simple majority, though many conferences set two thirds for certain committees. In a Security Council simulation, a vote against by any of the five permanent members defeats the resolution regardless of the count.
        </p>

        <Callout>
          If you remember one thing: the resolution is the product, the speeches are the marketing. Delegates who speak beautifully and never write are remembered fondly and rarely win anything.
        </Callout>

        <H2>What a delegate is actually being asked to do</H2>
        <p>
          You are representing a government, not yourself. That distinction is the whole activity. If you are assigned the Russian Federation on a sanctions topic, your job is to state and defend the position the Russian Federation has actually taken, with reference to its voting record and its stated interests, whether or not you agree with a word of it.
        </p>
        <p>
          This is not roleplay for its own sake. It forces you to research a position before you argue it, to separate what you think from what your brief requires, and to negotiate with people whose brief is incompatible with yours. Those three habits are the reason the activity survives. Start with our <Link href="/blog/mun-position-paper-guide">position paper guide</Link>: writing the paper is how most people discover what their country actually thinks.
        </p>
        <p>
          The line most conferences draw is this: represent the policy, never the prejudice. Chairs will stop a delegate who uses a national position as cover for something offensive, and most conference handbooks say so explicitly.
        </p>

        <H2>Three things that surprise first timers</H2>
        <ul>
          <li>
            <strong>You are not debating your own opinion.</strong> Delegates arrive ready to argue what they believe and are handed a country that believes the opposite. That is the point, and it is the part that actually teaches you something.
          </li>
          <li>
            <strong>Most of the real work happens in unmoderated caucus.</strong> Formal debate sets the terms. Blocs, drafts and votes are built standing up in the corner of the room with a laptop open.
          </li>
          <li>
            <strong>Procedure is a tool, not a test.</strong> Beginners treat the rules as a hazing ritual. Experienced delegates treat them as levers: a well timed motion for a moderated caucus can rescue an hour. Our <Link href="/blog/mun-motions-explained">guide to motions</Link> is the shortest route from intimidated to fluent.
          </li>
        </ul>

        <H2>Who runs it</H2>
        <p>
          <strong>Chairs</strong> sit on the dais and run the committee: recognising speakers, ruling on motions, keeping time and, at most conferences, deciding awards. A committee usually has a chair and one or two vice chairs or a rapporteur. If that appeals, read <Link href="/blog/how-to-chair-first-mun">how to chair your first committee</Link>.
        </p>
        <p>
          The <strong>secretariat</strong> runs the conference: applications, allocations, committees, logistics, money and the closing ceremony. It is led by a Secretary General with under secretaries general for specific portfolios. <strong>Crisis staff</strong> exist only in crisis committees, where they sit in a back room and respond to delegates&apos; directives with new developments. <strong>Faculty advisors</strong> are the teachers who travel with a school delegation; they do not participate in debate.
        </p>

        <ChairScript>
          &quot;The committee will come to order. The Secretariat has certified that quorum is present. This body is now in session. The chair will entertain a motion to open debate.&quot;
        </ChairScript>

        <H2>High school, university and online</H2>
        <p>
          <strong>High school MUN</strong> is usually two or three days, often with a school delegation and a faculty advisor, with more support from chairs and a stronger emphasis on learning the rules. <strong>University MUN</strong> is faster, more competitive, often four days, with crisis committees, larger conferences and delegations that travel internationally. The research expectation is considerably higher and the procedure moves at speed.
        </p>
        <p>
          <strong>Online and hybrid committees</strong> settled into a permanent minority of the calendar after 2020. They are cheaper and more accessible, and worse at the one thing that matters most, which is the unmoderated caucus. If you are running one, our guide to <Link href="/blog/mun-online-committees">chairing remotely</Link> is written for exactly that problem.
        </p>
        <p>
          Procedure differs by circuit too. North American conferences mostly run a UNA-USA derived ruleset with caucuses and motions. THIMUN affiliated conferences in Europe and Asia run a resolution centred model with lobbying and points of information instead. Neither is harder, but arriving with the wrong one is disorienting. Our <Link href="/blog/mun-rules-of-procedure">rules of procedure reference</Link> covers the shared core.
        </p>

        <H2>Questions people ask before their first one</H2>

        <H3>Do I need to be good at debating?</H3>
        <p>
          No, and competitive debaters are often worse at it to begin with. Debating rewards defeating the other side. Model UN rewards building a document that 25 delegations will vote for, which means the person who wins every exchange and ends up sponsoring nothing has lost. The useful transferable skill from debating is composure under a clock. The habit to unlearn is treating disagreement as a contest. If you are still deciding whether to try it, read <Link href="/blog/is-mun-worth-it">is Model UN worth it</Link>.
        </p>

        <H3>Do I need to know a lot about politics?</H3>
        <p>
          You need to know one country&apos;s position on one topic, and you can get there in an evening from the permanent mission website, the foreign ministry&apos;s statements and how the country voted last time. Breadth comes later and accumulates on its own. Nobody at your first conference knows everything, including the people who sound like they do. Our <Link href="/blog/mun-for-beginners">guide for beginners</Link> walks through a first conference hour by hour.
        </p>

        <H3>What does it cost?</H3>
        <p>
          Conference fees vary enormously by country and by conference, from nothing at a local school event to a substantial sum plus travel and accommodation at a large international one. Ask your club: many schools subsidise, many conferences run financial aid schemes, and the cheapest conferences are usually the nearest ones, which are also the right place to start.
        </p>

        <H3>How long is a conference?</H3>
        <p>
          Most are two or three days, typically a weekend, with committee sessions running in blocks of three to four hours. Large university conferences run four days. A first conference is a genuinely tiring amount of concentration, which is worth knowing in advance.
        </p>

        <H3>What do I wear?</H3>
        <p>
          <Link href="/blog/mun-dress-code">Western business attire</Link> is the near-universal standard: a suit or equivalent, and shoes you can stand in for eight hours. National dress is accepted at most conferences. The one practical warning is that committee rooms are either very cold or very hot and you cannot predict which, so bring a layer.
        </p>

        <H3>What if I say something wrong?</H3>
        <p>
          You will, repeatedly, and so will everyone else. Chairs rule delegates out of order constantly and think nothing of it thirty seconds later. The only mistake with any lasting cost is not speaking at all.
        </p>

        <H2>Where to start this month</H2>
        <ul className="gv-check">
          <li>Find out whether your school or university already has a club. If it does, the first meeting is the only thing you need to do this week.</li>
          <li>If it does not, three people and a teacher is enough to start one.</li>
          <li>Read one background guide from a real conference, published by its secretariat. You will learn more from it than from another explainer.</li>
          <li>Run a mock committee. You can open a free session on Gavelling at <Link href="/create/sessions">/create</Link>, put five friends on phones with the six character code, and get through a roll call, a speakers list and a vote in under an hour.</li>
          <li>Look at what conferences are open near you. The <Link href="/conferences/explore">conference directory</Link> is one place to start.</li>
        </ul>
        <p>
          Then go to one. Reading about a committee room is a poor substitute for an hour in one, and every experienced delegate you will meet was visibly terrible at their first conference.
        </p>
      </ArticleLayout>
    </>
  );
}
