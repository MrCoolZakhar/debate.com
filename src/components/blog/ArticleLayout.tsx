/**
 * ArticleLayout: every blog post's page, above and below its prose.
 *
 * A post file is now its metadata, its JSON-LD, and its words. Everything else
 * lives here, so the section cannot drift again: the 34 posts that existed
 * before this each hand-rolled a stylesheet, a header, a back link and a call
 * to action, and by the end no two of them agreed on a measure, a heading size
 * or a table width.
 *
 * ONE PROP IS REQUIRED: `slug`. Title, description, shelf, date, reading time
 * and cover art are all read from the manifest (src/app/blog/posts.ts), so the
 * index card and the article can never disagree about a post.
 *
 * See docs/blog-authoring.md for the post template.
 */

import Link from 'next/link';
import { ChevronRight, CalendarDays, Clock, ArrowRight } from 'lucide-react';
import { articles } from '@/app/blog/posts';
import { SHELVES, formatPostDate } from './blogTaxonomy';
import GuidePlate from './GuidePlate';
import ArticleToc from './ArticleToc';
import RelatedGuides from './RelatedGuides';
import BlogChrome from './BlogChrome';
import { collectHeadings } from './prose';
import { AuthorByline, AuthorBox } from './AuthorCredit';
import { HeroPhoto, PhotoCredit } from './BlogPhoto';

const C = {
  forest: '#1B3828',
  forestMid: '#2A5A3C',
  ink: '#1C1410',
  inkSoft: '#55483C',
  muted: '#9A8A78',
  rule: '#DDD4C0',
  gold: '#EED98A',
};

function Breadcrumb({ shelfLabel, shelfKey }: { shelfLabel: string; shelfKey: string }) {
  const sep = <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" style={{ color: '#B3A48F', flex: 'none' }} />;
  const link = 'no-underline transition-colors hover:text-[#1B3828]';
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12.5px]" style={{ color: C.muted }}>
      <Link href="/" className={link} style={{ color: C.muted }}>
        Home
      </Link>
      {sep}
      <Link href="/blog" className={link} style={{ color: C.muted }}>
        MUN guides
      </Link>
      {sep}
      <Link href={`/blog#${shelfKey}`} className={link} style={{ color: C.muted }}>
        {shelfLabel}
      </Link>
    </nav>
  );
}

/** Date and reading time. Plain typography with a glyph, never a pill: the
 *  rulebook (§7, Disliked) rules out count and status pills outright. */
function MetaLine({ date, updated, minutes }: { date: string; updated?: string; minutes: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px]" style={{ color: C.inkSoft }}>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays size={15} strokeWidth={2.1} aria-hidden="true" style={{ color: C.muted }} />
        <time dateTime={updated ?? date}>{formatPostDate(updated ?? date)}</time>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock size={15} strokeWidth={2.1} aria-hidden="true" style={{ color: C.muted }} />
        {minutes} minute read
      </span>
    </div>
  );
}

/**
 * The one call to action, at the foot of the article where a reader who
 * finished has a reason to act. `pitch` is the post's own sentence: a guide to
 * the right of reply should not end on the same line as a guide to conference
 * budgets.
 */
function ArticleCta({ pitch }: { pitch: string }) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl px-6 py-9 sm:px-11 sm:py-11"
      style={{
        background: `linear-gradient(135deg, ${C.forestMid} 0%, ${C.forest} 62%)`,
        boxShadow: '0 18px 44px rgba(27,56,40,0.22)',
      }}
    >
      {/* the gold glow the rulebook asks for on a protagonist */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(238,217,138,0.20) 0%, transparent 68%)' }}
      />
      <div className="relative max-w-[34rem]">
        <p className="m-0 text-[13px] font-bold" style={{ color: C.gold }}>
          Run it on Gavelling
        </p>
        <p className="m-0 mt-2.5 text-[21px] font-extrabold leading-[1.28] sm:text-[24px]" style={{ color: '#EDE7D8' }}>
          {pitch}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/create/sessions"
            className="gv-lift-dark inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[14.5px] font-extrabold no-underline"
            style={{ background: C.gold, color: '#1C1410' }}
          >
            Start a free session
            <ArrowRight size={17} strokeWidth={2.6} aria-hidden="true" />
          </Link>
          <Link
            href="/conferences/explore"
            className="inline-flex items-center justify-center rounded-xl px-5 py-3.5 text-[14.5px] font-bold no-underline transition-colors"
            style={{ color: C.gold, border: '1.5px solid rgba(238,217,138,0.34)' }}
          >
            Explore conferences
          </Link>
        </div>
        <p className="m-0 mt-4 text-[12.5px]" style={{ color: 'rgba(238,217,138,0.6)' }}>
          Free, no account, delegates join with a six character code.
        </p>
      </div>
    </section>
  );
}

export default function ArticleLayout({
  slug,
  title,
  dek,
  pitch = 'Run your next committee on Gavelling: roll call, speakers, motions and voting in one place.',
  children,
}: {
  /** The post's slug. Everything else is looked up from the manifest. */
  slug: string;
  /** Only when the article's own headline should differ from the manifest
   *  title (which is written for a search result and can be longer). */
  title?: string;
  /** Only when the standfirst should differ from the manifest description. */
  dek?: string;
  /** The sentence in the call to action. Say what THIS guide's reader gets. */
  pitch?: string;
  children: React.ReactNode;
}) {
  const post = articles.find((a) => a.slug === slug);
  if (!post) {
    // A post file with a slug that is not in the manifest would be invisible to
    // the sitemap, the index and the cross-links. Fail loudly at render rather
    // than ship an orphan page that nothing links to.
    throw new Error(
      `ArticleLayout: "${slug}" is not in src/app/blog/posts.ts. Add it to the manifest (see docs/blog-authoring.md).`,
    );
  }

  const shelf = SHELVES[post.category];
  const ShelfIcon = shelf.icon;
  // headings are collected from the post's own JSX, on the server

  const headings = collectHeadings(children);

  return (
    <BlogChrome>
      {/* The shelf's colour is published once, here, as a custom property. Every
          accent below it (prose rules, list markers, the contents rail, the
          cover drawing) reads `var(--gv-accent)`, so a new shelf needs no edit
          anywhere but blogTaxonomy.ts. */}
      <div style={{ '--gv-accent': shelf.accent } as React.CSSProperties}>
        <div className="mx-auto w-full max-w-[920px] px-4 pt-4 sm:px-8 sm:pt-6">
          <Breadcrumb shelfLabel={shelf.label} shelfKey={shelf.key} />

          <header className="mt-6 grid items-center gap-8 lg:mt-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12">
            <div>
              <Link
                href={`/blog#${shelf.key}`}
                className="inline-flex items-center gap-2 text-[13px] font-bold no-underline"
                style={{ color: shelf.accent }}
              >
                <ShelfIcon size={17} strokeWidth={2.3} aria-hidden="true" />
                {shelf.label}
              </Link>

              <h1
                className="m-0 mt-3 font-extrabold"
                style={{
                  color: C.forest,
                  fontSize: 'clamp(28px, 5.2vw, 43px)',
                  lineHeight: 1.11,
                  letterSpacing: '-0.018em',
                }}
              >
                {title ?? post.title}
              </h1>

              <p
                className="m-0 mt-4 max-w-[46ch]"
                style={{ color: C.inkSoft, fontSize: 'clamp(16.5px, 2.2vw, 18.5px)', lineHeight: 1.6 }}
              >
                {dek ?? post.description}
              </p>

              {post.author ? (
                <div className="mt-6">
                  <AuthorByline author={post.author} />
                </div>
              ) : null}

              <div className={post.author ? 'mt-4' : 'mt-6'}>
                <MetaLine date={post.date} updated={post.updated} minutes={post.readingMinutes} />
              </div>
            </div>

            {/* Deliberately NOT `order-first`: on a phone the headline is what
                the reader came for, so the cover follows the title block
                rather than pushing it down the screen. */}
            {post.photo ? (
              <figure className="m-0">
                <div
                  className="overflow-hidden rounded-2xl"
                  style={{ aspectRatio: '400 / 250', boxShadow: '0 14px 36px rgba(27,56,40,0.20)', background: '#DDD4C0' }}
                >
                  <HeroPhoto id={post.photo} />
                </div>
                <figcaption className="mt-2">
                  <PhotoCredit id={post.photo} />
                </figcaption>
              </figure>
            ) : (
              <div
                className="overflow-hidden rounded-2xl"
                style={{ aspectRatio: '400 / 250', boxShadow: '0 14px 36px rgba(27,56,40,0.20)' }}
              >
                <GuidePlate category={post.category} slug={post.slug} tone="deep" />
              </div>
            )}
          </header>

          <hr className="mt-10 mb-9 border-0" style={{ height: '1.5px', background: C.rule }} />

          {/* Prose left, contents right. The contents come FIRST in the DOM so
              that on a phone, where the grid collapses to one column, the
              folded "In this guide" sits above the article rather than after
              it; on desktop the two are placed explicitly. */}
          <div className="grid grid-cols-1 gap-x-14 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
            <div className="lg:col-start-2 lg:row-start-1">
              <ArticleToc items={headings} />
            </div>
            {post.author ? (
              <div className="lg:col-start-1 lg:row-start-1">
                <article className="gv-prose">{children}</article>
                <AuthorBox author={post.author} />
              </div>
            ) : (
              <article className="gv-prose lg:col-start-1 lg:row-start-1">{children}</article>
            )}
          </div>

          <div className="mt-14">
            <RelatedGuides currentSlug={post.slug} />
          </div>

          <div className="mt-12">
            <ArticleCta pitch={pitch} />
          </div>
        </div>
      </div>
    </BlogChrome>
  );
}
