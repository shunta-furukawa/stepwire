import type { ArticleVideoInput } from '../content/article';
import type { CompositionId } from './compositions';
import type { EnvLike } from './guard';

/**
 * Render drivers.
 *
 * A driver turns (article, composition) into an MP4. Two exist:
 *
 *   local   — @remotion/bundler + @remotion/renderer in this process. Used by
 *             `pnpm video:render`. No cloud account, no cost, no network.
 *   sandbox — Vercel Sandbox. Used by the deployed render API, because a
 *             serverless function cannot run headless Chrome for a minute.
 *
 * Both are behind this interface so `/api/render` does not know or care which
 * one it is using, and so a designer can iterate on scenes locally without ever
 * touching the paid path.
 */

export interface RenderInput {
  renderId: string;
  article: ArticleVideoInput;
  composition: CompositionId;
  onLog?: (message: string) => void;
  signal?: AbortSignal;
}

export interface RenderOutput {
  /** The finished file. */
  body: Buffer;
  durationMs: number;
}

export interface RenderDriver {
  name: 'local' | 'sandbox';
  render(input: RenderInput): Promise<RenderOutput>;
}

/**
 * Chooses a driver from the environment.
 *
 * The sandbox driver is used only when it is fully configured. Anything else
 * falls back to local, so a misconfigured deployment fails loudly at render
 * time rather than silently spending money in a half-set-up account.
 */
export function selectDriverName(env: EnvLike = process.env): 'local' | 'sandbox' {
  const explicit = env.STEPWIRE_RENDER_DRIVER;
  if (explicit === 'local' || explicit === 'sandbox') return explicit;

  const sandboxReady =
    Boolean(env.VERCEL_TOKEN) && Boolean(env.VERCEL_TEAM_ID) && Boolean(env.VERCEL_PROJECT_ID);

  return sandboxReady ? 'sandbox' : 'local';
}

export async function loadDriver(name: 'local' | 'sandbox'): Promise<RenderDriver> {
  if (name === 'sandbox') {
    const { sandboxDriver } = await import('./drivers/sandbox');
    return sandboxDriver;
  }
  const { localDriver } = await import('./drivers/local');
  return localDriver;
}
