import { motion, video } from '../design/tokens';
import { visualLength } from './text';

/**
 * Timing.
 *
 * Video duration is derived, never hard-coded. A scene lasts as long as its
 * text needs to be read, so an article with a short PLAYER IMPACT produces a
 * shorter video without anyone editing a number — which is the property that
 * lets one Article drive both surfaces.
 */

export const FPS: number = video.fps;

export function secondsToFrames(seconds: number, fps = FPS): number {
  return Math.max(1, Math.round(seconds * fps));
}

export function framesToSeconds(frames: number, fps = FPS): number {
  return frames / fps;
}

/** Web motion durations, in frames — so a transition matches the website. */
export const MOTION_FRAMES = {
  instant: secondsToFrames(motion.instant / 1000),
  quick: secondsToFrames(motion.quick / 1000),
  base: secondsToFrames(motion.base / 1000),
  slow: secondsToFrames(motion.slow / 1000),
} as const;

/**
 * Reading speed for on-screen text, in weighted characters per second.
 *
 * Deliberately slower than silent reading: a viewer is also watching motion,
 * and social video is often played without sound, so text has to survive a
 * single pass. The measure is `visualLength`, which counts a CJK character
 * twice — so this works out to ~12 Latin characters or ~6 Japanese characters
 * per second, which is about right for both.
 */
const CHARS_PER_SECOND = 12;
/** Time to register that a new card has appeared, before reading starts. */
const ENTRY_SECONDS = 0.85;

export interface DurationBounds {
  min: number;
  max: number;
}

export const DEFAULT_TEXT_BOUNDS: DurationBounds = { min: 2, max: 7 };

/** Seconds a block of text needs on screen. */
export function readingSeconds(
  text: string,
  bounds: DurationBounds = DEFAULT_TEXT_BOUNDS,
): number {
  const characters = visualLength(text.trim());
  const seconds = ENTRY_SECONDS + characters / CHARS_PER_SECOND;
  return Math.min(bounds.max, Math.max(bounds.min, Number(seconds.toFixed(2))));
}

export function readingFrames(
  text: string,
  bounds: DurationBounds = DEFAULT_TEXT_BOUNDS,
  fps = FPS,
): number {
  return secondsToFrames(readingSeconds(text, bounds), fps);
}

/** `1:04` — used in the studio UI. */
export function formatDuration(frames: number, fps = FPS): string {
  const total = framesToSeconds(frames, fps);
  const minutes = Math.floor(total / 60);
  const seconds = Math.round(total % 60);
  if (minutes === 0) return `${total.toFixed(1)}s`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
