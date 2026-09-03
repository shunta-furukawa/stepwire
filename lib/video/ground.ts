import { SCENE_TONE, type Scene } from './scenes';
import { color } from '../design/tokens';

/**
 * What is behind a scene, decided once.
 *
 * Both renderers paint the same stack under every card: a ground, then the
 * article's picture if the scene has one, then the particle field, then the
 * copy. The ground colour and how far a picture is darkened used to be chosen
 * inside each renderer's scene code, which is two places to be wrong. They are
 * answered here, and the renderers ask.
 */

/** Reported fact sits on the deepest ground; analysis is raised off it. */
export function sceneGround(scene: Pick<Scene, 'type'>): string {
  return SCENE_TONE[scene.type] === 'analysis' ? color.raised : color.deep;
}

/**
 * How much the picture behind a scene is darkened at the bottom, where the
 * copy sits, or `null` when the scene shows no picture.
 *
 * A headline is read over its hero, so the hero is mostly shadow; an image
 * scene exists to show the image, so it keeps most of its light and the
 * caption gets its own band.
 */
export function backdropDim(scene: Pick<Scene, 'type' | 'image'>): number | null {
  if (!scene.image) return null;
  if (scene.type === 'headline') return 0.82;
  if (scene.type === 'image') return 0.35;
  return null;
}

/**
 * The slow push into a picture over its scene, as a scale factor.
 *
 * A still image that does not move reads as a slide; a few percent of drift
 * over the card's life reads as film. Linear on purpose — an ease would
 * visibly slow at the end, and the cut comes before that.
 */
export function backdropZoom(progress: number): number {
  return 1 + 0.06 * Math.min(1, Math.max(0, progress));
}
