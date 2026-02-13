import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/board/'],
      },
    ],
    sitemap: 'https://swarm-kanban.vercel.app/sitemap.xml',
  };
}
