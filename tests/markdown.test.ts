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

describe('toSentences', () => {
  it('breaks Japanese on its own full stop, which carries no trailing space', () => {
    // The bug this pins: a rule requiring whitespace after the terminator never
    // fires on Japanese, so a whole paragraph arrived as one "sentence" and the
    // video card packer had nothing to split on.
    expect(toSentences('短い一文です。次の文があります。')).toEqual([
      '短い一文です。',
      '次の文があります。',
    ]);
  });

  it('breaks on the Japanese question and exclamation marks too', () => {
    expect(toSentences('本当ですか？はい！')).toEqual(['本当ですか？', 'はい！']);
  });

  it('keeps a closing bracket with the sentence it closes', () => {
    expect(toSentences('「これは引用です。」と彼は言った。')).toEqual([
      '「これは引用です。」',
      'と彼は言った。',
    ]);
    expect(toSentences('（注記です。）続き。')).toEqual(['（注記です。）', '続き。']);
  });

  it('still requires a space after a Latin full stop, so a decimal survives', () => {
    expect(toSentences('BPM 300.5 is the peak. It is fast.')).toEqual([
      'BPM 300.5 is the peak.',
      'It is fast.',
    ]);
  });

  it('splits a mixed-script paragraph on both terminators', () => {
    expect(toSentences('DDR WORLD が更新された。The patch is live.')).toEqual([
      'DDR WORLD が更新された。',
      'The patch is live.',
    ]);
  });
});

describe('image blocks', () => {
  it('reads a picture on its own line and keeps it out of the plain text', async () => {
    const { parseMarkdown, toPlainText } = await import('../lib/content/markdown');
    const blocks = parseMarkdown('Before.\n\n![a result](images/articles/x/result.jpg)\n\nAfter.');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'image', 'paragraph']);
    const image = blocks[1]!;
    if (image.type !== 'image') throw new Error('expected an image block');
    expect(image.src).toBe('images/articles/x/result.jpg');
    expect(image.alt).toBe('a result');
    // The words of the section are the words; a picture adds none.
    expect(toPlainText(blocks)).toBe('Before.\n\nAfter.');
  });
});
