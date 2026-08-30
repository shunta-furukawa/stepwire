import { describe, expect, it } from 'vitest';
import { normalizeTitle, normalizeUrl } from '../lib/news/url';

describe('normalizeUrl', () => {
  it('strips tracking parameters but keeps meaningful ones', () => {
    expect(
      normalizeUrl('https://example.com/post?id=7&utm_source=rss&utm_campaign=feed&fbclid=xyz'),
    ).toBe('https://example.com/post?id=7');
  });

  it('drops www, the fragment and a trailing slash', () => {
    expect(normalizeUrl('https://www.example.com/post/#section')).toBe(
      'https://example.com/post',
    );
  });

  it('treats http and https as the same document', () => {
    expect(normalizeUrl('http://example.com/post')).toBe(normalizeUrl('https://example.com/post'));
  });

  it('sorts remaining query parameters so ordering cannot create a duplicate', () => {
    expect(normalizeUrl('https://example.com/p?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/p?a=1&b=2'),
    );
  });

  it('lowercases the host but preserves path case', () => {
    expect(normalizeUrl('https://Example.COM/Path/To/Item')).toBe(
      'https://example.com/Path/To/Item',
    );
  });

  it('keeps a bare origin intact rather than stripping its slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('returns unparseable input unchanged instead of throwing', () => {
    expect(normalizeUrl('  not a url  ')).toBe('not a url');
    expect(normalizeUrl('mailto:someone@example.com')).toBe('mailto:someone@example.com');
  });
});

describe('normalizeTitle', () => {
  it('ignores punctuation, case and curly quotes', () => {
    expect(normalizeTitle('DDR WORLD: “Summer Update” announced!')).toBe(
      normalizeTitle('ddr world summer update announced'),
    );
  });

  it('collapses whitespace', () => {
    expect(normalizeTitle('  a   b  ')).toBe('a b');
  });
});
