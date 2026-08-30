import type { RawItem, SourceDefinition, SourceType } from '../types';

/**
 * Fetch function injected into every adapter.
 *
 * Adapters never call `fetch` directly: tests supply a stub, and the runtime
 * supplies a wrapper that adds a User-Agent, a timeout and a per-host delay.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface AdapterContext {
  fetch: FetchLike;
  /** Injected so runs are reproducible in tests. */
  now: () => Date;
}

/**
 * A source adapter.
 *
 * Adapters are isolated on purpose: each one only knows its own format, throws
 * its own errors, and is never given the chance to affect another source. The
 * collector catches per-adapter failures, so a feed that changes shape or goes
 * offline degrades to one warning line rather than a failed run.
 */
export interface SourceAdapter {
  type: SourceType;
  fetchItems(source: SourceDefinition, context: AdapterContext): Promise<RawItem[]>;
}
