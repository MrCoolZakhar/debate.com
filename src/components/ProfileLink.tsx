'use client';

/**
 * PROFILE → PUBLIC MUN CV
 * ───────────────────────
 * Wrap anything that identifies a person — an avatar, a name, an avatar+name
 * pair — and it becomes a link to that person's public CV at `/cv/…`.
 *
 * The point of this component is that the two cases every call site would
 * otherwise have to remember are handled HERE, once:
 *
 *   1. NO ACCOUNT → NO LINK. `userId` null/blank/not-a-UUID renders the
 *      children bare, with no anchor and no hover affordance. This is the
 *      common path, not an edge case: a dais entry that is just a name, and
 *      every invited-but-unclaimed applicant (`user_id IS NULL`). Linking
 *      those would promise a page that cannot exist.
 *   2. NESTING. A person's name very often sits inside a row that is itself
 *      clickable. Pass `nested` and the click is stopped from reaching the
 *      row's handler, so clicking the name opens the CV and clicking anywhere
 *      else in the row still does the row's own thing.
 *
 * ⚠️  `nested` is for a row whose click is a JS handler (a div/button with
 * onClick). If the ancestor is itself an `<a>`/`<Link>`, do NOT use this
 * component inside it — an anchor inside an anchor is invalid HTML and the
 * browser silently unnests it, breaking both links. Either link the whole row
 * to the CV, or lift the person's name out of the outer anchor.
 *
 * An empty CV is NOT a reason to withhold the link. The CV page always renders
 * the person's identity (name, photo, nationality) and says "No conferences
 * yet" below it — that is a real profile, and today most accounts are in that
 * state (341 of 1891 profiles have any CV entry).
 */

import Link from 'next/link';
import { cvHref } from '@/lib/cvLink';

export default function ProfileLink({
  userId,
  name,
  children,
  className,
  style,
  nested = false,
  newTab = false,
  title,
  draggable,
}: {
  /** profiles.id. Null/blank → children render unwrapped. */
  userId?: string | null;
  /** Display name — used for the pretty slug and the default hover title. */
  name?: string | null;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** True when a clickable (onClick) ancestor must not also fire. */
  nested?: boolean;
  /** Open in a new tab — for links leaving an in-progress task (e.g. review queues). */
  newTab?: boolean;
  /** Overrides the default "View X's MUN CV" tooltip. */
  title?: string;
  /**
   * Pass `false` inside a drag-and-drop surface. An `<a>` is natively
   * draggable, so on a card the user is meant to DRAG (the assignment rails)
   * the browser would start a link drag with a URL ghost instead of the card's
   * own dataTransfer payload, silently breaking the drop.
   */
  draggable?: boolean;
}) {
  const href = cvHref(userId, name);
  if (!href) return <>{children}</>;

  const label = (name ?? '').trim();

  return (
    <Link
      href={href}
      className={className}
      style={{ textDecoration: 'none', color: 'inherit', ...style }}
      title={title ?? (label ? `View ${label}'s MUN CV` : 'View MUN CV')}
      onClick={nested ? (e) => e.stopPropagation() : undefined}
      draggable={draggable}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </Link>
  );
}
