import { expect, it } from 'vitest';
import { characterPose, POSE_IMAGES, resolveCharacterPoses } from '../lib/video/character-poses';
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

it('changes only the speaker, retaining listener poses across photos and other scenes', () => {
  const scenes = resolveCharacterPoses([
    { type: 'turn', speaker: 'WIRE' as const, mood: 'grin' as const },
    { type: 'image' },
    { type: 'turn', speaker: 'MONO' as const, characterPoses: { WIRE: 'think' as const } },
    { type: 'turn', speaker: 'WIRE' as const, mood: 'think' as const },
  ]);
  expect(scenes[0]?.resolvedCharacterPoses).toEqual({ WIRE: 'celebrate', MONO: 'default' });
  expect(scenes[2]?.resolvedCharacterPoses).toEqual({ WIRE: 'celebrate', MONO: 'explain' });
  expect(scenes[3]?.resolvedCharacterPoses).toEqual({ WIRE: 'think', MONO: 'explain' });
  // No renderer history is needed when seeking directly to the last turn.
  expect(characterPose(scenes[3]!, 'MONO')).toBe('explain');
});
