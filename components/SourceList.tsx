import type { SourceRef } from '@/lib/content/schema';
import { formatDate, hostnameOf } from '@/lib/format';

/**
 * The sources block.
 *
 * Numbered to match the `[^n]` citation markers in the body, so a reader can
 * move between a claim and its evidence in either direction. This pairing is
 * the whole point of the STEPWIRE sourcing model.
 */
export function SourceList({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;

  return (
    <section aria-labelledby="sources-heading" className="border-t-2 border-line-strong pt-lg">
      <h2
        id="sources-heading"
        className="font-mono text-micro font-bold uppercase tracking-wider"
      >
        出典
      </h2>
      <ol className="mt-md space-y-md">
        {sources.map((source, index) => {
          const number = index + 1;
          return (
            <li
              key={source.url}
              id={`source-${number}`}
              className="grid grid-cols-[28px_1fr] gap-md scroll-mt-24 target:bg-line"
            >
              <span className="mt-[3px] flex h-[20px] w-[20px] items-center justify-center border border-line-strong font-mono text-[11px] leading-none">
                {number}
              </span>
              <div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-base font-medium leading-snug underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                >
                  {source.title}
                </a>
                <p className="mt-[2px] font-mono text-micro uppercase tracking-wide text-muted">
                  {source.publisher}
                  {source.type ? ` · ${source.type}` : ''} · {hostnameOf(source.url)}
                  {source.publishedAt ? ` · ${formatDate(source.publishedAt)}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Compact single-line attribution used on cards and in list views. */
export function SourceAttribution({ sources }: { sources: SourceRef[] }) {
  const primary = sources[0];
  if (!primary) return null;

  const extra = sources.length - 1;

  return (
    <p className="font-mono text-micro uppercase tracking-wide text-muted">
      <span aria-hidden="true">↳ </span>
      {primary.publisher}
      {extra > 0 ? ` +${extra} more` : ''}
    </p>
  );
}
