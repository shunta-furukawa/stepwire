import { parse as parseYaml } from 'yaml';

/**
 * Splits a `---` delimited YAML frontmatter block from a document body.
 *
 * A dedicated dependency (gray-matter et al.) would only add a second YAML
 * implementation to the tree; `yaml` is already needed for `data/sources.yml`.
 */
export function splitFrontmatter(raw: string): { data: unknown; body: string } {
  const normalised = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');

  if (!normalised.startsWith('---\n')) {
    throw new Error('missing YAML frontmatter block (file must start with "---")');
  }

  const end = normalised.indexOf('\n---', 3);
  if (end === -1) {
    throw new Error('unterminated YAML frontmatter block (missing closing "---")');
  }

  const yamlSource = normalised.slice(4, end);
  const body = normalised.slice(normalised.indexOf('\n', end + 1) + 1);

  return { data: parseYaml(yamlSource) ?? {}, body };
}
