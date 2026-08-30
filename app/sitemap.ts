import type { MetadataRoute } from 'next';
import { getSyndicatableArticles } from '@/lib/content/loader';
import { SECTIONS } from '@/lib/content/categories';
import { absoluteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fixtures are deliberately absent: they describe invented events and must
  // never be offered to a search engine.
  const articles = await getSyndicatableArticles();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'hourly', priority: 1 },
    { url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.3 },
    ...SECTIONS.map((section) => ({
      url: absoluteUrl(`/${section.slug}`),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];

  return [
    ...staticRoutes,
    ...articles.map((article) => ({
      url: absoluteUrl(`/article/${article.slug}`),
      lastModified: new Date(article.updatedAt ?? article.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
