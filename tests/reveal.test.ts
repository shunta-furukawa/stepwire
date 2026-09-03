import { describe, expect, it } from 'vitest';
import { planReveal, revealedText, visibleUnits } from '../lib/video/reveal';
import { buildSceneSequence } from '../lib/video/scenes';
import { tickOffsets } from '../lib/video/canvas/mix';
import type { ArticleVideoInput } from '../lib/content/article';

describe('planReveal', () => {
  it('lands one character per cadence and counts code points, not UTF-16 units', () => {
    const plan = planReveal('あい😀', 'body', 30);
    expect(plan.units).toBe(3);
    expect(plan.revealFrames).toBe(3 * plan.framesPerUnit);
  });

  it('types a headline slower than body copy', () => {
    expect(planReveal('abc', 'headline', 30).framesPerUnit).toBeGreaterThan(
      planReveal('abc', 'body', 30).framesPerUnit,
    );
  });

  it('holds the finished card for at least the minimum', () => {
    expect(planReveal('短', 'body', 30).holdFrames).toBeGreaterThanOrEqual(42);
  });

  it('ticks on landing characters and never on whitespace', () => {
    const plan = planReveal('ab cd', 'headline', 30);
    // 'a','b','c','d' sound; the space does not, and it does not advance the beat.
    expect(plan.ticks).toEqual([0, 2, 6, 8]);
  });

  it('ticks every other character for body copy', () => {
    expect(planReveal('abcd', 'body', 30).ticks).toEqual([0, 2]);
  });
});

describe('visibleUnits / revealedText', () => {
  const plan = planReveal('あいうえお', 'body', 30);

  it('shows the first character on frame zero and all of them after the reveal', () => {
    expect(visibleUnits(plan, 0)).toBe(1);
    expect(visibleUnits(plan, plan.revealFrames + 100)).toBe(plan.units);
  });

  it('slices by code point', () => {
    expect(revealedText('あ😀い', 2)).toBe('あ😀');
  });
});

describe('tickOffsets', () => {
  const article: ArticleVideoInput = {
    slug: 'a',
    title: 'ab',
    summary: 's',
    category: 'UPDATE',
    importance: 'normal',
    publishedAt: '2026-08-30T09:00:00+09:00',
    news: 'cd.',
    context: 'ef.',
    playerImpact: 'gh.',
    figures: [],
    media: [],
  };

  it('places every tick inside the film, in order, on the frame its plan says', () => {
    const sequence = buildSceneSequence(article, 'STEPWIRE_NEWS');
    const offsets = tickOffsets(sequence, 48_000);
    const total = sequence.scenes.reduce((n, s) => n + (s.reveal?.ticks.length ?? 0), 0);
    expect(offsets).toHaveLength(total);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(offsets.at(-1)!).toBeLessThan((sequence.durationInFrames / sequence.fps) * 48_000);
    // The first tick is the headline's first character, on frame 0.
    expect(offsets[0]).toBe(0);
  });
});
