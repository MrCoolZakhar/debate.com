import { NextResponse, type NextRequest } from 'next/server';
import { currentConferenceSlug } from '@/lib/conferenceAliases';

/**
 * OLD CONFERENCE SLUGS → 308 → THE CURRENT ONE
 * ────────────────────────────────────────────
 * A conference's slug follows its name now: rename KU MUN and the trigger
 * `conferences_reslug_on_rename` re-mints `demomun` as `kumun2026` and files
 * the old string in `conference_slug_aliases`. This is the other half — every
 * link already in the world (a printed QR code, an email sent last month, a
 * bookmark, a Google result) has to land on the new page.
 *
 * ── WHY MIDDLEWARE ─────────────────────────────────────────────────────────
 * The redirect has to cover EVERY path under the slug, not just the landing
 * page: `/conferences/<slug>/{apply,pay,papers,awards,participant,role,
 * reviews}` and `/manage/<slug>/{everything}`. Those are a dozen route files,
 * several of them client components (`/manage/[slug]/layout.tsx` is
 * `'use client'`), which cannot issue a 308 at all — the best they could do is
 * a client-side `router.replace`, which is a 200 with a redirect painted on
 * top and carries no ranking signal. One middleware covers the whole tree,
 * once, before anything renders.
 *
 * ── INDEXABILITY (CLAUDE.md §4) ────────────────────────────────────────────
 * 308, not 307: the move is permanent, so link equity transfers and Google
 * drops the old URL. `/conferences/<current>` stays the one self-canonical,
 * sitemap-listed URL — the sitemap reads `conferences.slug` and never the
 * alias table, so an alias is never advertised, only honoured. The redirect
 * fires only when the segment is an alias of a conference whose current slug
 * is DIFFERENT, so the target is always a live 200 and can never loop back.
 * (`/<ACRONYM>` vanity links stay 307 in `src/app/[slug]/page.tsx` — that
 * mapping is derived from a mutable acronym, this one is a stored fact.)
 *
 * ── WHAT IS PRESERVED ──────────────────────────────────────────────────────
 * The rest of the path, the query string, and — because a fragment never
 * leaves the browser — the hash.
 */

/** Static siblings of `/conferences/[slug]`. Mirrors RESERVED_CONFERENCE_SLUGS. */
const CONFERENCE_STATIC = new Set([
  'explore', 'landing-lab', 'map', 'new', 'organise', 'organize', 'roles',
]);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /conferences/<seg>/... or /manage/<seg>/...
  const m = /^\/(conferences|manage)\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!m) return NextResponse.next();

  const [, section, rawSegment, rest = ''] = m;
  let segment: string;
  try {
    segment = decodeURIComponent(rawSegment);
  } catch {
    return NextResponse.next();
  }
  if (section === 'conferences' && CONFERENCE_STATIC.has(segment)) return NextResponse.next();

  const target = await currentConferenceSlug(segment);
  if (!target || target === segment) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/${section}/${target}${rest}`;
  url.search = search;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Only the two trees that carry a conference slug. Everything else — the
  // homepage, /blog, /join, the session runtimes, static assets — never
  // reaches this file.
  matcher: ['/conferences/:path*', '/manage/:path*'],
};
