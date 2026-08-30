import { createHash } from 'node:crypto';
import { z } from 'zod';
import { COMPOSITION_IDS, type CompositionId } from './compositions';

/**
 * Render request identity.
 *
 * A render costs real money and real minutes, so the same article rendered into
 * the same composition must resolve to the same artefact rather than starting a
 * second job. The render id is a hash of (slug, composition, content hash), so:
 *
 *   - re-clicking Render is free
 *   - editing the article produces a genuinely new id
 *   - two concurrent requests collide on one id and one wins
 */

export const renderRequestSchema = z.object({
  articleSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'articleSlug must be a lowercase kebab-case slug'),
  composition: z.enum(COMPOSITION_IDS as [CompositionId, ...CompositionId[]]),
  /** Bypasses the "already rendered" short-circuit. Never the default. */
  force: z.boolean().default(false),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

export function makeRenderId(input: {
  articleSlug: string;
  composition: string;
  contentHash: string;
}): string {
  const digest = createHash('sha256')
    .update(`${input.articleSlug}|${input.composition}|${input.contentHash}`)
    .digest('hex')
    .slice(0, 16);
  return `${input.composition.toLowerCase()}-${input.articleSlug}-${digest}`.slice(0, 120);
}

/** Where a finished render lives in blob storage. */
export function renderObjectPath(renderId: string): string {
  return `renders/${renderId}.mp4`;
}

export type RenderStatus = 'queued' | 'rendering' | 'uploading' | 'complete' | 'failed';

export interface RenderJob {
  renderId: string;
  articleSlug: string;
  composition: CompositionId;
  status: RenderStatus;
  createdAt: string;
  updatedAt: string;
  /** Present once the render is complete. */
  url?: string;
  error?: string;
  /** Free-form progress notes, surfaced in the studio. */
  log: string[];
  driver: 'local' | 'sandbox';
}
