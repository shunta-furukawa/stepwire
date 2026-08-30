import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RenderDriver, RenderInput, RenderOutput } from '../drivers';
import type { StepwireVideoProps } from '../../../video/compositions/StepwireVideo';

/**
 * Local render driver.
 *
 * Runs the Remotion toolchain in-process. This is the path a designer uses
 * (`pnpm video:render <slug>`) and the fallback the API uses when no cloud
 * render is configured — being able to see a finished video without a Vercel
 * account is a requirement, not a convenience.
 *
 * Remotion's bundler and renderer are imported dynamically so that nothing in
 * the Next.js request path pulls in a native Chrome dependency it will never use.
 */
export const localDriver: RenderDriver = {
  name: 'local',

  async render(input: RenderInput): Promise<RenderOutput> {
    const startedAt = Date.now();
    const log = input.onLog ?? (() => {});

    const [{ bundle }, { renderMedia, selectComposition }, { getComposition }] =
      await Promise.all([
        import('@remotion/bundler'),
        import('@remotion/renderer'),
        import('../compositions'),
      ]);

    const definition = getComposition(input.composition);

    const outputDir = await mkdtemp(path.join(tmpdir(), 'stepwire-render-'));
    const outputPath = path.join(outputDir, `${input.renderId}.mp4`);

    try {
      log('bundling compositions');
      // Progress callbacks fire per frame; only report when the rounded
      // percentage actually moves, or the log is unreadable.
      let lastBundle = -1;
      const serveUrl = await bundle({
        entryPoint: path.join(process.cwd(), 'video', 'index.ts'),
        onProgress: (progress) => {
          const step = Math.floor(progress / 25) * 25;
          if (step > lastBundle) {
            lastBundle = step;
            log(`bundle ${step}%`);
          }
        },
      });

      const inputProps: StepwireVideoProps = {
        article: input.article,
        composition: input.composition,
      };

      log(`selecting composition ${input.composition}`);
      const composition = await selectComposition({
        serveUrl,
        id: definition.remotionId,
        inputProps,
      });

      log(`rendering ${composition.durationInFrames} frames at ${composition.fps}fps`);
      let lastRender = -1;
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        crf: 18,
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const step = Math.floor(progress * 10) * 10;
          if (step > lastRender) {
            lastRender = step;
            log(`render ${step}%`);
          }
        },
      });

      const body = await readFile(outputPath);
      log(`rendered ${(body.byteLength / 1_000_000).toFixed(1)} MB`);

      return { body, durationMs: Date.now() - startedAt };
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  },
};
