import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { articles, type BlogCategory } from './posts';
import { SHELVES, SHELF_ORDER, byNewest } from '@/components/blog/blogTaxonomy';
import BlogChrome from '@/components/blog/BlogChrome';
import BlogCard from '@/components/blog/BlogCard';
import BlogShelfNav from '@/components/blog/BlogShelfNav';
import { PhotoCreditsList } from '@/components/blog/BlogPhoto';
import type { PhotoId } from '@/components/blog/photos';
import { listGuides } from '@/lib/premiumGuides';
import GuideCardGrid from '../guides/GuideCardGrid';
import '../guides/guides.css';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Resources & Guides',
  description:
    'Practical guides for Model UN chairs and delegates: how to run a committee, manage the GSL, handle motions, and run great MUN sessions.',
  path: '/blog',
  ogTitle: 'MUN Resources & Guides: Gavelling Blog',
  ogDescription: 'Practical guides for Model UN chairs and delegates.',
});

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'MUN Resources & Guides',
  description: 'Practical guides for Model UN chairs and delegates.',
  url: `${SITE_URL}/blog`,
  itemListElement: articles.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE_URL}/blog/${a.slug}`,
    name: a.title,
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
  ],
};

export default function BlogIndexPage() {
  const lead = articles.find((a) => a.featured) ?? byNewest(articles)[0];
  // "Start here": the lead guide, then the guides a first-time reader of each
  // kind needs most. Unknown slugs drop out, so a rename costs a card, not the page.
  const startHere = [
    lead.slug,
    'what-is-model-un',
    'mun-for-beginners',
    'mun-position-paper-guide',
    'how-to-chair-first-mun',
    'start-a-mun-conference',
  ]
    .map((slug) => articles.find((a) => a.slug === slug))
    .filter((a, i, all): a is (typeof articles)[number] => !!a && all.indexOf(a) === i);
  const counts = SHELF_ORDER.reduce(
    (acc, key) => ({ ...acc, [key]: articles.filter((a) => a.category === key).length }),
    {} as Record<BlogCategory, number>,
  );

  // Every photo a card on this page shows, once, in first-seen order: the
  // cards carry a plain-text credit (a card is one link), and this list at the
  // foot is where each credit links to its source and its licence.
  const photoIds = [...new Set(articles.map((a) => a.photo).filter((p): p is PhotoId => !!p))];
  const premiumGuides = listGuides();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogChrome>
        <div className="mx-auto w-full max-w-[1060px] px-4 sm:px-8">
          <header className="pt-6 pb-9 sm:pt-10 sm:pb-12">
            <h1
              className="m-0 font-extrabold"
              style={{
                color: '#1B3828',
                fontSize: 'clamp(32px, 6vw, 52px)',
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
              }}
            >
              MUN Guides
            </h1>
            <p
              className="m-0 mt-4 max-w-[52ch]"
              style={{ color: '#55483C', fontSize: 'clamp(16.5px, 2.4vw, 19px)', lineHeight: 1.6 }}
            >
              {articles.length} free guides to running a Model UN committee, for chairs, delegates and secretariats.
            </p>
          </header>

          {/* Premium guides sit on top of the free posts (owner, 25 Sep 2026).
              Plain <a> cards, server rendered, so every guide and /guides are
              crawled from here (CLAUDE.md §4). The full text is behind the
              Unlimited paywall; see src/lib/premiumGuides. */}
          <section aria-labelledby="premium-guides" className="gvg pb-10 sm:pb-12">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2
                id="premium-guides"
                className="m-0 font-extrabold"
                style={{ color: '#1B3828', fontSize: 'clamp(21px, 3vw, 26px)', letterSpacing: '-0.014em' }}
              >
                Premium Guides
              </h2>
              <Link href="/guides" className="text-[15px] font-bold underline underline-offset-4" style={{ color: '#1B3828' }}>
                All premium guides
              </Link>
            </div>
            <p className="m-0 mt-2 max-w-[62ch] text-[15px] leading-[1.55]" style={{ color: '#55483C' }}>
              The opening sections are free to read. The rest comes with Gavelling Unlimited.
            </p>
            {/* Three: one each for delegates, chairs and organisers. */}
            <GuideCardGrid guides={premiumGuides} picks />
          </section>

          {/* The lead guide. One post is the protagonist of this page; the rest
              are shelved below it (rulebook §2: every viewport has one obvious
              protagonist). Which post it is comes from `featured` in the
              manifest, so it is an editorial decision, not a date accident. */}
          <section aria-labelledby="start-here" className="pb-2">
            <h2
              id="start-here"
              className="m-0 mb-3 text-[13px] font-bold uppercase"
              style={{ color: '#6A5A4A', letterSpacing: '0.08em' }}
            >
              Start here
            </h2>
            <div className="gv-start-here">
              {startHere.map((post) => (
                <BlogCard key={post.slug} post={post} compact />
              ))}
            </div>
          </section>

          {/* Not wrapped in a spacing div: a sticky element travels only inside
              its own parent's box, and a wrapper sized to the rail would let it
              stick for its own height and no further. Its parent is this page
              container, so it stays with the reader down the whole index. */}
          <BlogShelfNav counts={counts} />

          {SHELF_ORDER.map((key) => {
            const shelf = SHELVES[key];
            const Icon = shelf.icon;
            // Every post is listed under its shelf, the lead one included: a
            // reader who skipped past the top of the page should still find it
            // where it belongs, and /blog must link to every post exactly once
            // per shelf so the crawl graph is simple to reason about.
            const posts = byNewest(articles.filter((a) => a.category === key));
            if (posts.length === 0) return null;

            return (
              <section key={key} id={key} className="gv-shelf pt-12 sm:pt-14">
                <div
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-b pb-4"
                  style={{ borderColor: '#DDD4C0' }}
                >
                  <h2
                    className="m-0 inline-flex items-center gap-2.5 font-extrabold"
                    style={{ color: '#1B3828', fontSize: 'clamp(21px, 3vw, 26px)', letterSpacing: '-0.014em' }}
                  >
                    <Icon size={22} strokeWidth={2.2} aria-hidden="true" style={{ color: shelf.accent }} />
                    {shelf.label}
                  </h2>
                  <p className="m-0 text-[14.5px]" style={{ color: '#55483C' }}>
                    {shelf.lead}
                  </p>
                </div>

                <div
                  className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                  style={{ '--gv-accent': shelf.accent } as React.CSSProperties}
                >
                  {posts.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            );
          })}

          {photoIds.length > 0 ? (
            <section aria-labelledby="photo-credits" className="mt-16 border-t pt-8" style={{ borderColor: '#DDD4C0' }}>
              <h2 id="photo-credits" className="m-0 text-[17px] font-extrabold" style={{ color: '#1B3828' }}>
                Photo Credits
              </h2>
              <p className="m-0 mt-2 max-w-[62ch] text-[13.5px] leading-[1.6]" style={{ color: '#55483C' }}>
                Every photograph on these guides is used under an open licence or is in the public domain, and is
                credited beside it. If a photo is yours and you would like it credited differently or removed, email{' '}
                <a href="mailto:wearegavelling@gmail.com" className="font-bold underline" style={{ color: '#1B3828' }}>
                  wearegavelling@gmail.com
                </a>
                .
              </p>
              <div className="mt-5">
                <PhotoCreditsList ids={photoIds} />
              </div>
            </section>
          ) : null}
        </div>
      </BlogChrome>
    </>
  );
}
