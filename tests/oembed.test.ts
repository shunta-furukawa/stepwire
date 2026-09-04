import { describe, expect, it } from 'vitest';
import { X_POST_URL, dateFromOembedHtml, parseOembed, textFromOembedHtml } from '../lib/news/oembed';

/** The shape X actually returns, trimmed. */
const html =
  '<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">【EXTRA SAVIOR WORLD】<br>9月3日(木)10:00(JST)より、「EXTRA SAVIOR WORLD」に「The 7th MUSIC CREATOR AUDITION」の楽曲を追加！<br>#DDR#DDR_WORLD#BEMANI<a href="https://t.co/jWMRPfzkSd">https://t.co/jWMRPfzkSd</a> <a href="https://t.co/33yhOiNz4g">pic.twitter.com/33yhOiNz4g</a></p>&mdash; DDRチーム【公式】 (@DDR_573) <a href="https://twitter.com/DDR_573/status/2094683017671520571?ref_src=twsrc%5Etfw">September 1, 2026</a></blockquote>';

describe('X post URLs', () => {
  it('accepts x.com and twitter.com, with a query string', () => {
    for (const url of [
      'https://x.com/mono_ddr/status/2095502936768221669?s=46&t=abc',
      'https://twitter.com/DDR_573/status/2094683017671520571',
      'https://www.x.com/DDR_573/status/2094683017671520571',
    ]) {
      expect(X_POST_URL.test(url)).toBe(true);
    }
    expect(X_POST_URL.test('https://x.com/mono_ddr')).toBe(false);
    expect(X_POST_URL.test('https://example.com/x.com/a/status/1')).toBe(false);
  });
});

describe('the embed', () => {
  it('yields the post text with its line breaks and without the picture link', () => {
    const text = textFromOembedHtml(html);
    expect(text.split('\n')).toEqual([
      '【EXTRA SAVIOR WORLD】',
      '9月3日(木)10:00(JST)より、「EXTRA SAVIOR WORLD」に「The 7th MUSIC CREATOR AUDITION」の楽曲を追加！',
      '#DDR#DDR_WORLD#BEMANI https://t.co/jWMRPfzkSd',
    ]);
    expect(text).not.toContain('pic.twitter.com');
    // The author line after the paragraph is the embed's, not the post's.
    expect(text).not.toContain('DDRチーム');
  });

  it('reads the date the embed prints', () => {
    expect(dateFromOembedHtml(html)).toBe('2026-09-01');
    expect(dateFromOembedHtml('<p>no date</p>')).toBeUndefined();
  });

  it('canonicalises the post out of the payload', () => {
    const post = parseOembed({
      url: 'https://twitter.com/DDR_573/status/2094683017671520571',
      author_name: 'DDRチーム【公式】',
      author_url: 'https://twitter.com/DDR_573',
      html,
      provider_name: 'Twitter',
    });
    expect(post.url).toBe('https://x.com/DDR_573/status/2094683017671520571');
    expect(post.handle).toBe('DDR_573');
    expect(post.id).toBe('2094683017671520571');
    expect(post.author).toBe('DDRチーム【公式】');
    expect(post.date).toBe('2026-09-01');
  });

  it('refuses a payload without the fields the draft needs', () => {
    expect(() => parseOembed({ url: 'https://x.com/a/status/1' })).toThrow();
  });
});
