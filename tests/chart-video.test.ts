import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { prepareChartClip } from '../lib/content/chart-clip';
import { parseArticle, toVideoInput } from '../lib/content/article';
import { buildSceneSequence } from '../lib/video/scenes';
import { chartFrame, chartPlaybackSeconds } from '../lib/video/chart-playback';
import { STEP_ANALYZER_ORIGIN } from '../lib/content/step-analyzer';

const notes = '1000010000100001-1000001001000001';
const url = `${STEP_ANALYZER_ORIGIN}/?n=${notes}&b=120&f=192R&hl=192-240`;
const sample = () => parseArticle(readFileSync('content/fixtures/sample-chart-conversation.mdx', 'utf8'), { filePath: 'content/fixtures/sample-chart-conversation.mdx', forceFixture: true });

describe('chart video data and frame clock', () => {
  it('decodes compressed and raw URLs to the same chart and pinned foot assignment', () => {
    const raw = prepareChartClip(url, 'Practice');
    const compressed = prepareChartClip(`${STEP_ANALYZER_ORIGIN}/?d=${deflateRawSync(notes).toString('base64url')}&b=120&f=192R&hl=192-240`, 'Practice');
    expect(compressed.chart).toEqual(raw.chart);
    expect(compressed.footsteps).toEqual(raw.footsteps);
    expect(raw.footsteps[4]?.feet[0]).toBe('R');
  });

  it('preserves holds, jumps, ghost/shock data and transforms before assigning feet', () => {
    const clip = prepareChartClip(`${STEP_ANALYZER_ORIGIN}/?n=2000010000103001-100150000000MMMM&tr=mirror`, 'Special notes');
    expect(clip.chart.holds[0]?.panel).toBe(3);
    expect(clip.chart.events.some((event) => event.panels.length === 2)).toBe(true);
    expect(clip.chart.events.some((event) => event.ghostPanels.length > 0)).toBe(true);
    expect(clip.chart.shocks).toHaveLength(1);
  });

  it('holds the beat during STOP and applies a BPM change', () => {
    const clip = prepareChartClip(`${STEP_ANALYZER_ORIGIN}/?n=${notes}&b=120,4:240&s=2:1`, 'Timing');
    expect(chartFrame({ clip, mode: 'overview' }, 45, 30).beat).toBe(2);
    expect(chartFrame({ clip, mode: 'overview' }, 105, 30).beat).toBeCloseTo(6);
  });

  it('replays only highlighted measures at half speed with deterministic backwards seeks', () => {
    const playback = { clip: prepareChartClip(url, 'Focus'), mode: 'focus' as const };
    expect(chartFrame(playback, 0, 30).beat).toBe(4);
    expect(chartFrame(playback, 30, 30).beat).toBe(5);
    expect(chartPlaybackSeconds(playback)).toBeCloseTo(4.8);
    const frame = chartFrame(playback, 17, 30);
    chartFrame(playback, 99, 30);
    expect(chartFrame(playback, 17, 30)).toEqual(frame);
    expect(frame.rate).toBe(0.5);
  });

  it('rejects invalid and oversized compressed data without fetching a remote resource', () => {
    expect(() => prepareChartClip(`${STEP_ANALYZER_ORIGIN}/?d=broken`, 'Bad')).toThrow();
    const large = deflateRawSync('1'.repeat(100_001)).toString('base64url');
    expect(() => prepareChartClip(`${STEP_ANALYZER_ORIGIN}/?d=${large}`, 'Large')).toThrow();
  });

  it('projects an embedded chart into conversation scenes for the shared renderer', () => {
    const article = toVideoInput(sample());
    const scenes = buildSceneSequence(article, 'STEPWIRE_NEWS', 30).scenes;
    const turns = scenes.filter((scene) => scene.type === 'turn');
    expect(turns.map((scene) => scene.speaker)).toEqual(['WIRE', 'MONO', 'WIRE', 'MONO']);
    expect(turns.map((scene) => scene.chartPlayback?.mode)).toEqual(['overview', 'focus', 'focus', 'focus']);
    expect(turns[0]?.durationInFrames).toBeGreaterThanOrEqual(264);
    expect(scenes.find((scene) => scene.type === 'impact')?.chartPlayback).toBeUndefined();
    expect(article.context).not.toContain('@[step-analyzer]');
    expect(JSON.parse(JSON.stringify(article))).toEqual(article);
  });

  it('keeps chart state in a selected Short conversation without changing its 45-second ceiling', () => {
    const short = buildSceneSequence(toVideoInput(sample()), 'STEPWIRE_SHORT', 30);
    expect(short.durationInFrames).toBeLessThanOrEqual(45 * 30);
    expect(short.scenes.some((scene) => scene.chartPlayback)).toBe(true);
  });

  it('clears chart context at headings and gives a trailing embed its own card', () => {
    const article = toVideoInput(sample());
    const clip = prepareChartClip(url, 'Standalone');
    if (!article.blocks) throw new Error('sample blocks missing');
    article.blocks.context = [
      { kind: 'chart', clip }, { kind: 'turn', speaker: 'WIRE', mood: 'neutral', text: 'Chart.' },
      { kind: 'chart-end' }, { kind: 'turn', speaker: 'MONO', mood: 'neutral', text: 'Next topic.' },
      { kind: 'chart', clip },
    ];
    const scenes = buildSceneSequence(article, 'STEPWIRE_NEWS', 30).scenes;
    expect(scenes.find((scene) => scene.text === 'Next topic.')?.chartPlayback).toBeUndefined();
    expect(scenes.find((scene) => scene.text === 'Standalone')?.chartPlayback?.mode).toBe('overview');
  });
});
