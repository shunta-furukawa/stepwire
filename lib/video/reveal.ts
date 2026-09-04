/**
 * Text reveal timing — the game text box, as arithmetic.
 *
 * The video's copy does not appear; it types. Each character lands on a fixed
 * cadence and a tick sounds as it does, which is the rhythm-game register the
 * whole brand sits in. The renderer and the sound generator have to agree on
 * exactly which frame each character lands, so the timing lives here and
 * nowhere else. Nothing in the renderer decides when a character appears.
 *
 * The cadence is per CHARACTER, not per word or per break unit: a typewriter
 * is what the operator asked for, and a typewriter does not know about words.
 */

export type RevealKind = 'headline' | 'body';

/** Frames each character takes to land. Body types faster than a headline. */
const FRAMES_PER_CHAR: Record<RevealKind, number> = {
  headline: 2,
  body: 1,
};

/** A tick every this many characters. Every one at 30/s is a buzz, not a beat. */
const TICK_EVERY: Record<RevealKind, number> = {
  headline: 1,
  body: 2,
};

/** After the last character, how long the card holds, as a share of reveal. */
const HOLD_RATIO = 0.9;
const HOLD_MIN_SECONDS = 1.4;

export interface RevealPlan {
  /** Characters in the text, as the viewer counts them (code points). */
  units: number;
  framesPerUnit: number;
  /** Frames until the last character has landed. */
  revealFrames: number;
  /** Frames the finished card stays up. */
  holdFrames: number;
  /** Frame offsets within the scene at which a tick sounds. */
  ticks: number[];
}

/** Characters that do not type: whitespace lands silently and instantly. */
const SILENT = /\s/;

export function planReveal(text: string, kind: RevealKind, fps: number): RevealPlan {
  const chars = [...text];
  const units = chars.length;
  const framesPerUnit = FRAMES_PER_CHAR[kind];
  const every = TICK_EVERY[kind];

  const ticks: number[] = [];
  let sounding = 0;
  chars.forEach((char, index) => {
    if (SILENT.test(char)) return;
    if (sounding % every === 0) ticks.push(index * framesPerUnit);
    sounding += 1;
  });

  const revealFrames = units * framesPerUnit;
  const holdFrames = Math.max(
    Math.round(HOLD_MIN_SECONDS * fps),
    Math.round(revealFrames * HOLD_RATIO),
  );

  return { units, framesPerUnit, revealFrames, holdFrames, ticks };
}

/** How many characters are on screen at a given frame of the scene. */
export function visibleUnits(plan: RevealPlan, frameInScene: number): number {
  if (plan.framesPerUnit <= 0) return plan.units;
  return Math.min(plan.units, Math.floor(frameInScene / plan.framesPerUnit) + 1);
}

/** The first `n` characters of `text`, by code point rather than UTF-16 unit. */
export function revealedText(text: string, n: number): string {
  return [...text].slice(0, n).join('');
}
