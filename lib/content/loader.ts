import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { parseArticle, toVideoInput, type Article, type ArticleVideoInput } from './article';
import { loadTranscript } from './narration';
import type { Category } from './categories';

/**
 * Filesystem-backed article store.
 *
 * There is no database and no CMS: the Git working tree is the source of truth.
 * Everything here runs at build time (or on a cached server render), so the
 * published site is fully static.
 */

const CONTENT_ROOT = path.join(process.cwd(), 'content');

/**
 * `content/articles` holds real reporting. `content/fixtures` holds the seeded
 * sample articles that exist so the design and the video system can be
 * developed without publishing anything that looks like news. Fixtures can be
 * dropped from a production build with `STEPWIRE_INCLUDE_FIXTURES=false`.
 */
const DIRECTORIES = [
  { dir: 'articles', forceFixture: false },
  { dir: 'fixtures', forceFixture: true },
] as const;

export function fixturesEnabled(): boolean {
  return process.env.STEPWIRE_INCLUDE_FIXTURES !== 'false';
}

async function listMdx(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
      .map((entry) => path.join(dir, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Loads and parses every article. Unlike `getArticles()` this includes drafts
 * and fixtures regardless of environment — content validation needs to see
 * everything.
 */
export async function loadAllArticles(): Promise<Article[]> {
  const articles: Article[] = [];

  for (const { dir, forceFixture } of DIRECTORIES) {
    const files = await listMdx(path.join(CONTENT_ROOT, dir));
    for (const file of files) {
      const relative = path.relative(process.cwd(), file);
      const raw = await readFile(file, 'utf8');
      try {
        articles.push(parseArticle(raw, { filePath: relative, forceFixture }));
      } catch (error) {
        throw new Error(`${relative}: ${(error as Error).message}`);
      }
    }
  }

  return articles.sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}

/**
 * Published articles, newest first — what the website renders.
 *
 * `cache()` deduplicates the filesystem read across a single render pass; Next
 * then caches the rendered output itself.
 */
export const getArticles = cache(async (): Promise<Article[]> => {
  const all = await loadAllArticles();
  const includeFixtures = fixturesEnabled();
  return all.filter(
    (article) => article.status === 'published' && (includeFixtures || !article.fixture),
  );
});

/**
 * Everything the studio may preview: drafts and reviews as well as what is
 * published. The website never sees these — `getArticles` is what it reads —
 * but the operator has to watch a draft's film before deciding to publish it,
 * or the review step is a review of the text alone.
 */
export const getStudioArticles = cache(async (): Promise<Article[]> => {
  const all = await loadAllArticles();
  const includeFixtures = fixturesEnabled();
  return all.filter(
    (article) => article.status !== 'archived' && (includeFixtures || !article.fixture),
  );
});

export const getArticleBySlug = cache(
  async (slug: string): Promise<Article | undefined> => {
    const articles = await getArticles();
    return articles.find((article) => article.slug === slug);
  },
);

export async function getArticlesByCategories(categories: Category[]): Promise<Article[]> {
  const articles = await getArticles();
  return articles.filter((article) => categories.includes(article.category));
}

/** Articles that are safe to expose in the sitemap and the RSS feed. */
export async function getSyndicatableArticles(): Promise<Article[]> {
  const articles = await getArticles();
  return articles.filter((article) => !article.fixture);
}

/**
 * Projects an article to its video input, attaching the transcript when the
 * article has a recording. Everything that renders video goes through here, so
 * no caller has to remember that narration is two files.
 */
export async function getVideoInput(article: Article): Promise<ArticleVideoInput> {
  if (!article.narration) return toVideoInput(article);
  return toVideoInput(article, await loadTranscript(article.slug));
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const articles = await getArticles();
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
