import { createFetch, getAdapter, type AdapterContext, type FetchLike } from './adapters';
import { applyFilter } from './filter';
import {
  addToSeenIndex,
  defaultDuplicateDetector,
  emptySeenIndex,
  toCandidate,
  type DuplicateDetector,
  type SeenIndex,
} from './dedupe';
import type { CandidateNews, CollectRunResult, SourceDefinition } from './types';

/**
 * The collection pipeline.
 *
 *   sources → adapter → normalize → deduplicate → candidates
 *
 * Everything here is pure orchestration over injected pieces: the fetcher, the
 * clock and the duplicate detector are all parameters. That is what lets the
 * whole pipeline run against fixtures in CI with no network at all.
 */

export interface CollectOptions {
  sources: SourceDefinition[];
  /** Candidates already known — from the ledger and from open GitHub issues. */
  seen?: SeenIndex;
  fetch?: FetchLike;
  now?: () => Date;
  isDuplicate?: DuplicateDetector;
  /** Restrict the run to these source ids. */
  only?: string[];
  /** Global cap across all sources, applied after deduplication. */
  limit?: number;
  /** Ignore items published more than this many days ago. */
  maxAgeDays?: number;
  onLog?: (message: string) => void;
}

export async function collectNews(options: CollectOptions): Promise<CollectRunResult> {
  const {
    sources,
    seen = emptySeenIndex(),
    fetch: fetchImpl = createFetch(),
    now = () => new Date(),
    isDuplicate = defaultDuplicateDetector,
    only,
    limit = 20,
    maxAgeDays = 14,
    onLog = () => {},
  } = options;

  const context: AdapterContext = { fetch: fetchImpl, now };
  const collectedAt = now().toISOString();
  const ageCutoff = now().getTime() - maxAgeDays * 24 * 60 * 60 * 1000;

  const result: CollectRunResult = {
    candidates: [],
    duplicates: [],
    errors: [],
    skipped: [],
  };

  for (const source of sources) {
    if (only && !only.includes(source.id)) continue;

    if (!source.enabled) {
      result.skipped.push(source.id);
      continue;
    }

    const adapter = getAdapter(source.type);
    if (!adapter) {
      result.errors.push({
        sourceId: source.id,
        message: `no adapter registered for type "${source.type}"`,
      });
      continue;
    }

    let items;
    try {
      items = await adapter.fetchItems(source, context);
    } catch (error) {
      // A broken source is a warning, never a failed run. One publisher
      // changing their feed must not stop the rest of the newsroom.
      result.errors.push({ sourceId: source.id, message: (error as Error).message });
      continue;
    }

    // Filter before capping: applying `maxItems` first would spend the budget
    // on items the filter is about to discard, and a busy multi-game feed would
    // then yield nothing relevant at all.
    const { kept, removed } = applyFilter(items, source.filter);
    onLog(
      `${source.id}: ${items.length} item(s) fetched` +
        (removed > 0 ? `, ${removed} filtered out as off-topic` : ''),
    );

    const perSource = kept.slice(0, source.maxItems ?? 10);

    for (const item of perSource) {
      const candidate = toCandidate(item, source, collectedAt);

      if (candidate.publishedAt && Date.parse(candidate.publishedAt) < ageCutoff) {
        continue;
      }

      const verdict = isDuplicate(candidate, seen);
      if (verdict.duplicate) {
        result.duplicates.push({
          candidate,
          reason: verdict.reason ?? 'duplicate',
        });
        continue;
      }

      // Add immediately so two items inside the same run cannot both pass.
      addToSeenIndex(seen, candidate);
      result.candidates.push(candidate);
    }
  }

  result.candidates.sort(
    (a, b) => Date.parse(b.publishedAt ?? b.collectedAt) - Date.parse(a.publishedAt ?? a.collectedAt),
  );

  if (result.candidates.length > limit) {
    onLog(`capping ${result.candidates.length} candidate(s) at limit ${limit}`);
    result.candidates = result.candidates.slice(0, limit);
  }

  return result;
}

/** Convenience: candidates grouped by source, for run summaries. */
export function groupBySource(candidates: CandidateNews[]): Map<string, CandidateNews[]> {
  const groups = new Map<string, CandidateNews[]>();
  for (const candidate of candidates) {
    const existing = groups.get(candidate.sourceId);
    if (existing) existing.push(candidate);
    else groups.set(candidate.sourceId, [candidate]);
  }
  return groups;
}
