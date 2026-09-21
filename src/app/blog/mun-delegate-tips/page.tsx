import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { PhotoFigure } from '@/components/blog/BlogPhoto';
import { H2, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Delegate Tips: How to Stand Out in Any Committee',
  description:
    'Practical MUN delegate tips for beginners and experienced delegates: how to research, speak, build blocs, draft resolutions, and win best delegate.',
  path: '/blog/mun-delegate-tips',
  ogDescription:
    'The practical delegate playbook for Model UN success.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Delegate Tips: How to Stand Out in Any Committee',
  description: 'Practical tips for MUN delegates at all levels.',
  url: 'https://gavelling.com/blog/mun-delegate-tips',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-delegate-tips' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Delegate Tips', item: 'https://gavelling.com/blog/mun-delegate-tips' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-delegate-tips"
        pitch="Gavelling gives delegates real-time visibility into their queue position and speaking time."
      >

        <p>Every delegate walks into committee wanting to make an impact. Few do. The gap between a forgettable delegate and one who earns Best Delegate is rarely about intelligence or knowledge. It is almost always about preparation, strategy, and presence. These tips apply whether you are attending your first conference or your fifteenth.</p>

        <H2>Before the Conference: Research Like a Diplomat</H2>
        <p>The single biggest differentiator in MUN is preparation. Delegates who know their country&apos;s position cold can spend committee time on strategy instead of scrambling to figure out what they believe. Our <Link href="/blog/mun-country-research">country research method</Link> shows how to get there.</p>
        <ul>
          <li><strong>Read your country&apos;s UN voting record.</strong> The UN Digital Library and Dag Hammarskjöld Library both have full voting records. How has your country voted on similar resolutions in the last five years?</li>
          <li><strong>Find your country&apos;s official statements.</strong> Ministry of Foreign Affairs websites often publish speeches given at UN sessions. These are gold: they tell you exactly how your country phrases its positions.</li>
          <li><strong>Know the topic cold, not just your position.</strong> The best delegates can explain every major bloc&apos;s perspective, not just their own. This makes you a more effective negotiator.</li>
          <li><strong>Read the background guide.</strong> It exists for a reason. Chairs write questions to guide. Read it and answer every question from your country&apos;s perspective.</li>
        </ul>

        <PhotoFigure id="mun-jakarta-council" caption="Preparation shows at the table: delegates in a model Security Council." />


        <H2>Your Opening Speech: Make It Count</H2>
        <p>The opening speech (GSL speech) is your first impression. Most delegates use it to summarise their country&apos;s general position. Good delegates use it to signal leadership and attract bloc members.</p>
        <ul>
          <li><strong>State your position clearly in the first thirty seconds.</strong> Do not make delegates guess where you stand.</li>
          <li><strong>Propose something.</strong> Even a vague framework (&quot;Denmark proposes a three-pillar approach to climate adaptation financing&quot;) gives other delegates something to react to and rally around.</li>
          <li><strong>End with a call to action.</strong> &quot;Denmark invites like-minded delegations to collaborate on a working paper addressing these priorities&quot; signals that you are ready to lead.</li>
        </ul>
        <Callout>Sixty seconds is enough time for a strong opening speech. Do not pad it. Say what your country believes, what you propose, and who you want to work with. Sit down.</Callout>

        <H2>Building a Bloc: The Real Game</H2>
        <p>Most awards go to delegates who drive resolution drafting. That requires a bloc. Here is how to build one:</p>
        <ul>
          <li><strong>Approach delegates during unmoderated caucuses, not formal debate.</strong> Walk up, introduce yourself by country, and ask their position on the key issue. Keep it short.</li>
          <li><strong>Find common ground first.</strong> Even opposing blocs usually agree on the problem. Start there and work outward to solutions. Our <Link href="/blog/mun-negotiation-tactics">negotiation guide</Link> covers the rest.</li>
          <li><strong>Be the one who starts the draft.</strong> Any working paper, even a rough one, draws people to you. Blank Google Docs have no gravity.</li>
          <li><strong>Be inclusive deliberately.</strong> Invite one or two delegates from opposing blocs into your working paper. This strengthens your resolution and earns the chair&apos;s respect.</li>
        </ul>

        <H2>Speaking in Debate: Quality Over Quantity</H2>
        <p>A <Link href="/blog/mun-common-mistakes">common mistake</Link> is raising your placard for every speaking slot regardless of what you have to say. Chairs and fellow delegates notice when speeches are filler. Say something substantive, or yield your time.</p>
        <ul>
          <li><strong>Respond to what was just said.</strong> The most impactful speeches directly engage with the previous speaker&apos;s argument. This shows you are listening, not just waiting to speak.</li>
          <li><strong>Use specific data.</strong> Numbers anchor arguments. &quot;Over 800 million people lack access to safe drinking water&quot; lands harder than &quot;many people face water scarcity.&quot;</li>
          <li><strong>Propose concrete operative clauses.</strong> Do not just describe the problem, propose a solution. This advances the committee&apos;s work and marks you as a constructive delegate.</li>
        </ul>

        <H2>Points and Motions: Use Them Strategically</H2>
        <p>Points of information, points of order, and motions are procedural tools. Used well, they show command of the room. Used poorly, they signal desperation or inexperience. See our guide to <Link href="/blog/mun-points-explained">points in MUN</Link> for when each one is in order.</p>
        <ul>
          <li><strong>Points of information:</strong> Ask a genuine clarifying question, not a disguised speech. Chairs respect brevity.</li>
          <li><strong>Motions for a moderated caucus:</strong> Propose one when formal debate has stalled and your bloc needs to make a specific argument in a focused setting.</li>
          <li><strong>Motion to extend the speakers list:</strong> Use this when you have not yet spoken and want to make sure you get a slot.</li>
        </ul>

        <H2>What Chairs Notice When Awarding Best Delegate</H2>
        <p>Awards vary by conference, but most chairs are looking for the same things: substantive contribution to debate, leadership in bloc-building, quality of resolution language, adherence to rules of procedure, and consistent, respectful engagement with all delegates, not just your allies.</p>
        <p>Being the loudest is not the same as being the best. The delegate who quietly drafts an amendment that bridges two opposing blocs often impresses more than the one who gives six speeches.</p>
        <p>To see the room from the other side, read <Link href="/blog/how-to-become-a-mun-chair">how to become a MUN chair</Link>.</p>
      </ArticleLayout>
    </>
  );
}
