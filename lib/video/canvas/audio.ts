/**
 * The narration track, encoded in the browser.
 *
 * A silent export of a narrated article is not the same video with a piece
 * missing — it is the wrong video. The recording IS the film's audio, so the
 * on-device path has to carry it or it cannot replace the server render.
 *
 * The chain: fetch the file the website already serves → `decodeAudioData`
 * (which handles mp3, m4a and wav without a parser of our own) → slice into
 * `AudioData` → `AudioEncoder` → the muxer. Nothing here re-encodes anything
 * the browser cannot already play.
 */

/** AAC-LC. The only audio codec an MP4 can rely on everywhere. */
const AAC = 'mp4a.40.2';
/** Opus, as a fallback. Legal in MP4, and not every browser encodes AAC. */
const OPUS = 'opus';

export interface AudioCandidate {
  codec: string;
  /** What `mp4-muxer` calls it. */
  muxer: 'aac' | 'opus';
  sampleRate: number;
  numberOfChannels: number;
}

export async function pickAudioCodec(
  sampleRate: number,
  numberOfChannels: number,
): Promise<AudioCandidate | null> {
  if (typeof globalThis.AudioEncoder === 'undefined') return null;

  for (const [codec, muxer] of [
    [AAC, 'aac'],
    [OPUS, 'opus'],
  ] as const) {
    try {
      const probe = await globalThis.AudioEncoder.isConfigSupported({
        codec,
        sampleRate,
        numberOfChannels,
        bitrate: 128_000,
      });
      if (probe.supported) return { codec, muxer, sampleRate, numberOfChannels };
    } catch {
      // An unsupported codec string throws rather than returning false.
    }
  }
  return null;
}

export interface DecodedNarration {
  buffer: AudioBuffer;
  sampleRate: number;
  numberOfChannels: number;
  durationInSeconds: number;
}

export async function decodeNarration(src: string): Promise<DecodedNarration> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`音声を取得できません (${response.status}): ${src}`);
  const bytes = await response.arrayBuffer();

  // `OfflineAudioContext` decodes without opening an output device, which is
  // what lets this run without a user gesture on iOS.
  const context = new OfflineAudioContext({ length: 1, sampleRate: 48_000, numberOfChannels: 2 });
  const buffer = await context.decodeAudioData(bytes);

  return {
    buffer,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    durationInSeconds: buffer.duration,
  };
}

export interface EncodeAudioOptions {
  decoded: DecodedNarration;
  candidate: AudioCandidate;
  /** Seconds of silence before the voice starts — the ident plays silent. */
  offsetSeconds: number;
  /** The film's length. Audio past this is dropped rather than trailing it. */
  durationSeconds: number;
  onChunk: (chunk: EncodedAudioChunk, meta: EncodedAudioChunkMetadata | undefined) => void;
}

/** One AudioData per this many frames. Small enough to stay responsive. */
const CHUNK_FRAMES = 1024;

/**
 * Encodes the narration, placed at its offset within the film.
 *
 * The offset is real silence rather than a timestamp shift: a muxer given a
 * first sample at t=5s produces a file that some players treat as starting at
 * 5s and others as starting at 0. Writing the silence removes the ambiguity for
 * the cost of a few hundred KB before compression.
 */
export async function encodeNarration(options: EncodeAudioOptions): Promise<number> {
  const { decoded, candidate, offsetSeconds, durationSeconds, onChunk } = options;
  const { sampleRate, numberOfChannels } = candidate;

  const encoder = new globalThis.AudioEncoder({
    output: onChunk,
    error: (error: DOMException) => {
      throw new Error(`音声エンコードに失敗しました: ${error.message}`);
    },
  });

  encoder.configure({
    codec: candidate.codec,
    sampleRate,
    numberOfChannels,
    bitrate: 128_000,
  });

  const totalFrames = Math.floor(durationSeconds * sampleRate);
  const offsetFrames = Math.floor(offsetSeconds * sampleRate);
  const source = decoded.buffer;

  // Interleaved f32, which is the layout every AudioEncoder accepts.
  const scratch = new Float32Array(CHUNK_FRAMES * numberOfChannels);
  const channels = Array.from({ length: numberOfChannels }, (_, channel) =>
    source.getChannelData(Math.min(channel, source.numberOfChannels - 1)),
  );

  let written = 0;
  while (written < totalFrames) {
    const frames = Math.min(CHUNK_FRAMES, totalFrames - written);
    scratch.fill(0, 0, frames * numberOfChannels);

    for (let i = 0; i < frames; i += 1) {
      const sourceIndex = written + i - offsetFrames;
      if (sourceIndex < 0 || sourceIndex >= source.length) continue;
      for (let channel = 0; channel < numberOfChannels; channel += 1) {
        scratch[i * numberOfChannels + channel] = channels[channel]![sourceIndex] ?? 0;
      }
    }

    const data = new globalThis.AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels,
      timestamp: Math.round((written / sampleRate) * 1_000_000),
      data: scratch.subarray(0, frames * numberOfChannels),
    });

    encoder.encode(data);
    data.close();
    written += frames;

    if (encoder.encodeQueueSize > 16) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  await encoder.flush();
  encoder.close();
  return written / sampleRate;
}
