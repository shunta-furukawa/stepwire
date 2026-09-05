'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompositionDefinition } from '@/lib/video/compositions';
import type { SceneSequence } from '@/lib/video/scenes';
import { sceneStartFrames } from '@/lib/video/scenes';
import { drawScene } from '@/lib/video/canvas/draw';
import { fieldState } from '@/lib/video/field-plan';
import type { Field } from '@/lib/video/field';
import { loadImages } from '@/lib/video/canvas/images';
import { ensureFonts } from '@/lib/video/canvas/fonts';
import { formatDuration } from '@/lib/video/timing';

/**
 * The film, one frame at a time, drawn by the same renderer that exports it.
 *
 * There used to be a second renderer for previewing — a DOM composition — and
 * the two could disagree. Now the preview IS the export at a chosen frame:
 * what the slider shows is, pixel for pixel, what the file will contain. It
 * does not play; the export is the playback, and a scrubber is what a phone
 * needs to check a card.
 */
export function PreviewPanel({
  sequence,
  definition,
}: {
  sequence: SceneSequence;
  definition: CompositionDefinition;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<{ field: Field; canvas: HTMLCanvasElement } | null>(null);
  const imagesRef = useRef<Map<string, CanvasImageSource>>(new Map());
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(0);

  const starts = useMemo(() => sceneStartFrames(sequence), [sequence]);
  const last = Math.max(0, sequence.durationInFrames - 1);

  // Pictures and the field are loaded once per sequence, not per frame.
  useEffect(() => {
    let alive = true;
    const sources = sequence.scenes.flatMap((scene) => (scene.image ? [scene.image.src] : []));
    void (async () => {
      const [images, { createField }] = await Promise.all([
        loadImages(sources),
        import('@/lib/video/field').catch(() => ({ createField: null })),
        ensureFonts(),
      ]);
      if (!alive) return;
      imagesRef.current = images;
      if (createField && !fieldRef.current) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = definition.width;
          canvas.height = definition.height;
          fieldRef.current = {
            field: createField({ canvas, width: definition.width, height: definition.height }),
            canvas,
          };
        } catch {
          // No WebGL here: the preview is plainer, like the export would be.
        }
      }
      setReady((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
  }, [sequence, definition.width, definition.height]);

  useEffect(() => () => fieldRef.current?.field.dispose(), []);

  const draw = useCallback(
    (at: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== definition.width) {
        canvas.width = definition.width;
        canvas.height = definition.height;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let index = 0;
      starts.forEach((start, i) => {
        if (start <= at) index = i;
      });
      const scene = sequence.scenes[index];
      if (!scene) return;
      const sceneFrame = at - (starts[index] ?? 0);

      const gl = fieldRef.current;
      if (gl) {
        gl.field.resize(definition.width, definition.height);
        gl.field.render(fieldState(scene, sceneFrame, at, sequence.fps));
      }
      drawScene(
        {
          ctx,
          width: definition.width,
          height: definition.height,
          frame: sceneFrame,
          fps: sequence.fps,
          progress: sceneFrame / Math.max(1, scene.durationInFrames - 1),
          images: imagesRef.current,
          ...(gl ? { field: gl.canvas } : {}),
        },
        scene,
      );
    },
    [definition.height, definition.width, sequence, starts],
  );

  useEffect(() => {
    draw(Math.min(frame, last));
  }, [draw, frame, last, ready]);

  let current = 0;
  starts.forEach((start, i) => {
    if (start <= frame) current = i;
  });
  const scene = sequence.scenes[current];

  return (
    <section className="space-y-sm" aria-labelledby="preview-heading">
      <h2 id="preview-heading" className="font-mono text-micro font-bold uppercase tracking-wider">
        プレビュー
        <span className="ml-sm font-normal text-muted">
          書き出しと同じ描画 · {definition.width}×{definition.height}
        </span>
      </h2>
      <div className="border-2 border-line bg-deep">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ aspectRatio: `${definition.width} / ${definition.height}` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={last}
        value={Math.min(frame, last)}
        onChange={(event) => setFrame(Number(event.target.value))}
        aria-label="フレーム"
        className="w-full accent-[var(--color-accent)]"
      />
      <div className="flex items-center justify-between font-mono text-micro uppercase tracking-wide text-muted">
        <button
          type="button"
          className="px-sm py-xs hover:text-accent"
          onClick={() => setFrame(starts[Math.max(0, current - 1)] ?? 0)}
        >
          ← 前
        </button>
        <span>
          {scene?.id ?? '—'} · {formatDuration(Math.min(frame, last), sequence.fps)} /{' '}
          {formatDuration(sequence.durationInFrames, sequence.fps)}
        </span>
        <button
          type="button"
          className="px-sm py-xs hover:text-accent"
          onClick={() => setFrame(starts[Math.min(starts.length - 1, current + 1)] ?? last)}
        >
          次 →
        </button>
      </div>
    </section>
  );
}
