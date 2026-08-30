import { describe, expect, it } from 'vitest';
import {
  collectCitations,
  joinWrappedLines,
  parseInline,
  parseMarkdown,
  toPlainText,
  toSentences,
} from '../lib/content/markdown';

describe('parseInline', () => {
  it('parses bold, italic, code and links', () => {
    const nodes = parseInline('a **bold** and *italic* and `code` and [link](https://example.com)');
    expect(nodes.map((node) => node.type)).toEqual([
      'text',
      'strong',
      'text',
      'em',
      'text',
      'code',
      'text',
      'link',
    ]);
  });

  it('parses a citation marker into a typed node', () => {
    const nodes = parseInline('A claim.[^2]');
    expect(nodes[1]).toEqual({ type: 'citation', index: 2 });
  });

  it('keeps the link href and label separate', () => {
    const nodes = parseInline('[STEPWIRE](https://example.com/x)');
    expect(nodes[0]).toMatchObject({ type: 'link', href: 'https://example.com/x' });
  });

  it('leaves plain text untouched', () => {
    expect(parseInline('just words')).toEqual([{ type: 'text', value: 'just words' }]);
  });

  it('does not emit empty text nodes', () => {
    const nodes = parseInline('**bold**');
    expect(nodes).toHaveLength(1);
  });
});

/**
 * A line break inside a paragraph is a formatting artifact of the .mdx file.
 * In Latin text it stands for a word space; in Japanese it stands for nothing,
 * and inserting a space leaves a visible gap after every 、 that happened to
 * land at the end of a source line.
 */
describe('joinWrappedLines', () => {
  it('joins Latin lines with a space', () => {
    expect(joinWrappedLines(['one line', 'continued here'])).toBe('one line continued here');
  });

  it('joins Japanese lines with nothing', () => {
    expect(joinWrappedLines(['動画システムを、', '報道と誤認されうるものを公開せずに'])).toBe(
      '動画システムを、報道と誤認されうるものを公開せずに',
    );
  });

  it('adds no space where Latin meets Japanese across a break', () => {
    // "STEPWIRE の" would be wrong; the particle attaches to the word.
    expect(joinWrappedLines(['STEPWIRE', 'のレイアウト'])).toBe('STEPWIREのレイアウト');
    expect(joinWrappedLines(['架空の', 'DDR WORLD'])).toBe('架空のDDR WORLD');
  });

  it('handles a single line and trims', () => {
    expect(joinWrappedLines(['  only  '])).toBe('only');
  });
});

describe('parseMarkdown', () => {
  it('joins wrapped lines into one paragraph', () => {
    const blocks = parseMarkdown('one line\ncontinued here\n\nsecond paragraph');
    expect(blocks).toHaveLength(2);
    expect(toPlainText([blocks[0]!])).toBe('one line continued here');
  });

  it('does not insert spaces into wrapped Japanese prose', () => {
    const blocks = parseMarkdown('この記事はサンプルです。STEPWIREのレイアウト、\n動画システムを開発するために置かれています。');
    expect(toPlainText(blocks)).toBe(
      'この記事はサンプルです。STEPWIREのレイアウト、動画システムを開発するために置かれています。',
    );
  });

  it('parses unordered and ordered lists', () => {
    const blocks = parseMarkdown('- one\n- two\n\n1. first\n2. second');
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: true });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('parses headings, quotes and rules', () => {
    const blocks = parseMarkdown('### A heading\n\n> quoted text\n\n---');
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'blockquote', 'rule']);
  });

  it('handles CRLF input', () => {
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2);
  });

  it('produces nothing for empty input', () => {
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
  });
});

describe('collectCitations', () => {
  it('finds citations in document order, including inside emphasis and lists', () => {
    const blocks = parseMarkdown('A claim.[^1] **Another.[^3]**\n\n- listed[^2]');
    expect(collectCitations(blocks)).toEqual([1, 3, 2]);
  });
});

describe('toPlainText', () => {
  it('flattens formatting to text for the video projection', () => {
    const blocks = parseMarkdown('A **bold** claim with a [link](https://example.com).');
    expect(toPlainText(blocks)).toBe('A bold claim with a link.');
  });

  it('drops citation markers, which are a web-reading affordance', () => {
    const blocks = parseMarkdown('A sourced claim.[^1]');
    expect(toPlainText(blocks)).toBe('A sourced claim.');
  });

  it('separates blocks with blank lines and skips rules', () => {
    const blocks = parseMarkdown('one\n\n---\n\ntwo');
    expect(toPlainText(blocks)).toBe('one\n\ntwo');
  });
});

describe('toSentences', () => {
  it('splits on sentence boundaries', () => {
    expect(toSentences('One. Two! Three? Four')).toEqual(['One.', 'Two!', 'Three?', 'Four']);
  });

  it('splits on paragraph breaks', () => {
    expect(toSentences('One\n\nTwo')).toEqual(['One', 'Two']);
  });

  it('drops empty fragments', () => {
    expect(toSentences('  ')).toEqual([]);
  });
});
