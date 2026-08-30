import { timingSafeEqual } from 'node:crypto';

/**
 * Cost protection for the render endpoint.
 *
 * A render spins up a machine and bills for it. An unauthenticated render
 * endpoint on a public domain is therefore not a security nicety — it is an
 * open invoice. Three layers guard it:
 *
 *   1. A shared secret. No secret configured means the endpoint is disabled
 *      outright, so a partial deployment fails closed rather than open.
 *   2. A rate limit, behind an interface so it can be swapped for a shared
 *      store (Vercel KV, Upstash) the moment there is more than one instance.
 *   3. Duplicate prevention, which lives in `storage.ts` and `jobs.ts` because
 *      it needs to be shared across instances to be worth anything.
 */

export const RENDER_TOKEN_HEADER = 'x-stepwire-render-token';

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 503; message: string };

/** Constant-time comparison, safe for values of differing length. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authorizeRender(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): AuthResult {
  const expected = env.STEPWIRE_RENDER_TOKEN;

  if (!expected) {
    return {
      ok: false,
      status: 503,
      message:
        'rendering is disabled: STEPWIRE_RENDER_TOKEN is not configured on this deployment',
    };
  }

  const provided = headers.get(RENDER_TOKEN_HEADER);
  if (!provided) {
    return { ok: false, status: 401, message: `missing ${RENDER_TOKEN_HEADER} header` };
  }

  if (!secretsMatch(provided, expected)) {
    return { ok: false, status: 403, message: 'invalid render token' };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

/**
 * Fixed-window in-memory limiter.
 *
 * Honest about its limits: with several serverless instances the effective
 * ceiling is `limit × instances`. That is acceptable for a single-operator MVP
 * where the real backstop is the shared-secret gate, and the interface above
 * means replacing it later touches one file.
 */
export function createMemoryRateLimiter(limit = 10, windowMs = 60 * 60 * 1000): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        windows.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: limit - 1, resetAt };
      }

      if (existing.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt };
      }

      existing.count += 1;
      return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
    },
  };
}

/** The limiter used by the route. Module-scoped so it survives warm invocations. */
export const renderRateLimiter: RateLimiter = createMemoryRateLimiter(
  Number(process.env.STEPWIRE_RENDER_RATE_LIMIT ?? 10),
);
