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
          '/account/',
          '/my-conferences',
          '/invites/',
          '/auth/',
          '/delegation/',
          '/api/',
          '/conferences/new',
          '/conferences/landing-lab',
          '/conferences/*/apply',
          '/conferences/*/pay',
          '/conferences/*/participant',
          // Dev-only
          '/grain-dev/',
        ],
      },
    ],
    sitemap: 'https://gavelling.com/sitemap.xml',
  };
}
