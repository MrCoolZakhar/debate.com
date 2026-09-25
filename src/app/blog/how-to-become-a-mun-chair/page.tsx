import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Become a MUN Chair: Applying, Interviewing and Getting Picked',
  description:
    'What secretariats look for in a chair application, what the interview really tests, and how to get your first dais.',
  path: '/blog/how-to-become-a-mun-chair',
  ogDescription: 'How to apply, interview and get picked for your first MUN dais.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Become a MUN Chair: Applying, Interviewing and Getting Picked',
  description: 'How to apply, interview and get picked for your first MUN dais.',
  url: 'https://gavelling.com/blog/how-to-become-a-mun-chair',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/how-to-become-a-mun-chair' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'How to Become a MUN Chair', item: 'https://gavelling.com/blog/how-to-become-a-mun-chair' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="how-to-become-a-mun-chair"
        pitch="Gavelling lists open chair and secretariat roles across conferences, and runs the committee once you get one."
      >
        <p>Most guides to chairing start on the morning of the conference, with a gavel already in your hand. This one ends there. It is about the four months before: finding the openings, writing an application that a tired secretariat reads properly, surviving the interview, and turning a yes into a dais you are actually ready for.</p>

        <H2>What chairing actually asks of you</H2>
        <p>The visible part is two days in a room. The invisible part is much larger, and it is the reason chair applications have a drop-out problem.</p>
        <p>A typical single-topic committee at a mid-sized conference costs a chair somewhere between 40 and 80 hours before anyone arrives. The background guide is most of it: researching a topic you probably did not pick, writing 15 to 25 pages, taking a round of secretariat edits, and delivering it to a deadline that sits weeks before the conference so delegates have time to read it. Add the position paper marking, the delegate questions in your inbox, the pre-conference calls with your co-chair and the academic team, and the hours you will spend rereading the rules of procedure of a conference that is not the one you usually attend.</p>
        <p>Then there is the room itself. Chairing is not public speaking, which surprises delegates who apply because they were good at speaking. It is closer to refereeing: keeping time, keeping the queue honest, ruling on motions in the second you are asked, tracking who has contributed what, and staying neutral while forty people try to read your face. If you have never watched a chair closely, spend one conference doing nothing else.</p>
        <Callout>The honest question to ask yourself is not whether you would enjoy holding a gavel. It is whether you would enjoy writing 20 pages about maritime delimitation in your exam term, because that is the part you sign up for first.</Callout>

        <H2>When you are ready to apply</H2>
        <p>There is no universal bar, but secretariats converge on roughly the same shape.</p>
        <ul>
          <li><strong>For a school or regional conference:</strong> two or three conferences as a delegate, at least one award or one committee where you clearly led, and a teacher or society president willing to vouch for you. Plenty of conferences take first-time chairs at this level, usually as a vice chair beside an experienced one.</li>
          <li><strong>For a large national or international conference:</strong> five or more conferences, some experience on the circuit the conference uses, and usually a chairing credit already. A THIMUN-affiliated conference will want you to have sat in THIMUN-style debate before, not only North American style.</li>
          <li><strong>For crisis:</strong> different again. Crisis directors are recruited on judgement and writing speed rather than seniority, and a delegate who was excellent in two crisis committees is a plausible crisis staffer at their third.</li>
        </ul>
        <p>The commonest exception runs the other way. Many of the biggest conferences do not take external chair applications at all: the dais is staffed from the host university society or the host school, and the &ldquo;application&rdquo; is an internal process you can only enter by joining that society. If a conference you admire has no public chair application, that is usually why. Do not read it as a rejection.</p>

        <H2>Where the openings are posted, and when</H2>
        <p>Chair recruitment runs on a predictable annual clock, and it is earlier than most delegates expect.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Conference date</th><th>Chair applications usually open</th><th>Usually close</th></tr>
            </thead>
            <tbody>
              <tr><td>Autumn conference</td><td>Late in the previous academic year</td><td>Before the summer break</td></tr>
              <tr><td>Winter conference</td><td>Start of the academic year</td><td>Six to ten weeks later</td></tr>
              <tr><td>Spring conference</td><td>Autumn term</td><td>Around the turn of the year</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="gv-note">Ranges vary by conference and by country. Treat the pattern as a prompt to check early, not as a calendar.</p>
        <p>They are posted in four places, in roughly this order of usefulness: the conference&rsquo;s own site, usually behind a &ldquo;Get involved&rdquo; or &ldquo;Staff&rdquo; link that is not in the main navigation; cross-conference role boards, including <Link href="/conferences/roles">Gavelling&rsquo;s job board for chairs and staff</Link>; the conference&rsquo;s Instagram, which is often where the deadline is actually announced; and your own society&rsquo;s mailing list, where a secretariat member will forward a call because they want someone they know to apply.</p>
        <p>Set a reminder for each conference you would chair at, three weeks before the window you expect. Most missed applications are missed by people who were qualified and looked in November.</p>

        <H2>The application, question by question</H2>
        <p>Chair applications look like a form and read like an interview. Here is what each recurring question is really testing.</p>

        <FactCard title="&ldquo;List your MUN experience.&rdquo;">
          Testing volume, but mostly testing whether you can be concise. Give conference, committee, country and result in one line each, most recent first. Do not narrate. A reader looking at 90 applications reads this as a table, so format it as one.
        </FactCard>
        <FactCard title="&ldquo;Which committees would you like to chair? Rank three.&rdquo;">
          Testing whether you read the committee list properly. Ranking three committees that all sit in the same topic area tells the academic team you have one interest and no flexibility. Ranking three with a reason each tells them you can be moved.
        </FactCard>
        <FactCard title="&ldquo;Why do you want to chair this committee?&rdquo;">
          Testing knowledge, not enthusiasm. An answer that names the actual deadlock in the topic, and the two positions that will collide in the room, beats any amount of passion. Two hundred words is enough.
        </FactCard>
        <FactCard title="&ldquo;Describe a difficult situation in committee and how you would handle it.&rdquo;">
          Testing temperament. Secretariats are screening out the applicant who wants authority. The right answer is specific, proportionate and ends with the committee still working. See our guide to <Link href="/blog/mun-controlling-the-floor">keeping debate moving when a committee stalls</Link> for the vocabulary.
        </FactCard>
        <FactCard title="&ldquo;What is your availability?&rdquo;">
          Testing honesty. Tell them about the exam period. A chair who flags a three-week gap in November is scheduled around; a chair who disappears in November without warning is the academic team&rsquo;s worst month.
        </FactCard>

        <H2>The writing sample, which usually decides it</H2>
        <p>Almost every serious chair application asks for writing: a mock background guide section, a topic overview of 500 to 1,000 words, or a set of questions a resolution must answer. This is the item that separates the shortlist from the pile, for a simple reason. Everything else on the form is a claim. The writing sample is evidence, and it predicts the one deliverable the secretariat actually depends on.</p>
        <p>Four things reviewers look for, in order:</p>
        <ol>
          <li><strong>Can you explain a conflict without taking a side?</strong> Write the strongest version of both positions. A sample that argues is a sample that will produce a guide delegates cannot use.</li>
          <li><strong>Do you cite?</strong> Name the resolution number, the treaty article, the agency report. &ldquo;The UN has addressed this several times&rdquo; is what an unprepared delegate writes.</li>
          <li><strong>Is it structured?</strong> Subheadings, short paragraphs, one idea each. Reviewers skim first and read second.</li>
          <li><strong>Is it the right length?</strong> If they asked for 800 words, send 800. Sending 2,000 is not enthusiasm; it is a preview of the 45-page guide you will hand in late.</li>
        </ol>
        <p>Write the sample as if it were a real section of a real guide, because the best ones are reused. Our full method is in <Link href="/blog/mun-background-guide-writing">how to write a MUN background guide</Link>.</p>

        <H2>The interview: six questions and what a good answer contains</H2>
        <p>Chair interviews are usually 20 to 30 minutes over video, with the Under-Secretary-General for Academics, sometimes with the Secretary-General present. They are not adversarial. They are mostly checking that the person who wrote the application is the person on the call, and that you will be pleasant to work with for four months.</p>

        <H3>1. &ldquo;Walk us through your MUN experience.&rdquo;</H3>
        <p>Ninety seconds, not five minutes. End on why you want to move to the dais now.</p>

        <H3>2. &ldquo;What makes a good chair?&rdquo;</H3>
        <p>The weak answer is &ldquo;confidence&rdquo; or &ldquo;knowing the rules&rdquo;. The strong answer names the trade-off: a chair has to be visible enough to hold the room and invisible enough that the debate belongs to the delegates. Give an example of a chair you watched do it.</p>

        <H3>3. &ldquo;A delegate raises a point of order and you know they are wrong. What do you do?&rdquo;</H3>
        <p>They want to see you rule, immediately, and move on. &ldquo;The chair rules the point not well taken. The committee will continue.&rdquo; Not a debate, not an apology. Our <Link href="/blog/mun-points-explained">guide to the four points</Link> and our guide to the <Link href="/blog/mun-points-of-order">point of order</Link> in particular give you the exact wording.</p>

        <H3>4. &ldquo;Your committee has gone silent. It is 40 minutes into the first session.&rdquo;</H3>
        <p>A diagnostic answer beats a menu. Say what you would check first (is it a quiet room or a lost room), then name two interventions and when you would abandon each.</p>

        <H3>5. &ldquo;How would you decide awards?&rdquo;</H3>
        <p>They are checking for a method, not a philosophy. Describe criteria, describe how you would record evidence during the session, and admit what evidence does not capture. There is a full rubric in <Link href="/blog/mun-judging-rubric">how to judge a MUN committee</Link>.</p>

        <H3>6. &ldquo;Do you have questions for us?&rdquo;</H3>
        <p>Have two. Good ones: when is the background guide due and who reviews it; how many delegates will be in the room; what the conference expects of chairs outside session hours. These are the questions of someone planning to do the job.</p>
        <Callout>Almost nobody is rejected for a wrong answer in a chair interview. People are rejected for being vague, for talking over the interviewer, and for not having read the conference&rsquo;s own committee list.</Callout>

        <H2>Which committee to apply for</H2>
        <p>The instinct is to rank the flagship first: the Security Council, the crisis committee, the one with the famous topic. This is usually the wrong move for a first dais, for three reasons.</p>
        <p>The flagship attracts the most applications, so your odds are worst there. It is also where the secretariat is least willing to take a risk, so it goes to a returning chair. And it is the hardest room to chair: small, fast, procedurally awkward, full of delegates who have done it before and will test you. A first-time chair in an unremarkable 40-seat General Assembly committee learns more and enjoys it more.</p>
        <p>Rank by what you can write about. If you can produce a genuinely good background guide on the committee, apply for it. If you would be researching it from nothing in your exam term, do not. Our overview of <Link href="/blog/how-to-run-mun-committee">how a committee actually runs</Link> is worth reading before you rank, because the committee type changes the job more than the topic does.</p>

        <H2>The other routes onto a dais</H2>
        <p>Chair is one of five seats, and four of them are easier to get first.</p>
        <TableWrap>
          <table>
            <thead>
              <tr><th>Role</th><th>What it does</th><th>Good first step if</th></tr>
            </thead>
            <tbody>
              <tr><td>Chair / Director</td><td>Runs the room, owns the background guide, signs the award slate</td><td>You have chaired or led before</td></tr>
              <tr><td>Vice chair / Moderator</td><td>Shares the dais, often runs the speakers list and timing while the chair rules</td><td>You want the room without owning the guide</td></tr>
              <tr><td>Rapporteur</td><td>Keeps the record, checks resolutions for format, handles documents</td><td>You are precise and new to the dais</td></tr>
              <tr><td>Crisis staff</td><td>Writes updates and responds to directives from the backroom</td><td>You write fast and think in consequences</td></tr>
              <tr><td>Crisis director</td><td>Designs and runs the arc, manages the staff</td><td>You have staffed a backroom already</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Vice chair and rapporteur are underrated. You sit on the dais for the whole conference, you see every ruling made and every award argued, and you carry none of the guide. A year as a rapporteur is the cheapest chairing education available. If the crisis route appeals, read <Link href="/blog/mun-crisis-backroom-guide">what crisis staff actually do</Link> before you apply, because the job is nothing like being a crisis delegate.</p>

        <H2>Between the acceptance and the conference</H2>
        <p>The gap is where chairs are made or quietly replaced. A workable sequence:</p>
        <ul className="gv-check">
          <li>Week 1: introduce yourself to your co-chair and agree who drafts which section of the guide. Agree a personal deadline a fortnight before the real one.</li>
          <li>Weeks 2 to 5: research and draft. Keep a running bibliography from the first day, not at the end.</li>
          <li>Week 6: send the guide to the academic team. Expect edits. Take them without arguing unless something is factually wrong.</li>
          <li>Guide published: read the conference&rsquo;s own rules of procedure end to end, twice, and note every place they differ from the rules you are used to. This is the single highest-value hour you will spend.</li>
          <li>Two weeks out: mark the position papers as they arrive, not in one night. Write one line per delegation while you read, and keep it, because on day one those lines are the only thing you know about the room.</li>
          <li>One week out: run through the opening in full, out loud, with your co-chair. Roll call, opening remarks, first speakers list, first motion. Fifteen minutes, and it removes most first-session nerves.</li>
        </ul>

        <H2>Your first dais</H2>
        <p>Prepare three things and you will be fine. A printed or saved script for the moments you will otherwise fumble, which are roll call, the first motion and the vote: take it from our <Link href="/blog/mun-chair-script">MUN chair script</Link>. A way of tracking speakers, time and motions that is not a piece of paper you will lose, because a chair who loses the queue loses the room. And a plan for the first twenty minutes, in order, so that the room sees a dais that knows what happens next.</p>
        <p>Everything after that is judgement, and judgement is built by chairing. Read <Link href="/blog/how-to-chair-first-mun">how to chair your first MUN committee</Link> the week before, and let the rest arrive on the day.</p>
      </ArticleLayout>
    </>
  );
}
