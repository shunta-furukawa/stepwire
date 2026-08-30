import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFeed, stripHtml } from '../lib/news/adapters/feed';
import { applyFilter, matchesFilter } from '../lib/news/filter';
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

/**
 * These two fixtures are verbatim captures of live feeds, trimmed to three
 * items. They exist because both sources broke assumptions the hand-written
 * fixtures did not: 4Gamer serves RSS 1.0, and BEMANIWiki stamps dates with a
 * "JST" abbreviation. A synthetic fixture would only ever encode what we
 * already believed.
 */
describe('parseFeed (captured real feeds)', () => {
  it('parses RSS 1.0 (RDF), whose items are siblings of <channel>', async () => {
    const items = parseFeed(await fixture('4gamer-latest.captured.xml'));
    expect(items).toHaveLength(3);
    expect(items[0]!.raw?.format).toBe('rss1.0');
    expect(items[0]!.url).toMatch(/^https?:\/\//);
    expect(items[0]!.title.length).toBeGreaterThan(0);
    // RSS 1.0 dates the item with dc:date rather than pubDate.
    expect(items[0]!.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('parses a "JST" pubDate that Date.parse alone rejects', async () => {
    const items = parseFeed(await fixture('bemaniwiki-recent-changes.captured.xml'));
    expect(items).toHaveLength(3);
    // 21:58:37 JST is 12:58:37 UTC. Getting this wrong by nine hours would be
    // invisible without an assertion on the exact instant.
    expect(items[0]!.publishedAt).toBe('2026-08-30T12:58:37.000Z');
  });

  it('yields no date rather than a wrong one for an unknown timezone', () => {
    const [item] = parseFeed(
      `<?xml version="1.0"?><rss version="2.0"><channel><item>
         <title>Unknown zone</title><link>https://example.com/a</link>
         <pubDate>Sun, 30 Aug 2026 21:58:37 XYZ</pubDate>
       </item></channel></rss>`,
    );
    // An absent date is safe: the item just skips the age filter. A guessed one
    // would be silently wrong by hours.
    expect(item!.publishedAt).toBeUndefined();
  });
});

describe('parseFeed (invalid input)', () => {
  it('throws a legible error rather than returning nothing', () => {
    expect(() => parseFeed('<html><body>not a feed</body></html>')).toThrow(
      /neither an RSS\/RDF channel nor an Atom feed/,
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

  it('decodes numeric character references', () => {
    // WordPress emits these for dashes and typographic quotes.
    expect(stripHtml('GALAXY BRAVE &#8211; MISERY')).toBe('GALAXY BRAVE – MISERY');
    expect(stripHtml('&#x2014; dash')).toBe('— dash');
  });
});

describe('entity handling in titles', () => {
  it('decodes a numeric reference in a feed title', () => {
    // Left raw, this reaches the headline on the page and in the video.
    const [item] = parseFeed(
      `<?xml version="1.0"?><rss version="2.0"><channel><item>
         <title>GALAXY BRAVE &#8211; MISERY</title>
         <link>https://example.com/a</link>
       </item></channel></rss>`,
    );
    expect(item!.title).toBe('GALAXY BRAVE – MISERY');
  });
});

describe('source filtering', () => {
  const item = (title: string, summary?: string) => ({
    url: 'https://example.com/a',
    title,
    ...(summary ? { summary } : {}),
  });

  it('keeps everything when no filter is configured', () => {
    expect(matchesFilter(item('Anything at all'))).toBe(true);
  });

  it('keeps an item matching any include term', () => {
    const filter = { include: ['DanceDanceRevolution', 'DDR'] };
    // Real BEMANIWiki page titles.
    expect(matchesFilter(item('DanceDanceRevolution WORLD/新曲リスト'), filter)).toBe(true);
    expect(matchesFilter(item('DDR GRAND PRIX/解禁イベント'), filter)).toBe(true);
    expect(matchesFilter(item('SOUND VOLTEX ∇/新曲雑記'), filter)).toBe(false);
    expect(matchesFilter(item('jubeat beyond the Ave./新曲リスト'), filter)).toBe(false);
  });

  it('matches case-insensitively and searches the summary too', () => {
    const filter = { include: ['ddr'] };
    expect(matchesFilter(item('An update', 'Covers DDR WORLD.'), filter)).toBe(true);
    expect(matchesFilter(item('DANCEDANCEREVOLUTION'), { include: ['DanceDanceRevolution'] })).toBe(true);
  });

  it('applies exclude after include', () => {
    const filter = { include: ['DDR'], exclude: ['MenuBar'] };
    expect(matchesFilter(item('DDR WORLD/Contents'), filter)).toBe(true);
    expect(matchesFilter(item('MenuBar'), filter)).toBe(false);
    // Excluded even though it matches an include term.
    expect(matchesFilter(item('DDR MenuBar'), filter)).toBe(false);
  });

  it('reports how many items it removed', () => {
    const result = applyFilter(
      [item('DanceDanceRevolution WORLD'), item('SOUND VOLTEX'), item('jubeat')],
      { include: ['DanceDanceRevolution'] },
    );
    expect(result.kept).toHaveLength(1);
    expect(result.removed).toBe(2);
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
    // The registry keeps checked-but-rejected sources recorded and disabled.
    expect(result.skipped).toContain('reddit-ddr');
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
