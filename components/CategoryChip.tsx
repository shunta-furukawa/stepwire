import Link from 'next/link';
import { CATEGORY_META, sectionForCategory, type Category } from '@/lib/content/categories';

/**
 * Category chip.
 *
 * Categories are distinguished by glyph and typography rather than by colour:
 * the palette stays monochrome so that the signal accent keeps meaning
 * "this is important" instead of "this is an update".
 */
export function CategoryChip({
  category,
  href = true,
  size = 'base',
}: {
  category: Category;
  href?: boolean;
  size?: 'small' | 'base';
}) {
  const meta = CATEGORY_META[category];
  const classes = [
    'inline-flex items-center gap-[6px] border border-ink font-mono uppercase tracking-wider',
    size === 'small' ? 'px-[6px] py-[1px] text-[10px]' : 'px-2 py-[3px] text-micro',
    href ? 'transition-colors hover:bg-ink hover:text-paper' : '',
  ].join(' ');

  const body = (
    <>
      <span aria-hidden="true" className="text-[0.85em] leading-none">
        {meta.glyph}
      </span>
      {category}
    </>
  );

  if (!href) {
    return <span className={classes}>{body}</span>;
  }

  return (
    <Link className={classes} href={`/${sectionForCategory(category)}`}>
      {body}
    </Link>
  );
}

/** A small, non-interactive marker for high-importance stories. */
export function ImportanceFlag({ importance }: { importance: string }) {
  if (importance !== 'breaking' && importance !== 'major') return null;

  return (
    <span className="inline-flex items-center gap-[6px] bg-signal px-2 py-[3px] font-mono text-micro font-bold uppercase tracking-wider text-paper">
      <span aria-hidden="true" className="wire-pulse block h-[6px] w-[6px] bg-paper" />
      {importance === 'breaking' ? '速報' : '重要'}
    </span>
  );
}
