import {
  border,
  color,
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
 */

/** Type is ~3x web size at these canvas dimensions. */
export const SCALE = 3;

export const px = (value: number) => `${value * SCALE}px`;

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

export { color, font, fontWeight, tracking, leading, border };

/** Recurring text styles, so a scene never re-specifies the brand. */
export const textStyles = {
  /** All-caps mono metadata — the "wire" voice. */
  meta: {
    fontFamily: font.mono,
    fontSize: type.small,
    letterSpacing: `${tracking.wider}em`,
    textTransform: 'uppercase',
    lineHeight: leading.snug,
  },
  /** Section label chips. */
  label: {
    fontFamily: font.mono,
    fontSize: type.base,
    fontWeight: fontWeight.bold,
    letterSpacing: `${tracking.wider}em`,
    textTransform: 'uppercase',
    lineHeight: 1,
  },
  /** Headline / display type. */
  display: {
    fontFamily: font.display,
    fontWeight: fontWeight.black,
    letterSpacing: `${tracking.display}em`,
    lineHeight: leading.display,
  },
  /** Body copy on a card. */
  body: {
    fontFamily: font.display,
    fontWeight: fontWeight.medium,
    letterSpacing: `${tracking.tight}em`,
    lineHeight: leading.tight,
  },
} as const satisfies Record<string, React.CSSProperties>;
