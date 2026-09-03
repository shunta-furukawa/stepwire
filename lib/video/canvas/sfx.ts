/**
 * The tick — the sound a character makes when it lands.
 *
 * Synthesised, not sampled, for the same reason the facets are drawn and not
 * loaded: an asset is one more file to lose, license, and keep in sync, and a
 * click is twenty lines of arithmetic. Two layers: a short bright transient
 * for the "key" and a lower, longer body every few ticks for the "carriage",
 * which is what turns a buzz into a rhythm.
 */

export interface Tick {
  samples: Float32Array;
  sampleRate: number;
}

/** A decaying sine with a noise attack. ~28ms. */
function transient(sampleRate: number, hz: number, ms: number, noise: number): Float32Array {
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
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const decay = Math.exp(-t * (1000 / ms) * 4.5);
    const tone = Math.sin(2 * Math.PI * hz * t);
    const attack = i < length * 0.12 ? random() * noise : 0;
    out[i] = (tone * 0.85 + attack) * decay;
  }
  return out;
}

export function synthTick(sampleRate: number): Tick {
  return { samples: transient(sampleRate, 1760, 28, 0.6), sampleRate };
}

/** The heavier tick that lands every few characters. */
export function synthAccentTick(sampleRate: number): Tick {
  const high = transient(sampleRate, 1320, 34, 0.5);
  const low = transient(sampleRate, 220, 70, 0.2);
  const out = new Float32Array(Math.max(high.length, low.length));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = (high[i] ?? 0) * 0.8 + (low[i] ?? 0) * 0.9;
  }
  return { samples: out, sampleRate };
}
