import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { color, fontSize, motion, space, video } from '../lib/design/tokens';
import { SCALE, type } from '../video/styles/theme';

/**
 * The guard that keeps one brand across two renderers.
 *
 * The website reads its palette and type scale from CSS custom properties in
 * `app/globals.css`; the Remotion compositions read theirs from
 * `lib/design/tokens.ts`. Nothing at runtime forces the two to agree, so this
 * test does: change a token in one place without the other and CI fails.
 */

const GLOBALS = path.join(process.cwd(), 'app', 'globals.css');

async function themeVariables(): Promise<Map<string, string>> {
  const css = await readFile(GLOBALS, 'utf8');
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
  if (!block) throw new Error('no @theme block found in app/globals.css');

  const variables = new Map<string, string>();
  for (const line of block[1]!.split(';')) {
    const match = /--([a-z0-9-]+)\s*:\s*([\s\S]+)/i.exec(line.trim());
    if (match) variables.set(match[1]!, match[2]!.trim().replace(/\s+/g, ' '));
  }
  return variables;
}

describe('design tokens', () => {
  it('mirrors every colour into the Tailwind theme', async () => {
    const variables = await themeVariables();
    const expected: Record<string, string> = {
      'color-ink': color.ink,
      'color-ink80': color.ink80,
      'color-paper': color.paper,
      'color-off-white': color.offWhite,
      'color-gray100': color.gray100,
      'color-gray300': color.gray300,
      'color-gray500': color.gray500,
      'color-gray700': color.gray700,
      'color-signal': color.signal,
      'color-signal-on-dark': color.signalOnDark,
      'color-wire': color.wire,
    };

    for (const [name, value] of Object.entries(expected)) {
      expect(variables.get(name)?.toLowerCase(), `--${name}`).toBe(value.toLowerCase());
    }
  });

  it('mirrors the type scale into the Tailwind theme', async () => {
    const variables = await themeVariables();
    for (const [name, value] of Object.entries(fontSize)) {
      expect(variables.get(`text-${name}`), `--text-${name}`).toBe(`${value}px`);
    }
  });

  it('mirrors the spacing scale into the Tailwind theme', async () => {
    const variables = await themeVariables();
    for (const [name, value] of Object.entries(space)) {
      expect(variables.get(`spacing-${name}`), `--spacing-${name}`).toBe(`${value}px`);
    }
  });

  it('mirrors the brand easing curve into the Tailwind theme', async () => {
    const variables = await themeVariables();
    expect(variables.get('ease-brand')).toBe(motion.easeCss);
  });

  it('derives the video type scale from the same tokens', () => {
    expect(type.h1).toBe(fontSize.h1 * SCALE);
    expect(type.display).toBe(fontSize.display * SCALE);
    expect(type.micro).toBe(fontSize.micro * SCALE);
  });

  it('keeps the accents reserved and distinct from the monochrome ramp', () => {
    const monochrome = [
      color.ink,
      color.ink80,
      color.paper,
      color.offWhite,
      color.gray100,
      color.gray300,
      color.gray500,
      color.gray700,
    ];
    expect(monochrome).not.toContain(color.signal);
    expect(monochrome).not.toContain(color.wire);
    expect(color.signal).not.toBe(color.wire);
  });

  it('pins the video formats the brief specifies', () => {
    expect(video.fps).toBe(30);
    expect(video.formats.STEPWIRE_SHORT).toEqual({ width: 1080, height: 1920 });
    expect(video.formats.STEPWIRE_NEWS).toEqual({ width: 1920, height: 1080 });
  });
});

/**
 * Contrast is a product requirement, not a review checklist item, so it is
 * asserted. No single accent can clear AA against both a near-white and a
 * near-black ground, which is why there are two signal tones — these tests are
 * what stop someone "simplifying" them back into one.
 */
describe('colour contrast (WCAG 2.1)', () => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };

  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  const AA = 4.5;

  it('meets AA for body and secondary text on the light ground', () => {
    expect(contrast(color.ink, color.offWhite)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.gray700, color.offWhite)).toBeGreaterThanOrEqual(AA);
  });

  it('meets AA for text on the inverted ground', () => {
    expect(contrast(color.paper, color.ink)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.gray300, color.ink)).toBeGreaterThanOrEqual(AA);
    // gray500 is the on-dark secondary tone; it is not usable on light.
    expect(contrast(color.gray500, color.ink)).toBeGreaterThanOrEqual(AA);
  });

  it('meets AA for each signal tone against the ground it is meant for', () => {
    expect(contrast(color.signal, color.offWhite)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.signal, color.paper)).toBeGreaterThanOrEqual(AA);
    // The importance flag is white text on a signal fill.
    expect(contrast(color.paper, color.signal)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.signalOnDark, color.ink)).toBeGreaterThanOrEqual(AA);
  });

  it('meets AA for the data accent', () => {
    expect(contrast(color.wire, color.paper)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.wire, color.offWhite)).toBeGreaterThanOrEqual(AA);
  });

});
