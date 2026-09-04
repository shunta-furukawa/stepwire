/**
 * STEPWIRE editorial categories.
 *
 * A category is a *content class*, not a navigation item. Several categories
 * roll up into one section of the site (see `SECTIONS`), which keeps the
 * information architecture small without flattening the data model.
 */
export const CATEGORIES = [
  'NEWS',
  'UPDATE',
  'CHARTS',
  'EVENT',
  'TOURNAMENT',
  'DATA',
  'CULTURE',
  'COMMUNITY',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Each category carries an abstracted glyph so categories stay identifiable
 * without introducing eight accent colours. The glyphs are a deliberate
 * abstraction of arrow / panel / step motifs rather than game artwork.
 */
/**
 * The category code itself stays Latin and uppercase: it is set in monospace as
 * a chip, where it reads as a wire code rather than as a word. The Japanese
 * label is what appears in prose.
 */
export const CATEGORY_META: Record<
  Category,
  { glyph: string; label: string; blurb: string }
> = {
  NEWS: { glyph: '▲', label: 'ニュース', blurb: 'DDRをめぐる動き。' },
  UPDATE: { glyph: '▶', label: 'アップデート', blurb: 'ゲーム・筐体・サービスの更新。' },
  CHARTS: { glyph: '◀', label: '譜面', blurb: '新曲、新譜面、難易度の変更。' },
  EVENT: { glyph: '▼', label: 'イベント', blurb: 'ロケテスト、キャンペーン、ゲーム内イベント。' },
  TOURNAMENT: { glyph: '◆', label: '大会', blurb: '競技シーンと結果。' },
  DATA: { glyph: '■', label: 'データ', blurb: 'BPM・難易度・譜面データの分析。' },
  CULTURE: { glyph: '●', label: 'カルチャー', blurb: 'シーン、音楽、そして歴史。' },
  COMMUNITY: { glyph: '◎', label: 'コミュニティ', blurb: 'プレイヤー、チーム、コミュニティの活動。' },
};

/** Site sections. MVP intentionally maps many categories onto few pages. */
export const SECTIONS = [
  {
    slug: 'news',
    label: 'ニュース',
    categories: ['NEWS', 'UPDATE', 'EVENT', 'TOURNAMENT'] as Category[],
    description: 'DDRの動き。ゲームの更新、イベント、そして競技シーン。'
  },
  {
    slug: 'charts',
    label: '譜面',
    categories: ['CHARTS'] as Category[],
    description: '新曲、新譜面、難易度の変更。',
  },
  {
    slug: 'data',
    label: 'データ',
    categories: ['DATA'] as Category[],
    description: 'BPM・難易度・譜面データを読み解く。',
  },
  {
    slug: 'culture',
    label: 'カルチャー',
    categories: ['CULTURE', 'COMMUNITY'] as Category[],
    description: '筐体のまわりにあるもの。音楽、プレイヤー、歴史。',
  },
] as const;

export type SectionSlug = (typeof SECTIONS)[number]['slug'];

export function sectionForCategory(category: Category): SectionSlug {
  const section = SECTIONS.find((s) => (s.categories as Category[]).includes(category));
  // Every category is assigned to exactly one section; NEWS is the safe default.
  return section?.slug ?? 'news';
}

export function getSection(slug: string) {
  return SECTIONS.find((s) => s.slug === slug);
}
