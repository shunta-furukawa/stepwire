import { z } from 'zod';
import { CATEGORIES } from './categories';
import { figureSchema } from './figures';

/**
 * The STEPWIRE Article model.
 *
 * This schema is the contract shared by the website, the video compositions and
 * the editorial tooling. Anything that both surfaces need lives here; nothing
 * that only one surface needs does.
 */

export const IMPORTANCE = ['breaking', 'major', 'normal', 'minor'] as const;
export type Importance = (typeof IMPORTANCE)[number];

export const STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

/**
 * Source types. `official` is a first-party announcement (KONAMI, an arcade
 * operator, an event organiser); `media` is reporting by another outlet;
 * `community` is a community-run resource. AI output is never a source type —
 * see `docs/editorial-workflow.md`.
 */
export const SOURCE_TYPES = [
  'official',
  'media',
  'community',
  'social',
  'video',
  'dataset',
  'other',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'must be an ISO-8601 date or date-time string',
  });

export const sourceRefSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  publishedAt: isoDateTime.optional(),
  type: z.enum(SOURCE_TYPES).optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const imageRefSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1, 'every image needs alt text'),
  credit: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

/**
 * An image the article carries into the video.
 *
 * `credit` is required here where it is optional on `heroImage`: a jacket, a
 * screenshot or somebody's post in a published video is a quotation, and a
 * quotation without attribution is not one. The validator refuses the article
 * rather than the video quietly omitting the line.
 */
export const mediaSchema = imageRefSchema.extend({
  src: z
    .string()
    .regex(/^\/?images\/[\w./-]+\.(png|jpg|jpeg|webp)$/, 'media must be a file under public/images/'),
  credit: z.string().min(1, 'every media image needs a credit — it is a quotation'),
  /** Shown under the image. What the reader is looking at, not what it means. */
  caption: z.string().max(120).optional(),
  /** A hint for how the video frames it. */
  kind: z.enum(['jacket', 'screenshot', 'post', 'photo']).optional(),
});
export type MediaRef = z.infer<typeof mediaSchema>;

/**
 * Music under the video.
 *
 * The file is the operator's responsibility, and the schema says so by
 * requiring a credit: what goes under a STEPWIRE video is an editorial and a
 * legal decision, not something the system fetches. A game's own tracks in a
 * public video are a rights question the software cannot answer.
 */
export const bgmSchema = z.object({
  src: z
    .string()
    .regex(/^\/?audio\/bgm\/[\w.-]+\.(m4a|mp3|wav|ogg)$/, 'bgm must be a file under public/audio/bgm/'),
  credit: z.string().min(1, 'bgm needs a credit — say what it is and where it may be used'),
  /** Level under the effects, 0–1. Music is a bed, not the point. */
  gain: z.number().min(0).max(1).default(0.35),
});
export type Bgm = z.infer<typeof bgmSchema>;

/**
 * Optional per-article video overrides.
 *
 * The rule is: overrides are the exception. If a field is absent the video
 * system derives it from the article body, which is what keeps the web article
 * and the video from drifting apart. See `lib/video/scenes.ts`.
 */
export const videoOverrideSchema = z.object({
  /** Replaces the on-screen headline when the article title is too long. */
  headline: z.string().max(90).optional(),
  /** A short opening line used by the intro scene. */
  hook: z.string().max(120).optional(),
  /** Per-scene overrides, keyed by scene id. */
  scenes: z
    .record(
      z.string(),
      z.object({
        text: z.string().optional(),
        /** Explicit duration in seconds; otherwise derived from text length. */
        durationInSeconds: z.number().positive().max(30).optional(),
        skip: z.boolean().optional(),
      }),
    )
    .optional(),
});
export type VideoOverride = z.infer<typeof videoOverrideSchema>;

/**
 * Narration. `audio` is a path under `public/`, so the same file serves the
 * website and the transcription without a second copy.
 *
 * The transcript is found by convention at `content/transcripts/<slug>.json`
 * and is not referenced here: one fewer thing to keep in sync.
 */
export const narrationSchema = z.object({
  audio: z
    .string()
    .regex(/^\/?audio\/[\w.-]+\.(m4a|mp3|wav|webm|ogg)$/, 'audio must be a file under public/audio/'),
  /** Who is speaking. Shown on the video's source card. */
  speaker: z.string().min(1).optional(),
});
export type Narration = z.infer<typeof narrationSchema>;

/** Frontmatter as authored in `content/**\/*.mdx`. */
export const articleFrontmatterSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
  title: z.string().min(1).max(140),
  /** Used where the full title will not fit — nav, cards, video headline. */
  shortTitle: z.string().max(70).optional(),
  dek: z.string().max(240).optional(),
  publishedAt: isoDateTime,
  updatedAt: isoDateTime.optional(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string().min(1)).default([]),
  importance: z.enum(IMPORTANCE).default('normal'),
  /** One-sentence factual summary. Used for meta description and video. */
  summary: z.string().min(1).max(320),
  sources: z.array(sourceRefSchema).default([]),
  /**
   * Diagrams. Drawn on the page and in the video from the same declared data —
   * see `lib/content/figures.ts` for why the article declares rather than the
   * system infers.
   */
  figures: z.array(figureSchema).max(3).default([]),
  /**
   * What the three sections are called on this article, when the defaults
   * (NEWS / CONTEXT / PLAYER IMPACT) do not fit — a session write-up calls its
   * middle SESSION and its last PICKUP. The sections themselves, and which is
   * fact and which is analysis, do not change; only the word on the card.
   */
  labels: z
    .object({
      news: z.string().min(1).max(24).optional(),
      context: z.string().min(1).max(24).optional(),
      playerImpact: z.string().min(1).max(24).optional(),
    })
    .optional(),
  heroImage: imageRefSchema.optional(),
  thumbnail: imageRefSchema.optional(),
  /** Images the video shows, in order. See `mediaSchema`. */
  media: z.array(mediaSchema).max(6).default([]),
  /** Music under the video. See `bgmSchema`. */
  bgm: bgmSchema.optional(),
  video: videoOverrideSchema.optional(),
  /**
   * The recording this article is spoken over. Optional — an article with no
   * narration still produces a complete, silent video from its text.
   */
  narration: narrationSchema.optional(),
  status: z.enum(STATUSES),
  /**
   * Marks seeded sample content. Fixture articles are rendered with a visible
   * banner and are excluded from the sitemap and the RSS feed so they can never
   * be mistaken for reporting.
   */
  fixture: z.boolean().default(false),
  /** Links the article back to the collector candidate it came from. */
  collectorId: z.string().optional(),
  /** The GitHub issue the article was drafted from, if any. */
  sourceIssue: z.number().int().positive().optional(),
});
export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;

/**
 * The three body sections. This split is the STEPWIRE format and it is enforced
 * by the schema rather than left to authoring discipline:
 *
 *   news         — what happened. Reported fact. Must cite a source.
 *   context      — why it is notable. Editorial analysis.
 *   playerImpact — what changes for a player. Editorial analysis.
 */
export const SECTION_KEYS = ['news', 'context', 'playerImpact'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_HEADINGS: Record<SectionKey, string> = {
  news: 'NEWS',
  context: 'CONTEXT',
  playerImpact: 'PLAYER IMPACT',
};

/** Categories whose articles are held to reported-news sourcing standards. */
export const REPORTED_CATEGORIES = ['NEWS', 'UPDATE', 'EVENT', 'TOURNAMENT', 'CHARTS'] as const;
