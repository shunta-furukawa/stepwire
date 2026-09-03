import { describe, expect, it } from 'vitest';
import { audioSpecificConfig, withDecoderConfig } from '../lib/video/canvas/audio';

/**
 * The two bytes that decide whether an exported AAC track can be played.
 *
 * Asserted against the spec's own bit layout rather than against what the code
 * happens to produce, because the failure this guards is invisible: the muxer
 * accepts a missing description, writes an empty one, and every API in the
 * chain reports success while the file is undecodable.
 */
const candidate = {
  codec: 'mp4a.40.2',
  muxer: 'aac' as const,
  sampleRate: 48_000,
  numberOfChannels: 1,
};

describe('audioSpecificConfig', () => {
  it('encodes AAC-LC, 48kHz, mono', () => {
    // 00010 0011 0001 000 → objectType 2, freqIndex 3 (48000), 1 channel.
    expect([...audioSpecificConfig(48_000, 1)]).toEqual([0x11, 0x88]);
  });

  it('encodes 44.1kHz stereo, where the frequency index crosses a byte', () => {
    // freqIndex 4 (44100) has its low bit in byte 1, which is the part of this
    // layout most likely to be got wrong.
    expect([...audioSpecificConfig(44_100, 2)]).toEqual([0x12, 0x10]);
  });

  it('refuses a rate AAC has no index for', () => {
    expect(() => audioSpecificConfig(47_000, 1)).toThrow(/47000/);
  });
});

describe('withDecoderConfig', () => {
  it('fills in a description the encoder did not supply', () => {
    const { meta, synthesised } = withDecoderConfig(undefined, candidate);
    expect(synthesised).toBe(true);
    expect([...new Uint8Array(meta!.decoderConfig!.description as ArrayBuffer)]).toEqual([
      0x11, 0x88,
    ]);
  });

  it('leaves an encoder-supplied description alone', () => {
    const original = new Uint8Array([1, 2, 3]);
    const { meta, synthesised } = withDecoderConfig(
      { decoderConfig: { codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 1, description: original } },
      candidate,
    );
    expect(synthesised).toBe(false);
    expect(meta!.decoderConfig!.description).toBe(original);
  });

  it('does not touch Opus, which carries its own header', () => {
    const { synthesised } = withDecoderConfig(undefined, { ...candidate, muxer: 'opus', codec: 'opus' });
    expect(synthesised).toBe(false);
  });
});
