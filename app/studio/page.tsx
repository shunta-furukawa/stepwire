import type { Metadata } from 'next';
import { getArticles } from '@/lib/content/loader';
import { toVideoInput } from '@/lib/content/article';
import { StudioClient } from '@/components/studio/StudioClient';

/**
 * The video studio.
 *
 * A server component that loads every published article, projects each to its
 * video input, and hands the lot to one client island. Everything interactive
 * lives inside `StudioClient`; nothing else on the site ships this JavaScript.
 */
export const metadata: Metadata = {
  title: 'Video studio',
  description: 'Preview and render STEPWIRE videos from published articles.',
  robots: { index: false, follow: false },
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>;
}) {
  const [{ article: requested }, articles] = await Promise.all([searchParams, getArticles()]);

  const inputs = articles.map((item) => ({
    ...toVideoInput(item),
    fixture: item.fixture,
  }));

  const initialSlug =
    inputs.find((item) => item.slug === requested)?.slug ?? inputs[0]?.slug ?? '';

  return <StudioClient articles={inputs} initialSlug={initialSlug} />;
}
