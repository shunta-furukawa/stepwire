import { expect, it } from 'vitest';
import { actorPose } from '../lib/video/canvas/stage-actors';
import { planReveal } from '../lib/video/reveal';
import type { Scene } from '../lib/video/scenes';

const turn: Scene = {
  id: 'turn', type: 'turn', speaker: 'WIRE', mood: 'grin', index: 0, total: 2,
  durationInFrames: 240, reveal: planReveal('a'.repeat(160), 'body', 30),
};

it('returns to its registered pose at both sides of a cut', () => {
  for (const who of ['WIRE', 'MONO'] as const) {
    for (const frame of [0, 239]) {
      const pose = actorPose({ frame, fps: 30 }, turn, who);
      expect(Math.abs(pose.x) + Math.abs(pose.y) + Math.abs(pose.rotation)).toBe(0);
      expect(pose.scaleY).toBe(1);
    }
  }
});

it('gives MONO and WIRE distinct speaking and listening motion', () => {
  const d = { frame: 40, fps: 30 };
  expect(actorPose(d, turn, 'MONO')).not.toEqual(actorPose(d, { ...turn, speaker: 'MONO' }, 'MONO'));
  expect(actorPose(d, turn, 'WIRE')).not.toEqual(actorPose(d, turn, 'MONO'));
  expect(actorPose(d, turn, 'WIRE')).toEqual(actorPose(d, turn, 'WIRE'));
});

it('keeps motion small enough for face registration and media margins', () => {
  for (let frame = 0; frame < 240; frame++) {
    for (const who of ['WIRE', 'MONO'] as const) {
      const pose = actorPose({ frame, fps: 30 }, turn, who);
      expect(Math.abs(pose.rotation)).toBeLessThan(0.03);
      expect(Math.abs(pose.x)).toBeLessThan(8);
      expect(Math.abs(pose.y)).toBeLessThan(12);
      expect(Math.abs(pose.scaleY - 1)).toBeLessThan(0.012);
    }
  }
});
