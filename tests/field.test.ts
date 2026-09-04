import { describe, expect, it } from 'vitest';
import type { ArticleVideoInput } from '../lib/content/article';
import { FIELD_ENERGY, fieldState, seeded } from '../lib/video/field-plan';
import { backdropDim, backdropZoom, sceneGround } from '../lib/video/ground';
import { buildSceneSequence } from '../lib/video/scenes';
import { difficultyLabel, figureSchema, formatScore } from '../lib/content/figures';
import { SCENE_TYPES } from '../lib/video/scene-types';
import { color } from '../lib/design/tokens';

/**
 * The particle field, tested as numbers.
 *
 * Nothing here touches WebGL. The field is a function of the frame and the
 * scene, and that function is what can go wrong in a way a viewer notices:
 * a sky that differs between preview and export, a burst that never fades, a
 * scene type with no decided energy.
 */

const article: ArticleVideoInput = {
  slug: 'a-test-article',
  title: 'A headline',
  summary: 'A summary.',
  category: 'UPDATE',
  importance: 'normal',
  publishedAt: '2026-08-30T09:00:00+09:00',
  news: 'A fact.',
  context: 'Some analysis.',
  playerImpact: 'A consequence.',
  primarySource: { publisher: 'Example', title: 'The announcement', url: 'https://example.com/a' },
  figures: [],
  media: [],
};

describe('field plan', () => {
  it('decides an energy for every scene type', () => {
    expect(Object.keys(FIELD_ENERGY).sort()).toEqual([...SCENE_TYPES].sort());
    for (const energy of Object.values(FIELD_ENERGY)) {
      expect(energy).toBeGreaterThan(0);
      expect(energy).toBeLessThanOrEqual(1);
    }
    // The headline is the loudest card; the source card is the quietest.
    expect(FIELD_ENERGY.headline).toBe(1);
    expect(FIELD_ENERGY.source).toBeLessThan(FIELD_ENERGY.news);
  });

  it('is a pure function of the frame', () => {
    const a = fieldState({ type: 'headline' }, 12, 312, 30);
    const b = fieldState({ type: 'headline' }, 12, 312, 30);
    expect(a).toEqual(b);
    expect(a.time).toBeCloseTo(10.4);
  });

  it('bursts on the cut and settles', () => {
    const first = fieldState({ type: 'news' }, 0, 100, 30);
    const later = fieldState({ type: 'news' }, 40, 140, 30);
    expect(first.burst).toBe(1);
    expect(first.enter).toBe(0);
    expect(later.burst).toBeLessThan(0.01);
    expect(later.enter).toBe(1);
  });

  it('places facets the same way every time', () => {
    const a = seeded(7);
    const b = seeded(7);
    const runA = Array.from({ length: 5 }, () => a());
    const runB = Array.from({ length: 5 }, () => b());
    expect(runA).toEqual(runB);
    for (const value of runA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(new Set(runA).size).toBe(5);
  });
});

describe('the ground under a scene', () => {
  it('raises analysis off the deepest ground', () => {
    expect(sceneGround({ type: 'news' })).toBe(color.deep);
    expect(sceneGround({ type: 'headline' })).toBe(color.deep);
    expect(sceneGround({ type: 'context' })).toBe(color.raised);
    expect(sceneGround({ type: 'impact' })).toBe(color.raised);
  });

  it('darkens a hero more than a picture that is the point', () => {
    const image = { src: 'images/x.png', alt: 'x', credit: 'X' };
    expect(backdropDim({ type: 'headline', image })).toBeGreaterThan(backdropDim({ type: 'image', image })!);
    expect(backdropDim({ type: 'headline' })).toBeNull();
    // A body card never shows a picture, whatever it carries.
    expect(backdropDim({ type: 'news', image })).toBeNull();
  });

  it('pushes into a picture slowly and never past a few percent', () => {
    expect(backdropZoom(0)).toBe(1);
    expect(backdropZoom(1)).toBeCloseTo(1.06);
    expect(backdropZoom(2)).toBeCloseTo(1.06);
  });
});

describe('credits on the last card', () => {
  it('lists every picture and the music, once each', () => {
    const sequence = buildSceneSequence(
      {
        ...article,
        heroImage: { src: 'images/hero.png', alt: 'hero', credit: 'Photo: A' },
        media: [
          { src: 'images/a.png', alt: 'a', credit: 'Photo: A' },
          { src: 'images/b.png', alt: 'b', credit: '© B / 公式サイトより' },
        ],
        bgm: { src: 'audio/bgm/x.wav', credit: '音楽：魔王魂', gain: 0.3 },
      },
      'STEPWIRE_NEWS',
    );
    const outro = sequence.scenes.at(-1)!;
    expect(outro.type).toBe('outro');
    expect(outro.credits).toEqual(['IMAGE: Photo: A', 'IMAGE: © B / 公式サイトより', 'MUSIC: 音楽：魔王魂']);
  });

  it('carries none when the film owes none', () => {
    const outro = buildSceneSequence(article, 'STEPWIRE_NEWS').scenes.at(-1)!;
    expect(outro.credits).toBeUndefined();
  });
});

describe('plays figure', () => {
  it('labels a chart the way the game does', () => {
    expect(difficultyLabel({ difficulty: 'EXPERT', level: 15 })).toBe('EXPERT 15');
    expect(difficultyLabel({ difficulty: 'CHALLENGE' })).toBe('CHALLENGE');
    expect(formatScore(998550)).toBe('998,550');
  });

  it('accepts a session log and refuses a score the game cannot give', () => {
    const ok = figureSchema.safeParse({
      kind: 'plays',
      items: [{ song: 'eyesight', difficulty: 'EXPERT', level: 15, score: 998550, rank: 'AAA' }],
    });
    expect(ok.success).toBe(true);
    if (ok.success && ok.data.kind === 'plays') expect(ok.data.items[0]?.style).toBe('SINGLE');
    expect(
      figureSchema.safeParse({ kind: 'plays', items: [{ song: 'x', difficulty: 'EXPERT', score: 1_000_001 }] }).success,
    ).toBe(false);
    expect(
      figureSchema.safeParse({ kind: 'plays', items: [{ song: 'x', difficulty: 'HEAVY', score: 1 }] }).success,
    ).toBe(false);
  });

  it('renames a section on the card when the article asks', () => {
    const sequence = buildSceneSequence(
      { ...article, labels: { context: 'SESSION', playerImpact: 'PICKUP' } },
      'STEPWIRE_NEWS',
    );
    const labels = sequence.scenes.filter((s) => s.label).map((s) => s.label);
    expect(labels).toContain('SESSION');
    expect(labels).toContain('PICKUP');
    expect(labels).toContain('WHAT HAPPENED');
  });
});
