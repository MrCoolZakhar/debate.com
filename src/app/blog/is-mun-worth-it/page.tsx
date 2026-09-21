import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Is Model UN Worth It? An Honest Answer',
  description:
    'What Model UN is genuinely worth on an application and in working life, which skills really transfer, and when it is a waste of your weekends',
  path: '/blog/is-mun-worth-it',
  ogDescription: 'What Model UN is genuinely worth, and when it is a waste of your time.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Is Model UN Worth It? An Honest Answer',
  description: 'What Model UN is genuinely worth, and when it is a waste of your time.',
  url: 'https://gavelling.com/blog/is-mun-worth-it',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/is-mun-worth-it' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Is Model UN Worth It', item: 'https://gavelling.com/blog/is-mun-worth-it' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="is-mun-worth-it"
        pitch="Gavelling is free for sessions and free for organisers, so the cost of doing more than attending is mostly your time."
      >
        <p>Model UN is worth a lot to a few people and very little to most, and the difference is almost entirely what you do with it rather than how long you do it. Four years of attending conferences is worth less than one year of running something. This is the honest version, including the part where the answer is no. If you have never seen a committee, read <Link href="/blog/what-is-model-un">what Model UN is</Link> first.</p>

        <H2>The short answer</H2>
        <p>Model UN is worth it if you use it to do things that leave a record: chairing a committee, leading a club, founding a conference, writing background guides other people read. It is worth much less if you attend conferences, collect a few certificates and stop there. The activity itself teaches speaking, writing and negotiation better than most school subjects do. The activity as a line on an application is close to invisible unless you did something in it that a stranger can verify.</p>
        <p>If you enjoy it, that is already a sufficient reason to do it, and you can stop reading here. The rest of this page is for people deciding whether to invest heavily.</p>

        <H2>What an admissions reader actually sees</H2>
        <p>Admissions offices do not publish scoring rubrics for extracurriculars, so anyone quoting you a number is guessing. What is observable is the shape of what they ask for: activity lists with limited slots, a line for your role and a line for hours, and space for a small number of things to be described at length.</p>
        <p>That structure rewards three things and punishes one. Our guide to <Link href="/blog/mun-on-your-cv">putting Model UN on your CV</Link> shows how to write each line.</p>
        <ul>
          <li><strong>Role.</strong> &ldquo;Delegate&rdquo; describes attendance. &ldquo;Secretary-General&rdquo;, &ldquo;Chair, 45-delegate committee&rdquo; or &ldquo;Founder&rdquo; describes responsibility. The words are free; earning them is not.</li>
          <li><strong>Scale.</strong> Numbers a reader can picture: how many delegates, how many schools, how much money you handled, how many people you trained.</li>
          <li><strong>Continuity.</strong> A four-year arc that ends somewhere is a story. Four years that end where they started is a hobby, which is fine, but it is not evidence of anything.</li>
          <li><strong>Inflation.</strong> The one that hurts. &ldquo;Award-winning delegate&rdquo; with no named award, or a club presidency of a club with six members, reads to an experienced reader exactly as thin as it is.</li>
        </ul>
        <Callout>The test to apply to every line: could someone who was not there check it? A conference name, a committee size, a role with a start date and a handover all survive that test. &ldquo;Developed leadership and negotiation skills&rdquo; does not.</Callout>

        <H2>The skills that genuinely transfer</H2>
        <p>These are the ones you can demonstrate afterwards, which is the only definition of transfer that matters.</p>
        <ul>
          <li><strong>Speaking to a clock.</strong> Very few activities force you to make a complete argument in sixty seconds, repeatedly, in front of people who are not obliged to be interested. This is the skill that is most obviously visible later, in interviews, seminars and meetings.</li>
          <li><strong>Writing to a brief that is not your own.</strong> A position paper requires you to argue a position you may not hold, in a fixed format, to a word limit, to a deadline. That is most professional writing.</li>
          <li><strong>Negotiating with people who disagree.</strong> Merging two working papers is a real negotiation with a real cost: your clause or theirs. Delegates learn to trade and to know what they are trading.</li>
          <li><strong>Reading a room.</strong> Knowing who is actually deciding, who is only talking, and when a bloc has quietly settled is a genuine and unusual skill for a seventeen-year-old.</li>
          <li><strong>Running a complicated thing.</strong> This only comes from chairing or organising, not from delegating, and it is far and away the most valuable thing on offer. Budgets, volunteers, deadlines, angry emails and something happening on the day whatever you do.</li>
        </ul>

        <H2>The skills people claim and cannot show</H2>
        <p>Written honestly, the list is short but worth saying out loud.</p>
        <p><strong>Knowledge of international relations.</strong> You learn one topic, at conference depth, several times. That is real but it is not a discipline, and a university interviewer who works in the field will find the edge of it in about ninety seconds. Claim the topic you researched, not the subject.</p>
        <p><strong>Diplomacy.</strong> Model UN rewards being persuasive in a room with a two-day horizon and no consequences. Actual diplomacy is slow, consequence-heavy and mostly written. The overlap is real but smaller than the name suggests.</p>
        <p><strong>Research skills.</strong> Delegates who use the UN Digital Library, the treaty collection and mission statements are genuinely learning to find primary sources. Delegates who read three articles and a Wikipedia page are not, and the activity does not force the difference. Our <Link href="/blog/mun-country-research">country research guide</Link> is the line between the two.</p>

        <H2>Claim against reality</H2>
        <TableWrap>
          <table>
            <thead><tr><th>The claim</th><th>What is actually true</th></tr></thead>
            <tbody>
              <tr><td>MUN looks good on applications</td><td>A role in MUN looks good. Attendance is neutral and takes a slot.</td></tr>
              <tr><td>MUN teaches public speaking</td><td>True, and it is the strongest claim on this list.</td></tr>
              <tr><td>MUN teaches diplomacy</td><td>Partly. It teaches negotiation under time pressure, which is a piece of it.</td></tr>
              <tr><td>MUN makes you good at international relations</td><td>It makes you good at a handful of topics. That is not the same thing.</td></tr>
              <tr><td>Awards prove you are good</td><td>Awards prove a chair thought so on one weekend. The <Link href="/blog/mun-awards-guide">awards guide</Link> explains how they are decided. Several awards across different circuits mean more than several at one conference.</td></tr>
              <tr><td>MUN helps you get a job at the UN</td><td>There is no pipeline. Language skills, a relevant degree and field experience are what those applications ask for.</td></tr>
              <tr><td>You need to start young</td><td>You do not. Two intense years beat five passive ones.</td></tr>
            </tbody>
          </table>
        </TableWrap>

        <H2>When Model UN is the wrong choice</H2>
        <p>Three cases, stated plainly.</p>
        <p><strong>It is displacing depth in the thing you actually care about.</strong> If you are a serious musician, coder or athlete, MUN takes weekends at exactly the times that matter. The general point beats the specific one here: a reader would rather see one thing pursued a long way than four pursued a short way.</p>
        <p><strong>You are only there for the certificate.</strong> A delegate who has decided in advance that the point is the award tends to learn very little and to be unpleasant to sit next to. Chairs notice both.</p>
        <p><strong>The cost is a real strain.</strong> Conference fees, travel, accommodation and formal clothing add up, and the largest international conferences are expensive. If it hurts, do fewer and better conferences, ask about financial aid because most conferences quietly have some, and put the saved weekends into running something at your own school, which costs almost nothing and is worth more anyway.</p>

        <H2>How to make it count</H2>
        <p>A rough progression, useful whether you have one year left or four.</p>
        <ul>
          <li><strong>Attend two or three conferences</strong> to learn the room. Not ten. After the third, attendance stops teaching you much. For the university circuit, see <Link href="/blog/university-mun-guide">university Model UN</Link>.</li>
          <li><strong>Get onto a dais.</strong> Chairing is where the learning changes kind, because you are suddenly responsible for forty people&rsquo;s experience. Our guide on <Link href="/blog/how-to-chair-first-mun">chairing your first committee</Link> covers the job, <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link> covers getting picked, and open chair positions are advertised publicly, including on the <Link href="/conferences/roles">Gavelling roles board</Link>.</li>
          <li><strong>Run the club.</strong> Training people is harder and more useful than being good yourself, and unlike delegate performance it produces something that outlives you.</li>
          <li><strong>Organise something.</strong> A small in-house conference for local schools is the single highest-value thing a student can do in this activity. It is also the hardest, which is the point.</li>
          <li><strong>Write something people use.</strong> A background guide, a training curriculum, a rules primer for your club. Artefacts survive.</li>
        </ul>
        <FactCard title="One year, done well">
          Chair one committee, train the new intake at your school, and run a one-day in-house conference for three neighbouring schools. That is a real record, it costs almost nothing beyond a room and some time, and it is more persuasive than four years of attendance.
        </FactCard>

        <H2>Careers where it helps, and where nobody asks</H2>
        <p>Where the habits carry: law, policy, consulting, journalism, academia, anything where you present and negotiate for a living. Not because MUN is on your CV, but because you will be visibly better at the interview than people who have never argued against a clock.</p>
        <p>Where nobody will ask: essentially everywhere else. In most technical, clinical and creative fields your MUN record is a conversation starter at best. That is not an argument against doing it, only against treating it as a career investment.</p>
        <p>One caution about the international organisations themselves. There is no route from Model UN into the UN system, and the entry programmes those organisations run have their own published requirements, usually a relevant degree, language ability and work experience. Treat MUN as practice for the skills, not as a step on a ladder.</p>

        <H2>The cost, said plainly</H2>
        <p>Model UN costs money and weekends. Fees vary enormously by conference and country, travel is usually the largest line, and the flagship international conferences can cost more than everything else in a school year combined. Add the hours: research, position papers, practice, then two or three full days in a suit.</p>
        <p>The honest trade is that the cheapest version of this activity is also the most valuable version. Chairing at a local conference, running your school club and organising a one-day event cost almost nothing and teach considerably more than an expensive weekend three time zones away. The expensive conferences are excellent, and they are a luxury rather than a requirement.</p>

        <H2>The answer, one more time</H2>
        <p>Yes, if you intend to do something in it. The speaking, the writing under a brief and the experience of running something complicated are genuinely valuable and genuinely rare at school age. No, if the plan is to attend conferences for four years and hope the name carries weight, because it does not.</p>
        <p>If you are deciding where to start, the cheapest and best first step is usually not a conference at all: it is starting or reviving a club at your own school, which is covered in our guide to <Link href="/blog/start-mun-club">starting a MUN club</Link>. And if you are already a delegate wondering why the results have stalled, <Link href="/blog/mun-common-mistakes">the common mistakes guide</Link> is a more useful read than another list of tips.</p>
      </ArticleLayout>
    </>
  );
}
