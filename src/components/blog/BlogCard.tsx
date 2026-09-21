/**
 * The card a post wears on the index and in the "keep reading" block.
 *
 * Two sizes, one anatomy: cover drawing, shelf (icon and word), headline,
 * standfirst, then date and reading time as plain typography. `lead` is the
 * one post at the top of /blog and lays the same parts out side by side on a
 * wide screen, on the deep forest cover rather than the light one.
 *
 * The whole card is ONE anchor, so the hit area is the card and the link is a
 * plain server-rendered <a href> (CLAUDE.md §4: every sitemap URL must be
 * reachable by one from another sitemap page).
 */

import Link from 'next/link';
import { CalendarDays, Clock, ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/app/blog/posts';
import { SHELVES, formatPostDate } from './blogTaxonomy';
import GuidePlate from './GuidePlate';
import { CardPhoto } from './BlogPhoto';

const C = {
  surface: '#FAF8F3',
  rule: '#D8CDB6',
  forest: '#1B3828',
  inkSoft: '#55483C',
  muted: '#9A8A78',
  gold: '#EED98A',
};

function Meta({ post, tone }: { post: BlogPost; tone: 'light' | 'deep' }) {
  const colour = tone === 'deep' ? 'rgba(238,217,138,0.72)' : C.muted;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]" style={{ color: colour }}>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays size={14} strokeWidth={2.1} aria-hidden="true" />
        <time dateTime={post.updated ?? post.date}>{formatPostDate(post.updated ?? post.date)}</time>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock size={14} strokeWidth={2.1} aria-hidden="true" />
        {post.readingMinutes} min read
      </span>
    </div>
  );
}

export default function BlogCard({
  post,
  lead = false,
  compact = false,
}: {
  post: BlogPost;
  lead?: boolean;
  compact?: boolean;
}) {
  const shelf = SHELVES[post.category];
  const Icon = shelf.icon;

  // The "Start here" picks at the top of /blog: a small thumbnail beside the
  // shelf and headline, nothing else, so six fit where one lead card used to.
  if (compact) {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className="gv-card group flex h-full items-stretch gap-3 overflow-hidden rounded-2xl p-2.5 no-underline"
        style={{ background: C.surface, border: `1.5px solid ${C.rule}`, '--gv-accent': shelf.accent } as React.CSSProperties}
      >
        <div className="w-[92px] shrink-0 overflow-hidden rounded-xl sm:w-[104px]" style={{ aspectRatio: '1 / 1' }}>
          {post.photo ? (
            <CardPhoto id={post.photo} thumb />
          ) : (
            <GuidePlate category={post.category} slug={post.slug} tone="light" bare />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 pr-1">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: shelf.accent }}>
            <Icon size={13} strokeWidth={2.3} aria-hidden="true" />
            {shelf.label}
          </span>
          <h3
            className="m-0 line-clamp-3 font-extrabold"
            style={{ color: C.forest, fontSize: '14.5px', lineHeight: 1.28, letterSpacing: '-0.005em' }}
          >
            {post.title}
          </h3>
          <span className="text-[11.5px]" style={{ color: C.muted }}>
            {post.readingMinutes} min read
          </span>
        </div>
      </Link>
    );
  }

  if (lead) {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className="gv-card gv-card-lead group grid overflow-hidden rounded-3xl no-underline md:grid-cols-[1fr_0.92fr]"
        style={
          {
            background: 'linear-gradient(135deg, #2A5A3C 0%, #1B3828 64%)',
            boxShadow: '0 18px 44px rgba(27,56,40,0.22)',
            '--gv-accent': shelf.accent,
          } as React.CSSProperties
        }
      >
        <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-10 md:order-1">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold" style={{ color: C.gold }}>
            <Icon size={17} strokeWidth={2.3} aria-hidden="true" />
            {shelf.label}
          </span>
          <h2
            className="m-0 font-extrabold"
            style={{
              color: '#EDE7D8',
              fontSize: 'clamp(23px, 3.4vw, 32px)',
              lineHeight: 1.16,
              letterSpacing: '-0.015em',
            }}
          >
            {post.title}
          </h2>
          <p className="m-0 text-[15.5px] leading-[1.6]" style={{ color: 'rgba(237,231,216,0.82)' }}>
            {post.description}
          </p>
          <Meta post={post} tone="deep" />
          <span
            className="mt-1 inline-flex items-center gap-2 text-[14px] font-extrabold transition-transform group-hover:translate-x-1"
            style={{ color: C.gold }}
          >
            Read the guide
            <ArrowRight size={17} strokeWidth={2.6} aria-hidden="true" />
          </span>
        </div>
        <div className="order-1 md:order-2" style={{ aspectRatio: '400 / 250' }}>
          {post.photo ? (
            <CardPhoto id={post.photo} lead />
          ) : (
            <GuidePlate category={post.category} slug={post.slug} tone="deep" bare />
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="gv-card group flex h-full flex-col overflow-hidden rounded-2xl no-underline"
      style={{ background: C.surface, border: `1.5px solid ${C.rule}`, '--gv-accent': shelf.accent } as React.CSSProperties}
    >
      <div style={{ aspectRatio: '400 / 250', borderBottom: `1.5px solid ${C.rule}` }}>
        {post.photo ? (
          <CardPhoto id={post.photo} />
        ) : (
          <GuidePlate category={post.category} slug={post.slug} tone="light" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: shelf.accent }}>
          <Icon size={15} strokeWidth={2.3} aria-hidden="true" />
          {shelf.label}
        </span>
        <h3
          className="m-0 font-extrabold"
          style={{ color: C.forest, fontSize: '17.5px', lineHeight: 1.26, letterSpacing: '-0.008em' }}
        >
          {post.title}
        </h3>
        <p className="m-0 text-[14px] leading-[1.58]" style={{ color: C.inkSoft }}>
          {post.description}
        </p>
        <div className="mt-auto pt-2.5">
          <Meta post={post} tone="light" />
        </div>
      </div>
    </Link>
  );
}
