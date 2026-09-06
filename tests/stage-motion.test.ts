import { expect, it } from 'vitest';
import { stagePerformance } from '../lib/video/canvas/stage-motion';
import { planReveal } from '../lib/video/reveal';
import type { Scene } from '../lib/video/scenes';

const turn: Scene = {
  id: 'wire', type: 'turn', speaker: 'WIRE', mood: 'neutral', index: 0, total: 2,
  durationInFrames: 120, text: 'テストの会話です。',
  reveal: planReveal('テストの会話です。', 'body', 30),
};

it('moves the mouth while copy types, then rests during the reading hold', () => {
  expect(stagePerformance({ frame: 5, fps: 30 }, turn).talking).toBe(true);
  expect(stagePerformance({ frame: 90, fps: 30 }, turn).mouth).toBe(0);
  expect(stagePerformance({ frame: 5, fps: 30 }, { ...turn, speaker: 'MONO' }).mouth).toBe(0);
});

it('reconstructs expressions on seek and uses seconds for blinking at any fps', () => {
  const frame = { frame: 120, fps: 30 };
  const initial = stagePerformance(frame, turn);
  stagePerformance({ frame: 900, fps: 30 }, turn);
  expect(stagePerformance(frame, turn)).toEqual(initial);
  expect(initial.blink).toBe(true);
  expect(stagePerformance({ frame: 240, fps: 60 }, turn).blink).toBe(true);
  expect(stagePerformance({ frame: 126, fps: 30 }, turn).blink).toBe(false);
});
