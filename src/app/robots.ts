import { MetadataRoute } from 'next';

// ── robots.txt: block ONLY what must never be fetched ────────────────────────
//
// A Disallow does NOT keep a URL out of Google. It stops Google READING the
// page, so it never sees the page's noindex, and a URL it finds linked anywhere
// gets indexed bare ("Indexed, though blocked by robots.txt": /auth/signin was
// exactly that). So private pages are CRAWLABLE and say noindex themselves,
// through the X-Robots-Tag headers in next.config.ts (one list, which also
// covers client pages and query-string variants such as /join?code=...).
//
// What stays disallowed is what has a side effect when a crawler renders it:
//   - the live-session runtimes: loading /delegate/CODE claims a seat through
//     claim_delegate_seat (a rendering bot would take a real delegate's seat
//     for 65 minutes); the chair, advisor and voting pages start the same kind
//     of per-device claims. They are also noindex by header.
//   - /unsubscribe and /drafts/...?stop=1 act on GET for a real person.
//   - /api/ is not pages (except the OG cards, which image crawlers may fetch).
// Never add a private PAGE here: add it to NOINDEX_ROUTES in next.config.ts.
// `npm run check:indexability` fails if a known private page is disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/'],
        disallow: [
          '/chair/',
          '/delegate/',
          '/voting/',
          '/advisor/',
          '/unsubscribe',
          '/drafts/*stop=',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://gavelling.com/sitemap.xml',
  };
}
