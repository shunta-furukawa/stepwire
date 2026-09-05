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

describe('tick voices', () => {
  it('routes each scene to its speaker: narration, WIRE or MONO', async () => {
    const { tickVoiceOf } = await import('../lib/video/canvas/mix');
    expect(tickVoiceOf({ type: 'news' })).toBe('narration');
    expect(tickVoiceOf({ type: 'narration' })).toBe('narration');
    expect(tickVoiceOf({ type: 'turn', speaker: 'WIRE' })).toBe('wire');
    expect(tickVoiceOf({ type: 'turn', speaker: 'MONO' })).toBe('mono');
  });

  it('gives the three voices three registers, and the same sound every time', async () => {
    const { synthTick } = await import('../lib/video/canvas/sfx');
    const rate = 48_000;
    // Zero-crossing rate stands in for pitch: WIRE above the narrator, MONO below.
    const zcr = (samples: Float32Array) => {
      let crossings = 0;
      for (let i = 1; i < samples.length; i += 1) if (samples[i]! >= 0 !== samples[i - 1]! >= 0) crossings += 1;
      return crossings / (samples.length / rate);
    };
    const wire = synthTick(rate, 'wire').samples;
    const narration = synthTick(rate, 'narration').samples;
    const mono = synthTick(rate, 'mono').samples;
    expect(zcr(wire)).toBeGreaterThan(zcr(narration));
    expect(zcr(narration)).toBeGreaterThan(zcr(mono));
    expect(synthTick(rate, 'mono').samples).toEqual(mono);
    for (const samples of [wire, narration, mono]) {
      expect(Math.max(...Array.from(samples).map(Math.abs))).toBeLessThanOrEqual(1);
    }
  });
});
