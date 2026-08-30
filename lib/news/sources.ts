import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { CATEGORIES } from '../content/categories';
import type { SourceDefinition } from './types';

/**
 * The source registry.
 *
 * Sources live in `data/sources.yml`, never in code. Adding a feed is a
 * one-file pull request that a reviewer can read without knowing TypeScript,
 * which is the point: the registry is editorial configuration, not software.
 */

export const sourceSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'source id must be lowercase kebab-case'),
  name: z.string().min(1),
  type: z.enum(['rss', 'atom', 'json', 'youtube', 'html', 'manual', 'fixture']),
  url: z.string().min(1),
  enabled: z.boolean().default(false),
  category: z.enum(['official', 'media', 'community']),
  suggestedCategory: z.enum(CATEGORIES).default('NEWS'),
  homepage: z.url().optional(),
  filter: z
    .object({
      include: z.array(z.string().min(1)).optional(),
      exclude: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  maxItems: z.number().int().positive().max(50).default(10),
  notes: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const sourceRegistrySchema = z.object({
  sources: z.array(sourceSchema).default([]),
});

export const SOURCES_PATH = path.join(process.cwd(), 'data', 'sources.yml');

export async function loadSources(filePath = SOURCES_PATH): Promise<SourceDefinition[]> {
  const raw = await readFile(filePath, 'utf8');
  return parseSources(raw, filePath);
}

export function parseSources(raw: string, filePath = SOURCES_PATH): SourceDefinition[] {
  const parsed = sourceRegistrySchema.safeParse(parseYaml(raw) ?? {});

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`invalid source registry (${filePath}):\n${issues}`);
  }

  const seen = new Set<string>();
  for (const source of parsed.data.sources) {
    if (seen.has(source.id)) {
      throw new Error(`duplicate source id "${source.id}" in ${filePath}`);
    }
    seen.add(source.id);
  }

  return parsed.data.sources;
}
