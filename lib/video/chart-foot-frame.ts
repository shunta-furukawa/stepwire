import type { FootSceneProps } from '../vendor/step-analyzer/footScene';
import type { ChartPlayback } from './chart-model';
import { chartFrame } from './chart-playback';

/** Pose and time only: WebGL rendering consumes this same plan when seeking or encoding. */
export function chartFootFrame(playback: ChartPlayback, frame: number, fps: number) {
  const { clip } = playback;
  const state = chartFrame(playback, frame, fps);
  const age = (state.sourceTime - (clip.eventTimes[state.index] ?? -Infinity)) / state.rate;
  const current = clip.footsteps[state.index];
  const event = clip.chart.events[state.index];
  const pose = (index: number): FootSceneProps => {
    const step = clip.footsteps[index];
    return {
      leftPos: step?.leftPos ?? 0, rightPos: step?.rightPos ?? 3,
      facing: step?.facing ?? 0, oneFoot: step?.stretch ?? null,
      liftedFoot: step?.liftedFoot ?? null,
      stepping: age < 0.18 ? event?.panels ?? [] : [],
      feet: current?.feet ?? [null, null, null, null],
      heldFeet: current?.heldFeet ?? [], stepKey: state.index,
      playSpeed: state.rate,
    };
  };
  const nextTime = clip.eventTimes[state.index + 1];
  const gap = nextTime === undefined ? Infinity : (nextTime - (clip.eventTimes[state.index] ?? 0)) / state.rate;
  const travel = Math.min(0.25, Math.max(0.09, gap * 1.8), gap * 0.8);
  const until = nextTime === undefined ? Infinity : (nextTime - state.sourceTime) / state.rate;
  const approaching = Number.isFinite(until) && until <= travel + 0.04;
  return {
    from: pose(approaching ? state.index : state.index - 1),
    to: pose(approaching ? state.index + 1 : state.index),
    progress: approaching ? Math.min(1, Math.max(0, 1 - (until - 0.04) / Math.max(0.001, travel))) : 1,
    nowMs: 1000 + state.sourceTime / state.rate * 1000,
    hitAgeMs: age * 1000,
  };
}
