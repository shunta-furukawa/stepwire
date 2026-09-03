'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ArticleVideoInput } from '@/lib/content/article';
import { buildSceneSequence } from '@/lib/video/scenes';
import { COMPOSITIONS, type CompositionId } from '@/lib/video/compositions';
import { drawScene } from '@/lib/video/canvas/draw';
import {
  decodeNarration,
  encodeNarration,
  pickAudioCodec,
  verifyAudio,
  withDecoderConfig,
  type AudioCandidate,
} from '@/lib/video/canvas/audio';

/**
 * The export spike.
 *
 * One question, answered by measurement on the device that matters: can this
 * phone encode a STEPWIRE video by itself, how fast, and does it look right?
 *
 * It is a lab, not a product. It renders a real sequence at full resolution
 * through the canvas renderer, encodes it with WebCodecs, muxes an MP4, and
 * reports numbers. If the numbers are good the studio can be built on this and
 * rendering stops costing money; if they are not, this page is the evidence for
 * dropping the idea rather than an opinion about it.
 */

type Support = {
  videoEncoder: boolean;
  videoFrame: boolean;
  offscreenCanvas: boolean;
  /** `VideoEncoder.isConfigSupported` for the exact config we would use. */
  h264: 'yes' | 'no' | 'unknown';
  /** The best codec this device actually offers. */
  codec: string;
};

type Result = {
  frames: number;
  drawMs: number;
  encodeMs: number;
  muxMs: number;
  totalMs: number;
  bytes: number;
  url: string;
  codec: string;
  audio: string;
  /** What a decoder finds in the file we just wrote. */
  verified: string;
  verifiedOk: boolean;
  /** The narration alone, as its own file — see `audioOnlyUrl` below. */
  audioUrl: string;
};

/**
 * Codecs to try, best first.
 *
 * H.264 is the only one worth shipping — every phone, every editor and every
 * platform takes it, and Safari encodes it in hardware. The rest are here so
 * the lab still produces a measurement on a browser build that lacks it
 * (open-source Chromium ships without H.264), and so the failure reports
 * *which* codec was missing instead of "closed codec".
 */
const CANDIDATES = [
  { label: 'H.264 High', codec: 'avc1.640028', muxer: 'avc' },
  { label: 'H.264 Baseline', codec: 'avc1.42001f', muxer: 'avc' },
  { label: 'VP9', codec: 'vp09.00.10.08', muxer: 'vp9' },
] as const;

type Candidate = (typeof CANDIDATES)[number];

async function pickCodec(width: number, height: number, fps: number): Promise<Candidate | null> {
  if (typeof globalThis.VideoEncoder === 'undefined') return null;
  for (const candidate of CANDIDATES) {
    try {
      const probe = await globalThis.VideoEncoder.isConfigSupported({
        codec: candidate.codec,
        width,
        height,
        bitrate: 6_000_000,
        framerate: fps,
      });
      if (probe.supported) return candidate;
    } catch {
      // An unrecognised codec string throws rather than returning false.
    }
  }
  return null;
}

async function detect(): Promise<Support> {
  const videoEncoder = typeof globalThis.VideoEncoder !== 'undefined';
  const support: Support = {
    videoEncoder,
    videoFrame: typeof globalThis.VideoFrame !== 'undefined',
    offscreenCanvas: typeof globalThis.OffscreenCanvas !== 'undefined',
    h264: 'unknown',
    codec: '',
  };

  if (!videoEncoder) return support;

  const picked = await pickCodec(1920, 1080, 30);
  support.h264 = picked === null ? 'no' : picked.muxer === 'avc' ? 'yes' : 'no';
  support.codec = picked?.label ?? 'なし';

  return support;
}

export function ExportLab({ articles }: { articles: ArticleVideoInput[] }) {
  // Opens on an article that has a recording, if any: the lab's job includes
  // proving the audio path, and defaulting to a silent article made "I exported
  // and heard nothing" the expected result rather than a bug report.
  const [slug, setSlug] = useState(
    (articles.find((item) => item.narration) ?? articles[0])?.slug ?? '',
  );
  // Landscape is the delivery format; the phone is the editing surface, not the
  // output shape. It is also the safer encode: 1080x1920 is an unusual geometry
  // for a hardware H.264 encoder, and 1920x1080 is the one every device ships.
  const [composition, setComposition] = useState<CompositionId>('STEPWIRE_NEWS');
  const [scale, setScale] = useState(1);
  const [support, setSupport] = useState<Support | null>(null);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const article = articles.find((item) => item.slug === slug) ?? articles[0];
  const definition = COMPOSITIONS[composition];
  const sequence = useMemo(
    () => (article ? buildSceneSequence(article, composition) : null),
    [article, composition],
  );

  const check = useCallback(async () => {
    setSupport(await detect());
  }, []);

  const run = useCallback(async () => {
    if (!sequence || !article) return;
    setError('');
    setResult(null);
    setStatus('準備中…');

    const width = Math.round(definition.width * scale);
    const height = Math.round(definition.height * scale);
    // H.264 requires even dimensions; an odd one fails at configure() with a
    // message that does not say so.
    const w = width - (width % 2);
    const h = height - (height % 2);

    try {
      if (typeof globalThis.VideoEncoder === 'undefined') {
        throw new Error('この端末には VideoEncoder がありません（iOS 16.4以降が必要）');
      }

      // Probe at the real output size, not a nominal one: an encoder can accept
      // 1280x720 and refuse 1920x1080, and finding that out at configure() costs
      // an error message that does not name the cause.
      const candidate = await pickCodec(w, h, sequence.fps);
      if (!candidate) throw new Error(`${w}×${h} をエンコードできるコーデックがありません`);
      setSupport(await detect());

      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');

      const canvas = canvasRef.current;
      if (!canvas) throw new Error('canvas がありません');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('2d コンテキストを取得できません');

      // The narration is decoded before the muxer is built, because the muxer
      // has to declare its audio track up front and cannot learn the sample
      // rate later.
      let audioCandidate: AudioCandidate | null = null;
      let decoded: Awaited<ReturnType<typeof decodeNarration>> | null = null;
      let audioNote = 'なし（無音の記事）';
      let audioBlob: Blob | null = null;

      if (article.narration) {
        setStatus('音声を読み込み中…');
        try {
          decoded = await decodeNarration(article.narration.audioSrc);
          audioCandidate = await pickAudioCodec(decoded.sampleRate, decoded.numberOfChannels);
          if (!audioCandidate) audioNote = 'この端末は音声をエンコードできません';
        } catch (audioError) {
          // A missing recording must not cost the whole export: the film is
          // still worth having silent, and the reason is worth reporting.
          audioNote = audioError instanceof Error ? audioError.message : String(audioError);
        }
      }

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: candidate.muxer, width: w, height: h },
        ...(audioCandidate && decoded
          ? {
              audio: {
                codec: audioCandidate.muxer,
                sampleRate: audioCandidate.sampleRate,
                numberOfChannels: audioCandidate.numberOfChannels,
              },
            }
          : {}),
        fastStart: 'in-memory',
      });

      let drawMs = 0;
      let encodeMs = 0;
      let encodedChunks = 0;

      const encoder = new globalThis.VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta);
          encodedChunks += 1;
        },
        error: (e: DOMException) => setError(`エンコーダエラー: ${e.message}`),
      });

      encoder.configure({
        codec: candidate.codec,
        width: w,
        height: h,
        bitrate: Math.round(6_000_000 * scale * scale),
        framerate: sequence.fps,
        latencyMode: 'quality',
      });

      const startedAt = performance.now();
      let frameIndex = 0;

      for (const scene of sequence.scenes) {
        for (let f = 0; f < scene.durationInFrames; f += 1) {
          const t0 = performance.now();
          drawScene(
            { ctx, width: w, height: h, progress: f / Math.max(1, scene.durationInFrames - 1) },
            scene,
          );
          const t1 = performance.now();
          drawMs += t1 - t0;

          const frame = new globalThis.VideoFrame(canvas, {
            timestamp: (frameIndex * 1_000_000) / sequence.fps,
            duration: 1_000_000 / sequence.fps,
          });
          // A keyframe every two seconds keeps the file seekable on a phone.
          encoder.encode(frame, { keyFrame: frameIndex % (sequence.fps * 2) === 0 });
          frame.close();
          encodeMs += performance.now() - t1;

          frameIndex += 1;

          // Encoding is async under the hood; letting the queue drain keeps
          // memory flat and the page responsive instead of freezing the tab.
          if (encoder.encodeQueueSize > 8) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          if (frameIndex % 30 === 0) {
            setStatus(`${frameIndex} / ${sequence.durationInFrames} フレーム`);
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
          }
        }
      }

      setStatus('書き出し中…');
      await encoder.flush();
      encoder.close();

      if (audioCandidate && decoded) {
        setStatus('音声を書き出し中…');
        try {
          const audio = await encodeNarration({
            decoded,
            candidate: audioCandidate,
            offsetSeconds: (sequence.narration?.startFrame ?? 0) / sequence.fps,
            durationSeconds: sequence.durationInFrames / sequence.fps,
          });
          // Safari's AAC encoder emits no decoder description, and the muxer
          // turns that into a zero-length one rather than complaining.
          let synthesised = false;
          const withConfig = audio.chunks.map(({ chunk, meta }) => {
            const patched = withDecoderConfig(meta, audioCandidate!);
            synthesised = synthesised || patched.synthesised;
            return { chunk, meta: patched.meta };
          });

          for (const { chunk, meta } of withConfig) muxer.addAudioChunk(chunk, meta);

          // The same track, muxed again on its own.
          //
          // Because the check that was supposed to settle this could not:
          // `decodeAudioData` was handed the finished MP4, and Safari refuses
          // an MP4 that carries video however sound its audio is. The result
          // was "Decoding failed" for a file that may be perfectly fine. An
          // audio-only MP4 is what that API expects, and it is also something
          // the operator can simply press play on.
          const audioTarget = new ArrayBufferTarget();
          const audioMuxer = new Muxer({
            target: audioTarget,
            audio: {
              codec: audioCandidate.muxer,
              sampleRate: audioCandidate.sampleRate,
              numberOfChannels: audioCandidate.numberOfChannels,
            },
            fastStart: 'in-memory',
          });
          for (const { chunk, meta } of withConfig) audioMuxer.addAudioChunk(chunk, meta);
          audioMuxer.finalize();
          audioBlob = new Blob([audioTarget.buffer], { type: 'audio/mp4' });

          audioNote =
            audioCandidate.muxer === 'aac'
              ? `AAC · ${audio.chunks.length}チャンク · ${audio.format}${
                  synthesised ? ' · esds補完' : ''
                }`
              : // Opus is legal inside an MP4 and Safari and QuickTime both
                // refuse to decode it, so the file plays and is silent — the
                // exact symptom this label has to stop being a mystery.
                `OPUS（Safari/QuickTimeでは無音になります） · ${audio.chunks.length}チャンク`;
        } catch (audioError) {
          // The video is still worth having. What is not acceptable is
          // reporting success and handing back a silent file.
          audioNote = audioError instanceof Error ? audioError.message : String(audioError);
        }
      }

      const muxStart = performance.now();
      muxer.finalize();
      const muxMs = performance.now() - muxStart;

      const blob = new Blob([target.buffer], { type: 'video/mp4' });
      const totalMs = performance.now() - startedAt;

      // Open what we just wrote and measure it. Every layer above can report
      // success and still produce a silent file.
      setStatus('出力を検証中…');
      const verdict = audioBlob
        ? await verifyAudio(audioBlob)
        : {
            audible: false,
            span: '',
            detail: article.narration ? '音声トラックを作れませんでした' : '録音のない記事です',
          };

      if (encodedChunks === 0) throw new Error('エンコーダが1フレームも出力しませんでした');

      setResult({
        frames: frameIndex,
        drawMs,
        encodeMs,
        muxMs,
        totalMs,
        bytes: blob.size,
        url: URL.createObjectURL(blob),
        codec: candidate.label,
        audio: audioNote,
        verified: `${audioCandidate?.muxer.toUpperCase() ?? '—'} / ${verdict.detail}`,
        verifiedOk: verdict.audible,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : '',
      });
      setStatus('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    }
  }, [article, definition, scale, sequence]);

  if (!article || !sequence) {
    return <p className="font-body text-lead text-muted">記事がありません。</p>;
  }

  const seconds = sequence.durationInFrames / sequence.fps;

  return (
    <div className="space-y-xl">
      <section className="border-2 border-line-strong bg-raised p-md">
        <h2 className="font-mono text-micro font-bold uppercase tracking-wider">対応状況</h2>
        {support ? (
          <dl className="mt-md grid grid-cols-2 gap-x-md gap-y-sm font-mono text-micro">
            <Row label="VideoEncoder" value={support.videoEncoder ? 'あり' : 'なし'} ok={support.videoEncoder} />
            <Row label="VideoFrame" value={support.videoFrame ? 'あり' : 'なし'} ok={support.videoFrame} />
            <Row label="OffscreenCanvas" value={support.offscreenCanvas ? 'あり' : 'なし'} ok={support.offscreenCanvas} />
            <Row
              label={`H.264 ${definition.width}×${definition.height}`}
              value={support.h264 === 'yes' ? 'あり' : 'なし'}
              ok={support.h264 === 'yes'}
            />
            <Row label="採用コーデック" value={support.codec} ok={support.codec !== 'なし'} />
          </dl>
        ) : (
          <button
            type="button"
            onClick={check}
            className="mt-md w-full border-2 border-line-strong px-md py-sm font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-accent hover:text-on-accent"
          >
            この端末を調べる
          </button>
        )}
      </section>

      <section className="space-y-md">
        <label className="block font-mono text-micro uppercase tracking-wide text-muted" htmlFor="lab-article">
          記事
        </label>
        <select
          id="lab-article"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="w-full border-2 border-line-strong bg-raised px-md py-sm font-display text-base text-fg"
        >
          {articles.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.narration ? '🎙 ' : ''}
              {item.shortTitle ?? item.title}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-md">
          <div>
            <label className="block font-mono text-micro uppercase tracking-wide text-muted" htmlFor="lab-comp">
              形式
            </label>
            <select
              id="lab-comp"
              value={composition}
              onChange={(event) => setComposition(event.target.value as CompositionId)}
              className="mt-sm w-full border-2 border-line-strong bg-raised px-md py-sm font-mono text-small text-fg"
            >
              <option value="STEPWIRE_NEWS">16:9（主）</option>
              <option value="STEPWIRE_SHORT">9:16</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-micro uppercase tracking-wide text-muted" htmlFor="lab-scale">
              解像度
            </label>
            <select
              id="lab-scale"
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              className="mt-sm w-full border-2 border-line-strong bg-raised px-md py-sm font-mono text-small text-fg"
            >
              <option value={1}>フル ({definition.width}×{definition.height})</option>
              <option value={0.5}>半分</option>
            </select>
          </div>
        </div>

        <p className="font-mono text-micro text-muted">
          {sequence.scenes.length} シーン · {sequence.durationInFrames} フレーム ·{' '}
          {seconds.toFixed(1)}秒 @ {sequence.fps}fps
        </p>

        {/* Only one sample article carries a recording, and "I exported and
            there was no sound" is the same sentence whether the bug is in the
            encoder or the article simply has no voice. The difference is
            stated before the button, not after. */}
        <p
          className={`border-l-2 pl-md font-mono text-micro leading-snug ${
            article.narration ? 'border-accent text-accent' : 'border-line-strong text-muted'
          }`}
        >
          {article.narration
            ? `録音あり — ${article.narration.audioSrc}`
            : 'この記事に録音はありません。書き出しても無音です。'}
        </p>

        <button
          type="button"
          onClick={run}
          disabled={status !== ''}
          className="w-full border-2 border-accent bg-accent px-md py-md font-mono text-micro font-bold uppercase tracking-wider text-on-accent transition-colors disabled:border-line disabled:bg-line disabled:text-muted"
        >
          {status === '' ? 'この端末で書き出す' : status}
        </button>
      </section>

      {error ? (
        <p className="border-2 border-accent-hot bg-raised p-md font-mono text-micro leading-snug text-accent-hot">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="border-2 border-line-strong bg-raised p-md">
          <h2 className="font-mono text-micro font-bold uppercase tracking-wider">結果</h2>
          <dl className="mt-md grid grid-cols-2 gap-x-md gap-y-sm font-mono text-micro">
            <Row label="コーデック" value={result.codec} ok={result.codec.startsWith('H.264')} />
            <Row label="音声" value={result.audio} ok={result.audio.startsWith('AAC')} />
            <Row label="実時間" value={`${(result.totalMs / 1000).toFixed(1)}秒`} ok />
            <Row
              label="実時間比"
              value={`${(result.totalMs / 1000 / seconds).toFixed(2)}×`}
              ok={result.totalMs / 1000 < seconds}
            />
            <Row label="描画" value={`${(result.drawMs / result.frames).toFixed(1)}ms/f`} ok />
            <Row label="エンコード" value={`${(result.encodeMs / result.frames).toFixed(1)}ms/f`} ok />
            <Row label="多重化" value={`${result.muxMs.toFixed(0)}ms`} ok />
            <Row label="サイズ" value={`${(result.bytes / 1024 / 1024).toFixed(1)} MB`} ok />
          </dl>

          {/* The verdict from decoding the output, which is the only statement
              here that is about the file rather than about the process. */}
          <p
            className={`mt-md border-l-2 pl-md font-mono text-micro leading-snug ${
              result.verifiedOk ? 'border-accent text-accent' : 'border-accent-hot text-accent-hot'
            }`}
          >
            {result.verified}
            {result.verifiedOk ? (
              <span className="mt-xs block text-muted">
                ファイルに音は入っています。聞こえない場合は本体側面のマナースイッチを確認してください
                — iPhoneはインライン再生の動画をこれで消音します。
              </span>
            ) : null}
          </p>

          {/* The decisive test: the narration on its own, with a play button.
              A number can be argued with; this either makes a sound or it does
              not. */}
          {result.audioUrl ? (
            <div className="mt-md">
              <p className="font-mono text-micro uppercase tracking-wide text-muted">
                音声だけを再生（これが鳴るなら音声は正しい）
              </p>
              <audio src={result.audioUrl} controls className="mt-sm w-full" />
              <a
                href={result.audioUrl}
                download={`${slug}-narration.mp4`}
                className="mt-sm block border border-line px-md py-sm text-center font-mono text-micro uppercase tracking-wider text-muted hover:text-accent"
              >
                音声だけを保存
              </a>
            </div>
          ) : null}

          {/* Playing it back is the quality check the numbers cannot make. */}
          <video
            src={result.url}
            controls
            playsInline
            className="mt-md w-full border border-line bg-deep"
          />
          <a
            href={result.url}
            download={`${slug}-${composition}.mp4`}
            className="mt-md block border-2 border-line-strong px-md py-sm text-center font-mono text-micro font-bold uppercase tracking-wider transition-colors hover:bg-accent hover:text-on-accent"
          >
            MP4 を保存
          </a>
        </section>
      ) : null}

      {/* Off-screen but in the DOM: an OffscreenCanvas would be faster, and is
          the next thing to try if these numbers are close. */}
      <canvas ref={canvasRef} className="sr-only" />
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={ok ? 'text-accent' : 'text-accent-hot'}>{value}</dd>
    </>
  );
}
