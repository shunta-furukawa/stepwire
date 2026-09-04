'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArticleVideoInput } from '@/lib/content/article';
import { drawThumbnail, thumbnailPlan } from '@/lib/video/canvas/thumbnail';

/**
 * The thumbnail, made on the device like the film.
 *
 * Drawn from the article at 1920×1080, shown small, and handed over three
 * ways because a phone has three: the share sheet (which is how a picture
 * reaches Photos on iOS), the clipboard, and a plain download for everything
 * else. Nothing leaves the device and nothing is rendered on a server.
 */

const WIDTH = 1920;
const HEIGHT = 1080;

/** YouTube refuses a thumbnail over this; a JPEG at 0.9 stays well under. */
const SIZE_LIMIT = 2 * 1024 * 1024;

type Output = { url: string; blob: Blob; bytes: number };

export function ThumbnailPanel({ article }: { article: ArticleVideoInput }) {
  const plan = useMemo(() => thumbnailPlan(article), [article]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus('描画中…');
    setNote('');
    try {
      const images = new Map<string, CanvasImageSource>();
      const sources = [plan.backdrop?.src, ...plan.tiles.map((t) => t.src)].filter(
        (src): src is string => Boolean(src),
      );
      await Promise.all(
        sources.map(async (src) => {
          try {
            const response = await fetch(`/${src.replace(/^\//, '')}`);
            if (response.ok) images.set(src, await createImageBitmap(await response.blob()));
          } catch {
            // A missing picture leaves a dark tile; the thumbnail still exists.
          }
        }),
      );

      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2d コンテキストを取得できません');
      drawThumbnail({ ctx, width: WIDTH, height: HEIGHT, images }, plan);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('画像を書き出せません');
      setOutput((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return { url: URL.createObjectURL(blob), blob, bytes: blob.size };
      });
      setStatus('');
      if (blob.size > SIZE_LIMIT) setNote('2MBを超えています。YouTubeは受け付けません');
    } catch (error) {
      setStatus('');
      setNote(error instanceof Error ? error.message : String(error));
    }
  }, [plan]);

  useEffect(() => {
    void render();
  }, [render]);

  const share = useCallback(async () => {
    if (!output) return;
    const file = new File([output.blob], `${article.slug}-thumbnail.jpg`, { type: 'image/jpeg' });
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: article.title });
        return;
      } catch {
        // Cancelled, or the sheet refused the file; fall through to the link.
      }
    }
    setNote('この端末では共有シートを使えません。「保存」から開いてください');
  }, [article.slug, article.title, output]);

  const copy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // The clipboard wants PNG; JPEG is only for the file.
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('PNGを作れません');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setNote('クリップボードにコピーしました');
    } catch {
      setNote('この端末では画像をコピーできません。「保存」から開いてください');
    }
  }, []);

  return (
    <section className="mt-xl space-y-md border-2 border-line-strong bg-raised p-md" aria-labelledby="thumbnail-heading">
      <h2 id="thumbnail-heading" className="font-mono text-micro font-bold uppercase tracking-wider">
        サムネイル
        <span className="ml-sm font-normal text-muted">
          {WIDTH}×{HEIGHT} · 記事から生成{output ? ` · ${(output.bytes / 1024).toFixed(0)} KB` : ''}
        </span>
      </h2>

      <div className="border-2 border-line bg-deep">
        <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }} />
      </div>

      {status ? <p className="font-mono text-micro text-muted">{status}</p> : null}
      {note ? <p className="font-mono text-micro text-accent-hot">{note}</p> : null}

      <div className="flex flex-wrap gap-sm">
        <button
          type="button"
          onClick={share}
          disabled={!output}
          className="border-2 border-accent bg-accent px-md py-sm font-mono text-micro font-bold uppercase tracking-wider text-on-accent disabled:opacity-50"
        >
          共有 · 写真に保存
        </button>
        {output ? (
          <a
            href={output.url}
            download={`${article.slug}-thumbnail.jpg`}
            className="border-2 border-line-strong px-md py-sm font-mono text-micro uppercase tracking-wider hover:bg-accent hover:text-on-accent"
          >
            保存
          </a>
        ) : null}
        <button
          type="button"
          onClick={copy}
          disabled={!output}
          className="border-2 border-line-strong px-md py-sm font-mono text-micro uppercase tracking-wider hover:bg-accent hover:text-on-accent disabled:opacity-50"
        >
          コピー
        </button>
        <button
          type="button"
          onClick={() => void render()}
          className="border-2 border-line-strong px-md py-sm font-mono text-micro uppercase tracking-wider text-muted hover:text-accent"
        >
          作り直す
        </button>
      </div>
    </section>
  );
}
