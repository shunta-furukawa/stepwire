import type { Mood } from '../content/dialogue';

/**
 * WIRE's face, as geometry.
 *
 * One description, two renderers: the website draws it as SVG and the film
 * draws it on the canvas, and both read this so the character on the page is
 * the character in the video. Everything is in a 100 × 100 box with the
 * origin at the top-left, in the palette's tones by role — the renderers map
 * `tone` to a colour, this file never names one.
 *
 * WIRE is low-poly, like the field it lives in front of: a faceted head, a
 * single wire for an antenna, and two big eyes that do almost all of the
 * talking. Expression is the eyes and the mouth; the head never changes.
 *
 * Motion is a function of time, never of a clock: `blink(t)` and `bob(t)`
 * take seconds and return the same answer for the same second, so an export
 * and the preview agree, frame for frame.
 */

export type Tone = 'accent' | 'accentHot' | 'fg' | 'muted' | 'raised' | 'line' | 'lineStrong' | 'deep';

export interface Polygon {
  points: [number, number][];
  tone: Tone;
}

export interface Eye {
  cx: number;
  cy: number;
  /** Half-width and half-height of the open eye. Round: the two are equal. */
  rx: number;
  ry: number;
  /** The pupil, as a fraction of the eye. Big — it is what makes WIRE cute. */
  pupil: number;
  /** `open` is a rounded shape; `arc` is the ^ of a smile; `shut` a line. */
  shape: 'open' | 'arc' | 'shut';
  /** Where the pupil looks, as a fraction of the eye's radius. */
  look: [number, number];
}

export interface Mouth {
  /** Cubic path: start, two controls, end — closed for `round`. */
  points: [number, number][];
  kind: 'curve' | 'round';
}

export interface Face {
  head: Polygon[];
  antenna: { from: [number, number]; to: [number, number]; tip: [number, number] };
  eyes: [Eye, Eye];
  mouth: Mouth;
  /** Two soft dots under the eyes, only when WIRE is pleased. */
  cheeks?: [[number, number], [number, number]];
  /** A tilted line over one eye, only when WIRE is thinking. */
  brow?: [[number, number], [number, number]];
}

/** The head is the same for every mood: a rounded hexagon, cut into facets. */
const HEAD: Polygon[] = [
  // The silhouette, then the facets that catch light, front to back.
  { points: [[50, 8], [86, 28], [86, 72], [50, 92], [14, 72], [14, 28]], tone: 'raised' },
  { points: [[50, 8], [86, 28], [50, 40], [14, 28]], tone: 'lineStrong' },
  { points: [[14, 28], [50, 40], [50, 92], [14, 72]], tone: 'line' },
  { points: [[50, 40], [86, 28], [86, 72], [50, 92]], tone: 'raised' },
];

const ANTENNA = { from: [50, 8] as [number, number], to: [58, -6] as [number, number], tip: [60, -9] as [number, number] };

const EYE_BASE = { rx: 9.5, ry: 9.5, pupil: 0.56 } as const;

export function wireFace(mood: Mood): Face {
  const left = { cx: 36, cy: 54 };
  const right = { cx: 64, cy: 54 };
  const eye = (at: { cx: number; cy: number }, over: Partial<Eye> = {}): Eye => ({
    ...at,
    ...EYE_BASE,
    shape: 'open',
    look: [0, 0],
    ...over,
  });

  switch (mood) {
    case 'grin':
      return {
        head: HEAD,
        antenna: ANTENNA,
        eyes: [eye(left, { shape: 'arc' }), eye(right, { shape: 'arc' })],
        mouth: { kind: 'curve', points: [[38, 70], [44, 80], [56, 80], [62, 70]] },
        cheeks: [[26, 66], [74, 66]],
      };
    case 'surprise':
      return {
        head: HEAD,
        antenna: ANTENNA,
        eyes: [eye(left, { rx: 11, ry: 11, pupil: 0.42 }), eye(right, { rx: 11, ry: 11, pupil: 0.42 })],
        mouth: { kind: 'round', points: [[50, 75], [4, 5]] },
      };
    case 'think':
      return {
        head: HEAD,
        antenna: ANTENNA,
        eyes: [eye(left, { look: [0.4, -0.4] }), eye(right, { look: [0.4, -0.4] })],
        mouth: { kind: 'curve', points: [[42, 75], [46, 73], [54, 73], [58, 75]] },
        brow: [[58, 38], [72, 41]],
      };
    case 'wink':
      return {
        head: HEAD,
        antenna: ANTENNA,
        eyes: [eye(left, { shape: 'shut' }), eye(right)],
        mouth: { kind: 'curve', points: [[40, 71], [45, 78], [57, 78], [60, 70]] },
        cheeks: [[26, 66], [74, 66]],
      };
    case 'neutral':
    default:
      return {
        head: HEAD,
        antenna: ANTENNA,
        eyes: [eye(left), eye(right)],
        mouth: { kind: 'curve', points: [[42, 72], [46, 77], [54, 77], [58, 72]] },
      };
  }
}

/** Seconds between blinks, and how long the lids stay down. */
const BLINK_EVERY = 3.4;
const BLINK_FOR = 0.12;

/**
 * How open the eyes are at `t` seconds, 0 (shut) to 1 (open).
 *
 * A blink is a dip, not a switch: the lids close over the first half of the
 * window and open over the second. Two blinks close together every fourth
 * cycle, because a face that blinks like a metronome is a clock.
 */
export function blink(t: number): number {
  const cycle = Math.floor(t / BLINK_EVERY);
  const into = t - cycle * BLINK_EVERY;
  const dip = (start: number) => {
    const x = (into - start) / BLINK_FOR;
    return x > 0 && x < 1 ? 1 - Math.sin(x * Math.PI) : 0;
  };
  const shut = Math.max(dip(0.7), cycle % 4 === 3 ? dip(0.7 + BLINK_FOR * 1.6) : 0);
  return 1 - shut;
}

/** A slow float, in units of the box, so WIRE is never quite still. */
export function bob(t: number): { dx: number; dy: number; tilt: number } {
  return {
    dx: Math.sin(t * 0.9) * 1.2,
    dy: Math.sin(t * 1.3 + 0.8) * 1.8,
    tilt: Math.sin(t * 0.7) * 0.035,
  };
}
