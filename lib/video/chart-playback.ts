import { beatAtTime, timeAtBeat } from '../vendor/step-analyzer/timing';
import { PANEL_COORDS } from '../vendor/step-analyzer/chart';
import type { ChartPlayback } from './chart-model';

export function chartRanges(playback: ChartPlayback) {
  const { clip, mode } = playback;
  const measures = [...new Set(clip.highlights.map((tick) => Math.floor(tick / 192)))].sort((a, b) => a - b);
  const beats = mode === 'focus' && measures.length
    ? measures.map((m) => [m * 4, Math.min((m + 1) * 4, clip.chart.totalBeats)] as const)
    : [[0, clip.chart.totalBeats] as const];
  return beats.map(([start, end]) => ({ start: timeAtBeat(clip.timeline, start), end: timeAtBeat(clip.timeline, end) }));
}

export function chartPlaybackSeconds(playback: ChartPlayback): number {
  const rate = playback.mode === 'focus' ? Math.min(0.5, playback.clip.speed) : playback.clip.speed;
  return chartRanges(playback).reduce((sum, r) => sum + (r.end - r.start) / rate, 0) + 0.8;
}

/** Every frame stands alone, including backwards seeks and slow replays. */
export function chartFrame(playback: ChartPlayback, frame: number, fps: number) {
  const { clip, mode } = playback;
  const rate = mode === 'focus' ? Math.min(0.5, clip.speed) : clip.speed;
  const ranges = chartRanges(playback);
  const total = Math.max(0.001, ranges.reduce((sum, r) => sum + r.end - r.start, 0));
  const cycle = total / rate + 0.8;
  const elapsed = Math.max(0, frame / fps) % cycle;
  let remaining = Math.min(elapsed * rate, total - 0.000001);
  let sourceTime = 0;
  for (const range of ranges) {
    sourceTime = range.start + Math.min(remaining, range.end - range.start);
    if (remaining < range.end - range.start) break;
    remaining -= range.end - range.start;
  }
  const beat = beatAtTime(clip.timeline, sourceTime);
  // Binary search avoids scanning a long chart on every exported frame.
  let lo = 0; let hi = clip.eventTimes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((clip.eventTimes[mid] ?? Infinity) <= sourceTime + 1e-8) lo = mid + 1;
    else hi = mid;
  }
  const index = lo - 1;
  const step = clip.footsteps[index];
  const next = clip.footsteps[index + 1];
  const gap = (clip.eventTimes[index + 1] ?? Infinity) - sourceTime;
  const travel = Math.min(0.25 * rate, ((clip.eventTimes[index + 1] ?? Infinity) - (clip.eventTimes[index] ?? 0)) * 0.8);
  const mix = next && gap < travel ? Math.max(0, 1 - gap / travel) : 0;
  const position = (foot: 'left' | 'right') => {
    const key = foot === 'left' ? 'leftPos' : 'rightPos';
    const a = PANEL_COORDS[step?.[key] ?? (foot === 'left' ? 0 : 3)] ?? { x: 0, y: 0 };
    const b = PANEL_COORDS[next?.[key] ?? step?.[key] ?? (foot === 'left' ? 0 : 3)] ?? a;
    return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix };
  };
  return { beat, sourceTime, index, step, rate, left: position('left'), right: position('right'),
    hit: sourceTime - (clip.eventTimes[index] ?? -Infinity) < 0.12 * rate };
}
