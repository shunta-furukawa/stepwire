import { expect, it } from 'vitest';
import { characterPose, POSE_IMAGES } from '../lib/video/character-poses';
import { sceneImageSources } from '../lib/video/canvas/images';
import { videoOverrideSchema } from '../lib/content/schema';

it('switches arm illustrations by speaker and authored WIRE mood', () => {
  expect(characterPose({ speaker: 'WIRE', mood: 'grin' }, 'WIRE')).toBe('celebrate');
  expect(characterPose({ speaker: 'WIRE', mood: 'think' }, 'WIRE')).toBe('think');
  expect(characterPose({ speaker: 'WIRE' }, 'MONO')).toBe('default');
  expect(characterPose({ speaker: 'MONO' }, 'MONO')).toBe('explain');
});

it('lets either character use all poses without changing dialogue or facial mood', () => {
  const result = videoOverrideSchema.parse({ scenes: { 'context-2': { characterPoses: { MONO: 'celebrate', WIRE: 'think' } } } });
  const scene = { speaker: 'MONO' as const, ...result.scenes!['context-2'] };
  expect(characterPose(scene, 'MONO')).toBe('celebrate');
  expect(characterPose(scene, 'WIRE')).toBe('think');
  expect(videoOverrideSchema.safeParse({ scenes: { a: { characterPoses: { MONO: 'invalid' } } } }).success).toBe(false);
});

it('preloads selected variants plus the registered default fallback', () => {
  const sources = sceneImageSources([{ type: 'turn', speaker: 'WIRE', mood: 'think' }]);
  expect(sources).toContain(POSE_IMAGES.think);
  expect(sources).toContain(POSE_IMAGES.default);
  expect(sources).not.toContain(POSE_IMAGES.celebrate);
  expect(sceneImageSources([{ type: 'headline' }])).not.toContain(POSE_IMAGES.explain);
});
