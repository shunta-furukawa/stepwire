import { describe, expect, it } from 'vitest';
import type { ArticleVideoInput } from '../lib/content/article';
import { buildSceneSequence, sceneStartFrames } from '../lib/video/scenes';
import { COMPOSITIONS, COMPOSITION_IDS, isCompositionId } from '../lib/video/compositions';
import { formatDuration, framesToSeconds, readingSeconds, secondsToFrames } from '../lib/video/timing';
import { needsSpaceBetween, splitForReveal, visualLength } from '../lib/video/text';
import {
  barFractions,
  figureSchema,
  formatBarValue,
  type BarsFigure,
  type Figure,
  type StatFigure,
} from '../lib/content/figures';

const statFigure: StatFigure = {
  kind: 'stat',
  items: [
    { label: 'PEAK BPM', value: '300' },
    { label: 'SONGS', value: '6' },
  ],
};

const barsFigure: BarsFigure = {
  kind: 'bars',
  title: 'Peak BPM',
  unit: 'BPM',
  items: [
    { label: 'Chart A', value: 300, highlight: true },
    { label: 'Chart B', value: 200 },
    { label: 'Chart C', value: 100 },
  ],
};

const article: ArticleVideoInput = {
  slug: 'a-test-article',
  title: 'A test article with a reasonably long headline',
  summary: 'One factual sentence about the thing that happened.',
  category: 'UPDATE',
  importance: 'normal',
  publishedAt: '2026-08-30T09:00:00+09:00',
  news: 'First fact about the update. Second fact about the update. Third fact that adds detail.',
  context: 'Why this matters in the wider scene. A second point of analysis follows here.',
  playerImpact: 'What changes at the cabinet. A second consequence for a player.',
  primarySource: {
    publisher: 'Example',
    title: 'The announcement',
    url: 'https://example.com/a',
  },
  figures: [],
  media: [],
};

describe('timing', () => {
  it('converts between seconds and frames', () => {
    expect(secondsToFrames(2, 30)).toBe(60);
    expect(framesToSeconds(60, 30)).toBe(2);
  });

  it('never produces a zero-length scene', () => {
    expect(secondsToFrames(0, 30)).toBe(1);
  });

  it('scales reading time with text length, within bounds', () => {
    const short = readingSeconds('Short.');
    const long = readingSeconds('x'.repeat(400));
    expect(long).toBeGreaterThan(short);
    expect(short).toBeGreaterThanOrEqual(2);
    expect(long).toBeLessThanOrEqual(7);
  });

  it('formats durations for the studio', () => {
    expect(formatDuration(300, 30)).toBe('10.0s');
    expect(formatDuration(1950, 30)).toBe('1:05');
  });
});

describe('headline reveal splitting', () => {
  it('splits Latin on word boundaries', () => {
    expect(splitForReveal('A test article with a headline')).toEqual([
      'A', 'test', 'article', 'with', 'a', 'headline',
    ]);
  });

  it('splits Japanese into bunsetsu-like units', () => {
    // Japanese has no spaces, so without this a headline reveals as one block.
    expect(splitForReveal('【SAMPLE】DDR WORLD、夏のアップデートでスコア表示を刷新')).toEqual([
      '【SAMPLE】', 'DDR', 'WORLD、', '夏の', 'アップデートで', 'スコア表示を', '刷新',
    ]);
  });

  it('breaks after closing punctuation', () => {
    expect(splitForReveal('速報。譜面が増えた')).toEqual(['速報。', '譜面が', '増えた']);
  });

  it('puts a space only between two Latin units', () => {
    const units = splitForReveal('【SAMPLE】DDR WORLD、夏の更新');
    expect(units).toEqual(['【SAMPLE】', 'DDR', 'WORLD、', '夏の', '更新']);
    // Only DDR -> WORLD、 takes a space; nothing before or after a CJK unit does.
    expect(units.map((unit, i) => needsSpaceBetween(unit, units[i + 1]))).toEqual([
      false, true, false, false, false,
    ]);
  });

  it('never puts a space after the last unit', () => {
    expect(needsSpaceBetween('headline', undefined)).toBe(false);
  });
});

describe('composition registry', () => {
  it('exposes both required compositions at the specified dimensions', () => {
    expect(COMPOSITION_IDS).toEqual(['STEPWIRE_SHORT', 'STEPWIRE_NEWS']);
    expect(COMPOSITIONS.STEPWIRE_SHORT).toMatchObject({ width: 1080, height: 1920, fps: 30 });
    expect(COMPOSITIONS.STEPWIRE_NEWS).toMatchObject({ width: 1920, height: 1080, fps: 30 });
  });

  it('recognises only known composition ids', () => {
    expect(isCompositionId('STEPWIRE_SHORT')).toBe(true);
    expect(isCompositionId('STEPWIRE_TALL')).toBe(false);
  });
});

describe('buildSceneSequence', () => {
  it('opens on the headline and closes with source and outro', () => {
    // No ident up front: a feed gives a film two seconds to earn the next two,
    // and a brand ident spends them on the brand. The ident is the sign-off.
    const sequence = buildSceneSequence(article, 'STEPWIRE_SHORT');
    const types = sequence.scenes.map((scene) => scene.type);
    expect(types[0]).toBe('headline');
    expect(types).not.toContain('intro');
    expect(types.at(-2)).toBe('source');
    expect(types.at(-1)).toBe('outro');
  });

  it('carries the category and date on the headline, where the ident had them', () => {
    const headline = buildSceneSequence(article, 'STEPWIRE_SHORT').scenes[0]!;
    expect(headline.kicker).toContain('2026.08.30');
  });

  it('opens on the session card instead of the headline when a session is declared', () => {
    // The thumbnail already said what the film is about; the film opens on
    // what was played. The session card is never dropped under budget.
    const sequence = buildSceneSequence(
      {
        ...article,
        session: { date: '2026-09-03', start: '19:08', end: '19:37', style: 'SINGLE' },
        figures: [
          {
            kind: 'plays',
            items: [
              { song: 'A', difficulty: 'EXPERT', style: 'SINGLE', level: 13, score: 999200, rank: 'AAA', pb: true },
              { song: 'B', difficulty: 'EXPERT', style: 'SINGLE', level: 15, score: 987020, rank: 'AA+' },
            ],
          },
        ],
      },
      'STEPWIRE_NEWS',
    );
    const first = sequence.scenes[0]!;
    expect(first.type).toBe('stats');
    expect(first.kicker).toBe('SESSION · 2026.09.03');
    expect(first.stats?.charts).toBe(2);
    expect(first.stats?.personalBests).toBe(1);
    expect(sequence.scenes.map((scene) => scene.type)).not.toContain('headline');
  });

  it('turns a conversation into turn cards that carry the speaker and the mood', () => {
    const sequence = buildSceneSequence(
      {
        ...article,
        blocks: {
          news: [{ kind: 'paragraph', text: article.news }],
          context: [
            { kind: 'turn', speaker: 'WIRE', mood: 'grin', text: 'まずコンディションはどうだった？' },
            { kind: 'image', media: { src: 'images/a.jpg', alt: 'a', credit: 'MONO DDR', kind: 'photo' } },
            { kind: 'turn', speaker: 'MONO', mood: 'neutral', text: '正直、悪かったです。' },
          ],
          playerImpact: [{ kind: 'paragraph', text: article.playerImpact }],
        },
      },
      'STEPWIRE_NEWS',
    );
    const turns = sequence.scenes.filter((scene) => scene.type === 'turn');
    expect(turns.map((scene) => scene.speaker)).toEqual(['WIRE', 'MONO']);
    expect(turns[0]?.mood).toBe('grin');
    // The first card of the section carries its label; the picture rides
    // with the turn after it.
    expect(turns[0]?.label).toBeDefined();
    expect(turns[1]?.label).toBeUndefined();
    expect(turns[1]?.image?.src).toBe('images/a.jpg');
    expect(turns.every((scene) => scene.reveal)).toBe(true);
  });

  it('types every card, and holds it after the last character', () => {
    for (const scene of buildSceneSequence(article, 'STEPWIRE_NEWS').scenes) {
      if (!['headline', 'news', 'context', 'impact'].includes(scene.type)) continue;
      expect(scene.reveal, scene.id).toBeDefined();
      expect(scene.durationInFrames).toBe(scene.reveal!.revealFrames + scene.reveal!.holdFrames);
      expect(scene.reveal!.units).toBe([...scene.text!].length);
    }
  });

  it('puts the images after the reported fact and before the analysis', () => {
    const withImages: ArticleVideoInput = {
      ...article,
      media: [
        { src: 'images/a.png', alt: 'a', credit: 'A' },
        { src: 'images/b.png', alt: 'b', credit: 'B' },
      ],
    };
    const types = buildSceneSequence(withImages, 'STEPWIRE_NEWS').scenes.map((s) => s.type);
    const lastNews = types.lastIndexOf('news');
    const firstImage = types.indexOf('image');
    const firstContext = types.indexOf('context');
    expect(firstImage).toBeGreaterThan(lastNews);
    expect(firstImage).toBeLessThan(firstContext);
    expect(types.filter((t) => t === 'image')).toHaveLength(2);
  });

  it('puts the hero image behind the headline and carries its credit', () => {
    const withHero: ArticleVideoInput = {
      ...article,
      heroImage: { src: 'images/hero.png', alt: 'hero', credit: 'Photo: X' },
    };
    const headline = buildSceneSequence(withHero, 'STEPWIRE_NEWS').scenes[0]!;
    expect(headline.image?.src).toBe('images/hero.png');
    expect(headline.image?.credit).toBe('Photo: X');
  });

  it('derives a scene from each of the three article sections', () => {
    const types = buildSceneSequence(article, 'STEPWIRE_NEWS').scenes.map((scene) => scene.type);
    expect(types).toContain('news');
    expect(types).toContain('context');
    expect(types).toContain('impact');
  });

  it('labels only the first card of each section', () => {
    const sequence = buildSceneSequence(article, 'STEPWIRE_NEWS');
    const newsCards = sequence.scenes.filter((scene) => scene.type === 'news');
    expect(newsCards[0]!.label).toBe('WHAT HAPPENED');
    for (const card of newsCards.slice(1)) {
      expect(card.label).toBeUndefined();
    }
  });

  it('reports a total duration equal to the sum of its scenes', () => {
    const sequence = buildSceneSequence(article, 'STEPWIRE_SHORT');
    const sum = sequence.scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
    expect(sequence.durationInFrames).toBe(sum);
  });

  it('keeps the short format inside its 45-second ceiling', () => {
    const wordy: ArticleVideoInput = {
      ...article,
      news: 'A sentence about the update. '.repeat(20),
      context: 'A sentence of analysis. '.repeat(20),
      playerImpact: 'A sentence about impact. '.repeat(20),
    };
    const sequence = buildSceneSequence(wordy, 'STEPWIRE_SHORT');
    expect(framesToSeconds(sequence.durationInFrames, sequence.fps)).toBeLessThanOrEqual(45);
  });

  it('never trims away the source or outro when budgeting', () => {
    const wordy: ArticleVideoInput = {
      ...article,
      news: 'A sentence about the update. '.repeat(40),
      context: 'A sentence of analysis. '.repeat(40),
      playerImpact: 'A sentence about impact. '.repeat(40),
    };
    const types = buildSceneSequence(wordy, 'STEPWIRE_SHORT').scenes.map((scene) => scene.type);
    expect(types).toContain('source');
    expect(types).toContain('outro');
    expect(types).toContain('news');
  });

  it('does not strand a short opening sentence on its own card', () => {
    const stranded: ArticleVideoInput = {
      ...article,
      news:
        'It shipped. The update adds a per-panel accuracy readout to the results screen and rebalances four charts at the top of the difficulty table for the new season.',
    };
    const cards = buildSceneSequence(stranded, 'STEPWIRE_NEWS').scenes.filter(
      (scene) => scene.type === 'news',
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]!.text).toContain('It shipped.');
    expect(cards[0]!.text).toContain('difficulty table');
  });

  it('never packs a card past what the frame can fit', () => {
    // The overflow this guards against is invisible to a unit test — body copy
    // running into the progress rail — so the length is asserted instead.
    const dense: ArticleVideoInput = {
      ...article,
      news: '短い一文です。' + 'これは十分に長い日本語の文章で、カードの詰め込み量を試すためのものです。'.repeat(3),
      context: 'A short one. ' + 'A considerably longer sentence that tests how much a single card takes. '.repeat(3),
      playerImpact: '中上位帯を詰めている人にとって、これは普通の追加です。計画を立てるべきは速い1曲のほうで、この形の譜面は反応速度よりも足運びの効率を要求します。',
    };

    for (const composition of COMPOSITION_IDS) {
      for (const scene of buildSceneSequence(dense, composition).scenes) {
        if (!scene.text) continue;
        if (scene.type !== 'news' && scene.type !== 'context' && scene.type !== 'impact') continue;
        // One sentence longer than the budget is still allowed to be one card;
        // what must not happen is two sentences packed well past it.
        const sentences = scene.text.split(/(?<=[。.])\s*/).filter(Boolean);
        if (sentences.length < 2) continue;
        expect(visualLength(scene.text), `${composition} ${scene.id}`).toBeLessThanOrEqual(
          composition === 'STEPWIRE_SHORT' ? 165 : 220,
        );
      }
    }
  });

  it('still splits a section that genuinely exceeds one card', () => {
    const long: ArticleVideoInput = {
      ...article,
      news: 'A full sentence of reported detail about the update. '.repeat(8),
    };
    const cards = buildSceneSequence(long, 'STEPWIRE_NEWS').scenes.filter(
      (scene) => scene.type === 'news',
    );
    expect(cards.length).toBeGreaterThan(1);
  });

  it('gives a shorter article a shorter video', () => {
    const brief: ArticleVideoInput = {
      ...article,
      news: 'It shipped.',
      context: 'It is notable.',
      playerImpact: 'Little changes.',
    };
    const short = buildSceneSequence(brief, 'STEPWIRE_SHORT');
    const normal = buildSceneSequence(article, 'STEPWIRE_SHORT');
    expect(short.durationInFrames).toBeLessThan(normal.durationInFrames);
  });

  it('numbers scenes consecutively with a consistent total', () => {
    const sequence = buildSceneSequence(article, 'STEPWIRE_NEWS');
    sequence.scenes.forEach((scene, index) => {
      expect(scene.index).toBe(index);
      expect(scene.total).toBe(sequence.scenes.length);
    });
  });

  it('gives every scene a unique id', () => {
    const ids = buildSceneSequence(article, 'STEPWIRE_NEWS').scenes.map((scene) => scene.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses the video headline override in place of the title', () => {
    const sequence = buildSceneSequence(
      { ...article, video: { headline: 'Overridden headline' } },
      'STEPWIRE_SHORT',
    );
    expect(sequence.scenes.find((scene) => scene.type === 'headline')?.text).toBe(
      'Overridden headline',
    );
  });

  it('prefers shortTitle over title when no override is given', () => {
    const sequence = buildSceneSequence(
      { ...article, shortTitle: 'A short headline' },
      'STEPWIRE_SHORT',
    );
    expect(sequence.scenes.find((scene) => scene.type === 'headline')?.text).toBe(
      'A short headline',
    );
  });

  it('applies a per-scene text and duration override', () => {
    const sequence = buildSceneSequence(
      {
        ...article,
        video: { scenes: { source: { durationInSeconds: 3 } } },
      },
      'STEPWIRE_SHORT',
    );
    const source = sequence.scenes.find((scene) => scene.id === 'source');
    expect(source?.durationInFrames).toBe(90);
  });

  it('drops a scene marked skip', () => {
    const sequence = buildSceneSequence(
      { ...article, video: { scenes: { outro: { skip: true } } } },
      'STEPWIRE_SHORT',
    );
    expect(sequence.scenes.some((scene) => scene.type === 'outro')).toBe(false);
  });

  it('adds a figure scene only when the article declares one', () => {
    expect(
      buildSceneSequence(article, 'STEPWIRE_SHORT').scenes.some((scene) => scene.type === 'figure'),
    ).toBe(false);

    const withFigure = buildSceneSequence({ ...article, figures: [statFigure] }, 'STEPWIRE_SHORT');
    const scene = withFigure.scenes.find((scene) => scene.type === 'figure');
    expect(scene?.id).toBe('figure');
    expect(scene?.figure).toEqual(statFigure);
  });

  it('gives each figure its own scene, numbered', () => {
    const sequence = buildSceneSequence(
      { ...article, figures: [statFigure, barsFigure] },
      'STEPWIRE_NEWS',
    );
    const ids = sequence.scenes.filter((scene) => scene.type === 'figure').map((scene) => scene.id);
    expect(ids).toEqual(['figure-1', 'figure-2']);
  });

  it("labels a figure with its own title, falling back to the section label", () => {
    const titled = buildSceneSequence({ ...article, figures: [barsFigure] }, 'STEPWIRE_NEWS');
    expect(titled.scenes.find((scene) => scene.type === 'figure')?.label).toBe('Peak BPM');

    const untitled: Figure = { kind: 'stat', items: statFigure.items };
    const plain = buildSceneSequence({ ...article, figures: [untitled] }, 'STEPWIRE_NEWS');
    expect(plain.scenes.find((scene) => scene.type === 'figure')?.label).toBe('BY THE NUMBERS');
  });

  it('holds a figure with more rows on screen for longer', () => {
    const two = buildSceneSequence({ ...article, figures: [statFigure] }, 'STEPWIRE_NEWS');
    const six: Figure = {
      kind: 'timeline',
      items: Array.from({ length: 6 }, (_, i) => ({ at: `2026.0${i + 1}`, label: `Step ${i + 1}` })),
    };
    const many = buildSceneSequence({ ...article, figures: [six] }, 'STEPWIRE_NEWS');
    const duration = (s: typeof two) =>
      s.scenes.find((scene) => scene.type === 'figure')!.durationInFrames;
    expect(duration(many)).toBeGreaterThan(duration(two));
  });

  it('falls back to STEPWIRE reporting when there is no source', () => {
    const noSource = { ...article };
    delete noSource.primarySource;
    const sequence = buildSceneSequence(noSource, 'STEPWIRE_SHORT');
    expect(sequence.scenes.find((scene) => scene.type === 'source')?.text).toBe(
      'STEPWIRE reporting',
    );
  });

  it('is deterministic', () => {
    expect(buildSceneSequence(article, 'STEPWIRE_SHORT')).toEqual(
      buildSceneSequence(article, 'STEPWIRE_SHORT'),
    );
  });
});

describe('sceneStartFrames', () => {
  it('returns cumulative offsets starting at zero', () => {
    const sequence = buildSceneSequence(article, 'STEPWIRE_SHORT');
    const offsets = sceneStartFrames(sequence);
    expect(offsets[0]).toBe(0);
    expect(offsets).toHaveLength(sequence.scenes.length);
    expect(offsets.at(-1)! + sequence.scenes.at(-1)!.durationInFrames).toBe(
      sequence.durationInFrames,
    );
  });
});

describe('figures', () => {
  it('accepts each of the three shapes', () => {
    for (const figure of [statFigure, barsFigure]) {
      expect(figureSchema.safeParse(figure).success).toBe(true);
    }
    expect(
      figureSchema.safeParse({
        kind: 'timeline',
        items: [
          { at: '2026.08', label: 'Announced' },
          { at: '未定', label: 'Release', highlight: true },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown kind and a comparison of one', () => {
    expect(figureSchema.safeParse({ kind: 'pie', items: [] }).success).toBe(false);
    expect(
      figureSchema.safeParse({ kind: 'bars', items: [{ label: 'A', value: 1 }] }).success,
    ).toBe(false);
  });

  it('rejects a bar value that is not a number', () => {
    // The point of `bars` over `stat` is that the lengths are true to scale,
    // which only holds if the values are real numbers.
    expect(
      figureSchema.safeParse({
        kind: 'bars',
        items: [
          { label: 'A', value: '300' },
          { label: 'B', value: '200' },
        ],
      }).success,
    ).toBe(false);
  });

  it('baselines bars at zero rather than at the smallest value', () => {
    // Baselining at the minimum would draw Chart C as a zero-length bar and
    // make a 3x difference look infinite.
    expect(barFractions(barsFigure)).toEqual([1, 2 / 3, 1 / 3]);
  });

  it('handles a comparison in which every value is equal', () => {
    expect(
      barFractions({
        kind: 'bars',
        items: [
          { label: 'A', value: 5 },
          { label: 'B', value: 5 },
        ],
      }),
    ).toEqual([1, 1]);
  });

  it('includes negative values in the span so a bar is never negative-length', () => {
    const fractions = barFractions({
      kind: 'bars',
      items: [
        { label: 'A', value: -10 },
        { label: 'B', value: 30 },
      ],
    });
    expect(Math.min(...fractions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fractions)).toBe(1);
  });

  it('appends the unit, and keeps whole numbers whole', () => {
    expect(formatBarValue(barsFigure, 300)).toBe('300 BPM');
    expect(formatBarValue(barsFigure, 187.53)).toBe('187.5 BPM');
    expect(formatBarValue({ ...barsFigure, unit: undefined }, 300)).toBe('300');
  });
});

describe('pictures placed in the prose', () => {
  it('ride with the paragraph after them and leave the gallery', () => {
    const shot = { src: 'images/a.png', alt: 'a', credit: 'A' };
    const other = { src: 'images/b.png', alt: 'b', credit: 'B' };
    const sequence = buildSceneSequence(
      {
        ...article,
        media: [shot, other],
        blocks: {
          news: [{ kind: 'paragraph', text: article.news }],
          context: [
            { kind: 'paragraph', text: 'Before the picture.' },
            { kind: 'image', media: shot },
            { kind: 'paragraph', text: 'About the picture.' },
          ],
          playerImpact: [{ kind: 'paragraph', text: article.playerImpact }],
        },
      },
      'STEPWIRE_NEWS',
    );
    const context = sequence.scenes.filter((s) => s.type === 'context');
    expect(context[0]?.image).toBeUndefined();
    expect(context[1]?.image?.src).toBe('images/a.png');
    expect(context[1]?.text).toBe('About the picture.');
    // Only the unplaced picture gets a gallery card.
    const gallery = sequence.scenes.filter((s) => s.type === 'image').map((s) => s.image?.src);
    expect(gallery).toEqual(['images/b.png']);
  });

  it('gives a trailing picture to the paragraph before it', () => {
    const shot = { src: 'images/a.png', alt: 'a', credit: 'A' };
    const sequence = buildSceneSequence(
      {
        ...article,
        media: [shot],
        blocks: {
          news: [{ kind: 'paragraph', text: article.news }],
          context: [{ kind: 'paragraph', text: 'Only words.' }, { kind: 'image', media: shot }],
          playerImpact: [{ kind: 'paragraph', text: article.playerImpact }],
        },
      },
      'STEPWIRE_NEWS',
    );
    expect(sequence.scenes.find((s) => s.type === 'context')?.image?.src).toBe('images/a.png');
    expect(sequence.scenes.some((s) => s.type === 'image')).toBe(false);
  });
});

describe('pictures beside copy', () => {
  it('gives a card with a picture a smaller budget, and keeps every paragraph', () => {
    const para = '一文がここにある。'.repeat(12);
    const withPictures: ArticleVideoInput = {
      ...article,
      media: [{ src: 'images/a.png', alt: 'a', credit: 'A' }],
      blocks: {
        news: [{ kind: 'paragraph', text: article.news }],
        context: [
          { kind: 'image', media: { src: 'images/a.png', alt: 'a', credit: 'A' } },
          { kind: 'paragraph', text: para },
          { kind: 'paragraph', text: '二つ目。' },
          { kind: 'paragraph', text: '三つ目。' },
          { kind: 'paragraph', text: '四つ目。' },
        ],
        playerImpact: [{ kind: 'paragraph', text: article.playerImpact }],
      },
    };
    const scenes = buildSceneSequence(withPictures, 'STEPWIRE_NEWS').scenes;
    const context = scenes.filter((s) => s.type === 'context');
    // The pictured paragraph split into more, smaller cards than it would
    // have at full measure; the three short paragraphs after it survived.
    const pictured = context.filter((s) => s.image);
    expect(pictured.length).toBeGreaterThanOrEqual(2);
    for (const card of pictured) expect(card.text!.length).toBeLessThan(120);
    expect(context.map((s) => s.text)).toEqual(expect.arrayContaining(['二つ目。', '三つ目。', '四つ目。']));
    // A placed picture is not repeated in the gallery.
    expect(scenes.filter((s) => s.type === 'image')).toHaveLength(0);
  });
});
