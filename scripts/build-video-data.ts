/**
 * Writes Remotion props files for every published article.
 *
 *   pnpm video:data
 *   pnpm exec remotion studio video/index.ts --props=video/data/<slug>.json
 *
 * Remotion Studio bundles for the browser and cannot read `content/` off disk,
 * so previewing a real article there means handing it props. The Next.js studio
 * at `/studio` reads live data and needs none of this.
 *
 * Output is generated and git-ignored.
 */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getArticles } from '../lib/content/loader';
import { toVideoInput } from '../lib/content/article';
import { COMPOSITION_IDS } from '../lib/video/compositions';
import { buildSceneSequence } from '../lib/video/scenes';
import { formatDuration } from '../lib/video/timing';

async function main() {
  const articles = await getArticles();
  const outDir = path.join(process.cwd(), 'video', 'data');
  await mkdir(outDir, { recursive: true });

  if (articles.length === 0) {
    console.log('no published articles — nothing to write.\n');
    return;
  }

  const index: { slug: string; composition: string; propsFile: string }[] = [];

  for (const article of articles) {
    const videoInput = toVideoInput(article);

    // One file per composition. A props file always matches the format it is
    // named for, so passing the wrong one is not an easy mistake to make.
    for (const composition of COMPOSITION_IDS) {
      const props = { article: videoInput, composition };
      const suffix = composition === COMPOSITION_IDS[0] ? '' : `.${composition.toLowerCase()}`;
      const file = path.join(outDir, `${article.slug}${suffix}.json`);
      await writeFile(file, `${JSON.stringify(props, null, 2)}\n`, 'utf8');

      index.push({
        slug: article.slug,
        composition,
        propsFile: path.relative(process.cwd(), file),
      });
    }

    const durations = COMPOSITION_IDS.map((id) => {
      const sequence = buildSceneSequence(videoInput, id);
      return `${id}=${formatDuration(sequence.durationInFrames, sequence.fps)}`;
    }).join('  ');

    console.log(`  ${article.slug}  ${durations}`);
  }

  await writeFile(
    path.join(outDir, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8',
  );

  console.log(`\n  ${index.length} props file(s) written to video/data/\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
