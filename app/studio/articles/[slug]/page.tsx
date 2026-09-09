import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStudioArticles } from '@/lib/content/loader';
import { SECTION_KEYS } from '@/lib/content/schema';
import { Markdown } from '@/components/Markdown';
import { SourceList } from '@/components/SourceList';
import { FigureList } from '@/components/Figure';
import { CategoryChip } from '@/components/CategoryChip';
import { ArticleVideo } from '@/components/ArticleVideo';

// Studio already carries review content. Keep the web-reading preview in that
// same noindex surface; never widen the published article loader to show drafts.
export const metadata: Metadata = {
  title: '記事プレビュー',
  robots: { index: false, follow: false },
};

export async function generateStaticParams() {
  return (await getStudioArticles()).map((article) => ({ slug: article.slug }));
}

export const dynamicParams = false;

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = (await getStudioArticles()).find((item) => item.slug === slug);
  if (!article) notFound();

  return (
    <article className="mx-auto max-w-[900px] px-md py-xl">
      <aside className="border-2 border-accent bg-raised p-md font-mono text-micro leading-snug">
        <p className="font-bold text-accent">記事プレビュー · {article.status}</p>
        <p className="mt-xs text-muted">
          {article.status === 'published' ? '公開済み記事の確認用表示です。' : '未公開の記事です。トップページ・RSS・サイトマップには掲載されません。'}
          この確認用URLを知っている人は閲覧できます。
        </p>
        <Link href="/studio" className="mt-sm inline-block underline underline-offset-4 hover:text-accent">
          Studioに戻る
        </Link>
      </aside>

      <header className="mt-xl border-b-4 border-accent pb-xl">
        <CategoryChip category={article.category} />
        <h1 className="mt-lg font-display text-h2 font-black leading-headline tracking-headline text-balance sm:text-h1">
          {article.title}
        </h1>
        {article.dek ? (
          <p className="mt-lg font-body text-lead leading-snug text-muted">{article.dek}</p>
        ) : null}
      </header>

      <div className="min-w-0 space-y-2xl pt-xl">
        <ArticleVideo videoId={article.youtubeVideoId} title={article.title} />
        {SECTION_KEYS.map((key) => (
          <section key={key} aria-labelledby={`section-${key}`}>
            <h2 id={`section-${key}`} className="border-b-2 border-line-strong pb-sm font-display text-h4 font-black">
              {article.labels?.[key] ?? article.sections[key].heading}
              <span className="ml-sm font-mono text-micro font-normal text-muted">
                {key === 'news' ? '出典つき' : '解説・会話'}
              </span>
            </h2>
            <div className="mt-lg"><Markdown blocks={article.sections[key].blocks} /></div>
          </section>
        ))}
        <FigureList figures={article.figures} />
        <SourceList sources={article.sources} />
      </div>
    </article>
  );
}
