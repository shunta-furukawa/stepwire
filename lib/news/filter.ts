import type { RawItem } from './types';

/**
 * Per-source relevance filtering.
 *
 * Almost no real feed is DDR-specific. A community wiki's recent-changes feed
 * covers every game the wiki documents; a games-media feed covers every game
 * there is. Without a filter, a single collector run would bury one relevant
 * item under fifty irrelevant ones, and the editorial inbox — whose whole value
 * is being short enough to triage on a phone — stops being usable.
 *
 * So relevance is a property of the *source*, declared in `data/sources.yml`
 * next to the feed it applies to:
 *
 *     filter:
 *       include: ['DanceDanceRevolution', 'DDR']
 *       exclude: ['MenuBar', 'SOUND VOLTEX']
 *
 * Matching is case-insensitive substring against the title and the summary.
 * Deliberately not regular expressions: the registry is editorial
 * configuration meant to be reviewed by a human in a pull request, and a
 * mis-anchored regex fails in ways a substring cannot.
 */

export interface SourceFilter {
  /** The item must contain at least one of these. Absent means "keep all". */
  include?: string[];
  /** The item must contain none of these. Applied after `include`. */
  exclude?: string[];
}

function haystack(item: RawItem): string {
  return `${item.title}\n${item.summary ?? ''}`.toLowerCase();
}

export function matchesFilter(item: RawItem, filter?: SourceFilter): boolean {
  if (!filter) return true;

  const text = haystack(item);

  if (filter.exclude?.some((term) => text.includes(term.toLowerCase()))) {
    return false;
  }

  if (!filter.include || filter.include.length === 0) return true;

  return filter.include.some((term) => text.includes(term.toLowerCase()));
}

/** Applies a source's filter, reporting how many items it removed. */
export function applyFilter(
  items: RawItem[],
  filter?: SourceFilter,
): { kept: RawItem[]; removed: number } {
  if (!filter) return { kept: items, removed: 0 };
  const kept = items.filter((item) => matchesFilter(item, filter));
  return { kept, removed: items.length - kept.length };
}
