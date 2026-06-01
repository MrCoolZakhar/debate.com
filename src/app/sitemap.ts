import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://gavelling.com',             lastModified: new Date(), changeFrequency: 'weekly',  priority: 1   },
    { url: 'https://gavelling.com/about',        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/conferences',  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: 'https://gavelling.com/contact',      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://gavelling.com/features',     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://gavelling.com/pricing',      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/resources',    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: 'https://gavelling.com/blog',         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: 'https://gavelling.com/blog/how-to-run-mun-committee',  lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/best-mun-software-2026',    lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://gavelling.com/blog/general-speakers-list-guide', lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-motions-explained',     lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/how-to-chair-first-mun',    lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
