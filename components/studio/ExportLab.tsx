'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ArticleVideoInput } from '@/lib/content/article';
import { buildSceneSequence } from '@/lib/video/scenes';
import { COMPOSITIONS, type CompositionId } from '@/lib/video/compositions';
import { drawScene } from '@/lib/video/canvas/draw';

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
  const [slug, setSlug] = useState(articles[0]?.slug ?? '');
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
    if (!sequence) return;
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

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: candidate.muxer, width: w, height: h },
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
      const analysis = new Set(['context', 'impact']);
      let frameIndex = 0;

      for (const scene of sequence.scenes) {
        for (let f = 0; f < scene.durationInFrames; f += 1) {
          const t0 = performance.now();
          drawScene(
            { ctx, width: w, height: h, progress: f / Math.max(1, scene.durationInFrames - 1) },
            scene,
            analysis.has(scene.type) ? 'analysis' : 'fact',
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

      const muxStart = performance.now();
      muxer.finalize();
      const muxMs = performance.now() - muxStart;

      const blob = new Blob([target.buffer], { type: 'video/mp4' });
      const totalMs = performance.now() - startedAt;

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
      });
      setStatus('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    }
  }, [definition, scale, sequence]);

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
