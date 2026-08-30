import { z } from 'zod';
import type { RawItem, SourceDefinition } from '../types';
import { stripHtml } from './feed';
import type { AdapterContext, SourceAdapter } from './types';

/**
 * Generic JSON adapter.
 *
 * Covers JSON Feed out of the box and any other JSON endpoint through a field
 * mapping declared in `data/sources.yml`:
 *
 *     options:
 *       itemsPath: data.releases
 *       fields: { url: link, title: name, publishedAt: released_at }
 *
 * The mapping lives in configuration rather than in code so that adding an
 * official JSON API does not require a new adapter.
 */

const optionsSchema = z.object({
  /** Dot path to the array of items. Defaults to JSON Feed's `items`. */
  itemsPath: z.string().default('items'),
  fields: z
    .object({
      url: z.string().default('url'),
      title: z.string().default('title'),
      summary: z.string().default('summary'),
      publishedAt: z.string().default('date_published'),
    })
    .default({
      url: 'url',
      title: 'title',
      summary: 'summary',
      publishedAt: 'date_published',
    }),
});

function readPath(value: unknown, dotPath: string): unknown {
  if (dotPath === '') return value;
  return dotPath.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, value);
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  return undefined;
}

/** Exported for unit testing without a network round trip. */
export function parseJsonItems(payload: unknown, rawOptions: unknown = {}): RawItem[] {
  const options = optionsSchema.parse(rawOptions ?? {});
  const items = readPath(payload, options.itemsPath);

  if (!Array.isArray(items)) {
    throw new Error(`no array found at options.itemsPath "${options.itemsPath}"`);
  }

  return items
    .map((entry) => {
      const url = asText(readPath(entry, options.fields.url));
      const title = asText(readPath(entry, options.fields.title));
      if (!url || !title) return null;

      const summary = asText(readPath(entry, options.fields.summary));
      const published = asText(readPath(entry, options.fields.publishedAt));
      const parsedDate = published ? Date.parse(published) : NaN;

      const item: RawItem = {
        url,
        title,
        ...(summary ? { summary: stripHtml(summary).slice(0, 600) } : {}),
        ...(Number.isNaN(parsedDate)
          ? {}
          : { publishedAt: new Date(parsedDate).toISOString() }),
        raw: { format: 'json' },
      };
      return item;
    })
    .filter((item): item is RawItem => item !== null);
}

export const jsonAdapter: SourceAdapter = {
  type: 'json',
  async fetchItems(source: SourceDefinition, context: AdapterContext): Promise<RawItem[]> {
    const response = await context.fetch(source.url, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return parseJsonItems(await response.json(), source.options ?? {});
  },
};
