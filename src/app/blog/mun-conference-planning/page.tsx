import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import Link from 'next/link';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'How to Plan a MUN Conference: Step-by-Step for Schools and Clubs',
  description:
    'A complete step-by-step guide to planning a Model UN conference from scratch: timeline, committees, registration, background guides, technology, and logistics.',
  path: '/blog/mun-conference-planning',
  ogDescription:
    'Plan your first MUN conference with this complete organiser guide.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Plan a MUN Conference: Step-by-Step for Schools and Clubs',
  description: 'Step-by-step MUN conference planning guide.',
  url: 'https://gavelling.com/blog/mun-conference-planning',
  datePublished: '2026-06-07',
  dateModified: '2026-06-07',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-planning' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Conference Planning', item: 'https://gavelling.com/blog/mun-conference-planning' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-planning"
        pitch="Set up all your conference committees in Gavelling for free: no software installation, no IT team required."
      >
        <p>Planning a Model UN conference from scratch is genuinely hard. You are simultaneously managing academic content, event logistics, people management, and technology, often with a team of students who have never done it before. This guide gives you a realistic, chronological plan for pulling it off well. If you are still deciding whether to host at all, read <Link href="/blog/start-a-mun-conference">how to start a MUN conference</Link> first.</p>

        <H2>Decide Your Scope First</H2>
        <p>Before anything else, answer three questions: How many delegates? How many committees? How many days? These decisions cascade into every other planning choice. A first-time conference organiser is better served by a small, excellent conference (50–80 delegates, three committees, one day) than an ambitious one that collapses under its own complexity.</p>
        <Callout>Start smaller than feels ambitious. A tight, well-run 60-delegate conference is a better reputation-builder than a chaotic 200-delegate one. You can always grow next year.</Callout>

        <H2>Eight Months Out: Foundation</H2>
        <ul>
          <li><strong>Book your venue.</strong> Our guide to <Link href="/blog/mun-conference-venue-logistics">venue logistics</Link> covers this step in detail. School cafeterias, library halls, university rooms: whatever you can secure. You need one room per committee plus a space for opening and closing ceremonies.</li>
          <li><strong>Set your date.</strong> Avoid exam periods, major holidays, and dates that clash with other regional conferences that would compete for delegates.</li>
          <li><strong>Form your secretariat.</strong> At minimum: a Secretary-General (overall lead), a Director-General (operations), committee directors for each committee, and a communications/registration lead. See <Link href="/blog/mun-secretariat-roles">MUN secretariat roles</Link> for what each one does.</li>
          <li><strong>Choose your conference name and branding.</strong> Register a domain and set up a simple website or Google Form for interest registration.</li>
        </ul>

        <H2>Six Months Out: Academic Planning</H2>
        <ul>
          <li><strong>Finalise your committee list and topics.</strong> For each committee, choose one topic that is timely, debatable, and appropriate for your expected delegate experience level.</li>
          <li><strong>Write your rules of procedure document.</strong> You can adapt NMUN&apos;s publicly available rules or write your own simplified version. The important thing is that it exists and is consistent across committees.</li>
          <li><strong>Recruit and brief your dais team.</strong> Each committee needs a chair and at least one co-chair. Find experienced MUN delegates from your school or network.</li>
          <li><strong>Open delegate registration.</strong> Set a registration fee if needed to cover venue and catering costs. Our <Link href="/blog/mun-conference-budget">MUN conference budget</Link> guide helps you work out the number.</li>
        </ul>

        <H2>Four Months Out: Background Guides</H2>
        <p>Each committee&apos;s chair team should produce a background guide of ten to fifteen pages. This is the most time-consuming academic deliverable. Give chairs a template and a hard deadline (eight weeks before the conference), and review drafts before publication.</p>
        <H3>Background Guide Structure</H3>
        <ul>
          <li>Committee introduction and mandate</li>
          <li>Topic background (history, current situation, key statistics)</li>
          <li>Bloc positions (how different country groups view the issue)</li>
          <li>Previous UN action (resolutions, treaties, programmes)</li>
          <li>Questions to consider</li>
          <li>References and further reading</li>
        </ul>

        <H2>Two Months Out: Registration and Assignments</H2>
        <ul>
          <li><strong>Close registration</strong> and finalise your delegate count.</li>
          <li><strong><Link href="/blog/mun-country-allocation">Assign countries</Link>.</strong> Each registered school or team gets a list of countries across committees. Try to give schools country assignments that match their team&apos;s experience level.</li>
          <li><strong>Send confirmation packages</strong>: committee assignments, country assignments, background guides, rules of procedure, schedule.</li>
          <li><strong>Set up your committee management platform.</strong> Create all committee sessions in Gavelling, configure delegate lists, and share chair access codes with your dais team so they can familiarise themselves before conference day.</li>
        </ul>

        <H2>Conference Week: Final Checks</H2>
        <ul>
          <li>Confirm venue access and room setup</li>
          <li>Test all technology (projectors, Wi-Fi, committee management software)</li>
          <li>Brief your full secretariat team: everyone should know their role and their fallback if something goes wrong</li>
          <li>Prepare printed name placards if using physical ones</li>
          <li>Prepare award certificates and materials</li>
        </ul>

        <H2>Conference Day</H2>
        <p>Run a tight opening ceremony, under thirty minutes. Get delegates into committee sessions as fast as possible. The energy peaks early; capitalise on it. Have secretariat members assigned to roam between committees and report issues back to the Secretary-General in real time.</p>

        <H2>After the Conference</H2>
        <p>Send a survey within 48 hours. Debrief your secretariat. Document what worked and what did not. Write it down before memory fades. Share your notes with next year&apos;s planning team. This institutional knowledge is more valuable than any single conference outcome.</p>
      </ArticleLayout>
    </>
  );
}
