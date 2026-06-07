import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'MUN Resources & Guides — Gavelling Blog',
  description: 'Practical guides for Model UN chairs and delegates: how to run a committee, manage the GSL, handle motions, and run great MUN sessions.',
  alternates: { canonical: 'https://gavelling.com/blog' },
  openGraph: {
    title: 'MUN Resources & Guides — Gavelling Blog',
    description: 'Practical guides for Model UN chairs and delegates.',
    url: 'https://gavelling.com/blog',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

const articles = [
  {
    slug: 'how-to-run-mun-committee',
    title: "How to Run a Model UN Committee — Chair's Complete Guide (2026)",
    description: 'Step-by-step guide covering roll call, GSL, caucuses, voting procedures, and closing the session.',
  },
  {
    slug: 'best-mun-software-2026',
    title: 'Best MUN Software in 2026 — Full Comparison for Chairs and Directors',
    description: 'Comparing dedicated MUN tools, spreadsheets, and timer apps to help you pick the right setup for your conference.',
  },
  {
    slug: 'general-speakers-list-guide',
    title: 'General Speakers List (GSL) in MUN — Complete Guide for Chairs and Delegates',
    description: 'Everything you need to know about the GSL: how it works, yielding time, points, and chair tips.',
  },
  {
    slug: 'mun-motions-explained',
    title: 'MUN Motions Explained — Types, How to Propose, and Voting Rules',
    description: 'A complete reference for every motion type: moderated caucus, unmoderated caucus, adjournment, and more.',
  },
  {
    slug: 'how-to-chair-first-mun',
    title: 'How to Chair Your First MUN Committee — Practical Guide for New Chairs',
    description: 'A warm, practical guide for first-time chairs covering preparation, opening, debate management, and handling the unexpected.',
  },
  {
    slug: 'how-to-run-moderated-caucus',
    title: 'How to Run a Moderated Caucus in MUN — Chair Guide',
    description: 'Complete chair guide to opening, managing speaker time, keeping order, and closing a moderated caucus.',
  },
  {
    slug: 'unmoderated-caucus-guide',
    title: 'Unmoderated Caucus in MUN — What It Is and How to Use It',
    description: 'What an unmoderated caucus is, how delegates should use the time, and tips for chairs on managing unmod periods.',
  },
  {
    slug: 'mun-voting-procedures',
    title: 'MUN Voting Procedures Explained — In Favour, Against, Abstain',
    description: 'Simple majority, supermajority, roll call votes, abstentions, and everything else about voting in MUN committees.',
  },
  {
    slug: 'mun-delegate-tips',
    title: 'MUN Delegate Tips — How to Stand Out in Any Committee',
    description: 'Practical tips for research, speeches, bloc-building, and winning Best Delegate at any MUN conference.',
  },
  {
    slug: 'mun-position-paper-guide',
    title: 'How to Write a MUN Position Paper — Format, Tips & Examples',
    description: 'Step-by-step guide to the correct format, what to include, common mistakes, and examples that impress chairs.',
  },
  {
    slug: 'mun-resolution-writing',
    title: 'How to Write a MUN Resolution — Clauses, Format & Examples',
    description: 'Preambulatory clauses, operative clauses, correct format, sponsor rules, and getting your resolution passed.',
  },
  {
    slug: 'mun-rules-of-procedure',
    title: 'MUN Rules of Procedure — Complete Reference Guide',
    description: 'Points, motions, yields, quorum, voting thresholds, and how rules differ across major MUN conferences.',
  },
  {
    slug: 'mun-security-council-guide',
    title: 'MUN Security Council Guide — Veto, P5, and How UNSC Works',
    description: 'Veto power, P5 dynamics, procedure differences, and how to chair or delegate in a Security Council simulation.',
  },
  {
    slug: 'mun-crisis-committee-guide',
    title: 'MUN Crisis Committee Guide — How Crisis Committees Work',
    description: 'Crisis arcs, directive writing, backroom vs frontroom, and how to perform as a delegate in a MUN crisis committee.',
  },
  {
    slug: 'free-mun-tools',
    title: 'Free MUN Tools in 2026 — Best Software for Chairs and Delegates',
    description: 'A detailed comparison of free MUN tools: Gavelling, spreadsheets, timer apps, and what actually works in a real session.',
  },
  {
    slug: 'mun-conference-preparation',
    title: 'How to Prepare for a MUN Conference — Complete Pre-Conference Checklist',
    description: 'Week-by-week preparation timeline: research, position papers, practice speeches, rules, and what to pack.',
  },
  {
    slug: 'mun-public-speaking-tips',
    title: 'MUN Public Speaking Tips — How to Speak Confidently in Committee',
    description: 'Structure speeches, manage nerves, use your voice effectively, and make every speaking slot count.',
  },
  {
    slug: 'mun-opening-speech',
    title: 'How to Write a MUN Opening Speech — Templates and Examples',
    description: 'Four-part structure, length guide, real example speeches, and the most common mistakes to avoid.',
  },
  {
    slug: 'mun-working-paper-guide',
    title: 'MUN Working Paper Guide — How to Draft, Merge, and Introduce',
    description: 'Writing working papers quickly, getting sponsors, merging blocs, and converting to a draft resolution.',
  },
  {
    slug: 'mun-amendment-guide',
    title: 'MUN Amendments Explained — Friendly vs Unfriendly, How to Submit',
    description: 'Friendly and unfriendly amendments, how to submit them, voting order, and strategic use in committee.',
  },
  {
    slug: 'mun-right-of-reply',
    title: 'Right of Reply in MUN — When and How to Use It',
    description: 'What qualifies for a right of reply, how to request it, chair discretion, and how to use it effectively.',
  },
  {
    slug: 'tour-de-table-mun',
    title: 'Tour de Table in MUN — What It Is and How Chairs Run It',
    description: 'How tour de table differs from the GSL, when to use it, and how chairs manage it with software.',
  },
  {
    slug: 'mun-director-guide',
    title: 'MUN Director Guide — How to Run a Model UN Conference',
    description: 'Planning committees, briefing chairs, managing logistics, overseeing awards, and wrapping up successfully.',
  },
  {
    slug: 'mun-chair-script',
    title: 'MUN Chair Script — Exact Phrases for Every Situation',
    description: 'Word-for-word chair language for opening, roll call, GSL, caucuses, voting, points of order, and closing.',
  },
  {
    slug: 'mun-bloc-building',
    title: 'MUN Bloc Building — How to Form and Lead a Coalition',
    description: 'How to find allies, draft collaboratively, handle defections, and lead a coalition to a passed resolution.',
  },
  {
    slug: 'mun-awards-guide',
    title: 'MUN Awards Guide — How Best Delegate Is Chosen',
    description: 'What chairs look for, how to improve your score, and what consistently disqualifies delegates from awards.',
  },
  {
    slug: 'mun-conference-planning',
    title: 'How to Plan a MUN Conference — Step-by-Step for Schools and Clubs',
    description: 'Complete planning timeline: venue, committees, background guides, registration, technology, and conference day.',
  },
  {
    slug: 'mun-technology-guide',
    title: 'MUN Technology Guide — Software, Apps, and Tools for Modern Committees',
    description: 'Committee management software, document collaboration, delegate apps, and what chairs and directors need.',
  },
  {
    slug: 'mun-online-committees',
    title: 'Online MUN Committees — How to Chair and Participate Remotely',
    description: 'Managing procedure remotely, keeping delegates engaged, and the tools that work for virtual and hybrid MUN.',
  },
  {
    slug: 'mun-faculty-advisor-guide',
    title: 'MUN Faculty Advisor Guide — How to Prepare and Support Your Team',
    description: 'Building a MUN program, choosing conferences, reviewing position papers, and supporting delegates at the event.',
  },
  {
    slug: 'mun-points-of-order',
    title: 'Points of Order in MUN — When to Use Them and When Not To',
    description: 'What qualifies as a point of order, how to raise it correctly, and how chairs should rule — for delegates and chairs.',
  },
];

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'MUN Resources & Guides',
  description: 'Practical guides for Model UN chairs and delegates.',
  url: 'https://gavelling.com/blog',
  itemListElement: articles.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `https://gavelling.com/blog/${a.slug}`,
    name: a.title,
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
  ],
};

export default function BlogIndexPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    <div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8', padding: '48px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6A5A4A', textDecoration: 'none', display: 'inline-block', marginBottom: '32px' }}>
          ← Back to Gavelling
        </Link>
        <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#1B3828', marginBottom: '8px', lineHeight: 1.2 }}>
          MUN Resources
        </h1>
        <p style={{ fontSize: '16px', color: '#6A5A4A', marginBottom: '48px' }}>
          Practical guides for chairs and delegates.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/blog/${a.slug}`}
              style={{ display: 'block', padding: '24px', borderRadius: '16px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', textDecoration: 'none' }}
            >
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#1B3828', marginBottom: '6px', lineHeight: 1.3 }}>
                {a.title}
              </h2>
              <p style={{ fontSize: '14px', color: '#6A5A4A', margin: 0 }}>{a.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
