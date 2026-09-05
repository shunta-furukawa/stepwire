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
import type { Figure } from './figures';
import type { Bgm, ImageRef, MediaRef, Session } from './schema';
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
 * The studio receives this over a serialisation boundary (server component to
 * client island), so it gets plain strings and blocks rather than the AST.
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

/** One unit of a section as the video sees it: words, or a picture. */
export type VideoBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'image'; media: MediaRef };

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
  /** Every source, for the post description; `primarySource` is the first. */
  sources?: { publisher: string; title: string; url: string }[];
  tags?: string[];
  figures: Figure[];
  /** Section names on the cards, when the article renames them. */
  labels?: ArticleFrontmatter['labels'];
  /**
   * The sections as blocks, so the video knows which paragraph a picture
   * belongs to. `news` / `context` / `playerImpact` above stay as the plain
   * text for callers that only need words.
   */
  blocks?: Record<SectionKey, VideoBlock[]>;
  /** Behind the opening headline, when the article has one. */
  heroImage?: ImageRef;
  /** Images the video shows, in order, each with its credit. */
  media: MediaRef[];
  /** Music under the film. The file and its rights are the operator's. */
  bgm?: Bgm;
  /** The session the article records; opens the film when present. */
  session?: Session;
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

  // A picture in the prose is a quotation like any other, so it has to be one
  // the frontmatter declared with a credit. Binding it here means the page and
  // the video read the caption and the credit from one place.
  for (const key of SECTION_KEYS) {
    for (const block of sections[key].blocks) {
      if (block.type !== 'image') continue;
      const media = frontmatter.media.find(
        (item) => item.src.replace(/^\//, '') === block.src.replace(/^\//, ''),
      );
      if (!media) {
        throw new Error(
          `## ${SECTION_HEADINGS[key]} shows ${block.src}, which is not declared in media — every picture needs a credit`,
        );
      }
      block.src = media.src;
      if (!block.alt) block.alt = media.alt;
      block.credit = media.credit;
      if (media.caption) block.caption = media.caption;
    }
  }

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

function toVideoBlocks(article: Article, key: SectionKey): VideoBlock[] {
  const out: VideoBlock[] = [];
  for (const block of article.sections[key].blocks) {
    if (block.type === 'image') {
      const media = article.media.find((item) => item.src === block.src);
      if (media) out.push({ kind: 'image', media });
      continue;
    }
    const text = toPlainText([block]);
    if (text) out.push({ kind: 'paragraph', text });
  }
  return out;
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
    figures: article.figures,
    tags: article.tags,
    sources: article.sources.map((s) => ({ publisher: s.publisher, title: s.title, url: s.url })),
    ...(article.labels ? { labels: article.labels } : {}),
    ...(article.heroImage ? { heroImage: article.heroImage } : {}),
    media: article.media,
    ...(article.bgm ? { bgm: article.bgm } : {}),
    ...(article.session ? { session: article.session } : {}),
    news: article.sections.news.text,
    context: article.sections.context.text,
    playerImpact: article.sections.playerImpact.text,
    blocks: {
      news: toVideoBlocks(article, 'news'),
      context: toVideoBlocks(article, 'context'),
      playerImpact: toVideoBlocks(article, 'playerImpact'),
    },
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
