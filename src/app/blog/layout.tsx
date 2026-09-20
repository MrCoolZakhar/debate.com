import './blog.css';

/**
 * Blog shell.
 *
 * Two jobs, both small:
 *
 *  1. Load `blog.css` once for the whole section. That stylesheet is where the
 *     prose lives now. Before it, each of the 34 posts hand-rolled an inline
 *     `style` object, and because an inline style cannot carry a media query
 *     the measure was a fixed pixel column: about 247px of text on a 375px
 *     phone, with tables running off an edge the page could not scroll to
 *     (`html, body { overflow-x: clip }` in globals.css is the site's overflow
 *     backstop, so the overflow was unreachable rather than merely off screen).
 *     Every correction had to be an `!important` override fighting the inline
 *     value it was correcting. Classes end that argument.
 *
 *  2. Carry `.gv-blog`, which is where blog.css hangs its custom properties
 *     (the measure, the type scale, the palette), so a post inherits the whole
 *     system by existing inside this layout.
 *
 * Deliberately still a plain server component with no chrome: the header and
 * the footer come from BlogChrome, which the index and ArticleLayout each
 * mount, because that is the level that knows the page's own shape.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="gv-blog">{children}</div>;
}
