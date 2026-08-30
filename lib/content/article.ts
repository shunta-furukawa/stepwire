import {
  articleFrontmatterSchema,
  SECTION_HEADINGS,
  SECTION_KEYS,
  type ArticleFrontmatter,
  type SectionKey,
} from './schema';
import { splitFrontmatter } from './frontmatter';
import {
  collectCitations,
  parseMarkdown,
  toPlainText,
  type Block,
} from './markdown';
import {
  narrationPublicPath,
  type Transcript,
  type TranscriptCaption,
} from './narration';

/**
 * A parsed article: typed frontmatter plus the three STEPWIRE body sections,
 * each available as both a rendered AST (web) and plain text (video).
 */
export interface ArticleSection {
  key: SectionKey;
  heading: string;
  blocks: Block[];
  text: string;
}

export interface Article extends ArticleFrontmatter {
  sections: Record<SectionKey, ArticleSection>;
  /** Stable hash of the file contents. Used as the video render cache key. */
  contentHash: string;
  /** Repository-relative path, for editor links and error messages. */
  filePath: string;
}

/**
 * Video-safe projection of an article.
 *
 * Remotion compositions receive props over a serialisation boundary (studio
 * props, `--props` on the CLI, the render API payload), so they get plain
 * strings rather than the AST.
 */
/** A narration track resolved for the video boundary. */
export interface NarrationInput {
  /** Public URL of the audio file, e.g. `/audio/foo.m4a`. */
  audioSrc: string;
  durationInSeconds: number;
  language: string;
  speaker?: string;
  captions: TranscriptCaption[];
}

export interface ArticleVideoInput {
  slug: string;
  title: string;
  shortTitle?: string;
  dek?: string;
  summary: string;
  category: ArticleFrontmatter['category'];
  importance: ArticleFrontmatter['importance'];
  publishedAt: string;
  news: string;
  context: string;
  playerImpact: string;
  primarySource?: { publisher: string; title: string; url: string };
  video?: ArticleFrontmatter['video'];
  /**
   * Present only when the article has a recording AND a transcript. The video
   * then plays the voice and follows its timings instead of deriving pacing
   * from reading speed.
   */
  narration?: NarrationInput;
}

const HEADING_TO_KEY = new Map<string, SectionKey>(
  SECTION_KEYS.map((key) => [SECTION_HEADINGS[key], key]),
);

/**
 * Splits an article body on its `## NEWS` / `## CONTEXT` / `## PLAYER IMPACT`
 * headings. The headings are structural, not decorative — they are how the
 * data model reaches into the prose.
 */
export function splitSections(body: string): Record<SectionKey, string> {
  const sections: Partial<Record<SectionKey, string[]>> = {};
  let current: SectionKey | null = null;

  for (const line of body.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const key = HEADING_TO_KEY.get(heading[1]!.trim().toUpperCase());
      if (!key) {
        throw new Error(
          `unknown section heading "## ${heading[1]}" — expected one of ${SECTION_KEYS.map(
            (k) => `## ${SECTION_HEADINGS[k]}`,
          ).join(', ')}`,
        );
      }
      current = key;
      sections[key] = [];
      continue;
    }
    if (current) sections[current]!.push(line);
  }

  const missing = SECTION_KEYS.filter((key) => !sections[key]?.join('').trim());
  if (missing.length > 0) {
    throw new Error(
      `missing or empty section(s): ${missing.map((k) => `## ${SECTION_HEADINGS[k]}`).join(', ')}`,
    );
  }

  return {
    news: sections.news!.join('\n').trim(),
    context: sections.context!.join('\n').trim(),
    playerImpact: sections.playerImpact!.join('\n').trim(),
  };
}

/** FNV-1a (32-bit), hex. Enough to key a render cache; not a security hash. */
export function contentHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface ParseOptions {
  filePath: string;
  /** Forces `fixture: true` — used for everything under `content/fixtures/`. */
  forceFixture?: boolean;
}

export function parseArticle(raw: string, options: ParseOptions): Article {
  const { data, body } = splitFrontmatter(raw);
  const parsed = articleFrontmatterSchema.safeParse(data);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`invalid frontmatter:\n${issues}`);
  }

  const frontmatter = parsed.data;
  const rawSections = splitSections(body);

  const sections = Object.fromEntries(
    SECTION_KEYS.map((key) => {
      const blocks = parseMarkdown(rawSections[key]);
      return [
        key,
        { key, heading: SECTION_HEADINGS[key], blocks, text: toPlainText(blocks) },
      ];
    }),
  ) as Record<SectionKey, ArticleSection>;

  return {
    ...frontmatter,
    fixture: frontmatter.fixture || options.forceFixture === true,
    sections,
    contentHash: contentHash(raw),
    filePath: options.filePath,
  };
}

/** Citation indices used anywhere in the body, deduplicated and sorted. */
export function articleCitations(article: Article): number[] {
  const all = SECTION_KEYS.flatMap((key) => collectCitations(article.sections[key].blocks));
  return [...new Set(all)].sort((a, b) => a - b);
}

export function toVideoInput(
  article: Article,
  transcript?: Transcript,
): ArticleVideoInput {
  const primary = article.sources[0];
  return {
    slug: article.slug,
    title: article.title,
    ...(article.shortTitle ? { shortTitle: article.shortTitle } : {}),
    ...(article.dek ? { dek: article.dek } : {}),
    summary: article.summary,
    category: article.category,
    importance: article.importance,
    publishedAt: article.publishedAt,
    news: article.sections.news.text,
    context: article.sections.context.text,
    playerImpact: article.sections.playerImpact.text,
    ...(primary
      ? {
          primarySource: {
            publisher: primary.publisher,
            title: primary.title,
            url: primary.url,
          },
        }
      : {}),
    ...(article.video ? { video: article.video } : {}),
    // Narration needs both halves: a recording with no transcript cannot be
    // subtitled or timed, so the video falls back to its silent form.
    ...(article.narration && transcript
      ? {
          narration: {
            audioSrc: narrationPublicPath(article.narration.audio),
            durationInSeconds: transcript.durationInSeconds,
            language: transcript.language,
            ...(article.narration.speaker ? { speaker: article.narration.speaker } : {}),
            captions: transcript.captions,
          },
        }
      : {}),
  };
}
