import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { prepareChartClip } from '../lib/content/chart-clip';
import { chartFrame, chartPlaybackSeconds } from '../lib/video/chart-playback';
import { chartAudioRegions } from '../lib/video/canvas/chart-audio';
import { mixSoundtrack } from '../lib/video/canvas/mix';
import { parseArticle, toVideoInput } from '../lib/content/article';
import { buildSceneSequence, type SceneSequence } from '../lib/video/scenes';
import { thumbnailPlan, thumbnailImageSources } from '../lib/video/canvas/thumbnail';
import { sceneImageSources } from '../lib/video/canvas/images';

describe('AB chart exports', () => {
  it('does not turn an equal-speed reinterpretation into a second song', () => {
    const path = 'content/articles/2026-09-11-miserable-life-footwork.mdx';
    const article = toVideoInput(parseArticle(readFileSync(path, 'utf8'), { filePath: path }));
    expect(thumbnailPlan(article).charts?.map(g => g.title)).toEqual(['miserable life and worthless thoughts']);
    const scenes = buildSceneSequence(article, 'STEPWIRE_NEWS').scenes;
    expect(scenes.filter(s => s.chartPlayback).every(s => s.chartGuide?.title === 'miserable life and worthless thoughts')).toBe(true);
  });
  it('shares timing, highlights and total length, while preserving independent foot overrides', () => {
    const clip = prepareChartClip('https://step-analyzer-beta.vercel.app/?n=10000100&n2=00010010-10000000&b=120,4:240&s=2:1&f=0L&f2=0R&df=417&df2=315&hl=0&tr=mirror', 'AB');
    expect(clip.difficultyLabel).toBe('鬼17');
    expect(clip.comparison?.difficultyLabel).toBe('激15');
    expect(clip.footsteps[0]?.feet.filter(Boolean)).toEqual(['L']);
    expect(clip.comparison?.footsteps[0]?.feet.filter(Boolean)).toEqual(['R']);
    const other = clip.comparison!;
    for (const mode of ['overview', 'focus'] as const) {
      expect(chartPlaybackSeconds({ clip, mode })).toBe(chartPlaybackSeconds({ clip: other, mode }));
      for (const frame of [0, 22, 100, 210, 800]) expect(chartFrame({ clip, mode }, frame, 30).beat).toBeCloseTo(chartFrame({ clip: other, mode }, frame, 30).beat, 8);
    }
  });
  it('places A-only and B-only claps in separate channels without treating shocks as steps', () => {
    const clip = prepareChartClip('https://step-analyzer-beta.vercel.app/?n=10000000MMMM0000&n2=0000000100000000&b=120', 'AB');
    const sequence: SceneSequence = { fps: 30, composition: 'STEPWIRE_NEWS', durationInFrames: 60, scenes: [{ id: 'ab', index: 0, total: 1, type: 'turn', durationInFrames: 60, chartPlayback: { clip, mode: 'overview' } }] };
    const region = chartAudioRegions(sequence)[0]!;
    expect(region.events.map(e => e.time)).toEqual([0]);
    expect(region.eventsB?.map(e => e.time)).toEqual([0.5]);
    const mix = mixSoundtrack({ sequence, sampleRate: 8000, tickGain: 0 });
    expect(mix.channels).toHaveLength(2);
    const energy = (channel: number, start: number) => mix.channels![channel]!.slice(start, start + 400).reduce((s,v) => s + Math.abs(v), 0);
    expect(energy(0, 0)).toBeGreaterThan(0); expect(energy(1, 0)).toBe(0);
    expect(energy(0, 4000)).toBe(0); expect(energy(1, 4000)).toBeGreaterThan(0);
  });
  it('keeps both supplied charts and the last explanation in the four-minute draft', () => {
    const path = 'content/articles/2026-09-19-triple-tribe-zero-ab.mdx';
    const a = parseArticle(readFileSync(path,'utf8'), { filePath: path });
    const counts = a.sources.slice(1).map(s => {
      const clip = prepareChartClip(s.url, s.title);
      return [clip, clip.comparison!].map(c => ({ steps: c.chart.events.filter(e => e.panels.length && !e.shock).length, shocks: c.chart.shocks.length }));
    });
    expect(counts).toEqual([[{steps:717,shocks:0},{steps:567,shocks:0}],[{steps:609,shocks:50},{steps:659,shocks:0}]]);
    const seq = buildSceneSequence(toVideoInput(a), 'STEPWIRE_NEWS');
    const plan = thumbnailPlan(toVideoInput(a));
    expect(plan.charts?.map(g => [g.title, g.level, g.comparison?.level])).toEqual([
      ['ZENDEGI DANCE', '17', '15'], ['Daisycutter', '17', '17'],
    ]);
    expect(new Set(plan.charts?.map(g => g.jacket.src)).size).toBe(2);
    for (const guide of plan.charts ?? []) {
      expect(thumbnailImageSources(plan)).toContain(guide.jacket.src);
      expect(sceneImageSources(seq.scenes)).toContain(guide.jacket.src);
    }
    const zendegi = seq.scenes.filter(s => s.type === 'turn' && s.id.startsWith('context-'));
    expect(zendegi.length).toBeGreaterThan(0);
    expect(zendegi.every(s => s.chartGuide?.title === 'ZENDEGI DANCE')).toBe(true);
    const daisyIntro = seq.scenes.find(s => s.text?.startsWith('DaisycutterはBPM191'));
    expect(daisyIntro?.chartPlayback).toBeUndefined();
    expect(daisyIntro?.chartGuide?.title).toBe('Daisycutter');
    expect(seq.scenes.filter(s => s.chartPlayback).every(s => !!s.chartPlayback?.clip.comparison)).toBe(true);
    expect(seq.scenes.some(s => s.text?.includes('負担の種類が違う'))).toBe(true);
    expect(seq.durationInFrames / seq.fps).toBeLessThan(260);
    expect(a.status).toBe('draft');
  });
});
