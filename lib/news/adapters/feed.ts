import { XMLParser } from 'fast-xml-parser';
import type { RawItem, SourceDefinition } from '../types';
import type { AdapterContext, SourceAdapter } from './types';

/**
 * RSS 2.0 and Atom 1.0 adapter.
 *
 * Both formats are handled by one adapter because they describe the same thing
 * with different tag names, and every publisher gets the choice slightly wrong
 * anyway (RSS feeds with Atom links, Atom feeds with `pubDate`). Handling both
 * shapes in one place is more robust than pretending they are separate.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  trimValues: true,
  // Some feeds wrap content in CDATA; keep it as a plain string.
  cdataPropName: '#cdata',
  // WordPress feeds emit numeric character references in titles
  // ("GALAXY BRAVE &#8211; MISERY"). Without this they survive parsing and end
  // up rendered verbatim in a headline, on the page and in the video.
  processEntities: true,
  htmlEntities: true,
});

function textOf(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = textOf(entry);
      if (text) return text;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textOf(record['#cdata'] ?? record['#text']);
  }
  return undefined;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Atom `<link>` elements carry the URL in an attribute and may appear several
 * times with different `rel` values; `rel="alternate"` (or no rel) is the one
 * that points at the article.
 */
function atomLink(value: unknown): string | undefined {
  for (const link of asArray(value as Record<string, unknown> | Record<string, unknown>[])) {
    if (typeof link === 'string') return link;
    if (typeof link !== 'object' || link === null) continue;
    const record = link as Record<string, unknown>;
    const rel = record['@rel'];
    if (rel === undefined || rel === 'alternate') {
      const href = record['@href'];
      if (typeof href === 'string') return href;
    }
  }
  // Fall back to any link at all rather than dropping the item.
  for (const link of asArray(value as Record<string, unknown> | Record<string, unknown>[])) {
    if (typeof link === 'object' && link !== null) {
      const href = (link as Record<string, unknown>)['@href'];
      if (typeof href === 'string') return href;
    }
  }
  return undefined;
}

/** Strips markup from a feed summary without pulling in an HTML parser. */
export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    // Numeric character references, which publishers use freely for dashes and
    // typographic quotes. Restricted to the Basic Multilingual Plane.
    .replace(/&#(\d{2,5});/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0xffff ? String.fromCodePoint(point) : '';
    })
    .replace(/&#x([0-9a-f]{2,4});/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return point > 0 && point <= 0xffff ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Timezone abbreviations `Date.parse` does not accept.
 *
 * `Date.parse` already resolves the RFC-822 US zones (GMT, EST/EDT, CST/CDT,
 * MST/MDT, PST/PDT); this map covers the Asia-Pacific ones it rejects, which is
 * what Japanese feeds actually emit. An abbreviation in neither set yields no
 * date at all — a supported state, since the item simply skips the age filter.
 */
const TIMEZONE_OFFSETS: Record<string, string> = {
  JST: '+0900',
  KST: '+0900',
  HKT: '+0800',
  SGT: '+0800',
  AEST: '+1000',
  NZST: '+1200',
};

function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined;

  let candidate = value.trim();
  const abbreviation = /\s([A-Z]{2,4})$/.exec(candidate)?.[1];
  if (abbreviation && TIMEZONE_OFFSETS[abbreviation]) {
    candidate = candidate.replace(/\s[A-Z]{2,4}$/, ` ${TIMEZONE_OFFSETS[abbreviation]}`);
  }

  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

/** Parses a feed document into raw items. Exported so it can be unit tested. */
export function parseFeed(xml: string): RawItem[] {
  const document = parser.parse(xml) as Record<string, unknown>;

  const rss = document['rss'] as Record<string, unknown> | undefined;
  const rdf = document['rdf:RDF'] as Record<string, unknown> | undefined;
  const feed = document['feed'] as Record<string, unknown> | undefined;

  // RSS 2.0/0.9x nests <item> inside <channel>; RSS 1.0 hangs them off <rdf:RDF>
  // alongside it. Both otherwise use the same element names, so one branch
  // handles the pair once the items have been located.
  const channel = (rss?.['channel'] ?? undefined) as Record<string, unknown> | undefined;
  const items = channel
    ? asArray(channel['item'] as Record<string, unknown>[])
    : rdf
      ? asArray(rdf['item'] as Record<string, unknown>[])
      : undefined;

  if (items) {
    return items
      .map((entry) => {
        const url =
          textOf(entry['link']) ??
          atomLink(entry['atom:link']) ??
          textOf(entry['guid']);
        const title = textOf(entry['title']);
        if (!url || !title) return null;

        const summaryRaw =
          textOf(entry['description']) ?? textOf(entry['content:encoded']);

        const item: RawItem = {
          url,
          title,
          ...(summaryRaw ? { summary: stripHtml(summaryRaw).slice(0, 600) } : {}),
          ...(toIso(textOf(entry['pubDate']) ?? textOf(entry['dc:date']))
            ? { publishedAt: toIso(textOf(entry['pubDate']) ?? textOf(entry['dc:date']))! }
            : {}),
          raw: {
            format: rdf ? 'rss1.0' : 'rss',
            guid: textOf(entry['guid']),
            categories: asArray(entry['category'] as unknown[])
              .map(textOf)
              .filter((value): value is string => Boolean(value)),
          },
        };
        return item;
      })
      .filter((item): item is RawItem => item !== null);
  }

  if (feed) {
    return asArray(feed['entry'] as Record<string, unknown>[])
      .map((entry) => {
        const url = atomLink(entry['link']) ?? textOf(entry['id']);
        const title = textOf(entry['title']);
        if (!url || !title) return null;

        const summaryRaw = textOf(entry['summary']) ?? textOf(entry['content']);
        const published = toIso(textOf(entry['published']) ?? textOf(entry['updated']));

        const item: RawItem = {
          url,
          title,
          ...(summaryRaw ? { summary: stripHtml(summaryRaw).slice(0, 600) } : {}),
          ...(published ? { publishedAt: published } : {}),
          raw: {
            format: 'atom',
            id: textOf(entry['id']),
            categories: asArray(entry['category'] as Record<string, unknown>[])
              .map((category) =>
                typeof category === 'object' && category !== null
                  ? (category['@term'] as string | undefined)
                  : textOf(category),
              )
              .filter((value): value is string => Boolean(value)),
          },
        };
        return item;
      })
      .filter((item): item is RawItem => item !== null);
  }

  throw new Error('document is neither an RSS/RDF channel nor an Atom feed');
}

export const feedAdapter: SourceAdapter = {
  type: 'rss',
  async fetchItems(source: SourceDefinition, context: AdapterContext): Promise<RawItem[]> {
    const response = await context.fetch(source.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return parseFeed(await response.text());
  },
};

/** Atom is the same adapter under a second registry key. */
export const atomAdapter: SourceAdapter = { ...feedAdapter, type: 'atom' };
