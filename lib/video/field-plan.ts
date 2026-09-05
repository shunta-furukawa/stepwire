import type { Scene } from './scenes';
import type { SceneType } from './scene-types';

/**
 * The particle field, as numbers.
 *
 * The field is the layer of drifting facets and sparks behind every card. What
 * it does on a given frame is decided here, from the frame and the scene, and
 * nowhere else: `field.ts` turns this state into pixels, and both the canvas
 * export and the DOM preview hand it the same state. Nothing in the field
 * reads a clock — an export that rendered a different sky on each run could
 * never be checked against the preview.
 */

export interface FieldState {
  /** Seconds since the film started. The one input every motion derives from. */
  time: number;
  /**
   * How much is going on, 0–1. A headline is loud; a body card being read is
   * quiet. Controls how many facets are visible and how fast they move.
   */
  energy: number;
  /** A cut just happened: 1 on the first frame of a scene, decaying to 0. */
  burst: number;
  /** The scene assembling: 0 on its first frame, 1 once it has settled. */
  enter: number;
}

/**
 * How lively the field is behind each kind of scene.
 *
 * A `Record` so a new scene type cannot ship without a decision: the default
 * would otherwise be whatever number happens to be nearest, and "the sparks
 * were distracting on the source card" is a note nobody should have to write.
 */
export const FIELD_ENERGY: Record<SceneType, number> = {
  // The opening card is the loudest thing in the film: the session, at once.
  stats: 1,
  headline: 1,
  image: 0.55,
  outro: 0.9,
  news: 0.4,
  context: 0.4,
  impact: 0.4,
  narration: 0.4,
  figure: 0.3,
  source: 0.25,
};

/** Frames a cut's burst takes to fade to nothing. */
const BURST_FRAMES = 14;
/** Frames the field takes to assemble at the start of a scene. */
const ENTER_FRAMES = 18;

export function fieldState(
  scene: Pick<Scene, 'type'>,
  sceneFrame: number,
  absoluteFrame: number,
  fps: number,
): FieldState {
  const f = Math.max(0, sceneFrame);
  return {
    time: absoluteFrame / fps,
    energy: FIELD_ENERGY[scene.type],
    burst: Math.exp(-f / (BURST_FRAMES / 3)),
    enter: smoothstep(f / ENTER_FRAMES),
  };
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * A repeatable pseudo-random sequence, for placing facets and sparks.
 *
 * `Math.random` would give every export a different sky. The seed is fixed so
 * the preview and the file show the same field, and so a frame can be
 * regenerated and compared.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}
