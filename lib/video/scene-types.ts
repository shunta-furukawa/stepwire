/**
 * The scene types, as a value.
 *
 * `SceneType` is a union in `scenes.ts` and unions vanish at runtime, so a test
 * cannot ask "did every renderer cover all of them". This is the same list,
 * kept as data — and `scenes.ts` derives its type from here, so the two cannot
 * disagree.
 */
export const SCENE_TYPES = [
  'intro',
  'headline',
  'news',
  'context',
  'impact',
  'figure',
  'source',
  'outro',
  'narration',
] as const;

export type SceneType = (typeof SCENE_TYPES)[number];
