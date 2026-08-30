import { after } from 'next/server';
import { getArticleBySlug, getVideoInput } from '@/lib/content/loader';
import {
  makeRenderId,
  renderRequestSchema,
  type RenderJob,
} from '@/lib/video/render-request';
import { findExistingRender, uploadRender } from '@/lib/video/storage';
import { loadDriver, selectDriverName } from '@/lib/video/drivers';
import { createJob, getJob, isActive, updateJob } from '@/lib/video/jobs';
import { authorizeRender, renderRateLimiter } from '@/lib/video/guard';

/**
 * POST /api/render  — start (or reuse) a render
 * GET  /api/render?renderId=…  — poll its status
 *
 * The endpoint returns immediately with a render id and lets the work continue
 * in the background via `after()`. A Remotion render takes minutes, which is
 * longer than any sensible HTTP request, so the studio polls instead of holding
 * a connection open.
 *
 * Cost protection is deliberate and layered — see `lib/video/guard.ts`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * The `after()` callback outlives the response, so it needs its own ceiling.
 *
 * 300 seconds is the Hobby plan's maximum, and a value above a plan's limit
 * fails the *deployment*, not the request — the whole site refuses to ship
 * because of one endpoint nobody enabled. So this is the universally valid
 * number rather than the generous one; Next.js requires a literal here, so it
 * cannot be read from the environment.
 *
 * The consequence is real and worth knowing: the sandbox itself is allowed
 * twelve minutes, so on a plan capped at 300s a render that runs longer than
 * five minutes loses the function waiting to collect and upload it. Raise this
 * to 800 on a plan that permits it.
 */
export const maxDuration = 300;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function publicJob(job: RenderJob) {
  return {
    renderId: job.renderId,
    status: job.status,
    articleSlug: job.articleSlug,
    composition: job.composition,
    driver: job.driver,
    url: job.url,
    error: job.error,
    log: job.log,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeRender(request.headers);
  if (!auth.ok) {
    return json({ error: auth.message }, auth.status);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'request body must be JSON' }, 400);
  }

  const parsed = renderRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        error: 'invalid render request',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
    );
  }

  const { articleSlug, composition, force } = parsed.data;

  const article = await getArticleBySlug(articleSlug);
  if (!article) {
    return json({ error: `no published article with slug "${articleSlug}"` }, 404);
  }

  const renderId = makeRenderId({
    articleSlug,
    composition,
    contentHash: article.contentHash,
  });

  // 1. Already rendered? This is the cross-instance duplicate check and the one
  //    that actually prevents paying twice for the same video.
  if (!force) {
    const existing = await findExistingRender(renderId);
    if (existing) {
      return json({
        renderId,
        status: 'complete',
        url: existing.url,
        reused: true,
        composition,
        articleSlug,
      });
    }
  }

  // 2. Already running on this instance? Return the in-flight job rather than
  //    starting a second identical render.
  if (isActive(renderId)) {
    return json({ ...publicJob(getJob(renderId)!), reused: true }, 202);
  }

  // 3. Rate limit. Keyed by render id so retrying one video is cheap while
  //    fanning out across many is not.
  const limit = await renderRateLimiter.check('render');
  if (!limit.allowed) {
    return json(
      {
        error: 'render rate limit reached',
        resetAt: new Date(limit.resetAt).toISOString(),
      },
      429,
    );
  }

  const driverName = selectDriverName();
  const job = createJob({ renderId, articleSlug, composition, driver: driverName });
  const videoInput = await getVideoInput(article);

  after(async () => {
    const log = (message: string) => {
      console.log(`[render ${renderId}] ${message}`);
      updateJob(renderId, { log: message });
    };

    try {
      updateJob(renderId, { status: 'rendering', log: `driver: ${driverName}` });
      const driver = await loadDriver(driverName);
      const output = await driver.render({
        renderId,
        article: videoInput,
        composition,
        onLog: log,
      });

      updateJob(renderId, {
        status: 'uploading',
        log: `render finished in ${(output.durationMs / 1000).toFixed(1)}s`,
      });

      const stored = await uploadRender(renderId, output.body);
      updateJob(renderId, { status: 'complete', url: stored.url, log: 'uploaded' });
      console.log(`[render ${renderId}] complete: ${stored.url}`);
    } catch (error) {
      const message = (error as Error).message;
      updateJob(renderId, { status: 'failed', error: message, log: `failed: ${message}` });
      console.error(`[render ${renderId}] failed:`, error);
    }
  });

  return json({ ...publicJob(job), reused: false }, 202);
}

export async function GET(request: Request): Promise<Response> {
  const auth = authorizeRender(request.headers);
  if (!auth.ok) {
    return json({ error: auth.message }, auth.status);
  }

  const renderId = new URL(request.url).searchParams.get('renderId');
  if (!renderId) {
    return json({ error: 'renderId query parameter is required' }, 400);
  }

  const job = getJob(renderId);
  if (job) return json(publicJob(job));

  // The job is unknown to this instance — it may have been started on another
  // one, or this instance may have been recycled. Storage is authoritative.
  const existing = await findExistingRender(renderId);
  if (existing) {
    return json({ renderId, status: 'complete', url: existing.url });
  }

  return json(
    {
      renderId,
      status: 'unknown',
      message:
        'no job on this instance and no stored output. It may still be running elsewhere — poll again shortly.',
    },
    404,
  );
}
