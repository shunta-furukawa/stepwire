import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArticle, toVideoInput } from '../lib/content/article';
import { prepareChartClip } from '../lib/content/chart-clip';
import { buildSceneSequence } from '../lib/video/scenes';

const article = () => parseArticle(readFileSync('content/articles/2026-09-11-miserable-life-footwork.mdx', 'utf8'), { filePath: 'content/articles/2026-09-11-miserable-life-footwork.mdx' });

describe('miserable life chart explainer', () => {
  it('preserves every note time in the BPM157 comparison', () => {
    const blocks = article().sections.playerImpact.blocks.filter((block) => block.type === 'step-analyzer');
    const clips = blocks.map((block) => prepareChartClip(block.url, block.title));
    expect(clips).toHaveLength(2);
    const [original, flat] = clips;
    expect(flat!.eventTimes).toHaveLength(original!.eventTimes.length);
    flat!.eventTimes.forEach((time, i) => expect(time).toBeCloseTo(original!.eventTimes[i]!, 6));
    expect(flat!.chart.events.map((event) => event.panels)).toEqual(original!.chart.events.map((event) => event.panels));
  });
  it('matches the published statistics to the supplied data and keeps the final dialogue within four minutes', () => {
    const a = article();
    const full = prepareChartClip(a.sources[1]!.url, 'Full');
    expect(full.chart.events).toHaveLength(735);
    expect(full.chart.events.reduce((sum, event) => sum + event.panels.length, 0)).toBe(765);
    expect(full.chart.holds).toHaveLength(26);
    const sequence = buildSceneSequence(toVideoInput(a), 'STEPWIRE_NEWS');
    expect(sequence.durationInFrames / sequence.fps).toBeGreaterThanOrEqual(210);
    expect(sequence.durationInFrames / sequence.fps).toBeLessThanOrEqual(240);
    expect(sequence.scenes[1]?.figure?.kind).toBe('stat');
    expect(sequence.scenes.some((scene) => scene.text?.includes('ちょっと時間がかかる'))).toBe(true);
    expect(sequence.scenes.some((scene) => scene.text?.includes('実際に間隔が広がる切り替わり'))).toBe(true);
    expect(a.status).toBe('draft');
  });
});
