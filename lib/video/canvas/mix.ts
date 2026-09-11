import type { Scene, SceneSequence } from '../scenes';
import { sceneStartFrames } from '../scenes';
import { synthAccentTick, synthTick, type TickVoice } from './sfx';
import { chartAudioRegions, chartBgmGain } from './chart-audio';
import { renderClapTrackSamples } from '../../vendor/step-analyzer/clap';

/**
 * The soundtrack: music under the ticks.
 *
 * One mono buffer for the whole film, built from the scene sequence — so the
 * tick for a character lands on the frame the reveal plan put it on, on every
 * renderer, because they all read the same plan. There is no voice in it: the
 * recording was the script.
 */

export interface Soundtrack {
  samples: Float32Array;
  sampleRate: number;
  /** How many ticks were placed, for the lab to report. */
  ticks: number;
}

export interface MixOptions {
  sequence: SceneSequence;
  sampleRate: number;
  /** Decoded music, looped under the film and faded out at the end. */
  bgm?: { buffer: AudioBuffer; gain: number };
  /** One-shot music excerpts; their scene-aligned starts are resolved by Studio. */
  musicClips?: {
    buffer: AudioBuffer;
    startInSeconds: number;
    sourceStartSeconds: number;
    durationInSeconds: number;
    gain: number;
  }[];
  /** Level of the ticks, 0–1. */
  tickGain?: number;
}

/** Whose keys a scene's characters land on. */
export function tickVoiceOf(scene: Pick<Scene, 'type' | 'speaker'>): TickVoice {
  if (scene.type !== 'turn') return 'narration';
  return scene.speaker === 'MONO' ? 'mono' : 'wire';
}

/** Every tick in the film: where it lands, and in whose voice. */
export function tickEvents(sequence: SceneSequence, sampleRate: number): { offset: number; voice: TickVoice }[] {
  const starts = sceneStartFrames(sequence);
  const events: { offset: number; voice: TickVoice }[] = [];
  sequence.scenes.forEach((scene, index) => {
    if (!scene.reveal) return;
    const start = starts[index]!;
    const voice = tickVoiceOf(scene);
    for (const frame of scene.reveal.ticks) {
      events.push({ offset: Math.round(((start + frame) / sequence.fps) * sampleRate), voice });
    }
  });
  return events;
}

/** Every tick in the film, as a sample offset. */
export function tickOffsets(sequence: SceneSequence, sampleRate: number): number[] {
  return tickEvents(sequence, sampleRate).map((event) => event.offset);
}

/** Every eighth tick is the heavy one. */
const ACCENT_EVERY = 8;
/** Seconds the music takes to fade at the end of the film. */
const FADE_SECONDS = 1.6;

export function mixSoundtrack(options: MixOptions): Soundtrack {
  const { sequence, sampleRate, bgm, musicClips = [], tickGain = 0.55 } = options;
  const length = Math.ceil((sequence.durationInFrames / sequence.fps) * sampleRate);
  const out = new Float32Array(length);
  const chartRegions = chartAudioRegions(sequence);

  if (bgm) {
    // Mono mix of whatever the file is, resampled by nearest sample if the
    // rates differ. Music under a click track does not need better than that.
    const source = bgm.buffer;
    const ratio = source.sampleRate / sampleRate;
    const channels = Array.from({ length: source.numberOfChannels }, (_, c) => source.getChannelData(c));
    const fadeStart = length - Math.round(FADE_SECONDS * sampleRate);
    for (let i = 0; i < length; i += 1) {
      const at = Math.floor((i * ratio) % source.length);
      let sample = 0;
      for (const channel of channels) sample += channel[at] ?? 0;
      sample /= channels.length;
      const fade = i > fadeStart ? 1 - (i - fadeStart) / (length - fadeStart) : 1;
      const second = i / sampleRate;
      const underExcerpt = musicClips.some(
        (clip) => second >= clip.startInSeconds && second < clip.startInSeconds + clip.durationInSeconds,
      );
      const duck = Math.min(underExcerpt ? 0.16 : 1, chartBgmGain(second, chartRegions));
      out[i] = sample * bgm.gain * fade * duck;
    }
  }

  // Excerpts play once at their named scenes. A short edge fade avoids clicks
  // when a source begins away from a zero crossing.
  for (const clip of musicClips) {
    const source = clip.buffer;
    const ratio = source.sampleRate / sampleRate;
    const channels = Array.from({ length: source.numberOfChannels }, (_, c) => source.getChannelData(c));
    const outputStart = Math.round(clip.startInSeconds * sampleRate);
    const sourceStart = Math.round(clip.sourceStartSeconds * source.sampleRate);
    const requested = Math.round(clip.durationInSeconds * sampleRate);
    const available = Math.max(0, Math.floor((source.length - sourceStart) / ratio));
    const count = Math.min(requested, available, length - outputStart);
    const edge = Math.max(1, Math.round(0.12 * sampleRate));

    for (let i = 0; i < count; i += 1) {
      const at = sourceStart + Math.floor(i * ratio);
      let sample = 0;
      for (const channel of channels) sample += channel[at] ?? 0;
      sample /= channels.length;
      const fadeIn = Math.min(1, i / edge);
      const fadeOut = Math.min(1, (count - i - 1) / edge);
      out[outputStart + i]! += sample * clip.gain * Math.min(fadeIn, fadeOut);
    }
  }

  // Three hands on the keys, each with its own knock and carriage.
  const voices: Record<TickVoice, { tick: ReturnType<typeof synthTick>; accent: ReturnType<typeof synthTick> }> = {
    narration: { tick: synthTick(sampleRate, 'narration'), accent: synthAccentTick(sampleRate, 'narration') },
    wire: { tick: synthTick(sampleRate, 'wire'), accent: synthAccentTick(sampleRate, 'wire') },
    mono: { tick: synthTick(sampleRate, 'mono'), accent: synthAccentTick(sampleRate, 'mono') },
  };
  const events = tickEvents(sequence, sampleRate);
  events.forEach(({ offset, voice }, n) => {
    const sound = n % ACCENT_EVERY === 0 ? voices[voice].accent : voices[voice].tick;
    const underChart = chartRegions.some((region) => offset / sampleRate >= region.start && offset / sampleRate < region.start + region.duration);
    for (let i = 0; i < sound.samples.length && offset + i < length; i += 1) {
      out[offset + i]! += sound.samples[i]! * tickGain * (underChart ? 0.15 : 1);
    }
  });
  const offsets = events;

  for (const region of chartRegions) {
    const normal = region.events.filter((event) => !event.ghost);
    const { samples } = renderClapTrackSamples(normal.map((event) => event.time), normal.map((event) => event.accent),
      region.duration, region.events.filter((event) => event.ghost).map((event) => event.time), [], sampleRate);
    const start = Math.round(region.start * sampleRate);
    const count = Math.min(samples.length, Math.ceil(region.duration * sampleRate), length - start);
    for (let i = 0; i < count; i++) out[start + i]! += samples[i] ?? 0;
  }

  // A soft limiter: a tick on a music peak must not clip, and hard clipping
  // is the one artefact everybody hears.
  for (let i = 0; i < length; i += 1) {
    const x = out[i]!;
    out[i] = Math.abs(x) > 0.8 ? Math.sign(x) * (0.8 + Math.tanh((Math.abs(x) - 0.8) * 3) * 0.19) : x;
  }

  return { samples: out, sampleRate, ticks: offsets.length };
}
