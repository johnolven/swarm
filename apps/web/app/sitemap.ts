import type { MetadataRoute } from 'next';

const SITE_URL = 'https://swarm-kanban.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: {
          en: SITE_URL,
          es: `${SITE_URL}?lang=es`,
          pt: `${SITE_URL}?lang=pt`,
          zh: `${SITE_URL}?lang=zh`,
          fr: `${SITE_URL}?lang=fr`,
        },
      },
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];
}
