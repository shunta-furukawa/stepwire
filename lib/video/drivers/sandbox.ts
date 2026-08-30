import type { RenderDriver, RenderInput, RenderOutput } from '../drivers';
import type { StepwireVideoProps } from '../../../video/compositions/StepwireVideo';

/**
 * Vercel Sandbox render driver.
 *
 * A Remotion render needs headless Chrome, a minute or two of CPU and a few
 * hundred megabytes of RAM — none of which belong in a serverless function.
 * The sandbox gives the render a real machine: clone the repository at a known
 * revision, install, render, stream the file back, shut down.
 *
 * The repository is the render environment. There is no separate render service
 * to deploy or keep in sync, which is the same reason the CMS is Git.
 */

const RENDER_TIMEOUT_MS = 12 * 60 * 1000;

interface SandboxConfig {
  token: string;
  teamId: string;
  projectId: string;
  repositoryUrl: string;
  revision: string;
}

export function readSandboxConfig(env: NodeJS.ProcessEnv = process.env): SandboxConfig {
  const missing = (['VERCEL_TOKEN', 'VERCEL_TEAM_ID', 'VERCEL_PROJECT_ID'] as const).filter(
    (key) => !env[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `the sandbox render driver needs ${missing.join(', ')} — see .env.example`,
    );
  }

  return {
    token: env.VERCEL_TOKEN!,
    teamId: env.VERCEL_TEAM_ID!,
    projectId: env.VERCEL_PROJECT_ID!,
    repositoryUrl:
      env.STEPWIRE_RENDER_REPO_URL ?? 'https://github.com/shunta-furukawa/stepwire.git',
    // Renders track the deployed commit by default, so a video always matches
    // the article and the design that were live when it was requested.
    revision: env.STEPWIRE_RENDER_REVISION ?? env.VERCEL_GIT_COMMIT_SHA ?? 'main',
  };
}

export const sandboxDriver: RenderDriver = {
  name: 'sandbox',

  async render(input: RenderInput): Promise<RenderOutput> {
    const startedAt = Date.now();
    const log = input.onLog ?? (() => {});
    const config = readSandboxConfig();

    const [{ Sandbox }, { getComposition }] = await Promise.all([
      import('@vercel/sandbox'),
      import('../compositions'),
    ]);
    const definition = getComposition(input.composition);

    log(`creating sandbox at ${config.revision}`);
    const sandbox = await Sandbox.create({
      token: config.token,
      teamId: config.teamId,
      projectId: config.projectId,
      source: {
        type: 'git',
        url: config.repositoryUrl,
        revision: config.revision,
        depth: 1,
      },
      // Remotion parallelises across cores; four vCPUs is the point where
      // adding more stops paying for itself on a clip this short.
      resources: { vcpus: 4 },
      timeout: RENDER_TIMEOUT_MS,
      ...(input.signal ? { signal: input.signal } : {}),
    });

    try {
      const props: StepwireVideoProps = {
        article: input.article,
        composition: input.composition,
      };

      // Props go in as a file rather than as an argv string: an article body
      // contains quotes, newlines and non-ASCII text, and shell-quoting all of
      // that correctly is a bug waiting to happen.
      await sandbox.writeFiles([
        { path: 'render-props.json', content: Buffer.from(JSON.stringify(props), 'utf8') },
      ]);

      log('installing dependencies');
      const install = await sandbox.runCommand({
        cmd: 'npx',
        args: ['--yes', 'pnpm@10', 'install', '--frozen-lockfile', '--prod=false'],
        env: { CI: '1' },
      });
      if (install.exitCode !== 0) {
        throw new Error(`dependency install failed:\n${await install.output('both')}`);
      }

      log(`rendering ${input.composition}`);
      const outputPath = `out/${input.renderId}.mp4`;
      const render = await sandbox.runCommand({
        cmd: 'npx',
        args: [
          '--yes',
          'remotion',
          'render',
          'video/index.ts',
          definition.remotionId,
          outputPath,
          '--props=render-props.json',
          '--codec=h264',
          '--crf=18',
          '--log=info',
        ],
      });

      if (render.exitCode !== 0) {
        throw new Error(`remotion render failed:\n${await render.output('both')}`);
      }

      log('downloading the rendered file');
      const body = await sandbox.readFileToBuffer({ path: outputPath });
      if (!body || body.byteLength === 0) {
        throw new Error('the render produced no output file');
      }

      log(`rendered ${(body.byteLength / 1_000_000).toFixed(1)} MB`);
      return { body, durationMs: Date.now() - startedAt };
    } finally {
      // Always stop the sandbox: an orphaned one keeps billing.
      try {
        await sandbox.stop();
      } catch (error) {
        log(`warning: could not stop the sandbox — ${(error as Error).message}`);
      }
    }
  },
};
