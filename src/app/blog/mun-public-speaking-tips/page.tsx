import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Public Speaking Tips: How to Speak Confidently in Committee',
  description:
    'Practical public speaking tips for Model UN delegates: how to structure speeches, manage nerves, use your voice effectively, and make every speech count.',
  path: '/blog/mun-public-speaking-tips',
  ogDescription:
    'Master public speaking for MUN with these practical techniques.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Public Speaking Tips: How to Speak Confidently in Committee',
  description: 'Public speaking tips for MUN delegates.',
  url: 'https://gavelling.com/blog/mun-public-speaking-tips',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-public-speaking-tips' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Public Speaking Tips', item: 'https://gavelling.com/blog/mun-public-speaking-tips' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-public-speaking-tips"
        pitch="Track your speaking time and queue position with Gavelling during your next committee session."
      >

        <p>Standing up to address a committee of seventy delegates is nerve-wracking for almost everyone the first time. The good news: effective MUN speaking is a learnable skill, not a personality trait. These techniques work for introverts and extroverts alike, and they improve quickly with practice.</p>

        <H2>The Structure Every MUN Speech Needs</H2>
        <p>Rambling speeches lose the room. Every MUN speech (regardless of length) should have three components: a hook, a body, and a close. Our <Link href="/blog/mun-opening-speech">opening speech guide</Link> applies it to your first speech.</p>
        <ul>
          <li><strong>Hook (5 seconds):</strong> Grab attention immediately. A striking statistic, a direct statement of position, or a challenge to the previous speaker. &quot;Over 100 million people are currently displaced, more than at any point since World War II.&quot;</li>
          <li><strong>Body (45 seconds):</strong> Your argument. One or two points maximum in a sixty-second speech. Do not try to say everything.</li>
          <li><strong>Close (10 seconds):</strong> A call to action or a clear statement of what your delegation supports. &quot;France urges this committee to adopt a legally binding framework, and invites like-minded delegations to co-sponsor our working paper.&quot;</li>
        </ul>
        <Callout>The most <Link href="/blog/mun-common-mistakes">common mistake</Link>: trying to say too much. One clear argument, delivered well, is more persuasive than five arguments delivered nervously. Cut until it hurts.</Callout>

        <H2>Managing Nerves</H2>
        <p>Nerves are not the enemy. Unmanaged nerves are. A small amount of adrenaline actually improves performance. Here is how to keep it manageable:</p>
        <ul>
          <li><strong>Breathe before you stand.</strong> Take two slow breaths before getting up. This lowers your heart rate noticeably and gives your voice time to settle.</li>
          <li><strong>Plant your feet.</strong> Stand with feet shoulder-width apart. Do not sway or shift weight. It signals nervousness to the audience even when your voice sounds fine.</li>
          <li><strong>Speak slower than feels natural.</strong> When nervous, people speed up. Consciously slow down by about 20%. It feels odd from the inside but sounds authoritative from the outside.</li>
          <li><strong>Know your first sentence cold.</strong> Most nervousness peaks in the first ten seconds. If you know your opener word-for-word, the rest becomes easier once you are into it.</li>
        </ul>

        <H2>Using Your Voice</H2>
        <p>In a large conference room, volume and clarity matter more than eloquence. Chairs are assessing whether you sound confident, not whether you sound like a broadcast journalist.</p>
        <ul>
          <li><strong>Project to the back wall.</strong> Imagine the last row of the room and speak to them. This automatically raises your volume without shouting.</li>
          <li><strong>Pause deliberately.</strong> A one-second pause before a key point makes it land harder. It also gives you a moment to remember what comes next without fumbling.</li>
          <li><strong>Vary your pace.</strong> Say important facts slowly. Use normal speed for transitions. The variation holds attention.</li>
          <li><strong>Do not apologise.</strong> Avoid openers like &quot;I just wanted to say...&quot; or &quot;Sorry, I think...&quot; Start with your point.</li>
        </ul>

        <H2>Responding in the Moment</H2>
        <p>Planned speeches are one thing. Spontaneous responses to what another delegate just said are another, and they are what separates good delegates from great ones. When you have thirty seconds to formulate a rebuttal (and if you were misrepresented, see <Link href="/blog/mun-right-of-reply">right of reply</Link>):</p>
        <ul>
          <li>Identify the one thing you disagree with most strongly. Do not try to rebut everything.</li>
          <li>Name the specific claim: &quot;The delegate of Russia asserted that sanctions have been ineffective. The evidence contradicts this.&quot;</li>
          <li>Offer one piece of counter-evidence or reasoning.</li>
          <li>State your alternative position.</li>
        </ul>

        <H2>Eye Contact and Body Language</H2>
        <p>Look at the committee, not your notes. This is the single most powerful change most delegates can make. You may need notes for statistics and specific facts, so glance at them briefly, then look back up. Sustained eye contact with different sections of the room signals confidence and keeps people engaged.</p>
        <p>Avoid crossing your arms, looking at the floor, or gripping the podium. Open posture (shoulders back, arms at your sides or resting lightly) communicates that you belong at the podium.</p>

        <H2>Practise by Watching Others</H2>
        <p>Search for recordings of real UN speeches and MUN award-winning speeches. Watch what effective speakers do differently, or read our <Link href="/blog/mun-speech-examples">MUN speech examples</Link>. Pay attention to pace, structure, and how they handle transitions. Then practise with a timer in front of a mirror or a trusted classmate who will give honest feedback.</p>
      </ArticleLayout>
    </>
  );
}
