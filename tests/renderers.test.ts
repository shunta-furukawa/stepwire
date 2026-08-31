import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCENE_TONE } from '../lib/video/scenes';
import { SCENE_TYPES } from '../lib/video/scene-types';

/**
 * The guard between two renderers of one scene.
 *
 * The DOM compositions and the canvas renderer draw the same `Scene[]`, and
 * nothing at runtime makes them agree. `Record<SceneType, …>` in each file
 * makes *coverage* a compile error, which is the strong half of the guarantee.
 * This is the half a type cannot express: that both files actually claim every
 * scene, and that neither decides on its own what is fact and what is analysis.
 *
 * It reads source rather than importing, because `video/scenes/index.tsx` pulls
 * in Remotion and a canvas, neither of which belongs in a unit test.
 */

const DOM = path.join(process.cwd(), 'video', 'scenes', 'index.tsx');
const CANVAS = path.join(process.cwd(), 'lib', 'video', 'canvas', 'draw.ts');

async function keysOf(file: string, record: string): Promise<string[]> {
  const source = await readFile(file, 'utf8');
  const start = source.indexOf(record);
  if (start === -1) throw new Error(`${record} not found in ${file}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('};', open);
  return [...source.slice(open, close).matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1]!);
}

describe('the two renderers', () => {
  it('both draw every scene type the sequence can produce', async () => {
    const dom = await keysOf(DOM, 'const SCENE_COMPONENTS');
    const canvas = await keysOf(CANVAS, 'const DRAWERS');

    expect([...dom].sort()).toEqual([...SCENE_TYPES].sort());
    expect([...canvas].sort()).toEqual([...SCENE_TYPES].sort());
  });

  it('agrees on which scenes are fact and which are analysis', () => {
    // Not a style choice: a scene labelled analysis on one surface and fact on
    // the other tells a viewer two different things about the same claim.
    expect(Object.keys(SCENE_TONE).sort()).toEqual([...SCENE_TYPES].sort());
    expect(SCENE_TONE.news).toBe('fact');
    expect(SCENE_TONE.context).toBe('analysis');
    expect(SCENE_TONE.impact).toBe('analysis');
  });

  it('neither renderer hardcodes a tone beside the shared registry', async () => {
    // The DOM scenes used to pass tone="analysis" as a literal. Once two files
    // can each answer the question, they can each answer it differently.
    const dom = await readFile(DOM, 'utf8');
    expect(dom).not.toMatch(/tone=["']analysis["']/);
    expect(dom).not.toMatch(/tone=["']fact["']/);
  });
});
