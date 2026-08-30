import type { CompositionId } from './compositions';
import type { RenderJob, RenderStatus } from './render-request';

/**
 * In-process render job registry.
 *
 * Deliberately small and deliberately in memory. Adding a database for an MVP
 * with one operator would be the wrong trade — so the design is arranged so
 * that losing this registry is survivable:
 *
 *   - Duplicate prevention does NOT depend on it. The authoritative check is
 *     "does the object already exist in blob storage", which is shared across
 *     every serverless instance (see `lib/video/storage.ts`).
 *   - This registry only serves progress polling. If a poll lands on a
 *     different instance the job reads as `unknown`, and the studio falls back
 *     to checking storage for the finished file.
 *
 * When renders become frequent enough to need durable history, this module is
 * the only thing that has to change.
 */

const jobs = new Map<string, RenderJob>();

/** Bounded so a long-lived instance cannot leak memory. */
const MAX_JOBS = 100;

export function createJob(input: {
  renderId: string;
  articleSlug: string;
  composition: CompositionId;
  driver: 'local' | 'sandbox';
}): RenderJob {
  const now = new Date().toISOString();
  const job: RenderJob = {
    ...input,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    log: [],
  };

  jobs.set(job.renderId, job);

  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].sort(
      (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
    )[0];
    if (oldest) jobs.delete(oldest.renderId);
  }

  return job;
}

export function getJob(renderId: string): RenderJob | undefined {
  return jobs.get(renderId);
}

export function updateJob(
  renderId: string,
  patch: Partial<Pick<RenderJob, 'status' | 'url' | 'error'>> & { log?: string },
): RenderJob | undefined {
  const job = jobs.get(renderId);
  if (!job) return undefined;

  const next: RenderJob = {
    ...job,
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.url ? { url: patch.url } : {}),
    ...(patch.error ? { error: patch.error } : {}),
    updatedAt: new Date().toISOString(),
    // Keep the tail only: the studio shows recent progress, not a full trace.
    log: patch.log ? [...job.log, patch.log].slice(-40) : job.log,
  };

  jobs.set(renderId, next);
  return next;
}

/** True while a render for this id is already in flight on this instance. */
export function isActive(renderId: string): boolean {
  const status: RenderStatus | undefined = jobs.get(renderId)?.status;
  return status === 'queued' || status === 'rendering' || status === 'uploading';
}

/** Test seam. */
export function _resetJobs(): void {
  jobs.clear();
}
