/**
 * STEPWIRE brand tokens — the single source of truth for the visual system.
 *
 * These values are consumed by two very different surfaces:
 *   1. The website, through the CSS custom properties declared in
 *      `app/globals.css` (Tailwind v4 `@theme`).
 *   2. The video renderer (`lib/video/canvas/`), which paints a canvas and
 *      therefore imports this module directly.
 *
 * `tests/tokens.test.ts` asserts that `app/globals.css` and this module stay in
 * sync, so a token can never drift between web and video.
 */

/**
 * The palette, sampled from the MONO DDR identity.
 *
 * Black ground, low-poly greyscale, one lime accent — measured off the operator's
 * own banner rather than approximated: the ground is #000000 across two thirds
 * of it, the logo facets sit between #B7B7B7 and #CACACA, and the lime reads
 * #B4DA46 with a lit #E4FF6C in the light streaks.
 *
 * Names describe the ROLE, not the colour. The previous set (`ink`, `paper`,
 * `offWhite`) named the pigment, which stops being honest the moment the ground
 * flips: `bg-ink` meaning "the page" and `text-ink` meaning "the text" cannot
 * both be true. A role name survives a repaint; a pigment name does not.
 */
export const color = {
  /**
   * The page. A hair off true black — near-white text on #000 halates on OLED,
   * and true black is worth keeping in reserve so `deep` can still read as a
   * step down from the page rather than as the same surface.
   */
  surface: '#0A0A0B',
  /** Raised panel: cards, figures, the summary strip. */
  raised: '#141417',
  /** The deepest block. True black, exactly as the banner uses it. */
  deep: '#000000',
  /** Primary text. Off-white, in the register of the logo's brightest facets. */
  fg: '#ECECE7',
  /** Secondary text — deks, summaries, source lines. 6.99:1 on `surface`. */
  muted: '#9A9A94',
  /**
   * Tertiary text — timestamps, counts, captions. Tuned to clear AA on the
   * RAISED surface (4.74:1), not merely on the page, because that is where it
   * is dimmest; a tone that only passed on `surface` would fail inside a card.
   */
  faint: '#828279',
  /** Hairline between rows. */
  line: '#26262A',
  /** Structural rule — the equivalent of the old heavy black keyline. */
  lineStrong: '#3A3A40',
  /**
   * The one chromatic accent, and the brand itself.
   *
   * One hue rather than the previous red-plus-blue: the identity is greyscale
   * plus lime, and a second and third hue would read as a different brand no
   * matter how well each was justified. Alert and data are therefore separated
   * by FORM, not by colour — an alert is a filled chip that pulses, a datum is
   * accent-coloured text. That is the same "glyph and typography, not eight
   * accent colours" rule the categories already follow.
   */
  accent: '#B4DA46',
  /**
   * Lit. Reserved for live and breaking, where the accent has to out-shout an
   * accent that is already on screen. Echoes the light streaks in the banner.
   */
  accentHot: '#E4FF6C',
  /** Text and glyphs sitting on an accent fill. */
  onAccent: '#0A0A0B',
} as const;

/**
 * The five difficulty colours, quoted from the game.
 *
 * The one exception to "greyscale plus one hue", and a narrow one: these are
 * not STEPWIRE's colours, they are DDR's, and a player reads EXPERT as green
 * and CHALLENGE as purple before reading the word. Printing them in the lime
 * would be less clear, not more consistent. They appear on the difficulty
 * badge and nowhere else — never on text, never on a rule, never as accent.
 *
 * Lightened just enough that `onAccent` text meets AA on each; the test checks.
 */
export const difficulty = {
  BEGINNER: '#2FCDEB',
  BASIC: '#F4B33D',
  DIFFICULT: '#EE5158',
  EXPERT: '#41C245',
  CHALLENGE: '#B76DF2',
} as const;
export type Difficulty = keyof typeof difficulty;

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
 * to frames by `lib/video/timing.ts` for the film, so a transition feels the
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
