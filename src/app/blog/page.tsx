import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'MUN Resources & Guides — Gavelling Blog',
  description: 'Practical guides for Model UN chairs and delegates: how to run a committee, manage the GSL, handle motions, and run great MUN sessions.',
  alternates: { canonical: 'https://gavelling.com/blog' },
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
];

export default function BlogIndexPage() {
  return (
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
  );
}
