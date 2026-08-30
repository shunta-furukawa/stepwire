import { describe, expect, it } from 'vitest';
import { transcriptSchema, transcriptPath, narrationPublicPath } from '../lib/content/narration';
import { pageCaptions, DEFAULT_PAGING } from '../lib/video/captions';
import { buildSceneSequence } from '../lib/video/scenes';
import { narrationSchema } from '../lib/content/schema';
import type { ArticleVideoInput } from '../lib/content/article';

const caption = (text: string, startMs: number, endMs: number) => ({
  text,
  startMs,
  endMs,
  timestampMs: null,
  confidence: null,
});

describe('narration schema', () => {
  it('accepts a recording under public/audio', () => {
    expect(narrationSchema.parse({ audio: 'audio/take-1.m4a' }).audio).toBe('audio/take-1.m4a');
    expect(narrationSchema.safeParse({ audio: 'audio/take-1.mp3' }).success).toBe(true);
  });

  it('rejects a path outside public/audio or an unsupported container', () => {
    expect(narrationSchema.safeParse({ audio: '../secrets.m4a' }).success).toBe(false);
    expect(narrationSchema.safeParse({ audio: 'audio/take-1.txt' }).success).toBe(false);
  });

  it('finds a transcript by convention rather than configuration', () => {
    expect(transcriptPath('a-slug')).toMatch(/content\/transcripts\/a-slug\.json$/);
  });

  it('serves audio from a rooted public path', () => {
    expect(narrationPublicPath('audio/x.mp3')).toBe('/audio/x.mp3');
    expect(narrationPublicPath('/audio/x.mp3')).toBe('/audio/x.mp3');
  });
});

describe('transcript integrity', () => {
  const base = { version: 1 as const, language: 'ja', durationInSeconds: 10 };

  it('accepts a well-formed transcript', () => {
    expect(
      transcriptSchema.safeParse({ ...base, captions: [caption('はい。', 0, 500)] }).success,
    ).toBe(true);
  });

  it('rejects captions that run past the recording', () => {
    // Silent truncation here would desync every scene after this point.
    const result = transcriptSchema.safeParse({
      ...base,
      captions: [caption('はい。', 0, 500), caption('過ぎている', 9000, 11000)],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('past the 10000ms recording');
  });

  it('rejects captions that are out of order', () => {
    const result = transcriptSchema.safeParse({
      ...base,
      captions: [caption('二番目', 5000, 5500), caption('一番目', 1000, 1500)],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('out of order');
  });

  it('rejects an empty transcript', () => {
    expect(transcriptSchema.safeParse({ ...base, captions: [] }).success).toBe(false);
  });
});

/**
 * `createTikTokStyleCaptions` merged a whole take into one page, because
 * continuous speech has no gaps wide enough to break on. These cases pin the
 * behaviour that replaced it.
 */
describe('caption paging', () => {
  it('breaks a page at the end of a sentence', () => {
    const pages = pageCaptions([
      caption('はい、', 0, 400),
      caption('今日の話です。', 400, 1200),
      caption('次の文です。', 1300, 2000),
    ]);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.text).toBe('はい、今日の話です。');
    expect(pages[1]!.text).toBe('次の文です。');
  });

  it('breaks on a long silence even mid-sentence', () => {
    const pages = pageCaptions([
      caption('ここで', 0, 400),
      caption('間があいて', 2000, 2600),
    ]);
    expect(pages).toHaveLength(2);
  });

  it('breaks a run-on sentence at the length budget', () => {
    // No punctuation and no pauses: the fallback is the only thing that can page.
    const captions = Array.from({ length: 12 }, (_, i) =>
      caption('とても長い話が', i * 500, i * 500 + 450),
    );
    const pages = pageCaptions(captions);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.text.length * 2).toBeLessThanOrEqual(DEFAULT_PAGING.maxVisualLength + 14);
    }
  });

  it('joins Japanese without spaces and Latin with them', () => {
    const [page] = pageCaptions([
      caption('今回は', 0, 400),
      caption('DDR', 400, 700),
      caption('WORLD', 700, 1000),
      caption('の話。', 1000, 1400),
    ]);
    expect(page!.text).toBe('今回はDDR WORLDの話。');
  });

  it('keeps every token with its timing', () => {
    const [page] = pageCaptions([caption('あ', 0, 100), caption('い。', 100, 300)]);
    expect(page!.tokens).toEqual([
      { text: 'あ', fromMs: 0, toMs: 100 },
      { text: 'い。', fromMs: 100, toMs: 300 },
    ]);
  });
});

describe('narrated scene sequence', () => {
  const article: ArticleVideoInput = {
    slug: 'a',
    title: '見出し',
    summary: '要約。',
    category: 'UPDATE',
    importance: 'normal',
    publishedAt: '2026-08-24T09:00:00+09:00',
    news: '本文のニュース。',
    context: '本文のコンテクスト。',
    playerImpact: '本文の影響。',
    figures: [],
    narration: {
      audioSrc: '/audio/take.mp3',
      durationInSeconds: 6,
      language: 'ja',
      speaker: 'MONO DDR',
      captions: [
        caption('はい、今日の話です。', 500, 2000),
        caption('もうひとつあります。', 2200, 4000),
      ],
    },
  };

  it('replaces the derived text sections with the recording', () => {
    const types = buildSceneSequence(article, 'STEPWIRE_SHORT').scenes.map((s) => s.type);
    // The written sections are the article's job; the voice is the video's.
    // Rendering both would say everything twice.
    expect(types).not.toContain('news');
    expect(types).not.toContain('context');
    expect(types).not.toContain('impact');
    expect(types.filter((t) => t === 'narration').length).toBeGreaterThan(0);
  });

  it('still opens with the ident and headline and closes with source and outro', () => {
    const types = buildSceneSequence(article, 'STEPWIRE_SHORT').scenes.map((s) => s.type);
    expect(types[0]).toBe('intro');
    expect(types[1]).toBe('headline');
    expect(types.at(-2)).toBe('source');
    expect(types.at(-1)).toBe('outro');
  });

  it('mounts the audio over exactly the narration span', () => {
    const sequence = buildSceneSequence(article, 'STEPWIRE_SHORT');
    const scenes = sequence.scenes;
    const firstNarration = scenes.findIndex((s) => s.type === 'narration');
    const expectedStart = scenes
      .slice(0, firstNarration)
      .reduce((total, s) => total + s.durationInFrames, 0);

    expect(sequence.narration?.audioSrc).toBe('/audio/take.mp3');
    expect(sequence.narration?.startFrame).toBe(expectedStart);
    expect(sequence.narration?.durationInFrames).toBe(
      scenes.filter((s) => s.type === 'narration').reduce((t, s) => t + s.durationInFrames, 0),
    );
  });

  it('rebases token timings to the start of their page', () => {
    const first = buildSceneSequence(article, 'STEPWIRE_SHORT').scenes.find(
      (s) => s.type === 'narration',
    );
    // A scene highlights the spoken word without knowing where it sits.
    expect(first?.tokens?.[0]?.fromMs).toBe(0);
  });

  it('carries the speaker onto the card', () => {
    const first = buildSceneSequence(article, 'STEPWIRE_SHORT').scenes.find(
      (s) => s.type === 'narration',
    );
    expect(first?.meta).toBe('MONO DDR');
  });

  it('is not cut short by the format budget', () => {
    // Trimming a narrated film would cut the speaker off mid-sentence.
    const long: ArticleVideoInput = {
      ...article,
      narration: {
        ...article.narration!,
        durationInSeconds: 300,
        captions: Array.from({ length: 60 }, (_, i) =>
          caption('話し続けています。', i * 4000, i * 4000 + 3500),
        ),
      },
    };
    const sequence = buildSceneSequence(long, 'STEPWIRE_SHORT');
    expect(sequence.durationInFrames / sequence.fps).toBeGreaterThan(45);
  });

  it('falls back to the silent derived form without narration', () => {
    const silent = { ...article };
    delete silent.narration;
    const types = buildSceneSequence(silent, 'STEPWIRE_SHORT').scenes.map((s) => s.type);
    expect(types).toContain('news');
    expect(types).not.toContain('narration');
  });
});
