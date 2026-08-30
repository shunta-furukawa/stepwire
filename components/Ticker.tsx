import Link from 'next/link';
import type { Article } from '@/lib/content/article';
import { formatDate } from '@/lib/format';

/**
 * The latest strip. A horizontally scrollable wire line under the masthead that
 * answers "what came in today" before the reader scrolls anywhere.
 *
 * It scrolls on user input rather than on a timer: an auto-marquee is
 * unreadable, unfocusable, and hostile to `prefers-reduced-motion`.
 */
export function Ticker({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;

  return (
    <section
      aria-label="最新の記事"
      className="border-b-2 border-line-strong bg-deep text-fg"
    >
      <div className="mx-auto flex max-w-[1180px] items-stretch">
        <p className="flex shrink-0 items-center gap-sm border-r border-line-strong px-md py-sm font-mono text-micro font-bold uppercase tracking-wider">
          <span aria-hidden="true" className="wire-pulse block h-[6px] w-[6px] bg-accent-hot" />
          最新
        </p>
        <ul className="flex flex-1 gap-0 overflow-x-auto">
          {articles.map((article) => (
            <li key={article.id} className="shrink-0 border-r border-line-strong">
              <Link
                href={`/article/${article.slug}`}
                className="flex h-full items-center gap-sm px-md py-sm font-mono text-micro uppercase tracking-wide transition-colors hover:bg-accent"
              >
                <span className="text-muted">{formatDate(article.publishedAt)}</span>
                <span className="max-w-[46ch] truncate">
                  {article.shortTitle ?? article.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
