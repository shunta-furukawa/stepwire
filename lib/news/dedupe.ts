import { createHash } from 'node:crypto';
import { normalizeTitle, normalizeUrl } from './url';
import type { CandidateNews, RawItem, SourceDefinition } from './types';

/**
 * Identity and deduplication.
 *
 * `collectorId` is deterministic: the same story collected on a different day,
 * from a different mirror URL, or after a re-run produces the same id. That id
 * is written into the GitHub issue body, so the issue itself becomes the
 * dedupe ledger and no separate database is needed.
 */

/** Stable id for a candidate: source identity + normalised URL. */
export function makeCollectorId(sourceId: string, url: string): string {
  const normalized = normalizeUrl(url);
  const digest = createHash('sha256').update(`${sourceId} ${normalized}`).digest('hex');
  return `${sourceId}-${digest.slice(0, 12)}`;
}

export function toCandidate(
  item: RawItem,
  source: SourceDefinition,
  collectedAt: string,
): CandidateNews {
  return {
    collectorId: makeCollectorId(source.id, item.url),
    sourceId: source.id,
    sourceName: source.name,
    sourceCategory: source.category,
    suggestedCategory: source.suggestedCategory,
    title: item.title.trim(),
    url: item.url.trim(),
    normalizedUrl: normalizeUrl(item.url),
    ...(item.summary ? { summary: item.summary.trim() } : {}),
    ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
    collectedAt,
    ...(item.raw ? { raw: item.raw } : {}),
  };
}

export interface DuplicateVerdict {
  duplicate: boolean;
  reason?: string;
}

/** The set of things already collected, in the forms the detector compares. */
export interface SeenIndex {
  collectorIds: Set<string>;
  normalizedUrls: Set<string>;
  normalizedTitles: Set<string>;
}

/**
 * Decides whether a candidate has already been seen.
 *
 * Deliberately a plain function behind an interface: the MVP compares ids,
 * normalised URLs and normalised titles, and a later revision can swap in
 * embedding similarity or an LLM judgement without touching the pipeline.
 */
export interface DuplicateDetector {
  (candidate: CandidateNews, seen: SeenIndex): DuplicateVerdict;
}

export function emptySeenIndex(): SeenIndex {
  return {
    collectorIds: new Set(),
    normalizedUrls: new Set(),
    normalizedTitles: new Set(),
  };
}

export function buildSeenIndex(entries: LedgerEntry[]): SeenIndex {
  const index = emptySeenIndex();
  for (const entry of entries) {
    index.collectorIds.add(entry.collectorId);
    index.normalizedUrls.add(entry.normalizedUrl);
    index.normalizedTitles.add(normalizeTitle(entry.title));
  }
  return index;
}

export function addToSeenIndex(index: SeenIndex, candidate: CandidateNews): void {
  index.collectorIds.add(candidate.collectorId);
  index.normalizedUrls.add(candidate.normalizedUrl);
  index.normalizedTitles.add(normalizeTitle(candidate.title));
}

/** The default detector. Cheap, deterministic, and explainable in a log line. */
export const defaultDuplicateDetector: DuplicateDetector = (candidate, seen) => {
  if (seen.collectorIds.has(candidate.collectorId)) {
    return { duplicate: true, reason: `collector id ${candidate.collectorId} already collected` };
  }
  if (seen.normalizedUrls.has(candidate.normalizedUrl)) {
    return {
      duplicate: true,
      reason: `normalized URL already collected: ${candidate.normalizedUrl}`,
    };
  }
  const title = normalizeTitle(candidate.title);
  // A title match across *different* sources is the syndication case: two
  // outlets reporting the same announcement. One issue is enough.
  if (title.length >= 24 && seen.normalizedTitles.has(title)) {
    return {
      duplicate: true,
      reason: 'an item with the same normalized headline was already collected',
    };
  }
  return { duplicate: false };
};

/** One row of the persisted collection ledger (`data/news-ledger.json`). */
export interface LedgerEntry {
  collectorId: string;
  normalizedUrl: string;
  title: string;
  sourceId: string;
  collectedAt: string;
  /** The issue that was opened for this candidate, when one was. */
  issueNumber?: number;
}

export interface Ledger {
  version: 1;
  entries: LedgerEntry[];
}

export function emptyLedger(): Ledger {
  return { version: 1, entries: [] };
}

/**
 * Trims the ledger so the committed file cannot grow without bound. Entries are
 * only needed for as long as a feed might still be serving the same item.
 */
export function pruneLedger(ledger: Ledger, retainDays = 180, now = Date.now()): Ledger {
  const cutoff = now - retainDays * 24 * 60 * 60 * 1000;
  return {
    version: 1,
    entries: ledger.entries.filter((entry) => Date.parse(entry.collectedAt) >= cutoff),
  };
}
