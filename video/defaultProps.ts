import type { ArticleVideoInput } from '../lib/content/article';

/**
 * Default props for Remotion Studio.
 *
 * Self-contained and committed on purpose: Remotion Studio bundles for the
 * browser and cannot read `content/` off disk, and a generated file would make
 * `pnpm video:studio` fail on a fresh clone. A designer working on scenes gets
 * a representative article immediately, with no build step in between.
 *
 * To preview a real article in Remotion Studio, generate its props first:
 *
 *   pnpm video:data
 *   pnpm exec remotion studio video/index.ts --props=video/data/<slug>.json
 *
 * The Next.js studio at `/studio` reads live article data and needs none of this.
 */
export const SAMPLE_ARTICLE: ArticleVideoInput = {
  slug: 'sample-ddr-world-summer-update',
  title: 'SAMPLE: DDR WORLD ships a summer update with a reworked scoring readout',
  shortTitle: 'SAMPLE: Summer update reworks scoring',
  dek: 'Fictional sample content used to develop the STEPWIRE video system.',
  summary:
    'A fictional summer update adds a per-panel accuracy readout to the results screen and rebalances four boss charts.',
  category: 'UPDATE',
  importance: 'major',
  publishedAt: '2026-08-24T09:00:00+09:00',
  news: 'This is fixture content and describes nothing that happened. A fictional summer update adds a per-panel accuracy readout to the results screen. It also rebalances four charts at the top of the difficulty table.',
  context:
    'Results screens have historically told a player how well a run went without telling them where it went wrong. A per-panel breakdown moves that diagnosis into the cabinet itself.',
  playerImpact:
    'A failed run now points at a specific panel instead of a general feeling. Expect the effect to land on practice routine rather than on scores.',
  primarySource: {
    publisher: 'STEPWIRE Fixtures',
    title: 'SAMPLE SOURCE — not a real announcement',
    url: 'https://example.com/stepwire/fixtures/summer-update',
  },
  video: {
    hook: 'A results screen you actually read',
    data: [
      { label: 'CHARTS TOUCHED', value: '4' },
      { label: 'NEW READOUT', value: 'PER-PANEL' },
    ],
  },
};
