import type { ParsedChart, FootStep } from '../vendor/step-analyzer/chart';
import type { TimingSeg } from '../vendor/step-analyzer/timing';

export interface ChartClip {
  url: string;
  title: string;
  chart: ParsedChart;
  footsteps: FootStep[];
  timeline: TimingSeg[];
  eventTimes: number[];
  highlights: number[];
  comments: Record<string, string>;
  speed: number;
  hispeed: number;
}

export interface ChartPlayback {
  clip: ChartClip;
  mode: 'overview' | 'focus';
}
