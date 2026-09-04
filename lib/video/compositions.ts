import { video } from '../design/tokens';

/**
 * Composition registry.
 *
 * The formats a film can take. The studio, the scene builder and the
 * exporter all read this one list.
 */
export const COMPOSITIONS = {
  STEPWIRE_SHORT: {
    id: 'STEPWIRE_SHORT',
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
    label: 'News (landscape)',
    width: video.formats.STEPWIRE_NEWS.width,
    height: video.formats.STEPWIRE_NEWS.height,
    fps: video.fps,
    orientation: 'landscape',
    aspectRatio: '16:9',
    // Long enough for a session write-up with a card per chart; a Short is
    // the format that has to be brief, and it has its own ceiling.
    targetSeconds: { min: 35, max: 150 },
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
