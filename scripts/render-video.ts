/**
 * Local video render.
 *
 *   pnpm video:render <slug>
 *   pnpm video:render <slug> --composition STEPWIRE_NEWS --out out/clip.mp4
 *
 * Runs entirely on this machine: no Vercel account, no token, no cost. Being
 * able to see a finished video without touching the cloud path is what keeps
 * design iteration fast and the render bill near zero.
 */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getArticles, getVideoInput } from '../lib/content/loader';
import { isCompositionId, type CompositionId } from '../lib/video/compositions';
import { buildSceneSequence } from '../lib/video/scenes';
import { formatDuration } from '../lib/video/timing';
import { makeRenderId } from '../lib/video/render-request';
import { localDriver } from '../lib/video/drivers/local';

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const slug = argv.find((arg) => !arg.startsWith('--'));

  const articles = await getArticles();

  if (!slug) {
    console.error('\nusage: pnpm video:render <slug> [--composition STEPWIRE_SHORT] [--out path]\n');
    console.error('published articles:');
    for (const article of articles) {
      console.error(`  ${article.slug}${article.fixture ? '  (sample fixture)' : ''}`);
    }
    console.error('');
    process.exit(1);
  }

  const article = articles.find((item) => item.slug === slug);
  if (!article) {
    console.error(`\nerror: no published article with slug "${slug}"\n`);
    process.exit(1);
  }

  const compositionArg = flag(argv, 'composition') ?? 'STEPWIRE_SHORT';
  if (!isCompositionId(compositionArg)) {
    console.error(`\nerror: unknown composition "${compositionArg}"\n`);
    process.exit(1);
  }
  const composition: CompositionId = compositionArg;

  const videoInput = await getVideoInput(article);
  const sequence = buildSceneSequence(videoInput, composition);
  const renderId = makeRenderId({
    articleSlug: article.slug,
    composition,
    contentHash: article.contentHash,
  });

  const outPath = path.resolve(
    process.cwd(),
    flag(argv, 'out') ?? path.join('video', 'out', `${renderId}.mp4`),
  );

  console.log(`
  article      ${article.title}
  composition  ${composition}
  scenes       ${sequence.scenes.length}
  duration     ${formatDuration(sequence.durationInFrames, sequence.fps)} (${sequence.durationInFrames} frames)
  output       ${path.relative(process.cwd(), outPath)}
`);

  const output = await localDriver.render({
    renderId,
    article: videoInput,
    composition,
    onLog: (message) => console.log(`  ${message}`),
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, output.body);

  console.log(`
  done in ${(output.durationMs / 1000).toFixed(1)}s
  ${path.relative(process.cwd(), outPath)}
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
