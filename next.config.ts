import type { NextConfig } from "next";

// ── Indexability: noindex by HEADER, never by robots.txt ─────────────────────
// Private and per-person routes answer `X-Robots-Tag: noindex, nofollow`. A
// header (not a <meta>) because it covers 'use client' pages that cannot carry
// metadata, API/route handlers, and query-string variants of public pages
// (/join?code=ABC123 must never be indexed; bare /join must be). These routes
// stay CRAWLABLE in robots.ts so Google can actually read the header. See
// CLAUDE.md §4 and `npm run check:indexability`.
const NOINDEX = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
const NOINDEX_ROUTES = [
  '/auth/:path*',
  '/account', '/account/:path*',
  '/my-conferences', '/my-conferences/:path*',
  '/manage/:path*',
  '/admin', '/admin/:path*',
  '/invites/:path*',
  '/drafts/:path*',
  '/delegation/:path*',
  '/unsubscribe',
  '/api/:path*',
  '/grain-dev', '/grain-dev/:path*',
  '/chair/:path*', '/delegate/:path*', '/advisor/:path*', '/voting/:path*',
  '/conferences/new', '/conferences/organise', '/conferences/landing-lab/:path*',
  '/conferences/:slug/apply', '/conferences/:slug/apply/:path*',
  '/conferences/:slug/pay', '/conferences/:slug/pay/:path*',
  '/conferences/:slug/participant', '/conferences/:slug/participant/:path*',
  '/conferences/:slug/role/:path*',
  '/conferences/:slug/papers', '/conferences/:slug/papers/:path*',
];

const nextConfig: NextConfig = {
  // ── Moved and index-less addresses, answered by the server ──────────────────
  // These used to be redirect-only page files. Under the CLIENT account layout
  // a server `redirect()` page threw in dev ("'PointsPage' cannot have a
  // negative time stamp", 25 Sep 2026), so they live here: a 308 before any
  // React runs. Next keeps the query string (Stripe's ?unlimited=success&
  // session_id=…, the apply flow's ?returnTo=…) and the browser keeps the hash
  // (/my-conferences?tab=all#drafts from old emails).
  async redirects() {
    return [
      { source: '/account', destination: '/account/profile', permanent: true },
      { source: '/account/points', destination: '/account/manage/credits', permanent: true },
      { source: '/account/manage', destination: '/account/manage/credits', permanent: true },
      { source: '/account/unlimited', destination: '/pricing/subscription', permanent: true },
      { source: '/my-conferences', destination: '/account/conferences', permanent: true },
      { source: '/pricing', destination: '/pricing/credits', permanent: true },
    ];
  },
  async headers() {
    return [
      ...NOINDEX_ROUTES.map((source) => ({ source, headers: NOINDEX })),
      // The parameterised join links carry live session codes. The bare
      // pages stay indexable (they canonicalise every variant to themselves).
      ...['code', 'mode', 'idle'].map((key) => ({
        source: '/join',
        has: [{ type: 'query' as const, key }],
        headers: NOINDEX,
      })),
      // Build assets and public files are fetched by Google to RENDER pages
      // (so never disallow them) but must not be reported as pages: Search
      // Console listed every /_next/static chunk as "Crawled, not indexed".
      { source: '/_next/static/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/:file(.+\\.pdf)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/:file(.+\\.txt)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/sitemap.xml', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
  /* The share-card routes read four Outfit TTFs and the brand mark off disk at
     module scope. Nothing IMPORTS those files, so without this declaration the
     tracer only copies them by inferring an include from a `join(process.cwd(),
     '<literal>')` call — which works, but leaves the bundle contents dependent
     on the tracer recognising one particular code shape. Declaring them makes
     it explicit: change the filenames and you change this glob.

     Not to be confused with the "Encountered unexpected file in NFT list"
     warning these two routes emit. That one is NOT ours: it survives deleting
     every filesystem call in _shared/ (verified — stub them all out and the
     warning is unchanged), and `turbopackIgnore` comments do not silence it.
     It comes from next/og's own dynamic requires for its wasm renderer, so it
     is fixed upstream or not at all. */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'luruhkwrgisytejswlas.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
