import { describe, expect, it } from 'vitest';
import {
  addToSeenIndex,
  buildSeenIndex,
  defaultDuplicateDetector,
  emptySeenIndex,
  makeCollectorId,
  pruneLedger,
  toCandidate,
  type LedgerEntry,
} from '../lib/news/dedupe';
import type { SourceDefinition } from '../lib/news/types';

const source: SourceDefinition = {
  id: 'test-source',
  name: 'Test Source',
  type: 'rss',
  url: 'https://example.com/feed.xml',
  enabled: true,
  category: 'official',
  suggestedCategory: 'UPDATE',
  maxItems: 10,
};

const COLLECTED_AT = '2026-08-30T00:00:00.000Z';

describe('makeCollectorId', () => {
  it('is deterministic', () => {
    const a = makeCollectorId('src', 'https://example.com/post');
    const b = makeCollectorId('src', 'https://example.com/post');
    expect(a).toBe(b);
  });

  it('is stable across tracking parameters, http/https and a trailing slash', () => {
    const canonical = makeCollectorId('src', 'https://example.com/post');
    expect(makeCollectorId('src', 'https://example.com/post?utm_source=rss')).toBe(canonical);
    expect(makeCollectorId('src', 'http://www.example.com/post/')).toBe(canonical);
  });

  it('differs per source, so two feeds carrying one story stay distinguishable', () => {
    expect(makeCollectorId('a', 'https://example.com/post')).not.toBe(
      makeCollectorId('b', 'https://example.com/post'),
    );
  });

  it('is prefixed with the source id for legibility in an issue body', () => {
    expect(makeCollectorId('test-source', 'https://example.com/x')).toMatch(/^test-source-[0-9a-f]{12}$/);
  });
});

describe('defaultDuplicateDetector', () => {
  const candidate = (title: string, url: string, sourceId = 'test-source') =>
    toCandidate({ title, url }, { ...source, id: sourceId }, COLLECTED_AT);

  it('passes an unseen candidate', () => {
    const seen = emptySeenIndex();
    const verdict = defaultDuplicateDetector(
      candidate('A headline about a summer update', 'https://example.com/a'),
      seen,
    );
    expect(verdict.duplicate).toBe(false);
  });

  it('suppresses the same item on a second run', () => {
    const seen = emptySeenIndex();
    const item = candidate('A headline about a summer update', 'https://example.com/a');
    addToSeenIndex(seen, item);
    expect(defaultDuplicateDetector(item, seen).duplicate).toBe(true);
  });

  it('suppresses the same item when a feed adds tracking parameters between runs', () => {
    const seen = emptySeenIndex();
    addToSeenIndex(seen, candidate('First wording', 'https://example.com/a'));
    const verdict = defaultDuplicateDetector(
      candidate('Different wording entirely here', 'https://example.com/a?utm_source=x'),
      seen,
    );
    // Same source and same normalized URL resolve to the same collector id, so
    // the id rule fires before the URL rule ever needs to.
    expect(verdict.duplicate).toBe(true);
    expect(verdict.reason).toContain('collector id');
  });

  it('suppresses the same URL republished by a different source', () => {
    const seen = emptySeenIndex();
    addToSeenIndex(seen, candidate('First wording', 'https://example.com/a', 'source-a'));
    const verdict = defaultDuplicateDetector(
      candidate('Different wording entirely here', 'https://example.com/a', 'source-b'),
      seen,
    );
    expect(verdict.duplicate).toBe(true);
    expect(verdict.reason).toContain('normalized URL');
  });

  it('suppresses the same headline syndicated by a second source', () => {
    const seen = emptySeenIndex();
    addToSeenIndex(
      seen,
      candidate('Summer update adds a per-panel accuracy readout', 'https://a.example/1', 'a'),
    );
    const verdict = defaultDuplicateDetector(
      candidate('Summer update adds a per-panel accuracy readout', 'https://b.example/2', 'b'),
      seen,
    );
    expect(verdict.duplicate).toBe(true);
    expect(verdict.reason).toContain('headline');
  });

  it('does not treat two short, similar headlines as one story', () => {
    const seen = emptySeenIndex();
    addToSeenIndex(seen, candidate('New pack', 'https://a.example/1', 'a'));
    const verdict = defaultDuplicateDetector(
      candidate('New pack', 'https://b.example/2', 'b'),
      seen,
    );
    // Below the length threshold, a title collision is too weak a signal.
    expect(verdict.duplicate).toBe(false);
  });
});

describe('buildSeenIndex', () => {
  it('indexes ledger entries by id, URL and normalized title', () => {
    const entries: LedgerEntry[] = [
      {
        collectorId: 'src-abc123',
        normalizedUrl: 'https://example.com/a',
        title: 'A Long Enough Headline To Compare',
        sourceId: 'src',
        collectedAt: COLLECTED_AT,
      },
    ];
    const index = buildSeenIndex(entries);
    expect(index.collectorIds.has('src-abc123')).toBe(true);
    expect(index.normalizedUrls.has('https://example.com/a')).toBe(true);
    expect(index.normalizedTitles.has('a long enough headline to compare')).toBe(true);
  });
});

describe('pruneLedger', () => {
  it('drops entries older than the retention window', () => {
    const now = Date.parse('2026-08-30T00:00:00.000Z');
    const ledger = {
      version: 1 as const,
      entries: [
        {
          collectorId: 'old',
          normalizedUrl: 'https://example.com/old',
          title: 'Old',
          sourceId: 'src',
          collectedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          collectorId: 'recent',
          normalizedUrl: 'https://example.com/recent',
          title: 'Recent',
          sourceId: 'src',
          collectedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    };

    const pruned = pruneLedger(ledger, 180, now);
    expect(pruned.entries.map((entry) => entry.collectorId)).toEqual(['recent']);
  });
});

describe('toCandidate', () => {
  it('carries the source identity and normalizes the URL', () => {
    const result = toCandidate(
      {
        title: '  A headline  ',
        url: 'https://www.example.com/post/?utm_source=rss',
        summary: '  a summary  ',
      },
      source,
      COLLECTED_AT,
    );

    expect(result.title).toBe('A headline');
    expect(result.summary).toBe('a summary');
    expect(result.normalizedUrl).toBe('https://example.com/post');
    expect(result.sourceId).toBe('test-source');
    expect(result.suggestedCategory).toBe('UPDATE');
    // The original URL is preserved: the issue must link where the source did.
    expect(result.url).toBe('https://www.example.com/post/?utm_source=rss');
  });
});
