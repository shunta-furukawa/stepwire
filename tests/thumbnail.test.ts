import { describe, expect, it } from 'vitest';
import type { ArticleVideoInput } from '../lib/content/article';
import { fitHeadline, fitHeadlineTight, thumbnailPlan } from '../lib/video/canvas/thumbnail';

const article: ArticleVideoInput = {
  slug: 's',
  title: 'A long title that the thumbnail would not use',
  shortTitle: 'EXTRA SAVIORに7th MCAの3曲',
  summary: 'x',
  category: 'CHARTS',
  importance: 'normal',
  publishedAt: '2026-09-03T23:00:00+09:00',
  news: 'n',
  context: 'c',
  playerImpact: 'p',
  figures: [
    {
      kind: 'plays',
      items: [
        { song: 'a', difficulty: 'EXPERT', level: 13, style: 'SINGLE', score: 999200, rank: 'AAA', highlight: true },
        { song: 'b', difficulty: 'EXPERT', level: 15, style: 'SINGLE', score: 987020, rank: 'AA+', highlight: true },
        { song: 'c', difficulty: 'EXPERT', style: 'SINGLE', score: 920850, rank: 'AA' },
        { song: 'd', difficulty: 'EXPERT', level: 15, style: 'SINGLE', score: 998550, rank: 'AAA', highlight: true },
        { song: 'a', difficulty: 'EXPERT', level: 13, style: 'SINGLE', score: 996830, rank: 'AAA', highlight: true },
      ],
    },
    {
      kind: 'plays',
      items: [{ song: 'a', difficulty: 'EXPERT', level: 13, style: 'SINGLE', score: 999200, rank: 'AAA', highlight: true }],
    },
  ],
  heroImage: { src: 'images/hero.jpg', alt: 'h', credit: 'H' },
  media: [
    { src: 'images/hero.jpg', alt: 'h', credit: 'H' },
    { src: 'images/r1.jpg', alt: 'r1', credit: 'M' },
    { src: 'images/r2.jpg', alt: 'r2', credit: 'M' },
    { src: 'images/r3.jpg', alt: 'r3', credit: 'M' },
    { src: 'images/r4.jpg', alt: 'r4', credit: 'M' },
  ],
};

describe('thumbnail plan', () => {
  it('uses the short title, the hero behind, and three tiles that are not the hero', () => {
    const plan = thumbnailPlan(article);
    expect(plan.headline).toBe('EXTRA SAVIORに7th MCAの3曲');
    expect(plan.backdrop?.src).toBe('images/hero.jpg');
    expect(plan.tiles.map((t) => t.src)).toEqual(['images/r1.jpg', 'images/r2.jpg', 'images/r3.jpg']);
    expect(plan.kicker).toBe('譜面 · 2026.09.03');
  });

  it('shouts the highlighted results, one per chart at its best, best first, at most three', () => {
    const chips = thumbnailPlan(article).chips;
    expect(chips.map((c) => c.score)).toEqual(['999,200', '998,550', '987,020']);
    expect(chips[0]).toMatchObject({ label: 'EXPERT 13', rank: 'AAA', difficulty: 'EXPERT' });
  });

  it('copes with an article that has nothing to show', () => {
    const plan = thumbnailPlan({ ...article, heroImage: undefined, media: [], figures: [] });
    expect(plan.backdrop).toBeUndefined();
    expect(plan.tiles).toEqual([]);
    expect(plan.chips).toEqual([]);
  });
});

describe('fitHeadline', () => {
  // Every glyph is one em wide in this pretend font.
  const measure = (text: string, size: number) => [...text].length * size;

  it('finds the largest size at which the lines fit the box', () => {
    const { size, lines } = fitHeadline('あいうえおかきくけこ', { width: 1000, height: 400 }, measure);
    expect(lines.length * size * 1.04).toBeLessThanOrEqual(400);
    for (const line of lines) expect(measure(line, size)).toBeLessThanOrEqual(1000 + size);
    expect(size).toBeGreaterThan(150);
  });

  it('keeps a long headline on a few lines rather than shrinking to one', () => {
    const { lines, size } = fitHeadline('あ'.repeat(40), { width: 1000, height: 500 }, measure);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(size).toBeGreaterThan(60);
  });
});

describe('fitHeadline with an unbreakable word', () => {
  it('shrinks until the widest line fits the box, not only the height', () => {
    const measure = (text: string, size: number) => [...text].length * size * 0.6;
    const { size, lines } = fitHeadline('STEPWIREとは', { width: 1000, height: 400 }, measure);
    for (const line of lines) expect(measure(line, size)).toBeLessThanOrEqual(1000);
  });
});

describe('the pair on the thumbnail', () => {
  it('stands in only when a conversation has no pictures of its own', () => {
    const conversation: ArticleVideoInput = {
      ...article,
      heroImage: undefined,
      media: [],
      blocks: {
        news: [{ kind: 'paragraph', text: article.news }],
        context: [{ kind: 'turn', speaker: 'WIRE', mood: 'grin', text: 'はじめまして。' }],
        playerImpact: [{ kind: 'paragraph', text: article.playerImpact }],
      },
    };
    expect(thumbnailPlan(conversation).pair).toBe(true);
    expect(thumbnailPlan({ ...conversation, blocks: undefined }).pair).toBe(false);
    expect(thumbnailPlan(article).pair).toBe(false);
  });
});

describe('fitHeadlineTight', () => {
  const measure = (text: string, size: number) => [...text].length * size * 0.6;

  it('sizes every line to the width, and the block to the height', () => {
    const lines = fitHeadlineTight('STEPWIREとは', { width: 1200, height: 900 }, measure);
    // The Latin word stays whole; the two characters after it get their own,
    // much larger, line — the poster block — and the whole is scaled to the
    // height, so every line is at most the width and the block fills it.
    expect(lines.map((line) => line.text)).toEqual(['STEPWIRE', 'とは']);
    for (const line of lines) expect(measure(line.text, line.size)).toBeLessThanOrEqual(1200 + 1e-6);
    expect(lines.reduce((t, line) => t + line.size, 0)).toBeCloseTo(900, 3);
  });

  it('scales the block down when the width-filled lines would be too tall', () => {
    const lines = fitHeadlineTight('とは', { width: 1200, height: 300 }, measure);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.size).toBeCloseTo(300, 3);
  });

  it('never starts a line with a closing mark', () => {
    const lines = fitHeadlineTight('解禁当日に踏んできた。次はPFCを取りたい', { width: 800, height: 800 }, measure);
    for (const line of lines) expect([...'。、」）']).not.toContain([...line.text][0]);
  });
});
