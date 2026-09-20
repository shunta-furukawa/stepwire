import type { ArticleVideoInput } from '../content/article';
import type { MediaRef } from '../content/schema';
import { DIFFICULTIES } from '../content/figures';
import { parseDiffParam } from '../vendor/step-analyzer/difficulty';

export interface GuideDifficulty {
  difficulty: (typeof DIFFICULTIES)[number];
  level: string;
}
export interface ChartGuide extends GuideDifficulty {
  title: string;
  artist: string;
  jacket: MediaRef;
  comparison?: GuideDifficulty;
}

export function chartGuides(article: ArticleVideoInput): ChartGuide[] {
  if (article.category !== 'CHARTS') return [];
  const jackets = article.media.filter(m => m.kind === 'jacket');
  const guides = new Map<string, ChartGuide>();
  for (const block of Object.values(article.blocks ?? {}).flat()) {
    if (block.kind !== 'chart') continue;
    const params = new URL(block.clip.url).searchParams;
    const title = params.get('t')?.trim();
    if (!title || guides.has(title)) continue;
    const jacket = jackets.find(m => m.song === title || m.alt === `${title} ジャケット`)
      ?? (jackets.length === 1 && guides.size === 0 && !jackets[0]?.song ? jackets[0] : undefined);
    const readDifficulty = (value: string | null): GuideDifficulty | undefined => {
      const parsed = parseDiffParam(value ?? undefined);
      const difficulty = parsed.cls === null ? undefined : DIFFICULTIES[parsed.cls];
      return difficulty && Number(parsed.lvl) >= 1 && Number(parsed.lvl) <= 19
        ? { difficulty, level: parsed.lvl } : undefined;
    };
    const primary = readDifficulty(params.get('df'));
    if (!jacket || !primary) continue;
    const comparison = block.clip.comparison ? readDifficulty(params.get('df2')) : undefined;
    guides.set(title, { title, artist: params.get('st') ?? '', jacket, ...primary,
      ...(comparison ? { comparison } : {}) });
  }
  return [...guides.values()];
}
