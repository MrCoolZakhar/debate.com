/**
 * The authoring kit: the handful of elements a post is allowed to use.
 *
 * A post's body is plain semantic HTML (<p>, <ul>, <li>, <strong>, <a>) styled
 * by `.gv-prose` in src/app/blog/blog.css, plus the five components below for
 * the things plain HTML cannot express on its own. Nothing here takes a colour,
 * a size or a `style`: if a post could restyle itself, 50 posts would drift
 * into 50 designs, which is exactly how the old section ended up with 34
 * hand-rolled stylesheets.
 *
 * All server components. No state, no effects, no client bundle.
 */

import { Info } from 'lucide-react';

/** Slug for a heading, so `<H2>Chair's discretion</H2>` gets a stable anchor
 *  and the contents rail (ArticleToc) can find and name it. Deliberately the
 *  same shape as a URL slug: lowercase, words joined by hyphens. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Flatten a heading's children to the plain string the id and the contents
 *  rail need. Handles the one nesting a heading ever has: <strong>, <em>. */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    return textOf((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

/**
 * A section heading. ALWAYS use this rather than a bare <h2>: it mints the id,
 * hangs the copyable anchor off it, and is what the contents rail counts when
 * it decides whether the post is long enough to need contents at all.
 */
export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  const anchor = id ?? headingId(textOf(children));
  return (
    <h2 id={anchor}>
      {children}
      <a href={`#${anchor}`} className="gv-anchor" aria-label="Link to this section">
        #
      </a>
    </h2>
  );
}

/** A sub-heading. Anchored too, so a deep link into a long guide can be exact,
 *  but never listed in the contents: three levels is a table of contents
 *  nobody reads. */
export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h3 id={id ?? headingId(textOf(children))}>{children}</h3>;
}

export interface Heading {
  id: string;
  label: string;
}

/**
 * Walk a post's body and collect its <H2> headings, in order.
 *
 * This runs on the SERVER, at render, over the JSX tree the post file already
 * is. That matters: it means the contents rail ships inside the HTML rather
 * than being assembled by a script after hydration, so it costs no layout
 * shift, it is there with JavaScript off, and a crawler sees the in-page links.
 * It also means an author never maintains a contents list: writing <H2> IS
 * declaring a contents entry, and the two can never disagree.
 *
 * Recurses through arrays, fragments and any wrapper element, so headings
 * produced by a `.map()` or nested inside a <section> are still found.
 */
export function collectHeadings(node: React.ReactNode, out: Heading[] = []): Heading[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectHeadings(child, out);
    return out;
  }
  const el = node as { type?: unknown; props?: { children?: React.ReactNode; id?: string } };
  if (!el || typeof el !== 'object' || !('props' in el)) return out;
  if (el.type === H2) {
    const label = textOf(el.props?.children);
    if (label) out.push({ id: el.props?.id ?? headingId(label), label });
    return out; // never look for a heading inside a heading
  }
  collectHeadings(el.props?.children, out);
  return out;
}

/**
 * The aside a reader should remember: a rule of thumb, a caution, the thing
 * that catches people out. One per section at most.
 */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="gv-callout">
      <Info size={19} strokeWidth={2.2} aria-hidden="true" />
      <div>{typeof children === 'string' ? <p>{children}</p> : children}</div>
    </aside>
  );
}

/**
 * Words to say out loud from the dais. Forest ground, gold quote mark, set in
 * the one serif the app loads. Use it ONLY for actual spoken script: it is
 * loud, and it stops meaning "say this" if it becomes a general quote box.
 */
export function ChairScript({ children }: { children: React.ReactNode }) {
  return <div className="gv-script">{typeof children === 'string' ? <p>{children}</p> : children}</div>;
}

/** A titled block inside the prose: one motion, one rule, one option. */
export function FactCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gv-fact">
      <p className="gv-fact-title">{title}</p>
      {typeof children === 'string' ? <p className="gv-fact-body">{children}</p> : children}
    </div>
  );
}

/**
 * Wrap EVERY <table> in this. A comparison table is wider than a phone, and
 * `html, body { overflow-x: clip }` (globals.css) is the site's overflow
 * backstop: a table that overflows the page is not merely off screen, it is
 * unreachable. The wrapper scrolls instead, and it is the only thing that does.
 */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="gv-table-wrap">{children}</div>;
}
