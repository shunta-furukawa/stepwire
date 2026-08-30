import type { Metadata } from 'next';
import { getArticles, getVideoInput } from '@/lib/content/loader';
import { StudioClient } from '@/components/studio/StudioClient';

/**
 * The video studio.
 *
 * A server component that loads every published article, projects each to its
 * video input, and hands the lot to one client island. Everything interactive
 * lives inside `StudioClient`; nothing else on the site ships this JavaScript.
 */
export const metadata: Metadata = {
  title: '動画スタジオ',
  description: '公開済みの記事からSTEPWIREの動画をプレビューし、書き出します。',
  robots: { index: false, follow: false },
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>;
}) {
  const [{ article: requested }, articles] = await Promise.all([searchParams, getArticles()]);

  const inputs = await Promise.all(
    articles.map(async (item) => ({
      ...(await getVideoInput(item)),
      fixture: item.fixture,
    })),
  );

  const initialSlug =
    inputs.find((item) => item.slug === requested)?.slug ?? inputs[0]?.slug ?? '';

  return <StudioClient articles={inputs} initialSlug={initialSlug} />;
}
