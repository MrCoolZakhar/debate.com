import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/conferences', '/contact'],
        disallow: ['/chair/', '/delegate/', '/voting/', '/advisor/', '/join/', '/create/', '/pre-register/', '/grain-dev/'],
      },
    ],
    sitemap: 'https://gavelling.com/sitemap.xml',
  };
}
