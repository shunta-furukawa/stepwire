import { describe, expect, it } from 'vitest';
import { parseTurnPrefix } from '../lib/content/dialogue';
import { parseMarkdown, toPlainText } from '../lib/content/markdown';
import { blink, bob, wireFace } from '../lib/design/wire';

describe('turns', () => {
  it('reads the speaker and the mood off the head of a paragraph', () => {
    expect(parseTurnPrefix('WIRE(grin): やったね')).toEqual({ speaker: 'WIRE', mood: 'grin', rest: 'やったね' });
    expect(parseTurnPrefix('MONO: はい。')).toEqual({ speaker: 'MONO', mood: 'neutral', rest: 'はい。' });
    expect(parseTurnPrefix('MONO： 全角のコロンでも')).toEqual({ speaker: 'MONO', mood: 'neutral', rest: '全角のコロンでも' });
    expect(parseTurnPrefix('WIREはこう言った: 違う')).toBeNull();
    expect(parseTurnPrefix('A paragraph.')).toBeNull();
  });

  it('refuses a mood it does not have, and a mood on MONO', () => {
    // A typo would otherwise fall back to a face the writer did not choose.
    expect(() => parseTurnPrefix('WIRE(happy): ...')).toThrow(/Unknown mood/);
    expect(() => parseTurnPrefix('MONO(grin): ...')).toThrow(/MONO has no moods/);
  });

  it('parses turns as their own block, with citations intact', () => {
    const blocks = parseMarkdown(
      ['WIRE: 3曲ともEXPERTだね。[^2]', '', 'MONO: はい、', 'そうです。', '', 'A plain paragraph.'].join('\n'),
    );
    expect(blocks.map((block) => block.type)).toEqual(['turn', 'turn', 'paragraph']);
    const first = blocks[0]!;
    expect(first.type === 'turn' && first.speaker).toBe('WIRE');
    expect(first.type === 'turn' && first.children.some((node) => node.type === 'citation')).toBe(true);
    // A wrapped turn is one turn.
    const second = blocks[1]!;
    expect(second.type === 'turn' && second.speaker).toBe('MONO');
  });

  it('keeps the speaker in plain text, where there is no face to show', () => {
    const blocks = parseMarkdown('WIRE(wink): それは僕も同意見。');
    expect(toPlainText(blocks)).toBe('WIRE: それは僕も同意見。');
  });
});

describe("WIRE's face", () => {
  it('changes only the eyes and the mouth between moods', () => {
    const neutral = wireFace('neutral');
    for (const mood of ['grin', 'surprise', 'think', 'wink'] as const) {
      expect(wireFace(mood).head).toEqual(neutral.head);
      expect(wireFace(mood).antenna).toEqual(neutral.antenna);
    }
    expect(wireFace('grin').eyes.map((eye) => eye.shape)).toEqual(['arc', 'arc']);
    expect(wireFace('wink').eyes.map((eye) => eye.shape)).toEqual(['shut', 'open']);
    expect(wireFace('surprise').mouth.kind).toBe('round');
    expect(wireFace('think').brow).toBeDefined();
  });

  it('blinks and floats as a function of time, and nothing else', () => {
    expect(blink(1.0)).toBe(blink(1.0));
    expect(bob(2.5)).toEqual(bob(2.5));
    // Open almost all the time, shut at the bottom of a blink.
    const samples = Array.from({ length: 400 }, (_, i) => blink(i / 30));
    expect(samples.every((open) => open >= 0 && open <= 1)).toBe(true);
    expect(samples.filter((open) => open > 0.95).length).toBeGreaterThan(samples.length * 0.9);
    expect(Math.min(...samples)).toBeLessThan(0.1);
  });
});
