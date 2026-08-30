import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getArticles } from '@/lib/content/loader';
import { SECTION_KEYS } from '@/lib/content/schema';
import { CATEGORY_META, sectionForCategory } from '@/lib/content/categories';
import { Markdown } from '@/components/Markdown';
import { SourceList } from '@/components/SourceList';
import { CategoryChip, ImportanceFlag } from '@/components/CategoryChip';
import { Timestamp } from '@/components/Timestamp';
import { FixtureBanner } from '@/components/FixtureBanner';
import { StoryList } from '@/components/StoryCard';
import { SectionHeading } from '@/components/SectionHeading';
import { FigureList } from '@/components/Figure';
import { absoluteUrl, site } from '@/lib/site';

/**
 * Article URLs are permanent. Once a slug is published it does not change —
 * the archive promise depends on it.
 */
export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  const url = `/article/${article.slug}`;
  const description = article.dek ?? article.summary;

  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    // Fixture articles are excluded from search indexes as well as from the
    // feed and sitemap: they must never surface as if they were reporting.
    ...(article.fixture ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      url,
      publishedTime: article.publishedAt,
      ...(article.updatedAt ? { modifiedTime: article.updatedAt } : {}),
      tags: article.tags,
      section: CATEGORY_META[article.category].label,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.shortTitle ?? article.title,
      description,
    },
  };
}

/**
 * The three body sections.
 *
 * `NEWS` is reported fact; `CONTEXT` and `PLAYER IMPACT` are editorial
 * analysis. The design states which is which rather than leaving the reader to
 * infer it — that distinction is the reason the model separates them.
 */
const SECTION_LABELS: Record<
  (typeof SECTION_KEYS)[number],
  { index: string; heading: string; kind: string }
> = {
  news: { index: '01', heading: 'ニュース', kind: '報道' },
  context: { index: '02', heading: 'コンテクスト', kind: 'STEPWIREの分析' },
  playerImpact: { index: '03', heading: 'プレイヤーへの影響', kind: 'STEPWIREの分析' },
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const all = await getArticles();
  const related = all
    .filter((item) => item.slug !== article.slug && item.category === article.category)
    .slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.dek ?? article.summary,
    datePublished: article.publishedAt,
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    articleSection: CATEGORY_META[article.category].label,
    keywords: article.tags.join(', '),
    inLanguage: site.locale,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/article/${article.slug}`) },
    author: { '@type': 'Organization', name: site.name },
    publisher: { '@type': 'Organization', name: site.name },
    ...(article.sources.length > 0
      ? { citation: article.sources.map((source) => ({ '@type': 'CreativeWork', name: source.title, url: source.url })) }
      : {}),
  };

  return (
    <article className="mx-auto max-w-[1180px] px-md py-xl">
      {/* Fixture articles are excluded from JSON-LD so that structured data
          never describes invented events as news. */}
      {!article.fixture ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      <nav aria-label="パンくずリスト" className="font-mono text-micro uppercase tracking-wide text-gray700">
        <Link href="/" className="hover:text-signal">
          STEPWIRE
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/${sectionForCategory(article.category)}`} className="hover:text-signal">
          {CATEGORY_META[article.category].label}
        </Link>
      </nav>

      <header className="mt-lg border-b-4 border-ink pb-xl">
        <div className="flex flex-wrap items-center gap-sm">
          <ImportanceFlag importance={article.importance} />
          <CategoryChip category={article.category} />
          <Timestamp iso={article.publishedAt} precise />
          {article.updatedAt ? (
            <Timestamp iso={article.updatedAt} precise label="Updated" />
          ) : null}
        </div>

        <h1 className="mt-lg max-w-[26ch] font-display text-h2 font-black leading-headline tracking-headline text-balance sm:text-h1">
          {article.title}
        </h1>

        {article.dek ? (
          <p className="mt-lg max-w-[62ch] font-body text-lead leading-snug text-gray700 sm:text-h4">
            {article.dek}
          </p>
        ) : null}

        {article.fixture ? (
          <div className="mt-xl">
            <FixtureBanner />
          </div>
        ) : null}
      </header>

      <div className="grid gap-2xl pt-xl lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-2xl">
          {SECTION_KEYS.map((key) => {
            const section = article.sections[key];
            const meta = SECTION_LABELS[key];
            return (
              <section key={key} aria-labelledby={`section-${key}`} className="scroll-mt-24" id={key}>
                <div className="flex items-baseline gap-md border-b-2 border-ink pb-sm">
                  <span aria-hidden="true" className="font-mono text-micro text-signal">
                    {meta.index}
                  </span>
                  <h2
                    id={`section-${key}`}
                    className="font-display text-h4 font-black tracking-tight"
                  >
                    {meta.heading}
                    <span className="ml-sm font-mono text-micro font-normal tracking-wider text-gray700">
                      {section.heading}
                    </span>
                  </h2>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-gray700">
                    {meta.kind}
                  </span>
                </div>
                <div className="mt-lg">
                  <Markdown blocks={section.blocks} />
                </div>
              </section>
            );
          })}

          <FigureList figures={article.figures} />

          <SourceList sources={article.sources} />
        </div>

        <aside className="space-y-xl lg:sticky lg:top-lg lg:self-start">
          <nav aria-label="記事の構成" className="border-2 border-ink p-md">
            <p className="font-mono text-micro font-bold uppercase tracking-wider">この記事の構成</p>
            <ol className="mt-md space-y-sm font-mono text-micro uppercase tracking-wide">
              {SECTION_KEYS.map((key) => (
                <li key={key}>
                  <a href={`#${key}`} className="hover:text-signal">
                    <span className="text-gray700">{SECTION_LABELS[key].index}</span>{' '}
                    {SECTION_LABELS[key].heading}
                  </a>
                </li>
              ))}
              {article.figures.length > 0 ? (
                <li>
                  <a href="#figures" className="hover:text-signal">
                    <span className="text-gray700">04</span> データ
                  </a>
                </li>
              ) : null}
              {article.sources.length > 0 ? (
                <li>
                  <a href="#source-1" className="hover:text-signal">
                    <span className="text-gray700">{article.figures.length > 0 ? '05' : '04'}</span>{' '}
                    出典
                  </a>
                </li>
              ) : null}
            </ol>
          </nav>

          <section aria-labelledby="summary-heading">
            <SectionHeading id="summary-heading" label="ひとことで" as="h2" />
            <p className="mt-md font-body text-base leading-snug text-gray700">{article.summary}</p>
          </section>

          {article.tags.length > 0 ? (
            <section aria-labelledby="tags-heading">
              <SectionHeading id="tags-heading" label="タグ" as="h2" />
              <ul className="mt-md flex flex-wrap gap-sm font-mono text-micro uppercase tracking-wide text-gray700">
                {article.tags.map((tag) => (
                  <li key={tag} className="border border-gray300 px-sm py-[2px]">
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link
            href={{ pathname: '/studio', query: { article: article.slug } }}
            className="block border-2 border-ink px-md py-sm text-center font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
          >
            動画スタジオで開く →
          </Link>
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="pt-3xl">
          <SectionHeading id="related-heading" label="RELATED"
            description={`${CATEGORY_META[article.category].label}の他の記事`} />
          <StoryList articles={related} numbered={false} />
        </section>
      ) : null}
    </article>
  );
}
