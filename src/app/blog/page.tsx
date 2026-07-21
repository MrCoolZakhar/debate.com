import type { Metadata } from 'next';
import Link from 'next/link';
import { articles } from './posts';

export const metadata: Metadata = {
  title: 'MUN Resources & Guides',
  description: 'Practical guides for Model UN chairs and delegates: how to run a committee, manage the GSL, handle motions, and run great MUN sessions.',
  alternates: { canonical: 'https://gavelling.com/blog' },
  openGraph: {
    title: 'MUN Resources & Guides: Gavelling Blog',
    description: 'Practical guides for Model UN chairs and delegates.',
    url: 'https://gavelling.com/blog',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

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
