import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/conferences', '/contact'],
        disallow: ['/chair/', '/delegate/', '/voting/', '/advisor/', '/join/', '/create/', '/grain-dev/'],
      },
    ],
    sitemap: 'https://gavelling.com/sitemap.xml',
  };
}
