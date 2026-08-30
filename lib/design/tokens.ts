/**
 * STEPWIRE brand tokens — the single source of truth for the visual system.
 *
 * These values are consumed by two very different renderers:
 *   1. The website, through the CSS custom properties declared in
 *      `app/globals.css` (Tailwind v4 `@theme`).
 *   2. The Remotion video compositions, which use inline styles and therefore
 *      import this module directly.
 *
 * `tests/tokens.test.ts` asserts that `app/globals.css` and this module stay in
 * sync, so a token can never drift between web and video.
 */

/** Monochrome-first palette. Accents are reserved, never decorative. */
export const color = {
  /** Primary text / primary surface in dark contexts. */
  ink: '#0B0B0C',
  /** One step up from `ink`, used for panels on black. */
  ink80: '#17171A',
  paper: '#FFFFFF',
  /** Page background. Warm off-white keeps long reads comfortable. */
  offWhite: '#F3F2EE',
  gray100: '#E4E3DE',
  gray300: '#C2C1BB',
  /**
   * `gray500` clears AA only against a dark ground (5.61:1 on ink); on a light
   * ground it reaches 3.13:1, so light surfaces use `gray700` (6.67:1) for
   * secondary text. The pairing is deliberate, not interchangeable.
   */
  gray500: '#8A8983',
  gray700: '#565550',
  /**
   * Signal. Used ONLY for breaking / high-importance news and for the live
   * "wire" indicator. Never as a background for body text.
   *
   * Two tones, because no single red can clear WCAG AA against both a
   * near-white and a near-black ground: `signal` is tuned for light surfaces
   * (4.99:1 on offWhite, and 5.59:1 for white text sitting on it), and
   * `signalOnDark` for the inverted ones (5.72:1 on ink). Pick by ground, not
   * by taste.
   */
  signal: '#C62B14',
  signalOnDark: '#F2543A',
  /**
   * Wire. Used ONLY for chart/BPM/difficulty data readouts — the DDR-derived
   * numeric information the brand treats as a distinct content class.
   */
  wire: '#0B6BD6',
} as const;

export const font = {
  /**
   * Display + UI.
   *
   * Latin faces are listed first so Latin glyphs keep the tight, neutral
   * grotesque the wordmark is built on; the Japanese faces that follow pick up
   * the CJK glyphs the Latin faces do not carry. That ordering is the whole
   * trick to mixed-script type on the web.
   *
   * Still a system stack on purpose: it removes a network dependency from the
   * web build. The video render loads Noto Sans JP explicitly instead, because
   * headless Chrome cannot be assumed to carry a CJK face.
   */
  display:
    "'Helvetica Neue', Helvetica, Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic Medium', 'Yu Gothic', Meiryo, 'Noto Sans JP', ui-sans-serif, system-ui, sans-serif",
  /**
   * Long-form article body. Mincho is the Japanese editorial register, and it
   * keeps the display/body contrast that the Latin serif gave the design.
   */
  body:
    "'Iowan Old Style', Charter, Georgia, 'Hiragino Mincho ProN', 'Hiragino Mincho Pro', 'Yu Mincho', YuMincho, 'Noto Serif JP', ui-serif, serif",
  /** Metadata, timestamps, source lines, data readouts — the "wire" voice. */
  mono:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'Hiragino Sans', 'Yu Gothic', monospace",
} as const;

/** Modular type scale, in px. Video scales these up via `videoScale`. */
export const fontSize = {
  micro: 11,
  small: 13,
  base: 16,
  lead: 19,
  h4: 22,
  h3: 28,
  h2: 38,
  h1: 54,
  display: 88,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  bold: 700,
  black: 900,
} as const;

/** Tracking in em. Display type is set tight; small caps are set loose. */
export const tracking = {
  /** The wordmark and other all-Latin display type. */
  display: -0.03,
  /**
   * Headlines and body copy. Japanese fills its em box, so the negative
   * tracking that flatters a Latin grotesque makes CJK look jammed — and
   * `font-feature-settings: 'palt'` has already tightened it once.
   */
  headline: -0.005,
  tight: -0.015,
  normal: 0,
  wide: 0.08,
  wider: 0.18,
} as const;

export const leading = {
  /** All-Latin display type — the wordmark. Sub-1 leading only works there. */
  display: 0.92,
  /**
   * Headlines. A CJK glyph fills its full em box, so anything under about 1.1
   * makes consecutive lines touch.
   */
  headline: 1.18,
  tight: 1.35,
  snug: 1.45,
  // Japanese body text needs more air between lines than Latin does; 1.8 is
  // comfortable for mincho at reading sizes without loosening the column.
  normal: 1.8,
} as const;

/** 4px base spacing scale, in px. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  '2xl': 64,
  '3xl': 96,
} as const;

export const border = {
  hairline: 1,
  rule: 2,
  heavy: 4,
  /** STEPWIRE uses square corners everywhere. Kept as a token so it is a
   *  deliberate brand decision rather than an accident. */
  radius: 0,
} as const;

/**
 * Motion constants. Durations are in milliseconds for the web and are converted
 * to frames by `lib/video/timing.ts` for Remotion, so a transition feels the
 * same on both surfaces.
 */
export const motion = {
  instant: 120,
  quick: 220,
  base: 380,
  slow: 640,
  /** Standard easing, expressed as a cubic-bezier control-point tuple. */
  ease: [0.22, 1, 0.36, 1] as const,
  easeCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

/**
 * Video-only constants. Kept beside the web tokens on purpose: the video system
 * is a rendering target of the same brand, not a separate design.
 */
export const video = {
  fps: 30,
  /** Video type is roughly 3x web type at 1080p-class canvases. */
  scale: 3,
  formats: {
    STEPWIRE_SHORT: { width: 1080, height: 1920 },
    STEPWIRE_NEWS: { width: 1920, height: 1080 },
  },
} as const;

export const tokens = {
  color,
  font,
  fontSize,
  fontWeight,
  tracking,
  leading,
  space,
  border,
  motion,
  video,
} as const;

export type Tokens = typeof tokens;
