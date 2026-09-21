'use client';

/**
 * The contents of a long guide.
 *
 * The LIST comes from the server (`collectHeadings` walked the post's own JSX),
 * so it is in the HTML, costs no layout shift and works with JavaScript off.
 * The only thing this client component adds is the live mark showing which
 * section the reader is in, and folding the phone version shut.
 *
 * Two forms, one source:
 *   • from `lg` a sticky rail beside the prose
 *   • below it a <details> above the prose, shut by default, because a phone
 *     screen should open on the article and not on its index
 *
 * Read-only: it observes headings and writes nothing.
 */

import { useEffect, useState } from 'react';
import { List } from 'lucide-react';
import type { Heading } from './prose';

/** Fewer than this and a contents list is furniture, not navigation. */
export const TOC_MIN_HEADINGS = 4;

function useActiveHeading(items: Heading[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const nodes = items
      .map((h) => document.getElementById(h.id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    // The active section is the last heading that has passed the top band of
    // the viewport. Deriving it from the observer's own entries alone gets it
    // wrong while a long section fills the screen and no heading is visible at
    // all, so the entries only tell us WHEN to recompute; the answer is read
    // from the headings' own positions.
    const recompute = () => {
      const line = 120;
      let current: string | null = null;
      for (const n of nodes) {
        if (n.getBoundingClientRect().top <= line) current = n.id;
        else break;
      }
      setActive(current ?? nodes[0].id);
    };

    const io = new IntersectionObserver(recompute, {
      rootMargin: '-110px 0px -65% 0px',
      threshold: [0, 1],
    });
    nodes.forEach((n) => io.observe(n));
    window.addEventListener('scroll', recompute, { passive: true });
    recompute();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', recompute);
    };
  }, [items]);

  return active;
}

function TocList({
  items,
  active,
  onPick,
}: {
  items: Heading[];
  active: string | null;
  onPick?: () => void;
}) {
  // Several guides number their own sections ("1. What Is a Motion in MUN?").
  // Numbering the rail as well gave "1. 1. What Is a Motion in MUN?", so the
  // rail only counts when the headings do not count themselves.
  const selfNumbered = items.some((h) => /^\d+[.)]\s/.test(h.label));

  return (
    <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
      {items.map((h, i) => {
        const on = h.id === active;
        return (
          <li key={h.id} className="m-0">
            <a
              href={`#${h.id}`}
              onClick={onPick}
              className="flex gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] leading-[1.45] no-underline transition-colors"
              style={{
                color: on ? '#1B3828' : '#55483C',
                fontWeight: on ? 700 : 400,
                background: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                // A left rule that fills in on the active row: the reader's
                // place in the guide, shown rather than only coloured.
                boxShadow: on ? 'inset 2.5px 0 0 var(--gv-accent)' : 'inset 2.5px 0 0 transparent',
              }}
            >
              {!selfNumbered && (
                <span
                  aria-hidden="true"
                  className="shrink-0 tabular-nums"
                  style={{ color: on ? 'var(--gv-accent)' : '#B3A48F', fontWeight: 600 }}
                >
                  {i + 1}
                </span>
              )}
              <span>{h.label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export default function ArticleToc({ items }: { items: Heading[] }) {
  const active = useActiveHeading(items);
  const [open, setOpen] = useState(false);
  if (items.length < TOC_MIN_HEADINGS) return null;

  return (
    <>
      {/* Phone and tablet: shut by default, above the prose. */}
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mb-8 rounded-2xl lg:hidden"
        style={{ border: '1.5px solid #D8CDB6', background: '#FAF8F3' }}
      >
        <summary
          className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 text-[14.5px] font-bold"
          style={{ color: '#1B3828' }}
        >
          <List size={18} strokeWidth={2.2} style={{ color: 'var(--gv-accent)' }} aria-hidden="true" />
          In this guide
          <span className="ml-auto text-[13px] font-normal tabular-nums" style={{ color: '#9A8A78' }}>
            {items.length} sections
          </span>
        </summary>
        <div className="px-2 pb-3">
          <TocList items={items} active={active} onPick={() => setOpen(false)} />
        </div>
      </details>

      {/* Desktop: a sticky rail that keeps the reader's place.

          `sticky` is on the <nav> ITSELF, not on a div inside it. A sticky
          element only travels as far as its containing block: nested one level
          deeper, the rail's containing block was the nav, which is only as tall
          as the list, so it unstuck after about 230px and vanished for the rest
          of the article. On the nav, the containing block is the grid cell,
          which stretches to the height of the prose beside it.

          top-24 (96px) rather than 0: SiteNav parks a fixed glass link pill
          across the top 72px at every scroll position. */}
      <nav aria-label="Contents" className="sticky top-24 hidden self-start lg:block">
        <div>
          <p
            className="m-0 mb-3 flex items-center gap-2 pl-2.5 text-[12.5px] font-bold"
            style={{ color: '#1B3828' }}
          >
            <List size={16} strokeWidth={2.2} style={{ color: 'var(--gv-accent)' }} aria-hidden="true" />
            In this guide
          </p>
          <TocList items={items} active={active} />
        </div>
      </nav>
    </>
  );
}
