import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene } from '../../lib/video/scenes';
import { fieldState } from '../../lib/video/field-plan';
import type { Field } from '../../lib/video/field';

/**
 * The particle field, as a layer in the DOM composition.
 *
 * A canvas the size of the frame, painted by the same `createField` the
 * exporter uses, from the same `fieldState`. The frame number comes from
 * Remotion and nothing else, so scrubbing the preview backwards shows the
 * field exactly as the export will have it.
 *
 * `three` is loaded on first mount rather than imported: it is the largest
 * dependency in the project and this is the only component that needs it.
 * Remotion waits for the import through `delayRender`, so a server render
 * never captures a frame before the field exists.
 */
export function FieldLayer({ scene, sceneFrame }: { scene: Scene; sceneFrame: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<Field | null>(null);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    const handle = delayRender('field');

    import('../../lib/video/field')
      .then(({ createField }) => {
        if (!alive) return;
        fieldRef.current = createField({ canvas, width, height });
        setReady((n) => n + 1);
      })
      .catch(() => {
        // No WebGL: the film still plays, without its sky. The cards never
        // depended on it.
      })
      .finally(() => continueRender(handle));

    return () => {
      alive = false;
      fieldRef.current?.dispose();
      fieldRef.current = null;
    };
  }, [width, height]);

  useLayoutEffect(() => {
    fieldRef.current?.render(fieldState(scene, sceneFrame, frame, fps));
  }, [frame, fps, scene, sceneFrame, ready]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
