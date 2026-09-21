import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Faculty Advisor Guide: How to Prepare and Support Your Team',
  description:
    'A complete guide for faculty advisors running a Model UN program: preparing students, choosing conferences, reviewing position papers, and supporting delegates at the conference.',
  path: '/blog/mun-faculty-advisor-guide',
  ogDescription:
    'Everything faculty advisors need to run a successful MUN program.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Faculty Advisor Guide: How to Prepare and Support Your Team',
  description: 'Complete guide for MUN faculty advisors.',
  url: 'https://gavelling.com/blog/mun-faculty-advisor-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-faculty-advisor-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Faculty Advisor Guide', item: 'https://gavelling.com/blog/mun-faculty-advisor-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-faculty-advisor-guide"
        pitch="Gavelling includes a Faculty Advisor view: observe any session live without disrupting the committee."
      >
        <p>Faculty advisors are the backbone of every successful school MUN program. You are simultaneously coach, logistics coordinator, welfare officer, and sometimes the only adult in the building who knows what a moderated caucus is. This guide covers the full advisor role: from <Link href="/blog/start-mun-club">building a program from scratch</Link> to supporting experienced delegates at competitive conferences.</p>

        <H2>Your Role at the Conference</H2>
        <p>The faculty advisor is an observer at the conference itself. You do not participate in committee. Your role during sessions is to be available: for pastoral support, logistical issues, liaison with conference staff, and debrief conversations between sessions. Our <Link href="/blog/mun-chaperone-guide">chaperone guide</Link> covers the trip itself. You are not a coach on the sidelines calling plays; you are a support structure that lets students take full ownership of their performance.</p>
        <Callout>The hardest part of being a good faculty advisor is resisting the urge to intervene when a student is struggling in committee. Let them work through it. The learning is in the difficulty.</Callout>

        <H2>Building the Program</H2>
        <p>If you are starting a new MUN club, start small and build deliberately. A first-year program with ten well-prepared students attending one local conference will build more sustainable momentum than a thirty-student program thrown at a major national conference unprepared.</p>
        <ul>
          <li><strong>Run practice sessions before the conference.</strong> Even two or three <Link href="/blog/mun-club-curriculum">mock committee sessions</Link> dramatically improve first-timers&apos; performance and confidence.</li>
          <li><strong>Assign research responsibilities.</strong> Give each student their country assignment at least four weeks before the conference and set a position paper deadline two weeks out.</li>
          <li><strong>Teach procedure explicitly.</strong> Most students will not learn rules of procedure from a document alone. Run mock votes, practice points of order, and simulate caucus proposals during club meetings.</li>
        </ul>

        <H2>Choosing Conferences</H2>
        <p>Not all conferences are appropriate for all experience levels. Our guide to <Link href="/blog/choosing-mun-conferences">choosing MUN conferences</Link> goes into more detail. Evaluate conferences on:</p>
        <ul>
          <li><strong>Size:</strong> Smaller conferences (under 200 delegates) are better for first-timers. Large conferences like NMUN or NAIMUN are excellent for experienced delegates but overwhelming for beginners.</li>
          <li><strong>Reputation:</strong> Ask other advisors in your network. Conference quality varies significantly.</li>
          <li><strong>Cost:</strong> Registration fees, travel, and accommodation add up. Budget carefully and apply for any available financial aid early. See our <Link href="/blog/mun-team-fundraising">team fundraising guide</Link> for ways to cover it.</li>
          <li><strong>Academic quality:</strong> Read the background guides before registering. They tell you a lot about the conference&apos;s academic standards.</li>
        </ul>

        <H2>Reviewing Position Papers</H2>
        <p>Every student&apos;s position paper should go through at least one advisor review before submission. Look for:</p>
        <ul>
          <li>Does the paper accurately represent the country&apos;s position (not the student&apos;s personal opinion)?</li>
          <li>Are claims cited? Are sources reliable?</li>
          <li>Are the proposed solutions specific and actionable?</li>
          <li>Does the paper stay within the page limit and format requirements?</li>
        </ul>

        <H2>During the Conference</H2>
        <p>Your schedule during the conference should include:</p>
        <ul>
          <li><strong>Morning check-ins:</strong> Brief team meeting before sessions start. How is everyone feeling? Any questions about procedure or strategy?</li>
          <li><strong>Lunch debrief:</strong> What happened in the morning session? What is the plan for the afternoon? Keep this constructive. It is not a critique session, it is a strategy session.</li>
          <li><strong>Evening wrap-up:</strong> Full debrief, pastoral check-in, and preparation for the next day.</li>
        </ul>
        <p>Do not attend committee sessions unless there is a serious welfare concern. Your presence changes delegate behaviour. They look to you instead of finding their own solutions.</p>

        <H2>After the Conference</H2>
        <p>A structured post-conference debrief is one of the most valuable parts of the program. Do it within a week while the experience is fresh. Have each student share: one thing they did well, one thing they would do differently, and one specific skill they want to develop before the next conference. This reflection loop is what separates programs that improve every year from those that plateau.</p>

        <H2>Using Technology as a Faculty Advisor</H2>
        <p>Some conferences now offer faculty advisor views: read-only access to committee sessions so advisors can monitor how their students are performing without being physically present in the room. Gavelling&apos;s faculty advisor mode provides exactly this: a live view of the committee, current speakers, queue positions, and session status. This allows advisors to see what is happening in real time and have better-informed debrief conversations.</p>
      </ArticleLayout>
    </>
  );
}
