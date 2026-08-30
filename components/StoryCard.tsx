import Link from 'next/link';
import type { Article } from '@/lib/content/article';
import { CategoryChip, ImportanceFlag } from './CategoryChip';
import { Timestamp } from './Timestamp';
import { SourceAttribution } from './SourceList';
import { FixtureBanner } from './FixtureBanner';

/**
 * The lead story. One per page, set at display scale — the front page has an
 * opinion about what matters today, which is what makes it a wire and not a feed.
 */
export function LeadStory({ article }: { article: Article }) {
  return (
    <article className="border-b-4 border-ink pb-xl">
      <div className="flex flex-wrap items-center gap-sm">
        <ImportanceFlag importance={article.importance} />
        <CategoryChip category={article.category} />
        {article.fixture ? <FixtureBanner compact /> : null}
        <Timestamp iso={article.publishedAt} />
      </div>

      <h2 className="mt-md font-display text-h3 font-black leading-headline tracking-headline text-balance sm:text-h2 lg:text-h1">
        <Link
          href={`/article/${article.slug}`}
          className="transition-colors hover:text-signal"
        >
          {article.title}
        </Link>
      </h2>

      {article.dek ? (
        <p className="mt-lg max-w-[62ch] font-body text-lead leading-snug text-gray700 sm:text-h4">
          {article.dek}
        </p>
      ) : null}

      <div className="mt-lg">
        <SourceAttribution sources={article.sources} />
      </div>
    </article>
  );
}

/**
 * Standard story card.
 *
 * `rank` renders the wire-style running number that gives the list its density
 * without adding chrome.
 */
export function StoryCard({
  article,
  rank,
  showDek = false,
}: {
  article: Article;
  rank?: number;
  showDek?: boolean;
}) {
  return (
    <article className="group grid grid-cols-[auto_1fr] gap-md border-t border-gray300 py-lg first:border-t-0">
      {typeof rank === 'number' ? (
        <span
          aria-hidden="true"
          className="w-[2.5ch] font-mono text-micro tabular-nums text-gray700"
        >
          {String(rank).padStart(2, '0')}
        </span>
      ) : (
        <span aria-hidden="true" className="w-[2.5ch] font-mono text-micro text-gray300">
          ▸
        </span>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-sm">
          <ImportanceFlag importance={article.importance} />
          <CategoryChip category={article.category} size="small" />
          {article.fixture ? <FixtureBanner compact /> : null}
          <Timestamp iso={article.publishedAt} />
        </div>

        <h3 className="mt-sm font-display text-h4 font-bold leading-tight tracking-headline text-pretty sm:text-h3">
          <Link
            href={`/article/${article.slug}`}
            className="transition-colors group-hover:text-signal"
          >
            {article.shortTitle ?? article.title}
          </Link>
        </h3>

        {showDek && article.dek ? (
          <p className="mt-sm max-w-[68ch] font-body text-base leading-snug text-gray700">
            {article.dek}
          </p>
        ) : null}

        <div className="mt-sm">
          <SourceAttribution sources={article.sources} />
        </div>
      </div>
    </article>
  );
}

export function StoryList({
  articles,
  numbered = true,
  showDek = false,
}: {
  articles: Article[];
  numbered?: boolean;
  showDek?: boolean;
}) {
  if (articles.length === 0) {
    return (
      <p className="border-t border-gray300 py-xl font-mono text-small uppercase tracking-wide text-gray700">
        まだ記事がありません。
      </p>
    );
  }

  return (
    <div>
      {articles.map((article, index) => (
        <StoryCard
          key={article.id}
          article={article}
          {...(numbered ? { rank: index + 1 } : {})}
          showDek={showDek}
        />
      ))}
    </div>
  );
}
