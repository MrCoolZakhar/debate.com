/**
 * Blog shell.
 *
 * Every one of the 34 posts is a standalone page that hand-rolls its own
 * inline `style` object: a page wrapper with `padding: '48px 24px 80px'` and an
 * <article> with `padding: '40px 40px 48px'`, plus <table>s sized for a desktop
 * column. Inline styles cannot carry a media query, so on a 375px phone that
 * arithmetic left a 247px text measure and pushed wide tables past the right
 * edge — and because `html, body { overflow-x: clip }` (globals.css) is the
 * site's overflow backstop, the overflowing column was not merely off screen,
 * it was unreachable: no horizontal scroll, no way to read it.
 *
 * Rather than edit 34 files (and have them drift), this wrapper gives the whole
 * section one hook, `.gv-blog`, that globals.css uses to apply phone-only
 * corrections. Nothing here changes the desktop rendering.
 *
 * Deliberately a plain server component with no chrome of its own: the posts
 * still own their own header and back link.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="gv-blog">{children}</div>;
}
