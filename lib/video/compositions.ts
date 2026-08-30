import { video } from '../design/tokens';

/**
 * Composition registry.
 *
 * Defined here rather than inside `video/Root.tsx` because the Next.js studio,
 * the render API and the Remotion root all need to agree on the same list, and
 * only Remotion can import Remotion.
 */
export const COMPOSITIONS = {
  STEPWIRE_SHORT: {
    id: 'STEPWIRE_SHORT',
    /**
     * Remotion composition ids may not contain underscores, but STEPWIRE_SHORT
     * is the name the API, the studio and the docs use. The public name stays;
     * `remotionId` is what gets registered and passed to the renderer.
     */
    remotionId: 'STEPWIRE-SHORT',
    label: 'Short (vertical)',
    width: video.formats.STEPWIRE_SHORT.width,
    height: video.formats.STEPWIRE_SHORT.height,
    fps: video.fps,
    orientation: 'vertical',
    aspectRatio: '9:16',
    /** Target envelope. The sequence builder trims to fit inside it. */
    targetSeconds: { min: 20, max: 45 },
    usage: 'YouTube Shorts · X · Instagram Reels · TikTok',
  },
  STEPWIRE_NEWS: {
    id: 'STEPWIRE_NEWS',
    remotionId: 'STEPWIRE-NEWS',
    label: 'News (landscape)',
    width: video.formats.STEPWIRE_NEWS.width,
    height: video.formats.STEPWIRE_NEWS.height,
    fps: video.fps,
    orientation: 'landscape',
    aspectRatio: '16:9',
    targetSeconds: { min: 35, max: 90 },
    usage: 'YouTube · web embed',
  },
} as const;

export type CompositionId = keyof typeof COMPOSITIONS;
export type CompositionDefinition = (typeof COMPOSITIONS)[CompositionId];

export const COMPOSITION_IDS = Object.keys(COMPOSITIONS) as CompositionId[];

export function isCompositionId(value: string): value is CompositionId {
  return Object.prototype.hasOwnProperty.call(COMPOSITIONS, value);
}

export function getComposition(id: CompositionId): CompositionDefinition {
  return COMPOSITIONS[id];
}
