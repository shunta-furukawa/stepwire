import { describe, expect, it } from 'vitest';
import {
  articleCitations,
  contentHash,
  parseArticle,
  splitSections,
  toVideoInput,
} from '../lib/content/article';
import { splitFrontmatter } from '../lib/content/frontmatter';
import { loadAllArticles } from '../lib/content/loader';
import { validateArticle, validateArticles } from '../lib/content/validate';

const VALID = `---
id: t-1
slug: a-test-article
title: A test article
publishedAt: '2026-08-30T09:00:00+09:00'
category: UPDATE
summary: One factual sentence.
status: published
sources:
  - title: The announcement
    publisher: Example
    url: https://example.com/a
    type: official
---

## NEWS

Something happened.[^1]

## CONTEXT

Why it matters.

## PLAYER IMPACT

What changes for a player.
`;

describe('splitFrontmatter', () => {
  it('separates YAML frontmatter from the body', () => {
    const { data, body } = splitFrontmatter(VALID);
    expect((data as { slug: string }).slug).toBe('a-test-article');
    expect(body).toContain('## NEWS');
  });

  it('rejects a file with no frontmatter', () => {
    expect(() => splitFrontmatter('## NEWS\n\ntext')).toThrow(/missing YAML frontmatter/);
  });

  it('rejects an unterminated frontmatter block', () => {
    expect(() => splitFrontmatter('---\nslug: x\n')).toThrow(/unterminated/);
  });
});

describe('splitSections', () => {
  it('splits the three STEPWIRE sections', () => {
    const sections = splitSections(
      '## NEWS\n\na\n\n## CONTEXT\n\nb\n\n## PLAYER IMPACT\n\nc\n',
    );
    expect(sections).toEqual({ news: 'a', context: 'b', playerImpact: 'c' });
  });

  it('rejects an unknown section heading', () => {
    expect(() => splitSections('## OPINION\n\nx\n')).toThrow(/unknown section heading/);
  });

  it('rejects a missing section', () => {
    expect(() => splitSections('## NEWS\n\na\n')).toThrow(/missing or empty section/);
  });

  it('rejects an empty section', () => {
    expect(() =>
      splitSections('## NEWS\n\na\n\n## CONTEXT\n\n\n## PLAYER IMPACT\n\nc\n'),
    ).toThrow(/missing or empty section/);
  });
});

describe('parseArticle', () => {
  it('parses frontmatter and all three sections', () => {
    const article = parseArticle(VALID, { filePath: 'test.mdx' });
    expect(article.slug).toBe('a-test-article');
    expect(article.sections.news.text).toBe('Something happened.');
    expect(article.sections.context.heading).toBe('CONTEXT');
    expect(article.sections.playerImpact.blocks).toHaveLength(1);
  });

  it('reports invalid frontmatter with the offending field', () => {
    expect(() => parseArticle(VALID.replace('category: UPDATE', 'category: NOPE'), { filePath: 'x' })).toThrow(
      /category/,
    );
  });

  it('forces the fixture flag for content loaded from the fixtures directory', () => {
    const article = parseArticle(VALID, { filePath: 'x', forceFixture: true });
    expect(article.fixture).toBe(true);
  });
});

describe('contentHash', () => {
  it('is stable and changes when the content changes', () => {
    expect(contentHash(VALID)).toBe(contentHash(VALID));
    expect(contentHash(VALID)).not.toBe(contentHash(`${VALID}\n`));
  });
});

describe('articleCitations', () => {
  it('deduplicates and sorts citation indices across sections', () => {
    const article = parseArticle(
      VALID.replace('Why it matters.', 'Analysis.[^1] More.[^1]'),
      { filePath: 'x' },
    );
    expect(articleCitations(article)).toEqual([1]);
  });
});

describe('validateArticle', () => {
  it('accepts a well-formed, sourced article', () => {
    const issues = validateArticle(parseArticle(VALID, { filePath: 'x' }));
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it('rejects a published report with no sources', () => {
    const raw = VALID.replace(
      /sources:\n(  - .*\n|    .*\n)+/,
      'sources: []\n',
    ).replace('Something happened.[^1]', 'Something happened.');

    const issues = validateArticle(parseArticle(raw, { filePath: 'x' }));
    expect(issues.some((issue) => issue.level === 'error' && /requires at least one entry/.test(issue.message))).toBe(true);
  });

  it('rejects a citation that points at no source', () => {
    const article = parseArticle(VALID.replace('[^1]', '[^4]'), { filePath: 'x' });
    const issues = validateArticle(article);
    expect(issues.some((issue) => issue.level === 'error' && /citation \[\^4\]/.test(issue.message))).toBe(true);
  });

  it('rejects a published report whose NEWS section cites nothing', () => {
    const raw = VALID.replace('Something happened.[^1]', 'Something happened.').replace(
      'Why it matters.',
      'Why it matters.[^1]',
    );
    const issues = validateArticle(parseArticle(raw, { filePath: 'x' }));
    expect(
      issues.some(
        (issue) => issue.level === 'error' && /NEWS section .* must contain at least one/.test(issue.message),
      ),
    ).toBe(true);
  });

  it('warns about a source that is never cited', () => {
    const raw = VALID.replace('Something happened.[^1]', 'Something happened.').replace(
      'Why it matters.',
      'Why it matters.[^1]',
    );
    const issues = validateArticle(parseArticle(raw, { filePath: 'x' }));
    expect(issues.some((issue) => issue.level === 'warning')).toBe(false);
  });

  it('rejects updatedAt earlier than publishedAt', () => {
    const raw = VALID.replace(
      "publishedAt: '2026-08-30T09:00:00+09:00'",
      "publishedAt: '2026-08-30T09:00:00+09:00'\nupdatedAt: '2026-08-29T09:00:00+09:00'",
    );
    const issues = validateArticle(parseArticle(raw, { filePath: 'x' }));
    expect(issues.some((issue) => /earlier than/.test(issue.message))).toBe(true);
  });

  it('exempts fixtures from the sourcing rules', () => {
    const article = parseArticle(VALID.replace('title: A test article', 'title: SAMPLE article'), {
      filePath: 'x',
      forceFixture: true,
    });
    expect(validateArticle(article).filter((issue) => issue.level === 'error')).toEqual([]);
  });
});

describe('validateArticles', () => {
  it('rejects duplicate slugs and ids across files', () => {
    const a = parseArticle(VALID, { filePath: 'a.mdx' });
    const b = parseArticle(VALID, { filePath: 'b.mdx' });
    const issues = validateArticles([a, b]);
    expect(issues.some((issue) => /duplicate slug/.test(issue.message))).toBe(true);
    expect(issues.some((issue) => /duplicate id/.test(issue.message))).toBe(true);
  });
});

describe('loadAllArticles', () => {
  it('loads the committed content and marks fixtures', async () => {
    const articles = await loadAllArticles();
    expect(articles.length).toBeGreaterThan(0);
    expect(
      articles
        .filter((article) => article.filePath.includes('content/fixtures/'))
        .every((article) => article.fixture),
    ).toBe(true);
  });

  it('returns articles newest first', async () => {
    const articles = await loadAllArticles();
    const dates = articles.map((article) => Date.parse(article.publishedAt));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it('passes validation for every committed article', async () => {
    const issues = validateArticles(await loadAllArticles());
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
  });
});

describe('toVideoInput', () => {
  it('projects the article to plain strings for the video boundary', () => {
    const input = toVideoInput(parseArticle(VALID, { filePath: 'x' }));
    expect(input.news).toBe('Something happened.');
    expect(input.primarySource?.publisher).toBe('Example');
    // The projection must survive serialisation to the renderer.
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
  });
});

describe('pictures in the prose', () => {
  const source = (body: string, media = true) => `---
id: 20260903-pictures
slug: pictures-in-the-prose
title: 'Pictures'
publishedAt: '2026-09-03T12:00:00+09:00'
category: CHARTS
summary: 'A summary.'
status: review
sources:
  - title: 'A'
    publisher: 'B'
    url: https://example.com/a
${media ? `media:
  - src: images/articles/x/result.jpg
    alt: 'the result'
    credit: 'MONO DDR'
    caption: 'A caption'
` : ''}---

## NEWS

Fact.[^1]

## CONTEXT

![](images/articles/x/result.jpg)

Words about the result.

## PLAYER IMPACT

More words.
`;

  it('binds an inline picture to its media entry, credit included', async () => {
    const { parseArticle, toVideoInput } = await import('../lib/content/article');
    const article = parseArticle(source(''), { filePath: 'x.mdx' });
    const image = article.sections.context.blocks.find((b) => b.type === 'image');
    if (!image || image.type !== 'image') throw new Error('expected an image block');
    expect(image.credit).toBe('MONO DDR');
    expect(image.caption).toBe('A caption');
    expect(image.alt).toBe('the result');

    const blocks = toVideoInput(article).blocks!.context;
    expect(blocks.map((b) => b.kind)).toEqual(['image', 'paragraph']);
  });

  it('refuses a picture the frontmatter never declared', async () => {
    const { parseArticle } = await import('../lib/content/article');
    expect(() => parseArticle(source('', false), { filePath: 'x.mdx' })).toThrow(/not declared in media/);
  });
});
