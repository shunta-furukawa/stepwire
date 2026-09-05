import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { color, difficulty, flareEx, fontSize, motion, space, video } from '../lib/design/tokens';

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
      'color-surface': color.surface,
      'color-raised': color.raised,
      'color-deep': color.deep,
      'color-fg': color.fg,
      'color-muted': color.muted,
      'color-faint': color.faint,
      'color-line': color.line,
      'color-line-strong': color.lineStrong,
      'color-accent': color.accent,
      'color-accent-hot': color.accentHot,
      'color-on-accent': color.onAccent,
    };

    // Every token, not just the ones someone remembered to list here.
    expect(Object.keys(expected).length).toBe(Object.keys(color).length);

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

  it('keeps the ramp monochrome, with the accent as the only hue', () => {
    const monochrome = [
      color.surface,
      color.raised,
      color.deep,
      color.fg,
      color.muted,
      color.faint,
      color.line,
      color.lineStrong,
    ];

    // "Monochrome" as a measurable claim, not a description: a neutral has no
    // meaningful spread between its channels. This is what stops a stray tinted
    // grey from creeping into a palette whose whole point is greyscale + lime.
    for (const hex of monochrome) {
      const n = Number.parseInt(hex.slice(1), 16);
      const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(Math.max(...channels) - Math.min(...channels), hex).toBeLessThanOrEqual(10);
    }

    expect(monochrome).not.toContain(color.accent);
    expect(monochrome).not.toContain(color.accentHot);
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

  it('meets AA for every text tone on the page ground', () => {
    expect(contrast(color.fg, color.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.muted, color.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.faint, color.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('meets AA for every text tone on a raised card', () => {
    // The stricter of the two grounds — a card is lighter than the page, so a
    // tone that only passed on `surface` would fail inside a figure or a panel.
    expect(contrast(color.fg, color.raised)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.muted, color.raised)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.faint, color.raised)).toBeGreaterThanOrEqual(AA);
  });

  it('meets AA for the badge text on every difficulty colour', () => {
    // The five game colours are the one exception to the single hue, and the
    // exception does not extend to being unreadable: the badge prints
    // `onAccent` on each, and each has to carry it.
    for (const [name, hex] of Object.entries(difficulty)) {
      expect(contrast(color.onAccent, hex), name).toBeGreaterThanOrEqual(AA);
    }
    // Five distinct hues, none of them the accent: a quotation, not a theme.
    expect(new Set(Object.values(difficulty)).size).toBe(5);
    expect(Object.values(difficulty)).not.toContain(color.accent);
  });

  it('meets AA for the label text on every stop of the FLARE EX rainbow', () => {
    // The rainbow is a gradient, so a letter can land on any stop; each has
    // to carry `onAccent` on its own.
    for (const hex of flareEx) {
      expect(contrast(color.onAccent, hex), hex).toBeGreaterThanOrEqual(AA);
    }
    expect(new Set(flareEx).size).toBe(flareEx.length);
    expect(flareEx).not.toContain(color.accent);
  });

  it('meets AA for every text tone on the deepest block', () => {
    expect(contrast(color.fg, color.deep)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.muted, color.deep)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.faint, color.deep)).toBeGreaterThanOrEqual(AA);
  });

  it('meets AA for the accent as text and as a fill', () => {
    for (const ground of [color.surface, color.raised, color.deep]) {
      expect(contrast(color.accent, ground)).toBeGreaterThanOrEqual(AA);
      expect(contrast(color.accentHot, ground)).toBeGreaterThanOrEqual(AA);
    }
    // A chip is text ON the accent, which is the pairing that usually fails.
    expect(contrast(color.onAccent, color.accent)).toBeGreaterThanOrEqual(AA);
    expect(contrast(color.onAccent, color.accentHot)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the lit accent brighter than the accent it has to out-shout', () => {
    expect(luminance(color.accentHot)).toBeGreaterThan(luminance(color.accent));
  });

  it('keeps the structural rule visible without becoming text', () => {
    // A 3:1 non-text minimum (WCAG 1.4.11) — a keyline nobody can see is not a
    // keyline, and this design is built almost entirely out of them.
    expect(contrast(color.lineStrong, color.surface)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(color.line, color.surface)).toBeGreaterThan(1);
  });
});
