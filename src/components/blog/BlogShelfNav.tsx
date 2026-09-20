'use client';

/**
 * The shelf rail at the top of /blog.
 *
 * It is a row of ANCHOR LINKS, not a filter. That is deliberate:
 *
 *  • A filter that hides cards would take posts out of the page, and /blog's
 *    job in the link graph is to be the one page that links to all of them
 *    with plain <a href>s (CLAUDE.md §4). Anchors move the reader instead of
 *    removing content, so every post is always in the HTML and always linked.
 *  • The rulebook (§7, Disliked) rules out dead-weight view toggles. A reader
 *    wants to get to the delegate guides, not to configure a list.
 *  • It makes the footer's and the breadcrumb's /blog#chairing links land
 *    somewhere real.
 *
 * The only thing JavaScript adds is the mark showing which shelf you are in,
 * and a sticky rail that keeps the shelves reachable all the way down. With
 * JavaScript off it is still a working row of links.
 *
 * Shaped as the bookmark flaps the owner asked for (§7, Liked): tabs that grow
 * out of the surface they belong to, not floating pills.
 */

import { useEffect, useState } from 'react';
import { SHELVES, SHELF_ORDER } from './blogTaxonomy';
import type { BlogCategory } from '@/app/blog/posts';

export default function BlogShelfNav({ counts }: { counts: Record<BlogCategory, number> }) {
  const [active, setActive] = useState<BlogCategory | null>(null);

  useEffect(() => {
    const read = () => {
      let current: BlogCategory | null = null;
      for (const key of SHELF_ORDER) {
        const node = document.getElementById(key);
        if (node && node.getBoundingClientRect().top <= 160) current = key;
      }
      setActive(current);
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return (
    // top-0 on a phone, but md:top-[72px] on desktop: SiteNav parks a fixed
    // glass link pill across the top 72px at every scroll position (z-40), so
    // anything sticking at 0 would slide underneath it.
    <div
      className="sticky top-0 z-20 -mx-4 mt-12 px-4 py-2.5 sm:-mx-8 sm:px-8 md:top-[72px]"
      style={{ background: 'rgba(237,231,216,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1.5px solid #DDD4C0' }}
    >
      <nav
        aria-label="Guide shelves"
        className="flex gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {SHELF_ORDER.map((key) => {
          const shelf = SHELVES[key];
          const Icon = shelf.icon;
          const on = active === key;
          return (
            <a
              key={key}
              href={`#${key}`}
              aria-current={on ? 'true' : undefined}
              className="inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-[13.5px] font-bold no-underline transition-colors"
              style={{
                color: on ? '#1B3828' : '#55483C',
                background: on ? '#FAF8F3' : 'transparent',
                boxShadow: on ? `inset 0 -3px 0 ${shelf.accent}` : 'inset 0 -3px 0 transparent',
              }}
            >
              <Icon size={16} strokeWidth={2.3} aria-hidden="true" style={{ color: on ? shelf.accent : '#9A8A78' }} />
              {shelf.label}
              <span className="tabular-nums font-normal" style={{ color: '#9A8A78' }}>
                {counts[key] ?? 0}
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
