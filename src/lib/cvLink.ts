/**
 * PUBLIC MUN CV LINKS — the single place that turns a user into a CV URL.
 * ──────────────────────────────────────────────────────────────────────
 * Every profile reference in the product (an avatar, a chair on a committee
 * card, an applicant row, a society member) links to that person's public CV
 * at `/cv/…`. This module owns the URL shape so no surface builds it by hand.
 *
 * URL FORM. `/cv/[id]` resolves BOTH a raw user UUID and a pretty
 * `<name-slug>-<first8ofuuid>` slug (see src/app/cv/[id]/page.tsx). We always
 * emit the pretty form when a display name is available, because these links
 * get pasted into chats and applications and a bare UUID tells the reader
 * nothing. Old raw-UUID links keep working — this is additive.
 *
 * WHY 8 HEX CHARS. `get_public_cv_by_prefix` resolves the trailing hex run and
 * returns NULL unless it matches EXACTLY ONE profile, so an ambiguous prefix
 * fails closed (an empty CV page) rather than showing the wrong person. Eight
 * characters is what /account/cv has always minted; do not shorten it.
 *
 * NO USER, NO LINK. `cvHref` returns null for a missing/blank id. That is the
 * common case, not an edge case — a chair listed by name only, and every
 * invited-but-unclaimed applicant (`applicants.user_id IS NULL`, 18 such rows
 * in the LIMUN demo data), has no account and therefore no CV. Callers must
 * render plain text when this returns null; `<ProfileLink>` does it for you.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `Jane Doe` + uuid → `jane-doe-8f0376f2`. Falls back to the bare short id. */
export function cvSlug(userId: string, displayName?: string | null): string {
  const slug = (displayName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const shortId = userId.slice(0, 8);
  return slug ? `${slug}-${shortId}` : shortId;
}

/**
 * The `/cv/…` path for a user, or null when there is nobody to link to.
 *
 * Returns null — never a broken href — when `userId` is null/undefined/blank
 * or is not a real UUID. Guarding on shape matters: several call sites carry a
 * loosely-typed `user_id` that is sometimes an email or a placeholder string,
 * and `/cv/<garbage>` would render the "This CV isn't available" page.
 */
export function cvHref(userId?: string | null, displayName?: string | null): string | null {
  const id = (userId ?? '').trim();
  if (!id || !UUID_RE.test(id)) return null;
  return `/cv/${cvSlug(id, displayName)}`;
}

/** Absolute URL for the same CV — for copy-to-clipboard and share sheets. */
export function cvShareUrl(userId?: string | null, displayName?: string | null): string {
  const path = cvHref(userId, displayName);
  if (!path) return '';
  const origin = typeof window === 'undefined' ? 'https://gavelling.com' : window.location.origin;
  return `${origin}${path}`;
}
