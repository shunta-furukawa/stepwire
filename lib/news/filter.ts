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
 * Matching is case-insensitive substring against the title and the summary,
 * except the exact term `DDR`: adjacent ASCII letters or digits make it part
 * of another word (e.g. NomadDrive), not the game's abbreviation. Japanese
 * text and punctuation can sit directly beside DDR. Terms stay literal;
 * the registry does not accept regular expressions.
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

function matchesTerm(text: string, term: string): boolean {
  const normalized = term.toLowerCase();
  // ASCII alphanumerics let DDRの新曲 match and treat underscores as
  // punctuation rather than word characters.
  if (normalized === 'ddr') return /(?:^|[^a-z0-9])ddr(?=$|[^a-z0-9])/.test(text);
  return text.includes(normalized);
}

export function matchesFilter(item: RawItem, filter?: SourceFilter): boolean {
  if (!filter) return true;

  const text = haystack(item);

  if (filter.exclude?.some((term) => matchesTerm(text, term))) {
    return false;
  }

  if (!filter.include || filter.include.length === 0) return true;

  return filter.include.some((term) => matchesTerm(text, term));
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
