/**
 * The tick — the sound a character makes when it lands.
 *
 * Synthesised, not sampled, for the same reason the facets are drawn and not
 * loaded: an asset is one more file to lose, license, and keep in sync, and a
 * click is thirty lines of arithmetic. Two layers: a short rounded knock for
 * the "key" and a lower, longer body every few ticks for the "carriage",
 * which is what turns a buzz into a rhythm.
 *
 * The knock sits in the mid range on purpose. The first version was a bright
 * 1.76 kHz click with a white-noise attack, and at ten to fifteen a second it
 * was shrill — the operator's word was 耳障り. A key on a real machine is a
 * wooden sound: the pitch is a few hundred hertz, it falls slightly as the
 * key seats, and the attack is a thud, not a hiss. That is what is built here:
 * a sine that glides down through the mid range, a noise burst rolled off
 * with a one-pole low-pass so it is felt as impact rather than heard as air,
 * and a soft clip so the sum never spikes above the bed the way a raw
 * transient does.
 */

export interface Tick {
  samples: Float32Array;
  sampleRate: number;
}

interface KnockShape {
  /** Where the pitch starts. */
  fromHz: number;
  /** Where it settles by the end of the glide. */
  toHz: number;
  ms: number;
  /** Noise level at the attack, before the low-pass. */
  noise: number;
  /** The low-pass corner for that noise: lower is duller. */
  noiseHz: number;
}

/** A sine that glides down, with a low-passed noise attack, decaying. */
function knock(sampleRate: number, shape: KnockShape): Float32Array {
  const { fromHz, toHz, ms, noise, noiseHz } = shape;
  const length = Math.round((ms / 1000) * sampleRate);
  const out = new Float32Array(length);

  // Deterministic noise: the same tick on every export, so a diff of two
  // renders of the same article is silent.
  let seed = 0x9e3779b9;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 0xffffffff) * 2 - 1;
  };

  // One-pole low-pass on the noise, so the attack is a thud and not a hiss.
  const alpha = 1 - Math.exp((-2 * Math.PI * noiseHz) / sampleRate);
  let filtered = 0;
  // The glide covers the first third of the sound; the pitch is settled by
  // the time the ear has registered it, so it reads as one note, not a sweep.
  const glideSamples = Math.max(1, Math.round(length / 3));
  let phase = 0;
  // A short linear attack instead of a hard edge: an instantaneous start is
  // exactly the click that was too sharp.
  const attackSamples = Math.max(1, Math.round(sampleRate * 0.0012));

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const glide = Math.min(1, i / glideSamples);
    const hz = fromHz + (toHz - fromHz) * glide;
    phase += (2 * Math.PI * hz) / sampleRate;

    const decay = Math.exp(-t * (1000 / ms) * 4);
    const attack = Math.min(1, i / attackSamples);
    const burst = i < length * 0.15 ? random() * noise : 0;
    filtered += alpha * (burst - filtered);

    // A touch of second harmonic gives the note a body without brightness.
    const tone = Math.sin(phase) + 0.25 * Math.sin(2 * phase);
    out[i] = Math.tanh((tone * 0.8 + filtered * 1.6) * decay * attack * 1.4);
  }
  return out;
}

export function synthTick(sampleRate: number): Tick {
  return {
    samples: knock(sampleRate, { fromHz: 700, toHz: 500, ms: 34, noise: 0.35, noiseHz: 900 }),
    sampleRate,
  };
}

/** The heavier tick that lands every few characters. */
export function synthAccentTick(sampleRate: number): Tick {
  const mid = knock(sampleRate, { fromHz: 560, toHz: 400, ms: 42, noise: 0.45, noiseHz: 1100 });
  const low = knock(sampleRate, { fromHz: 180, toHz: 140, ms: 80, noise: 0.15, noiseHz: 500 });
  const out = new Float32Array(Math.max(mid.length, low.length));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = (mid[i] ?? 0) * 0.75 + (low[i] ?? 0) * 0.85;
  }
  return { samples: out, sampleRate };
}
