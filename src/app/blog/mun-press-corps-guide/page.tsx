import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Press Corps: How a Press Committee Works and How to Win in One',
  description:
    'The two press models, what a press delegate does all day, the article forms, interviewing without disrupting a room, and how to run a press committee',
  path: '/blog/mun-press-corps-guide',
  ogDescription: 'How a Model UN press corps works, and how press delegates are actually judged.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Press Corps: How a Press Committee Works and How to Win in One',
  description: 'How a Model UN press committee works, what gets you judged well, and how to run one.',
  url: 'https://gavelling.com/blog/mun-press-corps-guide',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-press-corps-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Press Corps', item: 'https://gavelling.com/blog/mun-press-corps-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-press-corps-guide"
        pitch="Press delegates need to know what a committee actually did. Gavelling keeps the speakers list, motions and documents of every session in one place, free."
      >
        <p>The press corps is the <Link href="/blog/mun-committee-types">committee</Link> most conferences forget to explain. Delegates arrive expecting to write about the weekend and discover that the role is either a journalism exercise or a policy exercise, depending on a decision the conference made months earlier and may not have told them about. This guide covers both models, what the job actually involves, and how to run one if you are adding a press committee to your conference.</p>

        <H2>Two models, and why the difference matters</H2>
        <p>Almost every press corps is one of these. Find out which one yours is before you write anything.</p>
        <FactCard title="Independent journalists">
          Press delegates are reporters for a fictional or neutral conference outlet. They cover committees, interview delegates, and write to a professional standard of accuracy and balance. The exercise is journalism: sourcing, accuracy, structure, deadline.
        </FactCard>
        <FactCard title="Assigned outlets">
          Each press delegate is assigned a real news organisation with a real editorial character and, often, a real relationship to a state: a national broadcaster, a wire service, a partisan newspaper. The exercise is to report the conference as that outlet would, which makes it a policy exercise conducted through coverage.
        </FactCard>
        <p>The assigned outlet model is the more interesting one and the one worth arguing for. Writing as a state broadcaster forces a delegate to work out what that state wants the world to believe and what it will not print, which is exactly the analysis a delegate in the room is doing. Two reporters covering the same vote, one for a wire service and one for a state outlet, produce visibly different pieces, and the comparison teaches the whole conference something.</p>
        <Callout>If you are assigned an outlet, research its ownership, its audience and its editorial line before you research the topics. That line is your country position, and it constrains what you can write in the same way a delegate&apos;s instructions constrain what they can say.</Callout>

        <H2>What you actually do all day</H2>
        <p>The press schedule is the opposite of a delegate&apos;s. Delegates sit in one room all day. You move between rooms, and you have a deadline.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Time</th><th>What press is doing</th></tr></thead>
            <tbody>
              <tr><td>Before session one</td><td>Editorial meeting: assignments, angles, deadlines for the day</td></tr>
              <tr><td>Session one</td><td>Sitting in committees. Two rooms is realistic, three is not</td></tr>
              <tr><td>Break</td><td>Interviews. This is the only time delegates are available</td></tr>
              <tr><td>Session two</td><td>More committee coverage, or writing if you already have the story</td></tr>
              <tr><td>Late afternoon</td><td>Filing to the press director, editing, rewriting</td></tr>
              <tr><td>Evening</td><td>Publication, and planning tomorrow&apos;s angles</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The mistake first-time press delegates make is trying to cover every committee. You cannot. Pick two, follow them properly across the weekend, and let the arc of a committee be your story: the bloc that formed on Saturday morning and collapsed by Sunday is a better piece than a summary of eight rooms.</p>

        <H2>The article forms</H2>
        <H3>News report</H3>
        <p>The core form and the one you will write most. Inverted pyramid: what happened, who did it, why it matters, then the detail in descending order of importance. The first sentence carries the news and names the committee. Around 300 to 500 words, written to be cut from the bottom.</p>
        <p className="gv-note">Example opening, from a fictional committee: &quot;The World Health Organization committee passed its first resolution this afternoon by 71 votes to 19, after a two-hour dispute over whether member states should be required to report outbreak data within 48 hours. The reporting requirement survived, but only after sponsors removed the sanctions attached to it.&quot;</p>
        <H3>Interview</H3>
        <p>Five to eight questions, cut to the three or four answers that said something. Introduce the delegate, their delegation and why they matter to the story, then run question and answer. Never invent or tidy a quote into something they did not say.</p>
        <H3>Opinion or editorial</H3>
        <p>An argument with a thesis in the first paragraph and evidence after it, clearly labelled as comment. In the assigned outlet model this is where your outlet&apos;s character shows most.</p>
        <H3>Front page and live coverage</H3>
        <p>A front page is an editing exercise: what leads, what is secondary, what the headline says in six words. Live coverage is short timestamped updates during a session, and it is the form that most rewards accuracy under pressure. Both are usually the press director&apos;s responsibility to assemble.</p>

        <H2>Interviewing without disrupting the room</H2>
        <p>Committees are working. A press delegate who interrupts them is remembered for that and nothing else.</p>
        <ul className="gv-check">
          <li>Never interrupt formal debate. Wait for unmoderated caucus, a break, or the end of session</li>
          <li>Ask the chair before entering a committee room, and sit at the back</li>
          <li>Approach a delegate when they are not drafting, and ask for two minutes rather than an interview</li>
          <li>Identify yourself and your outlet every time, before the first question</li>
          <li>Take exact quotes. Read the quote back if it is important and you are unsure</li>
          <li>Agree what is on the record before you start, and honour it</li>
          <li>Ask the question that gets an answer: &quot;what changed between this morning and now&quot; beats &quot;how do you feel about the resolution&quot;</li>
        </ul>
        <p>The best press delegates become people that delegates want to talk to, which means being accurate about them on day one. A delegate who is quoted fairly on Saturday gives you the real story on Sunday.</p>

        <H2>Photography and multimedia</H2>
        <p>Photographs of committees are worth more than photographs of buildings. Ask the chair first, do not use flash during a speech, and shoot from the edges. Check your conference&apos;s policy on photographing delegates, particularly where under-18s are involved, and follow it exactly: many conferences require consent to have been collected at registration and restrict what can be published externally. If you are unsure whether a picture can be published, ask the press director rather than publishing it.</p>

        <H2>Deadlines and publication</H2>
        <p>Conferences distribute press output in one of four ways, and the choice shapes what the committee can write.</p>
        <ul>
          <li><strong>A printed newspaper</strong>, produced overnight and handed out at breakfast. The highest impact and the most work, and it needs a hard evening deadline and someone who can lay out pages.</li>
          <li><strong>A live blog or conference website</strong>, updated all day. Best for live coverage, and the easiest to run.</li>
          <li><strong>Social media accounts</strong> run by the press corps. Fast, but a poor showcase for long-form work and the hardest to moderate.</li>
          <li><strong>A published archive</strong> collected after the conference. Good for portfolios, no impact during the weekend.</li>
        </ul>
        <p>Whichever you use, the deadline is the discipline. A press committee without a published deadline produces nothing, because there is always another interview to do. Set the deadline earlier than you think and publish whatever exists at that moment.</p>

        <H2>How press delegates are judged</H2>
        <p>Differently from every other committee, which is why press awards sometimes look arbitrary to delegates who have never done it. A good press director assesses five things. For how ordinary committees are scored, compare our <Link href="/blog/mun-judging-rubric">MUN judging rubric</Link>.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Criterion</th><th>What it looks like</th></tr></thead>
            <tbody>
              <tr><td>Accuracy</td><td>Votes, numbers, names and quotes are right. A single wrong vote count is costly</td></tr>
              <tr><td>Output</td><td>Filed on time, to length, in the required form, every day</td></tr>
              <tr><td>Reporting</td><td>Left the press room, sat in committees, interviewed people others did not</td></tr>
              <tr><td>Writing</td><td>A lede that carries the news, structure, no padding</td></tr>
              <tr><td>Character</td><td>In the assigned outlet model, consistency with the outlet&apos;s line without abandoning the facts</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Note what is absent: speaking. A press delegate who never speaks publicly but files four accurate, well-sourced pieces will beat a charismatic one who files two late. The closest equivalent among ordinary delegates is the person who writes the resolution everybody votes for, which our <Link href="/blog/mun-awards-guide">awards guide</Link> covers from the delegate side.</p>

        <H2>Running a press committee as a director</H2>
        <p>The press director is an editor, not a chair, and the job is different from chairing a debate. Five things make it work.</p>
        <ol>
          <li><strong>Assign, do not let people choose.</strong> Each reporter gets named committees and a form for the day. Free-roaming press corps cover everything thinly and nothing well.</li>
          <li><strong>Hold a ten-minute editorial meeting</strong> at the start of every session block. Angles, assignments, deadlines. It is the whole management structure.</li>
          <li><strong>Edit properly and quickly.</strong> One pass for accuracy, one for structure, and hand it back with two specific changes rather than a rewrite. Reporters who are rewritten silently stop improving.</li>
          <li><strong>Protect the workload.</strong> Two pieces per day per reporter is realistic. Four is not, and the quality collapses.</li>
          <li><strong>Publish visibly.</strong> If the conference never sees the output, the committee feels pointless by Sunday morning, which is the most common way press committees fail.</li>
        </ol>
        <p>Brief your reporters on procedure too. A journalist who does not know what a motion to close debate is will misreport the vote that follows it, so send them our <Link href="/blog/mun-motions-explained">motions reference</Link> before the conference and spend fifteen minutes on it in the first editorial meeting. Press covering a crisis committee needs more: the room moves fast and half the action is invisible, so read the <Link href="/blog/mun-crisis-committee-guide">crisis guide</Link> too.</p>

        <H2>Ethics, and the line</H2>
        <p>Three rules, and they are not negotiable in either model.</p>
        <ul>
          <li><strong>Never fabricate.</strong> Not a quote, not a vote count, not a source. In-character bias is legitimate; invention is not, and it is the one thing that should end a press delegate&apos;s weekend.</li>
          <li><strong>Bias is in the selection and the framing, not the facts.</strong> A state broadcaster may lead on a different story, quote different people and use different adjectives. It does not print a result that did not happen.</li>
          <li><strong>Remember these are students.</strong> Satire of a delegation&apos;s position is fair. Personal mockery of the person holding it is not, and a press director should kill that copy without discussion.</li>
        </ul>
        <Callout>The useful distinction for a press delegate: you may choose what to cover and how to frame it, but everything you assert must be true. That is also, usefully, the distinction real journalists work with.</Callout>

        <H2>Why a press corps improves the whole conference</H2>
        <p>If you are a <Link href="/blog/mun-secretariat-roles">secretariat member</Link> deciding whether to add one, the argument is practical rather than sentimental. A press corps gives you an academic role for delegates who are strong writers but hate public speaking, which is a real and under-served group. It produces a record of the weekend that you can publish afterwards, which is marketing you did not have to write. It gives your social media something to post that is not a photograph of a lectern. And it changes delegate behaviour for the better: a committee that knows it is being covered is a committee where people check their facts.</p>
        <p>The costs are modest: a director, a room with tables and power, a publication route, and a place in the programme for the press to be distributed. Start with six to ten reporters in year one and grow it once you know your publication route works. Our <Link href="/blog/mun-conference-planning">conference planning guide</Link> covers where it fits in the timeline, and if you want to see how established conferences structure their committee line-ups before adding one, the <Link href="/conferences/explore">conference directory</Link> is a quick comparison. For the committee mechanics themselves, you can set up a room and try the whole thing with your club free at <Link href="/create/sessions">gavelling.com/create</Link>, press corps included, and find out what a reporter can actually see from the back of the room.</p>
      </ArticleLayout>
    </>
  );
}
