import { describe, expect, it } from 'vitest';
import { toBreakUnits, wrapText } from '../lib/video/canvas/text';

/**
 * A canvas has no line breaking, so the video's browser renderer has to do it.
 * Measurement is injected, which lets the rules be tested as data — no canvas,
 * no fonts, no rendering.
 *
 * The fake measure counts a CJK character as 2 and everything else as 1, which
 * is `visualLength`'s weighting and close enough to real glyph widths for the
 * rules to be exercised honestly.
 */
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿＀-￯]/;
const measure = (text: string) =>
  [...text].reduce((total, char) => total + (CJK.test(char) ? 2 : 1), 0);

describe('toBreakUnits', () => {
  it('keeps a Latin word whole and splits Japanese per character', () => {
    expect(toBreakUnits('速い譜面 is fast')).toEqual([
      '速', 'い', '譜', '面 ', 'is ', 'fast',
    ]);
  });

  it('attaches a space to the unit before it, so no line starts with one', () => {
    expect(toBreakUnits('DDR WORLD')).toEqual(['DDR ', 'WORLD']);
    // Including when the space follows a CJK character.
    expect(toBreakUnits('譜面 A')).toEqual(['譜', '面 ', 'A']);
  });

  it('keeps an explicit newline as its own unit', () => {
    expect(toBreakUnits('あ\nい')).toEqual(['あ', '\n', 'い']);
  });
});

describe('wrapText', () => {
  it('breaks Japanese at the character that overflows', () => {
    expect(wrapText('あいうえおかきくけこ', 10, measure)).toEqual([
      'あいうえお',
      'かきくけこ',
    ]);
  });

  it('never breaks a Latin word in half', () => {
    expect(wrapText('the quick brown fox', 10, measure)).toEqual([
      'the quick',
      'brown fox',
    ]);
  });

  it('runs a line long rather than start the next one with 。', () => {
    // Breaking strictly at the limit would put 。 alone at the head of line two,
    // which is the single most obvious way Japanese typesetting looks broken.
    const lines = wrapText('あいうえお。かきくけこ', 10, measure);
    expect(lines[0]).toBe('あいうえお。');
    expect(lines[1]).toBe('かきくけこ');
  });

  it('applies the rule to a terminator that carries a trailing space', () => {
    // The card packer joins two sentences with a space, so the break unit is
    // `。 ` rather than `。`. Testing the whole unit against the kinsoku set
    // misses it, and 。 lands at the head of the next line.
    const lines = wrapText('あいうえお。 かきくけこ', 10, measure);
    expect(lines[0]).toBe('あいうえお。');
    expect(lines[1]).toBe('かきくけこ');
  });

  it('applies the same rule to a closing bracket and a small kana', () => {
    expect(wrapText('あいうえお」かき', 10, measure)[0]).toBe('あいうえお」');
    expect(wrapText('あいうえおっかき', 10, measure)[0]).toBe('あいうえおっ');
  });

  it('carries an opening bracket down rather than leave it at a line end', () => {
    // 「 may not end a line, so it moves to the next one with what follows it.
    const lines = wrapText('あいうえ「おかきく', 10, measure);
    expect(lines[0]).toBe('あいうえ');
    expect(lines[1]!.startsWith('「')).toBe(true);
  });

  it('honours an explicit newline', () => {
    expect(wrapText('あい\nうえ', 100, measure)).toEqual(['あい', 'うえ']);
  });

  it('returns one line when everything fits', () => {
    expect(wrapText('短い', 100, measure)).toEqual(['短い']);
  });

  it('never returns an empty trailing line for text ending in a space', () => {
    expect(wrapText('a b ', 100, measure)).toEqual(['a b']);
  });

  it('wraps mixed script without splitting the Latin run', () => {
    expect(wrapText('最高BPMは300です', 8, measure)).toEqual([
      '最高BPM',
      'は300で',
      'す',
    ]);
  });
});
