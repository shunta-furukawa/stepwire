import { describe, expect, it } from 'vitest';
import { prepareChartClip } from '../lib/content/chart-clip';
import { chartClapEvents, chartBgmGain } from '../lib/video/canvas/chart-audio';
import { chartFrame } from '../lib/video/chart-playback';

describe('chart audio clock and background ducking', () => {
  it('aligns claps with the visual clock through BPM changes, STOP, slow replay and loops', () => {
    const clip = prepareChartClip('https://step-analyzer-beta.vercel.app/?n=1000010000100001-1000010000100001&b=120,4:240&s=2:1&hl=192', 'Timing');
    for (const mode of ['overview', 'focus'] as const) {
      const playback = { clip, mode };
      const events = chartClapEvents(playback, 18);
      expect(events.length).toBeGreaterThan(8);
      for (const event of events) {
        const visual = chartFrame(playback, event.time * 1000, 1000);
        expect(visual.hit).toBe(true);
        expect(clip.eventTimes[visual.index]).toBeCloseTo(visual.sourceTime, 6);
      }
      expect(events.every((event) => event.time < 18)).toBe(true);
    }
  });
  it('uses one accented clap for a jump and a stomp for a ghost step', () => {
    const clip = prepareChartClip('https://step-analyzer-beta.vercel.app/?n=1100500000000000&b=120', 'Notes');
    const events = chartClapEvents({ clip, mode: 'overview' }, 2);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ time: 0, accent: true, ghost: false });
    expect(events[1]).toMatchObject({ time: 0.5, ghost: true });
  });
  it('holds BGM at 20 percent and fades smoothly without pumping between adjacent chart cards', () => {
    const regions = [{ start: 2, duration: 3 }, { start: 5, duration: 2 }];
    expect(chartBgmGain(1, regions)).toBe(1);
    expect(chartBgmGain(1.94, regions)).toBeCloseTo(0.6);
    expect(chartBgmGain(2, regions)).toBeCloseTo(0.2);
    expect(chartBgmGain(5, regions)).toBeCloseTo(0.2);
    expect(chartBgmGain(7.175, regions)).toBeCloseTo(0.6);
    expect(chartBgmGain(7.4, regions)).toBe(1);
    expect(chartBgmGain(3, [])).toBe(1);
  });
});
