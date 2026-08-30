import type { SourceType } from '../types';
import { atomAdapter, feedAdapter } from './feed';
import { jsonAdapter } from './json';
import { youtubeAdapter } from './youtube';
import { fixtureAdapter } from './fixture';
import type { AdapterContext, FetchLike, SourceAdapter } from './types';

export type { AdapterContext, FetchLike, SourceAdapter };

/**
 * The adapter registry.
 *
 * `html` and `manual` are intentionally absent.
 *
 * `html` — STEPWIRE does not scrape. Official feeds, official APIs and public
 * feeds are the collection surface. A site-specific HTML adapter may be added
 * later, but only per site and only after checking robots.txt and terms,
 * setting a request budget, caching responses and recording attribution. See
 * `docs/sources.md`.
 *
 * `manual` — a human pasting a link needs an issue template, not a collector.
 * `.github/ISSUE_TEMPLATE/news-candidate.yml` is that path.
 *
 * `youtube` is a first-party API rather than a feed: YouTube's robots.txt
 * disallows `/feeds/videos.xml`, so official video is collected through the
 * documented Data API v3 instead. See `lib/news/adapters/youtube.ts`.
 */
export const ADAPTERS: Partial<Record<SourceType, SourceAdapter>> = {
  rss: feedAdapter,
  atom: atomAdapter,
  json: jsonAdapter,
  youtube: youtubeAdapter,
  fixture: fixtureAdapter,
};

export function getAdapter(type: SourceType): SourceAdapter | undefined {
  return ADAPTERS[type];
}

const USER_AGENT =
  'STEPWIRE-Collector/0.1 (+https://github.com/shunta-furukawa/stepwire; DDR news aggregation)';

/**
 * The runtime fetch wrapper.
 *
 * Identifies itself, gives up rather than hanging a workflow, and refuses to
 * follow a feed into a non-HTTP scheme.
 */
export function createFetch(timeoutMs = 15_000): FetchLike {
  return async (url, init) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`refusing to fetch non-HTTP URL: ${url}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*',
          ...init?.headers,
        },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
