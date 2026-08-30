import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFeed, stripHtml } from '../lib/news/adapters/feed';
import { parseJsonItems } from '../lib/news/adapters/json';
import { parseSources } from '../lib/news/sources';
import { collectNews } from '../lib/news/collect';
import { emptySeenIndex } from '../lib/news/dedupe';
import { issueBody, labelsFor, parseCollectorId } from '../lib/news/issue';
import { toCandidate } from '../lib/news/dedupe';
import type { SourceDefinition } from '../lib/news/types';

const fixture = (name: string) =>
  readFile(path.join(process.cwd(), 'data', 'fixtures', name), 'utf8');

describe('parseFeed (RSS)', () => {
  it('reads items from the sample RSS fixture', async () => {
    const items = parseFeed(await fixture('official-feed.xml'));
    expect(items).toHaveLength(3);

    const first = items[0]!;
    expect(first.title).toContain('per-panel accuracy readout');
    expect(first.url).toContain('summer-update');
    expect(first.publishedAt).toBe('2026-08-23T23:00:00.000Z');
    // CDATA-wrapped HTML is unwrapped and stripped.
    expect(first.summary).toContain('fictional');
    expect(first.summary).not.toContain('<');
  });

  it('carries feed categories through as raw metadata', async () => {
    const items = parseFeed(await fixture('official-feed.xml'));
    expect(items[0]!.raw?.format).toBe('rss');
    expect(items[0]!.raw?.categories).toContain('update');
  });
});

describe('parseFeed (Atom)', () => {
  it('reads entries and resolves the alternate link', async () => {
    const items = parseFeed(await fixture('community-feed.atom'));
    expect(items).toHaveLength(2);
    expect(items[0]!.url).toContain('qualifier');
    expect(items[0]!.publishedAt).toBe('2026-08-29T14:15:00.000Z');
    expect(items[0]!.raw?.format).toBe('atom');
  });
});

describe('parseFeed (invalid input)', () => {
  it('throws a legible error rather than returning nothing', () => {
    expect(() => parseFeed('<html><body>not a feed</body></html>')).toThrow(
      /neither an RSS channel nor an Atom feed/,
    );
  });
});

describe('parseJsonItems', () => {
  it('applies the configured field mapping', async () => {
    const payload = JSON.parse(await fixture('chart-releases.json'));
    const items = parseJsonItems(payload, {
      itemsPath: 'releases',
      fields: { url: 'link', title: 'name', summary: 'note', publishedAt: 'released_at' },
    });

    expect(items).toHaveLength(2);
    expect(items[0]!.title).toContain('300 BPM');
    expect(items[0]!.url).toContain('chart-pack');
    expect(items[0]!.publishedAt).toBe('2026-08-27T10:00:00.000Z');
  });

  it('defaults to the JSON Feed shape', () => {
    const items = parseJsonItems({
      items: [{ url: 'https://example.com/a', title: 'A', date_published: '2026-01-01' }],
    });
    expect(items[0]!.title).toBe('A');
  });

  it('reports a bad itemsPath clearly', () => {
    expect(() => parseJsonItems({}, { itemsPath: 'nope' })).toThrow(/options.itemsPath/);
  });

  it('skips entries missing a URL or a title rather than emitting junk', () => {
    const items = parseJsonItems({
      items: [{ url: 'https://example.com/a' }, { title: 'no url' }, { url: 'https://example.com/b', title: 'B' }],
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('B');
  });
});

describe('stripHtml', () => {
  it('removes markup and decodes the common entities', () => {
    expect(stripHtml('<p>a &amp; b</p><script>bad()</script>')).toBe('a & b');
  });
});

describe('parseSources', () => {
  it('parses the committed registry', async () => {
    const raw = await readFile(path.join(process.cwd(), 'data', 'sources.yml'), 'utf8');
    const sources = parseSources(raw);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => /^[a-z0-9-]+$/.test(source.id))).toBe(true);
  });

  it('defaults enabled to false, so a new source is never live by accident', () => {
    const sources = parseSources(`
sources:
  - id: new-source
    name: New Source
    type: rss
    url: https://example.com/feed.xml
    category: official
`);
    expect(sources[0]!.enabled).toBe(false);
    expect(sources[0]!.suggestedCategory).toBe('NEWS');
    expect(sources[0]!.maxItems).toBe(10);
  });

  it('rejects a duplicate source id', () => {
    expect(() =>
      parseSources(`
sources:
  - id: dupe
    name: A
    type: rss
    url: https://a.example/feed.xml
    category: official
  - id: dupe
    name: B
    type: rss
    url: https://b.example/feed.xml
    category: media
`),
    ).toThrow(/duplicate source id/);
  });

  it('rejects an id that is not kebab-case', () => {
    expect(() =>
      parseSources(`
sources:
  - id: Not_Kebab
    name: A
    type: rss
    url: https://a.example/feed.xml
    category: official
`),
    ).toThrow(/kebab-case/);
  });
});

describe('collectNews', () => {
  const registry = async (): Promise<SourceDefinition[]> =>
    parseSources(await readFile(path.join(process.cwd(), 'data', 'sources.yml'), 'utf8'));

  it('collects from fixtures without touching the network', async () => {
    const failingFetch = () => {
      throw new Error('the collector must not make network requests in this test');
    };

    const result = await collectNews({
      sources: await registry(),
      seen: emptySeenIndex(),
      fetch: failingFetch as never,
      now: () => new Date('2026-08-30T00:00:00.000Z'),
      only: ['fixture-official', 'fixture-community', 'fixture-json'],
      maxAgeDays: 365,
    });

    expect(result.errors).toEqual([]);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((candidate) => candidate.collectorId.length > 0)).toBe(true);
  });

  it('deduplicates the same story arriving from two fixture sources', async () => {
    const result = await collectNews({
      sources: await registry(),
      seen: emptySeenIndex(),
      now: () => new Date('2026-08-30T00:00:00.000Z'),
      only: ['fixture-official', 'fixture-json'],
      maxAgeDays: 365,
    });

    // The chart pack appears in both the RSS fixture and the JSON fixture at
    // the same canonical URL; only one candidate should survive.
    const chartPack = result.candidates.filter((candidate) =>
      candidate.normalizedUrl.includes('chart-pack'),
    );
    expect(chartPack).toHaveLength(1);
    expect(result.duplicates.length).toBeGreaterThan(0);
  });

  it('skips disabled sources instead of fetching them', async () => {
    const result = await collectNews({
      sources: await registry(),
      seen: emptySeenIndex(),
      now: () => new Date('2026-08-30T00:00:00.000Z'),
      maxAgeDays: 365,
    });
    expect(result.skipped).toContain('example-official');
  });

  it('turns one failing source into a warning, not a failed run', async () => {
    const sources: SourceDefinition[] = [
      {
        id: 'broken',
        name: 'Broken',
        type: 'fixture',
        url: 'data/fixtures/does-not-exist.xml',
        enabled: true,
        category: 'official',
        suggestedCategory: 'NEWS',
        maxItems: 10,
      },
      ...(await registry()).filter((source) => source.id === 'fixture-official'),
    ];

    const result = await collectNews({
      sources,
      seen: emptySeenIndex(),
      now: () => new Date('2026-08-30T00:00:00.000Z'),
      maxAgeDays: 365,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.sourceId).toBe('broken');
    // The healthy source still produced candidates.
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('drops items older than the age cutoff', async () => {
    const result = await collectNews({
      sources: await registry(),
      seen: emptySeenIndex(),
      now: () => new Date('2027-01-01T00:00:00.000Z'),
      only: ['fixture-official'],
      maxAgeDays: 14,
    });
    expect(result.candidates).toHaveLength(0);
  });

  it('honours the global limit', async () => {
    const result = await collectNews({
      sources: await registry(),
      seen: emptySeenIndex(),
      now: () => new Date('2026-08-30T00:00:00.000Z'),
      maxAgeDays: 365,
      limit: 2,
    });
    expect(result.candidates).toHaveLength(2);
  });
});

describe('issue formatting', () => {
  const candidate = toCandidate(
    {
      title: 'A headline',
      url: 'https://example.com/post',
      summary: 'A summary.',
      publishedAt: '2026-08-30T00:00:00.000Z',
      raw: { format: 'rss' },
    },
    {
      id: 'src',
      name: 'Source Name',
      type: 'rss',
      url: 'https://example.com/feed.xml',
      enabled: true,
      category: 'official',
      suggestedCategory: 'UPDATE',
      maxItems: 10,
    },
    '2026-08-30T01:00:00.000Z',
  );

  it('includes every field the editorial inbox needs', () => {
    const body = issueBody(candidate);
    for (const heading of [
      '## Headline',
      '## Source',
      '## Canonical URL',
      '## Published at',
      '## Collected at',
      '## Summary',
      '## Why it may matter',
      '## Raw metadata',
      '## Collector ID',
    ]) {
      expect(body).toContain(heading);
    }
  });

  it('embeds a machine-readable collector id that round-trips', () => {
    expect(parseCollectorId(issueBody(candidate))).toBe(candidate.collectorId);
  });

  it('labels by source category and suggested category, never by priority guess', () => {
    const labels = labelsFor(candidate);
    expect(labels).toContain('news-inbox');
    expect(labels).toContain('needs-review');
    expect(labels).toContain('source:official');
    expect(labels).toContain('category:update');
    // Priority is an editorial judgement; the collector always files as normal.
    expect(labels).toContain('priority:normal');
    expect(labels).not.toContain('priority:breaking');
  });
});
