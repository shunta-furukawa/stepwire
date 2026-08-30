import type { ArticleVideoInput } from '../content/article';
import { toSentences } from '../content/markdown';
import { visualLength } from './text';
import { CATEGORY_META } from '../content/categories';
import { formatDate } from '../format';
import { COMPOSITIONS, type CompositionId } from './compositions';
import { FPS, readingFrames, secondsToFrames, type DurationBounds } from './timing';

/**
 * Article → scene sequence.
 *
 * This is the hinge of the whole project. The video is not authored; it is
 * *derived* from the same Article the website renders. An editor who fixes a
 * typo in the article fixes it in the video, because there is no second copy.
 *
 * `article.video` may override a headline, a hook, per-scene text or a
 * duration — but every override is optional, and an article with none still
 * produces a complete video.
 */

export type SceneType =
  | 'intro'
  | 'headline'
  | 'news'
  | 'context'
  | 'impact'
  | 'data'
  | 'source'
  | 'outro';

export interface Scene {
  /** Unique within a sequence, e.g. `context-2`. Also the override key. */
  id: string;
  type: SceneType;
  durationInFrames: number;
  /** Section label shown on the card, e.g. "WHAT HAPPENED". */
  label?: string;
  /** Body copy. */
  text?: string;
  /** Short supporting line — a kicker, a date, an attribution. */
  meta?: string;
  /** `data` scenes only. */
  data?: { label: string; value: string }[];
  /** Position in the sequence, for the progress rail. */
  index: number;
  total: number;
}

export interface SceneSequence {
  scenes: Scene[];
  durationInFrames: number;
  fps: number;
  composition: CompositionId;
}

/** Section labels. Editorial voice, not field names. */
const LABELS = {
  news: 'WHAT HAPPENED',
  context: 'WHY IT MATTERS',
  impact: 'PLAYER IMPACT',
  data: 'BY THE NUMBERS',
} as const;

/**
 * Splits a section into cards.
 *
 * Text is broken on sentence boundaries and packed up to a character budget, so
 * a card never cuts a thought in half and never overflows the frame.
 */
function chunk(text: string, budget: number, maxChunks: number): string[] {
  const sentences = toSentences(text);
  const chunks: string[] = [];
  let current = '';
  // Budgets are in weighted characters, so one number works for both scripts:
  // 200 is about 200 Latin characters or 100 Japanese ones, which occupy the
  // same space on the card.
  const width = visualLength;

  // A card that is nearly empty wastes a slot and a couple of seconds, and a
  // short opening sentence followed by a long one strands the short one on its
  // own. So a card under this fill may take the next sentence even if that
  // overshoots the budget a little.
  const minFill = budget * 0.45;
  const overshoot = budget * 1.3;

  for (const sentence of sentences) {
    if (current.length === 0) {
      current = sentence;
      continue;
    }

    const joined = width(current) + width(sentence) + 1;
    if (joined <= budget || (width(current) < minFill && joined <= overshoot)) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
    if (chunks.length >= maxChunks) break;
  }

  if (current.length > 0 && chunks.length < maxChunks) chunks.push(current);
  // A single sentence longer than the budget is still one card: better a dense
  // card than a sentence chopped mid-clause.
  return chunks.slice(0, maxChunks).map((value) => value.trim());
}

interface FormatProfile {
  /** Characters per body card. */
  budget: number;
  /** Maximum cards per section. */
  maxChunks: { news: number; context: number; impact: number };
  bounds: DurationBounds;
  introSeconds: number;
  headlineBounds: DurationBounds;
  sourceSeconds: number;
  outroSeconds: number;
  dataSeconds: number;
}

const PROFILES: Record<CompositionId, FormatProfile> = {
  // Vertical: read on a phone, thumb hovering over "next". Fewer words per
  // card, fewer cards, hard ceiling on total length.
  STEPWIRE_SHORT: {
    budget: 150,
    maxChunks: { news: 2, context: 2, impact: 2 },
    bounds: { min: 2.2, max: 6 },
    introSeconds: 1.6,
    headlineBounds: { min: 2.4, max: 5 },
    sourceSeconds: 2.2,
    outroSeconds: 2,
    dataSeconds: 3,
  },
  // Landscape: watched, not scrolled past. Room for the full argument, but a
  // 16:9 frame has less vertical space per card than its width suggests, so the
  // budget is only modestly larger than the vertical one.
  STEPWIRE_NEWS: {
    budget: 200,
    maxChunks: { news: 3, context: 3, impact: 3 },
    bounds: { min: 2.5, max: 8 },
    introSeconds: 2,
    headlineBounds: { min: 3, max: 6 },
    sourceSeconds: 3,
    outroSeconds: 2.5,
    dataSeconds: 3.5,
  },
};

type Draft = Omit<Scene, 'index' | 'total'>;

function applyOverride(
  scene: Draft,
  overrides: ArticleVideoInput['video'],
  fps: number,
): Draft | null {
  const override = overrides?.scenes?.[scene.id];
  if (!override) return scene;
  if (override.skip) return null;

  return {
    ...scene,
    ...(override.text ? { text: override.text } : {}),
    ...(override.durationInSeconds
      ? { durationInFrames: secondsToFrames(override.durationInSeconds, fps) }
      : override.text
        ? { durationInFrames: readingFrames(override.text, undefined, fps) }
        : {}),
  };
}

export function buildSceneSequence(
  article: ArticleVideoInput,
  composition: CompositionId,
  fps = FPS,
): SceneSequence {
  const profile = PROFILES[composition];
  const target = COMPOSITIONS[composition].targetSeconds;
  const headline = article.video?.headline ?? article.shortTitle ?? article.title;
  const drafts: Draft[] = [];

  drafts.push({
    id: 'intro',
    type: 'intro',
    durationInFrames: secondsToFrames(profile.introSeconds, fps),
    meta: `${CATEGORY_META[article.category].label.toUpperCase()} · ${formatDate(article.publishedAt)}`,
    ...(article.video?.hook ? { text: article.video.hook } : {}),
  });

  drafts.push({
    id: 'headline',
    type: 'headline',
    durationInFrames: readingFrames(headline, profile.headlineBounds, fps),
    text: headline,
    meta: article.summary,
  });

  const sections = [
    { type: 'news' as const, source: article.news, max: profile.maxChunks.news },
    { type: 'context' as const, source: article.context, max: profile.maxChunks.context },
    { type: 'impact' as const, source: article.playerImpact, max: profile.maxChunks.impact },
  ];

  for (const section of sections) {
    const cards = chunk(section.source, profile.budget, section.max);
    cards.forEach((text, position) => {
      drafts.push({
        id: cards.length > 1 ? `${section.type}-${position + 1}` : section.type,
        type: section.type,
        durationInFrames: readingFrames(text, profile.bounds, fps),
        // Only the first card of a section carries the label; repeating it on
        // every card would read as a new section each time.
        ...(position === 0 ? { label: LABELS[section.type] } : {}),
        text,
      });
    });
  }

  if (article.video?.data && article.video.data.length > 0) {
    drafts.push({
      id: 'data',
      type: 'data',
      durationInFrames: secondsToFrames(profile.dataSeconds, fps),
      label: LABELS.data,
      data: article.video.data,
    });
  }

  drafts.push({
    id: 'source',
    type: 'source',
    durationInFrames: secondsToFrames(profile.sourceSeconds, fps),
    label: 'SOURCE',
    text: article.primarySource
      ? `${article.primarySource.publisher} — ${article.primarySource.title}`
      : 'STEPWIRE reporting',
    meta: formatDate(article.publishedAt),
  });

  drafts.push({
    id: 'outro',
    type: 'outro',
    durationInFrames: secondsToFrames(profile.outroSeconds, fps),
    meta: 'DDR News, Charts & Culture.',
  });

  const overridden = drafts
    .map((scene) => applyOverride(scene, article.video, fps))
    .filter((scene): scene is Draft => scene !== null);

  const trimmed = trimToBudget(overridden, target.max * fps);

  const scenes: Scene[] = trimmed.map((scene, index) => ({
    ...scene,
    index,
    total: trimmed.length,
  }));

  return {
    scenes,
    durationInFrames: scenes.reduce((total, scene) => total + scene.durationInFrames, 0),
    fps,
    composition,
  };
}

/**
 * Brings a sequence inside its format's ceiling.
 *
 * Trailing analysis cards are dropped first, because a short video that loses
 * its last supporting point is still coherent — one that loses its source line
 * or its sign-off is not. Intro, headline, the first news card, the source and
 * the outro are never dropped.
 */
function trimToBudget(scenes: Draft[], maxFrames: number): Draft[] {
  const total = (list: Draft[]) =>
    list.reduce((sum, scene) => sum + scene.durationInFrames, 0);

  if (total(scenes) <= maxFrames) return scenes;

  const result = [...scenes];
  const droppable = (scene: Draft, list: Draft[]) => {
    if (scene.type !== 'context' && scene.type !== 'impact' && scene.type !== 'news') {
      return false;
    }
    // Never drop the only remaining card of a section.
    return list.filter((other) => other.type === scene.type).length > 1;
  };

  // Drop from the end, so the earliest (most important) card of each section
  // survives longest.
  for (let i = result.length - 1; i >= 0 && total(result) > maxFrames; i -= 1) {
    const scene = result[i]!;
    if (droppable(scene, result)) result.splice(i, 1);
  }

  return result;
}

/** Frame offset at which a scene starts. Used by the studio scrubber. */
export function sceneStartFrames(sequence: SceneSequence): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const scene of sequence.scenes) {
    offsets.push(cursor);
    cursor += scene.durationInFrames;
  }
  return offsets;
}
