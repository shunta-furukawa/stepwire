import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArticle, toVideoInput, type ArticleVideoInput } from '../lib/content/article';
import { buildSceneSequence, sceneStartFrames } from '../lib/video/scenes';
import { sceneImageSources } from '../lib/video/canvas/images';

const input: ArticleVideoInput = {
  slug: 'trailer', title: 'テスト記事', summary: '新しい楽曲が登場。',
  category: 'CHARTS', importance: 'normal', publishedAt: '2026-09-09T12:00:00Z',
  news: '新しい楽曲が登場。', context: '原曲の背景。', playerImpact: '踏みどころの話。',
  figures: [], media: [],
};
const shot = { src: 'images/result.jpg', alt: 'result', credit: 'MONO DDR' };

describe('Short as a full-film trailer', () => {
  it('defaults to a trailer for news and sessions; summary remains an explicit opt-out', () => {
    for (const session of [undefined, { date: '2026-09-09', style: 'SINGLE' as const }]) {
      const short = buildSceneSequence({ ...input, session }, 'STEPWIRE_SHORT');
      expect(short.scenes[0]?.id).toBe('short-hook');
      expect(short.scenes.at(-1)?.promotion?.destination).toBe('article');
      expect(short.scenes.at(-1)?.meta).not.toContain('関連動画');
      expect(short.scenes.some((s) => s.type === 'stats')).toBe(false);
    }
    expect(buildSceneSequence({ ...input, video: { shortMode: 'summary' } }, 'STEPWIRE_SHORT').scenes.at(-1)?.promotion).toBeUndefined();
  });

  it('keeps a question and reply together, retains the image and resolves listener poses after selection', () => {
    const article: ArticleVideoInput = { ...input, media: [shot], blocks: {
      news: [{ kind: 'paragraph', text: input.news }],
      context: [
        { kind: 'image', media: shot },
        { kind: 'turn', speaker: 'WIRE', mood: 'think', text: '今回の曲はどうだった？' },
        { kind: 'turn', speaker: 'MONO', mood: 'neutral', text: '最後まで楽しく踏めたよ。' },
        { kind: 'turn', speaker: 'WIRE', mood: 'grin', text: '次に気になっている曲は？' },
        { kind: 'turn', speaker: 'MONO', mood: 'neutral', text: 'その答えは本編に残す。' },
      ], playerImpact: [],
    } };
    const sequence = buildSceneSequence(article, 'STEPWIRE_SHORT');
    const turns = sequence.scenes.filter((s) => s.type === 'turn');
    expect(turns.map((s) => s.text)).toEqual(['今回の曲はどうだった？', '最後まで楽しく踏めたよ。', '次に気になっている曲は？']);
    expect(turns[0]?.image).toEqual(shot);
    expect(turns[1]?.resolvedCharacterPoses?.WIRE).toBe(turns[0]?.resolvedCharacterPoses?.WIRE);
    expect(turns[2]?.resolvedCharacterPoses?.MONO).toBe(turns[1]?.resolvedCharacterPoses?.MONO);
  });

  it('keeps trailer controls and the published poster out of the landscape script', () => {
    const full = buildSceneSequence(input, 'STEPWIRE_NEWS');
    expect(buildSceneSequence({ ...input, youtubeVideoId: 'maunje9POB0', thumbnail: shot,
      video: { shortHook: '続きが気になる？', shortMode: 'summary' } }, 'STEPWIRE_NEWS')).toEqual(full);
  });

  it('always leaves room for source and CTA, with readable text at different frame rates', () => {
    for (const fps of [24, 30, 60]) {
      const sequence = buildSceneSequence({ ...input, news: '長い事実の説明。'.repeat(60),
        context: '文脈についての説明。'.repeat(60), playerImpact: '影響についての説明。'.repeat(60) }, 'STEPWIRE_SHORT', fps);
      expect(sequence.durationInFrames).toBeLessThanOrEqual(45 * fps);
      expect(sequence.scenes.at(-2)?.type).toBe('source');
      expect(sequence.scenes.at(-1)?.id).toBe('short-outro');
      for (const s of sequence.scenes) {
        if (s.reveal) expect(s.durationInFrames - s.reveal.revealFrames).toBeGreaterThanOrEqual(s.reveal.holdFrames);
      }
    }
  });

  it('preserves required credits even when the full outro was explicitly skipped', () => {
    const sequence = buildSceneSequence({ ...input, media: [shot], thumbnail: shot,
      bgm: { src: 'audio/a.mp3', credit: 'Music maker', gain: 0.4 },
      video: { scenes: { outro: { skip: true } } } }, 'STEPWIRE_SHORT');
    expect(sequence.scenes.at(-1)?.credits).toEqual(['IMAGE: MONO DDR', 'MUSIC: Music maker']);
  });

  it('makes the actual three-song feature a 45s-or-less trailer with all three MVs and the published poster', () => {
    const filePath = 'content/articles/2026-09-09-teto-triple-pack.mdx';
    const article = parseArticle(readFileSync(filePath, 'utf8'), { filePath });
    const video = toVideoInput(article);
    const short = buildSceneSequence(video, 'STEPWIRE_SHORT');
    const full = buildSceneSequence(video, 'STEPWIRE_NEWS');
    expect(short.scenes[0]?.text).toBe(article.video?.shortHook);
    expect(short.durationInFrames / short.fps).toBeGreaterThanOrEqual(25);
    expect(short.durationInFrames / short.fps).toBeLessThanOrEqual(45);
    expect(full.durationInFrames / full.fps).toBe(180);
    expect(short.scenes.at(-1)?.promotion?.destination).toBe('youtube');
    expect(short.scenes.at(-1)?.image?.src).toBe(article.thumbnail?.src);
    expect(sceneImageSources(short.scenes)).toContain(article.thumbnail?.src);
    for (const media of article.media) expect(short.scenes.some((s) => s.type === 'turn' && s.image?.src === media.src)).toBe(true);
    for (const s of short.scenes.filter((s) => s.type === 'turn')) {
      const original = full.scenes.find((f) => f.id === s.id);
      expect(s.text).toBe(original?.text);
      expect(s.speaker).toBe(original?.speaker);
      expect(s.mood).toBe(original?.mood);
      expect(s.characterPoses).toEqual(original?.characterPoses);
    }
  });

  it('is deterministic, correctly indexed and bounded for every real article', () => {
    for (const filename of readdirSync('content/articles').filter((f) => f.endsWith('.mdx'))) {
      const filePath = `content/articles/${filename}`;
      const article = toVideoInput(parseArticle(readFileSync(filePath, 'utf8'), { filePath }));
      const sequence = buildSceneSequence(article, 'STEPWIRE_SHORT');
      expect(sequence).toEqual(buildSceneSequence(article, 'STEPWIRE_SHORT'));
      expect(sequence.durationInFrames).toBeLessThanOrEqual(45 * sequence.fps);
      expect(new Set(sequence.scenes.map((s) => s.id)).size).toBe(sequence.scenes.length);
      expect(sequence.scenes.some((s) => ['turn', 'news', 'context', 'impact', 'narration'].includes(s.type))).toBe(true);
      const starts = sceneStartFrames(sequence);
      sequence.scenes.forEach((s, i) => {
        expect(s.index).toBe(i); expect(s.total).toBe(sequence.scenes.length);
        expect(starts[i]).toBe(sequence.scenes.slice(0, i).reduce((n, prior) => n + prior.durationInFrames, 0));
      });
    }
  });
});
