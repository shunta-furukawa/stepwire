import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArticle, toVideoInput } from '../lib/content/article';
import { buildSceneSequence } from '../lib/video/scenes';

const filePath = 'content/articles/2026-09-09-teto-triple-pack.mdx';
const article = parseArticle(readFileSync(filePath, 'utf8'), { filePath });

describe('three-song MV feature', () => {
  it('keeps the published film and its poster out of the landscape export script', () => {
    expect(article.youtubeVideoId).toBe('maunje9POB0');
    expect(article.thumbnail).toBeDefined();
    expect(existsSync(`public/${article.thumbnail!.src}`)).toBe(true);
    expect(buildSceneSequence(toVideoInput(article), 'STEPWIRE_NEWS')).toEqual(
      buildSceneSequence(toVideoInput({ ...article, youtubeVideoId: undefined, thumbnail: undefined }), 'STEPWIRE_NEWS'),
    );
  });

  it('keeps all three illustrated chapters and the ending in about three minutes', () => {
    const sequence = buildSceneSequence(toVideoInput(article), 'STEPWIRE_NEWS');
    const seconds = sequence.durationInFrames / sequence.fps;
    expect(seconds).toBeGreaterThanOrEqual(175);
    expect(seconds).toBeLessThanOrEqual(180);
    for (const media of article.media) {
      expect(existsSync(`public/${media.src}`)).toBe(true);
      const chapter = sequence.scenes.filter((scene) => scene.image?.src === media.src);
      // Each MV accompanies sustained commentary, not a flash in the gallery.
      expect(chapter.length).toBeGreaterThanOrEqual(5);
      expect(chapter.every((scene) => scene.type === 'turn')).toBe(true);
      const duration = chapter.reduce((total, scene) => total + scene.durationInFrames, 0);
      expect(duration / sequence.fps).toBeGreaterThanOrEqual(30);
      expect(sequence.scenes.at(-1)?.credits).toContain(`IMAGE: ${media.credit}`);
    }
    expect(sequence.scenes.at(-3)?.text).toContain('めっちゃ楽しみ');
    expect(sequence.scenes.at(-2)?.type).toBe('source');
    expect(sequence.scenes.at(-1)?.type).toBe('outro');
    const ids = sequence.scenes.map((scene) => scene.id);
    for (const id of Object.keys(article.video?.scenes ?? {})) expect(ids).toContain(id);
    for (const scene of sequence.scenes) {
      if (scene.reveal) {
        expect(scene.durationInFrames - scene.reveal.revealFrames).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
