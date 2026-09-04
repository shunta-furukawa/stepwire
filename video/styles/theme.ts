import {
  border,
  color,
  difficulty,
  font,
  fontSize,
  fontWeight,
  leading,
  space,
  tracking,
} from '../../lib/design/tokens';

/**
 * Video theme.
 *
 * Every value is derived from `lib/design/tokens.ts` — the same tokens the
 * website's Tailwind theme mirrors. The video does not have a palette or a type
 * scale of its own; it has the brand's, scaled up for a 1080p-class canvas.
 *
 * Fonts follow the web: the same system stack, no webfont.
 *
 * Loading Noto Sans JP from Google Fonts was tried and reverted. The Japanese
 * subset is split across ~124 unicode ranges per weight, and Remotion must wait
 * for all of them before the first frame — 363 network requests per render, and
 * a hard dependency on fonts.gstatic.com being reachable. That is strictly
 * worse than the system stack, which renders Japanese correctly on any machine
 * that has a CJK face.
 *
 * The real requirement is therefore on the render environment, not the bundle:
 * it must have a CJK font installed. `lib/video/drivers/sandbox.ts` ensures one
 * in the sandbox, and `docs/video-system.md` records the requirement for local
 * renders.
 */

/** Type is ~3x web size at these canvas dimensions. */
export const SCALE = 3;

export const px = (value: number) => `${value * SCALE}px`;

/** The video type stack — identical to the website's. */
export const videoFont = {
  display: font.display,
  body: font.body,
  mono: font.mono,
} as const;

export const type = {
  display: fontSize.display * SCALE,
  h1: fontSize.h1 * SCALE,
  h2: fontSize.h2 * SCALE,
  h3: fontSize.h3 * SCALE,
  h4: fontSize.h4 * SCALE,
  lead: fontSize.lead * SCALE,
  base: fontSize.base * SCALE,
  small: fontSize.small * SCALE,
  micro: fontSize.micro * SCALE,
} as const;

export const gap = {
  xs: space.xs * SCALE,
  sm: space.sm * SCALE,
  md: space.md * SCALE,
  lg: space.lg * SCALE,
  xl: space.xl * SCALE,
  xxl: space['2xl'] * SCALE,
} as const;

export { color, difficulty, font, fontWeight, tracking, leading, border };

/** Recurring text styles, so a scene never re-specifies the brand. */
export const textStyles = {
  /** All-caps mono metadata — the "wire" voice. */
  meta: {
    fontFamily: videoFont.mono,
    fontSize: type.small,
    letterSpacing: `${tracking.wider}em`,
    textTransform: 'uppercase',
    lineHeight: leading.snug,
  },
  /** Section label chips. */
  label: {
    fontFamily: videoFont.mono,
    fontSize: type.base,
    fontWeight: fontWeight.bold,
    letterSpacing: `${tracking.wider}em`,
    textTransform: 'uppercase',
    lineHeight: 1,
  },
  /** Headline / display type. */
  display: {
    fontFamily: videoFont.display,
    fontWeight: fontWeight.black,
    letterSpacing: `${tracking.display}em`,
    lineHeight: leading.display,
  },
  /** Body copy on a card. Japanese needs near-normal tracking, not the
   *  wordmark's -0.03em; see `tracking.headline`. */
  body: {
    fontFamily: videoFont.display,
    fontWeight: fontWeight.medium,
    letterSpacing: `${tracking.headline}em`,
    lineHeight: leading.tight,
  },
} as const satisfies Record<string, React.CSSProperties>;
