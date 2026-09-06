import type { Mood, Speaker } from '../content/dialogue';

export const CHARACTER_POSES = ['default', 'explain', 'think', 'celebrate'] as const;
export type CharacterPose = (typeof CHARACTER_POSES)[number];
export type CharacterPoses = Partial<Record<Speaker, CharacterPose>>;

export const POSE_IMAGES: Record<CharacterPose, string> = {
  default: 'images/studio/mono-wire-characters.webp',
  explain: 'images/studio/mono-wire-pose-explain.webp',
  think: 'images/studio/mono-wire-pose-think.webp',
  celebrate: 'images/studio/mono-wire-pose-celebrate.webp',
};

export interface PoseScene {
  speaker?: Speaker;
  mood?: Mood;
  characterPoses?: CharacterPoses;
  resolvedCharacterPoses?: CharacterPoses;
}

/** A pose is held for the whole turn, never cycled by time or randomness. */
export function characterPose(scene: PoseScene, who: Speaker): CharacterPose {
  const resolved = scene.resolvedCharacterPoses?.[who];
  if (resolved) return resolved;
  const explicit = scene.characterPoses?.[who];
  if (explicit) return explicit;
  if (scene.speaker !== who) return 'default';
  if (who === 'WIRE') {
    if (scene.mood === 'think') return 'think';
    if (scene.mood === 'grin') return 'celebrate';
  }
  return 'explain';
}

/** Resolve once, after trimming: listeners keep their last on-screen pose.
 * Every frame then stands alone, including out-of-order preview seeks.
 */
export function resolveCharacterPoses<T extends PoseScene & { type: string }>(scenes: readonly T[]): (T & { resolvedCharacterPoses?: CharacterPoses })[] {
  let held: CharacterPoses = { WIRE: 'default', MONO: 'default' };
  return scenes.map((scene) => {
    if (scene.type !== 'turn') return scene;
    const who = scene.speaker ?? 'WIRE';
    held = { ...held, [who]: characterPose({ ...scene, speaker: who, resolvedCharacterPoses: undefined }, who) };
    return { ...scene, resolvedCharacterPoses: { ...held } };
  });
}
