import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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

/** Static siblings of `/conferences/[slug]`. Mirrors RESERVED_CONFERENCE_SLUGS.
 *  `all` and `in` (the directory and the hubs) skip the alias lookup too. */
const CONFERENCE_STATIC = new Set([
  'explore', 'landing-lab', 'map', 'new', 'organise', 'organize', 'roles', 'all', 'in',
]);

export async function middleware(req: NextRequest) {
  const redirect = await aliasRedirect(req);
  if (redirect) return redirect;
  return keepSessionFresh(req);
}

/**
 * KEEP A SIGNED-IN SESSION ALIVE ON THE SERVER (19 Oct 2026)
 * ──────────────────────────────────────────────────────────
 * The browser client writes the session cookies with document.cookie, and
 * Safari caps every cookie written by script at 7 days (24 hours after a visit
 * from a link with tracking parameters), so Safari users were signed out every
 * few days. A cookie sent by the server in Set-Cookie is not capped. On a page
 * navigation that carries a session, this refreshes an expired token (setAll
 * receives the new cookies) and, at most once a day, sends the existing
 * session cookies back from the server so Safari keeps them. Visitors with no
 * session cookie never reach the SDK. Any failure leaves the request as it was.
 */
const AUTH_COOKIE = 'sb-luruhkwrgisytejswlas-auth-token';
const TOUCH_COOKIE = 'gv-auth-touch';
const AUTH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

async function keepSessionFresh(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.next({ request: req });
  if (req.headers.get('sec-fetch-dest') === 'iframe') return res;
  const authCookies = req.cookies.getAll().filter((c) => c.name.startsWith(AUTH_COOKIE));
  if (authCookies.length === 0) return res;
  try {
    let wrote = false;
    const supabase = createServerClient(
      'https://luruhkwrgisytejswlas.supabase.co',
      'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll(cookiesToSet) {
            wrote = true;
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      },
    );
    // Reads the cookie and refreshes only when the access token has expired.
    await supabase.auth.getSession();
    if (!wrote && !req.cookies.get(TOUCH_COOKIE)) {
      for (const c of authCookies) {
        res.cookies.set(c.name, c.value, { path: '/', sameSite: 'lax', maxAge: AUTH_COOKIE_MAX_AGE });
      }
      wrote = true;
    }
    if (wrote) res.cookies.set(TOUCH_COOKIE, '1', { path: '/', sameSite: 'lax', maxAge: 24 * 60 * 60, httpOnly: true });
  } catch {
    /* never fail a page over a session refresh */
  }
  return res;
}

async function aliasRedirect(req: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = req.nextUrl;

  // /conferences/<seg>/... or /manage/<seg>/...
  const m = /^\/(conferences|manage)\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!m) return null;

  const [, section, rawSegment, rest = ''] = m;
  let segment: string;
  try {
    segment = decodeURIComponent(rawSegment);
  } catch {
    return null;
  }
  if (section === 'conferences' && CONFERENCE_STATIC.has(segment)) return null;

  const target = await currentConferenceSlug(segment);
  if (!target || target === segment) return null;

  const url = req.nextUrl.clone();
  url.pathname = `/${section}/${target}${rest}`;
  url.search = search;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Every page, for the session refresh above; the alias redirect still
  // matches only /conferences and /manage. Skipped: static assets, API routes,
  // the auth callback (it writes its own cookies) and the anonymous session
  // runtimes, which never carry an account.
  matcher: [
    '/((?!_next/|api/|auth/callback|chair/|delegate/|voting/|r/|favicon|icon|apple-icon|robots\\.txt|sitemap|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|pdf|txt|xml|js|css|woff2?|ttf)$).*)',
  ],
};
