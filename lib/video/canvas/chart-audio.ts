import { chartRanges, chartPlaybackSeconds } from '../chart-playback';
import type { ChartPlayback } from '../chart-model';
import type { SceneSequence } from '../scenes';
import { sceneStartFrames } from '../scenes';

/** The same ranges, rate and loop tail as chartFrame, in output seconds. */
export function chartClapEvents(playback: ChartPlayback, duration: number) {
  const { clip } = playback;
  const rate = playback.mode === 'focus' ? Math.min(0.5, clip.speed) : clip.speed;
  const cycle = chartPlaybackSeconds(playback);
  const events: { time: number; accent: boolean; ghost: boolean }[] = [];
  for (let loop = 0; loop < duration; loop += cycle) {
    let offset = loop;
    for (const range of chartRanges(playback)) {
      clip.chart.events.forEach((event, i) => {
        const sourceTime = clip.eventTimes[i];
        if (sourceTime === undefined || sourceTime < range.start || sourceTime >= range.end) return;
        const time = offset + (sourceTime - range.start) / rate;
        if (time >= duration || !event.panels.length) return;
        const ghost = event.panels.every((p) => event.ghostPanels.includes(p));
        events.push({ time, accent: event.panels.length > 1, ghost });
      });
      offset += (range.end - range.start) / rate;
    }
  }
  return events;
}

export function chartAudioRegions(sequence: SceneSequence) {
  const starts = sceneStartFrames(sequence);
  return sequence.scenes.flatMap((scene, i) => {
    if (!scene.chartPlayback) return [];
    const duration = scene.durationInFrames / sequence.fps;
    const events = chartClapEvents(scene.chartPlayback, duration);
    return events.length ? [{ start: (starts[i] ?? 0) / sequence.fps, duration, events }] : [];
  });
}

/** Hold the bed down across the phrase, with smooth entry and recovery. */
export function chartBgmGain(second: number, regions: { start: number; duration: number }[]) {
  let gain = 1;
  for (const region of regions) {
    const end = region.start + region.duration;
    const envelope = second < region.start
      ? Math.max(0, 1 - (region.start - second) / 0.12)
      : second <= end ? 1 : Math.max(0, 1 - (second - end) / 0.35);
    gain = Math.min(gain, 1 - envelope * 0.8);
  }
  return gain;
}
