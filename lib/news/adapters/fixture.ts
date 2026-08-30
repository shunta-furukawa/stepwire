import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RawItem, SourceDefinition } from '../types';
import { parseFeed } from './feed';
import { parseJsonItems } from './json';
import type { AdapterContext, SourceAdapter } from './types';

/**
 * Fixture adapter — reads a feed from `data/fixtures/` instead of the network.
 *
 * This is what makes the collector safe to develop and to test in CI: the whole
 * pipeline (normalise, deduplicate, format an issue) can be exercised end to
 * end without making a single outbound request to anyone's server.
 *
 * `url` in `data/sources.yml` is a path relative to the repository root.
 */
export const fixtureAdapter: SourceAdapter = {
  type: 'fixture',
  async fetchItems(source: SourceDefinition, _context: AdapterContext): Promise<RawItem[]> {
    const filePath = path.resolve(process.cwd(), source.url);

    // Fixtures are repository files; refuse to read outside the tree.
    if (!filePath.startsWith(path.resolve(process.cwd()) + path.sep)) {
      throw new Error(`fixture path escapes the repository: ${source.url}`);
    }

    const raw = await readFile(filePath, 'utf8');

    if (filePath.endsWith('.json')) {
      return parseJsonItems(JSON.parse(raw), source.options ?? {});
    }
    return parseFeed(raw);
  },
};
