import { CategoryChip } from '@/components/CategoryChip';
import { groupInboxByDay, summariseInbox, type InboxItem } from '@/lib/news/inbox';
import { formatDate, formatDateTime, hostnameOf } from '@/lib/format';

/**
 * The wire board.
 *
 * A server component, and deliberately not an app: there is no filter UI, no
 * search box and no way to accept or dismiss a candidate from here. Accepting a
 * candidate is `pnpm article:from-issue <n>`, which produces a file and a diff;
 * dismissing one is closing the issue. A button here would either duplicate
 * GitHub's own review surface or quietly bypass it.
 *
 * What the board adds is the thing GitHub's issue list cannot: everything that
 * came in, grouped by the day it happened, with its source and its summary
 * visible without opening anything. That is the question an editor actually
 * arrives with — *what has been going on?* — and answering it in one screen is
 * the whole point.
 */

const SOURCE_LABELS: Record<string, string> = {
  official: '一次情報',
  media: 'メディア',
  community: 'コミュニティ',
};

export function WireBoard({ items }: { items: InboxItem[] }) {
  const days = groupInboxByDay(items);
  const summary = summariseInbox(items);

  return (
    <div className="space-y-2xl">
      <section aria-labelledby="wire-summary" className="border-2 border-ink bg-paper">
        <h2 id="wire-summary" className="sr-only">
          受信箱の概況
        </h2>
        <dl className="grid grid-cols-3">
          <Stat label="未処理" value={String(summary.total)} />
          <Stat label="要レビュー" value={String(summary.needsReview)} />
          <Stat label="速報指定" value={String(summary.breaking)} highlight={summary.breaking > 0} />
        </dl>
        {summary.bySource.length > 0 ? (
          <ul className="flex flex-wrap gap-x-lg gap-y-sm border-t-2 border-ink px-md py-sm font-mono text-micro uppercase tracking-wide text-gray700">
            {summary.bySource.map((source) => (
              <li key={source.sourceId}>
                {source.sourceName}
                <span className="ml-sm tabular-nums text-ink">{source.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {days.map((day) => (
        <section key={day.date || 'undated'} aria-labelledby={`day-${day.date || 'undated'}`}>
          <div className="flex items-baseline gap-md border-b-2 border-ink pb-sm">
            <h2
              id={`day-${day.date || 'undated'}`}
              className="font-mono text-micro font-bold uppercase tracking-wider tabular-nums"
            >
              {day.date ? formatDate(day.date) : '日付なし'}
            </h2>
            <span className="ml-auto font-mono text-micro tabular-nums text-gray700">
              {day.items.length}
            </span>
          </div>
          <ul>
            {day.items.map((item) => (
              <WireRow key={item.number} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-r-2 border-ink px-md py-md last:border-r-0">
      <dt className="font-mono text-micro uppercase tracking-wide text-gray700">{label}</dt>
      <dd
        className={`mt-xs font-display text-h3 font-black leading-headline tabular-nums ${
          highlight ? 'text-signal' : 'text-wire'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function WireRow({ item }: { item: InboxItem }) {
  return (
    <li className="border-b border-gray100 py-md">
      <div className="flex flex-wrap items-center gap-sm font-mono text-micro uppercase tracking-wide text-gray700">
        <span className="tabular-nums text-ink">#{item.number}</span>
        {item.priority === 'breaking' ? (
          <span className="bg-signal px-[6px] py-[1px] font-bold text-paper">速報</span>
        ) : null}
        {item.sourceCategory ? (
          <span className="border border-gray300 px-[6px] py-[1px]">
            {SOURCE_LABELS[item.sourceCategory] ?? item.sourceCategory}
          </span>
        ) : null}
        {item.suggestedCategory ? (
          <CategoryChip category={item.suggestedCategory} href={false} size="small" />
        ) : null}
        {item.needsReview ? null : (
          // The collector files everything as needs-review, so its absence means
          // an editor has been here — worth showing, since a triaged candidate
          // is not the same as a new one.
          <span className="border border-gray300 px-[6px] py-[1px]">確認済み</span>
        )}
      </div>

      <h3 className="mt-sm font-display text-lead font-bold leading-headline tracking-headline">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-gray300 underline-offset-4 transition-colors hover:decoration-wire"
          >
            {item.headline}
          </a>
        ) : (
          item.headline
        )}
      </h3>

      {item.summary ? (
        <p className="mt-sm max-w-[70ch] font-body text-small leading-snug text-gray700 line-clamp-3">
          {item.summary}
        </p>
      ) : null}

      <div className="mt-sm flex flex-wrap items-center gap-x-md gap-y-xs font-mono text-micro uppercase tracking-wide text-gray700">
        {item.sourceName ? <span className="text-ink">{item.sourceName}</span> : null}
        {item.url ? <span>{hostnameOf(item.url)}</span> : null}
        {item.publishedAt ? (
          <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
        ) : item.collectedAt ? (
          // Not the same claim: this is when STEPWIRE saw it, not when it
          // happened, and the board says which of the two it is showing.
          <time dateTime={item.collectedAt}>受信 {formatDateTime(item.collectedAt)}</time>
        ) : null}
        <a
          href={item.issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto underline underline-offset-4 hover:text-signal"
        >
          Issue →
        </a>
      </div>

      {item.degraded ? (
        <p className="mt-sm font-mono text-micro text-gray700">
          ⚠ 収集メタデータを読み取れませんでした。ラベルとタイトルのみ表示しています。
        </p>
      ) : null}

      <p className="mt-sm select-all bg-off-white px-sm py-[6px] font-mono text-micro text-gray700">
        pnpm article:from-issue {item.number}
      </p>
    </li>
  );
}
