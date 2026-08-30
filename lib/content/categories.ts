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
export const CATEGORY_META: Record<
  Category,
  { glyph: string; label: string; blurb: string }
> = {
  NEWS: { glyph: '▲', label: 'News', blurb: 'Reported news from the DDR world.' },
  UPDATE: { glyph: '▶', label: 'Update', blurb: 'Game, cabinet and service updates.' },
  CHARTS: { glyph: '◀', label: 'Charts', blurb: 'New songs, new charts, difficulty changes.' },
  EVENT: { glyph: '▼', label: 'Event', blurb: 'Location tests, campaigns and in-game events.' },
  TOURNAMENT: { glyph: '◆', label: 'Tournament', blurb: 'Competitive play and results.' },
  DATA: { glyph: '■', label: 'Data', blurb: 'BPM, difficulty and chart data analysis.' },
  CULTURE: { glyph: '●', label: 'Culture', blurb: 'The scene, the music, the history.' },
  COMMUNITY: { glyph: '◎', label: 'Community', blurb: 'Players, crews and community projects.' },
};

/** Site sections. MVP intentionally maps many categories onto few pages. */
export const SECTIONS = [
  {
    slug: 'news',
    label: 'News',
    categories: ['NEWS', 'UPDATE', 'EVENT', 'TOURNAMENT'] as Category[],
    description: 'Reported DDR news: game updates, events and competitive play.',
  },
  {
    slug: 'charts',
    label: 'Charts',
    categories: ['CHARTS'] as Category[],
    description: 'New songs, new charts and difficulty changes.',
  },
  {
    slug: 'data',
    label: 'Data',
    categories: ['DATA'] as Category[],
    description: 'BPM, difficulty and chart data, examined.',
  },
  {
    slug: 'culture',
    label: 'Culture',
    categories: ['CULTURE', 'COMMUNITY'] as Category[],
    description: 'The scene around the machine: music, players and history.',
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
