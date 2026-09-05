/**
 * The scene types, as a value.
 *
 * `SceneType` is a union in `scenes.ts` and unions vanish at runtime, so a test
 * cannot ask "did every renderer cover all of them". This is the same list,
 * kept as data — and `scenes.ts` derives its type from here, so the two cannot
 * disagree.
 *
 * There is no `intro`. A film for a feed has about two seconds to earn the
 * next two, and a brand ident spends them on the brand. The headline opens;
 * the ident is the sign-off.
 */
export const SCENE_TYPES = [
  'stats',
  'headline',
  'news',
  'image',
  'context',
  'impact',
  'figure',
  'narration',
  'source',
  'outro',
] as const;

export type SceneType = (typeof SCENE_TYPES)[number];
