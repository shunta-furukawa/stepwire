import type { SceneSequence } from '../scenes';
import { sceneStartFrames } from '../scenes';
import { synthAccentTick, synthTick } from './sfx';

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
  /** Level of the ticks, 0–1. */
  tickGain?: number;
}

/** Every tick in the film, as a sample offset. */
export function tickOffsets(sequence: SceneSequence, sampleRate: number): number[] {
  const starts = sceneStartFrames(sequence);
  const offsets: number[] = [];
  sequence.scenes.forEach((scene, index) => {
    if (!scene.reveal) return;
    const start = starts[index]!;
    for (const frame of scene.reveal.ticks) {
      offsets.push(Math.round(((start + frame) / sequence.fps) * sampleRate));
    }
  });
  return offsets;
}

/** Every eighth tick is the heavy one. */
const ACCENT_EVERY = 8;
/** Seconds the music takes to fade at the end of the film. */
const FADE_SECONDS = 1.6;

export function mixSoundtrack(options: MixOptions): Soundtrack {
  const { sequence, sampleRate, bgm, tickGain = 0.55 } = options;
  const length = Math.ceil((sequence.durationInFrames / sequence.fps) * sampleRate);
  const out = new Float32Array(length);

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
      out[i] = sample * bgm.gain * fade;
    }
  }

  const tick = synthTick(sampleRate);
  const accent = synthAccentTick(sampleRate);
  const offsets = tickOffsets(sequence, sampleRate);
  offsets.forEach((offset, n) => {
    const voice = n % ACCENT_EVERY === 0 ? accent : tick;
    for (let i = 0; i < voice.samples.length && offset + i < length; i += 1) {
      out[offset + i]! += voice.samples[i]! * tickGain;
    }
  });

  // A soft limiter: a tick on a music peak must not clip, and hard clipping
  // is the one artefact everybody hears.
  for (let i = 0; i < length; i += 1) {
    const x = out[i]!;
    out[i] = Math.abs(x) > 0.8 ? Math.sign(x) * (0.8 + Math.tanh((Math.abs(x) - 0.8) * 3) * 0.19) : x;
  }

  return { samples: out, sampleRate, ticks: offsets.length };
}
