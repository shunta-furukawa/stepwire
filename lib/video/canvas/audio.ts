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
}

export interface EncodedAudio {
  /**
   * The whole track, buffered rather than streamed to the muxer.
   *
   * Because the format is discovered by trying: streaming an attempt that then
   * fails leaves its chunks in the muxer, and the retry appends a second
   * track's worth on top of them. Buffering costs a few MB and makes a failed
   * attempt leave nothing behind.
   */
  chunks: { chunk: EncodedAudioChunk; meta: EncodedAudioChunkMetadata | undefined }[];
  seconds: number;
  /** Which `AudioData` layout the encoder actually accepted. */
  format: AudioSampleFormat;
}

/**
 * `f32` is interleaved and `f32-planar` is not, and browsers disagree about
 * which they take. Chrome accepts both; Safari has historically wanted planar.
 * Trying in order costs one failed `encode` and removes a whole class of
 * "exported fine, no sound".
 */
const FORMATS: AudioSampleFormat[] = ['f32-planar', 'f32'];

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
export async function encodeNarration(options: EncodeAudioOptions): Promise<EncodedAudio> {
  let lastError: Error | null = null;

  for (const format of FORMATS) {
    try {
      return await encodeWith(options, format);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('音声をエンコードできませんでした');
}

async function encodeWith(
  options: EncodeAudioOptions,
  format: AudioSampleFormat,
): Promise<EncodedAudio> {
  const { decoded, candidate, offsetSeconds, durationSeconds } = options;
  const { sampleRate, numberOfChannels } = candidate;

  const chunks: EncodedAudio['chunks'] = [];
  // WebCodecs reports failures through a callback, and a throw inside one
  // reaches nobody: the export used to finish "successfully" with no audio in
  // it. The error is captured and re-thrown where it can be seen instead.
  //
  // Held in an object because the callback can fire during `flush()`, after
  // control flow has already passed a `if (failure)` check — a plain `let`
  // narrows to `null` there and the later check becomes dead code.
  const state: { failure: Error | null } = { failure: null };
  const failed = (error: Error) => {
    state.failure = error;
  };

  const encoder = new globalThis.AudioEncoder({
    output: (chunk, meta) => chunks.push({ chunk, meta }),
    error: (error: DOMException) => {
      failed(new Error(`${candidate.codec} / ${format}: ${error.message}`));
    },
  });

  encoder.configure({ codec: candidate.codec, sampleRate, numberOfChannels, bitrate: 128_000 });

  const totalFrames = Math.floor(durationSeconds * sampleRate);
  const offsetFrames = Math.floor(offsetSeconds * sampleRate);
  const source = decoded.buffer;
  const channels = Array.from({ length: numberOfChannels }, (_, channel) =>
    source.getChannelData(Math.min(channel, source.numberOfChannels - 1)),
  );

  const scratch = new Float32Array(CHUNK_FRAMES * numberOfChannels);
  let written = 0;

  while (written < totalFrames && !state.failure) {
    const frames = Math.min(CHUNK_FRAMES, totalFrames - written);
    scratch.fill(0, 0, frames * numberOfChannels);

    for (let i = 0; i < frames; i += 1) {
      const sourceIndex = written + i - offsetFrames;
      if (sourceIndex < 0 || sourceIndex >= source.length) continue;
      for (let channel = 0; channel < numberOfChannels; channel += 1) {
        // Planar lays each channel end to end; interleaved alternates them.
        const at = format === 'f32-planar' ? channel * frames + i : i * numberOfChannels + channel;
        scratch[at] = channels[channel]![sourceIndex] ?? 0;
      }
    }

    const data = new globalThis.AudioData({
      format,
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

  if (state.failure) {
    encoder.close();
    throw state.failure;
  }

  await encoder.flush();
  encoder.close();

  if (state.failure) throw state.failure;
  // An encoder that accepts everything and emits nothing is the exact shape of
  // "the video exported and there is no sound". It is an error, not a result.
  if (chunks.length === 0) {
    throw new Error(`${candidate.codec} / ${format}: エンコーダが音声を1つも出力しませんでした`);
  }

  return { chunks, seconds: written / sampleRate, format };
}

export interface AudioVerdict {
  /** True when a decoder found an audio track and it is not pure silence. */
  audible: boolean;
  /** Seconds where the track has signal, as `5–19`. Empty when silent. */
  span: string;
  detail: string;
}

/**
 * Checks the file we just produced for sound.
 *
 * Because every layer in this chain can succeed and still hand back a silent
 * video: an encoder that emits chunks a muxer writes into a track no decoder
 * accepts is, to every API involved, a success. The only honest test is to open
 * the output and listen to it, which is what this does numerically.
 *
 * It also separates the two things "I can't hear it" can mean. If the track is
 * audible here and silent on the phone, the file is fine and the playback is
 * not — an iPhone's ring/silent switch mutes inline video, and that has nothing
 * to do with the encoder.
 */
export async function verifyAudio(blob: Blob): Promise<AudioVerdict> {
  try {
    const context = new OfflineAudioContext({
      length: 1,
      sampleRate: 48_000,
      numberOfChannels: 2,
    });
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = buffer.getChannelData(0);
    const rate = buffer.sampleRate;

    const loud: number[] = [];
    for (let second = 0; second < Math.ceil(buffer.duration); second += 1) {
      let sum = 0;
      let count = 0;
      for (let i = second * rate; i < Math.min((second + 1) * rate, samples.length); i += 1) {
        sum += samples[i]! * samples[i]!;
        count += 1;
      }
      if (Math.sqrt(sum / Math.max(1, count)) > 0.005) loud.push(second);
    }

    if (loud.length === 0) {
      return {
        audible: false,
        span: '',
        detail: `音声トラックはあるが全編無音（${buffer.duration.toFixed(1)}秒）`,
      };
    }

    return {
      audible: true,
      span: `${loud[0]}–${loud.at(-1)}秒`,
      detail: `音声を検出（${loud[0]}–${loud.at(-1)}秒 / 全${buffer.duration.toFixed(1)}秒）`,
    };
  } catch (error) {
    // A decode failure here is itself the answer: the track exists but nothing
    // on this device can play it, which is what Opus in an MP4 looks like.
    return {
      audible: false,
      span: '',
      detail: `音声トラックを復号できません: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** The sampling frequency table AudioSpecificConfig indexes into. */
const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/**
 * The two bytes an AAC track needs to be decodable, built by hand.
 *
 * An MP4's `esds` box carries an AudioSpecificConfig, and the muxer takes it
 * from `EncodedAudioChunkMetadata.decoderConfig.description`. When an encoder
 * does not supply one — Safari does not — the muxer reaches for `undefined`,
 * `new Uint8Array(undefined)` yields an empty array rather than throwing, and
 * the file gets an AAC track with a zero-length config. Every layer reports
 * success; nothing can play the result. This is that failure, in two bytes.
 *
 *   5 bits  audioObjectType        2 = AAC-LC
 *   4 bits  samplingFrequencyIndex
 *   4 bits  channelConfiguration
 *   3 bits  frameLengthFlag, dependsOnCoreCoder, extensionFlag — all zero
 */
export function audioSpecificConfig(sampleRate: number, channels: number): Uint8Array {
  const index = AAC_RATES.indexOf(sampleRate);
  if (index === -1) {
    throw new Error(`AACが扱えないサンプリングレートです: ${sampleRate}Hz`);
  }

  const objectType = 2;
  return new Uint8Array([
    (objectType << 3) | (index >> 1),
    ((index & 1) << 7) | (channels << 3),
  ]);
}

/**
 * Fills in a missing decoder description, and says whether it had to.
 *
 * Returned rather than mutated because the metadata is the encoder's, and
 * because "did this device supply one" is worth reporting: it is the difference
 * between a browser quirk we have worked around and a bug we have not found.
 */
export function withDecoderConfig(
  meta: EncodedAudioChunkMetadata | undefined,
  candidate: AudioCandidate,
): { meta: EncodedAudioChunkMetadata | undefined; synthesised: boolean } {
  if (candidate.muxer !== 'aac') return { meta, synthesised: false };
  if (meta?.decoderConfig?.description) return { meta, synthesised: false };

  const description = audioSpecificConfig(candidate.sampleRate, candidate.numberOfChannels);
  return {
    meta: {
      ...meta,
      decoderConfig: {
        codec: candidate.codec,
        sampleRate: candidate.sampleRate,
        numberOfChannels: candidate.numberOfChannels,
        ...meta?.decoderConfig,
        description,
      },
    },
    synthesised: true,
  };
}
