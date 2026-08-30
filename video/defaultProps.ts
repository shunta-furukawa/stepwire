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
  title: '【SAMPLE】DDR WORLD、夏のアップデートでスコア表示を刷新',
  shortTitle: '【SAMPLE】夏の更新でスコア表示刷新',
  dek: 'STEPWIREの動画システムを開発するための架空のサンプルです。',
  summary:
    '架空の夏アップデートで、リザルト画面にパネル別の精度表示が追加され、上位4譜面が調整された。',
  category: 'UPDATE',
  importance: 'major',
  publishedAt: '2026-08-24T09:00:00+09:00',
  news: 'この記事はサンプルで、実際には何も起きていません。架空の夏アップデートがリザルト画面にパネル別の精度表示を追加しました。難易度表の上位にある4譜面も調整されています。',
  context:
    'リザルト画面はこれまで、どれだけ良かったかは教えても、どこで崩れたかは教えてくれませんでした。パネル別の内訳は、その診断を筐体そのものへ移します。',
  playerImpact:
    '落ちた run が漠然とした感覚ではなく特定のパネルを指すようになります。影響はスコアよりも練習の組み立てに出るはずです。',
  primarySource: {
    publisher: 'STEPWIRE Fixtures',
    title: 'SAMPLE SOURCE — 実在しない告知',
    url: 'https://example.com/stepwire/fixtures/summer-update',
  },
  figures: [
    {
      kind: 'stat',
      title: 'アップデートの中身',
      items: [
        { label: '調整譜面', value: '4', note: '難易度表の上位' },
        { label: '新表示', value: 'パネル別', note: 'リザルト画面' },
      ],
    },
    {
      kind: 'bars',
      title: '調整された譜面のBPM',
      unit: 'BPM',
      caption: 'SAMPLE — 実在しない数値です。',
      items: [
        { label: 'SAMPLE CHART A', value: 300, highlight: true },
        { label: 'SAMPLE CHART B', value: 222 },
        { label: 'SAMPLE CHART C', value: 180 },
      ],
    },
  ],
  video: {
    hook: '読めるリザルト画面',
  },
};
