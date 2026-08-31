import type { Scene } from '../scenes';
import { color, font, fontSize, tracking } from '../../design/tokens';
import { wrapText } from './text';

/**
 * A canvas renderer for STEPWIRE scenes.
 *
 * The React compositions and this draw the SAME `Scene[]`, which is the project's
 * one structural idea applied once more: the article feeds the page and the
 * video, and now the scene feeds the DOM renderer and the canvas one. Neither
 * is authored; both are derived.
 *
 * Why a second renderer exists at all: a browser cannot encode DOM. Exporting a
 * video on the device means producing pixels the WebCodecs `VideoEncoder` can
 * take, and the only thing in a browser that produces pixels on demand is a
 * canvas. Rasterising the DOM instead would mean a screenshot library and its
 * approximations; drawing from the data is exact.
 *
 * The cost is real and worth stating: two renderers can drift. `tests/` covers
 * the line breaking, and `tests/tokens.test.ts` already stops the palette
 * drifting, but nothing yet asserts that a scene looks the same in both. That
 * is the open risk of this approach, not a detail.
 *
 * SCOPE: this is the export spike. It draws intro, headline, body and source
 * scenes well enough to measure encode throughput and judge quality on a real
 * phone. Figures, narration and the outro fall back to a plain card.
 */

/**
 * Design units, in the same 1080-class space the DOM theme uses.
 *
 * Scaled by the SHORT edge, not the width: a 16:9 frame is constrained by its
 * height, and scaling by width made every glyph 1.78x too large and ran the
 * body copy off the bottom of the frame. Both formats have a 1080 short edge,
 * so this reduces to 1.0 for each — which is exactly what `SCALE = 3` in
 * `video/styles/theme.ts` assumes.
 */
const BASE_SHORT_EDGE = 1080;

export interface DrawContext {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  /** Progress through this scene, 0 to 1. Drives the same reveals as the DOM. */
  progress: number;
}

function scaled(width: number, height: number) {
  const factor = Math.min(width, height) / BASE_SHORT_EDGE;
  return (value: number) => value * factor;
}

/** `600 48px "…"` — canvas wants one string, and order matters. */
function fontOf(weight: number, size: number, family: string) {
  return `${weight} ${size}px ${family}`;
}

/**
 * Draws text with letter-spacing, which canvas only gained recently and Safari
 * applies inconsistently. Drawing per character is slower but identical
 * everywhere, and these are short mono strings.
 */
function drawTracked(
  ctx: DrawContext['ctx'],
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
  return cursor - x;
}

/** The low-poly hatch, matching `.facet` in `app/globals.css`. */
function drawFacets(d: DrawContext) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  ctx.save();
  ctx.strokeStyle = color.fg;
  ctx.globalAlpha = 0.045;
  ctx.lineWidth = Math.max(1, px(2));
  const step = px(190);
  for (const slope of [Math.tan((60 * Math.PI) / 180), -Math.tan((60 * Math.PI) / 180)]) {
    for (let x = -height / Math.abs(slope) - step; x < width + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height / slope, height);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The persistent masthead. Same content as `WireBar`. */
function drawWireBar(d: DrawContext, meta: string | undefined) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const x = px(120);
  const y = px(150);

  ctx.textBaseline = 'alphabetic';
  ctx.font = fontOf(900, px(fontSize.h4 * 3), font.display);
  ctx.fillStyle = color.fg;
  const step = ctx.measureText('STEP').width;
  ctx.fillText('STEP', x, y);
  ctx.fillStyle = color.accent;
  ctx.fillText('WIRE', x + step, y);

  if (!meta) return;

  // `textAlign: 'right'` cannot compose with per-character drawing — each
  // character would be right-aligned to the same x. The origin is measured
  // instead, and the string is drawn left-to-right from there.
  const size = px(fontSize.small * 3);
  ctx.font = fontOf(400, size, font.mono);
  const spacing = size * tracking.wider;
  const text = meta.toUpperCase();
  const textWidth = [...text].reduce(
    (total, char) => total + ctx.measureText(char).width + spacing,
    0,
  );
  ctx.fillStyle = color.muted;
  drawTracked(ctx, text, width - px(120) - textWidth, y, spacing);
}

/** The step timeline along the bottom. Same role as `ProgressRail`. */
function drawProgressRail(d: DrawContext, index: number, total: number) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const left = px(120);
  const right = width - px(120);
  const y = height - px(150);
  const gap = px(14);
  const segment = (right - left - gap * (total - 1)) / total;

  ctx.save();
  for (let i = 0; i < total; i += 1) {
    ctx.fillStyle = i === index ? color.accent : i < index ? color.fg : color.lineStrong;
    ctx.fillRect(left + i * (segment + gap), y, segment, px(8));
  }
  ctx.restore();
}

/** The chip's height, for laying out the block that contains it. */
function measureLabelChip(d: DrawContext) {
  const px = scaled(d.width, d.height);
  return px(fontSize.base * 3) + px(24) * 2;
}

function drawLabelChip(d: DrawContext, label: string, tone: 'fact' | 'analysis', y: number) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const x = px(120);
  const size = px(fontSize.base * 3);
  const padX = px(48);
  const padY = px(24);

  ctx.font = fontOf(700, size, font.mono);
  const spacing = size * tracking.wider;
  const text = label.toUpperCase();
  const textWidth = [...text].reduce(
    (total, char) => total + ctx.measureText(char).width + spacing,
    0,
  );
  const arrow = size * 0.9;
  const boxWidth = padX * 2 + arrow + px(24) + textWidth;
  const boxHeight = size + padY * 2;

  ctx.fillStyle = tone === 'analysis' ? color.accent : color.fg;
  ctx.fillRect(x, y, boxWidth, boxHeight);

  // The arrow motif, as a triangle rather than an imported glyph.
  ctx.fillStyle = tone === 'analysis' ? color.onAccent : color.accent;
  const ax = x + padX;
  const ay = y + boxHeight / 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay - arrow / 2);
  ctx.lineTo(ax + arrow, ay);
  ctx.lineTo(ax, ay + arrow / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color.onAccent;
  ctx.textBaseline = 'middle';
  drawTracked(ctx, text, ax + arrow + px(24), ay, spacing);
  ctx.textBaseline = 'alphabetic';

  return boxHeight;
}

/**
 * Lays out body copy without drawing it.
 *
 * Separate from drawing because the block has to be measured before it can be
 * placed: the DOM version gets vertical centring from flexbox, and a canvas
 * gets it by computing the height first.
 */
function layoutBody(d: DrawContext, text: string, size: number, weight = 500) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const x = px(120);
  // A 16:9 frame is wider than its measure should be; the DOM caps it at 82%.
  const maxWidth = Math.min(width - x * 2, width * (width > height ? 0.82 : 1));

  ctx.font = fontOf(weight, size, font.display);
  const lines = wrapText(text, maxWidth, (line) => ctx.measureText(line).width);
  const lineHeight = size * 1.35;
  return { lines, lineHeight, x, size, weight, blockHeight: lines.length * lineHeight };
}

type BodyLayout = ReturnType<typeof layoutBody>;

function paintBody(d: DrawContext, layout: BodyLayout, top: number, fill: string = color.fg) {
  const { ctx } = d;
  ctx.font = fontOf(layout.weight, layout.size, font.display);
  ctx.fillStyle = fill;
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, layout.x, top + layout.size + i * layout.lineHeight);
  });
  return layout.blockHeight;
}

/**
 * Draws one frame of one scene.
 *
 * Deliberately synchronous and allocation-light: this runs once per frame of
 * the export, so an extra object per call is an extra object per frame.
 */
export function drawScene(d: DrawContext, scene: Scene, tone: 'fact' | 'analysis') {
  const { ctx, width, height } = d;
  const px = scaled(width, height);

  const ground =
    scene.type === 'intro' || scene.type === 'outro'
      ? color.deep
      : tone === 'analysis'
        ? color.raised
        : color.deep;

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);
  drawFacets(d);

  if (scene.type === 'intro' || scene.type === 'outro') {
    // The wordmark, centred, with the rule under it.
    const size = px(fontSize.h1 * 3);
    ctx.font = fontOf(900, size, font.display);
    ctx.textAlign = 'center';
    ctx.fillStyle = color.fg;
    const stepWidth = ctx.measureText('STEP').width;
    const wireWidth = ctx.measureText('WIRE').width;
    const total = stepWidth + wireWidth;
    const left = width / 2 - total / 2;
    ctx.textAlign = 'left';
    ctx.fillText('STEP', left, height / 2);
    ctx.fillStyle = color.accent;
    ctx.fillText('WIRE', left + stepWidth, height / 2);

    ctx.fillStyle = color.accent;
    ctx.fillRect(left, height / 2 + px(40), total * Math.min(1, d.progress * 2), px(10));

    if (scene.meta) {
      ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
      ctx.fillStyle = color.muted;
      drawTracked(ctx, scene.meta.toUpperCase(), left, height / 2 + px(140), px(4));
    }
    drawProgressRail(d, scene.index, scene.total);
    return;
  }

  drawWireBar(d, scene.type === 'source' ? undefined : scene.label);

  // The band the content may occupy: below the masthead, above the rail. The
  // block is measured, then centred in it — a fixed top let long copy run off
  // the bottom of the frame and through the progress rail.
  const top = px(150) + px(80);
  const bottom = height - px(150) - px(60);

  const isHeadline = scene.type === 'headline';
  const bodySize = px(fontSize[isHeadline ? 'h2' : 'h4'] * 3);
  const body = scene.text ? layoutBody(d, scene.text, bodySize, isHeadline ? 900 : 500) : null;

  const metaSize = px(fontSize.lead * 2.4);
  const meta = isHeadline && scene.meta ? layoutBody(d, scene.meta, metaSize, 400) : null;

  const markHeight = isHeadline
    ? 0
    : scene.label
      ? measureLabelChip(d)
      : px(8);
  const markGap = isHeadline ? 0 : px(60);
  const metaGap = meta ? px(50) : 0;

  const blockHeight =
    markHeight + markGap + (body?.blockHeight ?? 0) + metaGap + (meta?.blockHeight ?? 0);

  let cursor = Math.max(top, top + (bottom - top - blockHeight) / 2);

  if (!isHeadline) {
    if (scene.label) {
      drawLabelChip(d, scene.label, tone, cursor);
    } else {
      ctx.fillStyle = tone === 'analysis' ? color.accent : color.fg;
      ctx.fillRect(px(120), cursor, px(96), px(8));
    }
    cursor += markHeight + markGap;
  }

  if (body) cursor += paintBody(d, body, cursor);
  if (meta) paintBody(d, meta, cursor + metaGap, color.muted);

  drawProgressRail(d, scene.index, scene.total);
}
