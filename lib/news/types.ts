import type { Category } from '../content/categories';
import type { SourceFilter } from './filter';

/**
 * A raw item exactly as an adapter found it. Adapters do no interpretation
 * beyond mapping their own format onto these fields — normalisation,
 * deduplication and classification all happen downstream, so a change to one
 * feed's shape cannot alter how the pipeline behaves.
 */
export interface RawItem {
  /** Best available canonical link for the item. */
  url: string;
  title: string;
  /** Feed-provided summary or description, if any. */
  summary?: string;
  publishedAt?: string;
  /** Anything else the adapter saw. Preserved verbatim in the issue body. */
  raw?: Record<string, unknown>;
}

/** A raw item joined to its source and given a stable identity. */
export interface CandidateNews {
  /** Deterministic identity — see `lib/news/dedupe.ts`. */
  collectorId: string;
  sourceId: string;
  sourceName: string;
  sourceCategory: SourceCategory;
  suggestedCategory: Category;
  title: string;
  url: string;
  normalizedUrl: string;
  summary?: string;
  publishedAt?: string;
  collectedAt: string;
  raw?: Record<string, unknown>;
}

export type SourceCategory = 'official' | 'media' | 'community';

export type SourceType =
  | 'rss'
  | 'atom'
  | 'json'
  | 'youtube'
  | 'html'
  | 'manual'
  | 'fixture';

export interface SourceDefinition {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  enabled: boolean;
  category: SourceCategory;
  /** Default STEPWIRE category suggested for items from this source. */
  suggestedCategory: Category;
  /** Homepage / attribution link shown in the issue body. */
  homepage?: string;
  /** Per-source cap on items collected per run. Protects against feed floods. */
  maxItems?: number;
  /**
   * Relevance filter. Required in practice for any feed that is not
   * DDR-specific — see `lib/news/filter.ts`.
   */
  filter?: SourceFilter;
  /** Free-form notes: terms of use, rate limits, contact. */
  notes?: string;
  /** Adapter-specific options (e.g. JSON field mapping). */
  options?: Record<string, unknown>;
}

export interface CollectRunResult {
  candidates: CandidateNews[];
  /** Candidates suppressed as duplicates, with the reason. */
  duplicates: { candidate: CandidateNews; reason: string }[];
  /** Per-source failures. A failing source never fails the run. */
  errors: { sourceId: string; message: string }[];
  /** Sources that were skipped because they are disabled. */
  skipped: string[];
}
