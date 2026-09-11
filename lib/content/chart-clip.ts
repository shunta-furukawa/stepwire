import { inflateRawSync } from 'node:zlib';
import { stepAnalyzerUrlSchema } from './step-analyzer';
import { parseCompact, assignFeet } from '../vendor/step-analyzer/chart';
import { parseOverrides, parseHighlights, parseComments } from '../vendor/step-analyzer/edit';
import { parseBpmParam, parseStopsParam, buildTimeline, timeAtBeat } from '../vendor/step-analyzer/timing';
import { parseTransform, applyTransform } from '../vendor/step-analyzer/transform';
import type { ChartClip } from '../video/chart-model';

/** Parse on the content boundary; export never fetches or records an iframe. */
export function prepareChartClip(input: string, title: string): ChartClip {
  const url = stepAnalyzerUrlSchema.parse(input);
  const p = new URL(url).searchParams;
  const raw = p.get('n') || inflateRawSync(Buffer.from(p.get('d') ?? '', 'base64url'), { maxOutputLength: 100_000 }).toString('utf8');
  if (!/^[0123456M-]+$/.test(raw) || raw.length > 100_000) throw new Error('動画用の譜面データが不正です');
  const perm = parseTransform(p.get('tr'));
  const chart = parseCompact(perm ? applyTransform(raw, perm) : raw);
  if (!chart.events.length) throw new Error('動画用の譜面にはノーツが必要です');
  const timeline = buildTimeline(parseBpmParam(p.get('b') ?? undefined), parseStopsParam(p.get('s') ?? undefined), chart.totalBeats);
  const choices = [0.25, 0.5, 0.75, 1];
  const requested = Number(p.get('sp')) || 1;
  const speed = choices.reduce((a, b) => Math.abs(a - requested) <= Math.abs(b - requested) ? a : b);
  return {
    url, title, chart, timeline,
    footsteps: assignFeet(chart.events, parseOverrides(p.get('f') ?? undefined), chart.holds),
    eventTimes: chart.events.map((event) => timeAtBeat(timeline, event.row.beat)),
    highlights: [...parseHighlights(p.get('hl') ?? undefined)].filter((tick) => tick < chart.totalBeats * 48),
    comments: Object.fromEntries(parseComments(p.get('hc') ?? undefined)),
    speed, hispeed: Math.min(6, Math.max(0.25, Math.round((Number(p.get('hs')) || 1) * 20) / 20)),
  };
}
