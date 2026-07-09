import Link from 'next/link';
import { articles } from '@/app/blog/posts';

// Cross-links each post to 5 siblings so no post is a dead end in the link graph.
// Selection: the 5 posts following the current one in the manifest, wrapping
// around, excluding the current slug. (No category field exists on posts.)
export default function RelatedGuides({ currentSlug }: { currentSlug: string }) {
  const idx = articles.findIndex((a) => a.slug === currentSlug);
  const start = idx === -1 ? 0 : idx;
  const related: typeof articles = [];
  for (let i = 1; related.length < 5 && i <= articles.length; i++) {
    const post = articles[(start + i) % articles.length];
    if (post.slug !== currentSlug) related.push(post);
  }

  return (
    <section aria-label="Related guides" style={{ marginTop: '48px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1B3828', marginBottom: '16px' }}>
        Related guides
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{
              display: 'block',
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: '#EDE7D8',
              border: '1px solid #DDD4C0',
              borderLeft: '3px solid #B6871F',
              color: '#1B3828',
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: 1.4,
              textDecoration: 'none',
            }}
          >
            {post.title}
          </Link>
        ))}
      </div>
    </section>
  );
}
