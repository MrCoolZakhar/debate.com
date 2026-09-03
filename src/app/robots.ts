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
          '/join/',
          '/create/',
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
