import { describe, expect, it } from 'vitest';
import type { ArticleVideoInput } from '../lib/content/article';
import { hashtag, postCopy, postTitle } from '../lib/video/post-copy';

const article: ArticleVideoInput = {
  slug: 'a-session',
  title: 'EXTRA SAVIOR WORLDに3曲。解禁当日に踏んできた',
  shortTitle: 'ESWに3曲',
  dek: '3曲が9月3日から。その夜、踏んできた。',
  summary: 'DDRチーム公式は3曲を追加すると告知した。',
  category: 'CHARTS',
  tags: ['EXTRA SAVIOR WORLD', 'DDR WORLD', '譜面'],
  importance: 'normal',
  publishedAt: '2026-09-03T23:00:00+09:00',
  news: 'x',
  context: 'y',
  playerImpact: 'z',
  primarySource: { publisher: 'DDRチーム【公式】', title: '楽曲追加', url: 'https://x.com/DDR_573/status/1' },
  sources: [
    { publisher: 'DDRチーム【公式】', title: '楽曲追加', url: 'https://x.com/DDR_573/status/1' },
    { publisher: 'MONO DDR', title: 'リザルト', url: 'https://x.com/MONO_DDR/status/2' },
  ],
  figures: [],
  heroImage: { src: 'images/hero.jpg', alt: 'hero', credit: '© Konami Arcade Games — @DDR_573 の告知画像より' },
  media: [
    { src: 'images/hero.jpg', alt: 'hero', credit: '© Konami Arcade Games — @DDR_573 の告知画像より' },
    { src: 'images/r.jpg', alt: 'r', credit: 'MONO DDR' },
  ],
  bgm: { src: 'audio/bgm/x.mp3', credit: '"Getting it Done" Kevin MacLeod (incompetech.com) · CC BY 4.0', gain: 0.4 },
};

describe('post copy', () => {
  it('turns tags into hashtags the platforms accept', () => {
    expect(hashtag('EXTRA SAVIOR WORLD')).toBe('#EXTRASAVIORWORLD');
    expect(hashtag('譜面')).toBe('#譜面');
    expect(hashtag('DDR WORLD')).toBe('#DDRWORLD');
    expect(hashtag('!!!')).toBe('');
  });

  it('keeps a title inside the platform limit', () => {
    expect(postTitle(article)).toBe(article.title);
    expect(postTitle({ title: 'x'.repeat(120), shortTitle: 'short' })).toBe('short');
    expect(postTitle({ title: 'x'.repeat(120) })).toHaveLength(100);
  });

  it('writes a description with the link, every source, every credit and the licence lines', () => {
    const copy = postCopy(article, 'https://stepwire.vercel.app/article/a-session');
    expect(copy.description).toContain('記事: https://stepwire.vercel.app/article/a-session');
    expect(copy.description).toContain('https://x.com/DDR_573/status/1');
    expect(copy.description).toContain('https://x.com/MONO_DDR/status/2');
    // Each credit once, even when the hero is also in media.
    expect(copy.description.match(/Konami Arcade Games/g)).toHaveLength(1);
    expect(copy.description).toContain('MONO DDR');
    // The music credit in incompetech's own three-line form.
    expect(copy.description).toContain('"Getting it Done" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttps://creativecommons.org/licenses/by/4.0/');
    expect(copy.description).not.toContain('· CC BY 4.0');
    expect(copy.description.endsWith(copy.hashtags)).toBe(true);
    expect(copy.hashtags).toBe('#DDR #DanceDanceRevolution #STEPWIRE #EXTRASAVIORWORLD #DDRWORLD #譜面');
  });

  it('opens with the dek, or the summary when there is none', () => {
    expect(postCopy(article, 'u').description.startsWith(article.dek!)).toBe(true);
    const { dek: _dek, ...noDek } = article;
    expect(postCopy(noDek, 'u').description.startsWith(article.summary)).toBe(true);
  });
});
