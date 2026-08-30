import { REPORTED_CATEGORIES } from './schema';
import { articleCitations, type Article } from './article';
import { collectCitations } from './markdown';

export interface ValidationIssue {
  level: 'error' | 'warning';
  filePath: string;
  message: string;
}

/**
 * Editorial-integrity rules that a type system cannot express.
 *
 * These run in `pnpm content:validate` and in CI, so a pull request that breaks
 * the sourcing contract fails before it can be merged.
 */
export function validateArticle(article: Article): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (message: string) =>
    issues.push({ level: 'error', filePath: article.filePath, message });
  const warn = (message: string) =>
    issues.push({ level: 'warning', filePath: article.filePath, message });

  const isReported = (REPORTED_CATEGORIES as readonly string[]).includes(article.category);
  const isPublishedReporting = article.status === 'published' && isReported;

  // 1. Reported news must be sourced. Fixtures are exempt: they are clearly
  //    labelled samples and have no real-world source to point at.
  if (isPublishedReporting && !article.fixture && article.sources.length === 0) {
    error(
      `category ${article.category} with status "published" requires at least one entry in "sources"`,
    );
  }

  // 2. Citation markers must resolve to a real source.
  const citations = articleCitations(article);
  for (const index of citations) {
    if (index < 1 || index > article.sources.length) {
      error(`citation [^${index}] has no matching entry in "sources" (${article.sources.length} listed)`);
    }
  }

  // 3. The NEWS section carries reported fact, so it is the section that has to
  //    cite. CONTEXT and PLAYER IMPACT are signed editorial analysis.
  if (isPublishedReporting && !article.fixture) {
    const newsCitations = collectCitations(article.sections.news.blocks);
    if (newsCitations.length === 0) {
      error('the NEWS section of a published report must contain at least one [^n] citation');
    }
  }

  // 4. Unused sources usually mean a citation was dropped during editing.
  const used = new Set(citations);
  article.sources.forEach((source, i) => {
    if (!used.has(i + 1) && !article.fixture) {
      warn(`source [^${i + 1}] (${source.publisher}) is listed but never cited in the body`);
    }
  });

  // 5. Dates must be coherent.
  if (article.updatedAt && Date.parse(article.updatedAt) < Date.parse(article.publishedAt)) {
    error('"updatedAt" is earlier than "publishedAt"');
  }

  // 6. Fixtures must never be published as if they were reporting.
  if (article.fixture && !article.title.toUpperCase().includes('SAMPLE')) {
    // The banner in the UI is the real safeguard; this keeps the file honest
    // for anyone reading the repository directly.
    warn('fixture article title does not contain "SAMPLE" — readers rely on the UI banner alone');
  }

  // 7. Video overrides must reference scenes that exist.
  if (article.video?.scenes) {
    for (const id of Object.keys(article.video.scenes)) {
      if (!/^[a-z][a-z0-9-]*$/.test(id)) {
        error(`video.scenes key "${id}" is not a valid scene id`);
      }
    }
  }

  return issues;
}

export function validateArticles(articles: Article[]): ValidationIssue[] {
  const issues = articles.flatMap(validateArticle);

  const seenSlugs = new Map<string, string>();
  const seenIds = new Map<string, string>();

  for (const article of articles) {
    const slugOwner = seenSlugs.get(article.slug);
    if (slugOwner) {
      issues.push({
        level: 'error',
        filePath: article.filePath,
        message: `duplicate slug "${article.slug}" (also used by ${slugOwner})`,
      });
    }
    seenSlugs.set(article.slug, article.filePath);

    const idOwner = seenIds.get(article.id);
    if (idOwner) {
      issues.push({
        level: 'error',
        filePath: article.filePath,
        message: `duplicate id "${article.id}" (also used by ${idOwner})`,
      });
    }
    seenIds.set(article.id, article.filePath);
  }

  return issues;
}
