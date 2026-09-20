import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Crisis Committee Guide: How Crisis Committees Work',
  description:
    'A complete guide to MUN crisis committees: how crisis arcs work, directive writing, the crisis staff, backroom vs frontroom, and how to perform well as a delegate.',
  path: '/blog/mun-crisis-committee-guide',
  ogDescription:
    'Master crisis committees in Model UN with this complete guide.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Crisis Committee Guide: How Crisis Committees Work',
  description: 'Complete guide to MUN crisis committees.',
  url: 'https://gavelling.com/blog/mun-crisis-committee-guide',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-crisis-committee-guide' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Crisis Committee Guide', item: 'https://gavelling.com/blog/mun-crisis-committee-guide' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-crisis-committee-guide"
        pitch="Run your MUN sessions, crisis or GA, with Gavelling's real-time committee management platform."
      >

        <p>Crisis committees are the most dynamic format in Model UN. Where General Assembly committees debate policy over hours or days, crisis committees react to rapidly evolving fictional scenarios in real time. They demand faster thinking, stronger individual character play, and a completely different set of skills from standard MUN. Here is everything you need to know.</p>

        <H2>What Is a Crisis Committee?</H2>
        <p>A crisis committee is a small MUN committee, typically ten to twenty delegates, in which a fictional or historically-based scenario unfolds in real time throughout the conference. The committee might be a cabinet, a corporate board, a historical council of war, or an intelligence agency. Crisis updates (called "crisis updates" or "news flashes") arrive from the crisis staff, and the committee must respond through formal directives and resolutions.</p>
        <p>Unlike GA committees where you represent a country, in crisis you often represent a named individual with a specific role, agenda, and portfolio of assets.</p>

        <H2>Frontroom vs. Backroom</H2>
        <p>Crisis committees operate on two tracks simultaneously:</p>
        <H3>Frontroom (Committee)</H3>
        <p>The formal committee session where delegates debate, pass directives, and respond to crisis updates collectively. It looks similar to a standard MUN committee (speakers lists, motions, caucuses) but moves faster and the content reacts to live updates.</p>
        <H3>Backroom (Personal Portfolio)</H3>
        <p>Each delegate also has a personal portfolio: the resources, relationships, and powers specific to their character. During unmoderated caucuses, delegates submit personal directives to the crisis staff: secret orders to assets, private communications, covert operations. The crisis staff evaluates these directives and may grant, deny, or modify the outcomes, feeding the results back into the scenario.</p>
        <Callout>The best crisis delegates play both games simultaneously: leading frontroom debate while running a strategic backroom operation that advances their character's personal agenda.</Callout>

        <H2>What Is a Directive?</H2>
        <p>A directive is a written order submitted to the crisis staff, either as a collective committee directive (voted on like a resolution) or as a personal backroom directive. Directives typically instruct specific assets or officials to take actions: "Deploy the 3rd Infantry Division to the northern border," or "Transfer $2M from the discretionary fund to the offshore account."</p>
        <p>The crisis staff responds to directives by updating the scenario. A well-written directive is specific, realistic within the scenario's rules, and accounts for potential failure. Vague directives ("deal with the situation in the north") get vague results.</p>

        <H2>How Crisis Arcs Work</H2>
        <p>The crisis staff pre-plans a broad narrative arc: an escalating series of events designed to challenge the committee. But skilled crisis directors adapt the arc in real time based on how delegates respond. If the committee makes an unexpectedly brilliant move, the arc adjusts. If delegates miss a key signal, the crisis escalates. The best crisis scenarios feel genuinely unpredictable because they partially are.</p>

        <H2>Performing Well in Crisis</H2>
        <ul>
          <li><strong>Know your character cold.</strong> Read the background guide and character sheet thoroughly. What does your character want? What resources do they control? Who are their allies and enemies?</li>
          <li><strong>Be specific in directives.</strong> "Activate Agent CARDINAL to surveil the finance minister's communications via SIGINT intercepts" is actionable. "Find out what the finance minister is doing" is not.</li>
          <li><strong>Build coalitions early.</strong> Even in crisis, you need allies. Find delegates whose characters have compatible interests and coordinate both frontroom positions and backroom operations.</li>
          <li><strong>Take risks.</strong> Crisis rewards bold action. A clever backroom move that partially fails is more impressive than safe, conservative play.</li>
          <li><strong>Respond to the crisis, not just to debate.</strong> When a crisis update arrives, read it carefully and react to the specific developments. Do not just continue making your pre-planned arguments.</li>
        </ul>

        <H2>Common Crisis Formats</H2>
        <ul>
          <li><strong>Cabinet crisis:</strong> The committee is a national cabinet managing a domestic or international emergency.</li>
          <li><strong>Historical crisis:</strong> A council set in a historical moment (the Cuban Missile Crisis, WWII-era cabinet, Cold War intelligence committee).</li>
          <li><strong>Corporate crisis:</strong> A board of directors navigating a scandal, merger, or market collapse.</li>
          <li><strong>Continuous crisis (JCC):</strong> Two linked committees, Joint Crisis Committees, that interact with each other through the crisis staff, often representing opposing sides of a conflict.</li>
        </ul>
      </ArticleLayout>
    </>
  );
}
