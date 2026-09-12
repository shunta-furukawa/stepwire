import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArticle, toVideoInput } from '../lib/content/article';
import { buildSceneSequence } from '../lib/video/scenes';

const filePath = 'content/articles/2026-09-10-teto-first-session.mdx';
const article = parseArticle(readFileSync(filePath, 'utf8'), { filePath });
const input = toVideoInput(article);

describe('Teto first-session article', () => {
  it('records all eight September 10 plays without confusing first scores with PB improvements', () => {
    expect(article.session).toMatchObject({ date: '2026-09-10', start: '12:14', end: '12:38' });
    const log = article.figures.find((figure) => figure.kind === 'plays');
    expect(log?.kind).toBe('plays');
    if (log?.kind !== 'plays') throw new Error('session log is missing');
    expect(log.items.map((row) => row.score)).toEqual([
      998850, 999910, 999770, 999870, 999540, 999490, 994260, 337660,
    ]);
    expect(log.items.filter((row) => row.note?.includes('PFC'))).toHaveLength(5);
    expect(log.items.some((row) => row.pb)).toBe(false);
    expect(log.items.filter((row) => row.difficulty === 'DIFFICULT').every((row) => row.level === undefined)).toBe(true);
    expect(log.items.at(-1)).toMatchObject({ score: 337660, rank: 'E' });
  });

  it('keeps other-player screenshots distinct from MONO results, with timestamped references', () => {
    const references = article.media.filter((media) => media.kind === 'screenshot');
    expect(references).toHaveLength(5);
    for (const media of article.media) expect(existsSync(`public/${media.src}`)).toBe(true);
    for (const media of references) {
      expect(media.credit).toContain('譜面参考: おーしま / O4MA. Ch');
      expect(media.caption).toContain('MONOの記録ではありません');
    }
    expect(article.sources.map((source) => source.url)).toContain('https://www.youtube.com/watch?v=l6KkMnftq1c&t=83s');
    expect(article.sources.map((source) => source.url)).toContain('https://www.youtube.com/watch?v=69bwtjRNm00&t=144s');
    for (const name of ['session-history.webp', 'ghoststep.webp']) {
      expect(existsSync(`public/images/articles/2026-09-10-teto-first-session/${name}`)).toBe(true);
    }
    // No third-party gameplay or the previous STEPWIRE film becomes this session's own film.
    expect(article.youtubeVideoId).toBe('DgD_8C345JU');
    expect(article.video?.musicClips).toBeUndefined();
  });

  it('shows all chart references and results during dialogue, with time to inspect them', () => {
    const sequence = buildSceneSequence(input, 'STEPWIRE_NEWS');
    expect(sequence.durationInFrames / sequence.fps).toBeGreaterThanOrEqual(150);
    expect(sequence.durationInFrames / sequence.fps).toBeLessThanOrEqual(180);
    for (const media of article.media) {
      const scene = sequence.scenes.find((item) => item.image?.src === media.src);
      expect(scene?.type).toBe('turn');
      expect((scene?.durationInFrames ?? 0) / sequence.fps).toBeGreaterThanOrEqual(4);
      expect(sequence.scenes.at(-1)?.credits).toContain(`IMAGE: ${media.credit}`);
    }
    for (const scene of sequence.scenes) {
      if (scene.characterPoses) expect(Object.keys(scene.characterPoses)).toEqual([scene.speaker]);
      if (scene.reveal) expect(scene.durationInFrames - scene.reveal.revealFrames).toBeGreaterThanOrEqual(30);
    }
    expect(sequence.scenes.some((scene) => scene.text?.includes('またの機会に'))).toBe(true);
    expect(sequence.scenes.some((scene) => scene.type === 'image')).toBe(false);
  });

  it('links the short teaser to the uploaded session film', () => {
    const sequence = buildSceneSequence(input, 'STEPWIRE_SHORT');
    expect(sequence.durationInFrames / sequence.fps).toBeLessThanOrEqual(45);
    expect(sequence.scenes.some((scene) => scene.text?.includes('テトリミノの形'))).toBe(true);
    expect(sequence.scenes.at(-1)?.promotion?.destination).toBe('youtube');
  });
});
