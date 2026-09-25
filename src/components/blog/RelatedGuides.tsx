/**
 * "Keep reading": the six guides offered at the foot of every article.
 *
 * TWO JOBS, AND THE SECOND ONE IS LOAD-BEARING.
 *
 * For the reader: the guides nearest this one, same shelf first, because
 * somebody who just read about moderated caucuses wants the other procedure
 * guides and not a conference budgeting checklist.
 *
 * For the link graph: no post may be a dead end, and every post must be
 * reachable. That is why the same-shelf picks are TOPPED UP from the manifest
 * ring (the posts immediately after this one, wrapping around). The ring fill
 * always starts at the very next post, so post N always links to post N+1
 * whatever its shelf, the ring is unbroken, and every post is linked from at
 * least one other. Do not "improve" this into pure category matching: a shelf
 * with two posts on it would strand them.
 */

import { articles, type BlogPost } from '@/app/blog/posts';
import BlogCard from './BlogCard';

/** How many cards, and how many of them may come from the same shelf. */
const TOTAL = 6;
const SAME_SHELF_MAX = 3;

export function relatedPosts(currentSlug: string): BlogPost[] {
  const idx = articles.findIndex((a) => a.slug === currentSlug);
  if (idx === -1) return articles.slice(0, TOTAL);
  const current = articles[idx];
  const picked: BlogPost[] = [];
  const has = (p: BlogPost) => picked.some((q) => q.slug === p.slug);

  // Whatever the post named itself, first and in its own order. A slug that
  // does not resolve is skipped rather than thrown: a typo in a manifest entry
  // should cost one link, not the whole page.
  // Capped at TOTAL - 1 so the ring below always contributes at least one pick,
  // and its first pick is always the very next post. That is what keeps the
  // ring unbroken even for a post that names six of its own.
  for (const slug of current.related ?? []) {
    if (picked.length >= TOTAL - 1) break;
    const post = articles.find((a) => a.slug === slug);
    if (post && post.slug !== currentSlug && !has(post)) picked.push(post);
  }

  // Same shelf, walking outward from this post so the nearest ones come first.
  for (let step = 1; step < articles.length && picked.length < SAME_SHELF_MAX; step++) {
    for (const post of [articles[(idx + step) % articles.length], articles[(idx - step + articles.length) % articles.length]]) {
      if (picked.length >= SAME_SHELF_MAX) break;
      if (post.slug !== currentSlug && post.category === current.category && !has(post)) picked.push(post);
    }
  }

  // The ring: fill the rest from the posts that follow this one.
  for (let step = 1; step <= articles.length && picked.length < TOTAL; step++) {
    const post = articles[(idx + step) % articles.length];
    if (post.slug !== currentSlug && !has(post)) picked.push(post);
  }

  return picked;
}

export default function RelatedGuides({ currentSlug }: { currentSlug: string }) {
  const related = relatedPosts(currentSlug);

  return (
    <section aria-labelledby="related-guides">
      <h2
        id="related-guides"
        className="m-0 mb-6 font-extrabold"
        style={{ color: '#1B3828', fontSize: '24px', lineHeight: 1.2, letterSpacing: '-0.012em' }}
      >
        Keep Reading
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
