import { describe, expect, it } from 'vitest';
import {
  articleFrontmatterSchema,
  sourceRefSchema,
  videoOverrideSchema,
} from '../lib/content/schema';

const validFrontmatter = {
  id: 'test-1',
  slug: 'a-valid-slug',
  title: 'A headline',
  publishedAt: '2026-08-30T09:00:00+09:00',
  category: 'UPDATE',
  summary: 'One factual sentence.',
  status: 'published',
};

describe('articleFrontmatterSchema', () => {
  it('accepts minimal valid frontmatter and applies defaults', () => {
    const parsed = articleFrontmatterSchema.parse(validFrontmatter);
    expect(parsed.tags).toEqual([]);
    expect(parsed.sources).toEqual([]);
    expect(parsed.importance).toBe('normal');
    expect(parsed.fixture).toBe(false);
  });

  it('rejects a slug that is not lowercase kebab-case', () => {
    for (const slug of ['Not Kebab', 'trailing-', 'UPPER', 'double--dash', '']) {
      const result = articleFrontmatterSchema.safeParse({ ...validFrontmatter, slug });
      expect(result.success, `slug "${slug}" should be rejected`).toBe(false);
    }
  });

  it('rejects an unknown category', () => {
    const result = articleFrontmatterSchema.safeParse({
      ...validFrontmatter,
      category: 'OPINION',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unparseable publishedAt', () => {
    const result = articleFrontmatterSchema.safeParse({
      ...validFrontmatter,
      publishedAt: 'last tuesday',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a summary longer than the metadata budget', () => {
    const result = articleFrontmatterSchema.safeParse({
      ...validFrontmatter,
      summary: 'x'.repeat(321),
    });
    expect(result.success).toBe(false);
  });
});

describe('sourceRefSchema', () => {
  it('requires a title, a publisher and a valid URL', () => {
    expect(
      sourceRefSchema.safeParse({
        title: 'Announcement',
        publisher: 'KONAMI',
        url: 'https://example.com/a',
      }).success,
    ).toBe(true);

    expect(
      sourceRefSchema.safeParse({
        title: 'Announcement',
        publisher: 'KONAMI',
        url: 'not-a-url',
      }).success,
    ).toBe(false);

    expect(
      sourceRefSchema.safeParse({ title: 'Announcement', url: 'https://example.com/a' })
        .success,
    ).toBe(false);
  });
});

describe('videoOverrideSchema', () => {
  it('accepts partial overrides', () => {
    const parsed = videoOverrideSchema.parse({ hook: 'A short hook' });
    expect(parsed.hook).toBe('A short hook');
    expect(parsed.scenes).toBeUndefined();
  });

  it('caps a scene override duration so an override cannot run away', () => {
    const result = videoOverrideSchema.safeParse({
      scenes: { intro: { durationInSeconds: 120 } },
    });
    expect(result.success).toBe(false);
  });
});
