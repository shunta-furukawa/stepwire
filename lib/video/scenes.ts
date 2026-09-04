import type { ArticleVideoInput, NarrationInput, VideoBlock } from '../content/article';
import type { SceneType } from './scene-types';
import type { Figure } from '../content/figures';
import type { MediaRef } from '../content/schema';
import { planReveal, type RevealPlan } from './reveal';
import { toSentences } from '../content/markdown';
import { pageCaptions } from './captions';
import { visualLength } from './text';
import { CATEGORY_META } from '../content/categories';
import { formatDate } from '../format';
import { COMPOSITIONS, type CompositionId } from './compositions';
import { FPS, secondsToFrames, type DurationBounds } from './timing';
import { site } from '../site';

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

export type { SceneType } from './scene-types';

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
  /** `figure` scenes only. */
  figure?: Figure;
  /** `image` scenes, and the headline when the article has a hero. */
  image?: MediaRef;
  /** The small line above a headline: category and date. */
  kicker?: string;
  /**
   * `outro` only: every credit the film owes, one line each. Pictures and
   * music are quotations, and a licence that asks for attribution asks for it
   * where a viewer can find it — the last card is that place.
   */
  credits?: string[];
  /**
   * When each character of `text` lands, and when a tick sounds. Present on
   * every scene that types its copy; both renderers and the sound generator
   * read it, and none of them computes its own.
   */
  reveal?: RevealPlan;
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

/**
 * Which scenes are reported fact and which are STEPWIRE talking.
 *
 * Declared once because two renderers read it. The DOM compositions and the
 * canvas renderer must not each decide that `impact` is analysis — the moment
 * they disagree, one surface labels a claim differently from the other, which
 * is the one thing this project's content model exists to prevent.
 */
export const SCENE_TONE: Record<SceneType, 'fact' | 'analysis'> = {
  headline: 'fact',
  news: 'fact',
  // An image is shown, not argued. What it means is the analysis around it.
  image: 'fact',
  context: 'analysis',
  impact: 'analysis',
  // A figure draws declared data. The article decided what it means; the
  // figure only shows it.
  figure: 'fact',
  source: 'fact',
  outro: 'fact',
  // Narration is the operator's own voice, and the article is the record it
  // may differ in wording from. That is analysis by any honest reading.
  narration: 'analysis',
};

/** Section labels. Editorial voice, not field names. */
const LABELS = {
  news: 'WHAT HAPPENED',
  context: 'WHY IT MATTERS',
  impact: 'PLAYER IMPACT',
  figure: 'BY THE NUMBERS',
} as const;

type Draft = Omit<Scene, 'index' | 'total'>;

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
  //
  // "A little" is 10%. It was 30%, which permits a 200-budget card to carry 260
  // weighted characters — more than a 16:9 frame fits before body copy reaches
  // the progress rail. The budget is what fits; the overshoot is slack for a
  // ragged sentence, not a second budget.
  const minFill = budget * 0.45;
  const overshoot = budget * 1.1;

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
  /**
   * Share of `budget` a card gets when a picture sits beside its copy. The
   * column is narrower (landscape) or shorter (portrait), and a card sized
   * for the full measure runs through the rail.
   */
  pictureBudget: number;
  bounds: DurationBounds;
  headlineBounds: DurationBounds;
  sourceSeconds: number;
  outroSeconds: number;
  figureSeconds: number;
  imageSeconds: number;
}

const PROFILES: Record<CompositionId, FormatProfile> = {
  // Vertical: read on a phone, thumb hovering over "next". Fewer words per
  // card, fewer cards, hard ceiling on total length.
  STEPWIRE_SHORT: {
    budget: 150,
    maxChunks: { news: 3, context: 4, impact: 4 },
    pictureBudget: 0.5,
    bounds: { min: 2.2, max: 6 },
    headlineBounds: { min: 2.4, max: 5 },
    sourceSeconds: 2.2,
    outroSeconds: 2,
    figureSeconds: 3,
    imageSeconds: 2.6,
  },
  // Landscape: watched, not scrolled past. Room for the full argument, but a
  // 16:9 frame has less vertical space per card than its width suggests, so the
  // budget is only modestly larger than the vertical one.
  STEPWIRE_NEWS: {
    budget: 200,
    // Generous: a session write-up has a paragraph per chart, and a paragraph
    // dropped for a cap is a paragraph the operator wrote for nothing. The
    // format's duration ceiling, not this, is what keeps a film short.
    maxChunks: { news: 4, context: 8, impact: 8 },
    pictureBudget: 0.65,
    bounds: { min: 2.5, max: 8 },
    headlineBounds: { min: 3, max: 6 },
    sourceSeconds: 3,
    outroSeconds: 2.5,
    figureSeconds: 3.5,
    imageSeconds: 3,
  },
};

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
    ...(override.text && scene.reveal ? typed(override.text, scene.type === 'headline' ? 'headline' : 'body', fps) : {}),
    ...(override.durationInSeconds
      ? { durationInFrames: secondsToFrames(override.durationInSeconds, fps) }
      : {}),
  };
}

/**
 * Turns a transcript into text cards.
 *
 * The recording is the SCRIPT, not the soundtrack: the operator talks, the
 * words are transcribed, and the video types them. So a transcript page is
 * paced like any other card — by its reveal — and carries no audio timings.
 * The voice itself never reaches the film; that is what the operator asked
 * for, and it removes the one place where the article and the video were
 * allowed to differ in wording.
 */
function narrationScenes(narration: NarrationInput, fps: number): Draft[] {
  const pages = pageCaptions(narration.captions);

  return pages.map((page, index) => {
    const reveal = planReveal(page.text, 'body', fps);
    return {
      id: `narration-${index + 1}`,
      type: 'narration' as const,
      durationInFrames: reveal.revealFrames + reveal.holdFrames,
      text: page.text,
      reveal,
      ...(narration.speaker ? { meta: narration.speaker } : {}),
    };
  });
}

/** A card that types its copy: duration is the reveal plus a hold. */
function typed(text: string, kind: 'headline' | 'body', fps: number) {
  const reveal = planReveal(text, kind, fps);
  return { reveal, durationInFrames: reveal.revealFrames + reveal.holdFrames };
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

  // The headline opens, over the hero image when there is one. A feed gives a
  // film about two seconds to earn the next two; a brand ident spends them on
  // the brand. The kicker carries what the ident used to say.
  drafts.push({
    id: 'headline',
    type: 'headline',
    ...typed(headline, 'headline', fps),
    text: headline,
    meta: article.summary,
    kicker: `${CATEGORY_META[article.category].label.toUpperCase()} · ${formatDate(article.publishedAt)}`,
    ...(article.heroImage
      ? { image: { ...article.heroImage, credit: article.heroImage.credit ?? '' } }
      : {}),
  });

  // A narrated article replaces its three derived text sections with the
  // recording. The written sections are the article's job; the voice is the
  // video's. Duplicating both would say everything twice.
  const narrated = article.narration !== undefined;

  const sections = narrated
    ? []
    : [
        { type: 'news' as const, key: 'news' as const, source: article.news, max: profile.maxChunks.news },
        { type: 'context' as const, key: 'context' as const, source: article.context, max: profile.maxChunks.context },
        { type: 'impact' as const, key: 'playerImpact' as const, source: article.playerImpact, max: profile.maxChunks.impact },
      ];

  // A picture placed in the prose is shown WITH the paragraph after it, on
  // that paragraph's cards, rather than in the gallery after the fact: the
  // operator talks about a result while the result is on screen. Pictures the
  // prose never places still get their own card in the gallery.
  const placed = new Set<string>();
  for (const section of sections) {
    for (const block of article.blocks?.[section.key] ?? []) {
      if (block.kind === 'image') placed.add(block.media.src);
    }
  }
  const gallery = article.media.filter((image) => !placed.has(image.src));

  for (const section of sections) {
    const blocks: VideoBlock[] = article.blocks?.[section.key] ?? [
      { kind: 'paragraph', text: section.source },
    ];
    const cards: Draft[] = [];
    let pending: MediaRef | undefined;

    for (const block of blocks) {
      if (block.kind === 'image') {
        pending = block.media;
        continue;
      }
      if (cards.length >= section.max) break;
      // Chunked per paragraph, not per section: a paragraph break is a break
      // the author chose, and a picture is bound to a paragraph.
      const budget = pending ? Math.round(profile.budget * profile.pictureBudget) : profile.budget;
      for (const text of chunk(block.text, budget, section.max - cards.length)) {
        cards.push({
          id: section.type,
          type: section.type,
          ...typed(text, 'body', fps),
          text,
          ...(pending ? { image: pending } : {}),
        });
      }
      pending = undefined;
    }
    // A picture with nothing after it belongs to what came before it.
    if (pending && cards.length > 0) cards[cards.length - 1]!.image = pending;

    cards.forEach((card, position) => {
      drafts.push({
        ...card,
        id: cards.length > 1 ? `${section.type}-${position + 1}` : section.type,
        // Only the first card of a section carries the label; repeating it on
        // every card would read as a new section each time.
        ...(position === 0
          ? { label: article.labels?.[section.key] ?? LABELS[section.type] }
          : {}),
      });
    });

    // The gallery follows the reported fact and precedes the analysis: they are
    // what the story is about, shown before anyone says what it means.
    if (section.type === 'news') {
      gallery.forEach((image, index) => {
        drafts.push({
          id: gallery.length > 1 ? `image-${index + 1}` : 'image',
          type: 'image',
          durationInFrames: secondsToFrames(profile.imageSeconds, fps),
          image,
          ...(image.caption ? { text: image.caption } : {}),
          meta: image.credit,
        });
      });
    }
  }

  if (article.narration) {
    drafts.push(...narrationScenes(article.narration, fps));
    // A narrated article has no news section for the images to follow.
    article.media.forEach((image, index) => {
      drafts.push({
        id: article.media.length > 1 ? `image-${index + 1}` : 'image',
        type: 'image',
        durationInFrames: secondsToFrames(profile.imageSeconds, fps),
        image,
        ...(image.caption ? { text: image.caption } : {}),
        meta: image.credit,
      });
    });
  }

  // One scene per figure. A figure with more rows needs longer on screen, so
  // the duration is derived from the row count rather than fixed.
  article.figures.forEach((figure, index) => {
    drafts.push({
      id: article.figures.length > 1 ? `figure-${index + 1}` : 'figure',
      type: 'figure',
      durationInFrames: secondsToFrames(
        Math.min(profile.figureSeconds + figure.items.length * 0.55, 9),
        fps,
      ),
      ...(figure.title ? { label: figure.title } : { label: LABELS.figure }),
      figure,
    });
  });

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

  const credits = [
    ...new Set(
      [article.heroImage?.credit, ...article.media.map((image) => image.credit)].filter(
        (credit): credit is string => Boolean(credit),
      ),
    ),
  ].map((credit) => `IMAGE: ${credit}`);
  if (article.bgm) credits.push(`MUSIC: ${article.bgm.credit}`);

  drafts.push({
    id: 'outro',
    type: 'outro',
    durationInFrames: secondsToFrames(profile.outroSeconds, fps),
    meta: site.tagline,
    ...(credits.length > 0 ? { credits } : {}),
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
    const kinds: SceneType[] = ['context', 'impact', 'news', 'narration', 'image'];
    if (!kinds.includes(scene.type)) return false;
    // Never drop the only remaining card of a section, nor the only image.
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
