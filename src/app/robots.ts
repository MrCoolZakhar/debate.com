import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Live-session app surfaces (per-committee, code-gated)
          '/chair/',
          '/delegate/',
          '/voting/',
          '/advisor/',
          // Sub-paths only — the trailing slash deliberately leaves the bare
          // /join and /create indexable, which is where the SEO value is.
          '/join/',
          '/create/',
          // But NEVER the parameterised form. /join?code=ABC123 is a real URL
          // this page reads, so an indexed query string would publish a live
          // session code into search results. Both pages canonicalise to their
          // bare path, so nothing of value is lost.
          '/join?',
          '/create?',
          // Token-bearing, and acts on GET. Must never be crawled: a bot
          // following it would unsubscribe a real person.
          '/unsubscribe',
          // Conferences private surfaces (auth-gated dashboards & flows)
          '/manage/',
          '/admin',
          '/account/',
          '/my-conferences',
          '/invites/',
          '/auth/',
          '/delegation/',
          '/api/',
          '/conferences/new',
          '/conferences/*/apply',
          '/conferences/*/pay',
          '/conferences/*/participant',
          '/conferences/*/role',
          '/conferences/*/papers',
          // Dev-only
          '/grain-dev/',
        ],
      },
    ],
    sitemap: 'https://gavelling.com/sitemap.xml',
  };
}
