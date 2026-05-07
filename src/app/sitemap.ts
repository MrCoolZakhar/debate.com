import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://gavelling.com',             lastModified: new Date(), changeFrequency: 'weekly',  priority: 1   },
    { url: 'https://gavelling.com/about',        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/conferences',  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: 'https://gavelling.com/contact',      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];
}
